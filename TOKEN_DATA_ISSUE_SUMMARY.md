# Token Data Issue: Executive Summary

## TL;DR

**Problem:** Tokens minted with `-d` flag fail SDK verification when transferring.

**Root Cause:** Missing `recipientDataHash` parameter in `MintTransactionData.create()` call.

**Fix:** Compute SHA256 hash of token data and pass it as `recipientDataHash`.

**Impact:** HIGH - `-d` flag is essentially broken for transfers.

---

## Quick Diagnosis

### What the SDK Expects

```javascript
// Token.js:168-176 - verifyRecipientData()
async verifyRecipientData() {
    const previousTransaction = this.genesis;
    
    // Calls containsRecipientData() to verify state.data
    if (!(await previousTransaction.containsRecipientData(this.state.data))) {
        return FAIL;
    }
    return OK;
}

// Transaction.js:21-30 - containsRecipientData()
async containsRecipientData(data) {
    if (this.data.recipientDataHash) {
        // If recipientDataHash exists, hash must match data
        const dataHash = await hash(data);
        return dataHash.equals(this.data.recipientDataHash);
    }
    
    // If NO recipientDataHash, data MUST be empty/null
    return !data;  // ← Fails when data is present but no hash!
}
```

### What We're Creating (BROKEN)

```json
{
  "genesis": {
    "data": {
      "recipientDataHash": null,  // ← NO HASH!
      "tokenData": "7b2274657374..."  // ← Has data
    }
  },
  "state": {
    "data": "7b2274657374..."  // ← Has data, but no hash to verify against!
  }
}
```

**Result:** `containsRecipientData(state.data)` returns `false` because:
- `recipientDataHash` is `null` (no hash)
- But `data` is NOT empty
- SDK expects: if no hash, then no data

---

## The Fix

### Code Change Required

In `/home/vrogojin/cli/src/commands/mint-token.ts`:

```typescript
// 1. Add import
import { DataHash } from '@unicitylabs/state-transition-sdk/lib/hash/DataHash.js';

// 2. Compute hash when processing token data (line ~398)
let recipientDataHash: DataHash | null = null;

if (options.tokenData) {
  tokenDataBytes = await processInput(options.tokenData, ...);
  
  // NEW: Compute recipientDataHash
  const hasher = new DataHasher(HashAlgorithm.SHA256);
  recipientDataHash = await hasher.update(tokenDataBytes).digest();
} else {
  tokenDataBytes = new Uint8Array(0);
}

// 3. Pass recipientDataHash to SDK (line ~442)
const mintTransactionData = await MintTransactionData.create(
  tokenId,
  tokenType,
  tokenDataBytes,
  coinData,
  address,
  salt,
  recipientDataHash,  // ← ADD THIS (was: null)
  null                // reason
);
```

### Why This Works

With the fix, tokens have:

```json
{
  "genesis": {
    "data": {
      "recipientDataHash": {
        "algorithm": "SHA-256",
        "data": "44136fa355b367..."  // ← SHA256 of tokenData
      },
      "tokenData": "7b2274657374..."
    }
  },
  "state": {
    "data": "7b2274657374..."  // ← Matches tokenData
  }
}
```

**Result:** `containsRecipientData(state.data)` returns `true` because:
- `recipientDataHash` exists
- SHA256(state.data) matches recipientDataHash
- SDK verification passes

---

## Testing

### Before Fix

```bash
$ SECRET="test" npm run mint-token -- --local -d '{"test":"data"}' -o /tmp/token.txf
$ SECRET="test" npm run send-token -- -f /tmp/token.txf -r "DIRECT://..." --local

❌ Token proof validation failed:
  - SDK comprehensive verification failed (state data hash mismatch or invalid recipient data)
```

### After Fix

```bash
$ SECRET="test" npm run mint-token -- --local -d '{"test":"data"}' -o /tmp/token.txf
Computed recipientDataHash: 44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a

$ SECRET="test" npm run send-token -- -f /tmp/token.txf -r "DIRECT://..." --local

✓ SDK comprehensive verification passed
✅ Transfer saved to /tmp/transfer.txf
```

---

## Files to Review

1. **Root Cause Analysis:**
   - `/home/vrogojin/cli/TOKEN_DATA_VERIFICATION_ISSUE.md`
   - Comprehensive explanation of SDK verification logic
   - Line-by-line analysis of why it fails

2. **Implementation Guide:**
   - `/home/vrogojin/cli/TOKEN_DATA_FIX_IMPLEMENTATION.md`
   - Complete diff and code changes
   - Testing checklist and verification steps

3. **Broken Token Example:**
   - `/tmp/test-data-token.txf`
   - Shows token with `recipientDataHash: null`
   - Demonstrates the failure case

4. **SDK Source References:**
   - `node_modules/@unicitylabs/state-transition-sdk/lib/token/Token.js:136-176`
   - `node_modules/@unicitylabs/state-transition-sdk/lib/transaction/Transaction.js:21-30`
   - `node_modules/@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionData.d.ts:47`

---

## Impact Assessment

### Severity: HIGH

- `-d` flag is completely broken for transfers
- Affects ALL tokens minted with data
- No workaround without code fix

### Affected Commands

1. **mint-token:** Creates invalid tokens (when using `-d`)
2. **send-token:** Fails verification for tokens with data
3. **receive-token:** May fail processing transfers with data

### Backwards Compatibility: BREAKING

- Tokens minted before fix are INVALID
- Cannot be transferred without re-minting
- Existing tokens must be recreated

---

## Questions Answered

### 1. Is there an issue with how we're minting tokens with data?

**Yes.** We're not computing the `recipientDataHash` parameter required by the SDK.

### 2. What does `token.verify(trustBase)` actually check?

It checks:
1. Genesis transaction proof validity
2. All transfer transaction proofs
3. **Current state verification** (this is where we fail):
   - Recipient address matches predicate
   - **Recipient data hash matches state.data** ← FAILS HERE

### 3. Is there a specific way tokens with data should be structured?

**Yes.** When `state.data` is non-empty, `genesis.data.recipientDataHash` MUST contain the SHA256 hash of that data. This is a cryptographic commitment pattern.

### 4. Should tokens minted with `-d` data work normally?

**Yes,** but only if `recipientDataHash` is provided. The SDK enforces this invariant:

```
IF recipientDataHash == null THEN state.data MUST be empty/null
IF recipientDataHash != null THEN SHA256(state.data) MUST equal recipientDataHash
```

---

## Key Insights

### SDK Design Intent

The SDK uses a **cryptographic commitment** pattern:

1. **Mint transaction commits to data** via `recipientDataHash`
2. **Token state contains actual data** in `state.data`
3. **Verification ensures data wasn't tampered** by recomputing hash

This allows:
- **Privacy:** Transaction doesn't reveal data (only hash)
- **Integrity:** Data can't be modified after minting
- **Proof:** Anyone can verify data matches commitment

### tokenData vs state.data

The SDK distinguishes:

- **`tokenData`** (genesis.data.tokenData):
  - Immutable metadata about the token
  - Set at mint, never changes
  - Example: NFT metadata, symbol, decimals
  
- **`state.data`** (state.data):
  - Current state data (can change with transfers)
  - Must match `recipientDataHash` from previous transaction
  - Example: Token payload, ownership proof

Our CLI currently uses `-d` to populate BOTH fields with the same value, which works but may not match SDK design intent.

---

## Next Steps

1. **Implement the fix** (see `TOKEN_DATA_FIX_IMPLEMENTATION.md`)
2. **Test thoroughly** with tokens with/without data
3. **Update BATS tests** to cover this scenario
4. **Document breaking change** in CHANGELOG
5. **Consider design:** Should `-d` populate tokenData, state.data, or both?

---

## References

- **SDK Methods:**
  - `Token.verify()` - Validates entire token state
  - `Token.verifyRecipientData()` - Checks data hash
  - `Transaction.containsRecipientData()` - Hash comparison logic
  
- **CLI Code:**
  - `src/commands/mint-token.ts:442-453` - MintTransactionData.create() call
  - `src/commands/mint-token.ts:398-405` - Token data processing
  - `src/utils/proof-validation.ts:344-377` - SDK verification wrapper

- **Test Token:**
  - `/tmp/test-data-token.txf` - Example of broken token structure

