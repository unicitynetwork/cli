# Token Data Coverage Gaps - Quick Reference

## Coverage Status at a Glance

```
COMBINATION COVERAGE:

C1: No Data at all
████████████████████████████ 28/28 tests ✅ COMPLETE

C2: State Data Only (via -d flag)
████░░░░░░░░░░░░░░░░░░░░░░░░  2/12 tests ⚠️ INADEQUATE

C3: Genesis Data Only
░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0/10 tests ❌ MISSING

C4: Both Genesis + State Data
░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0/8 tests ❌ MISSING

OVERALL: 30/58 scenarios covered (52%)
```

---

## The 4 Required Test Combinations Explained

### Combination 1: No Data (C1) - ✅ COVERED
**Token Creation:**
```bash
mint-token --preset nft --local
# No -d flag = no genesis.data.tokenData, no state.data
```
**Structure:**
```json
{
  "genesis": {
    "data": {
      "tokenType": "...",
      "tokenId": "...",
      "tokenData": "00"  // Empty or minimal
    }
  },
  "state": {
    "data": "00"  // Empty
  }
}
```
**Tests:** 28 tests covering cryptographic validation, proofs, signatures
**Status:** ✅ Excellent coverage

---

### Combination 2: State Data Only (C2) - ⚠️ INADEQUATE
**Token Creation:**
```bash
mint-token --preset nft --local -d '{"metadata":"value"}'
# Has genesis.data.tokenData, but state.data is same at inception
```
**Structure:**
```json
{
  "genesis": {
    "data": {
      "tokenType": "...",
      "tokenId": "...",
      "tokenData": "7b226d657461646174612..."  // Hex-encoded JSON
    },
    "transaction": {
      "recipientDataHash": "a1b2c3d4..."  // Commits to state.data
    }
  },
  "state": {
    "data": "7b226d657461646174612..."  // Same as genesis initially
  }
}
```
**Tests:** Only 2 tests (SEC-RECV-CRYPTO-004, SEC-SEND-CRYPTO-004)
**Gaps:**
- ❌ No recipientDataHash tampering tests
- ❌ No genesis.data.tokenData tampering tests
- ❌ No verification of both protections together
**Status:** ⚠️ Critical gaps

---

### Combination 3: Genesis Data Only (C3) - ❌ MISSING
**Scenario:** Token created with metadata but never transferred (no state.data)

**Note:** This is actually a **VARIANT** of C2 - same creation method, but represents a token that's kept but never transferred, so state.data isn't modified.

**Why This Matters:**
- Genesis data is IMMUTABLE per transaction signature
- Should test that genesis.data.tokenData cannot be modified
- Should verify transaction signature prevents tampering

**Tests Needed:**
```bash
# Create token with metadata
mint-token --preset nft --local -d '{"metadata":"original"}' -o token.txf

# Test 1: Tamper genesis.data.tokenData
jq '.genesis.data.tokenData = "deadbeef"' token.txf > tampered.txf
receive-token -f tampered.txf  # Should FAIL

# Test 2: Verify genesis signature validation
# (Already covered in SEC-CRYPTO-001 but on C1 tokens)

# Test 3: Verify state.data remains unchanged
# (No explicit test for this)
```

**Coverage Needed:** 3-5 tests

---

### Combination 4: Both Genesis + State Data (C4) - ❌ MISSING
**Scenario:** Token with metadata transferred to someone else
**Token Evolution:**
```
Alice mints with -d:
  genesis.data.tokenData = "metadata"
  state.data = "metadata" (same initially)

Alice transfers to Bob:
  Bob receives (or state updates):
    state.data = "new_data"  (MAY change)
    genesis.data.tokenData = "metadata"  (unchanged)
```

**Structure After Transfer:**
```json
{
  "genesis": {
    "data": {
      "tokenData": "7b226d657461646174612..."  // Alice's original metadata
    },
    "transaction": {
      "recipientDataHash": "a1b2c3d4..."  // Commits to ORIGINAL state.data
    }
  },
  "state": {
    "data": "..."  // May be different now
  },
  "transactions": [...]  // History of transfers
}
```

**Why This Matters:**
- Tests BOTH protection mechanisms work independently
- Ensures tampering one field is detected without affecting the other
- Real-world use case

**Tests Needed:**
```bash
# Create token with metadata
mint-token --preset nft --local -d '{"metadata":"original"}' -o token.txf

# Transfer to Bob (creates new state)
send-token -f token.txf -r bob_address --local -o transfer.txf

# Bob receives
receive-token -f transfer.txf --local -o bob_token.txf

# Now test tampering on Bob's token:

# Test C4-1: Tamper genesis.data.tokenData only
jq '.genesis.data.tokenData = "deadbeef"' bob_token.txf > tampered.txf
verify-token -f tampered.txf --local  # Should FAIL

# Test C4-2: Tamper state.data only
jq '.state.data = "deadbeef"' bob_token.txf > tampered.txf
verify-token -f tampered.txf --local  # Should FAIL

# Test C4-3: Tamper recipientDataHash only
jq '.genesis.transaction.recipientDataHash = "deadbeef..."' bob_token.txf > tampered.txf
receive-token -f tampered.txf --local  # Should FAIL (on next transfer)

# Test C4-4: Verify independent detection
# Each tampering should be detected by different mechanism:
# - genesis.data.tokenData: Transaction signature
# - state.data: State hash (recipientDataHash)
# - recipientDataHash: Commitment binding
```

**Coverage Needed:** 4-6 tests

---

## Missing Tampering Scenarios by Mechanism

### 1. Genesis Data Protection (Transaction Signature)

**Mechanism:** `genesis.transaction` is signed; tampering invalidates signature

**Tests Needed:**
```
C2-GENSIG-001: Tamper genesis.data.tokenData (no state data transfer)
C3-GENSIG-001: Tamper genesis.data.tokenData (genesis data only)
C4-GENSIG-001: Tamper genesis.data.tokenData (with state data transfer)
```

**Current Status:** ❌ 0 explicit tests
**Related Tests:** SEC-RECV-CRYPTO-005 tests `tokenType` but not custom `tokenData`

---

### 2. State Data Protection (RecipientDataHash Commitment)

**Mechanism:** `recipientDataHash` commits to state.data; mismatch detected during verification

**Tests Needed:**
```
C2-HASH-001: Tamper recipientDataHash
C2-HASH-002: Tamper state.data (hash mismatch)
C4-HASH-001: Tamper recipientDataHash (with genesis data)
C4-HASH-002: Tamper state.data (hash mismatch with genesis data)
```

**Current Status:** ❌ 0 explicit tests
**Related Tests:**
- SEC-RECV-CRYPTO-004 tests state.data tampering but on C2 only
- SEC-INTEGRITY-002 tests state.data on C1 (empty data)

---

### 3. Proof Integrity (Merkle Tree + Authenticator)

**Tests Needed for Data-Bearing Tokens:**
```
C2-PROOF-001: Tamper genesis proof signature (on state data token)
C2-PROOF-002: Tamper merkle path (on state data token)
C4-PROOF-001: Tamper genesis proof signature (on both-data token)
C4-PROOF-002: Tamper merkle path (on both-data token)
```

**Current Status:** ⚠️ Partially covered
- SEC-RECV-CRYPTO-001, 002, 003 test proof integrity but only on C1
- Need variants on C2 and C4 to ensure proofs work with data-bearing tokens

---

## Missing Tests by Priority

### CRITICAL (Must Have)

| Scenario | Test ID Needed | Reason | Impact |
|----------|----------------|--------|--------|
| Tamper genesis.data.tokenData | C2/C3/C4-GENSIG | Transaction signature protection | HIGH |
| Tamper recipientDataHash | C2/C4-HASH | State commitment binding | HIGH |
| Hash mismatch with state.data | C2/C4-HASH | Data integrity validation | HIGH |
| Verify both protections work together | C4-BOTH | Real-world use case | MEDIUM |

### HIGH (Should Have)

| Scenario | Test ID Needed | Reason | Impact |
|----------|----------------|--------|--------|
| Proof tampering on data tokens | C2/C4-PROOF | Merkle validation with data | MEDIUM |
| Genesis data immutability | C3-IMMUTABLE | Prevent data modification | MEDIUM |
| State.data presence/absence validation | C3/C4-PRESENCE | Prevent unauthorized changes | MEDIUM |

### MEDIUM (Nice to Have)

| Scenario | Test ID Needed | Reason | Impact |
|----------|----------------|--------|--------|
| Multiple field tampering on data tokens | C4-MULTI | Comprehensive attack simulation | LOW |
| Data size variations | C2/C4-SIZES | Boundary condition testing | LOW |
| Special characters in data | C2/C4-CHARS | Input sanitization with data | LOW |

---

## Test Implementation Checklist

### New Test File: `test_data_combinations.bats`

- [ ] Setup common data generation helpers
- [ ] C3 Test Suite (Genesis Data Only):
  - [ ] C3-001: Create token with genesis data
  - [ ] C3-002: Verify genesis.data.tokenData stored correctly
  - [ ] C3-003: Tamper genesis.data.tokenData, verify rejection
  - [ ] C3-004: Verify state.data remains minimal/empty
  - [ ] C3-005: Transfer genesis-data token, verify data preserved
- [ ] C4 Test Suite (Both Data Types):
  - [ ] C4-001: Create token with both genesis and state data
  - [ ] C4-002: Tamper genesis.data.tokenData, verify rejection
  - [ ] C4-003: Tamper state.data, verify rejection
  - [ ] C4-004: Verify independent detection of tampering
  - [ ] C4-005: Cross-field tampering detection
  - [ ] C4-006: Verify transaction history preserves both data types

### Enhance Existing Tests

**test_receive_token_crypto.bats:**
- [ ] SEC-RECV-CRYPTO-004: Add C1 variant (try adding data to no-data token)
- [ ] SEC-RECV-CRYPTO-004: Add C4 variant (data-bearing token)
- [ ] Add recipientDataHash tampering to SEC-RECV-CRYPTO-007

**test_send_token_crypto.bats:**
- [ ] SEC-SEND-CRYPTO-004: Add C1 variant
- [ ] SEC-SEND-CRYPTO-004: Add C4 variant

**test_data_integrity.bats:**
- [ ] SEC-INTEGRITY-002: Add recipientDataHash tampering test
- [ ] Add C2 and C4 variants to state hash mismatch tests

### New Test File: `test_recipientDataHash.bats`

- [ ] HAH-001: Tamper recipientDataHash on C2 token
- [ ] HAH-002: Set recipientDataHash to all zeros
- [ ] HAH-003: Set recipientDataHash to null
- [ ] HAH-004: Hash mismatch detection on receive-token
- [ ] HAH-005: Hash mismatch detection on send-token
- [ ] HAH-006: Verify hash matches state.data (C2 token)

---

## Quick Implementation Guide

### To Create a C3 Test Token
```bash
# Create with genesis data only
SECRET="test" npm run mint-token -- --preset nft --local -d '{"metadata":"value"}' --save

# This creates C3 because:
# - genesis.data.tokenData = hex-encoded JSON
# - state.data = same value (not transferred yet)
# - Token is saved without any transfers

# Note: C3 and C2 are created the SAME way
# Difference is whether the token has been transferred
```

### To Create a C4 Test Token
```bash
# Step 1: Create with metadata
SECRET="alice" npm run mint-token -- --preset nft --local -d '{"metadata":"value"}' -o alice.txf

# Step 2: Generate recipient
SECRET="bob" npm run gen-address -- --preset nft
# Note recipient address from output

# Step 3: Transfer (creates C4 state)
SECRET="alice" npm run send-token -- -f alice.txf -r "DIRECT://..." --local -o transfer.txf

# Step 4: Bob receives
SECRET="bob" npm run receive-token -- -f transfer.txf --local -o bob.txf

# Now bob.txf is C4:
# - genesis.data.tokenData = original metadata
# - state.data = (may be same or different depending on implementation)
# - genesis.transaction.recipientDataHash = commitment to original state.data
```

### To Test RecipientDataHash Tampering
```bash
# Start with C2 token
jq '.genesis.transaction.recipientDataHash = "0000000000000000000000000000000000000000000000000000000000000000"' \
  token.txf > tampered.txf

# Verify it fails
SECRET="bob" npm run receive-token -- -f tampered.txf --local
# Expected: FAIL with hash/mismatch error

# Check error message contains reference to hash
npm run receive-token -- -f tampered.txf --local 2>&1 | grep -i "hash\|mismatch"
```

---

## Summary Statistics

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Combinations covered | 2/4 | 4/4 | -2 |
| Tests for C1 | 28 | 25-28 | ✅ |
| Tests for C2 | 2 | 8-10 | -6 |
| Tests for C3 | 0 | 3-5 | -3-5 |
| Tests for C4 | 0 | 4-6 | -4-6 |
| RecipientDataHash tests | 0 | 4-6 | -4-6 |
| Genesis data tampering | 1 | 4-6 | -3-5 |
| **Total Coverage** | **30** | **55-70** | **-25-40** |

---

## Actionable Next Steps

### Immediate (Do First)
1. Create `test_data_combinations.bats` with C3 and C4 test suites
2. Create `test_recipientDataHash.bats` with explicit hash tampering tests
3. Add missing recipientDataHash tampering to SEC-INTEGRITY-002

### Short Term (Do Next)
1. Enhance SEC-RECV-CRYPTO-004 with C1 and C4 variants
2. Enhance SEC-SEND-CRYPTO-004 with C1 and C4 variants
3. Add genesis data tampering tests

### Medium Term (Enhancement)
1. Add cross-field tampering scenarios
2. Add data size boundary tests
3. Update test documentation

---

## Verification Checklist

Once new tests are added, verify:

- [ ] All 4 combinations (C1, C2, C3, C4) have explicit test cases
- [ ] Each combination tests at least 3 tampering scenarios
- [ ] RecipientDataHash tampering is explicitly tested
- [ ] Genesis.data.tokenData tampering is explicitly tested
- [ ] State.data tampering is tested on all combinations
- [ ] Error messages are appropriate for each tampering type
- [ ] No false positives (valid tokens pass)
- [ ] No false negatives (tampering always detected)
- [ ] Tests document which data field provides protection
- [ ] Coverage report shows all 4 combinations

