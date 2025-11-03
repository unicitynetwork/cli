# Offline Transfer Workflow - Complete Guide

## Overview

The offline transfer workflow allows tokens to be sent and received without requiring both parties to be online simultaneously. This is ideal for mobile wallets, cross-wallet transfers, and scenarios with intermittent connectivity.

## Two-Command Workflow

### 1. Sender: Create Transfer Package

```bash
npm run send-token -- -f my-token.txf -r UNICITY://recipient-address --save
```

**What happens:**
- Loads your token
- Creates a transfer commitment signed with your secret
- Packages the commitment with sender info and recipient address
- Creates an extended TXF file with `offlineTransfer` section
- Sets status to `PENDING`
- Outputs a transfer package file

**Output:** `20251102_143000_transfer_abcdef1234.txf`

### 2. Recipient: Receive Transfer

```bash
npm run receive-token -- -f transfer_package.txf --save
```

**What happens:**
- Validates the transfer package
- Verifies you are the intended recipient
- Submits the transfer to the network
- Waits for inclusion proof
- Updates token with your predicate (ownership)
- Sets status to `CONFIRMED`
- Removes `offlineTransfer` section

**Output:** `20251102_143100_received_fedcba0987.txf`

## Complete End-to-End Example

### Scenario
Alice wants to send a token to Bob offline.

---

### Step 1: Alice Creates Transfer Package

```bash
# Alice has token: my-nft-token.txf
# Bob's address: UNICITY://fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543

SECRET="alice-secret" npm run send-token -- \
  -f my-nft-token.txf \
  -r UNICITY://fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543 \
  -m "Happy birthday!" \
  --save
```

**Output:**
```
=== Send Token - Pattern A (Offline Package) ===

Step 1: Loading token from file...
  ✓ Token loaded: 1234567890abcdef...
  Token Type: f8aa13834268d293...

Step 2: Parsing recipient address...
  ✓ Recipient: UNICITY://fedcba0987654321...

Step 3: Getting sender secret...
  ✓ Signing service created
  Public Key: 03a1b2c3d4e5f6...

Step 4: Generating transfer salt...
  ✓ Salt: 9876543210fedcba...

Step 5: Processing transfer message...
  ✓ Message: "Happy birthday!"

Step 6: Creating transfer commitment...
  ✓ Transfer commitment created
  Request ID: abc123def456...

=== Pattern A: Creating Offline Transfer Package ===

Step 7: Building offline transfer package...
  ✓ Offline package created

Step 8: Building extended TXF with offline package...
  ✓ Extended TXF created with PENDING status

Final Step: Sanitizing and preparing output...
  ✓ Output sanitized (private keys removed)

✅ Token saved to 20251102_143000_1730565000_transfer_fedcba0987.txf

=== Transfer Complete ===
Token ID: 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
Recipient: UNICITY://fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543
Status: PENDING

💡 Offline transfer package created!
   Send this file to the recipient to complete the transfer.
   Recipient can submit using: npm run complete-transfer -- -f <file>
```

**File created:** `20251102_143000_1730565000_transfer_fedcba0987.txf`

---

### Step 2: Alice Sends File to Bob

Alice can send the transfer package file to Bob via:
- QR code (for mobile wallets)
- Email attachment
- File sharing service
- Bluetooth/NFC
- Any file transfer method

---

### Step 3: Bob Receives the Token

```bash
# Bob receives the file and runs:
SECRET="bob-secret" npm run receive-token -- \
  -f 20251102_143000_1730565000_transfer_fedcba0987.txf \
  --save
```

**Output:**
```
=== Receive Token (Offline Transfer) ===

Step 1: Loading extended TXF file...
  ✓ File loaded: 20251102_143000_1730565000_transfer_fedcba0987.txf

Step 2: Validating offline transfer package...
  ✓ Offline transfer package validated
  Sender: UNICITY://1234567890abcdef...
  Recipient: UNICITY://fedcba0987654321...
  Network: production
  Message: "Happy birthday!"

Step 3: Getting recipient secret...
  ✓ Signing service created
  Public Key: 02b1c2d3e4f5a6...

Step 4: Parsing transfer commitment...
  ✓ Transfer commitment parsed
  Request ID: abc123def456...

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

✅ Token saved to 20251102_143100_1730565060_received_fedcba0987.txf

=== Transfer Received Successfully ===
Token ID: 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
Your Address: UNICITY://fedcba0987654321fedcba0987654321fedcba0987654321fedcba09876543
Status: CONFIRMED
Transactions: 1

✅ Token is now in your wallet and ready to use!
```

**File created:** `20251102_143100_1730565060_received_fedcba0987.txf`

---

## Technical Flow Diagram

```
SENDER (Alice)                          NETWORK                     RECIPIENT (Bob)
│                                          │                              │
│  1. Load token                          │                              │
│  2. Create transfer commitment          │                              │
│  3. Build offline package               │                              │
│  4. Output TXF with offlineTransfer     │                              │
│                                          │                              │
│────── Send transfer package file ──────────────────────────────────────>│
│                                          │                              │
│                                          │        5. Load transfer pkg  │
│                                          │        6. Validate package   │
│                                          │        7. Verify address     │
│                                          │<─── 8. Submit commitment ────│
│                                          │                              │
│                                          │──── 9. Process & confirm ────>│
│                                          │                              │
│                                          │<─── 10. Get inclusion proof ──│
│                                          │                              │
│                                          │──── 11. Return proof ────────>│
│                                          │                              │
│                                          │       12. Update token state │
│                                          │       13. Save CONFIRMED TXF │
│                                          │                              │
```

## TXF File Evolution

### Original Token (Alice's Wallet)
```json
{
  "version": "2.0",
  "state": {
    "predicate": [1, "UNMASKED", {...}],  // Alice's predicate
    "data": "..."
  },
  "genesis": {...},
  "transactions": [],
  "status": "CONFIRMED"
}
```

### Transfer Package (After send-token)
```json
{
  "version": "2.0",
  "state": {
    "predicate": [1, "UNMASKED", {...}],  // Alice's predicate (unchanged)
    "data": "..."
  },
  "genesis": {...},
  "transactions": [],
  "offlineTransfer": {
    "version": "1.1",
    "type": "offline_transfer",
    "sender": {
      "address": "UNICITY://alice-address",
      "publicKey": "base64-encoded-key"
    },
    "recipient": "UNICITY://bob-address",
    "commitment": {
      "salt": "base64-encoded-salt",
      "timestamp": 1730565000
    },
    "network": "production",
    "commitmentData": "{...}",  // Serialized TransferCommitment
    "message": "Happy birthday!"
  },
  "status": "PENDING"
}
```

### Final Token (After receive-token, Bob's Wallet)
```json
{
  "version": "2.0",
  "state": {
    "predicate": [1, "UNMASKED", {...}],  // Bob's predicate (NEW!)
    "data": "..."
  },
  "genesis": {...},
  "transactions": [
    {
      "type": "transfer",
      "data": {...},
      "inclusionProof": {...}
    }
  ],
  "status": "CONFIRMED"
  // Note: offlineTransfer section is removed
}
```

## Key Differences from Submit-Now Pattern

### Offline Transfer (Pattern A) - DEFAULT
- **Two-step process**: send-token → transfer file → receive-token
- **No network required for sender**: Transfer package created offline
- **Recipient submits**: Recipient completes the transfer when ready
- **Status flow**: Original (CONFIRMED) → Transfer (PENDING) → Final (CONFIRMED)
- **Use cases**: Mobile wallets, intermittent connectivity, asynchronous transfers

### Submit Now (Pattern B) - `--submit-now`
- **One-step process**: send-token submits directly to network
- **Network required for sender**: Sender must be online
- **Sender completes**: Transfer finalized immediately
- **Status flow**: Original (CONFIRMED) → Final (TRANSFERRED)
- **Use cases**: Real-time transfers, online wallets, instant settlements

## Security Considerations

### What's Included in Transfer Package (Safe)
✅ Token state and genesis data (public)
✅ Transfer commitment (public, signed by sender)
✅ Sender's public key (public)
✅ Recipient address (public)
✅ Salt for recipient predicate (public)
✅ Optional transfer message (public)

### What's NEVER Included (Private)
❌ Sender's private key
❌ Sender's secret phrase
❌ Recipient's private key
❌ Recipient's secret phrase
❌ Nonce values for masked predicates

### Validation Checks

**Send-token sanitization:**
- Removes any private keys from output
- Uses SDK commitment signing (private key never serialized)

**Receive-token validation:**
- Validates commitment structure
- Checks for private key leakage (fails if found)
- Verifies recipient address matches
- Confirms network signatures

## Common Workflows

### 1. Gift Token to Friend
```bash
# You (sender)
npm run send-token -- -f my-nft.txf -r FRIEND_ADDRESS -m "Birthday gift!" --save

# Send file to friend via email/chat

# Friend (recipient)
npm run receive-token -- -f received-file.txf --save
```

### 2. Cross-Wallet Transfer
```bash
# Wallet A export
SECRET="wallet-a-secret" npm run send-token -- \
  -f wallet-a-token.txf \
  -r WALLET_B_ADDRESS \
  --save

# Wallet B import
SECRET="wallet-b-secret" npm run receive-token -- \
  -f transfer.txf \
  -o wallet-b-token.txf
```

### 3. Multi-Step Transfer Chain
```bash
# Alice → Bob
npm run send-token -- -f alice-token.txf -r BOB_ADDR --save

# Bob receives
npm run receive-token -- -f alice-transfer.txf -o bob-token.txf

# Bob → Carol
npm run send-token -- -f bob-token.txf -r CAROL_ADDR --save

# Carol receives
npm run receive-token -- -f bob-transfer.txf -o carol-token.txf
```

## Error Handling

### Sender Errors

**Invalid recipient address:**
```
Error: Invalid address format: not-a-valid-address
```
Solution: Ensure recipient address starts with `UNICITY://` and is properly formatted

**File not found:**
```
Error: Token file not found: missing-token.txf
```
Solution: Verify the token file path is correct

### Recipient Errors

**Wrong secret:**
```
❌ Error: Address mismatch!
  Expected: UNICITY://abc123...
  Your address: UNICITY://def456...
```
Solution: Use the correct secret for the recipient address

**Already submitted:**
```
ℹ Transfer already submitted (continuing...)
```
This is normal if running receive-token multiple times. The command continues and completes successfully.

**Network timeout:**
```
Timeout waiting for inclusion proof after 30000ms
```
Solution: Check network connectivity and try again

## Best Practices

### For Senders
1. **Verify recipient address** before creating transfer
2. **Keep original token** until recipient confirms receipt
3. **Use meaningful messages** to help recipient identify transfers
4. **Choose correct network** (test vs production)
5. **Secure file transmission** using trusted channels

### For Recipients
1. **Validate sender** before accepting tokens
2. **Use correct secret** matching your recipient address
3. **Backup received tokens** immediately after confirmation
4. **Verify token details** (ID, type, data) match expectations
5. **Check network** matches sender's network (test/production)

## Troubleshooting

### Transfer package validation fails
1. Check file integrity (not corrupted during transmission)
2. Verify it's an offline transfer package (has `offlineTransfer` section)
3. Ensure TXF version is 2.0

### Address verification fails
1. Confirm you're using the recipient secret (not sender's)
2. Verify the sender used your correct address
3. Check that salt matches between send and receive

### Network submission fails
1. Test network connectivity: `curl https://gateway.unicity.network`
2. Try with `--local` flag for testing
3. Check aggregator logs for detailed errors

## Related Documentation

- **SEND_TOKEN_GUIDE.md** - Detailed send-token command documentation
- **RECEIVE_TOKEN_GUIDE.md** - Detailed receive-token command documentation
- **CLAUDE.md** - Overall architecture and patterns
- **src/types/extended-txf.ts** - TXF format specifications

## Quick Reference

### Sender Checklist
- [ ] Have token file
- [ ] Know recipient address
- [ ] Choose network (production/test/local)
- [ ] Run send-token with --save
- [ ] Send transfer package file to recipient
- [ ] Wait for recipient confirmation

### Recipient Checklist
- [ ] Receive transfer package file
- [ ] Have recipient secret ready
- [ ] Verify sender is trusted
- [ ] Run receive-token with --save
- [ ] Verify token received successfully
- [ ] Backup token file
- [ ] Notify sender of successful receipt
