# Test Cleanup Best Practices - Unicity CLI

## Quick Reference Guide

This guide documents the test cleanup and isolation patterns used in the Unicity CLI test suite. Follow these patterns when writing new tests.

## Core Principles

1. **Each test runs in isolated temp directory** (`$TEST_TEMP_DIR`)
2. **Cleanup happens automatically** via `teardown_common()`
3. **Failed tests preserve files** for debugging
4. **No manual cleanup required** in test bodies

## Test File Template

```bash
#!/usr/bin/env bats
# Test Suite: MY_COMMAND (description)

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common  # Creates $TEST_TEMP_DIR
    check_aggregator  # If test needs aggregator

    # Generate test secrets
    SECRET=$(generate_test_secret "test-prefix")
}

teardown() {
    teardown_common  # Cleans up $TEST_TEMP_DIR
}

@test "MY_COMMAND-001: Test description" {
    log_test "What this test does"

    # Create files in temp directory (automatic)
    mint_token_to_address "${SECRET}" "nft" "" "token.txf"

    # Verify
    assert_file_exists "token.txf"
    assert_token_fully_valid "token.txf"

    # Cleanup: AUTOMATIC via teardown_common()
}
```

## File Creation Patterns

### ✅ DO: Use Relative Paths

Files created with relative paths automatically go into `$TEST_TEMP_DIR`:

```bash
# Relative path (GOOD)
mint_token_to_address "${SECRET}" "nft" "" "token.txf"
# Creates: $TEST_TEMP_DIR/token.txf

# Output redirection (GOOD)
run_cli_with_secret "${SECRET}" "gen-address" > address.json
# Creates: $TEST_TEMP_DIR/address.json
```

### ✅ DO: Use Helper Functions

Helper functions automatically use temp directory:

```bash
# Mint token (file created in $TEST_TEMP_DIR)
mint_token_to_address "${SECRET}" "nft" "{\"data\":\"test\"}" "token.txf"

# Send token (file created in $TEST_TEMP_DIR)
send_token_offline "${SECRET}" "token.txf" "${recipient_addr}" "transfer.txf"

# Generate address (file created in $TEST_TEMP_DIR if output_file provided)
local addr
addr=$(generate_address "${SECRET}" "nft" "" "address.json")
```

### ✅ DO: Use create_temp_file() for Dynamic Names

For temporary files with auto-generated names:

```bash
# Create temp file in $TEST_TEMP_DIR
local temp_token
temp_token=$(create_temp_file ".txf")

# Use it
mint_token_to_address "${SECRET}" "nft" "" "$temp_token"
```

### ❌ DON'T: Use Absolute Paths

Never use absolute paths outside temp directory:

```bash
# BAD - creates file outside temp directory
mint_token_to_address "${SECRET}" "nft" "" "/tmp/token.txf"

# BAD - hardcoded project root path
run_cli_with_secret "${SECRET}" "gen-address" > /home/user/cli/address.json
```

### ❌ DON'T: Create Files in Project Root

Never create files in project root or parent directories:

```bash
# BAD - creates file in project root
cd ../.. && run_cli gen-address > address.json

# BAD - uses parent directory
mint_token_to_address "${SECRET}" "nft" "" "../token.txf"
```

## Cleanup Patterns

### ✅ DO: Rely on Automatic Cleanup

```bash
@test "Test with automatic cleanup" {
    mint_token_to_address "${SECRET}" "nft" "" "token.txf"
    assert_file_exists "token.txf"

    # NO manual cleanup needed
    # teardown_common() will remove $TEST_TEMP_DIR
}
```

### ✅ DO: Use teardown_common()

```bash
teardown() {
    teardown_common  # Always call this
}
```

### ❌ DON'T: Clean Up Manually (Usually)

Manual cleanup is redundant and error-prone:

```bash
@test "Test with unnecessary manual cleanup" {
    mint_token_to_address "${SECRET}" "nft" "" "token.txf"

    # BAD - unnecessary, teardown_common() handles it
    rm -f token.txf
}
```

**Exception**: Manual cleanup is OK for intermediate files within a test:

```bash
@test "Test with intermediate cleanup" {
    mint_token_to_address "${SECRET}" "nft" "" "temp.txf"
    assert_file_exists "temp.txf"

    # OK - cleaning up intermediate file within same test
    rm -f temp.txf

    mint_token_to_address "${SECRET}" "uct" "" "final.txf"
    assert_file_exists "final.txf"
}
```

## Environment Variables

### TEST_TEMP_DIR

Current test's temporary directory:

```bash
# Available in all tests
echo "Test files in: $TEST_TEMP_DIR"

# Use for explicit paths (usually not needed)
local output_file="$TEST_TEMP_DIR/token.txf"
```

### UNICITY_TEST_KEEP_TMP

Preserve temp directory after test (for debugging):

```bash
# Keep all test files after run
UNICITY_TEST_KEEP_TMP=1 bats tests/functional/test_mint_token.bats

# Location will be printed:
# Test artifacts preserved at: /tmp/bats-test-12345-67890/test-0
```

### UNICITY_TEST_DEBUG

Enable verbose output:

```bash
# See detailed test execution
UNICITY_TEST_DEBUG=1 bats tests/functional/test_mint_token.bats -f "MINT_TOKEN-001"
```

## Debugging Failed Tests

### Automatic Preservation

Failed tests automatically preserve files:

```bash
$ bats tests/functional/test_mint_token.bats -f "MINT_TOKEN-001"
not ok 1 MINT_TOKEN-001: Mint NFT with default settings
Test artifacts preserved at: /tmp/bats-test-12345-67890/test-0

# Inspect preserved files
$ ls -la /tmp/bats-test-12345-67890/test-0/
total 24
-rw-r--r-- 1 user user 8192 Nov 10 10:00 token.txf
drwxr-xr-x 2 user user 4096 Nov 10 10:00 artifacts/
```

### Manual Preservation

Force preservation of successful tests:

```bash
# Run with preservation
UNICITY_TEST_KEEP_TMP=1 bats tests/functional/test_mint_token.bats -f "MINT_TOKEN-001"

# Inspect files
ls -la /tmp/bats-test-*/test-0/
```

## Common Patterns

### Pattern 1: Mint and Verify

```bash
@test "Mint token and verify" {
    # Mint (file created in $TEST_TEMP_DIR)
    mint_token_to_address "${SECRET}" "nft" "{\"name\":\"Test\"}" "token.txf"

    # Verify
    assert_file_exists "token.txf"
    assert_token_fully_valid "token.txf"

    # Cleanup: AUTOMATIC
}
```

### Pattern 2: Generate Address and Use

```bash
@test "Generate address and use it" {
    # Generate address (file created in $TEST_TEMP_DIR)
    local addr
    addr=$(generate_address "${SECRET}" "nft" "" "address.json")
    assert_set addr

    # Use address
    mint_token_to_address "${SECRET}" "nft" "" "token.txf"
    send_token_offline "${SECRET}" "token.txf" "${addr}" "transfer.txf"

    # Verify
    assert_file_exists "transfer.txf"

    # Cleanup: AUTOMATIC
}
```

### Pattern 3: Multiple Files in One Test

```bash
@test "Create multiple files" {
    # All files created in same $TEST_TEMP_DIR
    mint_token_to_address "${ALICE_SECRET}" "nft" "" "alice-token.txf"
    mint_token_to_address "${BOB_SECRET}" "nft" "" "bob-token.txf"

    local carol_addr
    carol_addr=$(generate_address "${CAROL_SECRET}" "nft")

    send_token_offline "${ALICE_SECRET}" "alice-token.txf" "${carol_addr}" "transfer1.txf"
    send_token_offline "${BOB_SECRET}" "bob-token.txf" "${carol_addr}" "transfer2.txf"

    # All files isolated to this test's temp directory
    # Cleanup: AUTOMATIC
}
```

### Pattern 4: Capture CLI Output to File

```bash
@test "Capture output to file" {
    # Capture JSON output
    run_cli_with_secret "${SECRET}" "gen-address" > address.json
    assert_success

    # Extract and verify
    local addr
    addr=$(extract_json_field "address.json" ".address")
    assert_set addr

    # Cleanup: AUTOMATIC
}
```

## Helper Function Reference

### File Creation Helpers

```bash
# Create temp file with extension
create_temp_file ".txf"           # Returns: $TEST_TEMP_DIR/tmp-12345.txf

# Create temp directory
create_temp_dir "tokens"          # Returns: $TEST_TEMP_DIR/tmpdir-12345-tokens

# Create artifact (preserved even on success)
create_artifact_file "test.log"  # Returns: $TEST_ARTIFACTS_DIR/test.log
```

### Token Operation Helpers

```bash
# Mint token
mint_token_to_address "${SECRET}" "nft" "{\"data\":\"test\"}" "token.txf"

# Send offline
send_token_offline "${SECRET}" "input.txf" "${recipient}" "output.txf" "message"

# Send immediate
send_token_immediate "${SECRET}" "input.txf" "${recipient}" "output.txf"

# Receive token
receive_token "${SECRET}" "transfer.txf" "received.txf"

# Generate address
generate_address "${SECRET}" "nft" "${nonce}" "address.json"
```

## Verification Checklist

When writing new tests, verify:

- [ ] Test file has `setup()` calling `setup_common()`
- [ ] Test file has `teardown()` calling `teardown_common()`
- [ ] All file paths are relative (no absolute paths)
- [ ] No files created outside `$TEST_TEMP_DIR`
- [ ] No manual cleanup in test body (unless intermediate files)
- [ ] Test runs in isolation (doesn't depend on other tests)

## Running Cleanup Verification

```bash
# Run verification script
./test-cleanup-verification.sh

# Manual verification
ls /tmp/bats-test-* 2>/dev/null || echo "Clean"
ls *.txf *address*.json 2>/dev/null || echo "Clean"
```

## Troubleshooting

### Problem: Files Not Cleaned Up

**Symptoms**: Files remain in `/tmp/bats-test-*` after tests

**Causes**:
1. Test failed (expected behavior - files preserved for debugging)
2. `UNICITY_TEST_KEEP_TMP=1` is set
3. Test doesn't call `teardown_common()`

**Solution**:
```bash
# Check if test failed
echo $?  # Non-zero = failed

# Check environment
echo $UNICITY_TEST_KEEP_TMP

# Verify teardown function exists
grep -A 3 "^teardown()" tests/functional/test_*.bats
```

### Problem: Files Created in Wrong Location

**Symptoms**: Files appear in project root instead of temp directory

**Causes**:
1. Using absolute paths
2. Using `../` parent directory references
3. Changing directory with `cd`

**Solution**:
```bash
# Use relative paths only
mint_token_to_address "${SECRET}" "nft" "" "token.txf"  # ✅

# Don't use absolute paths
mint_token_to_address "${SECRET}" "nft" "" "/tmp/token.txf"  # ❌

# Don't change directory
cd /tmp && run_cli mint-token  # ❌
```

### Problem: Tests Interfere with Each Other

**Symptoms**: Test passes alone but fails when run with other tests

**Causes**:
1. Tests sharing file names (shouldn't happen with `$TEST_TEMP_DIR`)
2. Tests not using `setup_common()` / `teardown_common()`

**Solution**:
```bash
# Ensure setup/teardown exist
setup() {
    setup_common  # ✅ Creates isolated temp directory
}

teardown() {
    teardown_common  # ✅ Cleans up temp directory
}
```

## Examples from Test Suite

### Excellent Example: test_send_token.bats

```bash
#!/usr/bin/env bats

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common  # ✅
    check_aggregator

    ALICE_SECRET=$(generate_test_secret "alice-send")
    BOB_SECRET=$(generate_test_secret "bob-send")
}

teardown() {
    teardown_common  # ✅
}

@test "SEND_TOKEN-001: Create offline transfer package" {
    log_test "Testing Pattern A: Offline transfer"

    # Generate address (relative path) ✅
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft" "" "bob-addr.json")

    # Mint token (relative path) ✅
    mint_token_to_address "${ALICE_SECRET}" "nft" "{\"name\":\"Test NFT\"}" "alice-token.txf"

    # Send token (relative path) ✅
    send_token_offline "${ALICE_SECRET}" "alice-token.txf" "${bob_addr}" "transfer.txf"

    # Verify
    assert_file_exists "transfer.txf"
    assert_offline_transfer_valid "transfer.txf"

    # NO manual cleanup ✅ - teardown_common() handles it
}
```

## Summary

✅ **Key Takeaways**:

1. Always use `setup_common()` and `teardown_common()`
2. Use relative paths (files go to `$TEST_TEMP_DIR` automatically)
3. Don't manually clean up (it happens automatically)
4. Failed tests preserve files for debugging
5. Each test is fully isolated

✅ **Benefits**:

- No file leakage between tests
- No manual cleanup required
- Easy debugging of failed tests
- Safe for parallel test execution
- Clean test environment every time

---

**For more information**:
- Analysis: `TEST_CLEANUP_ANALYSIS.md`
- Verification: `TEST_CLEANUP_VERIFICATION_SUMMARY.md`
- Test Guide: `TEST_SUITE_COMPLETE.md`
