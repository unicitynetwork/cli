# Mint Token Test Fixes - Final Summary

## Current Status

**Total tests:** 28
**Passing:** 22 ✅
**Failing:** 6 ❌

## Failing Tests (Detailed Analysis)

### 1. MINT_TOKEN-012: Stdout contains diagnostic output ❌
**Fix:** CLI bug - `--stdout` should output ONLY JSON to stdout
**Priority:** Medium

### 2. MINT_TOKEN-013, 015, 017: Unmasked address tests ❌  
**Fix:** Unknown - needs investigation (masked tests pass, unmasked fail)
**Priority:** Medium

### 3. MINT_TOKEN-020: Merkle root validation ❌
**Fix:** Test helper - Accept 68-char hashes (with algorithm prefix)
**Priority:** Low - Easy fix

### 4. MINT_TOKEN-022: Non-deterministic tokenId ❌
**Fix:** CLI bug - Make tokenId deterministic when salt is provided
**Priority:** High - Core functionality

### 5. MINT_TOKEN-025: Negative amounts accepted ❌
**Fix:** CLI bug - Add input validation to reject negative amounts
**Priority:** CRITICAL - Security vulnerability

## Recommended Immediate Actions

###  CRITICAL: Fix MINT_TOKEN-025 (Security)

Add to `src/utils/input-validation.ts`:
```typescript
export function validateCoinAmount(amount: string): ValidationResult {
  try {
    const parsed = BigInt(amount);
    if (parsed < 0n) {
      return {
        valid: false,
        field: 'coin-amount',
        value: amount,
        error: 'Coin amount cannot be negative',
        severity: 'error'
      };
    }
    return { valid: true };
  } catch {
    return {
      valid: false,
      field: 'coin-amount',
      value: amount,
      error: 'Invalid coin amount',
      severity: 'error'
    };
  }
}
```

Add validation in `src/commands/mint-token.ts` before minting.

### 2. HIGH: Fix MINT_TOKEN-022 (Deterministic TokenId)

In `src/commands/mint-token.ts`, change tokenId generation:
```typescript
if (!tokenIdInput) {
  if (saltInput) {
    // Deterministic
    const hasher = new DataHasher(HashAlgorithm.SHA256);
    hasher.write(salt);
    hasher.write(publicKeyBytes);
    tokenId = hasher.digest();
  } else {
    // Random
    tokenId = crypto.getRandomValues(new Uint8Array(32));
  }
}
```

### 3. LOW: Fix MINT_TOKEN-020 (Hash Validation)

In `tests/helpers/assertions.bash:1610-1614`, change:
```bash
# Accept 64-char or 68-char hashes
if [[ ! "$merkle_root" =~ ^[0-9a-fA-F]{64}$ ]] && [[ ! "$merkle_root" =~ ^[0-9a-fA-F]{68}$ ]]; then
  printf "${COLOR_RED}✗ Invalid Merkle root format${COLOR_RESET}\n" >&2
  return 1
fi
```

### 4. INVESTIGATE: MINT_TOKEN-013, 015, 017

Need to understand why unmasked address tests fail while masked tests pass.
Run with debug to see the actual difference.

### 5. REFACTOR: MINT_TOKEN-012 (Stdout)

When `--stdout` is used, CLI should:
- Output ONLY JSON to stdout (use console.log)
- Send ALL diagnostics to stderr (use console.error)  
- Not save to file

## Files to Modify

1. `src/utils/input-validation.ts` - Add `validateCoinAmount()`
2. `src/commands/mint-token.ts` - Add validation, fix deterministic tokenId, fix --stdout
3. `tests/helpers/assertions.bash` - Accept 68-char hashes

## Success Metrics

After fixes, we should have:
- **26/28 tests passing** (93%)
- Security vulnerability fixed
- Deterministic tokenId working correctly
- Hash validation accepting both formats

The remaining 2 failures (unmasked address tests) need further investigation.
