# Test Quality Quick Fixes - Critical Issues Only

## The 7 Most Critical Test Patterns to Fix

### Pattern 1: Commands without assertions (CRITICAL-001)

**BAD:**
```bash
@test "Test something" {
    run_cli some_command
    # No assert_success or assert_failure!
    # Test always passes
}
```

**GOOD:**
```bash
@test "Test something" {
    run_cli some_command
    assert_success  # Or assert_failure - MUST be present
}
```

**Affected Tests:**
- `test_input_validation.bats:156-167, 172-183, 218-250`
- `test_cryptographic.bats:81-84, 93-134, 243-274`
- `test_double_spend.bats` (multiple locations)

---

### Pattern 2: Using || true to hide failures (CRITICAL-006)

**BAD:**
```bash
run_cli "some-command" || true  # Silently hides failure

# Later - no assertion on whether it succeeded or failed
[[ "$output" == *"NOT_FOUND"* ]] || true  # Always passes!
```

**GOOD:**
```bash
run_cli "some-command"
if [[ $status -eq 0 ]]; then
    assert_output_contains "expected success message"
else
    assert_output_contains "expected error message"
fi
```

**Affected Tests:**
- `test_aggregator_operations.bats:159-164` - Non-existent request test
- `test_input_validation.bats:174, 229, 240` - Multiple tests
- `test_double_spend.bats:159-162` - Background process test
- `test_cryptographic.bats:159, 392` - Multiple crypto tests

---

### Pattern 3: Accepting both success and failure (CRITICAL-005, CRITICAL-007)

**BAD:**
```bash
run_cli "mint-token --preset uct -c ${negative_amount}" || true

if [[ -f "token.txf" ]]; then
    # Success case - no assertion that negative amounts ARE allowed
    log "Token created"
else
    # Failure case - no assertion that negative amounts MUST fail
    log "Rejected"
fi
# Both cases equally acceptable?
```

**GOOD:**
```bash
# Define: Negative amounts MUST be rejected
run_cli "mint-token --preset uct -c ${negative_amount}"
assert_failure "Negative amounts MUST be rejected"
assert_output_contains "negative\|invalid"
```

**Affected Tests:**
- `test_mint_token.bats:491-514` - Negative amount test
- `test_double_spend.bats:273-332` - Idempotent receive test
- `test_receive_token.bats:173-207` - Re-receive test
- `test_input_validation.bats:156-167, 172-183` - Multiple path tests

---

### Pattern 4: Conditional skip on critical features (CRITICAL-003)

**BAD:**
```bash
@test "Test critical security feature" {
    if [[ -n "${SIGNATURE}" ]]; then
        # Run actual test
    else
        skip "Signature not exposed"  # This is a CRITICAL BUG!
    fi
}
```

**GOOD:**
```bash
@test "Test critical security feature" {
    # Signature MUST be exposed - it's a security requirement
    local sig=$(jq -r '.signature' token.txf)
    [[ -n "$sig" ]] || fail "Signature field MUST be present in token"

    # Now test tampering detection
    # ... actual test ...
}
```

**Affected Tests:**
- `test_cryptographic.bats:32-84` - Signature tampering test
- `test_cryptographic.bats:81-84` - Merkle path tampering test
- `test_verify_token.bats:163-190` - Outdated token detection
- `test_integration.bats:213-236` - Multi-hop test
- `test_integration.bats:228-236` - 3-level postponement test

---

### Pattern 5: Variable assignments instead of assertions (CRITICAL-002)

**BAD:**
```bash
if [[ $bob_exit -eq 0 ]]; then
    : $((success_count++))  # This is NOT an assertion!
fi

# Later
assert_equals "1" "${success_count}"  # Will this value be accurate?
```

**GOOD:**
```bash
if [[ $bob_exit -eq 0 ]]; then
    assert_file_exists "${bob_received}"
    assert_token_fully_valid "${bob_received}"
    success_count=$((success_count + 1))
else
    failure_count=$((failure_count + 1))
fi

# And properly assert at end
assert_equals "1" "${success_count}" "Expected exactly ONE successful transfer"
```

**Affected Tests:**
- `test_double_spend.bats:77-109` - Double-spend test

---

### Pattern 6: Comments claiming assertions exist when they don't (CRITICAL-004)

**BAD:**
```bash
# Carol tries to receive - MUST fail
run_cli_with_secret "${CAROL_SECRET}" "receive-token -f ${transfer} -o output.txf"

# This MUST fail - token already spent
# CRITICAL: This assertion must ALWAYS execute
assert_failure  # But what if run_cli exits early?
```

**GOOD:**
```bash
# Carol tries to receive - MUST fail
local carol_exit=0
run_cli_with_secret "${CAROL_SECRET}" "receive-token -f ${transfer} -o output.txf" || carol_exit=$?

# Verify failure
[[ $carol_exit -ne 0 ]] || fail "Double-spend MUST be rejected"
```

**Affected Tests:**
- `test_double_spend.bats:233-263` - Re-spend test (though this one is actually correct)

---

### Pattern 7: No assertion after variable extraction (Related to CRITICAL-001)

**BAD:**
```bash
local request_id=$(echo "$output" | grep -oP '...' | head -n1)
assert_set request_id  # What if grep found nothing?

local token_id=$(jq -r '.genesis.data.tokenId' token.txf)  # No assertion!
```

**GOOD:**
```bash
local request_id=$(echo "$output" | grep -oP '(?<=Request ID: )[0-9a-fA-F]{68}' | head -n1)
[[ -n "${request_id}" ]] || fail "No valid request ID found in output"
is_valid_hex "${request_id}" 68

local token_id=$(jq -r '.genesis.data.tokenId' token.txf)
[[ -n "${token_id}" ]] || fail "Cannot extract token ID"
[[ ${#token_id} -eq 64 ]] || fail "Token ID must be 64 hex chars, got: ${token_id}"
```

**Affected Tests:**
- `test_aggregator_operations.bats:37-40` - Request ID extraction
- `test_mint_token.bats:443-450, 469-473` - Token ID extraction
- Multiple tests extracting jq values

---

## Checklist: How to Review Each Test

Use this checklist when reviewing test files:

- [ ] Every `run_cli` or similar command is followed by `assert_success`, `assert_failure`, or explicit exit code check
- [ ] No `|| true` unless followed by explicit check of success/failure
- [ ] Every variable extraction (jq, grep, etc.) is followed by validation
- [ ] Every conditional has assertions in ALL branches (no silent pass on one path)
- [ ] No `skip` on critical security features unless justified in comment
- [ ] No comments claiming assertions exist when they don't
- [ ] All helper function calls validated for non-empty output
- [ ] No tests accepting both success and failure equally

---

## Examples of Fixes

### Example 1: test_input_validation.bats:156-167

**Current Code:**
```bash
local exit_code=0
run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft -o ${traversal_path}" || exit_code=$?

if [[ $exit_code -eq 0 ]]; then
    log_info "RESULT: Relative paths accepted (expected CLI behavior)"
else
    log_info "RESULT: Relative paths rejected (acceptable)"
fi
```

**Fixed Code:**
```bash
# Decision: Relative paths should be allowed if within test directory
local exit_code=0
run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft -o ${traversal_path}" || exit_code=$?

# We expect success (test can write to relative paths)
assert_equals "0" "${exit_code}" "Relative paths must be accepted"
assert_file_exists "${traversal_path}"
is_valid_txf "${traversal_path}"
```

---

### Example 2: test_aggregator_operations.bats:150-165

**Current Code:**
```bash
run_cli "get-request ${fake_request_id} --local --json" || true

[[ "$output" == *"NOT_FOUND"* ]] || [[ "$output" == *"not found"* ]] || true
```

**Fixed Code:**
```bash
run_cli "get-request ${fake_request_id} --local --json"

# Expected: Either fails OR returns NOT_FOUND status
if [[ $status -eq 0 ]]; then
    # Success - should indicate not found
    assert_output_contains "NOT_FOUND"
else
    # Failure - should mention not found
    assert_output_contains "not found"
fi
```

---

### Example 3: test_mint_token.bats:491-514

**Current Code:**
```bash
run_cli_with_secret "${SECRET}" "mint-token --preset uct -c '${negative_amount}' --local -o token.txf" || true

if [[ -f "token.txf" ]]; then
    # Accept both success and failure
    assert_token_fully_valid "token.txf"
else
    info "Negative amount rejected"
fi
```

**Fixed Code:**
```bash
# DECISION: Negative amounts MUST always be rejected
run_cli_with_secret "${SECRET}" "mint-token --preset uct -c '${negative_amount}' --local -o token.txf"

# Assert failure
assert_failure "Negative amounts MUST be rejected"

# Verify error message
if ! (echo "${output}${stderr_output}" | grep -qiE "(negative|invalid|amount)"); then
    fail "Expected error mentioning 'negative' or 'invalid', got: ${output}"
fi

# Verify no token file created
[[ ! -f "token.txf" ]] || fail "Token file should not be created for negative amount"
```

---

## Implementation Strategy

1. **Week 1:** Fix all CRITICAL-006 issues (|| true patterns)
2. **Week 2:** Fix all CRITICAL-001 issues (missing assertions)
3. **Week 3:** Fix all CRITICAL-003 issues (conditional skips)
4. **Week 4:** Fix all remaining CRITICAL issues
5. **Week 5-6:** Address HIGH priority issues
6. **Week 7:** Address MEDIUM issues

---

## Testing Your Fixes

Run these commands to verify improvements:

```bash
# Run all tests and capture failures
npm test 2>&1 | tee test-results.txt

# Check for "|| true" patterns (usually problematic)
grep -r "|| true" tests/*.bats | head -20

# Check for "skip" on non-optional features
grep -r 'skip "' tests/security/*.bats

# Check for tests without clear assertions
grep -B5 "^}" tests/functional/*.bats | grep -v assert | head -20
```

---

## Questions to Ask When Reviewing Tests

1. **What should this test assert?** (Not: what does it currently do)
2. **Can this test pass when it should fail?**
3. **Is there a conditional that accepts both success and failure?**
4. **Does the test skip on critical functionality?**
5. **Are all variable extractions validated?**
6. **Are there any `|| true` without explicit checks?**
7. **Would a developer understand why this test exists?**
8. **Can the test run in any order, or does it depend on prior tests?**

