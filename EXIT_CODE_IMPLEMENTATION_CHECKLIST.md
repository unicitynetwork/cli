# Exit Code Implementation Checklist for verify-token

## Phase 1: Code Changes

- [ ] **Update command options** in `/home/vrogojin/cli/src/commands/verify-token.ts`
  ```typescript
  .option('--diagnostic', 'Display verification info without failing (exit 0 always)')
  ```

- [ ] **Add exit code tracking variable**
  ```typescript
  let exitCode = 0;  // Track verification status
  let hasCriticalErrors = false;
  ```

- [ ] **Update error handling for file operations** (exit 2)
  ```typescript
  if (!options.file) {
    console.error('Error: --file option is required');
    process.exit(2);  // Usage error
  }

  try {
    const tokenFileContent = fs.readFileSync(options.file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Error: File not found: ${options.file}`);
      process.exit(2);  // Usage error
    }
    throw error;
  }

  try {
    const tokenJson = JSON.parse(tokenFileContent);
  } catch (error) {
    console.error('Error: Invalid JSON syntax');
    process.exit(2);  // Usage error
  }
  ```

- [ ] **Update SDK parsing failures** (exit 1)
  ```typescript
  try {
    token = await Token.fromJSON(tokenJson);
    console.log('✅ Token loaded successfully with SDK');
  } catch (err) {
    console.log('⚠ Could not load token with SDK:', err.message);
    hasCriticalErrors = true;  // Mark as failed
  }
  ```

- [ ] **Update proof validation failures** (exit 1)
  ```typescript
  if (!jsonProofValidation.valid) {
    console.log('❌ Proof validation failed:');
    jsonProofValidation.errors.forEach(err => console.log(`  - ${err}`));
    hasCriticalErrors = true;
  }

  if (sdkProofValidation && !sdkProofValidation.valid) {
    console.log('❌ Cryptographic verification failed:');
    sdkProofValidation.errors.forEach(err => console.log(`  - ${err}`));
    hasCriticalErrors = true;
  }
  ```

- [ ] **Update network status checks** (spent = exit 1, unavailable = warning)
  ```typescript
  const ownershipStatus = await checkOwnershipStatus(...);

  if (ownershipStatus.isSpent) {
    console.log('❌ Token has been spent on network');
    hasCriticalErrors = true;
  } else if (ownershipStatus.networkError) {
    console.log('⚠️  Network unavailable - cannot verify on-chain status');
    // Don't set hasCriticalErrors - graceful degradation
  }
  ```

- [ ] **Update final summary logic**
  ```typescript
  // Summary
  console.log('\n=== Verification Summary ===');
  // ... existing summary ...

  if (token && jsonProofValidation.valid && !hasCriticalErrors) {
    console.log('\n✅ This token is valid and can be transferred');
  } else {
    console.log('\n❌ Token has issues and cannot be used');
  }

  // Exit with appropriate code
  if (options.diagnostic) {
    // Diagnostic mode - always exit 0
    process.exit(0);
  } else if (hasCriticalErrors) {
    process.exit(1);  // Verification failed
  } else {
    process.exit(0);  // Success
  }
  ```

- [ ] **Update catch block** (unexpected errors = exit 1)
  ```typescript
  } catch (error) {
    console.error(`\n❌ Error verifying token: ${error.message}`);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    // Check if this is a file/usage error or verification error
    if (error.code === 'ENOENT' || error.code === 'EACCES') {
      process.exit(2);  // Usage error
    } else {
      process.exit(1);  // Verification error
    }
  }
  ```

## Phase 2: Documentation Updates

- [ ] **Update command description** with exit codes
  ```typescript
  .description(`Verify and display detailed information about a token file

  EXIT CODES:
    0   Token is valid and can be used
    1   Verification failed (invalid, tampered, or spent)
    2   Usage error (file not found, invalid arguments)

  Use --diagnostic to display verification info without failing (always exit 0)`)
  ```

- [ ] **Update README.md** with exit code documentation

- [ ] **Update docs/reference/api-reference.md** with exit code section

- [ ] **Update docs/getting-started.md** with exit code examples

- [ ] **Create CHANGELOG.md entry**
  ```markdown
  ## [1.7.0] - 2025-XX-XX

  ### Fixed
  - **BREAKING**: `verify-token` now correctly returns exit code 1 when verification
    fails, matching standard Unix tool behavior (GPG, OpenSSL, Git)
  - Added `--diagnostic` flag to preserve old behavior (exit 0 always) for CI reporting

  ### Added
  - Exit code 2 for usage errors (file not found, invalid JSON)
  - Comprehensive exit code documentation in command help
  ```

## Phase 3: Test Updates

- [ ] **Create new test file**: `/home/vrogojin/cli/tests/functional/test_verify_exit_codes.bats`
  - Test exit 0 for valid tokens
  - Test exit 1 for tampered tokens
  - Test exit 1 for invalid proofs
  - Test exit 2 for file not found
  - Test exit 2 for invalid JSON
  - Test exit 0 for --diagnostic mode
  - Test exit 0 for network unavailable (warning shown)

- [ ] **Verify existing tests still pass**
  - `tests/security/test_cryptographic.bats` - already expects `assert_failure`
  - `tests/security/test_authentication.bats` - already expects `assert_failure`
  - `tests/functional/test_verify_token.bats` - should still pass

- [ ] **Run full test suite**
  ```bash
  npm test
  npm run test:security
  npm run test:functional
  ```

## Phase 4: Validation

- [ ] **Manual testing scenarios**
  ```bash
  # Valid token - should exit 0
  npm run verify-token -- -f valid.txf --local
  echo $?  # Should be 0

  # Invalid token - should exit 1
  echo '{"broken":"json"}' > broken.txf
  npm run verify-token -- -f broken.txf
  echo $?  # Should be 1

  # File not found - should exit 2
  npm run verify-token -- -f nonexistent.txf
  echo $?  # Should be 2

  # Diagnostic mode - should always exit 0
  npm run verify-token -- -f broken.txf --diagnostic
  echo $?  # Should be 0
  ```

- [ ] **Script integration test**
  ```bash
  #!/bin/bash
  # Test script usage pattern
  if npm run verify-token -- -f token.txf --local; then
      echo "Token valid, proceeding"
      npm run send-token -- -f token.txf -r "$RECIPIENT"
  else
      echo "Token invalid, aborting (exit code $?)"
      exit 1
  fi
  ```

- [ ] **CI/CD integration test**
  ```bash
  # Verify all tokens in directory
  for token in *.txf; do
      npm run verify-token -- -f "$token" --local || exit 1
  done
  ```

## Phase 5: Release

- [ ] **Update version in package.json** to 1.7.0

- [ ] **Build and test**
  ```bash
  npm run build
  npm run lint
  npm test
  ```

- [ ] **Git commit with clear message**
  ```bash
  git add -A
  git commit -m "Fix verify-token exit codes - return 1 on verification failure

  - Add exit code 1 for verification failures (invalid token, tampered proof)
  - Add exit code 2 for usage errors (file not found, invalid JSON)
  - Add --diagnostic flag for legacy behavior (exit 0 always)
  - Update documentation with exit code reference
  - Add comprehensive exit code test suite

  BREAKING CHANGE: verify-token now returns non-zero exit codes on failure.
  Use --diagnostic flag to preserve old behavior.

  Fixes security test expectations that already required assert_failure.
  Aligns with Unix convention (GPG, OpenSSL, Git verify commands).
  "
  ```

- [ ] **Create git tag**
  ```bash
  git tag -a v1.7.0 -m "Release v1.7.0 - Fix verify-token exit codes"
  ```

- [ ] **Update release notes**

## Success Criteria

✅ All existing tests pass
✅ New exit code tests pass (10/10 scenarios)
✅ Security tests pass (tampered tokens fail with exit 1)
✅ Documentation includes exit code reference
✅ Script integration patterns work correctly
✅ Diagnostic mode provides backward compatibility

## Rollback Plan

If issues discovered:
1. Revert commit: `git revert HEAD`
2. Use `--diagnostic` flag becomes default
3. Add `--strict` flag for new behavior
4. Reassess in v1.8.0
