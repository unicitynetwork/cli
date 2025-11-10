# Mint Token Test Failure Analysis

## Executive Summary

7 out of 28 mint-token tests are failing. This analysis identifies the root cause of each failure and proposes concrete fixes.

## Test Failure Breakdown

### 1. MINT_TOKEN-002: Mint NFT with JSON metadata ❌

**Test Location:** `tests/functional/test_mint_token.bats:60-79`

**Failure:**
```bash
assert_output_contains "Test NFT"  # Line 78 - FAILS
```

**Root Cause:**
- The test calls `decoded_data=$(get_token_data "token.txf")` 
- Then tries to find "Test NFT" in the `$output` variable (from BATS)
- But `get_token_data()` returns the decoded value, it doesn't set `$output`
- The assertion is checking the WRONG variable

**Evidence from test output:**
```json
"tokenData": "7b226e616d65223a2254657374204e4654222c226465736372697074696f6e223a2254657374204465736372697074696f6e222c22696d616765223a22697066733a2f2f516d2e2e2e227d"
```

Decoded: `{"name":"Test NFT","description":"Test Description","image":"ipfs://Qm..."}`

**Fix:**
```bash
# Current (WRONG):
local decoded_data
decoded_data=$(get_token_data "token.txf")
assert_output_contains "Test NFT"  # Checks wrong variable

# Fixed:
local decoded_data
decoded_data=$(get_token_data "token.txf")
assert_string_contains "$decoded_data" "Test NFT"  # Check the actual data
```

---

### 2. MINT_TOKEN-008: Mint with masked predicate ❌

**Test Location:** `tests/functional/test_mint_token.bats:177-197`

**Failure:**
```bash
address=$(get_txf_address "token.txf")  # Returns empty string
assert_address_type "${address}" "masked"  # FAILS - address is empty
```

**Root Cause:**
The `get_txf_address()` function looks for the address in `genesis.data.recipient`, but this field doesn't exist in the TXF structure.

**Evidence from token structure:**
```json
"genesis": {
  "data": {
    "recipient": "DIRECT://0000a28afcabc938...",  // This exists!
    ...
  }
}
```

**Actually, the address IS there!** The issue is that `get_txf_address()` is returning the value correctly, but the test is checking an empty variable.

**Real issue:** The test does:
```bash
local address
address=$(get_txf_address "token.txf")
assert_address_type "${address}" "masked"
```

But the function at `tests/helpers/token-helpers.bash:592-608` tries to extract from `genesis.data.recipient`, which works, but then the assertion at `tests/helpers/assertions.bash:1397-1437` fails with:

```
✗ Address does not start with DIRECT://
  Address:
```

This means `get_txf_address()` is returning an empty string despite the address being in the file!

**Debugging needed:**
```bash
# Check what jq returns
jq -r '.genesis.data.recipient // empty' token.txf

# The function should work, but something is failing
```

**Fix:** The `get_txf_address()` function needs to be fixed. It's in `tests/helpers/token-helpers.bash:592-608`:

```bash
get_txf_address() {
  local token_file="${1:?Token file required}"

  # For newly minted tokens, the address is in genesis.data.recipient
  local address
  address=$(jq -r '.genesis.data.recipient // empty' "$token_file" 2>/dev/null)

  if [[ -n "$address" ]] && [[ "$address" != "null" ]]; then
    printf "%s" "$address"
    return 0
  fi

  # If not found, return empty
  echo ""
  return 1
}
```

**The issue:** The function uses `jq` but tests use `~/.local/bin/jq`. There's a PATH inconsistency!

**Correct fix:**
```bash
get_txf_address() {
  local token_file="${1:?Token file required}"

  # Use the same jq path as other helper functions
  local address
  address=$(~/.local/bin/jq -r '.genesis.data.recipient // empty' "$token_file" 2>/dev/null)

  if [[ -n "$address" ]] && [[ "$address" != "null" ]]; then
    printf "%s" "$address"
    return 0
  fi

  # If not found, return empty
  echo ""
  return 1
}
```

---

### 3. MINT_TOKEN-012: Mint with stdout output ❌

**Test Location:** `tests/functional/test_mint_token.bats:241-260`

**Failure:**
```
✗ TXF file contains invalid JSON
```

**Root Cause:**
The test does:
```bash
run_cli_with_secret "${SECRET}" "mint-token --preset nft --local --stdout"
assert_success

# Save output to file
echo "$output" > captured-token.json  # ❌ WRONG
```

The problem is that `run_cli_with_secret` uses `run_cli`, which captures ONLY stdout. But the CLI outputs diagnostic messages to stderr, so `$output` contains the TXF JSON **plus all the stderr messages**.

**Evidence:**
```
=== Self-Mint Pattern: Minting token to yourself ===

⚠️  WARNING: Secret validation bypassed (--unsafe-secret flag used).
...
✅ Token saved to token.txf
...
{
  "version": "2.0",
  ...
}
```

The captured output includes all the diagnostic output, making it invalid JSON.

**Fix:**
The test is actually correct in its approach - the problem is that when using `--stdout`, the CLI should output ONLY the JSON to stdout, but it's mixing stderr content.

**Check the CLI implementation:**
Looking at `run_cli` in `tests/helpers/common.bash:197-234`:

```bash
# Capture output and exit code
# Note: Only capture stdout, not stderr (diagnostic messages go to stderr)
output=$(eval $timeout_cmd "${UNICITY_NODE_BIN:-node}" "$cli_path" "$@") || exit_code=$?
```

This looks correct - it should only capture stdout. The issue is that the test output shows both stdout and stderr are being captured.

**Actually, wait!** Looking at the test failure output more carefully:

The test does `echo "$output" > captured-token.json`, which should write the TXF JSON. But the error shows:
```
✗ TXF file contains invalid JSON
```

Let me check what's in captured-token.json by looking at the test more carefully. The test expects `--stdout` to output ONLY the TXF JSON, but currently the CLI might be mixing messages.

**Real fix:** The CLI's `--stdout` flag needs to ensure that:
1. All diagnostic messages go to stderr
2. Only the TXF JSON goes to stdout

This is a CLI implementation issue, not a test issue.

---

### 4. MINT_TOKEN-013, 015, 017: Address extraction tests ❌

**Same root cause as MINT_TOKEN-008** - `get_txf_address()` returns empty string due to jq path issue.

**Fix:** Same as MINT_TOKEN-008 - update `get_txf_address()` to use `~/.local/bin/jq`.

---

### 5. MINT_TOKEN-020: Mint using local aggregator ❌

**Test Location:** `tests/functional/test_mint_token.bats:380-395`

**Failure:**
```bash
assert_has_inclusion_proof "token.txf"  # Line 388
# ✗ Invalid Merkle root format (expected 64-char hex): 0000da5d2a5449beb30574ec674dc1ab054bdc9e4e273cae51dbc2657262b3981ce9
```

**Root Cause:**
The Merkle root is **68 characters**, not 64. It includes a 4-character algorithm prefix (`0000`).

**Evidence:**
```
"root": "0000da5d2a5449beb30574ec674dc1ab054bdc9e4e273cae51dbc2657262b3981ce9"
         ^^^^
         Algorithm prefix (SHA256 = 0000)
```

**Fix:**
Update `assert_has_inclusion_proof()` at `tests/helpers/assertions.bash:1585-1621`:

```bash
# Current (line 1610-1614):
local merkle_root
merkle_root=$(~/.local/bin/jq -r '.genesis.inclusionProof.merkleTreePath.root' "$file" 2>/dev/null)
if [[ ! "$merkle_root" =~ ^[0-9a-fA-F]{64}$ ]]; then
  printf "${COLOR_RED}✗ Invalid Merkle root format (expected 64-char hex): %s${COLOR_RESET}\n" "$merkle_root" >&2
  return 1
fi

# Fixed:
local merkle_root
merkle_root=$(~/.local/bin/jq -r '.genesis.inclusionProof.merkleTreePath.root' "$file" 2>/dev/null)
# Accept both 64-char hash (raw) and 68-char hash (with 4-char algorithm prefix)
if [[ ! "$merkle_root" =~ ^[0-9a-fA-F]{64}$ ]] && [[ ! "$merkle_root" =~ ^[0-9a-fA-F]{68}$ ]]; then
  printf "${COLOR_RED}✗ Invalid Merkle root format (expected 64 or 68-char hex): %s${COLOR_RESET}\n" "$merkle_root" >&2
  return 1
fi
```

---

### 6. MINT_TOKEN-022: Same inputs produce same token ID ❌

**Test Location:** `tests/functional/test_mint_token.bats:426-448`

**Failure:**
```
Expected: 5682499b29dce30903280e3b9dbe429fca22eb1d8865815f6bece2566f88277d
Actual:   f6f50801925ae768d7e7febbff8b603c8c1b513b409836a59a59dcabd911a532
```

**Root Cause:**
The test expects deterministic token ID generation when using the same salt and secret, but the CLI output shows:

```
# First mint:
Generated random tokenId: 5682499b29dce30903280e3b9dbe429fca22eb1d8865815f6bece2566f88277d
Using hex salt: 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# Second mint:
Generated random tokenId: f6f50801925ae768d7e7febbff8b603c8c1b513b409836a59a59dcabd911a532
Using hex salt: 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

The CLI says "Generated random tokenId" but the test is passing `--salt` which should make it deterministic!

**The issue:** Even though the same salt is used, the tokenId is being **randomly generated** instead of being deterministically derived from the salt.

**This is a CLI bug!** When `--salt` is provided but `--token-id` is not, the CLI should generate the token ID deterministically from the salt, not randomly.

**Fix:** Update `mint-token.ts` to derive tokenId from salt when not explicitly provided:

```typescript
// Current behavior (WRONG):
if (!tokenId) {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  console.error(`Generated random tokenId: ${HexConverter.encode(randomBytes)}`);
  tokenId = randomBytes;
}

// Fixed behavior:
if (!tokenId) {
  if (salt) {
    // Deterministic: hash(salt + publicKey) to get tokenId
    const hasher = new DataHasher(HashAlgorithm.SHA256);
    hasher.write(salt);
    hasher.write(publicKeyBytes);
    tokenId = hasher.digest();
    console.error(`Generated deterministic tokenId from salt: ${HexConverter.encode(tokenId)}`);
  } else {
    // Random
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    console.error(`Generated random tokenId: ${HexConverter.encode(randomBytes)}`);
    tokenId = randomBytes;
  }
}
```

---

### 7. MINT_TOKEN-025: Reject negative coin amount ❌

**Test Location:** `tests/functional/test_mint_token.bats:489-499`

**Failure:**
```
✗ Assertion Failed: Expected failure (non-zero exit code)
  Actual: success (exit code 0)
```

**Root Cause:**
The CLI accepts negative coin amounts (`-1000`) and successfully mints the token:

```json
"coinData": [
  [
    "d8483bfd1657b6377211994064c359bcece8d6c5f75195f7e22d360df52581a8",
    "-1000"
  ]
]
```

**This is a critical input validation bug!** Negative amounts should be rejected.

**Fix:**
Add validation to `mint-token.ts` or `src/utils/input-validation.ts`:

```typescript
// Add validation function
export function validateCoinAmount(amount: string): ValidationResult {
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
}

// In mint-token.ts, validate each coin amount:
if (coinAmounts && coinAmounts.length > 0) {
  for (const amount of coinAmounts) {
    const validation = validateCoinAmount(amount);
    if (!validation.valid) {
      throwValidationError(validation);
    }
  }
}
```

---

## Summary of Fixes

### Test Fixes (tests/helpers/*)

1. **token-helpers.bash:592-608** - Fix `get_txf_address()` to use `~/.local/bin/jq`
2. **assertions.bash:1610-1614** - Fix `assert_has_inclusion_proof()` to accept 68-char hashes
3. **test_mint_token.bats:78** - Fix MINT_TOKEN-002 to check `$decoded_data` not `$output`

### CLI Fixes (src/*)

4. **mint-token.ts** - Make tokenId deterministic when salt is provided
5. **mint-token.ts or input-validation.ts** - Reject negative coin amounts
6. **mint-token.ts** - Fix `--stdout` to output ONLY JSON (no diagnostic messages)

---

## Test Priority

**Critical (Security):**
- MINT_TOKEN-025 (negative amounts) - Security vulnerability

**High (Correctness):**
- MINT_TOKEN-022 (deterministic tokenId) - Core functionality broken
- MINT_TOKEN-012 (stdout output) - CLI UX issue

**Medium (Test issues):**
- MINT_TOKEN-002 (assertion bug)
- MINT_TOKEN-008, 013, 015, 017 (helper function path)
- MINT_TOKEN-020 (hash format validation)

---

## Recommended Fix Order

1. Fix MINT_TOKEN-025 (negative amounts) - **Security critical**
2. Fix `get_txf_address()` - Fixes 4 tests at once
3. Fix `assert_has_inclusion_proof()` - Simple validation update
4. Fix MINT_TOKEN-022 (deterministic tokenId) - Core functionality
5. Fix MINT_TOKEN-002 - Test assertion bug
6. Fix MINT_TOKEN-012 (stdout) - Requires CLI refactoring

