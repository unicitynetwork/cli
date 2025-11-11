# Dual Capture Migration Guide

## Quick Summary

**Good news**: Most tests require **NO changes**! The dual capture is backward compatible.

## What Changed

### Before

```bash
run_cli() {
  # Captured stdout only
  output=$(node cli.js "$@") || exit_code=$?
  return "$exit_code"
}
```

**Issue**: Error messages on stderr were lost, causing 8+ tests to fail.

### After

```bash
run_cli() {
  # Captures stdout AND stderr separately
  output=$(cat temp_stdout)
  stderr_output=$(cat temp_stderr)
  status=$exit_code
  return 0  # Always return 0, tests check $status
}
```

**Benefits**: Both streams available, all tests work correctly.

## Variables Available

After `run_cli()`:

- `$output` - stdout only (JSON, clean output)
- `$stderr_output` - stderr only (errors, warnings)
- `$status` - exit code (0 = success, non-zero = failure)

## Assertion Changes

### Backward Compatible Assertions

These functions now check **both** stdout and stderr automatically:

```bash
# OLD WAY (still works)
assert_output_contains "error message"

# NEW BEHAVIOR
# 1. Checks $output first
# 2. If not found, checks $stderr_output
# 3. Succeeds if found in either stream
```

**Affected functions**:
- `assert_output_contains()` - checks stdout, then stderr
- `assert_output_not_contains()` - checks both streams
- `assert_output_matches()` - checks stdout, then stderr

### New Explicit Stderr Assertions

For tests that specifically need stderr:

```bash
# Explicitly check stderr only
assert_stderr_contains "warning message"
assert_stderr_not_contains "error"
assert_stderr_empty

# Check either stream
assert_output_or_stderr_contains "message"
```

## Test Patterns That Need NO Changes

### Pattern 1: JSON Output Tests

```bash
@test "Generate address" {
  run_cli_with_secret "test" gen-address
  assert_success
  assert_valid_json "$output"  # Still works!
}
```

**No changes needed** - $output still contains stdout only.

### Pattern 2: Error Message Tests

```bash
@test "Invalid file shows error" {
  run_cli verify-token -f /bad/file.txf
  assert_failure
  assert_output_contains "file"  # Now finds errors in stderr!
}
```

**No changes needed** - `assert_output_contains()` now checks stderr as fallback.

### Pattern 3: Success/Failure Checks

```bash
@test "Command succeeds" {
  run_cli some-command
  assert_success  # Still works!
}

@test "Command fails" {
  run_cli bad-command
  assert_failure  # Still works!
}
```

**No changes needed** - `$status` variable is set correctly.

## Tests That Benefit from Explicit Stderr

### Before (broken)

```bash
@test "Shows warning on stderr" {
  run_cli some-command
  assert_output_contains "warning"  # Failed - stderr was lost
}
```

### After (works automatically)

```bash
@test "Shows warning on stderr" {
  run_cli some-command
  assert_output_contains "warning"  # Works - checks stderr too!
}
```

### After (explicit, recommended)

```bash
@test "Shows warning on stderr" {
  run_cli some-command
  assert_stderr_contains "warning"  # Explicit - best practice
  assert_valid_json "$output"       # Verify stdout is clean
}
```

## When to Update Tests

### Keep As-Is (no changes needed)

- ✅ Tests checking JSON output: `assert_valid_json "$output"`
- ✅ Tests checking error messages: `assert_output_contains "error"`
- ✅ Tests using assert_success / assert_failure
- ✅ Tests extracting JSON fields: `jq -r '.field' <<< "$output"`

### Consider Updating (optional improvement)

- 🔄 Tests that expect errors: Change to `assert_stderr_contains()`
- 🔄 Tests checking warnings: Change to `assert_stderr_contains()`
- 🔄 Tests verifying clean output: Add `assert_stderr_empty`

### Must Update (rare)

- ❌ Tests that directly use `run_cli`'s exit code: Change to check `$status`
- ❌ Tests that capture run_cli output: Use `$output` variable instead

## Migration Examples

### Example 1: No Changes Needed

```bash
# BEFORE
@test "Mint token creates TXF file" {
  run_cli_with_secret "test" mint-token --preset nft --local
  assert_success
  local token_id
  token_id=$(echo "$output" | jq -r '.genesis.data.tokenId')
  is_valid_hex "$token_id" 64
}

# AFTER - IDENTICAL, no changes
@test "Mint token creates TXF file" {
  run_cli_with_secret "test" mint-token --preset nft --local
  assert_success
  local token_id
  token_id=$(echo "$output" | jq -r '.genesis.data.tokenId')
  is_valid_hex "$token_id" 64
}
```

### Example 2: Automatically Fixed

```bash
# BEFORE - FAILED (couldn't see stderr)
@test "Invalid JSON shows error" {
  echo '{"bad json' > /tmp/bad.json
  run_cli verify-token -f /tmp/bad.json
  assert_failure
  assert_output_contains "JSON"  # FAILED - error was in stderr
}

# AFTER - WORKS AUTOMATICALLY
@test "Invalid JSON shows error" {
  echo '{"bad json' > /tmp/bad.json
  run_cli verify-token -f /tmp/bad.json
  assert_failure
  assert_output_contains "JSON"  # WORKS - now checks stderr too!
}
```

### Example 3: Optional Improvement

```bash
# BEFORE - Works but not precise
@test "Deprecated flag shows warning" {
  run_cli some-command --deprecated-flag
  assert_output_contains "deprecated"
}

# AFTER - Better practice
@test "Deprecated flag shows warning" {
  run_cli some-command --deprecated-flag
  assert_success
  assert_stderr_contains "deprecated"  # Explicit stderr check
  assert_valid_json "$output"          # Verify stdout is clean
}
```

## Identifying Tests That Need Review

Use this grep command to find tests that might benefit from explicit stderr:

```bash
# Find tests checking error messages
grep -r "assert_output_contains.*error" tests/

# Find tests checking warnings
grep -r "assert_output_contains.*warn" tests/

# Find tests checking for failure messages
grep -r "assert_output_contains.*fail" tests/
```

## Testing Your Changes

### Quick Test

```bash
# Test JSON output (gen-address)
bats tests/functional/test_gen_address.bats

# Test error messages (input validation)
bats tests/security/test_input_validation.bats
```

### Full Test Suite

```bash
# Run all tests
npm test

# Run with debug output
UNICITY_TEST_DEBUG=1 bats tests/functional/test_gen_address.bats
```

## Troubleshooting

### Issue: Test fails with "unbound variable: status"

**Cause**: Test directly checks `$status` before calling `run_cli()`

**Fix**: Ensure `run_cli()` is called first:

```bash
# WRONG
if [[ $status -eq 0 ]]; then  # $status not set yet

# RIGHT
run_cli some-command
if [[ $status -eq 0 ]]; then  # $status set by run_cli
```

### Issue: Error message not found in output

**Cause**: Error is in stderr, old code only captured stdout

**Solution**: Already fixed! `assert_output_contains()` now checks stderr

### Issue: JSON parsing fails with unexpected data

**Cause**: Stderr messages mixed with JSON

**Solution**: Already fixed! `$output` contains stdout only, `$stderr_output` has errors

### Issue: Temp files left behind

**Cause**: Test crashed before cleanup

**Solution**: Already handled! RETURN trap guarantees cleanup

## Summary

### What Works Automatically

✅ All gen-address tests (16/16 passing)
✅ Most error validation tests (working)
✅ All success/failure assertions
✅ All JSON parsing operations
✅ All existing $output usage

### What's Improved

✅ Error messages now visible in tests
✅ Warnings can be validated
✅ Both stdout and stderr available
✅ Backward compatible with existing tests
✅ No migration needed for most tests

### Best Practices Going Forward

1. Use `assert_output_contains()` for general checks (works with both streams)
2. Use `assert_stderr_contains()` when specifically checking errors/warnings
3. Use `assert_valid_json "$output"` to verify clean stdout
4. Use `assert_success` / `assert_failure` for exit code checks
5. Check `$status` variable, not `run_cli`'s return code

## Need Help?

See full documentation in:
- `/home/vrogojin/cli/tests/helpers/DUAL_CAPTURE_IMPLEMENTATION.md`
- Examples in `/home/vrogojin/cli/tests/helpers/test_dual_capture.bats`
