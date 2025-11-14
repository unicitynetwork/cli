# Code Location Reference - All Fixes

## File 1: tests/helpers/token-helpers.bash

### Function: get_token_status() - REWRITTEN
**Lines**: 796-897
**Status**: Queries real aggregator via HTTP

Key implementation:
```bash
# Query aggregator for inclusion proof
local response http_code
local temp_response="${TEST_TEMP_DIR}/token-status-response-$$-${RANDOM}"

# Make HTTP request to aggregator
http_code=$(curl -s -w "%{http_code}" -o "$temp_response" \
  "${aggregator_url}/api/v1/requests/${request_id}" 2>&1)
```

Interpreting responses:
- **200**: Found on blockchain (CONFIRMED/TRANSFERRED)
- **404**: Not found on blockchain (PENDING/UNSPENT)
- **500, 502, 503**: Aggregator error - FAIL
- **Other**: Unexpected response - FAIL

---

## File 2: tests/helpers/assertions.bash

### New Function: assert_valid_json()
**Lines**: 1941-1976
**Purpose**: Validate file exists, is non-empty, and contains valid JSON

Usage:
```bash
assert_valid_json "$token_file" "Token file"
```

### New Function: assert_token_structure_valid()
**Lines**: 1978-2027
**Purpose**: Validate complete token file structure
**Checks**:
- Valid JSON
- Has `.version`, `.genesis`, `.state`
- Has `.genesis.data.tokenId`, `.genesis.inclusionProof`
- Has `.state.data`, `.state.predicate`
- TokenId is non-empty

Usage:
```bash
assert_token_structure_valid "$token_file"
```

### New Function: assert_offline_transfer_structure_valid()
**Lines**: 2029-2067
**Purpose**: Validate offline transfer file structure
**Checks**:
- Valid JSON
- Has `.offlineTransfer` field
- Has `.offlineTransfer.transaction.type` = "transfer"

Usage:
```bash
assert_offline_transfer_structure_valid "$transfer_file"
```

### Exports
**Lines**: 2095-2098
All 3 new functions exported:
```bash
export -f assert_valid_json
export -f assert_token_structure_valid
export -f assert_offline_transfer_structure_valid
```

---

## File 3: tests/edge-cases/test_double_spend_advanced.bats

### Fix 1: Replaced skip with fail
**Lines Affected**: 41, 96, 162, 207, 252, 317, 364, 454, 512
**Change**: `skip_if_aggregator_unavailable` → `fail_if_aggregator_unavailable`

### Fix 2: DBLSPEND-005 - Enforce 1 success, 4 failures
**Test Name**: "DBLSPEND-005: Extreme concurrent submit-now race"
**Lines**: 251-307 (full test)
**Enforcement**: Lines 301-306

Before:
```bash
if [[ $success_count -eq 1 ]]; then
  info "✓ Exactly one concurrent submit-now succeeded..."
else
  info "⚠ Multiple concurrent submits..."
fi
```

After:
```bash
# CRITICAL: Enforce exactly 1 success, 4 failures
if [[ $success_count -ne 1 ]]; then
  fail "SECURITY FAILURE: Expected exactly 1 successful concurrent send, got ${success_count}. This indicates a double-spend vulnerability!"
fi

log_success "✓ Double-spend prevention working: 1 success, 4 blocked"
```

### Fix 3: DBLSPEND-007 - Enforce 1 success from 5 submissions
**Test Name**: "DBLSPEND-007: Create multiple offline packages rapidly"
**Lines**: 363-447 (full test)
**Enforcement**: Lines 437-446

Before:
```bash
if [[ $success_count -eq 1 ]]; then
  info "✓ Only one submission succeeded..."
else
  info "⚠ Multiple submissions attempted..."
fi
```

After:
```bash
# CRITICAL: Enforce exactly 1 success, others must fail
if [[ $created_count -eq 5 ]]; then
  if [[ $success_count -ne 1 ]]; then
    fail "SECURITY FAILURE: Expected exactly 1 successful offline transfer submission, got ${success_count}. This indicates a double-spend vulnerability!"
  fi
  log_success "✓ Double-spend prevention working: 1 success, 4 blocked"
else
  info "Note: Only $created_count of 5 packages were created (expected 5)"
fi
```

---

## File 4: tests/helpers/common.bash

### Function: fail_if_aggregator_unavailable()
**Lines**: 389-398
**Status**: VERIFIED - Already exists

Implementation:
```bash
fail_if_aggregator_unavailable() {
  # Security tests MUST NOT allow UNICITY_TEST_SKIP_EXTERNAL bypass
  if [[ "${UNICITY_TEST_SKIP_EXTERNAL:-0}" == "1" ]]; then
    fail "CRITICAL: Security tests require real aggregator. UNICITY_TEST_SKIP_EXTERNAL=1 not allowed for security tests."
  fi

  if ! check_aggregator_health; then
    fail "CRITICAL: Aggregator required for security test but unavailable at ${UNICITY_AGGREGATOR_URL}. Security tests cannot run without real aggregator - no mocks, no fallbacks allowed."
  fi
}
```

---

## Summary of Changes

| Fix | File | Lines | Type | Impact |
|-----|------|-------|------|--------|
| 1 | common.bash | 389-398 | Verified | Tests fail if aggregator unavailable |
| 2 | token-helpers.bash | 796-897 | Rewritten | Queries real aggregator (not local files) |
| 3 | token-helpers.bash | (all) | Verified | No silent failure masking |
| 4 | assertions.bash | 1941-2098 | Added | 3 new content validation functions |
| 5 | test_double_spend_advanced.bats | 41,96,162,207,252,317,364,454,512 | Replaced | 9 skip→fail changes |
| 6 | test_double_spend_advanced.bats | 301-306, 437-446 | Enforced | 2 tests enforce exactly 1 success |

---

## Verification Commands

### Check get_token_status rewrite:
```bash
grep -A 20 "^get_token_status()" /home/vrogojin/cli/tests/helpers/token-helpers.bash
```

### Check new assertions:
```bash
grep "^assert_valid_json\|^assert_token_structure_valid\|^assert_offline_transfer_structure_valid" /home/vrogojin/cli/tests/helpers/assertions.bash
```

### Check skip→fail replacements:
```bash
grep "fail_if_aggregator_unavailable" /home/vrogojin/cli/tests/edge-cases/test_double_spend_advanced.bats | wc -l
# Should output: 9
```

### Check double-spend enforcements:
```bash
grep "SECURITY FAILURE" /home/vrogojin/cli/tests/edge-cases/test_double_spend_advanced.bats | wc -l
# Should output: 2
```

### Test file is valid:
```bash
bats --count /home/vrogojin/cli/tests/edge-cases/test_double_spend_advanced.bats
# Should output: 11
```

---

## Absolute File Paths

1. `/home/vrogojin/cli/tests/helpers/token-helpers.bash`
2. `/home/vrogojin/cli/tests/helpers/assertions.bash`
3. `/home/vrogojin/cli/tests/edge-cases/test_double_spend_advanced.bats`
4. `/home/vrogojin/cli/tests/helpers/common.bash`

