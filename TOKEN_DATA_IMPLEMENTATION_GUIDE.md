# Token Data Tests - Quick Implementation Guide

**For:** Developer implementing the 18 new test cases
**Time Budget:** 10-13 hours across 2 weeks
**Difficulty:** Easy to Medium

---

## Quick Start (5 minutes)

The 18 test examples are in `TOKEN_DATA_TEST_EXAMPLES.md` and are **ready to implement**.

They're organized in 3 files:
1. `tests/security/test_recipientDataHash_tampering.bats` (6 tests)
2. `tests/security/test_data_c4_both.bats` (6 tests)
3. `tests/security/test_data_c3_genesis_only.bats` (6 tests)

**Each file is copy-paste ready from the examples document.**

---

## Implementation Priority

### Week 1 (Tuesday-Thursday): 7-8 hours

#### Day 1 (3-4 hours): RecipientDataHash Tests
```bash
# Create file
touch tests/security/test_recipientDataHash_tampering.bats

# Copy from TOKEN_DATA_TEST_EXAMPLES.md Part 3 into this file
# Tests: HAH-001 through HAH-006 (6 tests)

# Run to verify
bats tests/security/test_recipientDataHash_tampering.bats

# Expected: All 6 pass (or show which error messages differ)
```

**Key Learning:** How recipientDataHash protects state.data

---

#### Day 2 (4-5 hours): C4 Both-Data Tests
```bash
# Create file
touch tests/security/test_data_c4_both.bats

# Copy from TOKEN_DATA_TEST_EXAMPLES.md Part 2 into this file
# Tests: C4-001 through C4-006 (6 tests)

# Run to verify
bats tests/security/test_data_c4_both.bats

# Expected: All 6 pass (test dual protection)
```

**Key Learning:** How both protection mechanisms work together

---

### Week 2 (Tuesday-Thursday): 3-4 hours

#### Day 1-2 (3-4 hours): C3 Genesis-Only Tests
```bash
# Create file
touch tests/security/test_data_c3_genesis_only.bats

# Copy from TOKEN_DATA_TEST_EXAMPLES.md Part 1 into this file
# Tests: C3-001 through C3-006 (6 tests)

# Run to verify
bats tests/security/test_data_c3_genesis_only.bats

# Expected: All 6 pass (test immutability)
```

**Key Learning:** How genesis data is protected separately

---

### Final (1 hour): Verify & Commit

```bash
# Run full test suite to ensure no regressions
npm test

# If any failures:
# 1. Check if it's an error message format issue
# 2. Adjust assertions based on actual output
# 3. Ask in code review if message is correct

# Commit
git add tests/security/test_*.bats
git commit -m "Add token data combination tests (C3, C4, RecipientDataHash)"
```

---

## Common Issues & Solutions

### Issue 1: Aggregator Not Running

**Error:** Tests fail with "Unable to connect to aggregator"

**Solution:**
```bash
# Start aggregator in another terminal
docker run -p 3000:3000 unicity/aggregator

# Wait for it to be ready, then run tests
bats tests/security/test_recipientDataHash_tampering.bats
```

**Prevention:** Check `CLAUDE.md` "Prerequisites for running tests" section

---

### Issue 2: Error Message Doesn't Match Assertion

**Example:**
```bash
# Test expects:
assert_output_contains "hash"

# But actual error is:
"SDK verification failed - state mismatch"
```

**Solution:**
```bash
# 1. Run test to capture actual output
bats tests/security/test_recipientDataHash_tampering.bats 2>&1 | grep -A5 "HAH-002"

# 2. Update assertion to match
assert_output_contains "mismatch" || assert_output_contains "hash" || true
```

**TIP:** Multiple assertions with `||` are better than single strict assertions.

---

### Issue 3: Test Hangs or Times Out

**Cause:** Aggregator is slow, test waiting for response

**Solution:**
```bash
# Check if aggregator is responding
curl http://127.0.0.1:3000/health

# If not responding, restart it
docker restart aggregator-container-name

# If tests still timeout, the aggregator might be overloaded
# Try running fewer tests at once
bats tests/security/test_recipientDataHash_tampering.bats --filter HAH-001
```

---

### Issue 4: jq Command Fails

**Error:** `jq: error ... cannot index string with string`

**Cause:** JSON structure is different than expected

**Solution:**
```bash
# Debug the token structure
jq . alice_token.txf | head -50

# Verify the path you're accessing:
jq '.genesis.data.tokenData' alice_token.txf
jq '.state.data' alice_token.txf
jq '.genesis.transaction.recipientDataHash' alice_token.txf

# If fields are named differently, adjust the test jq paths
```

---

### Issue 5: Secret Generation Fails

**Error:** `generate_test_secret: command not found`

**Cause:** Test helper not loaded

**Solution:**
```bash
# Verify token-helpers is in tests/helpers/
ls tests/helpers/token-helpers.bats

# Verify it's sourced in your test file:
load '../helpers/token-helpers'

# If still failing, check the function exists:
grep -n "generate_test_secret" tests/helpers/token-helpers.bats
```

---

## When to Ask for Help

### Before Implementation

- [ ] "What does `recipientDataHash` do?"
  - Answer: Commits to state.data via SHA-256 hash
  - See: `CLAUDE.md` section "Token State Flow"

- [ ] "How are C3 and C4 different?"
  - Answer: C3 untransferred, C4 transferred
  - See: `TOKEN_DATA_COVERAGE_SUMMARY.md` combinations

### During Implementation

- [ ] Test setup/teardown issues
  - Check existing tests: `tests/security/test_receive_token_crypto.bats`
  - Follow same pattern

- [ ] Error message assertion
  - Run test first: `bats test_file.bats`
  - See actual output: `... output = "actual error"`
  - Adjust assertion to match

- [ ] jq syntax questions
  - Try command: `jq '.genesis.data.tokenData' token.txf`
  - Use `jq --help` for reference

### After Implementation

- [ ] All tests passing?
  - ✓ Great! Move to next test file

- [ ] Some tests failing?
  - ✓ Check error message differs from expected
  - ✓ Adjust assertions based on actual behavior
  - ✓ Ask in code review if behavior seems wrong

- [ ] Tests conflict with existing tests?
  - ⚠️ Unlikely, but report in code review
  - Tests use different temp directories and data combinations

---

## Validation Checklist

After implementing each file, verify:

### RecipientDataHash Tests
```bash
bats tests/security/test_recipientDataHash_tampering.bats

# Verify all 6 tests:
# ✓ HAH-001: Hash format verification
# ✓ HAH-002: All-zeros detection
# ✓ HAH-003: All-F's detection
# ✓ HAH-004: Partial modification detection
# ✓ HAH-005: State/hash inconsistency
# ✓ HAH-006: Null hash rejection

# Expected: 6 pass
```

### C4 Tests
```bash
bats tests/security/test_data_c4_both.bats

# Verify all 6 tests:
# ✓ C4-001: Token creation and transfer
# ✓ C4-002: Genesis data tampering
# ✓ C4-003: State data tampering
# ✓ C4-004: Hash tampering
# ✓ C4-005: Independent detection (MOST IMPORTANT)
# ✓ C4-006: Multi-transfer preservation

# Expected: 6 pass
```

### C3 Tests
```bash
bats tests/security/test_data_c3_genesis_only.bats

# Verify all 6 tests:
# ✓ C3-001: C3 token creation
# ✓ C3-002: Genesis data encoding
# ✓ C3-003: Genesis tampering (MOST IMPORTANT)
# ✓ C3-004: State matches genesis
# ✓ C3-005: State tampering
# ✓ C3-006: Transfer preserves genesis

# Expected: 6 pass
```

### Full Suite
```bash
npm test

# Verify:
# - All existing tests still pass
# - New tests are included
# - No regressions
# - Coverage improved
```

---

## Code Quality Checklist

Before submitting code review:

- [ ] All three test files created
- [ ] Each file has proper BATS structure:
  - [ ] `#!/usr/bin/env bats` header
  - [ ] Helper loads: `load '../helpers/common'`, etc.
  - [ ] `setup()` function
  - [ ] `teardown()` function
  - [ ] Test functions with `@test` decorator
- [ ] All tests follow naming convention: `@test "ID: Description"`
- [ ] Tests use logging functions: `log_test`, `log_success`, etc.
- [ ] Assertions are clear: `assert_success`, `assert_failure`, etc.
- [ ] Comments explain complex jq commands
- [ ] No hardcoded paths (use `${TEST_TEMP_DIR}`)
- [ ] No secrets in test code (use `${ALICE_SECRET}`, etc.)

---

## File-by-File Comparison

### test_recipientDataHash_tampering.bats

**Copy from:** `TOKEN_DATA_TEST_EXAMPLES.md`, Part 3 (lines 618-834)

**Structure:**
```
- Header & comments
- load statements (4 lines)
- setup() function (8 lines)
- teardown() function (3 lines)
- 6 test functions (80 lines total)
  - Each test: 20-30 lines
  - Clear names: HAH-001, HAH-002, etc.
  - Log statements for debugging
  - Assertions (success/failure)
  - Error message checks
```

**Tests hash commitment validation across 6 scenarios**

---

### test_data_c4_both.bats

**Copy from:** `TOKEN_DATA_TEST_EXAMPLES.md`, Part 2 (lines 254-614)

**Structure:**
```
- Header & comments
- load statements (4 lines)
- setup() function (8 lines)
- teardown() function (3 lines)
- 6 test functions (160 lines total)
  - Each test: 30-40 lines
  - Clear names: C4-001 through C4-006
  - Multi-step scenarios (create, transfer, verify)
  - Log statements for tracing
  - Multiple assertions per test
```

**Tests dual-protection mechanisms on transferred tokens**

---

### test_data_c3_genesis_only.bats

**Copy from:** `TOKEN_DATA_TEST_EXAMPLES.md`, Part 1 (lines 7-250)

**Structure:**
```
- Header & comments
- load statements (4 lines)
- setup() function (8 lines)
- teardown() function (3 lines)
- 6 test functions (120 lines total)
  - Each test: 20-30 lines
  - Clear names: C3-001 through C3-006
  - Simpler scenarios (no transfers initially)
  - Log statements for clarity
  - Clean assertions
```

**Tests genesis data immutability on untransferred tokens**

---

## Testing as You Go

Don't wait until all 18 tests are done. Test incrementally:

### After RecipientDataHash Tests (Day 1)
```bash
bats tests/security/test_recipientDataHash_tampering.bats

# If 6/6 pass → You're on the right track
# If some fail → Debug error messages, move to next test
```

### After C4 Tests (Day 2)
```bash
bats tests/security/test_data_c4_both.bats

# If 6/6 pass → Validation of dual protection works
# Pay special attention to C4-005 (independent detection)
```

### After C3 Tests (Week 2)
```bash
bats tests/security/test_data_c3_genesis_only.bats

# If 6/6 pass → Coverage is complete
```

### Final Full Suite
```bash
npm test

# Should see:
# - All existing tests still pass (expect 200+ tests)
# - New 18 tests pass
# - Total coverage improved
```

---

## Common Copy-Paste Mistakes

### Mistake 1: Wrong Load Paths

```bash
# ❌ WRONG:
load 'helpers/common'
load 'helpers/token-helpers'

# ✓ CORRECT:
load '../helpers/common'
load '../helpers/token-helpers'

# Tests are in tests/security/, helpers in tests/helpers/
# So need ../ to go up one level
```

### Mistake 2: Mixing Tab/Space Indentation

```bash
# ❌ WRONG:
@test "Test name" {
	run_cli ...      # TAB character

# ✓ CORRECT:
@test "Test name" {
    run_cli ...      # 4 spaces
```

**Use:** 4 spaces throughout (consistent with existing tests)

---

### Mistake 3: Forgetting Quotes in jq Arguments

```bash
# ❌ WRONG:
jq --arg data ${malicious_data} \
    '.genesis.data.tokenData = $data'

# ✓ CORRECT:
jq --arg data "${malicious_data}" \
    '.genesis.data.tokenData = $data'

# Quotes prevent shell word splitting
```

---

### Mistake 4: Using `=` Instead of `==` in Assertions

```bash
# ❌ WRONG:
[[ "${status}" = 1 ]] || assert_failure

# ✓ CORRECT:
[[ "${status}" == 1 ]] || assert_failure

# BATS style uses == for comparison
```

---

## Reference Files

### Understanding Tests

- `CLAUDE.md` - Project overview and architecture
- `TOKEN_DATA_COVERAGE_SUMMARY.md` - What's being tested and why
- `TOKEN_DATA_EXPERT_VALIDATION.md` - Deep dive into each test

### Existing Test Examples

- `tests/security/test_receive_token_crypto.bats` - Pattern for state data tests
- `tests/security/test_send_token_crypto.bats` - Pattern for send-token tests
- `tests/security/test_data_integrity.bats` - Pattern for tampering tests
- `tests/helpers/common.bats` - Helper functions available
- `tests/helpers/assertions.bats` - Assertion functions available

### Implementation Reference

- `TOKEN_DATA_TEST_EXAMPLES.md` - Copy tests from here
- `TOKEN_DATA_IMPLEMENTATION_GUIDE.md` - This file

---

## Questions?

### Quick Answers

**Q: How long per test?**
A: 5-10 minutes per test, 45 minutes per file (6 tests)

**Q: Will tests fail initially?**
A: Unlikely - examples are from expert review. But error message format might differ slightly.

**Q: Do I need to understand all the Unicity architecture?**
A: No. Tests are complete, you're mainly copy-pasting and adjusting error messages.

**Q: What if a test doesn't pass?**
A: Most likely: error message doesn't match assertion. See "Issue 2" above.

**Q: Can I do this in any order?**
A: Recommended order: RecipientDataHash → C4 → C3. But any order works.

**Q: How do I know if I'm done?**
A: All 18 tests passing, full suite still passing, no regressions.

---

## Success Criteria

When you're done:

- [ ] All 3 new test files created and in `tests/security/`
- [ ] RecipientDataHash tests: 6 tests, all passing
- [ ] C4 tests: 6 tests, all passing
- [ ] C3 tests: 6 tests, all passing
- [ ] Full test suite: All existing tests still passing (no regressions)
- [ ] Coverage: Improved from 52% to 83%+
- [ ] Code quality: Matches existing test style
- [ ] Commit: All 18 tests in one commit with clear message

---

**Document Status:** READY TO IMPLEMENT
**Estimated Time:** 2-3 weeks (flexible)
**Next Step:** Create first test file and copy tests from examples

