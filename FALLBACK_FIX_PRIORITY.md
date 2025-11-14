# Fallback Pattern Fix Priority List
## Immediate Action Items

**Total Issues Found:** 97 fallback patterns
**Critical Priority:** 20 issues
**Estimated Fix Time:** 3-4 days for Phase 1

---

## Phase 1: CRITICAL (Fix Today/Tomorrow) ⚠️

### 1. common.bash - Output Capture (HIGHEST PRIORITY)
**File:** `/home/vrogojin/cli/tests/helpers/common.bash`
**Lines:** 256-257
**Impact:** Affects ALL 313 tests

```bash
# CURRENT (BROKEN):
output=$(cat "$temp_stdout" 2>/dev/null || true)
stderr_output=$(cat "$temp_stderr" 2>/dev/null || true)

# FIX:
output=$(cat "$temp_stdout") || {
  echo "FATAL: Failed to read stdout capture" >&2
  return 1
}
stderr_output=$(cat "$temp_stderr") || {
  echo "FATAL: Failed to read stderr capture" >&2
  return 1
}
```

**Why Critical:** If temp file reads fail, every test gets empty output and makes wrong assertions.

---

### 2. test_concurrency.bats - Success Counter Pattern
**File:** `/home/vrogojin/cli/tests/edge-cases/test_concurrency.bats`
**Lines:** 65-71, 131-137, 192-193, 278-286, 341-347
**Impact:** 10 instances, all concurrency tests always pass

```bash
# CURRENT (BROKEN):
wait $pid1 || true
wait $pid2 || true
local success_count=0
[[ -f "$file1" ]] && ((success_count++)) || true
[[ -f "$file2" ]] && ((success_count++)) || true

# FIX:
local exit1=0
local exit2=0
wait $pid1 || exit1=$?
wait $pid2 || exit2=$?

# Must not crash
[[ $exit1 -eq 0 ]] || fail "Process 1 crashed: exit $exit1"
[[ $exit2 -eq 0 ]] || fail "Process 2 crashed: exit $exit2"

# Must create valid files
assert_file_exists "$file1"
assert_file_exists "$file2"
assert_valid_json "$file1"
assert_valid_json "$file2"
```

**Why Critical:** Tests accept ANY outcome (0, 1, or 2 successes) - they never fail.

---

### 3. test_double_spend_advanced.bats - jq Fallbacks
**File:** `/home/vrogojin/cli/tests/edge-cases/test_double_spend_advanced.bats`
**Lines:** 79-80, 398-419, 428, 486-487
**Impact:** 8 instances, security tests pass with corrupt data

```bash
# CURRENT (BROKEN):
[[ -f "$bob_token" ]] && [[ $(jq 'has("offlineTransfer") | not' "$bob_token") == "true" ]] && ((success_count++)) || true

# FIX:
assert_file_exists "$bob_token"
assert_valid_json "$bob_token"
local has_transfer=$(jq 'has("offlineTransfer")' "$bob_token")
[[ "$has_transfer" == "false" ]] || fail "Token still has pending transfer"
```

**Why Critical:** Corrupt JSON or missing files cause wrong success counting in security tests.

---

### 4. assertions.bash - jq Field Extraction
**File:** `/home/vrogojin/cli/tests/helpers/assertions.bash`
**Line:** 430
**Impact:** Affects all JSON field assertions

```bash
# CURRENT (BROKEN):
actual=$(~/.local/bin/jq -r "$field | tostring" "$file" 2>/dev/null || echo "")

# FIX:
assert_file_exists "$file" || return 1
assert_valid_json "$file" || return 1
actual=$(~/.local/bin/jq -r "$field | tostring" "$file")
[[ $? -eq 0 ]] || {
  printf "Failed to extract field: %s\n" "$field" >&2
  return 1
}
```

**Why Critical:** jq failures return empty string, causing wrong comparisons.

---

## Phase 2: HIGH (Fix This Week) 🔴

### 5. test_network_edge.bats - Assertion + || true
**File:** `/home/vrogojin/cli/tests/edge-cases/test_network_edge.bats`
**Lines:** 56, 82, 131, 151, 181, 205
**Count:** 6 instances

```bash
# BROKEN:
assert_output_contains "connect\|ECONNREFUSED\|refused\|unreachable" || true

# FIX:
assert_output_contains "ECONNREFUSED" || \
  assert_output_contains "refused" || \
  assert_output_contains "connect" || \
  fail "Expected connection error not found: $output"
```

---

### 6. OR-Chain Assertions (All Test Files)
**Files:** Multiple security and functional tests
**Count:** 24 instances
**Lines:**
- `test_input_validation.bats:380`
- `test_receive_token.bats:163, 393, 433`
- `test_recipientDataHash_tampering.bats:100, 150, 188, 226, 279`
- `test_double_spend.bats:401`
- `test_authentication.bats:201`
- `test_verify_token.bats:34, 37, 63, 145, 160, 264`

```bash
# BROKEN:
assert_output_contains "hash" || assert_output_contains "mismatch" || assert_output_contains "invalid"

# FIX:
# Use specific error code or exact message
assert_failure
assert_exit_code 1
assert_output_contains "Invalid hash: mismatch detected"
```

---

## Phase 3: MEDIUM (Fix Next Week) 🟡

### 7. Exit Code Swallowing - Audit Required
**Files:** token-helpers.bash, common.bash
**Count:** 51 instances
**Pattern:** `|| exit_code=$?`

**ACTION:** Audit each instance to ensure exit code is checked:
```bash
cmd || exit_code=$?
# MUST be followed by:
if [[ $exit_code -ne 0 ]]; then
  error "Operation failed"
  return $exit_code
fi
```

---

### 8. File System Tests - || true on Operations
**File:** `/home/vrogojin/cli/tests/edge-cases/test_file_system.bats`
**Lines:** 57, 154, 167, 209, 221, 278, 291
**Count:** 8 instances

```bash
# BROKEN:
SECRET="$TEST_SECRET" run_cli mint-token --preset nft -o "$file" || true

# FIX:
SECRET="$TEST_SECRET" run_cli mint-token --preset nft -o "$file"
assert_failure  # Must fail for permission denied
assert_output_contains "Permission denied"
```

---

### 9. Data Boundary Tests - Missing Assertions
**File:** `/home/vrogojin/cli/tests/edge-cases/test_data_boundaries.bats`
**Lines:** 61, 144, 227, 262, 275, 300, 337, 378, 381, 414, 450, 474
**Count:** 15 instances

```bash
# BROKEN:
SECRET="" run_cli gen-address --preset nft || true

# FIX:
SECRET="" run_cli gen-address --preset nft
assert_failure
assert_output_contains "Secret required" || assert_output_contains "empty"
```

---

### 10. Conditional Success Acceptance
**File:** `/home/vrogojin/cli/tests/edge-cases/test_network_edge.bats`
**Lines:** 48-60, 103-106, 123-130, 177-182, 197-206, 221-232
**Count:** 12 instances

```bash
# BROKEN:
if [[ $exit_code -ne 0 ]]; then
  info "✓ Failed as expected"
else
  info "⚠ Unexpectedly succeeded"
fi
# Test passes either way!

# FIX:
# Command MUST fail
assert_failure
assert_output_contains "expected error message"
```

---

## Quick Fix Script

Create this script to find all instances:

```bash
#!/bin/bash
# find-fallbacks.sh

echo "=== CRITICAL: || true on assertions ==="
grep -rn "assert.*|| true" tests/ | grep -v ".md:"

echo ""
echo "=== CRITICAL: || echo fallbacks ==="
grep -rn "|| echo" tests/ | grep -v ".md:" | grep -v "system detection"

echo ""
echo "=== HIGH: OR-chain assertions ==="
grep -rn "assert.*||.*assert" tests/ | grep -v ".md:"

echo ""
echo "=== MEDIUM: || true on operations ==="
grep -rn "run_cli.*|| true" tests/ | grep -v ".md:"
grep -rn "wait.*|| true" tests/ | grep -v ".md:"

echo ""
echo "=== Count: Success counters ==="
grep -rn "success_count" tests/ | grep -v ".md:"
```

---

## Verification After Fixes

Run these commands to verify fixes:

```bash
# 1. No more || true on assertions
grep -r "assert.*|| true" tests/*.bats && echo "FAIL: Still has || true" || echo "PASS"

# 2. No more || echo on jq
grep -r "jq.*|| echo" tests/helpers/ tests/edge-cases/ tests/security/ && echo "FAIL" || echo "PASS"

# 3. All wait commands check exit codes
grep -r "wait \$" tests/*.bats | grep -v "exit_code" && echo "FAIL: wait without check" || echo "PASS"

# 4. All background processes tracked
grep -r ") &" tests/*.bats -A 5 | grep -v "wait.*||.*=" && echo "WARNING: Check manually"
```

---

## Expected Impact

### Before Fixes:
- Tests passing: ~64% (201/313)
- False positives: ~30-40 tests
- Actual reliability: ~50%

### After Phase 1 Fixes:
- Tests passing: ~55-60% (170-190/313)
- False positives: ~10-15 tests
- Actual reliability: ~85%

### After All Fixes:
- Tests passing: ~50-55% (155-170/313)
- False positives: <5 tests
- Actual reliability: ~95%

---

## Files Requiring Changes

### CRITICAL (Phase 1):
1. `tests/helpers/common.bash` (1 file, 2 lines)
2. `tests/edge-cases/test_concurrency.bats` (1 file, 10 instances)
3. `tests/edge-cases/test_double_spend_advanced.bats` (1 file, 8 instances)
4. `tests/helpers/assertions.bash` (1 file, 1 line)

**Total Phase 1:** 4 files, ~21 fixes

### HIGH (Phase 2):
5. `tests/edge-cases/test_network_edge.bats` (1 file, 6 instances)
6. Multiple test files (8 files, 24 instances)

**Total Phase 2:** 9 files, ~30 fixes

### MEDIUM (Phase 3):
7. `tests/helpers/token-helpers.bash` + `common.bash` (audit 51 instances)
8. `tests/edge-cases/test_file_system.bats` (8 instances)
9. `tests/edge-cases/test_data_boundaries.bats` (15 instances)
10. Various conditional patterns (12 instances)

**Total Phase 3:** 5+ files, ~86 reviews/fixes

---

## Owner Assignment Suggestion

### Day 1-2: Core Infrastructure (1 developer)
- Fix common.bash output capture
- Fix assertions.bash jq pattern
- Run full test suite, verify no regressions

### Day 2-3: Concurrency Tests (1 developer)
- Fix all test_concurrency.bats patterns
- Fix test_double_spend_advanced.bats patterns
- Verify security tests properly detect double-spends

### Day 3-4: Network + OR-Chains (1 developer)
- Fix test_network_edge.bats assertions
- Fix OR-chain assertions across all files
- Verify error messages are specific

### Week 2: Medium Priority (Team effort)
- Exit code audit (pair programming)
- File system test fixes
- Data boundary test fixes

---

## Success Criteria

✅ **Phase 1 Complete When:**
- No `|| true` on assertions in helper files
- All concurrency tests have proper failure detection
- All jq operations validate files first
- Test pass rate drops to 55-60% (revealing hidden failures)

✅ **Phase 2 Complete When:**
- No OR-chain assertions (all use specific error validation)
- Network tests require specific error messages
- All assertion failures fail the test

✅ **Phase 3 Complete When:**
- All `|| exit_code=$?` followed by exit code check
- All operations assert expected outcome (success OR specific failure)
- No conditional success acceptance patterns
- CI linting prevents new fallback patterns

---

## Questions to Answer

1. **Should we fix all at once or incrementally?**
   - Recommend: Phase 1 immediately (2 days), then incremental
   - Reason: Phase 1 affects all tests, need stable foundation

2. **What's acceptable test pass rate after fixes?**
   - Target: 50-60% after Phase 1
   - Reason: Reveals real failures currently masked

3. **How to handle legitimate || true cases?**
   - Add comment: `|| true  # ACCEPTABLE: system detection fallback`
   - Document in code review guidelines

4. **CI integration?**
   - Add pre-commit hook checking for `assert.*|| true`
   - Add to lint script
