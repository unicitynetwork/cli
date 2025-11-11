# Unix Exit Code Implementation Guide for verify-token

**Author:** Bash Shell Scripting Expert
**Date:** 2025-01-11
**Target:** Unicity CLI v1.7.0
**Command:** `verify-token`

---

## Executive Summary

The `verify-token` command currently exits 0 in all cases, which violates Unix conventions and breaks test expectations. This guide provides the definitive implementation strategy based on analysis of standard verification tools (GPG, OpenSSL, Git) and best practices from 40+ years of Unix tool design.

**Key Decision:** Default strict behavior (exit 1 on failure) with optional `--diagnostic` flag.

---

## 1. Unix Verification Tool Exit Code Analysis

### Industry Standards

| Tool | Exit 0 | Exit 1 | Exit 2 |
|------|--------|--------|--------|
| `gpg --verify` | Valid signature | Bad signature | General error |
| `openssl verify` | Cert valid | Verification fail | Usage error |
| `git verify-commit` | Signature valid | Invalid/missing sig | Usage error |
| `shasum -c` | All checksums match | Any checksum fails | File not found |
| `diff` | Files identical | Files differ | Usage error |

**Universal Pattern:**
- **0**: Success - verification passed completely
- **1**: Verification failed - content is invalid/untrusted
- **2**: Usage/system error - cannot perform verification

### Rationale for Exit 1 on Failure

From POSIX and Unix design philosophy:
1. **Fail-safe defaults**: Tools should fail loudly when problems are detected
2. **Script safety**: `if verify-token; then use-token; fi` should not use invalid tokens
3. **Pipeline integrity**: `verify-token && send-token` should abort on invalid tokens
4. **Security principle**: Verification failures are security events, must not silently succeed

---

## 2. Exit Code Strategy for verify-token

### Exit Code Matrix

| Scenario | Category | Exit Code | Stdout Message | Rationale |
|----------|----------|-----------|----------------|-----------|
| **File/Input Errors** | | | | |
| Missing --file flag | Usage | 2 | "Error: --file option is required" | Required argument missing |
| File not found | Usage | 2 | "Error: File not found: {path}" | Invalid input path |
| Permission denied | Usage | 2 | "Error: Permission denied: {path}" | System access error |
| Invalid JSON syntax | Usage | 2 | "Error: Invalid JSON syntax" | Malformed input file |
| Empty file | Usage | 2 | "Error: File is empty" | Invalid input |
| **Token Structure Errors** | | | | |
| Missing genesis | Verification | 1 | "❌ Missing genesis transaction" | Invalid token structure |
| Missing state | Verification | 1 | "❌ Missing current state" | Incomplete token |
| Token.fromJSON() fails | Verification | 1 | "⚠ Could not load token with SDK" | SDK rejected token |
| **Cryptographic Failures** | | | | |
| CBOR decode failure | Verification | 1 | "❌ Failed to decode predicate" | Tampered or corrupted |
| Invalid proof structure | Verification | 1 | "❌ Proof validation failed" | Missing authenticator |
| Invalid proof signature | Verification | 1 | "❌ Cryptographic verification failed" | Tampered proof |
| Merkle path invalid | Verification | 1 | "❌ Merkle path verification failed" | Invalid state transition |
| **Network Status** | | | | |
| Token spent on-chain | Verification | 1 | "❌ Token has been spent" | No longer valid for use |
| Token unrecognized | Verification | 1 | "❌ Token not found on network" | Never registered |
| Network unavailable | Success (warning) | 0 | "⚠️ Network unavailable - cannot verify on-chain status" | Graceful degradation |
| **Success Cases** | | | | |
| All checks pass | Success | 0 | "✅ Token is valid and can be transferred" | Fully verified |
| Valid but network down | Success | 0 | "✅ Token valid locally (network status unknown)" | Best-effort verification |
| **Diagnostic Mode** | | | | |
| Any scenario with --diagnostic | Success | 0 | (shows issues but exits 0) | Reporting mode |

### Key Design Decisions

**Decision 1: Network unavailable = Exit 0**
- **Rationale**: Cannot determine on-chain status is not the same as "token is invalid"
- **Behavior**: Show warning, continue with local validation, exit 0 if local checks pass
- **Alternative considered**: Exit 1 if network check fails (rejected as too strict)

**Decision 2: Spent token = Exit 1**
- **Rationale**: Spent token cannot be used for transfers (primary use case)
- **Behavior**: Query aggregator, if token spent on-chain, exit 1
- **Alternative considered**: Exit 0 with warning (rejected - security risk)

**Decision 3: SDK load failure = Exit 1**
- **Rationale**: If SDK rejects token, it cannot be used with CLI commands
- **Behavior**: Token.fromJSON() failure is verification failure
- **Alternative considered**: Continue with JSON-only checks (rejected - incomplete verification)

---

## 3. Implementation Pattern

### Code Structure

```typescript
export function verifyTokenCommand(program: Command): void {
  program
    .command('verify-token')
    .description(`Verify and display detailed information about a token file

EXIT CODES:
  0   Token is valid and can be used
  1   Verification failed (invalid, tampered, or spent)
  2   Usage error (file not found, invalid arguments)

Use --diagnostic to display verification info without failing (always exit 0)`)
    .option('-f, --file <file>', 'Token file to verify (required)')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('--local', 'Use local aggregator (http://localhost:3000)')
    .option('--skip-network', 'Skip network ownership verification')
    .option('--diagnostic', 'Display verification info without failing (exit 0 always)')
    .action(async (options) => {
      let hasCriticalErrors = false;

      try {
        // ===== FILE VALIDATION (Usage Errors = Exit 2) =====

        if (!options.file) {
          console.error('Error: --file option is required');
          console.error('Usage: npm run verify-token -- -f <token_file.txf>');
          process.exit(2);
        }

        let tokenFileContent: string;
        try {
          tokenFileContent = fs.readFileSync(options.file, 'utf8');
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            console.error(`Error: File not found: ${options.file}`);
            process.exit(2);
          } else if (error.code === 'EACCES') {
            console.error(`Error: Permission denied: ${options.file}`);
            process.exit(2);
          }
          throw error; // Unexpected error, handle in outer catch
        }

        if (tokenFileContent.trim().length === 0) {
          console.error('Error: File is empty');
          process.exit(2);
        }

        let tokenJson: any;
        try {
          tokenJson = JSON.parse(tokenFileContent);
        } catch (error) {
          console.error('Error: Invalid JSON syntax');
          if (error instanceof Error) {
            console.error(`  ${error.message}`);
          }
          process.exit(2);
        }

        console.log('=== Token Verification ===');
        console.log(`File: ${options.file}\n`);

        // ===== STRUCTURE VALIDATION (Verification Failures = Exit 1) =====

        console.log('=== Basic Information ===');
        console.log(`Version: ${tokenJson.version || 'N/A'}`);

        if (!tokenJson.genesis) {
          console.log('\n❌ Missing genesis transaction');
          hasCriticalErrors = true;
        }

        if (!tokenJson.state) {
          console.log('\n❌ Missing current state');
          hasCriticalErrors = true;
        }

        // ===== PROOF VALIDATION (Verification Failures = Exit 1) =====

        console.log('\n=== Proof Validation (JSON) ===');
        const jsonProofValidation = validateTokenProofsJson(tokenJson);

        if (jsonProofValidation.valid) {
          console.log('✅ All proofs structurally valid');
          console.log('  ✓ Genesis proof has authenticator');
          if (tokenJson.transactions && tokenJson.transactions.length > 0) {
            console.log(`  ✓ All transaction proofs have authenticators (${tokenJson.transactions.length} transaction${tokenJson.transactions.length !== 1 ? 's' : ''})`);
          }
        } else {
          console.log('❌ Proof validation failed:');
          jsonProofValidation.errors.forEach(err => console.log(`  - ${err}`));
          hasCriticalErrors = true;
        }

        if (jsonProofValidation.warnings.length > 0) {
          console.log('⚠ Warnings:');
          jsonProofValidation.warnings.forEach(warn => console.log(`  - ${warn}`));
        }

        // ===== SDK VALIDATION (Verification Failures = Exit 1) =====

        let token: Token<any> | null = null;
        try {
          token = await Token.fromJSON(tokenJson);
          console.log('\n✅ Token loaded successfully with SDK');
          console.log(`Token ID: ${token.id.toJSON()}`);
          console.log(`Token Type: ${token.type.toJSON()}`);

          // Perform cryptographic proof validation
          console.log('\n=== Cryptographic Proof Verification ===');
          console.log('Loading trust base...');

          const trustBase = await getCachedTrustBase({
            filePath: process.env.TRUSTBASE_PATH,
            useFallback: false
          });
          console.log(`  ✓ Trust base ready (Network ID: ${trustBase.networkId}, Epoch: ${trustBase.epoch})`);
          console.log('Verifying proofs with SDK...');

          const sdkProofValidation = await validateTokenProofs(token, trustBase);

          if (sdkProofValidation.valid) {
            console.log('✅ All proofs cryptographically verified');
            console.log('  ✓ Genesis proof signature valid');
            console.log('  ✓ Genesis merkle path valid');
            if (token.transactions && token.transactions.length > 0) {
              console.log(`  ✓ All transaction proofs verified (${token.transactions.length} transaction${token.transactions.length !== 1 ? 's' : ''})`);
            }
          } else {
            console.log('❌ Cryptographic verification failed:');
            sdkProofValidation.errors.forEach(err => console.log(`  - ${err}`));
            hasCriticalErrors = true;
          }

          if (sdkProofValidation.warnings.length > 0) {
            console.log('⚠ Warnings:');
            sdkProofValidation.warnings.forEach(warn => console.log(`  - ${warn}`));
          }
        } catch (err) {
          console.log('\n⚠ Could not load token with SDK:', err instanceof Error ? err.message : String(err));
          console.log('Displaying raw JSON data...\n');
          hasCriticalErrors = true;
        }

        // ===== DISPLAY SECTIONS (No effect on exit code) =====

        displayGenesis(tokenJson.genesis);

        console.log('\n=== Current State ===');
        if (tokenJson.state) {
          if (tokenJson.state.data) {
            console.log(`\nState Data (hex): ${tokenJson.state.data.substring(0, 50)}${tokenJson.state.data.length > 50 ? '...' : ''}`);
            const decoded = tryDecodeAsText(tokenJson.state.data);
            console.log(`State Data (decoded):`);
            console.log(decoded);
          } else {
            console.log('\nState Data: (empty)');
          }

          if (tokenJson.state.predicate) {
            displayPredicateInfo(tokenJson.state.predicate);
          } else {
            console.log('\nPredicate: (none)');
          }
        }

        // ===== NETWORK STATUS (Spent = Exit 1, Unavailable = Warning) =====

        if (!options.skipNetwork && token && tokenJson.state) {
          console.log('\n=== Ownership Status ===');

          let endpoint = options.endpoint;
          if (options.local) {
            endpoint = 'http://127.0.0.1:3000';
          }

          try {
            console.log('Querying aggregator for current state...');
            const aggregatorClient = new AggregatorClient(endpoint);
            const client = new StateTransitionClient(aggregatorClient);

            let trustBase = null;
            try {
              trustBase = await getCachedTrustBase({
                filePath: process.env.TRUSTBASE_PATH,
                useFallback: false
              });
            } catch (err) {
              console.log('  ⚠ Could not load trust base for ownership verification');
              console.log(`  Error: ${err instanceof Error ? err.message : String(err)}`);
            }

            if (trustBase) {
              const ownershipStatus = await checkOwnershipStatus(token, tokenJson, client, trustBase);

              console.log(`\n${ownershipStatus.message}`);
              ownershipStatus.details.forEach(detail => {
                console.log(`  ${detail}`);
              });

              // Check if token is spent (verification failure)
              if (ownershipStatus.message.includes('spent') ||
                  ownershipStatus.message.includes('outdated')) {
                hasCriticalErrors = true;
              }
            }
          } catch (err) {
            console.log('  ⚠️ Network unavailable - cannot verify on-chain status');
            console.log(`  Local validation passed, but on-chain status unknown`);
            // Network error = warning only, not verification failure
          }
        } else if (options.skipNetwork) {
          console.log('\n=== Ownership Status ===');
          console.log('Network verification skipped (--skip-network flag)');
        }

        // ===== TRANSACTION HISTORY DISPLAY =====

        console.log('\n=== Transaction History ===');
        if (tokenJson.transactions && Array.isArray(tokenJson.transactions)) {
          console.log(`Number of transfers: ${tokenJson.transactions.length}`);

          if (tokenJson.transactions.length === 0) {
            console.log('(No transfer transactions - newly minted token)');
          } else {
            tokenJson.transactions.forEach((tx: any, idx: number) => {
              console.log(`\nTransfer ${idx + 1}:`);
              if (tx.data) {
                console.log(`  New Owner: ${tx.data.recipient || 'N/A'}`);
                if (tx.data.salt) {
                  console.log(`  Salt: ${tx.data.salt}`);
                }
              }
            });
          }
        } else {
          console.log('No transaction history');
        }

        // ===== NAMETAGS DISPLAY =====

        if (tokenJson.nametags && Array.isArray(tokenJson.nametags) && tokenJson.nametags.length > 0) {
          console.log('\n=== Nametags ===');
          console.log(`Number of nametags: ${tokenJson.nametags.length}`);
          tokenJson.nametags.forEach((nametag: any, idx: number) => {
            console.log(`  ${idx + 1}. ${JSON.stringify(nametag)}`);
          });
        }

        // ===== VERIFICATION SUMMARY =====

        console.log('\n=== Verification Summary ===');
        console.log(`${!!tokenJson.genesis ? '✓' : '✗'} File format: TXF v${tokenJson.version || '?'}`);
        console.log(`${!!tokenJson.genesis ? '✓' : '✗'} Has genesis: ${!!tokenJson.genesis}`);
        console.log(`${!!tokenJson.state ? '✓' : '✗'} Has state: ${!!tokenJson.state}`);
        console.log(`${!!tokenJson.state?.predicate ? '✓' : '✗'} Has predicate: ${!!tokenJson.state?.predicate}`);
        console.log(`${jsonProofValidation.valid ? '✓' : '✗'} Proof structure valid: ${jsonProofValidation.valid ? 'Yes' : 'No'}`);
        console.log(`${token !== null ? '✓' : '✗'} SDK compatible: ${token !== null ? 'Yes' : 'No'}`);

        if (token && jsonProofValidation.valid && !hasCriticalErrors) {
          console.log('\n✅ This token is valid and can be transferred using the send-token command');
        } else if (token && !hasCriticalErrors) {
          console.log('\n⚠️  Token loaded but has validation issues - transfer may fail');
        } else {
          console.log('\n❌ Token has issues and cannot be used for transfers');
        }

        // ===== EXIT CODE DETERMINATION =====

        if (options.diagnostic) {
          // Diagnostic mode - always exit 0 for CI/reporting
          process.exit(0);
        } else if (hasCriticalErrors) {
          // Verification failed - exit 1
          process.exit(1);
        } else {
          // Success - exit 0
          process.exit(0);
        }

      } catch (error) {
        // ===== UNEXPECTED ERROR HANDLING =====
        console.error(`\n❌ Error verifying token: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error && error.stack) {
          console.error('\nStack trace:');
          console.error(error.stack);
        }

        // Diagnostic mode always exits 0
        if (options.diagnostic) {
          process.exit(0);
        }

        // Determine if this is a usage error or verification error
        if (error instanceof Error &&
            (error.message.includes('ENOENT') ||
             error.message.includes('EACCES') ||
             error.message.includes('required'))) {
          process.exit(2);  // Usage error
        } else {
          process.exit(1);  // Verification error
        }
      }
    });
}
```

### Key Implementation Points

1. **Error tracking**: Use `hasCriticalErrors` boolean throughout
2. **Early exit for usage errors**: File not found, invalid JSON → exit 2 immediately
3. **Accumulate verification failures**: Don't exit early, show all issues, then exit 1
4. **Network errors are warnings**: Network unavailable doesn't fail verification
5. **Diagnostic mode bypass**: Check `options.diagnostic` at exit points only

---

## 4. Flag Design: --diagnostic

### Purpose
Provide backward compatibility and support CI/CD reporting use cases where exit code 0 is required regardless of verification status.

### Behavior
```bash
# Default: Strict mode (exit 1 on failure)
verify-token -f tampered.txf
# Output: ❌ Token has issues...
# Exit: 1

# Diagnostic mode: Report but don't fail
verify-token -f tampered.txf --diagnostic
# Output: ❌ Token has issues...
# Exit: 0
```

### Use Cases

**Use Case 1: Production validation pipeline**
```bash
#!/bin/bash
# Strict validation - fail on any issue
if verify-token -f token.txf --local; then
    send-token -f token.txf -r "$RECIPIENT" --local
else
    echo "Verification failed with exit code $?" >&2
    exit 1
fi
```

**Use Case 2: CI/CD reporting (don't fail build)**
```bash
#!/bin/bash
# Generate verification report without failing CI
for token in artifacts/*.txf; do
    echo "=== Verifying $token ===" >> report.txt
    verify-token -f "$token" --local --diagnostic >> report.txt 2>&1
done

# Report generated, CI continues regardless
```

**Use Case 3: Batch verification with summary**
```bash
#!/bin/bash
# Check all tokens, summarize results
valid=0
invalid=0

for token in *.txf; do
    if verify-token -f "$token" --local; then
        ((valid++))
    else
        ((invalid++))
        echo "INVALID: $token (exit code $?)" >&2
    fi
done

echo "Results: $valid valid, $invalid invalid"
exit $invalid  # Exit with count of failures
```

### Alternative Considered: --strict flag

**Rejected approach:**
```bash
# Default: Diagnostic (exit 0 always) - OLD BEHAVIOR
verify-token -f token.txf

# Strict mode: Exit 1 on failure - NEW BEHAVIOR
verify-token -f token.txf --strict
```

**Why rejected:**
1. **Violates Unix convention**: Verification tools fail by default
2. **Security risk**: Scripts might forget --strict, silently accept invalid tokens
3. **Test suite expects strict**: Would require updating all test assertions
4. **Principle of least surprise**: Users expect `if verify; then use; fi` to work correctly

---

## 5. Documentation Standards

### Command Help Output

```
verify-token - Verify and display detailed information about a token file

USAGE:
  npm run verify-token -- -f <file> [options]

OPTIONS:
  -f, --file <file>        Token file to verify (required)
  -e, --endpoint <url>     Aggregator endpoint URL (default: https://gateway.unicity.network)
  --local                  Use local aggregator (http://localhost:3000)
  --skip-network           Skip network ownership verification
  --diagnostic             Display verification info without failing (exit 0 always)
  -h, --help               Display this help

EXIT CODES:
  0   Token is valid and can be used
  1   Verification failed (invalid, tampered, or spent)
  2   Usage error (file not found, invalid arguments)

EXAMPLES:
  # Verify token before sending
  npm run verify-token -- -f token.txf --local

  # Verify token structure only (skip network check)
  npm run verify-token -- -f token.txf --skip-network

  # Generate diagnostic report (always exit 0)
  npm run verify-token -- -f token.txf --diagnostic > report.txt

SCRIPT USAGE:
  # Use in conditional
  if npm run verify-token -- -f token.txf --local; then
      echo "Token is valid"
      npm run send-token -- -f token.txf -r "$RECIPIENT"
  else
      echo "Token verification failed (exit $?)"
      exit 1
  fi

  # Validate all tokens in pipeline
  npm run verify-token -- -f token.txf --local && npm run send-token -- ...
```

### README.md Section

```markdown
## Exit Codes

The Unicity CLI follows standard Unix conventions for exit codes:

| Exit Code | Meaning | Commands |
|-----------|---------|----------|
| 0 | Success | All commands on success |
| 1 | Verification/operation failed | verify-token (invalid), send-token (transfer failed) |
| 2 | Usage error | All commands (file not found, invalid args) |

### verify-token Exit Codes

The `verify-token` command follows the same pattern as `gpg --verify`, `openssl verify`, and `git verify-commit`:

```bash
# Exit 0: Token is valid
$ npm run verify-token -- -f valid.txf --local
✅ This token is valid and can be transferred
$ echo $?
0

# Exit 1: Verification failed (tampered token)
$ npm run verify-token -- -f tampered.txf --local
❌ Token has issues and cannot be used
$ echo $?
1

# Exit 2: Usage error (file not found)
$ npm run verify-token -- -f nonexistent.txf
Error: File not found: nonexistent.txf
$ echo $?
2
```

### Diagnostic Mode

Use `--diagnostic` to display verification information without failing:

```bash
# Always exits 0, useful for CI reporting
$ npm run verify-token -- -f token.txf --diagnostic > report.txt
$ echo $?
0
```

### Script Integration

**Pattern 1: Fail-fast validation**
```bash
#!/bin/bash
# Exit immediately if token is invalid
npm run verify-token -- -f token.txf --local || exit 1
npm run send-token -- -f token.txf -r "$RECIPIENT" --local
```

**Pattern 2: Conditional logic**
```bash
#!/bin/bash
if npm run verify-token -- -f token.txf --local; then
    echo "Token valid, proceeding with transfer"
    npm run send-token -- -f token.txf -r "$RECIPIENT" --local
else
    echo "Token verification failed with exit code $?"
    exit 1
fi
```

**Pattern 3: Batch validation**
```bash
#!/bin/bash
for token in *.txf; do
    npm run verify-token -- -f "$token" --local || {
        echo "FAILED: $token"
        exit 1
    }
done
echo "All tokens validated successfully"
```
```

### API Reference Update

```markdown
## verify-token

Verify and display detailed information about a token file.

### Syntax

```bash
npm run verify-token -- -f <file> [options]
```

### Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `-f, --file` | string | Yes | - | Token file path (.txf) |
| `-e, --endpoint` | string | No | `https://gateway.unicity.network` | Aggregator endpoint |
| `--local` | flag | No | false | Use local aggregator (port 3000) |
| `--skip-network` | flag | No | false | Skip on-chain status verification |
| `--diagnostic` | flag | No | false | Report mode (always exit 0) |

### Exit Codes

| Code | Meaning | Example Scenarios |
|------|---------|-------------------|
| 0 | Token is valid | All checks pass, token can be used |
| 1 | Verification failed | Tampered token, invalid proof, token spent |
| 2 | Usage error | File not found, invalid JSON, missing argument |

### Verification Checks

The command performs these checks in order:

1. **File validation**: File exists, readable, valid JSON
2. **Structure validation**: Has genesis, state, predicate
3. **Proof validation**: Authenticators present and valid
4. **SDK compatibility**: Token.fromJSON() succeeds
5. **Cryptographic verification**: Signatures and merkle paths valid
6. **Network status** (unless --skip-network): Token not spent on-chain

### Examples

**Basic verification:**
```bash
npm run verify-token -- -f token.txf --local
```

**Offline verification (skip network check):**
```bash
npm run verify-token -- -f token.txf --skip-network
```

**Generate report without failing:**
```bash
npm run verify-token -- -f token.txf --diagnostic > verification-report.txt
```

**Verify before transfer in script:**
```bash
#!/bin/bash
if npm run verify-token -- -f "$TOKEN" --local; then
    npm run send-token -- -f "$TOKEN" -r "$RECIPIENT" --local
else
    echo "Token verification failed" >&2
    exit 1
fi
```

### Output Format

The command displays:
- Basic information (version, token ID, token type)
- Genesis transaction details
- Proof validation results
- Current state and predicate
- Ownership status (from network query)
- Transaction history
- Verification summary

### Error Messages

| Message | Exit Code | Meaning |
|---------|-----------|---------|
| "Error: --file option is required" | 2 | Missing required argument |
| "Error: File not found: {path}" | 2 | Invalid file path |
| "Error: Invalid JSON syntax" | 2 | Malformed JSON file |
| "❌ Failed to decode predicate" | 1 | Tampered or corrupted token |
| "❌ Proof validation failed" | 1 | Missing or invalid authenticator |
| "❌ Cryptographic verification failed" | 1 | Invalid signature or merkle path |
| "❌ Token has been spent" | 1 | Token already used on-chain |
| "⚠️ Network unavailable" | 0 | Warning only (not a failure) |

### Diagnostic Mode

When `--diagnostic` is used:
- All verification checks still run
- All errors and warnings are displayed
- Exit code is always 0 (success)

**Use cases for diagnostic mode:**
- CI/CD reporting (don't fail build)
- Generating verification reports
- Inspecting invalid tokens without script failures

### Related Commands

- `mint-token`: Create new tokens
- `send-token`: Transfer tokens (requires valid token)
- `receive-token`: Complete offline transfers
- `gen-address`: Generate recipient addresses
```

---

## 6. Test Suite Design

### Test File Structure

```
tests/
├── functional/
│   ├── test_verify_token.bats          # Existing: Basic verification (10 tests)
│   └── test_verify_exit_codes.bats     # NEW: Exit code testing (10 tests)
├── security/
│   ├── test_cryptographic.bats         # Existing: Expects assert_failure for tampered
│   └── test_authentication.bats        # Existing: Expects assert_failure for invalid
└── edge-cases/
    └── test_verify_edge_cases.bats     # Existing: Malformed files, etc.
```

### New Test File: test_verify_exit_codes.bats

See implementation in EXIT_CODE_IMPLEMENTATION_CHECKLIST.md, Phase 3.

### Existing Test Verification

**Tests that already expect correct behavior:**

1. `tests/security/test_cryptographic.bats`:
   - Lines 142-147: Tampered authenticator → `assert_failure`
   - Lines 172-176: Tampered merkle path → `assert_failure`

2. `tests/security/test_authentication.bats`:
   - Tampered token verification → `assert_failure`

**Tests that need no changes:**

All functional tests in `test_verify_token.bats` test valid tokens and expect `assert_success`, which is correct.

### Test Coverage Matrix

| Scenario | Test File | Test ID | Expected Exit | Status |
|----------|-----------|---------|---------------|--------|
| Valid token | test_verify_token.bats | VERIFY_TOKEN-001 | 0 | ✅ Exists |
| Tampered token | test_verify_exit_codes.bats | EXIT_CODE-004 | 1 | ⭕ New |
| File not found | test_verify_exit_codes.bats | EXIT_CODE-002 | 2 | ⭕ New |
| Invalid JSON | test_verify_exit_codes.bats | EXIT_CODE-003 | 2 | ⭕ New |
| Invalid proof | test_cryptographic.bats | SEC-CRYPTO-001 | 1 | ✅ Exists |
| Network down | test_verify_exit_codes.bats | EXIT_CODE-008 | 0 | ⭕ New |
| Diagnostic mode | test_verify_exit_codes.bats | EXIT_CODE-006 | 0 | ⭕ New |
| Missing flag | test_verify_exit_codes.bats | EXIT_CODE-009 | 2 | ⭕ New |
| Script usage | test_verify_exit_codes.bats | EXIT_CODE-010 | varies | ⭕ New |

**Coverage target: 10 new tests + 15 existing tests = 25 total exit code scenarios**

---

## 7. Breaking Change Management

### Is This Actually a Breaking Change?

**Analysis:**

1. **Current behavior is a bug**: Exit 0 on verification failure violates Unix convention
2. **Test suite expects correct behavior**: Security tests already use `assert_failure`
3. **No documented contract**: README doesn't promise exit 0 on failure
4. **Security implication**: Current behavior is unsafe for scripts

**Conclusion:** This is a **bug fix**, not a breaking change. However, treat it as breaking change out of caution.

### Semantic Versioning Decision

**Recommendation: Bump to v1.7.0** (minor version, not patch)

**Rationale:**
- It's a bug fix, but affects behavior
- Adds new feature (--diagnostic flag)
- Conservative approach: signal behavioral change

**Alternative: v2.0.0** (major version)
- Only if strictly following SemVer for public API
- Overkill for CLI tool in RC stage

### Migration Guide

```markdown
## Migration Guide: v1.6.x → v1.7.0

### verify-token Exit Code Behavior Change

**What changed:**
The `verify-token` command now returns correct exit codes:
- Exit 0 only when token is valid
- Exit 1 when verification fails
- Exit 2 for usage errors (file not found, etc.)

**Why this changed:**
The previous behavior (exit 0 always) was a bug that:
- Violated Unix conventions
- Made scripts unsafe (invalid tokens not caught)
- Contradicted test expectations

**Impact assessment:**

| Your Usage | Impact | Action Required |
|------------|--------|-----------------|
| Interactive CLI use | None | None - output unchanged |
| Scripts: `npm run verify-token -- ...` | **High** | Update scripts (see below) |
| CI/CD pipelines | **Medium** | Add --diagnostic flag |
| Manual testing | None | None |

**Migration steps:**

**Scenario 1: You want verification to fail scripts (recommended)**
```bash
# Before (v1.6.x) - verification failure didn't stop script
npm run verify-token -- -f token.txf
npm run send-token -- -f token.txf -r "$RECIPIENT"

# After (v1.7.0) - no change needed, now works correctly!
npm run verify-token -- -f token.txf || exit 1
npm run send-token -- -f token.txf -r "$RECIPIENT"
```

**Scenario 2: You want to inspect tokens without failing scripts**
```bash
# Before (v1.6.x) - always passed
npm run verify-token -- -f token.txf

# After (v1.7.0) - use --diagnostic flag
npm run verify-token -- -f token.txf --diagnostic
```

**Scenario 3: CI/CD that generates reports**
```bash
# Before (v1.6.x)
for token in *.txf; do
    npm run verify-token -- -f "$token" > "report-$token.txt"
done

# After (v1.7.0) - add --diagnostic
for token in *.txf; do
    npm run verify-token -- -f "$token" --diagnostic > "report-$token.txt"
done
```

**Scenario 4: Conditional logic (now works correctly!)**
```bash
# Before (v1.6.x) - didn't work (always succeeded)
if npm run verify-token -- -f token.txf; then
    echo "Valid"
fi

# After (v1.7.0) - works correctly now!
if npm run verify-token -- -f token.txf; then
    echo "Valid"
else
    echo "Invalid (exit code $?)"
fi
```

### Testing Your Migration

Run this script to verify your scripts work with v1.7.0:

```bash
#!/bin/bash
# test-v1.7-migration.sh

echo "=== Testing verify-token exit codes ==="

# Test 1: Valid token should exit 0
SECRET="test" npm run mint-token -- --local -d '{}' --save > /dev/null
TOKEN=$(ls -t *.txf | head -1)
if npm run verify-token -- -f "$TOKEN" --local > /dev/null 2>&1; then
    echo "✅ Valid token: exit 0 (correct)"
else
    echo "❌ Valid token: exit $? (incorrect - should be 0)"
    exit 1
fi

# Test 2: Invalid token should exit 1
echo '{"broken": "json"}' > broken.txf
if npm run verify-token -- -f broken.txf > /dev/null 2>&1; then
    echo "❌ Invalid token: exit 0 (incorrect - should be 1)"
    exit 1
else
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 1 ] || [ $EXIT_CODE -eq 2 ]; then
        echo "✅ Invalid token: exit $EXIT_CODE (correct)"
    else
        echo "❌ Invalid token: exit $EXIT_CODE (unexpected)"
        exit 1
    fi
fi

# Test 3: Diagnostic mode should always exit 0
if npm run verify-token -- -f broken.txf --diagnostic > /dev/null 2>&1; then
    echo "✅ Diagnostic mode: exit 0 (correct)"
else
    echo "❌ Diagnostic mode: exit $? (incorrect - should be 0)"
    exit 1
fi

echo ""
echo "✅ All migration tests passed!"
echo "Your scripts should work correctly with v1.7.0"
```

### Rollback Plan

If critical issues discovered after release:

**Option 1: Hotfix release v1.7.1**
- Swap default: diagnostic mode by default, --strict for new behavior
- Gives users time to migrate

**Option 2: Revert to v1.6.x**
- Tag v1.7.0 as beta, revert main to v1.6.x
- Redesign with --strict flag in v1.8.0

**Option 3: Configuration option**
```bash
# Add to ~/.unicityrc or environment variable
UNICITY_VERIFY_DIAGNOSTIC_DEFAULT=1
```
```

---

## 8. Implementation Timeline

### Phase 1: Code Changes (1-2 hours)
1. Update verify-token.ts with exit code logic
2. Add --diagnostic flag
3. Update command description

### Phase 2: Documentation (1 hour)
1. Update README.md exit code section
2. Update API reference
3. Create CHANGELOG.md entry
4. Update getting-started.md examples

### Phase 3: Testing (1-2 hours)
1. Create test_verify_exit_codes.bats (10 tests)
2. Run existing test suites (verify no regressions)
3. Manual testing with scripts

### Phase 4: Release (30 minutes)
1. Update package.json version
2. Build and lint
3. Git commit with detailed message
4. Tag release
5. Update documentation website

**Total time: 4-6 hours**

---

## 9. Success Criteria

✅ **Code:**
- [ ] All 10 exit code tests pass
- [ ] All existing security tests pass (assert_failure works)
- [ ] All existing functional tests pass
- [ ] No lint errors

✅ **Documentation:**
- [ ] Command help shows exit codes
- [ ] README.md has exit code reference
- [ ] API reference updated
- [ ] CHANGELOG.md entry created

✅ **Testing:**
- [ ] Valid token exits 0
- [ ] Tampered token exits 1
- [ ] File not found exits 2
- [ ] --diagnostic always exits 0
- [ ] Script conditional patterns work

✅ **Validation:**
- [ ] Manual script testing passes
- [ ] CI/CD patterns documented
- [ ] Migration guide complete
- [ ] Rollback plan documented

---

## 10. Reference: Unix Tool Exit Code Survey

### Verification Tools

| Tool | Command | Exit 0 | Exit 1 | Exit 2+ |
|------|---------|--------|--------|---------|
| GPG | `gpg --verify sig file` | Valid sig | Bad sig | General error |
| OpenSSL | `openssl verify cert.pem` | Cert valid | Verify fail | Usage error |
| Git | `git verify-commit HEAD` | Sig valid | No/invalid sig | Usage error |
| PGP | `pgpverify sig file` | Valid | Invalid | Error |

### Checksum Tools

| Tool | Command | Exit 0 | Exit 1 | Exit 2+ |
|------|---------|--------|--------|---------|
| sha256sum | `sha256sum -c checksums` | All match | Any mismatch | File error |
| md5sum | `md5sum -c checksums` | All match | Any mismatch | File error |
| b2sum | `b2sum -c checksums` | All match | Any mismatch | File error |

### Comparison Tools

| Tool | Command | Exit 0 | Exit 1 | Exit 2+ |
|------|---------|--------|--------|---------|
| diff | `diff file1 file2` | Identical | Different | Error |
| cmp | `cmp file1 file2` | Identical | Different | Error |
| test | `test -f file` | True | False | N/A |

### Key Principles

1. **Exit 0 = Success**: Verification passed, content is valid
2. **Exit 1 = Verification failed**: Content is invalid, untrusted, or doesn't match
3. **Exit 2 = Usage error**: Cannot perform verification (file missing, bad args)
4. **Never exit 0 on failure**: Security-critical tools must fail loudly

---

## Appendix: Quick Reference Card

```
╔═══════════════════════════════════════════════════════════════════╗
║  verify-token EXIT CODE QUICK REFERENCE                          ║
╠═══════════════════════════════════════════════════════════════════╣
║  EXIT CODE │ MEANING          │ EXAMPLE SCENARIOS                ║
╠════════════╪══════════════════╪══════════════════════════════════╣
║     0      │ Valid token      │ • All checks pass                ║
║            │                  │ • Token can be used              ║
║            │                  │ • Network down (with warning)    ║
╟────────────┼──────────────────┼──────────────────────────────────╢
║     1      │ Verify failed    │ • Tampered token                 ║
║            │                  │ • Invalid proof signature        ║
║            │                  │ • CBOR decode failure            ║
║            │                  │ • Token spent on network         ║
║            │                  │ • SDK rejected token             ║
╟────────────┼──────────────────┼──────────────────────────────────╢
║     2      │ Usage error      │ • File not found                 ║
║            │                  │ • Invalid JSON syntax            ║
║            │                  │ • Permission denied              ║
║            │                  │ • Missing --file flag            ║
╚════════════╧══════════════════╧══════════════════════════════════╝

FLAGS:
  --diagnostic    Always exit 0 (for CI/CD reporting)

SCRIPT PATTERNS:
  # Pattern 1: Fail-fast
  verify-token -f token.txf || exit 1

  # Pattern 2: Conditional
  if verify-token -f token.txf; then use-token; fi

  # Pattern 3: Diagnostic
  verify-token -f token.txf --diagnostic > report.txt

FOLLOWS UNIX CONVENTION:
  ✅ gpg --verify      (0=valid, 1=invalid, 2=error)
  ✅ openssl verify    (0=valid, 1=invalid, 2=error)
  ✅ git verify-commit (0=valid, 1=invalid, 2=error)
```

---

**END OF GUIDE**

For implementation, proceed with checklist in:
`/home/vrogojin/cli/EXIT_CODE_IMPLEMENTATION_CHECKLIST.md`
