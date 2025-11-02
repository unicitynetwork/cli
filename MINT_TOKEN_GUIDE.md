# mint-token Command Guide

## Overview

The `mint-token` command creates new tokens on the Unicity Network with intelligent data serialization and flexible input formats.

## Basic Usage

```bash
npm run mint-token -- <address> [options]
```

### Required Argument

- **`<address>`** - Destination address of the first token owner
  - Example: `unicity:direct:a1b2c3d4e5f6...`

### Common Options

| Option | Description | Example |
|--------|-------------|---------|
| `-i, --token-id <id>` | Token identifier | `"my-nft-001"` or 64-char hex |
| `-y, --token-type <type>` | Token type | `"MyTokenType"` or 64-char hex |
| `-m, --metadata <data>` | Initial metadata | `'{"name":"My NFT"}'` |
| `-s, --state <data>` | Initial state data | `"State description"` |
| `-r, --reason <text>` | Minting reason | `"Airdrop campaign"` |
| `-c, --coins <amounts>` | Coin amounts (fungible) | `"100,200,300"` |
| `-o, --output <file>` | Output file path | `token.txf` or `-` for stdout |
| `--stdout` | Output to stdout | - |
| `--local` | Use local aggregator | - |
| `--production` | Use production aggregator | - |

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

## Examples

### Example 1: Minimal NFT

```bash
npm run mint-token -- unicity:direct:abc123def456
```

- Generates random TokenId and uses default TokenType
- Empty metadata and state
- Creates non-fungible token (NFT)
- Auto-generates filename: `20251102_143022_1730570722456_abc123def4.txf`

### Example 2: NFT with Metadata

```bash
npm run mint-token -- unicity:direct:abc123def456 \
  -m '{"name":"Rare Collectible","edition":1,"rarity":"legendary"}' \
  -r "Limited edition launch"
```

- Metadata stored as JSON (preserves structure)
- Reason saved in TXF metadata
- Recipient can parse JSON from state data

### Example 3: Custom TokenId and Type

```bash
npm run mint-token -- unicity:direct:abc123def456 \
  -i "genesis-token-001" \
  -y "MyCollectionType"
```

- TokenId hashed: `"genesis-token-001"` → 256-bit hash
- TokenType hashed: `"MyCollectionType"` → 256-bit hash
- Same text input always produces same hash (deterministic)

### Example 4: Fungible Token with Coins

```bash
npm run mint-token -- unicity:direct:abc123def456 \
  -c "1000,2000,5000" \
  -m '{"symbol":"MTK","decimals":18}'
```

- Creates fungible token with 3 coins (amounts: 1000, 2000, 5000)
- Total supply: 8000 units
- Metadata describes token properties

### Example 5: Using Exact 256-bit Hex

```bash
npm run mint-token -- unicity:direct:abc123def456 \
  -i a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890 \
  -y b2c3d4e5f6789012345678901234567890123456789012345678901234567890ab
```

- TokenId used directly (64 hex chars = 256 bits)
- TokenType used directly (64 hex chars = 256 bits)
- No hashing applied

### Example 6: State as Hex Data

```bash
npm run mint-token -- unicity:direct:abc123def456 \
  -s 0xdeadbeefcafe1234
```

- State decoded from hex: `0xdeadbeefcafe1234` → bytes `[de ad be ef ca fe 12 34]`
- Useful for binary state data

### Example 7: Pipeline Usage

```bash
# Output to stdout for processing
npm run mint-token -- unicity:direct:abc123def456 \
  -m '{"name":"NFT"}' \
  --stdout | jq .

# Save to specific file
npm run mint-token -- unicity:direct:abc123def456 \
  -o my-token.txf

# Output to stdout via -o flag
npm run mint-token -- unicity:direct:abc123def456 \
  -o - > token.txf
```

### Example 8: Local Testing

```bash
npm run mint-token -- unicity:direct:abc123def456 \
  --local \
  -m "Test token for local aggregator"
```

- Uses `http://localhost:3000` endpoint
- Requires local aggregator running

## Output Format

### TXF File Structure (v2.0)

```json
{
  "version": "2.0",
  "id": "0000a1b2c3d4...",
  "type": "nft",
  "state": {
    "data": "7b226e616d65...",
    "unlockPredicate": null
  },
  "genesis": {
    "data": {
      "tokenId": "0000a1b2c3d4...",
      "tokenType": "0000b2c3d4e5...",
      "tokenData": "7b226e616d65...",
      "recipient": "unicity:direct:abc123..."
    }
  },
  "transactions": [
    {
      "type": "mint",
      "data": {...},
      "inclusionProof": {...}
    }
  ],
  "status": "CONFIRMED",
  "reason": "Limited edition launch",
  "metadata": "{\"name\":\"Rare Collectible\"}"
}
```

### Auto-Generated Filename Format

```
{date}_{time}_{timestamp}_{address_prefix}.txf
```

Example: `20251102_143022_1730570722456_abc123def4.txf`

- **date**: YYYYMMDD format
- **time**: HHMMSS format (24-hour)
- **timestamp**: Unix timestamp in milliseconds
- **address_prefix**: First 10 chars of address (without scheme)

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

### 1. Use Descriptive TokenIds

```bash
# Good - descriptive and deterministic
-i "collection-mythical-beasts-001"

# Also good - explicit hex
-i a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890
```

### 2. Structure Metadata as JSON

```bash
# Good - structured and parseable
-m '{"name":"Dragon","type":"Legendary","power":9500}'

# Avoid - hard to parse later
-m "Dragon Legendary 9500"
```

### 3. Use Reason for Audit Trail

```bash
-r "Q4 2024 community airdrop - wallet #1234"
```

### 4. Test Locally First

```bash
# Test with local aggregator
npm run mint-token -- <address> --local -m "Test"

# Then deploy to production
npm run mint-token -- <address> --production -m "Production NFT"
```

### 5. Save Important Tokens

```bash
# Auto-save to file
npm run mint-token -- <address> -m '{"important":true}'

# Custom filename
npm run mint-token -- <address> -o genesis-token.txf
```

## Troubleshooting

### "Cannot parse address"

- Check address format: must be valid Unicity address
- Should start with scheme like `unicity:direct:`

### "Timeout waiting for inclusion proof"

- Local aggregator may not be running
- Network connectivity issues
- Try increasing timeout (requires code change)

### "Hex string has wrong length"

- For TokenId/TokenType: must be exactly 64 hex chars
- Shorter hex will be hashed automatically
- Check for typos in hex string

### "Invalid JSON in metadata"

- Ensure proper JSON formatting
- Use single quotes around JSON string in bash
- Example: `-m '{"valid":"json"}'`

## Advanced Usage

### Deterministic Token Generation

Same input always produces same TokenId:

```bash
# Run 1
npm run mint-token -- addr -i "my-token" --stdout | jq .id

# Run 2 (same TokenId as Run 1)
npm run mint-token -- addr -i "my-token" --stdout | jq .id
```

### Batch Minting

```bash
for i in {1..10}; do
  npm run mint-token -- unicity:direct:abc123 \
    -i "collection-$i" \
    -m "{\"edition\":$i}" \
    -o "token-$i.txf"
done
```

### Integration with Other Tools

```bash
# Generate and verify in pipeline
npm run mint-token -- <addr> -m '{"test":true}' -o token.txf && \
npm run verify-token -- -f token.txf
```

## See Also

- `verify-token` - Verify token file validity
- `gen-address` - Generate new addresses
- `register-request` - Low-level commitment registration
- `get-request` - Query inclusion proofs
