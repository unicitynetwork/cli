# Mint Token Test Failures - Final Analysis and Fixes

## Summary

7 out of 28 mint-token tests fail. After detailed investigation, here are the root causes and fixes:

---

## 1. MINT_TOKEN-002: JSON metadata not found in output ❌

**Location:** `tests/functional/test_mint_token.bats:73-78`

**Failure:**
```bash
local decoded_data
decoded_data=$(get_token_data "token.txf")
assert_output_contains "Test NFT"  # ❌ Checks wrong variable
```

**Root Cause:** Test bug - `get_token_data()` returns the value in `$decoded_data`, but the assertion checks the BATS `$output` variable from the CLI command.

**Fix:**
```bash
local decoded_data
decoded_data=$(get_token_data "token.txf")
assert_string_contains "$decoded_data" "Test NFT"  # ✅ Check the correct variable
```

**Type:** Test bug (not CLI bug)

---

## 2-5. MINT_TOKEN-008, 013, 015, 017: Address extraction returns empty ❌

**Location:** Multiple tests checking masked/unmasked addresses

**Failure:**
```
✗ Address does not start with DIRECT://
  Address: 
```

**Investigation:** The `get_txf_address()` function works correctly when tested in isolation, but returns empty in the test context.

**Hypothesis:** The issue is that these tests run in sequence within the SAME BATS test file, and there might be a working directory or variable contamination issue.

**Alternative hypothesis:** The test is using a relative path `token.txf` but the working directory has changed.

**Need to verify:** Run test with debug to see actual working directory.

**Fix (tentative):** Use absolute paths in tests:
```bash
local test_file="${TEST_TEMP_DIR}/token.txf"
run_cli_with_secret "${SECRET}" "mint-token --preset nft --local -o ${test_file}"
local address
address=$(get_txf_address "${test_file}")
```

**Type:** Test environment issue (likely)

---

## 6. MINT_TOKEN-012: Stdout contains diagnostic messages ❌

**Location:** `tests/functional/test_mint_token.bats:241-260`

**Failure:**
```
✗ TXF file contains invalid JSON
```

**Root Cause:** When using `--stdout`, the CLI mixes diagnostic messages (stderr) into the output stream. The test captures this mixed output, which is not valid JSON.

**Evidence:** The `run_cli` function should only capture stdout, but the test output shows both stdout and stderr content.

**Fix:** The CLI needs to respect `--stdout` by:
1. Outputting ONLY the TXF JSON to stdout (console.log)
2. Sending ALL diagnostic messages to stderr (console.error)

**Current behavior:**
- Uses `console.error()` for diagnostics ✅
- Saves to file AND prints success message ❌
- Needs to ONLY print JSON when `--stdout` is used

**Type:** CLI bug

---

## 7. MINT_TOKEN-020: Merkle root validation rejects 68-char hashes ❌

**Location:** `tests/functional/test_mint_token.bats:380-395`

**Failure:**
```
✗ Invalid Merkle root format (expected 64-char hex): 0000da5d2a...981ce9
```

**Root Cause:** The aggregator returns Merkle roots with a 4-character algorithm prefix (`0000` for SHA256), making them 68 chars total. The test validation expects exactly 64 chars.

**Fix:** Update `tests/helpers/assertions.bash:1610-1614`:
```bash
# Accept both 64-char and 68-char hashes
if [[ ! "$merkle_root" =~ ^[0-9a-fA-F]{64}$ ]] && [[ ! "$merkle_root" =~ ^[0-9a-fA-F]{68}$ ]]; then
  printf "${COLOR_RED}✗ Invalid Merkle root format (expected 64 or 68-char hex): %s${COLOR_RESET}\n" "$merkle_root" >&2
  return 1
fi
```

**Type:** Test validation bug

---

## 8. MINT_TOKEN-022: Non-deterministic tokenId despite same salt ❌

**Location:** `tests/functional/test_mint_token.bats:426-448`

**Failure:**
```
Expected: 5682499b29dce30903280e3b9dbe429fca22eb1d8865815f6bece2566f88277d
Actual:   f6f50801925ae768d7e7febbff8b603c8c1b513b409836a59a59dcabd911a532
```

**Root Cause:** The CLI ALWAYS generates a random tokenId, even when `--salt` is provided. The test expects that using the same salt should produce the same tokenId (deterministic).

**CLI behavior:**
```typescript
// Current (WRONG):
if (!tokenIdInput) {
  tokenId = await processInput(undefined, 'tokenId', { requireHash: true });
  // This ALWAYS generates random bytes
}
```

**Expected behavior:** When salt is provided but tokenId is not, derive tokenId deterministically from salt.

**Fix:** In `src/commands/mint-token.ts`:
```typescript
if (!tokenIdInput) {
  if (saltInput) {
    // Deterministic: hash(salt + publicKey)
    const hasher = new DataHasher(HashAlgorithm.SHA256);
    hasher.write(salt);
    hasher.write(publicKeyBytes);
    tokenId = hasher.digest();
    console.error(`Derived deterministic tokenId from salt`);
  } else {
    // Random
    tokenId = crypto.getRandomValues(new Uint8Array(32));
    console.error(`Generated random tokenId`);
  }
}
```

**Type:** CLI bug - missing deterministic tokenId generation

---

## 9. MINT_TOKEN-025: Negative coin amounts accepted ❌ **SECURITY CRITICAL**

**Location:** `tests/functional/test_mint_token.bats:489-499`

**Failure:**
```
✗ Expected failure (non-zero exit code)
  Actual: success (exit code 0)
```

**Root Cause:** The CLI accepts negative coin amounts without validation:

```json
"coinData": [
  ["d8483bfd...", "-1000"]
]
```

**This is a security vulnerability!** Negative amounts can be used to exploit token systems.

**Fix:** Add validation in `src/utils/input-validation.ts`:

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
      error: 'Invalid coin amount (must be a number)',
      severity: 'error'
    };
  }
}
```

Then in `src/commands/mint-token.ts`, validate each amount:
```typescript
if (coinAmounts && coinAmounts.length > 0) {
  for (const amount of coinAmounts) {
    const validation = validateCoinAmount(amount);
    if (!validation.valid) {
      throwValidationError(validation);
    }
  }
}
```

**Type:** CLI bug - SECURITY VULNERABILITY

---

## Fix Priority

### 🔴 Critical (Security)
1. **MINT_TOKEN-025** - Reject negative coin amounts

### 🟡 High (Core Functionality)  
2. **MINT_TOKEN-022** - Deterministic tokenId from salt
3. **MINT_TOKEN-012** - Stdout should output only JSON

### 🟢 Medium (Test Fixes)
4. **MINT_TOKEN-020** - Accept 68-char Merkle roots
5. **MINT_TOKEN-002** - Fix assertion to check decoded_data
6. **MINT_TOKEN-008/013/015/017** - Debug working directory issue

---

## Files to Modify

### Security Fix
- `src/utils/input-validation.ts` - Add `validateCoinAmount()`
- `src/commands/mint-token.ts` - Call validation before minting

### Functionality Fixes
- `src/commands/mint-token.ts` - Deterministic tokenId from salt
- `src/commands/mint-token.ts` - Fix --stdout to output only JSON

### Test Fixes
- `tests/helpers/assertions.bash` - Accept 68-char Merkle roots (line 1610-1614)
- `tests/functional/test_mint_token.bats` - Fix MINT_TOKEN-002 assertion (line 78)
- `tests/functional/test_mint_token.bats` - Add debug/fix for address tests (008, 013, 015, 017)

---

## Next Steps

1. Implement security fix (MINT_TOKEN-025) immediately
2. Fix deterministic tokenId (MINT_TOKEN-022)
3. Fix test validation bugs (MINT_TOKEN-002, 020)
4. Debug and fix address extraction tests (MINT_TOKEN-008, 013, 015, 017)
5. Refactor --stdout handling (MINT_TOKEN-012)
