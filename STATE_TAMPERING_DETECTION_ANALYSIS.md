# State Tampering Detection Analysis

## Executive Summary

**CRITICAL FINDING**: The current `verify-token` command **CANNOT detect state data tampering** in minted tokens. If an attacker modifies `state.data` in a TXF file while keeping proofs unchanged, all current validations pass.

**Root Cause**: The predicate signature is NOT computed over the token state data. It is computed over the **transaction data** during transfer operations, not during mint validation.

---

## Attack Scenario

### Scenario: State Data Tampering

```bash
# Step 1: Mint token with empty state.data
SECRET="test" npm run mint-token -- --local --save
# Creates: state.data = ""

# Step 2: Attacker tampers with TXF file
# Manually edit token.txf and change:
#   state.data: "" → "deadbeef"

# Step 3: Verify tampered token
npm run verify-token -- -f token.txf

# RESULT: All validations PASS ✅ (this is the bug!)
# ✅ Genesis proof signature is valid
# ✅ Merkle path verification passes
# ✅ Token loads with SDK successfully
# ✅ Authenticator signature verified
```

### Why This Works (The Security Gap)

The genesis proof's authenticator signature covers:
- Transaction hash (from `MintTransactionData`)
- State hash of **source state** (for mint: SHA256(tokenId || "MINT"))

The genesis proof does NOT cover:
- The **recipient's final TokenState**
- The `state.data` field in the TXF file

---

## Code Analysis

### 1. What TokenState Hash Covers

**Location**: `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/token/TokenState.js:71-73`

```javascript
calculateHash() {
    return new DataHasher(HashAlgorithm.SHA256).update(this.toCBOR()).digest();
}
```

The `TokenState.calculateHash()` includes:
- **Predicate** (public key, signature, nonce)
- **State data** (`this._data`)

This hash is computed over the CBOR structure: `[predicate, data]`

### 2. What Genesis Proof Covers

**Location**: `/home/vrogojin/cli/src/utils/proof-validation.ts:229-238`

```typescript
// NOTE: For genesis (mint) transactions, we CANNOT verify state hash by comparing
// token.state.calculateHash() with genesis.authenticator.stateHash because:
// - authenticator.stateHash = Hash of MintTransactionState (source state: SHA256(tokenId || "MINT"))
// - token.state.calculateHash() = Hash of recipient's final TokenState
// These are intentionally different - the mint creates a NEW state from an "empty" source.
```

The genesis authenticator signature covers:
- Transaction hash (mint transaction data)
- **Source state hash** = `SHA256(tokenId || "MINT")`

**It does NOT cover the recipient's final state data!**

### 3. What Predicate Verify Checks

**Location**: `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/predicate/embedded/DefaultPredicate.js:72-90`

```javascript
async verify(trustBase, token, transaction) {
    // 1. Verify token ID and type match
    if (!this.tokenId.equals(token.id) || !this.tokenType.equals(token.type)) {
        return false;
    }
    
    // 2. Verify authenticator exists and public key matches
    const authenticator = transaction.inclusionProof.authenticator;
    if (authenticator == null) {
        return false;
    }
    if (!areUint8ArraysEqual(authenticator.publicKey, this.publicKey)) {
        return false;
    }
    
    // 3. Verify signature covers transaction data
    const transactionHash = await transaction.data.calculateHash();
    if (!(await authenticator.verify(transactionHash))) {
        return false;
    }
    
    // 4. Verify inclusion proof merkle path
    const requestId = await RequestId.create(
        this.publicKey, 
        await transaction.data.sourceState.calculateHash()  // SOURCE state, not CURRENT state!
    );
    const status = await transaction.inclusionProof.verify(trustBase, requestId);
    return status == InclusionProofVerificationStatus.OK;
}
```

**Key Insight**: `predicate.verify()` is designed for **TRANSFER transactions**, where:
- It verifies the signature covers the **source state** (previous owner's state)
- It does NOT verify the **destination state** (new owner's state)

For **MINT transactions**, there is no "previous owner", so the source state is synthetic (`SHA256(tokenId || "MINT")`).

---

## Security Implications

### What CAN Be Tampered

1. **State data** (`state.data`) - This is the vulnerability
2. State data could be:
   - Changed from empty to arbitrary bytes
   - Modified JSON metadata
   - Altered token attributes

### What CANNOT Be Tampered

1. **Token ID** - Covered by predicate structure
2. **Token Type** - Covered by predicate structure
3. **Owner public key** - Embedded in predicate, verified by signature
4. **Inclusion proofs** - Verified via Merkle path
5. **Authenticator signatures** - Cryptographically verified

### Impact Assessment

**Severity**: Medium to High (depends on use case)

**Attack Surface**:
- An attacker with access to a TXF file can modify `state.data`
- The tampered token passes all current validation checks
- If the recipient trusts `state.data` (e.g., for metadata, attributes), they can be deceived

**Real-World Example**:
- NFT with metadata in `state.data`: `{"image": "https://legit-nft.com/1.png"}`
- Attacker changes to: `{"image": "https://evil-site.com/phishing.png"}`
- Victim sees the tampered metadata and trusts it

---

## Why This Happens: Architectural Design

### The Unicity Protocol Design

The Unicity protocol uses a **state transition model**:
1. Each transaction creates a NEW state from an OLD state
2. Proofs cover the **transition** (from state A → state B)
3. The authenticator signs over the **source state hash**

### For Mint Transactions

**Source state**: Synthetic "empty" state = `SHA256(tokenId || "MINT")`  
**Destination state**: The recipient's new `TokenState(predicate, data)`

The genesis proof verifies:
- The mint transaction was included in the blockchain
- The source state hash matches the synthetic mint source
- The transaction data (tokenId, tokenType, recipient) is signed

**BUT**: The proof does NOT verify what `state.data` the recipient received!

### For Transfer Transactions

**Source state**: Previous owner's `TokenState`  
**Destination state**: New owner's `TokenState`

The transfer proof verifies:
- The previous owner signed the transaction
- The source state hash (previous owner's state) is correct
- The merkle path proves inclusion

**BUT**: The proof does NOT verify the destination state either!

---

## Current Validation Gaps

### What verify-token Currently Checks

File: `/home/vrogojin/cli/src/commands/verify-token.ts`

1. **Structural validation** (lines 247-266):
   - Genesis proof has authenticator ✓
   - Transaction proofs have authenticators ✓
   - Merkle paths exist ✓

2. **Cryptographic validation** (lines 279-307):
   - Genesis proof signature valid ✓
   - Genesis merkle path valid ✓
   - Transaction proof signatures valid ✓

3. **Ownership status** (lines 339-385):
   - Query aggregator for spent/unspent status ✓

### What verify-token DOES NOT Check

1. **State hash consistency**: Does `token.state.calculateHash()` match any verified hash?
2. **State data integrity**: Has `state.data` been tampered with?
3. **Predicate binding**: Is the predicate correctly bound to the state?

---

## Why Traditional Predicate Verification Doesn't Help

### Attempt 1: Call predicate.verify()

```typescript
// In verify-token.ts
const predicate = token.state.predicate;
const isValid = await predicate.verify(trustBase, token, token.genesis);
```

**Problem**: This checks:
- If the genesis transaction signature is valid ✓
- If the merkle path is correct ✓
- **BUT**: It verifies the SOURCE state hash, not the CURRENT state hash!

For minted tokens, source state = `SHA256(tokenId || "MINT")`, which has nothing to do with `state.data`.

### Attempt 2: Compare state hash with authenticator.stateHash

```typescript
// In verify-token.ts
const currentStateHash = await token.state.calculateHash();
const genesisStateHash = token.genesis.inclusionProof.authenticator.stateHash;
if (!areEqual(currentStateHash, genesisStateHash)) {
    throw new Error('State hash mismatch!');
}
```

**Problem**: This ALWAYS fails for minted tokens!
- `currentStateHash` = Hash of `TokenState(predicate, data)` (the DESTINATION state)
- `genesisStateHash` = Hash of synthetic mint source state (the SOURCE state)

These are **intentionally different** by design.

---

## Possible Solutions

### Solution 1: Verify State Hash Against Transaction Data (RECOMMENDED)

For mint transactions, the `MintTransactionData` contains the original `tokenData` that was minted.

**Implementation**:
```typescript
// In verify-token.ts, for genesis validation
if (token.genesis && token.genesis.data) {
    const mintedData = token.genesis.data.tokenData; // Original data from mint
    const currentData = token.state.data;            // Current data in TXF
    
    if (!areEqual(mintedData, currentData)) {
        errors.push('State data does not match genesis mint data - possible tampering!');
    }
}
```

**Pros**:
- Simple to implement
- Covers mint transactions
- Detects tampering immediately

**Cons**:
- Only works for mint transactions (no source transaction data for transfers)
- Assumes genesis.data.tokenData is trusted

### Solution 2: Validate Complete Transaction Chain

For tokens with transfer history, verify that each state transition is consistent:

```typescript
// Verify genesis → first transaction consistency
const genesisResultState = computeResultingState(token.genesis);
const firstTransactionSourceState = token.transactions[0].data.sourceState;

if (!statesMatch(genesisResultState, firstTransactionSourceState)) {
    errors.push('Transaction chain broken: genesis result ≠ first transfer source');
}

// Verify transaction[i] → transaction[i+1] consistency
for (let i = 0; i < token.transactions.length - 1; i++) {
    const txResultState = computeResultingState(token.transactions[i]);
    const nextTxSourceState = token.transactions[i+1].data.sourceState;
    
    if (!statesMatch(txResultState, nextTxSourceState)) {
        errors.push(`Transaction chain broken at transfer ${i+1}`);
    }
}
```

**Pros**:
- Detects tampering at any point in transaction history
- Works for both mint and transfer scenarios

**Cons**:
- Complex to implement (need to compute resulting states)
- Requires understanding of SDK transaction data structures
- May not cover all edge cases

### Solution 3: Add State Hash to Predicate Signature (SDK Change)

**This would require SDK modification** - not feasible for CLI-only fix.

The SDK could be modified to include the destination state hash in the authenticator signature. This is a protocol-level change.

### Solution 4: Document the Limitation

If tampering detection is not critical for the current use case, document the limitation:

```typescript
// In verify-token.ts
console.warn('⚠️  WARNING: State data integrity cannot be fully verified');
console.warn('   The genesis proof covers the mint transaction, but not the final state data.');
console.warn('   If state.data has been tampered with, it cannot be detected without comparing');
console.warn('   against the original mint transaction data.');
```

---

## Recommended Implementation Plan

### Phase 1: Immediate Fix (30 minutes)

Add genesis state data validation to `verify-token`:

```typescript
// File: src/commands/verify-token.ts
// Location: After line 314 (inside try block after token loads)

// NEW: Validate state data matches genesis mint data
if (token && token.genesis && token.genesis.data) {
    console.log('\n=== State Data Integrity Check ===');
    
    const genesisData = token.genesis.data.tokenData 
        ? HexConverter.decode(token.genesis.data.tokenData) 
        : new Uint8Array(0);
    const currentData = token.state.data || new Uint8Array(0);
    
    if (!areEqual(genesisData, currentData)) {
        console.log('❌ STATE TAMPERING DETECTED!');
        console.log(`  Genesis minted data: ${HexConverter.encode(genesisData)}`);
        console.log(`  Current state data:  ${HexConverter.encode(currentData)}`);
        errors.push('State data has been tampered with after minting');
        exitCode = 1;
    } else {
        console.log('✅ State data matches genesis mint data');
    }
}
```

### Phase 2: Enhanced Validation (1-2 hours)

Add full transaction chain validation to detect tampering in transfer history.

### Phase 3: Documentation (30 minutes)

Document the security model:
- What proofs verify (source state transitions)
- What proofs don't verify (destination state integrity)
- How users can protect against tampering (trust TXF sources)

---

## Testing Plan

### Test Case 1: Tampered Genesis State Data

```bash
# 1. Mint token with data
SECRET="test" npm run mint-token -- --local -d "original data" --save

# 2. Manually tamper with TXF
# Edit state.data: "original data" → "tampered data"

# 3. Verify token
npm run verify-token -- -f token.txf
# EXPECTED: ❌ STATE TAMPERING DETECTED!
```

### Test Case 2: Legitimate Token

```bash
# 1. Mint token
SECRET="test" npm run mint-token -- --local -d "legit data" --save

# 2. Verify token (no tampering)
npm run verify-token -- -f token.txf
# EXPECTED: ✅ All validations pass
```

### Test Case 3: Tampered Transfer History

```bash
# 1. Mint and transfer token
SECRET="alice" npm run mint-token -- --local -d "data" --save
SECRET="bob" npm run gen-address > bob-addr.json
SECRET="alice" npm run send-token -- -f token.txf -r "$(cat bob-addr.json)" --save

# 2. Tamper with TXF after transfer
# Edit state.data in final TXF

# 3. Verify token
npm run verify-token -- -f token.txf
# EXPECTED: ❌ STATE TAMPERING DETECTED! (if transfer chain validation implemented)
```

---

## Questions Answered

> 1. Does the predicate signature cover the TokenState?

**Answer**: No. The predicate signature covers the **source state** (previous owner's state) during transfers. For mints, it covers the synthetic source state `SHA256(tokenId || "MINT")`, which has no relation to the final `TokenState`.

> 2. If I change `state.data` after minting, should predicate verification fail?

**Answer**: No, it won't fail with current SDK design. The predicate's `verify()` method checks:
- Source state hash (for mint: the synthetic "MINT" source)
- Transaction signature
- Merkle path

None of these depend on the destination `state.data`.

> 3. Is there a method to verify the predicate against the current state?

**Answer**: Not directly. The SDK's `predicate.verify()` is designed for validating **state transitions** (from old state → new state), not for validating the current state's integrity. You must manually compare `token.state.data` with `token.genesis.data.tokenData`.

> 4. Should I be calling `predicate.verify()` in verify-token?

**Answer**: Yes, but it's not sufficient. You should:
1. Call `predicate.verify()` to ensure the genesis transaction is valid
2. **ALSO** compare `state.data` with `genesis.data.tokenData` to detect tampering

---

## Security Model Summary

### What Unicity Proofs Guarantee

1. **Transaction inclusion**: The mint/transfer was recorded in the blockchain
2. **Signature validity**: The transaction was signed by the correct key
3. **Source state correctness**: The transaction consumed the correct previous state
4. **Merkle path integrity**: The proof is cryptographically sound

### What Unicity Proofs DON'T Guarantee

1. **Destination state integrity**: The resulting state data is correct
2. **State data tampering**: If someone modifies the TXF file, it's not detected by proofs alone
3. **Metadata accuracy**: Any data stored in `state.data` must be validated separately

### User Responsibilities

1. **Trust TXF sources**: Only accept TXF files from trusted origins
2. **Validate state data**: Check that `state.data` matches expected values for your use case
3. **Compare with genesis**: For minted tokens, verify `state.data` matches the original mint
4. **Protect TXF files**: Treat TXF files like sensitive credentials (they represent ownership)

---

## Conclusion

**The current verify-token command has a security gap**: it cannot detect state data tampering in minted tokens.

**Recommended fix**: Add validation that compares `token.state.data` with `token.genesis.data.tokenData` for genesis transactions.

**Long-term solution**: Educate users about the Unicity security model and implement comprehensive transaction chain validation.
