# Token Data Verification Issue: Root Cause Analysis

## Executive Summary

**Issue:** Tokens minted with `-d` data flag fail SDK comprehensive verification when attempting to transfer them.

**Root Cause:** Missing `recipientDataHash` in the mint transaction. The SDK's `verifyRecipientData()` method expects that when a token has state data, the genesis transaction must contain a `recipientDataHash` field that matches the hash of the state data.

**Status:** This is a fundamental SDK design requirement that our CLI implementation is violating.

---

## The SDK Verification Logic

### Token.verify() Flow

When `token.verify(trustBase)` is called (line 136-147 in Token.js):

```javascript
async verify(trustBase) {
    const results = [];
    // 1. Verify genesis transaction
    results.push(VerificationResult.fromChildren('Genesis verification', 
        [await this.genesis.verify(trustBase)]));
    
    // 2. Verify each transfer transaction
    for (let i = 0; i < this._transactions.length; i++) {
        const transaction = this._transactions[i];
        results.push(VerificationResult.fromChildren('Transaction verification', [
            await transaction.verify(trustBase, previousToken)
        ]));
    }
    
    // 3. Verify CURRENT STATE (this is where we fail!)
    results.push(VerificationResult.fromChildren('Current state verification', 
        await Promise.all([
            this.verifyNametagTokens(trustBase),
            this.verifyRecipient(),
            this.verifyRecipientData()  // ← FAILS HERE
        ])));
    
    return VerificationResult.fromChildren('Token verification', results);
}
```

### The verifyRecipientData() Check

Line 168-176 in Token.js:

```javascript
async verifyRecipientData() {
    // Get the most recent transaction (genesis if no transfers)
    const previousTransaction = this.transactions.length
        ? this.transactions.at(-1)
        : this.genesis;
    
    // Check if state.data matches the recipientDataHash in the transaction
    if (!(await previousTransaction.containsRecipientData(this.state.data))) {
        return new VerificationResult(VerificationResultCode.FAIL, 
            'State data hash does not match previous transaction recipient data hash');
    }
    
    return new VerificationResult(VerificationResultCode.OK, 'Recipient data verification');
}
```

### The containsRecipientData() Logic

Line 21-30 in Transaction.js:

```javascript
async containsRecipientData(data) {
    if (this.data.recipientDataHash) {
        // If transaction has recipientDataHash, verify data matches
        if (!data) {
            return false;  // Transaction expects data but none provided
        }
        const dataHash = await new DataHasher(this.data.recipientDataHash.algorithm)
            .update(data)
            .digest();
        return dataHash.equals(this.data.recipientDataHash);
    }
    
    // If transaction has NO recipientDataHash, data MUST be empty/null
    return !data;  // ← THIS IS WHY WE FAIL!
}
```

---

## The Problem in Our Token

### What We Create

```json
{
  "genesis": {
    "data": {
      "coinData": [],
      "reason": null,
      "recipient": "DIRECT://...",
      "recipientDataHash": null,  // ← NO HASH!
      "salt": "...",
      "tokenData": "7b2274657374223a226f726967696e616c227d",  // {"test":"original"}
      "tokenId": "...",
      "tokenType": "..."
    }
  },
  "state": {
    "data": "7b2274657374223a226f726967696e616c227d",  // {"test":"original"}
    "predicate": "..."
  }
}
```

### What the SDK Expects

When `state.data` is NOT empty, the SDK expects:

```json
{
  "genesis": {
    "data": {
      "recipientDataHash": {
        "algorithm": "SHA-256",
        "data": "<sha256 hash of state.data>"  // ← MUST BE PRESENT!
      },
      "tokenData": "7b2274657374223a226f726967696e616c227d"
    }
  },
  "state": {
    "data": "7b2274657374223a226f726967696e616c227d"
  }
}
```

### The Verification Failure

1. **Token has state.data:** `"7b2274657374223a226f726967696e616c227d"` (non-empty)
2. **Genesis has recipientDataHash:** `null`
3. **containsRecipientData(state.data) logic:**
   - `recipientDataHash` is `null` → no hash in transaction
   - Returns `!data` → `!("7b...95")` → `false` (since data is NOT empty)
4. **verifyRecipientData() fails:** "State data hash does not match previous transaction recipient data hash"

---

## Why This Happens

### In mint-token.ts (Line 442-453)

```typescript
// STEP 3: Create MintTransactionData using the address
console.error('Step 3: Creating MintTransactionData...');
const mintTransactionData = await MintTransactionData.create(
  tokenId,
  tokenType,
  tokenDataBytes,  // ← This becomes genesis.data.tokenData
  coinData,
  address,         // ← This becomes genesis.data.recipient
  salt,
  null,            // Nametag tokens
  null             // Owner reference
);
```

**Missing parameter:** `recipientDataHash`

The SDK's `MintTransactionData.create()` method signature likely includes a parameter for `recipientDataHash`, but we're not providing it.

---

## The SDK Design Intent

### Token Data vs State Data

The SDK distinguishes between:

1. **`tokenData`** (genesis.data.tokenData):
   - Immutable metadata about the token itself
   - Set at mint time, never changes
   - Examples: NFT metadata, token symbol, decimals
   - Always visible in genesis transaction

2. **`state.data`** (current state data):
   - Mutable data that changes with each transfer
   - The "payload" being transferred
   - Must be committed to via `recipientDataHash`
   - Hidden from transaction unless hash is revealed

### The Commitment Pattern

When minting a token WITH state data:

```
1. Mint transaction specifies recipientDataHash = SHA256(state.data)
2. Token is created with state.data
3. On verification: SDK recomputes SHA256(state.data) and compares to recipientDataHash
4. If match → data is authentic
5. If mismatch → data has been tampered with
```

This is a **cryptographic commitment** pattern - the transaction commits to what data the recipient will receive WITHOUT revealing the data itself.

---

## Solutions

### Option 1: Set recipientDataHash in mint-token.ts (CORRECT FIX)

Modify `mint-token.ts` line 442-453 to compute and provide the recipientDataHash:

```typescript
// Process token data
let tokenDataBytes: Uint8Array;
let recipientDataHash: DataHash | null = null;

if (options.tokenData) {
  tokenDataBytes = await processInput(options.tokenData, 'token data', { allowEmpty: false });
  
  // Compute recipientDataHash for state.data
  const hasher = new DataHasher(HashAlgorithm.SHA256);
  recipientDataHash = await hasher.update(tokenDataBytes).digest();
  
  console.error(`Computed recipientDataHash: ${HexConverter.encode(recipientDataHash.data)}`);
} else {
  tokenDataBytes = new Uint8Array(0);
  console.error('Using empty token data');
}

// STEP 3: Create MintTransactionData with recipientDataHash
const mintTransactionData = await MintTransactionData.create(
  tokenId,
  tokenType,
  tokenDataBytes,      // genesis.data.tokenData
  coinData,
  address,
  salt,
  recipientDataHash,   // ← ADD THIS!
  null,                // Nametag tokens
  null                 // Owner reference
);
```

### Option 2: Separate tokenData from state.data (DESIGN CHANGE)

Modify the CLI to distinguish between:
- `-d, --token-data`: Immutable token metadata (goes to genesis.data.tokenData ONLY)
- `--state-data`: Initial state data (goes to state.data with recipientDataHash)

This would match the SDK's design intent more closely.

---

## Testing the Fix

### Before Fix

```bash
SECRET="test-data" npm run mint-token -- --preset nft --local -d '{"test":"original"}' -o /tmp/test.txf
SECRET="test-data" npm run send-token -- -f /tmp/test.txf -r "DIRECT://..." --local -o /tmp/transfer.txf
# ❌ Fails: SDK comprehensive verification failed
```

### After Fix

```bash
SECRET="test-data" npm run mint-token -- --preset nft --local -d '{"test":"original"}' -o /tmp/test.txf
# ✓ genesis.data.recipientDataHash = SHA256({"test":"original"})

SECRET="test-data" npm run send-token -- -f /tmp/test.txf -r "DIRECT://..." --local -o /tmp/transfer.txf
# ✓ SDK verification passes (recipientDataHash matches state.data)
```

---

## Impact Analysis

### Affected Commands

1. **mint-token:** Creates tokens with invalid recipientDataHash
2. **send-token:** Fails verification when source token has data
3. **receive-token:** May fail when processing transfers with data

### Severity

**HIGH** - This is a fundamental correctness issue. Tokens minted with data cannot be transferred, making the `-d` flag essentially broken.

### Backwards Compatibility

**BREAKING** - Tokens minted with the current implementation will fail SDK verification. Existing tokens with data in production may be affected.

---

## Additional Questions for SDK Team

1. **Is `tokenData` supposed to be copied to `state.data`?**
   - Or should they be separate concepts?
   - Should `-d` populate `tokenData` only, or also `state.data`?

2. **What is the intended use of `state.data` in mint transactions?**
   - For fungible tokens with amounts?
   - For NFTs with dynamic metadata?
   - For arbitrary payloads?

3. **Should tokens minted WITHOUT data have empty state.data?**
   - Current behavior: `state.data = tokenData` (even if empty)
   - Expected behavior: `state.data = null` or `state.data = ""`?

4. **Is there SDK documentation on the recipientDataHash pattern?**
   - We couldn't find comprehensive docs on this cryptographic commitment

---

## References

### SDK Source Code

- **Token.verify()**: `@unicitylabs/state-transition-sdk/lib/token/Token.js:136-147`
- **verifyRecipientData()**: `@unicitylabs/state-transition-sdk/lib/token/Token.js:168-176`
- **containsRecipientData()**: `@unicitylabs/state-transition-sdk/lib/transaction/Transaction.js:21-30`

### CLI Source Code

- **mint-token.ts**: `/home/vrogojin/cli/src/commands/mint-token.ts:442-453`
- **Token structure**: Lines 494-518 (TokenState creation)

### Test Token

- **File**: `/tmp/test-data-token.txf`
- **State data**: `7b2274657374223a226f726967696e616c227d` ({"test":"original"})
- **recipientDataHash**: `null` (should be SHA256 of state data)

---

## Next Steps

1. **Implement Option 1** (add recipientDataHash computation)
2. **Add test case** for tokens with data
3. **Verify fix** with send-token and receive-token
4. **Update documentation** to explain tokenData vs state.data distinction
5. **Consider breaking change** if existing tokens are affected
