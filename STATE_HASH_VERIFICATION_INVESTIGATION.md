# State Hash Integrity Verification Investigation

## Executive Summary

**Problem**: Tests SEC-ACCESS-003 and SEC-INTEGRITY-002 modify token state (`state.data` or `state.predicate`) while keeping the original inclusion proof. The `authenticator.stateHash` no longer matches the actual state, but verify-token doesn't detect this tampering.

**Root Cause**: verify-token performs:
- ✅ Proof structure validation (authenticator exists)
- ✅ Signature verification (authenticator.signature matches transactionHash)
- ✅ Merkle path verification (path leads to root)
- ❌ **MISSING**: State hash integrity check (authenticator.stateHash matches actual state)

**Solution**: Add state hash verification to `validateTokenProofs()` in `/home/vrogojin/cli/src/utils/proof-validation.ts`

---

## Understanding the Attack Vector

### Valid Token Structure
```json
{
  "genesis": {
    "inclusionProof": {
      "authenticator": {
        "stateHash": "00000beb86f1f1c3d022164b7d447f78c5c53ccd1326a6e041ee75239b21f11dd17a"
      }
    }
  },
  "state": {
    "data": "",
    "predicate": "8300410058b5..."
  }
}
```

**Authenticator.stateHash** = SHA256(state.data + state.predicate)

### Attack Scenario
1. **Attacker modifies state.data**: `"" → "deadbeef"`
2. **Attacker keeps original proof**: stateHash still says "00000beb86..."
3. **Actual state hash**: Now computes to different value
4. **Expected behavior**: verify-token should detect mismatch and FAIL
5. **Current behavior**: verify-token checks signature but NOT state hash → PASS (BUG)

---

## SDK API Analysis

### Key Classes and Methods

#### 1. TokenState Class
**Location**: `@unicitylabs/state-transition-sdk/lib/token/TokenState.d.ts`

```typescript
export declare class TokenState {
    readonly predicate: ISerializablePredicate;
    private readonly _data: Uint8Array | null;
    
    constructor(predicate: ISerializablePredicate, _data: Uint8Array | null);
    
    get data(): Uint8Array | null;
    
    /**
     * Calculate current state hash.
     * @return state hash
     */
    calculateHash(): Promise<DataHash>;
    
    static fromJSON(input: unknown): TokenState;
    toCBOR(): Uint8Array;
    toJSON(): ITokenStateJson;
}
```

**Key Method**: `calculateHash(): Promise<DataHash>`
- Computes SHA-256 hash of the token state
- Returns `DataHash` object with algorithm and hash bytes

#### 2. DataHash Class
**Location**: `@unicitylabs/state-transition-sdk/lib/hash/DataHash.d.ts`

```typescript
export declare class DataHash {
    readonly algorithm: HashAlgorithm;
    private readonly _data: Uint8Array;
    
    get data(): Uint8Array;  // Raw hash bytes
    get imprint(): Uint8Array;  // Algorithm ID + hash bytes
    
    equals(hash: DataHash): boolean;  // Compare two hashes
    toString(): string;  // Hex representation
    
    static fromJSON(data: string): DataHash;
}
```

**Key Method**: `equals(hash: DataHash): boolean`
- Compares two hashes for equality
- Returns true if algorithm and data match

#### 3. Authenticator Class
**Location**: `@unicitylabs/state-transition-sdk/lib/api/Authenticator.d.ts`

```typescript
export declare class Authenticator {
    readonly algorithm: string;
    private readonly _publicKey: Uint8Array;
    readonly signature: Signature;
    readonly stateHash: DataHash;  // ← THIS IS WHAT WE NEED TO CHECK
    
    verify(transactionHash: DataHash): Promise<boolean>;
    calculateRequestId(): Promise<RequestId>;
}
```

**Key Field**: `stateHash: DataHash`
- Contains the expected state hash at time of proof creation
- Should match `token.state.calculateHash()`

---

## Verification Strategy

### What to Verify

For **genesis transaction**:
```typescript
// Expected hash (in proof)
const expectedHash = token.genesis.inclusionProof.authenticator.stateHash;

// Actual hash (computed from current state)
const actualHash = await token.state.calculateHash();

// They must match
if (!expectedHash.equals(actualHash)) {
  errors.push('Genesis state hash mismatch - state has been tampered');
}
```

For **transfer transactions** (if any):
```typescript
// Each transaction should have led to a new state
// The proof's stateHash should match the state after that transaction
// This is more complex and may require reconstructing intermediate states

// For now, we focus on genesis validation since that catches the test scenarios
```

### When Token.fromJSON() is Called

**Question**: Does `Token.fromJSON()` already validate state hash?

**Answer**: Let me check by examining the test behavior:
- Tests modify state, keep proof
- Tests load token with `Token.fromJSON()` (implicit in verify-token)
- Tests expect verify-token to FAIL
- Currently verify-token PASSES → Token.fromJSON() does NOT validate state hash

**Conclusion**: SDK loads token without state hash validation. CLI must add this check.

---

## Implementation Solution

### Location
File: `/home/vrogojin/cli/src/utils/proof-validation.ts`
Function: `validateTokenProofs(token: Token<any>, trustBase?: RootTrustBase)`
Lines: 191-338

### Code to Add

Add after line 228 (after checking genesis proof structure), before signature verification:

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

### Full Modified Function

```typescript
export async function validateTokenProofs(
  token: Token<any>,
  trustBase?: RootTrustBase
): Promise<ProofValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate genesis transaction has inclusion proof
  if (!token.genesis) {
    errors.push('Token missing genesis transaction');
    return { valid: false, errors, warnings };
  }

  if (!token.genesis.inclusionProof) {
    errors.push('Genesis transaction missing inclusion proof');
    return { valid: false, errors, warnings };
  }

  // 2. Validate genesis inclusion proof structure
  const genesisProof = token.genesis.inclusionProof;

  if (genesisProof.authenticator === null) {
    errors.push('Genesis proof missing authenticator');
  }

  if (genesisProof.transactionHash === null) {
    errors.push('Genesis proof missing transaction hash');
  }

  if (!genesisProof.merkleTreePath) {
    errors.push('Genesis proof missing merkle tree path');
  }

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
    for (let i = 0; i < token.transactions.length; i++) {
      const tx = token.transactions[i];

      if (!tx.inclusionProof) {
        errors.push(`Transaction ${i + 1} missing inclusion proof`);
        continue;
      }

      const txProof = tx.inclusionProof;

      if (txProof.authenticator === null) {
        errors.push(`Transaction ${i + 1} proof missing authenticator`);
      }

      if (txProof.transactionHash === null) {
        errors.push(`Transaction ${i + 1} proof missing transaction hash`);
      }

      if (!txProof.merkleTreePath) {
        errors.push(`Transaction ${i + 1} proof missing merkle tree path`);
      }

      if (!txProof.unicityCertificate) {
        errors.push(`Transaction ${i + 1} proof missing unicity certificate`);
      }

      // Note: For transaction state hash verification, we would need to:
      // 1. Reconstruct the state after transaction i
      // 2. Compare with tx.inclusionProof.authenticator.stateHash
      // This is complex and left for future enhancement
      // Current genesis check catches the test scenarios
    }
  }

  // 4. Perform cryptographic verification on genesis proof
  if (trustBase && genesisProof.authenticator && genesisProof.transactionHash) {
    try {
      const isValid = await genesisProof.authenticator.verify(genesisProof.transactionHash);
      if (!isValid) {
        errors.push('Genesis proof authenticator signature verification failed');
      }
    } catch (err) {
      errors.push(`Genesis proof verification error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ... rest of function (merkle path verification, etc.)

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
```

---

## Test Scenarios Covered

### SEC-ACCESS-003: Token File Modification Detection

**Attack 1: Modify state.data**
```bash
jq '.state.data = "deadbeef"' token.txf > modified.txf
```
**Detection**: State hash mismatch
- Expected: 00000beb86f1f1c3d022164b7d447f78c5c53ccd1326a6e041ee75239b21f11dd17a
- Actual: (new hash from "deadbeef")
- Result: ❌ FAIL with "Genesis state hash mismatch"

**Attack 2: Modify state.predicate**
```bash
jq '.state.predicate = "ffff"' token.txf > modified.txf
```
**Detection**: State hash mismatch
- Predicate is part of state hash computation
- Result: ❌ FAIL with "Genesis state hash mismatch"

**Attack 3: Try to send modified token**
```bash
send-token -f modified.txf -r DIRECT://...
```
**Detection**: verify-token fails → send-token refuses to send
- Result: ❌ FAIL

### SEC-INTEGRITY-002: State Hash Mismatch Detection

**Attack 1: Modify state.data with original proof**
- Same as SEC-ACCESS-003 Attack 1
- Result: ❌ FAIL

**Attack 2: Modify state.predicate with original proof**
- Same as SEC-ACCESS-003 Attack 2
- Result: ❌ FAIL

**Attack 3: Modify genesis.data but not state**
```bash
jq '.genesis.data.tokenData = "aabbccdd"' token.txf > modified.txf
```
**Detection**: 
- Genesis data doesn't affect state hash directly
- BUT SDK Token.fromJSON() may fail to parse inconsistent token
- If it loads, state hash still matches (state unchanged)
- This might require additional validation (genesis consistency check)

---

## Implementation Steps

### Step 1: Add State Hash Import
No new imports needed - `DataHash` already used via `token.state.calculateHash()`

### Step 2: Add Validation Logic
Insert code after line 228 in `validateTokenProofs()` function

### Step 3: Test with Manual Verification
```bash
# Create token
SECRET="test" npm run mint-token -- --local -o token.txf

# Modify state
jq '.state.data = "deadbeef"' token.txf > tampered.txf

# Verify (should FAIL)
npm run verify-token -- -f tampered.txf --local
# Expected: "Genesis state hash mismatch - state has been tampered with"
```

### Step 4: Run Security Tests
```bash
npm run test:security
# Expected: SEC-ACCESS-003 and SEC-INTEGRITY-002 now PASS
```

---

## Edge Cases and Future Enhancements

### Edge Case 1: Transaction State Hashes
**Current**: Only validates genesis state hash
**Issue**: Transactions also have state hashes in their proofs
**Solution**: Would need to reconstruct intermediate states
**Priority**: Medium (genesis covers most tampering scenarios)

### Edge Case 2: SDK Token.fromJSON() Fails
**Current**: If state tampered so badly SDK can't parse
**Behavior**: verify-token shows "Could not load token with SDK"
**Result**: Already fails (exit code 1)
**Priority**: Low (already handled)

### Edge Case 3: Genesis Data Inconsistency
**Attack**: Modify genesis.data without changing state
**Current**: State hash still matches (state unchanged)
**Detection**: Requires separate genesis-to-state consistency check
**Priority**: Medium (less critical, affects metadata only)

### Future Enhancement: Full State Chain Verification
```typescript
// For each transaction, verify state hash chain
for (let i = 0; i < token.transactions.length; i++) {
  const tx = token.transactions[i];
  // Reconstruct state after transaction i
  const reconstructedState = reconstructStateAfterTx(token, i);
  const expectedHash = tx.inclusionProof.authenticator.stateHash;
  const actualHash = await reconstructedState.calculateHash();
  
  if (!expectedHash.equals(actualHash)) {
    errors.push(`Transaction ${i + 1} state hash mismatch`);
  }
}
```

---

## Security Impact

### Before Fix
- ⚠️ Attacker can modify token state after mint
- ⚠️ verify-token shows "valid" even though state tampered
- ⚠️ send-token might use tampered token
- ⚠️ Aggregator would reject (server-side validation)
- Result: Poor UX, false confidence in tampered tokens

### After Fix
- ✅ verify-token detects state tampering immediately
- ✅ Clear error message identifies state hash mismatch
- ✅ send-token refuses to use tampered token
- ✅ Client-side validation matches server expectations
- Result: Strong local integrity verification

### Severity
- **Risk**: MEDIUM (aggregator still validates, but CLI should catch early)
- **Priority**: HIGH (security test coverage requires this)
- **Impact**: 2 failing security tests → 2 passing tests

---

## Testing Strategy

### Unit Test (Manual)
```bash
# Test 1: Valid token passes
SECRET="test" npm run mint-token -- --local -o valid.txf
npm run verify-token -- -f valid.txf --local
# Expected: exit 0, "✅ This token is valid"

# Test 2: Modified state.data fails
jq '.state.data = "deadbeef"' valid.txf > tampered-data.txf
npm run verify-token -- -f tampered-data.txf --local
# Expected: exit 1, "Genesis state hash mismatch"

# Test 3: Modified state.predicate fails
jq '.state.predicate = "ffff"' valid.txf > tampered-pred.txf
npm run verify-token -- -f tampered-pred.txf --local
# Expected: exit 1, "Genesis state hash mismatch" (or SDK parse error)
```

### Integration Tests (BATS)
```bash
# Run specific failing tests
npm test tests/security/test_access_control.bats::SEC-ACCESS-003
npm test tests/security/test_data_integrity.bats::SEC-INTEGRITY-002

# Run full security suite
npm run test:security
```

---

## Recommendations

### Immediate Actions
1. ✅ Implement state hash verification in `validateTokenProofs()`
2. ✅ Test manually with tampered token
3. ✅ Run security test suite
4. ✅ Verify SEC-ACCESS-003 and SEC-INTEGRITY-002 pass

### Short-term Enhancements
1. Add genesis-to-state consistency validation
2. Improve error messages to distinguish types of tampering
3. Add diagnostic mode to show state hash comparison details

### Long-term Enhancements
1. Implement full transaction state chain verification
2. Add cryptographic audit log showing all state transitions
3. Consider adding state hash to verify-token output summary

---

## References

### SDK Documentation
- TokenState.calculateHash(): Computes SHA-256 of state
- DataHash.equals(): Compares two hash values
- Authenticator.stateHash: Expected state hash in proof

### Test Files
- `/home/vrogojin/cli/tests/security/test_access_control.bats` (SEC-ACCESS-003)
- `/home/vrogojin/cli/tests/security/test_data_integrity.bats` (SEC-INTEGRITY-002)

### CLI Files
- `/home/vrogojin/cli/src/utils/proof-validation.ts` (target for fix)
- `/home/vrogojin/cli/src/commands/verify-token.ts` (calls validateTokenProofs)

---

## Conclusion

The fix is straightforward:
1. Use existing SDK API: `token.state.calculateHash()`
2. Compare with proof: `genesisProof.authenticator.stateHash`
3. Add error if mismatch detected

This will close a critical security gap in local validation and align CLI behavior with aggregator-side verification.
