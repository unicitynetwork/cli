# Exact Fixes Required - Line by Line

## Fix #1: coinData Array Path in test_mint_token.bats

### Location: `/home/vrogojin/cli/tests/functional/test_mint_token.bats`

#### Change 1.1: Line 134 (MINT_TOKEN-005)

**Current (WRONG):**
```bash
    local actual_amount
    actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0].amount' token.txf)
    assert_equals "${amount}" "${actual_amount}"
```

**New (CORRECT):**
```bash
    local actual_amount
    actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
    assert_equals "${amount}" "${actual_amount}"
```

---

#### Change 1.2: Line 153 (MINT_TOKEN-006)

**Current (WRONG):**
```bash
    local actual_amount
    actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0].amount' token.txf)
    assert_equals "${amount}" "${actual_amount}"
```

**New (CORRECT):**
```bash
    local actual_amount
    actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
    assert_equals "${amount}" "${actual_amount}"
```

---

#### Change 1.3: Line 172-173 (MINT_TOKEN-007) - LIKELY NEEDS SAME FIX

Check lines around 172 for:
```bash
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0].amount'
```

If found, replace `.amount` with `[1]` as above.

---

#### Change 1.4: SEARCH FOR ALL OCCURRENCES

Run this command to find all occurrences that need fixing:

```bash
grep -n ".coinData\[0\].amount" /home/vrogojin/cli/tests/functional/test_mint_token.bats
```

Expected output shows all lines like:
```
134:    actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0].amount' token.txf)
153:    actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0].amount' token.txf)
(possibly more)
```

**For EACH line found**, replace:
```
.coinData[0].amount
```
with:
```
.coinData[0][1]
```

---

## Fix #2: Token Data Hex Decoding in assertions.bash

### Location: `/home/vrogojin/cli/tests/helpers/assertions.bash`

#### Find the function

Search for:
```bash
get_token_data() {
```

This should be around line 1619.

#### Current Code (INCOMPLETE)

```bash
get_token_data() {
  local file="${1:?File path required}"

  # Get the hex-encoded token data
  local hex_data
  hex_data=$(~/.local/bin/jq -r '.state.data // .genesis.data.tokenData' "$file" 2>/dev/null)

  # Return the hex data as-is
  # NOTE: Cannot decode without CBOR decoder
  echo "$hex_data"
}
```

#### New Code (WITH DECODING)

```bash
get_token_data() {
  local file="${1:?File path required}"

  # Get the hex-encoded token data
  local hex_data
  hex_data=$(~/.local/bin/jq -r '.state.data // .genesis.data.tokenData' "$file" 2>/dev/null)

  if [[ -z "$hex_data" ]]; then
    return 1
  fi

  # Decode hex to ASCII
  # Convert hex pairs (e.g., 7b) to escape sequences (\x7b)
  # Then printf interprets them as ASCII characters
  # Example: 7b226e616d65... becomes {"name"...
  printf '%b' "$(printf '%s' "$hex_data" | sed 's/../\\x&/g')"
}
```

**Key Changes:**
1. Added check for empty hex_data
2. Added hex-to-ASCII decoding using sed and printf
3. Returns decoded string instead of raw hex

---

## Fix #3: Optional - Add Helper Functions

### Location: `/home/vrogojin/cli/tests/helpers/assertions.bash`

#### Add these functions (after get_token_data, around line 1640)

```bash
# Helper: Get coin amount from coinData array
# Args: $1 = file path, $2 = coin index (optional, default 0)
# Returns: Amount string or empty if not found
get_coin_amount() {
  local file="${1:?File path required}"
  local coin_index="${2:-0}"

  if [[ ! -f "$file" ]]; then
    return 1
  fi

  ~/.local/bin/jq -r ".genesis.data.coinData[$coin_index][1]" "$file" 2>/dev/null || echo ""
}

# Helper: Get coin ID from coinData array
# Args: $1 = file path, $2 = coin index (optional, default 0)
# Returns: Coin ID string or empty if not found
get_coin_id() {
  local file="${1:?File path required}"
  local coin_index="${2:-0}"

  if [[ ! -f "$file" ]]; then
    return 1
  fi

  ~/.local/bin/jq -r ".genesis.data.coinData[$coin_index][0]" "$file" 2>/dev/null || echo ""
}

# Helper: Get coin count from coinData array
# Args: $1 = file path
# Returns: Number of coins
get_coin_count() {
  local file="${1:?File path required}"

  if [[ ! -f "$file" ]]; then
    return 1
  fi

  ~/.local/bin/jq '.genesis.data.coinData | length' "$file" 2>/dev/null || echo "0"
}
```

#### Then update test_mint_token.bats to use these

**Instead of:**
```bash
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
```

**Use:**
```bash
actual_amount=$(get_coin_amount "token.txf" 0)
```

---

## Summary of Changes

### Files to Modify: 2

1. **`/home/vrogojin/cli/tests/functional/test_mint_token.bats`**
   - Lines: 134, 153, (+ any others with `.coinData[0].amount`)
   - Change: Replace `.amount` with `[1]`

2. **`/home/vrogojin/cli/tests/helpers/assertions.bash`**
   - Lines: ~1619 (in `get_token_data` function)
   - Change: Add hex-to-ASCII decoding
   - Optional: Add helper functions around line 1640

### Total Changes: 2-3 line changes minimum, 6-8 if using helpers

### Risk Level: VERY LOW
- Changes are localized
- No dependency changes
- No breaking changes
- All changes are bug fixes

---

## Testing Changes

### Test 1: Verify coinData Fix

```bash
# After fixing line 134
bats /home/vrogojin/cli/tests/functional/test_mint_token.bats --filter "MINT_TOKEN-005"
# Should PASS
```

### Test 2: Verify Token Data Decoding

```bash
# After fixing get_token_data function
bats /home/vrogojin/cli/tests/functional/test_mint_token.bats --filter "MINT_TOKEN-002"
# Should PASS
```

### Test 3: Full Suite

```bash
# After all fixes
npm test
# Should show significant improvement in pass rate
```

---

## Validation Commands

### Before Starting

```bash
# Count current failures
bats /home/vrogojin/cli/tests/functional/test_mint_token.bats 2>&1 | grep "not ok" | wc -l
# Current: ~18 failures
```

### After Fixes

```bash
# Count fixed tests
bats /home/vrogojin/cli/tests/functional/test_mint_token.bats 2>&1 | grep "not ok" | wc -l
# Expected: ~10-12 failures (rest are unrelated issues)
```

### Specific Verification

```bash
# Test the exact jq path works
cat > /tmp/test_fix.json << 'EOF'
{
  "genesis": {
    "data": {
      "coinData": [
        [
          "abc123",
          "1500000000000000000"
        ]
      ]
    }
  },
  "state": {
    "data": "7b226e616d65223a2254657374227d"
  }
}
EOF

# Test 1: coinData fix
jq -r '.genesis.data.coinData[0][1]' /tmp/test_fix.json
# Output: 1500000000000000000

# Test 2: hex decoding fix
hex_data="7b226e616d65223a2254657374227d"
printf '%b' "$(printf '%s' "$hex_data" | sed 's/../\\x&/g')"
# Output: {"name":"test"}
```

---

## Rollback Plan

If any issue occurs, simply revert the changes:

```bash
# Check what changed
git diff /home/vrogojin/cli/tests/functional/test_mint_token.bats
git diff /home/vrogojin/cli/tests/helpers/assertions.bash

# Rollback if needed
git checkout /home/vrogojin/cli/tests/functional/test_mint_token.bats
git checkout /home/vrogojin/cli/tests/helpers/assertions.bash
```

---

## Related Issues Found But Not Fixed In This Pass

1. **Token data decoding for plain text**: Currently works, no fix needed
2. **File path handling**: Currently works in BATS context
3. **Version field extraction**: Already fixed in previous versions
4. **Masked predicate tests**: May have separate issues
5. **Multi-coin coinId uniqueness**: Will be fixed by coinData path fix

---

## Next Steps After Fixes

1. Run full test suite: `npm test`
2. Fix remaining failures (if any)
3. Update documentation on coinData structure
4. Add code comments explaining array format
5. Consider SDK update when structure is finalized
