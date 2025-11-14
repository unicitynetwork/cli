# Test Failure Analysis Report
**Date:** 2025-11-14
**Test Run:** all-tests-20251114-140803.log
**Total Tests:** 242
**Total Failures:** 31 (12.8%)
**Skipped Tests:** 6 (intentional skips, not counted as failures)

---

## Summary Statistics

| Category | Count | Percentage |
|----------|-------|-----------|
| **Passing Tests** | 205 | 84.7% |
| **Failed Tests** | 31 | 12.8% |
| **Skipped Tests** | 6 | 2.5% |
| **CRITICAL Priority** | 3 | |
| **HIGH Priority** | 5 | |
| **MEDIUM Priority** | 14 | |
| **LOW Priority** | 9 | |

---

## Critical Priority Issues (3)

These issues represent broken test infrastructure or CLI bugs affecting core functionality.

### 1. CRITICAL: `assert_valid_json` Assertion Failure - JSON Parse Error
**Test Names:**
- AGGREGATOR-001 (Line 2)
- AGGREGATOR-010 (Line 69)

**Root Cause Analysis:**
The `assert_valid_json` function is checking if a file exists after writing, but is receiving the JSON content as a string instead of a filename. Looking at the error messages:
- The assertion shows valid JSON content being printed to stdout
- Error message: "Assertion Failed: File does not exist"
- The function is treating the JSON content (multiline object) as a file path

**Technical Details:**
```
# ✗ Assertion Failed: File does not exist
#   File: {
#   "status": "EXCLUSION",
#   "requestId": "00008d5a106b82d329f9e22338d8aa00245d63990ddd185bf9d267ebd971043594f1",
#   ...
```

**Proposed Fix:**
1. Check `tests/helpers/assertions.bash` line 1969 - `assert_valid_json` function
2. The function likely expects a file path but is receiving stdout content
3. Verify the test is capturing output correctly before passing to assertion
4. May need to save output to file first, then pass filename to assertion

**Severity:** CRITICAL - Affects aggregator integration tests which are core functionality

---

### 2. CRITICAL: `receive_token` Helper Creates No Output File
**Test Names:**
- INTEGRATION-007 (Line 147, actual failure at 233)
- INTEGRATION-009 (Line 235, actual failure at 262)

**Root Cause Analysis:**
The `receive_token` helper function (tests/helpers/token-helpers.bash:449) executes successfully but does NOT create the output file specified in the third argument.

**Evidence from Logs:**
```bash
# [ERROR] Receive succeeded but output file not created: dave-token.txf
# [ERROR] Receive succeeded but output file not created: bob-token1.txf
```

The receive command exits with status 0 (success) but the file is never written.

**Technical Details:**
- Command executes successfully (no error message from CLI)
- Output shows token validation succeeding
- But file specified in arguments is not created
- This suggests the `--save` flag or `-o` output file handling is broken in `receive-token` command

**Proposed Fix:**
1. Check `src/commands/receive-token.ts` for output file handling
2. Verify `--save` flag creates files with correct names
3. Check if file is being saved to wrong location or with wrong name
4. Add logging to see what filename is actually being used

**Severity:** CRITICAL - Core functionality (token receiving) broken

---

### 3. CRITICAL: Missing Assertion Function `assert_true`
**Test Names:**
- CORNER-027 (Line 541)
- CORNER-031 (Line 574)

**Root Cause Analysis:**
Tests are calling `assert_true` function which does not exist in `tests/helpers/assertions.bash`.

**Evidence from Logs:**
```bash
# /home/vrogojin/cli/tests/edge-cases/test_network_edge.bats: line 90: assert_true: command not found
# /home/vrogojin/cli/tests/edge-cases/test_network_edge.bats: line 154: assert_true: command not found
```

**Technical Details:**
- Function is called but not defined in helper files
- This is a test infrastructure problem, not a CLI bug
- But it prevents these network timeout tests from running

**Proposed Fix:**
1. Define `assert_true` function in `tests/helpers/assertions.bash`
2. Should be simple: check if first argument evaluates to true/non-zero
3. Example implementation:
```bash
assert_true() {
  local condition="$1"
  local message="${2:-Assertion failed}"

  if eval "$condition"; then
    echo "✓ $message"
    return 0
  else
    echo "✗ $message"
    return 1
  fi
}
```

**Severity:** CRITICAL - Blocks network timeout edge case tests

---

## High Priority Issues (5)

These issues represent test infrastructure problems that prevent valid tests from running properly.

### 1. HIGH: Unbound Variable `stderr_output` in Assertion
**Test Name:** CORNER-032 (Line 729)

**Root Cause Analysis:**
The assertion code is trying to use an unbound variable `stderr_output`.

**Evidence from Logs:**
```bash
# /home/vrogojin/cli/tests/edge-cases/../helpers/assertions.bash: line 126: stderr_output: unbound variable
```

**Technical Details:**
- Tests using `run_cli` helper capture stderr to a variable
- The assertion at line 126 in assertions.bash is trying to access `stderr_output`
- Variable name mismatch - probably should be `$stderr` or `$error_output`

**Proposed Fix:**
1. Check assertions.bash line 126 - identify what variable name should be used
2. Verify variable names match between `run_cli` helper and assertion functions
3. May need to use `$output` for stdout or properly captured stderr variable

**Severity:** HIGH - Blocks multiple test assertions

---

### 2. HIGH: Short Secret Validation Using Wrong Test Value
**Test Names:**
- CORNER-026 (Line 528)
- CORNER-027 (Line 530)
- CORNER-030 (Line 570)
- CORNER-033 (Line 694)

**Root Cause Analysis:**
Tests are trying to test network behavior (aggregator unavailable, DNS failure, etc.) but failing because the CLI is rejecting the secret as too short before it even gets to network operations.

**Evidence from Logs:**
```bash
# ❌ Validation Error: Secret is too short
# Secret must be at least 8 characters for security. Use a strong, unique secret for production.
```

The tests use short test secrets like "test" but the CLI now has minimum length validation.

**Technical Details:**
- CLI validates secret length before doing any network operations
- Tests trying to exercise network error paths use short secrets
- Secret validation happens first, blocking the network error test
- Tests need to use valid-length secrets to reach the network code

**Proposed Fix:**
1. Update network edge case tests (test_network_edge.bats lines 51-203) to use secrets like "test-secret-long-enough" (8+ chars)
2. Search for tests using `SECRET="test"` or similar short values
3. Replace with `SECRET="testnetwork123"` or similar

**Severity:** HIGH - Prevents legitimate network error handling tests from executing

---

### 3. HIGH: File Path Argument Confusion - `--local` Treated as Path
**Test Name:** CORNER-028, CORNER-032 (Lines 554-556, 759-760)

**Root Cause Analysis:**
The `--local` flag is being interpreted as a file path instead of as a flag.

**Evidence from Logs:**
```bash
# File: --local/tmp/bats-test-2918889-8349/test-3/tmp-12925.txf
# Error: Cannot read file: ENOENT: no such file or directory, open '--local/tmp/...'

# File: --local/tmp/bats-test-2920127-12705/test-10/tmp-16638.txf
```

**Technical Details:**
- Test is passing `--local` as first positional argument instead of as flag
- `verify-token` command is treating it as the file path
- Result: trying to open file named "--local/tmp/..."
- Test should use `-f` or `--file` before the path

**Proposed Fix:**
1. Check test_network_edge.bats lines where verify-token is called
2. Change from: `verify-token --local <path>` or `verify-token --local <path>`
3. To: `verify-token --local -f <path>` or `verify-token -f <path> --local`
4. Verify command documentation for correct flag order

**Severity:** HIGH - Affects multiple network edge case tests

---

### 4. HIGH: Incomplete Assertion - Missing Expected Output String
**Test Names:**
- CORNER-026 (Line 538)
- CORNER-030 (Line 559)
- CORNER-033 (Line 684)
- CORNER-032 (Line 579)

**Root Cause Analysis:**
Tests call `assert_output_contains` expecting specific error keywords but the commands succeed or produce different output than expected.

**Evidence from Logs:**
```bash
# ✗ Assertion Failed: Output does not contain expected string
#   Expected to contain: 'ECONNREFUSED\|refused\|connect\|unreachable'
#   Actual stdout: (empty)
#   Actual stderr: (shows validation error instead)
```

**Technical Details:**
- Tests expect network error messages (ECONNREFUSED, DNS errors, etc.)
- But secret validation errors appear first
- Commands fail for validation reasons, not network reasons
- Need better test setup to bypass validation and reach network layer

**Proposed Fix:**
1. Fix secret validation issue first (use longer secrets)
2. Ensure tests can reach the network code path
3. May need to mock/stub aggregator for these error scenarios
4. Alternative: accept that validation happens first and adjust test expectations

**Severity:** HIGH - Masks actual network error handling behavior

---

### 5. HIGH: Empty File Output on Token Operations
**Test Names:**
- CORNER-012 (Line 456)
- CORNER-014 (Line 463)
- CORNER-015 (Line 469)
- CORNER-017 (Line 476)
- CORNER-018 (Line 482)
- CORNER-025 (Line 521)

**Root Cause Analysis:**
Mint and send operations with invalid inputs are creating empty token files instead of failing with errors.

**Evidence from Logs:**
```bash
# ✗ Assertion Failed: File is empty
#   File: /tmp/bats-test-2909704-3475/test-7/tmp-508.txf
```

**Technical Details:**
- Commands exit with status 0 but create empty files
- Invalid inputs (zero amount, odd-length hex, invalid hex) should be rejected
- Instead of returning errors, files are created with no content
- Suggests output file is created before validation completes

**Proposed Fix:**
1. Check mint-token.ts and send-token.ts for output file handling
2. Validate inputs BEFORE creating/opening output file
3. Only write to file after successful validation and token creation
4. Ensure error exit codes are set properly

**Severity:** HIGH - Silent failures could corrupt token workflows

---

## Medium Priority Issues (14)

These are test assertion/logic issues that don't affect core functionality but prevent accurate test reporting.

### Issue Group 1: Skipped Tests (Intentional)
**Test Names:**
- INTEGRATION-005 (Line 147): "Complex scenario - requires careful transaction management"
- INTEGRATION-006 (Line 152): "Advanced scenario - may have network limitations"
- VERIFY_TOKEN-007 (Line 339): "Requires dual-device simulation or mock"
- SEC-ACCESS-004 (Line 350): "Trustbase authenticity validation not implemented (pending)"
- SEC-DBLSPEND-002 (Line 390): "Concurrent execution test infrastructure needs investigation"
- SEC-INPUT-006 (Line 403): "Input size limits are not a security priority per requirements"
- DBLSPEND-020 (Line 499): "Network partition simulation requires infrastructure setup"
- CORNER-023 (Line 509): "Disk full simulation requires root privileges or special setup"

**Root Cause:** These tests are intentionally skipped (using `skip` function with `status 77`). Not failures - they're architectural/infrastructure limitations.

**Proposed Action:** Document as known limitations, not bugs. These should appear in test documentation.

---

### Issue Group 2: Boundary Testing Failures
**Test Names:**
- CORNER-010 (Line 447): Very long secret (10MB) - "Argument list too long"
- CORNER-010b (Line 451): Very long token data (1MB) - "Argument list too long"

**Root Cause Analysis:**
These tests try to pass extremely large strings via environment variables and command arguments, hitting OS limits.

```bash
# /usr/bin/timeout: Argument list too long
```

**Technical Details:**
- Bash has ARG_MAX limit (usually 128KB)
- 10MB secret exceeds this limit when passed via $SECRET env var
- Cannot expand the variable in the command line

**Proposed Fix:**
1. These may be unrealistic test cases (10MB secret is not practical)
2. Either skip these tests as "OS limitation" or
3. Use file-based secret input instead of environment variable
4. Document that CLI handles typical secrets (up to reasonable size)

**Severity:** MEDIUM - Edge case beyond typical use

---

### Issue Group 3: Idempotent Receive Assertion Issue
**Test Name:** RACE-006 (Line 434)

**Root Cause Analysis:**
Test expects sequential receives of same transfer package to be idempotent but assertion fails.

```bash
# [[ $status1 -eq 0 ]] && ((success_count++))' failed
```

**Technical Details:**
- Both receive operations return status 0 (success)
- But the assertion counting logic fails
- May be bash syntax issue in test itself

**Proposed Fix:**
1. Review RACE-006 test logic in test_concurrency.bats line 348
2. Check `$status1` variable assignment
3. Verify arithmetic syntax is correct: `((success_count++))`
4. May need proper variable initialization

**Severity:** MEDIUM - Test logic issue, CLI behavior is correct

---

### Issue Group 4: Network Timeout Tests (Missing assert_true)
**Test Names:**
- CORNER-027 (Line 541)
- CORNER-031 (Line 574)

**Root Cause:** Already covered in HIGH priority section (missing `assert_true` function)

**Severity:** MEDIUM as secondary issue (will be fixed by HIGH priority fix)

---

### Issue Group 5: Symbolic Link Read/Write Issue
**Test Name:** CORNER-025 (Line 514)

**Root Cause Analysis:**
Test sends token through symbolic link but output file is empty.

```bash
# ✓ Read through symlink successful
# ✗ Assertion Failed: File is empty
#   File: /tmp/bats-test-2917997-12441/test-7/tmp-18213-send.txf
```

**Technical Details:**
- File creation through symlink works
- But output is empty (similar to HIGH priority issue)
- Related to output file handling timing

**Proposed Fix:**
1. Fix output file handling issue (HIGH priority #5)
2. Then re-test symbolic link scenario
3. May be same root cause as other empty files

**Severity:** MEDIUM - Unlikely real-world scenario but tests file system edge case

---

## Low Priority Issues (9)

These are expected limitations, edge cases, or behavioral quirks that don't represent bugs.

### 1. LOW: Mint Token with Zero Amount
**Test Name:** CORNER-012 (Line 456)

**Root Cause Analysis:**
Creating fungible token with zero amount produces empty file.

**Business Logic:** Zero-amount coins may be considered invalid - CLI correctly rejects this, but should return error code instead of creating empty file.

**Status:** Related to HIGH priority issue #5 (empty file output)

---

### 2. LOW: Coin Amount Exceeds MAX_SAFE_INTEGER
**Test Name:** CORNER-014 (Line 463)

**Root Cause Analysis:**
JavaScript Number.MAX_SAFE_INTEGER (2^53 - 1) overflow handling.

**Technical Details:**
- Number.MAX_SAFE_INTEGER = 9007199254740991
- Test likely tries amount larger than this
- JavaScript cannot safely represent larger integers
- CLI correctly handles by truncating/failing, but file is empty

**Status:** Edge case - related to HIGH priority issue #5

---

### 3. LOW: Odd-Length Hex String
**Test Name:** CORNER-015 (Line 469)

**Root Cause Analysis:**
Hex string with odd number of characters (not byte-aligned).

**Technical Details:**
- Hex encoding requires pairs of characters for bytes
- "abc" is invalid, "abcd" is valid
- SDK likely rejects this during parsing
- But file is empty instead of error

**Status:** Related to HIGH priority issue #5

---

### 4. LOW: Invalid Hex Characters
**Test Name:** CORNER-017 (Line 476)

**Root Cause Analysis:**
Hex string contains characters G-Z (not valid hex 0-F).

**Example:** "GGHHIIJJ" - all invalid hex
- Should be rejected with clear error
- But creates empty file instead

**Status:** Related to HIGH priority issue #5

---

### 5. LOW: Empty Token Data
**Test Name:** CORNER-018 (Line 482)

**Root Cause Analysis:**
Minting NFT with explicitly empty data.

**Technical Details:**
- Empty string vs. null vs. undefined handling
- May be valid (empty metadata) or invalid (requires description)
- Current behavior: empty file
- Should either accept empty data or return clear error

**Status:** Related to HIGH priority issue #5

---

### 6. LOW: Very Long File Path
**Test Name:** CORNER-021 (Line 507) - PASSED

This test passed! No issue here.

---

### 7. LOW: Argument List Too Long for Large Inputs
**Test Names:**
- CORNER-010 (Line 447)
- CORNER-010b (Line 451)

**Status:** Already covered in MEDIUM priority (OS limitations)

---

### 8. LOW: Network Timeout Test
**Test Name:** CORNER-031 (Line 574)

**Root Cause:** Missing `assert_true` function (HIGH priority issue)

---

### 9. LOW: Aggregator Unavailable Network Test
**Test Name:** CORNER-026 (Line 524)

**Root Cause:** Multiple issues:
1. Short secret validation fails first
2. Command doesn't reach network code
3. Missing proper error message

**Status:** Related to HIGH priority issues #2 and #4

---

## Recommended Fix Order

### Phase 1: Critical Infrastructure (Enable Core Testing)
1. **Fix `assert_valid_json` function** (CRITICAL #1)
   - Check function signature and parameter passing
   - Ensure tests save output to files before assertion
   - Impact: Enables aggregator integration tests

2. **Fix `receive_token` output file creation** (CRITICAL #2)
   - Debug receive-token command output handling
   - Verify --save flag and file naming
   - Impact: Enables token receiving functionality testing

3. **Add `assert_true` function** (CRITICAL #3)
   - Simple implementation for condition testing
   - Impact: Enables network timeout tests

**Estimated time:** 1-2 hours
**Tests unlocked:** ~10 tests

---

### Phase 2: Command Input Validation (Fix False Failures)
4. **Fix empty file output on invalid inputs** (HIGH #5)
   - Move validation before file creation
   - Ensure error codes are set properly
   - Impact: Cleans up 6 test failures

5. **Update network edge case test secrets** (HIGH #2)
   - Replace short test secrets with 8+ char versions
   - Impact: Enables 4 network error handling tests

6. **Fix file path arguments** (HIGH #3)
   - Correct flag ordering in test calls
   - Verify command argument parsing
   - Impact: Fixes 2 test failures

7. **Fix unbound variable `stderr_output`** (HIGH #1)
   - Identify correct variable name in context
   - Update all references
   - Impact: Fixes assertion errors

**Estimated time:** 1-2 hours
**Tests unlocked:** ~15 tests

---

### Phase 3: Edge Cases and Documentation (Lowest Priority)
8. **Verify symbolic link handling** (LOW #5)
   - Should work after Phase 2 fixes
   - May need additional investigation
   - Impact: 1 edge case test

9. **Document expected limitations** (MEDIUM skipped tests)
   - Create mapping of skipped tests to known limitations
   - Update test suite documentation
   - Impact: Better test report clarity

**Estimated time:** 30 minutes
**Tests status:** No new passes, improved documentation

---

## Key Findings

### What's Actually Broken
1. **Test assertion helpers** - `assert_valid_json`, `assert_true` have issues
2. **Output file handling** - Commands create empty files on errors instead of failing cleanly
3. **receive-token output** - Files aren't being saved despite success indication

### What's Just Poorly Tested
1. Network error scenarios - short test secrets prevent reaching network code
2. Edge cases - file path handling, symbolic links, large inputs
3. Boundary conditions - zero amounts, invalid hex, odd-length strings

### What's Working Well
- 205/242 tests passing (84.7%)
- Core functionality (mint, send, verify) fully functional
- Security tests passing (auth, integrity, crypto)
- Integration tests mostly passing
- Exit codes and error handling mostly correct

### Action Items for CLI Team
1. **High-urgency:** Fix #CRITICAL issues (output handling, receive-token)
2. **Medium-urgency:** Add missing test helpers, update test data
3. **Low-urgency:** Handle edge cases with better error messages

