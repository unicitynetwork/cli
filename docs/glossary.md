# Unicity CLI Glossary

Complete terminology reference for the Unicity CLI and offchain token system.

---

## A

### Address
A unique identifier for receiving tokens, derived from your secret (private key). Addresses are cryptographic representations of ownership predicates.

**Formats**:
- `DIRECT://0000...` - Standard direct address format (primary format used by CLI)
- `UNICITY://...` - Alternative notation (equivalent to DIRECT)
- `PK://03...` - Public key address (unmasked predicate, compressed secp256k1 key)
- `PKH://...` - Public key hash address

**Example**: `DIRECT://00004059268bb18c04e6544493195cee9a2e7043f73cf542d15ecbef31647e65c6e98acebf8f`

**Safety**: Addresses are safe to share publicly. They do NOT reveal your secret/private key.

**See**: [GEN_ADDRESS_GUIDE.md](guides/commands/gen-address.md)

---

### Aggregator
Network component that collects state transition requests and aggregates them into Merkle trees for blockchain commitment. The aggregator provides the gateway API for submitting transactions and retrieving inclusion proofs.

**Default Endpoint**: `https://gateway.unicity.network`

**See**: [CLAUDE.md](../.dev/README.md#architecture-overview)

---

## C

### CBOR (Concise Binary Object Representation)
Binary data serialization format used for predicates in Unicity tokens. More compact than JSON while preserving structure.

**Predicate Structure**: `[engine_id, template, parameters]` encoded as CBOR array

**Size**: Unicity predicates are exactly 187 bytes when CBOR-encoded

**See**: [VERIFY_TOKEN_GUIDE.md#predicate-structure-deep-dive](guides/commands/verify-token.md#predicate-structure-deep-dive)

---

### Coin Data
For fungible tokens, represents individual coin amounts that can be split or merged. Non-fungible tokens (NFTs) have empty coin data.

**Example**: `--coins "100,200,300"` creates 3 coins with those amounts

---

### Commitment
Cryptographic structure containing transaction data and authenticator (signature). Commitments are submitted to the aggregator for inclusion in the blockchain.

**Types**:
- **MintCommitment**: For creating new tokens
- **TransferCommitment**: For transferring token ownership

**See**: [OFFLINE_TRANSFER_WORKFLOW.md](guides/workflows/offline-transfer.md)

---

## D

### DIRECT Address
See [Address](#address). The standard address format for Unicity CLI.

---

## E

### Extended TXF
Enhanced Token eXchange Format (v2.0) that includes additional fields for offline transfers and status tracking.

**Additional Fields**:
- `offlineTransfer` - Package for recipient to complete transfer
- `status` - Token lifecycle status (PENDING, CONFIRMED, TRANSFERRED, etc.)
- `nametags` - Associated nametag tokens

**See**: [Extended TXF Format](#extended-txf), [SEND_TOKEN_GUIDE.md](SEND_TOKEN_GUIDE.md#extended-txf-format)

---

## F

### Fungible Token
Token that can be split into smaller units (coins) or merged. Examples: UCT, USDU, EURU.

**Opposite**: Non-Fungible Token (NFT)

**See**: [Mint Token Guide - Fungible Tokens](#)

---

## G

### Genesis Transaction
The original mint transaction that created a token. Contains initial token data, recipient, and inclusion proof.

**Always preserved**: Every token retains its genesis transaction in the transaction history.

**See**: [VERIFY_TOKEN_GUIDE.md#genesis-transaction](guides/commands/verify-token.md#genesis-transaction)

---

## H

### Hash
Cryptographic one-way function output (256-bit for SHA256). Used extensively in Unicity for:
- Token IDs
- Token Types
- Nonces (when not provided as exact hex)
- Data hashing

**Algorithm**: SHA256 (default)

---

### Hex (Hexadecimal)
Base-16 number system (0-9, a-f). Used to represent binary data as text.

**Example**: `0xdeadbeef` or `deadbeef`

**256-bit hex**: Exactly 64 hexadecimal characters

---

## I

### Inclusion Proof
Cryptographic proof that a transaction was included in the blockchain. Contains:
- Merkle tree path
- Root hash
- Unicity certificate (validator signature)

**Purpose**: Proves transaction finality without needing full blockchain

**See**: [VERIFY_TOKEN_GUIDE.md#inclusion-proof](guides/commands/verify-token.md#inclusion-proof)

---

## M

### Masked Predicate
Single-use ownership predicate that includes a nonce. Creates unique addresses for enhanced privacy.

**Characteristics**:
- One-time use per token type
- Requires both secret AND nonce to spend
- More private (addresses not linkable)
- Nonce must be unique

**Created with**: `-n, --nonce` option

**Opposite**: Unmasked Predicate

**See**: [GEN_ADDRESS_GUIDE.md#masked-addresses](guides/commands/gen-address.md#masked-addresses), [MINT_TOKEN_GUIDE.md#masked-predicate](guides/commands/mint-token.md#masked-predicate)

---

### Merkle Tree
Tree data structure where each non-leaf node is the hash of its children. Used to efficiently prove inclusion of transactions.

**Merkle Root**: Top hash of the tree, committed to blockchain

**Merkle Path**: Series of hashes proving a specific transaction is in the tree

---

### Mint
Create a new token. The CLI uses a **self-mint pattern** where tokens are minted directly to your own address.

**Command**: `npm run mint-token`

**See**: [MINT_TOKEN_GUIDE.md](guides/commands/mint-token.md)

---

## N

### NFT (Non-Fungible Token)
Token that represents a unique item and cannot be split or merged. Each NFT is distinct.

**Token Type (Unicity)**: `f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509`

**Preset**: `--preset nft`

**Examples**: Artwork, collectibles, certificates, receipts

**See**: [MINT_TOKEN_GUIDE.md#token-types](guides/commands/mint-token.md#token-types)

---

### Nonce
Random or unique value used in masked predicates to create distinct addresses. Must be unique per token type for the same secret.

**Input Formats**:
- Text string: `"my-nonce-1"` (will be hashed to 256-bit)
- 256-bit hex: `a1b2c3d4e5f6...` (64 chars, used directly)
- Not provided: Random 256-bit value generated

**Storage**: For masked addresses, you must save the nonce to spend the token later

**See**: [GEN_ADDRESS_GUIDE.md#nonce-management](guides/commands/gen-address.md#nonce-management)

---

## O

### Offchain Token
Token that exists outside the blockchain but is secured by blockchain-based proofs. Benefits:
- No gas fees for creation
- Fast transfers
- Privacy options
- Mobile-friendly

**Security**: Inclusion proofs ensure tokens can't be double-spent

**See**: [GETTING_STARTED.md](getting-started.md)

---

### Offline Transfer
Transfer pattern where sender creates a transfer package offline, and recipient submits it to the network later. Enables asynchronous transfers.

**Pattern A** (default): Offline transfer package
**Pattern B** (`--submit-now`): Immediate network submission

**See**: [OFFLINE_TRANSFER_WORKFLOW.md](guides/workflows/offline-transfer.md), [TRANSFER_GUIDE.md](guides/workflows/transfer-guide.md)

---

## P

### Predicate
Cryptographic ownership proof that determines who can spend a token. Contains:
- Engine ID (masked or unmasked)
- Template (usually 0x00)
- Parameters: token ID, token type, public key, algorithm, signature scheme, signature

**Structure**: CBOR-encoded array of 187 bytes

**Types**:
- **Masked Predicate**: Single-use with nonce
- **Unmasked Predicate**: Reusable without nonce

**See**: [VERIFY_TOKEN_GUIDE.md#predicate-details](guides/commands/verify-token.md#predicate-details)

---

### Preset Token Type
Official Unicity token type with predefined token type ID.

**Available Presets**:
| Preset | Name | Token Type ID |
|--------|------|---------------|
| `uct` | Unicity Coin | `455ad872...` |
| `alpha` | Unicity Coin (alias) | `455ad872...` |
| `nft` | Unicity NFT | `f8aa1383...` |
| `usdu` | Unicity USD | `8f0f3d7a...` |
| `euru` | Unicity EUR | `5e160d5e...` |

**Usage**: `--preset nft` or `--preset usdu`

**See**: [GEN_ADDRESS_GUIDE.md#preset-token-types](guides/commands/gen-address.md#preset-token-types)

---

### Public Key
Cryptographic key derived from your secret (private key) that can be safely shared. Used in predicates to prove ownership.

**Format**: 33 bytes (compressed secp256k1 key)
**Example**: `0364d7f0d4c1c7a3ac3aaca74a860c7e9fd421b244016de642caf57d638fdd8fc6`

**Safety**: Public keys are safe to share. They do NOT reveal your secret.

---

## R

### Recipient
The address that will receive a token in a transfer or mint operation.

**In mint-token**: Automatically your address (self-mint pattern)
**In send-token**: Address you specify with `-r, --recipient`

---

## S

### Salt
Random value used in token creation to ensure uniqueness. Automatically generated if not specified.

**Size**: 256-bit (32 bytes)

**See**: `--salt` option in [MINT_TOKEN_GUIDE.md](guides/commands/mint-token.md)

---

### SDK (Software Development Kit)
The Unicity TypeScript SDK (`@unicitylabs/state-transition-sdk`) used by the CLI for token operations.

**Version**: 1.6.0-rc.fd1f327
**Compatibility**: CLI generates SDK-compliant tokens that can be loaded with `Token.fromJSON()`

---

### Secret
Your private key or password that controls your tokens. Used to:
- Generate addresses
- Sign transactions
- Prove ownership

**CRITICAL SECURITY**:
- **NEVER share your secret**
- **NEVER commit to version control**
- **NEVER store unencrypted**
- **NEVER reuse across systems**

**Input Methods**:
- Environment variable: `SECRET="my-secret" npm run ...`
- Interactive prompt: CLI will ask if not provided

**See**: [Getting Started - Security](getting-started.md)

---

### Self-Mint Pattern
Default minting approach where tokens are created directly to your own address. No need to specify recipient - it's derived from your secret.

**Benefits**:
- Simpler workflow
- Immediate ownership
- No address mismatch errors

**See**: [MINT_TOKEN_GUIDE.md#self-mint-pattern](guides/commands/mint-token.md#self-mint-pattern)

---

### Signature
Cryptographic proof created with your private key (secret). Proves you authorized a transaction without revealing the secret.

**Algorithm**: secp256k1 (same as Bitcoin/Ethereum)
**Size**: 64 bytes

**Location**: Embedded in token predicate

---

### State
Current data and ownership information for a token. Contains:
- Token data (metadata)
- Predicate (ownership proof)

**Evolution**: State changes with each transaction (transfers, updates)

---

### State Transition
Change in token state, such as:
- Mint: Create new token
- Transfer: Change ownership
- Split: Divide fungible token
- Merge: Combine fungible tokens

---

### Status
Lifecycle state of a token in Extended TXF format.

**Values**:
- `PENDING` - Offline transfer created, not yet submitted
- `SUBMITTED` - Sent to network, awaiting confirmation
- `CONFIRMED` - Confirmed on network, ready to use
- `TRANSFERRED` - Token sent away (archived state)
- `BURNED` - Token destroyed (split/swap operation)
- `FAILED` - Network submission failed

**See**: [Extended TXF](#extended-txf), [TRANSFER_GUIDE.md#status-lifecycle](guides/workflows/transfer-guide.md#status-lifecycle)

---

## T

### Token
Digital asset with cryptographic ownership proof. In Unicity, tokens exist offchain with blockchain-secured inclusion proofs.

**Components**:
- Token ID (unique identifier)
- Token Type (category/collection)
- Token Data (metadata/state)
- Predicate (ownership proof)
- Transaction History (genesis + transfers)

---

### Token Data
Metadata or state information stored in a token. Can be any format:
- JSON: `'{"name":"My NFT","edition":1}'`
- Text: `"Description text"`
- Binary: `0xdeadbeef` (hex-encoded)

**Storage**: Hex-encoded in TXF file, decoded for display

**See**: [MINT_TOKEN_GUIDE.md#smart-serialization](guides/commands/mint-token.md#smart-serialization)

---

### Token ID
Unique 256-bit identifier for a specific token instance.

**Format**: 64 hexadecimal characters
**Example**: `eaf0f2acbc090fcfef0d08ad1ddbd0016d2777a1b68e2d101824cdcf3738ff86`

**Generation**:
- Auto-generated if not specified
- Can be specified with `-i, --token-id`
- Hashed from text or used directly if 64 hex chars

---

### Token Type
256-bit identifier for a category or collection of tokens (e.g., all USDU tokens have the same token type).

**Format**: 64 hexadecimal characters

**Official Types**: See [Preset Token Type](#preset-token-type)

**Custom Types**: Use `-y, --token-type` with any string (will be hashed) or exact 64-char hex

**See**: [GEN_ADDRESS_GUIDE.md#preset-token-types](guides/commands/gen-address.md#preset-token-types)

---

### Transaction
Record of a state transition (mint, transfer, etc.) with inclusion proof.

**Contains**:
- Transaction data (source state, recipient, etc.)
- Inclusion proof (Merkle path, certificate)

**History**: All transactions preserved in TXF file

---

### Transfer
Changing ownership of a token from one address to another.

**Patterns**:
- **Pattern A (Offline)**: Create package → send file → recipient submits
- **Pattern B (Immediate)**: Submit to network immediately

**See**: [TRANSFER_GUIDE.md](guides/workflows/transfer-guide.md), [SEND_TOKEN_GUIDE.md](guides/commands/send-token.md)

---

### Trust Base
Set of trusted validators for verifying blockchain certificates. Used by SDK for proof validation.

**Default**: Root trust base with Network ID
- Production: Network ID 1
- Test: Network ID 3

---

### TXF (Token eXchange Format)
JSON file format (`.txf` extension) for storing and exchanging tokens. Portable across wallets and systems.

**Version**: 2.0
**Structure**: Genesis, State, Transactions, Nametags
**Extended**: v2.0 adds offlineTransfer and status fields

**See**: [TXF_IMPLEMENTATION_GUIDE.md](reference/txf-format.md)

---

## U

### UCT (Unicity Coin)
Native coin of the Unicity testnet. Default token type for gen-address and mint-token.

**Token Type ID**: `455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89`

**Preset**: `--preset uct` or `--preset alpha`

---

### Unicity Network
Distributed blockchain network providing single-spend proofs for offchain tokens.

**Gateway**: `https://gateway.unicity.network`

**See**: [Official Website](https://unicity.network)

---

### Unmasked Predicate
Reusable ownership predicate without nonce. Same address for all tokens of a given type from the same secret.

**Characteristics**:
- Reusable (can receive multiple tokens)
- Simpler (only need secret to spend)
- Less private (all tokens linkable)
- No nonce required

**Created with**: Omit `-n, --nonce` option

**Opposite**: Masked Predicate

**See**: [GEN_ADDRESS_GUIDE.md#unmasked-addresses](guides/commands/gen-address.md#unmasked-addresses), [MINT_TOKEN_GUIDE.md#unmasked-predicate](guides/commands/mint-token.md#unmasked-predicate)

---

### USDU (Unicity USD)
USD-pegged stablecoin on Unicity testnet.

**Token Type ID**: `8f0f3d7a5e7297be0ee98c63b81bcebb2740f43f616566fc290f9823a54f52d7`

**Preset**: `--preset usdu`

---

### EURU (Unicity EUR)
EUR-pegged stablecoin on Unicity testnet.

**Token Type ID**: `5e160d5e9fdbb03b553fb9c3f6e6c30efa41fa807be39fb4f18e43776e492925`

**Preset**: `--preset euru`

---

## V

### Verify
Check token validity and structure using `verify-token` command. Shows:
- SDK compatibility
- Token data (decoded)
- Predicate structure
- Inclusion proof
- Transaction history

**Always verify** tokens after minting or receiving.

**See**: [VERIFY_TOKEN_GUIDE.md](guides/commands/verify-token.md)

---

## W

### Wallet
Collection of tokens controlled by a secret. In CLI context, a directory of `.txf` files.

**Management**:
- Generate addresses: `gen-address`
- Mint tokens: `mint-token`
- Send tokens: `send-token`
- Receive tokens: `receive-token`
- Verify tokens: `verify-token`

**See**: [WORKFLOWS.md](guides/workflows/transfer-guide.md)

---

## Quick Reference

### Common Abbreviations
- **CLI** - Command Line Interface
- **NFT** - Non-Fungible Token
- **TXF** - Token eXchange Format
- **SDK** - Software Development Kit
- **CBOR** - Concise Binary Object Representation
- **UCT** - Unicity Coin (testnet)
- **USDU** - Unicity USD (stablecoin)
- **EURU** - Unicity EUR (stablecoin)

### Address Formats Summary
- `DIRECT://` - Standard CLI format
- `UNICITY://` - Alternative notation (same as DIRECT)
- `PK://` - Public key address
- `PKH://` - Public key hash address

### Predicate Types Summary
| Type | Nonce Required | Reusable | Privacy |
|------|---------------|----------|---------|
| Unmasked | No | Yes | Lower |
| Masked | Yes | No | Higher |

### Token Type IDs
| Preset | Token Type ID |
|--------|---------------|
| uct/alpha | `455ad872...` |
| nft | `f8aa1383...` |
| usdu | `8f0f3d7a...` |
| euru | `5e160d5e...` |

---

## See Also

- [GETTING_STARTED.md](getting-started.md) - Beginner's guide
- [README.md](README.md) - All commands
- [WORKFLOWS.md](guides/workflows/transfer-guide.md) - Common workflows
- [FAQ.md](faq.md) - Frequently asked questions
- [TROUBLESHOOTING.md](troubleshooting.md) - Common issues
