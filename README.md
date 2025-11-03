# Unicity CLI

Command-line tools for interacting with the Unicity Network's offchain token system, including:

- **Aggregator Layer**: Tools for interacting with the Unicity gateway and commitment aggregation
- **Token State Transition**: Utilities for creating, transferring, and managing offchain tokens
- **Agent Layer**: Tools for automated token management and processing

This CLI provides a convenient interface to the transaction flow engine, allowing users to mint tokens, create pointers for reception, send tokens to other users, and receive tokens securely while leveraging Unicity's blockchain-based single-spend proof system.

## Documentation

- **[Getting Started Guide](GETTING_STARTED.md)** - New users start here (15-minute tutorial)
- **[API Reference](API_REFERENCE.md)** - Complete command-line API documentation
- **[Documentation Index](DOCUMENTATION_INDEX.md)** - Full documentation navigation
- **[Tutorial Series](TUTORIALS_INDEX.md)** - Progressive learning path (beginner to expert)
- **[Glossary](GLOSSARY.md)** - Key terms and concepts

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

## Usage

### Quick Start: Mint Your First Token

Mint a token to your own address using the self-mint pattern:

```bash
# Mint with interactive secret entry
npm run mint-token -- -d '{"name":"My First NFT"}'

# Or with environment variable
SECRET="my-secret-password" npm run mint-token -- -d '{"name":"My NFT"}'
```

This creates a token owned by you and saves it to a `.txf` file.

### Verify a Token

Inspect and validate a token file:

```bash
npm run verify-token -- -f token.txf
```

Shows comprehensive information including:
- Token data (decoded as JSON/UTF-8)
- Public key and signature (from predicate)
- Inclusion proof
- SDK compatibility

### Generate an Address

Generate an address from your secret to receive tokens:

```bash
SECRET="my-secret" npm run gen-address
```

### Low-Level Commands

#### Get Inclusion Proof

Retrieve an inclusion proof for a specific request ID:

```bash
npm run get-request -- -e <endpoint_url> <request_id>
```

Example:
```bash
npm run get-request -- -e https://gateway.unicity.network 7c8a9b0f1d2e3f4a5b6c7d8e9f0a1b2c
```

#### Register Request

Register a new state transition request:

```bash
npm run register-request -- -e <endpoint_url> <secret> <state> <transition>
```

Example:
```bash
npm run register-request -- -e https://gateway.unicity.network mySecretKey "initial state" "new transition"
```

## Available Commands

| Command | Description | Guide |
|---------|-------------|-------|
| `mint-token` | Create new tokens (self-mint to your address) | [MINT_TOKEN_GUIDE.md](MINT_TOKEN_GUIDE.md) |
| `verify-token` | Verify and inspect token files | [VERIFY_TOKEN_GUIDE.md](VERIFY_TOKEN_GUIDE.md) |
| `send-token` | Send tokens to recipients (offline or immediate) | [SEND_TOKEN_GUIDE.md](SEND_TOKEN_GUIDE.md) |
| `receive-token` | Complete offline token transfers | [RECEIVE_TOKEN_GUIDE.md](RECEIVE_TOKEN_GUIDE.md) |
| `gen-address` | Generate addresses from secrets | [GEN_ADDRESS_GUIDE.md](GEN_ADDRESS_GUIDE.md) |
| `get-request` | Get inclusion proofs | - |
| `register-request` | Register state transitions | - |

**Transfer Commands** - See [TRANSFER_GUIDE.md](TRANSFER_GUIDE.md) for complete workflow

## Key Features

### Self-Mint Pattern

The mint-token command uses a **self-mint pattern** where:
- You provide a secret (password/private key)
- Command derives your public key and address
- Token is minted directly to your address
- You have immediate ownership with full control

### SDK-Compliant TXF Files

All generated tokens use:
- Proper CBOR predicate encoding (187 bytes)
- Full SDK compatibility with `Token.fromJSON()`
- Public key and signature embedded in predicate
- Ready for transfer and other SDK operations

### Masked vs Unmasked Predicates

- **Masked** (default): One-time-use address, more private
- **Unmasked** (`-u` flag): Reusable address, more convenient

## Development

For development, you can use:

```bash
npm run dev -- <command> <args>
```

For example:
```bash
npm run dev -- get-request -e https://gateway-test1.unicity.network:443 7c8a9b0f1d2e3f4a5b6c7d8e9f0a1b2c
```
