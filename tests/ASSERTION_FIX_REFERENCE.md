# OR-Chained Assertion Fix - Quick Reference

## Problem Summary

The security test suite had a **critical systemic bug** where 20+ OR-chained assertions provided NO actual validation.

### The Bug
```bash
# BROKEN - Always passed!
assert_output_contains "error1" || assert_output_contains "error2" || assert_output_contains "error3"
```

**Why:** Bash evaluates `||` left-to-right. Even if ALL assertions fail, the expression continues and the test passes.

## The Fix

```bash
# CORRECT - Actually validates
if ! (echo "${output}${stderr_output}" | grep -qiE "(error1|error2|error3)"); then
    fail "Expected error message containing one of: error1, error2, error3. Got: ${output}"
fi
```

**How it works:**
1. `grep -qiE` = quiet, case-insensitive, extended regex
2. `(error1|error2|error3)` = alternation (match ANY)
3. `! (...)` = inverts result
4. `fail` = actually fails the test if no match found

## Pattern Template

Use this template for any assertion checking multiple possible error messages:

```bash
if ! (echo "${output}${stderr_output}" | grep -qiE "(keyword1|keyword2|keyword3)"); then
    fail "Expected error message containing one of: keyword1, keyword2, keyword3. Got: ${output}"
fi
```

## Key Points

1. **Case-insensitive**: Use `grep -qiE` to handle any case variation
2. **Multiple streams**: Check both `${output}` and `${stderr_output}`
3. **Clear messages**: Show what was expected and what was received
4. **Proper failure**: Use `fail` to ensure test actually fails
5. **Grep alternation**: Use `(word1|word2|word3)` for multiple keywords

## Files Fixed

| File | Fixes | Line Numbers |
|------|-------|--------------|
| test_access_control.bats | 2 | 60, 162 |
| test_authentication.bats | 4 | 64, 104, 159, 295 |
| test_cryptographic.bats | 4 | 67, 125, 181, 328 |
| test_data_integrity.bats | 3 | 47, 116, 382 |
| test_double_spend.bats | 2 | 252, 317 |
| test_input_validation.bats | 3 | 40, 224, 267 |
| test_data_c4_both.bats | 2 | 205, 265 |

**Total: 20 assertions fixed across 7 test files**

## When NOT to Use OR-Chaining

✅ DO use OR-chaining for:
```bash
# Testing mutually exclusive conditions
assert_success || assert_failure  # Only ONE will be true
```

❌ DON'T use OR-chaining for:
```bash
# Testing if output contains any of multiple keywords
assert_output_contains "a" || assert_output_contains "b" || assert_output_contains "c"  # BROKEN!
# Use the fix instead (see above)
```

## Testing Your Fix

After making changes, verify with:

```bash
# Run the specific test file
bats tests/security/test_<name>.bats --tap

# Run all security tests
npm run test:security

# Run with verbose output to see error messages
BATS_TEST_VERBOSE=1 bats tests/security/test_<name>.bats
```

## Related Issues

- These assertions validate that the CLI returns proper error messages for security violations
- Without this fix, tests could pass even when security features weren't working
- The fix ensures real validation of error handling and user feedback

## Historical Context

**Commit:** 305376b - "Fix critical OR-chained assertion bug in 20+ security tests"

This was a high-priority fix because:
1. Systemic issue affecting 20+ tests
2. Tests appeared to pass when they shouldn't have
3. False sense of security - incomplete test coverage
4. Easy to miss unless you understand bash OR semantics

## Going Forward

- Always use the proper pattern for multi-keyword error validation
- Avoid OR-chaining `assert_output_contains` statements
- Use `grep -qiE "(word1|word2|word3)"` pattern instead
- Remember to check BOTH `${output}` and `${stderr_output}`
