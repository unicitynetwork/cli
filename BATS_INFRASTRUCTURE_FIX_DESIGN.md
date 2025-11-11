# BATS Test Infrastructure Fix Design

**Date:** 2025-11-11
**Status:** Design Phase - Implementation Pending
**Author:** Claude Code (Test Automation Expert)

## Executive Summary

Systematic test failures across security and edge-case test suites are caused by **fundamental BATS infrastructure bugs**, not actual test logic issues. The problems stem from incorrect usage of BATS patterns and missing variable initialization.

**Impact:**
- Functional tests: 100/103 passing (97.1%) ✅
- Security tests: Many failures due to infrastructure bugs ❌
- Edge-case tests: Many failures due to infrastructure bugs ❌

**Root Cause:** Tests were written with assumptions about how custom helper functions interact with BATS's `run` command, but these patterns were never implemented correctly.

---

## Problem Analysis

### Issue #1: Missing `GENERATED_ADDRESS` Variable

**Root Cause:** Tests use `run generate_address` and expect `$GENERATED_ADDRESS` to be set automatically, but this variable is never assigned.

**Pattern:**
```bash
# Current (BROKEN):
run generate_address "$BOB_SECRET" "nft"
local bob_addr="$GENERATED_ADDRESS"  # ❌ GENERATED_ADDRESS is never set!

# What actually happens:
# 1. `run` executes generate_address in a subshell
# 2. generate_address prints address to stdout
# 3. BATS captures stdout in $output
# 4. GENERATED_ADDRESS is NEVER set anywhere
# 5. Test tries to use unbound variable → CRASH
```

**Affected Files:** (24 occurrences across 8 files)
- `tests/edge-cases/test_double_spend_advanced.bats` (16 uses)
- `tests/edge-cases/test_state_machine.bats` (5 uses)
- `tests/edge-cases/test_concurrency.bats` (2 uses)
- `tests/edge-cases/test_file_system.bats` (1 use)
- `tests/edge-cases/test_network_edge.bats` (1 use)

**Error Message:**
```
/home/vrogojin/cli/tests/edge-cases/test_double_spend_advanced.bats: line 50: GENERATED_ADDRESS: unbound variable
```

---

### Issue #2: Incorrect `$status` Usage Without `run`

**Root Cause:** Tests check `$status` variable without using BATS's `run` command, causing "unbound variable" errors.

**Pattern:**
```bash
# Current (BROKEN):
SECRET="" run_cli gen-address --preset nft || true
if [[ $status -eq 0 ]]; then  # ❌ $status not set!
  # ...
fi

# Why this fails:
# 1. `run_cli` is a custom function (NOT BATS's `run`)
# 2. BATS only sets $status when using `run` command
# 3. `|| true` suppresses exit code, so $? isn't useful either
# 4. $status is unbound → CRASH
```

**Affected Files:** (4+ occurrences)
- `tests/edge-cases/test_data_boundaries.bats` (4 uses at lines 53, 80, 89, 186)

**Error Message:**
```
/home/vrogojin/cli/tests/edge-cases/test_data_boundaries.bats: line 53: status: unbound variable
```

---

### Issue #3: Helper Functions Not Compatible with `run`

**Root Cause:** Custom helper functions like `generate_address`, `mint_token`, `send_token_offline` were designed to work standalone, but tests try to use them with BATS's `run` command.

**BATS `run` Behavior:**
- Executes command in a subshell
- Captures stdout → `$output`
- Captures exit code → `$status`
- **DOES NOT** preserve exported variables from the command

**Why Our Helpers Don't Work:**
```bash
# Our helper in token-helpers.bash:
generate_address() {
  local address=$(...)
  printf "%s" "$address"  # Prints to stdout
  return 0
}

# Test expects this pattern:
run generate_address "$SECRET" "nft"
local addr="$GENERATED_ADDRESS"  # ❌ This is never set!

# What actually happens:
# - generate_address prints address to stdout
# - BATS captures it in $output
# - GENERATED_ADDRESS is NEVER assigned
# - Test crashes on unbound variable
```

---

## Fix Strategy

### Strategy A: Make Helpers BATS-Compatible (RECOMMENDED)

**Approach:** Modify helper functions to follow BATS conventions by setting well-known variables.

**Implementation:**

#### 1. Modify `generate_address()` in `token-helpers.bash`

```bash
# Add after line 82 (after printf "%s" "$address"):

# BATS compatibility: Set GENERATED_ADDRESS for tests using `run`
export GENERATED_ADDRESS="$address"

# Also set in parent shell if not in subshell
if [[ "${BASH_SUBSHELL}" -eq 0 ]]; then
  # Running directly, not via `run`
  GENERATED_ADDRESS="$address"
fi
```

**Problem:** This won't work! BATS's `run` executes in a subshell, so `export` won't propagate to parent shell.

#### 2. Create BATS-Specific Wrapper Functions

**Better Solution:** Create new wrapper functions that extract values from `$output`:

```bash
# Add to tests/helpers/token-helpers.bash:

# Generate address and set GENERATED_ADDRESS from output
# Usage with BATS run:
#   run generate_address_bats "$SECRET" "nft"
#   local addr="$GENERATED_ADDRESS"
generate_address_bats() {
  # Call the original generate_address
  generate_address "$@"

  # This still won't work in subshell...
  # Need different approach
}
```

**Still won't work!** Variables set in subshell don't propagate.

#### 3. **CORRECT SOLUTION:** Post-processing Helper

Create a helper that extracts address from `$output` after `run`:

```bash
# Add to tests/helpers/common.bash or token-helpers.bash:

# Extract generated address from run output
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
    error "Could not extract address from output"
    return 1
  fi

  export GENERATED_ADDRESS="$address"
  return 0
}

# Export the function
export -f extract_generated_address
```

**Updated Test Pattern:**
```bash
# OLD (BROKEN):
run generate_address "$BOB_SECRET" "nft"
local bob_addr="$GENERATED_ADDRESS"  # ❌ Crashes

# NEW (FIXED):
run generate_address "$BOB_SECRET" "nft"
extract_generated_address
local bob_addr="$GENERATED_ADDRESS"  # ✅ Works!
```

---

### Strategy B: Change Test Pattern to Use `$output` Directly (ALTERNATIVE)

**Approach:** Don't use `GENERATED_ADDRESS` at all—extract from `$output` inline.

**Implementation:**
```bash
# OLD:
run generate_address "$BOB_SECRET" "nft"
local bob_addr="$GENERATED_ADDRESS"

# NEW:
run generate_address "$BOB_SECRET" "nft"
local bob_addr=$(echo "$output" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)
```

**Pros:**
- Simple, direct, no helper needed
- Follows standard BATS patterns
- No mystery variables

**Cons:**
- Repetitive code (need to extract address in every test)
- Error-prone (easy to forget or mistype)
- Less readable for complex scenarios

---

### Strategy C: Hybrid Approach (RECOMMENDED FOR IMPLEMENTATION)

**Combine both strategies:**

1. **Add `extract_generated_address()` helper** for backward compatibility
2. **Update documentation** to recommend direct `$output` usage for new tests
3. **Gradually migrate** tests to direct pattern

**Benefits:**
- Quick fix for existing tests
- Cleaner pattern for new tests
- Incremental migration path

---

## Fix for Issue #2: `$status` Without `run`

### Problem Pattern

```bash
# BROKEN:
SECRET="" run_cli gen-address --preset nft || true
if [[ $status -eq 0 ]]; then  # ❌ $status not set
```

### Solution

**Option A: Use BATS `run` command**
```bash
# FIXED:
run bash -c 'SECRET="" run_cli gen-address --preset nft'
if [[ $status -eq 0 ]]; then  # ✅ Works
```

**Option B: Capture exit code manually**
```bash
# FIXED:
local exit_code=0
SECRET="" run_cli gen-address --preset nft || exit_code=$?
if [[ $exit_code -eq 0 ]]; then  # ✅ Works
```

**Option C: Use `run_cli` which sets `$output` (RECOMMENDED)**
```bash
# FIXED:
run_cli_with_secret "" "gen-address --preset nft"
local exit_code=$?
if [[ $exit_code -eq 0 ]]; then  # ✅ Works
```

**Best Practice:** Since `run_cli` already returns exit code, just check it directly:

```bash
# BEST:
if run_cli_with_secret "" "gen-address --preset nft"; then
  info "⚠ Empty secret accepted (security risk)"
  # Check if generated same as another empty secret
  local addr1=$(echo "$output" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)
else
  info "✓ Empty secret rejected"
fi
```

---

## Implementation Plan

### Phase 1: Infrastructure Fixes (HIGH PRIORITY)

**File: `tests/helpers/token-helpers.bash`**

Add after the `generate_address()` function (around line 86):

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

### Phase 2: Fix Tests Using `GENERATED_ADDRESS` (CRITICAL)

**Affected Files (24 fixes needed):**

1. **`tests/edge-cases/test_double_spend_advanced.bats`** (16 fixes)
   - Lines: 50, 53, 103, 106, 165, 209, 212, 256, 313, 321, 364, 445, 448, 501, 512

2. **`tests/edge-cases/test_state_machine.bats`** (5 fixes)
   - Lines: 63, 123, 150, 153, 219

3. **`tests/edge-cases/test_concurrency.bats`** (2 fixes)
   - Lines: 110, 113, 315

4. **`tests/edge-cases/test_file_system.bats`** (1 fix)
   - Line: 262

5. **`tests/edge-cases/test_network_edge.bats`** (1 fix)
   - Line: 323

**Fix Pattern (apply to all 24 locations):**

```bash
# OLD:
run generate_address "$BOB_SECRET" "nft"
local bob_addr="$GENERATED_ADDRESS"

# NEW:
run generate_address "$BOB_SECRET" "nft"
extract_generated_address
local bob_addr="$GENERATED_ADDRESS"
```

### Phase 3: Fix `$status` Usage (4 fixes)

**File: `tests/edge-cases/test_data_boundaries.bats`**

**Lines to fix:** 53, 80, 89, 186

**Pattern 1 (CORNER-007, line 50-69):**
```bash
# OLD:
SECRET="" run_cli gen-address --preset nft || true
if [[ $status -eq 0 ]]; then

# NEW:
if run_cli_with_secret "" "gen-address --preset nft"; then
```

**Pattern 2 (CORNER-008, line 77-84):**
```bash
# OLD:
SECRET="     " run_cli gen-address --preset nft || true
if [[ $status -eq 0 ]]; then

# NEW:
if run_cli_with_secret "     " "gen-address --preset nft"; then
```

**Pattern 3 (CORNER-008 continued, line 87-93):**
```bash
# OLD:
SECRET=$'\n\t  \n' run_cli gen-address --preset nft || true
if [[ $status -eq 0 ]]; then

# NEW:
if run_cli_with_secret $'\n\t  \n' "gen-address --preset nft"; then
```

**Pattern 4 (CORNER-011, line 183-196):**
```bash
# OLD:
SECRET=$'test\x00secret' run_cli gen-address --preset nft || true
if [[ $status -eq 0 ]]; then

# NEW:
if run_cli_with_secret $'test\x00secret' "gen-address --preset nft"; then
```

### Phase 4: Testing and Validation

After implementing fixes, run tests to verify:

```bash
# Test the helper function works
bats tests/edge-cases/test_double_spend_advanced.bats

# Test status fixes work
bats tests/edge-cases/test_data_boundaries.bats

# Full security suite
npm run test:security

# Full edge-case suite
npm run test:edge-cases
```

---

## Risk Assessment

### Will Fixes Break Working Tests?

**Analysis:** ✅ **LOW RISK - Fixes are additive and isolated**

#### Risk Level: LOW

**Why it's safe:**

1. **Additive Change:** We're adding a NEW function (`extract_generated_address`), not modifying existing ones
2. **Isolated Scope:** Only affects tests that use `GENERATED_ADDRESS` (which are already broken)
3. **No Functional Test Impact:** Working functional tests don't use `GENERATED_ADDRESS` pattern
4. **Backward Compatible:** Existing patterns continue to work unchanged

**Tests that will NOT be affected:**
- ✅ All 103 functional tests (they don't use `GENERATED_ADDRESS`)
- ✅ Working edge-case tests (they use different patterns)
- ✅ Any test using direct `$output` extraction

**Tests that will be FIXED:**
- ✅ 24 test cases using `GENERATED_ADDRESS` (currently failing)
- ✅ 4 test cases using `$status` incorrectly (currently failing)

### Potential Issues

#### Issue 1: `extract_generated_address` called without `run`

**Scenario:** If someone calls `extract_generated_address` without first using `run`:
```bash
generate_address "$SECRET" "nft"  # No `run`!
extract_generated_address  # Will fail gracefully
```

**Mitigation:** Function checks for `$output` variable and provides clear error message.

#### Issue 2: Output format changes

**Scenario:** If `generate_address` output format changes (no longer contains DIRECT://):
```bash
run generate_address "$SECRET" "nft"
extract_generated_address  # Will fail with clear error
```

**Mitigation:** Function validates extracted address and provides diagnostic error message.

#### Issue 3: Grep pattern too strict/loose

**Risk:** Current pattern `grep -oE "DIRECT://[0-9a-fA-F]+"` might miss valid addresses or match invalid ones.

**Mitigation:** Pattern is already used successfully in functional tests and helper functions. Well-tested.

---

## Expected Outcomes

### Before Fixes

- **Security tests:** ~40-60% passing (many infrastructure failures)
- **Edge-case tests:** ~60-70% passing (many infrastructure failures)
- **Functional tests:** 97.1% passing ✅

### After Fixes

- **Security tests:** ~85-95% passing (only real failures remain)
- **Edge-case tests:** ~85-95% passing (only real failures remain)
- **Functional tests:** 97.1% passing (unchanged) ✅

### Remaining Failures (Expected)

After infrastructure fixes, remaining failures will be:

1. **Real security issues** (if any exist in CLI)
2. **Edge cases not handled** by CLI implementation
3. **Test scenarios that need aggregator features** not yet implemented
4. **Legitimate test failures** that need CLI code fixes

These are **GOOD failures** - they indicate actual issues to fix in the CLI, not test infrastructure bugs.

---

## File Modification Summary

### Files to Create/Modify

1. **`tests/helpers/token-helpers.bash`** (ADD ~30 lines)
   - Add `extract_generated_address()` function
   - Export function for BATS

2. **`tests/edge-cases/test_double_spend_advanced.bats`** (MODIFY ~32 lines)
   - Insert `extract_generated_address` after 16 `run generate_address` calls

3. **`tests/edge-cases/test_state_machine.bats`** (MODIFY ~10 lines)
   - Insert `extract_generated_address` after 5 `run generate_address` calls

4. **`tests/edge-cases/test_concurrency.bats`** (MODIFY ~6 lines)
   - Insert `extract_generated_address` after 3 `run generate_address` calls

5. **`tests/edge-cases/test_file_system.bats`** (MODIFY ~2 lines)
   - Insert `extract_generated_address` after 1 `run generate_address` call

6. **`tests/edge-cases/test_network_edge.bats`** (MODIFY ~2 lines)
   - Insert `extract_generated_address` after 1 `run generate_address` call

7. **`tests/edge-cases/test_data_boundaries.bats`** (MODIFY ~12 lines)
   - Replace 4 instances of `$status` checks with direct `if` checks

### Total Changes

- **Files modified:** 7
- **Lines added:** ~30
- **Lines modified:** ~64
- **Total diff size:** ~94 lines

---

## Implementation Priority

### Critical Path (Do First)

1. ✅ **Add `extract_generated_address()` helper** (5 minutes)
   - File: `tests/helpers/token-helpers.bash`
   - Impact: Enables all other fixes

2. ✅ **Fix `test_double_spend_advanced.bats`** (20 minutes)
   - File: `tests/edge-cases/test_double_spend_advanced.bats`
   - Impact: 16 test cases fixed
   - Reason: Highest concentration of failures

3. ✅ **Fix `test_data_boundaries.bats`** (10 minutes)
   - File: `tests/edge-cases/test_data_boundaries.bats`
   - Impact: 4 test cases fixed
   - Reason: Different failure pattern, validates both fix strategies

### Secondary Priority (Do Next)

4. ✅ **Fix `test_state_machine.bats`** (10 minutes)
   - Impact: 5 test cases

5. ✅ **Fix `test_concurrency.bats`** (5 minutes)
   - Impact: 3 test cases

6. ✅ **Fix `test_file_system.bats`** (2 minutes)
   - Impact: 1 test case

7. ✅ **Fix `test_network_edge.bats`** (2 minutes)
   - Impact: 1 test case

### Total Time Estimate

- **Infrastructure fix:** 5 minutes
- **Test fixes:** 49 minutes
- **Testing and validation:** 15 minutes
- **Documentation:** 10 minutes
- **Total:** ~80 minutes (1.5 hours)

---

## Alternative Approaches Considered

### Alternative 1: Modify `generate_address()` to Set Variable

**Idea:** Make `generate_address()` set `GENERATED_ADDRESS` directly.

**Why rejected:**
- Won't work with BATS `run` (subshell isolation)
- Would require all tests to stop using `run`
- Would break BATS best practices

### Alternative 2: Create New `generate_address_for_tests()` Function

**Idea:** Create a separate function specifically for BATS tests.

**Why rejected:**
- Duplicates functionality
- Confusing which function to use
- Maintenance burden (two functions doing same thing)

### Alternative 3: Abandon `run` Pattern Entirely

**Idea:** Stop using BATS `run` command, use direct calls.

**Why rejected:**
- Loses BATS integration benefits
- No automatic `$status` and `$output` capture
- Would require rewriting many more tests
- Goes against BATS best practices

### Alternative 4: Use Process Substitution or Named Pipes

**Idea:** Use bash process substitution to capture output while preserving variables.

**Why rejected:**
- Overly complex
- Less readable
- Not portable
- Violates BATS conventions

---

## Testing Strategy

### Unit Testing the Fix

Test the new `extract_generated_address()` helper:

```bash
# Test 1: Works with valid output
output="Generated address: DIRECT://deadbeef1234567890"
extract_generated_address
echo "$GENERATED_ADDRESS"  # Should print: DIRECT://deadbeef1234567890

# Test 2: Fails gracefully with no output
unset output
extract_generated_address  # Should fail with error message

# Test 3: Fails gracefully with invalid output
output="No address here"
extract_generated_address  # Should fail with error message
```

### Integration Testing

Test with actual BATS test:

```bash
# Create temporary test file
cat > /tmp/test_fix.bats <<'EOF'
#!/usr/bin/env bats
load '../tests/helpers/common'
load '../tests/helpers/token-helpers'

setup() {
  setup_test
}

@test "extract_generated_address works" {
  run generate_address "test-secret" "nft"
  extract_generated_address
  echo "Address: $GENERATED_ADDRESS"
  [[ -n "$GENERATED_ADDRESS" ]]
  [[ "$GENERATED_ADDRESS" =~ ^DIRECT:// ]]
}
EOF

# Run test
bats /tmp/test_fix.bats
```

### Regression Testing

After implementing all fixes:

```bash
# Run full security suite
npm run test:security

# Run full edge-case suite
npm run test:edge-cases

# Run full functional suite (should still pass)
npm run test:functional

# Run everything
npm test
```

---

## Documentation Updates Needed

### Update Test Documentation

**File: `tests/QUICK_REFERENCE.md`**

Update section on using `generate_address`:

```markdown
## Generating Addresses for Tests

### Using with BATS `run` Command

```bash
# Generate address and capture output
run generate_address "$SECRET" "nft"

# Extract address from output
extract_generated_address

# Use the address
local recipient="$GENERATED_ADDRESS"
```

### Direct Usage (Without run)

```bash
# Generate address directly
local address=$(generate_address "$SECRET" "nft")
```

### Common Patterns

```bash
# Pattern 1: Generate recipient address for transfer
run generate_address "$BOB_SECRET" "nft"
extract_generated_address
local bob_addr="$GENERATED_ADDRESS"

# Pattern 2: Generate multiple addresses
run generate_address "$USER1_SECRET" "nft"
extract_generated_address
local addr1="$GENERATED_ADDRESS"

run generate_address "$USER2_SECRET" "nft"
extract_generated_address
local addr2="$GENERATED_ADDRESS"
```
```

---

## Conclusion

The BATS test infrastructure issues are **well-understood and straightforward to fix**. The fixes are:

1. ✅ **Low risk** - won't break working tests
2. ✅ **Additive** - only add new helper, don't modify existing code
3. ✅ **Isolated** - only affect already-broken tests
4. ✅ **Quick** - ~80 minutes total implementation time
5. ✅ **High impact** - will fix ~30 failing tests

**Recommendation:** Proceed with implementation using the hybrid approach:
- Add `extract_generated_address()` helper for backward compatibility
- Fix all 24 `GENERATED_ADDRESS` usages
- Fix all 4 `$status` usages
- Validate with regression testing

This will dramatically improve test suite reliability and reveal actual CLI issues that need attention.

---

## Next Steps

After bash-pro agent completes its analysis (if any additional issues found):

1. Review bash-pro findings
2. Incorporate any additional patterns discovered
3. Create implementation PR with all fixes
4. Run comprehensive test suite
5. Document any remaining real failures for CLI team

**Ready to proceed with implementation when approved.**
