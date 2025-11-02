# gen-address Command Guide

## Overview

The `gen-address` command generates direct addresses for the Unicity Network based on your private key/secret and token type. It supports both **unmasked (reusable)** and **masked (single-use)** addresses.

## Basic Usage

```bash
npm run gen-address -- [options]
```

### Authentication

The command requires a secret (private key). You can provide it in two ways:

1. **Environment variable** (recommended for scripts):
   ```bash
   SECRET="your-secret-here" npm run gen-address
   ```

2. **Interactive prompt**:
   ```bash
   npm run gen-address
   # You'll be prompted: Enter secret (password):
   ```

### Common Options

| Option | Description | Example |
|--------|-------------|---------|
| `--preset <type>` | Use official token type | `nft`, `alpha`, `uct` (default), `usdu`, `euru` |
| `-y, --token-type <type>` | Custom token type | `"MyTokenType"` or 64-char hex |
| `-n, --nonce <nonce>` | Nonce for masked address | `"my-nonce-1"` or 64-char hex |

## Address Types

### Unmasked (Reusable) Address

**When to use**: For addresses that will receive multiple tokens of the same type.

**How to generate**: Omit the `-n, --nonce` option.

```bash
SECRET="my-secret" npm run gen-address
```

**Characteristics**:
- ✅ Can receive multiple tokens of the same token type
- ✅ Simpler to manage (only need to remember secret)
- ⚠️ Less privacy (all tokens sent to this address are linkable)

### Masked (Single-Use) Address

**When to use**: For maximum privacy or one-time payments.

**How to generate**: Provide a nonce with `-n, --nonce`.

```bash
SECRET="my-secret" npm run gen-address -- -n "unique-nonce-1"
```

**Characteristics**:
- 🔒 Maximum privacy (each address is unique)
- ⚠️ Single-use per token type (cannot reuse the same nonce)
- 📝 Must remember BOTH secret AND nonce to spend

## Preset Token Types

Official Unicity token types from the [unicity-ids repository](https://github.com/unicitynetwork/unicity-ids):

| Preset | Token Name | Description | Token Type ID |
|--------|------------|-------------|---------------|
| `uct` (default) | Unicity Coin | Native coin (UCT) | `455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89` |
| `alpha` | Unicity Coin | Same as `uct` | `455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89` |
| `nft` | Unicity NFT | NFT token type | `f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509` |
| `usdu` | Unicity USD | USD stablecoin | `8f0f3d7a5e7297be0ee98c63b81bcebb2740f43f616566fc290f9823a54f52d7` |
| `euru` | Unicity EUR | EUR stablecoin | `5e160d5e9fdbb03b553fb9c3f6e6c30efa41fa807be39fb4f18e43776e492925` |

## Examples

### Example 1: Default UCT Address (Unmasked)

```bash
SECRET="my-secret" npm run gen-address
```

**Output**:
```json
{
  "type": "unmasked",
  "address": "DIRECT://00004059268bb18c04e6544493195cee9a2e7043f73cf542d15ecbef31647e65c6e98acebf8f",
  "tokenType": "455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89",
  "tokenTypeInfo": {
    "preset": "uct",
    "name": "unicity",
    "description": "Unicity testnet native coin (UCT)"
  }
}
```

- Uses default UCT token type
- Unmasked (reusable) address
- Can receive multiple UCT tokens

### Example 2: NFT Address (Unmasked)

```bash
SECRET="my-secret" npm run gen-address -- --preset nft
```

**Output**:
```json
{
  "type": "unmasked",
  "address": "DIRECT://00005812b08f9c5ed1ed446a3acecf0094aba65b31a2ab381f951892c8d236a8682968756375",
  "tokenType": "f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509",
  "tokenTypeInfo": {
    "preset": "nft",
    "name": "unicity",
    "description": "Unicity testnet NFT token type"
  }
}
```

- Uses official NFT token type
- Can receive multiple NFTs of this type

### Example 3: Masked UCT Address (Single-Use)

```bash
SECRET="my-secret" npm run gen-address -- -n "payment-001"
```

**Output**:
```json
{
  "type": "masked",
  "address": "DIRECT://00008927ced4ea6543def144da2e988af6eb4646a2bffc2843f070cc980e88fc766b6bf909aa",
  "nonce": "ec878abb89dd41df589a548c755e208e8f36937117757a355302b1325b4452c7",
  "tokenType": "455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89",
  "tokenTypeInfo": {
    "preset": "uct",
    "name": "unicity",
    "description": "Unicity testnet native coin (UCT)"
  }
}
```

- Masked (single-use) address
- Nonce "payment-001" was hashed to 256-bit
- Must save both secret and nonce to spend

### Example 4: USDU Address with Hex Nonce

```bash
SECRET="my-secret" npm run gen-address -- --preset usdu \
  -n 0xa1b2c3d4e5f6789012345678901234567890123456789012345678901234567890
```

- Uses USDU stablecoin token type
- Hex nonce used directly (no hashing)
- Single-use address for USDU payments

### Example 5: Custom Token Type

```bash
SECRET="my-secret" npm run gen-address -- -y "MyCustomTokenType"
```

**Output**:
```json
{
  "type": "unmasked",
  "address": "DIRECT://0000c2a874876dafa61c810dd5db0cbe1d6bd661dae98f2a43e883f399e4b92fd46d17b631ba",
  "tokenType": "2b264199b047b568a6b9573569260624f859f25879e5b68f22c44a5a363746bc"
}
```

- Custom token type hashed to 256-bit
- Deterministic: same input always produces same address

### Example 6: Custom Token Type with Exact Hex

```bash
SECRET="my-secret" npm run gen-address -- \
  -y a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890
```

- Custom 256-bit token type used directly
- No hashing applied to valid 64-char hex

### Example 7: Multiple Addresses for Privacy

```bash
# Generate 5 masked addresses with different nonces
for i in {1..5}; do
  SECRET="my-secret" npm run gen-address -- -n "invoice-$i" | jq .address
done
```

- Each address has a unique nonce
- Perfect for invoice generation
- Maximum privacy (addresses not linkable)

## Output Format

The command outputs JSON to **stdout** and informational messages to **stderr**.

### Unmasked Address Output

```json
{
  "type": "unmasked",
  "address": "DIRECT://...",
  "tokenType": "...",
  "tokenTypeInfo": {
    "preset": "uct",
    "name": "unicity",
    "description": "Unicity testnet native coin (UCT)"
  }
}
```

### Masked Address Output

```json
{
  "type": "masked",
  "address": "DIRECT://...",
  "nonce": "...",
  "tokenType": "...",
  "tokenTypeInfo": {
    "preset": "uct",
    "name": "unicity",
    "description": "..."
  }
}
```

### Custom Token Type Output

```json
{
  "type": "unmasked",
  "address": "DIRECT://...",
  "tokenType": "..."
}
```

Note: `tokenTypeInfo` is only present when using presets.

## Detection Logic

### Nonce Processing

```
Input (--nonce option)
    ↓
Is it undefined/not provided?
    ↓ Yes → Return null (UNMASKED address)
    ↓ No
    ↓
Matches /^(0x)?[0-9a-fA-F]{64}$/? (valid 256-bit hex)
    ↓ Yes → Decode hex to bytes, use directly
    ↓ No
    ↓
Hash input text with SHA256 to 256-bit
```

### Token Type Processing

```
Preset option or Token Type option?
    ↓
--preset specified?
    ↓ Yes → Look up in UNICITY_TOKEN_TYPES
    │       ↓ Found → Use preset token type ID
    │       ↓ Not found → Error
    ↓ No
    ↓
-y, --token-type specified?
    ↓ Yes → Is it 64 hex chars?
    │       ↓ Yes → Use directly
    │       ↓ No → Hash to 256-bit
    ↓ No
    ↓
Use default 'uct' preset
```

## Best Practices

### 1. Use Presets for Standard Tokens

```bash
# Good - uses official token types
--preset uct              # For UCT/alpha
--preset nft              # For NFTs
--preset usdu             # For USDU

# Avoid - custom types when official ones exist
-y "my-alpha-type"        # Unless you need a custom token
```

### 2. Choose Address Type Wisely

**Use Unmasked (no nonce) when**:
- Creating a long-term receiving address
- Receiving multiple payments
- Simplicity is more important than privacy

**Use Masked (with nonce) when**:
- Maximum privacy is required
- Generating unique invoice addresses
- One-time payment scenarios

### 3. Secure Secret Management

```bash
# Good - secret from environment variable
SECRET="$MY_SECRET" npm run gen-address

# Good - secret from password manager
SECRET="$(pass show unicity/secret)" npm run gen-address

# Avoid - secret in command history
npm run gen-address  # Then type interactively
```

### 4. Nonce Management for Masked Addresses

```bash
# Good - deterministic nonces
SECRET="$SECRET" npm run gen-address -- -n "invoice-$(date +%Y%m%d)-001"

# Good - sequential nonces
SECRET="$SECRET" npm run gen-address -- -n "payment-$COUNTER"

# Avoid - reusing nonces
# Same nonce = same address = security issue!
```

### 5. Save Generated Addresses

```bash
# Save to file with metadata
SECRET="$SECRET" npm run gen-address -- --preset uct -n "invoice-123" \
  > address-invoice-123.json

# Extract just the address for quick use
SECRET="$SECRET" npm run gen-address | jq -r .address
```

### 6. Use Different Addresses per Token Type

```bash
# Generate addresses for different token types
SECRET="$SECRET" npm run gen-address -- --preset uct  > addr-uct.json
SECRET="$SECRET" npm run gen-address -- --preset usdu > addr-usdu.json
SECRET="$SECRET" npm run gen-address -- --preset nft  > addr-nft.json
```

## Integration Examples

### Generate Address and Mint Token

```bash
# 1. Generate address
ADDR=$(SECRET="my-secret" npm run gen-address | jq -r .address)

# 2. Mint token to that address
npm run mint-token -- "$ADDR" --preset uct -c "1000000000000000000"
```

### Invoice Generation System

```bash
#!/bin/bash
# invoice-generator.sh

CUSTOMER_ID=$1
AMOUNT=$2
INVOICE_NUM=$(date +%Y%m%d)-$CUSTOMER_ID

# Generate unique masked address for this invoice
SECRET="$BUSINESS_SECRET" npm run gen-address -- \
  --preset usdu \
  -n "invoice-$INVOICE_NUM" \
  > "invoices/invoice-$INVOICE_NUM.json"

echo "Invoice $INVOICE_NUM created for $AMOUNT USDU"
jq -r .address "invoices/invoice-$INVOICE_NUM.json"
```

### Multi-Wallet Address Management

```bash
# wallet-manager.sh

# Main wallet (unmasked, reusable)
SECRET="$MAIN_SECRET" npm run gen-address -- --preset uct \
  > wallets/main-uct.json

# Savings wallet (different secret)
SECRET="$SAVINGS_SECRET" npm run gen-address -- --preset uct \
  > wallets/savings-uct.json

# Privacy wallet (masked addresses)
for i in {1..10}; do
  SECRET="$PRIVACY_SECRET" npm run gen-address -- \
    --preset uct -n "privacy-$i" \
    > "wallets/privacy-uct-$i.json"
done
```

## Troubleshooting

### "Cannot read secret"

- Ensure `SECRET` environment variable is set, or be ready to type it interactively
- Check that your shell is properly exporting the variable

### "Unknown preset: xyz"

- Check available presets: `nft`, `alpha`, `uct`, `usdu`, `euru`
- Preset names are case-insensitive

### "Hex string has wrong length"

- For nonce: must be exactly 64 hex characters (256-bit)
- For token type: must be exactly 64 hex characters (256-bit)
- Shorter hex strings will be hashed automatically

### Address Generation is Slow

- This is normal - cryptographic operations are computationally intensive
- Unmasked addresses are slightly faster than masked addresses

## Security Considerations

### Secret Storage

⚠️ **NEVER** store your secret in:
- Git repositories
- Unencrypted files
- Command history
- Shared locations

✅ **DO** store your secret in:
- Password managers (1Password, Bitwarden, etc.)
- Hardware security modules (HSM)
- Encrypted key files with proper permissions
- Environment variables (for temporary use)

### Nonce Management for Masked Addresses

⚠️ **NEVER**:
- Reuse the same nonce for the same secret and token type
- Share nonces publicly if you want address privacy

✅ **DO**:
- Use unique nonces for each masked address
- Store nonces alongside address records
- Use deterministic nonce generation for recovery

### Address Sharing

✅ **Safe to share**:
- The generated address itself
- The token type information

⚠️ **NEVER share**:
- Your secret
- Your nonce (if privacy is important)

## Advanced Usage

### Deterministic Address Generation

Same inputs always produce the same address:

```bash
# Run 1
SECRET="my-secret" npm run gen-address | jq -r .address

# Run 2 (same address as Run 1)
SECRET="my-secret" npm run gen-address | jq -r .address
```

This is useful for:
- Address recovery from secret
- Deterministic wallet generation
- Testing and debugging

### Address Derivation Paths

Simulate BIP44-like derivation with nonces:

```bash
# Account 0, Address 0
SECRET="$MASTER" npm run gen-address -- -n "m/44'/0'/0'/0/0"

# Account 0, Address 1
SECRET="$MASTER" npm run gen-address -- -n "m/44'/0'/0'/0/1"

# Account 1, Address 0
SECRET="$MASTER" npm run gen-address -- -n "m/44'/0'/1'/0/0"
```

### Scripting and Automation

```bash
# Generate 100 addresses in parallel
seq 1 100 | xargs -P 10 -I {} bash -c \
  "SECRET='$SECRET' npm run gen-address -- -n 'addr-{}' > addr-{}.json"

# Extract all addresses to CSV
echo "index,type,address,nonce" > addresses.csv
for f in addr-*.json; do
  idx=$(basename "$f" .json | cut -d- -f2)
  jq -r "\"$idx,\" + .type + \",\" + .address + \",\" + (.nonce // \"\")" "$f" \
    >> addresses.csv
done
```

## See Also

- `mint-token` - Mint tokens to generated addresses
- `verify-token` - Verify token file validity
- `register-request` - Low-level commitment registration
- `get-request` - Query inclusion proofs
