# Tutorial 4: Understanding Token Internals (Technical Deep-Dive - 30 minutes)

## Welcome to the Technical Depths!

You can use Unicity CLI without understanding internals. But to become a true expert - debugging issues, building wallets, or contributing - you need to understand what happens under the hood.

## Learning Objectives

By the end of this tutorial, you'll understand:
- TXF (Token eXchange Format) file structure
- How tokens are created and stored
- Predicates and ownership encoding
- How transfers work at the protocol level
- Inclusion proofs and network commitment
- Status lifecycle and state transitions
- CBOR encoding in predicates

## Prerequisites

- Completed Tutorials 1-3
- Comfortable with JSON
- Basic understanding of cryptography (hashing, signatures)
- A text editor to view token files
- A token file to examine

---

## Part 1: The TXF File Format (8 minutes)

The Token eXchange Format (TXF) is a JSON specification designed for token portability.

### Opening Your First Token File

Let's examine a real token:

```bash
# Create a token to examine
SECRET="examine-secret" npm run mint-token -- \
  -d '{"examine":"this token"}' \
  -s
```

Find the created file and open it in a text editor:

```bash
# Show the most recent token file
cat $(ls -t *.txf | head -1) | head -100
```

You'll see JSON like:

```json
{
  "version": "2.0",
  "state": {
    "predicate": [...],
    "data": "7b226578616d696e65223a227468697320746f6b656e227d"
  },
  "genesis": {
    "data": {
      "tokenId": "abc123def456...",
      "tokenType": "455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89",
      "tokenData": "7b226578616d696e65223a227468697320746f6b656e227d"
    }
  },
  "transactions": [],
  "nametags": [],
  "status": "CONFIRMED"
}
```

### Version Field

```json
"version": "2.0"
```

- **Meaning**: TXF format version
- **Current**: Always 2.0 for production tokens
- **Purpose**: Allows future format upgrades while maintaining compatibility

### State Section

```json
"state": {
  "predicate": [1, "UNMASKED", {...}],
  "data": "7b226578616d696e65223a227468697320746f6b656e227d"
}
```

**Predicate**: Ownership proof (see Part 3)
**Data**: Your metadata (hex-encoded)

#### Decoding Hex Data

The `data` field is hex-encoded JSON. To decode:

```bash
# Get the hex string from token file
echo "7b226578616d696e65223a227468697320746f6b656e227d" | xxd -r -p

# Output: {"examine":"this token"}
```

Or use an online converter: https://www.rapidtables.com/convert/number/hex-to-ascii.html

### Genesis Section

```json
"genesis": {
  "data": {
    "tokenId": "eaf0f2acbc090fcfef0d08ad1ddbd0016d2777a1b68e2d101824cdcf3738ff86",
    "tokenType": "455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89",
    "tokenData": "7b226578616d696e65223a227468697320746f6b656e227d"
  }
}
```

Genesis = The token's origin story:
- **tokenId**: Unique ID assigned at creation (never changes)
- **tokenType**: Category/type of token (never changes)
- **tokenData**: Original metadata when created (never changes)

**Key point**: Genesis is immutable - it proves the token's origin.

### Transactions Section

```json
"transactions": []
```

For a new token, this is empty. Each transfer adds one:

```json
"transactions": [
  {
    "type": "transfer",
    "data": {...},
    "inclusionProof": {...}
  }
]
```

The transaction history proves the token's path through the network.

### Status Field

```json
"status": "CONFIRMED"
```

Possible values:
- **PENDING**: Created locally, not submitted
- **SUBMITTED**: Submitted to network, awaiting confirmation
- **CONFIRMED**: Confirmed on network, ready to use
- **TRANSFERRED**: Sent to another wallet (archived)
- **BURNED**: Destroyed (split/consumed)

---

## Part 2: Understanding Predicates (10 minutes)

The predicate is the heart of token ownership. It's a cryptographic proof that only you can satisfy.

### What is a Predicate?

A predicate is a function that asks: "Can you prove you should own this token?"

```
Predicate = "Can you satisfy this proof requirement?"
  ↓
  Only the holder of the private key can satisfy it
  ↓
  Your secret is the key to unlocking it
```

### Predicate Structure in TXF

```json
"predicate": [1, "UNMASKED", {...detailed_predicate_data...}]
```

Format: `[version, type, data]`

**version**: Protocol version (1)
**type**: UNMASKED or MASKED
**data**: Cryptographic details (CBOR encoded)

### Predicate Types

#### 1. Unmasked Predicate (Reusable Address)

Used in Tutorial 1 - same address for multiple tokens.

```json
"predicate": [1, "UNMASKED", {
  "publicKey": "base64-encoded-public-key",
  "publicKey_raw": "65-char-hex-key"
}]
```

**How it works**:
1. Your secret is hashed to create a private key
2. The private key generates a public key
3. The predicate stores your public key
4. Only holders of the private key (your secret) can prove ownership

**Example creation**:
```bash
SECRET="my-secret" npm run gen-address -u  # -u for unmasked
```

Same secret = Same address always!

**Use case**: Receiving multiple tokens, reusable wallet address

#### 2. Masked Predicate (One-Time Use)

Different address for each token - more private.

```json
"predicate": [1, "MASKED", {
  "data": {...},
  "publicKey": "base64...",
  "publicKey_raw": "hex..."
}]
```

**How it works**:
1. You provide a nonce (random or specified)
2. Hash: `(secret, nonce) → private_key`
3. This creates a unique address for THIS token ONLY
4. Different nonce = Different address

**Example creation**:
```bash
SECRET="my-secret" npm run mint-token -n "unique-nonce-1"
# Creates masked predicate with that nonce
```

Different nonce = Different address!

**Use case**: Privacy (each token has unique address), one-time transfers

### How Predicates Prove Ownership

When you transfer a token:

```
Your Action: "I want to transfer this token"
   ↓
Your Secret: Hashed to private key
   ↓
Private Key: Signs the transfer request
   ↓
Network: Verifies signature against public key in predicate
   ↓
Result: Only you could have created that signature!
   ↓
Ownership Proven!
```

### Examining Real Predicates

Let's look at a predicate in your token:

```bash
# Open a token file
cat $(ls -t *.txf | head -1) | python3 -m json.tool | head -50
```

Find the predicate section:

```json
"predicate": [
  1,
  "UNMASKED",
  {
    "publicKey": "A6sy2...(long base64)...==",
    "publicKey_raw": "1ba...(130-char hex)...3c1"
  }
]
```

The `publicKey_raw` is your public key in hex - this is what proves your ownership!

---

## Part 3: How Transfers Work (8 minutes)

Now let's understand what happens when you transfer a token.

### Transfer Protocol Overview

A transfer has 2-3 phases:

#### Phase 1: Sender Creates Commitment

```
Sender's Action:
  1. Load token
  2. Create transfer commitment
  3. Sign with sender's private key
  4. Result: Signed transfer request
```

The commitment includes:
- Token being transferred
- Recipient's address
- Salt (random value)
- Optional message
- Sender's signature

#### Phase 2: Create Transfer Package (Pattern A)

For offline transfers:

```json
{
  "offlineTransfer": {
    "version": "1.1",
    "type": "offline_transfer",
    "sender": {
      "address": "DIRECT://sender-address",
      "publicKey": "base64..."
    },
    "recipient": "DIRECT://recipient-address",
    "commitment": {
      "salt": "base64-encoded-salt",
      "timestamp": 1730558622
    },
    "network": "production",
    "commitmentData": "{...serialized commitment...}",
    "message": "Optional message"
  }
}
```

This package is:
- Safe to transmit (no private keys)
- Transferable (file-based)
- Network-independent (can be delivered offline)

#### Phase 3: Recipient Receives and Submits

```
Recipient's Action:
  1. Load transfer package
  2. Verify recipient address matches
  3. Create recipient predicate
  4. Submit to network
  5. Network confirms transfer
  6. Update token ownership
```

### Understanding the Salt

The salt is a random value used for masked predicates:

```
Salt = Random bytes (256-bit)
  ↓
Used to calculate recipient's masked predicate address
  ↓
Formula: address = hash(recipient_secret + salt)
  ↓
Result: Unique address that proves recipient owns token
```

The sender generates the salt and includes it in the transfer package. The recipient uses it to prove they own the token.

### Token State After Transfer

**Before Transfer**:
```json
"state": {
  "predicate": [1, "UNMASKED", {...sender's_public_key...}],
  "data": "original metadata"
}
```

**In Transfer Package** (PENDING):
```json
"state": {
  "predicate": [1, "UNMASKED", {...sender's_public_key...}],  // Unchanged!
  "data": "original metadata"
},
"offlineTransfer": {
  "sender": {...},
  "recipient": "DIRECT://recipient-address",
  ...
}
```

**After Recipient Claims** (CONFIRMED):
```json
"state": {
  "predicate": [1, "MASKED", {...recipient's_predicate...}],  // Changed!
  "data": "original metadata"  // Unchanged
},
"transactions": [
  {
    "type": "transfer",
    "data": {...includes_commitment...},
    "inclusionProof": {...}
  }
],
"status": "CONFIRMED"
```

**What Changed:**
- Predicate: Now shows recipient's public key (proves they own it)
- Transactions: Added transfer transaction
- Status: PENDING → CONFIRMED
- OfflineTransfer: Removed (no longer needed)

**What Stayed the Same:**
- Token ID (same token)
- Token data (original metadata)
- Genesis (original creation)

---

## Part 4: Inclusion Proofs and Network Commitment (6 minutes)

When the recipient submits the transfer, the network confirms it. This confirmation is an **inclusion proof**.

### What is an Inclusion Proof?

Proof that the transaction was included in the network's blockchain/merkle tree:

```
Recipient submits transfer
   ↓
Network processes transaction
   ↓
Transaction added to block
   ↓
Network generates proof: "This transaction is in block #12345 at position 42"
   ↓
Proof is the inclusion proof
```

### Inclusion Proof Structure

In your token file:

```json
"transactions": [
  {
    "type": "transfer",
    "data": {...},
    "inclusionProof": {
      "leaf": "hash-of-transaction",
      "proof": ["hash-1", "hash-2", "hash-3", ...],
      "index": 42,
      "treeSize": 256
    }
  }
]
```

The proof contains:
- **leaf**: Hash of this transaction
- **proof**: Hashes needed to reconstruct merkle tree
- **index**: Position in the block
- **treeSize**: Total transactions in block

### Why Inclusion Proofs Matter

```
Without proof: "I claim the transfer happened"
  → Not verifiable

With proof: "The transfer is in block #12345, position 42, proven by merkle path"
  → Verifiable by anyone!
```

Inclusion proofs enable:
- ✅ Offline verification (don't need to query network)
- ✅ Portable proof (travels with token)
- ✅ Historical verification (prove past transfers)
- ✅ Auditing (prove chain of ownership)

---

## Part 5: Token ID Generation (4 minutes)

Every token has a unique ID. Understanding how it's generated helps you control token identity.

### Token ID Formula

```
Token ID = Hash(Genesis Data)
```

The genesis data includes:
- tokenId input (if provided)
- tokenType
- tokenData
- timestamp (if applicable)

### Examples

#### Example 1: Simple Mint

```bash
npm run mint-token -- -d '{"name":"Token"}'
```

Genesis data created automatically with random values, resulting in a unique ID.

#### Example 2: Specified Token ID

```bash
npm run mint-token -- -i "my-token-id" -d '{"name":"Token"}'
```

The string "my-token-id" is hashed, combined with genesis data, creating a deterministic ID.

#### Example 3: Reproducible ID

```bash
# These create DIFFERENT tokens (different data)
npm run mint-token -- -d '{"version":"1"}'
npm run mint-token -- -d '{"version":"1"}'

# These create the SAME token ID if run with same secret (same hash inputs)
SECRET="s" npm run mint-token -- -d '{"exact":"same"}'
SECRET="s" npm run mint-token -- -d '{"exact":"same"}'  # Same ID!
```

---

## Part 6: CBOR Encoding (5 minutes)

Predicates and some token data use CBOR (Concise Binary Object Representation) encoding.

### What is CBOR?

A binary format like JSON:
- **JSON**: Human-readable text
- **CBOR**: Compact binary equivalent
- **Purpose**: Efficient storage and transmission

### CBOR Examples

```
JSON: {"name": "Alice"}
CBOR (hex): a1646e616d6565416c696365

JSON: [1, 2, 3]
CBOR (hex): 83010203

JSON: "hello"
CBOR (hex): 6568656c6c6f
```

### Why Unicity Uses CBOR

1. **Efficiency**: Smaller file size
2. **Determinism**: Same data always produces same CBOR
3. **Cryptographic**: Perfect for signed transactions
4. **Standard**: Used in blockchain and IoT

### Viewing Predicates

The predicate contains CBOR data. Here's how to understand it:

```bash
# Get a token file
cat $(ls -t *.txf | head -1) | python3 -m json.tool | grep -A 20 "predicate"
```

You'll see the structure:

```json
"predicate": [
  1,
  "UNMASKED",
  {
    "publicKey": "A6sy...(base64)...==",
    "publicKey_raw": "1ba...(hex)..."
  }
]
```

The predicate array is:
- **Index 0**: Version (1)
- **Index 1**: Type ("UNMASKED" or "MASKED")
- **Index 2**: Data (CBOR-encoded cryptographic details)

The data is CBOR-encoded, which is why it's compact and unreadable as text.

---

## Hands-On: Analyzing Your Token

Let's dissect a real token:

### Step 1: Export Token as Pretty JSON

```bash
# Get the most recent token
TOKEN_FILE=$(ls -t *.txf | head -1)

# Pretty-print it
cat "$TOKEN_FILE" | python3 -m json.tool > token-analysis.json

# Open in editor
cat token-analysis.json | head -50
```

### Step 2: Find Each Section

```bash
# Token ID
grep '"tokenId"' token-analysis.json

# Token Type
grep '"tokenType"' token-analysis.json

# Status
grep '"status"' token-analysis.json

# Predicate type
grep '"UNMASKED\|"MASKED' token-analysis.json
```

### Step 3: Decode Metadata

```bash
# Get the data field
DATA_HEX=$(grep '"data":' token-analysis.json | head -1 | sed 's/.*"\([a-f0-9]*\)".*/\1/')

# Decode it
echo "$DATA_HEX" | xxd -r -p
echo ""  # Newline for readability
```

### Step 4: Understand the Flow

Trace through your token:

```
1. Created at: [check status and timestamp]
2. Minted to: [check predicate type - UNMASKED or MASKED]
3. Metadata: [decode the hex data]
4. Transactions: [check if empty or has transfers]
5. Final state: [CONFIRMED means ready to use]
```

---

## Token Lifecycle Visual

Here's the complete lifecycle:

```
┌─────────────────────────────────────────────────────────┐
│ MINT (Your Secret + Metadata)                           │
│ ↓                                                        │
│ Create Genesis (immutable origin)                       │
│ ↓                                                        │
│ Create Predicate (ownership proof)                      │
│ ↓                                                        │
│ Submit to network                                       │
│ ↓                                                        │
│ Receive inclusion proof                                 │
│ ↓                                                        │
│ Status: CONFIRMED                                       │
├─────────────────────────────────────────────────────────┤
│ TRANSFER (Sender's Secret + Recipient's Address)        │
│ ↓                                                        │
│ Create transfer commitment (sender signs)               │
│ ↓                                                        │
│ Pattern A: Create package (status: PENDING)             │
│ Pattern B: Submit immediately to network                │
│ ↓                                                        │
│ Recipient receives package                              │
│ ↓                                                        │
│ Recipient validates and submits                         │
│ ↓                                                        │
│ Network processes, creates new predicate (recipient)    │
│ ↓                                                        │
│ Inclusion proof received                                │
│ ↓                                                        │
│ Status: CONFIRMED (recipient now owns token)            │
├─────────────────────────────────────────────────────────┤
│ FINAL STATE                                             │
│ ├─ Predicate: Recipient's public key                    │
│ ├─ Data: Original metadata (unchanged)                  │
│ ├─ Genesis: Original creation (unchanged)               │
│ ├─ Transactions: List of all transfers                  │
│ └─ Status: CONFIRMED                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Cryptographic Security

Why tokens are secure:

### Predicate as Ownership Proof

```
Predicate = Public Key
  ↓
Only private key holder (who has your secret) can:
  ✓ Sign transactions
  ✓ Create valid transfer commitments
  ✓ Generate valid predicates
  ↓
Network verifies signatures before accepting transfers
```

### Transfer Commitment Signing

```
Commitment = Transfer request
  ↓
Sender's Secret → Private Key → Digital Signature
  ↓
Network verifies: signature must be from public key in predicate
  ↓
Only sender could have created signature!
```

### Inclusion Proof Verification

```
Merkle Proof = Path from transaction to block root
  ↓
Verify: transaction_hash + merkle_proof = block_root
  ↓
If path is valid, transaction definitely in block!
  ↓
Can verify offline, no network needed!
```

---

## Advanced: Debugging Token Issues

Understanding internals helps debugging:

### Issue: "Token not found after transfer"

**Investigation**:
```bash
# Check recipient file exists
ls -1 *received*.txf

# Verify ownership in predicate
npm run verify-token -- -f received-token.txf | grep predicate
```

### Issue: "Inclusion proof missing"

**Investigation**:
```bash
# Check transactions in token
cat token.txf | python3 -m json.tool | grep -A 5 '"transactions"'

# Should show inclusion proof if confirmed
```

### Issue: "Status still PENDING"

**Investigation**:
```bash
# Check status field
cat token.txf | grep '"status"'

# If PENDING, recipient hasn't submitted yet or submission failed
```

---

## Summary: What You've Learned

| Concept | What It Does |
|---------|------------|
| **TXF** | JSON format for portable tokens |
| **State** | Current predicate and data |
| **Genesis** | Immutable origin record |
| **Predicate** | Cryptographic ownership proof |
| **Unmasked** | Reusable address, same for all tokens |
| **Masked** | One-time address, unique per token |
| **Transaction** | Transfer record with inclusion proof |
| **Inclusion Proof** | Network confirmation of transaction |
| **CBOR** | Binary encoding format for efficiency |
| **Token ID** | Unique identifier derived from genesis |
| **Status** | PENDING → CONFIRMED → TRANSFERRED |

---

## Next: Practical Debugging Session

Want to apply this knowledge? Follow this debugging exercise:

### Exercise: Trace a Transfer

```bash
# 1. Mint a token (note the filename)
SECRET="trace-secret" npm run mint-token -- -d '{"trace":"enabled"}'

# 2. Create transfer package (note filename)
SECRET="trace-secret" npm run send-token -- \
  -f original-token.txf \
  -r "RECIPIENT_ADDRESS" \
  --save

# 3. Examine original token
echo "=== Original Token ==="
cat original-token.txf | python3 -m json.tool | grep -E '"tokenId"|"status"|predicate' | head -10

# 4. Examine transfer package
echo "=== Transfer Package ==="
cat *transfer*.txf | python3 -m json.tool | grep -E '"status"|"offlineTransfer"' | head -10
```

This shows the token evolution during transfer!

---

## What's Next?

Now that you understand internals:
- **Tutorial 5**: Production best practices (security, backups, auditing)
- Build custom wallets with token parsing
- Integrate Unicity tokens into applications
- Debug complex transfer issues

---

*Now you understand the complete token system!*
