# RECV_TOKEN-007 Debug Solution Report

## Executive Summary

Successfully debugged and fixed the RECV_TOKEN-007 test failure. The issue was **inconsistent nonce processing between gen-address.ts and receive-token.ts**, causing masked address validation to fail.

**Status**: FIXED - Test now passes consistently

---

## The Bug

### Test Failure: RECV_TOKEN-007
- **Test Name**: "Receive token at masked (one-time) address"
- **Location**: `tests/functional/test_receive_token.bats` (lines 233-255)
- **Exit Code**: 1 (failure)
- **Error**: Address mismatch - received address did not match intended recipient

### Test Flow (with bug)
```
1. Bob generates masked address using gen-address --nonce "test-nonce"
   ↓ gen-address correctly hashes nonce to 32 bytes
   Address = DIRECT://xxxxx

2. Alice sends token to that address (works)
   ↓ Transfer created successfully

3. Bob receives token using receive-token --nonce "test-nonce"
   ↓ receive-token INCORRECTLY converts nonce to UTF8 bytes (variable length)
   Generated Address = DIRECT://yyyyy ← DIFFERENT!

4. Address validation: Expected xxxxx, got yyyyy
   → MISMATCH ERROR → TEST FAILS ✗
```

---

## Root Cause Analysis

### The Mismatch

**gen-address.ts (lines 78-105)** - `processNonce()` function:
```typescript
// For text nonce input: "nonce-bob-masked-receive-1234567890-5678"
const hasher = new DataHasher(HashAlgorithm.SHA256);
const hash = await hasher.update(new TextEncoder().encode(input)).digest();
const hashBytes = hash.data;  // 32 bytes
// Result: SHA256("nonce-bob-masked-receive-1234567890-5678")
//         = 0xed04c4e9ea6c49cf...
```

**receive-token.ts (line 326)** - BEFORE FIX:
```typescript
// For same text nonce input: "nonce-bob-masked-receive-1234567890-5678"
const nonceBytes = new TextEncoder().encode(options.nonce);
// Result: UTF8 bytes of string = ~48 bytes
//         ≠ SHA256 hash
```

### Why It Mattered

The nonce bytes are used to derive the signing key:
```typescript
const maskedSigningService = await SigningService.createFromSecret(secret, nonceBytes);
```

Different nonce bytes → Different signing service → Different public key → Different predicate → Different address

**The generated address in receive-token.ts would NEVER match the address generated in gen-address.ts**

---

## The Fix

### File Modified
`/home/vrogojin/cli/src/commands/receive-token.ts`

### Lines Changed
Lines 325-340 (within the `if (options.nonce)` block)

### Code Change

**BEFORE (broken):**
```typescript
// Convert nonce string to Uint8Array
const nonceBytes = new TextEncoder().encode(options.nonce);
```

**AFTER (fixed):**
```typescript
// Process nonce: convert hex or hash string input to 32-byte Uint8Array
// CRITICAL: Must match gen-address.ts processNonce() logic for address consistency
let nonceBytes: Uint8Array;

// If it's a valid 32-byte hex string, decode it
if (/^(0x)?[0-9a-fA-F]{64}$/.test(options.nonce)) {
  const hexStr = options.nonce.startsWith('0x') ? options.nonce.slice(2) : options.nonce;
  nonceBytes = HexConverter.decode(hexStr);
  console.error(`  Using hex nonce: ${HexConverter.encode(nonceBytes)}`);
} else {
  // Otherwise, hash the input to get 32 bytes (matches gen-address.ts behavior)
  const hasher = new DataHasher(HashAlgorithm.SHA256);
  const hash = await hasher.update(new TextEncoder().encode(options.nonce)).digest();
  nonceBytes = hash.data;
  console.error(`  Hashed nonce input to: ${HexConverter.encode(nonceBytes)}`);
}
```

### Why This Fix Works

1. **Hex nonce support**: If user provides a 64-char hex string (already 32 bytes), decode it directly
2. **Text nonce support**: If user provides text, hash it to 32 bytes (matching gen-address.ts)
3. **Consistency**: Both commands now use identical nonce processing logic
4. **Debugging**: Added debug output showing the processed nonce value

### Imports
No new imports needed - `DataHasher` and `HexConverter` were already imported

---

## Verification

### Test Results
```
RECV_TOKEN-007: Receive token at masked (one-time) address
Status: PASS ✓
```

### Stability Testing
Ran test 3 times - passes every time ✓

### Regression Testing
All 11 receive-token tests pass:
- RECV_TOKEN-001: ✓ Complete offline transfer
- RECV_TOKEN-002: ✓ Receive NFT with metadata
- RECV_TOKEN-003: ✓ Receive UCT token
- RECV_TOKEN-004: ✓ Error with incorrect secret
- RECV_TOKEN-005: ✓ Idempotent reception
- RECV_TOKEN-006: ✓ Local aggregator
- **RECV_TOKEN-007**: ✓ **Masked address (FIXED)**
- RECV_TOKEN-008: ✓ No data hash commitment
- RECV_TOKEN-009: ✓ Matching data hash
- RECV_TOKEN-010: ✓ Mismatched data hash error
- RECV_TOKEN-011: ✓ Missing state data error

### Build Verification
```
npm run build
✓ No TypeScript errors
✓ All imports resolved
✓ Types validated
```

---

## Technical Details

### Masked Predicate Cryptography

A masked (one-time) address is derived from:
1. **Secret** (user password/key) → PBKDF2 derivation
2. **Nonce** (randomizer) → Modifies key derivation
3. **Token ID** (specific token identity)
4. **Token Type** (token class)

All combined through HMAC-SHA256 to produce unique keys.

### Why SHA256 Hashing?

Test nonce: `"nonce-bob-masked-receive-1234567890-5678"`
- UTF8 encoded: ~48 bytes (variable length)
- SHA256 hashed: 32 bytes (fixed length, deterministic)

The SDK expects 32-byte nonce values. Hashing normalizes variable-length text to exactly 32 bytes while maintaining determinism (same input always produces same output).

### Hex Nonce Support

Advanced users can provide pre-computed 32-byte nonce as 64-char hex:
- Format: `feeddeadbeefcafe...` (64 hex chars)
- Or: `0xfeeddeadbeefcafe...` (with 0x prefix)
- Decoded directly without hashing

---

## Impact Analysis

### Affected Features
- **receive-token command with --nonce flag** (masked addresses)
- Specifically: Address validation step (line 365)

### Not Affected
- Unmasked address reception (uses salt, not nonce)
- Token minting
- Token transfers
- gen-address command (already working)
- send-token command
- verify-token command
- Other commands

### Backward Compatibility
- **Text nonce format**: Now works correctly (was broken)
- **Hex nonce format**: Now supported (wasn't before)
- No breaking changes to API or command interface

---

## Prevention

To prevent similar issues in future:

### 1. Extract Shared Utility
Create `src/utils/nonce-processor.ts`:
```typescript
export async function processNonce(input: string | undefined): Promise<Uint8Array | null> {
  if (!input) return null;

  // Shared logic between gen-address and receive-token
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(input)) {
    const hexStr = input.startsWith('0x') ? input.slice(2) : input;
    return HexConverter.decode(hexStr);
  }

  const hasher = new DataHasher(HashAlgorithm.SHA256);
  const hash = await hasher.update(new TextEncoder().encode(input)).digest();
  return hash.data;
}
```

Then both commands use:
```typescript
const nonceBytes = await processNonce(options.nonce);
```

### 2. Integration Tests
Add test that verifies address consistency:
```bash
# Generate address
ADDR=$(gen-address --nonce "test-nonce" -u)

# Mint and send to that address
mint-token ...
send-token -r "$ADDR" ...

# Receive with same nonce
receive-token --nonce "test-nonce"  # Must succeed!
```

### 3. Documentation
Update CLAUDE.md with masked address workflow:
```markdown
## Masked Address Workflow

1. Generate address:
   gen-address --nonce "my-nonce-string"

2. Send token to that address

3. Receive using SAME nonce:
   receive-token --nonce "my-nonce-string"

Note: The nonce is hashed internally to 32 bytes for cryptographic derivation.
Must be identical between commands.
```

---

## Files Modified

### `/home/vrogojin/cli/src/commands/receive-token.ts`
- **Lines**: 319-354
- **Change Type**: Bug fix
- **Imports**: No new imports (DataHasher and HexConverter already present)

### Summary of Changes
```diff
- const nonceBytes = new TextEncoder().encode(options.nonce);
+ // Process nonce: convert hex or hash string input to 32-byte Uint8Array
+ // CRITICAL: Must match gen-address.ts processNonce() logic for address consistency
+ let nonceBytes: Uint8Array;
+
+ // If it's a valid 32-byte hex string, decode it
+ if (/^(0x)?[0-9a-fA-F]{64}$/.test(options.nonce)) {
+   const hexStr = options.nonce.startsWith('0x') ? options.nonce.slice(2) : options.nonce;
+   nonceBytes = HexConverter.decode(hexStr);
+   console.error(`  Using hex nonce: ${HexConverter.encode(nonceBytes)}`);
+ } else {
+   // Otherwise, hash the input to get 32 bytes (matches gen-address.ts behavior)
+   const hasher = new DataHasher(HashAlgorithm.SHA256);
+   const hash = await hasher.update(new TextEncoder().encode(options.nonce)).digest();
+   nonceBytes = hash.data;
+   console.error(`  Hashed nonce input to: ${HexConverter.encode(nonceBytes)}`);
+ }
```

---

## References

### Related Code
- `src/commands/gen-address.ts` (lines 78-105): Working nonce processing logic
- `src/commands/receive-token.ts` (lines 319-354): Fixed nonce processing logic
- `tests/functional/test_receive_token.bats` (lines 233-255): Test case
- `tests/helpers/token-helpers.bash` (lines 44-86): Test helper functions

### Test Execution
- Command: `bats tests/functional/test_receive_token.bats --filter "RECV_TOKEN-007"`
- Result: PASS
- Status: Consistent (3/3 runs successful)

---

## Conclusion

The RECV_TOKEN-007 test failure was caused by receive-token.ts not processing the nonce input the same way as gen-address.ts. By implementing identical nonce processing (with SHA256 hashing for text input and hex decoding for hex input), the commands now generate consistent masked addresses, and the test passes reliably.

The fix is minimal, focused, and maintains backward compatibility while enabling the masked address feature to work correctly.
