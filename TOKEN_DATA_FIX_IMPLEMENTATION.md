# Token Data Fix: Implementation Guide

## Confirmed SDK Signature

From `@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionData.d.ts:47`:

```typescript
static create<R extends IMintTransactionReason>(
    tokenId: TokenId,
    tokenType: TokenType,
    tokenData: Uint8Array | null,           // Parameter 3
    coinData: TokenCoinData | null,          // Parameter 4
    recipient: IAddress,                     // Parameter 5
    salt: Uint8Array,                        // Parameter 6
    recipientDataHash: DataHash | null,      // Parameter 7 ← WE'RE MISSING THIS!
    reason: R | null                         // Parameter 8
): Promise<MintTransactionData<R>>;
```

---

## Current Implementation (BROKEN)

In `/home/vrogojin/cli/src/commands/mint-token.ts:442-453`:

```typescript
const mintTransactionData = await MintTransactionData.create(
  tokenId,        // ✓ Parameter 1
  tokenType,      // ✓ Parameter 2
  tokenDataBytes, // ✓ Parameter 3 (genesis.data.tokenData)
  coinData,       // ✓ Parameter 4
  address,        // ✓ Parameter 5
  salt,           // ✓ Parameter 6
  null,           // ❌ Parameter 7 - should be recipientDataHash, NOT nametags!
  null            // ❌ Parameter 8 - should be reason, NOT owner ref!
);
```

**Bug:** We're passing `null` for both `recipientDataHash` and `reason`, but in the wrong positions! The comment in our code says "Nametag tokens" and "Owner reference", which don't exist in the actual signature.

---

## Fixed Implementation

### Step 1: Import DataHash

Add to imports at top of `mint-token.ts`:

```typescript
import { DataHash } from '@unicitylabs/state-transition-sdk/lib/hash/DataHash.js';
```

### Step 2: Compute recipientDataHash

Replace lines 398-405 in `mint-token.ts`:

```typescript
// Process token data
let tokenDataBytes: Uint8Array;
let recipientDataHash: DataHash | null = null;

if (options.tokenData) {
  tokenDataBytes = await processInput(options.tokenData, 'token data', { allowEmpty: false });
  
  // CRITICAL: Compute recipientDataHash to commit to state.data
  // This is required for SDK verification of tokens with data
  const hasher = new DataHasher(HashAlgorithm.SHA256);
  recipientDataHash = await hasher.update(tokenDataBytes).digest();
  
  console.error(`Token data: ${HexConverter.encode(tokenDataBytes)}`);
  console.error(`Computed recipientDataHash: ${HexConverter.encode(recipientDataHash.data)}`);
} else {
  // Empty token data (no recipientDataHash needed)
  tokenDataBytes = new Uint8Array(0);
  console.error('Using empty token data');
}
```

### Step 3: Pass recipientDataHash to MintTransactionData.create()

Replace lines 442-453 in `mint-token.ts`:

```typescript
// STEP 3: Create MintTransactionData using the address
console.error('Step 3: Creating MintTransactionData...');
const mintTransactionData = await MintTransactionData.create(
  tokenId,           // Token identifier
  tokenType,         // Token type identifier
  tokenDataBytes,    // Immutable token metadata (genesis.data.tokenData)
  coinData,          // Fungible coin data, or null
  address,           // Address of the first owner
  salt,              // Random salt used to derive predicates
  recipientDataHash, // ✅ FIXED: Commit to state.data via hash
  null               // Reason (optional)
);
console.error('  ✓ MintTransactionData created\n');
```

---

## Complete Diff

```diff
--- a/src/commands/mint-token.ts
+++ b/src/commands/mint-token.ts
@@ -2,6 +2,7 @@ import { Command } from 'commander';
 import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
 import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
+import { DataHash } from '@unicitylabs/state-transition-sdk/lib/hash/DataHash.js';
 import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
 import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';
 import { TokenType } from '@unicitylabs/state-transition-sdk/lib/token/TokenType.js';
@@ -396,11 +397,20 @@ export function mintTokenCommand(program: Command): void {
 
         // Process token data
+        let tokenDataBytes: Uint8Array;
+        let recipientDataHash: DataHash | null = null;
+
         if (options.tokenData) {
           tokenDataBytes = await processInput(options.tokenData, 'token data', { allowEmpty: false });
+          
+          // CRITICAL: Compute recipientDataHash to commit to state.data
+          // This is required for SDK verification of tokens with data
+          const hasher = new DataHasher(HashAlgorithm.SHA256);
+          recipientDataHash = await hasher.update(tokenDataBytes).digest();
+          
+          console.error(`Token data: ${HexConverter.encode(tokenDataBytes)}`);
+          console.error(`Computed recipientDataHash: ${HexConverter.encode(recipientDataHash.data)}`);
         } else {
-          // Empty token data
+          // Empty token data (no recipientDataHash needed)
           tokenDataBytes = new Uint8Array(0);
           console.error('Using empty token data');
         }
@@ -441,13 +451,13 @@ export function mintTokenCommand(program: Command): void {
         // STEP 3: Create MintTransactionData using the address
         console.error('Step 3: Creating MintTransactionData...');
         const mintTransactionData = await MintTransactionData.create(
-          tokenId,
-          tokenType,
-          tokenDataBytes,  // ← This becomes genesis.data.tokenData
-          coinData,
-          address,         // ← This becomes genesis.data.recipient
-          salt,
-          null,            // Nametag tokens
-          null             // Owner reference
+          tokenId,           // Token identifier
+          tokenType,         // Token type identifier
+          tokenDataBytes,    // Immutable token metadata (genesis.data.tokenData)
+          coinData,          // Fungible coin data, or null
+          address,           // Address of the first owner
+          salt,              // Random salt used to derive predicates
+          recipientDataHash, // Commit to state.data via hash
+          null               // Reason (optional)
         );
         console.error('  ✓ MintTransactionData created\n');
```

---

## Expected Output After Fix

### Minting Token WITH Data

```bash
$ SECRET="test-data" npm run mint-token -- --preset nft --local -d '{"test":"original"}' -o /tmp/test.txf
=== Self-Mint Pattern: Minting token to yourself ===

Using UNMASKED predicate (reusable address)
Public Key: 03bf5055f7cd4338edbcc55e9fa61f63f2a69bdc5cebc68061dbb5a686f7491de9

Loading trust base...
  ✓ Trust base ready (Network ID: 1, Epoch: 1731261320)

Generated random tokenId: d06498d360a164f5c3a45d67bb75f65fe4ba4c1b4b327b4073b64babc66c4595
Using preset token type "nft" (unicity)
  TokenType ID: f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509
  Asset kind: non-fungible
Salt: b1e4ef830c7569aa6c1fbc8c200d30e88f9225e060811d7dc49790d865eb80a3

Step 1: Creating predicate...
  ✓ Predicate created

Step 2: Deriving address from predicate...
  ✓ Address: DIRECT://0000e78f806ba5af282df1995fe53799752f1b55e9766e436acb6ebe976dd89dc4acad2371d3

Token data: 7b2274657374223a226f726967696e616c227d
Computed recipientDataHash: 44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a  ← NEW!

Step 3: Creating MintTransactionData...
  ✓ MintTransactionData created
  
[... rest of output ...]

✅ Token saved to /tmp/test.txf
```

### Token Structure After Fix

```json
{
  "genesis": {
    "data": {
      "recipientDataHash": {                                                        ← FIXED!
        "algorithm": "SHA-256",                                                     ← NEW!
        "data": "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"  ← NEW!
      },
      "tokenData": "7b2274657374223a226f726967696e616c227d",
      "recipient": "DIRECT://...",
      "salt": "...",
      "coinData": [],
      "reason": null,
      "tokenId": "...",
      "tokenType": "..."
    }
  },
  "state": {
    "data": "7b2274657374223a226f726967696e616c227d",  ← Same as tokenData
    "predicate": "..."
  }
}
```

### Transfer Works After Fix

```bash
$ SECRET="test-data" npm run send-token -- -f /tmp/test.txf -r "DIRECT://..." --local -o /tmp/transfer.txf

Step 1.8: Validating token proofs cryptographically...
  ✓ Genesis transaction inclusion proof verified (authenticator + Merkle path)
  ✓ SDK comprehensive verification passed                                        ← FIXED!

[... transfer succeeds ...]

✅ Transfer saved to /tmp/transfer.txf
```

---

## Verification Tests

### Test 1: Token WITH Data (Should Pass)

```bash
# Mint token with data
SECRET="test-with-data" npm run mint-token -- --preset nft --local -d '{"nft":"metadata"}' -o /tmp/with-data.txf

# Verify recipientDataHash is present
jq '.genesis.data.recipientDataHash' /tmp/with-data.txf
# Expected: { "algorithm": "SHA-256", "data": "..." }

# Transfer should work
SECRET="test-with-data" npm run send-token -- -f /tmp/with-data.txf -r "DIRECT://..." --local -o /tmp/transfer.txf
# Expected: ✓ SDK comprehensive verification passed
```

### Test 2: Token WITHOUT Data (Should Pass)

```bash
# Mint token without data
SECRET="test-no-data" npm run mint-token -- --preset nft --local -o /tmp/no-data.txf

# Verify recipientDataHash is null
jq '.genesis.data.recipientDataHash' /tmp/no-data.txf
# Expected: null

# Transfer should work
SECRET="test-no-data" npm run send-token -- -f /tmp/no-data.txf -r "DIRECT://..." --local -o /tmp/transfer.txf
# Expected: ✓ SDK comprehensive verification passed
```

### Test 3: Fungible Token WITH Data (Edge Case)

```bash
# Mint fungible token with custom data
SECRET="test-fungible" npm run mint-token -- --preset alpha --local -d '{"symbol":"UCT"}' -c "1000000000000000000" -o /tmp/fungible-data.txf

# Verify both recipientDataHash and coinData
jq '.genesis.data | {recipientDataHash, coinData}' /tmp/fungible-data.txf
# Expected: recipientDataHash != null, coinData has 1 coin

# Transfer should work
SECRET="test-fungible" npm run send-token -- -f /tmp/fungible-data.txf -r "DIRECT://..." --local -o /tmp/transfer.txf
# Expected: ✓ SDK comprehensive verification passed
```

---

## Backwards Compatibility Impact

### Tokens Minted BEFORE Fix

- **Status:** INVALID (will fail SDK verification)
- **Cannot be transferred** via send-token
- **Recommended action:** Re-mint with fixed CLI

### Tokens Minted AFTER Fix

- **Status:** VALID (pass SDK verification)
- **Can be transferred** normally
- **Fully compatible** with SDK expectations

### Migration Path for Existing Tokens

If you have tokens minted with the old CLI:

1. **Extract the tokenData** from existing token
2. **Re-mint** with same tokenData using fixed CLI
3. **Replace old token file** with new one

Example:

```bash
# Extract tokenData from old token
TOKEN_DATA=$(jq -r '.genesis.data.tokenData' old-token.txf)

# Re-mint with same data
SECRET="same-secret" npm run mint-token -- --preset nft --local -d "0x$TOKEN_DATA" -o new-token.txf
```

---

## Related Issues

This fix also resolves:

1. **send-token verification failures** for tokens with data
2. **receive-token processing failures** for offline transfers with data
3. **verify-token inconsistencies** where SDK verification differs from CLI validation

---

## Testing Checklist

- [ ] Mint token WITH data - verify recipientDataHash is computed
- [ ] Mint token WITHOUT data - verify recipientDataHash is null
- [ ] Transfer token WITH data - verify SDK verification passes
- [ ] Transfer token WITHOUT data - verify SDK verification passes
- [ ] Receive token with data - verify processing works
- [ ] Verify recipientDataHash matches SHA256(state.data)
- [ ] Test with NFT preset (non-fungible)
- [ ] Test with UCT preset (fungible with coins)
- [ ] Test with custom tokenType
- [ ] Update BATS test suite to cover this scenario

---

## Documentation Updates Required

1. **docs/guides/mint-token.md**
   - Explain `tokenData` vs `state.data`
   - Document recipientDataHash commitment pattern
   
2. **docs/reference/api-reference.md**
   - Update `-d` flag description to mention cryptographic commitment
   
3. **CLAUDE.md**
   - Add note about recipientDataHash requirement
   - Explain SDK verification requirements

4. **CHANGELOG.md**
   - Add breaking change notice
   - Document migration path for existing tokens

---

## Follow-up Questions for SDK Team

1. **Is this the intended behavior?**
   - Should `tokenData` always be copied to `state.data`?
   - Or should they be separate fields?

2. **Documentation clarity:**
   - Can we add SDK docs explaining recipientDataHash pattern?
   - Should there be a warning when creating tokens without recipientDataHash?

3. **Edge cases:**
   - What if `tokenData` is empty but `state.data` is not?
   - What if `recipientDataHash` is provided but doesn't match `state.data`?
   - Should the SDK automatically compute recipientDataHash from tokenData?

