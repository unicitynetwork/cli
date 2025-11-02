# mint-token Command Guide

## Overview

The `mint-token` command creates new tokens on the Unicity Network using a **self-mint pattern** where tokens are minted directly to your own address derived from your secret key. This ensures you maintain ownership and control of newly minted tokens.

## Basic Usage

```bash
SECRET="your-secret" npm run mint-token -- [options]
# OR
npm run mint-token -- [options]  # Will prompt for secret interactively
```

### Authentication

The command requires a secret (password/private key) to:
1. Derive your public key and address
2. Create ownership predicate (masked or unmasked)
3. Sign the token for secure ownership

**Two ways to provide the secret:**

1. **Environment Variable** (recommended for scripts):
   ```bash
   SECRET="my-secret-password" npm run mint-token -- [options]
   ```

2. **Interactive Prompt** (recommended for manual use):
   ```bash
   npm run mint-token -- [options]
   # Enter secret (password): ****
   ```

### No Address Argument Required

Unlike older versions, you **do NOT** provide a destination address. The token is automatically minted to your address derived from your secret.

### Common Options

| Option | Description | Example |
|--------|-------------|---------|
| `-n, --nonce <nonce>` | Nonce for masked predicate | `"unique-nonce-001"` or random if not provided |
| `-u, --unmasked` | Use unmasked predicate (reusable address) | - |
| `-i, --token-id <id>` | Token identifier | `"my-nft-001"` or 64-char hex |
| `-y, --token-type <type>` | Token type | `"MyTokenType"` or 64-char hex |
| `-d, --token-data <data>` | Token data (metadata/state) | `'{"name":"My NFT"}'` |
| `--salt <salt>` | Salt for token creation | `"custom-salt"` or random if not provided |
| `-h, --data-hash <hash>` | Hash of token data | 64-char hex |
| `-r, --reason <text>` | Minting reason | `"Initial mint"` |
| `-o, --output <file>` | Output file path | `token.txf` or `-` for stdout |
| `-s, --save` | Auto-save to timestamped file | - |
| `-e, --endpoint <url>` | Custom aggregator endpoint | `https://gateway.unicity.network` |

## Smart Serialization

The command automatically detects input format and serializes appropriately.

### TokenId & TokenType (256-bit required)

These fields **must be exactly 256 bits** (64 hex characters). The command will:

| Input Type | Example | Behavior |
|------------|---------|----------|
| 64 hex chars | `a1b2c3d4...` (64 chars) | ✅ Used directly |
| <64 hex chars | `0x1234abcd` | 🔄 Hashed to 256-bit |
| Plain text | `"my-custom-token"` | 🔄 Hashed to 256-bit |
| JSON | `{"id": "token-001"}` | 🔄 Hashed to 256-bit |
| Not provided | - | 🎲 Random 256-bit generated |

**Hash Algorithm**: SHA256

### Metadata & State Data (Flexible format)

These fields accept **any format** and preserve structure:

| Input Type | Example | Behavior |
|------------|---------|----------|
| Hex string | `0x1234abcd` | 📦 Decoded to bytes |
| JSON object | `'{"name":"NFT","value":100}'` | 📝 Serialized as UTF-8 |
| JSON array | `'["tag1","tag2"]'` | 📝 Serialized as UTF-8 |
| Plain text | `"Description text"` | 📝 Serialized as UTF-8 |
| Not provided | - | ⚪ Empty bytes |

**Key Point**: JSON is NOT hashed - it's preserved as UTF-8 bytes for later parsing.

## Predicate Types

### Masked Predicate (Default - One-Time Address)

- **Default behavior** when `-u` flag is NOT used
- Creates a unique, **one-time-use address** for this specific token
- More private - each token has a different address
- Requires nonce (random if not specified with `-n`)

```bash
SECRET="my-secret" npm run mint-token -- [options]
# Uses masked predicate (default)
```

### Unmasked Predicate (Reusable Address)

- **Enabled with `-u` flag**
- Creates a **reusable address** that's the same for all tokens from your secret
- More convenient for receiving multiple tokens
- Address can be shared publicly

```bash
SECRET="my-secret" npm run mint-token -- -u [options]
# Uses unmasked predicate (reusable address)
```

## Examples

### Basic Examples

#### Example 1: Mint Simple NFT to Your Address

```bash
SECRET="my-secret-password" npm run mint-token -- \
  -d '{"name":"My First NFT","description":"A test NFT"}'
```

- Mints to your address (derived from secret)
- Uses masked predicate (one-time address)
- TokenId and nonce automatically generated
- Token data includes name and description
- Auto-saves to timestamped .txf file

#### Example 2: Mint with Reusable Address

```bash
SECRET="my-secret-password" npm run mint-token -- -u \
  -d '{"name":"SDK Test","version":1}'
```

- Uses **unmasked predicate** (reusable address with `-u` flag)
- Same address for all tokens minted with this secret
- Useful for creating a public receiving address
- Token data stored as JSON

#### Example 3: Mint with Custom Token ID

```bash
SECRET="my-secret" npm run mint-token -- \
  -i "my-unique-token-id-001" \
  -y "MyTokenType" \
  -d '{"name":"Custom Token","edition":1}'
```

- Custom TokenId: hashed from "my-unique-token-id-001"
- Custom TokenType: hashed from "MyTokenType"
- Deterministic - same inputs always produce same IDs
- Token data as JSON

#### Example 4: Mint with Explicit Nonce

```bash
SECRET="my-secret" npm run mint-token -- \
  -n "my-unique-nonce-001" \
  -d '{"name":"Nonce Test"}'
```

- Explicit nonce for masked predicate
- Useful for deterministic address generation
- Different nonce = different address

#### Example 5: Save to Custom File

```bash
SECRET="my-secret" npm run mint-token -- \
  -d '{"name":"My Token"}' \
  -o my-token.txf
```

- Saves to specified file: `my-token.txf`
- Instead of auto-generated filename

### Advanced Examples

#### Example 6: Using Exact 256-bit Hex for Token ID

```bash
SECRET="my-secret" npm run mint-token -- \
  -i a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890 \
  -y b2c3d4e5f6789012345678901234567890123456789012345678901234567890ab \
  -d '{"name":"Hex Token"}'
```

- TokenId used directly (64 hex chars = 256 bits)
- TokenType used directly (64 hex chars = 256 bits)
- No hashing applied

#### Example 7: Binary Data as Hex

```bash
SECRET="my-secret" npm run mint-token -- \
  -d 0xdeadbeefcafe1234
```

- Token data decoded from hex: `0xdeadbeefcafe1234` → bytes `[de ad be ef ca fe 12 34]`
- Useful for binary state data

#### Example 8: Interactive Secret Entry

```bash
npm run mint-token -- -d '{"name":"My NFT"}'
# Prompts: Enter secret (password): ****
```

- More secure than environment variable
- Secret not visible in process list
- Good for manual/interactive use

#### Example 9: Custom Endpoint

```bash
SECRET="my-secret" npm run mint-token -- \
  -e "http://localhost:3000" \
  -d '{"test":true}'
```

- Uses custom aggregator endpoint
- Useful for local testing or different networks

## Output Format

### TXF File Structure (v2.0)

The command generates **SDK-compliant TXF files** using `tokenState.toJSON()` to ensure proper CBOR predicate encoding.

```json
{
  "version": "2.0",
  "genesis": {
    "data": {
      "tokenId": "eaf0f2acbc090fcfef0d08ad1ddbd0016d2777a1b68e2d101824cdcf3738ff86",
      "tokenType": "f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509",
      "recipient": "DIRECT://00005812b0...",
      "tokenData": "7b226e616d65223a2253444b2054657374222c2276657273696f6e223a317d",
      "salt": "c845a590c905922e1f03c0e621e02fcdcad1738146a925ad6a7c0f8238b36f3e",
      "coinData": [],
      "reason": null,
      "recipientDataHash": null
    },
    "inclusionProof": {
      "merkleTreePath": {
        "root": "000090344643f1623e8b63011da7e062aca9cec173935bc98293638b7479535e3cd4",
        "steps": [...]
      },
      "unicityCertificate": "d903ef8701d903f08a011a00021dab00...",
      "transactionHash": null,
      "authenticator": null
    }
  },
  "state": {
    "data": "7b226e616d65223a2253444b2054657374222c2276657273696f6e223a317d",
    "predicate": "8300410058b5865820eaf0f2acbc090fcfef0d08ad1ddbd0016d2777a1b68e2d101824cdcf3738ff865820f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe39786750958210364d7f0d4c1c7a3ac3aaca74a860c7e9fd421b244016de642caf57d638fdd8fc669736563703235366b310058400a60dc84699975e45c3c08d7e9707ea3e6d0876dd84b263c2433a2b9840d668d125a397b71dcb5067dac0ee21e8293d2c36a0321b418b2f7dfa854ff3407825a"
  },
  "transactions": [],
  "nametags": []
}
```

### Key Fields Explained

- **`state.predicate`**: CBOR-encoded array `[engine_id, template, params]` (187 bytes)
  - `engine_id`: 0 (UnmaskedPredicate) or 1 (MaskedPredicate)
  - `template`: 0x00 (1 byte)
  - `params`: 181 bytes containing tokenId, tokenType, publicKey, algorithm, signatureScheme, signature
- **`state.data`**: Hex-encoded token data (can be decoded as UTF-8/JSON)
- **`genesis.inclusionProof`**: Proof that token was included in blockchain
- **`genesis.data.recipient`**: Your address (derived from secret)

### Auto-Generated Filename Format

When using `-s` flag or when no output is specified:

```
{date}_{time}_{timestamp}_{address_prefix}.txf
```

Example: `20251102_205623_1762113383329_00005812b0.txf`

- **date**: YYYYMMDD format
- **time**: HHMMSS format (24-hour)
- **timestamp**: Unix timestamp in milliseconds
- **address_prefix**: First 10 chars of your address (derived from secret)

## Detection Logic

### How the command detects input type:

```
Input String
    ↓
Is it empty/undefined?
    ↓ Yes → Generate random or return empty
    ↓ No
    ↓
Matches /^(0x)?[0-9a-fA-F]+$/ with even length?
    ↓ Yes → Hex string
    │   ↓
    │   requireHash=true AND length≠64?
    │   ↓ Yes → Hash to 256-bit
    │   ↓ No  → Use directly
    ↓ No
    ↓
Starts with { or [ and valid JSON?
    ↓ Yes → JSON data
    │   ↓
    │   requireHash=true?
    │   ↓ Yes → Hash to 256-bit
    │   ↓ No  → Serialize as UTF-8
    ↓ No
    ↓
Plain text
    ↓
    requireHash=true?
    ↓ Yes → Hash to 256-bit
    ↓ No  → Serialize as UTF-8
```

## Token Types

### Non-Fungible Token (NFT)

- Created when `--coins` option is NOT provided
- Cannot be split or merged
- Unique identifier and metadata

### Fungible Token

- Created when `--coins` option IS provided
- Can be split and merged
- Each coin has an amount value
- Example: `-c "100,200,300"` creates 3 coins

## Best Practices

### 1. Secure Secret Management

```bash
# Good - environment variable (for scripts)
SECRET="my-secret" npm run mint-token -- [options]

# Better - interactive prompt (for manual use)
npm run mint-token -- [options]  # Prompts for secret securely

# Avoid - hardcoding secrets in files
```

### 2. Choose the Right Predicate Type

```bash
# Use masked (default) for privacy - different address per token
SECRET="my-secret" npm run mint-token -- -d '{"name":"NFT"}'

# Use unmasked (-u) for convenience - same address for all tokens
SECRET="my-secret" npm run mint-token -- -u -d '{"name":"NFT"}'
```

### 3. Structure Token Data as JSON

```bash
# Good - structured and parseable
-d '{"name":"Dragon","type":"Legendary","power":9500}'

# Avoid - hard to parse later
-d "Dragon Legendary 9500"
```

### 4. Use Descriptive TokenIds

```bash
# Good - descriptive and deterministic
-i "collection-mythical-beasts-001"

# Also good - explicit hex (if you need specific ID)
-i a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890
```

### 5. Verify Tokens After Minting

```bash
# Mint and immediately verify
SECRET="my-secret" npm run mint-token -- \
  -d '{"name":"Test"}' \
  -o token.txf

npm run verify-token -- -f token.txf
```

### 6. Use SDK-Compliant Format

The command automatically generates SDK-compliant TXF files:
- Proper CBOR predicate encoding using `tokenState.toJSON()`
- Public key and signature embedded in predicate
- Can be reloaded with `Token.fromJSON()`

### 7. Save Important Tokens

```bash
# Auto-save with timestamp
SECRET="my-secret" npm run mint-token -- \
  -d '{"important":true}' \
  -s

# Custom filename
SECRET="my-secret" npm run mint-token -- \
  -d '{"name":"Genesis"}' \
  -o genesis-token.txf
```

## Troubleshooting

### "Secret is required"

- Provide secret via `SECRET` environment variable OR
- Run without SECRET to be prompted interactively

### "Timeout waiting for inclusion proof"

- Aggregator may not be running (if using local endpoint)
- Network connectivity issues
- Default timeout is 30 seconds (adjustable in code)

### "Hex string has wrong length"

- For TokenId/TokenType: must be exactly 64 hex chars
- Shorter hex will be hashed automatically
- Check for typos in hex string

### "Invalid JSON in token data"

- Ensure proper JSON formatting
- Use single quotes around JSON string in bash
- Example: `-d '{"valid":"json"}'`

### "Token cannot be reloaded with SDK"

- This should NOT happen with the updated implementation
- All tokens now use `tokenState.toJSON()` for SDK compliance
- If it does, please report as a bug

## Advanced Usage

### Deterministic Token Generation

Same inputs always produce same TokenId (useful for reproducibility):

```bash
# Run 1
SECRET="my-secret" npm run mint-token -- \
  -i "my-unique-token-id" \
  -d '{"name":"Test"}' \
  -o - | jq '.genesis.data.tokenId'

# Run 2 (same TokenId as Run 1)
SECRET="my-secret" npm run mint-token -- \
  -i "my-unique-token-id" \
  -d '{"name":"Test"}' \
  -o - | jq '.genesis.data.tokenId'
```

### Deterministic Address Generation

Same secret + nonce = same address (useful for predictable addresses):

```bash
# Always produces same address with same secret and nonce
SECRET="my-secret" npm run mint-token -- \
  -n "fixed-nonce-001" \
  -d '{"name":"Token 1"}' \
  -o token1.txf

SECRET="my-secret" npm run mint-token -- \
  -n "fixed-nonce-001" \
  -d '{"name":"Token 2"}' \
  -o token2.txf

# Both tokens have the SAME address (but different tokenIds)
```

### Batch Minting

```bash
# Batch mint NFTs with different nonces
for i in {1..10}; do
  SECRET="my-secret" npm run mint-token -- \
    -n "nonce-$i" \
    -i "collection-token-$i" \
    -d "{\"edition\":$i,\"name\":\"NFT #$i\"}" \
    -o "nft-$i.txf"
done
```

### Integration with Other Tools

```bash
# Mint and verify in pipeline
SECRET="my-secret" npm run mint-token -- \
  -d '{"test":true}' \
  -o token.txf && \
npm run verify-token -- -f token.txf
```

## SDK Compliance

The mint-token command now generates **fully SDK-compliant TXF files**:

1. Uses `tokenState.toJSON()` for proper state serialization
2. Predicates are CBOR-encoded arrays: `[engine_id, template, params]`
3. Public key and signature embedded in predicate parameters
4. Tokens can be reloaded with `Token.fromJSON()` without errors
5. Ready for transfer and other SDK operations

**Critical Fix (2024-11-02)**: Previous versions generated broken predicates that only contained parameters (181 bytes) instead of the full CBOR array structure (187 bytes). This caused SDK loading failures. The fix uses SDK methods instead of manual serialization.

## See Also

- **`verify-token`** - Verify and inspect token files (with full predicate deserialization)
- **`gen-address`** - Generate addresses from secrets (preview your address before minting)
- **`register-request`** - Low-level state transition registration
- **`get-request`** - Query inclusion proofs
