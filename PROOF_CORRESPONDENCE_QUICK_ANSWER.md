# PROOF CORRESPONDENCE - Quick Answer

## Your Questions Answered

### 1. What should we verify instead?

**ANSWER**: Verify that the proof's SOURCE STATE HASH matches our commitment's source state hash.

```typescript
// Extract from proof's authenticator
const proofSourceStateHash = inclusionProof.authenticator.stateHash;

// Calculate from our commitment
const ourSourceStateHash = await transferCommitment.transactionData.sourceState.calculateHash();

// CRITICAL VERIFICATION
if (!proofSourceStateHash.equals(ourSourceStateHash)) {
  ERROR: Proof does not correspond to our source state
}
```

### 2. What's in the inclusion proof that identifies the source state?

**ANSWER**: The `authenticator.stateHash` field.

```typescript
class InclusionProof {
    readonly authenticator: Authenticator | null;  // Contains stateHash
    // ...
}

class Authenticator {
    readonly publicKey: Uint8Array;      // Sender's public key
    readonly stateHash: DataHash;        // SOURCE STATE HASH ← THIS!
    readonly signature: Signature;       // Signature over txHash
}
```

### 3. What's the correct verification?

**ANSWER**: Two-step verification:

```typescript
// STEP 1: Verify proof corresponds to our SOURCE STATE (NEW - REQUIRED)
const proofSourceStateHash = inclusionProof.authenticator.stateHash;
const ourSourceStateHash = await transferCommitment.transactionData.sourceState.calculateHash();

if (!proofSourceStateHash.equals(ourSourceStateHash)) {
  ERROR: Proof is for WRONG source state (Byzantine aggregator)
}

// STEP 2: Verify proof transaction matches our TRANSACTION (EXISTING)
const proofTxHash = inclusionProof.transactionHash;
const ourTxHash = await transferCommitment.transactionData.calculateHash();

if (!proofTxHash.equals(ourTxHash)) {
  ERROR: Double-spend detected (different recipient got token first)
}
```

### 4. For concurrent same-recipient submissions?

**ANSWER**: Detection happens at SUBMISSION TIME, not proof verification time.

```
5 processes submit IDENTICAL transfer file:
  - Same sourceState
  - Same recipient (Bob)
  - Same salt
  - Same RequestId
  - Same txHash

Process 1: submits → aggregator stores txHash → returns proof
Processes 2-5: submit → aggregator rejects "already exists" → NO PROOF returned

Detection: HTTP error at submission time (not cryptographic proof)
```

**User's concern**: "Must not rely on 'already exists' exception since it brings no cryptographic proof."

**Solution**: The source state verification provides cryptographic guarantee that:
- Proof is for correct source state
- Aggregator didn't switch proofs (Byzantine behavior)
- Protection against network tampering

### 5. RequestId computation?

**ANSWER**: Yes, RequestId is the key!

```typescript
// RequestId formula
RequestId = SHA256(publicKey + sourceStateHash)

// The SDK's proof.verify() already checks this:
const proofRequestId = await inclusionProof.authenticator.calculateRequestId();
// This computes: Hash(authenticator.publicKey + authenticator.stateHash)

// Then verifies Merkle path proves this RequestId is in tree
```

**We already call `proof.verify()` in `validateInclusionProof()`**, so the RequestId verification is already happening internally.

**BUT** we must ALSO explicitly verify source state correspondence for defense against Byzantine aggregators.

---

## Implementation Code

### Location: src/commands/receive-token.ts

Replace lines 634-691 with:

```typescript
// STEP 10.5: CRITICAL SECURITY - Verify proof corresponds to our source state
// Defense against Byzantine aggregator behavior
console.error('Step 10.5: Verifying proof corresponds to our source state...');

if (!inclusionProof.authenticator) {
  console.error('\n❌ SECURITY ERROR: Proof missing authenticator!');
  console.error('\nThe inclusion proof does not contain an authenticator.');
  console.error('This indicates an incomplete or invalid proof from the aggregator.');
  process.exit(1);
}

// VERIFICATION 1: Source State Correspondence (NEW - CRITICAL)
// This protects against Byzantine aggregator returning proof for wrong RequestId
const proofSourceStateHash = inclusionProof.authenticator.stateHash;
const ourSourceStateHash = await transferCommitment.transactionData.sourceState.calculateHash();

const proofStateHashHex = HexConverter.encode(proofSourceStateHash.imprint);
const ourStateHashHex = HexConverter.encode(ourSourceStateHash.imprint);

console.error(`  Proof Source State Hash: ${proofStateHashHex}`);
console.error(`  Our Source State Hash:   ${ourStateHashHex}`);

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

console.error('  ✓ Source state hash matches - proof corresponds to our source state\n');

// VERIFICATION 2: Transaction Correspondence (EXISTING - KEEP)
// This detects double-spend when different recipients claim same token
const proofTxHash = inclusionProof.transactionHash;

if (!proofTxHash) {
  console.error('\n❌ SECURITY ERROR: Proof is missing transaction hash!');
  console.error('\nThe inclusion proof does not contain a transaction hash.');
  console.error('This indicates an incomplete or invalid proof from the aggregator.');
  process.exit(1);
}

const ourTxHash = await transferCommitment.transactionData.calculateHash();

const proofTxHashHex = HexConverter.encode(proofTxHash.imprint);
const ourTxHashHex = HexConverter.encode(ourTxHash.imprint);

console.error(`  Proof Transaction Hash: ${proofTxHashHex}`);
console.error(`  Our Transaction Hash:   ${ourTxHashHex}`);

if (proofTxHashHex !== ourTxHashHex) {
  // DOUBLE-SPEND DETECTED!
  console.error('\n❌ DOUBLE-SPEND DETECTED - Transaction Hash Mismatch!');
  console.error('\nThe proof transaction does NOT match our transaction.');
  console.error('This means another recipient submitted their transfer FIRST.');
  console.error('\nDetails:');
  console.error(`  - Request ID: ${transferCommitment.requestId.toJSON()}`);
  console.error(`  - Expected Transaction Hash: ${ourTxHashHex}`);
  console.error(`  - Proof Transaction Hash:    ${proofTxHashHex}`);
  console.error('\nWhat happened:');
  console.error('  1. The sender created multiple offline transfers from the same token');
  console.error('  2. Multiple recipients submitted their transfers concurrently');
  console.error('  3. The aggregator accepted the FIRST submission');
  console.error('  4. Our submission arrived AFTER another recipient');
  console.error('\nResult:');
  console.error('  - The aggregator stored the other recipient\'s transaction');
  console.error('  - The proof is for THEIR transaction, not yours');
  console.error('  - You cannot claim this token (already transferred to someone else)');
  console.error('\nAction Required:');
  console.error('  Contact the sender and request a fresh token.');
  process.exit(1);
}

console.error('  ✓ Transaction hash matches - proof is for our transaction');
console.error('  ✓ No double-spend detected\n');
```

---

## How This Detects Both Scenarios

### Scenario 1: Different Recipients (Bob vs Carol)

```
Alice → Bob (txHash 0xBBB)
Alice → Carol (txHash 0xCCC)

Both have same source state hash 0xAAA

Bob submits first → aggregator stores 0xBBB
Carol submits later → gets proof with:
  - authenticator.stateHash = 0xAAA
  - transactionHash = 0xBBB

Carol's verification:
  ✓ Source state: 0xAAA == 0xAAA (PASS)
  ✗ Transaction: 0xBBB != 0xCCC (FAIL - double-spend detected)
```

### Scenario 2: Concurrent Same Recipient (5x Bob)

```
All 5 processes have identical transfer file

Process 1: submits → gets proof with txHash 0xDDD
Processes 2-5: submit → aggregator rejects "already exists"

NO proof returned to processes 2-5
Detection at submission time via HTTP error
```

---

## Key Insights

1. **RequestId = Hash(publicKey + sourceStateHash)**
   - Identifies the SOURCE STATE being spent
   - NOT the transaction hash

2. **Proof's authenticator contains source state hash**
   - `authenticator.stateHash` identifies which token state is being spent
   - Must match our commitment's source state

3. **Two-layer verification**:
   - Layer 1: Source state correspondence (defense against Byzantine aggregator)
   - Layer 2: Transaction hash comparison (double-spend detection)

4. **SDK's `proof.verify()` already checks RequestId internally**
   - But explicit source state verification adds defense-in-depth
   - Shows intent clearly in code
   - Provides better error messages

5. **"Already exists" error is NOT cryptographically secure**
   - Can be spoofed by malicious aggregator
   - Can be injected by network attacker
   - Source state verification provides cryptographic guarantee

---

## Files to Read for Full Context

1. `/home/vrogojin/cli/PROOF_CORRESPONDENCE_CORRECTION.md` - Complete architecture analysis
2. `/home/vrogojin/cli/src/commands/receive-token.ts` - Current implementation (lines 634-691)
3. `/home/vrogojin/cli/src/utils/proof-validation.ts` - Proof verification utilities
4. `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/Authenticator.d.ts` - Authenticator structure
5. `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.d.ts` - InclusionProof structure

