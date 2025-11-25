# Root Cause Analysis: Uncommitted Transaction Signing Error

**Error Message:** "Ownership verification failed: Authenticator does not match source state predicate."

**Root Cause:** In the `NEEDS_RESOLUTION` scenario of `receive-token.ts`, the `TransferCommitment` is being signed with the **recipient's signing service** instead of the **sender's signing service**.

## Critical Issue Location

**File:** `/home/vrogojin/cli/src/commands/receive-token.ts`
**Lines:** 589-610 (NEEDS_RESOLUTION scenario, uncommitted transaction submission)

```typescript
// Line 527: Create recipient's signing service
const signingService = await SigningService.createFromSecret(secret);
console.error(`  ✓ Public Key: ${HexConverter.encode(signingService.publicKey)}\n`);

// ... recipient predicate creation code ...

// Line 603-610: CRITICAL BUG - Using RECIPIENT's signingService
const transferCommitment = await TransferCommitment.create(
  sourceToken,                 // Token with source state (sender's token)
  recipientAddress,
  transferDetails.salt,
  recipientDataHash,
  null,
  signingService               // BUG: This is the RECIPIENT's key, not sender's!
);
```

## Why This Is Wrong

The `TransferCommitment.create()` method signs the commitment with the provided `signingService`. The signature proves that the transfer was authorized by the owner of the **source state**.

In Unicity's single-spend proof system:
- **Source State Owner (Sender):** The token was in their state before the transfer
- **Token State Predicate:** Contains the sender's public key
- **Transfer Commitment Signature:** MUST be signed by the sender's key to prove authorization

When receive-token submits the uncommitted transaction, it recreates the commitment. However:

1. The sender's secret was never provided (not stored anywhere)
2. The recipient only has their own secret
3. The code signs with the recipient's key
4. The aggregator verifies the signature against the source state predicate (which contains the sender's key)
5. **Signature verification fails:** Authenticator (recipient's key) ≠ Source State Predicate (sender's key)

## What Should Happen

For offline transactions to work, **the commitment must be pre-signed by the sender** and stored in the uncommitted transaction data.

Currently (in `send-token.ts` offline mode, lines 496-532):

```typescript
// OFFLINE MODE: No pre-signing
const uncommittedTx = {
  type: 'transfer',
  data: {
    sourceState: tokenJson.state,
    recipient: recipientAddress.address,
    salt: HexConverter.encode(salt),
    recipientDataHash: recipientDataHash?.toJSON() || null,
    message: options.message || null
  }
  // NO inclusionProof - this marks it as uncommitted
  // NO signature - THIS IS THE PROBLEM
};
```

## The Fix Requires TWO Changes

### 1. In `send-token.ts` (Offline Mode, Lines 496-532)

**Store the commitment signature in the uncommitted transaction:**

```typescript
// Line 356-367: TransferCommitment is created with sender's signing service
const transferCommitment = await TransferCommitment.create(
  token,
  recipientAddress,
  salt,
  recipientDataHash,
  messageBytes,
  signingService  // SENDER's signing service
);

// OFFLINE MODE: Store commitment details for later submission
const uncommittedTx = {
  type: 'transfer',
  data: {
    sourceState: tokenJson.state,
    recipient: recipientAddress.address,
    salt: HexConverter.encode(salt),
    recipientDataHash: recipientDataHash?.toJSON() || null,
    message: options.message || null
  },
  // NEW: Store the commitment signature (pre-signed by sender)
  commitment: {
    requestId: transferCommitment.requestId.toJSON(),
    signature: HexConverter.encode(transferCommitment.signature),
    publicKey: HexConverter.encode(transferCommitment.publicKey)
  }
};
```

### 2. In `receive-token.ts` (NEEDS_RESOLUTION, Lines 589-610)

**Use the pre-signed commitment instead of recreating it:**

```typescript
// Line 589-611: Instead of recreating the commitment...
if (lastTx.commitment && lastTx.commitment.signature) {
  // USE PRE-SIGNED COMMITMENT from sender
  console.error('Using pre-signed commitment from sender...');

  // Reconstruct TransferCommitment from stored data
  // (need a way to deserialize/reconstruct from stored commitment)
  const transferCommitment = ... // Reconstruct from lastTx.commitment

} else {
  // For backwards compatibility: original recreation flow
  // But this will ONLY work if recipient has sender's secret
  // which they don't in offline mode
}
```

## Why Uncommitted Transactions Are Different

**Online Mode (send-token with submission):**
- Sender creates commitment, signs it with their key
- Aggregator receives it and signs authenticator
- Commitment signature verified against sender's public key in source state
- Transfer can be submitted by anyone (no additional signing needed)

**Offline Mode (send-token without submission):**
- Sender creates commitment, signs it with their key
- Sender gives file to recipient WITHOUT submitting to aggregator
- **CRITICAL:** Commitment signature must be stored because recipient can't recreate it
  - Recipient doesn't have sender's secret
  - Recipient can't sign with sender's key
  - Only the pre-signed commitment from sender is valid
- Recipient submits the pre-signed commitment to aggregator
- Aggregator verifies signature against sender's public key in source state
- If signature is missing or wrong, verification fails

## Current Flow vs Required Flow

### Current Flow (BROKEN)
```
send-token (offline):
  1. Create TransferCommitment with sender's signing service
  2. Store uncommitted transaction WITHOUT commitment signature
  3. Save file

receive-token (NEEDS_RESOLUTION):
  1. Load file
  2. Extract transfer details (recipient, salt, etc.)
  3. Get recipient's secret
  4. Create NEW TransferCommitment with RECIPIENT's signing service
  5. Submit to aggregator
  6. Aggregator verifies signature: RECIPIENT's key ≠ SENDER's key in predicate
  7. ERROR: "Authenticator does not match source state predicate"
```

### Required Flow (CORRECT)
```
send-token (offline):
  1. Create TransferCommitment with sender's signing service
  2. Extract commitment.signature (proves sender authorized transfer)
  3. Store uncommitted transaction WITH commitment.signature
  4. Save file

receive-token (NEEDS_RESOLUTION):
  1. Load file
  2. Extract transfer details AND commitment.signature
  3. Reconstruct TransferCommitment from stored commitment data
  4. Use pre-signed commitment (no new signing needed)
  5. Submit to aggregator
  6. Aggregator verifies signature: sender's key matches predicate
  7. SUCCESS: Proof received and verified
```

## Files to Modify

1. **`/home/vrogojin/cli/src/commands/send-token.ts`**
   - Lines 496-532: Uncommented transaction creation
   - Add commitment signature to uncommitted transaction data

2. **`/home/vrogojin/cli/src/commands/receive-token.ts`**
   - Lines 589-610: Commitment creation in NEEDS_RESOLUTION scenario
   - Detect and use pre-signed commitment from stored data

3. **`/home/vrogojin/cli/src/types/extended-txf.ts`**
   - Update uncommitted transaction structure to include optional commitment field

4. **`/home/vrogojin/cli/src/utils/state-resolution.ts`**
   - Update `extractTransferDetails()` to also extract commitment data if available

## Why The Ownership Verification Error Message

The error occurs at aggregator submission time:

```
submitTransferCommitment()
  → Aggregator receives commitment
  → Verifies signature against source state predicate
  → Signature verification fails (wrong key)
  → Returns error: "Ownership verification failed"
  → Error propagates to receive-token
```

This is actually the **aggregator's correct behavior** - it's properly rejecting a transfer signed with the wrong key. The bug is in **our code** for not providing the correct signature.

## Testing This Fix

After implementing the fix:

```bash
# Sender: Create offline transfer
SECRET="sender-secret" npm run send-token -- \
  -f token.txf \
  -r "DIRECT://recipient-address" \
  --offline \
  --save

# Transfer file to recipient

# Recipient: Submit offline transfer
SECRET="recipient-secret" npm run receive-token -- \
  -f <offline-transfer.txf>

# Should now:
# 1. Detect NEEDS_RESOLUTION scenario
# 2. Extract pre-signed commitment
# 3. Submit to aggregator successfully
# 4. Receive and verify proof
# 5. Update token state to CONFIRMED
```

## Summary

The uncommitted transaction system requires **pre-signing by the sender** because:
1. The commitment proves authorization from the token owner (sender)
2. Offline mode means the recipient can't get the sender's secret
3. The signature must be stored and reused when submitting to the aggregator
4. The recipient can't forge a new signature without the sender's key

Without pre-signing, offline transfers are cryptographically impossible in the single-spend proof model.
