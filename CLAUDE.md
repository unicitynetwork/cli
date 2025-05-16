# CLAUDE.md - Coding Assistant Guide

## Build & Test Commands
- Build: `npm run build` 
- Test: `npm test`
- Lint: `npm run lint`
- Start: `npm start`
- Get Request: `npm run get-request -- <endpoint_url> <request_id>`
- Register Request: `npm run register-request -- <endpoint_url> <secret> <state> <transition>`

## Code Style Guidelines
- **Formatting**: Use consistent indentation (2 spaces)
- **Naming**: Use camelCase for variables/functions, PascalCase for classes
- **Imports**: Group imports (standard libraries first, then @unicitylabs packages, followed by other third-party, then local)
- **Types**: Use TypeScript interfaces and types for all objects
- **Error Handling**: Use try/catch blocks with appropriate error messages
- **Comments**: Document complex logic, public API functions, and cryptographic operations

## Project Overview
CLI tools for interacting with the Unicity Network's offchain token system:

- **Aggregator Layer**: Interface with Unicity gateway for token commitment and proof generation
- **Token State Transition**: Manage offchain tokens (mint, transfer, receive)
- **Agent Layer**: Automate token operations and processing

The CLI provides command-line access to the transaction flow engine, enabling secure token management with blockchain-based single-spend proofs.

## Key Concepts
- Tokens exist offchain with cryptographic proofs attesting to state (ownership, value)
- Token state changes require blockchain infrastructure to produce single-spend proofs
- Commitment aggregation enables horizontal scalability for transactions

## Implementation Notes
- Uses @unicitylabs/commons for cryptographic primitives
- Uses @unicitylabs/state-transition-sdk for token operations and API
- Implements CLI commands using TypeScript and Commander
- AggregatorClient handles direct communication with the Unicity gateway
- RequestId and Authenticator provide cryptographic identity and proof verification