# TXF coinData Structure Fix Summary

**Issue:** Tests expect coinData to be objects with `.amount` and `.coinId` properties, but SDK produces arrays of `[coinId, amount]` tuples.

**Impact:** 21 incorrect assertions across 6 test files

## The Problem

### What Tests Expect (WRONG)
```bash
amount=$(jq -r '.genesis.data.coinData[0].amount' token.txf)
coin_id=$(jq -r '.genesis.data.coinData[0].coinId' token.txf)
```

### What SDK Actually Produces (CORRECT)
```json
{
  "genesis": {
    "data": {
      "coinData": [
        ["090513256b916e7a6da4bf15d55dfa5b85cbd0ad9496b9e8dc0c554f809df72a", "1000"],
        ["13cb0221113c586b681b375c7e3788997937904edd069a53c31d51a6e02d621d", "2000"]
      ]
    }
  }
}
```

### Correct Access Pattern
```bash
amount=$(jq -r '.genesis.data.coinData[0][1]' token.txf)    # [1] = amount
coin_id=$(jq -r '.genesis.data.coinData[0][0]' token.txf)  # [0] = coinId
```

## Affected Files

### 1. tests/functional/test_mint_token.bats (14 occurrences)
- Line 134: `.coinData[0].amount`
- Line 153: `.coinData[0].amount`
- Line 172: `.coinData[0].amount`
- Line 360: `.coinData[0].amount`
- Line 364: `.coinData[1].amount`
- Line 368: `.coinData[2].amount`
- Line 373: `.coinData[0].coinId`
- Line 375: `.coinData[1].coinId`
- Line 421: `.coinData[0].amount`
- Line 511: `.coinData[0].amount`
- Line 527: `.coinData[0].coinId`
- Line 529: `.coinData[1].coinId`
- Line 531: `.coinData[2].coinId`

### 2. tests/edge-cases/test_data_boundaries.bats (3 occurrences)
- Line 230: `.coinData[0].amount`
- Line 259: `.coinData[0].amount // "none"`
- Line 299: `.coinData[0].amount`

### 3. tests/helpers/token-helpers.bash (1 occurrence)
- Line 521: `.coinData[].amount` in `get_total_coin_amount()`

### 4. tests/functional/test_send_token.bats (1 occurrence)
- Line 165: `.coinData[0].amount`

### 5. tests/functional/test_integration.bats (2 occurrences)
- Line 151: `.coinData[0].amount`
- Line 168: `.coinData[0].amount`

## Fix Strategy

### Global Search/Replace

```bash
# Search pattern
\.coinData\[([0-9]+)\]\.amount

# Replace with
.coinData[$1][1]

# For coinId
\.coinData\[([0-9]+)\]\.coinId

# Replace with
.coinData[$1][0]

# For array iteration
\.coinData\[\]\.amount

# Replace with
.coinData[][1]
```

### Test the Fix

```bash
# Create fungible token
SECRET="test" npm run mint-token -- --local --coins "1000,2000,3000" --save

# Verify tuple structure (should work)
jq '.genesis.data.coinData[0][0]' <file>.txf  # Returns coinId
jq '.genesis.data.coinData[0][1]' <file>.txf  # Returns "1000"

# Verify old pattern fails (should return null)
jq '.genesis.data.coinData[0].amount' <file>.txf  # Returns null
jq '.genesis.data.coinData[0].coinId' <file>.txf  # Returns null
```

## Additional Improvements

### Add Helper Functions to token-helpers.bash

```bash
# Get coin amount by index
get_coin_amount() {
  local token_file="${1:?Token file required}"
  local index="${2:-0}"
  jq -r ".genesis.data.coinData[$index][1]" "$token_file" 2>/dev/null || echo "0"
}

# Get coin ID by index
get_coin_id() {
  local token_file="${1:?Token file required}"
  local index="${2:-0}"
  jq -r ".genesis.data.coinData[$index][0]" "$token_file" 2>/dev/null || echo ""
}

# Get all coin amounts (for sum)
get_all_coin_amounts() {
  local token_file="${1:?Token file required}"
  jq -r '.genesis.data.coinData[][1]' "$token_file" 2>/dev/null
}
```

### Fix get_total_coin_amount()

**Current (Line 521):**
```bash
jq '[.genesis.data.coinData[].amount | tonumber] | add' "$token_file"
```

**Fixed:**
```bash
jq '[.genesis.data.coinData[][1] | tonumber] | add' "$token_file"
```

## Verification Script

```bash
#!/bin/bash
# verify-coindata-fix.sh

echo "Creating test fungible token..."
SECRET="test-verify" npm run mint-token -- --local --coins "1000,2000,3000" --save -q

# Find the created file
token_file=$(ls -t *.txf 2>/dev/null | head -1)

if [[ ! -f "$token_file" ]]; then
  echo "ERROR: No token file created"
  exit 1
fi

echo "Testing coinData structure in: $token_file"

# Test new tuple access (should work)
amount=$(jq -r '.genesis.data.coinData[0][1]' "$token_file")
coin_id=$(jq -r '.genesis.data.coinData[0][0]' "$token_file")

if [[ "$amount" == "1000" && ${#coin_id} -eq 64 ]]; then
  echo "✓ Tuple access works correctly"
else
  echo "✗ Tuple access failed: amount=$amount, coin_id=$coin_id"
  exit 1
fi

# Test old object access (should fail)
old_amount=$(jq -r '.genesis.data.coinData[0].amount' "$token_file")
old_coin_id=$(jq -r '.genesis.data.coinData[0].coinId' "$token_file")

if [[ "$old_amount" == "null" && "$old_coin_id" == "null" ]]; then
  echo "✓ Confirmed old object access pattern doesn't work"
else
  echo "✗ Unexpected: old pattern returned values"
  exit 1
fi

# Test iteration
count=$(jq '[.genesis.data.coinData[][1] | tonumber] | add' "$token_file")
if [[ "$count" == "6000" ]]; then
  echo "✓ Array iteration for sum works"
else
  echo "✗ Sum failed: $count (expected 6000)"
  exit 1
fi

echo ""
echo "All verifications passed!"
rm "$token_file"
```

## Expected Test Results After Fix

Before fix: ~21 test failures related to coinData assertions
After fix: All coinData assertions should pass

## Notes

- This is NOT a bug in the CLI or SDK
- The SDK correctly implements the TypeScript type: `type TokenCoinDataJson = [string, string][]`
- The tests were written with incorrect assumptions about the data structure
- No code changes needed in src/, only test files

## References

- SDK Type Definition: `node_modules/@unicitylabs/state-transition-sdk/lib/token/fungible/TokenCoinData.d.ts:4`
- Analysis Document: `TXF_STRUCTURE_ANALYSIS.md`
- Real TXF Example: `20251110_154702_1762786022437_0000de691b.txf`
