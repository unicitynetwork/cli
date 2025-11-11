# verify-token Exit Code Implementation Example

This document provides the exact code changes needed to implement proper exit codes in `verify-token`.

## File: `src/commands/verify-token.ts`

### Change 1: Add exit code tracking variable

**Location:** Line 205, inside the `.action()` handler

```typescript
.action(async (options) => {
  let exitCode = 0;  // Track critical failures (0=success, 1=validation failure)
  
  try {
    // Check if file option is provided
    if (!options.file) {
```

### Change 2: Update command description

**Location:** Line 200

```typescript
.description('Verify and display detailed information about a token file. Exit codes: 0=valid, 1=validation failure, 2=file error')
```

### Change 3: Exit 1 on critical JSON proof failures

**Location:** After line 238 (after jsonProofValidation)

```typescript
if (jsonProofValidation.valid) {
  console.log('✅ All proofs structurally valid');
  console.log('  ✓ Genesis proof has authenticator');
  if (tokenJson.transactions && tokenJson.transactions.length > 0) {
    console.log(`  ✓ All transaction proofs have authenticators (${tokenJson.transactions.length} transaction${tokenJson.transactions.length !== 1 ? 's' : ''})`);
  }
} else {
  console.log('❌ Proof validation failed:');
  jsonProofValidation.errors.forEach(err => console.log(`  - ${err}`));
  
  // Check for critical proof failures
  const hasCriticalProofFailure = jsonProofValidation.errors.some(err =>
    err.includes('Authenticator is null') ||
    err.includes('Transaction hash is null') ||
    err.includes('missing signature') ||
    err.includes('missing authenticator') ||
    err.includes('Merkle tree path is missing') ||
    err.includes('Unicity certificate is missing')
  );
  
  if (hasCriticalProofFailure) {
    exitCode = 1;
  }
}
```

### Change 4: Exit 1 on SDK load failure

**Location:** Replace lines 282-285 (catch block)

```typescript
} catch (err) {
  console.log('\n⚠ Could not load token with SDK:', err instanceof Error ? err.message : String(err));
  console.log('Displaying raw JSON data...\n');
  exitCode = 1;  // SDK cannot load token = invalid token
}
```

### Change 5: Exit 1 on cryptographic verification failure

**Location:** After line 276 (after sdkProofValidation)

```typescript
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
  
  // Check for signature verification failures
  const hasSignatureFailure = sdkProofValidation.errors.some(err =>
    err.includes('signature verification failed') ||
    err.includes('Authenticator verification threw error') ||
    err.includes('verify() threw error')
  );
  
  if (hasSignatureFailure) {
    exitCode = 1;
  }
}
```

### Change 6: Exit 1 on missing required fields

**Location:** After line 393 (after verification summary)

```typescript
console.log(`${token !== null ? '✓' : '✗'} SDK compatible: ${token !== null ? 'Yes' : 'No'}`);

// Check for missing required fields
if (!tokenJson.genesis || !tokenJson.state || !tokenJson.state?.predicate) {
  console.log('\n❌ Token missing required fields (genesis, state, or predicate)');
  exitCode = 1;
}
```

### Change 7: Final exit status

**Location:** Replace lines 395-401 (final summary messages)

```typescript
// Display final status based on validation results
if (exitCode === 0 && token && jsonProofValidation.valid) {
  console.log('\n✅ This token is valid and can be transferred using the send-token command');
} else if (exitCode === 0 && token && !jsonProofValidation.valid) {
  console.log('\n⚠️  Token loaded but has proof validation issues - transfer may fail');
  exitCode = 1;  // Proof issues = invalid token
} else if (exitCode !== 0) {
  console.log('\n❌ Token has critical validation failures and cannot be used for transfers');
}

// Exit with appropriate code
if (exitCode !== 0) {
  process.exit(exitCode);
}
```

### Change 8: Update file error exit code

**Location:** Line 409 (catch block for file I/O)

```typescript
} catch (error) {
  console.error(`\n❌ Error verifying token: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }
  process.exit(2);  // Changed from 1 to 2 for file I/O errors
}
```

---

## Complete Modified Function Structure

Here's the high-level structure with exit code handling:

```typescript
export function verifyTokenCommand(program: Command): void {
  program
    .command('verify-token')
    .description('Verify and display detailed information about a token file. Exit codes: 0=valid, 1=validation failure, 2=file error')
    .option('-f, --file <file>', 'Token file to verify (required)')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('--local', 'Use local aggregator (http://localhost:3000)')
    .option('--skip-network', 'Skip network ownership verification')
    .action(async (options) => {
      let exitCode = 0;  // Track validation failures
      
      try {
        // File option check (already exists)
        if (!options.file) {
          console.error('Error: --file option is required');
          process.exit(1);
        }
        
        // Read and parse JSON (already exists)
        const tokenFileContent = fs.readFileSync(options.file, 'utf8');
        const tokenJson = JSON.parse(tokenFileContent);
        
        // Basic info display (already exists)
        console.log('=== Basic Information ===');
        
        // JSON proof validation (ADD exit code check)
        const jsonProofValidation = validateTokenProofsJson(tokenJson);
        if (!jsonProofValidation.valid) {
          // Check for critical failures
          if (hasCriticalProofFailure) {
            exitCode = 1;
          }
        }
        
        // SDK load (ADD exit code on failure)
        let token: Token<any> | null = null;
        try {
          token = await Token.fromJSON(tokenJson);
        } catch (err) {
          console.log('⚠ Could not load token with SDK:', err.message);
          exitCode = 1;  // ADD THIS
        }
        
        // Cryptographic verification (ADD exit code check)
        if (token) {
          const sdkProofValidation = await validateTokenProofs(token, trustBase);
          if (!sdkProofValidation.valid) {
            // Check for signature failures
            if (hasSignatureFailure) {
              exitCode = 1;
            }
          }
        }
        
        // Display genesis, state, history (already exists)
        displayGenesis(tokenJson.genesis);
        // ... other displays ...
        
        // Ownership status (already exists, no exit code change)
        if (!options.skipNetwork && token) {
          // Network checks (warnings only, don't set exitCode)
        }
        
        // Verification summary (ADD missing field check)
        console.log('=== Verification Summary ===');
        if (!tokenJson.genesis || !tokenJson.state || !tokenJson.state?.predicate) {
          exitCode = 1;
        }
        
        // Final status and exit
        if (exitCode === 0 && token && jsonProofValidation.valid) {
          console.log('✅ Token is valid');
        } else {
          console.log('❌ Token has validation failures');
        }
        
        if (exitCode !== 0) {
          process.exit(exitCode);
        }
        
      } catch (error) {
        // File I/O errors
        console.error(`❌ Error verifying token: ${error.message}`);
        process.exit(2);  // Changed from 1 to 2
      }
    });
}
```

---

## Testing the Implementation

### Test 1: Valid token should exit 0

```bash
# Mint a valid token
SECRET="test" npm run mint-token -- --local --save

# Verify it (should exit 0)
npm run verify-token -- -f *.txf --local
echo "Exit code: $?"  # Should print "Exit code: 0"
```

### Test 2: Tampered token should exit 1

```bash
# Create tampered token
jq '.state.predicate = "ffffffff"' valid-token.txf > tampered.txf

# Verify it (should exit 1)
npm run verify-token -- -f tampered.txf --local
echo "Exit code: $?"  # Should print "Exit code: 1"
```

### Test 3: Missing file should exit 2

```bash
# Try to verify non-existent file (should exit 2)
npm run verify-token -- -f does-not-exist.txf
echo "Exit code: $?"  # Should print "Exit code: 2"
```

### Test 4: Invalid JSON should exit 2

```bash
# Create invalid JSON file
echo "not valid json" > invalid.txf

# Verify it (should exit 2)
npm run verify-token -- -f invalid.txf
echo "Exit code: $?"  # Should print "Exit code: 2"
```

### Test 5: Missing authenticator should exit 1

```bash
# Remove authenticator from valid token
jq '.genesis.inclusionProof.authenticator = null' valid-token.txf > no-auth.txf

# Verify it (should exit 1)
npm run verify-token -- -f no-auth.txf --local
echo "Exit code: $?"  # Should print "Exit code: 1"
```

---

## Running Security Tests

After implementing the changes, these security tests should pass:

```bash
# Run authentication tests (should now pass)
bats tests/security/test_authentication.bats -f "SEC-AUTH-003"

# Run cryptographic tests (should now pass)
bats tests/security/test_cryptographic.bats

# Run data integrity tests (should now pass)
bats tests/security/test_data_integrity.bats
```

Expected output:
```
✓ SEC-AUTH-003: Masked predicate tampering detection
✓ SEC-CRYPTO-001: Genesis proof signature tampering
✓ SEC-DATA-001: Truncated/corrupted file detection
```

---

## Summary of Changes

**Files Modified:** 1 file (`src/commands/verify-token.ts`)

**Lines Changed:** ~30 lines (8 modification points)

**New Behavior:**
- Exit 0: Token is valid and SDK-compatible
- Exit 1: Token has critical validation failures (CBOR, proof, signature, missing fields)
- Exit 2: File I/O errors (file not found, JSON parse error)

**Breaking Change:** Yes, but security tests already expect this behavior

**Migration Path:** None needed (fixing incorrect behavior)

**Documentation Updates:**
- Command description (inline)
- API reference (separate PR)
- CHANGELOG.md (separate PR)

---

## Rollout Strategy

1. **Implement changes** (this document)
2. **Run full test suite** to verify no regressions
3. **Update CHANGELOG.md** with breaking change notice:
   ```markdown
   ### BREAKING CHANGES
   
   - **verify-token:** Now exits with code 1 when validation failures are detected. 
     Previously, the command would exit 0 even for tampered or invalid tokens.
     This is a security fix. Exit codes:
     - 0: Token is valid
     - 1: Validation failure (tampered, invalid proof, missing fields)
     - 2: File I/O error
   ```
4. **Update docs/reference/api-reference.md** with exit code section
5. **Commit and push** with message:
   ```
   Fix verify-token exit codes - exit 1 on validation failures
   
   BREAKING CHANGE: verify-token now returns exit code 1 when critical
   validation failures are detected (CBOR decode errors, invalid proofs,
   missing authenticators, etc). Previously it would exit 0 even for
   tampered tokens.
   
   This is a security fix. The previous behavior violated UNIX conventions
   and gave false confidence about token validity.
   
   Exit codes:
   - 0: Token is valid and SDK-compatible
   - 1: Critical validation failure
   - 2: File I/O error
   
   Fixes security tests: SEC-AUTH-003, SEC-CRYPTO-001, SEC-DATA-*
   ```

---

## Quick Reference: What Triggers Exit 1?

1. SDK cannot load token (`Token.fromJSON()` fails)
2. CBOR decode failure ("Major type mismatch")
3. Missing authenticator (`proof.authenticator === null`)
4. Missing transaction hash (`proof.transactionHash === null`)
5. Invalid authenticator signature (`authenticator.verify()` fails)
6. Missing genesis transaction
7. Missing state object
8. Missing predicate in state
9. Missing critical proof fields (merkle path, unicity certificate)

**Does NOT trigger exit 1:**
- Network unavailable (cannot check ownership)
- Token spent on-chain (outdated state)
- UnicityCertificate mismatch (local testing)
- Missing optional fields (nametags)
