# Investigation: Minting Tokens with Public Predicate

## Question
Can we mint tokens directly to a public address (predicate) knowing only the recipient's address, without their private key?

## Answer: NO

### Why Not?

The Unicity SDK has a **one-way cryptographic flow**:

```
Private Key → Public Key → Predicate → Predicate Reference → Hash → Address
```

This is **irreversible**. You cannot go backwards from address to predicate.

### Technical Details

1. **Address Structure**:
   ```javascript
   const address = await AddressFactory.createAddress(
     'DIRECT://00001416858a469ab52f5c96b7b31bdf04f7dfc787a4064098a040ba1fc5346a3ba1266650c8'
   );
   ```
   - The address contains a **HASH** of the predicate reference
   - NOT the actual public key or predicate
   - Hash is one-way - cannot derive the original key

2. **Predicate Creation Requires Private Key**:
   ```javascript
   const predicate = await UnmaskedPredicate.create(
     tokenId,
     tokenType,
     signingService,  // ← Requires private key!
     HashAlgorithm.SHA256,
     salt
   );
   ```
   - `SigningService` must be created from the private key
   - Without private key, cannot create predicate
   - Cannot use `Token.mint()` without predicate

3. **Token.mint() Requires Predicate**:
   ```javascript
   const tokenState = new TokenState(predicate, data);  // ← Need predicate!
   const token = await Token.mint(
     trustBase,
     tokenState,
     mintTransaction,
     []
   );
   ```
   - `TokenState` constructor requires a `Predicate` instance
   - Cannot create `TokenState` without predicate
   - Therefore cannot use `Token.mint()` for external addresses

## Two Distinct Scenarios

### Scenario 1: Self-Mint (Have Private Key) ✅

**Can use proper SDK methods:**

```javascript
// 1. Create predicate from OUR signing service
const predicate = await UnmaskedPredicate.create(
  tokenId, tokenType, signingService, HashAlgorithm.SHA256, salt
);

// 2. Derive address FROM the predicate
const predicateRef = await predicate.getReference();
const address = await predicateRef.toAddress();

// 3. Create mint transaction data
const mintTxData = await MintTransactionData.create(
  tokenId, tokenType, data, coins, address.address, salt, null, null
);

// 4. Submit, get inclusion proof

// 5. Create TokenState with SAME predicate instance
const tokenState = new TokenState(predicate, data);

// 6. Use Token.mint() - performs internal verification
const token = await Token.mint(
  trustBase, tokenState, mintTransaction, []
);

// 7. Get proper TXF format
const txfJson = token.toJSON();
```

**Result:** ✅ Proper SDK-compliant TXF format

**TXF Structure:**
```json
{
  "version": "2.0",
  "genesis": {
    "data": { ... },
    "inclusionProof": { ... }
  },
  "state": {
    "data": "...",
    "predicate": "..."  // ← Has the predicate!
  },
  "transactions": [],
  "nametags": []
}
```

### Scenario 2: Airdrop to External Address (No Private Key) ❌

**Cannot use Token.mint():**

```javascript
// 1. We have recipient's address
const recipientAddress = 'DIRECT://0000...';

// 2. ❌ Cannot create predicate - no private key
// Cannot call: UnmaskedPredicate.create(...)

// 3. ✓ CAN create MintTransactionData (only needs address string)
const mintTxData = await MintTransactionData.create(
  tokenId, tokenType, data, coins, recipientAddress, salt, null, null
);

// 4. ✓ CAN submit and get inclusion proof

// 5. ❌ Cannot create TokenState - no predicate
// Cannot call: new TokenState(???, data)

// 6. ❌ Cannot use Token.mint()
// Cannot call: Token.mint(trustBase, ???, ...)

// 7. Must use custom TXF format OR different approach
```

**Result:** ❌ Cannot use SDK's Token.mint() - must find alternative

## Solutions for Airdrop Scenario

### Option A: Mint to Self, Then Transfer (RECOMMENDED)

**Flow:**
1. Mint token to self-controlled address (can be masked, one-time use)
2. Use `Token.mint()` to create proper token object
3. Save with `token.toJSON()` - standard TXF format
4. Later: Transfer from self-controlled address to recipient
5. Recipient receives properly formatted token

**Advantages:**
- ✅ Uses SDK methods throughout
- ✅ Proper TXF format maintained
- ✅ Standard, verifiable token

**Disadvantages:**
- ❌ Two transactions (mint + transfer)
- ❌ Higher gas cost
- ❌ More complex workflow

**Implementation:**
```javascript
// Mint to self-controlled masked address
const nonce = crypto.randomBytes(32);
const maskedPredicate = await MaskedPredicate.create(
  tokenId, tokenType, ourSigningService, HashAlgorithm.SHA256, nonce
);
const tempAddress = await (await maskedPredicate.getReference()).toAddress();

// Mint to this temp address using Token.mint()
const tokenState = new TokenState(maskedPredicate, data);
const token = await Token.mint(trustBase, tokenState, mintTx, []);

// Save proper TXF
fs.writeFileSync('token.txf', JSON.stringify(token.toJSON()));

// Later: transfer to final recipient
```

### Option B: Mint Receipt Format (Current Approach)

**Flow:**
1. Create MintTransactionData with recipient address
2. Submit commitment, get inclusion proof
3. Save as custom "mint receipt" format
4. Recipient imports into wallet
5. Wallet reconstructs Token using recipient's predicate

**Advantages:**
- ✅ Single transaction (mint only)
- ✅ Lower gas cost
- ✅ Direct airdrop

**Disadvantages:**
- ❌ Custom format, not standard TXF
- ❌ Recipient wallet must support this flow
- ❌ Doesn't use Token.mint() verification
- ❌ Cannot use `token.toJSON()`

**Current Format (Custom):**
```json
{
  "version": "2.0",
  "id": "...",
  "type": "nft",
  "state": {
    "data": "...",
    "unlockPredicate": null  // ← No predicate!
  },
  "genesis": { ... },
  "transactions": [
    {
      "type": "mint",
      "data": { ... },
      "inclusionProof": { ... }
    }
  ],
  ...
}
```

**Note:** This is NOT the SDK-standard format. It's a "mint receipt" that documents the mint operation occurred, but is not a full Token object.

### Option C: Masked Predicate with Shared Nonce

**Flow:**
1. Create MaskedPredicate with specific nonce
2. Mint using Token.mint() (proper format)
3. Share token.toJSON() + nonce with recipient
4. Recipient recreates same MaskedPredicate with shared nonce
5. Recipient can unlock and transfer to their permanent address

**Advantages:**
- ✅ Proper SDK usage
- ✅ Standard TXF format
- ✅ Token verification passes

**Disadvantages:**
- ❌ Must securely share nonce (secret)
- ❌ Still requires transfer step
- ❌ Nonce management complexity

## Recommendation for CLI Tool

### Default Behavior: Mint to Self (Option A - Step 1-3)

```bash
# Generate your own address first
npm run gen-address

# Mint to your own address (proper Token.mint())
npm run mint-token -- -e http://localhost:3000 \
  --token-type nft \
  --token-data '{"name":"My NFT"}' \
  --save my-token.txf

# Result: Proper TXF format with predicate
```

**Benefits:**
- User gets standard TXF format
- Can verify token structure
- Can later transfer to any recipient
- Full SDK compliance

### Alternative: Add --mint-receipt Flag

```bash
# Mint directly to external address (custom receipt format)
npm run mint-token -- -e http://localhost:3000 \
  --recipient DIRECT://0000... \
  --token-type nft \
  --token-data '{"name":"Airdrop NFT"}' \
  --mint-receipt \
  --save airdrop-receipt.json
```

**Documentation:**
- Clearly label output as "mint receipt" not "token"
- Document that recipient needs compatible wallet
- Note that this is NOT standard TXF format
- Explain limitation: cannot use Token.mint() without recipient's key

## Key Insight

**The fundamental requirement:** To use `Token.mint()` and get proper SDK-compliant TXF format, you MUST have the private key to create the predicate.

Without the recipient's private key:
- ✅ Can submit mint transaction to network
- ✅ Can get inclusion proof
- ❌ Cannot create proper Token object
- ❌ Cannot use Token.mint() verification
- ❌ Cannot get standard token.toJSON() format

This is **by design** - it's a cryptographic security feature, not a bug!

## References

### Test Scripts
- `/home/vrogojin/cli/test-address-to-predicate.js` - Demonstrates address parsing
- `/home/vrogojin/cli/test-mint-style-commitment.js` - Compares both scenarios (incomplete)

### Reference Implementation
- `/home/vrogojin/unicity-nft-mint/src/lib/nftMinter.js` - Proper self-mint pattern
- `/home/vrogojin/unicity-nft-mint/nft-test1.json` - Standard TXF format example

### SDK Source
- `UnmaskedPredicate.create()` requires `SigningService`
- `SigningService.createFromSecret()` requires private key bytes
- `Token.mint()` requires `TokenState` requires `Predicate`
- `DirectAddress` contains hash, not recoverable key material

## Conclusion

**Answer to original question:** No, we cannot mint tokens into a "public predicate" knowing only the public address. The address is a one-way hash - we cannot reverse it to get the predicate without the private key.

**Recommended approach:** Mint to self-controlled address first, then transfer. This maintains SDK compliance and produces proper TXF format.
