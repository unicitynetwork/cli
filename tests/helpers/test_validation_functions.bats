#!/usr/bin/env bats
# =============================================================================
# Test: Validation Helper Functions
# =============================================================================
# Tests the comprehensive Unicity validation helper functions added to
# assertions.bash for cryptographic validation, structure validation,
# and data integrity checks.
#
# Run: bats tests/helpers/test_validation_functions.bats
# =============================================================================

load '../helpers/common.bash'
load '../helpers/assertions.bash'
load '../helpers/token-helpers.bash'

setup() {
  setup_test
  export TEST_TOKEN_FILE=$(create_temp_file ".json")
  export TEST_OWNER_KEY=$(create_temp_file ".key")
}

teardown() {
  cleanup_test
}

# -----------------------------------------------------------------------------
# Structure Validation Tests
# -----------------------------------------------------------------------------

@test "assert_token_has_valid_structure validates token structure" {
  # Create a valid token
  run_cli mint-token nft --owner  --local"$TEST_OWNER_KEY" -o "$TEST_TOKEN_FILE"
  assert_success
  
  # Validate structure
  assert_token_has_valid_structure "$TEST_TOKEN_FILE"
}

@test "assert_token_has_valid_structure fails on invalid JSON" {
  # Create invalid JSON
  echo "{ invalid json" > "$TEST_TOKEN_FILE"
  
  # Should fail
  run assert_token_has_valid_structure "$TEST_TOKEN_FILE"
  assert_failure
}

@test "assert_token_has_valid_structure fails on missing fields" {
  # Create JSON missing required fields
  echo '{"version":"2.0"}' > "$TEST_TOKEN_FILE"
  
  # Should fail
  run assert_token_has_valid_structure "$TEST_TOKEN_FILE"
  assert_failure
}

# -----------------------------------------------------------------------------
# Genesis Validation Tests
# -----------------------------------------------------------------------------

@test "assert_token_has_valid_genesis validates genesis transaction" {
  # Create token with valid genesis
  run_cli mint-token nft --owner  --local"$TEST_OWNER_KEY" -o "$TEST_TOKEN_FILE"
  assert_success
  
  # Validate genesis
  assert_token_has_valid_genesis "$TEST_TOKEN_FILE"
}

@test "assert_token_has_valid_genesis fails on missing genesis" {
  # Create JSON without genesis
  echo '{"version":"2.0","token":{"tokenId":"123","typeId":"nft"},"state":{},"inclusionProof":{}}' > "$TEST_TOKEN_FILE"
  
  # Should fail
  run assert_token_has_valid_genesis "$TEST_TOKEN_FILE"
  assert_failure
}

# -----------------------------------------------------------------------------
# State Validation Tests
# -----------------------------------------------------------------------------

@test "assert_token_has_valid_state validates current state" {
  # Create token
  run_cli mint-token nft --owner  --local"$TEST_OWNER_KEY" -o "$TEST_TOKEN_FILE"
  assert_success
  
  # Validate state
  assert_token_has_valid_state "$TEST_TOKEN_FILE"
}

@test "assert_token_has_valid_state fails on missing state hash" {
  # Create token JSON without state hash
  cat > "$TEST_TOKEN_FILE" << 'EOJSON'
{
  "version":"2.0",
  "token":{"tokenId":"123","typeId":"nft"},
  "genesis":{"data":{"tokenType":"nft"}},
  "state":{"data":"test","predicate":"abc123"},
  "inclusionProof":{}
}
EOJSON
  
  # Should fail
  run assert_token_has_valid_state "$TEST_TOKEN_FILE"
  assert_failure
}

@test "assert_state_hash_correct validates hash format" {
  # Create token
  run_cli mint-token nft --owner  --local"$TEST_OWNER_KEY" -o "$TEST_TOKEN_FILE"
  assert_success
  
  # Validate state hash format
  assert_state_hash_correct "$TEST_TOKEN_FILE"
}

# -----------------------------------------------------------------------------
# Predicate Validation Tests
# -----------------------------------------------------------------------------

@test "assert_predicate_structure_valid validates hex format" {
  # Valid predicate hex (even length, reasonable size)
  local valid_predicate="83010203"  # Short but valid CBOR-like hex
  
  # Pad to minimum length
  valid_predicate="${valid_predicate}$(printf '00%.0s' {1..50})"
  
  # Should succeed
  assert_predicate_structure_valid "$valid_predicate"
}

@test "assert_predicate_structure_valid fails on odd length" {
  local invalid_predicate="abc"  # Odd length
  
  # Should fail
  run assert_predicate_structure_valid "$invalid_predicate"
  assert_failure
}

@test "assert_predicate_structure_valid fails on too short" {
  local invalid_predicate="ab"  # Too short
  
  # Should fail
  run assert_predicate_structure_valid "$invalid_predicate"
  assert_failure
}

@test "assert_predicate_structure_valid fails on non-hex" {
  local invalid_predicate="ghijklmnopqrstuvwxyz$(printf '00%.0s' {1..50})"
  
  # Should fail
  run assert_predicate_structure_valid "$invalid_predicate"
  assert_failure
}

@test "assert_token_predicate_valid extracts and validates predicate" {
  # Create token
  run_cli mint-token nft --owner  --local"$TEST_OWNER_KEY" -o "$TEST_TOKEN_FILE"
  assert_success
  
  # Validate token predicate
  assert_token_predicate_valid "$TEST_TOKEN_FILE"
}

# -----------------------------------------------------------------------------
# Inclusion Proof Validation Tests
# -----------------------------------------------------------------------------

@test "assert_inclusion_proof_valid checks proof structure" {
  # Create token with inclusion proof
  run_cli mint-token nft --owner  --local"$TEST_OWNER_KEY" -o "$TEST_TOKEN_FILE"
  assert_success
  
  # Validate inclusion proof structure
  assert_inclusion_proof_valid "$TEST_TOKEN_FILE"
}

# -----------------------------------------------------------------------------
# Helper Field Validation Tests
# -----------------------------------------------------------------------------

@test "assert_json_has_field validates field exists with value" {
  # Create JSON with field
  cat > "$TEST_TOKEN_FILE" << 'EOJSON'
{
  "field1": "value1",
  "field2": null,
  "field3": ""
}
EOJSON
  
  # Should succeed for field with value
  assert_json_has_field "$TEST_TOKEN_FILE" ".field1"
  
  # Should fail for null field
  run assert_json_has_field "$TEST_TOKEN_FILE" ".field2"
  assert_failure
  
  # Should fail for empty field
  run assert_json_has_field "$TEST_TOKEN_FILE" ".field3"
  assert_failure
  
  # Should fail for missing field
  run assert_json_has_field "$TEST_TOKEN_FILE" ".field4"
  assert_failure
}

# -----------------------------------------------------------------------------
# Comprehensive Validation Tests
# -----------------------------------------------------------------------------

@test "assert_token_fully_valid performs all checks" {
  # Note: This test requires actual token creation and verify-token command
  # Skip if aggregator not available or in offline mode
  
  if [[ "${UNICITY_TEST_SKIP_EXTERNAL:-0}" == "1" ]]; then
    skip "Requires external services"
  fi
  
  # Create token
  run_cli mint-token nft --owner  --local"$TEST_OWNER_KEY" -o "$TEST_TOKEN_FILE"
  
  if [[ $status -ne 0 ]]; then
    skip "Token creation failed - likely no aggregator"
  fi
  
  # Comprehensive validation
  assert_token_fully_valid "$TEST_TOKEN_FILE"
}

@test "assert_token_valid_quick performs fast validation" {
  # Note: Requires verify-token command
  
  if [[ "${UNICITY_TEST_SKIP_EXTERNAL:-0}" == "1" ]]; then
    skip "Requires external services"
  fi
  
  # Create token
  run_cli mint-token nft --owner  --local"$TEST_OWNER_KEY" -o "$TEST_TOKEN_FILE"
  
  if [[ $status -ne 0 ]]; then
    skip "Token creation failed"
  fi
  
  # Quick validation
  assert_token_valid_quick "$TEST_TOKEN_FILE"
}

# -----------------------------------------------------------------------------
# Cryptographic Validation Tests
# -----------------------------------------------------------------------------

@test "verify_token_cryptographically uses verify-token command" {
  # Note: This test requires verify-token command to work
  
  if [[ "${UNICITY_TEST_SKIP_EXTERNAL:-0}" == "1" ]]; then
    skip "Requires external services"
  fi
  
  # Create token
  run_cli mint-token nft --owner  --local"$TEST_OWNER_KEY" -o "$TEST_TOKEN_FILE"
  
  if [[ $status -ne 0 ]]; then
    skip "Token creation failed"
  fi
  
  # Cryptographic validation
  verify_token_cryptographically "$TEST_TOKEN_FILE"
}

# -----------------------------------------------------------------------------
# Chain Validation Tests
# -----------------------------------------------------------------------------

@test "assert_token_chain_valid handles single-state tokens" {
  # Create single-state token
  run_cli mint-token nft --owner  --local"$TEST_OWNER_KEY" -o "$TEST_TOKEN_FILE"
  assert_success
  
  # Chain validation should succeed (no chain)
  assert_token_chain_valid "$TEST_TOKEN_FILE"
}

@test "assert_token_chain_valid validates transaction history" {
  # Create token with transaction history
  cat > "$TEST_TOKEN_FILE" << 'EOJSON'
{
  "version":"2.0",
  "token":{"tokenId":"123","typeId":"nft"},
  "genesis":{"data":{"tokenType":"nft"}},
  "state":{"stateHash":"abc123","data":"test","predicate":"def456"},
  "inclusionProof":{},
  "transactionHistory":[
    {"tx":"genesis"},
    {"tx":"transfer"}
  ]
}
EOJSON
  
  # Should validate chain structure
  assert_token_chain_valid "$TEST_TOKEN_FILE"
}

# -----------------------------------------------------------------------------
# Offline Transfer Validation Tests
# -----------------------------------------------------------------------------

@test "assert_offline_transfer_valid checks offline transfer structure" {
  # Create token with offline transfer
  cat > "$TEST_TOKEN_FILE" << 'EOJSON'
{
  "version":"2.0",
  "token":{"tokenId":"123","typeId":"nft"},
  "genesis":{"data":{"tokenType":"nft"}},
  "state":{"stateHash":"abc123","data":"test","predicate":"def456"},
  "inclusionProof":{},
  "offlineTransfer":{
    "sender":"abc123",
    "recipient":"def456"
  }
}
EOJSON
  
  # Should validate offline transfer
  assert_offline_transfer_valid "$TEST_TOKEN_FILE"
}

@test "assert_offline_transfer_valid fails on missing fields" {
  # Create token without complete offline transfer
  cat > "$TEST_TOKEN_FILE" << 'EOJSON'
{
  "version":"2.0",
  "token":{"tokenId":"123","typeId":"nft"},
  "genesis":{"data":{"tokenType":"nft"}},
  "state":{"stateHash":"abc123","data":"test","predicate":"def456"},
  "inclusionProof":{},
  "offlineTransfer":{
    "sender":"abc123"
  }
}
EOJSON
  
  # Should fail
  run assert_offline_transfer_valid "$TEST_TOKEN_FILE"
  assert_failure
}

@test "assert_offline_transfer_valid fails on invalid recipient format" {
  # Create token with invalid recipient
  cat > "$TEST_TOKEN_FILE" << 'EOJSON'
{
  "version":"2.0",
  "token":{"tokenId":"123","typeId":"nft"},
  "genesis":{"data":{"tokenType":"nft"}},
  "state":{"stateHash":"abc123","data":"test","predicate":"def456"},
  "inclusionProof":{},
  "offlineTransfer":{
    "sender":"abc123",
    "recipient":"not-hex-format"
  }
}
EOJSON
  
  # Should fail
  run assert_offline_transfer_valid "$TEST_TOKEN_FILE"
  assert_failure
}

# -----------------------------------------------------------------------------
# BFT Signature Validation Tests
# -----------------------------------------------------------------------------

@test "assert_bft_signatures_valid handles tokens without BFT" {
  # Create token without BFT authenticator
  run_cli mint-token nft --owner  --local"$TEST_OWNER_KEY" -o "$TEST_TOKEN_FILE"
  assert_success
  
  # Should not fail (BFT is optional)
  assert_bft_signatures_valid "$TEST_TOKEN_FILE"
}

@test "assert_bft_signatures_valid validates BFT structure" {
  # Create token with BFT authenticator
  cat > "$TEST_TOKEN_FILE" << 'EOJSON'
{
  "version":"2.0",
  "token":{"tokenId":"123","typeId":"nft"},
  "genesis":{"data":{"tokenType":"nft"}},
  "state":{"stateHash":"abc123","data":"test","predicate":"def456"},
  "inclusionProof":{
    "bftAuthenticator":{
      "signatures":["sig1","sig2","sig3"]
    }
  }
}
EOJSON
  
  # Should validate BFT structure
  assert_bft_signatures_valid "$TEST_TOKEN_FILE"
}
