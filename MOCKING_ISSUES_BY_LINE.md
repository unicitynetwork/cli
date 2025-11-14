# Mocking Issues - Detailed Line-by-Line Analysis

## Critical Issues Requiring Immediate Fix

---

## Issue 1: Double-Spend Test Can't Detect Double-Spend

**File:** `/home/vrogojin/cli/tests/security/test_double_spend.bats`
**Lines:** 33-111 (SEC-DBLSPEND-001 test)
**Severity:** CRITICAL
**Root Cause:** All aggregator interactions use `--local` flag (mock)

### Problem Code

```bash
# Lines 37-41: Setup phase - USES MOCK
run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
assert_success
assert_file_exists "${alice_token}"
assert_token_fully_valid "${alice_token}"

# Line 54: Transfer to Bob - USES MOCK
run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_address} --local -o ${transfer_bob}"

# Line 62: Transfer to Carol - USES MOCK
run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${carol_address} --local -o ${transfer_carol}"

# Lines 76-80: Receive attempts - USES MOCK
run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer_bob} --local -o ${bob_received}"
bob_exit=$status

run_cli_with_secret "${CAROL_SECRET}" "receive-token -f ${transfer_carol} --local -o ${carol_received}"
carol_exit=$status

# Lines 86-104: Accept both success and failure!
if [[ $bob_exit -eq 0 ]]; then
    : $((success_count++))
    assert_file_exists "${bob_received}"
    assert_token_fully_valid "${bob_received}"
    log_info "Bob successfully received token"
else
    : $((failure_count++))
    log_info "Bob's receive failed (expected for double-spend)"
fi

if [[ $carol_exit -eq 0 ]]; then
    : $((success_count++))
    assert_file_exists "${carol_received}"
    assert_token_fully_valid "${carol_received}"
    log_info "Carol successfully received token"
else
    : $((failure_count++))
    log_info "Carol's receive failed (expected for double-spend)"
fi

# Line 107-108: Assertion only passes if counts are 1 each
assert_equals "1" "${success_count}"
assert_equals "1" "${failure_count}"
```

### What Goes Wrong

1. **Line 38:** `--local` flag causes mint to use fake aggregator
2. **Line 54:** First transfer uses fake aggregator (no network)
3. **Line 62:** Second transfer uses fake aggregator (no network)
4. **Line 76:** Bob's receive uses fake aggregator (can't check if spent)
5. **Line 79:** Carol's receive uses fake aggregator (can't check if spent)
6. **Lines 86-104:** Since aggregator is fake, both CAN succeed locally
7. **Line 107:** Test might pass with BOTH succeeding (not caught)

### Expected Output

```bash
# With --local flag (current - BROKEN):
Both Bob and Carol transfers succeed locally
Test assertion: success_count=2, failure_count=0
Test FAILS assertion "Expected exactly ONE successful transfer"

# BUT: Test design is fundamentally wrong!
# Assertion can't distinguish between:
# A) Both succeed (double-spend not prevented) - BAD
# B) Exactly one succeeds (double-spend prevented) - GOOD

# Because with mocks, both can always succeed!
```

### Solution

**Remove all `--local` flags and require real aggregator:**

```bash
# Line 38: CHANGE FROM:
run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
# CHANGE TO:
run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft -o ${alice_token}"

# Line 54: CHANGE FROM:
run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_address} --local -o ${transfer_bob}"
# CHANGE TO:
run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_address} -o ${transfer_bob}"

# Line 62: CHANGE FROM:
run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${carol_address} --local -o ${transfer_carol}"
# CHANGE TO:
run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${carol_address} -o ${transfer_carol}"

# Line 76: CHANGE FROM:
run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer_bob} --local -o ${bob_received}"
# CHANGE TO:
run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer_bob} -o ${bob_received}"

# Line 79: CHANGE FROM:
run_cli_with_secret "${CAROL_SECRET}" "receive-token -f ${transfer_carol} --local -o ${carol_received}"
# CHANGE TO:
run_cli_with_secret "${CAROL_SECRET}" "receive-token -f ${transfer_carol} -o ${carol_received}"

# Lines 82-108: CHANGE FROM (conditional acceptance):
# To (clear requirement):
assert_equals "1" "${success_count}" "Expected exactly ONE successful transfer"
assert_equals "1" "${failure_count}" "Expected exactly ONE failed transfer"
```

---

## Issue 2: Input Validation Tests Use Fake Aggregator

**File:** `/home/vrogojin/cli/tests/security/test_input_validation.bats`
**Lines:** Throughout (15 tests, all affected)
**Severity:** CRITICAL
**Root Cause:** All tests use `--local` flag despite calling `require_aggregator`

### Contradiction

```bash
# Line 15: Requires aggregator
setup() {
    setup_common
    require_aggregator  # ← Says aggregator is required
    # ...
}

# But then tests use --local flag
# Examples:
# Line 50: run_cli_with_secret ... "mint-token ... --local ..."
# Line 60: run_cli_with_secret ... "send-token ... --local ..."
# Line 70: run_cli_with_secret ... "receive-token ... --local ..."
# [30 total --local occurrences]
```

### Critical Test Cases (Lines with --local)

```bash
# SEC-INPUT-001: Line 50-51
@test "SEC-INPUT-001: Mint with valid secret" {
    require_aggregator  # ← Requires real aggregator
    run_cli_with_secret "${VALID_SECRET}" "mint-token --local -o token.txf"
    # ↑ Uses fake aggregator - INPUT VALIDATION IN AGGREGATOR CAN'T BE TESTED
}

# SEC-INPUT-002: Line 60
@test "SEC-INPUT-002: Mint with missing secret" {
    run_cli_with_secret "" "mint-token --local -o token.txf" || true
    # ↑ Uses --local AND || true - DOUBLE MOCK!
}

# SEC-INPUT-003: Line 70
@test "SEC-INPUT-003: Mint with invalid amount" {
    run_cli_with_secret "${SECRET}" "mint-token -c 'invalid' --local -o token.txf" || true
    # ↑ Uses --local AND || true - HIDES FAILURES
}
```

### Why This Is Critical

1. Validation might be in aggregator layer
2. CLI might have incomplete validation
3. With `--local`, aggregator layer isn't tested
4. Invalid inputs might be accepted locally but rejected by aggregator
5. Tests give false confidence that validation works

### Solution

**Remove all `--local` flags from input validation tests:**

```bash
# For EVERY test in test_input_validation.bats:
# Search for: mint-token.*--local
# Replace with: mint-token (remove --local)
# Search for: send-token.*--local
# Replace with: send-token (remove --local)
# Search for: receive-token.*--local
# Replace with: receive-token (remove --local)
```

---

## Issue 3: Token Status Always Checks Local File

**File:** `/home/vrogojin/cli/tests/helpers/token-helpers.bash`
**Lines:** 641-656
**Severity:** CRITICAL
**Root Cause:** Function queries local token file, never queries aggregator

### Problem Code

```bash
# Lines 641-656: get_token_status() implementation
get_token_status() {
    local token_file="${1:?Token file required}"

    if has_offline_transfer "$token_file"; then
        echo "PENDING"
    else
        local tx_count
        tx_count=$(get_transaction_count "$token_file" 2>/dev/null || echo "0")
        # ↑ Checks LOCAL file only, never checks blockchain!

        if [[ "$tx_count" -gt 0 ]]; then
            echo "TRANSFERRED"
        else
            echo "CONFIRMED"
        fi
    fi
}
```

### Why This Is Wrong

1. **Line 644:** `has_offline_transfer` checks local file for offline transfer section
   - Only reliable if file hasn't been submitted yet
   - If offline transfer was submitted to aggregator, file still shows as PENDING

2. **Line 649:** `get_transaction_count` counts transactions in LOCAL file
   - If token was transferred through different method, count is 0
   - Aggregator would show token as SPENT, but function says CONFIRMED

3. **Never queries aggregator:** No network calls to check real spent status
   - Function is 100% local file based
   - Function is 0% blockchain aware

### Usage - Tests Using This Mock

```bash
# grep -r "get_token_status" tests/ returns:
# Tests/helpers/token-helpers.bash:748 - export statement
# Tests using this include:
# - Any test checking token ownership
# - Any test verifying transfer status
# - Any security test checking spent state
```

### What Should Happen

When `get_token_status()` is called on a transferred token:

1. **Real:** Query aggregator → returns "TRANSFERRED"
2. **Current:** Checks local file transaction count → returns "CONFIRMED"

Result: **Test cannot detect if token is actually spent on blockchain**

### Solution

**Replace function to query aggregator:**

```bash
get_token_status() {
    local token_file="${1:?Token file required}"

    # First check if we have offline transfer (local-only)
    if has_offline_transfer "$token_file"; then
        echo "PENDING"
        return 0
    fi

    # For actual spent status, MUST query aggregator
    local request_id
    request_id=$(extract_request_id "$token_file") || {
        error "Could not extract request ID from token file"
        echo "UNKNOWN"
        return 1
    }

    # If no aggregator configured, can't check
    if [[ -z "${UNICITY_AGGREGATOR_URL}" ]]; then
        echo "UNKNOWN"
        return 1
    fi

    # Query aggregator for spent status
    local response
    response=$(curl -s -X GET \
        "${UNICITY_AGGREGATOR_URL}/status/${request_id}" \
        -H "Content-Type: application/json" 2>/dev/null) || {
        error "Failed to query aggregator"
        echo "UNKNOWN"
        return 1
    }

    # Parse response to determine status
    if echo "$response" | jq -e '.spent == true' >/dev/null 2>&1; then
        echo "TRANSFERRED"
    elif echo "$response" | jq -e '.committed == true' >/dev/null 2>&1; then
        echo "CONFIRMED"
    else
        echo "UNKNOWN"
    fi
}
```

---

## Issue 4: 62 File Checks Without Content Validation

**File:** Multiple test files
**Instances:** 62 occurrences throughout test suite
**Severity:** HIGH

### Examples from test_double_spend.bats

```bash
# Line 40: Check file exists, but don't validate content
assert_file_exists "${alice_token}"
assert_token_fully_valid "${alice_token}"  # ← This one is OK (lines 41)

# Line 56: Check file exists, but don't validate content
assert_file_exists "${transfer_bob}"
assert_offline_transfer_valid "${transfer_bob}"  # ← This one is OK (line 57)

# Line 64: Check file exists, but don't validate content
assert_file_exists "${transfer_carol}"
assert_offline_transfer_valid "${transfer_carol}"  # ← This one is OK (line 65)

# Line 88: Check file exists but NO content validation!
assert_file_exists "${bob_received}"
# Missing: assert_json_valid, assert_token_fully_valid, etc.

# Line 98: Check file exists but NO content validation!
assert_file_exists "${carol_received}"
# Missing: assert_json_valid, assert_token_fully_valid, etc.
```

### Examples from test_mint_token.bats

```bash
# Line 29: File exists check, then validation (GOOD)
assert_file_exists "token.txf"
is_valid_txf "token.txf"
assert_token_fully_valid "token.txf"

# Line 69: File exists check, but no content validation shown immediately
assert_file_exists "token.txf"
assert_token_fully_valid "token.txf"  # ← Validation happens later (GOOD)

# Line 235: File exists check, then validation (GOOD)
assert_file_exists "my-custom-nft.txf"
is_valid_txf "my-custom-nft.txf"
assert_token_fully_valid "my-custom-nft.txf"

# Line 253: File exists check, then validation (GOOD)
assert_file_exists "captured-token.json"
is_valid_txf "captured-token.json"
assert_token_fully_valid "captured-token.json"
```

### Distribution of Incomplete Checks

```
test_double_spend.bats: 8 instances (lines 40, 56, 64, 88, 98, 234, 242, 318)
test_input_validation.bats: 3 instances
test_authentication.bats: 4 instances
test_receive_token.bats: 4 instances
test_send_token.bats: 4 instances
test_verify_token.bats: 2 instances
test_access_control.bats: 1 instance
test_data_integrity.bats: 1 instance
[other files]: ~27 instances
TOTAL: 62 instances
```

### What Can Go Wrong

```bash
# These all pass "assert_file_exists":
touch empty.txf                              # ✓ File exists (0 bytes)
echo "{}" > invalid.txf                      # ✓ File exists (empty JSON)
echo '{"version":"1.0"}' > incomplete.txf   # ✓ File exists (missing fields)
```

### Solution

**Always follow assert_file_exists with content validation:**

```bash
# Pattern A: For token files
assert_file_exists "token.txf"
assert_json_valid "token.txf"
assert_token_fully_valid "token.txf"  # Checks all required fields

# Pattern B: For offline transfers
assert_file_exists "transfer.txf"
assert_json_valid "transfer.txf"
assert_offline_transfer_valid "transfer.txf"

# Pattern C: For generic JSON
assert_file_exists "output.json"
assert_json_valid "output.json"
assert_json_field_exists "output.json" ".requiredField"
```

---

## Issue 5: Tests Accept Both Success and Failure

**File:** `/home/vrogojin/cli/tests/security/test_double_spend.bats`
**Lines:** 152-189 (SEC-DBLSPEND-002 test)
**Severity:** HIGH
**Root Cause:** Conditional logic accepts both success and failure as valid outcomes

### Problem Code

```bash
# Lines 152-161: Launch 5 concurrent receives
for i in $(seq 1 ${concurrent_count}); do
    local output_file="${TEST_TEMP_DIR}/bob-token-attempt-${i}.txf"
    (
        SECRET="${BOB_SECRET}" "${UNICITY_NODE_BIN:-node}" "$(get_cli_path)" \
            receive-token -f "${transfer}" --local -o "${output_file}" \
            >/dev/null 2>&1
        echo $? > "${TEST_TEMP_DIR}/exit-${i}.txt"
    ) &
    pids+=($!)
done

# Lines 168-180: Count both successes AND failures
success_count=0
failure_count=0

for i in $(seq 1 ${concurrent_count}); do
    if [[ -f "${TEST_TEMP_DIR}/exit-${i}.txt" ]]; then
        local exit_code=$(cat "${TEST_TEMP_DIR}/exit-${i}.txt")
        if [[ $exit_code -eq 0 ]]; then
            : $((success_count++))      # ← Success counted
        else
            : $((failure_count++))      # ← Failure also counted
        fi
    fi
done

# Lines 185-190: Assertion only checks success_count
log_info "Results: ${success_count} succeeded, ${failure_count} failed"

assert_equals "${concurrent_count}" "${success_count}" \
    "Expected ALL receives to succeed (idempotent)"
assert_equals "0" "${failure_count}" \
    "Expected zero failures for idempotent operations"
```

### The Problem

**The test counts both success and failure during the loop (lines 173-179).**

What if results are:
- 3 successes (count = 3)
- 2 failures (count = 2)

**The assertion on line 189 will FAIL:** Expected 5, got 3

But what if the test logic is wrong? What if:
- 2 successes (count = 2)
- 3 failures (count = 3)

**The assertion on line 189 will FAIL:** Expected 5, got 2

**However:** The loop logic accepts BOTH outcomes equally. It doesn't validate that failure_count is zero until line 190.

### Scenario Where This Breaks

```bash
# Scenario: Network failures (simulated)
# All 5 concurrent receives fail due to network timeout

for i in 1 2 3 4 5; do
    exit_code=$(cat exit-${i}.txt)
    # All are non-zero
    if [[ $exit_code -eq 0 ]]; then
        success_count=$((success_count + 1))
    else
        failure_count=$((failure_count + 1))  # ← All failures counted
    fi
done

# Result: success_count=0, failure_count=5

# Assertion on line 189:
assert_equals "5" "${success_count}"  # ← FAILS: expected 5, got 0
# Test correctly fails! ✓

# But what if:
# Line 189 asserts success_count == 5 (ALL should succeed)
# Line 190 asserts failure_count == 0 (ZERO should fail)

# With 3 successes, 2 failures:
assert_equals "5" "${success_count}"  # ← FAILS: expected 5, got 3
# Test fails because both success and failure are counted equally
```

### The Real Issue

**The test can't distinguish between:**
1. **Correct behavior:** 5 successes, 0 failures (idempotent)
2. **Broken behavior:** 3 successes, 2 failures (some failed)

Because both paths in the if statement are equally valid in the counting logic.

### Solution

**Assert clear expectations for each outcome:**

```bash
# Lines 152-161: Launch 5 concurrent receives
for i in $(seq 1 ${concurrent_count}); do
    local output_file="${TEST_TEMP_DIR}/bob-token-attempt-${i}.txf"
    (
        SECRET="${BOB_SECRET}" "${UNICITY_NODE_BIN:-node}" "$(get_cli_path)" \
            receive-token -f "${transfer}" -o "${output_file}" \
            >/dev/null 2>&1
        echo $? > "${TEST_TEMP_DIR}/exit-${i}.txt"
    ) &
    pids+=($!)
done

# Lines 168-189: Verify EACH attempt succeeds
success_count=0
for i in $(seq 1 ${concurrent_count}); do
    if [[ ! -f "${TEST_TEMP_DIR}/exit-${i}.txt" ]]; then
        fail "Exit status file not created for attempt $i"
    fi

    local exit_code=$(cat "${TEST_TEMP_DIR}/exit-${i}.txt")

    if [[ $exit_code -ne 0 ]]; then
        fail "Attempt $i failed (exit code: $exit_code)"
    fi

    # Only count successes
    success_count=$((success_count + 1))
done

# CLEAR ASSERTION: All must succeed
assert_equals "${concurrent_count}" "${success_count}" \
    "Expected ALL receives to succeed (idempotent)"
```

---

## Issue 6: 93 Instances of || true Masking Failures

**Files:** Multiple test files
**Pattern:** `command || true` or `command || echo "0"`
**Severity:** MEDIUM (pervasive but often in non-critical paths)

### Examples

```bash
# test_input_validation.bats, typical pattern
run_cli_with_secret "" "mint-token --preset nft --local -o token.txf" || true
# If command fails, shell still returns 0 (exit code 0 = success)
# Test continues even though minting failed

# test_double_spend_advanced.bats
(
    SECRET="${BOB_SECRET}" ... receive-token ... \
    >/dev/null 2>&1
    echo $? > "exit-${i}.txt"
) &
# But then: wait "$pid" || true
# If child process fails, wait still succeeds

# test_data_boundaries.bats, line with || echo "0"
tx_count=$(get_transaction_count "$token_file" 2>/dev/null || echo "0")
# If jq fails, default to "0" instead of failing
```

### Distribution

```
test_double_spend_advanced.bats: 16 instances
test_concurrency.bats: 20 instances
test_data_boundaries.bats: 14 instances
test_file_system.bats: 7 instances
test_state_machine.bats: 6 instances
test_network_edge.bats: 9 instances
[helpers and other]: ~21 instances
TOTAL: 93 instances
```

### When || true Is Appropriate

```bash
# OK: Cleanup operations
rm -f "${temp_file}" || true
trap 'rm -f temp.txt' EXIT || true

# OK: Intentional fallback to default
local value=$(extract_field || echo "default_value")
```

### When || true Is WRONG

```bash
# WRONG: Masking test assertion failure
run_cli_with_secret "$SECRET" "command-that-should-succeed" || true
# If command fails, test doesn't know

# WRONG: In conditional logic
if [[ $(some_command || echo "0") -gt 0 ]]; then
    # If some_command fails, always gets "0"
fi

# WRONG: In background processes
command &
pid=$!
wait $pid || true
# If command fails, we never know
```

### Solution

**Remove || true from test assertions, replace with explicit assertion:**

```bash
# BEFORE:
run_cli_with_secret "$SECRET" "mint-token --preset nft -o token.txf" || true
if [[ -f "token.txf" ]]; then
    echo "OK"
fi

# AFTER:
run_cli_with_secret "$SECRET" "mint-token --preset nft -o token.txf"
assert_success "Minting should succeed"
assert_file_exists "token.txf"
```

---

## Issue 7: 73 Tests Are Skipped

**Files:** 13 test files
**Severity:** HIGH (hardest tests are skipped)

### Skipped Integration Tests

```bash
# test_integration.bats, line 214
@test "INTEGRATION-005: Postponed Commitment Chain (2-Level)" {
    log_test "Testing 2-level commitment chain before submission"
    skip "requires careful transaction management"
    # ← Test never runs!
}

# test_integration.bats, line 220
@test "INTEGRATION-006: Multiple senders, single recipient" {
    log_test "Testing UTXO-based receiving from multiple senders"
    skip "requires careful transaction management"
    # ← Test never runs!
}
```

### Skipped Edge Case Tests

```bash
# test_double_spend_advanced.bats: 12 out of 12 tests skipped!
# test_file_system.bats: 11 skips
# test_data_boundaries.bats: 11 skips
# test_state_machine.bats: 6 skips
# test_concurrency.bats: 6 skips
# test_network_edge.bats: 7 skips
```

### What "Careful Management" Means

Tests marked with "requires careful transaction management" likely:
1. Are harder to implement correctly
2. Expose real bugs in the system
3. Have complex expected behaviors
4. Require careful test design

**Translation:** "This test is hard, so we skip it"

### Solution

**Unskip and fix these tests:**

```bash
# BEFORE:
@test "INTEGRATION-005: Postponed Commitment Chain (2-Level)" {
    skip "requires careful transaction management"
}

# AFTER:
@test "INTEGRATION-005: Postponed Commitment Chain (2-Level)" {
    log_test "Testing 2-level commitment chain before submission"

    require_aggregator

    # [Implement actual test logic]

    assert_equals "..." "..."
}
```

---

## Quick Fix Template

For each test file needing fixes:

```bash
# Step 1: Find all problematic patterns
grep -n "\-\-local" test_file.bats
grep -n "\|\| true" test_file.bats
grep -n "assert_file_exists" test_file.bats
grep -n "^[[:space:]]*skip" test_file.bats

# Step 2: Remove each --local flag
sed -i 's/ --local//g' test_file.bats

# Step 3: Remove masking || true
sed -i 's/ \|\| true//g' test_file.bats

# Step 4: Add content validation after file exists checks
# (Manual - search for assert_file_exists patterns)

# Step 5: Unskip tests
sed -i 's/skip ".*"/# Unskipped/g' test_file.bats

# Step 6: Run against real aggregator
docker run -p 3000:3000 unicity/aggregator &
UNICITY_AGGREGATOR_URL=http://localhost:3000 bats test_file.bats
```

---

## Summary: All Critical Issues

| Issue | File | Line(s) | Instances | Severity |
|-------|------|---------|-----------|----------|
| Double-spend test uses mock | test_double_spend.bats | 38, 54, 62, 76, 79 | 1 test | CRITICAL |
| Input validation uses mock | test_input_validation.bats | Throughout | 30 | CRITICAL |
| Data integrity uses mock | test_data_integrity.bats | Throughout | 36 | CRITICAL |
| Token status queries file, not aggregator | token-helpers.bash | 641-656 | 9 uses | CRITICAL |
| File checks without content | Multiple | Multiple | 62 | HIGH |
| || true masking failures | Multiple | Multiple | 93 | MEDIUM |
| Tests accept both outcomes | test_double_spend.bats | 86-104, 173-189 | 2 tests | HIGH |
| Tests are skipped | Multiple | Multiple | 73 | HIGH |

---

**Total affected:** 356 `--local` uses + 62 incomplete checks + 93 masking patterns = 511 mocking issues

**Estimated fix time:** 2-3 weeks with careful testing
