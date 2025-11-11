# $status Variable Fix Summary

## Problem
Tests were checking the `$status` variable without using BATS's `run` command. The `$status` variable is ONLY set by BATS's built-in `run` command, not by custom helper functions like `run_cli` or `run_cli_with_secret`.

**Error pattern:**
```bash
run_cli_with_secret "" "gen-address --preset nft" || true
if [[ $status -eq 0 ]]; then  # ❌ ERROR: $status not set
```

## Solution
Replace all `$status` checks with proper exit code capture:

```bash
local exit_code=0
run_cli_with_secret "" "gen-address --preset nft" || exit_code=$?
if [[ $exit_code -eq 0 ]]; then  # ✅ Correct
```

## Files Fixed

### Edge Cases Tests
1. **tests/edge-cases/test_data_boundaries.bats** - 4 occurrences fixed
   - Lines 50-54: Empty secret test
   - Lines 78-82: Whitespace-only secret test (2 occurrences)
   - Lines 187-190: Null bytes in secret test

2. **tests/edge-cases/test_file_system.bats** - 3 occurrences fixed
   - Lines 52-56: Read-only directory test
   - Lines 121-128: Long path test
   - Lines 254-257: Symlink test

3. **tests/edge-cases/test_network_edge.bats** - 8 occurrences fixed
   - Lines 48-55: Unavailable aggregator test
   - Lines 103-107: Invalid JSON response test
   - Lines 123-130: DNS failure test
   - Lines 177-180: Offline mode test
   - Lines 197-204: Connection refused test
   - Lines 221-229: HTTP 404 test
   - Lines 234-242: HTTP 500 test
   - Lines 247-255: HTTP 503 test

4. **tests/edge-cases/test_state_machine.bats** - 3 occurrences fixed
   - Lines 109-113: Invalid status test
   - Lines 252-256: Inconsistent state test
   - Lines 288-292: Status mismatch test

### Security Tests
5. **tests/security/test_access_control.bats** - 2 occurrences fixed
   - Lines 210-214: Fake trustbase test
   - Lines 232-235: Secret leak test

6. **tests/security/test_authentication.bats** - 1 occurrence fixed
   - Lines 270-278: Nonce reuse test

7. **tests/security/test_data_integrity.bats** - 4 occurrences fixed
   - Lines 197-201: Tampered chain test
   - Lines 302-306: Status inconsistency test
   - Lines 318-322: Missing offline transfer test
   - Lines 333-337: Invalid status value test

8. **tests/security/test_double_spend.bats** - 3 occurrences fixed
   - Lines 230-235: Double-spend attack test
   - Lines 285-289: Replay attack test
   - Lines 371-375: Outdated state test

9. **tests/security/test_input_validation.bats** - 11 occurrences fixed
   - Lines 123-128: Path traversal test
   - Lines 138-141: Absolute path test
   - Lines 188-192: Command injection in data test
   - Lines 199-202: Shell metacharacters test
   - Lines 225-230: Large coin amount test
   - Lines 251-255: Zero amount test
   - Lines 290-297: Very large data test (also fixed elif)
   - Lines 372-375: Null byte injection test
   - Lines 393-397: Unicode filename test
   - Lines 417-421: Buffer boundary test

## Total Fixes
- **39 occurrences** across **9 test files**
- All edge-cases and security test files reviewed and fixed
- No remaining `$status` unbound variable errors

## Verification
```bash
# Verify no remaining issues
grep -n "if \[\[ \$status" tests/edge-cases/*.bats tests/security/*.bats
# Output: No matches found ✓
```

## Testing
```bash
# Run individual test to verify fix
bats tests/edge-cases/test_data_boundaries.bats --filter "CORNER-007"
# Result: No "$status: unbound variable" errors ✓
```

## Notes
- Some tests may still fail for other reasons (e.g., parsing output, missing features)
- The fix preserves the original test logic - only the exit code capture mechanism changed
- All `|| true` constructs were replaced with `|| exit_code=$?` pattern
- Variable reuse within same test scope is safe and reduces duplication
