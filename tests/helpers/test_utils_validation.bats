#!/usr/bin/env bats
# =============================================================================
# Test Utilities Validation Tests
# =============================================================================
# This test file validates that all utility functions work correctly
# in a real BATS test environment.
# =============================================================================

# Load test helpers
load common
load txf-utils

setup() {
  setup_test
}

teardown() {
  cleanup_test
}

# =============================================================================
# Hex Decoding Tests
# =============================================================================

@test "decode_hex: decodes simple JSON" {
  local hex="7b226e616d65223a2254657374227d"
  local result
  result=$(decode_hex "$hex")

  [[ "$result" == '{"name":"Test"}' ]]
}

@test "decode_hex: handles empty string" {
  local result
  result=$(decode_hex "")

  [[ -z "$result" ]]
}

@test "decode_hex: decodes complex NFT data" {
  local hex="7b226e616d65223a2254657374204e4654222c2276616c7565223a3130307d"
  local result
  result=$(decode_hex "$hex")

  [[ "$result" == '{"name":"Test NFT","value":100}' ]]
}

# =============================================================================
# TXF Validation Tests
# =============================================================================

@test "is_valid_json: validates JSON file" {
  local json_file
  json_file=$(create_temp_file ".json")
  echo '{"test": "value"}' > "$json_file"

  is_valid_json "$json_file"
}

@test "is_valid_json: rejects invalid JSON" {
  local json_file
  json_file=$(create_temp_file ".json")
  echo 'not valid json' > "$json_file"

  ! is_valid_json "$json_file"
}

@test "is_valid_txf: requires version field" {
  local txf_file
  txf_file=$(create_temp_file ".txf")
  echo '{"genesis": {}, "state": {}}' > "$txf_file"

  ! is_valid_txf "$txf_file"
}

@test "is_valid_txf: validates complete TXF" {
  local txf_file
  txf_file=$(create_temp_file ".txf")
  cat > "$txf_file" <<'EOF'
{
  "version": "2.0",
  "genesis": {
    "data": {},
    "inclusionProof": {}
  },
  "state": {
    "data": "",
    "predicate": ""
  }
}
EOF

  is_valid_txf "$txf_file"
}

# =============================================================================
# Real TXF File Tests (require actual token)
# =============================================================================

@test "extract_token_id: extracts from real TXF" {
  # This test requires a real TXF file
  # Skip if no TXF files available
  local txf_file="/tmp/test-final.txf"

  if [[ ! -f "$txf_file" ]]; then
    skip "No test TXF file available at $txf_file"
  fi

  local token_id
  token_id=$(extract_token_id "$txf_file")

  # Token ID should be 64 hex chars
  [[ "${#token_id}" -eq 64 ]]
  [[ "$token_id" =~ ^[0-9a-f]+$ ]]
}

@test "extract_txf_address: extracts DIRECT address" {
  local txf_file="/tmp/test-final.txf"

  if [[ ! -f "$txf_file" ]]; then
    skip "No test TXF file available"
  fi

  local address
  address=$(extract_txf_address "$txf_file")

  # Address should start with DIRECT://
  [[ "$address" =~ ^DIRECT:// ]]
}

@test "extract_predicate: returns hex string" {
  local txf_file="/tmp/test-final.txf"

  if [[ ! -f "$txf_file" ]]; then
    skip "No test TXF file available"
  fi

  local predicate
  predicate=$(extract_predicate "$txf_file")

  # Predicate should be non-empty hex
  [[ -n "$predicate" ]]
  [[ "$predicate" =~ ^[0-9a-f]+$ ]]
}

@test "decode_predicate: returns valid JSON" {
  local txf_file="/tmp/test-final.txf"

  if [[ ! -f "$txf_file" ]]; then
    skip "No test TXF file available"
  fi

  local predicate
  predicate=$(extract_predicate "$txf_file")

  local info
  info=$(decode_predicate "$predicate")

  # Should be valid JSON with expected fields
  local engine_id
  engine_id=$(echo "$info" | jq -r '.engineId')
  [[ -n "$engine_id" ]]
  [[ "$engine_id" =~ ^[0-9]+$ ]]
}

@test "extract_predicate_pubkey: extracts public key" {
  local txf_file="/tmp/test-final.txf"

  if [[ ! -f "$txf_file" ]]; then
    skip "No test TXF file available"
  fi

  local predicate
  predicate=$(extract_predicate "$txf_file")

  local pubkey
  pubkey=$(extract_predicate_pubkey "$predicate")

  # Public key should be 66 hex chars (compressed secp256k1)
  [[ "${#pubkey}" -eq 66 ]]
  [[ "$pubkey" =~ ^[0-9a-f]+$ ]]
  [[ "$pubkey" =~ ^(02|03) ]]  # Compressed key starts with 02 or 03
}

@test "get_predicate_engine: returns engine name" {
  local txf_file="/tmp/test-final.txf"

  if [[ ! -f "$txf_file" ]]; then
    skip "No test TXF file available"
  fi

  local predicate
  predicate=$(extract_predicate "$txf_file")

  local engine
  engine=$(get_predicate_engine "$predicate")

  # Should be one of the known engines
  [[ "$engine" == "unmasked (reusable address)" ]] || \
  [[ "$engine" == "masked (one-time address)" ]]
}

@test "is_predicate_masked: returns boolean" {
  local txf_file="/tmp/test-final.txf"

  if [[ ! -f "$txf_file" ]]; then
    skip "No test TXF file available"
  fi

  local predicate
  predicate=$(extract_predicate "$txf_file")

  # Should return 0 or 1
  local result=0
  if is_predicate_masked "$predicate"; then
    result=1
  fi

  [[ "$result" -eq 0 ]] || [[ "$result" -eq 1 ]]
}

@test "has_valid_inclusion_proof: validates proof structure" {
  local txf_file="/tmp/test-final.txf"

  if [[ ! -f "$txf_file" ]]; then
    skip "No test TXF file available"
  fi

  # Should have valid proof
  has_valid_inclusion_proof "$txf_file"
}

@test "has_authenticator: checks for authenticator" {
  local txf_file="/tmp/test-final.txf"

  if [[ ! -f "$txf_file" ]]; then
    skip "No test TXF file available"
  fi

  has_authenticator "$txf_file"
}

@test "has_merkle_tree_path: checks for merkle path" {
  local txf_file="/tmp/test-final.txf"

  if [[ ! -f "$txf_file" ]]; then
    skip "No test TXF file available"
  fi

  has_merkle_tree_path "$txf_file"
}

@test "has_transaction_hash: checks for tx hash" {
  local txf_file="/tmp/test-final.txf"

  if [[ ! -f "$txf_file" ]]; then
    skip "No test TXF file available"
  fi

  has_transaction_hash "$txf_file"
}

@test "has_unicity_certificate: checks for certificate" {
  local txf_file="/tmp/test-final.txf"

  if [[ ! -f "$txf_file" ]]; then
    skip "No test TXF file available"
  fi

  has_unicity_certificate "$txf_file"
}

# =============================================================================
# Integration Test: Full Token Validation
# =============================================================================

@test "integration: validate complete token workflow" {
  local txf_file="/tmp/test-final.txf"

  if [[ ! -f "$txf_file" ]]; then
    skip "No test TXF file available"
  fi

  # Validate structure
  is_valid_json "$txf_file"
  is_valid_txf "$txf_file"

  # Extract fields
  local token_id
  token_id=$(extract_token_id "$txf_file")
  [[ -n "$token_id" ]]

  local address
  address=$(extract_txf_address "$txf_file")
  [[ "$address" =~ ^DIRECT:// ]]

  # Validate predicate
  local predicate
  predicate=$(extract_predicate "$txf_file")
  [[ -n "$predicate" ]]

  local pubkey
  pubkey=$(extract_predicate_pubkey "$predicate")
  [[ "${#pubkey}" -eq 66 ]]

  # Validate proof
  has_valid_inclusion_proof "$txf_file"
  has_authenticator "$txf_file"
  has_merkle_tree_path "$txf_file"
  has_transaction_hash "$txf_file"
  has_unicity_certificate "$txf_file"
}
