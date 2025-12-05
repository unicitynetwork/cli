# TXF Format Specification v2.0

## Overview

TXF (Token eXchange Format) is a JSON-based file format for storing and exchanging Unicity Network tokens. This specification defines the complete structure for token files, enabling interoperability between different software components.

**File Extension:** `.txf`
**MIME Type:** `application/json`
**Encoding:** UTF-8

## Multi-Token File Structure

TXF v2.0 supports multiple tokens in a single file. Each token is stored at the root level with a key prefixed by underscore followed by the token ID.

```json
{
  "_e715d5f387b569777c7d22ee38f2796a34b95f6605b77d29b8fed6c6e69c599d": { /* Token object */ },
  "_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2": { /* Token object */ },
  "_integrity": { /* Optional integrity metadata */ }
}
```

### Root-Level Keys

| Key Pattern | Type | Description |
|-------------|------|-------------|
| `_<tokenId>` | Object | Token object keyed by token ID (64-character hex string) |
| `_integrity` | Object | Optional file integrity metadata (reserved) |

### Token ID Format

Token IDs are 64-character hexadecimal strings representing 32-byte (256-bit) values:
- Pattern: `[0-9a-fA-F]{64}`
- Example: `"_e715d5f387b569777c7d22ee38f2796a34b95f6605b77d29b8fed6c6e69c599d"`
- Can be any arbitrary 256-bit value (no semantic meaning required)

## Token Object Structure

Each token object contains the complete state and history of a single token.

```json
{
  "version": "2.0",
  "genesis": { /* Genesis transaction */ },
  "state": { /* Current state */ },
  "transactions": [ /* Transaction history */ ],
  "nametags": [ /* Optional human-readable tags */ ],
  "_integrity": { /* Token-level integrity */ }
}
```

### Token Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | String | Yes | Format version (currently "2.0") |
| `genesis` | Object | Yes | Initial minting transaction |
| `state` | Object | Yes | Current token state |
| `transactions` | Array | Yes | Chronological transaction history |
| `nametags` | Array | No | Human-readable identifiers |
| `_integrity` | Object | Yes | Token integrity metadata |

## Genesis Object

The genesis object represents the initial minting transaction.

```json
{
  "data": {
    "tokenId": "hex-64-chars",
    "tokenType": "hex-64-chars",
    "coinData": [ ["coinId", "amount"], ... ],
    "tokenData": "string",
    "salt": "hex-64-chars",
    "recipient": "DIRECT://...",
    "recipientDataHash": "hex-string" | null,
    "reason": "string" | null
  },
  "inclusionProof": { /* Aggregator proof */ }
}
```

### Genesis Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | Object | Yes | Token data payload |
| `inclusionProof` | Object | Yes | Sparse Merkle Tree inclusion proof |

### Genesis Data Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tokenId` | String | Yes | 64-character hex token identifier (same as root key without underscore) |
| `tokenType` | String | Yes | 64-character hex token type identifier |
| `coinData` | Array | Yes | 2D array of coin units `[[coinId, amount], ...]` |
| `tokenData` | String | No | Optional token metadata (empty string if none) |
| `salt` | String | Yes | 64-character hex random salt for uniqueness |
| `recipient` | String | Yes | Initial recipient address in `DIRECT://` format |
| `recipientDataHash` | String/null | No | Hash of expected recipient data (for validation) |
| `reason` | String/null | No | Optional reason/memo for the mint |

### CoinData Format

CoinData is a 2D array where each element is `[coinId, amount]`:

```json
"coinData": [
  ["f7a99b4412acec3fc7a613312469b7aff04392b206395477d0dd9b392d8d3fd4", "0"],
  ["908c481ef8638aa8ec2959b4062b47a38060adff59b0e9a906df0cf3e6c84596", "100"]
]
```

| Index | Type | Description |
|-------|------|-------------|
| `[n][0]` | String | 64-character hex coin identifier |
| `[n][1]` | String | Amount as numeric string |

### Token Types

Token types are identified by their 64-character hex `tokenType` field. Common types:

| Token Type (hex) | Name | Description |
|------------------|------|-------------|
| `455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89` | NFT | Non-fungible token |
| (varies) | UCT | Unicity Coin Token |
| (varies) | Custom | Application-specific token types |

## Inclusion Proof Object

Inclusion proofs demonstrate that a state transition was recorded in the aggregator's Sparse Merkle Tree.

```json
{
  "authenticator": {
    "algorithm": "secp256k1",
    "publicKey": "hex-string",
    "signature": "hex-string",
    "stateHash": "hex-string"
  },
  "merkleTreePath": {
    "root": "hex-string",
    "steps": [
      {
        "data": "hex-string",
        "path": "numeric-string"
      }
    ]
  },
  "transactionHash": "hex-string",
  "unicityCertificate": "hex-cbor-string"
}
```

### Authenticator Fields

| Field | Type | Description |
|-------|------|-------------|
| `algorithm` | String | Signature algorithm (e.g., "secp256k1") |
| `publicKey` | String | Aggregator's public key (hex, compressed format) |
| `signature` | String | Signature over state hash (hex) |
| `stateHash` | String | Hash being authenticated (hex with "0000" prefix) |

### Merkle Tree Path Fields

| Field | Type | Description |
|-------|------|-------------|
| `root` | String | Merkle tree root hash (hex with "0000" prefix) |
| `steps` | Array | Array of path steps for proof verification |
| `steps[n].data` | String | Sibling node hash at this step (hex) |
| `steps[n].path` | String | Path direction as numeric string |

### Transaction Hash

| Field | Type | Description |
|-------|------|-------------|
| `transactionHash` | String | Hash of the transaction (hex with "0000" prefix) |

### Unicity Certificate

| Field | Type | Description |
|-------|------|-------------|
| `unicityCertificate` | String | CBOR-encoded certificate containing seal, signatures, and round info (hex) |

## Predicate Encoding

Predicates define ownership conditions using CBOR encoding.

### Predicate Structure (Decoded)

```
[engineId, predicateType, parameters]
```

| Field | Type | Values |
|-------|------|--------|
| `engineId` | Integer | 1 = Unmasked, 5 = Masked |
| `predicateType` | Integer | 5001 = Standard ownership |
| `parameters` | Array | `[signature, publicKey]` or `[signature, publicKey, mask]` |

### Unmasked Predicate (Engine ID 1)
- Reusable address
- Parameters: `[signature, publicKey]`
- Total size: ~119 bytes

### Masked Predicate (Engine ID 5)
- One-time-use address (more private)
- Parameters: `[signature, publicKey, mask]`
- Total size: ~187 bytes

### Example (Hex-encoded CBOR)
```
830105821858... (truncated)
```

Decoded:
```json
[1, 5001, ["<signature-bytes>", "<publicKey-bytes>"]]
```

## State Object

The state object represents the current token ownership state.

```json
{
  "data": "string",
  "predicate": "hex-cbor-string"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | String | Yes | State data (empty string if none) |
| `predicate` | String | Yes | Current owner's predicate (hex-encoded CBOR) |

### State Example

```json
{
  "data": "",
  "predicate": "8300410058b5865820e715d5f387b569777c7d22ee38f2796a34b95f6605b77d29b8fed6c6e69c599d5820455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d895821039e8389cb79ce98a70efd57a66df1a9a1cd3d36173c20d720e8b2a0fab85c736469736563703235366b3100584059fa5414c6ef010209f473efc13a01edd50a7aee61c0a10ca68957041fba42277e8934e334f1bdc7a8821fb2c7b35cbe81a3fae4027dac9fa59349e19721a2a0"
}
```

## Transactions Array

The transactions array contains the chronological history of all state transitions after genesis.

```json
"transactions": [
  {
    "previousStateHash": "hex-string",
    "newStateHash": "hex-string",
    "predicate": "hex-string",
    "inclusionProof": { /* Proof object */ } | null,
    "data": { /* Optional transfer data */ }
  }
]
```

### Transaction Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `previousStateHash` | String | Yes | State hash before transition |
| `newStateHash` | String | Yes | State hash after transition |
| `predicate` | String | Yes | New owner's predicate |
| `inclusionProof` | Object/null | Yes | Proof (null if uncommitted) |
| `data` | Object | No | Optional transfer metadata |

### Uncommitted Transactions

Transactions with `inclusionProof: null` represent pending transfers awaiting aggregator confirmation:

```json
{
  "previousStateHash": "abc123...",
  "newStateHash": "def456...",
  "predicate": "830105...",
  "inclusionProof": null,
  "data": {
    "transferredAt": "2025-01-15T10:30:00Z",
    "memo": "Payment for services"
  }
}
```

## Address Format

Addresses use the DIRECT protocol format:

```
DIRECT://<hex-encoded-public-key-hash>
```

Example:
```
DIRECT://0000057e2a9d980704a1593bfd9fcb4b5a77c720e0a83f4a917165ff94addaca41db0f4216dc
```

### Address Components

| Component | Description |
|-----------|-------------|
| `DIRECT://` | Protocol prefix |
| `0000` | Version/type prefix |
| `057e2a9d...` | SHA-256 hash of public key (varies by mask status) |

## Token Integrity

The `_integrity` field provides integrity verification for each token:

```json
"_integrity": {
  "genesisDataJSONHash": "hex-string"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `genesisDataJSONHash` | String | SHA-256 hash of the genesis data JSON (hex with "0000" prefix) |

### Example

```json
"_integrity": {
  "genesisDataJSONHash": "00005e79a133e2d23f52af53b16da3a80eac6017652493d75241d6ea77acaa4e6d1b"
}
```

## Complete Example

### Single Token (Condensed)

```json
{
  "_e715d5f387b569777c7d22ee38f2796a34b95f6605b77d29b8fed6c6e69c599d": {
    "version": "2.0",
    "genesis": {
      "data": {
        "coinData": [["f7a99b4412acec3fc7a613312469b7aff04392b206395477d0dd9b392d8d3fd4", "0"]],
        "reason": null,
        "recipient": "DIRECT://0000fb3e7f62a7cd1b156d6747abeaa8b217e483257dd604697c1f63123cd39940b8cc708a66",
        "recipientDataHash": null,
        "salt": "6f26890c6ff60a0d5b800f412ca7cac6efa79a6dadf7b4c8fc2e3aaa70ec9ba4",
        "tokenData": "",
        "tokenId": "e715d5f387b569777c7d22ee38f2796a34b95f6605b77d29b8fed6c6e69c599d",
        "tokenType": "455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89"
      },
      "inclusionProof": {
        "authenticator": {
          "algorithm": "secp256k1",
          "publicKey": "03151cd1cb02631450629f570927afe0b11feaa345e9f1502b2dc7c5d046794a6a",
          "signature": "0f6f4dc06294f8ba0d1351b83f253041196be42fd15cb2e68558cbba7217aaae...",
          "stateHash": "00001244854d15b79bf988deb14dd5332319e08382867376d8f9ad4487117210e0d6"
        },
        "merkleTreePath": {
          "root": "000061727041a7b270c1244e6f1946de38dbe5c58aaf21f1b0d8adf76e82a557bb0c",
          "steps": [
            {"data": "0000547e5e980d3103a916f749c22aa543bf91fcf03530147bd92ef4c8680b77ec01", "path": "1852698951604417562300299341881438666959094069169867131693583787142653922346379"},
            {"data": "b2c8c28158399755efb6d112db4cb063590aa531e383dc9f7beb7b5e10cd30b5", "path": "8"}
          ]
        },
        "transactionHash": "0000578a283444690a28bcc8035e605f25ac12adaabe2cb8a15ea8589b6d5c2d4ce1",
        "unicityCertificate": "d903ef8701d903f08a0119264d..."
      }
    },
    "state": {
      "data": "",
      "predicate": "8300410058b5865820e715d5f387b569777c7d22ee38f2796a34b95f6605b77d29b8fed6c6e69c599d..."
    },
    "transactions": [],
    "nametags": [],
    "_integrity": {
      "genesisDataJSONHash": "00005e79a133e2d23f52af53b16da3a80eac6017652493d75241d6ea77acaa4e6d1b"
    }
  }
}
```

### Multi-Token File

```json
{
  "_e715d5f387b569777c7d22ee38f2796a34b95f6605b77d29b8fed6c6e69c599d": {
    "version": "2.0",
    "genesis": { /* ... */ },
    "state": { /* ... */ },
    "transactions": [],
    "nametags": [],
    "_integrity": { "genesisDataJSONHash": "00005e79a133e2d23f52af53b16da3a80eac6017652493d75241d6ea77acaa4e6d1b" }
  },
  "_3d7b18031760fafd66939d4b1c422a3c4fa811a2dbd18c5f7d018dad6fc9daca": {
    "version": "2.0",
    "genesis": { /* ... */ },
    "state": { /* ... */ },
    "transactions": [],
    "nametags": [],
    "_integrity": { "genesisDataJSONHash": "0000897c68a787e854adfce50957056e997b0eaa34e0a74ff810c2799bc79d8d40f9" }
  },
  "_cf89cf34306a60492224b78c721e71b4813af917f422be1a048d9cba7fdaad6c": {
    "version": "2.0",
    "genesis": { /* ... */ },
    "state": { /* ... */ },
    "transactions": [],
    "nametags": [],
    "_integrity": { "genesisDataJSONHash": "00005a8195b9b4d1c105b6efb0bf3a714f6a57642e6a79826f4bb69002fe51485406" }
  }
}
```

## Validation Rules

### Required Validations

1. **File Structure**
   - Must be valid JSON
   - Root must be an object
   - At least one `_<tokenId>` key must exist

2. **Token ID**
   - Must match pattern `_[0-9a-fA-F]{64}`
   - Must be unique within file
   - Must match `genesis.data.tokenId` (without underscore prefix)

3. **Version**
   - Must be present in each token
   - Current valid version: "2.0"

4. **Genesis**
   - Must be present with `data` and `inclusionProof` objects
   - `data.tokenId` must be 64-character hex string
   - `data.tokenType` must be 64-character hex string
   - `data.coinData` must be array of `[coinId, amount]` pairs
   - `data.salt` must be 64-character hex string
   - `data.recipient` must be valid `DIRECT://` address
   - `inclusionProof` must contain `authenticator`, `merkleTreePath`, `transactionHash`, `unicityCertificate`

5. **State**
   - `data` must be a string (can be empty)
   - `predicate` must be valid hex-encoded CBOR

6. **Transactions**
   - Must be an array (can be empty)

7. **Integrity**
   - `_integrity.genesisDataJSONHash` must be present
   - Hash must be valid hex string with "0000" prefix

### Cryptographic Validations

1. **Predicate Verification**
   - CBOR must decode to valid predicate structure
   - Signature must verify against public key
   - Public key hash must match address

2. **Inclusion Proof Verification**
   - Merkle path must verify from leaf to root
   - Authenticator signature must verify
   - Unicity seal signatures must verify against TrustBase

3. **State Hash Verification**
   - State hash must match hash of serialized state data

## Implementation Notes

### Parsing Multi-Token Files

```javascript
// JavaScript example
function parseTokenFile(json) {
  const tokens = {};
  for (const [key, value] of Object.entries(json)) {
    if (key.startsWith('_') && key !== '_integrity') {
      const tokenId = key.substring(1);
      tokens[tokenId] = value;
    }
  }
  return tokens;
}

// Get first token
function getFirstToken(json) {
  const key = Object.keys(json).find(k =>
    k.startsWith('_') && k !== '_integrity'
  );
  return key ? json[key] : null;
}
```

### Writing Multi-Token Files

```javascript
// JavaScript example
function addTokenToFile(existingJson, tokenId, tokenObject) {
  return {
    ...existingJson,
    [`_${tokenId}`]: tokenObject
  };
}
```

### CoinData Processing

```javascript
// Calculate total amount from coinData
function getTotalAmount(coinData) {
  if (!coinData) return 0n;
  return coinData.reduce((sum, [coinId, amount]) => {
    return sum + BigInt(amount);
  }, 0n);
}
```

### Token ID Validation

```javascript
// Validate 64-character hex token ID
function isValidTokenId(tokenId) {
  return /^[0-9a-fA-F]{64}$/.test(tokenId);
}

// Validate token key matches genesis tokenId
function validateTokenKey(key, token) {
  if (!key.startsWith('_')) return false;
  const keyTokenId = key.substring(1);
  return keyTokenId === token.genesis.data.tokenId;
}
```

### Detecting Uncommitted Transfers

```javascript
function hasUncommittedTransfer(token) {
  // Check transactions array for any with null inclusionProof
  return token.transactions.some(tx => tx.inclusionProof === null);
}
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2025-01 | Multi-token support, transactions array, 64-char hex token IDs |
| 1.0 | 2024-11 | Initial single-token format |

## References

- [Unicity Network Documentation](https://docs.unicity.network)
- [State Transition SDK](https://github.com/unicitylabs/state-transition-sdk)
- [CBOR Specification (RFC 8949)](https://www.rfc-editor.org/rfc/rfc8949.html)
- [Sparse Merkle Trees](https://eprint.iacr.org/2016/683.pdf)
