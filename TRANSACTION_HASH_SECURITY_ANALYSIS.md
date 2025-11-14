# CRITICAL SECURITY ANALYSIS: Genesis Data Integrity Protection

**Date**: 2025-11-12  
**Status**: VERIFIED - Genesis data IS cryptographically protected

---

## Executive Summary

**CONFIRMED**: Genesis data (including coin amounts and token data) IS cryptographically protected by the transaction hash. Any tampering with genesis data will break the inclusion proof verification.

**Security Guarantee**: The transaction hash covers ALL 8 fields of MintTransactionData, making it impossible to tamper with genesis data without detection.

---

## How Transaction Hash is Calculated

### Formula

```
transactionHash = SHA256(toCBOR(MintTransactionData))
```

### Source Code Reference

File: `/node_modules/@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionData.js:116-118`

```javascript
calculateHash() {
  return new DataHasher(HashAlgorithm.SHA256).update(this.toCBOR()).digest();
}
```

### CBOR Serialization (Line 96-98)

```javascript
toCBOR() {
  return CborSerializer.encodeArray(
    this.tokenId.toCBOR(),              // Field 1: Token ID
    this.tokenType.toCBOR(),            // Field 2: Token type
    CborSerializer.encodeOptional(      // Field 3: Token data (optional)
      this.tokenData, 
      CborSerializer.encodeByteString
    ),
    CborSerializer.encodeOptional(      // Field 4: Coin data (optional)
      this.coinData, 
      (coins) => coins.toCBOR()
    ),
    CborSerializer.encodeTextString(    // Field 5: Recipient address
      this.recipient.address
    ),
    CborSerializer.encodeByteString(    // Field 6: Salt
      this.salt
    ),
    CborSerializer.encodeOptional(      // Field 7: Recipient data hash (optional)
      this.recipientDataHash, 
      (hash) => hash.toCBOR()
    ),
    CborSerializer.encodeOptional(      // Field 8: Reason (optional)
      this.reason, 
      (reason) => reason.toCBOR()
    )
  );
}
```

---

## Fields Included in Transaction Hash

**ALL 8 fields are included in the CBOR encoding:**

1. **tokenId** - Token identifier
2. **tokenType** - Token type (e.g., 0x0001 for fungible)
3. **tokenData** - Immutable token metadata (PROTECTED)
4. **coinData** - Coin amounts and IDs (PROTECTED)
5. **recipient** - First owner's address
6. **salt** - Random salt for predicate derivation
7. **recipientDataHash** - Optional metadata hash
8. **reason** - Optional reason object (e.g., split mint)

### Critical Fields for Security

- **tokenData**: Any custom data attached to the token
- **coinData**: Contains `TokenCoinData` with coin amounts
  - `coinId`: Unique coin identifier
  - `amount`: Coin value (e.g., 1000 for 1000 units)

**If either field is modified in the TXF file, the transaction hash will change, and the inclusion proof will fail verification.**

---

## How the Commitment is Created

File: `/node_modules/@unicitylabs/state-transition-sdk/lib/transaction/MintCommitment.js:22-27`

```javascript
static async create(transactionData) {
  const signingService = await MintCommitment.createSigningService(transactionData);
  
  // 1. Calculate transaction hash from ALL transaction data
  const transactionHash = await transactionData.calculateHash();
  
  // 2. Create RequestId = Hash(publicKey || stateHash)
  const requestId = await RequestId.create(signingService.publicKey, transactionData.sourceState);
  
  // 3. Create Authenticator = Sign(transactionHash || stateHash)
  const authenticator = await Authenticator.create(signingService, transactionHash, transactionData.sourceState);
  
  return new MintCommitment(requestId, transactionData, authenticator);
}
```

### Cryptographic Chain

```
MintTransactionData
  ↓ (toCBOR)
CBOR bytes [tokenId, tokenType, tokenData, coinData, recipient, salt, ...]
  ↓ (SHA256)
transactionHash
  ↓ (included in Authenticator)
Authenticator signature = Sign(transactionHash || stateHash)
  ↓ (included in InclusionProof)
InclusionProof.transactionHash
```

---

## Security Verification Method

### Current Implementation in verify-token Command

File: `/home/vrogojin/cli/src/commands/verify-token.ts:329-346`

```typescript
// SECURITY CHECK: Verify genesis data integrity
const genesisDataHash = await token.genesis.data.calculateHash();
const genesisProofTxHash = token.genesis.inclusionProof?.transactionHash;

if (genesisProofTxHash) {
  if (HexConverter.encode(genesisDataHash.imprint) === HexConverter.encode(genesisProofTxHash.imprint)) {
    console.log('  ✓ Genesis data integrity verified (not tampered)');
  } else {
    console.log('  ❌ CRITICAL: Genesis data has been TAMPERED!');
    console.log(`    Expected hash: ${HexConverter.encode(genesisProofTxHash.imprint)}`);
    console.log(`    Actual hash:   ${HexConverter.encode(genesisDataHash.imprint)}`);
    console.log('    Token data has been modified after signing - REJECT this token!');
    correspondenceValid = false;
    exitCode = 1;
  }
}
```

### Verification Steps

1. **Recalculate transaction hash** from genesis data:
   ```typescript
   const genesisDataHash = await token.genesis.data.calculateHash();
   ```

2. **Extract stored transaction hash** from inclusion proof:
   ```typescript
   const genesisProofTxHash = token.genesis.inclusionProof?.transactionHash;
   ```

3. **Compare the hashes**:
   ```typescript
   if (HexConverter.encode(genesisDataHash.imprint) === HexConverter.encode(genesisProofTxHash.imprint)) {
     // Data is intact
   } else {
     // Data has been tampered with!
   }
   ```

---

## Attack Scenarios (ALL PREVENTED)

### Attack 1: Modify Coin Amount

**Attacker's Goal**: Change `coinData.amount` from 1000 to 9999 in TXF file

**What Happens**:
1. Attacker modifies `token.genesis.data.coinData[0].amount` in JSON
2. When verification runs:
   ```typescript
   const recalculatedHash = await token.genesis.data.calculateHash();
   // This produces a DIFFERENT hash because coinData changed
   ```
3. Comparison fails:
   ```
   recalculatedHash !== inclusionProof.transactionHash
   ```
4. **Result**: Tampering detected, token rejected

**Status**: PREVENTED ✓

---

### Attack 2: Modify Token Data

**Attacker's Goal**: Change `tokenData` metadata after minting

**What Happens**:
1. Attacker modifies `token.genesis.data.tokenData` in JSON
2. CBOR encoding changes (tokenData is field #3)
3. SHA256 hash changes
4. Verification fails: `recalculatedHash !== inclusionProof.transactionHash`

**Status**: PREVENTED ✓

---

### Attack 3: Replace Entire Genesis Data

**Attacker's Goal**: Replace genesis transaction with different data

**What Happens**:
1. Attacker replaces `token.genesis.data` with new MintTransactionData
2. The new data has a different transaction hash
3. The inclusion proof's `transactionHash` no longer matches
4. Merkle tree verification fails (leaf value mismatch)

**Status**: PREVENTED ✓

---

### Attack 4: Use Valid Proof from Different Token

**Attacker's Goal**: Copy inclusion proof from token A to token B

**What Happens**:
1. Token A has genesis data with hash `H_A`
2. Token B has genesis data with hash `H_B` (H_A ≠ H_B)
3. Attacker copies Token A's inclusion proof to Token B
4. Verification recalculates Token B's hash: `H_B`
5. Proof contains `transactionHash = H_A`
6. Comparison fails: `H_B !== H_A`

**Status**: PREVENTED ✓

---

## SDK Method Reference

### MintTransactionData Methods

```typescript
class MintTransactionData {
  // Create mint transaction data
  static async create(
    tokenId: TokenId,
    tokenType: TokenType,
    tokenData: Uint8Array | null,
    coinData: TokenCoinData | null,
    recipient: IAddress,
    salt: Uint8Array,
    recipientDataHash: DataHash | null,
    reason: R | null
  ): Promise<MintTransactionData<R>>
  
  // Calculate transaction hash (includes ALL 8 fields)
  calculateHash(): Promise<DataHash>
  
  // Serialize to CBOR (for hashing)
  toCBOR(): Uint8Array
  
  // Deserialize from JSON
  static async fromJSON(input: unknown): Promise<MintTransactionData<IMintTransactionReason>>
}
```

### TokenCoinData Methods

```typescript
class TokenCoinData {
  // Create coin data with amount
  static async create(amount: bigint): Promise<TokenCoinData>
  
  // Access coin amount
  get amount(): bigint
  
  // Access coin ID
  get coinId(): CoinId
  
  // Serialize to CBOR (included in MintTransactionData.toCBOR())
  toCBOR(): Uint8Array
}
```

### Token Methods

```typescript
class Token {
  // Access genesis transaction
  readonly genesis: MintTransaction<R>
  
  // Genesis contains:
  //   - data: MintTransactionData (all 8 fields)
  //   - inclusionProof: InclusionProof (contains transactionHash)
  
  // Verify token against trust base
  verify(trustBase: RootTrustBase): Promise<VerificationResult>
}
```

---

## Verification Code Examples

### Example 1: Verify Genesis Data Integrity

```typescript
import { Token } from '@unicitylabs/state-transition-sdk';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import fs from 'fs';

// Load token from TXF file
const txfJson = JSON.parse(fs.readFileSync('token.txf', 'utf-8'));
const token = await Token.fromJSON(txfJson);

// Recalculate transaction hash from genesis data
const recalculatedHash = await token.genesis.data.calculateHash();

// Get stored transaction hash from inclusion proof
const storedHash = token.genesis.inclusionProof?.transactionHash;

if (!storedHash) {
  console.error('ERROR: No inclusion proof found');
  process.exit(1);
}

// Compare hashes
const recalculatedHex = HexConverter.encode(recalculatedHash.imprint);
const storedHex = HexConverter.encode(storedHash.imprint);

if (recalculatedHex === storedHex) {
  console.log('✓ Genesis data is intact (not tampered)');
  console.log(`  Transaction hash: ${storedHex}`);
} else {
  console.error('❌ CRITICAL: Genesis data has been TAMPERED!');
  console.error(`  Expected: ${storedHex}`);
  console.error(`  Actual:   ${recalculatedHex}`);
  console.error('  Token is INVALID - REJECT!');
  process.exit(1);
}
```

### Example 2: Verify Coin Amount Integrity

```typescript
// Check if coin data exists and matches proof
if (token.genesis.data.coinData) {
  const coinAmount = token.genesis.data.coinData.amount;
  console.log(`Coin amount: ${coinAmount}`);
  
  // Recalculate transaction hash (includes coinData)
  const hash = await token.genesis.data.calculateHash();
  
  // Compare with proof
  if (HexConverter.encode(hash.imprint) === HexConverter.encode(token.genesis.inclusionProof.transactionHash.imprint)) {
    console.log('✓ Coin amount is authentic');
  } else {
    console.error('❌ Coin amount has been tampered with!');
  }
}
```

### Example 3: Verify Token Data Integrity

```typescript
// Check if token data exists and matches proof
if (token.genesis.data.tokenData) {
  const tokenData = new TextDecoder().decode(token.genesis.data.tokenData);
  console.log(`Token data: ${tokenData}`);
  
  // Recalculate transaction hash (includes tokenData)
  const hash = await token.genesis.data.calculateHash();
  
  // Compare with proof
  if (HexConverter.encode(hash.imprint) === HexConverter.encode(token.genesis.inclusionProof.transactionHash.imprint)) {
    console.log('✓ Token data is authentic');
  } else {
    console.error('❌ Token data has been tampered with!');
  }
}
```

---

## Comparison with Transfer Transactions

**Transfer transactions use the SAME security model:**

File: `/node_modules/@unicitylabs/state-transition-sdk/lib/transaction/TransferTransactionData.js`

```javascript
calculateHash() {
  return new DataHasher(HashAlgorithm.SHA256).update(this.toCBOR()).digest();
}
```

**TransferTransactionData includes:**
1. sourceState (TokenState)
2. targetState (TokenState)
3. predicate (unlock condition)
4. recipientDataHash (optional metadata)

**Same verification logic applies:**
```typescript
const txDataHash = await transaction.data.calculateHash();
const proofTxHash = transaction.inclusionProof?.transactionHash;

if (txDataHash.equals(proofTxHash)) {
  console.log('✓ Transfer data is intact');
} else {
  console.error('❌ Transfer data has been tampered with!');
}
```

See: `/home/vrogojin/cli/src/commands/verify-token.ts:365-376`

---

## Security Assertions

### 1. Genesis Data is Cryptographically Protected

**Assertion**: All 8 fields of MintTransactionData are included in the transaction hash.

**Evidence**:
- `MintTransactionData.calculateHash()` calls `SHA256(toCBOR())`
- `toCBOR()` serializes ALL 8 fields (see line 96-98)
- Transaction hash is stored in `InclusionProof.transactionHash`
- Verification recalculates hash and compares

**Status**: VERIFIED ✓

---

### 2. Coin Amounts Cannot Be Tampered

**Assertion**: Changing `coinData.amount` will break the inclusion proof.

**Evidence**:
- `coinData` is field #4 in CBOR array
- `coinData.toCBOR()` includes coin amount
- Any change to amount changes CBOR bytes
- Changed CBOR bytes produce different SHA256 hash
- Different hash fails verification

**Status**: VERIFIED ✓

---

### 3. Token Data Cannot Be Tampered

**Assertion**: Changing `tokenData` will break the inclusion proof.

**Evidence**:
- `tokenData` is field #3 in CBOR array
- Stored as `CborSerializer.encodeByteString(tokenData)`
- Any byte change alters CBOR encoding
- Changed CBOR produces different hash
- Different hash fails verification

**Status**: VERIFIED ✓

---

### 4. Inclusion Proof is Bound to Genesis Data

**Assertion**: The inclusion proof cannot be used with different genesis data.

**Evidence**:
- Proof contains `transactionHash = SHA256(toCBOR(genesisData))`
- Changing any genesis field changes transaction hash
- Merkle tree leaf value = `Hash(requestId || transactionHash)`
- Different transaction hash = different leaf value
- Different leaf value = Merkle path verification fails

**Status**: VERIFIED ✓

---

## Conclusion

**CONFIRMED**: Genesis data (tokenData, coinData, and all other fields) IS cryptographically protected by the transaction hash.

**Security Guarantee**:
- Transaction hash = SHA256(CBOR(ALL 8 fields))
- Inclusion proof stores transaction hash
- Any tampering changes transaction hash
- Changed hash fails verification
- Tampering is ALWAYS detected

**No SDK vulnerability exists** - the current implementation is secure.

**Verification is implemented correctly** in the CLI:
- See `/home/vrogojin/cli/src/commands/verify-token.ts:329-346` for genesis verification
- See `/home/vrogojin/cli/src/commands/verify-token.ts:365-376` for transfer verification

---

## Recommended Actions

1. **NONE** - Current implementation is correct
2. Continue using existing verification logic
3. Trust the SDK's transaction hash calculation
4. No changes needed to security model

---

## References

**SDK Source Files**:
- `/node_modules/@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionData.js:116-118`
- `/node_modules/@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionData.js:96-98`
- `/node_modules/@unicitylabs/state-transition-sdk/lib/transaction/MintCommitment.js:22-27`

**CLI Implementation**:
- `/home/vrogojin/cli/src/commands/verify-token.ts:329-346` (genesis verification)
- `/home/vrogojin/cli/src/commands/verify-token.ts:365-376` (transfer verification)

**Related Documentation**:
- `CLAUDE.md` - Project architecture
- `.dev/architecture/ownership-verification-summary.md` - Ownership verification design
- `test-scenarios/README.md` - Test scenarios including data integrity tests
