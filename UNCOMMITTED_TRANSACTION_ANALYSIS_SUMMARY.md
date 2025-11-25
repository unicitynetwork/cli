# Uncommitted Transaction Analysis - Executive Summary

## Problem Statement

**Error Message:** "Ownership verification failed: Authenticator does not match source state predicate."

**When it occurs:** When receive-token processes an offline transfer created with send-token --offline

**Root Cause:** The commitment signature is NOT stored in the uncommitted transaction, so when receive-token tries to submit it, it recreates the commitment using the recipient's key instead of the sender's key, which doesn't match the source state predicate.

## Evidence

### Current Code Flow (Broken)

1. **send-token.ts (Line 358-365):** Creates TransferCommitment with **sender's signing service**
   ```typescript
   const transferCommitment = await TransferCommitment.create(
     token,
     recipientAddress,
     salt,
     recipientDataHash,
     messageBytes,
     signingService  // SENDER's key
   );
   ```

2. **send-token.ts (Line 496-532):** Stores ONLY transfer data, NOT signature
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
     // BUG: NO commitment.signature stored!
   };
   ```

3. **receive-token.ts (Line 527):** Gets recipient's secret
   ```typescript
   const secret = await getSecret(options.unsafeSecret);
   const signingService = await SigningService.createFromSecret(secret);
   // signingService.publicKey is NOW RECIPIENT's key
   ```

4. **receive-token.ts (Line 603-610):** Recreates commitment with WRONG key
   ```typescript
   const transferCommitment = await TransferCommitment.create(
     sourceToken,                 // Source state has SENDER's predicate
     recipientAddress,
     transferDetails.salt,
     recipientDataHash,
     null,
     signingService               // BUG: RECIPIENT's key, not sender's!
   );
   ```

5. **Aggregator verification fails:** Signature doesn't match predicate
   - Signature: Made with recipient's private key
   - Predicate in source state: Contains sender's public key
   - Result: Signature verification fails

### Why This Matters Cryptographically

The commitment is like a check signature:
- **Check writer (sender):** Must sign it with their key to authorize payment
- **Check recipient:** Cannot forge the writer's signature
- **Verification:** Bank verifies writer's key, not depositor's

The commitment signature **proves the sender authorized the transfer**. You cannot:
1. Create a new signature with a different key
2. Reuse a signature from a different signer
3. Verify a signature against the wrong public key

Once the sender creates the commitment, it's **locked in with their signature**. The recipient cannot create a new one without the sender's secret.

## The Solution

### Two-Part Fix

**Part 1: Store the signature (send-token.ts)**

After creating the TransferCommitment, extract and store the signature:

```typescript
// Extract signature details
const commitmentData = {
  requestId: transferCommitment.requestId.toJSON(),
  signature: HexConverter.encode(transferCommitment.signature),
  publicKey: HexConverter.encode(transferCommitment.publicKey)
};

// Store in uncommitted transaction
const uncommittedTx = {
  type: 'transfer',
  data: { ... },
  commitment: commitmentData  // ADD THIS
};
```

**Part 2: Use the stored signature (receive-token.ts)**

Instead of recreating the commitment, extract and use the pre-signed one:

```typescript
// Extract pre-signed commitment from transaction
if (lastTx.commitment && lastTx.commitment.signature) {
  // Use pre-signed commitment from sender
  const transferCommitment = reconstructFromStored(lastTx.commitment);
  // Don't create a new one!
} else {
  throw new Error('Missing commitment signature');
}
```

## Key Insight

**In offline transfers, the commitment MUST be signed by the sender and stored, because the recipient cannot recreate it without the sender's secret.**

This is a fundamental requirement of cryptographic signatures:
- Signatures are created by the signer's private key
- Only the signer can create a valid signature for their key
- The recipient doesn't have (and should never have) the sender's private key
- Therefore, the signature must be stored and reused

## Files Affected

### Must Modify

1. **`/home/vrogojin/cli/src/commands/send-token.ts`**
   - Lines 356-367: Extract commitment signature after creation
   - Lines 496-532: Store commitment in uncommitted transaction

2. **`/home/vrogojin/cli/src/commands/receive-token.ts`**
   - Lines 497-610: Check for stored commitment in NEEDS_RESOLUTION scenario
   - Use pre-signed commitment instead of recreating it

### Should Modify

3. **`/home/vrogojin/cli/src/types/extended-txf.ts`**
   - Add `commitment` field type to transaction structure

4. **`/home/vrogojin/cli/src/utils/state-resolution.ts`**
   - Add `extractCommitment()` helper function
   - Update scenario detection to check for signature

## Implementation Impact

### User Experience

**Before Fix:** Offline transfers fail with cryptic error
```
❌ Submission failed: Error
Ownership verification failed: Authenticator does not match source state predicate
```

**After Fix:** Offline transfers work as expected
```
✓ Uncommitted transaction detected - submitting to aggregator
✓ Using commitment pre-signed by sender
✓ Submitted
✓ Proof received
=== Online Transfer Received Successfully ===
Status: CONFIRMED
```

### File Format Changes

**Before:**
```json
{
  "transactions": [{
    "type": "transfer",
    "data": {
      "sourceState": { ... },
      "recipient": "DIRECT://...",
      "salt": "...",
      "recipientDataHash": null,
      "message": null
    }
  }]
}
```

**After:**
```json
{
  "transactions": [{
    "type": "transfer",
    "data": {
      "sourceState": { ... },
      "recipient": "DIRECT://...",
      "salt": "...",
      "recipientDataHash": null,
      "message": null
    },
    "commitment": {
      "requestId": "hash(...)",
      "signature": "abcd1234...",
      "publicKey": "5678efgh..."
    }
  }]
}
```

### Backwards Compatibility

Old files (without `commitment` field) won't work with new code. Options:
1. Provide migration tool to re-sign old offline transfers (requires sender's secret)
2. Gracefully error: "File format outdated, please recreate transfer"
3. Both

## Testing Strategy

### Basic Test: Create and Submit Offline Transfer
```bash
# Alice creates token
SECRET="alice" npm run mint-token -- --local -d '{}' --save
# Get alice-token-file.txf

# Alice sends offline to Bob
SECRET="alice" npm run send-token -- \
  -f alice-token-file.txf \
  -r "DIRECT://bob-address" \
  --offline \
  --save
# Get offline-transfer-file.txf

# Verify file contains commitment
jq '.transactions[-1].commitment' offline-transfer-file.txf

# Bob receives and submits
SECRET="bob" npm run receive-token -- -f offline-transfer-file.txf

# Should succeed with Status: CONFIRMED
```

### Edge Cases to Test

1. **Missing commitment field:** Old file format → Should error gracefully
2. **Missing signature in commitment:** Corrupted file → Should error gracefully
3. **Signature mismatch:** Tampered file → Should error gracefully
4. **Round-trip:** Alice → Bob → Charlie → Verify chain works
5. **With state data commitment:** Offline transfer with --recipient-data-hash
6. **With message:** Offline transfer with --message

## Prevention

To prevent similar issues in the future:

1. **Document the commitment signing requirement** in architecture docs
2. **Add test coverage** for offline transfers in BATS test suite
3. **Add type safety** for commitment field in TypeScript interfaces
4. **Add validation** in state-resolution to check for required signature

## Related Documentation

This analysis is accompanied by:
- `UNCOMMITTED_TRANSACTION_ROOT_CAUSE.md` - Detailed root cause analysis
- `UNCOMMITTED_TRANSACTION_DATA_FLOW.md` - Data flow diagrams and examples
- `UNCOMMITTED_TRANSACTION_CODE_LOCATIONS.md` - Exact code locations and changes needed
- `UNCOMMITTED_TRANSACTION_FIX_REFERENCE.md` - Quick reference for implementation

## Conclusion

The uncommitted transaction system requires **pre-signing by the sender** because:

1. The commitment proves authorization (only sender should sign it)
2. Offline mode means no real-time aggregator interaction
3. The recipient can't access the sender's secret
4. The signature must be stored and reused by the recipient
5. Cryptographic security requires the correct signer

This is not a design flaw but a fundamental requirement of cryptographic proof systems. Offline transfers that work with separate sender and recipient keys must store the sender's signature.
