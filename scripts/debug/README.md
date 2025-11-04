# Debug Scripts

This directory contains debugging and development utility scripts for the Unicity CLI project.

## Contents

### Certificate and Key Management

- **[extract-pubkey.js](./extract-pubkey.js)**
  Utility to extract public keys from certificates for testing and debugging.

- **[debug-cert-simple.js](./debug-cert-simple.js)**
  Simplified certificate debugging tool for troubleshooting certificate issues.

### Authentication Testing

- **[test-authenticator.js](./test-authenticator.js)**
  Script to test the authentication system and validator communication.

- **[test-sdk-verify.js](./test-sdk-verify.js)**
  Utility to verify SDK integration and response validation.

### Bug Reproduction

- **[reproduce_bug.js](./reproduce_bug.js)**
  Script to reproduce specific bugs for debugging and verification purposes.

## Usage

These scripts are intended for development and debugging purposes only. They are not part of the main CLI functionality.

### Prerequisites

Ensure you have the required dependencies installed:

```bash
npm install
```

### Running Debug Scripts

```bash
# Extract public key from certificate
node scripts/debug/extract-pubkey.js <certificate-file>

# Test authenticator
node scripts/debug/test-authenticator.js

# Test SDK verification
node scripts/debug/test-sdk-verify.js

# Reproduce specific bug
node scripts/debug/reproduce_bug.js
```

## Development Notes

- These scripts use the Unicity SDK directly
- They may require network access to Unicity validators
- Some scripts may need configuration adjustments for your environment
- Always test in a safe environment before running against production

## Security Warning

⚠️ These scripts are for debugging purposes only. Do not use them with production credentials or in production environments.

## Related Documentation

- [Security Documentation](../../docs/security/) - Security considerations
- [Testing Documentation](../../docs/testing/) - Test suite documentation
- [Implementation Documentation](../../docs/implementation/) - Implementation details
