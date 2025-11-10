# Send-Token Test Failures: Quick Fix Guide

**3 test failures, all in test infrastructure (not CLI bugs)**

---

## Fix 1: Message Preservation (SEND_TOKEN-001)

**Problem:** Multi-word messages get truncated ("Test transfer message" → "Test")

**Root Cause:** `eval` in `run_cli()` causes bash word splitting

**File:** `/home/vrogojin/cli/tests/helpers/common.bash`  
**Lines:** 219-222

```bash
# BEFORE
if [[ -n "$timeout_cmd" ]]; then
  output=$(eval $timeout_cmd "${UNICITY_NODE_BIN:-node}" "$cli_path" "$@") || exit_code=$?
else
  output=$(eval "${UNICITY_NODE_BIN:-node}" "$cli_path" "$@") || exit_code=$?
fi

# AFTER
if [[ -n "$timeout_cmd" ]]; then
  output=$($timeout_cmd "${UNICITY_NODE_BIN:-node}" "$cli_path" "$@") || exit_code=$?
else
  output=$("${UNICITY_NODE_BIN:-node}" "$cli_path" "$@") || exit_code=$?
fi
```

**Change:** Remove `eval` command to preserve argument quoting

---

## Fix 2: Token Data Assertions (SEND_TOKEN-003)

**Problem:** Assertions check wrong variable (`$output` instead of `$data`)

**Root Cause:** Using `assert_output_contains` on extracted data stored in local variable

**File:** `/home/vrogojin/cli/tests/functional/test_send_token.bats`  
**Lines:** 128-132

```bash
# BEFORE
local data
data=$(get_token_data "transfer.txf")
assert_output_contains "Art NFT"
assert_output_contains "Alice"

# AFTER
local data
data=$(get_token_data "transfer.txf")
assert_string_contains "$data" "Art NFT"
assert_string_contains "$data" "Alice"
```

**Change:** Use `assert_string_contains "$data"` instead of `assert_output_contains`

---

## Fix 3: Coin Amount Extraction (SEND_TOKEN-004)

**Problem:** jq path treats coinData as objects, but it's an array of tuples

**Root Cause:** coinData structure is `[[coinId, amount], ...]` not `[{amount: ...}, ...]`

**File:** `/home/vrogojin/cli/tests/functional/test_send_token.bats`  
**Line:** 165

```bash
# BEFORE
amount=$(jq -r '.genesis.data.coinData[0].amount' transfer.txf)

# AFTER  
amount=$(jq -r '.genesis.data.coinData[0][1]' transfer.txf)
```

**Change:** Use tuple index `[0][1]` instead of object property `.amount`

---

## Bonus: Add Helper Functions

**File:** `/home/vrogojin/cli/tests/helpers/token-helpers.bash`  
**Location:** After line 591

```bash
# Get coin amount for specific coin index
# Args:
#   $1: Token file path
#   $2: Coin index (default: 0)
# Returns: Coin amount as string
get_coin_amount() {
  local token_file="${1:?Token file required}"
  local index="${2:-0}"
  jq -r ".genesis.data.coinData[${index}][1] // \"0\"" "$token_file" 2>/dev/null || echo "0"
}

# Get coin ID for specific coin index  
# Args:
#   $1: Token file path
#   $2: Coin index (default: 0)
# Returns: Coin ID as hex string
get_coin_id() {
  local token_file="${1:?Token file required}"
  local index="${2:-0}"
  jq -r ".genesis.data.coinData[${index}][0] // empty" "$token_file" 2>/dev/null || echo ""
}

export -f get_coin_amount
export -f get_coin_id
```

---

## Testing

```bash
# Run fixed tests individually
bats tests/functional/test_send_token.bats -f "SEND_TOKEN-001"
bats tests/functional/test_send_token.bats -f "SEND_TOKEN-003"
bats tests/functional/test_send_token.bats -f "SEND_TOKEN-004"

# Run full send-token suite
bats tests/functional/test_send_token.bats

# Run all functional tests
npm run test:functional
```

**Expected:** 13/13 SEND_TOKEN tests passing

---

## Key Insights

1. **CLI code is correct** - all failures are in test infrastructure
2. **Protocol compliance verified** - transfers follow Unicity SDK patterns correctly
3. **Data structures correct** - coinData format matches SDK spec (tuples not objects)
4. **Low risk fixes** - only test code changes, no CLI modifications needed

**Estimated Time:** 10-15 minutes  
**Files Changed:** 2 files (common.bash, test_send_token.bats), 1 optional enhancement (token-helpers.bash)
