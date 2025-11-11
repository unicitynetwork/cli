# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Unicity CLI is a command-line tool for interacting with the Unicity Network's offchain token system. It provides utilities for creating, transferring, and managing tokens using Unicity's blockchain-based single-spend proof system with a Sparse Merkle Tree commitment aggregator.

**Key Dependencies:**
- `@unicitylabs/state-transition-sdk` v1.6.0-rc.fd1f327 - Core SDK for token operations
- `@unicitylabs/commons` v2.4.0-rc.a5f85b0 - Shared utilities (used minimally for CBOR decoding and proof verification)
- `commander` - CLI framework

## Development Commands

### Build and Lint
```bash
# Build TypeScript to JavaScript
npm run build

# Lint the codebase
npm run lint

# Development mode (ts-node)
npm run dev -- <command> <args>
```

### Testing Commands

**Automated Test Suite (BATS Framework):**
```bash
# Run all tests (313 scenarios, ~20 minutes)
npm test

# Run specific suite
npm run test:functional    # 96 tests, ~5 min
npm run test:security      # 68 tests, ~8 min
npm run test:edge-cases    # 127+ tests, ~7 min

# Quick smoke tests (~2 minutes)
npm run test:quick

# Parallel execution (2x faster)
npm run test:parallel

# Debug mode
npm run test:debug

# CI mode with reports
npm run test:ci

# Single test file
bats tests/functional/test_gen_address.bats

# Filter specific test by name
bats --filter "GEN_ADDR-001" tests/functional/test_gen_address.bats

# Generate coverage report
npm run test:coverage
```

**Prerequisites for running tests:**
- BATS installed: `sudo apt install bats` or `brew install bats-core`
- jq installed: `sudo apt install jq` or `brew install jq`
- Local aggregator running: `docker run -p 3000:3000 unicity/aggregator`
- Build CLI first: `npm run build`

**Test Documentation:**
- Quick Reference: `TESTS_QUICK_REFERENCE.md`
- Complete Guide: `TEST_SUITE_COMPLETE.md`
- CI/CD Guide: `CI_CD_QUICK_START.md`
- Suite-specific: `tests/{functional,security,edge-cases}/README.md`

**Manual Testing Patterns (for development):**
```bash
# Mint token against local aggregator
SECRET="test" npm run mint-token -- --local -d '{"test":"data"}' --save

# Generate address
SECRET="test-secret" npm run gen-address

# Verify token
npm run verify-token -- -f <token-file.txf>

# Send token (offline transfer)
SECRET="sender-secret" npm run send-token -- -f <token.txf> -r "DIRECT://..." --save

# Receive token
SECRET="recipient-secret" npm run receive-token -- -f <offline-transfer.txf> --save
```

### TrustBase Setup for Local Development

The CLI requires a TrustBase configuration to verify proofs. For local development:

```bash
# Extract TrustBase from Docker aggregator (replace container name)
docker cp aggregator-service:/app/bft-config/trust-base.json ./config/trust-base.json

# Verify it's valid
cat ./config/trust-base.json | jq '.networkId, .rootNodes[0].nodeId'

# CLI will auto-detect ./config/trust-base.json
```

**Alternative:** Use `TRUSTBASE_PATH` environment variable:
```bash
TRUSTBASE_PATH=/tmp/trust-base.json SECRET="test" npm run mint-token -- --local
```

See `.dev/architecture/trustbase-loading.md` for full details.

## Architecture

### Command Structure

The CLI is organized as a Commander.js application with separate command files:

```
src/
├── index.ts                          # CLI entry point, registers all commands
├── commands/
│   ├── mint-token.ts                 # Create new tokens (self-mint pattern)
│   ├── send-token.ts                 # Transfer tokens (offline or immediate)
│   ├── receive-token.ts              # Complete offline transfers
│   ├── gen-address.ts                # Generate addresses from secrets
│   ├── verify-token.ts               # Verify and inspect tokens
│   ├── hash-data.ts                  # Hash data for transfer validation
│   ├── get-request.ts                # Fetch inclusion proofs from aggregator
│   └── register-request.ts           # Register state transitions
├── utils/
│   ├── trustbase-loader.ts           # Dynamic TrustBase loading with caching
│   ├── proof-validation.ts           # Inclusion proof verification
│   ├── ownership-verification.ts     # Token ownership status checking
│   └── transfer-validation.ts        # Transfer validation logic
└── types/
    └── extended-txf.ts               # TXF file format type definitions
```

### Key Architectural Patterns

**1. Self-Mint Pattern**
- User provides a secret (password/private key)
- CLI derives public key and address from secret
- Token is minted directly to the user's address
- User has immediate ownership with full control

**2. TXF File Format**
- Extended JSON format containing token state and metadata
- Includes genesis transaction, current state, inclusion proofs
- Contains transaction history and optional offline transfers
- SDK-compliant CBOR predicate encoding (187 bytes)

**3. Masked vs Unmasked Predicates**
- **Masked** (default): One-time-use address, more private
- **Unmasked** (`-u` flag): Reusable address, more convenient
- Both store public key and signature in predicate params

**4. Dynamic TrustBase Loading**
- Searches multiple paths: custom path, `/tmp/aggregator/`, `./config/`, project root
- Falls back to hardcoded local Docker config if no file found
- Cached after first load to avoid repeated I/O
- See `src/utils/trustbase-loader.ts:line:117-136` for loading strategy

**5. Ownership Verification**
- Queries aggregator to check if token state is spent
- Uses `getTokenStatus()` SDK method with RequestId
- Four scenarios: current, outdated, pending transfer, confirmed transfer
- Gracefully degrades if network unavailable
- See `.dev/architecture/ownership-verification-summary.md`

### Token State Flow

```
Mint → [Genesis State] → Transfer → [New State] → Transfer → ...
         ↓                  ↓                        ↓
      Inclusion         Inclusion               Inclusion
      Proof from        Proof from              Proof from
      Aggregator        Aggregator              Aggregator
```

Each state transition:
1. Creates commitment containing state hash
2. Submits to aggregator
3. Receives inclusion proof (Sparse Merkle Tree)
4. Proof verifies state is recorded in blockchain

### Aggregator Integration

The CLI interacts with the Unicity aggregator layer via:
- `AggregatorClient` - HTTP/JSON-RPC client for proof queries
- `StateTransitionClient` - High-level SDK for token operations

**Endpoints:**
- Production: `https://gateway.unicity.network`
- Local Docker: `http://127.0.0.1:3000`

**Key Operations:**
- `submitCommitment()` - Register state transition
- `getInclusionProof(requestId)` - Fetch proof from Sparse Merkle Tree
- `getTokenStatus(trustBase, token, publicKey)` - Check if state is spent

## Code Patterns and Conventions

### Import Consolidation

**Prefer SDK imports** over commons imports where possible:
```typescript
// Preferred (SDK)
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import { JsonRpcNetworkError } from '@unicitylabs/state-transition-sdk/lib/api/json-rpc/JsonRpcNetworkError.js';

// Only when necessary (commons-only classes)
import { CborDecoder } from '@unicitylabs/commons/lib/cbor/CborDecoder.js';
import { InclusionProofVerificationStatus } from '@unicitylabs/commons/lib/smt/InclusionProofVerificationStatus.js';
```

See `.dev/codebase-analysis/executive-summary.md` for full rationale.

### Secret Handling

Secrets are handled securely:
```typescript
// 1. Check environment variable first
if (process.env.SECRET) {
  const secret = process.env.SECRET;
  delete process.env.SECRET;  // Clear immediately
  return new TextEncoder().encode(secret);
}

// 2. Prompt user interactively
const rl = readline.createInterface({ input: stdin, output: stderr });
```

**Never log secrets or private keys to console.**

### Error Handling

Network errors are handled gracefully:
```typescript
try {
  const proof = await client.getInclusionProof(requestId);
} catch (error) {
  if (error instanceof JsonRpcNetworkError) {
    if (error.status === 404) {
      // Normal: RequestId not in tree (unspent state)
    } else if (error.status === 503 || error.code === 'ECONNREFUSED') {
      // Aggregator unavailable - show warning, continue
      console.error('⚠️ Network unavailable, showing local data only');
    }
  }
  // Always gracefully degrade, never crash
}
```

### File Operations

TXF files are read/written with proper JSON parsing:
```typescript
// Reading
const txfJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
const token = Token.fromJSON(txfJson);

// Writing
const outputPath = `${timestamp}_${tokenId}.txf`;
fs.writeFileSync(outputPath, JSON.stringify(txfJson, null, 2));
console.log(`✓ Saved to: ${outputPath}`);
```

### TypeScript Configuration

Key `tsconfig.json` settings:
- **Module:** `NodeNext` with `moduleResolution: NodeNext`
- **Target:** ES2020
- **Strict mode:** Enabled
- **ESM:** All imports must use `.js` extension (even for `.ts` files)

**Important:** When importing local TypeScript files, always use `.js` extension:
```typescript
import { validateInclusionProof } from '../utils/proof-validation.js';  // ✓
import { validateInclusionProof } from '../utils/proof-validation';     // ✗
```

## Common Tasks

### Adding a New Command

1. Create file in `src/commands/your-command.ts`
2. Export a function that registers with Commander:
```typescript
import { Command } from 'commander';

export function yourCommand(program: Command): void {
  program
    .command('your-command')
    .description('What it does')
    .option('-f, --flag', 'Option description')
    .action(async (options) => {
      // Implementation
    });
}
```
3. Register in `src/index.ts`:
```typescript
import { yourCommand } from './commands/your-command.js';
yourCommand(program);
```
4. Add npm script in `package.json`:
```json
"your-command": "node dist/index.js your-command"
```

### Working with Predicates

Predicates are CBOR-encoded structures containing:
- Engine ID (e.g., 1 for unmasked, 5 for masked)
- Predicate type (e.g., 5001)
- Parameters (signature, public key, optional mask)

**Parsing predicates:**
```typescript
const predicateBytes = HexConverter.decode(predicateHex);
const predicateArray = CborDecoder.readArray(predicateBytes);
// [engineId, predicateType, params]
```

**Creating predicates:**
```typescript
// Unmasked (reusable address)
const predicate = new UnmaskedPredicate(publicKey, signature);

// Masked (one-time address)
const predicate = new MaskedPredicate(publicKey, signature, mask);
```

### Verifying Inclusion Proofs

Use the helper function in `src/utils/proof-validation.ts:line:19-54`:
```typescript
import { validateInclusionProof } from '../utils/proof-validation.js';

const isValid = await validateInclusionProof(
  proof,           // InclusionProof object
  expectedHash,    // Expected value in tree
  trustBase        // RootTrustBase for verification
);
```

## Documentation

### For Users
- **[docs/getting-started.md](docs/getting-started.md)** - 15-minute tutorial
- **[docs/reference/api-reference.md](docs/reference/api-reference.md)** - Complete command reference
- **[docs/guides/](docs/guides/)** - Command guides and workflows
- **[docs/tutorials/](docs/tutorials/)** - Progressive learning path

### For Developers
- **[.dev/README.md](.dev/README.md)** - Developer documentation index
- **[.dev/architecture/](.dev/architecture/)** - Architecture and design decisions
- **[.dev/codebase-analysis/](.dev/codebase-analysis/)** - Dependency analysis and refactoring
- **[.dev/implementation-notes/](.dev/implementation-notes/)** - Bug fixes and technical notes

### Test Documentation
- **[test-scenarios/README.md](test-scenarios/README.md)** - 313 comprehensive test scenarios
- Organized into: functional (96), security (68), edge cases (149)

## Important Context

### Unicity Network Concepts

**Sparse Merkle Tree (SMT):** The aggregator maintains a SMT of all state transitions. Inclusion proofs demonstrate that a state transition was recorded in the tree.

**RequestId:** Hash of (public key + state hash). Used to query the aggregator for spent/unspent status.

**State Transition:** Moving from one token state to another (e.g., mint, transfer). Each transition gets an inclusion proof.

**Offline Transfers:** Token transfers that don't immediately submit to aggregator. Sender creates transfer, recipient submits it later.

**TrustBase:** Network configuration containing root node information, signatures, and network ID. Required for cryptographic proof verification.

### SDK Versioning

Both SDK packages use RC (release candidate) versions:
- `@unicitylabs/state-transition-sdk` v1.6.0-rc.fd1f327
- `@unicitylabs/commons` v2.4.0-rc.a5f85b0

When updating dependencies:
1. Check for breaking changes in SDK release notes
2. Test all commands after updating
3. Update TrustBase if network ID changes
4. Verify proof validation still works

### Test Infrastructure

The project has a comprehensive BATS test suite with 313+ test scenarios:
- **Test Helpers** (`tests/helpers/`):
  - `common.bash` - Core test utilities and CLI execution wrappers
  - `assertions.bash` - 50+ assertion functions for validation
  - `id-generation.bash` - Unique ID generation for test isolation
  - `aggregator-parsing.bash` - Aggregator response parsing utilities

**Key Test Patterns:**
- **Dual Capture**: Tests capture both stdout and stderr separately using `run_cli()` helper
- **Unique IDs**: Every test uses `generate_unique_id()` to avoid collisions
- **Automatic Cleanup**: `setup_test()` and `cleanup_test()` manage temp files
- **Aggregator Checks**: `skip_if_aggregator_unavailable()` handles offline scenarios

**Test Helper Functions:**
```bash
# CLI execution with dual capture
run_cli command args...              # Captures stdout→$output, stderr→$stderr

# Token operations
mint_token "$secret" "preset" "$output_file" "$data"
send_token_offline "$secret" "$input" "$recipient" "$output"
receive_token "$secret" "$input" "$output"

# Assertions
assert_valid_token "$file"
assert_json_field_equals "$file" ".path" "value"
assert_output_contains "string"
```

See `tests/QUICK_REFERENCE.md` for complete test infrastructure guide.

**Debugging Test Failures:**
```bash
# Run with debug output
UNICITY_TEST_DEBUG=1 bats tests/functional/test_gen_address.bats

# Keep temp files for inspection
UNICITY_TEST_KEEP_TMP=1 bats tests/functional/test_gen_address.bats

# Run single test by filter
bats --filter "GEN_ADDR-005" tests/functional/test_gen_address.bats

# Combine debug options
UNICITY_TEST_DEBUG=1 UNICITY_TEST_KEEP_TMP=1 \
  bats tests/functional/test_gen_address.bats
```

**Common Test Issues:**
- **CLI not built**: Run `npm run build` before testing
- **Aggregator unavailable**: Tests skip automatically or use `UNICITY_TEST_SKIP_EXTERNAL=1`
- **Test output capture**: Tests use dual capture (`run_cli`) - avoid mixing stdout/stderr
- **File cleanup**: Tests auto-cleanup temp files unless `UNICITY_TEST_KEEP_TMP=1` is set

### Known Limitations

1. **RC versions** - SDK may have breaking changes between releases
2. **Local Docker only** - TrustBase fallback only works with standard local Docker setup
3. **No multi-token support** - Each TXF file contains one token only

## File Naming Conventions

**TXF files:** `YYYYMMDD_HHMMSS_<tokenId>_<uniquifier>.txf`
- Example: `20251103_213804_1762202284127_0000569306.txf`
- Generated automatically by mint-token, send-token, receive-token

**Offline transfer files:** Same pattern, but contains `offlineTransfer` field in JSON

## Environment Variables

**Runtime Variables:**
- `SECRET` - User secret for key derivation (cleared after use)
- `TRUSTBASE_PATH` - Custom path to trust-base.json file (optional)

**Test Variables:**
- `UNICITY_TEST_DEBUG=1` - Enable debug output in tests
- `UNICITY_TEST_KEEP_TMP=1` - Preserve temp files after test runs
- `UNICITY_TEST_SKIP_EXTERNAL=1` - Skip tests requiring aggregator
- `UNICITY_TEST_VERBOSE_ASSERTIONS=1` - Detailed assertion output

## Git Workflow

Standard git workflow. When making commits:
- Use descriptive commit messages
- Include 🤖 attribution if desired: `🤖 Generated with Claude Code`
- Test build before committing: `npm run build && npm run lint`

Current branch: `main`
