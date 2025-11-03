# Getting Started with Unicity CLI

Welcome to Unicity CLI! In the next 15 minutes, you'll learn how to create and transfer offchain tokens on the Unicity Network.

## What You'll Learn

By the end of this guide, you'll be able to:
- Generate addresses to receive tokens
- Mint your first token
- Verify token validity
- Send tokens to other addresses
- Receive tokens from others

## Prerequisites

Before starting, ensure you have:

- **Node.js 18+** installed ([Download here](https://nodejs.org/))
- **Terminal access** (Command Prompt, PowerShell, Terminal, or bash)
- **15 minutes** of focused time
- **Internet connection** (for installation and network operations)

### Verify Your Setup

```bash
# Check Node.js version (should be 18.0 or higher)
node --version

# Check npm version (should be 8.0 or higher)
npm --version
```

If these commands work, you're ready to proceed!

---

## Installation (2 minutes)

### Step 1: Clone the Repository

```bash
git clone https://github.com/unicitynetwork/cli.git
cd cli
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Build the Project

```bash
npm run build
```

### Step 4: Verify Installation

```bash
npm run gen-address -- --help
```

If you see the help output, installation was successful!

---

## Your First Token (10 minutes)

### Step 1: Generate Your Address (2 minutes)

Every wallet needs an address to receive tokens. Let's create yours:

```bash
SECRET="my-first-secret-password" npm run gen-address
```

**Important Notes**:
- Replace `my-first-secret-password` with your own secret phrase
- This secret is like a password - **keep it safe and NEVER share it**
- Write it down somewhere secure - you'll need it later

**Expected Output**:
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

**What just happened?**
- Your secret was used to generate a cryptographic address
- This address can receive UCT tokens (default token type)
- The address is "unmasked" (reusable) - you can receive multiple tokens

**Pro Tip**: Save this address somewhere - you'll use it to receive tokens!

---

### Step 2: Mint Your First Token (3 minutes)

Now let's create (mint) your first token. This will belong to YOU:

```bash
SECRET="my-first-secret-password" npm run mint-token -- \
  -d '{"name":"My First Token","created":"2025-11-02","purpose":"learning"}'
```

**What's happening here?**
- `SECRET="..."` - Your secret phrase (same as Step 1)
- `-d` - Token data (metadata) as JSON
- The token is automatically minted to YOUR address

**Expected Output**:
```
Minting token...
✓ Token minted successfully
✓ Waiting for blockchain confirmation...
✓ Token confirmed and saved

Token saved to: 20251102_153045_1730558622_00004059.txf
```

**What just happened?**
- A new token was created with your metadata
- It was submitted to the Unicity Network
- The network confirmed it's valid and unique
- It was saved to a `.txf` file (Token eXchange Format)

**Important**: The `.txf` file IS your token. Keep it safe!

---

### Step 3: Verify Your Token (1 minute)

Let's make sure your token is valid:

```bash
npm run verify-token -- -f 20251102_*.txf
```

**Note**: Replace `20251102_*.txf` with your actual filename from Step 2.

**Expected Output**:
```
=== Token Verification ===
File: 20251102_153045_1730558622_00004059.txf

=== Basic Information ===
✅ Token loaded successfully with SDK
Token ID: eaf0f2acbc090fcfef0d08ad1ddbd0016d2777a1b68e2d101824cdcf3738ff86
Token Type: f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509

State Data (decoded):
{"name":"My First Token","created":"2025-11-02","purpose":"learning"}

=== Verification Summary ===
✓ File format: TXF v2.0
✓ Has genesis: true
✓ Has state: true
✓ Has predicate: true
✓ SDK compatible: Yes
```

**What to look for**:
- ✅ "Token loaded successfully with SDK" - Your token is valid!
- Your metadata is visible in "State Data (decoded)"
- "SDK compatible: Yes" means it's ready to use

**Congratulations!** You've successfully created your first Unicity token!

---

## Transfer Tokens (Optional, 5 minutes)

Want to try sending your token to someone else? Here's how:

### Step 4: Get a Recipient Address

For this example, let's create a second address (pretend it's your friend's):

```bash
SECRET="friend-secret-password" npm run gen-address
```

**Save the address** from the output - you'll send your token here.

Example: `DIRECT://0000280c3d90eee10f445c23c457c8968020b647ae9f...`

---

### Step 5: Send the Token

```bash
SECRET="my-first-secret-password" npm run send-token -- \
  -f 20251102_*.txf \
  -r "DIRECT://0000280c3d90eee10f445c23c457c8968020b647ae9f..." \
  -m "Here's my first token!" \
  --save
```

**Replace**:
- `20251102_*.txf` with your token filename
- `DIRECT://...` with the recipient address from Step 4
- `my-first-secret-password` with your secret

**Expected Output**:
```
=== Send Token - Pattern A (Offline Package) ===
...
✅ Token saved to 20251102_153500_transfer_0000280c3d.txf

💡 Offline transfer package created!
   Send this file to the recipient to complete the transfer.
```

**What just happened?**
- You created a transfer package
- The package contains a signed transfer commitment
- The recipient can now claim the token

---

### Step 6: Receive the Token (as the recipient)

Now pretend you're the recipient. Let's complete the transfer:

```bash
SECRET="friend-secret-password" npm run receive-token -- \
  -f 20251102_*_transfer_*.txf \
  --save
```

**Replace**:
- `20251102_*_transfer_*.txf` with the transfer package filename
- `friend-secret-password` with the recipient's secret

**Expected Output**:
```
=== Receive Token (Offline Transfer) ===
...
✅ Address verified - you are the intended recipient
...
✅ Token saved to 20251102_153600_received_0000280c3d.txf

✅ Token is now in your wallet and ready to use!
```

**Congratulations!** You've completed a full token transfer!

---

## What You've Learned

In the past 15 minutes, you:

1. ✅ Installed Unicity CLI
2. ✅ Generated a cryptographic address
3. ✅ Minted your first token
4. ✅ Verified the token is valid
5. ✅ (Optional) Transferred a token to another address

## Key Concepts

### Secret (Private Key)
- Your secret is like a password for your wallet
- **NEVER share it** with anyone
- Keep it safe - if you lose it, you lose access to your tokens
- Same secret always generates the same address

### Address
- A unique identifier where you receive tokens
- Safe to share publicly
- Format: `DIRECT://...` (64 hex characters)

### Token File (.txf)
- Your token stored in JSON format
- Contains ownership proof and metadata
- Keep backups of important tokens

### Transfer Patterns
- **Pattern A (Offline)**: Create package, send file, recipient claims (what we did)
- **Pattern B (Immediate)**: Submit to network immediately (faster but needs connection)

---

## What's Next?

### Explore Token Types

Try minting different types of tokens:

```bash
# Mint an NFT
SECRET="my-secret" npm run mint-token -- \
  --preset nft \
  -d '{"name":"Cool NFT","edition":1}'

# Mint USDU stablecoin
SECRET="my-secret" npm run mint-token -- \
  --preset usdu \
  -d '{"amount":"100.00","currency":"USD"}'
```

See [MINT_TOKEN_GUIDE.md](MINT_TOKEN_GUIDE.md) for all token types.

### Try Advanced Features

**Masked Addresses (Privacy)**:
```bash
SECRET="my-secret" npm run gen-address -- -n "unique-nonce-1"
```

**Immediate Transfers**:
```bash
SECRET="my-secret" npm run send-token -- \
  -f token.txf \
  -r "DIRECT://..." \
  --submit-now
```

### Learn Common Workflows

- [WORKFLOWS.md](WORKFLOWS.md) - Complete end-to-end workflows
- [TRANSFER_GUIDE.md](TRANSFER_GUIDE.md) - Deep dive on transfers
- [SECURITY.md](SECURITY.md) - Keep your tokens safe

### Read Command Guides

Each command has a detailed guide:

- [gen-address](GEN_ADDRESS_GUIDE.md) - Address generation options
- [mint-token](MINT_TOKEN_GUIDE.md) - All minting options
- [verify-token](VERIFY_TOKEN_GUIDE.md) - Understand token structure
- [send-token](SEND_TOKEN_GUIDE.md) - Transfer patterns explained
- [receive-token](RECEIVE_TOKEN_GUIDE.md) - Claim tokens sent to you

---

## Need Help?

### Common Issues

**"Command not found"**
- Make sure you ran `npm install` and `npm run build`
- Run commands from the `cli` directory

**"Token file not found"**
- Check the filename matches what was output
- Use `ls *.txf` to list all token files

**"Address mismatch"**
- Make sure you're using the correct secret
- The secret must match the recipient address

**"Timeout waiting for inclusion proof"**
- Check your internet connection
- The network might be busy - try again
- Consider using `--local` for testing

### Get More Help

- **Troubleshooting Guide**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **FAQ**: [FAQ.md](FAQ.md)
- **All Commands**: [README.md](README.md)
- **Glossary**: [GLOSSARY.md](GLOSSARY.md) - Understand the terms

### Join the Community

- GitHub Issues: [Report bugs or ask questions](https://github.com/unicitynetwork/cli/issues)
- Unicity Network: [Official website](https://unicity.network)

---

## Quick Reference Card

### Essential Commands

```bash
# Generate address
SECRET="my-secret" npm run gen-address

# Mint token
SECRET="my-secret" npm run mint-token -- -d '{"name":"Token"}'

# Verify token
npm run verify-token -- -f token.txf

# Send token (offline)
SECRET="my-secret" npm run send-token -- -f token.txf -r ADDRESS --save

# Receive token
SECRET="my-secret" npm run receive-token -- -f transfer.txf --save
```

### Important Tips

- ✅ **Always backup** token files
- ✅ **Keep secrets safe** - never share them
- ✅ **Verify tokens** after minting
- ✅ **Double-check addresses** before sending
- ✅ **Test with small tokens first**

---

## Congratulations!

You're now a Unicity CLI user! You know how to:
- Create addresses
- Mint tokens
- Verify tokens
- Transfer tokens

Continue exploring the guides to master advanced features.

**Happy minting!** 🎉
