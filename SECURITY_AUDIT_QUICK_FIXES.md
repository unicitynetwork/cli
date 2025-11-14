# Security Audit: Quick Fix Reference

## 🚨 CRITICAL FIXES REQUIRED IMMEDIATELY

### Fix 1: get_token_status() Must Query Blockchain

**File**: `tests/helpers/token-helpers.bash:641-656`

**Current (BROKEN)**:
```bash
get_token_status() {
  local token_file="${1:?Token file required}"
  if has_offline_transfer "$token_file"; then
    echo "PENDING"
  else
    local tx_count=$(get_transaction_count "$token_file" 2>/dev/null || echo "0")
    if [[ "$tx_count" -gt 0 ]]; then
      echo "TRANSFERRED"
    else
      echo "CONFIRMED"  # ⚠️ WRONG - just reading local file!
    fi
  fi
}
```

**Fixed**:
```bash
get_token_status() {
  local token_file="${1:?Token file required}"

  # SECURITY: Must query aggregator for actual blockchain status
  # Local file can be stale or modified

  if has_offline_transfer "$token_file"; then
    echo "PENDING"
    return 0
  fi

  # Extract RequestId for blockchain query
  local request_id=$(jq -r '.genesis.inclusionProof.requestId // empty' "$token_file")

  if [[ -z "$request_id" ]]; then
    echo "ERROR: Cannot determine status - no RequestId" >&2
    return 1
  fi

  # Query aggregator for actual spent status
  local aggregator_url="${AGGREGATOR_URL:-http://127.0.0.1:3000}"
  local status_response

  if ! status_response=$(curl -s -f "$aggregator_url/api/v1/status/$request_id" 2>/dev/null); then
    # Network unavailable - mark as UNVERIFIED, don't assume CONFIRMED
    echo "UNVERIFIED"
    return 0
  fi

  # Parse aggregator response
  local spent_status=$(echo "$status_response" | jq -r '.spent // false')

  if [[ "$spent_status" == "true" ]]; then
    echo "SPENT"
  else
    echo "CONFIRMED"
  fi
}
```

---

### Fix 2: SEC-DBLSPEND-002 Must Enforce Single-Spend

**File**: `tests/security/test_double_spend.bats:122-197`

**Current (BROKEN)**:
```bash
# Fault tolerance assertion: ALL should succeed (idempotent behavior)
assert_equals "${concurrent_count}" "${success_count}" "Expected ALL receives to succeed (idempotent)"
assert_equals "0" "${failure_count}" "Expected zero failures for idempotent operations"
```

**Fixed**:
```bash
# SECURITY CRITICAL: Exactly ONE receive should succeed
# This is the DEFINITION of double-spend prevention
assert_equals "1" "${success_count}" "Expected exactly ONE successful receive (double-spend prevention)"

# All others MUST fail with spent/duplicate error
if [[ $failure_count -gt 0 ]]; then
    # Verify failures are due to double-spend detection, not other errors
    for i in $(seq 1 ${concurrent_count}); do
        if [[ -f "${TEST_TEMP_DIR}/exit-${i}.txt" ]]; then
            local exit_code=$(cat "${TEST_TEMP_DIR}/exit-${i}.txt")
            if [[ $exit_code -ne 0 ]]; then
                # Check that failure is due to double-spend, not network error
                local error_log="${TEST_TEMP_DIR}/bob-token-attempt-${i}.txf.log"
                if [[ -f "$error_log" ]]; then
                    grep -qiE "(already.*spent|duplicate|exists)" "$error_log" || \
                        fail "Receive failed but not due to double-spend detection"
                fi
            fi
        fi
    done
fi

log_success "SEC-DBLSPEND-002: Double-spend prevented - exactly one receive succeeded"
```

---

### Fix 3: Remove Silent Failure Masking (|| echo "0")

**Files**: Multiple in `tests/helpers/token-helpers.bash`

**Current (BROKEN)**:
```bash
get_total_coin_amount() {
  local token_file="${1:?Token file required}"
  jq '[.genesis.data.coinData[].amount | tonumber] | add' "$token_file" 2>/dev/null || echo "0"
}

get_transaction_count() {
  local token_file="${1:?Token file required}"
  jq '.transactions | length' "$token_file" 2>/dev/null || echo "0"
}
```

**Fixed**:
```bash
get_total_coin_amount() {
  local token_file="${1:?Token file required}"

  # Don't mask errors - let them propagate
  local amount
  amount=$(jq '[.genesis.data.coinData[].amount | tonumber] | add' "$token_file" 2>&1) || {
    echo "ERROR: Failed to parse coin amount from $token_file: $amount" >&2
    return 1
  }

  # Validate result is a number
  if ! [[ "$amount" =~ ^[0-9]+$ ]]; then
    echo "ERROR: Invalid coin amount: $amount" >&2
    return 1
  fi

  echo "$amount"
}

get_transaction_count() {
  local token_file="${1:?Token file required}"

  local count
  count=$(jq '.transactions | length' "$token_file" 2>&1) || {
    echo "ERROR: Failed to read transactions from $token_file: $count" >&2
    return 1
  }

  # Validate result
  if ! [[ "$count" =~ ^[0-9]+$ ]]; then
    echo "ERROR: Invalid transaction count: $count" >&2
    return 1
  fi

  echo "$count"
}
```

---

### Fix 4: Replace OR-Chain Assertions

**Pattern**: `assert_output_contains "a" || assert_output_contains "b" || assert_output_contains "c"`

**Current (BROKEN)**:
```bash
# Tests pass if ANY of these strings appear, even wrong ones
assert_output_contains "signature" || assert_output_contains "verification" || assert_output_contains "invalid"
```

**Fixed Option 1 - Specific Error**:
```bash
# Require SPECIFIC error message
assert_output_contains "Signature verification failed" || \
    fail "Expected specific error: 'Signature verification failed', got: ${output}${stderr_output}"
```

**Fixed Option 2 - All Errors Acceptable**:
```bash
# If multiple errors are genuinely acceptable, use helper
assert_output_contains_any() {
    local patterns=("$@")
    for pattern in "${patterns[@]}"; do
        if echo "${output}${stderr_output}" | grep -qE "$pattern"; then
            return 0
        fi
    done
    fail "Output did not contain any expected pattern: ${patterns[*]}\nActual: ${output}${stderr_output}"
}

# Use it
assert_output_contains_any "signature.*verification.*failed" "ownership.*mismatch" "invalid.*predicate"
```

**Fixed Option 3 - Document Why Multiple Errors**:
```bash
# SECURITY NOTE: Multiple error messages acceptable because:
# - SDK may return "signature verification failed" OR
# - CLI may detect "ownership mismatch" before SDK
# Both indicate attack was PREVENTED at different layers

assert_output_contains "signature" || assert_output_contains "ownership" || {
    fail "Expected signature or ownership error (attack should be prevented), got: ${output}"
}
```

---

### Fix 5: SEC-ACCESS-004 Must Fail, Not Skip

**File**: `tests/security/test_access_control.bats:212-235`

**Current (BROKEN)**:
```bash
if [[ "${status:-0}" -eq 0 ]]; then
    log_info "WARNING: Fake trustbase accepted - should be rejected"
    skip "Trustbase authenticity validation not implemented (pending)"
fi
```

**Fixed**:
```bash
# CRITICAL: Fake trustbase MUST be rejected
assert_failure "Fake trustbase must be rejected for security"

# Verify specific error message
assert_output_contains "trustbase" || assert_output_contains "invalid.*network" || \
    fail "Expected trustbase validation error, got: ${output}"

log_success "SEC-ACCESS-004: Fake trustbase correctly rejected"
```

**If Trustbase Validation Not Implemented Yet**:
```bash
# Mark test as FAILING, not skipped
if [[ "${status:-0}" -eq 0 ]]; then
    fail "SECURITY VULNERABILITY: Fake trustbase was accepted! Trustbase authenticity validation MUST be implemented."
fi

# This makes test FAIL (red in CI) instead of SKIP (yellow)
# Forces team to fix or acknowledge security risk
```

---

### Fix 6: SEC-AUTH-005 Must Enforce Security Property

**File**: `tests/security/test_authentication.bats:313-378`

**Current (BROKEN)**:
```bash
if [[ $exit_code -eq 0 ]]; then
    log_info "Nonce reuse succeeded - this is acceptable behavior"
else
    log_info "Nonce reuse was rejected - SDK enforces one-time nonce use"
fi
log_success "SEC-AUTH-005: Nonce reuse behavior verified (accepts either design choice)"
```

**Fixed**:
```bash
# SECURITY DECISION: Choose ONE behavior and enforce it

# Option A: Enforce one-time nonce use (privacy-preserving)
assert_failure "Nonce reuse must be prevented for privacy (masked address unlinkability)"
assert_output_contains "nonce.*already.*used" || assert_output_contains "duplicate.*address"
log_success "SEC-AUTH-005: Nonce reuse correctly prevented (privacy preserved)"

# OR Option B: Allow nonce reuse but document implications
if [[ $exit_code -eq 0 ]]; then
    log_info "SECURITY NOTE: Nonce reuse allowed"
    log_info "IMPLICATION: Multiple tokens to same masked address are linkable"
    log_info "PRIVACY: Reduced - observer can link receives to same recipient"

    # Verify both tokens are distinct
    local token1_id=$(jq -r '.genesis.data.tokenId' "${bob_token1}")
    local token2_id=$(jq -r '.genesis.data.tokenId' "${bob_token2}")
    assert_not_equals "${token1_id}" "${token2_id}" "Different tokens must have different IDs"

    log_success "SEC-AUTH-005: Nonce reuse allowed (with documented privacy trade-off)"
else
    fail "Expected nonce reuse to succeed per documented behavior"
fi
```

---

## 🔧 SYSTEMATIC FIXES FOR ALL TESTS

### Pattern 1: Add Content Validation After File Checks

**Before**:
```bash
run_cli "mint-token ... -o ${token_file}"
assert_success
assert_file_exists "${token_file}"
```

**After**:
```bash
run_cli "mint-token ... -o ${token_file}"
assert_success
assert_file_exists "${token_file}"

# SECURITY: Validate file actually contains valid token
assert_valid_json "${token_file}"
assert_json_field_exists "${token_file}" ".genesis.data.tokenId"
assert_json_field_exists "${token_file}" ".state.predicate"
assert_json_field_exists "${token_file}" ".genesis.inclusionProof"
```

---

### Pattern 2: Enforce Specific Error Messages

**Before**:
```bash
run_cli_with_secret "${WRONG_SECRET}" "send-token ..."
assert_failure
```

**After**:
```bash
run_cli_with_secret "${WRONG_SECRET}" "send-token ..."
assert_failure

# SECURITY: Verify WHY it failed (must be signature/ownership, not parsing error)
assert_output_contains "signature.*verification" || \
    assert_output_contains "ownership.*check.*failed" || \
    fail "Expected authentication failure, got: ${output}${stderr_output}"
```

---

### Pattern 3: Query Blockchain Instead of Local Files

**Before**:
```bash
local status=$(get_token_status "${token_file}")
assert_equals "CONFIRMED" "${status}"
```

**After**:
```bash
# Query actual blockchain status
local request_id=$(jq -r '.genesis.inclusionProof.requestId' "${token_file}")
local blockchain_status=$(curl -s "$AGGREGATOR_URL/api/v1/status/$request_id" | jq -r '.spent')

assert_equals "false" "${blockchain_status}" "Token must be unspent on blockchain"
```

---

### Pattern 4: Don't Skip Security Tests

**Before**:
```bash
if [[ ! -f "$required_file" ]]; then
    skip "Required file not available"
fi
```

**After**:
```bash
# SECURITY: Required files missing is a FAILURE, not a skip
if [[ ! -f "$required_file" ]]; then
    fail "Security test cannot proceed: required file $required_file missing. This indicates broken test setup or security feature not implemented."
fi
```

---

### Pattern 5: Validate Double-Spend Prevention

**Before**:
```bash
# Both Bob and Carol try to receive
run receive_token "$BOB_SECRET" ...
local bob_exit=$?

run receive_token "$CAROL_SECRET" ...
local carol_exit=$?

# Count successes (may be 0, 1, or 2)
info "Results: ..."
```

**After**:
```bash
# Both try to receive
run receive_token "$BOB_SECRET" ...
local bob_exit=$?

run receive_token "$CAROL_SECRET" ...
local carol_exit=$?

# SECURITY: Exactly ONE must succeed
local success_count=0
[[ $bob_exit -eq 0 ]] && ((success_count++))
[[ $carol_exit -eq 0 ]] && ((success_count++))

assert_equals "1" "$success_count" "Double-spend prevention: exactly ONE receive must succeed"

# Verify failure was due to double-spend, not other error
if [[ $bob_exit -ne 0 ]]; then
    assert_output_contains "spent" || assert_output_contains "already.*received"
elif [[ $carol_exit -ne 0 ]]; then
    assert_output_contains "spent" || assert_output_contains "already.*received"
fi
```

---

## 📋 PRIORITY CHECKLIST

### Immediate (This Week)
- [ ] Fix `get_token_status()` blockchain query
- [ ] Fix SEC-DBLSPEND-002 to enforce single-spend
- [ ] Remove all `|| echo "0"` fallbacks
- [ ] Fix SEC-ACCESS-004 to fail on fake trustbase
- [ ] Fix SEC-AUTH-005 to enforce chosen behavior

### Short-Term (Next 2 Weeks)
- [ ] Replace all OR-chain assertions
- [ ] Add content validation after file existence checks
- [ ] Add specific error message validation to all security tests
- [ ] Convert all `skip` in security tests to `fail`
- [ ] Add blockchain verification to double-spend tests

### Medium-Term (Next Month)
- [ ] Create helper functions for blockchain validation
- [ ] Implement `assert_token_unspent_on_chain()`
- [ ] Implement `assert_output_contains_any()` helper
- [ ] Add security property documentation to all tests
- [ ] Create security test quality audit script

### Ongoing
- [ ] Review all new tests with security checklist
- [ ] Never use `|| echo "0"` pattern
- [ ] Always validate content, not just file existence
- [ ] Always query blockchain for security-critical validation
- [ ] Never skip security tests - fail with tracking instead

---

## 🎯 VALIDATION STRATEGY

After implementing fixes, verify with:

```bash
# 1. Run security test suite
npm run test:security

# 2. Verify all critical tests still pass
grep -r "CRITICAL" tests/security/*.bats

# 3. Verify no tests skip security validation
! grep -r "skip.*not implemented" tests/security/*.bats

# 4. Verify blockchain queries in place
grep -r "get_token_status" tests/security/*.bats | grep -q "AGGREGATOR_URL"

# 5. Check for OR-chain assertions
! grep -r "assert_output_contains.*||.*assert_output_contains.*||" tests/security/*.bats

# 6. Verify no silent failures
! grep -r "|| echo \"0\"" tests/helpers/*.bash
```

---

## 📚 REFERENCE

Full audit report: `/home/vrogojin/cli/SECURITY_AUDIT_CRITICAL_FINDINGS.md`

Key metrics:
- **Critical issues**: 12
- **High-risk issues**: 18
- **Medium-risk issues**: 8
- **Tests needing fixes**: 40+
- **Security confidence**: Currently 40%, target 95%

**Status**: Ready for immediate implementation
**Priority**: CRITICAL - Security team review required
