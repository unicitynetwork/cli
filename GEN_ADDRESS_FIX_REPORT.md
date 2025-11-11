# gen-address --local Flag Fix Report

## Executive Summary
Fixed critical test infrastructure issue where 41 calls to `gen-address` command with unsupported `--local` flag were causing 13+ security tests to fail immediately with exit code 1.

## Problem Details

### Root Cause
The `gen-address` command does **not** support the `--local` flag because it performs purely local cryptographic operations (key derivation and address generation) and never communicates with the aggregator service.

However, 41 test invocations across 6 security test files were calling:
```bash
run_cli_with_secret "${SECRET}" "gen-address --preset nft --local"
```

This resulted in:
```
error: unknown option '--local'
Exit code: 1
```

### Why the Flag Was Used Incorrectly
The `--local` flag is only relevant for commands that interact with the aggregator:
- ✓ `mint-token` - submits commitments to aggregator
- ✓ `send-token` - may submit transfers to aggregator
- ✓ `receive-token` - fetches proofs from aggregator
- ✓ `verify-token` - queries aggregator for token status
- ✗ `gen-address` - **purely local computation, no network calls**

Test authors likely added `--local` uniformly to all commands without checking which commands actually support it.

## Solution Implemented

### Fix Applied
Removed `--local` flag from all `gen-address` invocations in 6 test files:

1. **tests/security/test_access_control.bats** - 10 fixes
2. **tests/security/test_authentication.bats** - 8 fixes
3. **tests/security/test_data_integrity.bats** - 5 fixes
4. **tests/security/test_double_spend.bats** - 11 fixes
5. **tests/security/test_input_validation.bats** - 1 fix
6. **tests/security/test_cryptographic.bats** - 6 fixes

**Total: 41 command invocations fixed**

### Change Pattern

**Before (incorrect):**
```bash
run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft --local"
```

**After (correct):**
```bash
run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
```

The `run_cli_with_secret` helper automatically appends `--unsafe-secret` flag, resulting in:
```bash
SECRET="${BOB_SECRET}" node dist/index.js gen-address --preset nft --unsafe-secret
```

## Verification

### Manual Testing
```bash
$ SECRET="test" node dist/index.js gen-address --preset nft --unsafe-secret
{
  "type": "unmasked",
  "address": "DIRECT://0000d1b18542237c898e2a9d28fe06c645b3c2787c7e695a2196875cc963ecd5b7e66c0f2987",
  "tokenType": "f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509",
  "tokenTypeInfo": {
    "preset": "nft",
    "name": "unicity",
    "description": "Unicity testnet NFT token type"
  }
}
✅ Success (exit code 0)
```

### Confirmed No Remaining Issues
```bash
$ grep -n "gen-address.*--local" tests/security/*.bats
# No results - all fixed
```

## Impact Assessment

### Tests Unblocked
This fix unblocks **at least 13 security tests** that were failing due to `gen-address` command errors:

#### test_access_control.bats (2 tests)
- SEC-ACCESS-001: Cannot transfer token not owned by user
- SEC-ACCESS-EXTRA: Complete multi-user transfer chain maintains security

#### test_authentication.bats (6 tests)
- All 6 authentication tests were blocked

#### test_data_integrity.bats (3 tests)
- SEC-INTEGRITY-003: Token data modification detection
- SEC-INTEGRITY-005: Inclusion proof tampering detection
- SEC-INTEGRITY-EXTRA: End-to-end integrity validation

#### Additional Tests Fixed
Multiple tests in:
- test_double_spend.bats
- test_input_validation.bats
- test_cryptographic.bats

### Important Note
Some tests may still fail for **different reasons** unrelated to the `gen-address` issue. For example:
- SEC-ACCESS-001 now gets past gen-address but fails later because `send-token` doesn't properly validate ownership (separate security issue)

This fix specifically resolves the **immediate blocker** where tests couldn't even generate addresses.

## Commands to Verify Fix

### Verify no --local flags remain:
```bash
grep -n "gen-address.*--local" tests/security/*.bats
# Should return no results
```

### Test gen-address command directly:
```bash
SECRET="test" node dist/index.js gen-address --preset nft --unsafe-secret
# Should succeed with JSON output
```

### Run one of the fixed test suites:
```bash
bats tests/security/test_authentication.bats
# Tests should now get past gen-address step
```

## Files Modified
All changes are in the test suite - no production code changes required:

- `/home/vrogojin/cli/tests/security/test_access_control.bats`
- `/home/vrogojin/cli/tests/security/test_authentication.bats`
- `/home/vrogojin/cli/tests/security/test_data_integrity.bats`
- `/home/vrogojin/cli/tests/security/test_double_spend.bats`
- `/home/vrogojin/cli/tests/security/test_input_validation.bats`
- `/home/vrogojin/cli/tests/security/test_cryptographic.bats`

## Recommendations

### Prevent Future Issues
1. **Document command flags**: Update command reference docs to clearly show which commands support `--local` flag
2. **Add CLI validation**: Consider having commands reject unknown flags more loudly in test environments
3. **Test helper improvements**: Consider creating separate helpers like `run_cli_with_secret_local()` vs `run_cli_with_secret()` to make intent clearer

### Next Steps
1. Run full security test suite to identify any remaining failures
2. Investigate the SEC-ACCESS-001 ownership validation issue separately
3. Consider adding integration tests that verify command flag compatibility

## Conclusion
Successfully fixed 41 incorrect command invocations across 6 test files, unblocking 13+ security tests. The `gen-address` command now works correctly in all test scenarios. Some tests may have additional failures unrelated to this fix that should be investigated separately.
