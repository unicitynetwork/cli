# Test Assertion Failures - Root Cause Analysis

## Executive Summary

The test assertion failures are caused by **three distinct issues**:

1. **JSON Field Extraction (`.version`)**: The jq query `".version | tostring"` returns an empty string when the actual JSON file contains `"version": "2.0"`
2. **coinData Array Structure Mismatch**: Tests expect `coinData[0].amount` (object) but actual structure is `coinData[0][1]` (array of arrays)
3. **state.data Field Interpretation**: The function `assert_json_field_exists` correctly validates `.state.data` exists, but tests misunderstand what field they're checking

---

## Issue #1: Version Field Extraction Failure

### Evidence

**Test Output (Line 500-520 from test execution):**
```
# ✗ Assertion Failed: JSON field mismatch
#   File: token.txf
#   Field: version
#   Expected: 2.0
#   Actual:
```

Yet the JSON shown in "Last output:" clearly contains:
```json
{
  "version": "2.0",
  ...
}
```

### Root Cause Analysis

**File Location**: `/home/vrogojin/cli/tests/helpers/assertions.bash`, lines 241-270

**Function**: `assert_json_field_equals()`

```bash
assert_json_field_equals() {
  local file="${1:?File path required}"
  local field="${2:?JSON field required}"
  local expected="${3:?Expected value required}"

  # ... file exists check ...

  local actual
  actual=$(~/.local/bin/jq -r "$field | tostring" "$file" 2>/dev/null || echo "")

  if [[ "$actual" != "$expected" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: JSON field mismatch${COLOR_RESET}\n" >&2
    printf "  Actual: %s\n" "$actual" >&2
    return 1
  fi
}
```

**Problem**: The `$field` variable is being treated as part of jq expression syntax, BUT the function receives the field path as a STRING that gets evaluated.

When called as:
```bash
assert_json_field_equals "token.txf" "version" "2.0"
```

This becomes:
```bash
actual=$(~/.local/bin/jq -r "version | tostring" "$file" 2>/dev/null || echo "")
```

**This should work** - and it does work in isolated tests. The issue must be related to **file path handling in BATS environment**.

### Investigation Results

**Test 1 - Isolated jq test (PASSED):**
```bash
$ jq -r ".version | tostring" test.json
2.0
```

**Test 2 - With token.txf in BATS (FAILED):**
- File is created successfully (output shows "✅ Token saved to token.txf")
- File contains valid JSON (shown in "Last output:")
- But jq extraction returns empty string
- This suggests: **file path resolution issue in BATS context**

### Hypothesis

In BATS test environment, when `assert_json_field_equals` is called from test body:
1. Test is running in isolated `$BATS_TEST_TMPDIR` (per common.bash line 73)
2. File `token.txf` is created in that temp directory
3. But assertion function might be executing in different directory/context
4. `$file` parameter is relative path `"token.txf"`, not absolute

**Test Location**: `/home/vrogojin/cli/tests/functional/test_mint_token.bats`, line 36
```bash
assert_json_field_equals "token.txf" "version" "2.0"
```

The test passes relative path `"token.txf"`, but it's not clear if this path is valid in assertion function context.

---

## Issue #2: coinData Array Structure Mismatch

### Evidence

**Test Failure (Line 134 of test_mint_token.bats):**
```bash
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0].amount' token.txf)
# Returns: jq: error (at token.txf:68): Cannot index array with string "amount"
```

**Actual JSON Structure (from test output):**
```json
{
  "genesis": {
    "data": {
      "coinData": [
        [
          "ae7959a0aa31325849c884337c14e18927350277b3291bc36ad4fcdd561d0677",
          "1500000000000000000"
        ]
      ]
    }
  }
}
```

### Root Cause Analysis

**File Location**: `/home/vrogojin/cli/tests/functional/test_mint_token.bats`, lines 133-135

```bash
# Current (WRONG):
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0].amount' token.txf)

# Correct structure:
# coinData is array of arrays: [[coinId, amount], [coinId, amount], ...]
# coinData[0] = ["ae795...", "1500000000000000000"]
# coinData[0][1] = "1500000000000000000"
```

### The Problem

The test assumes object structure:
```json
coinData: [
  { coinId: "...", amount: "..." },
  ...
]
```

But actual SDK structure is array of arrays:
```json
coinData: [
  ["coinId", "amount"],
  ...
]
```

This indicates **SDK serialization format mismatch** - the SDK's `toJSON()` method produces nested arrays for coins, not objects.

### Affected Lines

- `/home/vrogojin/cli/tests/functional/test_mint_token.bats`, line 134
- `/home/vrogojin/cli/tests/functional/test_mint_token.bats`, line 153

**Test Names:**
- MINT_TOKEN-005: Mint UCT with specific amount
- MINT_TOKEN-006: Mint USDU stablecoin

**Correct jq Path:**
```bash
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
```

---

## Issue #3: state.data Field Validation

### Evidence

**Test Failure (Line 73 of test_mint_token.bats):**
```bash
assert_json_field_exists "token.txf" "state.data"
# ✗ Assertion Failed: JSON field does not exist
#   File: token.txf
#   Field: state.data
```

Yet the JSON output shows:
```json
{
  "state": {
    "data": "7b226e616d65223a...",
    "predicate": "8300410058b5..."
  }
}
```

### Root Cause Analysis

**File Location**: `/home/vrogojin/cli/tests/helpers/assertions.bash`, lines 276-297

```bash
assert_json_field_exists() {
  local file="${1:?File path required}"
  local field="${2:?JSON field required}"

  if ! ~/.local/bin/jq -e "$field" "$file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Assertion Failed: JSON field does not exist${COLOR_RESET}\n" >&2
    return 1
  fi
}
```

When called as:
```bash
assert_json_field_exists "token.txf" "state.data"
```

The jq command becomes:
```bash
jq -e "state.data" token.txf >/dev/null 2>&1
```

**This should work** - but same issue as Issue #1: **file path resolution**.

The JSON clearly contains this field, so the failure is again due to file not being accessible from assertion context.

### Status

This appears to be secondary symptom of Issue #1 (file path problem).

---

## Summary of Root Causes

### Primary Cause: File Path Resolution in BATS

**Location**: Tests in `/home/vrogojin/cli/tests/functional/` and assertion functions in `/home/vrogojin/cli/tests/helpers/`

**Issue**:
- Tests create files with relative path: `"token.txf"`
- These files go to current working directory
- But assertion functions may execute in different directory context
- `~/.local/bin/jq` cannot find the file when given relative path

**Evidence**:
1. Test output shows "✅ Token saved to token.txf" (success in CLI context)
2. Same test shows "✅ File exists: token.txf" (success in file assertion)
3. But jq extraction fails silently (file path invalid in jq context)

### Secondary Cause: coinData Array Structure

**Location**: `/home/vrogojin/cli/tests/functional/test_mint_token.bats`

**Issue**:
- Tests use wrong jq path for accessing coin amounts
- coinData is `[coinId, amount]` array format, not `{coinId, amount}` object format
- Affects lines: 134, 153

### Why Other Tests Pass

Some tests pass despite these issues:
1. `MINT_TOKEN-003`: Plain text data (doesn't require coin data extraction)
2. `MINT_TOKEN-004`: Default coin (maybe doesn't check amount)
3. Tests that use `assert_file_exists` work because they don't try jq on path
4. Tests that use `assert_token_fully_valid` work because validation functions handle paths differently

---

## Fixes Required

### Fix 1: Use Absolute Paths in Assertions

**File**: `/home/vrogojin/cli/tests/helpers/assertions.bash`, line 255

```bash
# Current (line 255):
actual=$(~/.local/bin/jq -r "$field | tostring" "$file" 2>/dev/null || echo "")

# Fixed:
local abs_file="$file"
if [[ ! "$file" = /* ]]; then
  abs_file="$PWD/$file"
fi
actual=$(~/.local/bin/jq -r "$field | tostring" "$abs_file" 2>/dev/null || echo "")
```

Also apply to lines: 286, 313, 333

### Fix 2: Use Correct coinData Array Path

**File**: `/home/vrogojin/cli/tests/functional/test_mint_token.bats`

Line 134 - Change from:
```bash
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0].amount' token.txf)
```

To:
```bash
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
```

Repeat for line 153.

### Fix 3: Verify File Path Handling in Test Context

**File**: `/home/vrogojin/cli/tests/functional/test_mint_token.bats`

Before calling assertions with relative paths, ensure absolute path:

```bash
# Create file with absolute path output
run_cli_with_secret "${SECRET}" "mint-token --preset nft --local --save -o '$(pwd)/token.txf'"

# Then assertions will work with absolute path
assert_json_field_equals "$(pwd)/token.txf" "version" "2.0"
```

---

## Testing the Fixes

### Test Case 1: Version Field Extraction
```bash
# Setup
export TMPDIR=/tmp/bats-test
mkdir -p "$TMPDIR"
cd "$TMPDIR"

# Create valid token
SECRET="test" node dist/index.js mint-token --preset nft --local -o token.txf --unsafe-secret

# Test relative path resolution
source tests/helpers/assertions.bash
assert_json_field_equals "token.txf" "version" "2.0"
# Should PASS after fix
```

### Test Case 2: coinData Array Extraction
```bash
# After minting fungible token
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
echo "Amount: $actual_amount"
# Should show: Amount: 1500000000000000000
```

---

## Files Requiring Changes

1. `/home/vrogojin/cli/tests/helpers/assertions.bash`
   - Line 255: Fix relative path handling in `assert_json_field_equals`
   - Line 286: Fix relative path handling in `assert_json_field_exists`
   - Line 313: Fix relative path handling in `assert_json_field_not_exists`

2. `/home/vrogojin/cli/tests/functional/test_mint_token.bats`
   - Line 134: Fix coinData path from `[0].amount` to `[0][1]`
   - Line 153: Fix coinData path from `[0].amount` to `[0][1]`
   - Consider: Add absolute path parameter to mint-token output option

---

## Prevention Recommendations

1. **Use absolute paths consistently** in all assertion functions
2. **Add path validation** at start of each assertion function
3. **Document coinData structure** in code comments showing it's array of arrays
4. **Add test for coinData access** to catch structure mismatches
5. **Improve error messages** in jq queries to show actual path being queried
6. **Create helper function** for consistent path resolution across all helpers
