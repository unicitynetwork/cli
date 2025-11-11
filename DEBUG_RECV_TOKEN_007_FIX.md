# RECV_TOKEN-007 Bug Fix: Masked Address Nonce Processing

## Problem Summary

The test `RECV_TOKEN-007: Receive token at masked (one-time) address` was failing with exit code 1. The test generates a masked address using `gen-address` with a nonce, sends a token to that address, then tries to receive it using `receive-token` with the same nonce. The operation failed because the recipient address didn't match.

## Root Cause

**Inconsistent nonce processing between `gen-address.ts` and `receive-token.ts`:**

### gen-address.ts (working):
- Takes nonce input as a string: `"nonce-bob-masked-receive-1234567890-5678"`
- Checks if it's a 64-char hex string (line 92)
- If NOT hex, **hashes it with SHA256** (lines 100-104):
  ```typescript
  const hasher = new DataHasher(HashAlgorithm.SHA256);
  const hash = await hasher.update(new TextEncoder().encode(input)).digest();
  const hashBytes = hash.data;  // 32-byte Uint8Array
  ```
- Result: Input `"nonce-bob-masked-receive-1234567890-5678"` becomes a 32-byte SHA256 hash

### receive-token.ts (broken):
- Takes nonce input as a string: `"nonce-bob-masked-receive-1234567890-5678"`
- **Directly encoded to UTF8** without hashing (line 326):
  ```typescript
  const nonceBytes = new TextEncoder().encode(options.nonce);
  ```
- Result: Input becomes UTF8 bytes (variable length, not 32 bytes)

## Why This Broke

The `MaskedPredicate.create()` uses the nonce bytes to derive cryptographic keys. When the nonce differs:
1. Different signing service created (line 329 in broken code vs. line 191 in working code)
2. Different public key derived from secret
3. Different predicate reference created
4. Different address derived from predicate
5. Received address ≠ Intended recipient address → **Validation fails**

## The Fix

Replace lines 325-340 in `/home/vrogojin/cli/src/commands/receive-token.ts` to match the nonce processing logic from `gen-address.ts`:

**Changed code (lines 325-340):**
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

## Changes Made

**File:** `/home/vrogojin/cli/src/commands/receive-token.ts`
**Lines:** 319-354
**Change Type:** Bug fix (align nonce processing with gen-address.ts)

### What Changed
- Line 326: Removed direct UTF8 encoding of nonce
- Lines 327-340: Added proper nonce processing with hex detection and SHA256 hashing
- Added debug output to show hashed nonce value

### Required Imports
Both `DataHasher` and `HexConverter` were already imported, so no new imports needed.

## Verification

### Test Results
1. **RECV_TOKEN-007 now passes**: ✓
   ```
   ok 1 RECV_TOKEN-007: Receive token at masked (one-time) address
   ```

2. **All receive-token tests pass** (11/11): ✓
   - RECV_TOKEN-001 through RECV_TOKEN-011 all pass

3. **No regressions**: ✓
   - Functional tests show 100+ tests passing

## Technical Details

### Masked Predicate Address Generation

The address for a masked predicate depends on:
1. **Secret** → Derives signing service private key
2. **Nonce** → Derives signing service public key (combined with secret)
3. **Token ID** → Identifies the specific token
4. **Token Type** → Identifies the token class
5. **HashAlgorithm** → SHA256

For the same secret and nonce to generate the same address:
- The nonce MUST be processed identically in both commands
- The nonce MUST be a deterministic 32-byte value
- Text input (not hex) MUST be SHA256 hashed to normalize to 32 bytes
- Hex input (64 characters) can be decoded directly to 32 bytes

### Why SHA256 Hashing

Test nonce format: `"nonce-bob-masked-receive-1234567890-5678"` (variable length)

Without hashing:
- UTF8 encoding gives ~48 bytes (not 32)
- Predicate derivation fails or gives inconsistent results

With SHA256 hashing:
- Always produces exactly 32 bytes
- Deterministic: same input always produces same output
- Matches gen-address.ts behavior for address consistency

## Impact Analysis

### Affected Commands
- `receive-token` with `--nonce` flag (masked addresses)
- Direct impact: Address validation (line 365)

### Not Affected
- Unmasked address reception (uses salt, not nonce)
- Token minting or transfer operations
- Other commands (gen-address, send-token, etc.)

### Security Implications
- **Before fix**: Masked address feature was non-functional for text nonces
- **After fix**: Proper cryptographic derivation, consistent with other commands
- **No security regressions**: Uses standard SHA256 hashing, same as gen-address.ts

## Testing Strategy

1. Verified RECV_TOKEN-007 test passes (specific masked address test)
2. Verified all 11 receive-token tests pass (no regressions)
3. Verified gen-address command still works correctly
4. Checked imports are available (DataHasher, HexConverter)
5. Built project successfully (no TypeScript errors)

## Future Considerations

To prevent similar issues, consider:
1. **Extract nonce processing** to shared utility function in `src/utils/`
2. **Document nonce processing behavior** in architecture docs
3. **Add integration tests** that verify gen-address and receive-token produce matching addresses for same secret+nonce
4. **Consider nonce validation** utility function that both commands use

## References

- **gen-address.ts**: Lines 78-105 (processNonce function)
- **receive-token.ts**: Lines 319-354 (masked predicate creation)
- **Test file**: tests/functional/test_receive_token.bats (lines 233-255)
- **Test helper**: tests/helpers/token-helpers.bash (generate_address and receive_token functions)
