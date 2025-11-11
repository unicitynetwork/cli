# verify-token Exit Code Analysis & Implementation Guide

**Date:** 2025-11-11  
**Author:** Unicity SDK Expert  
**Status:** Production-Ready Implementation Plan

## Executive Summary

The `verify-token` command currently exits with code 0 even when **major cryptographic verification failures** occur. Based on security test analysis and SDK best practices, this is **incorrect behavior**. The command should exit non-zero when critical validation failures are detected.

**Recommendation:** Implement **Option B: Moderate Exit Strategy** with clear separation between:
- **Exit 0:** Structural validity (diagnostic success)
- **Exit 1:** Critical security failures (CBOR decode, proof signature, state hash)
- **Exit 2:** File I/O errors

---

## 1. Current Behavior Analysis

### Code Examination: `src/commands/verify-token.ts`

**Line 282-285:** Token loading failure
```typescript
catch (err) {
  console.log('\n⚠ Could not load token with SDK:', err.message);
  console.log('Displaying raw JSON data...\n');
}
// NO process.exit() - continues execution
```

**Line 404-409:** General error handler
```typescript
catch (error) {
  console.error(`\n❌ Error verifying token: ${error.message}`);
  process.exit(1);  // ✓ Only exits on file I/O errors
}
```

**Lines 226-281:** Proof validation
```typescript
const jsonProofValidation = validateTokenProofsJson(tokenJson);
if (!jsonProofValidation.valid) {
  console.log('❌ Proof validation failed:');
  jsonProofValidation.errors.forEach(err => console.log(`  - ${err}`));
}
// NO process.exit() - continues showing diagnostics
```

### Test Expectations

**Security Test `SEC-AUTH-003` (Line 232-233):**
```bash
run_cli "verify-token -f ${tampered_token} --local"
assert_failure  # ← Test expects exit code ≠ 0
```

**Current Reality:** This test is **failing** because verify-token exits 0 even for tampered tokens.

---

## 2. Major Verification Failure Categories

### 2.1 Critical Security Failures (MUST exit 1)

These indicate **cryptographic compromise** or **malicious tampering**:

| Failure Type | Detection Location | SDK Impact | Security Risk |
|-------------|-------------------|------------|---------------|
| **CBOR decode failure** | `Token.fromJSON()` → "Major type mismatch" | SDK cannot load token | HIGH - Predicate tampered |
| **State hash mismatch** | Proof validation → `validateTokenProofs()` | Token cannot be transferred | HIGH - Data integrity violated |
| **Invalid authenticator signature** | `proof.authenticator.verify()` | Proof is forged | CRITICAL - Not recorded in blockchain |
| **Missing authenticator** | `proof.authenticator === null` | Incomplete proof | CRITICAL - No proof of inclusion |
| **SDK Token.fromJSON() failure** | Line 248 catch block | Token structure invalid | HIGH - Cannot be used |

### 2.2 Structural Failures (MUST exit 1)

File is not a valid TXF format:

- JSON parse failure → Already exits 1 (line 409)
- Missing `genesis` field
- Missing `state` field
- Missing `state.predicate`
- File not found → Already exits 1 (line 409)

### 2.3 Non-Critical Issues (Exit 0 acceptable)

These are **informational** and don't prevent token usage:

- Network unavailable (cannot check ownership status)
- Token is spent on-chain (outdated state)
- UnicityCertificate mismatch (local testing environment)
- Missing optional fields (nametags, etc.)

---

## 3. Recommended Exit Code Strategy: **Option B (Moderate)**

### Exit Code Definitions

```
Exit 0: Token is structurally valid and SDK-compatible
        - File parsed successfully
        - Token.fromJSON() succeeded
        - All proofs have authenticators
        - May have warnings (network issues, spent status)

Exit 1: Critical validation failure
        - CBOR decode failure
        - State hash mismatch
        - Invalid authenticator signature
        - Missing required fields (genesis, state, predicate)
        - SDK cannot load token

Exit 2: File I/O error
        - File not found
        - JSON parse error
        - Permission denied
```

### Why Option B?

1. **Security Test Compatibility:** Tests expect exit 1 for tampered tokens
2. **SDK Alignment:** Token.fromJSON() failure = unusable token
3. **Clear Signal:** Exit 0 means "token can be transferred", exit 1 means "token is invalid"
4. **Backwards Compatibility:** Users checking `$?` get meaningful result

---

## 4. Conditions That Should Exit 1 (Detailed)

### 4.1 SDK Load Failure (Line 282)
```typescript
try {
  token = await Token.fromJSON(tokenJson);
} catch (err) {
  console.log('❌ Could not load token with SDK:', err.message);
  process.exit(1);  // ← ADD THIS
}
```

**Rationale:** If SDK cannot load, token cannot be transferred or received.

### 4.2 CBOR Decode Failure
```typescript
displayPredicateInfo(tokenJson.state.predicate);
// If this throws "Major type mismatch", it's caught at SDK load level
```

**Already handled by SDK load failure above.**

### 4.3 Proof Validation Failure (Line 227-238)
```typescript
const jsonProofValidation = validateTokenProofsJson(tokenJson);
if (!jsonProofValidation.valid) {
  console.log('❌ Proof validation failed:');
  jsonProofValidation.errors.forEach(err => console.log(`  - ${err}`));
  
  // Check for critical proof failures
  const hasCriticalFailure = jsonProofValidation.errors.some(err =>
    err.includes('Authenticator is null') ||
    err.includes('Transaction hash is null') ||
    err.includes('missing signature')
  );
  
  if (hasCriticalFailure) {
    process.exit(1);  // ← ADD THIS
  }
}
```

### 4.4 Cryptographic Verification Failure (Line 264-276)
```typescript
const sdkProofValidation = await validateTokenProofs(token, trustBase);
if (!sdkProofValidation.valid) {
  console.log('❌ Cryptographic verification failed:');
  sdkProofValidation.errors.forEach(err => console.log(`  - ${err}`));
  
  // Check for signature verification failures
  const hasSignatureFailure = sdkProofValidation.errors.some(err =>
    err.includes('signature verification failed') ||
    err.includes('Authenticator verification threw error')
  );
  
  if (hasSignatureFailure) {
    process.exit(1);  // ← ADD THIS
  }
}
```

### 4.5 Missing Critical Fields (Line 388-393)
```typescript
console.log(`${!!tokenJson.genesis ? '✓' : '✗'} Has genesis: ${!!tokenJson.genesis}`);
console.log(`${!!tokenJson.state ? '✓' : '✗'} Has state: ${!!tokenJson.state}`);
console.log(`${!!tokenJson.state?.predicate ? '✓' : '✗'} Has predicate: ${!!tokenJson.state?.predicate}`);

if (!tokenJson.genesis || !tokenJson.state || !tokenJson.state?.predicate) {
  console.log('\n❌ Token missing required fields');
  process.exit(1);  // ← ADD THIS
}
```

---

## 5. Conditions That Should NOT Exit 1

### 5.1 Network Unavailable (Line 346-349)
```typescript
catch (err) {
  console.log('  ⚠ Cannot verify ownership status');
  console.log(`  Error: ${err.message}`);
  // DO NOT exit(1) - just diagnostic
}
```

**Rationale:** Token may be valid but aggregator is offline.

### 5.2 Token Spent/Outdated (Line 339)
```typescript
const ownershipStatus = await checkOwnershipStatus(...);
console.log(`\n${ownershipStatus.message}`);
// DO NOT exit(1) - just informational
```

**Rationale:** Verification succeeded, but token state is old.

### 5.3 UnicityCertificate Mismatch (Line 102-103 of proof-validation.ts)
```typescript
if (sdkStatus === InclusionProofVerificationStatus.PATH_NOT_INCLUDED) {
  warnings.push(`SDK proof.verify() returned: ${sdkStatus} (may be due to UnicityCertificate mismatch in local testing)`);
  // DO NOT exit(1) - local testing environment issue
}
```

**Rationale:** Local Docker aggregator may have different UnicityCertificate.

---

## 6. Implementation Code Structure

### 6.1 Add Exit Code Tracking Variable
```typescript
export function verifyTokenCommand(program: Command): void {
  program
    .command('verify-token')
    .action(async (options) => {
      let exitCode = 0;  // ← ADD THIS
      
      try {
        // ... existing code ...
        
        // Track critical failures
        if (criticalFailure) {
          exitCode = 1;
        }
        
        // At end of action:
        if (exitCode !== 0) {
          process.exit(exitCode);
        }
      } catch (error) {
        // File I/O errors
        console.error(`❌ Error: ${error.message}`);
        process.exit(2);  // ← CHANGE TO 2
      }
    });
}
```

### 6.2 Check Critical Failures at Each Stage
```typescript
// Stage 1: JSON proof validation
const jsonProofValidation = validateTokenProofsJson(tokenJson);
if (!jsonProofValidation.valid) {
  const hasCriticalProofFailure = jsonProofValidation.errors.some(err =>
    err.includes('Authenticator is null') ||
    err.includes('Transaction hash is null') ||
    err.includes('missing signature')
  );
  if (hasCriticalProofFailure) {
    exitCode = 1;
  }
}

// Stage 2: SDK load
try {
  token = await Token.fromJSON(tokenJson);
} catch (err) {
  console.log('❌ Could not load token with SDK:', err.message);
  exitCode = 1;
}

// Stage 3: Cryptographic verification
if (token && sdkProofValidation && !sdkProofValidation.valid) {
  const hasSignatureFailure = sdkProofValidation.errors.some(err =>
    err.includes('signature verification failed')
  );
  if (hasSignatureFailure) {
    exitCode = 1;
  }
}

// Stage 4: Required fields
if (!tokenJson.genesis || !tokenJson.state || !tokenJson.state?.predicate) {
  exitCode = 1;
}

// Stage 5: Final exit
if (exitCode !== 0) {
  console.log('\n❌ Token verification failed');
  process.exit(exitCode);
}
```

---

## 7. Backwards Compatibility Considerations

### Option 1: No Flag (Breaking Change)
- Change exit behavior immediately
- Security tests will pass
- Users checking `$?` get correct signal

**Impact:** Existing scripts may break if they expect exit 0

### Option 2: Add --strict Flag (Gradual Migration)
```bash
verify-token -f token.txf --strict  # Exit 1 on failures
verify-token -f token.txf           # Exit 0 always (old behavior)
```

**Impact:** No breaking changes, users opt-in

### Recommendation: **Option 1 (No Flag)**

**Reasoning:**
1. Current behavior is **objectively wrong** from security perspective
2. Security tests already expect exit 1 behavior
3. `verify-token` is not widely used in production scripts yet
4. Better to fix now than accumulate technical debt

---

## 8. Documentation Updates Required

### 8.1 Command Help Text
```typescript
.description('Verify and display detailed information about a token file. Exit codes: 0=valid, 1=invalid, 2=file error')
```

### 8.2 User Documentation (docs/reference/api-reference.md)
```markdown
### Exit Codes

- **0:** Token is structurally valid and SDK-compatible
- **1:** Critical validation failure (tampered, invalid proof, CBOR error)
- **2:** File I/O error (file not found, JSON parse error)

### Examples

Check if token is valid for transfer:
```bash
if npm run verify-token -- -f token.txf --local; then
  echo "Token is valid"
else
  echo "Token verification failed"
fi
```
```

### 8.3 Test Documentation
Update `tests/security/README.md` to document that tampered tokens MUST fail verification.

---

## 9. Test Scenarios to Verify

### 9.1 Should Exit 1
```bash
# CBOR decode failure
jq '.state.predicate = "ffffffff"' token.txf > tampered.txf
npm run verify-token -- -f tampered.txf --local
echo $?  # Should be 1

# Missing authenticator
jq '.genesis.inclusionProof.authenticator = null' token.txf > no-auth.txf
npm run verify-token -- -f no-auth.txf --local
echo $?  # Should be 1

# Invalid JSON
echo "not json" > invalid.txf
npm run verify-token -- -f invalid.txf
echo $?  # Should be 2 (file error)
```

### 9.2 Should Exit 0
```bash
# Valid token (even if spent on-chain)
npm run verify-token -- -f valid-token.txf --local
echo $?  # Should be 0

# Valid token (network unavailable)
npm run verify-token -- -f valid-token.txf --endpoint http://localhost:9999
echo $?  # Should be 0 (with warnings)

# Valid token (skip network check)
npm run verify-token -- -f valid-token.txf --skip-network
echo $?  # Should be 0
```

---

## 10. Implementation Checklist

- [ ] Add `let exitCode = 0` variable at start of action handler
- [ ] Add exit 1 after SDK load failure (line 282-285)
- [ ] Add exit 1 for critical proof validation failures (line 227-238)
- [ ] Add exit 1 for cryptographic signature failures (line 264-276)
- [ ] Add exit 1 for missing required fields (line 388-393)
- [ ] Change file I/O error exit to code 2 (line 409)
- [ ] Update command description with exit code documentation
- [ ] Update `docs/reference/api-reference.md` with exit code section
- [ ] Update security test expectations (already expect exit 1)
- [ ] Add exit code tests to `tests/functional/test_verify_token.bats`
- [ ] Run full test suite to verify no regressions
- [ ] Update CHANGELOG.md with breaking change notice

---

## 11. SDK Expert Assertions

### On Security
"A verification command that exits 0 for tampered tokens violates the principle of secure-by-default. The SDK's cryptographic validation is meaningless if the CLI silently accepts invalid proofs."

### On SDK Compatibility
"If `Token.fromJSON()` fails with CBOR decode error, the token is **fundamentally unusable**. Continuing execution and exiting 0 gives users false confidence that the token is valid."

### On Exit Codes
"Standard UNIX convention: exit 0 = success, non-zero = failure. A verification tool must follow this convention. Exit 0 should mean 'verification passed', not 'verification completed'."

### On Testing
"The security test `SEC-AUTH-003` is **correct** in expecting exit 1 for tampered tokens. The implementation is wrong, not the test."

### On Backwards Compatibility
"Breaking changes are acceptable when fixing security bugs. This is not a feature change, it's a **security fix**. Document it clearly, ship it immediately."

---

## 12. Performance Considerations

**Impact:** Negligible (< 1ms overhead for exit code checks)

The implementation adds only boolean checks on existing validation results. No additional cryptographic operations or network calls are introduced.

---

## 13. Related Files

**Implementation:**
- `/home/vrogojin/cli/src/commands/verify-token.ts` (primary changes)
- `/home/vrogojin/cli/src/utils/proof-validation.ts` (no changes needed)

**Tests:**
- `/home/vrogojin/cli/tests/security/test_authentication.bats` (already expects exit 1)
- `/home/vrogojin/cli/tests/security/test_cryptographic.bats` (already expects exit 1)
- `/home/vrogojin/cli/tests/functional/test_verify_token.bats` (add exit code tests)

**Documentation:**
- `/home/vrogojin/cli/docs/reference/api-reference.md`
- `/home/vrogojin/cli/CHANGELOG.md`

---

## Conclusion

The current `verify-token` exit behavior is **incorrect from both security and CLI design perspectives**. Implement **Option B: Moderate Exit Strategy** immediately:

1. Exit 0 = Token is valid and SDK-compatible
2. Exit 1 = Critical validation failure (security risk)
3. Exit 2 = File I/O error

This aligns with:
- Security test expectations
- SDK cryptographic validation semantics
- UNIX CLI conventions
- User expectations for verification tools

**Priority:** HIGH (security bug fix)  
**Estimated Implementation Time:** 2-3 hours (including tests)  
**Risk:** LOW (existing tests already expect this behavior)
