# CRITICAL TEST FIXES - QUICK REFERENCE

## What Changed?

### 1. Token Status Checking (Most Important)
**Before**: Checked local file structure only
**Now**: Queries real aggregator via HTTP to `/api/v1/requests/{requestId}`

### 2. Aggregator Availability
**Before**: Tests skipped if aggregator unavailable
**Now**: Tests FAIL if aggregator unavailable (9 tests updated)

### 3. File Validation
**New functions available**:
- `assert_valid_json $file` - Validates JSON structure
- `assert_token_structure_valid $file` - Validates token format
- `assert_offline_transfer_structure_valid $file` - Validates transfer format

### 4. Double-Spend Prevention
**Before**: Logged info messages about success counts
**Now**: Tests FAIL if exactly 1 success is not achieved (2 tests fixed)

---

## Files Modified (5 total)

1. **tests/helpers/token-helpers.bash**
   - Rewrote `get_token_status()` - now queries aggregator

2. **tests/helpers/assertions.bash**
   - Added `assert_valid_json()`
   - Added `assert_token_structure_valid()`
   - Added `assert_offline_transfer_structure_valid()`

3. **tests/edge-cases/test_double_spend_advanced.bats**
   - 9 lines: `skip_if_aggregator_unavailable` → `fail_if_aggregator_unavailable`
   - DBLSPEND-005: Enforce exactly 1 success in 5 concurrent operations
   - DBLSPEND-007: Enforce exactly 1 success in 5 submissions

---

## Testing the Changes

### Quick Test
```bash
# Start aggregator
docker run -p 3000:3000 unicity/aggregator &
sleep 2

# Run double-spend tests (should enforce 1 success)
bats tests/edge-cases/test_double_spend_advanced.bats
```

### Using New Assertions
```bash
# In your test file
assert_valid_json "/path/to/token.txf"
assert_token_structure_valid "/path/to/token.txf"
assert_offline_transfer_structure_valid "/path/to/transfer.txf"
```

---

## What's NOT Changed?

- ✅ `--local` flags (they're correct - mean local aggregator)
- ✅ Test command patterns (`run`, `assert_success`, etc.)
- ✅ Token operation APIs (mint, send, receive)
- ✅ Test file structure and naming

---

## Key Improvements

| Before | After |
|--------|-------|
| Tests silently skip if aggregator down | Tests FAIL loudly if aggregator down |
| Token status from local files | Token status from real blockchain |
| Silent failures on errors | All errors fail tests |
| Success counts logged as info | Success counts enforced (1 success required) |
| No file structure validation | Files validated for JSON + structure |

---

## Success Indicators

Tests now properly:
1. Fail when aggregator is unavailable
2. Query real blockchain state
3. Validate file integrity
4. Enforce double-spend prevention (1 success, 4 failures)
5. Report all errors clearly

---

**All 6 critical fixes implemented and verified**
