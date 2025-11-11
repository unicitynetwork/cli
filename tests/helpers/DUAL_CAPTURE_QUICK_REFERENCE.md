# Dual Capture Quick Reference Card

## Variables After run_cli()

```bash
$output          # stdout only (clean JSON)
$stderr_output   # stderr only (errors, warnings)
$status          # exit code (0 = success, non-zero = failure)
```

## Assertions

### Stdout + Stderr (backward compatible)

```bash
assert_output_contains "text"      # Checks stdout, then stderr
assert_output_not_contains "text"  # Checks both streams
assert_output_matches "pattern"    # Checks stdout, then stderr
assert_output_equals "exact"       # Checks stdout only
```

### Stderr Only (explicit)

```bash
assert_stderr_contains "text"      # Stderr must contain text
assert_stderr_not_contains "text"  # Stderr must not contain text
assert_stderr_matches "pattern"    # Stderr matches regex
assert_stderr_equals "exact"       # Stderr exact match
assert_stderr_empty                # Stderr must be empty
```

### Combined (flexible)

```bash
assert_output_or_stderr_contains "text"  # Either stream
assert_not_output_contains "text"        # Alias for assert_output_not_contains
```

### Exit Code

```bash
assert_success    # $status == 0
assert_failure    # $status != 0
assert_exit_code 1  # $status == 1
```

## Common Patterns

### Pattern 1: JSON Output Test

```bash
@test "Command outputs JSON" {
  run_cli command --args
  assert_success
  assert_valid_json "$output"
}
```

### Pattern 2: Error Message Test

```bash
@test "Invalid input shows error" {
  run_cli command --bad-input
  assert_failure
  assert_output_contains "error"  # Finds in stderr automatically
}
```

### Pattern 3: Both Streams

```bash
@test "Success with warnings" {
  run_cli command --deprecated
  assert_success
  assert_valid_json "$output"
  assert_stderr_contains "deprecated"
}
```

## Quick Examples

### Extract JSON Field

```bash
local address
address=$(echo "$output" | jq -r '.address')
```

### Check Error Type

```bash
assert_stderr_contains "FileNotFound" || \
  assert_stderr_contains "ENOENT"
```

### Verify Clean Output

```bash
assert_valid_json "$output"
assert_stderr_empty
```

## Debug Output

```bash
UNICITY_TEST_DEBUG=1 bats tests/your_test.bats
```

Shows:
```
=== CLI Execution ===
Command: /path/to/cli command
Exit Code: 0
Status: 0
Stdout:
{"result":"data"}
Stderr:
Warning: deprecated
```

## Common Issues

### "unbound variable: status"

**Fix**: Call `run_cli()` before checking `$status`

### Error message not found

**Already fixed**: `assert_output_contains()` now checks stderr

### JSON has extra text

**Already fixed**: `$output` contains stdout only, stderr is separate

## Test Files

```bash
# Verify dual capture
bats tests/helpers/test_dual_capture.bats

# JSON output tests
bats tests/functional/test_gen_address.bats

# Error message tests
bats tests/security/test_input_validation.bats
```

## When to Use What

| Scenario | Use This |
|----------|----------|
| Check JSON output | `assert_valid_json "$output"` |
| Check error message | `assert_output_contains "error"` |
| Explicitly check stderr | `assert_stderr_contains "error"` |
| Verify clean stdout | `assert_stderr_empty` |
| Check success | `assert_success` |
| Check failure | `assert_failure` |
| Extract JSON | `jq -r '.field' <<< "$output"` |

## Migration Status

✅ **No changes needed** for:
- Tests using `$output` for JSON
- Tests checking errors with `assert_output_contains()`
- Tests using `assert_success` / `assert_failure`

🔄 **Consider improving**:
- Use `assert_stderr_contains()` for explicit error checks
- Add `assert_stderr_empty` to verify clean output

## Documentation

- Full implementation: `DUAL_CAPTURE_IMPLEMENTATION.md`
- Migration guide: `DUAL_CAPTURE_MIGRATION_GUIDE.md`
- Summary: `DUAL_CAPTURE_SUMMARY.md`
- This reference: `DUAL_CAPTURE_QUICK_REFERENCE.md`
