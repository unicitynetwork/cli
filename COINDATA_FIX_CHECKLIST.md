# coinData Fix Checklist - Specific Line-by-Line Changes

**Total changes needed:** 21 across 6 files

## File 1: tests/functional/test_mint_token.bats (14 changes)

### Line 134
```bash
# BEFORE:
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0].amount' token.txf)

# AFTER:
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
```

### Line 153
```bash
# BEFORE:
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0].amount' token.txf)

# AFTER:
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
```

### Line 172
```bash
# BEFORE:
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0].amount' token.txf)

# AFTER:
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
```

### Line 360
```bash
# BEFORE:
amount1=$(~/.local/bin/jq -r '.genesis.data.coinData[0].amount' token.txf)

# AFTER:
amount1=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
```

### Line 364
```bash
# BEFORE:
amount2=$(~/.local/bin/jq -r '.genesis.data.coinData[1].amount' token.txf)

# AFTER:
amount2=$(~/.local/bin/jq -r '.genesis.data.coinData[1][1]' token.txf)
```

### Line 368
```bash
# BEFORE:
amount3=$(~/.local/bin/jq -r '.genesis.data.coinData[2].amount' token.txf)

# AFTER:
amount3=$(~/.local/bin/jq -r '.genesis.data.coinData[2][1]' token.txf)
```

### Line 373
```bash
# BEFORE:
coin_id1=$(~/.local/bin/jq -r '.genesis.data.coinData[0].coinId' token.txf)

# AFTER:
coin_id1=$(~/.local/bin/jq -r '.genesis.data.coinData[0][0]' token.txf)
```

### Line 375
```bash
# BEFORE:
coin_id2=$(~/.local/bin/jq -r '.genesis.data.coinData[1].coinId' token.txf)

# AFTER:
coin_id2=$(~/.local/bin/jq -r '.genesis.data.coinData[1][0]' token.txf)
```

### Line 421
```bash
# BEFORE:
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0].amount' token.txf)

# AFTER:
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
```

### Line 511
```bash
# BEFORE:
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0].amount' token.txf)

# AFTER:
actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
```

### Line 527
```bash
# BEFORE:
coin_id1=$(~/.local/bin/jq -r '.genesis.data.coinData[0].coinId' token.txf)

# AFTER:
coin_id1=$(~/.local/bin/jq -r '.genesis.data.coinData[0][0]' token.txf)
```

### Line 529
```bash
# BEFORE:
coin_id2=$(~/.local/bin/jq -r '.genesis.data.coinData[1].coinId' token.txf)

# AFTER:
coin_id2=$(~/.local/bin/jq -r '.genesis.data.coinData[1][0]' token.txf)
```

### Line 531
```bash
# BEFORE:
coin_id3=$(~/.local/bin/jq -r '.genesis.data.coinData[2].coinId' token.txf)

# AFTER:
coin_id3=$(~/.local/bin/jq -r '.genesis.data.coinData[2][0]' token.txf)
```

---

## File 2: tests/edge-cases/test_data_boundaries.bats (3 changes)

### Line 230
```bash
# BEFORE:
amount=$(jq -r '.genesis.data.coinData[0].amount' "$token_file")

# AFTER:
amount=$(jq -r '.genesis.data.coinData[0][1]' "$token_file")
```

### Line 259
```bash
# BEFORE:
amount=$(jq -r '.genesis.data.coinData[0].amount // "none"' "$token_file")

# AFTER:
amount=$(jq -r '.genesis.data.coinData[0][1] // "none"' "$token_file")
```

### Line 299
```bash
# BEFORE:
amount=$(jq -r '.genesis.data.coinData[0].amount' "$token_file")

# AFTER:
amount=$(jq -r '.genesis.data.coinData[0][1]' "$token_file")
```

---

## File 3: tests/helpers/token-helpers.bash (1 change)

### Line 521 (in get_total_coin_amount function)
```bash
# BEFORE:
jq '[.genesis.data.coinData[].amount | tonumber] | add' "$token_file" 2>/dev/null || echo "0"

# AFTER:
jq '[.genesis.data.coinData[][1] | tonumber] | add' "$token_file" 2>/dev/null || echo "0"
```

**Also add new helper functions after line 521:**

```bash
# Get coin amount by index
# Args:
#   $1: Token file path
#   $2: Coin index (default 0)
# Returns: Coin amount as string
get_coin_amount() {
  local token_file="${1:?Token file required}"
  local index="${2:-0}"
  jq -r ".genesis.data.coinData[$index][1]" "$token_file" 2>/dev/null || echo "0"
}

# Get coin ID by index
# Args:
#   $1: Token file path
#   $2: Coin index (default 0)
# Returns: Coin ID (64 hex chars)
get_coin_id() {
  local token_file="${1:?Token file required}"
  local index="${2:-0}"
  jq -r ".genesis.data.coinData[$index][0]" "$token_file" 2>/dev/null || echo ""
}

# Get all coin IDs
# Args:
#   $1: Token file path
# Returns: List of coin IDs, one per line
get_all_coin_ids() {
  local token_file="${1:?Token file required}"
  jq -r '.genesis.data.coinData[][0]' "$token_file" 2>/dev/null
}

# Get all coin amounts
# Args:
#   $1: Token file path
# Returns: List of amounts, one per line
get_all_coin_amounts() {
  local token_file="${1:?Token file required}"
  jq -r '.genesis.data.coinData[][1]' "$token_file" 2>/dev/null
}
```

---

## File 4: tests/functional/test_send_token.bats (1 change)

### Line 165
```bash
# BEFORE:
amount=$(jq -r '.genesis.data.coinData[0].amount' transfer.txf)

# AFTER:
amount=$(jq -r '.genesis.data.coinData[0][1]' transfer.txf)
```

---

## File 5: tests/functional/test_integration.bats (2 changes)

### Line 151
```bash
# BEFORE:
coin_amount=$(jq -r '.genesis.data.coinData[0].amount' alice-uct.txf)

# AFTER:
coin_amount=$(jq -r '.genesis.data.coinData[0][1]' alice-uct.txf)
```

### Line 168
```bash
# BEFORE:
coin_amount=$(jq -r '.genesis.data.coinData[0].amount' bob-uct.txf)

# AFTER:
coin_amount=$(jq -r '.genesis.data.coinData[0][1]' bob-uct.txf)
```

---

## Verification After Changes

Run these commands to verify all changes were applied correctly:

```bash
# 1. Check no old patterns remain
grep -rn "\.coinData\[.*\]\.amount\|\.coinData\[.*\]\.coinId" tests/functional/test_mint_token.bats tests/edge-cases/test_data_boundaries.bats tests/helpers/token-helpers.bash tests/functional/test_send_token.bats tests/functional/test_integration.bats

# Should return: no matches

# 2. Count new correct patterns
grep -rn "\.coinData\[.*\]\[0\]\|\.coinData\[.*\]\[1\]" tests/ --include="*.bats" --include="*.bash" | wc -l

# Should return: 21 (or more if helper functions added)

# 3. Run affected tests
cd /home/vrogojin/cli
npm run test:functional -- test_mint_token.bats
npm run test:edge-cases -- test_data_boundaries.bats
npm run test:functional -- test_send_token.bats
npm run test:functional -- test_integration.bats
```

---

## Automated Fix Script

```bash
#!/bin/bash
# fix-coindata-access.sh

cd /home/vrogojin/cli

# Backup files
echo "Creating backups..."
for file in \
  tests/functional/test_mint_token.bats \
  tests/edge-cases/test_data_boundaries.bats \
  tests/helpers/token-helpers.bash \
  tests/functional/test_send_token.bats \
  tests/functional/test_integration.bats; do
  cp "$file" "$file.backup-$(date +%Y%m%d-%H%M%S)"
done

echo "Applying fixes..."

# Fix .coinData[N].amount -> .coinData[N][1]
sed -i 's/\.coinData\[\([0-9]\+\)\]\.amount/.coinData[\1][1]/g' \
  tests/functional/test_mint_token.bats \
  tests/edge-cases/test_data_boundaries.bats \
  tests/helpers/token-helpers.bash \
  tests/functional/test_send_token.bats \
  tests/functional/test_integration.bats

# Fix .coinData[N].coinId -> .coinData[N][0]
sed -i 's/\.coinData\[\([0-9]\+\)\]\.coinId/.coinData[\1][0]/g' \
  tests/functional/test_mint_token.bats

# Fix .coinData[].amount -> .coinData[][1] (for iteration)
sed -i 's/\.coinData\[\]\.amount/.coinData[][1]/g' \
  tests/helpers/token-helpers.bash

echo "Fixes applied!"
echo ""
echo "Verification:"
remaining=$(grep -rn "\.coinData\[.*\]\.amount\|\.coinData\[.*\]\.coinId" tests/ --include="*.bats" --include="*.bash" 2>/dev/null | wc -l)

if [[ $remaining -eq 0 ]]; then
  echo "✓ All patterns fixed (0 remaining)"
else
  echo "✗ Warning: $remaining patterns still found"
  grep -rn "\.coinData\[.*\]\.amount\|\.coinData\[.*\]\.coinId" tests/ --include="*.bats" --include="*.bash"
fi
```

---

## Post-Fix Testing

1. **Quick verification:**
   ```bash
   SECRET="test" npm run mint-token -- --local --coins "1000,2000" --save
   ```

2. **Run affected test suites:**
   ```bash
   npm run test:functional
   npm run test:edge-cases
   ```

3. **Full test suite:**
   ```bash
   npm test
   ```

---

## Checklist Summary

- [ ] File 1: test_mint_token.bats (14 changes)
- [ ] File 2: test_data_boundaries.bats (3 changes)
- [ ] File 3: token-helpers.bash (1 change + add helpers)
- [ ] File 4: test_send_token.bats (1 change)
- [ ] File 5: test_integration.bats (2 changes)
- [ ] Verify no old patterns remain
- [ ] Run test suite
- [ ] Update documentation if needed

**Total: 21 changes across 6 files**
