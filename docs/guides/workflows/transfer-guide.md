# Token Transfer Guide

## Overview

The Unicity CLI supports peer-to-peer token transfers using an **offline transfer pattern** compatible with the Android wallet ecosystem. Transfers can be completed entirely offline or submitted to the network immediately.

## Transfer Patterns

### Pattern A: Offline Transfer (Default - Recommended)

The sender creates an **offline transfer package** that the recipient later submits to the network.

**Advantages:**
- Works completely offline
- Recipient controls when to submit
- No network requirement for sender
- Compatible with Android wallet
- More flexible for recipient

**Workflow:**
```
Sender                  Transfer File              Recipient
  │                          │                         │
  ├─ Create transfer         │                         │
  ├─ Save to .txf file ──────┼────────────────────────>│
  │                          │                         ├─ Load transfer
  │                          │                         ├─ Submit to network
  │                          │                         └─ Receive token
```

### Pattern B: Immediate Submission

The sender submits the transfer to the network immediately and provides a finalized token to the recipient.

**Advantages:**
- Faster finality
- Sender confirms network acceptance
- Recipient just imports the file

**Workflow:**
```
Sender                                    Recipient
  │                                           │
  ├─ Create transfer                          │
  ├─ Submit to network                        │
  ├─ Wait for inclusion proof                 │
  ├─ Create final token                       │
  ├─ Save to .txf file ──────────────────────>│
  │                                           ├─ Import token
  │                                           └─ Token ready to use
```

## Commands

### send-token

Create a token transfer (offline package or immediate submission).

```bash
npm run send-token -- -f <token_file> -r <recipient_address> [options]
```

**Required Options:**
- `-f, --file <file>` - Token file (.txf) to send
- `-r, --recipient <address>` - Recipient's address

**Common Options:**
- `-m, --message <message>` - Optional transfer message
- `--save` - Auto-generate output filename
- `-o, --output <file>` - Custom output filename
- `--submit-now` - Use Pattern B (immediate submission)
- `--local` - Use local aggregator
- `-e, --endpoint <url>` - Custom aggregator URL

### receive-token

Complete an offline transfer by submitting to the network and claiming the token.

```bash
npm run receive-token -- -f <transfer_file> [options]
```

**Required Option:**
- `-f, --file <file>` - Transfer package file (.txf with offlineTransfer section)

**Common Options:**
- `--save` - Auto-generate output filename
- `-o, --output <file>` - Custom output filename
- `--local` - Use local aggregator
- `-e, --endpoint <url>` - Custom aggregator URL

## Complete Example (Pattern A)

### Step 1: Recipient Generates Address

First, the recipient needs to generate and share their address:

```bash
# Recipient generates their address
SECRET="recipient-secret" npm run gen-address

# Output shows address like:
# DIRECT://0000280c3d90eee10f445c23c457c8968020b647ae9f...
```

### Step 2: Sender Creates Transfer

```bash
# Sender creates offline transfer package
SECRET="sender-secret" npm run send-token -- \
  -f my-token.txf \
  -r "DIRECT://0000280c3d90eee10f445c23c457c8968020b647ae9f..." \
  -m "Payment for services" \
  --save

# Output: 20251102_215617_1762116977525_transfer_0000280c3d.txf
```

### Step 3: Sender Shares File

The sender shares the transfer file with the recipient:
- Email attachment
- USB drive
- NFC/Bluetooth (for mobile)
- Cloud storage
- Any file transfer method

### Step 4: Recipient Completes Transfer

```bash
# Recipient submits transfer and receives token
SECRET="recipient-secret" npm run receive-token -- \
  -f 20251102_215617_1762116977525_transfer_0000280c3d.txf \
  --save

# Output: received_eaf0f2ac_1762117234567.txf
```

## Complete Example (Pattern B)

### Step 1: Recipient Shares Address

Same as Pattern A - recipient generates and shares address.

### Step 2: Sender Creates and Submits Transfer

```bash
# Sender creates transfer and submits to network immediately
SECRET="sender-secret" npm run send-token -- \
  -f my-token.txf \
  -r "DIRECT://0000280c3d90eee10f445c23c457c8968020b647ae9f..." \
  -m "Payment for services" \
  --submit-now \
  --save

# Waits for network confirmation...
# Output: transferred_eaf0f2ac_1762117123456.txf
```

### Step 3: Recipient Imports Token

```bash
# Recipient just verifies the token (no network submission needed)
npm run verify-token -- -f transferred_eaf0f2ac_1762117123456.txf

# Token is ready to use!
```

## File Format: Extended TXF

Transfer packages use the **Extended TXF v2.0** format, which includes an `offlineTransfer` section:

```json
{
  "version": "2.0",
  "state": { /* token state */ },
  "genesis": { /* mint transaction */ },
  "transactions": [],
  "nametags": [],

  "offlineTransfer": {
    "version": "1.1",
    "type": "offline_transfer",
    "sender": {
      "address": "DIRECT://00005812b0...",
      "publicKey": "A2Ed0VSqU+V9ma..."
    },
    "recipient": "DIRECT://0000280c3d...",
    "commitment": {
      "salt": "LST4bMf3B/e2RVIp...",
      "timestamp": 1762116977525,
      "amount": null
    },
    "network": "production",
    "commitmentData": "{ /* SDK commitment JSON */ }",
    "message": "Payment for services"
  },

  "status": "PENDING"
}
```

## Status Lifecycle

Tokens progress through the following states:

1. **CONFIRMED** - Initial state after minting
2. **PENDING** - Offline transfer created (Pattern A)
3. **SUBMITTED** - Transfer submitted to network
4. **CONFIRMED** - Transfer confirmed (recipient owns token)
5. **TRANSFERRED** - Token sent away (sender's final state)

## Security Considerations

### Secret Management

**Never share your secret!** The secret is your private key.

**Safe:**
```bash
# Environment variable (visible only to current process)
SECRET="my-secret" npm run send-token -- ...

# Interactive prompt (not visible in command history)
npm run send-token -- ...
# Prompts: Enter secret (password): ****
```

**Unsafe:**
```bash
# NEVER put secret in scripts or files
# NEVER commit secrets to version control
# NEVER share secrets over insecure channels
```

### Transfer Package Security

**Safe to share:**
- ✅ Transfer package (.txf files with offlineTransfer)
- ✅ Recipient addresses
- ✅ Public keys
- ✅ Commitment data
- ✅ Transfer messages

**Never include in transfers:**
- ❌ Private keys
- ❌ Secrets/passwords
- ❌ Nonces (for masked predicates)

The CLI automatically sanitizes output to prevent private key leakage.

### Address Verification

**Always verify the recipient address before sending:**

```bash
# Ask recipient to confirm their address
# Recipient runs:
SECRET="their-secret" npm run gen-address

# Compare the address carefully before sending
```

## Troubleshooting

### "Address mismatch" Error

**Problem**: When receiving, you get "Address mismatch!" error.

**Causes:**
1. Wrong secret - you're not the intended recipient
2. Wrong token type - address was generated for different token type
3. Transfer was created for someone else

**Solution:**
- Verify you're using the correct secret
- Check the recipient address in the transfer matches yours
- Ask sender to confirm the recipient address

### "Timeout waiting for inclusion proof"

**Problem**: Transfer submission times out.

**Causes:**
1. Network connectivity issues
2. Aggregator not responding
3. Invalid commitment data

**Solutions:**
```bash
# Try local aggregator for testing
npm run receive-token -- -f transfer.txf --local

# Or specify custom endpoint
npm run receive-token -- -f transfer.txf -e http://custom-endpoint:3000

# Check network connectivity
curl https://gateway.unicity.network
```

### "File does not contain offline transfer"

**Problem**: Trying to receive a regular token file.

**Cause**: The file is a standard TXF token, not a transfer package.

**Solution:**
- Verify you have the correct file
- Regular tokens don't need receive-token
- Only files created with send-token need receive-token

### "Token already transferred"

**Problem**: Trying to send a token that's already been sent.

**Cause**: Token has status "TRANSFERRED" - it's been sent away.

**Solution:**
- You no longer own this token
- Check for the final token file from when you sent it
- Cannot send the same token twice

## Advanced Usage

### Batch Transfers

Send multiple tokens to multiple recipients:

```bash
# Create transfers for multiple tokens
for token in *.txf; do
  SECRET="my-secret" npm run send-token -- \
    -f "$token" \
    -r "$RECIPIENT_ADDRESS" \
    --save
done
```

### Transfer with Custom Endpoint

```bash
# Local development
npm run send-token -- \
  -f token.txf \
  -r "$RECIPIENT" \
  --local

# Custom network
npm run send-token -- \
  -f token.txf \
  -r "$RECIPIENT" \
  -e "https://custom-gateway.example.com"
```

### Scripted Transfers

```bash
#!/bin/bash
# automated-transfer.sh

SENDER_SECRET="sender-secret"
RECIPIENT="DIRECT://0000280c3d..."
TOKEN_FILE="my-token.txf"

# Send token
SECRET="$SENDER_SECRET" npm run send-token -- \
  -f "$TOKEN_FILE" \
  -r "$RECIPIENT" \
  -m "Automated payment" \
  --save

echo "Transfer package created!"
```

## Best Practices

### 1. Verify Addresses

Always double-check recipient addresses before sending.

### 2. Use Meaningful Messages

```bash
-m "Invoice #12345 - Web development services"
-m "NFT transfer - Genesis Collection #042"
-m "Test transfer - please confirm receipt"
```

### 3. Keep Transfer Records

Save transfer packages and final tokens:
```bash
mkdir -p transfers/sent
mkdir -p transfers/received

# When sending
npm run send-token -- -f token.txf -r "$RECIPIENT" \
  -o "transfers/sent/transfer-$(date +%Y%m%d-%H%M%S).txf"

# When receiving
npm run receive-token -- -f transfer.txf \
  -o "transfers/received/token-$(date +%Y%m%d-%H%M%S).txf"
```

### 4. Test with Small Amounts First

For valuable tokens, test the transfer flow with a small test token first.

### 5. Backup Important Tokens

```bash
# Before sending, backup the original token
cp important-token.txf backups/important-token-$(date +%Y%m%d).txf.bak
```

## See Also

- **SEND_TOKEN_GUIDE.md** - Detailed send-token command documentation
- **RECEIVE_TOKEN_GUIDE.md** - Detailed receive-token command documentation
- **OFFLINE_TRANSFER_WORKFLOW.md** - Complete end-to-end workflow
- **MINT_TOKEN_GUIDE.md** - How to mint new tokens
- **VERIFY_TOKEN_GUIDE.md** - How to inspect token files
