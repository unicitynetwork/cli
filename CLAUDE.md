# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands
- Build TypeScript: `npm run build`
- Development mode: `npm run dev -- <command> <args>`
- Production run: `npm start -- <command> <args>`
- Lint code: `npm run lint`

### Available CLI Commands
```bash
# Generate a new address
npm run gen-address

# Mint a new token
npm run mint-token -- -e <endpoint> [options]
# Options: -n/--nonce, -u/--unmasked, -i/--token-id, -y/--token-type,
#          -d/--token-data, --salt, -h/--data-hash, -r/--reason,
#          -o/--output <file>, -s/--save

# Verify a token file
npm run verify-token -- -f <token_file> [--secret]

# Send a token to a recipient
npm run send-token -- -f <token_file> -r <recipient_address> [options]
# Options: -m/--message, -e/--endpoint, --submit-now, -o/--output, --save
# Pattern A (default): Creates offline transfer package for recipient
# Pattern B (--submit-now): Submits to network immediately

# Receive a token sent via offline transfer
npm run receive-token -- -f <token_file> [options]
# Options: -e/--endpoint, --local, --production, -o/--output, --save
# Validates offline transfer package, verifies recipient, submits to network

# Register a state transition request
npm run register-request -- -e <endpoint> <secret> <state> <transition>

# Get inclusion proof for a request
npm run get-request -- -e <endpoint> <request_id>
```

## Architecture Overview

### Core Technology Stack
- **Unicity SDK**: `@unicitylabs/state-transition-sdk` v1.6.0-rc.fd1f327 - Main SDK for token operations
- **Commons Library**: `@unicitylabs/commons` v2.4.0 - Cryptographic primitives and utilities
- **CLI Framework**: Commander.js for command parsing and user interaction
- **TypeScript**: ES2020 target with strict mode, NodeNext module system

### Command Architecture Pattern
Each command follows this structure:
1. Command file in `src/commands/` exports a function that takes `Command` from commander
2. Command registration in `src/index.ts` via function call
3. Commands handle async operations with try/catch error handling
4. Secret/password input handled via environment variable or interactive prompt

### Token System Architecture
- **Offchain Tokens**: Tokens exist offchain with cryptographic state proofs
- **State Transitions**: All token operations are state transitions submitted to aggregator
- **Inclusion Proofs**: Operations require inclusion proofs from the network for finality
- **Predicate System**: Tokens use masked/unmasked predicates for ownership control

### Key Implementation Patterns

#### Secret Handling
Commands that need secrets check `process.env.SECRET` first, then prompt interactively if not set. The environment variable is cleared after reading for security.

#### Hex/Hash Processing
Input parameters can be:
- Valid 32-byte hex strings (64 chars) - used directly
- Other strings - hashed with SHA256 to generate 32 bytes
- Not provided - generates random 32 bytes

#### Network Communication
- Uses `AggregatorClient` from SDK to communicate with Unicity gateway
- Default endpoint: `https://gateway.unicity.network`
- Supports custom endpoints via `-e/--endpoint` option
- Implements polling for inclusion proofs with timeout/retry logic

#### Token Minting Flow
1. Create signing service from secret (with optional nonce for masked addresses)
2. Generate predicate (masked or unmasked)
3. Create recipient address from predicate
4. Submit mint transaction to network
5. Wait for inclusion proof (polls with 1-second intervals, 30-second timeout)
6. Create final token with state and transaction history
7. Output as JSON or save to file

#### Token Transfer Flow
**Pattern A (Offline Transfer - Default)**:
1. Load token from TXF file
2. Get sender's secret and create signing service
3. Parse recipient address string
4. Generate random salt for transfer
5. Create transfer commitment with optional message
6. Build offline transfer package with sender info, recipient, commitment data
7. Create extended TXF with `offlineTransfer` section and PENDING status
8. Output sanitized file (never includes private keys)

**Pattern B (Submit Now - with `--submit-now` flag)**:
1. Steps 1-5 same as Pattern A
2. Submit transfer commitment to network
3. Wait for inclusion proof
4. Create transfer transaction from commitment and proof
5. Update TXF with new transaction and TRANSFERRED status
6. Output final TXF file

#### Token Receive Flow (Offline Transfer)
1. Load extended TXF file with offline transfer package
2. Validate offline transfer structure and required fields
3. Get recipient's secret and create signing service
4. Parse transfer commitment from `offlineTransfer.commitmentData`
5. Load token to extract token ID and type
6. Create recipient's UnmaskedPredicate using salt from offline package
7. Verify recipient address matches (ensure we're the intended recipient)
8. Submit transfer commitment to network
9. Wait for inclusion proof (30-second timeout with polling)
10. Create transfer transaction from commitment and proof
11. Create new TokenState with recipient's predicate
12. Update token using `token.update(trustBase, newState, transferTx)`
13. Create final TXF with CONFIRMED status (remove offlineTransfer section)
14. Output sanitized file

## TypeScript Configuration
- Target: ES2020
- Module: NodeNext with NodeNext resolution
- Strict mode enabled
- Source maps and declarations generated
- Output directory: `dist/`

## File Structure Conventions
- Commands: `src/commands/<command-name>.ts`
- Each command exports a single function taking `Command` parameter
- Imports grouped by: Node.js built-ins → @unicitylabs packages → third-party → local

## Token File Format (.txf)
The project includes comprehensive TXF (Token eXchange Format) implementation guide for:
- Token portability between wallets
- Offline transfer support with pending transactions
- Version 2.0 JSON structure with state tracking
- Status lifecycle: PENDING → SUBMITTED → CONFIRMED → TRANSFERRED/BURNED