# Unicity CLI Test Infrastructure - Quick Reference

## Running Tests

```bash
# All tests
npm test

# By category
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:e2e           # End-to-end tests
npm run test:regression    # Regression tests

# With debug output
npm run test:debug         # Enable debug messages
npm run test:verbose       # Verbose assertions
npm run test:keep-tmp      # Keep temp files

# Direct BATS execution
bats tests/unit/sample-test.bats
bats tests/unit/
bats -f "specific test name" tests/unit/
```

## Test Template

```bash
#!/usr/bin/env bats

load ../setup

setup() {
  setup_test
  skip_if_aggregator_unavailable
}

teardown() {
  cleanup_test
}

@test "descriptive test name" {
  # Test code here
}
```

## ID Generation

```bash
generate_unique_id           # General unique ID
generate_token_id            # Token-specific ID (token-*)
generate_address_id          # Address-specific ID (addr-*)
generate_request_id          # Request-specific ID (req-*)
generate_test_run_id         # Test run ID

# Session info
get_session_id              # Current session ID
get_current_counter         # Current counter value
```

## Token Operations

```bash
# Generate address
generate_address "$secret" "preset" "nonce"
# Sets: $GENERATED_ADDRESS

# Mint token
mint_token "$secret" "preset" "output_file" "data"
# Sets: $MINT_OUTPUT_FILE

# Send token (offline - Pattern A)
send_token_offline "$secret" "$input" "$recipient" "$output" "message"
# Sets: $SEND_OUTPUT_FILE

# Send token (immediate - Pattern B)
send_token_immediate "$secret" "$input" "$recipient" "$output"
# Sets: $SEND_OUTPUT_FILE

# Receive token
receive_token "$secret" "$input" "$output"
# Sets: $RECEIVE_OUTPUT_FILE

# Verify token
verify_token "$token_file"
verify_token_on_aggregator "$token_file"
```

## Token Queries

```bash
get_token_type "$file"           # Extract token type
get_token_id "$file"             # Extract token ID
get_token_recipient "$file"      # Extract recipient
get_transaction_count "$file"    # Count transactions
has_offline_transfer "$file"     # Check offline transfer (returns 0/1)
is_nft_token "$file"             # Check if NFT (returns 0/1)
is_fungible_token "$file"        # Check if fungible (returns 0/1)
get_coin_count "$file"           # Get number of coins
get_total_coin_amount "$file"    # Sum coin amounts
get_token_status "$file"         # Get status (PENDING/TRANSFERRED/CONFIRMED)
```

## Basic Assertions

```bash
assert_success                              # Exit code 0
assert_failure                              # Non-zero exit code
assert_exit_code 1                          # Specific exit code

# Output
assert_output_contains "string"
assert_output_not_contains "string"
assert_output_matches "regex"
assert_output_equals "exact string"

# Files
assert_file_exists "$file"
assert_file_not_exists "$file"
assert_dir_exists "$dir"
```

## JSON Assertions

```bash
assert_valid_json "$file"
assert_json_field_equals "$file" ".path" "value"
assert_json_field_exists "$file" ".path"
assert_json_field_not_exists "$file" ".path"

# Examples
assert_json_field_equals "$token" ".version" "2.0"
assert_json_field_exists "$token" ".genesis.data"
```

## Value Assertions

```bash
# Comparison
assert_equals "expected" "actual" "message"
assert_not_equals "not_expected" "actual" "message"

# Numeric
assert_greater_than 10 5                    # 10 > 5
assert_less_than 5 10                       # 5 < 10
assert_in_range 50 0 100                    # 0 <= 50 <= 100
```

## Token-Specific Assertions

```bash
assert_valid_token "$file"                  # Valid token structure
assert_has_offline_transfer "$file"         # Has offline transfer
assert_no_offline_transfer "$file"          # No offline transfer
assert_token_type "$file" "nft"             # Token type matches preset
```

## File Operations

```bash
create_temp_file ".txt"                     # Create temp file with extension
create_temp_dir "suffix"                    # Create temp directory
create_artifact_file "name.txt"             # Create artifact (preserved)
```

## Utilities

```bash
# Logging
debug "message"                             # Debug output (if enabled)
info "message"                              # Info output
warn "message"                              # Warning output
error "message"                             # Error output

# Control
skip "reason"                               # Skip test with reason
skip_if_aggregator_unavailable              # Skip if no aggregator

# Output processing
save_output_artifact "name" "$content"
extract_json_field ".path" "$json"
output_contains "string"
output_matches "pattern"
```

## Environment Variables

```bash
# Configuration
UNICITY_AGGREGATOR_URL=http://localhost:3000
UNICITY_CLI_BIN=dist/index.js
UNICITY_NODE_BIN=node

# Test behavior
UNICITY_TEST_DEBUG=1                        # Enable debug output
UNICITY_TEST_TRACE=1                        # Enable bash trace (set -x)
UNICITY_TEST_KEEP_TMP=1                     # Keep temp files
UNICITY_TEST_SKIP_EXTERNAL=1                # Skip external service tests
UNICITY_TEST_VERBOSE_ASSERTIONS=1           # Verbose assertions
UNICITY_TEST_COLOR=1                        # Colored output

# Test directories (set by setup_test)
TEST_TEMP_DIR                               # Test-specific temp directory
TEST_ARTIFACTS_DIR                          # Artifacts directory
TEST_RUN_ID                                 # Unique test run ID
TEST_START_TIME                             # Test start timestamp

# Output variables (set by helpers)
GENERATED_ADDRESS                           # Generated address
MINT_OUTPUT_FILE                            # Minted token file
SEND_OUTPUT_FILE                            # Sent token file
RECEIVE_OUTPUT_FILE                         # Received token file
```

## Token Type Presets

```bash
TOKEN_TYPE_NFT=f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509
TOKEN_TYPE_UCT=455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89
TOKEN_TYPE_ALPHA=455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89
TOKEN_TYPE_USDU=8f0f3d7a5e7297be0ee98c63b81bcebb2740f43f616566fc290f9823a54f52d7
TOKEN_TYPE_EURU=5e160d5e9fdbb03b553fb9c3f6e6c30efa41fa807be39fb4f18e43776e492925
```

## Common Patterns

### Mint and Verify Token

```bash
@test "mint and verify token" {
  local secret="test-$(generate_unique_id)"

  mint_token "$secret" "nft"

  assert_file_exists "$MINT_OUTPUT_FILE"
  assert_valid_token "$MINT_OUTPUT_FILE"
  assert_token_type "$MINT_OUTPUT_FILE" "nft"
  assert_no_offline_transfer "$MINT_OUTPUT_FILE"
}
```

### Complete Transfer Flow

```bash
@test "complete transfer flow" {
  local alice="alice-$(generate_unique_id)"
  local bob="bob-$(generate_unique_id)"

  # Bob generates address
  generate_address "$bob" "nft"
  local bob_addr="$GENERATED_ADDRESS"

  # Alice mints token
  mint_token "$alice" "nft"

  # Alice sends to Bob
  send_token_offline "$alice" "$MINT_OUTPUT_FILE" "$bob_addr"

  # Bob receives
  receive_token "$bob" "$SEND_OUTPUT_FILE"

  # Verify
  assert_valid_token "$RECEIVE_OUTPUT_FILE"
  assert_json_field_equals "$RECEIVE_OUTPUT_FILE" \
    ".genesis.data.recipient" "$bob_addr"
}
```

### Check JSON Structure

```bash
@test "token has correct structure" {
  local token="$TEST_TEMP_DIR/token.txf"

  # ... create token ...

  assert_json_field_equals "$token" ".version" "2.0"
  assert_json_field_exists "$token" ".genesis"
  assert_json_field_exists "$token" ".genesis.data"
  assert_json_field_exists "$token" ".genesis.data.tokenType"
  assert_json_field_exists "$token" ".transactions"
}
```

### Error Handling

```bash
@test "should fail with invalid input" {
  run_cli mint-token --invalid-option

  assert_failure
  assert_output_contains "error"
}
```

## Debug Commands

```bash
# Run with debug output
UNICITY_TEST_DEBUG=1 bats tests/unit/sample-test.bats

# Keep temp files for inspection
UNICITY_TEST_KEEP_TMP=1 bats tests/unit/

# Enable bash trace
UNICITY_TEST_TRACE=1 bats tests/unit/

# Combine options
UNICITY_TEST_DEBUG=1 UNICITY_TEST_VERBOSE_ASSERTIONS=1 \
  UNICITY_TEST_KEEP_TMP=1 bats tests/unit/
```

## File Locations

```bash
# Configuration
tests/config/test-config.env

# Helpers
tests/helpers/common.bash
tests/helpers/id-generation.bash
tests/helpers/token-helpers.bash
tests/helpers/assertions.bash

# Setup
tests/setup.bash                            # Auto-loaded by BATS

# Documentation
tests/README.md                             # Full documentation
tests/INFRASTRUCTURE_SUMMARY.md             # Implementation details
tests/QUICK_REFERENCE.md                    # This file

# Sample
tests/unit/sample-test.bats                 # Example tests
```

## Tips

1. **Use unique IDs**: Always use `generate_unique_id()` for test data
2. **Check aggregator**: Use `skip_if_aggregator_unavailable()` for integration tests
3. **Clean up**: Always use `setup_test()` and `cleanup_test()`
4. **Debug mode**: Enable `UNICITY_TEST_DEBUG=1` when developing tests
5. **Artifacts**: Failed tests automatically preserve artifacts
6. **Assertions**: Use specific assertions (e.g., `assert_json_field_equals`) over generic ones
7. **Descriptive names**: Use clear test names that explain what is being tested

## Common Issues

### CLI not found

```bash
npm run build
```

### Aggregator not available

```bash
# Check aggregator
curl http://localhost:3000/health

# Or skip external tests
export UNICITY_TEST_SKIP_EXTERNAL=1
```

### jq not found

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq
```

### BATS not found

```bash
# macOS
brew install bats-core

# Ubuntu/Debian
sudo apt-get install bats
```

## Resources

- Full docs: `/home/vrogojin/cli/tests/README.md`
- Implementation details: `/home/vrogojin/cli/tests/INFRASTRUCTURE_SUMMARY.md`
- Sample tests: `/home/vrogojin/cli/tests/unit/sample-test.bats`
- BATS documentation: https://bats-core.readthedocs.io/
