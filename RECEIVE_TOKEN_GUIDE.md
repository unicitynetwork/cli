# Receive Token Command Guide

## Overview

The `receive-token` command processes offline token transfer packages, allowing recipients to claim tokens that have been sent to them via the offline transfer pattern. This command validates the transfer package, verifies the recipient's identity, submits the transfer to the network, and updates the token with the recipient's ownership.

## Command Syntax

```bash
npm run receive-token -- -f <token_file> [options]
```

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--file <file>` | `-f` | Extended TXF file with offline transfer package (required) | - |
| `--endpoint <url>` | `-e` | Aggregator endpoint URL | `https://gateway.unicity.network` |
| `--local` | - | Use local aggregator (http://localhost:3000) | - |
| `--production` | - | Use production aggregator | - |
| `--output <file>` | `-o` | Explicit output file path | - |
| `--save` | - | Save to auto-generated filename | - |
| `--stdout` | - | Output to STDOUT only (no file) | - |

## How It Works

### 1. Load and Validate Extended TXF

The command loads the TXF file and validates:
- It's a valid TXF v2.0 format
- It contains an `offlineTransfer` section
- The offline transfer package has all required fields
- The commitment data is valid JSON
- No private keys are included (security check)

### 2. Verify Recipient Identity

- Gets the recipient's secret (from `SECRET` env var or interactive prompt)
- Creates a signing service from the secret
- Extracts the salt from the offline transfer package
- Creates an UnmaskedPredicate using token ID, type, and salt
- Derives the recipient address from the predicate
- Verifies it matches the intended recipient address

**Security**: If addresses don't match, the command exits with an error - this ensures you're using the correct secret and the token is actually intended for you.

### 3. Submit to Network

- Parses the TransferCommitment from `offlineTransfer.commitmentData`
- Submits the commitment to the Unicity Network
- Polls for inclusion proof (30-second timeout, 1-second intervals)
- Creates the final transfer transaction from commitment + proof

### 4. Update Token Ownership

- Creates a new TokenState with the recipient's predicate
- Updates the token using `token.update(trustBase, newState, transferTx)`
- Removes the `offlineTransfer` section
- Sets status to `CONFIRMED`
- Sanitizes output to ensure no private keys are included

## Usage Examples

### Basic Usage (Interactive)

```bash
npm run receive-token -- -f transfer_package.txf --save
```

This will:
1. Prompt for your secret
2. Validate the transfer
3. Submit to network
4. Save to an auto-generated filename

### Using Environment Variable for Secret

```bash
SECRET="my-secret-phrase" npm run receive-token -- -f transfer.txf -o my-token.txf
```

### Output to STDOUT Only

```bash
npm run receive-token -- -f transfer.txf --stdout > my-token.txf
```

### Using Local Test Network

```bash
npm run receive-token -- -f transfer.txf --local --save
```

## Step-by-Step Process

When you run the command, you'll see detailed output for each step:

```
=== Receive Token (Offline Transfer) ===

Step 1: Loading extended TXF file...
  ✓ File loaded: transfer_package.txf

Step 2: Validating offline transfer package...
  ✓ Offline transfer package validated
  Sender: UNICITY://1234567890abcdef...
  Recipient: UNICITY://fedcba0987654321...
  Network: production

Step 3: Getting recipient secret...
Enter your secret (will be hidden): [user input]
  ✓ Signing service created
  Public Key: 03a1b2c3d4e5f6...

Step 4: Parsing transfer commitment...
  ✓ Transfer commitment parsed
  Request ID: a1b2c3d4e5f6...

Step 5: Loading token data...
  ✓ Token loaded
  Token ID: 1234567890abcdef...
  Token Type: f8aa13834268d293...

Step 6: Creating recipient predicate and verifying address...
  Salt: 9876543210fedcba...
  ✓ Recipient predicate created
  Recipient Address: UNICITY://fedcba0987654321...
  ✓ Address verified - you are the intended recipient

Step 7: Connecting to network...
  ✓ Connected to https://gateway.unicity.network

Step 8: Submitting transfer to network...
  ✓ Transfer submitted to network

Step 9: Waiting for inclusion proof...
  ✓ Inclusion proof received

Step 10: Creating transfer transaction...
  ✓ Transfer transaction created

Step 11: Setting up trust base...
  ✓ Trust base ready (Network ID: 1)

Step 12: Creating new token state with recipient predicate...
  ✓ New token state created

Step 13: Updating token with new ownership...
  ✓ Token updated with recipient ownership

Step 14: Building final extended TXF...
  ✓ Final TXF created with CONFIRMED status

Step 15: Sanitizing and preparing output...
  ✓ Output sanitized (private keys removed)

✅ Token saved to 20251102_143022_1730565022_received_fedcba0987.txf

=== Transfer Received Successfully ===
Token ID: 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
Your Address: UNICITY://fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543
Status: CONFIRMED
Transactions: 1

✅ Token is now in your wallet and ready to use!
```

## Error Scenarios

### Missing Offline Transfer Package

```
❌ Error: No offline transfer package found in TXF file
This command is for receiving offline transfers.
Use "send-token" to create offline transfer packages.
```

**Solution**: Ensure the file you're receiving is a valid offline transfer package created with `send-token`.

### Address Mismatch

```
❌ Error: Address mismatch!
  Expected: UNICITY://abc123...
  Your address: UNICITY://def456...

  This token is not intended for you, or you are using the wrong secret.
```

**Solution**:
- Verify you're using the correct secret that corresponds to the recipient address
- Check that the sender provided the correct recipient address

### Invalid Transfer Package

```
❌ Validation failed:
  - Missing commitment data
  - Invalid commitment structure
```

**Solution**: The transfer package is corrupted or incomplete. Request a new transfer from the sender.

### Network Submission Error

```
❌ Error receiving token:
  Message: Timeout waiting for inclusion proof after 30000ms
```

**Solution**:
- Check network connectivity
- Verify the aggregator endpoint is correct
- Try again - network may be temporarily busy

## Security Considerations

### What the Command Checks

1. **Private Key Protection**: Validates that the transfer package doesn't contain private keys
2. **Recipient Verification**: Ensures you are the intended recipient by verifying address matches
3. **Secret Security**: Clears the `SECRET` environment variable after reading
4. **Output Sanitization**: Removes any sensitive data before writing output files

### Best Practices

1. **Never share your secret**: The recipient secret should never be transmitted or shared
2. **Verify sender**: Before receiving, verify the token is from a trusted sender
3. **Check network**: Use `--production` for mainnet tokens, `--local` for testing only
4. **Backup tokens**: Keep backups of received tokens in secure storage

## Integration with Wallet Flow

### Typical Wallet Integration

1. **Sender creates offline package**:
   ```bash
   npm run send-token -- -f my-token.txf -r UNICITY://recipient-address --save
   ```

2. **Sender shares the transfer file** (via QR code, file transfer, etc.)

3. **Recipient receives the token**:
   ```bash
   npm run receive-token -- -f received-transfer.txf --save
   ```

4. **Token is now in recipient's wallet** with CONFIRMED status

### Android Wallet Compatibility

This command is designed to be compatible with the Android wallet offline transfer pattern:
- Uses UnmaskedPredicate for recipient (reusable address)
- Validates extended TXF v2.0 format
- Supports the `offlineTransfer` section structure
- Creates CONFIRMED status on successful receipt

## Technical Details

### Predicate Creation

The command creates an **UnmaskedPredicate** for the recipient, which means:
- The address is reusable (can receive multiple tokens)
- Uses the salt from the offline transfer package
- Requires the token ID and token type from the original token

### Token Update Pattern

The command uses the `token.update()` SDK method which:
1. Verifies the transfer transaction is valid
2. Updates the token state with the new predicate
3. Appends the transfer transaction to the transaction history
4. Maintains the full audit trail of ownership changes

### Trust Base

A minimal trust base is created for the token update:
- Network ID based on endpoint (1 for production, 3 for test)
- Single root node for testnet compatibility
- Required for SDK validation even though trust is already established via inclusion proof

## Output Files

### Auto-Generated Filenames

When using `--save`, filenames follow the pattern:
```
YYYYMMDD_HHMMSS_timestamp_received_addressprefix.txf
```

Example: `20251102_143022_1730565022_received_fedcba0987.txf`

### Output Structure

The final TXF file contains:
```json
{
  "version": "2.0",
  "state": { /* recipient's predicate and token data */ },
  "genesis": { /* original mint transaction */ },
  "transactions": [ /* transfer transaction(s) */ ],
  "nametags": [],
  "status": "CONFIRMED"
}
```

Note: The `offlineTransfer` section is removed - the transfer is now complete.

## Related Commands

- **send-token**: Create offline transfer packages
- **verify-token**: Verify token ownership and structure
- **mint-token**: Create new tokens

## Troubleshooting

### Command Not Found

Ensure you've built the project:
```bash
npm run build
```

### TypeScript Errors

Check TypeScript version compatibility:
```bash
npm install
npm run build
```

### Network Connection Issues

Test connectivity to the aggregator:
```bash
curl https://gateway.unicity.network
```

For local testing:
```bash
npm run receive-token -- -f transfer.txf --local --save
```

## Additional Resources

- See `SEND_TOKEN_GUIDE.md` for creating offline transfer packages
- See `CLAUDE.md` for overall architecture and patterns
- See `src/types/extended-txf.ts` for TXF format specifications
- See `src/utils/transfer-validation.ts` for validation logic
