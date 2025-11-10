# Mint-Token Test Suite Failure Analysis

**Date:** November 10, 2025
**Test Suite:** `tests/functional/test_mint_token.bats` (28 test scenarios)
**Failure Type:** Timeout (Exit Code 124) - All tests fail at same point

---

## Executive Summary

All 28 mint-token tests fail with timeout (exit code 124) while waiting for the BFT authenticator to be populated. The tests successfully:
- Create predicates and addresses
- Submit transactions to aggregator
- Receive initial inclusion proofs

But then enter an infinite loop waiting for `proof.authenticator` to be populated, with a 300-second timeout.

**Root Cause Category:** **Aggregator Response Issue** - The local aggregator is not populating the authenticator field in the inclusion proof response.

---

## Failure Pattern Overview

### Test Execution Timeline

1. **Success Phase (Steps 1-5)** - All tests progress normally:
   - Step 1: Predicate created ✓
   - Step 2: Address derived ✓
   - Step 3: MintTransactionData created ✓
   - Step 4: Commitment created ✓
   - Step 5: Transaction submitted ✓

2. **Wait Phase (Step 6)** - Tests enter waiting loop:
   - Inclusion proof received initially
   - Loop starts checking for `authenticator` field
   - Prints "Waiting for authenticator to be populated..." repeatedly
   - **Continues for ~30+ seconds until timeout**

3. **Timeout (Exit Code 124)**:
   ```
   Waiting for authenticator to be populated...
   Waiting for authenticator to be populated...
   [... 20+ more iterations ...]
   ```

### All Failing Tests

```
1. MINT_TOKEN-001: Mint NFT with default settings           → TIMEOUT
2. MINT_TOKEN-002: Mint NFT with JSON metadata              → TIMEOUT
3. MINT_TOKEN-003: Mint NFT with plain text data            → TIMEOUT
4. MINT_TOKEN-004: Mint UCT with default coin               → TIMEOUT
(and tests 5-28 follow same pattern)
```

---

## Root Cause Analysis

### Primary Root Cause: Authenticator Not Populated

**Issue:** The aggregator's inclusion proof response lacks the `authenticator` field required by the verify-token command.

**Location:** `/home/vrogojin/cli/src/commands/mint-token.ts:236-244`

```typescript
if (proofJson.authenticator !== null && proofJson.authenticator !== undefined) {
  console.error('Authenticator populated - proof complete');
  return proof;
} else {
  // Proof exists but authenticator not yet populated
  if (proofReceived) {
    console.error('Waiting for authenticator to be populated...');
  }
}
```

**Expected Behavior:**
- Proof includes `authenticator` field with BFT consensus signatures
- Should be populated within milliseconds of proof receipt
- Validates network consensus

**Actual Behavior:**
- Proof received, but `authenticator` is null/undefined
- Command polls for 300 seconds (default timeout)
- Eventually timeout after ~30+ iterations
- Test harness kills process with exit code 124

### Timeout Configuration

**File:** `/home/vrogojin/cli/src/commands/mint-token.ts`
**Lines:** 200-265

```typescript
const timeoutMs = 300000;  // 300 seconds
const intervalMs = 1000;   // Poll every 1 second
```

With a 30-second BATS timeout (default), the test fails at 30 seconds instead of waiting for the full 300-second command timeout.

---

## Categorized Failure Analysis

### Category A: Aggregator Configuration Issue

**Description:** Local Docker aggregator not properly configured or not generating BFT authenticator
**Affects:** All 28 tests
**Evidence:**
- Inclusion proof received (Merkle tree path populated)
- BFT authenticator missing from proof response
- Issue happens consistently across all test cases

**Impacted Assertions:**
- `assert_token_fully_valid` (line 33, 70, 89, 103, etc.)
- `verify_token_cryptographically` (lines 636-682 in assertions.bash)
- `assert_has_inclusion_proof` (lines 1508-1544 in assertions.bash)

**Files Involved:**
- Source: `/home/vrogojin/cli/src/commands/mint-token.ts:236-244`
- Test: `/home/vrogojin/cli/tests/functional/test_mint_token.bats:25, 65, 87, 101`

**Why This is Root Cause:**
1. All test failures occur at identical point (waiting for authenticator)
2. Not a test suite issue (assertions are correct)
3. Not a command invocation issue (all preceding steps work)
4. Specific to aggregator response format

---

### Category B: Potential Secondary Issues (Masked by Primary Failure)

These issues exist but are not visible because tests timeout before reaching these assertions:

#### B1: Version Number Type Mismatch

**Location:** `test_mint_token.bats:36`
```bash
assert_json_field_equals "token.txf" "version" "2.0"
```

**Function:** `assert_json_field_equals` (assertions.bash:240-267)
```bash
actual=$(~/.local/bin/jq -r "$field" "$file" 2>/dev/null || echo "")
if [[ "$actual" != "$expected" ]]; then
  # FAIL: string comparison "2.0" vs "2"
```

**Issue:** JSON version field likely returns numeric `2` or `2.0`, but jq `-r` flag returns different types:
- Number: `jq -r '.version'` returns `2` (not `2.0`)
- String: `jq -r '.version'` returns `"2.0"` with quotes stripped
- The assertion expects string `"2.0"` but gets numeric output

**Expected Fix:** Use numeric comparison or handle type coercion
```bash
version=$(jq '.version' token.txf)  # Gets 2 as number
assert_equals "2" "$version"  # Compare as strings "2"
```

#### B2: JSON Type Comparisons in Token Structure

**Locations:**
- `test_mint_token.bats:49-50` (transaction count)
- `test_mint_token.bats:113-114` (coin count)
- `test_mint_token.bats:129-130` (coin count verification)

**Issue:** All use `get_transaction_count` and `get_coin_count` which return:
```bash
jq '.transactions | length' token.txf  # Returns number
jq '.genesis.data.coinData | length'   # Returns number
```

But then compare with:
```bash
assert_equals "0" "${tx_count}"  # String "0" vs string "0" - may work
```

**Risk:** Numeric vs string comparison could fail depending on jq version

#### B3: Missing Field Path Validation

**Locations:**
- `test_mint_token.bats:49-50` - References `.transactions` (not `.transactionHistory`)
- `test_mint_token.bats:113-114` - References `.genesis.data.coinData`

**Potential Issue:** Path might not exist in actual token structure

**Impact:** Would fail if tests ever got past authenticator timeout

---

### Category C: Timeout Configuration Mismatch

**File:** `/home/vrogojin/cli/tests/helpers/common.bash:211`

```bash
timeout_cmd="timeout ${UNICITY_CLI_TIMEOUT:-30}"
```

**Issue:** Default timeout is 30 seconds, but mint-token command expects 300 seconds
**Result:** BATS kills process with exit code 124 before command's internal timeout

**Configuration:**
- BATS timeout: 30 seconds (line 211, common.bash)
- Command timeout: 300 seconds (line 200, mint-token.ts)
- Mismatch: 30 < 300, so BATS timeout wins

---

## Detailed Failure Trace

### Test Execution Trace (Example: MINT_TOKEN-001)

```
Line 25: run_cli_with_secret "${SECRET}" "mint-token --preset nft --local -o token.txf"
  └─→ Calls: run_cli_with_secret (line 486, common.bash)
      └─→ Calls: run_cli (line 197, common.bash)
          └─→ Timeout wrapper: timeout 30 node dist/index.js mint-token --preset nft --local -o token.txf
              └─→ CLI Execution (mint-token.ts)
                  ├─ Step 1: Create predicate ✓
                  ├─ Step 2: Derive address ✓
                  ├─ Step 3: Create MintTransactionData ✓
                  ├─ Step 4: Create commitment ✓
                  ├─ Step 5: Submit transaction to aggregator ✓
                  │   Request ID: 0000df2fac1f6ed37204812fccbc463329b800135a0bc9489f32f743f1d1f074d6eb
                  │
                  └─ Step 6: Wait for inclusion proof (mint-token.ts:215-265)
                     ├─ Poll aggregator every 1 second
                     ├─ Receive initial proof (merkleTreePath populated)
                     ├─ Check for authenticator field
                     │   └─ FOUND: proofJson.authenticator === null/undefined ✗
                     │
                     ├─ Loop iteration 1: "Waiting for authenticator to be populated..."
                     ├─ Loop iteration 2: "Waiting for authenticator to be populated..."
                     ├─ ...
                     ├─ Loop iteration 30: "Waiting for authenticator to be populated..."
                     │
                     └─ TIMEOUT at 30 seconds (Exit code 124)
                        └─ BATS terminates process
                        └─ Test fails: status=124

Line 26: assert_success
  └─ FAIL: status 124 ≠ 0
```

---

## Affected Test Assertions

### Assertions That Will Fail If Tests Progress Past Timeout

All 28 tests have identical assertion patterns at line 33, 70, 89, 103, etc.:

```bash
assert_token_fully_valid "token.txf"  # Line 33, 70, 89, 103, ...
```

This function (assertions.bash:1138-1181) calls:
1. `assert_token_has_valid_structure` (line 1150)
2. `assert_token_has_valid_genesis` (line 1156)
3. `assert_token_has_valid_state` (line 1162)
4. `assert_token_predicate_valid` (line 1168)
5. `verify_token_cryptographically` (line 1174) ← **Would fail without authenticator**

### Function: verify_token_cryptographically

**File:** `assertions.bash:636-682`

```bash
verify_token_cryptographically() {
  # Runs: run_cli verify-token -f "$token_file" --local
  # The verify-token command requires valid authenticator in proof
  # Without it, verification would fail
}
```

**Why It Would Fail:**
- `verify-token` command validates authenticator signatures
- Missing authenticator = verification fails
- Exit code non-zero = assert_success fails

---

## Helper Function Issues

### Issue 1: assert_json_field_equals (assertions.bash:240-267)

**Problem:** Doesn't handle numeric vs string comparison correctly

```bash
actual=$(~/.local/bin/jq -r "$field" "$file")
# With -r flag, numbers become strings: 2 → "2"
# But "2" !== "2.0" (string comparison is exact)

if [[ "$actual" != "$expected" ]]; then
  # Fails if actual="2" and expected="2.0"
```

**Affects Tests:**
- Line 36: `assert_json_field_equals "token.txf" "version" "2.0"`

**Fix Needed:**
```bash
# Use jq without -r for type-safe comparison
version=$(jq '.version' "$file")
expected_version=2.0
if ! jq -e ".version == $expected_version" "$file" >/dev/null 2>&1; then
  # Fail
fi
```

### Issue 2: get_transaction_count (token-helpers.bash:470-473)

**Function:**
```bash
get_transaction_count() {
  jq '.transactions | length' "$token_file"  # Returns number
}
```

**Problem:** Returns numeric value but test compares as string
```bash
tx_count=$(get_transaction_count "token.txf")  # Gets: 0 (number)
assert_equals "0" "${tx_count}"                # Compares: "0" == "0" ✓
```

**Actually Okay:** String comparison of "0" == "0" works, but fragile

**Better Fix:**
```bash
assert_equals "0" "$(echo "$tx_count" | jq -r .)"  # Force string
```

---

## Recommended Fixes

### Priority 1: Fix Aggregator Authenticator Issue (Blocking All Tests)

**Root Problem:** Local aggregator not including BFT authenticator in proof response

**Investigation Steps:**
1. Verify aggregator Docker image is running: `docker ps | grep aggregator`
2. Check aggregator logs: `docker logs <aggregator-container>`
3. Query aggregator directly:
   ```bash
   curl -X POST http://localhost:3000 \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"state_getInclusionProof","params":["REQUEST_ID"],"id":1}'
   ```
4. Check if response includes `"authenticator"` field

**Possible Solutions:**
1. **Update aggregator image** to version that populates authenticator
2. **Mock aggregator response** to include authenticator for tests
3. **Adjust test timeout** to skip authenticator wait for --local mode
4. **Modify mint-token command** to make authenticator check optional for local mode

**Recommended:** Update aggregator Docker image or configure it to populate authenticator field

### Priority 2: Fix Version Comparison (Category A)

**File:** `tests/functional/test_mint_token.bats:36`

**Fix:**
```bash
# Before:
assert_json_field_equals "token.txf" "version" "2.0"

# After - use numeric comparison:
local version
version=$(jq '.version' "token.txf")
assert_equals "2" "$version"  # or "2.0" if that's the JSON value
```

### Priority 3: Standardize Numeric Comparisons (Category B1-B2)

**Files:**
- `test_mint_token.bats:49-50` (transaction count)
- `test_mint_token.bats:113-114` (coin count)

**Fix Pattern:**
```bash
# Before:
tx_count=$(get_transaction_count "token.txf")
assert_equals "0" "${tx_count}"

# After - ensure string format:
tx_count=$(get_transaction_count "token.txf" | jq -r .)
assert_equals "0" "${tx_count}"
```

### Priority 4: Increase Test Timeout (Category C)

**File:** `tests/helpers/common.bash:211`

**Fix:**
```bash
# Before:
timeout_cmd="timeout ${UNICITY_CLI_TIMEOUT:-30}"

# After - accommodate 300s command timeout:
timeout_cmd="timeout ${UNICITY_CLI_TIMEOUT:-320}"  # 300s + 20s buffer
```

---

## Test Categories Summary

### Category A: Aggregator Response Format (BLOCKING ALL TESTS)
- **Affected:** All 28 tests
- **Issue:** Missing BFT authenticator field in inclusion proof
- **Failure Point:** Step 6 (waiting for authenticator)
- **Fix Type:** Infrastructure (aggregator configuration)

### Category B: JSON Type Mismatches (HIDDEN BEHIND TIMEOUT)
- **Affected:** Tests 1, 4-7, 13-28
- **Issue:** String vs numeric comparison of version field
- **Failure Point:** Line 36 - `assert_json_field_equals` for version
- **Fix Type:** Test assertion logic

### Category C: Timeout Configuration (SECONDARY ISSUE)
- **Affected:** All 28 tests
- **Issue:** BATS timeout (30s) < mint-token timeout (300s)
- **Failure Point:** Command execution wrapper
- **Fix Type:** Configuration adjustment

---

## File Locations Summary

### Source Code Issues
- `/home/vrogojin/cli/src/commands/mint-token.ts` (line 236-244): Authenticator check loop

### Test Files
- `/home/vrogojin/cli/tests/functional/test_mint_token.bats` (lines 21-565): All tests follow same pattern

### Helper Functions
- `/home/vrogojin/cli/tests/helpers/assertions.bash` (line 240-267): Version comparison issue
- `/home/vrogojin/cli/tests/helpers/common.bash` (line 211): Timeout configuration
- `/home/vrogojin/cli/tests/helpers/token-helpers.bash` (line 470-513): Numeric return issues

---

## Verification Checklist

Before running tests again:

- [ ] Docker aggregator container is running
- [ ] Aggregator responds to health check: `curl http://localhost:3000/health`
- [ ] Trust base is available: `cat ./config/trust-base.json`
- [ ] Aggregator version supports BFT authenticator in proofs
- [ ] Test timeout increased to accommodate 300s command timeout
- [ ] Version comparison updated to use numeric comparison
- [ ] Numeric field comparisons use consistent format

---

## Next Steps

1. **Immediate:** Investigate aggregator response to determine why authenticator is missing
2. **Short-term:** Update aggregator Docker image or configuration
3. **Medium-term:** Fix hidden test failures (version comparison, numeric fields)
4. **Long-term:** Consider mocking aggregator for unit tests vs integration tests

---

## Appendix: Test Assertion Call Chain

```
Test Start
└─ mint-token command execution (timeout 30s)
   └─ Submit transaction to aggregator
   └─ Wait for inclusion proof (timeout 300s in command, 30s in BATS)
      └─ Poll aggregator for proof
      └─ Check authenticator field
         └─ [TIMEOUT] Authenticator never populated
            └─ Test fails with exit code 124

Line 26: assert_success
└─ Checks: status === 0
   └─ FAIL: status = 124
```
