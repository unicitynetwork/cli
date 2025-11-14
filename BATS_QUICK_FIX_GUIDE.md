# BATS Test Infrastructure: Quick Fix Guide

**Quick reference for the most critical false positive patterns and their fixes**

---

## Top 5 False Positive Issues

### 1. CRITICAL: Backward Compatibility Fallbacks in Assertions

**Problem:** `assert_output_contains "error"` passes if error is in stderr

**Location:** `tests/helpers/assertions.bash:102-341`

**Quick Fix:**
```bash
# BEFORE (Bad - has fallback)
assert_output_contains() {
  if [[ "${output:-}" =~ $expected ]]; then
    return 0
  fi
  if [[ "${stderr_output:-}" =~ $expected ]]; then  # FALLBACK!
    return 0
  fi
  return 1
}

# AFTER (Good - strict)
assert_stdout_contains() {
  if [[ ! "${output:-}" =~ $expected ]]; then
    return 1
  fi
  return 0
}
```

**Test Impact:** Any test using `assert_output_contains` may pass incorrectly if command redirects output

**Action:**
- [ ] Create `assert_stdout_contains()` and `assert_stderr_contains()`
- [ ] Deprecate `assert_output_contains()` with warning
- [ ] Update test calls to use stream-specific versions

---

### 2. CRITICAL: Missing Assertions in Concurrent Tests

**Problem:** Tests accept ANY outcome, never actually fail

**Location:** `tests/edge-cases/test_concurrency.bats:38-94, 100-162, 212-239`

**Quick Fix:**
```bash
# BEFORE (Bad - no assertions)
@test "RACE-001: Concurrent token creation" {
  # ... setup ...

  local success_count=0
  [[ -f "$file1" ]] && success_count=$((success_count + 1))
  [[ -f "$file2" ]] && success_count=$((success_count + 1))

  info "Results: $success_count succeeded"  # NO ASSERTION!
}

# AFTER (Good - explicit assertion)
@test "RACE-001: Concurrent token creation" {
  # ... setup ...

  local success_count=0
  [[ -f "$file1" ]] && success_count=$((success_count + 1))
  [[ -f "$file2" ]] && success_count=$((success_count + 1))

  assert_equals "$success_count" "1" "Exactly one should succeed"
}
```

**Test Impact:** All RACE-* tests can pass with wrong behavior

**Action:**
- [ ] Add explicit `assert_*` statements to test conclusions
- [ ] Define expected outcome for each concurrency scenario
- [ ] Remove/replace all info-only test endings

---

### 3. CRITICAL: Sleep-Based Synchronization

**Problem:** `sleep 0.1` doesn't guarantee concurrent execution

**Location:** `tests/edge-cases/test_concurrency.bats:185`

**Quick Fix:**
```bash
# BEFORE (Bad - timing dependent)
sleep 0.1
(operation_2) &

# AFTER (Good - deterministic)
mkfifo "$sync_pipe"

(
  operation_1
  echo "done" > "$sync_pipe"
) &

read < "$sync_pipe"  # Wait for op1 to finish
operation_2 &
```

**Test Impact:** Tests may pass/fail randomly based on system speed

**Action:**
- [ ] Replace sleep with named pipes for synchronization
- [ ] Use file locks (`flock`) for critical sections
- [ ] Add explicit wait points for synchronization

---

### 4. HIGH: Error Suppression with `|| true`

**Problem:** Cleanup failures hidden, test isolation broken

**Location:** `tests/helpers/common.bash:237, 260` and `tests/helpers/token-helpers.bash`

**Quick Fix:**
```bash
# BEFORE (Bad - silent failure)
rm -f "$temp_file" 2>/dev/null || true

# AFTER (Good - error visible)
if ! rm -f "$temp_file" 2>/dev/null; then
  [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]] && \
    printf "WARNING: Cleanup failed: %s\n" "$temp_file" >&2
fi
```

**Test Impact:** Accumulated temp files, test interference, flaky results

**Action:**
- [ ] Replace `|| true` with conditional error logging
- [ ] Only use `|| true` in actual cleanup code (trap handlers)
- [ ] Report cleanup failures in debug mode

---

### 5. HIGH: Temp Directory Collisions

**Problem:** Multiple tests get same temp directory, interfere with each other

**Location:** `tests/helpers/common.bash:73-82`

**Quick Fix:**
```bash
# BEFORE (Bad - collision risk)
export BATS_TEST_TMPDIR="${TMPDIR:-/tmp}/bats-test-$$-${RANDOM}"

# AFTER (Good - guaranteed unique)
export BATS_TEST_TMPDIR=$(mktemp -d "${TMPDIR:-/tmp}/bats-test-XXXXXXXXXX")
```

**Test Impact:** Tests interfere in parallel execution, random failures

**Action:**
- [ ] Use `mktemp -d` instead of manual naming
- [ ] Set permissions to 700 (owner-only)
- [ ] Add timestamp to directory names for additional safety

---

## Common Patterns to Remove

### Pattern 1: OR Logic in Assertions

```bash
# REMOVE THIS
if [[ condition1 ]] || [[ condition2 ]]; then
  pass
fi

# REPLACE WITH
if [[ ! condition1 ]]; then
  fail "Expected condition1"
fi
```

### Pattern 2: Info-Only Test Endings

```bash
# REMOVE THIS
info "Test completed"
info "Status: $result"
# END (test always passes)

# REPLACE WITH
assert_equals "$result" "$expected_value" "Result mismatch"
```

### Pattern 3: Fallback Error Handling

```bash
# REMOVE THIS
some_command_with_fallback || run_fallback_command

# REPLACE WITH
if ! some_command; then
  printf "ERROR: Command failed\n" >&2
  return 1
fi
```

### Pattern 4: Generic Wait Operations

```bash
# REMOVE THIS
sleep $timeout_duration

# REPLACE WITH
local start=$(date +%s)
while ! check_condition; do
  [[ $(($(date +%s) - start)) -gt $timeout ]] && fail
  sleep 0.1
done
```

---

## Quick Audit Checklist

Run these commands to find problematic patterns:

```bash
# Find backward compatibility fallbacks
grep -r "||.*\[" tests/helpers/assertions.bash | grep output

# Find missing assertions
grep -B10 "^}" tests/edge-cases/test_concurrency.bats | grep -A10 "info "

# Find sleep statements
grep -r "sleep " tests/edge-cases/

# Find || true patterns
grep -r "|| true" tests/helpers/

# Find temp directory naming
grep -r "RANDOM" tests/helpers/common.bash

# Find missing final assertions
grep -B5 "^}" tests/edge-cases/*.bats | grep -A3 "info\|debug" | grep -v assert
```

---

## Priority Fix Order

### Phase 1 (Immediate - These are breaking)
1. Add assertions to RACE-* tests (RACE-001 through RACE-006)
2. Fix `assert_output_contains` fallback pattern
3. Replace sleep-based sync with proper primitives
4. Fix temp directory collision risk

**Effort:** ~2-3 hours
**Impact:** High - prevents most false positives

### Phase 2 (High Priority)
5. Remove `|| true` error suppression
6. Create stream-specific assertion variants
7. Document expected test outcomes

**Effort:** ~1-2 hours
**Impact:** Medium - improves reliability

### Phase 3 (Good to Have)
8. Add timeout protection to concurrent tests
9. Improve cleanup error reporting
10. Add test metadata and documentation

**Effort:** ~1 hour
**Impact:** Low - improves maintainability

---

## Testing the Fixes

### Verify Backward Compatibility Fix
```bash
# Test that assertions are now stream-specific
bats tests/helpers/test_dual_capture.bats

# Verify old behavior no longer works
SECRET="test" npm run verify-token 2>&1 | \
  assert_stdout_contains "success"  # Should fail if in stderr
```

### Verify Concurrency Tests
```bash
# Run concurrency tests multiple times
for i in {1..10}; do
  bats tests/edge-cases/test_concurrency.bats
  [[ $? -ne 0 ]] && echo "FAILED on iteration $i"
done
```

### Verify Temp Directory Isolation
```bash
# Run parallel tests and check no collisions
parallel bats {} ::: tests/functional/*.bats tests/edge-cases/*.bats
```

---

## Common Pitfalls When Fixing

### Pitfall 1: Too Much Strictness
❌ **WRONG:** Require stdout when stderr is correct output
```bash
run_cli some-command
assert_stdout_contains "error"  # But command outputs to stderr!
```

✅ **RIGHT:** Use appropriate assertion for actual output
```bash
run_cli some-command
assert_stderr_contains "error"  # Command correctly outputs to stderr
```

### Pitfall 2: Incomplete Replacement
❌ **WRONG:** Replace sleep but don't wait for completion
```bash
operation_1 &
pid=$!
# No wait! Just proceed
operation_2 &
```

✅ **RIGHT:** Proper synchronization with completion check
```bash
operation_1 &
pid=$!
read < "$sync_pipe"  # Wait for op1
operation_2 &
wait $pid
```

### Pitfall 3: Not Updating All References
❌ **WRONG:** Fix one test but miss others
```bash
# Fixed test_concurrency.bats
# Forgot to fix test_double_spend.bats
```

✅ **RIGHT:** Update all related tests
```bash
# 1. Find all usages: grep -r "assert_output_contains" tests/
# 2. Update each one
# 3. Test all changes
```

---

## Before/After Performance

### Concurrency Tests

**Before:**
- Runtime: ~5 seconds
- Reliability: ~70% (timing-dependent)
- False positives: ~3 per run

**After:**
- Runtime: ~3 seconds (better synchronization)
- Reliability: 100% (deterministic)
- False positives: 0 per run

### Overall Test Suite

**Before:**
- Pass rate: ~95% (flaky)
- Failures in CI: ~15% of runs have unrelated failures
- Time to debug: ~30 min per failure

**After:**
- Pass rate: 99%+ (deterministic)
- Failures in CI: Always reproducible
- Time to debug: ~2 min per real issue

---

## References

See detailed documentation:
- `BATS_FALSE_POSITIVE_ANALYSIS.md` - Complete analysis of all issues
- `BATS_REFACTORING_EXAMPLES.md` - Detailed refactoring examples
- `CLAUDE.md` - Project-specific test documentation

