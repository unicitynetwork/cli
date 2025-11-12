# Failing Security Tests - Detailed Breakdown for Developers

**Generated:** 2025-11-12 | **Test Run:** Complete security suite (45/51 passing)

---

## Test 1: SEC-INPUT-005 - Integer Overflow / Negative Coin Amounts

**Suite:** Input Validation
**Status:** ❌ FAILING
**Severity:** 🔴 CRITICAL
**File:** `tests/security/test_input_validation.bats:240-250`

### What the Test Does
Tests that the system rejects negative coin amounts (e.g., `-1000000000000000000`) which are invalid for currency operations.

### What Failed
The system **accepted the negative amount** instead of rejecting it with an error.

### Expected Behavior
```bash
# When trying to mint with negative amount:
mint-token --amount -1000000000000000000 ...
# Should return: Error: Amount must be positive
# Exit code: 1 (failure)
```

### Actual Behavior
```bash
# System accepted it and created a valid token with:
"coinData": [
  [
    "a1f6df8cf4804e2bcbf24c62583eb40d5ff7936ffa1ed8fe527c1285394f65bd",
    "-1000000000000000000"  // ← Negative amount accepted!
  ]
]
# Exit code: 0 (success - wrong!)
```

### Root Cause
Input validation is missing numeric bounds checking. The system uses BigInt for amounts (good for large numbers) but doesn't validate that amounts must be positive.

### Where to Fix
Likely in:
- `src/commands/mint-token.ts` - Input validation section
- `src/commands/send-token.ts` - Input validation section
- Or a shared utility for amount validation

### Sample Fix
```typescript
// Add this validation before processing amount
if (typeof amount === 'string' || typeof amount === 'number') {
  const amountBig = BigInt(amount);
  if (amountBig <= 0n) {
    throw new Error('Amount must be a positive number');
  }
}
```

### Test Command
```bash
SECRET="test" bats tests/security/test_input_validation.bats -f "SEC-INPUT-005"
```

---

## Test 2: SEC-ACCESS-003 - Token File Modification Detection

**Suite:** Access Control
**Status:** ❌ FAILING
**Severity:** 🔴 CRITICAL
**File:** `tests/security/test_access_control.bats:160-180`

### What the Test Does
Creates a valid token, then modifies its `type` field (corruption test), and verifies that verify-token detects and rejects the modified file.

### What Failed
The verify-token command **accepted the corrupted token** when it should have rejected it.

### Expected Behavior
```bash
# 1. Create token (succeeds)
mint-token ...  # Creates: modified-type.txf

# 2. Corrupt the token (simulate tampering)
# Modify: genesis.data.tokenType field

# 3. Verify should detect corruption
verify-token -f modified-type.txf
# Should fail with: "Token has been modified/corrupted"
# Exit code: 1 (failure)
```

### Actual Behavior
```bash
verify-token -f modified-type.txf
# Output: ✅ Token loaded successfully with SDK
#         ✅ All proofs cryptographically verified
#         ✅ This token is valid and can be transferred
# Exit code: 0 (success - wrong!)
```

### Root Cause
The verify-token command does not validate that:
1. The token's current state hash matches the proof
2. The token structure has not been tampered with
3. All fields are consistent with the stored proofs

### Where to Fix
In `src/commands/verify-token.ts`:
- Add integrity check comparing current token fields to proof
- Verify token hash hasn't changed since last proof
- Detect if genesis data has been modified

### What Needs to Happen
```typescript
// After loading token, add:
1. Extract expected token ID from proof
2. Extract expected type from proof
3. Compare with actual token.id and token.type
4. If mismatch: throw error("Token structure modified")
```

### Test Command
```bash
SECRET="test" bats tests/security/test_access_control.bats -f "SEC-ACCESS-003"
```

---

## Test 3: SEC-INTEGRITY-002 - State Hash Mismatch Detection

**Suite:** Data Integrity
**Status:** ❌ FAILING
**Severity:** 🔴 CRITICAL
**File:** `tests/security/test_data_integrity.bats:130-145`

### What the Test Does
Creates a token, then corrupts its internal state hash (making it inconsistent with proofs), and verifies that verify-token detects the mismatch.

### What Failed
Verify-token **accepted the state hash mismatch** instead of rejecting it.

### Expected Behavior
```bash
# 1. Create token with valid state hash
mint-token ... # Creates token.txf

# 2. Corrupt state hash (simulate tampering)
# Modify: genesis.inclusionProof.authenticator.stateHash

# 3. Verify should detect inconsistency
verify-token -f corrupted-state.txf
# Should output: "State hash mismatch detected"
# Exit code: 1 (failure)
```

### Actual Behavior
```bash
verify-token -f corrupted-state.txf
# Output: ✅ All proofs cryptographically verified
#         ✅ Token loaded successfully
# Exit code: 0 (success - wrong!)
```

### Root Cause
While the SDK verifies the proof signature correctly, the system doesn't validate that the claimed state hash matches what would be computed from the token data.

### Where to Fix
In `src/commands/verify-token.ts`:
- Add state hash calculation from token data
- Compare calculated hash against proof's stateHash
- Reject if they don't match

### What Needs to Happen
```typescript
// Add this verification:
const calculatedStateHash = computeStateHash(token);
const proofStateHash = token.genesis.inclusionProof.authenticator.stateHash;

if (calculatedStateHash !== proofStateHash) {
  throw new Error('State hash mismatch - token may be corrupted');
}
```

### Test Command
```bash
SECRET="test" bats tests/security/test_data_integrity.bats -f "SEC-INTEGRITY-002"
```

---

## Test 4: SEC-INPUT-006 - Extremely Long Input Handling

**Suite:** Input Validation
**Status:** ❌ FAILING
**Severity:** 🟠 HIGH
**File:** `tests/security/test_input_validation.bats:285-300`

### What the Test Does
Attempts to create a token with extremely large token data (meant to test resource limits and DoS protection).

### What Failed
The system accepted and created a file with very large data when it should have either:
1. Rejected it with an error, or
2. At least warned the user

### Expected Behavior
```bash
# Attempt to mint with massive token data (1MB+)
mint-token --data $(python3 -c "print('x'*1000000)") ...
# Should return: Error: Token data too large (limit: 10MB)
# Exit code: 1 (failure)
```

### Actual Behavior
```bash
# System created token successfully
# Output: [INFO] Very large data accepted
# File generated: verylarge.txf (but test expects it to fail)
# Exit code: 0 (success when should fail)
```

### Root Cause
No input size validation exists. The system processes any size of token data without checking reasonable limits.

### Where to Fix
In any command that accepts token data:
- `src/commands/mint-token.ts`
- `src/commands/send-token.ts`
- Any data input handler

### Sample Fix
```typescript
// Add size validation:
const MAX_TOKEN_DATA_SIZE = 10 * 1024 * 1024; // 10MB limit

if (tokenData && tokenData.length > MAX_TOKEN_DATA_SIZE) {
  throw new Error(
    `Token data too large. ` +
    `Maximum: ${MAX_TOKEN_DATA_SIZE} bytes, ` +
    `Provided: ${tokenData.length} bytes`
  );
}
```

### Test Command
```bash
SECRET="test" bats tests/security/test_input_validation.bats -f "SEC-INPUT-006"
```

---

## Test 5: SEC-INPUT-007 - Special Characters in Addresses Rejected

**Suite:** Input Validation
**Status:** ❌ FAILING
**Severity:** 🟠 HIGH
**File:** `tests/security/test_input_validation.bats:320-335`

### What the Test Does
Tests that address fields reject special characters that could be used for injection attacks.

### What Failed
Test infrastructure error - the test helper has a shell syntax error, preventing proper validation testing.

### Error Message
```
/home/vrogojin/cli/tests/helpers/common.bash: eval: line 248:
unexpected EOF while looking for matching `''
/home/vrogojin/cli/tests/helpers/common.bash: eval: line 249:
syntax error: unexpected end of file
```

### Root Cause
In `tests/helpers/common.bash` lines 248-249, there's an unclosed single quote in a shell command construction. This causes the test to fail before it even runs the actual validation check.

### What Should Happen
Address validation should reject or warn about:
- Special shell characters: `;`, `|`, `&`, `$`, etc.
- Unusual address formats
- Invalid characters outside of allowed charset

### Where to Fix
1. **Immediate:** Fix the syntax error in `tests/helpers/common.bash:248-249`
2. **Then:** Implement address format validation in the CLI

### Files Involved
```
/home/vrogojin/cli/tests/helpers/common.bash  ← Syntax error here
src/utils/                                     ← Add validation utility
src/commands/                                  ← Use validation in commands
```

### Test Command
```bash
SECRET="test" bats tests/security/test_input_validation.bats -f "SEC-INPUT-007"
```

### Additional Note
This test is actually TWO problems:
1. **Test helper issue:** Shell syntax error (MUST FIX FIRST)
2. **Feature issue:** Address validation not implemented

---

## Summary Table: Failing Tests

| ID | Suite | Test | Type | Fix Complexity | Impact |
|----|-------|------|------|-----------------|--------|
| SEC-INPUT-005 | Input Validation | Negative amounts | Code | Low | HIGH |
| SEC-ACCESS-003 | Access Control | Tampering detection | Code | Medium | HIGH |
| SEC-INTEGRITY-002 | Data Integrity | Hash mismatch | Code | Medium | HIGH |
| SEC-INPUT-006 | Input Validation | Size limits | Code | Low | MEDIUM |
| SEC-INPUT-007 | Input Validation | Special chars | Code+Test | Medium | MEDIUM |
| Test helper error | Infrastructure | Syntax error | Test | Very Low | Blocking |

---

## Priority Order for Fixes

### Priority 1 (Today)
1. **SEC-INPUT-005:** Add amount validation
2. Fix test helper syntax error in common.bash

### Priority 2 (This week)
3. **SEC-ACCESS-003 & SEC-INTEGRITY-002:** Add token integrity verification

### Priority 3 (Before release)
4. **SEC-INPUT-006:** Add size limits
5. **SEC-INPUT-007:** Complete address validation

---

## Testing After Fixes

After implementing fixes, run:

```bash
# Test individual fixes
SECRET="test" bats tests/security/test_input_validation.bats -f "SEC-INPUT-005"
SECRET="test" bats tests/security/test_access_control.bats -f "SEC-ACCESS-003"

# Run full security suite
SECRET="test" bats tests/security/test_*.bats

# Expected result: 51/51 passing (100%)
```

---

## Developer Notes

### Patterns to Follow
- All input validation should happen early in commands
- Use consistent error messages across commands
- Always validate before SDK operations
- Test both positive and negative cases

### Files That Need Changes
- `src/commands/mint-token.ts` - Add amount, size validation
- `src/commands/send-token.ts` - Add amount validation
- `src/commands/verify-token.ts` - Add integrity checks
- `tests/helpers/common.bash` - Fix syntax error

### Related Documentation
- See SECURITY_TEST_STATUS_REPORT.md for full context
- See SECURITY_TEST_QUICK_SUMMARY.md for overview
