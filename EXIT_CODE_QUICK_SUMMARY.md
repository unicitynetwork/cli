# Exit Code Implementation - Quick Summary

**Date:** 2025-01-11
**Command:** `verify-token`
**Recommendation:** Default strict behavior with --diagnostic flag

---

## TL;DR: What to Implement

```typescript
// Add this flag
.option('--diagnostic', 'Display verification info without failing (exit 0 always)')

// Track verification failures
let hasCriticalErrors = false;

// File errors = exit 2
if (!options.file) process.exit(2);
if (fileNotFound) process.exit(2);
if (invalidJSON) process.exit(2);

// Verification failures = set flag
if (!jsonProofValidation.valid) hasCriticalErrors = true;
if (!token) hasCriticalErrors = true;
if (tokenSpent) hasCriticalErrors = true;

// Network down = warning only (not failure)
if (networkUnavailable) console.log('⚠️ Network unavailable');

// Final exit
if (options.diagnostic) process.exit(0);
if (hasCriticalErrors) process.exit(1);
process.exit(0);
```

---

## Exit Code Matrix

| Exit | Meaning | Examples |
|------|---------|----------|
| 0 | Valid token | All checks pass, token usable |
| 1 | Verification failed | Tampered token, invalid proof, spent |
| 2 | Usage error | File not found, invalid JSON |

**Pattern:** Same as `gpg --verify`, `openssl verify`, `git verify-commit`

---

## Why This Design?

1. **Unix convention**: Verification tools exit 1 on failure
2. **Security**: Scripts with `if verify; then use; fi` must work correctly
3. **Test suite**: Already expects `assert_failure` for tampered tokens
4. **Backward compat**: `--diagnostic` flag preserves old behavior

---

## Key Decision: Network Unavailable = Exit 0

**Rationale:**
- Cannot verify ≠ token is invalid
- Local validation still useful
- Show warning, don't fail
- Graceful degradation

**Alternative considered:** Exit 1 if network check fails → Rejected (too strict)

---

## Flag Design: --diagnostic

```bash
# Default: Strict (recommended)
verify-token -f token.txf        # Exit 1 on any failure

# Diagnostic: Always exit 0
verify-token -f token.txf --diagnostic  # For CI/CD reporting
```

**Use cases:**
- Production: Default (fail on errors)
- CI/CD: --diagnostic (generate reports)
- Scripts: Default (safe conditionals)

---

## Script Patterns

```bash
# Pattern 1: Fail-fast
verify-token -f token.txf || exit 1
send-token -f token.txf -r "$RECIPIENT"

# Pattern 2: Conditional
if verify-token -f token.txf; then
    send-token -f token.txf -r "$RECIPIENT"
else
    echo "Verification failed: $?"
    exit 1
fi

# Pattern 3: Batch validation
for token in *.txf; do
    verify-token -f "$token" || exit 1
done

# Pattern 4: CI reporting
verify-token -f token.txf --diagnostic > report.txt
```

---

## Implementation Checklist (Short Version)

**Code (2 hours):**
- [ ] Add --diagnostic flag
- [ ] Add hasCriticalErrors tracking
- [ ] File errors → exit 2
- [ ] Verification failures → set flag
- [ ] Network down → warning only
- [ ] Final exit logic

**Docs (1 hour):**
- [ ] Update command description
- [ ] Add exit code section to README
- [ ] Update API reference
- [ ] CHANGELOG.md entry

**Tests (2 hours):**
- [ ] Create test_verify_exit_codes.bats (10 tests)
- [ ] Verify existing tests still pass
- [ ] Manual script testing

**Total:** 4-6 hours

---

## Breaking Change?

**No** - This is a bug fix:
- Current behavior (exit 0 always) violates Unix convention
- Test suite already expects correct behavior
- No documented contract promises exit 0 on failure

**But:** Treat as breaking change out of caution
- Bump version to v1.7.0 (minor)
- Document migration path
- Add --diagnostic for legacy use cases

---

## Migration for Users

**If your scripts depend on exit 0 behavior:**

```bash
# Option 1: Use --diagnostic flag
verify-token -f token.txf --diagnostic

# Option 2: Ignore exit code
verify-token -f token.txf || true

# Option 3: Nothing (recommended - let verification work correctly!)
# Scripts like this now work as intended:
if verify-token -f token.txf; then
    send-token -f token.txf -r "$RECIPIENT"
fi
```

---

## Test Coverage

**New tests (10 scenarios):**
1. Valid token → exit 0
2. File not found → exit 2
3. Invalid JSON → exit 2
4. Tampered token → exit 1
5. Invalid proof → exit 1
6. --diagnostic with invalid → exit 0
7. Spent token → exit 1
8. Network down → exit 0 (with warning)
9. Missing --file flag → exit 2
10. Script conditional pattern

**Existing tests (15+ scenarios):**
- Functional tests: Valid tokens (already expect exit 0)
- Security tests: Tampered tokens (already expect exit 1)

---

## Unix Tool Reference

| Tool | Exit 0 | Exit 1 | Exit 2 |
|------|--------|--------|--------|
| gpg --verify | Valid sig | Bad sig | Error |
| openssl verify | Valid cert | Invalid | Error |
| git verify-commit | Valid sig | Invalid | Error |
| sha256sum -c | All match | Mismatch | Error |
| **verify-token** | **Valid** | **Invalid** | **Error** |

**Principle:** Exit 0 = verified and safe to use. Exit 1 = verification failed. Exit 2 = cannot verify.

---

## What Not to Do

❌ Exit 0 on verification failure
❌ Default --diagnostic mode (unsafe)
❌ Exit 1 when network unavailable (too strict)
❌ Complex exit codes (3-125) for specific errors
❌ Change behavior without --diagnostic fallback

---

## Success Criteria

✅ Valid tokens exit 0
✅ Invalid tokens exit 1
✅ File errors exit 2
✅ --diagnostic always exits 0
✅ Network down shows warning but exits 0
✅ All existing tests pass
✅ Script patterns work correctly
✅ Documentation complete

---

## Files to Update

```
src/commands/verify-token.ts              [CODE] Add exit logic
tests/functional/test_verify_exit_codes.bats  [NEW] Exit code tests
README.md                                 [DOCS] Exit code section
docs/reference/api-reference.md           [DOCS] Exit codes
CHANGELOG.md                              [DOCS] v1.7.0 entry
package.json                              [META] Version bump
```

---

## Quick Decision Reference

| Decision Point | Choice | Rejected Alternative | Rationale |
|----------------|--------|---------------------|-----------|
| Default behavior | Strict (exit 1) | Diagnostic (exit 0) | Unix convention, security |
| Network unavailable | Warning (exit 0) | Failure (exit 1) | Graceful degradation |
| Backward compat | --diagnostic flag | --strict flag | Fail-safe defaults |
| Version bump | 1.7.0 (minor) | 2.0.0 (major) | Conservative approach |
| Spent token | Exit 1 | Exit 0 + warning | Cannot be used |

---

## Next Steps

1. Read full guide: `/home/vrogojin/cli/EXIT_CODE_IMPLEMENTATION_GUIDE.md`
2. Follow checklist: `/home/vrogojin/cli/EXIT_CODE_IMPLEMENTATION_CHECKLIST.md`
3. Implement code changes (2 hours)
4. Update documentation (1 hour)
5. Write tests (2 hours)
6. Manual validation (30 min)
7. Commit and release (30 min)

**Total time: 4-6 hours**

---

**Questions?** Review full guide for:
- Complete code implementation
- Test case specifications
- Documentation templates
- Migration guide
- Rollback plan
