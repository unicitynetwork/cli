# Security Test Quick Checklist

## Discovered Vulnerability

**receive-token.ts does NOT validate token proofs cryptographically**

- ✅ Validates JSON structure
- ❌ Does NOT verify signatures  
- ❌ Does NOT verify merkle paths
- ❌ Does NOT run SDK verification

**Result:** Accepts tokens with tampered genesis/transaction proofs

---

## Required Tests (14 total)

### tests/security/test_receive_token_crypto.bats (7 tests - CRITICAL)

- [ ] SEC-RECV-CRYPTO-001: Tampered genesis signature → reject
- [ ] SEC-RECV-CRYPTO-002: Tampered transaction signature → reject
- [ ] SEC-RECV-CRYPTO-003: Null authenticator → reject
- [ ] SEC-RECV-CRYPTO-004: Tampered merkle path → reject
- [ ] SEC-RECV-CRYPTO-005: Modified state.data → reject
- [ ] SEC-RECV-CRYPTO-006: Modified recipient → reject (already tested)
- [ ] SEC-RECV-CRYPTO-007: Modified transfer message → reject

### tests/security/test_send_token_crypto.bats (5 tests - Documentation)

- [ ] SEC-SEND-CRYPTO-001: Tampered genesis signature → reject (works)
- [ ] SEC-SEND-CRYPTO-002: Tampered merkle path → reject (works)
- [ ] SEC-SEND-CRYPTO-003: Null authenticator → reject (works)
- [ ] SEC-SEND-CRYPTO-004: Tampered transaction signature → reject (works)
- [ ] SEC-SEND-CRYPTO-005: Modified state.data → reject (works)

### tests/security/test_transfer_chain_security.bats (2 tests - Integration)

- [ ] SEC-CHAIN-001: Multi-hop tampering detection
- [ ] SEC-CHAIN-002: Replay attack prevention

---

## Code Fix

**File:** `/home/vrogojin/cli/src/commands/receive-token.ts`  
**Location:** After line 212  
**Lines to add:** ~30

```typescript
// STEP 2.6: Cryptographic validation
const tokenToValidate = await Token.fromJSON(extendedTxf);
const trustBase = await getCachedTrustBase({...});
const cryptoValidation = await validateTokenProofs(tokenToValidate, trustBase);

if (!cryptoValidation.valid) {
  console.error('❌ Token cryptographic validation failed');
  cryptoValidation.errors.forEach(err => console.error(`  - ${err}`));
  process.exit(1);
}
```

---

## Testing Workflow

1. **Demonstrate vulnerability:**
   ```bash
   bats tests/security/test_receive_token_crypto.bats -f "SEC-RECV-CRYPTO-001"
   # Expected: PASS (bad - accepts tampered token)
   ```

2. **Apply fix to receive-token.ts**

3. **Verify fix:**
   ```bash
   bats tests/security/test_receive_token_crypto.bats
   # Expected: All PASS (good - rejects tampered tokens)
   ```

4. **Run full suite:**
   ```bash
   npm run test:security
   ```

---

## Files Created

- ✅ `/home/vrogojin/cli/SECURITY_TEST_PLAN_SEND_RECEIVE.md` (Full analysis)
- ✅ `/home/vrogojin/cli/SECURITY_TEST_PLAN_SUMMARY.md` (Executive summary)
- ✅ `/home/vrogojin/cli/SECURITY_TEST_QUICK_CHECKLIST.md` (This file)

---

## Next Actions

**Today:**
- [ ] Review findings
- [ ] Create SEC-RECV-CRYPTO-001 test
- [ ] Confirm vulnerability

**This Week:**
- [ ] Implement fix
- [ ] Write all 7 receive-token tests
- [ ] Verify fix works

**Next Week:**
- [ ] Write send-token tests (documentation)
- [ ] Write chain tests
- [ ] Update docs
