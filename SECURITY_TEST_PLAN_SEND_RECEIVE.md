# Security Test Plan: send-token and receive-token Commands

## Executive Summary

This document outlines comprehensive security tests for `send-token` and `receive-token` commands to ensure they properly validate tokens from UNTRUSTED sources before processing. The tests mirror the cryptographic verification strategy implemented in `verify-token` command.

**Date:** 2025-11-11  
**Author:** Security Analysis  
**Status:** Planning Phase

---

## 1. Current Implementation Analysis

### 1.1 Code Verification Status

#### send-token.ts (Lines 245-298)
**EXCELLENT COVERAGE** - Already implements comprehensive validation:

```typescript
// Line 245-263: Structural validation BEFORE SDK parsing
validateTokenProofsJson(tokenJson)

// Line 265-268: Parse with SDK
Token.fromJSON(tokenJson)

// Line 270-276: Load TrustBase
getCachedTrustBase()

// Line 278-297: Cryptographic proof validation
validateTokenProofs(token, trustBase)
  - Genesis proof signature verification ✓
  - All transaction proofs verification ✓
  - Merkle path validation ✓
  - SDK comprehensive verification ✓
```

**Validation Pipeline:**
1. JSON structure validation (lines 246-262)
2. SDK parsing (line 266)
3. TrustBase loading (line 272-276)
4. **Cryptographic validation** (line 278-297):
   - `validateTokenProofs()` calls:
     - `authenticator.verify(transactionHash)` - ECDSA signature check
     - `proof.verify(trustBase, requestId)` - Merkle path + UnicityCertificate
     - `token.verify(trustBase)` - Comprehensive SDK validation

**Result:** send-token ALREADY has full cryptographic verification! ✅

#### receive-token.ts (Lines 196-212)
**PARTIAL COVERAGE** - Has structural validation but missing full crypto verification:

```typescript
// Line 173-180: Validates offline transfer package structure
validateExtendedTxf(extendedTxf)

// Line 196-212: JSON proof structure validation
validateTokenProofsJson(extendedTxf)
  - Checks proof structure ✓
  - Does NOT verify signatures ✗
  - Does NOT verify merkle paths ✗
```

**Missing Validation:**
- No TrustBase loading for token validation
- No `validateTokenProofs(token, trustBase)` call
- No cryptographic signature verification of incoming token

**BUT:** receive-token DOES validate the transfer proof at lines 436-457:
```typescript
// Line 436-457: Validates transfer inclusion proof cryptographically
validateInclusionProof(inclusionProof, transferCommitment.requestId, trustBase)
```

**Gap Identified:**
- receive-token validates the NEW transfer proof (created during receive)
- receive-token does NOT validate the ORIGINAL token's proofs (from sender)
- Attacker could send a token with tampered genesis/transaction proofs
- Recipient would accept it if sender's signature is valid

---

## 2. Security Test Coverage Analysis

### 2.1 Existing Security Tests for send-token/receive-token

**Current Coverage in test_cryptographic.bats:**

| Test ID | Description | Coverage |
|---------|-------------|----------|
| SEC-CRYPTO-001 | Genesis proof signature tampering → verify-token FAILS ✓ | Tests verify-token only |
| SEC-CRYPTO-001 (line 74) | Tampered token → send-token FAILS ✓ | **Tests send-token!** |
| SEC-CRYPTO-002 | Merkle path tampering → verify-token FAILS ✓ | Tests verify-token only |
| SEC-CRYPTO-003 | Modified recipient after signing → receive-token FAILS ✓ | **Tests receive-token!** |
| SEC-CRYPTO-007 | Null authenticator → verify-token FAILS ✓ | Tests verify-token only |

**Current Coverage in test_access_control.bats:**

| Test ID | Description | Coverage |
|---------|-------------|----------|
| SEC-ACCESS-001 | Transfer token not owned → send-token FAILS ✓ | **Tests send-token ownership!** |
| SEC-ACCESS-003 | Modified token data → send-token FAILS ✓ | **Tests send-token validation!** |

**Current Coverage in test_data_integrity.bats:**

| Test ID | Description | Coverage |
|---------|-------------|----------|
| SEC-INTEGRITY-001 | Corrupted file → send-token FAILS ✓ | **Tests send-token!** |
| SEC-INTEGRITY-002 | State hash mismatch → verify-token FAILS ✓ | Tests verify-token only |

### 2.2 Gap Analysis

**What's Missing:**

1. **send-token specific crypto tests** (explicit proof tampering tests)
   - Currently tested indirectly via SEC-CRYPTO-001 line 74
   - Need explicit tests for all crypto attacks on send-token

2. **receive-token specific crypto tests** (token validation before receive)
   - SEC-CRYPTO-003 tests transfer package tampering ✓
   - Missing: Tampered GENESIS proof → receive should FAIL
   - Missing: Tampered TRANSACTION proof → receive should FAIL
   - Missing: Invalid token before transfer → receive should FAIL

3. **receive-token comprehensive validation**
   - Currently only validates transfer proof, not token proofs
   - Need to validate ENTIRE token history before accepting

---

## 3. Missing Security Tests - Detailed Specification

### 3.1 send-token Cryptographic Security Tests

**File:** `tests/security/test_send_token_crypto.bats` (NEW FILE)

#### SEC-SEND-CRYPTO-001: Tampered Genesis Proof Signature
```bash
@test "SEC-SEND-CRYPTO-001: send-token rejects token with tampered genesis proof signature"
Description: Verifies send-token detects corrupted genesis proof signatures
Setup:
  1. Mint valid token
  2. Tamper with genesis.inclusionProof.authenticator.signature
  3. Attempt send-token
Expected: exit 1, error contains "signature" or "verification" or "genesis"
Location: NEW FILE tests/security/test_send_token_crypto.bats
Priority: CRITICAL
Status: ALREADY WORKS (tested in SEC-CRYPTO-001 line 74)
```

#### SEC-SEND-CRYPTO-002: Tampered Genesis Merkle Path
```bash
@test "SEC-SEND-CRYPTO-002: send-token rejects token with tampered merkle path"
Description: Verifies send-token detects corrupted merkle tree paths
Setup:
  1. Mint valid token
  2. Tamper with genesis.inclusionProof.merkleTreePath.root
  3. Attempt send-token
Expected: exit 1, error contains "merkle" or "proof" or "invalid"
Location: NEW FILE tests/security/test_send_token_crypto.bats
Priority: CRITICAL
```

#### SEC-SEND-CRYPTO-003: Null Genesis Authenticator
```bash
@test "SEC-SEND-CRYPTO-003: send-token rejects token with null genesis authenticator"
Description: Verifies send-token enforces authenticator presence
Setup:
  1. Mint valid token
  2. Set genesis.inclusionProof.authenticator = null
  3. Attempt send-token
Expected: exit 1, error contains "authenticator" or "null" or "missing"
Location: NEW FILE tests/security/test_send_token_crypto.bats
Priority: CRITICAL
```

#### SEC-SEND-CRYPTO-004: Tampered Transaction Proof
```bash
@test "SEC-SEND-CRYPTO-004: send-token rejects token with tampered transaction proof"
Description: Verifies send-token validates all transaction proofs in history
Setup:
  1. Create token with transfer history (Alice→Bob→Alice)
  2. Tamper with transactions[0].inclusionProof.authenticator.signature
  3. Alice attempts to send token to Carol
Expected: exit 1, error contains "transaction" and ("signature" or "proof")
Location: NEW FILE tests/security/test_send_token_crypto.bats
Priority: HIGH
```

#### SEC-SEND-CRYPTO-005: Modified State Data (Hash Mismatch)
```bash
@test "SEC-SEND-CRYPTO-005: send-token rejects token with modified state data"
Description: Verifies send-token detects state.data tampering via SDK verification
Setup:
  1. Mint valid token with data
  2. Modify state.data without updating proof
  3. Attempt send-token
Expected: exit 1, error contains "hash" or "state" or "mismatch" or "verification"
Location: NEW FILE tests/security/test_send_token_crypto.bats
Priority: CRITICAL
Note: This is covered by SDK token.verify() comprehensive check
```

### 3.2 receive-token Cryptographic Security Tests

**File:** `tests/security/test_receive_token_crypto.bats` (NEW FILE)

#### SEC-RECV-CRYPTO-001: Tampered Genesis Proof in Incoming Token
```bash
@test "SEC-RECV-CRYPTO-001: receive-token rejects transfer with tampered genesis proof"
Description: Verifies receive-token validates genesis proof of incoming token
Setup:
  1. Alice mints token
  2. Alice creates transfer to Bob
  3. Bob tampers with genesis.inclusionProof.authenticator.signature in transfer file
  4. Bob attempts receive-token
Expected: exit 1, error contains "genesis" and ("signature" or "proof" or "invalid")
Location: NEW FILE tests/security/test_receive_token_crypto.bats
Priority: CRITICAL
Status: CURRENTLY VULNERABLE - receive-token does NOT validate token proofs
```

#### SEC-RECV-CRYPTO-002: Tampered Transaction Proof in Incoming Token
```bash
@test "SEC-RECV-CRYPTO-002: receive-token rejects transfer with tampered transaction proof"
Description: Verifies receive-token validates all transaction proofs in incoming token
Setup:
  1. Alice mints token, sends to Bob (transaction 1)
  2. Bob receives, then creates transfer to Carol
  3. Carol tampers with transactions[0].inclusionProof.signature
  4. Carol attempts receive-token
Expected: exit 1, error contains "transaction" and ("signature" or "proof")
Location: NEW FILE tests/security/test_receive_token_crypto.bats
Priority: HIGH
Status: CURRENTLY VULNERABLE
```

#### SEC-RECV-CRYPTO-003: Null Authenticator in Incoming Token
```bash
@test "SEC-RECV-CRYPTO-003: receive-token rejects transfer with null authenticator"
Description: Verifies receive-token enforces authenticator presence
Setup:
  1. Alice creates valid transfer to Bob
  2. Set genesis.inclusionProof.authenticator = null in transfer file
  3. Bob attempts receive-token
Expected: exit 1, error contains "authenticator" or "null"
Location: NEW FILE tests/security/test_receive_token_crypto.bats
Priority: CRITICAL
Status: CURRENTLY VULNERABLE
```

#### SEC-RECV-CRYPTO-004: Tampered Merkle Path in Incoming Token
```bash
@test "SEC-RECV-CRYPTO-004: receive-token rejects transfer with tampered merkle path"
Description: Verifies receive-token validates merkle paths
Setup:
  1. Alice creates transfer to Bob
  2. Tamper with genesis.inclusionProof.merkleTreePath.root
  3. Bob attempts receive-token
Expected: exit 1, error contains "merkle" or "proof" or "invalid"
Location: NEW FILE tests/security/test_receive_token_crypto.bats
Priority: CRITICAL
Status: CURRENTLY VULNERABLE
```

#### SEC-RECV-CRYPTO-005: Modified State Data in Incoming Token
```bash
@test "SEC-RECV-CRYPTO-005: receive-token rejects transfer with modified state data"
Description: Verifies receive-token detects state.data tampering
Setup:
  1. Alice creates transfer to Bob with token data
  2. Modify state.data in transfer file (change token metadata)
  3. Bob attempts receive-token
Expected: exit 1, error contains "hash" or "state" or "mismatch"
Location: NEW FILE tests/security/test_receive_token_crypto.bats
Priority: CRITICAL
Status: CURRENTLY VULNERABLE
```

#### SEC-RECV-CRYPTO-006: Tampered Offline Transfer Package
```bash
@test "SEC-RECV-CRYPTO-006: receive-token rejects tampered transfer commitment"
Description: Verifies receive-token validates transfer package integrity
Setup:
  1. Alice creates valid transfer to Bob
  2. Modify offlineTransfer.recipient to Carol's address
  3. Bob attempts receive-token
Expected: exit 1, error contains "recipient" or "address" or "mismatch"
Location: NEW FILE tests/security/test_receive_token_crypto.bats
Priority: CRITICAL
Status: ALREADY TESTED in SEC-CRYPTO-003 and RECV_TOKEN-004
```

#### SEC-RECV-CRYPTO-007: Modified Transfer Commitment Data
```bash
@test "SEC-RECV-CRYPTO-007: receive-token rejects modified commitment data"
Description: Verifies receive-token validates commitment signature binding
Setup:
  1. Alice creates transfer with message "Transfer to Bob"
  2. Modify offlineTransfer.message to different content
  3. Bob attempts receive-token
Expected: exit 1, error contains "commitment" or "signature" or "invalid"
Location: NEW FILE tests/security/test_receive_token_crypto.bats
Priority: HIGH
```

### 3.3 Integration Tests (Token Chain Security)

**File:** `tests/security/test_transfer_chain_security.bats` (NEW FILE)

#### SEC-CHAIN-001: Multi-hop Transfer with Tampering at Each Stage
```bash
@test "SEC-CHAIN-001: Detect tampering at any point in transfer chain"
Description: Verifies security maintained across multiple transfers
Setup:
  1. Alice mints token
  2. Alice → Bob (transfer 1)
  3. Tamper with token after Bob receives
  4. Bob → Carol (transfer 2)
Expected: Carol's receive-token should FAIL
Location: NEW FILE tests/security/test_transfer_chain_security.bats
Priority: HIGH
```

#### SEC-CHAIN-002: Replay Attack Prevention
```bash
@test "SEC-CHAIN-002: Cannot replay old transfer commitments"
Description: Verifies unique RequestId prevents replay
Setup:
  1. Alice → Bob transfer (commitment 1)
  2. Bob receives
  3. Bob → Carol transfer (commitment 2)
  4. Attacker tries to re-submit commitment 1
Expected: Network rejects duplicate RequestId
Location: NEW FILE tests/security/test_transfer_chain_security.bats
Priority: MEDIUM
Status: Network-level enforcement, CLI should handle gracefully
```

---

## 4. Implementation Gaps in Code

### 4.1 receive-token.ts - Missing Token Validation

**Current Code (line 196-212):**
```typescript
// STEP 2.5: Validate token proofs before processing
console.error('\nStep 2.5: Validating token proofs...');
const proofValidation = validateTokenProofsJson(extendedTxf);

if (!proofValidation.valid) {
  console.error('\n❌ Token proof validation failed:');
  proofValidation.errors.forEach(err => console.error(`  - ${err}`));
  console.error('\nCannot receive a token with invalid proofs.');
  process.exit(1);
}
```

**Problem:** `validateTokenProofsJson()` only checks JSON structure, NOT cryptographic validity

**Required Fix:**
```typescript
// STEP 2.5: Validate token proofs before processing
console.error('\nStep 2.5: Validating token proofs...');
const proofValidation = validateTokenProofsJson(extendedTxf);

if (!proofValidation.valid) {
  console.error('\n❌ Token proof validation failed:');
  proofValidation.errors.forEach(err => console.error(`  - ${err}`));
  console.error('\nCannot receive a token with invalid proofs.');
  process.exit(1);
}

// STEP 2.6: Load token and perform CRYPTOGRAPHIC validation
console.error('\nStep 2.6: Performing cryptographic validation of incoming token...');
const tokenToValidate = await Token.fromJSON(extendedTxf);

// Load TrustBase (reuse from Step 7.5 or load earlier)
const trustBaseForValidation = await getCachedTrustBase({
  filePath: process.env.TRUSTBASE_PATH,
  useFallback: false
});

// Perform comprehensive cryptographic validation
const cryptoValidation = await validateTokenProofs(tokenToValidate, trustBaseForValidation);

if (!cryptoValidation.valid) {
  console.error('\n❌ Token cryptographic validation failed:');
  cryptoValidation.errors.forEach(err => console.error(`  - ${err}`));
  console.error('\nCannot receive a token with invalid cryptographic proofs.');
  console.error('The sender may have provided a tampered or corrupted token.');
  process.exit(1);
}

console.error('  ✓ Token cryptographic validation passed');
console.error('  ✓ Genesis proof verified');
if (tokenToValidate.transactions && tokenToValidate.transactions.length > 0) {
  console.error(`  ✓ All transaction proofs verified (${tokenToValidate.transactions.length} transaction${tokenToValidate.transactions.length !== 1 ? 's' : ''})`);
}
console.error();
```

**Location to Insert:** After line 212 in `/home/vrogojin/cli/src/commands/receive-token.ts`

**Why This Matters:**
- Current code: Accepts tokens with tampered genesis proofs
- Fixed code: Rejects any token with invalid cryptographic proofs
- Defense-in-depth: Validates BEFORE submitting to network

### 4.2 Optimization: Avoid Duplicate TrustBase Loading

**Current Issue:** receive-token loads TrustBase at line 410-415, AFTER validation

**Optimized Approach:**
1. Load TrustBase once at beginning (after file validation)
2. Use for token validation (new step)
3. Reuse for transfer proof validation (existing step)

**Code Change:**
- Move TrustBase loading from line 410 to ~line 165 (before validation steps)
- Reference same trustBase in both validations

---

## 5. Test Organization

### 5.1 New Test Files to Create

| File | Test Count | Priority | Status |
|------|-----------|----------|--------|
| `tests/security/test_send_token_crypto.bats` | 5 tests | HIGH | Mostly redundant (send-token already validates) |
| `tests/security/test_receive_token_crypto.bats` | 7 tests | CRITICAL | Required - receive-token vulnerable |
| `tests/security/test_transfer_chain_security.bats` | 2 tests | MEDIUM | Integration tests |

### 5.2 Existing Files to Update

| File | Changes | Reason |
|------|---------|--------|
| `tests/security/test_cryptographic.bats` | Add reference to new tests | Documentation |
| `tests/security/README.md` | Document new test suites | Organization |

### 5.3 Test Execution Strategy

**Phase 1: Confirm Existing Coverage (send-token)**
```bash
# Run existing tests to verify send-token already validates
bats tests/security/test_cryptographic.bats -f "SEC-CRYPTO-001"
bats tests/security/test_access_control.bats -f "SEC-ACCESS-001"
bats tests/security/test_access_control.bats -f "SEC-ACCESS-003"
```

**Phase 2: Expose receive-token Vulnerability**
```bash
# Create and run SEC-RECV-CRYPTO-001 to demonstrate vulnerability
bats tests/security/test_receive_token_crypto.bats -f "SEC-RECV-CRYPTO-001"
# Expected: FAIL (currently vulnerable)
```

**Phase 3: Implement Fix**
```bash
# Add cryptographic validation to receive-token.ts
# Add validateTokenProofs() call after line 212
```

**Phase 4: Verify Fix**
```bash
# Re-run tests
bats tests/security/test_receive_token_crypto.bats
# Expected: PASS (vulnerability fixed)
```

---

## 6. Priority Matrix

### 6.1 Critical Tests (Must Implement)

| Test ID | Impact | Effort | Priority |
|---------|--------|--------|----------|
| SEC-RECV-CRYPTO-001 | High - Genesis tampering | Low | P0 |
| SEC-RECV-CRYPTO-003 | High - Null authenticator | Low | P0 |
| SEC-RECV-CRYPTO-004 | High - Merkle tampering | Low | P0 |
| SEC-RECV-CRYPTO-005 | High - State tampering | Low | P0 |

### 6.2 High Priority Tests (Should Implement)

| Test ID | Impact | Effort | Priority |
|---------|--------|--------|----------|
| SEC-RECV-CRYPTO-002 | Medium - Transaction tampering | Medium | P1 |
| SEC-RECV-CRYPTO-007 | Medium - Commitment tampering | Medium | P1 |
| SEC-CHAIN-001 | Medium - Multi-hop security | High | P1 |

### 6.3 Medium Priority Tests (Nice to Have)

| Test ID | Impact | Effort | Priority |
|---------|--------|--------|----------|
| SEC-SEND-CRYPTO-002 | Low - Redundant with existing | Low | P2 |
| SEC-SEND-CRYPTO-003 | Low - Redundant with existing | Low | P2 |
| SEC-SEND-CRYPTO-004 | Low - Redundant with existing | Medium | P2 |
| SEC-CHAIN-002 | Low - Network enforced | High | P2 |

---

## 7. Test Template

### Standard Test Structure
```bash
@test "SEC-RECV-CRYPTO-XXX: Description" {
    log_test "Testing [specific attack vector]"

    # SETUP: Create valid token/transfer
    local valid_token="${TEST_TEMP_DIR}/valid.txf"
    mint_token_to_address "${ALICE_SECRET}" "nft" "" "${valid_token}"
    assert_token_fully_valid "${valid_token}"

    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")
    
    local transfer="${TEST_TEMP_DIR}/transfer.txf"
    send_token_offline "${ALICE_SECRET}" "${valid_token}" "${bob_addr}" "${transfer}"
    assert_offline_transfer_valid "${transfer}"

    # ATTACK: Tamper with specific field
    local tampered="${TEST_TEMP_DIR}/tampered.txf"
    jq '.genesis.inclusionProof.authenticator.signature = "deadbeef"' \
        "${transfer}" > "${tampered}"

    # EXECUTE: Attempt receive-token
    local received="${TEST_TEMP_DIR}/received.txf"
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${tampered} --local -o ${received}"

    # VERIFY: Should fail
    assert_failure
    assert_output_contains "signature" || assert_output_contains "genesis" || assert_output_contains "invalid"

    # VERIFY: No file created
    assert_file_not_exists "${received}"

    log_success "SEC-RECV-CRYPTO-XXX: Attack correctly detected and rejected"
}
```

---

## 8. Summary and Recommendations

### 8.1 Key Findings

1. **send-token: EXCELLENT** ✅
   - Already implements full cryptographic validation
   - Validates genesis proof, transaction proofs, merkle paths
   - Uses SDK comprehensive verification
   - No implementation changes needed

2. **receive-token: VULNERABLE** ❌
   - Only validates JSON structure, not cryptographic proofs
   - Accepts tokens with tampered genesis proofs
   - Accepts tokens with invalid transaction proofs
   - CRITICAL security gap

### 8.2 Immediate Actions Required

**Priority 0 (This Week):**
1. Add `validateTokenProofs()` call to receive-token.ts after line 212
2. Load TrustBase earlier in receive-token.ts (optimization)
3. Create `test_receive_token_crypto.bats` with 7 critical tests
4. Run tests to verify vulnerability is fixed

**Priority 1 (Next Week):**
1. Create `test_send_token_crypto.bats` for documentation (already works)
2. Create `test_transfer_chain_security.bats` for integration tests
3. Update security test documentation

**Priority 2 (Future):**
1. Add performance benchmarks for validation
2. Consider caching validated tokens
3. Add metrics for validation failures

### 8.3 Expected Test Results

**Before Fix:**
- SEC-RECV-CRYPTO-001: FAIL (receive-token accepts tampered genesis)
- SEC-RECV-CRYPTO-002: FAIL (receive-token accepts tampered transactions)
- SEC-RECV-CRYPTO-003: FAIL (receive-token accepts null authenticator)
- SEC-RECV-CRYPTO-004: FAIL (receive-token accepts tampered merkle path)
- SEC-RECV-CRYPTO-005: FAIL (receive-token accepts modified state data)

**After Fix:**
- All SEC-RECV-CRYPTO tests: PASS (validation correctly rejects tampering)

### 8.4 Documentation Updates Needed

1. Update `CLAUDE.md` to reflect security validation strategy
2. Update `docs/reference/api-reference.md` with validation details
3. Create `.dev/security/CRYPTOGRAPHIC_VALIDATION.md` documenting approach
4. Update `tests/security/README.md` with new test suites

---

## 9. Next Steps

**Immediate (Today):**
1. Review this plan with team
2. Confirm vulnerability in receive-token via manual test
3. Create SEC-RECV-CRYPTO-001 test to demonstrate issue

**Short-term (This Week):**
1. Implement receive-token.ts fix (add validateTokenProofs call)
2. Write all 7 receive-token crypto tests
3. Verify all tests pass after fix

**Medium-term (Next 2 Weeks):**
1. Write send-token crypto tests (documentation)
2. Write transfer chain security tests
3. Update all documentation

**Long-term (Future):**
1. Add validation metrics/monitoring
2. Consider validation caching
3. Performance optimization

---

## Appendix A: Code Locations

### Validation Functions
- `validateTokenProofs()`: `/home/vrogojin/cli/src/utils/proof-validation.ts:191-384`
- `validateTokenProofsJson()`: `/home/vrogojin/cli/src/utils/proof-validation.ts:393-447`
- `validateInclusionProof()`: `/home/vrogojin/cli/src/utils/proof-validation.ts:30-118`

### Command Files
- `send-token.ts`: `/home/vrogojin/cli/src/commands/send-token.ts`
  - Validation: Lines 245-297
- `receive-token.ts`: `/home/vrogojin/cli/src/commands/receive-token.ts`
  - Structural validation: Lines 196-212
  - Transfer proof validation: Lines 436-457
  - **MISSING: Token proof validation** (should be ~line 213-240)

### Test Files
- Crypto tests: `/home/vrogojin/cli/tests/security/test_cryptographic.bats`
- Access control: `/home/vrogojin/cli/tests/security/test_access_control.bats`
- Data integrity: `/home/vrogojin/cli/tests/security/test_data_integrity.bats`
- Send functional: `/home/vrogojin/cli/tests/functional/test_send_token.bats`
- Receive functional: `/home/vrogojin/cli/tests/functional/test_receive_token.bats`

---

**End of Security Test Plan**
