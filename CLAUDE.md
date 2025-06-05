# CLAUDE.md - Coding Assistant Guide

## Build & Test Commands
- Build: `npm run build`
- Lint: `npm run lint`
- Start: `npm start`
- Development mode: `npm run dev`
- Run specific command: 
  - `npm run get-request -- <endpoint_url> <request_id>`
  - `npm run register-request -- <endpoint_url> <secret> <state> <transition>`
  - `npm run gen-address`
  - `npm run mint-token -- <args>`
  - `npm run verify-token -- -f <token_file> [--secret]`

## Code Style Guidelines
- **Formatting**: 2 spaces indentation, consistent spacing
- **Naming**: camelCase for variables/functions, PascalCase for classes/interfaces
- **Imports**: Group by priority (Node.js → @unicitylabs → third-party → local)
- **Types**: Use TypeScript interfaces/types, enable strict mode
- **Error Handling**: Use try/catch with meaningful error messages
- **Comments**: Document complex logic, cryptographic operations, and public APIs
- **Module System**: Uses ES modules (import/export)

## Project Architecture
- **CLI Framework**: Uses Commander.js for command-line parsing
- **SDK Integration**: Leverages @unicitylabs/state-transition-sdk for token operations
- **Cryptography**: Uses @unicitylabs/commons for cryptographic primitives
- **Command Structure**: Each command defined in separate file under src/commands/

## Implementation Notes
- Offchain tokens with cryptographic state proofs
- AggregatorClient for Unicity gateway communication
- Commands follow consistent pattern with proper error handling
- ES2020 target with Node.js module resolution