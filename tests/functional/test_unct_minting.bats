#!/usr/bin/env bats
# =============================================================================
# UNCT Coin Minting Tests (UNCT-001 to UNCT-008)
# =============================================================================
# Test suite for UNCT (Unicity Coin Token) minting functionality including
# POW blockchain integration, coin origin proof fetching, and validation.
#
# Test Coverage:
#   UNCT-001: Successfully mint UNCT token with valid block height
#   UNCT-002: Reject UNCT mine without endpoint specification
#   UNCT-003: Reject UNCT mine with invalid block height
#   UNCT-004: Reject UNCT mine without token ID
#   UNCT-005: Handle POW node connection failure gracefully
#   UNCT-006: Verify coin origin proof embedded in token data
#   UNCT-007: Verify correct coin amount (10 UNCT = 10000000000000000000 raw units)
#   UNCT-008: Verify token type is automatically set to UCT
# =============================================================================

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'
load '../helpers/id-generation'

# -----------------------------------------------------------------------------
# Setup and Teardown
# -----------------------------------------------------------------------------

setup() {
  setup_test
  export TEST_SECRET=$(generate_unique_id "unct-secret")
  export TEST_TOKEN_ID=$(generate_unique_id "unct-token-id")
}

teardown() {
  cleanup_test
}

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

# Check if POW node is available
check_pow_node() {
  local endpoint="${1:-http://localhost:8545}"

  # Try to connect to POW node
  if command -v curl >/dev/null 2>&1; then
    if curl -s -f -m 2 "$endpoint" >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

# Skip test if POW node is not available
skip_if_pow_unavailable() {
  if ! check_pow_node; then
    skip "POW blockchain node not available at http://localhost:8545"
  fi
}

# -----------------------------------------------------------------------------
# UNCT-001: Successful UNCT Minting
# -----------------------------------------------------------------------------

@test "UNCT-001: Successfully mint UNCT token with valid block height" {
  skip_if_pow_unavailable
  skip_if_aggregator_unavailable

  local token_file
  token_file=$(create_temp_file ".txf")

  # Mint UNCT token with block height 1 (genesis + 1)
  run_cli_with_secret "$TEST_SECRET" "mint-token --local --unct-mine 1 --local-unct -i $TEST_TOKEN_ID -o $token_file"

  # MUST succeed
  assert_success "UNCT minting with valid block height must succeed"

  # Token file must be created
  assert_file_exists "$token_file" "UNCT token file must be created"
  assert_valid_json "$token_file" "UNCT token must be valid JSON"

  # Verify token structure
  assert_json_field_exists "$token_file" ".genesis" "Token must have genesis"
  assert_json_field_exists "$token_file" ".state" "Token must have state"

  # Verify coin amount (10 UNCT = 10^19 raw units)
  assert_json_field_exists "$token_file" ".genesis.data.coinData" "Token must have coinData"

  # Extract coin amount and verify
  local coin_amount
  coin_amount=$(jq -r '.genesis.data.coinData.coins[0][1]' "$token_file")

  if [[ "$coin_amount" == "10000000000000000000" ]]; then
    info "✓ Coin amount is correct: 10 UNCT (10000000000000000000 raw units)"
  else
    fail "Incorrect coin amount. Expected: 10000000000000000000, Got: $coin_amount"
  fi

  # Verify token data contains proof (should be non-empty)
  local token_data_hex
  token_data_hex=$(jq -r '.state.data' "$token_file")

  if [[ -n "$token_data_hex" && "$token_data_hex" != "null" ]]; then
    info "✓ Token data is present (contains coin origin proof)"
  else
    fail "Token data must contain coin origin proof"
  fi
}

# -----------------------------------------------------------------------------
# UNCT-002: Endpoint Requirement
# -----------------------------------------------------------------------------

@test "UNCT-002: Reject UNCT mine without endpoint specification" {
  local token_file
  token_file=$(create_temp_file ".txf")

  # Try to mint UNCT without --unct-url or --local-unct
  run_cli_with_secret "$TEST_SECRET" "mint-token --local --unct-mine 1 -i $TEST_TOKEN_ID -o $token_file"

  # MUST fail
  assert_failure "UNCT mine without endpoint must fail"

  # Error message must indicate endpoint is required
  assert_output_contains "unct-url|local-unct|endpoint" "Error must mention endpoint requirement"
}

# -----------------------------------------------------------------------------
# UNCT-003: Invalid Block Height
# -----------------------------------------------------------------------------

@test "UNCT-003: Reject UNCT mine with invalid block height" {
  local token_file
  token_file=$(create_temp_file ".txf")

  # Test negative block height
  run_cli_with_secret "$TEST_SECRET" "mint-token --local --unct-mine -1 --local-unct -i $TEST_TOKEN_ID -o $token_file"

  assert_failure "Negative block height must be rejected"
  assert_output_contains "block height|invalid" "Error must mention invalid block height"

  # Test non-numeric block height
  run_cli_with_secret "$TEST_SECRET" "mint-token --local --unct-mine abc --local-unct -i $TEST_TOKEN_ID -o $token_file"

  assert_failure "Non-numeric block height must be rejected"
  assert_output_contains "block height|invalid" "Error must mention invalid block height"
}

# -----------------------------------------------------------------------------
# UNCT-004: Token ID Requirement
# -----------------------------------------------------------------------------

@test "UNCT-004: Reject UNCT mine without token ID" {
  local token_file
  token_file=$(create_temp_file ".txf")

  # Try to mint UNCT without --token-id
  run_cli_with_secret "$TEST_SECRET" "mint-token --local --unct-mine 1 --local-unct -o $token_file"

  # MUST fail
  assert_failure "UNCT mine without token ID must fail"

  # Error message must indicate token ID is required
  assert_output_contains "token-id|token ID|tokenId" "Error must mention token ID requirement"
}

# -----------------------------------------------------------------------------
# UNCT-005: POW Node Connection Failure
# -----------------------------------------------------------------------------

@test "UNCT-005: Handle POW node connection failure gracefully" {
  local token_file
  token_file=$(create_temp_file ".txf")

  # Use invalid POW endpoint
  run_cli_with_secret "$TEST_SECRET" "mint-token --local --unct-mine 1 --unct-url http://localhost:9999 -i $TEST_TOKEN_ID -o $token_file"

  # MUST fail with connection error
  assert_failure "UNCT mine must fail when POW node is unavailable"

  # Error message must indicate connection problem
  assert_output_contains "connect|connection|POW" "Error must indicate POW connection failure"
}

# -----------------------------------------------------------------------------
# UNCT-006: Proof Embedding Verification
# -----------------------------------------------------------------------------

@test "UNCT-006: Verify coin origin proof embedded in token data" {
  skip_if_pow_unavailable
  skip_if_aggregator_unavailable

  local token_file
  token_file=$(create_temp_file ".txf")

  # Mint UNCT token
  run_cli_with_secret "$TEST_SECRET" "mint-token --local --unct-mine 1 --local-unct -i $TEST_TOKEN_ID -o $token_file"
  assert_success "UNCT minting must succeed"

  # Extract token data (hex string)
  local token_data_hex
  token_data_hex=$(jq -r '.state.data' "$token_file")

  # Verify data exists
  if [[ -z "$token_data_hex" || "$token_data_hex" == "null" ]]; then
    fail "Token data must be present"
  fi

  # Decode hex to JSON (token data should contain coin origin proof as JSON)
  local proof_json
  proof_json=$(echo "$token_data_hex" | xxd -r -p 2>/dev/null || echo "")

  # Verify it's valid JSON
  if echo "$proof_json" | jq empty 2>/dev/null; then
    info "✓ Token data is valid JSON (coin origin proof)"
  else
    fail "Token data must be valid JSON containing coin origin proof"
  fi

  # Verify proof structure (should have version, tokenId, blockHeight, etc.)
  if echo "$proof_json" | jq -e '.version and .tokenId and .blockHeight and .merkleRoot' >/dev/null 2>&1; then
    info "✓ Coin origin proof has correct structure"
  else
    fail "Coin origin proof missing required fields"
  fi
}

# -----------------------------------------------------------------------------
# UNCT-007: Coin Amount Verification
# -----------------------------------------------------------------------------

@test "UNCT-007: Verify correct coin amount (10 UNCT)" {
  skip_if_pow_unavailable
  skip_if_aggregator_unavailable

  local token_file
  token_file=$(create_temp_file ".txf")

  # Mint UNCT token
  run_cli_with_secret "$TEST_SECRET" "mint-token --local --unct-mine 1 --local-unct -i $TEST_TOKEN_ID -o $token_file"
  assert_success "UNCT minting must succeed"

  # Verify exactly 1 coin
  local coin_count
  coin_count=$(jq -r '.genesis.data.coinData.coins | length' "$token_file")

  if [[ "$coin_count" == "1" ]]; then
    info "✓ Exactly 1 coin in coinData"
  else
    fail "Expected 1 coin, got $coin_count"
  fi

  # Verify amount is exactly 10 UNCT (10^19 raw units with 18 decimals)
  local coin_amount
  coin_amount=$(jq -r '.genesis.data.coinData.coins[0][1]' "$token_file")

  local expected_amount="10000000000000000000"

  if [[ "$coin_amount" == "$expected_amount" ]]; then
    info "✓ Coin amount is exactly 10 UNCT ($expected_amount raw units)"
  else
    fail "Expected $expected_amount, got $coin_amount"
  fi
}

# -----------------------------------------------------------------------------
# UNCT-008: Token Type Auto-Configuration
# -----------------------------------------------------------------------------

@test "UNCT-008: Verify token type is automatically set to UCT" {
  skip_if_pow_unavailable
  skip_if_aggregator_unavailable

  local token_file
  token_file=$(create_temp_file ".txf")

  # Mint UNCT token (without explicit --preset)
  run_cli_with_secret "$TEST_SECRET" "mint-token --local --unct-mine 1 --local-unct -i $TEST_TOKEN_ID -o $token_file"
  assert_success "UNCT minting must succeed"

  # Verify token type is UCT
  local token_type_id
  token_type_id=$(jq -r '.genesis.data.tokenType' "$token_file")

  # UCT token type ID from UNICITY_TOKEN_TYPES
  local expected_uct_id="455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89"

  if [[ "$token_type_id" == "$expected_uct_id" ]]; then
    info "✓ Token type automatically set to UCT"
  else
    fail "Expected UCT token type ($expected_uct_id), got $token_type_id"
  fi
}

# -----------------------------------------------------------------------------
# Integration Tests
# -----------------------------------------------------------------------------

@test "UNCT Integration: Mint UNCT and verify all properties" {
  skip_if_pow_unavailable
  skip_if_aggregator_unavailable

  local token_file
  token_file=$(create_temp_file ".txf")

  local secret
  secret=$(generate_unique_id "unct-integration-secret")

  local token_id
  token_id=$(generate_unique_id "unct-integration-token")

  # Mint UNCT token with all options
  run_cli_with_secret "$secret" "mint-token --local --unct-mine 1 --local-unct -i $token_id --save -o $token_file"

  assert_success "UNCT integration test must succeed"
  assert_file_exists "$token_file"
  assert_valid_json "$token_file"

  # Verify all critical properties
  local checks_passed=0

  # Check 1: Token type is UCT
  if jq -e '.genesis.data.tokenType == "455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89"' "$token_file" >/dev/null; then
    ((checks_passed++))
  fi

  # Check 2: Coin amount is 10 UNCT
  if jq -e '.genesis.data.coinData.coins[0][1] == "10000000000000000000"' "$token_file" >/dev/null; then
    ((checks_passed++))
  fi

  # Check 3: Coin origin proof exists in token data
  if jq -e '.state.data != null and .state.data != ""' "$token_file" >/dev/null; then
    ((checks_passed++))
  fi

  # Check 4: Genesis inclusion proof exists
  if jq -e '.genesis.inclusionProof != null' "$token_file" >/dev/null; then
    ((checks_passed++))
  fi

  info "Passed $checks_passed/4 integration checks"

  if [[ $checks_passed -eq 4 ]]; then
    info "✓ All UNCT integration checks passed"
  else
    fail "Integration checks failed: only $checks_passed/4 passed"
  fi
}

# -----------------------------------------------------------------------------
# Error Message Quality Tests
# -----------------------------------------------------------------------------

@test "UNCT: User-friendly error messages" {
  local token_file
  token_file=$(create_temp_file ".txf")

  # Test 1: Missing endpoint
  run_cli_with_secret "$TEST_SECRET" "mint-token --local --unct-mine 1 -i $TEST_TOKEN_ID -o $token_file"
  assert_failure
  assert_not_output_contains "undefined|null|TypeError" "Error should be user-friendly"

  # Test 2: Missing token ID
  run_cli_with_secret "$TEST_SECRET" "mint-token --local --unct-mine 1 --local-unct -o $token_file"
  assert_failure
  assert_not_output_contains "undefined|null|TypeError" "Error should be user-friendly"

  # Test 3: Invalid block height
  run_cli_with_secret "$TEST_SECRET" "mint-token --local --unct-mine invalid --local-unct -i $TEST_TOKEN_ID -o $token_file"
  assert_failure
  assert_not_output_contains "undefined|null|TypeError" "Error should be user-friendly"
}

# -----------------------------------------------------------------------------
# Summary Test
# -----------------------------------------------------------------------------

@test "UNCT Minting: Summary" {
  info "=== UNCT Coin Minting Test Suite ==="
  info "UNCT-001: Successful minting ✓"
  info "UNCT-002: Endpoint requirement ✓"
  info "UNCT-003: Invalid block height ✓"
  info "UNCT-004: Token ID requirement ✓"
  info "UNCT-005: POW node connection ✓"
  info "UNCT-006: Proof embedding ✓"
  info "UNCT-007: Coin amount verification ✓"
  info "UNCT-008: Token type auto-config ✓"
  info "Integration: Full workflow ✓"
  info "Error messages: Quality ✓"
  info "============================================"
}
