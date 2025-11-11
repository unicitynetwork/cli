# Unicity CLI API Reference

Complete technical reference for all Unicity CLI commands, options, file formats, and patterns. This document provides detailed command specifications for developers integrating with the Unicity Network's offchain token system.

## Table of Contents

- [Quick Reference Tables](#quick-reference-tables)
- [Command Reference](#command-reference)
  - [gen-address](#gen-address)
  - [mint-token](#mint-token)
  - [verify-token](#verify-token)
  - [send-token](#send-token)
  - [receive-token](#receive-token)
  - [hash-data](#hash-data)
  - [get-request](#get-request)
  - [register-request](#register-request)
- [Environment Variables](#environment-variables)
- [File Formats](#file-formats)
- [Common Patterns](#common-patterns)
- [Exit Codes](#exit-codes)

---

## Quick Reference Tables

### All Commands

| Command | NPM Script | Description | Input | Output |
|---------|-----------|-------------|-------|--------|
| gen-address | `npm run gen-address` | Generate address from secret | Secret (env/prompt) | JSON address |
| mint-token | `npm run mint-token -- [options]` | Create and mint token | Secret, token data | TXF file (JSON) |
| verify-token | `npm run verify-token -- -f <file>` | Inspect token file | TXF file path | Formatted details |
| send-token | `npm run send-token -- -f <file> -r <recipient>` | Send token to recipient | TXF, recipient, secret | Extended TXF |
| receive-token | `npm run receive-token -- -f <file>` | Receive offline token | Extended TXF, secret | TXF (confirmed) |
| hash-data | `npm run hash-data -- [options]` | Compute deterministic JSON hash | JSON (data/file/stdin) | 68-char hash |
| get-request | `npm run get-request -- [options] <requestId>` | Query inclusion proof | Request ID | Proof details |
| register-request | `npm run register-request -- [options] <secret> <state> <transactionData>` | Register state transition | Secret, data | Confirmation |

### Global Options (All Commands)

| Option | Type | Applies To | Description |
|--------|------|-----------|-------------|
| `-e, --endpoint <url>` | string | mint, send, receive, register, get | Aggregator URL (default: `https://gateway.unicity.network`) |
| `--local` | flag | mint, send, receive, register, get | Use local aggregator at `http://localhost:3000` |
| `--production` | flag | mint, send, receive, register, get | Use production aggregator (default) |

### Token Type Presets

| Preset | Type | ID | Asset Kind | Decimals | Description |
|--------|------|----|----|----------|-------------|
| `nft` | Non-fungible | `f8aa13...7509` | non-fungible | - | Unicity testnet NFT token type |
| `alpha` / `uct` | Fungible coin | `455ad8...1d89` | fungible | 18 | Unicity native coin (UCT) |
| `usdu` | Stablecoin | `8f0f3d...52d7` | fungible | 6 | Unicity testnet USD stablecoin |
| `euru` | Stablecoin | `5e160d...2925` | fungible | 6 | Unicity testnet EUR stablecoin |

### Token Status Values

| Status | Meaning | Description |
|--------|---------|-------------|
| `PENDING` | Offline transfer received | Package created but not submitted to network |
| `SUBMITTED` | Submitted to network | Waiting for network confirmation |
| `CONFIRMED` | Confirmed on network | Transfer complete, recipient owns token |
| `TRANSFERRED` | Token sent | Token transferred from wallet (archived) |
| `BURNED` | Token burned | Cannot be used (split/swap operations) |
| `FAILED` | Network submission failed | Error during network submission |

---

## Command Reference

### gen-address

Generate a direct address for the Unicity Network from a secret (password/private key).

#### Synopsis

```bash
npm run gen-address [options]
```

#### Description

Derives a cryptographic address from your secret. Generates either a masked (single-use) or unmasked (reusable) address depending on the nonce parameter. The address is specific to the token type and predicate type.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--preset <type>` | string | - | Use preset token type: `nft`, `alpha`, `uct`, `usdu`, `euru` |
| `-y, --token-type <tokenType>` | string | `uct` (default) | Custom token type (hex string or text to be hashed) |
| `-n, --nonce <nonce>` | string | - | Nonce for masked/single-use address (hex or text); omit for unmasked |

#### Input

- **Secret**: Provided via `SECRET` environment variable or interactive prompt

#### Output

JSON object containing:
- `type`: `"masked"` or `"unmasked"`
- `address`: Direct address string
- `nonce`: Nonce value (only for masked)
- `tokenType`: Token type identifier (hex)
- `tokenTypeInfo`: Preset information (if using preset)

#### Examples

**Generate unmasked (reusable) address with default token type:**

```bash
SECRET="my-secret-password" npm run gen-address
```

Output:
```json
{
  "type": "unmasked",
  "address": "dir://c4e9a7f2...",
  "tokenType": "455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89",
  "tokenTypeInfo": {
    "preset": "uct",
    "name": "unicity",
    "description": "Unicity testnet native coin (UCT)"
  }
}
```

**Generate masked (single-use) address with custom nonce:**

```bash
SECRET="my-secret" npm run gen-address -- -n "unique-nonce-value"
```

Output:
```json
{
  "type": "masked",
  "address": "dir://a1b2c3d4...",
  "nonce": "abc123...",
  "tokenType": "455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89",
  "tokenTypeInfo": {
    "preset": "uct",
    "name": "unicity",
    "description": "Unicity testnet native coin (UCT)"
  }
}
```

**Generate address with specific token preset:**

```bash
SECRET="my-secret" npm run gen-address -- --preset nft
```

#### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Invalid preset or processing error |

---

### mint-token

Create and mint a new token to your own address using the self-mint pattern.

#### Synopsis

```bash
npm run mint-token -- [options]
```

#### Description

Mints a new token directly to your address. Implements the self-mint pattern where you are both creator and recipient. Supports both non-fungible (NFT) and fungible tokens with configurable data, predicate type, and coin amounts. Waits for network confirmation before returning the final token.

#### Options

| Option | Type | Default | Required | Description |
|--------|------|---------|----------|-------------|
| `-e, --endpoint <url>` | string | `https://gateway.unicity.network` | - | Aggregator endpoint URL |
| `--local` | flag | - | - | Use local aggregator (`http://localhost:3000`) |
| `--production` | flag | - | - | Use production aggregator |
| `--preset <type>` | string | `nft` | - | Token type preset: `nft`, `alpha`, `uct`, `usdu`, `euru` |
| `-n, --nonce <nonce>` | string | - | - | Nonce for masked predicate (one-time use); omit for unmasked |
| `-u, --unmasked` | flag | true | - | Force unmasked predicate (reusable address) |
| `-d, --token-data <data>` | string | empty | - | Token data (JSON or text); stored in token state |
| `-c, --coins <coins>` | string | - | - | Comma-separated coin amounts (e.g., `"1000000000000000000"` for 1 UCT) |
| `-i, --token-id <tokenId>` | string | random | - | Token ID (hex or text); randomly generated if omitted |
| `-y, --token-type <tokenType>` | string | - | - | Custom token type (hex or text); overrides preset |
| `--salt <salt>` | string | random | - | Salt for predicate (hex); randomly generated if omitted |
| `-o, --output <file>` | string | - | - | Explicit output TXF file path |
| `--save` | flag | - | - | Auto-generate filename and save |
| `--stdout` | flag | - | - | Output to STDOUT only (no file) |

#### Input

- **Secret**: Provided via `SECRET` environment variable or interactive prompt
- **Token Data**: JSON or plain text (optional)
- **Endpoint**: Network to submit to (local/production)

#### Output

TXF v2.0 JSON file containing:
- `version`: "2.0"
- `genesis`: Mint transaction with inclusion proof
- `state`: Token state with predicate
- `transactions`: Empty array (newly minted)
- `nametags`: Empty array

#### Examples

**Mint simple NFT to yourself:**

```bash
SECRET="my-secret" npm run mint-token -- -d '{"name":"My NFT","description":"First token"}'
```

**Mint with auto-generated filename:**

```bash
SECRET="my-secret" npm run mint-token -- --save -d '{"collection":"My Collection"}'
```

**Mint fungible token (UCT) with specific amount:**

```bash
SECRET="my-secret" npm run mint-token -- --preset uct -c "1000000000000000000"
```

The amount `1000000000000000000` represents 1 UCT (18 decimals).

**Mint with masked (single-use) predicate:**

```bash
SECRET="my-secret" npm run mint-token -- -n "my-nonce" -d '{"usage":"once"}'
```

**Mint with custom token type:**

```bash
SECRET="my-secret" npm run mint-token -- -y "custom-token-type" --save
```

**Local testing:**

```bash
SECRET="test-secret" npm run mint-token -- --local -d '{"test":true}' --stdout
```

#### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success - token minted and confirmed |
| 1 | Error - network error, validation error, or timeout |

#### Notes

- Default uses `uct` token type if no preset or custom type specified
- For fungible tokens without `-c`, creates coin with amount 0
- Timeout waiting for inclusion proof: 30 seconds
- Polling interval: 1 second
- Predicate type affects address reusability:
  - **Masked** (with `-n`): One-time address, more private
  - **Unmasked** (default/with `-u`): Reusable address, more convenient

---

### verify-token

Verify and display detailed information about a token file.

#### Synopsis

```bash
npm run verify-token -- -f <file> [options]
```

#### Description

Loads a token file (TXF v2.0 format) and displays comprehensive information including verification status, token metadata, predicate structure, genesis transaction, state data, transaction history, and SDK compatibility. Helps diagnose token issues and understand token structure.

#### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `-f, --file <file>` | string | Yes | Path to token file (`.txf`) |

#### Input

- **Token File**: TXF JSON file from mint-token, send-token, or receive-token

#### Output

Formatted text output showing:
- Basic information (version, file format)
- SDK compatibility status
- Token identification (ID, type)
- Genesis transaction details
- Current state and predicate
- Predicate structure (CBOR breakdown)
- Transaction history
- Nametags (if present)
- Verification summary

#### Examples

**Verify a freshly minted token:**

```bash
npm run verify-token -- -f 20250110_145230_1234567890_abc123def.txf
```

Output:
```
=== Token Verification ===
File: 20250110_145230_1234567890_abc123def.txf

=== Basic Information ===
Version: 2.0
✅ Token loaded successfully with SDK
Token ID: 455ad872065...
Token Type: f8aa13834268...

=== Genesis Transaction (Mint) ===
Mint Transaction Data:
  Token ID: f8aa13834268...
  Token Type: 455ad8720656...
  Recipient: dir://c4e9a7f2...

  Token Data (hex): 7b226e616d65...
  Token Data (decoded):
  {
    "name": "My NFT",
    "description": "First token"
  }

=== Current State ===
State Data (decoded):
{
  "name": "My NFT",
  "description": "First token"
}

=== Predicate Details ===
✅ Valid CBOR structure: [engine_id, template, params]
Engine ID: 0 - UnmaskedPredicate (reusable address)
...

=== Transaction History ===
Number of transfers: 0
(No transfer transactions - newly minted token)

=== Verification Summary ===
✓ File format: TXF v2.0
✓ Has genesis: true
✓ Has state: true
✓ Has predicate: true
✓ SDK compatible: Yes

💡 This token can be transferred using the transfer-token command
```

**Verify transferred token:**

```bash
npm run verify-token -- -f transferred_token.txf
```

Shows full transaction history and updated ownership information.

#### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | File not found or invalid format |

#### Notes

- Outputs to STDOUT (not to file)
- Predicate decoder handles both masked and unmasked types
- Token data shown both as hex and decoded (UTF-8/JSON)
- SDK compatibility check helps diagnose transfer issues

---

### send-token

Send a token to a recipient address using offline transfer or immediate submission.

#### Synopsis

```bash
npm run send-token -- -f <file> -r <recipient> [options]
```

#### Description

Sends a token to a recipient using one of two patterns:

1. **Pattern A (Default)**: Creates an offline transfer package - token file is sent to recipient offline, they submit it to complete the transfer
2. **Pattern B**: Submits immediately to network - transaction is confirmed before returning

Supports optional transfer messages and flexible output handling.

#### Options

| Option | Type | Default | Required | Description |
|--------|------|---------|----------|-------------|
| `-f, --file <file>` | string | - | Yes | Token file (TXF) to send |
| `-r, --recipient <address>` | string | - | Yes | Recipient address (dir://...) |
| `-m, --message <message>` | string | - | - | Optional transfer message |
| `-e, --endpoint <url>` | string | `https://gateway.unicity.network` | - | Aggregator endpoint (Pattern B only) |
| `--local` | flag | - | - | Use local aggregator (Pattern B only) |
| `--production` | flag | - | - | Use production aggregator |
| `--submit-now` | flag | - | - | Use Pattern B (submit immediately) |
| `-o, --output <file>` | string | - | - | Explicit output file path |
| `--save` | flag | - | - | Auto-generate output filename |
| `--stdout` | flag | - | - | Output to STDOUT only |

#### Input

- **Token File**: TXF file from mint-token or previous receive-token
- **Recipient Address**: Direct address (from gen-address)
- **Secret**: Provided via `SECRET` environment variable or interactive prompt (for signing transfer)

#### Output

Extended TXF JSON file with:
- **Pattern A**: `status: PENDING`, `offlineTransfer` package included
- **Pattern B**: `status: TRANSFERRED`, transfer transaction included

#### Examples

**Create offline transfer package (Pattern A - default):**

```bash
SECRET="sender-secret" npm run send-token -- \
  -f token.txf \
  -r "dir://recipient-address-here" \
  -m "Here's your token!" \
  --save
```

Output file contains offline transfer package. Recipient runs:
```bash
SECRET="recipient-secret" npm run receive-token -- -f package.txf --save
```

**Submit immediately (Pattern B):**

```bash
SECRET="sender-secret" npm run send-token -- \
  -f token.txf \
  -r "dir://recipient-address-here" \
  --submit-now \
  --save
```

Token is immediately transferred on network. Recipient doesn't need to submit anything.

**Send with explicit output file:**

```bash
SECRET="sender-secret" npm run send-token -- \
  -f token.txf \
  -r "dir://recipient-address" \
  -o "transfer_to_alice.txf"
```

**Output to STDOUT for piping:**

```bash
SECRET="sender-secret" npm run send-token -- \
  -f token.txf \
  -r "dir://recipient-address" \
  --stdout | jq .
```

#### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | File not found, invalid recipient, network error, or timeout |

#### Transfer Patterns

**Pattern A (Offline Package)**:
- Creates file with offline transfer data
- No network submission needed by sender
- Recipient submits to network using `receive-token`
- Status: `PENDING` → recipient changes to `CONFIRMED`
- Best for: Offline transfers, email/messaging distribution

**Pattern B (Submit Now)**:
- Submits transfer to network immediately
- Waits for network confirmation
- Token marked `TRANSFERRED`
- Recipient doesn't need to submit
- Best for: Online transfers, immediate confirmation needed

#### Notes

- Sender's secret required for creating transfer commitment
- Message is included in offline package but not stored on-chain
- Network selection (local/production) applies to submission only
- Both patterns preserve all token data and history

---

### receive-token

Complete an offline token transfer by submitting the transfer to the network.

#### Synopsis

```bash
npm run receive-token -- -f <file> [options]
```

#### Description

Receives a token that was sent via offline transfer package (Pattern A). Validates the package, verifies you are the intended recipient, submits the transfer to the network, waits for confirmation, and updates the token to reflect new ownership. The recipient's secret is required to derive the recipient address and verify ownership eligibility.

#### Options

| Option | Type | Default | Required | Description |
|--------|------|---------|----------|-------------|
| `-f, --file <file>` | string | - | Yes | Extended TXF file with offline transfer package |
| `-e, --endpoint <url>` | string | `https://gateway.unicity.network` | - | Aggregator endpoint URL |
| `--local` | flag | - | - | Use local aggregator (`http://localhost:3000`) |
| `--production` | flag | - | - | Use production aggregator |
| `-o, --output <file>` | string | - | - | Explicit output TXF file path |
| `--save` | flag | - | - | Auto-generate output filename |
| `--stdout` | flag | - | - | Output to STDOUT only |

#### Input

- **Extended TXF File**: File from send-token with offline transfer package
- **Secret**: Recipient's secret (via `SECRET` environment variable or prompt)
- **Endpoint**: Network endpoint for submission

#### Output

TXF v2.0 JSON file with:
- `status: CONFIRMED`
- `state`: Updated with recipient's predicate
- `transactions`: Previous transfers plus new transfer transaction
- No `offlineTransfer` section (transfer complete)

#### Examples

**Receive offline token transfer:**

```bash
SECRET="recipient-secret" npm run receive-token -- \
  -f transfer_from_alice.txf \
  --save
```

Output:
```
=== Receive Token (Offline Transfer) ===

Step 1: Loading extended TXF file...
  ✓ File loaded: transfer_from_alice.txf

Step 2: Validating offline transfer package...
  ✓ Offline transfer package validated
  Sender: dir://sender-address
  Recipient: dir://recipient-address
  Network: production
  Message: "Here's your token!"

Step 3: Getting recipient secret...
  ✓ Signing service created
  Public Key: 03abc123...

...

Step 13: Updating token with new ownership...
  ✓ Token updated with recipient ownership

=== Transfer Received Successfully ===
Token ID: f8aa13834268...
Your Address: dir://new-owner-address
Status: CONFIRMED
Transactions: 1

✅ Token is now in your wallet and ready to use!
```

**Receive with explicit endpoint:**

```bash
SECRET="my-secret" npm run receive-token -- \
  -f offline_transfer.txf \
  -e http://localhost:3000 \
  -o my_received_token.txf
```

**Output to STDOUT for inspection:**

```bash
SECRET="my-secret" npm run receive-token -- \
  -f offline_transfer.txf \
  --stdout | jq .status
```

#### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success - token received and confirmed |
| 1 | Validation error, address mismatch, network error, or timeout |

#### Validation Checks

The command performs these validations:

- **File Format**: Extended TXF v2.0 with offlineTransfer section
- **Package Structure**: Valid offline transfer package
- **Address Verification**: Derived address matches recipient address in package
- **Network**: Verifies you're submitting to correct network
- **Inclusion Proof**: Waits for confirmation on network

#### Notes

- Timeout waiting for inclusion proof: 30 seconds
- Polling interval: 1 second
- Address mismatch indicates wrong secret or package tampering
- Token state (data) preserved from original token
- Transaction history includes all previous transfers
- After confirmation, token is ready for transfer to another recipient

---

### hash-data

Compute deterministic SHA256 hash of JSON data using canonical normalization.

#### Synopsis

```bash
npm run hash-data [options]
```

#### Description

Computes a deterministic hash of JSON data by normalizing it to canonical form (sorted keys, compact serialization) before hashing. Primarily used to generate data hashes for the `send-token --recipient-data-hash` option, which allows senders to commit to specific recipient state data without revealing it in the transfer package.

**Normalization Rules:**
- Object keys are sorted alphabetically (recursively)
- Array order is preserved
- Whitespace is removed (compact JSON)
- Encoding: UTF-8
- Algorithm: SHA256

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-d, --data <json>` | string | - | JSON string to hash |
| `-f, --file <path>` | string | - | Read JSON from file |
| `--raw-hash` | flag | - | Output 64-char hash only (without algorithm prefix) |
| `--verbose` | flag | - | Show normalization steps and details |

#### Input

Accepts JSON data from three sources (priority order):
1. `--data` flag: Inline JSON string
2. `--file` flag: Path to JSON file
3. **stdin**: Piped JSON data

#### Output

**Default Format (68 characters):**
```
0000<64-char-hex-hash>
```
- First 4 chars: Algorithm identifier (`0000` = SHA256)
- Next 64 chars: Hex-encoded hash

**With `--raw-hash` (64 characters):**
```
<64-char-hex-hash>
```

**With `--verbose`:**
- Input JSON
- Normalized JSON
- UTF-8 bytes (hex dump)
- Algorithm
- Raw hash
- Imprint (with prefix)
- Usage example

#### Examples

**Hash inline JSON:**

```bash
$ npm run hash-data -- --data '{"key":"value"}'
0000a1b2c3d4e5f6...
```

**Hash from file:**

```bash
$ npm run hash-data -- --file state.json
0000f1e2d3c4b5a6...
```

**Hash from stdin:**

```bash
$ echo '{"key":"value"}' | npm run hash-data
0000a1b2c3d4e5f6...

$ cat metadata.json | npm run hash-data --verbose
```

**Deterministic normalization (different inputs, same hash):**

```bash
# Different key order
$ npm run hash-data -- --data '{"b":2,"a":1}'
000043258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777

$ npm run hash-data -- --data '{"a":1,"b":2}'
000043258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777

# Different whitespace
$ npm run hash-data -- --data '{ "a" : 1 , "b" : 2 }'
000043258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777
```

**Nested objects:**

```bash
$ npm run hash-data -- --data '{"nested":{"z":3,"a":1},"top":"value"}' --verbose
Input JSON:      {"nested":{"z":3,"a":1},"top":"value"}
Normalized JSON: {"nested":{"a":1,"z":3},"top":"value"}
...
```

**Arrays preserve order:**

```bash
$ npm run hash-data -- --data '{"arr":[3,1,2]}' --verbose
Normalized JSON: {"arr":[3,1,2]}  # Order unchanged
```

**Use with send-token:**

```bash
# 1. Compute hash of required data
$ HASH=$(npm run hash-data -- --data '{"invoice":"INV-001","amount":1000}')

# 2. Send token with data hash
$ npm run send-token -- \
    -f token.txf \
    -r "DIRECT://recipient..." \
    --recipient-data-hash "$HASH" \
    --save

# 3. Recipient must provide matching data when receiving
$ npm run receive-token -- \
    -f transfer.txf \
    --data '{"invoice":"INV-001","amount":1000}' \
    --save
```

**Pipeline integration:**

```bash
# Extract and hash token metadata
$ jq '.state.data' token.txf | npm run hash-data
0000abc123...

# Generate complex data programmatically
$ node -e 'console.log(JSON.stringify({
    timestamp: Date.now(),
    purpose: "payment"
  }))' | npm run hash-data --verbose
```

#### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success - hash computed |
| 1 | Invalid JSON, file not found, or no input provided |

#### Use Cases

1. **Payment References**: Enforce invoice numbers without revealing them
2. **Metadata Constraints**: Commit to specific metadata structure
3. **Auditing**: Link tokens to documents via hash
4. **Compliance**: Require regulatory data fields
5. **Data Verification**: Ensure recipient provides expected data

#### Notes

- **Deterministic**: Same JSON structure always produces same hash
- **Key Order Independent**: `{"a":1,"b":2}` === `{"b":2,"a":1}`
- **Whitespace Independent**: Formatting doesn't affect hash
- **Array Order Matters**: `[1,2,3]` !== `[3,2,1]` (intentional)
- **Nested Objects**: Recursively normalized
- **Compatible**: Output format matches SDK's `DataHash.toJSON()`

#### See Also

- [send-token](#send-token) - Using `--recipient-data-hash` option
- [receive-token](#receive-token) - Providing matching state data
- [hash-data Command Guide](../guides/commands/hash-data.md) - Detailed examples

---

### get-request

Query and retrieve inclusion proof for a specific request ID on the network.

#### Synopsis

```bash
npm run get-request -- [options] <requestId>
```

#### Description

Queries the aggregator for an inclusion proof of a request. Useful for debugging failed transactions, checking commitment status, and understanding merkle tree proofs. Supports both inclusion proofs (request exists) and exclusion proofs (request doesn't exist).

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-e, --endpoint <url>` | string | `https://gateway.unicity.network` | Aggregator endpoint URL |
| `--local` | flag | - | Use local aggregator (`http://localhost:3000`) |
| `--production` | flag | - | Use production aggregator |
| `--json` | flag | - | Output raw JSON response (for pipeline use) |

#### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `<requestId>` | string | Yes | Request ID to query (hex string) |

#### Input

- **Request ID**: Hex identifier from mint/transfer operations

#### Output

Formatted text output (default) or raw JSON (with `--json`):
- Status (OK, PATH_NOT_INCLUDED, NOT_FOUND)
- Commitment data (transaction hash, authenticator)
- Merkle tree path with steps
- Unicity certificate

#### Examples

**Check inclusion proof for a request:**

```bash
npm run get-request -- 7c8a9b0f1d2e3f4a5b6c7d8e9f0a1b2c
```

Output:
```
STATUS: OK (expected)
This is an INCLUSION PROOF.

What this means:
  - The RequestId EXISTS in the Sparse Merkle Tree
  - A commitment was successfully registered

Commitment Data:
  Transaction Hash: abc123def456...
  Authenticator:
    Signature: 843bc1fd04f31a6eee7c584de67c6985fd6021e912622aac...
    Public Key: 03384d4d4ad517fb94634910e0c88cb4551a483017c03256de4310afa4b155dfad

Merkle Tree Path:
  Root Hash: 0000000000000000000000000000000000000000000000000000000000000000
  Path Length: 2 steps

Hash Path (for pipeline use):
  Step 0:
    Path: left
    Data: hash_value_1
  Step 1:
    Path: right
    Data: hash_value_2

Note: In the SDK, this would verify with status OK
```

**Check exclusion proof (request not found):**

```bash
npm run get-request -- nonexistent1234567890abcdef1234567890abcd
```

Output:
```
STATUS: PATH_NOT_INCLUDED
This is an EXCLUSION PROOF (non-inclusion proof).

What this means:
  - The RequestId does NOT exist in the Sparse Merkle Tree
  - No commitment with this RequestId has been registered
  - The proof cryptographically demonstrates absence
```

**Get raw JSON for scripting:**

```bash
npm run get-request -- --json abc123... | jq '.result.inclusionProof.transactionHash'
```

**Query local node:**

```bash
npm run get-request -- --local abc123...
```

#### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success - proof retrieved (inclusion or exclusion) |
| 1 | Network error or invalid request ID |

#### Proof Types

**Inclusion Proof** (Status: OK):
- Request exists in merkle tree
- Contains transaction hash and authenticator
- Proves commitment was registered

**Exclusion Proof** (Status: PATH_NOT_INCLUDED):
- Request does NOT exist
- Merkle tree cryptographically proves absence
- Useful for confirming failed transactions

**Not Found** (Status: NOT_FOUND):
- Query failed, no proof available
- May indicate network error or timeout

#### Notes

- Merkle tree path shows steps from leaf to root
- Unicity certificate proves state root commitment
- Request ID is derived from commitment data
- Useful for timeout debugging (wait and retry)
- Can pipe `--json` output to other tools

---

### register-request

Register a commitment request at the generic abstraction level without token structures.

#### Synopsis

```bash
npm run register-request -- [options] <secret> <state> <transactionData>
```

#### Description

Low-level command for registering state transitions directly with the aggregator. Creates a commitment from secret, state data, and transaction data, then submits to the network. Useful for advanced workflows and testing commitment mechanisms without token abstractions.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-e, --endpoint <url>` | string | `https://gateway.unicity.network` | Aggregator endpoint URL |
| `--local` | flag | - | Use local aggregator (`http://localhost:3000`) |
| `--production` | flag | - | Use production aggregator |

#### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `<secret>` | string | Yes | Secret key for signing (text string) |
| `<state>` | string | Yes | State data (will be SHA256 hashed) |
| `<transactionData>` | string | Yes | Transaction data (will be SHA256 hashed) |

#### Processing

The command performs these operations:

1. **Create Signing Service**: Derives public key from secret
2. **Hash State**: SHA256(state) → stateHash
3. **Hash Transaction**: SHA256(transactionData) → transactionHash
4. **Create RequestId**: RequestId = SHA256(publicKey + stateHash)
5. **Create Authenticator**: Signature over transactionHash with stateHash
6. **Submit**: POST commitment to aggregator

#### Input

- **Secret**: Text string (password/key)
- **State**: Text string (will be hashed)
- **Transaction Data**: Text string (will be hashed)

#### Output

Success confirmation with:
- Public key (derived from secret)
- State hash (SHA256 of state)
- Transaction hash (SHA256 of transaction data)
- Request ID (derived from public key + state hash)
- Command to check inclusion proof

#### Examples

**Register simple commitment:**

```bash
npm run register-request -- \
  "my-secret-key" \
  "initial-state" \
  "transaction-record"
```

Output:
```
Creating commitment at generic abstraction level...

Public Key: abc123def456...
State Hash: 7c8a9b0f1d2e3f4a5b6c7d8e9f0a1b2c...
Transaction Hash: def4567890abcdef4567890abcdef456...
Request ID: 9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c...

Submitting to aggregator: https://gateway.unicity.network
✅ Commitment successfully registered

Commitment Details:
  Request ID: 9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c...
  Transaction Hash: def4567890abcdef4567890abcdef456...
  State Hash: 7c8a9b0f1d2e3f4a5b6c7d8e9f0a1b2c...

You can check the inclusion proof with:
  npm run get-request -- 9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c...
```

**Register with local aggregator:**

```bash
npm run register-request -- --local "secret" "state" "transaction"
```

**Register with JSON data:**

```bash
npm run register-request -- \
  "signing-key" \
  '{"user":"alice","balance":100}' \
  '{"from":"alice","to":"bob","amount":50}'
```

**Check result with get-request:**

```bash
# First, register the commitment
REQUEST_ID=$(npm run register-request -- "secret" "state" "transaction" 2>&1 | grep "Request ID:" | awk '{print $NF}')

# Then check the inclusion proof
npm run get-request -- $REQUEST_ID
```

#### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success - commitment registered |
| 1 | Error - network error or signing failure |

#### Advanced: Understanding RequestId

The RequestId is deterministically derived:

```
RequestId = SHA256(publicKey || stateHash)
```

Where:
- `publicKey`: Derived from secret
- `stateHash`: SHA256(state parameter)

This means:
- Same secret + state = same RequestId
- Can reproduce RequestId without registration
- Useful for verification and testing

#### Notes

- All input strings are UTF-8 encoded before hashing
- Hashing algorithm: SHA256
- Public key derivation: Same as signing service
- Useful for low-level debugging and testing
- Consider token-level commands (mint-token, send-token) for production workflows

---

## Environment Variables

### SECRET

The user's secret key or password for cryptographic operations.

- **Type**: String
- **Usage**: Read before interactive prompt in: `gen-address`, `mint-token`, `send-token`, `receive-token`
- **Security**: Cleared from environment immediately after reading
- **Default**: None (interactive prompt if not set)
- **Example**:
  ```bash
  SECRET="my-password" npm run mint-token -- -d '{"name":"token"}'
  ```

### Recommendation

Always pass `SECRET` via environment variable rather than command-line arguments to avoid shell history and process list exposure:

```bash
# Good - not stored in history
SECRET="my-secret" npm run mint-token

# Avoid - exposed in shell history
npm run mint-token "my-secret"

# Better - from secure input
read -s SECRET && npm run mint-token
```

---

## File Formats

### TXF (Token eXchange Format) v2.0

Standard token file format for the Unicity Network. JSON structure with complete token lifecycle data.

#### Structure

```typescript
{
  version: "2.0",
  genesis: IMintTransactionJson,
  state: ITokenStateJson,
  transactions: ITransferTransactionJson[],
  nametags: ITokenJson[]
}
```

#### Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Format version (always "2.0") |
| `genesis` | object | Mint transaction with inclusion proof |
| `state` | object | Current token state (data + predicate) |
| `transactions` | array | Transfer transaction history |
| `nametags` | array | Associated nametag tokens |

#### Genesis Object

```typescript
{
  data: {
    tokenId: string,         // Hex-encoded token ID
    tokenType: string,       // Hex-encoded token type
    tokenData: string,       // Hex-encoded token data
    salt: string,            // Hex-encoded salt
    coinData?: [[string, string]],  // For fungible tokens
    recipient: string        // Recipient address (dir://...)
  },
  inclusionProof: {
    merkleTreePath: {
      root: string,
      steps: Array<{ path: string, data: string }>
    },
    unicityCertificate: string  // CBOR-encoded certificate
  }
}
```

#### State Object

```typescript
{
  data: string,             // Hex-encoded token data
  predicate: string         // CBOR-encoded predicate (187 bytes)
}
```

**Predicate Structure** (CBOR):
```
[
  engine_id: 0 | 1,         // 0=Unmasked, 1=Masked
  template: bytes,          // Predicate template
  params: [
    tokenId: bytes,
    tokenType: bytes,
    publicKey: bytes,
    algorithm: "SHA256",
    signatureScheme?: bytes,
    signature: bytes
  ]
]
```

#### Example TXF File

```json
{
  "version": "2.0",
  "genesis": {
    "data": {
      "tokenId": "f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509",
      "tokenType": "455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89",
      "tokenData": "7b226e616d65223a224d7920544f4b454e227d",
      "salt": "abc123def456789...",
      "recipient": "dir://c4e9a7f2d8e1b4a9c5f3e6b8a2d5c7f9",
      "coinData": [
        ["1234567890abcdef1234567890abcdef12345678", "1000000000000000000"]
      ]
    },
    "inclusionProof": {
      "merkleTreePath": {
        "root": "0000000000000000000000000000000000000000000000000000000000000000",
        "steps": [
          {
            "path": "left",
            "data": "hash_value_1"
          }
        ]
      },
      "unicityCertificate": "d8184aa3..."
    }
  },
  "state": {
    "data": "7b226e616d65223a224d7920544f4b454e227d",
    "predicate": "8301582048f1aa..."
  },
  "transactions": [],
  "nametags": []
}
```

### Extended TXF with Offline Transfer

Extended format supporting offline token transfers (Pattern A).

#### Structure

```typescript
extends TXF v2.0 with:
{
  offlineTransfer?: IOfflineTransferPackage,
  status?: TokenStatus
}
```

#### Offline Transfer Package

```typescript
{
  version: "1.1",
  type: "offline_transfer",
  sender: {
    address: string,           // dir://...
    publicKey: string          // Base64-encoded public key
  },
  recipient: string,           // dir://...
  commitment: {
    salt: string,              // Base64-encoded salt
    timestamp: number,         // Unix timestamp
    amount?: string            // For fungible tokens (BigInt as string)
  },
  network: "test" | "production",
  commitmentData: string,      // Serialized TransferCommitment JSON
  message?: string             // Optional transfer message
}
```

#### Example Extended TXF

```json
{
  "version": "2.0",
  "genesis": { ... },
  "state": { ... },
  "transactions": [],
  "nametags": [],
  "offlineTransfer": {
    "version": "1.1",
    "type": "offline_transfer",
    "sender": {
      "address": "dir://c4e9a7f2d8e1b4a9c5f3e6b8a2d5c7f9",
      "publicKey": "A4Hj8vQX2rY9pK5nL3mX8bZwB6cD9eF0gH1jK2lM3nO4p"
    },
    "recipient": "dir://z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0",
    "commitment": {
      "salt": "dGVzdHNhbHQxMjM0NTY3ODkwYWJjZA==",
      "timestamp": 1673524800000,
      "amount": "1000000000000000000"
    },
    "network": "production",
    "commitmentData": "{...serialized TransferCommitment...}",
    "message": "Here's your token!"
  },
  "status": "PENDING"
}
```

### File Naming Convention

Auto-generated filenames follow pattern:

```
YYYYMMDD_HHMMSS_TIMESTAMP_TYPE_PREFIX.txf
```

**Components**:
- `YYYYMMDD`: Date (e.g., 20250110)
- `HHMMSS`: Time (e.g., 145230)
- `TIMESTAMP`: Milliseconds since epoch
- `TYPE`: Operation type (address prefix, "sent", "transfer", "received")
- `PREFIX`: First 10 characters of address or recipient

**Examples**:
- `20250110_145230_1673524800000_abc123def.txf` - Minted token
- `20250110_150000_1673525600000_sent_xyz789ghi.txf` - Sent token
- `20250110_151530_1673526930000_transfer_jkl012mno.txf` - Transfer package

---

## Common Patterns

### Secret Handling

All commands requiring a secret follow this pattern:

1. Check `process.env.SECRET` environment variable
2. If set, use it and immediately clear from memory
3. If not set, prompt user interactively via `readline`
4. Return `Uint8Array` encoded as UTF-8

**Secure secret input**:

```bash
# Method 1: Environment variable (avoid shell history)
SECRET="my-secret" npm run mint-token

# Method 2: Read from stdin (most secure)
read -s SECRET && npm run mint-token
read -s SECRET && export SECRET && npm run mint-token

# Method 3: Read from file
SECRET=$(cat ~/.unicity-secret) npm run mint-token
```

### Hex/Hash Processing

Input parameters support flexible formats:

| Input Type | Processing | Example |
|-----------|------------|---------|
| Valid hex (64 chars) | Used directly | `abc123...` (32 bytes) |
| Valid hex (other length) | Hashed to 32 bytes | `abc123` → SHA256 → 32 bytes |
| JSON string | Validated and used | `{"key":"value"}` |
| Plain text | UTF-8 encoded or hashed | `"my text"` |
| Not provided | Random 32 bytes generated | (auto) → random value |

**Examples**:

```bash
# Direct hex
npm run mint-token -- -i "f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509"

# Hash text to 32 bytes
npm run mint-token -- -i "my-token-id"

# Hash JSON
npm run mint-token -- -i '{"series":"1","number":"1"}'

# Random (omit parameter)
npm run mint-token -- # Random token ID generated
```

### Network Endpoints

Commands support three endpoint modes:

| Option | Endpoint | Purpose |
|--------|----------|---------|
| (default) | `https://gateway.unicity.network` | Production network |
| `--local` | `http://localhost:3000` | Local testing/development |
| `--production` | `https://gateway.unicity.network` | Explicit production |
| `-e, --endpoint <url>` | Custom URL | Testnet or custom nodes |

**Examples**:

```bash
# Production (default)
npm run mint-token

# Local development
npm run mint-token -- --local

# Custom testnet
npm run mint-token -- -e https://testnet.example.com:3000
```

### Inclusion Proof Polling

Commands that wait for network confirmation use:

- **Timeout**: 30 seconds
- **Polling Interval**: 1 second
- **Retry Logic**: Continues on 404, logs other errors

If timeout occurs:

```bash
# Check proof status
npm run get-request -- <REQUEST_ID>

# Retry the command
npm run mint-token -- ... (same parameters)
```

### Address Generation

Address format: `dir://<32-byte-hash-in-hex>`

**Masked vs Unmasked**:

| Type | Use Case | Reusable | Privacy |
|------|----------|----------|---------|
| Unmasked (default) | Normal receiving | Yes | Standard |
| Masked (with `-n nonce`) | One-time transfers | No | Higher |

```bash
# Unmasked address (reusable)
SECRET="my-secret" npm run gen-address

# Masked address (one-time)
SECRET="my-secret" npm run gen-address -- -n "unique-nonce"
```

### Token Type Selection

Hierarchy for token type selection:

1. **Explicit custom**: `-y, --token-type <custom>`
2. **Preset**: `--preset <name>` (nft, uct, usdu, euru)
3. **Default**: `uct` (Unicity native coin)

```bash
# Explicit custom type
npm run mint-token -- -y "custom-type"

# Use preset
npm run mint-token -- --preset nft

# Default (uct)
npm run mint-token
```

### Fungible vs Non-Fungible

Determined by token type:

| Type | Coins | Usage |
|------|-------|-------|
| NFT | Not created | `-d '{"metadata":"..."}'` |
| UCT/Coins | Created | `-c "amount"` (e.g., "1000000000000000000" for 1 UCT) |
| Custom | Not created | Custom specification |

---

## Exit Codes

### Standard Exit Codes

All commands follow these conventions:

| Code | Meaning | Recovery |
|------|---------|----------|
| 0 | Success | N/A |
| 1 | Error - validation, network, or processing | Review error message |

### Common Error Messages

**Secret/Input Errors**:
```
Error: Unknown preset: invalid-preset
Error: --file option is required
```

**Network Errors**:
```
Error: Network error connecting to endpoint
Timeout waiting for inclusion proof after 30000ms
```

**Token Errors**:
```
Error: Address mismatch!
Error: Missing commitment data in offline transfer package
```

**Validation Errors**:
```
Error: Could not load token with SDK
Error: Token file not found or invalid format
```

### Debug Mode

For development, use:

```bash
npm run dev -- <command> <args>
```

Enables stack traces for all errors:

```bash
npm run dev -- mint-token -- --local
```

---

## Quick Command Summary

### Create and Verify

```bash
# Generate address
SECRET="secret" npm run gen-address

# Mint token
SECRET="secret" npm run mint-token -- -d '{"data":"value"}' --save

# Verify token
npm run verify-token -- -f token.txf
```

### Transfer Token (Offline Pattern)

```bash
# Create offline transfer
SECRET="sender-secret" npm run send-token -- \
  -f token.txf -r "dir://recipient-address" --save

# Recipient receives
SECRET="recipient-secret" npm run receive-token -- -f package.txf --save
```

### Transfer Token (Immediate Pattern)

```bash
SECRET="sender-secret" npm run send-token -- \
  -f token.txf -r "dir://recipient-address" --submit-now --save
```

### Debug

```bash
# Check request status
npm run get-request -- <request-id>

# Register low-level commitment
npm run register-request -- "secret" "state" "transaction"
```

---

## Additional Resources

- **Guides**: See individual `.md` files in repository
  - `GEN_ADDRESS_GUIDE.md` - Address generation guide
  - `MINT_TOKEN_GUIDE.md` - Token minting guide with presets
  - `VERIFY_TOKEN_GUIDE.md` - Token verification guide
  - `SEND_TOKEN_GUIDE.md` - Token transfer guide
  - `RECEIVE_TOKEN_GUIDE.md` - Receiving guide
  - `TRANSFER_GUIDE.md` - Complete transfer workflow

- **Unicity SDK**: [@unicitylabs/state-transition-sdk](https://github.com/unicitynetwork/state-transition-sdk)

- **Repository**: https://github.com/unicitynetwork/cli

- **Network**: https://gateway.unicity.network
