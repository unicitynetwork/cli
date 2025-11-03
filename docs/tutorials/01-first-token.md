# Tutorial 1: Your First Token (Beginner - 15 minutes)

## Welcome!

In this tutorial, you'll learn the fundamentals of the Unicity CLI by creating and verifying your first token. No previous experience needed - we'll walk through every step.

## Learning Objectives

By the end of this tutorial, you'll be able to:
- Set up the Unicity CLI on your computer
- Generate a cryptographic address (your wallet)
- Mint your first token (create it on the network)
- Verify your token is valid
- Understand the basic token lifecycle

## Prerequisites

Before starting, check you have:

- **Node.js 18+** ([Download here](https://nodejs.org))
- **Terminal access** (Command Prompt, PowerShell, Terminal, or bash)
- **Internet connection** (for installation and network operations)
- **15 minutes** of focused time

### Verify Your System

Run these commands to confirm your setup:

```bash
node --version    # Should show v18.0.0 or higher
npm --version     # Should show 8.0.0 or higher
```

If both show versions, you're ready! If not, install Node.js from the link above.

---

## Part 1: Installation (2 minutes)

### Step 1a: Clone the Repository

Open your terminal and run:

```bash
git clone https://github.com/unicitynetwork/cli.git
cd cli
```

**What's happening?**
- `git clone` downloads the Unicity CLI code to your computer
- `cd cli` moves you into the project directory

### Step 1b: Install Dependencies

```bash
npm install
```

This downloads all the packages the CLI needs to run. You'll see lots of text - this is normal! It takes 30-60 seconds.

### Step 1c: Build the Project

```bash
npm run build
```

This converts TypeScript code into JavaScript that your computer can run.

### Step 1d: Verify Installation

```bash
npm run gen-address -- --help
```

**Expected output** (you should see command options):
```
Usage: gen-address [options]

Generate a new address to receive tokens

Options:
  -n, --nonce <nonce>      Nonce for masked predicate
  -u, --unmasked           Use unmasked predicate (reusable address)
  --preset <preset>        Token type preset (uct, nft, usdu, etc.)
  --token-type <type>      Custom 64-character hex token type
  -e, --endpoint <url>     Custom aggregator endpoint
  -h, --help               Display help for command
```

**Congratulations!** Your installation is complete!

---

## Part 2: Generate Your First Address (3 minutes)

Every wallet needs an address to own tokens. Let's create yours.

### Step 2: Run the Command

Choose a secret (password) - something only you know. For this tutorial, we'll use `learning-secret-123`, but you can use any phrase.

```bash
SECRET="learning-secret-123" npm run gen-address
```

**Important**: Replace `learning-secret-123` with your own secret. Make it something memorable!

### Expected Output

You should see something like this:

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

### What Just Happened?

1. **Your Secret**: You provided a secret (password) that only you know
2. **Your Public Key**: The system derived a unique public key from your secret
3. **Your Address**: Created an address where you can receive tokens
4. **Unmasked Type**: This is a "reusable" address - you can receive multiple tokens here

### Save This Information

Write down or copy the **address** somewhere safe. You'll use it in the next step:

```
DIRECT://00004059268bb18c04e6544493195cee9a2e7043f73cf542d15ecbef31647e65c6e98acebf8f
```

**Pro tip**: This address is safe to share publicly - it's like your email address. BUT never share your secret!

---

## Part 3: Mint Your First Token (4 minutes)

Now let's create a token! "Minting" means creating a new token and claiming ownership.

### Step 3a: Mint the Token

Using the same secret as Step 2, run:

```bash
SECRET="learning-secret-123" npm run mint-token -- \
  -d '{"name":"My First Token","created":"2025-11-02","lesson":"Tutorial 1"}'
```

Replace `learning-secret-123` with the secret you used in Step 2.

### Expected Output

The command will show progress and then create a file:

```
Minting token...
✓ Token minted successfully
✓ Waiting for blockchain confirmation...
✓ Token confirmed and saved

Token saved to: 20251102_153045_1730558622_00004059.txf
```

**What just happened?**

1. **Token Created**: A unique token was generated with your metadata
2. **Blockchain Submission**: The token was submitted to the Unicity Network
3. **Confirmation**: The network verified it's valid and unique
4. **File Saved**: Your token was saved as a `.txf` file (Token eXchange Format)

### Step 3b: Find Your Token File

Look for the file that was created. It will look like:
```
20251102_153045_1730558622_00004059.txf
```

Run this command to see it:

```bash
ls -1 *.txf
```

**What you'll see:**
```
20251102_153045_1730558622_00004059.txf
```

Save the exact filename - you'll need it for the next step!

---

## Part 4: Verify Your Token (2 minutes)

Let's make sure your token is valid and see its details.

### Step 4: Run Verify Command

```bash
npm run verify-token -- -f 20251102_*.txf
```

Replace `20251102_*.txf` with your actual token filename.

### Expected Output

```
=== Token Verification ===
File: 20251102_153045_1730558622_00004059.txf

=== Basic Information ===
✅ Token loaded successfully with SDK
Token ID: eaf0f2acbc090fcfef0d08ad1ddbd0016d2777a1b68e2d101824cdcf3738ff86
Token Type: 455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89

State Data (decoded):
{"name":"My First Token","created":"2025-11-02","lesson":"Tutorial 1"}

=== Verification Summary ===
✓ File format: TXF v2.0
✓ Has genesis: true
✓ Has state: true
✓ Has predicate: true
✓ SDK compatible: Yes
```

### What to Look For

- ✅ **"Token loaded successfully with SDK"** = Your token is valid!
- **State Data** shows your JSON metadata
- **SDK compatible: Yes** means it's ready to use

---

## Understanding What You Created

### The Secret

Your secret is like a password:
- Generates your unique address
- Proves you own the token
- **MUST be kept secret** - never share it!
- If you lose it, you lose access to your tokens

### The Address

Your address (the `DIRECT://...` string):
- Your wallet identifier
- Safe to share publicly
- Always generated from your secret
- Same secret = same address

### The Token File

The `.txf` file is your token:
- JSON format (you can open it in a text editor)
- Contains ownership proof
- Can be transferred to others
- Keep backups of important tokens!

### The Token ID

The Token ID (`eaf0f2acbc...`):
- Unique identifier for this token
- Never changes
- Used to verify token authenticity
- Derived from your metadata and secret

---

## Common Mistakes & How to Fix Them

### "Command not found"

**Problem**: You get `npm: command not found` or similar

**Solution**:
1. Make sure you're in the `cli` directory (`cd cli`)
2. Run `npm install` again
3. Run `npm run build` again

### "Secret not recognized"

**Problem**: You use a different secret than you used before

**Solution**:
- Write down your secret somewhere safe
- **Important**: Same secret ALWAYS generates same address
- If you use a different secret, you get a different address

### "Token file not found"

**Problem**: `verify-token` can't find your `.txf` file

**Solution**:
1. Run `ls -1 *.txf` to see what files exist
2. Use the exact filename in the command
3. Make sure you're in the same directory as the token file

### "Timeout waiting for inclusion proof"

**Problem**: Network is taking too long to respond

**Solution**:
1. Check your internet connection
2. The network might be busy - wait a moment and try again
3. Make sure you didn't interrupt the command

---

## Next Steps

Congratulations! You've completed the basics. Here's what to explore next:

### Try Different Token Types

```bash
# Mint an NFT
SECRET="learning-secret-123" npm run mint-token -- \
  --preset nft \
  -d '{"name":"My NFT","edition":"1 of 10"}'

# Mint USDU stablecoin
SECRET="learning-secret-123" npm run mint-token -- \
  --preset usdu \
  -d '{"amount":"100.00","description":"USD equivalent"}'
```

### Learn About Masked Addresses (Advanced)

A "masked" address is unique to each token - more private:

```bash
SECRET="learning-secret-123" npm run gen-address -- \
  -n "unique-nonce-for-privacy"
```

### Ready for Transfers?

Check out **Tutorial 2: Token Transfers** to learn how to send tokens to others!

---

## Summary

You've learned:

1. ✅ How to install Unicity CLI
2. ✅ How to generate a cryptographic address
3. ✅ How to mint a token
4. ✅ How to verify a token is valid

## Key Concepts You Now Know

| Concept | What It Does |
|---------|-------------|
| **Secret** | Your private password (KEEP IT SAFE!) |
| **Address** | Your wallet ID (safe to share) |
| **Token** | A digital asset you own |
| **.txf File** | The token stored in a portable format |
| **Mint** | Create a new token |
| **Verify** | Check if a token is real and valid |

---

## Keep Learning

- **Tutorial 2**: Learn how to send tokens to other people
- **Tutorial 3**: Advanced operations like custom token types
- **Tutorial 4**: Deep dive into how tokens work internally
- **Tutorial 5**: Production best practices and security

---

## Quick Reference

Save these commands for future use:

```bash
# Generate address
SECRET="your-secret" npm run gen-address

# Mint token
SECRET="your-secret" npm run mint-token -- -d '{"name":"Token"}'

# Verify token
npm run verify-token -- -f token.txf

# List all token files
ls -1 *.txf
```

---

## You're Done!

You've successfully completed your first Unicity CLI tutorial. You now understand the fundamental concepts and can create tokens independently.

**What's next?** Move to Tutorial 2 to learn how to transfer tokens to other people!

**Questions?** Check the [GLOSSARY.md](../glossary.md) for term definitions or [TROUBLESHOOTING.md](../troubleshooting.md) for common issues.

---

*Happy minting!*
