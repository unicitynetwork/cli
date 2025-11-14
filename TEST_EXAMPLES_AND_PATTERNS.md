# Test Pattern Examples - Before and After

## Example 1: SEC-DBLSPEND-003 (Conditional Skip)

### BEFORE (Broken)
```bash
# Line 239-251 in test_double_spend.bats
local exit_code=0
run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${carol_address} --local -o ${transfer_carol}" || exit_code=$?

# The send-token might succeed locally (creates offline package)
# BUT when Carol tries to receive it, the network will reject it
if [[ $exit_code -eq 0 ]] && [[ -f "${transfer_carol}" ]]; then
    # Carol tries to receive the stale transfer
    run_cli_with_secret "${CAROL_SECRET}" "receive-token -f ${transfer_carol} --local -o ${TEST_TEMP_DIR}/carol-token.txf"

    # This MUST fail - token already spent
    assert_failure
    assert_output_contains "spent" || assert_output_contains "invalid" || assert_output_contains "outdated"
fi
```

**Problems:**
- If `send-token` fails, receive validation is SKIPPED
- If `receive-token` succeeds, test passes (no assertion check)
- Test passes with 0% actual validation

**Test Execution Trace:**
```
Case 1: send-token fails
  -> exit_code != 0
  -> condition false
  -> assert_failure never runs
  -> Test PASSES ✓ (but feature untested)

Case 2: receive-token succeeds (BROKEN)
  -> exit_code == 0
  -> condition true
  -> assert_failure runs
  -> assert_failure FAILS ✓ (good)

Case 3: Both fail
  -> exit_code == 0, but no file
  -> condition false
  -> assert_failure never runs
  -> Test PASSES ✓ (feature untested)
```

### AFTER (Fixed)
```bash
# Always create offline transfer (offline operation should succeed)
run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${carol_address} --local -o ${transfer_carol}"
assert_success "Offline transfer package creation must succeed"

# Always validate receive fails (network must reject re-spend)
run_cli_with_secret "${CAROL_SECRET}" "receive-token -f ${transfer_carol} --local -o ${TEST_TEMP_DIR}/carol-token.txf"
assert_failure "Re-spending already-transferred token must fail"
assert_output_matches "spent|already|outdated"
```

**Test Execution Trace:**
```
Case 1: send-token fails
  -> assert_success FAILS ✓ (catches regression)

Case 2: receive-token succeeds (BROKEN)
  -> assert_failure FAILS ✓ (catches security issue)

Case 3: Both fail correctly
  -> Both asserts pass ✓

Case 4: Both succeed correctly
  -> receive-token assertion FAILS ✓
```

---

## Example 2: SEC-DBLSPEND-002 (Wrong Test Intent)

### BEFORE (Broken)
```bash
# Title: "Concurrent submissions - exactly ONE succeeds"
# Comment: "Expected: ALL submissions succeed (idempotent)"
# Assertion: assert_equals "${concurrent_count}" "${success_count}"

@test "SEC-DBLSPEND-002: Concurrent submissions - exactly ONE succeeds" {
    # ... create 5 concurrent receives of SAME transfer ...
    
    assert_equals "${concurrent_count}" "${success_count}" "Expected ALL receives to succeed (idempotent)"
    assert_equals "0" "${failure_count}" "Expected zero failures"
}
```

**Problems:**
- Title says ONE succeeds
- Comments say ALL succeed
- Assertion expects ALL succeed
- Tests idempotency, not double-spend prevention
- **No double-spend test exists**

**What This Actually Tests:**
- Idempotent receipt (same recipient, same transfer, multiple times)
- NOT double-spend prevention (same source, different recipients)

### AFTER (Fixed)
```bash
# OPTION A: Rename to match actual test
@test "SEC-DBLSPEND-002: Idempotent concurrent receipt succeeds" {
    log_test "Testing fault tolerance: idempotent receipt of same transfer"
    
    # ... create 5 concurrent receives of SAME transfer ...
    
    assert_equals "${concurrent_count}" "${success_count}" "ALL idempotent receives must succeed"
    assert_equals "0" "${failure_count}" "No failures for idempotent operations"
}

# OPTION B: Add new test for actual double-spend
@test "NEW-DBLSPEND: Concurrent different-recipient double-spend fails" {
    log_test "Testing concurrent double-spend to different recipients"
    
    # Alice creates transfer to Bob AND transfer to Carol
    # Both try to receive concurrently
    # Only ONE should succeed
    
    # Pseudo-code:
    # create_transfer alice -> bob
    # create_transfer alice -> carol
    # receive_token bob (concurrent)
    # receive_token carol (concurrent)
    
    # Expected: Exactly one succeeds
    assert_equals "1" "$((bob_success + carol_success))" "Only one double-spend recipient succeeds"
}
```

---

## Example 3: SEC-INTEGRITY-003 (Optional Validation)

### BEFORE (Broken)
```bash
# Line 196-206 in test_data_integrity.bats
if [[ -n "${tx_count}" ]] && [[ "${tx_count}" -gt "0" ]]; then
    local tampered_chain="${TEST_TEMP_DIR}/tampered-chain.txf"
    jq 'del(.transactions[0])' "${carol_token}" > "${tampered_chain}"

    # Verify tampered chain is detected
    local exit_code=0
    run_cli "verify-token -f ${tampered_chain} --local" || exit_code=$?

    # May succeed or fail depending on whether CLI validates chain integrity
    if [[ $exit_code -eq 0 ]]; then
        warn "Transaction removal not detected - chain validation may be limited"
    else
        log_info "Transaction chain tampering detected"
    fi
fi
```

**Problems:**
- `warn` is not an assertion
- Test passes if tampering is NOT detected
- No enforcement that chain must be validated
- Test skips if no transactions exist

**Test Execution:**
```
Case 1: tx_count is 0
  -> condition false
  -> no test runs
  -> Test PASSES ✓ (untested)

Case 2: verify-token returns 0 (BROKEN)
  -> warn prints message
  -> But test continues
  -> Test PASSES ✓ (even though feature is broken)

Case 3: verify-token returns non-zero
  -> log_info prints message
  -> Test PASSES ✓ (correct)
```

### AFTER (Fixed)
```bash
# Always test chain integrity
if [[ -n "${tx_count}" ]] && [[ "${tx_count}" -gt "0" ]]; then
    local tampered_chain="${TEST_TEMP_DIR}/tampered-chain.txf"
    jq 'del(.transactions[0])' "${carol_token}" > "${tampered_chain}"

    run_cli "verify-token -f ${tampered_chain} --local"
    assert_failure "Tampering with transaction chain must be detected"
    assert_output_matches "transaction|chain|integrity"
else
    skip "Token has no transactions to test (test setup issue)"
fi
```

**Test Execution:**
```
Case 1: tx_count is 0
  -> skip (explicit, not silent failure)
  -> Test SKIPPED (known limitation)

Case 2: verify-token returns 0 (BROKEN)
  -> assert_failure FAILS ✓ (catches regression)

Case 3: verify-token returns non-zero
  -> assert_failure PASSES ✓
  -> assert_output_matches PASSES ✓
```

---

## Example 4: SEC-INPUT-007 (OR Assertions)

### BEFORE (Broken)
```bash
# Lines 304-328 in test_input_validation.bats
local sql_injection="'; DROP TABLE tokens;--"
run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${token} -r \"${sql_injection}\" --local -o /dev/null"
assert_failure
assert_output_contains "address" || assert_output_contains "invalid"
```

**Problems:**
- `||` means: pass if EITHER appears
- If output is "File not found", test still passes
- No verification that this is address validation error
- Command could fail for wrong reason

**Test Execution:**
```
Case 1: Proper validation
  Output: "Error: Invalid address format"
  -> assert_output_contains "address" PASSES
  -> Test PASSES ✓ (correct)

Case 2: Generic error (WRONG)
  Output: "Error: Unknown error occurred"
  -> assert_output_contains "address" FAILS
  -> assert_output_contains "invalid" PASSES (due to ||)
  -> Test PASSES ✓ (but wrong error!)

Case 3: File not found (WRONG)
  Output: "Error: Token file not found"
  -> assert_output_contains "address" FAILS
  -> assert_output_contains "invalid" FAILS
  -> Test FAILS ✓ (but catches wrong error)

Case 4: Success (WRONG)
  -> assert_failure FAILS ✓ (good)
```

### AFTER (Fixed)
```bash
local sql_injection="'; DROP TABLE tokens;--"
run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${token} -r \"${sql_injection}\" --local -o /dev/null"
assert_failure "Invalid address must be rejected"
# Use regex pattern matching
assert_output_matches "invalid.*address|address.*invalid|address.*format"
```

**Test Execution:**
```
Case 1: Proper validation
  Output: "Error: Invalid address format"
  -> assert_output_matches PASSES ✓

Case 2: Generic error
  Output: "Error: Unknown error occurred"
  -> assert_output_matches FAILS ✓ (catches wrong error)

Case 3: File not found
  Output: "Error: Token file not found"
  -> assert_output_matches FAILS ✓ (catches wrong error)

Case 4: Success
  -> assert_failure FAILS ✓ (good)
```

---

## Example 5: SEC-DBLSPEND-004 (Accept Both Outcomes)

### BEFORE (Broken)
```bash
# Line 294-314 in test_double_spend.bats
run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer} --local -o ${bob_token2}"
local exit_code=$status

# Expected behavior: Either FAILS or is idempotent (returns same state)
if [[ $exit_code -eq 0 ]]; then
    # If succeeded, verify it's idempotent (same token state)
    assert_file_exists "${bob_token2}"
    assert_token_fully_valid "${bob_token2}"
    
    local token1_id=$(jq -r '.genesis.data.tokenId' "${bob_token1}")
    local token2_id=$(jq -r '.genesis.data.tokenId' "${bob_token2}")
    
    assert_equals "${token1_id}" "${token2_id}" "Token IDs should match"
    log_info "Second receive was idempotent (acceptable)"
else
    # If failed, verify error indicates already processed
    assert_output_contains "already" || assert_output_contains "submitted"
    log_info "Second receive rejected as duplicate (expected)"
fi
```

**Problems:**
- Test accepts BOTH success AND failure
- No decision on correct behavior
- Token ID match doesn't prove full idempotency
- Test doesn't fail for either wrong behavior

**Test Execution:**
```
Case 1: Second receive succeeds
  -> Validates token IDs match
  -> But doesn't check state, proof, etc.
  -> Test PASSES ✓ (but weak validation)

Case 2: Second receive fails (UNKNOWN CORRECT)
  -> Validates error message
  -> Test PASSES ✓ (but unknown if correct)

Case 3: Both receive fail
  -> No assertions run for success case
  -> Test might PASS or FAIL randomly
```

### AFTER (Fixed - Option A: Idempotent)
```bash
# DECISION: Second receive MUST be idempotent
run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer} --local -o ${bob_token2}"
assert_success "Second receive of same transfer must be idempotent"

# Verify COMPLETE idempotency (not just token ID)
local hash1=$(jq -S -c '.' "${bob_token1}" | sha256sum | cut -d' ' -f1)
local hash2=$(jq -S -c '.' "${bob_token2}" | sha256sum | cut -d' ' -f1)
assert_equals "${hash1}" "${hash2}" "Idempotent receives must be completely identical"
```

**Test Execution:**
```
Case 1: Second receive succeeds
  -> assert_success PASSES ✓
  -> hash comparison PASSES ✓
  -> Test PASSES ✓ (correct)

Case 2: Second receive fails
  -> assert_success FAILS ✓ (catches regression)
  
Case 3: Token ID matches but content differs
  -> hash comparison FAILS ✓ (catches subtle bugs)
```

### AFTER (Fixed - Option B: Reject Duplicates)
```bash
# DECISION: Second receive MUST fail
run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer} --local -o ${bob_token2}"
assert_failure "Second receive of same transfer must be rejected"
assert_output_matches "duplicate|already.*received|already.*accepted"
```

**Test Execution:**
```
Case 1: Second receive succeeds
  -> assert_failure FAILS ✓ (catches security issue)

Case 2: Second receive fails with correct error
  -> assert_failure PASSES ✓
  -> assert_output_matches PASSES ✓
  -> Test PASSES ✓ (correct)

Case 3: Second receive fails with wrong error
  -> assert_output_matches FAILS ✓ (catches wrong error)
```

---

## Pattern Comparison Table

| Issue | Bad Pattern | Good Pattern | Impact |
|-------|-------------|--------------|--------|
| Conditional Assert | `if cond; then assert; fi` | `assert` (always) | Assertion may never run |
| Optional Validation | `if result == 0; warn "fail"; fi` | `assert_failure` | Wrong outcome accepted |
| OR Assertions | `assert_A OR assert_B` | `assert_output_matches "A.*B"` | Passes for wrong reason |
| Both Outcomes | Accept success OR failure | Choose one, assert it | Never fails for wrong behavior |
| Skip Fallback | `if data; then test; else skip; fi` | `assert_set "$data"; test` | Data format change undetected |

---

## Detection Test Scripts

### Inject #1: Disable Feature
```bash
# In src/commands/receive-token.ts, add:
if (process.env.TEST_DISABLE_RECEIVE === '1') {
    throw new Error("Feature disabled for testing");
}

# Run tests:
TEST_DISABLE_RECEIVE=1 bats tests/security/test_double_spend.bats

# BEFORE FIX: Some tests still pass
# AFTER FIX: All related tests fail
```

### Inject #2: Skip Validation
```bash
# In src/utils/proof-validation.ts, modify:
export async function validateInclusionProof(...) {
    if (process.env.TEST_SKIP_VALIDATION === '1') {
        return true;  // Skip all validation
    }
    // ... normal validation ...
}

# Run tests:
TEST_SKIP_VALIDATION=1 bats tests/security/test_data_integrity.bats

# BEFORE FIX: Integrity tests still pass
# AFTER FIX: All integrity tests fail
```

### Inject #3: Always Succeed
```bash
# In src/commands/send-token.ts, add:
if (process.env.TEST_ALWAYS_SUCCEED === '1') {
    return { success: true };
}

# Run tests:
TEST_ALWAYS_SUCCEED=1 bats tests/security/test_send_token_crypto.bats

# BEFORE FIX: Some crypto tests skip
# AFTER FIX: All crypto tests fail
```

---

## Summary

### Key Takeaway
**Assertions must be unconditional.** If an assertion can be skipped, it's not really an assertion.

### Rule Changes
1. ✗ Remove: `if [[ condition ]]; then assert; fi`
2. ✗ Remove: `warn` in place of assertions
3. ✗ Replace: `assert_A || assert_B` with `assert_A && assert_B` or regex
4. ✗ Remove: Accept both success and failure
5. ✓ Add: Explicit error messages to all assertions
6. ✓ Add: Regex patterns for error validation
7. ✓ Add: Injection tests to detect false positives

### Validation Levels
- **Level 1 (Current):** Tests can pass without validating features
- **Level 2 (After Fixes):** Tests must validate specific behavior
- **Level 3 (Ultimate):** Injection tests prove assertions work
