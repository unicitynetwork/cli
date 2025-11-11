# State Hash Verification - Implementation Guide

## Quick Summary

Add state hash integrity check to `validateTokenProofs()` function to detect token tampering.

**File**: `/home/vrogojin/cli/src/utils/proof-validation.ts`
**Function**: `validateTokenProofs()` at line 191
**Insert Location**: After line 228 (after genesis proof structure checks)

---

## The Code to Add

```typescript
  // 2.5. CRITICAL: Verify state hash matches authenticator
  // This detects tampering with token state after proof creation
  if (genesisProof.authenticator && genesisProof.authenticator.stateHash) {
    try {
      // Compute actual state hash from current token state
      const actualStateHash = await token.state.calculateHash();
      const expectedStateHash = genesisProof.authenticator.stateHash;

      // Compare hashes
      if (!expectedStateHash.equals(actualStateHash)) {
        errors.push(
          `Genesis state hash mismatch - state has been tampered with. ` +
          `Expected: ${expectedStateHash.toString()}, ` +
          `Actual: ${actualStateHash.toString()}`
        );
      }
    } catch (err) {
      errors.push(
        `Failed to verify genesis state hash: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
```

---

## Exact Location

**Before** (current code at line 228):
```typescript
  if (!genesisProof.unicityCertificate) {
    errors.push('Genesis proof missing unicity certificate');
  }

  // 3. Validate all transaction proofs  ← INSERT NEW CODE HERE
  if (token.transactions && token.transactions.length > 0) {
```

**After** (with fix):
```typescript
  if (!genesisProof.unicityCertificate) {
    errors.push('Genesis proof missing unicity certificate');
  }

  // 2.5. CRITICAL: Verify state hash matches authenticator
  // This detects tampering with token state after proof creation
  if (genesisProof.authenticator && genesisProof.authenticator.stateHash) {
    try {
      // Compute actual state hash from current token state
      const actualStateHash = await token.state.calculateHash();
      const expectedStateHash = genesisProof.authenticator.stateHash;

      // Compare hashes
      if (!expectedStateHash.equals(actualStateHash)) {
        errors.push(
          `Genesis state hash mismatch - state has been tampered with. ` +
          `Expected: ${expectedStateHash.toString()}, ` +
          `Actual: ${actualStateHash.toString()}`
        );
      }
    } catch (err) {
      errors.push(
        `Failed to verify genesis state hash: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // 3. Validate all transaction proofs
  if (token.transactions && token.transactions.length > 0) {
```

---

## Why This Works

1. **TokenState.calculateHash()** - SDK method that computes SHA-256 hash of current state
2. **Authenticator.stateHash** - Expected hash stored in genesis proof at mint time
3. **DataHash.equals()** - Cryptographically compares the two hashes
4. **Error on mismatch** - Detects any tampering with state.data or state.predicate

---

## Testing the Fix

### Manual Test
```bash
# Build with fix
npm run build

# Create valid token
SECRET="test" npm run mint-token -- --local -o test-token.txf

# Verify original (should pass)
npm run verify-token -- -f test-token.txf --local
# Expected: exit 0, "✅ This token is valid"

# Tamper with state
jq '.state.data = "deadbeef"' test-token.txf > tampered.txf

# Verify tampered (should fail)
npm run verify-token -- -f tampered.txf --local
# Expected: exit 1, "Genesis state hash mismatch - state has been tampered with"
```

### Automated Tests
```bash
# Run failing security tests
bats tests/security/test_access_control.bats -f "SEC-ACCESS-003"
bats tests/security/test_data_integrity.bats -f "SEC-INTEGRITY-002"

# Both should now PASS
```

---

## What This Fixes

### Test: SEC-ACCESS-003 (Token File Modification Detection)
**Attack**: Modify token state after mint
```bash
jq '.state.data = "deadbeef"' token.txf > modified.txf
```
**Before Fix**: verify-token says valid (BUG)
**After Fix**: verify-token detects mismatch, exits 1

### Test: SEC-INTEGRITY-002 (State Hash Mismatch Detection)
**Attack**: Modify state.data or state.predicate with original proof
**Before Fix**: Proof signature valid, state hash not checked (BUG)
**After Fix**: State hash mismatch detected, exits 1

---

## No New Dependencies

All required classes already imported:
- `Token` - already used
- `TokenState` - accessed via `token.state`
- `DataHash` - returned by `calculateHash()`

---

## Security Impact

- Prevents false confidence in tampered tokens
- Aligns client-side validation with server-side checks
- Provides clear error messages for debugging
- Closes security gap in SEC-ACCESS and SEC-INTEGRITY test suites

---

## Quick Reference: SDK Methods

```typescript
// Compute state hash
const stateHash: DataHash = await token.state.calculateHash();

// Get expected hash from proof
const expectedHash: DataHash = token.genesis.inclusionProof.authenticator.stateHash;

// Compare hashes
const isValid: boolean = expectedHash.equals(stateHash);

// Convert to string for error messages
const hashString: string = stateHash.toString();
// Example: "00000beb86f1f1c3d022164b7d447f78c5c53ccd1326a6e041ee75239b21f11dd17a"
```

---

## Implementation Checklist

- [ ] Open `/home/vrogojin/cli/src/utils/proof-validation.ts`
- [ ] Find line 228 (after `errors.push('Genesis proof missing unicity certificate')`)
- [ ] Insert the 19-line code block shown above
- [ ] Save file
- [ ] Run `npm run build` to compile TypeScript
- [ ] Test with manual tampered token (should fail verification)
- [ ] Run `bats tests/security/test_access_control.bats -f "SEC-ACCESS-003"` (should pass)
- [ ] Run `bats tests/security/test_data_integrity.bats -f "SEC-INTEGRITY-002"` (should pass)
- [ ] Run full security suite: `npm run test:security`

