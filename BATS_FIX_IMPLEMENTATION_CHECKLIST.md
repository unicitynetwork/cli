# BATS Test Infrastructure Fix - Implementation Checklist

**Date:** 2025-11-11
**Design Document:** `BATS_INFRASTRUCTURE_FIX_DESIGN.md`

---

## Pre-Implementation Checklist

- [ ] Review design document thoroughly
- [ ] Confirm bash-pro agent analysis complete
- [ ] Create implementation branch: `fix/bats-infrastructure`
- [ ] Backup current test suite state

---

## Phase 1: Infrastructure Fix (Critical)

### Task 1.1: Add `extract_generated_address()` Helper

**File:** `tests/helpers/token-helpers.bash`
**Location:** After `generate_address()` function (around line 86)
**Lines to add:** ~30

**Code to add:**
```bash
# -----------------------------------------------------------------------------
# BATS Compatibility Helpers
# -----------------------------------------------------------------------------

# Extract generated address from BATS $output variable
# Must be called AFTER running generate_address with `run`
# Sets GENERATED_ADDRESS from $output
# Usage:
#   run generate_address "$SECRET" "nft"
#   extract_generated_address
#   local addr="$GENERATED_ADDRESS"
extract_generated_address() {
  if [[ -z "${output:-}" ]]; then
    error "No output to extract address from (did you use 'run'?)"
    return 1
  fi

  # Extract DIRECT:// address from output
  local address
  address=$(echo "$output" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

  if [[ -z "$address" ]]; then
    error "Could not extract address from output: $output"
    return 1
  fi

  export GENERATED_ADDRESS="$address"

  if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
    debug "Extracted address: $GENERATED_ADDRESS"
  fi

  return 0
}

# Export function for use in tests
export -f extract_generated_address
```

**Validation:**
```bash
# Test the function manually
source tests/helpers/token-helpers.bash
output="Generated address: DIRECT://deadbeef1234567890abcdef"
extract_generated_address
echo "Extracted: $GENERATED_ADDRESS"
# Should output: DIRECT://deadbeef1234567890abcdef
```

- [ ] Code added to `token-helpers.bash`
- [ ] Function exported
- [ ] Manual validation passed

---

## Phase 2: Fix `GENERATED_ADDRESS` Usage (24 fixes)

### Task 2.1: Fix `test_double_spend_advanced.bats` (16 fixes)

**File:** `tests/edge-cases/test_double_spend_advanced.bats`

**Fix locations:**

#### Fix 1-2: DBLSPEND-001 (lines 49-53)
```bash
# Line 49-50:
run generate_address "$BOB_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local bob_addr="$GENERATED_ADDRESS"

# Line 52-53:
run generate_address "$CAROL_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local carol_addr="$GENERATED_ADDRESS"
```
- [ ] Lines 49-50 fixed
- [ ] Lines 52-53 fixed

#### Fix 3-4: DBLSPEND-002 (lines 103-106)
```bash
# Line 103:
run generate_address "$BOB_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local bob_addr="$GENERATED_ADDRESS"

# Line 106:
run generate_address "$CAROL_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local carol_addr="$GENERATED_ADDRESS"
```
- [ ] Lines 103-104 fixed
- [ ] Lines 105-106 fixed

#### Fix 5: DBLSPEND-003 (line 165)
```bash
run generate_address "$BOB_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local bob_addr="$GENERATED_ADDRESS"
```
- [ ] Line 165 fixed

#### Fix 6-7: DBLSPEND-004 (lines 209-212)
```bash
run generate_address "$BOB_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local bob_addr="$GENERATED_ADDRESS"

run generate_address "$CAROL_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local carol_addr="$GENERATED_ADDRESS"
```
- [ ] Lines 209-210 fixed
- [ ] Lines 211-212 fixed

#### Fix 8: DBLSPEND-005 (line 256)
```bash
# Inside loop:
run generate_address "$(generate_unique_id "user-$i")" "nft"
extract_generated_address  # ← ADD THIS LINE
recipients+=("$GENERATED_ADDRESS")
```
- [ ] Line 256 fixed

#### Fix 9-10: DBLSPEND-006 (lines 313, 321)
```bash
# Line 313:
run generate_address "$BOB_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local bob_addr="$GENERATED_ADDRESS"

# Line 321:
run generate_address "$ATTACKER_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local attacker_addr="$GENERATED_ADDRESS"
```
- [ ] Line 313 fixed
- [ ] Line 321 fixed

#### Fix 11: DBLSPEND-007 (line 364)
```bash
# Inside loop:
run generate_address "$(generate_unique_id "recipient-$i")" "nft"
extract_generated_address  # ← ADD THIS LINE
recipients+=("$GENERATED_ADDRESS")
```
- [ ] Line 364 fixed

#### Fix 12-13: DBLSPEND-008 (lines 445-448)
```bash
run generate_address "$BOB_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local bob_addr="$GENERATED_ADDRESS"

run generate_address "$CAROL_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local carol_addr="$GENERATED_ADDRESS"
```
- [ ] Lines 445-446 fixed
- [ ] Lines 447-448 fixed

#### Fix 14-15: DBLSPEND-009 (lines 501, 512)
```bash
# Line 501:
run generate_address "$BOB_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local bob_addr="$GENERATED_ADDRESS"

# Line 512:
run generate_address "$CAROL_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local carol_addr="$GENERATED_ADDRESS"
```
- [ ] Line 501 fixed
- [ ] Line 512 fixed

**Validation:**
```bash
bats tests/edge-cases/test_double_spend_advanced.bats
```
- [ ] All tests in file pass or show real failures (not infrastructure errors)

---

### Task 2.2: Fix `test_state_machine.bats` (5 fixes)

**File:** `tests/edge-cases/test_state_machine.bats`

#### Fix 1: STATE-002 (line 63)
```bash
run generate_address "$RECIPIENT_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
recipient_addr="$GENERATED_ADDRESS"
```
- [ ] Line 63 fixed

#### Fix 2: STATE-004 (line 123)
```bash
run generate_address "$RECIPIENT_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
recipient_addr="$GENERATED_ADDRESS"
```
- [ ] Line 123 fixed

#### Fix 3-4: STATE-005 (lines 150, 153)
```bash
run generate_address "$USER1_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local addr1="$GENERATED_ADDRESS"

run generate_address "$USER2_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local addr2="$GENERATED_ADDRESS"
```
- [ ] Line 150 fixed
- [ ] Line 153 fixed

#### Fix 5: STATE-007 (line 219)
```bash
run generate_address "$RECIPIENT_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local recipient="$GENERATED_ADDRESS"
```
- [ ] Line 219 fixed

**Validation:**
```bash
bats tests/edge-cases/test_state_machine.bats
```
- [ ] All tests in file pass or show real failures

---

### Task 2.3: Fix `test_concurrency.bats` (3 fixes)

**File:** `tests/edge-cases/test_concurrency.bats`

#### Fix 1-2: CONCUR-001 (lines 110, 113)
```bash
run generate_address "$USER1_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local addr1="$GENERATED_ADDRESS"

run generate_address "$USER2_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local addr2="$GENERATED_ADDRESS"
```
- [ ] Line 110 fixed
- [ ] Line 113 fixed

#### Fix 3: CONCUR-003 (line 315)
```bash
run generate_address "$RECIPIENT_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local recipient="$GENERATED_ADDRESS"
```
- [ ] Line 315 fixed

**Validation:**
```bash
bats tests/edge-cases/test_concurrency.bats
```
- [ ] All tests in file pass or show real failures

---

### Task 2.4: Fix `test_file_system.bats` (1 fix)

**File:** `tests/edge-cases/test_file_system.bats`

#### Fix 1: FILESYS-006 (line 262)
```bash
run generate_address "$RECIPIENT_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local recipient="$GENERATED_ADDRESS"
```
- [ ] Line 262 fixed

**Validation:**
```bash
bats tests/edge-cases/test_file_system.bats
```
- [ ] All tests in file pass or show real failures

---

### Task 2.5: Fix `test_network_edge.bats` (1 fix)

**File:** `tests/edge-cases/test_network_edge.bats`

#### Fix 1: NETEDGE-007 (line 323)
```bash
run generate_address "$RECIPIENT_SECRET" "nft"
extract_generated_address  # ← ADD THIS LINE
local recipient="$GENERATED_ADDRESS"
```
- [ ] Line 323 fixed

**Validation:**
```bash
bats tests/edge-cases/test_network_edge.bats
```
- [ ] All tests in file pass or show real failures

---

## Phase 3: Fix `$status` Usage (4 fixes)

### Task 3.1: Fix `test_data_boundaries.bats` (4 fixes)

**File:** `tests/edge-cases/test_data_boundaries.bats`

#### Fix 1: CORNER-007 (lines 50-69)

**Current (BROKEN):**
```bash
@test "CORNER-007: Empty string as SECRET environment variable" {
  # Try to generate address with empty secret
  local output_file
  output_file=$(create_temp_file "-addr.json")

  # Empty string is different from undefined
  SECRET="" run_cli gen-address --preset nft || true

  # Should fail or prompt
  if [[ $status -eq 0 ]]; then  # ❌ LINE 53
    info "⚠ Empty secret accepted (security risk)"
    # ...
```

**Fixed:**
```bash
@test "CORNER-007: Empty string as SECRET environment variable" {
  # Try to generate address with empty secret
  local output_file
  output_file=$(create_temp_file "-addr.json")

  # Empty string is different from undefined
  # Check if empty secret is accepted
  if run_cli_with_secret "" "gen-address --preset nft"; then
    info "⚠ Empty secret accepted (security risk)"
    # Check if generated same as another empty secret (deterministic but weak)
    local addr1
    addr1=$(echo "$output" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    if run_cli_with_secret "" "gen-address --preset nft"; then
      local addr2
      addr2=$(echo "$output" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

      if [[ "$addr1" == "$addr2" ]] && [[ -n "$addr1" ]]; then
        info "Empty secret generates deterministic address (weak security)"
      fi
    fi
  else
    # Expected: reject empty secret
    info "✓ Empty secret rejected"
  fi
}
```
- [ ] CORNER-007 fixed (lines 50-69)

#### Fix 2: CORNER-008 First Part (lines 76-84)

**Current (BROKEN):**
```bash
@test "CORNER-008: Secret with only whitespace characters" {
  # Test with spaces
  SECRET="     " run_cli gen-address --preset nft || true

  if [[ $status -eq 0 ]]; then  # ❌ LINE 80
    info "⚠ Whitespace-only secret accepted"
  else
    info "✓ Whitespace-only secret rejected or prompted"
  fi
```

**Fixed:**
```bash
@test "CORNER-008: Secret with only whitespace characters" {
  # Test with spaces
  if run_cli_with_secret "     " "gen-address --preset nft"; then
    info "⚠ Whitespace-only secret accepted"
  else
    info "✓ Whitespace-only secret rejected or prompted"
  fi
```
- [ ] CORNER-008 first part fixed (lines 76-84)

#### Fix 3: CORNER-008 Second Part (lines 86-93)

**Current (BROKEN):**
```bash
  # Test with tabs and newlines
  SECRET=$'\n\t  \n' run_cli gen-address --preset nft || true

  if [[ $status -eq 0 ]]; then  # ❌ LINE 89
    info "⚠ Whitespace (tabs/newlines) accepted"
  else
    info "✓ Whitespace secret rejected"
  fi
}
```

**Fixed:**
```bash
  # Test with tabs and newlines
  if run_cli_with_secret $'\n\t  \n' "gen-address --preset nft"; then
    info "⚠ Whitespace (tabs/newlines) accepted"
  else
    info "✓ Whitespace secret rejected"
  fi
}
```
- [ ] CORNER-008 second part fixed (lines 86-93)

#### Fix 4: CORNER-011 (lines 180-196)

**Current (BROKEN):**
```bash
@test "CORNER-011: Secret with null bytes" {
  skip "Null byte handling requires careful testing"

  # Null bytes in bash strings
  SECRET=$'test\x00secret' run_cli gen-address --preset nft || true

  if [[ $status -eq 0 ]]; then  # ❌ LINE 186
    info "⚠ Null bytes in secret accepted"
    # Verify how null byte was handled
    local addr1
    addr1=$(echo "$output" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    # Compare with truncated version (test\x00 → test)
    SECRET="test" run_cli gen-address --preset nft || true
```

**Fixed:**
```bash
@test "CORNER-011: Secret with null bytes" {
  skip "Null byte handling requires careful testing"

  # Null bytes in bash strings
  if run_cli_with_secret $'test\x00secret' "gen-address --preset nft"; then
    info "⚠ Null bytes in secret accepted"
    # Verify how null byte was handled
    local addr1
    addr1=$(echo "$output" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    # Compare with truncated version (test\x00 → test)
    if run_cli_with_secret "test" "gen-address --preset nft"; then
      local addr2
      addr2=$(echo "$output" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

      if [[ "$addr1" == "$addr2" ]]; then
        info "Null byte truncates secret (C-string behavior)"
      else
        info "Null byte preserved in secret (UTF-8 behavior)"
      fi
    fi
  else
    info "✓ Null bytes in secret rejected"
  fi
}
```
- [ ] CORNER-011 fixed (lines 180-196)

**Validation:**
```bash
bats tests/edge-cases/test_data_boundaries.bats
```
- [ ] All tests in file pass or show real failures

---

## Phase 4: Validation and Testing

### Task 4.1: Unit Test New Helper

```bash
# Test extract_generated_address()
source tests/helpers/token-helpers.bash

# Test 1: Valid output
output="Generated address: DIRECT://deadbeef1234567890abcdef"
extract_generated_address
echo "Test 1: $GENERATED_ADDRESS"
# Expected: DIRECT://deadbeef1234567890abcdef

# Test 2: No output (should fail)
unset output
extract_generated_address 2>&1 | grep -q "No output"
# Expected: Error message

# Test 3: Invalid output (should fail)
output="No address here"
extract_generated_address 2>&1 | grep -q "Could not extract"
# Expected: Error message
```

- [ ] Unit test passed

### Task 4.2: Run Individual Test Files

```bash
# Test each modified file
bats tests/edge-cases/test_double_spend_advanced.bats
bats tests/edge-cases/test_state_machine.bats
bats tests/edge-cases/test_concurrency.bats
bats tests/edge-cases/test_file_system.bats
bats tests/edge-cases/test_network_edge.bats
bats tests/edge-cases/test_data_boundaries.bats
```

- [ ] test_double_spend_advanced.bats - no infrastructure errors
- [ ] test_state_machine.bats - no infrastructure errors
- [ ] test_concurrency.bats - no infrastructure errors
- [ ] test_file_system.bats - no infrastructure errors
- [ ] test_network_edge.bats - no infrastructure errors
- [ ] test_data_boundaries.bats - no infrastructure errors

### Task 4.3: Run Full Test Suites

```bash
# Security suite
npm run test:security

# Edge-case suite
npm run test:edge-cases

# Functional suite (should remain unchanged)
npm run test:functional
```

- [ ] Security suite - improved pass rate
- [ ] Edge-case suite - improved pass rate
- [ ] Functional suite - still passing

### Task 4.4: Full Test Run

```bash
npm test
```

- [ ] Full test run completed
- [ ] Results documented

---

## Phase 5: Documentation

### Task 5.1: Update Test Documentation

**File:** `tests/QUICK_REFERENCE.md`

Add section on `extract_generated_address()`:

```markdown
### Using `generate_address` with BATS

When using `generate_address` with BATS's `run` command:

```bash
# Generate address
run generate_address "$SECRET" "nft"

# Extract address from output
extract_generated_address

# Use the address
local recipient="$GENERATED_ADDRESS"
```

**Important:** Always call `extract_generated_address` after `run generate_address`.
The helper extracts the address from `$output` and sets `$GENERATED_ADDRESS`.
```

- [ ] Documentation updated

### Task 5.2: Create Fix Summary Document

**File:** `BATS_FIX_IMPLEMENTATION_SUMMARY.md`

Document:
- Number of tests fixed
- Before/after pass rates
- Remaining failures and their causes
- Lessons learned

- [ ] Summary document created

---

## Phase 6: Final Validation

### Task 6.1: Review All Changes

```bash
# Show all changes
git diff

# Review each file
git diff tests/helpers/token-helpers.bash
git diff tests/edge-cases/test_double_spend_advanced.bats
# ... etc
```

- [ ] All changes reviewed
- [ ] No unintended modifications

### Task 6.2: Verify No Regressions

```bash
# Run working tests that shouldn't be affected
bats tests/functional/test_gen_address.bats
bats tests/functional/test_mint_token.bats
bats tests/functional/test_send_token.bats
```

- [ ] No regressions in functional tests

### Task 6.3: Final Test Run

```bash
# Complete test suite
npm test 2>&1 | tee test-results-after-fix.txt

# Compare with before
diff test-results-before-fix.txt test-results-after-fix.txt
```

- [ ] Final test run completed
- [ ] Results compared and documented

---

## Post-Implementation

### Task 7.1: Create PR/Commit

```bash
git add tests/helpers/token-helpers.bash
git add tests/edge-cases/*.bats
git add tests/QUICK_REFERENCE.md
git add BATS_FIX_IMPLEMENTATION_SUMMARY.md

git commit -m "Fix BATS test infrastructure issues

- Add extract_generated_address() helper for BATS compatibility
- Fix 24 tests using GENERATED_ADDRESS variable
- Fix 4 tests incorrectly checking \$status variable
- Update documentation with correct usage patterns

Fixes systematic test failures in security and edge-case suites.
Tests now fail only on real issues, not infrastructure bugs.

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] Commit created with descriptive message
- [ ] Changes pushed to branch

### Task 7.2: Analyze Remaining Failures

Document remaining test failures:
- Which tests still fail?
- Are they real CLI bugs or test issues?
- What needs to be fixed in the CLI?

- [ ] Remaining failures analyzed
- [ ] Issues created for real bugs

---

## Success Criteria

### Primary Goals

- [ ] All infrastructure-related test failures eliminated
- [ ] No "unbound variable" errors
- [ ] Tests fail only on real issues, not infrastructure bugs

### Metrics

**Before fixes:**
- Security suite: ~40-60% passing
- Edge-case suite: ~60-70% passing
- Functional suite: 97.1% passing

**After fixes (target):**
- Security suite: >85% passing
- Edge-case suite: >85% passing
- Functional suite: >97% passing (no regression)

### Deliverables

- [ ] Working `extract_generated_address()` helper
- [ ] 24 tests fixed for GENERATED_ADDRESS
- [ ] 4 tests fixed for $status usage
- [ ] Updated documentation
- [ ] Implementation summary document
- [ ] Clean git commit ready for PR

---

## Notes and Issues Discovered

(Add any issues discovered during implementation)

---

## Sign-Off

- [ ] All phases completed
- [ ] All validation passed
- [ ] Documentation updated
- [ ] Ready for review

**Completed by:** ________________
**Date:** ________________
**Total time:** ________________
