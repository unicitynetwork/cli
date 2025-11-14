# Failed Tests - Quick Fix Guide
**31 Total Failed Tests - Quick Reference**

## One-Line Summary
Out of 242 tests: 10 skipped (intentional), 21 actual failures (mostly test bugs, not CLI bugs).

---

## CRITICAL FIXES (5 minutes each)

### 1. AGGREGATOR-001 & AGGREGATOR-010 (2 tests)
**File:** `tests/functional/test_aggregator_operations.bats`

Fix wrong argument to `assert_valid_json`:
- Line 51: Change `assert_valid_json "$output"` → `assert_valid_json "get_response.json"`
- Line 262: Change `assert_valid_json "$output"` → `assert_valid_json "get.json"`

### 2. RACE-006 (1 test)
**File:** `tests/edge-cases/test_concurrency.bats:348`

Fix BATS status variable capture:
- Line 331: Change `local status1=$?` → `local status1=$status`
- Line 341: Change `local status2=$?` → `local status2=$status`

### 3. INTEGRATION-007 & INTEGRATION-009 (2 tests)
**File:** `src/commands/receive-token.ts`

**Issue:** Output file not created when receive completes
- Investigate why `-o` flag doesn't create output file when `--submit-now` is triggered
- Likely: Output file creation is missing in the submit-now code path

---

## HIGH PRIORITY FIXES (2 minutes each)

All are CLI flag syntax errors in tests. Pattern: Remove space before flag value.

### Data Boundaries Tests (5 tests)
**File:** `tests/edge-cases/test_data_boundaries.bats`

| Line | Change | To |
|------|--------|-----|
| 231 | `--coins  --local"0"` | `--coins 0 --local` |
| 307 | `--coins  --local"$huge_amount"` | `--coins "$huge_amount" --local` |
| 345 | `--token-type  --local"$odd_hex"` | `--token-type "$odd_hex" --local` |
| 425 | `--token-type  --local"$invalid_hex"` | `--token-type "$invalid_hex" --local` |
| 462 | `-d  --local""` | `-d "" --local` |

### Network Edge Tests (6 tests)
**File:** `tests/edge-cases/test_network_edge.bats`

| Line | Issue | Fix |
|------|-------|-----|
| 42-58 (CORNER-026) | Missing SECRET | Add: `secret=$(generate_unique_id "secret")` and use `run_cli_with_secret` |
| 108 (CORNER-028) | `--file  --local"$token_file"` | `--file "$token_file" --local` |
| 119-132 (CORNER-030) | Missing SECRET | Add: `secret=$(generate_unique_id "secret")` and use `run_cli_with_secret` |
| 166-185 (CORNER-032) | Verify --skip-network behavior | May need investigation of flag handling |
| 191-204 (CORNER-033) | Missing SECRET | Add: `secret=$(generate_unique_id "secret")` and use `run_cli_with_secret` |
| 251-280 (CORNER-232) | Missing SECRET/stack traces | Ensure TEST_SECRET set + verify error handling |
| 299 (CORNER-233) | `--file  --local"$token_file"` | Remove `--local` or fix flag spacing |

### Filesystem Test (1 test)
**File:** `tests/edge-cases/test_file_system.bats`

| Line | Issue | Notes |
|------|-------|-------|
| ~290 | Symlink handling | Needs investigation - unclear exact fix |

---

## MEDIUM PRIORITY FIXES (15 minutes each)

### CORNER-010 & CORNER-010b (2 tests)
**File:** `tests/edge-cases/test_data_boundaries.bats`

**Issue:** Argument list too long (ARG_MAX system limit)
- CORNER-010 (line 145): 10MB secret via command line
- CORNER-010b (line 169): 1MB data via command line

**Solution:** Write data to temp file instead of passing as argument:
```bash
# Before: timeout 10s bash -c "SECRET='$long_secret' run_cli gen-address..."
# After:
local secret_file=$(create_temp_file "-secret.txt")
echo -n "$long_secret" > "$secret_file"
export SECRET="$long_secret"
timeout 10s bash -c "... gen-address --preset nft"
unset SECRET
```

---

## Intentionally Skipped Tests (10 tests - NO FIX NEEDED)

These are marked with `skip` and represent future work:

1. **INTEGRATION-005** - Complex 2-level offline transfer chain
2. **INTEGRATION-006** - Complex 3-level offline transfer chain
3. **VERIFY_TOKEN-007** - Dual-device transfer detection
4. **SEC-ACCESS-004** - TrustBase authenticity validation (not yet implemented)
5. **SEC-DBLSPEND-002** - Concurrent execution infrastructure issue
6. **SEC-INPUT-006** - Input size limits (out of scope)
7. **DBLSPEND-020** - Network partition simulation
8. **CORNER-023** - Disk full simulation (needs root)
9. + 2 more similar infrastructure limitations

---

## Quick Statistics

| Category | Count | Time |
|----------|-------|------|
| CRITICAL fixes | 5 | 25 min |
| HIGH fixes | 14 | 90 min |
| MEDIUM fixes | 2 | 30 min |
| **TOTAL** | **21** | **2h 25min** |

Skipped (intentional): 10 tests

---

## Execution Order (Recommended)

1. **First pass (15 minutes):**
   - AGGREGATOR-001, AGGREGATOR-010 (5 min)
   - RACE-006 (10 min)

2. **Second pass (90 minutes):**
   - Fix all CLI flag syntax errors in test files (8 tests × 2-5 min each)
   - Add SECRET variables to network tests (3 tests × 5 min each)

3. **Third pass (30-60 minutes):**
   - Investigate INTEGRATION-007/009 (receive-token issue)
   - Investigate CORNER-025 (symlink issue)
   - Refactor CORNER-010/010b (ARG_MAX workarounds)

---

## Test Success Criteria

After fixes, run:
```bash
npm test

# Expected result:
# ~232 passing tests
# ~10 skipped (intentional)
# 0 failing
```

Or to run specific test suites:
```bash
npm run test:functional    # Should pass (no failures)
npm run test:security      # Should pass (some intentional skips)
npm run test:edge-cases    # Should pass (some intentional skips)
```

---

## Files to Modify

**Tests (9 files):**
- `tests/functional/test_aggregator_operations.bats` (2 changes)
- `tests/functional/test_integration.bats` (0 changes - needs CLI fix)
- `tests/edge-cases/test_data_boundaries.bats` (7 changes)
- `tests/edge-cases/test_network_edge.bats` (8 changes)
- `tests/edge-cases/test_concurrency.bats` (2 changes)
- `tests/edge-cases/test_file_system.bats` (1 investigation)

**CLI Source (1 file):**
- `src/commands/receive-token.ts` (1 investigation - output file creation)

---

## Notes

- Most failures (14/21) are test code bugs, not CLI bugs
- Failures follow clear patterns (flag syntax, missing variables, wrong function arguments)
- No database or schema changes needed
- No breaking changes to API or CLI interface
- All fixes are either test corrections or minor code investigations
