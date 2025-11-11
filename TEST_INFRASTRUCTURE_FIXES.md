# Test Infrastructure Fixes - Implementation Guide

## Quick Reference

**Issue 1:** GENERATED_ADDRESS unbound variable (80+ tests)
**Fix:** Add one line to token-helpers.bash

**Issue 2:** $status unbound variable (27+ tests)
**Fix:** Wrap run_cli calls with `run` or capture exit code manually

---

## Fix #1: Export GENERATED_ADDRESS (CRITICAL - 80+ tests)

### File: tests/helpers/token-helpers.bash

**Location:** Line 82 (after `printf "%s" "$address"`)

**Current Code (lines 80-86):**
```bash
  # Print address to stdout
  printf "%s" "$address"

  debug "Generated address: $address"
  return 0
}
```

**Fixed Code:**
```bash
  # Print address to stdout
  printf "%s" "$address"

  # Export for BATS test compatibility
  export GENERATED_ADDRESS="$address"

  debug "Generated address: $address"
  return 0
}
```

**Exact change:**
```diff
   # Print address to stdout
   printf "%s" "$address"

+  # Export for BATS test compatibility
+  export GENERATED_ADDRESS="$address"
+
   debug "Generated address: $address"
   return 0
 }
```

### Why This Works

1. BATS `run` captures stdout in `$output` but doesn't capture function variables
2. Using `export` makes the variable available in the test scope
3. Pattern matches `mint_token()` which successfully uses `export MINT_OUTPUT_FILE`
4. Maintains backward compatibility - stdout still returns the address

### Testing the Fix

```bash
# Before fix - this fails:
run generate_address "test-secret" "nft"
echo "$GENERATED_ADDRESS"  # ❌ unbound variable

# After fix - both work:
run generate_address "test-secret" "nft"
echo "$GENERATED_ADDRESS"  # ✓ Works (exported)
echo "$output"             # ✓ Works (stdout)

# Command substitution still works:
addr=$(generate_address "test-secret" "nft")  # ✓ Works
```

---

## Fix #2: Fix $status Checks (27 occurrences in 8 files)

### Pattern A: Using BATS run (Recommended)

**Problem Pattern:**
```bash
run_cli mint-token --preset nft || true
if [[ $status -ne 0 ]]; then  # ❌ $status not set
```

**Fix Pattern:**
```bash
run run_cli mint-token --preset nft
if [[ $status -ne 0 ]]; then  # ✓ $status set by BATS run
```

**Why:** BATS `run` captures exit code in `$status`

---

### Pattern B: Manual Exit Code Capture (Alternative)

**Fix Pattern:**
```bash
local exit_code=0
run_cli mint-token --preset nft || exit_code=$?
if [[ $exit_code -ne 0 ]]; then  # ✓ Works
```

**Why:** Captures the actual exit code from run_cli

---

## Detailed File Changes for Fix #2

### File 1: tests/edge-cases/test_network_edge.bats

#### Change 1: Line 48-54
**Before:**
```bash
  SECRET="$TEST_SECRET" run_cli mint-token \
    --preset nft \
    --endpoint "http://localhost:9999" \
    -o "$token_file" || true

  # Should fail with connection error
  if [[ $status -ne 0 ]]; then
```

**After (Pattern A - BATS run):**
```bash
  run bash -c "SECRET=\"$TEST_SECRET\" run_cli mint-token \
    --preset nft \
    --endpoint \"http://localhost:9999\" \
    -o \"$token_file\""

  # Should fail with connection error
  if [[ $status -ne 0 ]]; then
```

**After (Pattern B - Manual capture):**
```bash
  local exit_code=0
  SECRET="$TEST_SECRET" run_cli mint-token \
    --preset nft \
    --endpoint "http://localhost:9999" \
    -o "$token_file" || exit_code=$?

  # Should fail with connection error
  if [[ $exit_code -ne 0 ]]; then
```

---

#### Change 2: Line 100-105
**Before:**
```bash
  SECRET="$TEST_SECRET" run_cli mint-token \
    --preset nft \
    --endpoint "http://localhost:3001" \
    -o "$token_file" || true

  if [[ $status -ne 0 ]]; then
```

**After (Pattern B):**
```bash
  local exit_code=0
  SECRET="$TEST_SECRET" run_cli mint-token \
    --preset nft \
    --endpoint "http://localhost:3001" \
    -o "$token_file" || exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
```

---

#### Change 3: Line 122-127
**Before:**
```bash
  SECRET="$TEST_SECRET" run_cli mint-token \
    --preset nft \
    --endpoint "http://nonexistent-aggregator-domain-12345.local" \
    -o "$token_file" || true

  if [[ $status -ne 0 ]]; then
```

**After (Pattern B):**
```bash
  local exit_code=0
  SECRET="$TEST_SECRET" run_cli mint-token \
    --preset nft \
    --endpoint "http://nonexistent-aggregator-domain-12345.local" \
    -o "$token_file" || exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
```

---

### File 2: tests/edge-cases/test_file_system.bats

#### Change 1: Line 50-55
**Before:**
```bash
  SECRET="test-readonly" run_cli mint-token \
    --preset nft \
    -o "$readonly_file" || true

  if [[ $status -ne 0 ]]; then
```

**After:**
```bash
  local exit_code=0
  SECRET="test-readonly" run_cli mint-token \
    --preset nft \
    -o "$readonly_file" || exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
```

---

#### Change 2: Line 121-126
**Before:**
```bash
    SECRET="test-toolong" run_cli mint-token \
      --preset nft \
      -o "$long_path_file" || true

    if [[ $status -ne 0 ]]; then
```

**After:**
```bash
    local exit_code=0
    SECRET="test-toolong" run_cli mint-token \
      --preset nft \
      -o "$long_path_file" || exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
```

---

#### Change 3: Line 249-254
**Before:**
```bash
  SECRET="test-nospace" run_cli mint-token \
    --preset nft \
    -o "$token_file" || true

  if [[ $status -eq 0 ]]; then
```

**After:**
```bash
  local exit_code=0
  SECRET="test-nospace" run_cli mint-token \
    --preset nft \
    -o "$token_file" || exit_code=$?

  if [[ $exit_code -eq 0 ]]; then
```

---

### File 3: tests/security/test_access_control.bats

#### Change 1: Line 208-213
**Before:**
```bash
    SECRET="$(generate_unique_id user)" run_cli send-token \
      -f "$SOURCE_TOKEN" \
      -r "$recipient" \
      -o "$transfer_file" || true

    if [[ $status -eq 0 ]]; then
```

**After:**
```bash
    local exit_code=0
    SECRET="$(generate_unique_id user)" run_cli send-token \
      -f "$SOURCE_TOKEN" \
      -r "$recipient" \
      -o "$transfer_file" || exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
```

---

#### Change 2: Line 228-233
**Before:**
```bash
    SECRET="wrong-secret-$i" run_cli receive-token \
      -f "$transfer_file" \
      -o "$received_file" || true

    if [[ $status -eq 0 ]]; then
```

**After:**
```bash
    local exit_code=0
    SECRET="wrong-secret-$i" run_cli receive-token \
      -f "$transfer_file" \
      -o "$received_file" || exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
```

---

### File 4: tests/security/test_input_validation.bats

**This file has 11 occurrences. Pattern is consistent:**

#### Line 122-127, 134-139, 184-189, 193-198, etc.

**Before:**
```bash
    run_cli gen-address --preset "$preset" || true
    if [[ $status -eq 0 ]]; then
```

**After:**
```bash
    local exit_code=0
    run_cli gen-address --preset "$preset" || exit_code=$?
    if [[ $exit_code -eq 0 ]]; then
```

**All 11 locations in this file follow the same pattern.**

---

### File 5: tests/security/test_double_spend.bats

#### Change 1: Line 229-234
**Before:**
```bash
      SECRET="$CAROL_SECRET" run_cli receive-token \
        -f "$transfer_carol" \
        --endpoint "${UNICITY_AGGREGATOR_URL}" \
        -o "${received_carol}" || true

    if [[ $status -eq 0 ]] && [[ -f "${transfer_carol}" ]]; then
```

**After:**
```bash
      local exit_code=0
      SECRET="$CAROL_SECRET" run_cli receive-token \
        -f "$transfer_carol" \
        --endpoint "${UNICITY_AGGREGATOR_URL}" \
        -o "${received_carol}" || exit_code=$?

    if [[ $exit_code -eq 0 ]] && [[ -f "${transfer_carol}" ]]; then
```

---

#### Change 2: Line 282-287
**Before:**
```bash
      SECRET="$CAROL_SECRET" run_cli receive-token \
        -f "$transfer_carol" \
        -o "$received_carol" || true

    if [[ $status -eq 0 ]]; then
```

**After:**
```bash
      local exit_code=0
      SECRET="$CAROL_SECRET" run_cli receive-token \
        -f "$transfer_carol" \
        -o "$received_carol" || exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
```

---

#### Change 3: Line 367-372
**Before:**
```bash
    SECRET="$CAROL_SECRET" run_cli receive-token \
      -f "$transfer_to_carol" \
      -o "$received_carol" || true

    if [[ $status -eq 0 ]]; then
```

**After:**
```bash
    local exit_code=0
    SECRET="$CAROL_SECRET" run_cli receive-token \
      -f "$transfer_to_carol" \
      -o "$received_carol" || exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
```

---

### File 6: tests/security/test_authentication.bats

#### Change 1: Line 272-277
**Before:**
```bash
    SECRET="wrong-secret-$i" run_cli receive-token \
      -f "$transfer_file" \
      -o "$received_file" || true

    if [[ $status -eq 0 ]]; then
```

**After:**
```bash
    local exit_code=0
    SECRET="wrong-secret-$i" run_cli receive-token \
      -f "$transfer_file" \
      -o "$received_file" || exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
```

---

### File 7: tests/security/test_data_integrity.bats

#### Change 1: Line 195-200
**Before:**
```bash
        SECRET="$RECEIVER_SECRET" run_cli receive-token \
          -f "$corrupted_file" \
          -o "$received" || true

        if [[ $status -eq 0 ]]; then
```

**After:**
```bash
        local exit_code=0
        SECRET="$RECEIVER_SECRET" run_cli receive-token \
          -f "$corrupted_file" \
          -o "$received" || exit_code=$?

        if [[ $exit_code -eq 0 ]]; then
```

---

#### Change 2: Line 299-304
**Before:**
```bash
        SECRET="$RECEIVER_SECRET" run_cli receive-token \
          -f "$corrupted_file" \
          -o "$received" || true

        if [[ $status -eq 0 ]]; then
```

**After:**
```bash
        local exit_code=0
        SECRET="$RECEIVER_SECRET" run_cli receive-token \
          -f "$corrupted_file" \
          -o "$received" || exit_code=$?

        if [[ $exit_code -eq 0 ]]; then
```

---

#### Change 3: Line 314-319
**Before:**
```bash
        SECRET="$RECEIVER_SECRET" run_cli receive-token \
          -f "$corrupted_file" \
          -o "$received" || true

        if [[ $status -eq 0 ]]; then
```

**After:**
```bash
        local exit_code=0
        SECRET="$RECEIVER_SECRET" run_cli receive-token \
          -f "$corrupted_file" \
          -o "$received" || exit_code=$?

        if [[ $exit_code -eq 0 ]]; then
```

---

#### Change 4: Line 328-333
**Before:**
```bash
    SECRET="$RECEIVER_SECRET" run_cli receive-token \
      -f "$transfer_file" \
      -o "$received" || true

    if [[ $status -eq 0 ]]; then
```

**After:**
```bash
    local exit_code=0
    SECRET="$RECEIVER_SECRET" run_cli receive-token \
      -f "$transfer_file" \
      -o "$received" || exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
```

---

### File 8: tests/helpers/test_validation_functions.bats

#### Changes at Lines 224, 242, 264

**Before (all 3 locations):**
```bash
  if [[ $status -ne 0 ]]; then
```

**After:**
```bash
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
```

**Note:** These are slightly different - they're checking functions that just ran, so capture `$?` immediately.

---

## Automated Fix Script

```bash
#!/bin/bash
# fix-test-infrastructure.sh

set -euo pipefail

echo "=== Applying Test Infrastructure Fixes ==="

# Fix #1: Export GENERATED_ADDRESS in token-helpers.bash
echo "Fix #1: Adding GENERATED_ADDRESS export..."

FILE="tests/helpers/token-helpers.bash"
LINE_NUM=82

# Insert the export after line 82
sed -i '82 a\
\
  # Export for BATS test compatibility\
  export GENERATED_ADDRESS="$address"' "$FILE"

echo "✓ Fixed GENERATED_ADDRESS export in token-helpers.bash"

# Fix #2: Replace $status with exit_code pattern
echo "Fix #2: Fixing \$status checks..."

FILES=(
  "tests/edge-cases/test_network_edge.bats"
  "tests/edge-cases/test_file_system.bats"
  "tests/security/test_access_control.bats"
  "tests/security/test_input_validation.bats"
  "tests/security/test_double_spend.bats"
  "tests/security/test_authentication.bats"
  "tests/security/test_data_integrity.bats"
)

for file in "${FILES[@]}"; do
  if [[ -f "$file" ]]; then
    # Pattern: || true followed by if [[ $status
    # Replace with: || exit_code=$? and if [[ $exit_code

    # This is a complex multi-line replacement, recommend manual editing
    echo "  - $file (requires manual edit - see guide above)"
  fi
done

echo ""
echo "=== Fix Summary ==="
echo "✓ GENERATED_ADDRESS export added to token-helpers.bash"
echo "⚠ Manual edits needed for \$status checks (see detailed guide)"
echo ""
echo "Next steps:"
echo "1. Manually apply \$status fixes using the detailed guide above"
echo "2. Run: bats tests/edge-cases/test_double_spend_advanced.bats"
echo "3. Run: npm test"
```

---

## Verification Checklist

### After Fix #1 (GENERATED_ADDRESS)

```bash
# Test 1: Run double-spend tests
bats tests/edge-cases/test_double_spend_advanced.bats

# Expected: No "GENERATED_ADDRESS: unbound variable" errors
# Tests may still fail for other reasons, but address generation should work

# Test 2: Check other affected files
bats tests/edge-cases/test_concurrency.bats
bats tests/edge-cases/test_state_machine.bats

# Expected: GENERATED_ADDRESS errors gone
```

### After Fix #2 ($status)

```bash
# Test 1: Run network edge tests
bats tests/edge-cases/test_network_edge.bats

# Expected: No "status: unbound variable" errors

# Test 2: Run input validation tests
bats tests/security/test_input_validation.bats

# Expected: No $status errors
```

### Full Suite Verification

```bash
# Run all tests
npm test

# Expected results:
# - Functional: 95%+ passing (currently 97%, should stay high)
# - Security: 80%+ passing (currently ~50%, should improve)
# - Edge-cases: 80%+ passing (currently ~30%, should improve)
# - Overall: 90%+ passing (currently 49%, should improve significantly)
```

---

## Impact Analysis

### Before Fixes
- **Total tests:** 205
- **Passing:** 101 (49%)
- **Failing:** 90 (44%)
- **Skipped:** 14 (7%)

### After Fixes (Estimated)
- **Total tests:** 205
- **Passing:** ~190 (93%)
- **Failing:** ~10 (5%)
- **Skipped:** ~5 (2%)

### Tests Fixed by Each Solution

**Fix #1 (GENERATED_ADDRESS):** ~80 tests
- test_double_spend_advanced.bats: 9 tests
- test_concurrency.bats: 2 tests
- test_state_machine.bats: 6 tests
- test_network_edge.bats: 1 test
- test_file_system.bats: 1 test
- Various security tests: ~60 tests

**Fix #2 ($status):** ~10 tests
- test_network_edge.bats: 3 tests
- test_file_system.bats: 3 tests
- test_input_validation.bats: ~11 tests (some may be same tests)
- Other security tests: ~7 tests

**Remaining failures:** ~10 tests
- Legitimate failures (expected behavior)
- Tests requiring external infrastructure
- Tests with other issues

---

## Priority and Sequencing

### Phase 1: Critical Fix (5 minutes)
1. Apply Fix #1 (GENERATED_ADDRESS export)
2. Test with one file: `bats tests/edge-cases/test_double_spend_advanced.bats`
3. Verify ~80 tests start passing

### Phase 2: High Priority (30 minutes)
1. Apply Fix #2 to all 8 files
2. Use Pattern B (exit_code capture) for consistency
3. Test each file after editing

### Phase 3: Verification (15 minutes)
1. Run full test suite: `npm test`
2. Document remaining failures
3. Update test documentation

**Total time: ~50 minutes**

---

## Alternative: Quick Batch Fix for $status

If manual editing is too time-consuming, use this helper:

```bash
# Quick fix for simple cases
for file in tests/edge-cases/*.bats tests/security/*.bats; do
  # Add 'local exit_code=0' before || true patterns
  sed -i '/|| true$/i\  local exit_code=0' "$file"

  # Replace || true with || exit_code=$?
  sed -i 's/|| true$/|| exit_code=$?/' "$file"

  # Replace $status with $exit_code in if statements
  sed -i 's/if \[\[ \$status/if [[ $exit_code/' "$file"
done
```

**Warning:** This is a rough pattern and may need manual cleanup. Use with caution.

---

*Implementation Guide - 2025-11-11*
