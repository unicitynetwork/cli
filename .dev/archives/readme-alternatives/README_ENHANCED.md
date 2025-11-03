# Unicity CLI

Command-line tools for interacting with the Unicity Network's offchain token system.

## What is Unicity CLI?

The Unicity CLI is a command-line toolkit for creating and managing **offchain tokens** on the Unicity Network. Unlike traditional blockchain tokens, Unicity tokens exist offchain with cryptographic proofs that ensure security and prevent double-spending.

**Key Features**:
- ✅ Create tokens without gas fees
- ✅ Transfer tokens offline (no network required)
- ✅ Cryptographic ownership proofs
- ✅ Mobile wallet compatible
- ✅ Privacy-preserving options (masked/unmasked predicates)
- ✅ SDK-compliant token files (`.txf` format)

**Use Cases**:
- NFT creation and transfer
- Stablecoin transactions (USDU, EURU)
- Cross-wallet token portability
- Offline payments and receipts
- Invoice generation with unique addresses

## Prerequisites

Before installing, ensure you have:

- **Node.js**: Version 18.0 or higher ([Download](https://nodejs.org/))
- **npm**: Usually comes with Node.js (version 8.0+)
- **Terminal**: Command line access (bash, zsh, PowerShell, Command Prompt)
- **Network**: Internet connection for installation and network operations

**Check your installation**:
```bash
node --version  # Should show v18.0 or higher
npm --version   # Should show 8.0 or higher
```

## Installation

```bash
# Clone the repository
git clone https://github.com/unicitynetwork/cli.git
cd cli

# Install dependencies
npm install

# Build the project
npm run build
```

**Verify installation**:
```bash
npm run gen-address -- --help
```

If you see the help output, you're ready to go!

## Quick Start

### Your First Token (5 minutes)

```bash
# 1. Generate your address
SECRET="my-secret-password" npm run gen-address

# 2. Mint a token to your address
SECRET="my-secret-password" npm run mint-token -- \
  -d '{"name":"My First NFT","description":"Created with Unicity CLI"}'

# 3. Verify it worked
npm run verify-token -- -f 20251102_*.txf
```

**That's it!** You now have your first Unicity token.

**New to Unicity?** Follow our step-by-step guide: [GETTING_STARTED.md](GETTING_STARTED.md)

## Common Workflows

### Generate an Address
```bash
SECRET="your-secret" npm run gen-address

# With specific token type
SECRET="your-secret" npm run gen-address -- --preset nft

# Masked address (single-use, more private)
SECRET="your-secret" npm run gen-address -- -n "unique-nonce-1"
```

**Learn more**: [GEN_ADDRESS_GUIDE.md](GEN_ADDRESS_GUIDE.md)

---

### Mint a Token
```bash
# Mint NFT (self-mint to your address)
SECRET="your-secret" npm run mint-token -- \
  --preset nft \
  -d '{"name":"My NFT","edition":1}'

# Mint stablecoin
SECRET="your-secret" npm run mint-token -- \
  --preset usdu \
  -d '{"amount":"100.00","currency":"USD"}'

# With custom token type
SECRET="your-secret" npm run mint-token -- \
  -y "MyTokenType" \
  -d '{"custom":"data"}'
```

**Learn more**: [MINT_TOKEN_GUIDE.md](MINT_TOKEN_GUIDE.md)

---

### Transfer a Token

**Pattern A: Offline Transfer** (default - recommended)
```bash
# Sender creates transfer package
SECRET="sender-secret" npm run send-token -- \
  -f my-token.txf \
  -r "DIRECT://recipient-address..." \
  -m "Payment for services" \
  --save

# Send the .txf file to recipient (email, QR, NFC, etc.)

# Recipient completes transfer
SECRET="recipient-secret" npm run receive-token -- \
  -f transfer-package.txf \
  --save
```

**Pattern B: Immediate Network Submission**
```bash
# Submit to network immediately
SECRET="sender-secret" npm run send-token -- \
  -f my-token.txf \
  -r "DIRECT://recipient-address..." \
  --submit-now \
  --save
```

**Learn more**: [TRANSFER_GUIDE.md](TRANSFER_GUIDE.md), [OFFLINE_TRANSFER_WORKFLOW.md](OFFLINE_TRANSFER_WORKFLOW.md)

---

### Verify a Token
```bash
npm run verify-token -- -f token.txf
```

Shows comprehensive information including:
- Token data (decoded as JSON/UTF-8)
- Public key and signature (from predicate)
- Inclusion proof
- SDK compatibility
- Transaction history

**Learn more**: [VERIFY_TOKEN_GUIDE.md](VERIFY_TOKEN_GUIDE.md)

---

## Available Commands

| Command | Description | Guide |
|---------|-------------|-------|
| `gen-address` | Generate addresses from secrets | [GEN_ADDRESS_GUIDE.md](GEN_ADDRESS_GUIDE.md) |
| `mint-token` | Create new tokens (self-mint to your address) | [MINT_TOKEN_GUIDE.md](MINT_TOKEN_GUIDE.md) |
| `send-token` | Send tokens to recipients (offline or immediate) | [SEND_TOKEN_GUIDE.md](SEND_TOKEN_GUIDE.md) |
| `receive-token` | Complete offline token transfers | [RECEIVE_TOKEN_GUIDE.md](RECEIVE_TOKEN_GUIDE.md) |
| `verify-token` | Verify and inspect token files | [VERIFY_TOKEN_GUIDE.md](VERIFY_TOKEN_GUIDE.md) |

### Low-Level Commands

| Command | Description |
|---------|-------------|
| `get-request` | Get inclusion proofs for requests |
| `register-request` | Register state transitions |

**Transfer Workflow**: See [TRANSFER_GUIDE.md](TRANSFER_GUIDE.md) for complete transfer patterns

## Architecture

```
┌─────────────────┐
│  Unicity CLI    │  Command Line Interface
│  (This Project) │  User-friendly commands
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Unicity SDK    │  TypeScript SDK
│  v1.6.0-rc      │  @unicitylabs/state-transition-sdk
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Aggregator     │  Network Gateway
│  Gateway        │  gateway.unicity.network
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Unicity        │  Blockchain Network
│  Network        │  Distributed validators
└─────────────────┘
```

**Components**:
- **CLI**: User interface (this project)
- **SDK**: Core token operations and cryptography
- **Aggregator**: Collects state transitions and creates Merkle trees
- **Network**: Validates and commits state transition proofs

**Learn more**: [CLAUDE.md](CLAUDE.md)

## Key Features

### Self-Mint Pattern

The mint-token command uses a **self-mint pattern** where:
- You provide a secret (password/private key)
- Command derives your public key and address
- Token is minted directly to your address
- You have immediate ownership with full control

No need to generate address separately - it's automatic!

### SDK-Compliant TXF Files

All generated tokens use:
- ✅ Proper CBOR predicate encoding (187 bytes)
- ✅ Full SDK compatibility with `Token.fromJSON()`
- ✅ Public key and signature embedded in predicate
- ✅ Ready for transfer and other SDK operations

### Masked vs Unmasked Predicates

**Unmasked** (default for mint, reusable):
- Same address for multiple tokens
- Simpler to use (only need secret)
- More convenient
- Command: Omit `-n, --nonce` option

**Masked** (single-use, more private):
- Unique address per token
- Requires secret + nonce
- Enhanced privacy
- Command: Use `-n, --nonce` option

**Learn more**: [GEN_ADDRESS_GUIDE.md#address-types](GEN_ADDRESS_GUIDE.md)

### Preset Token Types

Official Unicity token types:

| Preset | Name | Description |
|--------|------|-------------|
| `uct` (default) | Unicity Coin | Native testnet coin (UCT) |
| `alpha` | Unicity Coin | Alias for `uct` |
| `nft` | Unicity NFT | NFT token type |
| `usdu` | Unicity USD | USD stablecoin |
| `euru` | Unicity EUR | EUR stablecoin |

**Usage**: `--preset nft` or `--preset usdu`

**Learn more**: [GEN_ADDRESS_GUIDE.md#preset-token-types](GEN_ADDRESS_GUIDE.md), [MINT_TOKEN_GUIDE.md](MINT_TOKEN_GUIDE.md)

## Development

For development and testing:

```bash
npm run dev -- <command> <args>
```

Examples:
```bash
# Development mode with TypeScript
npm run dev -- gen-address --preset nft

# Test with local aggregator
npm run mint-token -- -d '{"test":true}' --local

# Production mode (after build)
npm run start -- gen-address
```

## Security Best Practices

**NEVER**:
- ❌ Share your secret/password
- ❌ Commit secrets to version control
- ❌ Store secrets in plain text files
- ❌ Use the same secret across systems

**ALWAYS**:
- ✅ Use strong, unique secrets
- ✅ Store secrets in password managers
- ✅ Backup token files securely
- ✅ Verify tokens after minting
- ✅ Double-check addresses before sending

**Learn more**: [SECURITY.md](SECURITY.md)

## Documentation

### Getting Started
- [GETTING_STARTED.md](GETTING_STARTED.md) - Your first 15 minutes with Unicity CLI
- [GLOSSARY.md](GLOSSARY.md) - Complete terminology reference
- [FAQ.md](FAQ.md) - Frequently asked questions

### Command Guides
- [GEN_ADDRESS_GUIDE.md](GEN_ADDRESS_GUIDE.md) - Generate addresses
- [MINT_TOKEN_GUIDE.md](MINT_TOKEN_GUIDE.md) - Create tokens
- [SEND_TOKEN_GUIDE.md](SEND_TOKEN_GUIDE.md) - Send tokens
- [RECEIVE_TOKEN_GUIDE.md](RECEIVE_TOKEN_GUIDE.md) - Receive tokens
- [VERIFY_TOKEN_GUIDE.md](VERIFY_TOKEN_GUIDE.md) - Verify tokens

### Workflows & Patterns
- [TRANSFER_GUIDE.md](TRANSFER_GUIDE.md) - Transfer patterns overview
- [OFFLINE_TRANSFER_WORKFLOW.md](OFFLINE_TRANSFER_WORKFLOW.md) - Complete offline transfer flow
- [WORKFLOWS.md](WORKFLOWS.md) - Common use cases and recipes

### Technical Documentation
- [CLAUDE.md](CLAUDE.md) - Architecture and implementation details
- [TXF_IMPLEMENTATION_GUIDE.md](TXF_IMPLEMENTATION_GUIDE.md) - Token file format specification
- [DOCUMENTATION_ANALYSIS.md](DOCUMENTATION_ANALYSIS.md) - Documentation review and roadmap

### Help & Troubleshooting
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and solutions
- [SECURITY.md](SECURITY.md) - Security guidelines

## Examples

### Create NFT Collection
```bash
# Mint 10 NFTs with sequential IDs
for i in {1..10}; do
  SECRET="collection-secret" npm run mint-token -- \
    --preset nft \
    -i "dragon-$i" \
    -d "{\"name\":\"Dragon #$i\",\"rarity\":\"common\"}" \
    -o "collection/dragon-$i.txf"
done
```

### Invoice Generation
```bash
# Generate unique address for each invoice
INVOICE_ID="INV-$(date +%Y%m%d)-001"

ADDRESS=$(SECRET="business-secret" npm run gen-address -- \
  --preset usdu \
  -n "invoice-$INVOICE_ID" | jq -r .address)

echo "Invoice $INVOICE_ID"
echo "Payment address: $ADDRESS"
```

### Batch Token Transfer
```bash
# Transfer all tokens to new wallet
NEW_WALLET="DIRECT://..."

for token in wallet/*.txf; do
  SECRET="old-secret" npm run send-token -- \
    -f "$token" \
    -r "$NEW_WALLET" \
    --save
done
```

**More examples**: [WORKFLOWS.md](WORKFLOWS.md)

## Troubleshooting

### Common Issues

**"Command not found"**
- Run `npm install` and `npm run build`
- Execute from the `cli` directory

**"Token file not found"**
- Check filename matches output
- Use `ls *.txf` to list token files

**"Timeout waiting for inclusion proof"**
- Check internet connection
- Verify aggregator endpoint
- Try `--local` for testing

**"Address mismatch"**
- Use correct secret for recipient
- Secret must match the intended recipient address

**More solutions**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Resources

- **Official Website**: [unicity.network](https://unicity.network)
- **GitHub Repository**: [unicitynetwork/cli](https://github.com/unicitynetwork/cli)
- **Token Type Registry**: [unicitynetwork/unicity-ids](https://github.com/unicitynetwork/unicity-ids)
- **SDK Documentation**: [@unicitylabs/state-transition-sdk](https://www.npmjs.com/package/@unicitylabs/state-transition-sdk)
- **Issue Tracker**: [GitHub Issues](https://github.com/unicitynetwork/cli/issues)

## License

ISC License - See [LICENSE](LICENSE) file for details.

## Support

Need help?
- **Documentation**: Start with [GETTING_STARTED.md](GETTING_STARTED.md)
- **Troubleshooting**: Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **FAQ**: See [FAQ.md](FAQ.md)
- **Issues**: [GitHub Issues](https://github.com/unicitynetwork/cli/issues)
- **Community**: Join our community forum

---

**Quick Links**:
[Getting Started](GETTING_STARTED.md) • [Workflows](WORKFLOWS.md) • [Security](SECURITY.md) • [Glossary](GLOSSARY.md) • [Troubleshooting](TROUBLESHOOTING.md)
