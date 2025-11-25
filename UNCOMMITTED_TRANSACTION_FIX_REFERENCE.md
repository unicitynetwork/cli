# Uncommitted Transaction Fix - Quick Reference

## The Problem in One Sentence

**When receive-token submits an uncommitted transaction, it recreates the commitment using the recipient's signing key instead of the pre-signed commitment from the sender, causing signature verification to fail.**

## Root Cause

- **File:** `send-token.ts` lines 496-532 (offline mode)
- **Issue:** Uncommitted transaction is created WITHOUT storing the commitment signature
- **Consequence:** When `receive-token` submits it, the signature is wrong

- **File:** `receive-token.ts` lines 589-610 (NEEDS_RESOLUTION scenario)
- **Issue:** Recreates commitment with recipient's key instead of using sender's pre-signed commitment
- **Consequence:** Aggregator rejects with "Authenticator does not match source state predicate"

## The Fix in Two Parts

### Part 1: Store Sender's Signature in send-token.ts

**What:** After creating the TransferCommitment, extract and store its signature

**Where:** Lines 496-532 (offline mode branch)

**Current Code:**
```typescript
const uncommittedTx = {
  type: 'transfer',
  data: {
    sourceState: tokenJson.state,
    recipient: recipientAddress.address,
    salt: HexConverter.encode(salt),
    recipientDataHash: recipientDataHash?.toJSON() || null,
    message: options.message || null
  }
  // NO signature stored!
};
```

**Fixed Code:**
```typescript
// After TransferCommitment.create (line 365)
const transferCommitment = await TransferCommitment.create(
  token,
  recipientAddress,
  salt,
  recipientDataHash,
  messageBytes,
  signingService
);

// Extract commitment signature (SENDER signed this)
const commitmentSignature = {
  requestId: transferCommitment.requestId.toJSON(),
  signature: HexConverter.encode(transferCommitment.signature),
  publicKey: HexConverter.encode(transferCommitment.publicKey)
};

// Then create uncommitted transaction WITH signature
const uncommittedTx = {
  type: 'transfer',
  data: {
    sourceState: tokenJson.state,
    recipient: recipientAddress.address,
    salt: HexConverter.encode(salt),
    recipientDataHash: recipientDataHash?.toJSON() || null,
    message: options.message || null
  },
  commitment: commitmentSignature  // FIXED: Now stored!
};
```

### Part 2: Use Stored Signature in receive-token.ts

**What:** Instead of recreating the commitment, use the pre-signed one from the sender

**Where:** Lines 589-610 (NEEDS_RESOLUTION scenario, when `!hasAuthenticator`)

**Current Code:**
```typescript
// Line 603-610: Recreates commitment with WRONG key
const transferCommitment = await TransferCommitment.create(
  sourceToken,
  recipientAddress,
  transferDetails.salt,
  recipientDataHash,
  null,
  signingService  // BUG: This is recipient's key!
);
```

**Fixed Code:**
```typescript
// Check if commitment signature is stored
if (lastTx.commitment && lastTx.commitment.signature) {
  console.error('Using commitment pre-signed by sender...');

  // Reconstruct TransferCommitment from stored data
  // (using stored signature, not creating new one)
  const transferCommitment = {
    requestId: lastTx.commitment.requestId,
    signature: HexConverter.decode(lastTx.commitment.signature),
    publicKey: HexConverter.decode(lastTx.commitment.publicKey),
    transactionData: {
      sourceState: lastTx.data.sourceState,
      recipient: lastTx.data.recipient,
      salt: lastTx.data.salt,
      recipientDataHash: lastTx.data.recipientDataHash,
      message: lastTx.data.message
    }
  };

  // Use the reconstructed commitment directly
  // (no recreation needed)
} else {
  // Backwards compatibility: old format or future enhancement
  throw new Error(
    'Offline transfer missing commitment signature. ' +
    'File may be corrupted or created with an older version.'
  );
}
```

## Key Properties

### TransferCommitment Properties (from SDK)

When created in send-token:
```typescript
transferCommitment.requestId      // RequestId object
transferCommitment.signature      // Uint8Array (bytes of signature)
transferCommitment.publicKey      // Uint8Array (sender's public key)
transferCommitment.transactionData // Contains all transfer data
```

For storage, convert to JSON-compatible format:
```typescript
{
  requestId: transferCommitment.requestId.toJSON(),     // String
  signature: HexConverter.encode(transferCommitment.signature),  // Hex string
  publicKey: HexConverter.encode(transferCommitment.publicKey)   // Hex string
}
```

## Type Definitions to Update

**File:** `/home/vrogojin/cli/src/types/extended-txf.ts`

Add to Transaction interface:
```typescript
interface Transaction {
  type: 'transfer' | 'mint' | 'receive';
  data: {
    sourceState?: any;
    recipient?: string;
    salt?: string;
    recipientDataHash?: string | null;
    message?: string | null;
  };
  inclusionProof?: InclusionProofJSON;
  commitment?: {              // NEW: For uncommitted offline transfers
    requestId: string;
    signature: string;         // Hex-encoded signature bytes
    publicKey: string;         // Hex-encoded sender public key
  };
}
```

## Testing Checklist

After implementing the fix:

1. **Offline Transfer Creation**
   ```bash
   SECRET="sender-secret" npm run send-token -- \
     -f sender-token.txf \
     -r "DIRECT://recipient-address" \
     --offline \
     --save
   ```
   - Verify output file contains `commitment` field
   - Check that `commitment.signature` is a non-empty hex string

2. **Offline Transfer Submission**
   ```bash
   SECRET="recipient-secret" npm run receive-token -- \
     -f <offline-transfer.txf>
   ```
   - Should detect NEEDS_RESOLUTION scenario
   - Should extract pre-signed commitment
   - Should submit successfully to aggregator
   - Should receive and verify proof
   - Final status should be CONFIRMED (or PENDING if using --offline)

3. **Backwards Compatibility**
   - Test with old TXF files (without commitment field)
   - Should handle gracefully with appropriate error message

4. **Round-Trip Transfer**
   ```bash
   # Alice creates token
   SECRET="alice" npm run mint-token -- --local -d '{"owner":"alice"}' --save

   # Alice sends offline to Bob
   SECRET="alice" npm run send-token -- -f <alice-token.txf> -r <bob-address> --offline --save

   # Bob receives and submits
   SECRET="bob" npm run receive-token -- -f <offline-transfer.txf>

   # Verify Bob's token is CONFIRMED
   ```

## Error Messages to Watch For

**Before Fix (Current - Expected Failures):**
```
❌ Submission failed: Error
Ownership verification failed: Authenticator does not match source state predicate
```

**After Fix (Expected Success):**
```
✓ Uncommitted transaction detected - submitting to aggregator
✓ Commitment created
✓ Submitted
✓ Proof received
✓ Proof validated
✓ Transaction created
=== Online Transfer Received Successfully ===
Status: CONFIRMED
```

## Summary

**The core insight:** Signatures prove identity. In offline transfers, the commitment **must be signed by the sender** (who owns the token) and **that signature must be stored** because the recipient can't recreate it. When the recipient later submits the transfer, they use the pre-signed commitment which the aggregator verifies against the sender's public key in the source state predicate.

Without pre-signed commitments, offline transfers are cryptographically impossible.

## Files to Modify

1. `/home/vrogojin/cli/src/commands/send-token.ts` - Store signature
2. `/home/vrogojin/cli/src/commands/receive-token.ts` - Use stored signature
3. `/home/vrogojin/cli/src/types/extended-txf.ts` - Update type definitions
4. (Optional) `/home/vrogojin/cli/src/utils/state-resolution.ts` - Helper for signature extraction
