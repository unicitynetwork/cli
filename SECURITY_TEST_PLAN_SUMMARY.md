# Security Test Plan Summary: send-token & receive-token

**Date:** 2025-11-11  
**Status:** CRITICAL VULNERABILITY IDENTIFIED in receive-token

---

## TL;DR

**send-token:** ✅ SECURE - Already validates all cryptographic proofs  
**receive-token:** ❌ VULNERABLE - Only validates structure, NOT signatures

**Impact:** Attacker can send tokens with tampered genesis/transaction proofs  
**Fix Required:** Add `validateTokenProofs()` call to receive-token.ts after line 212

---

## Critical Finding

### receive-token.ts Security Gap

**Current Code (Line 196-212):**
```typescript
const proofValidation = validateTokenProofsJson(extendedTxf);
// Only checks JSON structure - NO signature verification!
```

**Required Fix (Insert after line 212):**
```typescript
// Load token and TrustBase
const tokenToValidate = await Token.fromJSON(extendedTxf);
const trustBase = await getCachedTrustBase({...});

// CRYPTOGRAPHIC VALIDATION
const cryptoValidation = await validateTokenProofs(tokenToValidate, trustBase);
if (!cryptoValidation.valid) {
  console.error('❌ Token cryptographic validation failed');
  process.exit(1);
}
```

---

## Test Coverage Needed

### Priority 0: CRITICAL Tests (7 tests)

**File:** `tests/security/test_receive_token_crypto.bats`

| Test ID | Attack Vector | Expected Result |
|---------|---------------|-----------------|
| SEC-RECV-CRYPTO-001 | Tampered genesis signature | FAIL - reject |
| SEC-RECV-CRYPTO-002 | Tampered transaction signature | FAIL - reject |
| SEC-RECV-CRYPTO-003 | Null authenticator | FAIL - reject |
| SEC-RECV-CRYPTO-004 | Tampered merkle path | FAIL - reject |
| SEC-RECV-CRYPTO-005 | Modified state.data | FAIL - reject |
| SEC-RECV-CRYPTO-006 | Modified recipient address | FAIL - reject (already tested) |
| SEC-RECV-CRYPTO-007 | Modified transfer message | FAIL - reject |

**Current Status:** All would PASS (accept tampered tokens) - VULNERABILITY!

### Priority 1: Documentation Tests (5 tests)

**File:** `tests/security/test_send_token_crypto.bats`

Same attack vectors as receive-token, but for send-token.  
**Status:** All already work correctly - tests for documentation only.

### Priority 2: Integration Tests (2 tests)

**File:** `tests/security/test_transfer_chain_security.bats`

- SEC-CHAIN-001: Multi-hop transfer with tampering
- SEC-CHAIN-002: Replay attack prevention

---

## Comparison Matrix

| Feature | send-token | receive-token |
|---------|-----------|---------------|
| JSON structure validation | ✅ Yes | ✅ Yes |
| Genesis signature verification | ✅ Yes | ❌ NO |
| Transaction signature verification | ✅ Yes | ❌ NO |
| Merkle path validation | ✅ Yes | ❌ NO |
| SDK comprehensive verification | ✅ Yes | ❌ NO |
| Transfer proof validation | N/A | ✅ Yes |
| **Security Status** | ✅ SECURE | ❌ VULNERABLE |

---

## Implementation Checklist

### Phase 1: Demonstrate Vulnerability (Today)
- [ ] Create SEC-RECV-CRYPTO-001 test
- [ ] Run test - expect PASS (vulnerability confirmed)
- [ ] Document finding

### Phase 2: Fix Vulnerability (This Week)
- [ ] Add validation code to receive-token.ts (30 lines)
- [ ] Move TrustBase loading earlier (optimization)
- [ ] Test manually with tampered token

### Phase 3: Comprehensive Testing (This Week)
- [ ] Write all 7 receive-token crypto tests
- [ ] Run tests - expect FAIL (vulnerability fixed)
- [ ] Verify no regressions in functional tests

### Phase 4: Documentation (Next Week)
- [ ] Write send-token crypto tests (already works)
- [ ] Write transfer chain tests
- [ ] Update security documentation

---

## Code Changes Required

**File:** `/home/vrogojin/cli/src/commands/receive-token.ts`

**Change 1: Add imports** (top of file)
```typescript
import { validateTokenProofs } from '../utils/proof-validation.js';
// Note: getCachedTrustBase already imported
```

**Change 2: Insert after line 212** (between proof JSON validation and token loading)
```typescript
// STEP 2.6: Perform cryptographic validation of incoming token
console.error('\nStep 2.6: Performing cryptographic validation of incoming token...');
const tokenToValidate = await Token.fromJSON(extendedTxf);

// Load TrustBase for validation (will be reused later)
const trustBase = await getCachedTrustBase({
  filePath: process.env.TRUSTBASE_PATH,
  useFallback: false
});

// Comprehensive cryptographic validation
const cryptoValidation = await validateTokenProofs(tokenToValidate, trustBase);

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

**Change 3: Update existing code** (around line 410)
```typescript
// Remove duplicate TrustBase loading - already loaded in Step 2.6
// Use trustBase variable from earlier
```

**Total Changes:** ~30 lines added, ~5 lines removed

---

## Test Template

```bash
@test "SEC-RECV-CRYPTO-001: receive-token rejects tampered genesis proof" {
    log_test "Testing genesis proof signature tampering rejection"

    # Setup: Create valid transfer
    local alice_token="${TEST_TEMP_DIR}/alice.txf"
    mint_token_to_address "${ALICE_SECRET}" "nft" "" "${alice_token}"
    assert_token_fully_valid "${alice_token}"

    local bob_addr=$(generate_address "${BOB_SECRET}" "nft")
    local transfer="${TEST_TEMP_DIR}/transfer.txf"
    send_token_offline "${ALICE_SECRET}" "${alice_token}" "${bob_addr}" "${transfer}"
    assert_offline_transfer_valid "${transfer}"

    # Attack: Tamper with genesis proof signature
    local tampered="${TEST_TEMP_DIR}/tampered.txf"
    jq '.genesis.inclusionProof.authenticator.signature = "deadbeef"' \
        "${transfer}" > "${tampered}"

    # Execute: Attempt receive
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${tampered} --local -o ${TEST_TEMP_DIR}/received.txf"

    # Verify: MUST FAIL
    assert_failure
    assert_output_contains "signature" || assert_output_contains "genesis" || assert_output_contains "verification"
    assert_file_not_exists "${TEST_TEMP_DIR}/received.txf"

    log_success "SEC-RECV-CRYPTO-001: Genesis proof tampering correctly detected"
}
```

---

## Timeline

**Day 1 (Today):**
- Review plan
- Create demo test showing vulnerability
- Get approval for fix

**Day 2-3 (This Week):**
- Implement fix in receive-token.ts
- Write all 7 crypto tests
- Run full security test suite

**Week 2:**
- Write documentation tests
- Write integration tests
- Update documentation

**Estimated Effort:** 2-3 days

---

## Risk Assessment

**Without Fix:**
- **Severity:** CRITICAL
- **Exploitability:** HIGH (simple jq command to tamper)
- **Impact:** Token forgery, invalid state acceptance
- **Likelihood:** MEDIUM (requires attacker to understand token structure)

**With Fix:**
- **Severity:** None
- **Risk:** Eliminated
- **Cost:** 2-3 days development + testing

---

## References

**Full Plan:** `/home/vrogojin/cli/SECURITY_TEST_PLAN_SEND_RECEIVE.md`

**Code Locations:**
- send-token.ts validation: Lines 245-297 ✅
- receive-token.ts gap: After line 212 ❌
- validateTokenProofs(): `/home/vrogojin/cli/src/utils/proof-validation.ts:191-384`

**Test Files:**
- test_cryptographic.bats: Existing crypto tests
- test_receive_token_crypto.bats: NEW - 7 tests needed
- test_send_token_crypto.bats: NEW - 5 tests (documentation)

---

**END SUMMARY**
