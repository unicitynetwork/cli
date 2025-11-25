# Uncommitted Transaction Implementation - Code Locations

## Issue Summary

Error: "Ownership verification failed: Authenticator does not match source state predicate."

**Root Cause:** The commitment must be pre-signed by the sender and stored. Currently, it's being recreated in receive-token with the recipient's key, which doesn't match the source state predicate (which contains the sender's key).

## Exact Code Locations

### Location 1: Where Commitment IS Created (send-token.ts)

**File:** `/home/vrogojin/cli/src/commands/send-token.ts`
**Lines:** 356-367

```typescript
// STEP 6: Create transfer commitment
console.error('Step 6: Creating transfer commitment...');
const transferCommitment = await TransferCommitment.create(
  token,
  recipientAddress,
  salt,
  recipientDataHash,  // Use validated hash instead of null
  messageBytes,
  signingService      // SENDER's signing service - THIS IS KEY!
);
console.error(`  ✓ Transfer commitment created`);
console.error(`  Request ID: ${transferCommitment.requestId.toJSON()}\n`);
```

**What we have here:**
- `transferCommitment.signature` - Signed by sender's key (Uint8Array)
- `transferCommitment.publicKey` - Sender's public key (Uint8Array)
- `transferCommitment.requestId` - Hash of (publicKey + stateHash)

**What we need to do:** Extract these properties and store them in the uncommitted transaction.

### Location 2: Where Uncommitted Transaction IS Created (send-token.ts)

**File:** `/home/vrogojin/cli/src/commands/send-token.ts`
**Lines:** 496-532 (Offline mode block)

```typescript
} else {
  // OFFLINE MODE: Create uncommitted transaction (no network submission)
  console.error('=== Offline Mode: Creating Uncommitted Transaction ===\n');

  console.error('Step 7: Creating uncommitted transfer transaction...');

  // Create transaction data structure WITHOUT inclusion proof
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
  };
```

**Current problem:** No `commitment` field!

**What needs to be added:**
```typescript
{
  type: 'transfer',
  data: { ... },
  commitment: {  // ADD THIS
    requestId: transferCommitment.requestId.toJSON(),
    signature: HexConverter.encode(transferCommitment.signature),
    publicKey: HexConverter.encode(transferCommitment.publicKey)
  }
}
```

### Location 3: Where Commitment IS RECREATED WITH WRONG KEY (receive-token.ts)

**File:** `/home/vrogojin/cli/src/commands/receive-token.ts`
**Lines:** 520-610 (NEEDS_RESOLUTION scenario, when `!hasAuthenticator`)

```typescript
} else {
  // Transaction is truly uncommitted (no authenticator) - SUBMIT to aggregator
  console.error('Uncommitted transaction detected - submitting to aggregator...\n');

  // Extract transfer details from uncommitted transaction
  const transferDetails = extractTransferDetails(lastTx);
  // ...

  // Get recipient secret
  console.error('Getting recipient secret...');
  const secret = await getSecret(options.unsafeSecret);
  const signingService = await SigningService.createFromSecret(secret);
  // signingService.publicKey is RECIPIENT's key

  // ... predicate creation ...

  // CREATE TRANSFER COMMITMENT - BUG IS HERE
  console.error('Creating transfer commitment...');
  const transferCommitment = await TransferCommitment.create(
    sourceToken,                 // Token with source state (sender's)
    recipientAddress,
    transferDetails.salt,        // Salt from transaction data
    recipientDataHash,           // DataHash | null
    null,                        // No message bytes in commitment
    signingService               // BUG: RECIPIENT's signing service!
  );
  console.error('  ✓ Commitment created\n');
```

**The bug:** Line 609 uses the recipient's `signingService` instead of the sender's.

**Why it's broken:**
- The commitment will be signed with the **recipient's private key**
- The source state predicate contains the **sender's public key**
- When the aggregator verifies the signature, it won't match
- Error: "Authenticator does not match source state predicate"

**What needs to be changed:**
Don't recreate the commitment. Instead, extract it from the uncommitted transaction:

```typescript
if (lastTx.commitment && lastTx.commitment.signature) {
  // Use pre-signed commitment from sender
  console.error('Using pre-signed commitment from sender...');

  const transferCommitment = ... // Reconstruct from lastTx.commitment

  // Don't create a new one!
} else {
  // Error: missing signature
  throw new Error('Offline transfer missing commitment signature');
}
```

## Data Flow in Committed Transaction

### Online Mode (send-token without --offline)

Lines 375-494 create a full transaction with inclusion proof:

```typescript
// Line 385: Submit to aggregator
await client.submitTransferCommitment(transferCommitment);

// Line 390: Wait for proof
const inclusionProof = await waitInclusionProof(client, transferCommitment);

// Line 478: Create transaction with proof
const transferTransaction = transferCommitment.toTransaction(inclusionProof);

// Result: Transaction object includes:
{
  "transactionHash": "...",
  "transactionData": {
    "sourceState": { ... },
    "recipient": "...",
    "salt": "...",
    "recipientDataHash": null,
    "message": null
  },
  "inclusionProof": {
    "authenticator": { ... },  // Signed by aggregator
    "transactionHash": "...",
    "merkleTreePath": [ ... ]
  }
}
```

The transaction contains the full proof. No additional signature needed when transfer is already confirmed.

### Offline Mode (send-token with --offline)

Lines 496-532 create an uncommitted transaction:

```typescript
// Current (BROKEN):
{
  type: 'transfer',
  data: {
    sourceState: { ... },
    recipient: "DIRECT://...",
    salt: "abcd...",
    recipientDataHash: null,
    message: null
  }
  // NO proof, NO signature
}

// Required (CORRECT):
{
  type: 'transfer',
  data: {
    sourceState: { ... },
    recipient: "DIRECT://...",
    salt: "abcd...",
    recipientDataHash: null,
    message: null
  },
  commitment: {              // NEW: Must store sender's signature
    requestId: "...",
    signature: "abcd1234...",  // Signed by SENDER
    publicKey: "5678efgh..."   // SENDER's key
  }
}
```

The `commitment` field stores the **sender's signature** which can be verified when the recipient submits the transfer.

## Extract Transfer Details Function

**File:** `/home/vrogojin/cli/src/utils/state-resolution.ts`

This function extracts transfer data from both committed and uncommitted transactions:

```typescript
export function extractTransferDetails(tx: any): {
  recipient: string;
  salt: Uint8Array;
  recipientDataHash: string | null;
  message: string | null;
} {
  if (tx.data) {
    return {
      recipient: tx.data.recipient,
      salt: HexConverter.decode(tx.data.salt),
      recipientDataHash: tx.data.recipientDataHash,
      message: tx.data.message
    };
  }
  // ...
}
```

**Enhancement needed:** Also extract `commitment` if present:

```typescript
export function extractCommitment(tx: any): {
  requestId: string;
  signature: Uint8Array;
  publicKey: Uint8Array;
} | null {
  if (tx.commitment && tx.commitment.signature) {
    return {
      requestId: tx.commitment.requestId,
      signature: HexConverter.decode(tx.commitment.signature),
      publicKey: HexConverter.decode(tx.commitment.publicKey)
    };
  }
  return null;
}
```

## Type Definition Location

**File:** `/home/vrogojin/cli/src/types/extended-txf.ts`

Current definition (INCOMPLETE):
```typescript
export interface IExtendedTxfToken {
  version: string;
  state: any;
  genesis: any;
  transactions: any[];  // Should be more specific
  nametags: any[];
  status: TokenStatus;
}
```

**Need to add specific transaction type:**
```typescript
export interface TransactionJSON {
  type: 'transfer' | 'mint' | 'receive';
  data?: {
    sourceState?: any;
    recipient?: string;
    salt?: string;
    recipientDataHash?: string | null;
    message?: string | null;
  };
  transactionHash?: string;
  transactionData?: any;
  inclusionProof?: {
    authenticator?: any;
    transactionHash?: string;
    merkleTreePath?: any[];
  };
  commitment?: {              // NEW: For uncommitted transfers
    requestId: string;
    signature: string;         // Hex-encoded
    publicKey: string;         // Hex-encoded
  };
}

export interface IExtendedTxfToken {
  version: string;
  state: any;
  genesis: any;
  transactions: TransactionJSON[];
  nametags: any[];
  status: TokenStatus;
}
```

## Scenario Detection Logic

**File:** `/home/vrogojin/cli/src/utils/state-resolution.ts`

Function `detectScenario()` determines what to do:

```typescript
export function detectScenario(extendedTxf: IExtendedTxfToken): string | null {
  if (!extendedTxf.transactions || extendedTxf.transactions.length === 0) {
    return null;
  }

  const lastTx = extendedTxf.transactions[extendedTxf.transactions.length - 1];

  // Check for uncommitted transaction (no authenticator)
  const hasAuthenticator = lastTx.inclusionProof && lastTx.inclusionProof.authenticator;

  if (!hasAuthenticator) {
    return 'NEEDS_RESOLUTION';  // Must submit to get proof
  }

  // Check if proof is complete
  if (lastTx.inclusionProof && lastTx.inclusionProof.transactionHash) {
    return 'ONLINE_COMPLETE';  // Ready to receive
  }

  return null;
}
```

For NEEDS_RESOLUTION scenario, we need to check if `commitment` field exists:

```typescript
if (!hasAuthenticator) {
  const hasCommitmentSignature = lastTx.commitment && lastTx.commitment.signature;

  if (!hasCommitmentSignature) {
    // Cannot submit - would require sender's key
    throw new Error('Uncommitted transaction missing commitment signature');
  }

  return 'NEEDS_RESOLUTION';
}
```

## Implementation Checklist

1. **send-token.ts (Line ~360):** After creating TransferCommitment, extract signature
2. **send-token.ts (Line ~500):** Add `commitment` field to uncommitted transaction
3. **receive-token.ts (Line ~590):** Check for stored commitment before recreating
4. **receive-token.ts (Line ~603):** Use stored commitment instead of creating new one
5. **extended-txf.ts:** Add type definitions for commitment field
6. **state-resolution.ts:** Add `extractCommitment()` helper function
7. **state-resolution.ts:** Update scenario detection to check for commitment signature
8. **Tests:** Create offline transfer and verify it can be submitted

## Summary Table

| Component | Current Behavior | Required Behavior |
|-----------|-----------------|-------------------|
| send-token.ts line 365 | Creates commitment with sender's key | Creates + **extracts signature** |
| send-token.ts line 500 | Stores transfer data only | Stores transfer data + **commitment signature** |
| receive-token.ts line 527 | Gets recipient's secret | Gets recipient's secret (unchanged) |
| receive-token.ts line 603 | Creates NEW commitment with recipient's key | Uses pre-signed commitment from storage |
| Aggregator verification | Fails: recipient's key ≠ source state predicate | Succeeds: sender's key = source state predicate |

## Why This Order of Operations Matters

1. **Sender must sign first** (in send-token)
   - At this point, sender has their secret
   - Creates commitment proving sender authorized transfer
   - Signs with sender's key

2. **Signature must be stored** (in send-token offline transaction)
   - So recipient doesn't need sender's secret
   - Proof of authorization travels with the file

3. **Recipient must use stored signature** (in receive-token)
   - Recipient only has their own secret
   - Uses pre-signed commitment from sender
   - Submits with sender's original signature

4. **Aggregator verifies sender's signature** (in aggregator)
   - Checks signature against sender's public key in source state
   - Signature matches because it was created by sender
   - Transfer is authorized

Without this order, the cryptographic proof chain breaks.
