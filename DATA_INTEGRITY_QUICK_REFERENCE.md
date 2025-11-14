# Data Integrity Quick Reference

**TL;DR**: Genesis data (tokenData, coinData) IS cryptographically protected. Any tampering will break verification.

---

## The Security Formula

```
transactionHash = SHA256(CBOR([
  tokenId,           // Field 1
  tokenType,         // Field 2
  tokenData,         // Field 3 ← PROTECTED
  coinData,          // Field 4 ← PROTECTED (includes amounts)
  recipient,         // Field 5
  salt,              // Field 6
  recipientDataHash, // Field 7
  reason             // Field 8
]))
```

**Result**: All 8 fields are included in the hash. Changing any field breaks the proof.

---

## Quick Verification

### Check Genesis Data Integrity

```typescript
const token = await Token.fromJSON(txfJson);

// Recalculate hash from data
const calculatedHash = await token.genesis.data.calculateHash();

// Get stored hash from proof
const storedHash = token.genesis.inclusionProof?.transactionHash;

// Compare
if (calculatedHash.equals(storedHash)) {
  console.log('✓ Data is intact');
} else {
  console.error('❌ Data has been TAMPERED!');
}
```

### Check Transfer Data Integrity

```typescript
const tx = token.transactions[0];

// Recalculate hash from transfer data
const calculatedHash = await tx.data.calculateHash();

// Get stored hash from proof
const storedHash = tx.inclusionProof?.transactionHash;

// Compare
if (calculatedHash.equals(storedHash)) {
  console.log('✓ Transfer data is intact');
} else {
  console.error('❌ Transfer data has been TAMPERED!');
}
```

---

## What's Protected?

### Genesis Transaction

1. **Token ID** - Unique identifier
2. **Token Type** - Type code (0x0001 = fungible)
3. **Token Data** - Custom metadata (FULLY PROTECTED)
4. **Coin Data** - Amount and coin ID (FULLY PROTECTED)
5. **Recipient** - First owner's address
6. **Salt** - Predicate derivation salt
7. **Recipient Data Hash** - Optional metadata hash
8. **Reason** - Optional reason object

### Transfer Transaction

1. **Source State** - Previous token state
2. **Target State** - New token state
3. **Predicate** - Unlock condition
4. **Recipient Data Hash** - Optional metadata

---

## Attack Prevention

| Attack | Protected By | Detection Method |
|--------|-------------|------------------|
| Modify coin amount | Field #4 in CBOR | Hash mismatch |
| Modify token data | Field #3 in CBOR | Hash mismatch |
| Replace genesis data | Transaction hash | Hash mismatch |
| Replay different proof | Leaf value binding | Merkle verification fails |
| Tamper with transfer | Transaction hash | Hash mismatch |

**All attacks are automatically detected during verification.**

---

## SDK Methods

### Calculate Hash

```typescript
// Genesis transaction
const hash = await token.genesis.data.calculateHash();

// Transfer transaction
const hash = await token.transactions[0].data.calculateHash();

// Token state
const hash = await token.state.calculateHash();
```

### Compare Hashes

```typescript
// Using DataHash.equals()
if (hash1.equals(hash2)) { /* match */ }

// Using HexConverter
const hex1 = HexConverter.encode(hash1.imprint);
const hex2 = HexConverter.encode(hash2.imprint);
if (hex1 === hex2) { /* match */ }
```

### Access Fields

```typescript
// Genesis data
const tokenData = token.genesis.data.tokenData;      // Uint8Array | null
const coinData = token.genesis.data.coinData;        // TokenCoinData | null
const amount = coinData?.amount;                      // bigint
const recipient = token.genesis.data.recipient;       // IAddress

// Transfer data
const sourceState = tx.data.sourceState;              // TokenState
const targetState = tx.data.targetState;              // TokenState
```

---

## CLI Commands

### Verify Token

```bash
# Full verification (includes data integrity)
npm run verify-token -- -f token.txf

# Look for these lines in output:
# ✓ Genesis data integrity verified (not tampered)
# ✓ Last transaction data integrity verified
```

### Debug Verification

```bash
# Enable verbose mode
npm run verify-token -- -f token.txf -v

# Shows:
# - Transaction hash calculation
# - CBOR field serialization
# - Hash comparison results
```

---

## Common Patterns

### Pattern 1: Verify Before Accepting Token

```typescript
const token = await Token.fromJSON(txfJson);

// Check genesis data integrity
const genesisHash = await token.genesis.data.calculateHash();
const genesisProofHash = token.genesis.inclusionProof?.transactionHash;

if (!genesisHash.equals(genesisProofHash)) {
  throw new Error('Genesis data has been tampered with!');
}

// Check all transaction data integrity
for (const tx of token.transactions) {
  const txHash = await tx.data.calculateHash();
  const proofHash = tx.inclusionProof?.transactionHash;
  
  if (!txHash.equals(proofHash)) {
    throw new Error('Transaction data has been tampered with!');
  }
}

// Safe to accept token
console.log('✓ Token data integrity verified');
```

### Pattern 2: Verify Coin Amount

```typescript
if (token.genesis.data.coinData) {
  const amount = token.genesis.data.coinData.amount;
  console.log(`Token has ${amount} units`);
  
  // Verify amount hasn't been tampered with
  const hash = await token.genesis.data.calculateHash();
  const proofHash = token.genesis.inclusionProof?.transactionHash;
  
  if (!hash.equals(proofHash)) {
    throw new Error('Coin amount has been tampered with!');
  }
  
  console.log('✓ Coin amount is authentic');
}
```

### Pattern 3: Verify Token Data

```typescript
if (token.genesis.data.tokenData) {
  const data = new TextDecoder().decode(token.genesis.data.tokenData);
  console.log(`Token data: ${data}`);
  
  // Verify data hasn't been tampered with
  const hash = await token.genesis.data.calculateHash();
  const proofHash = token.genesis.inclusionProof?.transactionHash;
  
  if (!hash.equals(proofHash)) {
    throw new Error('Token data has been tampered with!');
  }
  
  console.log('✓ Token data is authentic');
}
```

---

## When to Verify

| Scenario | Verification Required | Why |
|----------|----------------------|-----|
| Receiving token | YES | Ensure data hasn't been tampered |
| Before transfer | YES | Verify current state is valid |
| Displaying amount | YES | Ensure amount is authentic |
| Reading metadata | YES | Ensure data hasn't been modified |
| After network sync | YES | Verify local data matches chain |

**Rule**: Always verify data integrity before trusting token data.

---

## Error Messages

```typescript
// Data tampering detected
❌ CRITICAL: Genesis data has been TAMPERED!
  Expected hash: 0xabc123...
  Actual hash:   0xdef456...
  Token data has been modified after signing - REJECT this token!

// Transfer tampering detected
❌ CRITICAL: Last transaction data has been TAMPERED!
  Expected hash: 0x123abc...
  Actual hash:   0x456def...

// Successful verification
✓ Genesis data integrity verified (not tampered)
✓ Last transaction data integrity verified
✓ Current state structure is consistent
```

---

## Files

**Implementation**:
- `/home/vrogojin/cli/src/commands/verify-token.ts` - Lines 329-346 (genesis), 365-376 (transfers)

**SDK Source**:
- `@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionData.js:116-118` - Hash calculation
- `@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionData.js:96-98` - CBOR serialization

**Documentation**:
- `/home/vrogojin/cli/TRANSACTION_HASH_SECURITY_ANALYSIS.md` - Full security analysis

---

## Summary

1. Transaction hash = SHA256(CBOR(ALL fields))
2. All genesis data (tokenData, coinData, etc.) is in CBOR
3. Changing any field changes the hash
4. Changed hash breaks verification
5. Tampering is ALWAYS detected

**Conclusion**: Genesis data is cryptographically protected. Current implementation is secure.
