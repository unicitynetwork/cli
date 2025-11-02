# Send Token Command Guide

The `send-token` command enables token transfers using two distinct patterns: offline transfer packages (Pattern A) and immediate network submission (Pattern B).

## Overview

The command implements the Unicity token transfer protocol, allowing you to:
- Create offline transfer packages for asynchronous token delivery
- Submit transfers directly to the network for immediate confirmation
- Include optional transfer messages
- Generate cryptographically secure transfer commitments

## Command Syntax

```bash
npm run send-token -- -f <token_file> -r <recipient_address> [options]
```

### Required Options

- `-f, --file <file>` - Path to the token file (TXF format) to send
- `-r, --recipient <address>` - Recipient's address (e.g., `PK://...` or `PKH://...`)

### Optional Parameters

- `-m, --message <message>` - Optional transfer message (attached to transfer)
- `-e, --endpoint <url>` - Aggregator endpoint URL (default: `https://gateway.unicity.network`)
- `--local` - Use local aggregator (`http://localhost:3000`)
- `--production` - Use production aggregator (explicitly)
- `--submit-now` - Submit to network immediately (Pattern B)
- `-o, --output <file>` - Explicit output file path
- `--save` - Auto-generate output filename
- `--stdout` - Output to STDOUT only (no file)

## Transfer Patterns

### Pattern A: Offline Transfer (Default)

Creates an extended TXF file with an offline transfer package that can be sent to the recipient for completion.

**Use Case**: When you need to transfer a token but:
- The recipient is offline or not immediately available
- You want to batch multiple transfers
- You need to transfer through out-of-band channels (email, QR code, USB, etc.)

**Process**:
1. Sender creates transfer commitment
2. System generates extended TXF with `offlineTransfer` section
3. File status is set to `PENDING`
4. Sender delivers file to recipient
5. Recipient completes transfer using `complete-transfer` command (to be implemented)

**Example**:
```bash
# Create offline transfer package
npm run send-token -- \
  -f my-token.txf \
  -r "PK://03a1b2c3d4e5f6..." \
  -m "Payment for services" \
  --save

# Output: Extended TXF with offlineTransfer package
```

**Output Structure**:
```json
{
  "version": "2.0",
  "state": { ... },
  "genesis": { ... },
  "transactions": [],
  "nametags": [],
  "offlineTransfer": {
    "version": "1.1",
    "type": "offline_transfer",
    "sender": {
      "address": "PK://...",
      "publicKey": "base64..."
    },
    "recipient": "PK://...",
    "commitment": {
      "salt": "base64...",
      "timestamp": 1234567890
    },
    "network": "production",
    "commitmentData": "{...}",
    "message": "Optional message"
  },
  "status": "PENDING"
}
```

### Pattern B: Submit Now

Submits the transfer directly to the network and waits for confirmation.

**Use Case**: When:
- You have network connectivity
- You need immediate confirmation
- The transfer is time-sensitive
- You want to update the token's on-chain state immediately

**Process**:
1. Sender creates transfer commitment
2. System submits to network immediately
3. Waits for inclusion proof (30-second timeout)
4. Creates transfer transaction
5. Updates TXF with new transaction
6. File status is set to `TRANSFERRED`

**Example**:
```bash
# Submit transfer immediately to network
npm run send-token -- \
  -f my-token.txf \
  -r "PK://03a1b2c3d4e5f6..." \
  -m "Immediate payment" \
  --submit-now \
  --save

# Output: Updated TXF with transfer transaction
```

**Output Structure**:
```json
{
  "version": "2.0",
  "state": { ... },
  "genesis": { ... },
  "transactions": [
    {
      "data": {
        "sourceState": { ... },
        "recipient": "PK://...",
        "salt": "...",
        "message": "..."
      },
      "inclusionProof": { ... }
    }
  ],
  "nametags": [],
  "status": "TRANSFERRED"
}
```

## Security Features

### Private Key Protection

The command automatically sanitizes all output to ensure private keys are never exposed:

- **Sender secret**: Never stored in output
- **Signing service**: Only public key is included
- **Commitment data**: Validated to ensure no private key leakage
- **Offline package**: Contains only public cryptographic material

### Transfer Commitment

Each transfer creates a cryptographically secure commitment that:
- Proves sender ownership of the token
- Binds the transfer to a specific recipient
- Includes a unique salt for non-replayability
- Optionally includes a message hash

## File Naming Conventions

When using `--save`, the command auto-generates filenames:

**Pattern A (Offline)**:
```
YYYYMMDD_HHMMSS_timestamp_transfer_recipientprefix.txf
```

**Pattern B (Submit Now)**:
```
YYYYMMDD_HHMMSS_timestamp_sent_recipientprefix.txf
```

Example: `20251102_143022_1730558622_transfer_03a1b2c3d4.txf`

## Usage Examples

### Example 1: Basic Offline Transfer

```bash
# Create offline transfer package with auto-generated filename
npm run send-token -- \
  -f token-123.txf \
  -r "PK://03a1b2c3d4e5f6789abcdef..." \
  --save
```

### Example 2: Immediate Transfer with Message

```bash
# Submit to network with message
npm run send-token -- \
  -f token-123.txf \
  -r "PKH://a1b2c3d4e5f6..." \
  -m "Payment for Invoice #12345" \
  --submit-now \
  -o sent-token.txf
```

### Example 3: Local Testing

```bash
# Test with local aggregator
npm run send-token -- \
  -f test-token.txf \
  -r "PK://03testaddress..." \
  --local \
  --submit-now \
  --stdout
```

### Example 4: Offline Transfer with Custom Output

```bash
# Create offline package with specific filename
npm run send-token -- \
  -f nft-artwork.txf \
  -r "PK://03recipient..." \
  -m "Artwork transfer to collector" \
  -o artwork-transfer-for-alice.txf
```

## Secret Input Methods

The sender's secret can be provided in two ways:

### Method 1: Environment Variable (Recommended for Scripts)

```bash
SECRET="my-secret-phrase" npm run send-token -- \
  -f token.txf \
  -r "PK://..."
```

### Method 2: Interactive Prompt (Recommended for Manual Use)

```bash
npm run send-token -- -f token.txf -r "PK://..."
# Prompts: "Enter your secret (will be hidden): "
```

**Security Note**: The environment variable is cleared immediately after reading for security.

## Error Handling

The command provides detailed error messages for common issues:

### Missing Required Options
```
Error: --file option is required
Usage: npm run send-token -- -f <token.txf> -r <recipient_address>
```

### Invalid Token File
```
Error sending token:
  Message: Token file not found: token.txf
```

### Network Issues
```
Error getting inclusion proof (will retry): Network timeout
Timeout waiting for inclusion proof after 30000ms
```

### Invalid Secret
```
Error sending token:
  Message: Failed to unlock token - invalid secret or predicate mismatch
```

## Output Formats

### STDOUT Output
```bash
# Print to console only
npm run send-token -- -f token.txf -r "PK://..." --stdout
```

### File Output
```bash
# Save to specific file
npm run send-token -- -f token.txf -r "PK://..." -o output.txf

# Auto-generate filename
npm run send-token -- -f token.txf -r "PK://..." --save
```

### Dual Output
```bash
# Save to file AND print to console
npm run send-token -- -f token.txf -r "PK://..." --save --stdout
```

## Network Endpoints

### Production Network (Default)
```bash
npm run send-token -- -f token.txf -r "PK://..." --production
# or simply omit endpoint flag
```

### Local Development
```bash
npm run send-token -- -f token.txf -r "PK://..." --local
```

### Custom Endpoint
```bash
npm run send-token -- -f token.txf -r "PK://..." -e https://custom-gateway.example.com
```

## Extended TXF Format

The command outputs Extended TXF v2.0 format with the following enhancements:

### Status Field
Tracks token lifecycle:
- `PENDING` - Offline transfer created, not submitted
- `SUBMITTED` - Transfer submitted to network, awaiting confirmation
- `CONFIRMED` - Transfer confirmed on network
- `TRANSFERRED` - Token successfully transferred (Pattern B)
- `FAILED` - Network submission failed

### Offline Transfer Package
Contains all information needed for recipient to complete transfer:
- Sender address and public key
- Recipient address
- Commitment data (salt, timestamp, optional amount)
- Network identifier (test/production)
- Serialized SDK commitment for network submission
- Optional transfer message

## Integration with Android Wallet

The offline transfer package format is compatible with the Unicity Android wallet:

1. **Sender Side** (CLI):
   - Create offline transfer package
   - Export as QR code or file

2. **Recipient Side** (Android Wallet):
   - Scan QR code or import file
   - Verify transfer details
   - Submit to network with recipient's secret
   - Token ownership transfers to recipient

## Best Practices

### For Offline Transfers (Pattern A)

1. **Verify Recipient Address**: Double-check the recipient address before creating transfer
2. **Secure Delivery**: Use encrypted channels when transmitting offline packages
3. **Include Messages**: Add descriptive messages for audit trails
4. **Keep Backup**: Save a copy of the offline package until recipient confirms
5. **Time-Stamped**: Note the timestamp for tracking transfer timing

### For Immediate Transfers (Pattern B)

1. **Network Connectivity**: Ensure stable network connection
2. **Wait for Confirmation**: Don't interrupt during inclusion proof wait
3. **Verify Output**: Check the TRANSFERRED status in output
4. **Archive**: Save the final TXF as proof of transfer
5. **Timeout Handling**: If timeout occurs, check network status

## Troubleshooting

### Transfer Commitment Creation Fails

**Problem**: "Failed to create transfer commitment"

**Solutions**:
1. Verify the secret matches the token's predicate
2. Check that token file is valid TXF format
3. Ensure token hasn't already been transferred
4. Verify you own the token (secret matches)

### Network Submission Fails

**Problem**: "Error submitting transfer to network"

**Solutions**:
1. Check network connectivity
2. Verify endpoint URL is correct
3. Ensure aggregator is online
4. Try again with increased timeout

### Inclusion Proof Timeout

**Problem**: "Timeout waiting for inclusion proof after 30000ms"

**Solutions**:
1. Check aggregator health/status
2. Verify network isn't congested
3. Try Pattern A (offline) instead
4. Contact network administrator

## Advanced Usage

### Scripting Multiple Transfers

```bash
#!/bin/bash
# Transfer multiple tokens to same recipient

RECIPIENT="PK://03recipient..."
for token in tokens/*.txf; do
  echo "Transferring $token"
  SECRET="my-secret" npm run send-token -- \
    -f "$token" \
    -r "$RECIPIENT" \
    --save
done
```

### Batch Processing with Different Recipients

```bash
#!/bin/bash
# Read CSV: token_file,recipient_address,message

while IFS=, read -r token recipient message; do
  echo "Transferring $token to $recipient"
  SECRET="my-secret" npm run send-token -- \
    -f "$token" \
    -r "$recipient" \
    -m "$message" \
    --save
done < transfers.csv
```

### Conditional Pattern Selection

```bash
#!/bin/bash
# Use Pattern B if online, Pattern A if offline

if ping -c 1 gateway.unicity.network &> /dev/null; then
  echo "Online - using Pattern B"
  npm run send-token -- -f token.txf -r "PK://..." --submit-now
else
  echo "Offline - using Pattern A"
  npm run send-token -- -f token.txf -r "PK://..." --save
fi
```

## See Also

- `mint-token` - Create new tokens
- `verify-token` - Verify token file integrity
- `gen-address` - Generate recipient addresses
- `complete-transfer` - Complete offline transfers (recipient side, to be implemented)

## Technical Details

### Transfer Commitment Structure

The transfer commitment includes:
- Request ID (derived from commitment hash)
- Transaction data (source state, recipient, salt, message)
- Authenticator (signature proving sender ownership)

### Salt Generation

A cryptographically secure random 32-byte salt is generated for each transfer using `crypto.getRandomValues()`.

### Message Encoding

Messages are UTF-8 encoded as `Uint8Array` and included in the commitment.

### Address Parsing

Recipient addresses are parsed using `AddressFactory.createAddress()`, supporting:
- `PK://` - Public key addresses (unmasked predicates)
- `PKH://` - Public key hash addresses
- Other Unicity address schemes

## Changelog

### Version 1.0.0 (Initial Release)
- Pattern A: Offline transfer package creation
- Pattern B: Immediate network submission
- Extended TXF v2.0 format support
- Security sanitization of private keys
- Auto-generated filenames
- Interactive secret prompting
- Transfer message support
- Multiple endpoint configurations
