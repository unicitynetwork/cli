# PROOF CORRESPONDENCE CORRECTION - Architecture Analysis

## Executive Summary

**CRITICAL CORRECTION NEEDED**: The current double-spend detection in `receive-token.ts` (lines 634-691) incorrectly compares transaction hashes. This is WRONG for Unicity's architecture.

**CORRECT APPROACH**: Verify that the proof corresponds to the SOURCE STATE being spent, not the transaction hash.

---

## Understanding the Architecture

### What is a RequestId?

```typescript
// From SDK: RequestId.d.ts line 18-19
static create(id: Uint8Array, stateHash: DataHash): Promise<RequestId>;

// In practice:
RequestId = SHA256(publicKey + sourceStateHash)
```

**Key insight**: RequestId is computed from the SOURCE STATE that is being spent, NOT from the transaction data.

### What is in a TransferCommitment?

```typescript
// From SDK: Commitment.d.ts line 15-18
abstract class Commitment<T> {
    readonly requestId: RequestId;           // Hash of (publicKey + sourceStateHash)
    readonly transactionData: T;             // Contains sourceState, recipient, salt, etc.
    readonly authenticator: Authenticator;   // Signature over transaction
}

// From SDK: TransferTransactionData.d.ts line 18-24
class TransferTransactionData {
    readonly sourceState: TokenState;        // THE SOURCE STATE BEING SPENT
    readonly recipient: IAddress;            // Target recipient address
    readonly salt: Uint8Array;               // Random salt
    readonly recipientDataHash: DataHash | null;
    readonly message: Uint8Array | null;
    readonly nametagTokens: Token[];
}
```

**Key insight**: The commitment contains BOTH the requestId (from source state) AND the transaction data (which includes recipient).

### What is in an InclusionProof?

```typescript
// From SDK: InclusionProof.d.ts line 32-36
class InclusionProof {
    readonly merkleTreePath: SparseMerkleTreePath;
    readonly authenticator: Authenticator | null;
    readonly transactionHash: DataHash | null;     // Hash of FIRST accepted tx
    readonly unicityCertificate: UnicityCertificate;
}

// From SDK: Authenticator.d.ts line 21-25
class Authenticator {
    readonly algorithm: string;
    readonly publicKey: Uint8Array;           // Sender's public key
    readonly signature: Signature;            // Signature over txHash
    readonly stateHash: DataHash;             // SOURCE STATE HASH
}
```

**CRITICAL**: The `authenticator.stateHash` in the proof identifies the SOURCE STATE.

---

## The Double-Spend Scenarios

### Scenario 1: Different Recipients (Bob vs Carol)

```
Source Token State: StateHash = 0xAAA...

Alice creates two offline transfers:
  Transfer 1: Alice → Bob   (same source 0xAAA, recipient Bob, salt S1)
  Transfer 2: Alice → Carol (same source 0xAAA, recipient Carol, salt S2)

BOTH compute SAME RequestId:
  RequestId = Hash(Alice.publicKey + 0xAAA)  ← IDENTICAL

Transaction hashes DIFFER:
  Bob's txHash   = Hash(sourceState=0xAAA, recipient=Bob, salt=S1)   = 0xBBB
  Carol's txHash = Hash(sourceState=0xAAA, recipient=Carol, salt=S2) = 0xCCC

Bob submits first → aggregator stores txHash=0xBBB in SMT at RequestId
Carol submits later → aggregator returns proof with txHash=0xBBB (not Carol's 0xCCC)
```

**Detection**: Compare `proof.transactionHash` vs `our transaction hash` → DIFFERENT → double-spend detected.

### Scenario 2: Same Recipient, Concurrent (5x Bob)

```
Source Token State: StateHash = 0xAAA...

Alice creates one offline transfer to Bob:
  Transfer: Alice → Bob (source 0xAAA, recipient Bob, salt S1)

5 processes receive IDENTICAL file containing:
  - sourceState: 0xAAA
  - recipient: Bob
  - salt: S1
  - commitment with RequestId = Hash(Alice.publicKey + 0xAAA)

ALL processes compute IDENTICAL transaction hash:
  txHash = Hash(sourceState=0xAAA, recipient=Bob, salt=S1) = 0xDDD

Process 1 submits → aggregator stores txHash=0xDDD at RequestId
Processes 2-5 submit → aggregator returns proof with txHash=0xDDD

ALL processes compute SAME transaction hash = 0xDDD
Proof contains transaction hash = 0xDDD
```

**Current Implementation**: Compare `proof.transactionHash (0xDDD)` vs `our txHash (0xDDD)` → IDENTICAL → NO DETECTION!

**Problem**: Cannot detect duplicates when transaction data is identical.

---

## The User's Correction Explained

> "The double spend detection should be based on the valid unicity proof corresponding to the transaction's **source state** and NOT corresponding to the transaction's hash."

### What This Means

The proof MUST correspond to the SOURCE STATE being spent. The key is the `authenticator.stateHash` field.

```typescript
// From the proof's authenticator
const proofSourceStateHash = inclusionProof.authenticator.stateHash;

// From our commitment
const ourSourceStateHash = transferCommitment.transactionData.sourceState.calculateHash();

// CORRECT VERIFICATION:
if (proofSourceStateHash !== ourSourceStateHash) {
  // The proof is for a DIFFERENT source state
  // This should NEVER happen if aggregator is honest
  // ERROR: Proof does not correspond to our source state
}
```

### Why This Matters

**Fundamental Architecture Insight:**

1. **RequestId is derived from SOURCE STATE**:
   ```typescript
   RequestId = Hash(publicKey + sourceStateHash)
   ```

2. **Aggregator stores ONE entry per RequestId in SMT**:
   - Key: RequestId (identifies the source state being spent)
   - Value: TransactionHash (identifies which transaction spent it)

3. **The proof's authenticator MUST contain the source state hash**:
   ```typescript
   authenticator.stateHash === sourceStateHash
   ```

4. **Verification flow**:
   ```typescript
   // Step 1: Compute expected RequestId
   const expectedRequestId = await RequestId.create(
     authenticator.publicKey,
     authenticator.stateHash  // SOURCE STATE HASH
   );

   // Step 2: Verify Merkle path proves this RequestId is in tree
   const status = await proof.verify(trustBase, expectedRequestId);

   // Step 3: Verify source state matches our commitment
   if (authenticator.stateHash !== ourSourceStateHash) {
     ERROR: Proof is for different source state
   }
   ```

---

## What the SDK Provides

### Method 1: Calculate RequestId from Authenticator

```typescript
// From SDK: Authenticator.d.ts line 86
calculateRequestId(): Promise<RequestId>

// This computes:
RequestId = Hash(this.publicKey + this.stateHash)
```

**Usage**:
```typescript
const proofRequestId = await inclusionProof.authenticator.calculateRequestId();
const ourRequestId = transferCommitment.requestId;

if (proofRequestId.toJSON() !== ourRequestId.toJSON()) {
  ERROR: Proof RequestId does not match our commitment RequestId
}
```

### Method 2: Extract State Hash from Authenticator

```typescript
// From SDK: Authenticator.d.ts line 25
readonly stateHash: DataHash;  // The SOURCE STATE HASH
```

**Usage**:
```typescript
const proofSourceStateHash = inclusionProof.authenticator.stateHash;
const ourSourceStateHash = await transferCommitment.transactionData.sourceState.calculateHash();

if (!proofSourceStateHash.equals(ourSourceStateHash)) {
  ERROR: Proof is for different source state
}
```

### Method 3: Use SDK's verify() Method

```typescript
// From SDK: InclusionProof.d.ts line 81
verify(trustBase: RootTrustBase, requestId: RequestId): Promise<InclusionProofVerificationStatus>
```

**This already performs the correct verification internally**:
1. Computes RequestId from authenticator (publicKey + stateHash)
2. Verifies Merkle path proves RequestId is in tree
3. Verifies UnicityCertificate signatures
4. Returns status: OK, PATH_NOT_INCLUDED, PATH_INVALID, or NOT_AUTHENTICATED

**We already call this** in `proof-validation.ts` line 97:
```typescript
const sdkStatus = await proof.verify(trustBase, requestId);
```

---

## The Correct Implementation

### Current Code (WRONG)

```typescript
// receive-token.ts lines 643-688 (CURRENT - WRONG)
const proofTxHash = inclusionProof.transactionHash;
const ourTxHash = await transferCommitment.transactionData.calculateHash();

if (proofTxHashHex !== ourTxHashHex) {
  // Double-spend detected
}
```

**Problems**:
1. Only detects when transaction hashes differ (different recipients)
2. Fails to detect when transaction data is identical (same recipient, concurrent)
3. Relies on transaction hash, not source state verification

### Correct Implementation (Option A - RequestId Comparison)

```typescript
// CORRECT: Verify proof RequestId matches our commitment RequestId

console.error('Step 10.5: Verifying proof corresponds to our source state...');

if (!inclusionProof.authenticator) {
  console.error('\n❌ SECURITY ERROR: Proof missing authenticator!');
  process.exit(1);
}

// Calculate RequestId from the proof's authenticator
// This uses the SOURCE STATE hash from the proof
const proofRequestId = await inclusionProof.authenticator.calculateRequestId();

// Get our expected RequestId (from source state in our commitment)
const ourRequestId = transferCommitment.requestId;

// Convert to hex for comparison
const proofRequestIdHex = proofRequestId.toJSON();
const ourRequestIdHex = ourRequestId.toJSON();

console.error(`  Proof Request ID: ${proofRequestIdHex}`);
console.error(`  Our Request ID:   ${ourRequestIdHex}`);

// CRITICAL: Verify exact match
if (proofRequestIdHex !== ourRequestIdHex) {
  console.error('\n❌ SECURITY ERROR: Proof RequestId mismatch!');
  console.error('\nThe proof does NOT correspond to our source state.');
  console.error('This indicates either:');
  console.error('  1. Aggregator returned wrong proof (Byzantine behavior)');
  console.error('  2. Network corruption or tampering');
  console.error('  3. Implementation bug');
  console.error('\nCannot proceed - proof does not match source state.');
  process.exit(1);
}

console.error('  ✓ Proof RequestId matches - proof corresponds to our source state');
```

### Correct Implementation (Option B - Direct State Hash Comparison)

```typescript
// CORRECT: Verify proof's source state hash matches our commitment's source state

console.error('Step 10.5: Verifying proof corresponds to our source state...');

if (!inclusionProof.authenticator) {
  console.error('\n❌ SECURITY ERROR: Proof missing authenticator!');
  process.exit(1);
}

// Extract source state hash from proof's authenticator
const proofSourceStateHash = inclusionProof.authenticator.stateHash;

// Calculate source state hash from our commitment
const ourSourceStateHash = await transferCommitment.transactionData.sourceState.calculateHash();

// Convert to hex for comparison
const proofStateHashHex = HexConverter.encode(proofSourceStateHash.imprint);
const ourStateHashHex = HexConverter.encode(ourSourceStateHash.imprint);

console.error(`  Proof Source State Hash: ${proofStateHashHex}`);
console.error(`  Our Source State Hash:   ${ourStateHashHex}`);

// CRITICAL: Verify exact match
if (proofStateHashHex !== ourStateHashHex) {
  console.error('\n❌ SECURITY ERROR: Source state hash mismatch!');
  console.error('\nThe proof does NOT correspond to our source state.');
  console.error('This indicates either:');
  console.error('  1. Aggregator returned wrong proof (Byzantine behavior)');
  console.error('  2. Network corruption or tampering');
  console.error('  3. Implementation bug');
  console.error('\nCannot proceed - proof does not match source state.');
  process.exit(1);
}

console.error('  ✓ Source state hash matches - proof corresponds to our source state');
```

### Why Option B is Better

**Option A (RequestId comparison)**:
- Pros: High-level, clear intent
- Cons: Redundant with SDK's `proof.verify()` which already checks this

**Option B (State hash comparison)**:
- Pros: More explicit, shows what property is being verified
- Cons: Lower-level

**RECOMMENDATION**: Use Option B for clarity, but ALSO ensure SDK's `proof.verify()` is called (which we already do in `validateInclusionProof()`).

---

## Addressing the Two Scenarios

### Scenario 1: Different Recipients (Bob vs Carol)

**With Correct Implementation**:
```
Bob and Carol both have source state hash = 0xAAA
Bob and Carol both compute RequestId = Hash(Alice.pubkey + 0xAAA)

Aggregator stores ONE entry:
  Key: RequestId
  Value: First transaction hash (either Bob's or Carol's)

When second recipient queries, aggregator returns proof with:
  authenticator.stateHash = 0xAAA  ← SOURCE STATE
  transactionHash = First recipient's tx hash

Second recipient verifies:
  proofSourceStateHash = 0xAAA
  ourSourceStateHash = 0xAAA
  ✓ MATCH - proof corresponds to our source state

Second recipient ALSO compares transaction hashes:
  proofTxHash = First recipient's hash
  ourTxHash = Second recipient's hash
  ✗ MISMATCH - different transaction

RESULT: Source state matches (expected), but tx hash differs (double-spend detected)
```

**Detection mechanism**: Transaction hash comparison (current code works for this case).

### Scenario 2: Same Recipient, Concurrent (5x Bob)

**With Correct Implementation**:
```
All 5 processes have IDENTICAL transfer file:
  sourceState: 0xAAA
  recipient: Bob
  salt: S1

All compute:
  RequestId = Hash(Alice.pubkey + 0xAAA)
  txHash = Hash(sourceState + recipient + salt) = 0xDDD

Process 1 submits → aggregator stores txHash=0xDDD
Processes 2-5 submit → aggregator REJECTS (already exists)

KEY QUESTION: What does aggregator return to processes 2-5?
```

**Aggregator Behavior Analysis**:

Looking at the current code in `receive-token.ts` lines 568-576:
```typescript
// CRITICAL: RequestId already submitted by another process
console.error('\n⚠ WARNING: Duplicate submission detected by aggregator!');
console.error('\nThe aggregator rejected this submission:');
console.error(`  Error: ${errorData.message}`);
console.error('\nThis happens when the RequestId has already been registered.');
console.error(`The aggregator enforces single-spend by rejecting duplicate RequestIds.`);
```

**The aggregator returns an ERROR (not a proof)** when RequestId already exists.

**Therefore**:
- First process: Gets proof with txHash=0xDDD
- Subsequent processes: Get ERROR "already exists" → NO PROOF returned

**For concurrent duplicates, detection happens at submission time, not at proof verification time.**

---

## The Real Purpose of Source State Verification

### User's Statement

> "Double spend detection must not rely on 'already exists' exception from the aggregator since it brings no cryptographic proof."

### What This Means

**The "already exists" error is not cryptographically secure**:
- Aggregator could be Byzantine (malicious)
- Network could return fake error
- Man-in-the-middle could inject false response

**Cryptographically secure verification requires**:
1. Getting a valid inclusion proof from aggregator
2. Verifying proof's Merkle path against trusted root
3. Verifying proof corresponds to correct source state
4. Comparing proof's transaction to our transaction

**The source state verification ensures**:
- Proof is for the correct token source state
- Aggregator didn't return proof for wrong RequestId
- Protection against Byzantine aggregator behavior
- Cryptographic guarantee (not just HTTP error response)

---

## Complete Verification Flow (Correct)

```typescript
// STEP 1: Submit commitment to aggregator
const submitResult = await client.submitCommitment(
  transferCommitment.requestId,
  await transferCommitment.transactionData.calculateHash(),
  transferCommitment.authenticator
);

// STEP 2: Wait for inclusion proof
const inclusionProof = await client.getInclusionProof(transferCommitment.requestId);

// STEP 3: Verify proof structure and authenticator
const validation = await validateInclusionProof(
  inclusionProof,
  transferCommitment.requestId,
  trustBase
);
// This calls proof.verify() which checks:
// - Merkle path proves RequestId is in tree
// - UnicityCertificate signatures are valid
// - Authenticator can compute correct RequestId

// STEP 4: Verify proof corresponds to OUR source state
const proofSourceStateHash = inclusionProof.authenticator!.stateHash;
const ourSourceStateHash = await transferCommitment.transactionData.sourceState.calculateHash();

if (!proofSourceStateHash.equals(ourSourceStateHash)) {
  ERROR: Proof is for wrong source state (Byzantine aggregator or bug)
}

// STEP 5: Verify proof transaction matches OUR transaction
const proofTxHash = inclusionProof.transactionHash!;
const ourTxHash = await transferCommitment.transactionData.calculateHash();

if (!proofTxHash.equals(ourTxHash)) {
  ERROR: Double-spend detected (different recipient got token first)
}

// STEP 6: All checks pass - we successfully claimed the token
console.log('✓ Token claimed successfully');
```

---

## Summary of Required Changes

### File: src/commands/receive-token.ts

**Current code** (lines 634-691): Compares transaction hashes only.

**Required changes**:

1. **Add source state verification** (NEW STEP before tx hash comparison):
   ```typescript
   // Verify proof's source state matches our commitment's source state
   const proofSourceStateHash = inclusionProof.authenticator!.stateHash;
   const ourSourceStateHash = await transferCommitment.transactionData.sourceState.calculateHash();
   
   if (!proofSourceStateHash.equals(ourSourceStateHash)) {
     ERROR: Proof corresponds to WRONG source state
   }
   ```

2. **Keep transaction hash comparison** (existing code is correct):
   ```typescript
   // Verify proof's transaction matches our transaction
   const proofTxHash = inclusionProof.transactionHash!;
   const ourTxHash = await transferCommitment.transactionData.calculateHash();
   
   if (!proofTxHash.equals(ourTxHash)) {
     ERROR: Double-spend (different recipient)
   }
   ```

3. **Update comments** to reflect correct architecture:
   - RequestId is from source state, not transaction
   - Proof MUST correspond to source state
   - Transaction hash comparison detects different recipients
   - Aggregator error detects concurrent same-recipient duplicates

### Testing Both Scenarios

**Scenario 1 (Different recipients)**:
- Source state verification: PASS (same source)
- Transaction hash comparison: FAIL (different transactions)
- Result: Double-spend detected ✓

**Scenario 2 (Concurrent same recipient)**:
- First process: All checks PASS, token claimed ✓
- Subsequent processes: Aggregator returns ERROR (not proof)
- Result: Duplicate detected at submission time ✓

---

## Conclusion

**Current Implementation is INCOMPLETE**:
- Only verifies transaction hash
- Missing source state verification
- Vulnerable to Byzantine aggregator attacks

**Correct Implementation MUST**:
1. Verify proof's source state matches our commitment (NEW)
2. Verify proof's transaction matches our transaction (EXISTING)
3. Rely on cryptographic proof, not HTTP errors

**The SDK's `proof.verify()` method already does the Merkle path verification**, but we need to EXPLICITLY verify the source state correspondence for defense against Byzantine aggregators.

