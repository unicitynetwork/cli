# Receive-Token Test Suite Analysis

**Date:** 2025-11-10
**Test File:** `/home/vrogojin/cli/tests/functional/test_receive_token.bats`
**Command Implementation:** `/home/vrogojin/cli/src/commands/receive-token.ts`

---

## Executive Summary

**Current Status:** 0/7 tests passing (0%)

**Critical Issues:**
1. ❌ **Missing `assert` function** causing immediate test failure (RECV_TOKEN-001)
2. ❌ **Missing `.state.data` field** in received tokens (4 tests failing)
3. ❌ **Missing `get_token_data()` output handling** in RECV_TOKEN-002
4. ⚠️  **NO support for recipient data hash** in receive-token command
5. ⚠️  **NO tests for state data validation** (critical security feature)

**Comparison with send-token:**
- send-token: 15/15 tests passing (100%) ✅
- receive-token: 0/7 tests passing (0%) ❌
- send-token has recipient data hash feature
- receive-token MISSING --state-data option to match hash commitments

---

## Current Test Results

### Test Execution Summary

```
Total Tests: 7
Passing: 0
Failing: 7
Success Rate: 0%
```

### Individual Test Status

| Test ID | Description | Status | Failure Reason |
|---------|-------------|--------|----------------|
| RECV_TOKEN-001 | Complete offline transfer by receiving package | ❌ FAIL | Missing `assert` function |
| RECV_TOKEN-002 | Receive NFT with preserved metadata | ❌ FAIL | get_token_data() output not captured |
| RECV_TOKEN-003 | Receive UCT token with coins | ❌ FAIL | Missing .state.data field |
| RECV_TOKEN-004 | Error when receiving with incorrect secret | ⚠️ SKIP | Dependent on passing setup |
| RECV_TOKEN-005 | Receiving same transfer multiple times is idempotent | ❌ FAIL | Missing .state.data field |
| RECV_TOKEN-006 | Receive using local aggregator | ❌ FAIL | Missing .state.data field |
| RECV_TOKEN-007 | Receive token at masked (one-time) address | ❌ FAIL | Missing .state.data field |

---

## Detailed Failure Analysis

### Issue 1: Missing `assert` Function (RECV_TOKEN-001)

**Error:**
```bash
/home/vrogojin/cli/tests/functional/test_receive_token.bats: line 42: assert: command not found
```

**Location:** Line 42
```bash
assert is_valid_txf "bob-token.txf"
```

**Root Cause:**
- Test uses `assert is_valid_txf` instead of correct assertion pattern
- Should use standalone `is_valid_txf` or proper assertion helper

**Impact:** Immediate test failure, cannot validate token structure

---

### Issue 2: Missing `.state.data` Field (4 Tests)

**Error:**
```bash
✗ Missing required field: .state.data
  File: bob-token.txf
```

**Affected Tests:**
- RECV_TOKEN-003 (UCT token)
- RECV_TOKEN-005 (Idempotent receive)
- RECV_TOKEN-006 (Local aggregator)
- RECV_TOKEN-007 (Masked address)

**Root Cause Analysis:**

Looking at receive-token.ts lines 326-330:
```typescript
// STEP 12: Create new token state with recipient's predicate
console.error('Step 12: Creating new token state with recipient predicate...');
const tokenData = token.state.data;  // Preserve token data
const newState = new TokenState(recipientPredicate, tokenData);
console.error('  ✓ New token state created\n');
```

**Problem:** The `TokenState` constructor appears to not be preserving the `data` field in the JSON output, or the SDK's `toJSON()` method is not including it.

**Evidence:**
1. Token is minted successfully with data (test setup passes validation)
2. Send-token creates offline transfer successfully
3. Receive-token claims "✓ New token state created"
4. But final TXF missing `.state.data`

**Hypothesis:** SDK's TokenState.toJSON() may not serialize the data field correctly, or there's a mismatch between how data is passed to the constructor vs. how it's serialized.

---

### Issue 3: get_token_data() Output Not Captured (RECV_TOKEN-002)

**Error:**
```bash
✗ Assertion Failed: Output does not contain expected string
  Expected to contain: 'Test NFT'
  Actual output: [receive-token command stderr output]
```

**Test Code (lines 89-92):**
```bash
# Verify: Token data preserved
local data
data=$(get_token_data "bob-nft.txf")
assert_output_contains "Test NFT"
```

**Root Cause:**
1. `get_token_data()` returns the decoded data to stdout
2. Test stores it in `$data` variable
3. BUT: `assert_output_contains` checks the LAST command's output
4. Last command was receive-token (stderr), not get_token_data

**Fix Needed:**
```bash
local data
data=$(get_token_data "bob-nft.txf")
# Check the variable, not global $output
[[ "$data" == *"Test NFT"* ]] || fail "Expected NFT metadata not found"
```

---

## Missing Functionality: Recipient Data Hash Support

### Critical Gap Identified

**send-token SUPPORTS:**
```bash
npm run send-token -- -f token.txf -r "DIRECT://..." \
  --recipient-data-hash "a1b2c3d4..." \
  --save
```

**receive-token MISSING:**
```bash
npm run receive-token -- -f transfer.txf \
  --state-data '{"status":"active","verified":true}' \  # ❌ DOES NOT EXIST
  --save
```

### How It Should Work

#### Sender (send-token):
1. Alice creates transfer with recipient data hash:
   ```bash
   HASH=$(echo -n '{"verified":true}' | sha256sum | cut -d' ' -f1)
   npm run send-token -- -f token.txf -r "DIRECT://bob..." \
     --recipient-data-hash "$HASH" \
     -o transfer.txf
   ```

2. Transfer commitment includes hash but NOT the plaintext data (privacy)

#### Recipient (receive-token):
1. Bob receives transfer with hash commitment
2. Bob MUST provide state data matching the hash:
   ```bash
   npm run receive-token -- -f transfer.txf \
     --state-data '{"verified":true}' \
     --save
   ```

3. CLI validates: `SHA256(stateData) == recipientDataHash`
4. If match: proceeds with transfer
5. If mismatch: ERROR - "State data does not match commitment hash"

### Why This Matters

**Use Case:** Privacy-preserving token transfers
- Sender commits to what state data recipient should use
- Recipient proves they have the correct data WITHOUT revealing it in transfer package
- Prevents recipient from changing critical state data unilaterally
- Example: NFT transfer where sender wants to ensure metadata stays consistent

**Security Impact:**
- Without validation: Recipient can set ANY state data
- With validation: Recipient must provide data matching sender's hash commitment
- Cryptographic proof that agreed-upon state is preserved

---

## Existing Test Coverage

### Currently Covered Scenarios

1. ✅ **Basic offline transfer** (RECV_TOKEN-001)
   - Receive token from offline package
   - Token state updated to recipient
   - Status changed to CONFIRMED
   - Offline transfer section removed

2. ✅ **NFT with metadata** (RECV_TOKEN-002)
   - NFT data preserved through transfer
   - Token type remains NFT
   - Metadata accessible after receive

3. ✅ **Fungible token (UCT)** (RECV_TOKEN-003)
   - Coin data intact
   - Amount preserved
   - Ownership transferred

4. ✅ **Wrong secret detection** (RECV_TOKEN-004)
   - Address mismatch validation
   - No file created on failure
   - Transfer remains pending

5. ✅ **Idempotent receive** (RECV_TOKEN-005)
   - Can receive same transfer multiple times
   - Final state consistent
   - No duplicate transactions

6. ✅ **Local aggregator** (RECV_TOKEN-006)
   - Works with local network
   - Inclusion proof from local aggregator
   - Proper network selection

7. ✅ **Masked address** (RECV_TOKEN-007)
   - One-time address support
   - Secret + nonce derivation
   - Masked predicate validation

---

## Missing Test Coverage

### Critical Missing Scenarios

#### 1. Recipient Data Hash Handling

**RECV_TOKEN-008: Receive token with recipient data hash commitment**
```bash
@test "RECV_TOKEN-008: Receive token with state data matching hash" {
  # Setup: Send with recipient data hash
  STATE_DATA='{"status":"active","verified":true}'
  HASH=$(echo -n "$STATE_DATA" | sha256sum | cut -d' ' -f1)

  send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" \
    "transfer.txf" "--recipient-data-hash \"$HASH\""

  # Execute: Receive with matching state data
  receive_token "${BOB_SECRET}" "transfer.txf" "bob-token.txf" \
    "--state-data '$STATE_DATA'"

  # Verify: Token received successfully
  assert_success
  assert_token_fully_valid "bob-token.txf"

  # Verify: State data matches
  local received_data
  received_data=$(get_token_data "bob-token.txf")
  assert_equals "$STATE_DATA" "$received_data"
}
```

**RECV_TOKEN-009: Error when state data doesn't match hash**
```bash
@test "RECV_TOKEN-009: Error - State data hash mismatch" {
  # Setup: Send with specific hash
  EXPECTED_HASH="a1b2c3d4..."
  send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" \
    "transfer.txf" "--recipient-data-hash \"$EXPECTED_HASH\""

  # Execute: Receive with WRONG state data
  WRONG_DATA='{"status":"inactive"}'
  receive_token "${BOB_SECRET}" "transfer.txf" "bob-token.txf" \
    "--state-data '$WRONG_DATA'"

  # Verify: Should fail
  assert_failure
  assert_output_contains "hash" || assert_output_contains "mismatch"
  assert_file_not_exists "bob-token.txf"
}
```

**RECV_TOKEN-010: Error when state data missing but hash required**
```bash
@test "RECV_TOKEN-010: Error - Missing required state data" {
  # Setup: Send with recipient data hash
  HASH="abcd1234..."
  send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" \
    "transfer.txf" "--recipient-data-hash \"$HASH\""

  # Execute: Receive WITHOUT providing state data
  receive_token "${BOB_SECRET}" "transfer.txf" "bob-token.txf"

  # Verify: Should fail (hash requires data)
  assert_failure
  assert_output_contains "state data" || assert_output_contains "required"
}
```

#### 2. Token Type Coverage

**RECV_TOKEN-011: Receive USDU token**
```bash
@test "RECV_TOKEN-011: Receive USDU stablecoin" {
  mint_token_to_address "${ALICE_SECRET}" "usdu" "" "usdu.txf" "-c 100000000"
  send_token_offline "${ALICE_SECRET}" "usdu.txf" "${bob_addr}" "transfer.txf"
  receive_token "${BOB_SECRET}" "transfer.txf" "bob-usdu.txf"

  assert_success
  assert_token_type "bob-usdu.txf" "usdu"
}
```

**RECV_TOKEN-012: Receive EURU token**
**RECV_TOKEN-013: Receive ALPHA token**

#### 3. Edge Cases

**RECV_TOKEN-014: Receive token with empty message**
```bash
@test "RECV_TOKEN-014: Receive transfer with empty message field" {
  send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" \
    "transfer.txf" "--message \"\""

  receive_token "${BOB_SECRET}" "transfer.txf" "bob-token.txf"
  assert_success
}
```

**RECV_TOKEN-015: Receive token with large metadata**
```bash
@test "RECV_TOKEN-015: Receive NFT with large JSON metadata" {
  LARGE_DATA=$(generate_json_metadata 10000)  # 10KB metadata
  mint_token_to_address "${ALICE_SECRET}" "nft" "$LARGE_DATA" "nft.txf"
  send_token_offline "${ALICE_SECRET}" "nft.txf" "${bob_addr}" "transfer.txf"

  receive_token "${BOB_SECRET}" "transfer.txf" "bob-nft.txf"
  assert_success

  # Verify metadata preserved
  local data
  data=$(get_token_data "bob-nft.txf")
  [[ ${#data} -gt 9000 ]] || fail "Metadata truncated"
}
```

**RECV_TOKEN-016: Receive after sender's token becomes invalid**
```bash
@test "RECV_TOKEN-016: Error - Sender already spent token" {
  # Alice sends to Bob (offline)
  send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" "transfer.txf"

  # Alice ALSO sends to Carol (immediate submit - double spend)
  send_token_immediate "${ALICE_SECRET}" "token.txf" "${carol_addr}"

  # Bob tries to receive his copy
  receive_token "${BOB_SECRET}" "transfer.txf" "bob-token.txf"

  # Verify: Should detect double-spend
  assert_failure
  assert_output_contains "already spent" || assert_output_contains "invalid"
}
```

#### 4. Network and Error Handling

**RECV_TOKEN-017: Receive with network timeout**
```bash
@test "RECV_TOKEN-017: Error handling when network unavailable" {
  # Stop aggregator
  stop_aggregator

  receive_token "${BOB_SECRET}" "transfer.txf" "bob-token.txf"

  # Should fail gracefully
  assert_failure
  assert_output_contains "network" || assert_output_contains "unavailable"

  # Restart for other tests
  start_aggregator
}
```

**RECV_TOKEN-018: Receive with invalid inclusion proof**
**RECV_TOKEN-019: Receive with corrupted TXF file**
**RECV_TOKEN-020: Receive with missing commitmentData**

---

## Implementation Gaps in receive-token.ts

### Missing Features

1. **--state-data option**
   ```typescript
   .option('--state-data <json>', 'State data for recipient (required if sender used --recipient-data-hash)')
   ```

2. **Hash validation logic**
   ```typescript
   // After parsing transfer commitment (around line 236)
   if (transferCommitment.recipientDataHash) {
     if (!options.stateData) {
       console.error('❌ Error: This transfer requires state data');
       console.error('Sender committed to a recipient data hash.');
       console.error('Use --state-data to provide the data matching the hash.');
       process.exit(1);
     }

     // Validate hash matches
     const providedData = new TextEncoder().encode(options.stateData);
     const computedHash = await HashAlgorithm.SHA256.hash(providedData);
     const expectedHash = transferCommitment.recipientDataHash;

     if (!HexConverter.encode(computedHash) === expectedHash.toJSON()) {
       console.error('❌ Error: State data hash mismatch');
       console.error(`Expected: ${expectedHash.toJSON()}`);
       console.error(`Got:      ${HexConverter.encode(computedHash)}`);
       process.exit(1);
     }

     console.error('  ✓ State data matches hash commitment');
     // Use providedData for token state
   }
   ```

3. **State data handling in new token state**
   ```typescript
   // Line 328 - use validated state data instead of original
   const tokenData = options.stateData
     ? new TextEncoder().encode(options.stateData)
     : token.state.data;
   ```

### State.data Field Issue

**Current code (line 328-330):**
```typescript
const tokenData = token.state.data;  // Preserve token data
const newState = new TokenState(recipientPredicate, tokenData);
console.error('  ✓ New token state created\n');
```

**Problem:** Need to verify if SDK's `TokenState` constructor and `toJSON()` properly handle the data field.

**Investigation needed:**
1. Check SDK TokenState constructor signature
2. Verify toJSON() includes data field
3. Test if data is Uint8Array vs hex string vs base64
4. Ensure proper encoding throughout pipeline

---

## Test Helper Issues

### Missing/Broken Assertions

1. **Line 42: `assert is_valid_txf`**
   - Should be: Direct call or use assert_equals pattern

2. **Line 91: `assert_output_contains` on wrong output**
   - Should check `$data` variable, not global `$output`

3. **Missing helper: `assert_state_data_matches`**
   ```bash
   assert_state_data_matches() {
     local file="${1:?File required}"
     local expected="${2:?Expected data required}"

     local actual
     actual=$(get_token_data "$file")

     if [[ "$actual" != "$expected" ]]; then
       fail "State data mismatch\nExpected: $expected\nGot: $actual"
     fi
   }
   ```

---

## Recommendations

### Immediate Fixes (Priority 1)

1. ✅ **Fix test_receive_token.bats line 42**
   - Remove `assert` wrapper
   - Use `is_valid_txf` directly or proper assertion

2. ✅ **Fix RECV_TOKEN-002 assertion**
   - Check `$data` variable instead of `$output`

3. ✅ **Fix .state.data missing issue**
   - Debug TokenState constructor/toJSON
   - Ensure data field properly serialized
   - May need SDK update or workaround

### Feature Implementation (Priority 2)

4. ✅ **Add --state-data option to receive-token**
   - Accept JSON string for state data
   - Validate format before use

5. ✅ **Add hash validation logic**
   - Check if transfer has recipientDataHash
   - Require --state-data if hash present
   - Validate SHA256(stateData) == hash
   - Error with clear message on mismatch

6. ✅ **Use provided state data in new token state**
   - When --state-data provided, use it
   - Otherwise preserve original token.state.data

### Test Expansion (Priority 3)

7. ✅ **Add recipient data hash test scenarios**
   - RECV_TOKEN-008: Receive with matching state data
   - RECV_TOKEN-009: Error on hash mismatch
   - RECV_TOKEN-010: Error on missing required data

8. ✅ **Add missing token type tests**
   - RECV_TOKEN-011: USDU
   - RECV_TOKEN-012: EURU
   - RECV_TOKEN-013: ALPHA

9. ✅ **Add edge case tests**
   - RECV_TOKEN-014: Empty message
   - RECV_TOKEN-015: Large metadata
   - RECV_TOKEN-016: Double-spend detection
   - RECV_TOKEN-017+: Network errors, invalid proofs, corruption

### Test Infrastructure (Priority 4)

10. ✅ **Add assertion helpers**
    - `assert_state_data_matches(file, expected)`
    - `assert_hash_matches(data, hash)`
    - `assert_recipient_data_hash_present(file)`

---

## Comparison with send-token Test Suite

### Coverage Parity Analysis

| Feature Category | send-token Tests | receive-token Tests | Gap |
|-----------------|------------------|---------------------|-----|
| Basic Operations | 4 tests | 3 tests | ✅ Similar |
| Token Types | 5 types (nft, uct, usdu, euru, alpha) | 2 types (nft, uct) | ❌ 3 missing |
| Recipient Data Hash | 2 tests (SEND-014, SEND-015) | 0 tests | ❌ CRITICAL GAP |
| Error Handling | 6 tests | 1 test | ❌ 5 missing |
| Network Modes | 3 tests (local, production, immediate) | 1 test (local) | ❌ 2 missing |
| Edge Cases | 3 tests | 1 test (masked) | ❌ 2 missing |

**Total send-token:** 15 tests (100% pass)
**Total receive-token:** 7 tests (0% pass)
**Missing scenarios:** 8-13 additional tests needed for parity

---

## Success Criteria for Completion

### Phase 1: Fix Existing Tests
- ✅ All 7 current tests passing
- ✅ .state.data field present in received tokens
- ✅ Proper assertion usage throughout
- ✅ 100% pass rate on existing scenarios

### Phase 2: Add Critical Features
- ✅ --state-data option implemented
- ✅ Recipient data hash validation working
- ✅ Error handling for hash mismatches
- ✅ 3 new tests for state data scenarios (RECV-008, 009, 010)

### Phase 3: Achieve Parity
- ✅ All token types covered (usdu, euru, alpha)
- ✅ Edge cases tested (large metadata, double-spend, etc)
- ✅ Network error handling comprehensive
- ✅ 15+ total tests matching send-token coverage

### Phase 4: Validation
- ✅ Integration test: Full flow send with hash → receive with data
- ✅ Security test: Verify hash enforcement prevents tampering
- ✅ Performance test: Large metadata handling
- ✅ Documentation: Update TESTS_QUICK_REFERENCE.md

---

## Files Requiring Updates

### Source Code
1. `/home/vrogojin/cli/src/commands/receive-token.ts`
   - Add --state-data option
   - Add hash validation logic
   - Fix state.data serialization

### Tests
2. `/home/vrogojin/cli/tests/functional/test_receive_token.bats`
   - Fix line 42 assertion
   - Fix line 91 output check
   - Add 8-13 new test scenarios

### Test Helpers
3. `/home/vrogojin/cli/tests/helpers/assertions.bash`
   - Add assert_state_data_matches()
   - Add assert_hash_matches()
   - Add assert_recipient_data_hash_present()

4. `/home/vrogojin/cli/tests/helpers/token-helpers.bash`
   - Add receive_token_with_data() helper
   - Update receive_token() to support --state-data

### Documentation
5. `/home/vrogojin/cli/TESTS_QUICK_REFERENCE.md`
   - Add receive-token scenarios
   - Document state data testing pattern

6. `/home/vrogojin/cli/docs/guides/receive-token-guide.md`
   - Add section on recipient data hash
   - Provide examples of --state-data usage

---

## Next Steps

1. **DO NOT IMPLEMENT** - Analysis complete, waiting for user direction
2. Report findings to user
3. Get approval for implementation approach
4. Proceed with fixes in priority order
5. Validate each phase before moving to next

---

## Appendix: Test Execution Logs

### Full RECV_TOKEN-002 Output
```
✗ Assertion Failed: Output does not contain expected string
  Expected to contain: 'Test NFT'
  Actual output:
=== Receive Token (Offline Transfer) ===

Step 1: Loading extended TXF file...
  ✓ File loaded: nft-transfer.txf

Step 2: Validating offline transfer package...
  ✓ Offline transfer package validated
...
=== Transfer Received Successfully ===
```

### Full RECV_TOKEN-003 Output
```
✗ Missing required field: .state.data
  File: bob-uct.txf
```

**End of Analysis Report**
