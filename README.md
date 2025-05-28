# Unicity CLI
Command-line tools for interacting with the Unicity Network's offchain token system, including:

- **Aggregator Layer**: Tools for interacting with the Unicity gateway and commitment aggregation
- **Token State Transition**: Utilities for creating, transferring, and managing offchain tokens
- **Agent Layer**: Tools for automated token management and processing

This CLI provides a convenient interface to the transaction flow engine, allowing users to mint tokens, create pointers for reception, send tokens to other users, and receive tokens securely while leveraging Unicity's blockchain-based single-spend proof system.

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

### Get Inclusion Proof

Retrieve an inclusion proof for a specific request ID:

```bash
npm run get-request -- -e <endpoint_url> <request_id>
```

Example:
```bash
npm run get-request -- -e https://gateway-test1.unicity.network:443 7c8a9b0f1d2e3f4a5b6c7d8e9f0a1b2c
```

### Register Request

Register a new state transition request:

```bash
npm run register-request -- -e <endpoint_url> <secret> <state> <transition>
```

Example:
```bash
npm run register-request -- -e https://gateway-test1.unicity.network:443 mySecretKey "initial state" "new transition"
```

## Development

For development, you can use:

```bash
npm run dev -- <command> <args>
```

For example:
```bash
npm run dev -- get-request -e https://gateway-test1.unicity.network:443 7c8a9b0f1d2e3f4a5b6c7d8e9f0a1b2c
```
