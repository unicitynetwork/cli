# Test Infrastructure Analysis - Unicity CLI BATS Test Suite

## Executive Summary

**Total Tests:** 205
**Passing:** 101 (49%)
**Failing:** 90 (44%)
**Skipped:** 14 (7%)

The test suite has two critical infrastructure bugs affecting ~90 tests:

1. **GENERATED_ADDRESS unbound variable** - Affects address generation in all test files
2. **$status unbound variable** - Affects conditional checks without `run` wrapper

---

## Root Cause Analysis

### Issue #1: GENERATED_ADDRESS Unbound Variable (PRIMARY ISSUE)

**Affected Files:** 26 test files
**Failure Count:** ~80 tests

#### The Problem

Tests call `generate_address()` using BATS `run` command and expect a `GENERATED_ADDRESS` variable to be set:

```bash
# From test_double_spend_advanced.bats:49-50
run generate_address "$BOB_SECRET" "nft"
local bob_addr="$GENERATED_ADDRESS"  # ❌ FAILS: GENERATED_ADDRESS not set
```

**Error Message:**
```
/home/vrogojin/cli/tests/edge-cases/test_double_spend_advanced.bats: line 50: GENERATED_ADDRESS: unbound variable
```

#### Why It Fails

1. **BATS `run` behavior:** When you use `run command`, BATS captures the command output in `$output` and exit code in `$status`. It does **not** export variables set by the function.

2. **Current `generate_address()` implementation** (token-helpers.bash:44-86):
   - Returns address on stdout: `printf "%s" "$address"`
   - Does NOT set `GENERATED_ADDRESS` variable
   - Designed to be used with command substitution: `addr=$(generate_address "secret" "nft")`

3. **Test expectation mismatch:**
   - Tests expect: `GENERATED_ADDRESS` to be populated after `run generate_address`
   - Reality: BATS captures output in `$output`, not in a custom variable

#### Affected Test Files

```bash
tests/edge-cases/test_double_spend_advanced.bats  # 9 tests
tests/edge-cases/test_concurrency.bats            # 2 tests
tests/edge-cases/test_network_edge.bats           # 1 test
tests/edge-cases/test_state_machine.bats          # 6 tests
tests/edge-cases/test_file_system.bats            # 1 test
# ... and more across security/ and functional/
```

**Pattern in failing tests:**
```bash
run generate_address "$SECRET" "nft"
local addr="$GENERATED_ADDRESS"  # ❌ Always fails
```

---

### Issue #2: $status Unbound Variable (SECONDARY ISSUE)

**Affected Files:** 10 test files
**Failure Count:** ~10 tests

#### The Problem

Tests check `$status` without first calling a command with `run`:

```bash
# From test_network_edge.bats:48-54
SECRET="$TEST_SECRET" run_cli mint-token \
  --preset nft \
  --endpoint "http://localhost:9999" \
  -o "$token_file" || true

# Should fail with connection error
if [[ $status -ne 0 ]]; then  # ❌ FAILS: $status not set by run_cli
  assert_output_contains "connect\|ECONNREFUSED\|refused\|unreachable" || true
```

**Error Message:**
```
/home/vrogojin/cli/tests/edge-cases/test_network_edge.bats: line 54: status: unbound variable
```

#### Why It Fails

1. **`run_cli()` does not use BATS `run`:** The helper function `run_cli()` in common.bash:197-241 executes commands directly and captures output, but does NOT set the BATS `$status` variable.

2. **BATS `$status` is only set by `run`:** The `$status` variable is a BATS built-in that's only populated when using the `run` command prefix.

3. **Tests use `run_cli` then check `$status`:** This is a conceptual error - `run_cli` returns an exit code but doesn't populate `$status`.

#### Affected Test Files

```bash
tests/edge-cases/test_network_edge.bats           # 3 uses
tests/edge-cases/test_file_system.bats            # 3 uses
tests/security/test_access_control.bats           # 2 uses
tests/security/test_input_validation.bats         # 11 uses
tests/security/test_double_spend.bats             # 3 uses
tests/security/test_authentication.bats           # 1 use
tests/security/test_data_integrity.bats           # 4 uses
tests/helpers/test_validation_functions.bats      # 3 uses
```

**Pattern in failing tests:**
```bash
run_cli some-command || true
if [[ $status -ne 0 ]]; then  # ❌ $status not set
  # handle error
fi
```

---

## Detailed Analysis: BATS vs Helper Function Patterns

### BATS `run` Command

**How it works:**
```bash
run command arg1 arg2
# After execution:
# - $status contains exit code
# - $output contains stdout+stderr
# - $lines array contains output lines
```

**Limitations:**
- Functions cannot export variables back to test scope
- Only captures stdio and exit code
- Variables set inside the function are lost

### Helper Function Patterns in This Codebase

#### Pattern A: Return via stdout (current)
```bash
# Function: token-helpers.bash:44-86
generate_address() {
  local secret="${1:?Secret required}"
  local address=$(...)
  printf "%s" "$address"  # Return on stdout
}

# Correct usage:
addr=$(generate_address "secret" "nft")  # ✓ Works

# Incorrect usage (in tests):
run generate_address "secret" "nft"
local addr="$GENERATED_ADDRESS"  # ❌ Variable not set
```

#### Pattern B: Export via global variable
```bash
# Function: token-helpers.bash:100-156
mint_token() {
  local output_file="${3:-}"
  # ... create token ...
  export MINT_OUTPUT_FILE="$output_file"  # ✓ Exports variable
}

# Usage:
run mint_token "secret" "nft" "$file"
# $MINT_OUTPUT_FILE is now available  # ✓ Works
```

---

## Solutions

### Solution #1: Fix generate_address() Usage

**Option A: Export GENERATED_ADDRESS in function** (Recommended)

Modify `generate_address()` in token-helpers.bash to export the address:

```bash
# Add after line 82 in token-helpers.bash
generate_address() {
  # ... existing code ...

  # Print address to stdout
  printf "%s" "$address"

  # NEW: Also export for BATS tests
  export GENERATED_ADDRESS="$address"  # ✓ Makes tests work

  debug "Generated address: $address"
  return 0
}
```

**Changes needed:**
- File: `/home/vrogojin/cli/tests/helpers/token-helpers.bash`
- Line: 82 (after `printf "%s" "$address"`)
- Add: `export GENERATED_ADDRESS="$address"`

**Impact:** Fixes ~80 failing tests across all test suites

---

**Option B: Fix all test files** (Not recommended - too many changes)

Change every test from:
```bash
run generate_address "$SECRET" "nft"
local addr="$GENERATED_ADDRESS"
```

To:
```bash
run generate_address "$SECRET" "nft"
local addr="$output"  # Use BATS $output variable
```

**Impact:** Requires changing 26+ test files with 80+ occurrences

---

### Solution #2: Fix $status Checks

**Option A: Wrap run_cli calls with BATS run** (Recommended for consistency)

Change tests from:
```bash
run_cli mint-token --preset nft || true
if [[ $status -ne 0 ]]; then  # ❌ Fails
```

To:
```bash
run run_cli mint-token --preset nft
if [[ $status -ne 0 ]]; then  # ✓ Works
```

**Why this works:** BATS `run` captures the exit code from `run_cli` into `$status`

---

**Option B: Capture exit code manually** (Alternative)

Change tests from:
```bash
run_cli mint-token --preset nft || true
if [[ $status -ne 0 ]]; then  # ❌ Fails
```

To:
```bash
run_cli mint-token --preset nft || exit_code=$?
if [[ $exit_code -ne 0 ]]; then  # ✓ Works
```

---

**Option C: Make run_cli export $status** (Not recommended - breaks BATS conventions)

Modify run_cli() to export status:
```bash
run_cli() {
  # ... existing code ...
  output=$("${full_cmd[@]}" "$@" 2>&1) || exit_code=$?

  # NEW: Export as $status for BATS compatibility
  export status=$exit_code  # ⚠️ Breaks BATS conventions

  return "$exit_code"
}
```

**Not recommended because:**
- BATS `$status` should only be set by `run` command
- Creates confusion about when `$status` is available
- Violates BATS design patterns

---

## Recommended Fix Plan

### Phase 1: Fix GENERATED_ADDRESS (High Priority)

**File:** `/home/vrogojin/cli/tests/helpers/token-helpers.bash`

**Change at line 82:**
```bash
# Current (line 81-85):
  # Print address to stdout
  printf "%s" "$address"

  debug "Generated address: $address"
  return 0

# NEW (add export):
  # Print address to stdout
  printf "%s" "$address"

  # Export for BATS test compatibility
  export GENERATED_ADDRESS="$address"

  debug "Generated address: $address"
  return 0
```

**Estimated Impact:** Fixes 80+ tests immediately

---

### Phase 2: Fix $status Checks (Medium Priority)

**Option A: Pattern matching replacement**

For all files in tests/:
```bash
# Find pattern:
run_cli .* \|\| true\nif \[\[ \$status

# Replace with:
run run_cli ...
if [[ $status
```

**Files to update:**
```
tests/edge-cases/test_network_edge.bats
tests/edge-cases/test_file_system.bats
tests/security/test_access_control.bats
tests/security/test_input_validation.bats
tests/security/test_double_spend.bats
tests/security/test_authentication.bats
tests/security/test_data_integrity.bats
tests/helpers/test_validation_functions.bats
```

**Estimated changes:** 27 locations across 8 files

---

## Verification Plan

### Step 1: Apply GENERATED_ADDRESS Fix

```bash
# Edit token-helpers.bash
# Run quick test
bats tests/edge-cases/test_double_spend_advanced.bats

# Expected: All GENERATED_ADDRESS errors should be gone
```

### Step 2: Apply $status Fixes

```bash
# Edit test files
# Run affected tests
bats tests/edge-cases/test_network_edge.bats
bats tests/security/test_input_validation.bats

# Expected: $status unbound errors should be gone
```

### Step 3: Full Test Suite

```bash
# Run all tests
npm test

# Expected pass rate: 95%+ (up from 49%)
```

---

## Additional Findings

### Variable Scoping in BATS

**Key insight:** BATS functions have limited variable export capabilities:

1. **Variables set in helper functions** are NOT available in test scope when using `run`
2. **Exported variables** (using `export`) ARE available
3. **Return via stdout** requires command substitution: `var=$(function)`

### Proper Pattern Examples

**Pattern 1: Export for BATS compatibility**
```bash
# Helper function
mint_token() {
  export MINT_OUTPUT_FILE="$file"  # ✓ Available in tests
}

# Test
run mint_token "secret" "nft" "$file"
echo "$MINT_OUTPUT_FILE"  # ✓ Works
```

**Pattern 2: Command substitution (no run)**
```bash
# Helper function
generate_address() {
  printf "%s" "$address"  # Return on stdout
}

# Test
addr=$(generate_address "secret" "nft")  # ✓ Works (no run)
```

**Pattern 3: BATS run with output capture**
```bash
# Test
run generate_address "secret" "nft"
echo "$output"  # ✓ Works (BATS variable)
```

---

## File-by-File Breakdown

### Files with GENERATED_ADDRESS Issues

| File | Tests Affected | Lines |
|------|----------------|-------|
| test_double_spend_advanced.bats | 9 | 50, 53, 103, 106, 165, 209, 212, 256, 313, 320, 364, 445, 448, 501, 512 |
| test_concurrency.bats | 2 | 110, 113, 315 |
| test_network_edge.bats | 1 | 323 |
| test_state_machine.bats | 6 | 63, 123, 150, 153, 219, 309 |
| test_file_system.bats | 1 | 262 |

### Files with $status Issues

| File | Occurrences | Pattern |
|------|-------------|---------|
| test_network_edge.bats | 3 | `run_cli ... \|\| true` then `$status` |
| test_file_system.bats | 3 | `run_cli ... \|\| true` then `$status` |
| test_access_control.bats | 2 | `run_cli ... \|\| true` then `$status` |
| test_input_validation.bats | 11 | `run_cli ... \|\| true` then `$status` |
| test_double_spend.bats | 3 | `run_cli ... \|\| true` then `$status` |
| test_authentication.bats | 1 | `run_cli ... \|\| true` then `$status` |
| test_data_integrity.bats | 4 | `run_cli ... \|\| true` then `$status` |

---

## Conclusion

The test infrastructure has two systemic issues:

1. **GENERATED_ADDRESS not exported** - Simple one-line fix in token-helpers.bash
2. **$status misuse** - Pattern needs updating in 8 test files

**Recommended approach:**
1. Fix GENERATED_ADDRESS export (5 minutes)
2. Fix $status checks with find/replace (30 minutes)
3. Run full test suite
4. Expected result: 95%+ pass rate

**Estimated effort:** 1 hour to fix all issues

---

## Next Steps

1. **Implement GENERATED_ADDRESS export** in token-helpers.bash:82
2. **Update $status checks** using pattern replacement
3. **Run verification suite**
4. **Document patterns** in test documentation

---

*Generated: 2025-11-11*
*Analysis based on: 205 total tests, 90 failing (44%)*
