# verify-token Exit Code Behavior: Before vs After

## Current Behavior (INCORRECT)

```
┌─────────────────────────┬──────────────┬─────────────┐
│ Scenario                │ Current Exit │ Output      │
├─────────────────────────┼──────────────┼─────────────┤
│ Valid token             │ 0 ✓          │ ✅ Valid    │
│ Tampered token (CBOR)   │ 0 ✗          │ ⚠ Warning   │
│ Missing authenticator   │ 0 ✗          │ ❌ Error    │
│ Invalid signature       │ 0 ✗          │ ❌ Failed   │
│ SDK cannot load token   │ 0 ✗          │ ⚠ Warning   │
│ File not found          │ 1 ✓          │ ❌ Error    │
│ Invalid JSON            │ 1 ✓          │ ❌ Error    │
│ Network unavailable     │ 0 ✓          │ ⚠ Warning   │
└─────────────────────────┴──────────────┴─────────────┘

❌ PROBLEM: Tampered tokens exit 0, giving false confidence!
```

## New Behavior (CORRECT)

```
┌─────────────────────────┬──────────────┬─────────────┐
│ Scenario                │ New Exit     │ Output      │
├─────────────────────────┼──────────────┼─────────────┤
│ Valid token             │ 0 ✓          │ ✅ Valid    │
│ Tampered token (CBOR)   │ 1 ✓          │ ❌ Failed   │
│ Missing authenticator   │ 1 ✓          │ ❌ Failed   │
│ Invalid signature       │ 1 ✓          │ ❌ Failed   │
│ SDK cannot load token   │ 1 ✓          │ ❌ Failed   │
│ File not found          │ 2 ✓          │ ❌ Error    │
│ Invalid JSON            │ 2 ✓          │ ❌ Error    │
│ Network unavailable     │ 0 ✓          │ ⚠ Warning   │
└─────────────────────────┴──────────────┴─────────────┘

✅ CORRECT: Security failures exit 1, file errors exit 2
```

## Exit Code Meanings

### Exit 0: Success
Token is **structurally valid and SDK-compatible**. Can be used with `send-token` and `receive-token`.

**Examples:**
- Valid token with complete proofs
- Valid token that's been spent (outdated state)
- Valid token when network is unavailable

**User interpretation:** "This token is usable"

### Exit 1: Validation Failure
Token has **critical security issues**. Cannot be used safely.

**Examples:**
- CBOR decode failure (predicate tampered)
- Missing or invalid authenticator
- Invalid cryptographic signature
- Missing required fields (genesis, state, predicate)
- SDK cannot parse token structure

**User interpretation:** "This token is corrupted or tampered"

### Exit 2: File Error
**File operation failed**. Token content not examined.

**Examples:**
- File not found
- JSON parse error
- Permission denied

**User interpretation:** "Cannot read token file"

## Real-World Impact

### Before (Security Risk)

```bash
# User checks tampered token
$ npm run verify-token -- -f tampered.txf --local
❌ Proof validation failed:
  - Authenticator signature verification failed
⚠ Could not load token with SDK: Major type mismatch

$ echo $?
0   # ← User thinks token is OK! 😱

$ npm run send-token -- -f tampered.txf -r DIRECT://abc123 --local
Error: Cannot parse token (Major type mismatch)
```

**Problem:** Exit 0 implies success, but token is unusable.

### After (Secure)

```bash
# User checks tampered token
$ npm run verify-token -- -f tampered.txf --local
❌ Proof validation failed:
  - Authenticator signature verification failed
❌ Could not load token with SDK: Major type mismatch
❌ Token has critical validation failures

$ echo $?
1   # ← User immediately knows token is invalid ✅

$ # User won't try to send, saved time and confusion
```

**Solution:** Exit 1 signals failure immediately.

## Script Integration Examples

### Before (Unreliable)

```bash
#!/bin/bash
# Check token before sending (DOESN'T WORK)

if npm run verify-token -- -f token.txf --local > /dev/null 2>&1; then
    echo "Token is valid, proceeding..."
    npm run send-token -- -f token.txf -r "$RECIPIENT" --local
else
    echo "Token verification failed"
fi

# ❌ PROBLEM: Tampered tokens pass the check!
```

### After (Reliable)

```bash
#!/bin/bash
# Check token before sending (WORKS CORRECTLY)

if npm run verify-token -- -f token.txf --local > /dev/null 2>&1; then
    echo "Token is valid, proceeding..."
    npm run send-token -- -f token.txf -r "$RECIPIENT" --local
else
    exit_code=$?
    if [ $exit_code -eq 1 ]; then
        echo "Token validation failed (corrupted or tampered)"
    elif [ $exit_code -eq 2 ]; then
        echo "Cannot read token file"
    fi
    exit $exit_code
fi

# ✅ CORRECT: Tampered tokens fail the check!
```

## Test Case Comparison

### SEC-AUTH-003: Masked Predicate Tampering

**Before:**
```bash
# Create tampered token
jq '.state.predicate = "ffffffff"' token.txf > tampered.txf

# Verify (current behavior)
run_cli "verify-token -f ${tampered_token} --local"
assert_failure  # ❌ TEST FAILS (exits 0)

# Expected: exit 1
# Actual: exit 0
```

**After:**
```bash
# Create tampered token
jq '.state.predicate = "ffffffff"' token.txf > tampered.txf

# Verify (new behavior)
run_cli "verify-token -f ${tampered_token} --local"
assert_failure  # ✅ TEST PASSES (exits 1)

# Expected: exit 1
# Actual: exit 1
```

## Security Test Results

### Current (Many Failures)

```
Running security tests...

✗ SEC-AUTH-002: Tampered token rejected
  Expected exit code != 0, got 0

✗ SEC-AUTH-003: Masked predicate tampering
  Expected exit code != 0, got 0

✗ SEC-CRYPTO-001: Genesis proof tampering
  Expected exit code != 0, got 0

... 15+ test failures ...
```

### After Fix (All Pass)

```
Running security tests...

✓ SEC-AUTH-002: Tampered token rejected
  Exit code 1 (validation failure)

✓ SEC-AUTH-003: Masked predicate tampering
  Exit code 1 (CBOR decode failed)

✓ SEC-CRYPTO-001: Genesis proof tampering
  Exit code 1 (signature verification failed)

... all security tests pass ...
```

## API Reference Example

### Before

```markdown
### verify-token

Verify and display detailed information about a token file.

**Usage:**
npm run verify-token -- -f <token.txf> [--local]

**Exit Code:** Always 0 (shows diagnostic info)
```

### After

```markdown
### verify-token

Verify and display detailed information about a token file.

**Usage:**
npm run verify-token -- -f <token.txf> [--local]

**Exit Codes:**
- 0: Token is valid and SDK-compatible
- 1: Critical validation failure (tampered, invalid proof, missing fields)
- 2: File I/O error (file not found, JSON parse error)

**Examples:**

Check token validity:
```bash
if npm run verify-token -- -f token.txf --local; then
    echo "Token is valid"
else
    echo "Token verification failed"
fi
```

Handle different failure types:
```bash
npm run verify-token -- -f token.txf --local
exit_code=$?

case $exit_code in
    0) echo "Valid token" ;;
    1) echo "Validation failure (security issue)" ;;
    2) echo "File error" ;;
esac
```
```

## Developer Mental Model

### Before (Confusing)

```
Developer: "Does exit 0 mean token is valid?"
CLI: "Exit 0 means verification completed"
Developer: "But there are errors in the output..."
CLI: "Yes, but I showed them to you, so exit 0"
Developer: "So... is the token valid or not?"
CLI: "¯\_(ツ)_/¯"
```

### After (Clear)

```
Developer: "Does exit 0 mean token is valid?"
CLI: "Yes. Exit 0 = valid, exit 1 = invalid"
Developer: "Perfect! That's what I expected"
```

## Summary Table

| Aspect | Before | After |
|--------|--------|-------|
| Tampered tokens | Exit 0 ❌ | Exit 1 ✅ |
| CBOR decode failure | Exit 0 ❌ | Exit 1 ✅ |
| Invalid signature | Exit 0 ❌ | Exit 1 ✅ |
| Missing authenticator | Exit 0 ❌ | Exit 1 ✅ |
| SDK load failure | Exit 0 ❌ | Exit 1 ✅ |
| File not found | Exit 1 ✅ | Exit 2 ✅ |
| Valid token | Exit 0 ✅ | Exit 0 ✅ |
| Network unavailable | Exit 0 ✅ | Exit 0 ✅ |
| Security tests | FAIL ❌ | PASS ✅ |
| UNIX conventions | Violated ❌ | Followed ✅ |
| User confidence | False ❌ | Accurate ✅ |

## Conclusion

**Current behavior is objectively wrong** from:
1. Security perspective (tampered tokens exit 0)
2. SDK perspective (unusable tokens exit 0)
3. CLI design perspective (violates UNIX conventions)
4. Testing perspective (security tests fail)

**New behavior is correct** and aligns with:
1. Security best practices
2. SDK validation semantics
3. UNIX exit code conventions
4. User expectations

**Recommendation:** Implement immediately as security fix.
