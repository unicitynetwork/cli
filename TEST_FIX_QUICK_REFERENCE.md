# Test False Positive Fixes - Quick Reference

## Critical Patterns to Fix

### Pattern 1: Conditional Skip (MUST REMOVE)
**Location:** Multiple tests
**Pattern:**
```bash
if [[ condition ]]; then
    run_cli ...
    assert_failure
else
    skip "condition not met"  # or warn "something"
fi
```

**FIX:** Remove the condition, always assert
```bash
run_cli ...
assert_failure
```

**Affected Tests:**
- SEC-SEND-CRYPTO-001 (line 53-80)
- SEC-CRYPTO-001 (line 53-80)
- SEC-DBLSPEND-003 (line 239-251)
- SEC-DBLSPEND-005 (line 380-390)

---

### Pattern 2: Optional Validation (MUST REMOVE)
**Location:** SEC-INTEGRITY tests
**Pattern:**
```bash
run_cli ...
if [[ $exit_code -eq 0 ]]; then
    warn "Something not detected"  # NOT AN ASSERTION
else
    log_info "Detected"
fi
```

**FIX:** Always assert
```bash
run_cli ...
assert_failure "This must fail"
assert_output_contains "specific_error"
```

**Affected Tests:**
- SEC-INTEGRITY-003 (line 196-206)
- SEC-INTEGRITY-005 (line 296-327)

---

### Pattern 3: OR in Assertions (MUST FIX)
**Location:** SEC-INPUT tests and others
**Pattern:**
```bash
assert_output_contains "A" || assert_output_contains "B"
```

**Problem:** Passes if EITHER appears, even if wrong reason

**FIX Option 1:** Use AND (both must appear)
```bash
assert_output_contains "A" && assert_output_contains "B"
```

**FIX Option 2:** Use regex pattern
```bash
assert_output_matches "A.*B|B.*A"
```

**FIX Option 3:** More specific match
```bash
assert_output_matches "invalid.*address|address.*invalid|address.*format"
```

**Affected Tests:**
- SEC-INPUT-001 (line 40)
- SEC-INPUT-003 (lines 40, 131, 137)
- SEC-INPUT-004 (lines 175, 207)
- SEC-INPUT-005 (line 248)
- SEC-INPUT-007 (line 306)
- SEC-DBLSPEND-003 (line 250)
- SEC-DBLSPEND-005 (line 389)
- Many others

---

### Pattern 4: Accept Both Success and Failure (MUST REMOVE)
**Location:** SEC-DBLSPEND-004
**Pattern:**
```bash
run_cli ...
local exit_code=$status

if [[ $exit_code -eq 0 ]]; then
    # Handle success case
    ...
else
    # Handle failure case
    ...
fi
# Test passes either way!
```

**FIX:** Decide which behavior is correct, then assert it
```bash
# Option A: Must succeed (idempotent)
run_cli ...
assert_success
# validate idempotency

# Option B: Must fail (reject duplicate)
run_cli ...
assert_failure
assert_output_contains "duplicate"
```

**Affected Tests:**
- SEC-DBLSPEND-004 (line 294-314)

---

## Test-by-Test Fixes

### SEC-DBLSPEND-001: Same token to two recipients
**Status:** OK - Correctly verifies exactly one succeeds

---

### SEC-DBLSPEND-002: Concurrent submissions
**Issue:** Title says "exactly ONE" but assertion expects "ALL"
**Fix:**
```bash
# Current assertion (line 189-190):
assert_equals "${concurrent_count}" "${success_count}" "Expected ALL receives to succeed (idempotent)"

# This is CORRECT for idempotency testing
# BUT test name should be:
# "SEC-DBLSPEND-002: Idempotent concurrent receipt succeeds"
# NOT: "exactly ONE succeeds"
```
**Action:** Rename test to match its actual purpose

---

### SEC-DBLSPEND-003: Cannot re-spend already transferred token
**Current (Lines 239-251):**
```bash
run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${carol_address} --local -o ${transfer_carol}" || exit_code=$?

if [[ $exit_code -eq 0 ]] && [[ -f "${transfer_carol}" ]]; then
    run_cli_with_secret "${CAROL_SECRET}" "receive-token -f ${transfer_carol} --local -o ${TEST_TEMP_DIR}/carol-token.txf"
    assert_failure
else
    # Skip validation if send-token fails
fi
```

**Fixed:**
```bash
# Always create the transfer (offline operation)
run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${carol_address} --local -o ${transfer_carol}"
assert_success  # Offline packaging should succeed

# Always validate receive fails
run_cli_with_secret "${CAROL_SECRET}" "receive-token -f ${transfer_carol} --local -o ${TEST_TEMP_DIR}/carol-token.txf"
assert_failure  # MUST fail - already spent
assert_output_matches "spent|already|outdated"  # Specific error
```

---

### SEC-DBLSPEND-004: Cannot receive same offline transfer multiple times
**Issue:** Accepts BOTH success (idempotent) and failure
**Decision Needed:** Which is required?
- If idempotent: verify states are IDENTICAL
- If reject duplicates: verify error message

**Current (Lines 294-314):**
```bash
if [[ $exit_code -eq 0 ]]; then
    # Idempotent case
    assert_token_fully_valid ...
    # Only checks token IDs match, not full state
else
    assert_output_contains "already"
fi
```

**If Idempotent (Recommended):**
```bash
run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer} --local -o ${bob_token2}"
assert_success

# Verify complete idempotency
local hash1=$(jq -S -c '.' "${bob_token1}" | sha256sum | cut -d' ' -f1)
local hash2=$(jq -S -c '.' "${bob_token2}" | sha256sum | cut -d' ' -f1)
assert_equals "${hash1}" "${hash2}" "Idempotent receives must produce identical tokens"
```

**If Reject Duplicates:**
```bash
run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer} --local -o ${bob_token2}"
assert_failure
assert_output_contains "duplicate\|already\|already.*received"
```

---

### SEC-DBLSPEND-005: Cannot use intermediate state after subsequent transfer
**Current (Lines 380-390):**
```bash
run_cli_with_secret "${BOB_SECRET}" "send-token -f ${bob_token} -r ${dave_address} --local -o ${transfer_to_dave}" || exit_code=$?

if [[ $exit_code -eq 0 ]]; then
    run_cli_with_secret "${dave_secret}" "receive-token -f ${transfer_to_dave} --local -o ${TEST_TEMP_DIR}/dave-token.txf"
    assert_failure
    assert_output_contains "spent" || assert_output_contains "outdated"
fi
```

**Fixed:**
```bash
# Offline send always succeeds (creates package)
run_cli_with_secret "${BOB_SECRET}" "send-token -f ${bob_token} -r ${dave_address} --local -o ${transfer_to_dave}"
assert_success

# Network must reject receive (state already spent)
run_cli_with_secret "${dave_secret}" "receive-token -f ${transfer_to_dave} --local -o ${TEST_TEMP_DIR}/dave-token.txf"
assert_failure "Cannot receive token from outdated state"
assert_output_matches "spent.*outdated|outdated.*spent|already.*transferred"
```

---

### SEC-DBLSPEND-006: Coin double-spend prevention
**Status:** OK - Correctly validates only one receive succeeds

---

### SEC-INPUT-001: Malformed JSON handling
**Current (Line 40):**
```bash
assert_output_contains "JSON" || assert_output_contains "parse" || assert_output_contains "invalid"
```

**Fixed:**
```bash
assert_output_matches "JSON.*error|error.*JSON|parse.*error|JSON.*parse"
```

---

### SEC-INPUT-007: Special characters in addresses
**Issues:** Multiple (lines 304-328)

**Fix All:**
```bash
# Instead of: assert_output_contains "address" || assert_output_contains "invalid"
assert_output_matches "invalid.*address|address.*invalid"

# Test each injection specifically
assert_output_contains "address"  # AND
assert_output_contains "invalid"
```

---

### SEC-INTEGRITY-001: File corruption detection
**Current (Line 58):**
```bash
dd if=/dev/urandom of="${corrupted}" bs=1 count=10 seek=100 conv=notrunc 2>/dev/null || true
```

**Fixed:**
```bash
dd if=/dev/urandom of="${corrupted}" bs=1 count=10 seek=100 conv=notrunc || {
    assert_failure "Failed to create corrupted test file"
}
```

---

### SEC-INTEGRITY-002: State hash mismatch detection
**Status:** OK - Correctly asserts failure

---

### SEC-INTEGRITY-003: Transaction chain integrity verification
**Current (Lines 196-206):**
```bash
if [[ -n "${tx_count}" ]] && [[ "${tx_count}" -gt "0" ]]; then
    ...
    if [[ $exit_code -eq 0 ]]; then
        warn "Transaction removal not detected"
    else
        log_info "Transaction chain tampering detected"
    fi
fi
```

**Fixed:**
```bash
if [[ -n "${tx_count}" ]] && [[ "${tx_count}" -gt "0" ]]; then
    jq 'del(.transactions[0])' "${carol_token}" > "${tampered_chain}"

    run_cli "verify-token -f ${tampered_chain} --local"
    assert_failure "Removing transactions must be detected"
    assert_output_matches "transaction|chain|integrity"
fi
```

---

### SEC-INTEGRITY-004: Missing required fields detection
**Status:** OK - Correctly asserts failures

---

### SEC-INTEGRITY-005: Status field consistency validation
**Current (Lines 296-327):**
```bash
if [[ $exit_code -eq 0 ]]; then
    warn "Status inconsistency not detected"
else
    log_info "Status inconsistency detected"
fi
```

**Fixed:**
```bash
run_cli "verify-token -f ${wrong_status} --local"
assert_failure "Inconsistent status must be rejected"
assert_output_matches "status|inconsistent"
```

---

### SEC-CRYPTO-001: Tampered genesis proof signature
**Current (Lines 53-80):**
```bash
if [[ -n "${original_sig}" ]] && [[ "${original_sig}" != "null" ]]; then
    ...
    assert_failure
else
    skip "Token format does not expose signature"
fi
```

**Fixed:**
```bash
local original_sig=$(jq -r '.genesis.inclusionProof.authenticator.signature' "${tampered_token}")
assert_set original_sig "Token must have extractable signature for testing"

# Tamper
local corrupted_sig=$(echo "${original_sig}" | sed 's/0/f/g' | head -c ${#original_sig})
jq --arg sig "${corrupted_sig}" '.genesis.inclusionProof.authenticator.signature = $sig' \
    "${tampered_token}" > "${tampered_token}.tmp"
mv "${tampered_token}.tmp" "${tampered_token}"

# Always verify
run_cli "verify-token -f ${tampered_token} --local"
assert_failure "Tampered signature must be detected"
```

---

### SEC-SEND-CRYPTO-001: send-token rejects tampered signature
**Same fix as SEC-CRYPTO-001** - Remove skip fallback

---

## Implementation Checklist

- [ ] Fix all `if [[ $status ]]` conditional assertions
- [ ] Replace all `warn` with `assert_failure`
- [ ] Fix all `||` assertions (use AND or regex)
- [ ] Remove skip fallbacks for test data
- [ ] Verify each test has single correct outcome
- [ ] Add regex assertions where needed
- [ ] Test full suite after changes
- [ ] Document test intent in comments
- [ ] Add --inspect mode to helpers
- [ ] Create separate fault-tolerance test suite

## File-by-File Changes Needed

```
tests/security/test_double_spend.bats
  - Lines 239-251: SEC-DBLSPEND-003
  - Line 189-190: SEC-DBLSPEND-002 (rename)
  - Lines 294-314: SEC-DBLSPEND-004 (decide behavior)
  - Lines 380-390: SEC-DBLSPEND-005

tests/security/test_input_validation.bats
  - Line 40: SEC-INPUT-001
  - Lines 304-328: SEC-INPUT-007
  - Many others

tests/security/test_data_integrity.bats
  - Line 58: SEC-INTEGRITY-001
  - Lines 196-206: SEC-INTEGRITY-003
  - Lines 296-327: SEC-INTEGRITY-005

tests/security/test_cryptographic.bats
  - Lines 53-80: SEC-CRYPTO-001

tests/security/test_send_token_crypto.bats
  - Lines 53-80: SEC-SEND-CRYPTO-001
```

## Testing the Fixes

After each change:
```bash
# Test single file
bats tests/security/test_double_spend.bats

# Test all security
npm run test:security

# Test all
npm test
```

Expected result: All tests still pass, but with stronger assertions
