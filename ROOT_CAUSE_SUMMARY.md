# Root Cause Analysis - Test Assertion Failures

## Quick Summary

**2 Critical Issues Found:**

1. **coinData Array Format Mismatch** (6-8 failing tests)
   - Tests use: `.genesis.data.coinData[0].amount` (object path)
   - SDK produces: `coinData[0][1]` (array-of-arrays format)
   - **Fix**: Change jq path from `[0].amount` to `[0][1]`

2. **Token Data Hex Decoding Missing** (2-3 failing tests)
   - `get_token_data()` returns raw hex string
   - Tests expect decoded JSON string
   - **Fix**: Add hex-to-ASCII decoder in helper function

---

## Issue #1: coinData Array Structure

### The Problem

When minting fungible tokens (UCT, USDU, EURU), the SDK stores coin data as an array of arrays:

```json
"coinData": [
  ["<coinId>", "<amount>"]
]
```

**NOT** as objects:
```json
"coinData": [
  {"coinId": "<coinId>", "amount": "<amount>"}
]
```

### Why Tests Fail

Tests use this jq path:
```bash
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0].amount' token.txf)
```

jq error:
```
jq: error: Cannot index array with string "amount"
```

Because `coinData[0]` is `["621df3f...", "1500000000000000000"]` (an array), not an object with `.amount` field.

### Correct Path

```bash
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
```

This correctly accesses:
- `[0]` = First coin entry
- `[1]` = Amount (second element of the array)
- `[0]` = Coin ID (first element of the array)

### Affected Lines

**File**: `/home/vrogojin/cli/tests/functional/test_mint_token.bats`

- **Line 134**: MINT_TOKEN-005 test
- **Line 153**: MINT_TOKEN-006 test
- **Line 173**: MINT_TOKEN-007 test (likely)
- **Line 199**: MINT_TOKEN-012 test (likely)
- **Line 218**: MINT_TOKEN-015 test (likely)
- **Line 237**: MINT_TOKEN-017 test (likely)

### Test Evidence

Test output shows valid JSON:
```json
{
  "coinData": [
    [
      "621df3f493450209967ef0b5ad7d6e4de65cf6aa6a9a4e8a6fc8121751eb539b",
      "1500000000000000000"
    ]
  ]
}
```

But test tries to access it as object:
```bash
.genesis.data.coinData[0].amount  # WRONG - coinData[0] is array, not object
```

Should be:
```bash
.genesis.data.coinData[0][1]  # RIGHT - second element of coin array
```

---

## Issue #2: Token Data Hex Decoding

### The Problem

When token data is stored as JSON metadata, the SDK encodes it as hex string in the TXF file:

```json
{
  "state": {
    "data": "7b226e616d65223a2254657374204e4654222c226465736372697074696f6e223a..."
  }
}
```

This hex string `7b226e616d65223a...` decodes to:
```json
{"name":"Test NFT","description":"Test Description",...}
```

### Why Tests Fail

The `get_token_data()` function in assertions.bash returns the raw hex string, but tests expect decoded JSON.

**File**: `/home/vrogojin/cli/tests/helpers/assertions.bash`, line ~1619

```bash
get_token_data() {
  local file="${1:?File path required}"
  local hex_data
  hex_data=$(~/.local/bin/jq -r '.state.data // .genesis.data.tokenData' "$file")
  echo "$hex_data"  # Returns hex, not decoded JSON
}
```

When test does:
```bash
local decoded_data
decoded_data=$(get_token_data "token.txf")
assert_output_contains "Test NFT"
# FAILS - decoded_data is hex, doesn't contain "Test NFT"
```

### Affected Tests

- **MINT_TOKEN-002**: Line 78 - `assert_output_contains "Test NFT"`
- **MINT_TOKEN-020**: Similar assertion
- Any test using `assert_output_contains` on token data

### Solution

Add hex-to-ASCII decoding to `get_token_data()`:

```bash
get_token_data() {
  local file="${1:?File path required}"
  local hex_data
  hex_data=$(~/.local/bin/jq -r '.state.data // .genesis.data.tokenData' "$file")

  if [[ -z "$hex_data" ]]; then
    return 1
  fi

  # Decode hex to ASCII
  printf '%b' "$(printf '%s' "$hex_data" | sed 's/../\\x&/g')"
}
```

This converts `7b226e616d65...` to `{"name":"Test NFT"...}`

---

## Why Some Tests Pass

**Passing Tests (10/28)**:
- MINT_TOKEN-001: No coinData involved (NFT)
- MINT_TOKEN-003: Plain text data (not JSON)
- MINT_TOKEN-004: Default coin (no amount check)
- MINT_TOKEN-009-011: Custom ID/salt (no data checks)
- MINT_TOKEN-014, -016, -018: Masked predicate (data structure same)
- MINT_TOKEN-023-024: Structure checks (no coinData/data content)

**Failing Tests (18/28)**:
- coinData path issues: Tests 5, 6, 7, 12, 15, 17, 19, 27, 28 (approx)
- Token data decoding: Tests 2, 13, 20, 21 (approx)
- Other issues: Tests 8, 25, 26, etc.

---

## Implementation Plan

### Step 1: Fix coinData Paths

**File**: `/home/vrogojin/cli/tests/functional/test_mint_token.bats`

Search and replace:
```bash
.genesis.data.coinData[0].amount
```

With:
```bash
.genesis.data.coinData[0][1]
```

Repeat for:
- `.genesis.data.coinData[0].coinId` → `.genesis.data.coinData[0][0]` (if used)

### Step 2: Fix Token Data Decoding

**File**: `/home/vrogojin/cli/tests/helpers/assertions.bash`

Locate `get_token_data()` function (line ~1619) and update:

```bash
# BEFORE:
get_token_data() {
  local file="${1:?File path required}"
  local hex_data
  hex_data=$(~/.local/bin/jq -r '.state.data // .genesis.data.tokenData' "$file")
  echo "$hex_data"
}

# AFTER:
get_token_data() {
  local file="${1:?File path required}"
  local hex_data
  hex_data=$(~/.local/bin/jq -r '.state.data // .genesis.data.tokenData' "$file")

  if [[ -z "$hex_data" ]]; then
    return 1
  fi

  # Decode hex string to ASCII
  # Converts hex pairs (e.g., 7b) to escape sequences (\x7b)
  # Then printf interprets them as ASCII characters
  printf '%b' "$(printf '%s' "$hex_data" | sed 's/../\\x&/g')"
}
```

### Step 3: Create Helper Functions (Optional but Recommended)

**File**: `/home/vrogojin/cli/tests/helpers/assertions.bash`

Add these helper functions to avoid repeating fixes:

```bash
# Get coin amount from coinData (second element of array)
get_coin_amount() {
  local file="${1:?File path required}"
  local coin_index="${2:-0}"
  ~/.local/bin/jq -r ".genesis.data.coinData[$coin_index][1]" "$file"
}

# Get coin ID from coinData (first element of array)
get_coin_id() {
  local file="${1:?File path required}"
  local coin_index="${2:-0}"
  ~/.local/bin/jq -r ".genesis.data.coinData[$coin_index][0]" "$file"
}
```

Then update tests to use:
```bash
# Instead of:
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)

# Use:
actual_amount=$(get_coin_amount "token.txf" 0)
```

---

## Verification

After fixes, re-run tests:

```bash
# Test individual failing tests
bats tests/functional/test_mint_token.bats --filter "MINT_TOKEN-005"
bats tests/functional/test_mint_token.bats --filter "MINT_TOKEN-006"
bats tests/functional/test_mint_token.bats --filter "MINT_TOKEN-002"

# Run full suite
npm test
```

Expected results after fixes:
- **MINT_TOKEN-005**: Should PASS (coinData[0][1] works)
- **MINT_TOKEN-006**: Should PASS (coinData[0][1] works)
- **MINT_TOKEN-002**: Should PASS (hex decoding works)
- Most other tests: Should improve significantly

---

## File Locations

### Files to Modify

1. `/home/vrogojin/cli/tests/functional/test_mint_token.bats`
   - **Reason**: Wrong coinData jq paths
   - **Lines**: 134, 153, (and others)
   - **Change**: Replace `.coinData[0].amount` with `.coinData[0][1]`

2. `/home/vrogojin/cli/tests/helpers/assertions.bash`
   - **Reason**: Missing hex decoder, wrong coinData paths in tests using it
   - **Lines**: ~1619 (get_token_data function)
   - **Change**: Add hex-to-ASCII decoding

### Files to Review

1. `/home/vrogojin/cli/tests/functional/test_*.bats`
   - **Reason**: May have same coinData path issue
   - **Action**: Search for `.coinData[].amount` and fix

2. `/home/vrogojin/cli/tests/edge-cases/*.bats`
   - **Reason**: May have similar assertion issues
   - **Action**: Review coinData assertions

---

## Root Cause Details

### Why coinData is Array of Arrays

The SDK's `Coin` or `CoinData` class likely serializes to tuple format for space efficiency:
```typescript
// SDK code (hypothetical)
interface CoinData {
  coinId: string;
  amount: string;
}

// Serialization to array format
toJSON(): [[string, string]] {
  return [[this.coinId, this.amount]];
}
```

This is more compact than object format for JSON encoding.

### Why Token Data is Hex-Encoded

The SDK stores JSON metadata as hex to maintain binary-safe encoding:
```typescript
// SDK code (hypothetical)
const jsonData = JSON.stringify({name: "Test NFT", ...});
const hexEncoded = Buffer.from(jsonData).toString('hex');
// "7b226e616d65223a..."
```

This ensures special characters don't break JSON parsing.

---

## Summary Table

| Issue | Type | Severity | Tests Affected | Fix Complexity |
|-------|------|----------|----------------|-----------------|
| coinData array format | Data structure | High | 6-8 tests | Low (1-line change) |
| Token data hex decoding | Missing function | Medium | 2-3 tests | Low (1-function update) |
| Version field extraction | FILE PATH | Low | 1 test | FIXED ✓ |

**Total Impact**: ~18/28 tests failing, all fixable with simple changes
