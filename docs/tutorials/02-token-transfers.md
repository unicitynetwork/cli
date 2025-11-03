# Tutorial 2: Token Transfers (Intermediate - 20 minutes)

## Welcome to Token Transfers!

In Tutorial 1, you created a token for yourself. Now it's time to learn how to transfer tokens to other people. This tutorial covers the complete workflow for offline token transfers.

## Learning Objectives

By the end of this tutorial, you'll understand:
- How to create two separate identities (Alice and Bob)
- The complete offline transfer workflow
- How to send a token from one address to another
- How to receive and claim a token
- What happens to the token file during transfer

## Prerequisites

- Completed **Tutorial 1: Your First Token**
- Understand addresses, tokens, and secrets
- Two different secrets ready (or create them below)

---

## The Scenario

We're going to simulate Alice sending a gift token to Bob:

1. **Alice**: Creates an identity and mints a token
2. **Bob**: Creates his identity
3. **Alice**: Creates a transfer package for Bob
4. **File Transfer**: Alice sends the package file to Bob (simulated)
5. **Bob**: Receives and claims the token
6. **Verification**: Bob owns the token

This mimics real-world scenarios:
- Sending an NFT gift via email
- Transferring tokens to a friend
- Cross-wallet transfers
- Offline token delivery

---

## Part 1: Set Up Two Identities (5 minutes)

### Step 1a: Alice's Identity

Alice will mint a token. Let's create her secret:

```bash
SECRET="alice-secret-phrase-keep-this-safe" npm run gen-address
```

**Expected output**:
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

**Save Alice's address**:
```
DIRECT://00004059268bb18c04e6544493195cee9a2e7043f73cf542d15ecbef31647e65c6e98acebf8f
```

### Step 1b: Bob's Identity

Now create Bob's identity with a different secret:

```bash
SECRET="bob-secret-different-phrase" npm run gen-address
```

**Expected output** (different address):
```json
{
  "type": "unmasked",
  "address": "DIRECT://0000280c3d90eee10f445c23c457c8968020b647ae9f7a4532e9a1f2c3d4e5f",
  "tokenType": "455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89",
  "tokenTypeInfo": {
    "preset": "uct",
    "name": "unicity",
    "description": "Unicity testnet native coin (UCT)"
  }
}
```

**Save Bob's address**:
```
DIRECT://0000280c3d90eee10f445c23c457c8968020b647ae9f7a4532e9a1f2c3d4e5f
```

### What Just Happened?

- **Alice** has a secret: `alice-secret-phrase-keep-this-safe`
- **Alice** has an address: `DIRECT://00004059...` (for receiving tokens)
- **Bob** has a secret: `bob-secret-different-phrase`
- **Bob** has an address: `DIRECT://0000280c...` (for receiving tokens)

Each secret produces a unique address. They're separate identities with no connection to each other.

---

## Part 2: Alice Mints a Token (3 minutes)

Alice creates a token she wants to send to Bob.

### Step 2a: Mint the Token

Using Alice's secret:

```bash
SECRET="alice-secret-phrase-keep-this-safe" npm run mint-token -- \
  -d '{"name":"Birthday Gift NFT","from":"Alice","to":"Bob","message":"Happy Birthday!"}'
```

**Expected output**:
```
Minting token...
✓ Token minted successfully
✓ Waiting for blockchain confirmation...
✓ Token confirmed and saved

Token saved to: 20251102_153045_1730558622_alice_token.txf
```

### Step 2b: Find the Token File

```bash
ls -1 alice_*.txf
```

or if it has the timestamp pattern:

```bash
ls -1 *_1730558622_*.txf
```

**Save the filename**: You'll use it in the next step.

### What Alice Now Has

- **Token File**: Contains the token she just created
- **Ownership**: Only Alice (with her secret) can spend or send this token
- **Content**: Birthday gift message and metadata

---

## Part 3: Alice Creates Transfer Package (4 minutes)

Now Alice creates a transfer package that Bob can receive and claim.

### Step 3a: Create the Transfer Package

Alice runs `send-token` with:
- Her token file
- Bob's address
- Optional message
- The `--save` flag to create a file

**Command**:

```bash
SECRET="alice-secret-phrase-keep-this-safe" npm run send-token -- \
  -f 20251102_153045_1730558622_alice_token.txf \
  -r "DIRECT://0000280c3d90eee10f445c23c457c8968020b647ae9f7a4532e9a1f2c3d4e5f" \
  -m "Happy Birthday Bob! Here's a gift token for you!" \
  --save
```

**Replace**:
- `20251102_153045_1730558622_alice_token.txf` with your actual token filename
- `DIRECT://0000280c3d9...` with Bob's actual address

### Expected Output

```
=== Send Token - Pattern A (Offline Package) ===

Step 1: Loading token from file...
  ✓ Token loaded: abc123def456...
  Token Type: 455ad8720656b08e8dbd5bac...

Step 2: Parsing recipient address...
  ✓ Recipient: DIRECT://0000280c3d90eee10f...

Step 3: Getting sender secret...
  ✓ Signing service created
  Public Key: 03a1b2c3d4e5f6...

Step 4: Generating transfer salt...
  ✓ Salt: 9876543210fedcba...

Step 5: Processing transfer message...
  ✓ Message: "Happy Birthday Bob!..."

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

✅ Token saved to 20251102_153500_transfer_0000280c3d.txf

=== Transfer Complete ===
Token ID: abc123def456abc123def456abc123def456abc123def456abc123def456ab
Recipient: DIRECT://0000280c3d90eee10f445c23c457c8968020b647ae9f7a4532e9a1f
Status: PENDING

💡 Offline transfer package created!
   Send this file to the recipient to complete the transfer.
```

### Step 3b: Find the Transfer Package File

```bash
ls -1 *_transfer_*.txf
```

**The new file** (example): `20251102_153500_transfer_0000280c3d.txf`

### What Just Happened?

1. **Transfer Commitment**: Alice signed a commitment to send the token to Bob
2. **Transfer Package**: The system created a file with:
   - The original token
   - Alice's signature (proof she authorized the transfer)
   - Bob's address (who can claim it)
   - A message for Bob
3. **Status Changed**: The token status is now `PENDING` (waiting for Bob to claim it)
4. **No Network Submission Yet**: Alice just created the package - Bob will submit it to the network

### Important Security Note

The transfer package file contains:
- ✅ Token data (public)
- ✅ Transfer commitment (public, signed by Alice)
- ✅ Alice's public key (public)
- ✅ Bob's address (public)

The file does NOT contain:
- ❌ Alice's secret (private - kept safe)
- ❌ Bob's secret (private - not needed for transfer)

Safe to send via email, shared drive, or any channel!

---

## Part 4: Simulate File Transfer (1 minute)

In the real world, Alice would send the transfer package file to Bob via:
- Email attachment
- File sharing service (Google Drive, Dropbox, etc.)
- QR code
- Bluetooth/NFC (mobile wallets)
- USB drive

**For this tutorial**, we simulate this by keeping the file in the same directory. Bob will use it in the next step.

---

## Part 5: Bob Receives the Token (4 minutes)

Now it's Bob's turn. He has the transfer package file and his secret.

### Step 5a: Prepare Bob's Information

Bob needs:
1. **His secret**: `bob-secret-different-phrase`
2. **His address**: `DIRECT://0000280c3d90eee10f445c23c457c8968020b647ae9f7a4532e9a1f2c3d4e5f` (must match what Alice used)
3. **Transfer file**: `20251102_153500_transfer_0000280c3d.txf` (Alice sent this)

### Step 5b: Receive and Claim the Token

Bob runs:

```bash
SECRET="bob-secret-different-phrase" npm run receive-token -- \
  -f 20251102_153500_transfer_0000280c3d.txf \
  --save
```

Replace:
- `bob-secret-different-phrase` with Bob's actual secret
- `20251102_153500_transfer_0000280c3d.txf` with the actual transfer filename

### Expected Output

```
=== Receive Token (Offline Transfer) ===

Step 1: Loading extended TXF file...
  ✓ File loaded: 20251102_153500_transfer_0000280c3d.txf

Step 2: Validating offline transfer package...
  ✓ Offline transfer package validated
  Sender: DIRECT://00004059268bb18c04e6544493195cee9a2e7043f73cf542d15ecbef31647e65c6e98acebf8f
  Recipient: DIRECT://0000280c3d90eee10f445c23c457c8968020b647ae9f7a4532e9a1f2c3d4e5f
  Network: production
  Message: "Happy Birthday Bob! Here's a gift token for you!"

Step 3: Getting recipient secret...
  ✓ Signing service created
  Public Key: 02b1c2d3e4f5a6...

Step 4: Parsing transfer commitment...
  ✓ Transfer commitment parsed
  Request ID: abc123def456...

Step 5: Loading token data...
  ✓ Token loaded
  Token ID: abc123def456...
  Token Type: 455ad8720656b08e8dbd5bac...

Step 6: Creating recipient predicate and verifying address...
  Salt: 9876543210fedcba...
  ✓ Recipient predicate created
  Recipient Address: DIRECT://0000280c3d90eee10f445c23c457c8968020b647ae9f7a4532e9a1f2c3d4e5f
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

✅ Token saved to 20251102_153600_received_0000280c3d.txf

=== Transfer Received Successfully ===
Token ID: abc123def456abc123def456abc123def456abc123def456abc123def456ab
Your Address: DIRECT://0000280c3d90eee10f445c23c457c8968020b647ae9f7a4532e9a1f2c3d4e5f
Status: CONFIRMED
Transactions: 1

✅ Token is now in your wallet and ready to use!
```

### What Just Happened?

1. **Validation**: Bob's system verified the transfer package is real and for him
2. **Network Submission**: The transfer was submitted to the Unicity Network
3. **Confirmation**: The network confirmed the transfer is valid
4. **Ownership Update**: The token now shows Bob as the owner
5. **New File**: A new token file was created showing Bob's ownership
6. **Status**: Changed from `PENDING` to `CONFIRMED`

---

## Part 6: Verify Final Ownership (2 minutes)

Let's verify that Bob now owns the token.

### Step 6a: Bob Verifies His Token

Bob runs:

```bash
npm run verify-token -- -f 20251102_153600_received_*.txf
```

### Expected Output

```
=== Token Verification ===
File: 20251102_153600_received_0000280c3d.txf

=== Basic Information ===
✅ Token loaded successfully with SDK
Token ID: abc123def456abc123def456abc123def456abc123def456abc123def456ab
Token Type: 455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89

State Data (decoded):
{"name":"Birthday Gift NFT","from":"Alice","to":"Bob","message":"Happy Birthday!"}

=== Verification Summary ===
✓ File format: TXF v2.0
✓ Has genesis: true
✓ Has state: true
✓ Has predicate: true
✓ SDK compatible: Yes
```

### What This Tells Us

- ✅ Bob's token file is valid
- The token contains the original data (Alice's gift message)
- Bob is now the legal owner (predicate shows his address)
- The token has been confirmed on the network

---

## Understanding the Transfer Flow

Here's what happened step-by-step:

```
ALICE                           FILE TRANSFER                    BOB
│                                                                 │
├─ Secret: alice-secret-phrase                                  │
├─ Address: DIRECT://00004059...                                │
│                                                                 │
│ 1. Mint token                                                  │
├─ Create: birthday-token.txf                                   │
│                                                                 │
│ 2. Create transfer package                                     │
├─ Sign with her secret                                         │
├─ Specify Bob's address                                        │
├─ Create: transfer_0000280c.txf                                │
│                                                                 │
├──────────── Send transfer file ──────────────────────────────>│
│                                                                 │
│                                              3. Receive token  │
│                                              ├─ Secret: bob-secret-different
│                                              ├─ Address: DIRECT://0000280c...
│                                              │
│                                              4. Validate transfer
│                                              ├─ Check signature
│                                              ├─ Verify address matches
│                                              │
│                                              5. Submit to network
│                                              ├─ Send commitment
│                                              ├─ Wait for proof
│                                              │
│                                              6. Update ownership
│                                              ├─ Change predicate to Bob's
│                                              ├─ Create: received_0000280c.txf
│                                              │
```

---

## Key Concepts: The Transfer Lifecycle

### Token Evolution

**Original Token (Alice's)**:
- Owner: Alice
- Status: CONFIRMED
- Contains: Birthday gift metadata

**Transfer Package (In Transit)**:
- Owner: Alice (unchanged)
- Status: PENDING (awaiting Bob's action)
- Extra data: Transfer commitment, Bob's address, message

**Final Token (Bob's)**:
- Owner: Bob (changed!)
- Status: CONFIRMED (finalized on network)
- Contains: Original birthday gift metadata
- History: Transaction showing transfer from Alice

### What Didn't Change

- **Token ID**: Same token (Alice's birthday gift)
- **Token Data**: Same metadata (name, message, etc.)
- **Genesis**: Same origin (when Alice created it)

### What Changed

- **Predicate**: Now shows Bob as owner (not Alice)
- **Owner's Address**: Now Bob's address (not Alice's)
- **Transactions**: Added transfer transaction
- **Status**: PENDING → CONFIRMED

---

## Transfer Pattern Explained

The transfer pattern we used is **Pattern A: Offline Transfer**.

### Why Pattern A?

- **Asynchronous**: Bob doesn't have to be online when Alice creates the transfer
- **Flexible**: Works with any file transfer method
- **Secure**: Alice's secret never leaves her computer
- **Reversible**: Alice keeps the original token until Bob claims it

### When to Use Pattern A

- Sending gifts via email
- Cross-device transfers
- Intermittent connectivity
- Batch transfers
- Mobile wallet scenarios

### Pattern B (Immediate)

There's also Pattern B (`--submit-now`) for immediate transfers:

```bash
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "BOB_ADDRESS" \
  --submit-now
```

Pattern B is faster but requires Alice to be online and online the whole time.

---

## Common Mistakes & Troubleshooting

### "Address mismatch" Error

**Problem**: Bob gets error: `Address mismatch! Expected: ... Got: ...`

**Cause**: Bob is using the wrong secret

**Solution**:
1. Verify Bob's secret is correct
2. Re-generate Bob's address with the correct secret
3. Ask Alice to send a new transfer package to the correct address

### "File not found"

**Problem**: Can't find the transfer file

**Solution**:
1. Check the filename matches what Alice sent
2. Make sure file is in the current directory
3. Run `ls -1 *transfer*.txf` to list all transfer files

### "Network timeout"

**Problem**: Network takes too long to respond

**Solution**:
1. Check internet connection
2. Wait a moment and try again
3. Network might be busy - retry in 30 seconds

### "Token already received"

**Problem**: Running receive-token multiple times

**Solution**: This is normal! The command checks if already received:
- If already submitted, continues and completes successfully
- You can run it multiple times safely
- Final result is the same

---

## Practice Exercise

Try this on your own:

1. Create a third identity (Carol) with a new secret
2. Bob sends his received token to Carol
3. Carol receives and verifies the token
4. Verify the token now belongs to Carol

**Hint**: Use Bob's secret to send the token, and Carol's address as recipient.

---

## What's Next?

You now understand:
- ✅ How to set up multiple identities
- ✅ How to mint tokens
- ✅ How to create transfer packages
- ✅ How to receive and claim tokens
- ✅ Complete offline transfer workflow

### Next Steps

- **Tutorial 3**: Learn advanced operations like custom token types
- **Tutorial 4**: Deep dive into token internals (TXF structure, predicates)
- **Tutorial 5**: Production best practices and security

---

## Quick Reference: The Complete Workflow

```bash
# ===== ALICE =====
# 1. Create address
SECRET="alice-secret-phrase-keep-this-safe" npm run gen-address

# 2. Mint token
SECRET="alice-secret-phrase-keep-this-safe" npm run mint-token -- \
  -d '{"gift":"for Bob"}'

# 3. Create transfer package
SECRET="alice-secret-phrase-keep-this-safe" npm run send-token -- \
  -f token.txf \
  -r "BOB_ADDRESS" \
  --save

# (Send file to Bob)

# ===== BOB =====
# 1. Create address
SECRET="bob-secret-different-phrase" npm run gen-address

# 2. Receive token
SECRET="bob-secret-different-phrase" npm run receive-token -- \
  -f transfer_file.txf \
  --save

# 3. Verify ownership
npm run verify-token -- -f received_file.txf
```

---

## Summary

You've completed the token transfer workflow! You now understand:

| Step | Action | Who | Result |
|------|--------|-----|--------|
| 1 | Create identity | Alice & Bob | Each has secret + address |
| 2 | Mint token | Alice | Token created, Alice owns it |
| 3 | Create transfer | Alice | Transfer package created (PENDING) |
| 4 | Send file | Alice → Bob | File transferred (offline) |
| 5 | Receive token | Bob | Token claimed on network |
| 6 | Verify | Bob | Bob now owns token (CONFIRMED) |

---

## Congratulations!

You've successfully completed a token transfer! You understand both sides of the transaction and how tokens move between wallets.

**Next up**: Tutorial 3 covers advanced operations and different token types!

---

*Happy transferring!*
