# Uncommitted Transaction Data Flow Analysis

## Key Insight

The commitment signature is the **source of truth** proving the sender authorized the transfer. It must be stored in the uncommitted transaction because the recipient cannot recreate it without the sender's secret.

## Data Structures Involved

### 1. TransferCommitment (Created by Sender in send-token)

Created in `send-token.ts` line 358-365:
```typescript
const transferCommitment = await TransferCommitment.create(
  token,                    // Sender's current token
  recipientAddress,
  salt,
  recipientDataHash,
  messageBytes,
  signingService           // SENDER's signing service
);
```

Properties available after creation:
```
transferCommitment.requestId           // Hash(publicKey + stateHash)
transferCommitment.signature           // Signed proof of authorization
transferCommitment.publicKey           // Sender's public key
transferCommitment.transactionData     // Contains sourceState, recipient, etc.
```

### 2. Uncommitted Transaction Structure (Current - BROKEN)

Currently stored in `send-token.ts` lines 503-513:
```json
{
  "type": "transfer",
  "data": {
    "sourceState": {},           // Sender's final token state
    "recipient": "DIRECT://...", // Recipient address
    "salt": "abcd...",           // Used to create recipient address
    "recipientDataHash": null,   // Optional state data commitment
    "message": null              // Optional message
  }
  // MISSING: commitment.signature
}
```

**Problem:** No signature! When receive-token tries to recreate the commitment in NEEDS_RESOLUTION scenario, it uses the recipient's key instead of the sender's key.

### 3. Uncommitted Transaction Structure (Required - CORRECT)

What it SHOULD look like:
```json
{
  "type": "transfer",
  "data": {
    "sourceState": {},
    "recipient": "DIRECT://...",
    "salt": "abcd...",
    "recipientDataHash": null,
    "message": null
  },
  "commitment": {
    "requestId": "hash(sender-pubkey + source-state-hash)",
    "signature": "hex-encoded-signature-bytes",
    "publicKey": "hex-encoded-sender-public-key"
  }
  // NOW: commitment.signature stored!
}
```

## Flow Comparison

### Current Flow (Broken)

```
SENDER SIDE (send-token --offline)
════════════════════════════════════════════════════════════════
Time T0: Create offline transfer
  1. Load sender's token
  2. Get sender's secret → create signingService
  3. Create TransferCommitment:
       - transferCommitment.signature = Sign(data, senderKey)
       - transferCommitment.publicKey = senderKey
  4. Save to file WITHOUT storing signature
     {
       "transactions": [{
         "type": "transfer",
         "data": { ... },
         "commitment": undefined  // BUG: Not stored!
       }]
     }
  5. Clear sender's secret from memory
  6. Send file to recipient


RECIPIENT SIDE (receive-token)
════════════════════════════════════════════════════════════════
Time T1: Receive offline transfer
  1. Load file
  2. Detect NEEDS_RESOLUTION scenario
  3. Get recipient's secret → create signingService
     signingService.publicKey = recipientKey
  4. Extract transfer details from lastTx.data
  5. Try to recreate TransferCommitment:
     NEW_transferCommitment = TransferCommitment.create(
       sourceToken,      // Still has sender's state
       recipientAddress,
       salt,
       recipientDataHash,
       null,
       signingService    // BUG: Using recipientKey, not senderKey!
     )
     → NEW_transferCommitment.signature = Sign(data, recipientKey)
     → NEW_transferCommitment.publicKey = recipientKey
  6. Submit NEW_transferCommitment to aggregator
  7. Aggregator receives commitment signed with recipientKey
  8. Aggregator verifies signature:
     - Expected: sourceState.predicate contains senderKey
     - Got: signature from recipientKey
     - Result: SIGNATURE MISMATCH ❌
  9. Return error: "Authenticator does not match source state predicate"


AGGREGATOR SIDE
════════════════════════════════════════════════════════════════
Verification fails because:
  sourceState.predicate.publicKey = senderKey
  commitment.signature = Sign(data, recipientKey)
  recipientKey ≠ senderKey
  → Verification fails
```

### Required Flow (Correct)

```
SENDER SIDE (send-token --offline)
════════════════════════════════════════════════════════════════
Time T0: Create offline transfer
  1. Load sender's token
  2. Get sender's secret → create signingService
  3. Create TransferCommitment:
       - transferCommitment.signature = Sign(data, senderKey)
       - transferCommitment.publicKey = senderKey
  4. EXTRACT signature for storage:
       - commitmentSig = transferCommitment.signature
       - commitmentPubKey = transferCommitment.publicKey
       - requestId = transferCommitment.requestId
  5. Save to file WITH stored signature
     {
       "transactions": [{
         "type": "transfer",
         "data": { ... },
         "commitment": {              // FIXED: Now stored!
           "requestId": "hash...",
           "signature": "abcd...",
           "publicKey": "1234..."
         }
       }]
     }
  6. Clear sender's secret from memory
  7. Send file to recipient


RECIPIENT SIDE (receive-token)
════════════════════════════════════════════════════════════════
Time T1: Receive offline transfer
  1. Load file
  2. Detect NEEDS_RESOLUTION scenario
  3. Get recipient's secret → create signingService
     signingService.publicKey = recipientKey
  4. Extract transfer details from lastTx.data
  5. Extract PRE-SIGNED commitment from lastTx.commitment
     storedCommitment = {
       requestId: "hash...",
       signature: "abcd...",      // Signed by SENDER
       publicKey: "1234..."        // SENDER's key
     }
  6. Reconstruct TransferCommitment from stored data
     transferCommitment = TransferCommitment.fromJSON({
       requestId: storedCommitment.requestId,
       signature: storedCommitment.signature,
       publicKey: storedCommitment.publicKey,
       transactionData: { ... }
     })
  7. Submit transferCommitment to aggregator
  8. Aggregator receives commitment signed with senderKey
  9. Aggregator verifies signature:
     - Expected: sourceState.predicate contains senderKey
     - Got: signature from senderKey
     - Result: SIGNATURE MATCH ✓
  10. Aggregator creates authenticator (signs with their key)
  11. Return proof with authenticator


AGGREGATOR SIDE
════════════════════════════════════════════════════════════════
Verification succeeds because:
  sourceState.predicate.publicKey = senderKey
  commitment.signature = Sign(data, senderKey)
  senderKey = senderKey
  → Verification succeeds ✓
  → Create authenticator and return proof
```

## Why Recipient Can't Sign

In offline mode:
- Sender and recipient are different people
- Recipient doesn't know sender's secret
- Recipient only has their own secret
- Recipient's key is only used to create the NEW state predicate
- But the commitment must be signed by the sender (token owner) to authorize the transfer

### Analogy: Check Signature

Think of it like a paper check:
- **Check writer (sender):** Signs the check to authorize payment
- **Check recipient:** Can't forge the writer's signature (that's illegal!)
- **Offline transfer:** The sender's signature must be written on the check
- **When recipient deposits:** Bank verifies the writer's signature, not the depositor's

The commitment signature is like the check writer's signature - it **proves the sender authorized the transfer**.

## Cryptographic Properties

```
Sender's signing key: SK_sender
Sender's public key:  PK_sender

Transfer commitment: C = (sourceState, recipient, salt, ...)
Commitment signature: S = Sign(C, SK_sender)

When verifying:
  Verify(S, C, PK_sender) = true  ✓ (sender authorized)
  Verify(S, C, PK_recipient) = false ✗ (not signed by recipient)
```

The signature **binds the sender's key to the commitment data**. You can't change the signer without invalidating the signature.

## Code Locations for Implementation

### To Store Signature (send-token.ts)

```typescript
// After line 365 (TransferCommitment created)
const transferCommitment = await TransferCommitment.create(...);

// Extract commitment details
const commitmentData = {
  requestId: transferCommitment.requestId.toJSON(),
  signature: HexConverter.encode(transferCommitment.signature),  // MUST STORE
  publicKey: HexConverter.encode(transferCommitment.publicKey)
};

// Then in offline mode (lines 503-513)
const uncommittedTx = {
  type: 'transfer',
  data: { ... },
  commitment: commitmentData  // ADD THIS
};
```

### To Use Stored Signature (receive-token.ts)

```typescript
// Before line 603
const lastTx = extendedTxf.transactions[extendedTxf.transactions.length - 1];

if (lastTx.commitment && lastTx.commitment.signature) {
  // Use pre-signed commitment
  const transferCommitment = await TransferCommitment.fromJSON({
    requestId: RequestId.fromJSON(lastTx.commitment.requestId),
    signature: HexConverter.decode(lastTx.commitment.signature),
    publicKey: HexConverter.decode(lastTx.commitment.publicKey),
    transactionData: { ... }
  });

  // Submit pre-signed commitment
  await client.submitTransferCommitment(transferCommitment);
} else {
  // Backwards compatibility: old format without stored signature
  // (would only work if recipient has sender's secret)
  throw new Error('Offline transfer missing commitment signature');
}
```

## TypeScript Type Updates

`/home/vrogojin/cli/src/types/extended-txf.ts`:

```typescript
interface TransactionData {
  type: 'transfer' | 'mint' | 'receive';
  data: {
    sourceState: StateJSON;
    recipient: string;
    salt: string;
    recipientDataHash: string | null;
    message: string | null;
  };
  inclusionProof?: InclusionProofJSON;
  commitment?: {  // NEW: For uncommitted transactions
    requestId: string;
    signature: string;     // Hex-encoded signature bytes
    publicKey: string;     // Hex-encoded sender public key
  };
}
```

## Summary: The Key Insight

**You cannot sign on someone else's behalf.**

In offline transfers:
- The commitment proves the sender authorized the transfer
- The signature **must be created by the sender** using their secret
- The signature **must be stored** because the recipient can't recreate it
- When the recipient submits the transfer, they use the pre-signed commitment
- The aggregator verifies the signature was made by the sender (token owner)

This is cryptographic security 101 - signatures prove identity and authorization. Without the pre-signed commitment, offline transfers are impossible.
