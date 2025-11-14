# Test Failures Organized by Source File

## Test Helper Files

### `tests/helpers/assertions.bash`
**Line 1969:** `assert_valid_json` function
- **Problem:** Function receives JSON content string instead of filename
- **Affected Tests:** AGGREGATOR-001, AGGREGATOR-010
- **Error Message:** "Assertion Failed: File does not exist"
- **Fix:** Verify function signature and how tests pass arguments

**Line 126:** Assertion with unbound variable
- **Problem:** `stderr_output` variable not defined in scope
- **Affected Tests:** CORNER-032
- **Error Message:** `stderr_output: unbound variable`
- **Fix:** Check variable naming consistency with `run_cli` helper

**Missing:** `assert_true` function
- **Problem:** Function not defined anywhere
- **Affected Tests:** CORNER-027, CORNER-031
- **Error Message:** `assert_true: command not found`
- **Fix:** Add function implementation:
```bash
assert_true() {
  local condition="$1"
  local message="${2:-Assertion failed}"
  if eval "$condition"; then
    return 0
  else
    return 1
  fi
}
```

---

### `tests/helpers/token-helpers.bash`
**Line 449:** `receive_token` helper function
- **Problem:** Command exits 0 but output file is not created
- **Affected Tests:** INTEGRATION-007, INTEGRATION-009
- **Error Message:** `[ERROR] Receive succeeded but output file not created: <filename>`
- **Root Cause:** receive-token command not properly saving output
- **Fix:** Debug output file handling in receive-token.ts

---

## Command Source Files

### `src/commands/receive-token.ts`
**Problem:** Output file not being created despite successful execution
- **Affected Tests:** INTEGRATION-007 (error at line 233), INTEGRATION-009 (error at line 262)
- **Symptoms:**
  - Token validation succeeds
  - Output shows "Successfully received token"
  - But no file written
  - Helper detects: "Receive succeeded but output file not created"
- **Investigation Steps:**
  1. Check `--save` flag handling
  2. Check `-o` / `--output` option processing
  3. Verify file write operations happen
  4. Check if file path is correct
  5. Look for early returns before file write
- **Tests Show:** File operations appear to succeed but files don't exist

---

### `src/commands/mint-token.ts`
**Problem:** Empty files created instead of error returns for invalid inputs
- **Affected Tests:**
  - CORNER-012: Zero amount fungible token
  - CORNER-014: Coin amount > MAX_SAFE_INTEGER
  - CORNER-015: Odd-length hex string
  - CORNER-017: Invalid hex characters
  - CORNER-018: Empty token data
- **Error Pattern:** `Assertion Failed: File is empty`
- **Root Cause:** Output file is opened/created before input validation completes
- **Fix:** Move all validation BEFORE file creation
  1. Validate secret length
  2. Validate token type format
  3. Validate coin amount (if fungible)
  4. Validate data (if provided)
  5. Validate hex strings (if used)
  6. THEN create output file and write token
- **Code Location:** Likely around file write operations (fs.writeFileSync)

---

### `src/commands/send-token.ts`
**Problem:** Empty files created instead of error returns for invalid inputs
- **Affected Tests:** CORNER-025 (symbolic link scenario)
- **Error Pattern:** `Assertion Failed: File is empty`
- **Same Fix as mint-token.ts:** Validate before file creation

---

## Test Suite Files

### `tests/edge-cases/test_network_edge.bats`
**Problem Group 1: Short secrets prevent reaching network code**
- **Affected Tests:** CORNER-026, 027, 030, 033
- **Lines:** 51, 90, 131, 154, 203
- **Error:** Commands fail with "Secret is too short" before reaching network layer
- **Root Cause:** CLI now enforces minimum 8-character secret length
- **Fix:** Update all secret values to 8+ characters
  - Replace: `SECRET="test"`
  - With: `SECRET="testnetwork123"`
- **Files Affected:**
  - Line 51: CORNER-026 setup
  - Line 90: CORNER-027 assertion
  - Line 131: CORNER-030 setup
  - Line 154: CORNER-031 assertion
  - Line 203: CORNER-033 setup

**Problem Group 2: Incorrect flag order**
- **Affected Tests:** CORNER-028, CORNER-032
- **Lines:** 109, 299
- **Error:** `--local` flag treated as file path
- **Current:** `verify-token --local <path>`
- **Correct:** `verify-token --local -f <path>` or `verify-token -f <path> --local`
- **Files to Fix:**
  - Line 109: Verify-token call with --local
  - Line 299: Another verify-token --local call

---

### `tests/functional/test_aggregator_operations.bats`
**Line 51:** AGGREGATOR-001 test
- **Problem:** `assert_valid_json` receiving output instead of filename
- **Error:** "Assertion Failed: File does not exist"
- **Fix:** Check how output is captured and passed to assertion

**Line 262:** AGGREGATOR-010 test
- **Problem:** Same as AGGREGATOR-001
- **Fix:** Check how output is captured and passed to assertion

---

### `tests/functional/test_integration.bats`
**Line 216:** INTEGRATION-005 test
- **Status:** INTENTIONALLY SKIPPED
- **Reason:** "Complex scenario - requires careful transaction management"
- **No action needed**

**Line 231:** INTEGRATION-006 test
- **Status:** INTENTIONALLY SKIPPED
- **Reason:** "Advanced scenario - may have network limitations"
- **No action needed**

**Line 270:** INTEGRATION-007 test
- **Problem:** `receive_token` helper fails to create output file
- **Error:** [ERROR] Receive succeeded but output file not created: dave-token.txf
- **Root Cause:** receive-token.ts not creating file
- **Fix:** Debug receive-token output handling

**Line 333:** INTEGRATION-009 test
- **Problem:** `receive_token` helper fails to create output file
- **Error:** [ERROR] Receive succeeded but output file not created: bob-token1.txf
- **Root Cause:** Same as INTEGRATION-007
- **Fix:** Same receive-token.ts debugging

---

### `tests/functional/test_verify_token.bats`
**Line 166:** VERIFY_TOKEN-007 test
- **Status:** INTENTIONALLY SKIPPED
- **Reason:** "Requires dual-device simulation or mock"
- **No action needed**

---

### `tests/security/test_access_control.bats`
**Line 235:** SEC-ACCESS-004 test
- **Status:** INTENTIONALLY SKIPPED
- **Reason:** "Trustbase authenticity validation not implemented (pending)"
- **No action needed**

---

### `tests/security/test_double_spend.bats`
**Line 124:** SEC-DBLSPEND-002 test
- **Status:** INTENTIONALLY SKIPPED
- **Reason:** "Concurrent execution test infrastructure needs investigation - background processes not capturing exit codes correctly"
- **No action needed** (would require background process infrastructure work)

---

### `tests/security/test_input_validation.bats`
**Line 351:** SEC-INPUT-006 test
- **Status:** INTENTIONALLY SKIPPED
- **Reason:** "Input size limits are not a security priority per requirements"
- **No action needed**

---

### `tests/edge-cases/test_concurrency.bats`
**Line 348:** RACE-006 test
- **Problem:** Assertion counting logic fails during sequential receive attempts
- **Error:** `[[ $status1 -eq 0 ]] && ((success_count++))' failed`
- **Root Cause:** Bash test logic issue or variable assignment problem
- **Fix:** Review test implementation
  1. Verify `$status1` is properly assigned
  2. Check arithmetic syntax: `((success_count++))`
  3. May need to initialize `success_count=0` first
  4. Verify `$status1` contains valid exit code

---

### `tests/edge-cases/test_data_boundaries.bats`
**Line 145:** CORNER-010 test (10MB secret)
- **Status:** Expected failure - OS limitation
- **Error:** `/usr/bin/timeout: Argument list too long`
- **Root Cause:** Bash ARG_MAX limit (~128KB) exceeded
- **Action:** Document as known limitation or use file-based secret input

**Line 169:** CORNER-010b test (1MB token data)
- **Status:** Expected failure - OS limitation
- **Error:** `/usr/bin/timeout: Argument list too long`
- **Root Cause:** Same as CORNER-010
- **Action:** Document as known limitation

**Line 236:** CORNER-012 test (zero amount)
- **Problem:** Empty file created instead of error
- **Related to:** mint-token.ts validation issue (see above)

**Line 312:** CORNER-014 test (large amount)
- **Problem:** Empty file created instead of error
- **Related to:** mint-token.ts validation issue

**Line 350:** CORNER-015 test (odd hex length)
- **Problem:** Empty file created instead of error
- **Related to:** mint-token.ts validation issue

**Line 430:** CORNER-017 test (invalid hex)
- **Problem:** Empty file created instead of error
- **Related to:** mint-token.ts validation issue

**Line 466:** CORNER-018 test (empty data)
- **Problem:** Empty file created instead of error
- **Related to:** mint-token.ts validation issue

---

### `tests/edge-cases/test_file_system.bats`
**Line 189:** CORNER-023 test
- **Status:** INTENTIONALLY SKIPPED
- **Reason:** "Disk full simulation requires root privileges or special setup"
- **No action needed**

**Line 290:** CORNER-025 test (symlink scenario)
- **Problem:** Empty file created when sending through symlink
- **Error:** `Assertion Failed: File is empty`
- **Related to:** send-token.ts validation issue
- **Will be fixed by:** send-token.ts fix for empty file output

---

### `tests/edge-cases/test_double_spend_advanced.bats`
**Line 564:** DBLSPEND-020 test
- **Status:** INTENTIONALLY SKIPPED
- **Reason:** "Network partition simulation requires infrastructure setup"
- **No action needed**

---

## Summary Table

| File Type | File Name | Critical | High | Medium | Low | Status |
|-----------|-----------|----------|------|--------|-----|--------|
| Test Helper | assertions.bash | 1 | 1 | 0 | 0 | Needs fixes |
| Test Helper | token-helpers.bash | 1 | 0 | 0 | 0 | Debugging needed |
| Command | receive-token.ts | 1 | 0 | 0 | 0 | Debugging needed |
| Command | mint-token.ts | 0 | 1 | 0 | 5 | Input validation needed |
| Command | send-token.ts | 0 | 1 | 0 | 1 | Input validation needed |
| Test Suite | test_network_edge.bats | 0 | 2 | 0 | 4 | Test data & setup fixes |
| Test Suite | test_aggregator_operations.bats | 0 | 0 | 2 | 0 | Assertion output handling |
| Test Suite | test_integration.bats | 0 | 0 | 2 | 0 | Dependent on receive-token.ts |
| Test Suite | test_concurrency.bats | 0 | 0 | 1 | 0 | Test logic review |
| Test Suite | test_data_boundaries.bats | 0 | 0 | 0 | 7 | Related to input validation |
| Test Suite | test_file_system.bats | 0 | 0 | 0 | 1 | Related to send-token.ts |
| **TOTAL** | | **3** | **5** | **5** | **18** | |

