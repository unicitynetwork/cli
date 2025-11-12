# Security Test Fixes - Implementation Checklist

**Date:** 2025-11-12
**Goal:** Fix all 6 failing security tests to achieve 100% pass rate
**Estimated Time:** 3-4 hours
**Current Status:** 45/51 passing (88.2%)

---

## Overview

This checklist guides you through fixing all 6 failing security tests. Follow each section in order for optimal efficiency.

**Legend:**
- [ ] = Not started
- [x] = Completed
- [~] = In progress

---

## CRITICAL ISSUES (Must Complete)

### Issue 1: Negative Coin Amounts Accepted
**Test:** SEC-INPUT-005
**Severity:** CRITICAL
**Location:** `src/commands/mint-token.ts` or amount validation utility
**Estimated Time:** 30 minutes

#### Task Checklist:

- [ ] **Step 1: Locate validation logic**
  - [ ] Find where coin amounts are processed
  - [ ] Check mint-token.ts command options parsing
  - [ ] Check send-token.ts for amount processing
  - [ ] Identify all amount input paths

- [ ] **Step 2: Add validation code**
  - [ ] Add check: `if (amount <= 0) throw Error("Amount must be positive")`
  - [ ] Test with negative inputs: `-1000000000000000000`
  - [ ] Test with zero: `0`
  - [ ] Test with positive: `1000` (should work)

- [ ] **Step 3: Test the fix**
  ```bash
  SECRET="test" bats tests/security/test_input_validation.bats -f "SEC-INPUT-005"
  # Expected: ok 5
  ```

- [ ] **Step 4: Verify no regression**
  ```bash
  # Make sure other tests still pass
  SECRET="test" bats tests/security/test_input_validation.bats
  ```

---

### Issue 2: Token File Modification Detection
**Test:** SEC-ACCESS-003
**Severity:** CRITICAL
**Location:** `src/commands/verify-token.ts`
**Estimated Time:** 1 hour

#### Task Checklist:

- [ ] **Step 1: Understand the test**
  - [ ] Read test in `tests/security/test_access_control.bats:160-180`
  - [ ] Understand: token gets modified, verify-token should reject it
  - [ ] Know what field gets modified: `genesis.data.tokenType`

- [ ] **Step 2: Add integrity verification**
  - [ ] Load token from file
  - [ ] Extract expected values from proofs
  - [ ] Compare with actual token values
  - [ ] If mismatch: throw error

- [ ] **Step 3: Implement verification**
  Location: In `verify-token.ts` after loading token
  ```typescript
  // Extract from proof
  const proofTokenId = token.genesis.data.tokenId;
  const proofTokenType = token.genesis.data.tokenType;

  // Extract from predicate
  const predicateTokenId = extractFromPredicate(token, 'tokenId');
  const predicateTokenType = extractFromPredicate(token, 'tokenType');

  // Verify consistency
  if (proofTokenId !== predicateTokenId) {
    throw new Error('Token ID mismatch - token may be corrupted');
  }
  if (proofTokenType !== predicateTokenType) {
    throw new Error('Token type mismatch - token may be corrupted');
  }
  ```

- [ ] **Step 4: Test the fix**
  ```bash
  SECRET="test" bats tests/security/test_access_control.bats -f "SEC-ACCESS-003"
  # Expected: ok 3
  ```

- [ ] **Step 5: Verify no regression**
  ```bash
  SECRET="test" bats tests/security/test_access_control.bats
  ```

---

### Issue 3: State Hash Mismatch Detection
**Test:** SEC-INTEGRITY-002
**Severity:** CRITICAL
**Location:** `src/commands/verify-token.ts`
**Estimated Time:** 1 hour

#### Task Checklist:

- [ ] **Step 1: Understand the test**
  - [ ] Read test in `tests/security/test_data_integrity.bats:130-145`
  - [ ] Understand: state hash in proof is corrupted, should be detected
  - [ ] Know what's modified: `genesis.inclusionProof.authenticator.stateHash`

- [ ] **Step 2: Add state hash validation**
  - [ ] Calculate state hash from token data
  - [ ] Compare with proof's stateHash
  - [ ] If mismatch: throw error

- [ ] **Step 3: Implement verification**
  Location: In `verify-token.ts` after loading token
  ```typescript
  // Calculate state hash from token data
  const tokenData = token.genesis.data;
  const calculatedStateHash = calculateStateHash(tokenData);

  // Get proof state hash
  const proofStateHash = token.genesis.inclusionProof.authenticator.stateHash;

  // Verify consistency
  if (calculatedStateHash !== proofStateHash) {
    throw new Error('State hash mismatch - token may be corrupted');
  }
  ```

- [ ] **Step 4: Test the fix**
  ```bash
  SECRET="test" bats tests/security/test_data_integrity.bats -f "SEC-INTEGRITY-002"
  # Expected: ok 2
  ```

- [ ] **Step 5: Verify no regression**
  ```bash
  SECRET="test" bats tests/security/test_data_integrity.bats
  ```

---

## HIGH PRIORITY ISSUES (Complete Before Major Release)

### Issue 4: Input Size Limits Missing
**Test:** SEC-INPUT-006
**Severity:** HIGH
**Location:** `src/commands/mint-token.ts` and other input handlers
**Estimated Time:** 30 minutes

#### Task Checklist:

- [ ] **Step 1: Define size limits**
  - [ ] Decide on maximum token data size (e.g., 10MB)
  - [ ] Decide on maximum address length
  - [ ] Document these limits

- [ ] **Step 2: Add validation code**
  - [ ] Add check before processing large inputs
  - [ ] Check: `if (tokenData.length > MAX_SIZE) throw Error(...)`
  - [ ] Test with: 1MB+ data, very long addresses

- [ ] **Step 3: Test the fix**
  ```bash
  SECRET="test" bats tests/security/test_input_validation.bats -f "SEC-INPUT-006"
  # Expected: ok 6
  ```

- [ ] **Step 4: Verify no regression**
  ```bash
  SECRET="test" bats tests/security/test_input_validation.bats
  ```

---

### Issue 5: Special Characters in Addresses
**Test:** SEC-INPUT-007
**Severity:** HIGH
**Location:** `tests/helpers/common.bash` (test infrastructure) AND address validation
**Estimated Time:** 1 hour

#### Task Checklist:

- [ ] **Step 1: Fix test helper syntax error**
  - [ ] Open `tests/helpers/common.bash`
  - [ ] Go to line 248-249
  - [ ] Find unclosed quote: `unexpected EOF while looking for matching ''`
  - [ ] Fix the shell syntax error

- [ ] **Step 2: Implement address validation**
  - [ ] Create address format validator function
  - [ ] Reject special characters: `;`, `|`, `&`, `$`, backtick, etc.
  - [ ] Test with valid addresses: should pass
  - [ ] Test with special chars: should fail

- [ ] **Step 3: Integrate validation**
  - [ ] Add validation in send-token, receive-token, etc.
  - [ ] Validate recipient addresses
  - [ ] Provide clear error messages

- [ ] **Step 4: Test the fix**
  ```bash
  SECRET="test" bats tests/security/test_input_validation.bats -f "SEC-INPUT-007"
  # Expected: ok 7
  ```

- [ ] **Step 5: Verify no regression**
  ```bash
  SECRET="test" bats tests/security/test_input_validation.bats
  ```

---

## MEDIUM PRIORITY (Before Next Sprint)

### Issue 6: Test Helper Shell Syntax Error
**Severity:** MEDIUM
**Location:** `tests/helpers/common.bash:248-249`
**Estimated Time:** 15 minutes

#### Task Checklist:

- [ ] **Step 1: Locate the error**
  - [ ] Open file: `tests/helpers/common.bash`
  - [ ] Find line 248-249 with unclosed quote
  - [ ] Review context around the error

- [ ] **Step 2: Fix the syntax**
  - [ ] Check matching quotes
  - [ ] Check escaped characters
  - [ ] Add missing closing quote if needed

- [ ] **Step 3: Verify fix**
  ```bash
  bash -n tests/helpers/common.bash
  # Should return no syntax errors
  ```

- [ ] **Step 4: Test related security test**
  ```bash
  SECRET="test" bats tests/security/test_input_validation.bats -f "SEC-INPUT-007"
  ```

---

## VERIFICATION & TESTING

### Full Test Cycle

- [ ] **Round 1: Individual test fixes**
  ```bash
  # Test each fix individually
  SECRET="test" bats tests/security/test_input_validation.bats -f "SEC-INPUT-005"
  SECRET="test" bats tests/security/test_access_control.bats -f "SEC-ACCESS-003"
  SECRET="test" bats tests/security/test_data_integrity.bats -f "SEC-INTEGRITY-002"
  SECRET="test" bats tests/security/test_input_validation.bats -f "SEC-INPUT-006"
  SECRET="test" bats tests/security/test_input_validation.bats -f "SEC-INPUT-007"
  ```

- [ ] **Round 2: Suite-level testing**
  ```bash
  SECRET="test" bats tests/security/test_access_control.bats
  SECRET="test" bats tests/security/test_input_validation.bats
  SECRET="test" bats tests/security/test_data_integrity.bats
  ```

- [ ] **Round 3: Full security test suite**
  ```bash
  SECRET="test" npm run test:security
  # Expected: 51 ok (100% pass rate)
  ```

- [ ] **Round 4: No regression in other suites**
  ```bash
  SECRET="test" bats tests/functional/test_*.bats
  SECRET="test" bats tests/edge-cases/test_*.bats
  ```

---

## CODE REVIEW CHECKLIST

Before committing changes:

- [ ] **Code Quality**
  - [ ] No console.log statements left in code
  - [ ] Proper error handling
  - [ ] Consistent with existing code style
  - [ ] TypeScript types are correct

- [ ] **Security**
  - [ ] Input validation happens early
  - [ ] Error messages don't leak sensitive info
  - [ ] No new vulnerabilities introduced
  - [ ] Proper bounds checking

- [ ] **Testing**
  - [ ] All 6 failing tests now pass
  - [ ] No regression in other tests
  - [ ] Edge cases covered
  - [ ] Clear test descriptions

- [ ] **Documentation**
  - [ ] Update relevant comments
  - [ ] Document any new utilities/functions
  - [ ] Update error messages
  - [ ] Add input constraints to docs

---

## GIT WORKFLOW

### Commit Checkpoints

**Checkpoint 1: Critical Issues (After Issues 1-3)**
```bash
git add src/commands/mint-token.ts src/commands/verify-token.ts
git commit -m "Add input validation and token integrity checks

- Add coin amount validation (must be positive)
- Add token field consistency verification
- Add state hash validation
- Fix SEC-INPUT-005, SEC-ACCESS-003, SEC-INTEGRITY-002"
```

**Checkpoint 2: High Priority Issues (After Issues 4-5)**
```bash
git add src/commands/ tests/helpers/common.bash
git commit -m "Add input size limits and address validation

- Implement input size limits (10MB max)
- Fix special character address validation
- Fix shell syntax error in test helpers
- Fix SEC-INPUT-006, SEC-INPUT-007"
```

**Checkpoint 3: Test Infrastructure (After Issue 6)**
```bash
git add tests/helpers/common.bash
git commit -m "Fix test helper shell syntax error"
```

---

## SUCCESS CRITERIA

All items must be checked to declare success:

- [ ] SEC-INPUT-005: ✅ Passing
- [ ] SEC-ACCESS-003: ✅ Passing
- [ ] SEC-INTEGRITY-002: ✅ Passing
- [ ] SEC-INPUT-006: ✅ Passing
- [ ] SEC-INPUT-007: ✅ Passing
- [ ] Test helper: ✅ No syntax errors
- [ ] Full suite: ✅ 51/51 passing (100%)
- [ ] No regressions: ✅ All other tests still pass
- [ ] Code reviewed: ✅ Quality verified
- [ ] Documentation: ✅ Updated

---

## TIMELINE ESTIMATE

| Phase | Duration | Target |
|-------|----------|--------|
| Critical Fixes (1-3) | 2.5 hours | Tuesday PM |
| High Priority (4-5) | 1.5 hours | Wednesday AM |
| Verification | 0.5 hours | Wednesday AM |
| Code Review | 0.5 hours | Wednesday PM |
| Documentation | 0.5 hours | Thursday AM |
| **TOTAL** | **~5 hours** | **Thursday AM** |

---

## NOTES & TROUBLESHOOTING

### Common Issues

**Issue: Amount validation breaks existing tests**
- Solution: Check if test data uses negative amounts intentionally
- Check test setup for default values
- Update test fixtures if needed

**Issue: Token integrity check fails on valid tokens**
- Solution: Verify your hash calculation matches SDK
- Check CBOR encoding/decoding
- Compare with working proofs

**Issue: Address validation too strict**
- Solution: Review what characters DIRECT:// addresses allow
- Check existing address format in working tests
- Adjust regex/validation rules

**Issue: Tests pass individually but fail in suite**
- Solution: Check for test interdependencies
- Verify temp file cleanup between tests
- Check environment variable state

### Debug Commands

```bash
# Run test with verbose output
SECRET="test" bats tests/security/test_input_validation.bats --verbose

# Run test with timing
time SECRET="test" bats tests/security/test_input_validation.bats -f "SEC-INPUT-005"

# Check Docker aggregator is running
docker ps | grep aggregator

# Verify TrustBase is accessible
ls -la config/trust-base.json

# Run test with bash debugging
bash -x tests/security/test_input_validation.bats
```

---

## ADDITIONAL RESOURCES

- **Detailed breakdown:** `FAILING_TESTS_DETAILED_BREAKDOWN.md`
- **Full report:** `SECURITY_TEST_STATUS_REPORT.md`
- **Quick reference:** `SECURITY_TEST_QUICK_SUMMARY.md`
- **Test execution log:** `SECURITY_TEST_EXECUTION_LOG.md`

---

## Approval Sign-Off

Once all items are checked:

- [ ] Developer: Completed all fixes
- [ ] Tester: Verified all tests pass
- [ ] Reviewer: Approved code changes
- [ ] Lead: Authorized for merge

---

**Created:** 2025-11-12
**Last Updated:** 2025-11-12
**Status:** Ready for Implementation
