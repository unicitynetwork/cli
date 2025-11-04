#!/usr/bin/env bats
# =============================================================================
# Sample Test - Infrastructure Demonstration
# =============================================================================
# This is a sample test file demonstrating the usage of the test infrastructure.
# It shows how to use helpers, assertions, and proper test structure.
#
# Run with: bats tests/unit/sample-test.bats
# =============================================================================

# Load test setup (automatically loads all helpers)
load ../setup

# -----------------------------------------------------------------------------
# Setup and Teardown
# -----------------------------------------------------------------------------

# Setup function runs before each test
setup() {
  # Initialize test environment
  setup_test

  # Skip if aggregator is not available
  # Comment this out to run tests without aggregator
  # skip_if_aggregator_unavailable
}

# Teardown function runs after each test
teardown() {
  # Clean up test resources
  cleanup_test
}

# -----------------------------------------------------------------------------
# ID Generation Tests
# -----------------------------------------------------------------------------

@test "ID generation: should generate unique IDs" {
  local id1 id2 id3

  id1=$(generate_unique_id)
  id2=$(generate_unique_id)
  id3=$(generate_unique_id)

  # All IDs should be different
  assert_not_equals "$id1" "$id2" "ID1 and ID2 should be different"
  assert_not_equals "$id2" "$id3" "ID2 and ID3 should be different"
  assert_not_equals "$id1" "$id3" "ID1 and ID3 should be different"

  # IDs should be non-empty
  [[ -n "$id1" ]]
  [[ -n "$id2" ]]
  [[ -n "$id3" ]]
}

@test "ID generation: should generate token-specific IDs" {
  local token_id
  token_id=$(generate_token_id)

  # Token ID should start with "token-"
  [[ "$token_id" =~ ^token- ]]
}

@test "ID generation: should generate address-specific IDs" {
  local addr_id
  addr_id=$(generate_address_id)

  # Address ID should start with "addr-"
  [[ "$addr_id" =~ ^addr- ]]
}

# -----------------------------------------------------------------------------
# File Operations Tests
# -----------------------------------------------------------------------------

@test "File operations: should create temporary file" {
  local temp_file
  temp_file=$(create_temp_file ".txt")

  # File should exist
  assert_file_exists "$temp_file"

  # File should have correct extension
  [[ "$temp_file" =~ \.txt$ ]]

  # File should be in test temp directory
  [[ "$temp_file" =~ ^${TEST_TEMP_DIR} ]]
}

@test "File operations: should create temporary directory" {
  local temp_dir
  temp_dir=$(create_temp_dir "test")

  # Directory should exist
  assert_dir_exists "$temp_dir"

  # Directory should be in test temp directory
  [[ "$temp_dir" =~ ^${TEST_TEMP_DIR} ]]
}

@test "File operations: should create artifact file" {
  local artifact_file
  artifact_file=$(create_artifact_file "test-artifact.txt")

  # File should exist
  assert_file_exists "$artifact_file"

  # File should be in artifacts directory
  [[ "$artifact_file" =~ artifacts/test-artifact.txt$ ]]

  # Write content to artifact
  echo "Test artifact content" > "$artifact_file"
}

# -----------------------------------------------------------------------------
# JSON Assertions Tests
# -----------------------------------------------------------------------------

@test "JSON assertions: should validate JSON file" {
  local json_file
  json_file=$(create_temp_file ".json")

  # Write valid JSON
  cat > "$json_file" <<EOF
{
  "version": "2.0",
  "name": "test",
  "count": 42
}
EOF

  # Validate JSON
  assert_valid_json "$json_file"

  # Check specific fields
  assert_json_field_equals "$json_file" ".version" "2.0"
  assert_json_field_equals "$json_file" ".name" "test"
  assert_json_field_equals "$json_file" ".count" "42"

  # Check field exists
  assert_json_field_exists "$json_file" ".version"
  assert_json_field_exists "$json_file" ".name"

  # Check field does not exist
  assert_json_field_not_exists "$json_file" ".nonexistent"
}

@test "JSON assertions: should detect invalid JSON" {
  local json_file
  json_file=$(create_temp_file ".json")

  # Write invalid JSON
  echo "{invalid json}" > "$json_file"

  # Should fail validation
  run assert_valid_json "$json_file"
  assert_failure
}

# -----------------------------------------------------------------------------
# Numeric Assertions Tests
# -----------------------------------------------------------------------------

@test "Numeric assertions: should compare numbers" {
  # Greater than
  assert_greater_than 10 5
  assert_greater_than 100 99

  # Less than
  assert_less_than 5 10
  assert_less_than 99 100

  # In range
  assert_in_range 50 0 100
  assert_in_range 1 1 10
  assert_in_range 10 1 10
}

# -----------------------------------------------------------------------------
# Output Assertions Tests
# -----------------------------------------------------------------------------

@test "Output assertions: should validate output content" {
  # Simulate command output
  output="Hello World"

  assert_output_contains "Hello"
  assert_output_contains "World"
  assert_output_not_contains "Goodbye"
}

@test "Output assertions: should match regex patterns" {
  # Simulate command output with address
  output="Generated address: DIRECT://000012345678abcdef"

  assert_output_matches "DIRECT://[0-9a-fA-F]+"
  assert_output_contains "DIRECT://"
}

# -----------------------------------------------------------------------------
# Token Preset Constants Tests
# -----------------------------------------------------------------------------

@test "Token presets: should have valid token type constants" {
  # Verify token type constants are defined and non-empty
  [[ -n "$TOKEN_TYPE_NFT" ]]
  [[ -n "$TOKEN_TYPE_UCT" ]]
  [[ -n "$TOKEN_TYPE_ALPHA" ]]
  [[ -n "$TOKEN_TYPE_USDU" ]]
  [[ -n "$TOKEN_TYPE_EURU" ]]

  # Verify they are hex strings of correct length
  [[ "$TOKEN_TYPE_NFT" =~ ^[0-9a-fA-F]{64}$ ]]
  [[ "$TOKEN_TYPE_UCT" =~ ^[0-9a-fA-F]{64}$ ]]
}

# -----------------------------------------------------------------------------
# Error Handling Tests
# -----------------------------------------------------------------------------

@test "Error handling: should handle missing files" {
  local nonexistent_file="/tmp/nonexistent-file-$(generate_unique_id).txt"

  # Should fail when file doesn't exist
  run assert_file_exists "$nonexistent_file"
  assert_failure
}

@test "Error handling: should validate required parameters" {
  # generate_unique_id should work without parameters
  local id
  id=$(generate_unique_id)
  [[ -n "$id" ]]

  # create_temp_file should work without parameters
  local temp_file
  temp_file=$(create_temp_file)
  assert_file_exists "$temp_file"
}

# -----------------------------------------------------------------------------
# Session Information Tests
# -----------------------------------------------------------------------------

@test "Session info: should have valid session ID" {
  local session_id
  session_id=$(get_session_id)

  # Session ID should be non-empty
  [[ -n "$session_id" ]]

  # Session ID should contain timestamp and PID
  [[ "$session_id" =~ ^[0-9]{8}-[0-9]{6}-[0-9]+-[0-9a-f]+$ ]]
}

@test "Session info: should track counter increments" {
  local counter1 counter2 counter3

  counter1=$(get_current_counter)
  generate_unique_id > /dev/null
  counter2=$(get_current_counter)
  generate_unique_id > /dev/null
  counter3=$(get_current_counter)

  # Counter should increment
  assert_greater_than "$counter2" "$counter1"
  assert_greater_than "$counter3" "$counter2"
}

# -----------------------------------------------------------------------------
# Configuration Tests
# -----------------------------------------------------------------------------

@test "Configuration: should have valid aggregator URL" {
  # Aggregator URL should be set
  [[ -n "$UNICITY_AGGREGATOR_URL" ]]

  # URL should start with http:// or https://
  [[ "$UNICITY_AGGREGATOR_URL" =~ ^https?:// ]]
}

@test "Configuration: should have valid CLI binary path" {
  # CLI binary path should be set
  [[ -n "$UNICITY_CLI_BIN" ]]

  # Full path to CLI should be retrievable
  local cli_path
  cli_path=$(get_cli_path)
  [[ -n "$cli_path" ]]
}

# -----------------------------------------------------------------------------
# Test Environment Tests
# -----------------------------------------------------------------------------

@test "Environment: should have valid test directories" {
  # Test temp directory should exist
  assert_dir_exists "$TEST_TEMP_DIR"

  # Test artifacts directory should exist
  assert_dir_exists "$TEST_ARTIFACTS_DIR"

  # Test run ID should be set
  [[ -n "$TEST_RUN_ID" ]]
}

@test "Environment: should have valid test metadata" {
  # Test start time should be set
  [[ -n "$TEST_START_TIME" ]]

  # Start time should be a valid Unix timestamp
  [[ "$TEST_START_TIME" =~ ^[0-9]+$ ]]

  # Start time should be recent (within last hour)
  local current_time
  current_time=$(date +%s)
  local age=$((current_time - TEST_START_TIME))
  assert_less_than "$age" 3600
}
