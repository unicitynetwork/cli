# Test Failure Analysis - Implementation Checklist

Use this checklist to track progress on fixing test failures.

---

## Phase 1: Critical Fixes (1-1.5 hours)

Target: Fix 3 critical test infrastructure issues blocking ~10 tests

### 1. Add `assert_true` Function
**Status:** PENDING
**Time Estimate:** 15 minutes

- [ ] Open `/home/vrogojin/cli/tests/helpers/assertions.bash`
- [ ] Add `assert_true()` function (see FAILURE_ANALYSIS_REPORT.md for implementation)
- [ ] Test with: `bats --filter "CORNER-027" tests/edge-cases/test_network_edge.bats`
- [ ] Test with: `bats --filter "CORNER-031" tests/edge-cases/test_network_edge.bats`
- [ ] Confirm both tests run (may still fail for other reasons)

**Evidence of Success:**
- Function is defined and callable
- CORNER-027 and CORNER-031 no longer report "command not found"

---

### 2. Fix `assert_valid_json` Function
**Status:** PENDING
**Time Estimate:** 30 minutes

- [ ] Open `/home/vrogojin/cli/tests/helpers/assertions.bash` at line 1969
- [ ] Analyze current function signature and parameter handling
- [ ] Identify why tests are passing JSON content string instead of filename
- [ ] Check how tests call this function (may be caller issue)
- [ ] Test with: `bats --filter "AGGREGATOR-001" tests/functional/test_aggregator_operations.bats`
- [ ] Test with: `bats --filter "AGGREGATOR-010" tests/functional/test_aggregator_operations.bats`

**Investigation Steps:**
1. Read the function to understand what it expects
2. Check test_aggregator_operations.bats line 51 and 262 to see how it's called
3. Determine if issue is in function or in test calling it
4. May need to capture output to file before passing to assertion

**Evidence of Success:**
- AGGREGATOR-001 passes
- AGGREGATOR-010 passes
- JSON validation actually validates token structure

---

### 3. Debug `receive_token` Output File Creation
**Status:** PENDING
**Time Estimate:** 45 minutes (debugging time may vary)

- [ ] Run failing test to reproduce issue: `bats --filter "INTEGRATION-007" tests/functional/test_integration.bats`
- [ ] Capture output showing: "Receive succeeded but output file not created"
- [ ] Open `/home/vrogojin/cli/src/commands/receive-token.ts`
- [ ] Add debug logging to trace execution:
  - [ ] Log when output file is about to be created
  - [ ] Log the filename being used
  - [ ] Log after file write completion
  - [ ] Log any errors during file write
- [ ] Re-run test with debug output enabled
- [ ] Identify where file creation is failing
- [ ] Check for:
  - [ ] Early returns before file write
  - [ ] File path issues (wrong directory or name)
  - [ ] Permission issues on output directory
  - [ ] File handle not being closed properly
- [ ] Test fix with: `bats --filter "INTEGRATION-007" tests/functional/test_integration.bats`
- [ ] Test fix with: `bats --filter "INTEGRATION-009" tests/functional/test_integration.bats`

**Evidence of Success:**
- INTEGRATION-007 passes
- INTEGRATION-009 passes
- Output files are created with correct content

---

## Phase 2: High Priority Fixes (1.5-2 hours)

Target: Fix 5 high-priority issues blocking ~15 tests

### 4. Fix Empty File Output on Invalid Input
**Status:** PENDING
**Time Estimate:** 60 minutes

- [ ] Identify which validation failures create empty files:
  - [ ] CORNER-012: Zero amount fungible token
  - [ ] CORNER-014: Coin amount > MAX_SAFE_INTEGER
  - [ ] CORNER-015: Odd-length hex string
  - [ ] CORNER-017: Invalid hex characters
  - [ ] CORNER-018: Empty token data
  - [ ] CORNER-025: Symbolic link scenario

- [ ] Open `/home/vrogojin/cli/src/commands/mint-token.ts`
- [ ] Find all validation code and file creation code
- [ ] Reorganize so that:
  - [ ] Step 1: Validate all inputs (secret, token type, amounts, hex, etc.)
  - [ ] Step 2: Create output file only after all validation passes
  - [ ] Step 3: Write token to file
  - [ ] Step 4: Return success
- [ ] Do same for `/home/vrogojin/cli/src/commands/send-token.ts`

- [ ] Test each scenario:
  - [ ] `bats --filter "CORNER-012" tests/edge-cases/test_data_boundaries.bats`
  - [ ] `bats --filter "CORNER-014" tests/edge-cases/test_data_boundaries.bats`
  - [ ] `bats --filter "CORNER-015" tests/edge-cases/test_data_boundaries.bats`
  - [ ] `bats --filter "CORNER-017" tests/edge-cases/test_data_boundaries.bats`
  - [ ] `bats --filter "CORNER-018" tests/edge-cases/test_data_boundaries.bats`
  - [ ] `bats --filter "CORNER-025" tests/edge-cases/test_file_system.bats`

**Evidence of Success:**
- Invalid input tests either:
  - [ ] Return proper error codes (non-zero)
  - [ ] Show error messages
  - [ ] Do NOT create empty output files
- Valid input still creates proper tokens

---

### 5. Update Network Edge Case Test Data
**Status:** PENDING
**Time Estimate:** 20 minutes

- [ ] Open `/home/vrogojin/cli/tests/edge-cases/test_network_edge.bats`
- [ ] Find all uses of `SECRET="test"` or similar short secrets
- [ ] Replace with 8+ character secrets:
  - [ ] Replace: `SECRET="test"`
  - [ ] With: `SECRET="testnetwork123"`
  - [ ] Or similar 8+ char test values
- [ ] Look for these line numbers based on test list:
  - [ ] Line ~51 (CORNER-026)
  - [ ] Line ~90 (CORNER-027)
  - [ ] Line ~131 (CORNER-030)
  - [ ] Line ~154 (CORNER-031)
  - [ ] Line ~203 (CORNER-033)

- [ ] Test results:
  - [ ] `bats --filter "CORNER-026" tests/edge-cases/test_network_edge.bats`
  - [ ] `bats --filter "CORNER-027" tests/edge-cases/test_network_edge.bats`
  - [ ] `bats --filter "CORNER-030" tests/edge-cases/test_network_edge.bats`
  - [ ] `bats --filter "CORNER-033" tests/edge-cases/test_network_edge.bats`

**Evidence of Success:**
- Tests no longer fail with "Secret is too short"
- Tests reach network code and test actual network error handling

---

### 6. Fix File Path Argument Confusion
**Status:** PENDING
**Time Estimate:** 15 minutes

- [ ] Open `/home/vrogojin/cli/tests/edge-cases/test_network_edge.bats`
- [ ] Find calls to `verify-token --local`
- [ ] Look for lines around:
  - [ ] Line ~109 (CORNER-028)
  - [ ] Line ~299 (CORNER-032)
- [ ] Change from:
  - [ ] `verify-token --local <path>` or
  - [ ] `verify-token --local <file>`
- [ ] To one of:
  - [ ] `verify-token --local -f <path>`
  - [ ] `verify-token -f <path> --local`
- [ ] Verify with command help: `npm run verify-token -- --help`

- [ ] Test results:
  - [ ] `bats --filter "CORNER-028" tests/edge-cases/test_network_edge.bats`
  - [ ] `bats --filter "CORNER-032" tests/edge-cases/test_network_edge.bats`

**Evidence of Success:**
- File paths no longer start with "--local"
- Tests can find and read the actual token files

---

### 7. Fix Variable Scoping in Assertions
**Status:** PENDING
**Time Estimate:** 15 minutes

- [ ] Open `/home/vrogojin/cli/tests/helpers/assertions.bash` at line 126
- [ ] Examine the assertion that uses unbound variable
- [ ] Identify what variable should be used:
  - [ ] Could be `$stdout` from output capture
  - [ ] Could be `$stderr` for error output
  - [ ] Could be related to `run_cli` helper output variables
- [ ] Check test helper documentation or `run_cli` implementation
- [ ] Fix variable reference throughout assertions.bash
- [ ] Check if same issue exists elsewhere in file

- [ ] Test result:
  - [ ] `bats --filter "CORNER-032" tests/edge-cases/test_network_edge.bats` (after other fixes)

**Evidence of Success:**
- No "unbound variable" errors
- Assertions can access stdout/stderr properly

---

## Phase 3: Medium Priority Fixes (30 minutes - 1 hour)

Target: Fix remaining edge case and documentation issues

### 8. Document Intentional Skips
**Status:** PENDING
**Time Estimate:** 20 minutes

These are NOT bugs - document them as known limitations:

- [ ] Create or update KNOWN_LIMITATIONS.md
- [ ] List the 6 intentionally skipped tests:
  - [ ] INTEGRATION-005: Complex multi-transfer (needs sequencing)
  - [ ] INTEGRATION-006: Advanced network scenario
  - [ ] VERIFY_TOKEN-007: Dual-device simulation
  - [ ] SEC-ACCESS-004: TrustBase validation (pending)
  - [ ] SEC-DBLSPEND-002: Concurrent background processes
  - [ ] SEC-INPUT-006: Large input (not priority)
  - [ ] DBLSPEND-020: Network partition simulation
  - [ ] CORNER-023: Disk full (needs root)
- [ ] For each: explain why it's skipped and what would be needed to enable

- [ ] Cross-reference test documentation

**Evidence of Success:**
- Limitation document clearly explains why tests are skipped
- Team understands these are not failures but infrastructure limitations

---

### 9. Verify Core Functionality Tests Still Pass
**Status:** PENDING
**Time Estimate:** 10 minutes

After all fixes, verify core tests still work:

- [ ] `npm run test:functional` - Should pass with minimal failures
- [ ] `npm run test:security` - All should pass
- [ ] `npm run test:quick` - Quick smoke tests should pass

**Evidence of Success:**
- All functional tests pass
- All security tests pass
- No regressions introduced

---

## Verification & Sign-Off

### Pre-Implementation
- [ ] Analyzed test log: `all-tests-20251114-140803.log`
- [ ] Identified 31 failing tests
- [ ] Categorized by severity (CRITICAL/HIGH/MEDIUM/LOW)
- [ ] Root cause analysis complete

### Phase 1 Sign-Off
- [ ] `assert_true` function added and working
- [ ] `assert_valid_json` fixed and passing AGGREGATOR tests
- [ ] `receive_token` output files being created
- [ ] **Phase 1 Status:** 215/242 tests passing (88.8%)
- [ ] **Verification:**
  ```bash
  npm test 2>&1 | grep "^not ok" | wc -l  # Should be ~26
  ```

### Phase 2 Sign-Off
- [ ] Empty file output issues resolved
- [ ] Network edge case tests running with proper data
- [ ] File path arguments corrected
- [ ] Variable scoping fixed
- [ ] **Phase 2 Status:** 230/242 tests passing (95%)
- [ ] **Verification:**
  ```bash
  npm test 2>&1 | grep "^not ok" | wc -l  # Should be ~12 (mostly skipped)
  ```

### Phase 3 Sign-Off
- [ ] Intentional skips documented
- [ ] All core functionality verified
- [ ] Error messages clear and helpful
- [ ] **Final Status:** 236/242 tests passing (97.5%)
- [ ] **Verification:**
  ```bash
  npm test  # Full run - should see mostly passes with intentional skips
  ```

---

## Testing Commands Reference

```bash
# Run specific test
bats --filter "TEST-NAME" tests/path/to/test.bats

# Run all tests
npm test

# Run functional tests only
npm run test:functional

# Run security tests only
npm run test:security

# Run quick smoke tests
npm run test:quick

# Run with debug output
UNICITY_TEST_DEBUG=1 npm run test:quick

# Count failures
npm test 2>&1 | grep "^not ok" | wc -l

# List all failures
npm test 2>&1 | grep "^not ok"

# Check for specific error
npm test 2>&1 | grep "assert_true"
```

---

## Common Issues & Solutions

### Issue: Test still failing after fix
**Solution:**
1. Check if other issues are blocking the test
2. Run with debug: `UNICITY_TEST_DEBUG=1 bats --filter "TEST-NAME" tests/...`
3. Check for dependent fixes needed first
4. Review error message carefully

### Issue: "Command not found" errors
**Solution:**
1. Rebuild CLI: `npm run build`
2. Ensure tests directory has executable permissions
3. Check shell interpreter: `#!/bin/bash` at top of test files

### Issue: File not found errors
**Solution:**
1. Verify working directory: `pwd` should be `/home/vrogojin/cli`
2. Check file paths are absolute, not relative
3. Ensure temporary directories exist and are writable

### Issue: Can't replicate issue locally
**Solution:**
1. Use exact command from test log
2. Run with same environment variables
3. Check if aggregator is running (if test uses it)
4. Check test output for timing issues (race conditions)

---

## Time Tracking

```
Phase 1 Estimated: 1-1.5 hours
Phase 1 Actual:    _____ hours (start: _____, end: _____)

Phase 2 Estimated: 1.5-2 hours
Phase 2 Actual:    _____ hours (start: _____, end: _____)

Phase 3 Estimated: 0.5-1 hour
Phase 3 Actual:    _____ hours (start: _____, end: _____)

Total Estimated:   3-4.5 hours
Total Actual:      _____ hours

Notes:
_________________________________________________________________
_________________________________________________________________
```

---

## Sign-Off

**Phase 1 Complete By:** _____________ (Date/Time)
**Phase 2 Complete By:** _____________ (Date/Time)
**Phase 3 Complete By:** _____________ (Date/Time)

**Implemented By:** _________________________________
**Reviewed By:** _________________________________
**Verified By:** _________________________________

---

## References

For detailed information, see:
- FAILURE_ANALYSIS_REPORT.md - Full root cause analysis
- FAILURE_ANALYSIS_BY_FILE.md - Issues by source file
- FAILURE_ANALYSIS_QUICK_REFERENCE.md - Quick lookup
- FAILURE_ANALYSIS_EXECUTIVE_SUMMARY.md - High-level overview
