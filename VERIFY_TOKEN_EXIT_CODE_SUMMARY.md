# verify-token Exit Code Fix - Quick Summary

## Problem

`verify-token` exits with code 0 even when **critical security failures** occur:
- CBOR decode failures ("Major type mismatch")
- Invalid authenticator signatures
- Missing inclusion proofs
- Tampered predicates

This violates UNIX conventions and gives false confidence about token validity.

## Solution

Implement proper exit codes:

```
Exit 0: Token is valid and SDK-compatible
Exit 1: Critical validation failure (security issue)
Exit 2: File I/O error (file not found, JSON parse)
```

## Implementation Summary

**File:** `src/commands/verify-token.ts`  
**Changes:** 8 modification points (~30 lines)

### Key Changes

1. Add `let exitCode = 0` tracking variable
2. Set `exitCode = 1` when SDK cannot load token
3. Set `exitCode = 1` when critical proof validation fails
4. Set `exitCode = 1` when cryptographic signatures are invalid
5. Set `exitCode = 1` when required fields are missing
6. Change file I/O errors to exit code 2 (was 1)
7. Update command description with exit code info
8. Call `process.exit(exitCode)` at end if non-zero

## What Triggers Exit 1?

Critical security failures:
- SDK `Token.fromJSON()` fails
- CBOR decode failure
- Missing authenticator (`null`)
- Missing transaction hash (`null`)
- Invalid signature (`authenticator.verify()` fails)
- Missing genesis/state/predicate

## What Does NOT Trigger Exit 1?

Non-critical diagnostic info:
- Network unavailable (aggregator offline)
- Token spent on-chain (outdated state)
- UnicityCertificate mismatch (local testing)

## Why This is Correct

### From Security Perspective
"A verification command that exits 0 for tampered tokens violates secure-by-default. SDK cryptographic validation is meaningless if the CLI silently accepts invalid proofs."

### From SDK Perspective
"If `Token.fromJSON()` fails, the token is **fundamentally unusable**. Continuing and exiting 0 gives false confidence."

### From CLI Design Perspective
"UNIX convention: exit 0 = success, non-zero = failure. Exit 0 should mean 'verification passed', not 'verification completed'."

### From Testing Perspective
"Security test `SEC-AUTH-003` **correctly** expects exit 1 for tampered tokens. The implementation is wrong, not the test."

## Testing Strategy

```bash
# Should exit 0 (valid token)
SECRET="test" npm run mint-token -- --local --save
npm run verify-token -- -f *.txf --local
echo $?  # 0

# Should exit 1 (tampered token)
jq '.state.predicate = "ffffffff"' token.txf > tampered.txf
npm run verify-token -- -f tampered.txf --local
echo $?  # 1

# Should exit 2 (file not found)
npm run verify-token -- -f nonexistent.txf
echo $?  # 2
```

## Security Tests Expected to Pass

After implementation, these tests will pass:
- `SEC-AUTH-002`: Tampered token rejection
- `SEC-AUTH-003`: Masked predicate tampering detection
- `SEC-CRYPTO-001`: Genesis proof signature tampering
- `SEC-DATA-001` through `SEC-DATA-008`: Data integrity checks

## Breaking Change Notice

**Yes, this is a breaking change**, but:
1. Current behavior is objectively wrong (security bug)
2. Security tests already expect exit 1 behavior
3. `verify-token` not widely used in production scripts yet
4. Better to fix now than accumulate technical debt

**Recommendation:** Ship immediately as security fix.

## Documentation Updates

1. Update command description (inline)
2. Update `docs/reference/api-reference.md`
3. Update `CHANGELOG.md` with breaking change notice
4. Add exit code examples to help text

## Priority

**HIGH** - This is a security bug fix, not a feature request.

**Estimated Time:** 2-3 hours (implementation + testing + docs)

**Risk:** LOW (tests already expect this behavior)

## Full Documentation

See these files for complete details:

1. **VERIFY_TOKEN_EXIT_CODE_ANALYSIS.md** (13 sections, comprehensive analysis)
2. **VERIFY_TOKEN_EXIT_CODE_IMPLEMENTATION.md** (exact code changes)
3. This summary (quick reference)

---

**File Locations:**
- Implementation: `/home/vrogojin/cli/src/commands/verify-token.ts`
- Tests: `/home/vrogojin/cli/tests/security/*.bats`
- Documentation: `/home/vrogojin/cli/docs/reference/api-reference.md`
