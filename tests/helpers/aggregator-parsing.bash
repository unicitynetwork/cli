#!/usr/bin/env bash
# =============================================================================
# Aggregator Output Parsing Helpers
# =============================================================================
# This module provides specialized parsing functions for extracting data from
# register-request and get-request command outputs. These commands have
# different output formats that require careful parsing.
#
# Command Output Formats:
# - register-request: Console text output (NOT JSON)
# - get-request: JSON output (with --json flag) or console text
#
# Usage:
#   source tests/helpers/aggregator-parsing.bash
#   request_id=$(extract_request_id_from_console "$output")
#   status=$(extract_status_from_json "$output")
# =============================================================================

# Strict error handling
set -euo pipefail

# -----------------------------------------------------------------------------
# register-request Console Output Parsing
# -----------------------------------------------------------------------------
# The register-request command outputs structured console text, not JSON.
# We need line-by-line parsing with regex to extract values.
# -----------------------------------------------------------------------------

# Extract Request ID from register-request console output
# Args:
#   $1: Console output from register-request
# Returns: Request ID as 64-character hex string
# Example:
#   request_id=$(extract_request_id_from_console "$output")
extract_request_id_from_console() {
  local output="${1:?Output required}"

  # Look for "Request ID: <hex>" line
  # Example: "Request ID: 9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b"
  local request_id
  request_id=$(echo "$output" | grep -oP 'Request ID: \K[0-9a-fA-F]{64}' | head -1)

  if [[ -z "$request_id" ]]; then
    # Fallback: Try less strict pattern
    request_id=$(echo "$output" | grep "Request ID:" | sed -E 's/.*Request ID: ([0-9a-fA-F]+).*/\1/' | head -1)
  fi

  printf "%s" "$request_id"
}

# Extract State Hash from register-request console output
# Args:
#   $1: Console output from register-request
# Returns: State hash as hex string
# Example:
#   state_hash=$(extract_state_hash_from_console "$output")
extract_state_hash_from_console() {
  local output="${1:?Output required}"

  # Look for "State Hash: <hex>" line
  local state_hash
  state_hash=$(echo "$output" | grep -oP 'State Hash: \K[0-9a-fA-F]{64}' | head -1)

  if [[ -z "$state_hash" ]]; then
    # Fallback: Try less strict pattern
    state_hash=$(echo "$output" | grep "State Hash:" | sed -E 's/.*State Hash: ([0-9a-fA-F]+).*/\1/' | head -1)
  fi

  printf "%s" "$state_hash"
}

# Extract Transaction Hash from register-request console output
# Args:
#   $1: Console output from register-request
# Returns: Transaction hash as hex string
# Example:
#   tx_hash=$(extract_transaction_hash_from_console "$output")
extract_transaction_hash_from_console() {
  local output="${1:?Output required}"

  # Look for "Transaction Hash: <hex>" line
  local tx_hash
  tx_hash=$(echo "$output" | grep -oP 'Transaction Hash: \K[0-9a-fA-F]{64}' | head -1)

  if [[ -z "$tx_hash" ]]; then
    # Fallback: Try less strict pattern
    tx_hash=$(echo "$output" | grep "Transaction Hash:" | sed -E 's/.*Transaction Hash: ([0-9a-fA-F]+).*/\1/' | head -1)
  fi

  printf "%s" "$tx_hash"
}

# Extract Public Key from register-request console output
# Args:
#   $1: Console output from register-request
# Returns: Public key as hex string
# Example:
#   pubkey=$(extract_public_key_from_console "$output")
extract_public_key_from_console() {
  local output="${1:?Output required}"

  # Look for "Public Key: <hex>" line (appears multiple times, get first)
  local pubkey
  pubkey=$(echo "$output" | grep -oP 'Public Key: \K[0-9a-fA-F]+' | head -1)

  if [[ -z "$pubkey" ]]; then
    # Fallback: Try less strict pattern
    pubkey=$(echo "$output" | grep "Public Key:" | head -1 | sed -E 's/.*Public Key: ([0-9a-fA-F]+).*/\1/')
  fi

  printf "%s" "$pubkey"
}

# Extract Signature from register-request console output
# Args:
#   $1: Console output from register-request
# Returns: Signature as hex string
# Example:
#   signature=$(extract_signature_from_console "$output")
extract_signature_from_console() {
  local output="${1:?Output required}"

  # Look for "Signature: <hex>" line in authenticator section
  local signature
  signature=$(echo "$output" | grep -oP 'Signature: \K[0-9a-fA-F]+' | head -1)

  if [[ -z "$signature" ]]; then
    # Fallback
    signature=$(echo "$output" | grep "Signature:" | head -1 | sed -E 's/.*Signature: ([0-9a-fA-F]+).*/\1/')
  fi

  printf "%s" "$signature"
}

# Extract Aggregator Endpoint from register-request console output
# Args:
#   $1: Console output from register-request
# Returns: Endpoint URL
# Example:
#   endpoint=$(extract_endpoint_from_console "$output")
extract_endpoint_from_console() {
  local output="${1:?Output required}"

  # Look for "Submitting to aggregator: <url>" line
  local endpoint
  endpoint=$(echo "$output" | grep "Submitting to aggregator:" | sed -E 's/.*Submitting to aggregator: (.*)/\1/')

  printf "%s" "$endpoint"
}

# Check if register-request succeeded
# Args:
#   $1: Console output from register-request
# Returns: 0 if success, 1 if failure
# Example:
#   if check_registration_success "$output"; then
#     echo "Success"
#   fi
check_registration_success() {
  local output="${1:?Output required}"

  # Look for success indicator
  if echo "$output" | grep -q "✅ Commitment successfully registered"; then
    return 0
  fi

  return 1
}

# Check if authenticator verification passed
# Args:
#   $1: Console output from register-request
# Returns: 0 if verified, 1 if not
# Example:
#   if check_authenticator_verified "$output"; then
#     echo "Authenticator valid"
#   fi
check_authenticator_verified() {
  local output="${1:?Output required}"

  # Look for verification indicator
  if echo "$output" | grep -q "✓ Local authenticator is VALID before submission"; then
    return 0
  fi

  return 1
}

# Check if register-request failed
# Args:
#   $1: Console output from register-request
# Returns: 0 if failed, 1 if success
# Example:
#   if check_registration_failed "$output"; then
#     echo "Registration failed"
#   fi
check_registration_failed() {
  local output="${1:?Output required}"

  # Look for failure indicators
  if echo "$output" | grep -qE "(❌|Failed to register|ERROR:)"; then
    return 0
  fi

  return 1
}

# Extract all hashes from register-request output
# Args:
#   $1: Console output from register-request
# Returns: Sets global variables REQUEST_ID, STATE_HASH, TX_HASH, PUBLIC_KEY
# Example:
#   extract_all_hashes_from_console "$output"
#   echo "Request ID: $REQUEST_ID"
extract_all_hashes_from_console() {
  local output="${1:?Output required}"

  export REQUEST_ID=$(extract_request_id_from_console "$output")
  export STATE_HASH=$(extract_state_hash_from_console "$output")
  export TX_HASH=$(extract_transaction_hash_from_console "$output")
  export PUBLIC_KEY=$(extract_public_key_from_console "$output")
}

# -----------------------------------------------------------------------------
# get-request JSON Output Parsing
# -----------------------------------------------------------------------------
# When called with --json flag, get-request outputs structured JSON
# -----------------------------------------------------------------------------

# Extract status from get-request JSON output
# Args:
#   $1: JSON output from get-request --json
# Returns: Status string (INCLUSION, EXCLUSION, NOT_FOUND)
# Example:
#   status=$(extract_status_from_json "$output")
extract_status_from_json() {
  local json="${1:?JSON output required}"

  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -r '.status // "UNKNOWN"'
  else
    # Fallback: grep
    echo "$json" | grep -oP '"status":\s*"\K[^"]+' | head -1
  fi
}

# Extract request ID from get-request JSON output
# Args:
#   $1: JSON output from get-request --json
# Returns: Request ID hex string
# Example:
#   request_id=$(extract_request_id_from_json "$output")
extract_request_id_from_json() {
  local json="${1:?JSON output required}"

  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -r '.requestId // .proof.requestId // empty'
  else
    echo "$json" | grep -oP '"requestId":\s*"\K[0-9a-fA-F]+' | head -1
  fi
}

# Extract endpoint from get-request JSON output
# Args:
#   $1: JSON output from get-request --json
# Returns: Endpoint URL
# Example:
#   endpoint=$(extract_endpoint_from_json "$output")
extract_endpoint_from_json() {
  local json="${1:?JSON output required}"

  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -r '.endpoint // empty'
  else
    echo "$json" | grep -oP '"endpoint":\s*"\K[^"]+' | head -1
  fi
}

# Check if proof exists in get-request JSON output
# Args:
#   $1: JSON output from get-request --json
# Returns: 0 if proof exists, 1 if null or missing
# Example:
#   if has_proof_in_json "$output"; then
#     echo "Proof found"
#   fi
has_proof_in_json() {
  local json="${1:?JSON output required}"

  if command -v jq >/dev/null 2>&1; then
    if echo "$json" | jq -e '.proof != null' >/dev/null 2>&1; then
      return 0
    fi
  else
    if echo "$json" | grep -q '"proof":\s*{'; then
      return 0
    fi
  fi

  return 1
}

# Extract authenticator from get-request JSON output
# Args:
#   $1: JSON output from get-request --json
# Returns: Authenticator JSON object as string
# Example:
#   authenticator=$(extract_authenticator_from_json "$output")
extract_authenticator_from_json() {
  local json="${1:?JSON output required}"

  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -c '.proof.authenticator // null'
  else
    echo "null"
  fi
}

# Extract Merkle tree path from get-request JSON output
# Args:
#   $1: JSON output from get-request --json
# Returns: Merkle path JSON object as string
# Example:
#   merkle_path=$(extract_merkle_path_from_json "$output")
extract_merkle_path_from_json() {
  local json="${1:?JSON output required}"

  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -c '.proof.merkleTreePath // null'
  else
    echo "null"
  fi
}

# Extract Unicity Certificate from get-request JSON output
# Args:
#   $1: JSON output from get-request --json
# Returns: Certificate JSON object as string
# Example:
#   certificate=$(extract_certificate_from_json "$output")
extract_certificate_from_json() {
  local json="${1:?JSON output required}"

  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -c '.proof.unicityCertificate // null'
  else
    echo "null"
  fi
}

# Validate inclusion proof structure in JSON
# Args:
#   $1: JSON output from get-request --json
# Returns: 0 if valid structure, 1 if invalid
# Example:
#   if validate_inclusion_proof_json "$output"; then
#     echo "Valid proof"
#   fi
validate_inclusion_proof_json() {
  local json="${1:?JSON output required}"

  if ! command -v jq >/dev/null 2>&1; then
    printf "ERROR: jq not found, cannot validate JSON\n" >&2
    return 1
  fi

  # Check required fields exist
  local checks=(
    '.proof.requestId'
    '.proof.authenticator'
    '.proof.merkleTreePath'
    '.proof.unicityCertificate'
  )

  for check in "${checks[@]}"; do
    if ! echo "$json" | jq -e "$check" >/dev/null 2>&1; then
      if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
        printf "Proof validation failed: Missing %s\n" "$check" >&2
      fi
      return 1
    fi
  done

  return 0
}

# Extract transaction hash from proof in JSON
# Args:
#   $1: JSON output from get-request --json
# Returns: Transaction hash hex string
# Example:
#   tx_hash=$(extract_proof_tx_hash_from_json "$output")
extract_proof_tx_hash_from_json() {
  local json="${1:?JSON output required}"

  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -r '.proof.transactionHash // empty'
  else
    echo ""
  fi
}

# Extract state hash from proof in JSON
# Args:
#   $1: JSON output from get-request --json
# Returns: State hash hex string
# Example:
#   state_hash=$(extract_proof_state_hash_from_json "$output")
extract_proof_state_hash_from_json() {
  local json="${1:?JSON output required}"

  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -r '.proof.stateHash // .proof.authenticator.stateHash // empty'
  else
    echo ""
  fi
}

# -----------------------------------------------------------------------------
# get-request Human-Readable Output Parsing
# -----------------------------------------------------------------------------
# When called without --json, get-request outputs formatted text
# -----------------------------------------------------------------------------

# Extract status from get-request text output
# Args:
#   $1: Text output from get-request (without --json)
# Returns: Status string (INCLUSION, EXCLUSION, NOT_FOUND, UNKNOWN)
# Example:
#   status=$(extract_status_from_text "$output")
extract_status_from_text() {
  local output="${1:?Output required}"

  if echo "$output" | grep -q "STATUS: INCLUSION PROOF"; then
    echo "INCLUSION"
  elif echo "$output" | grep -q "STATUS: EXCLUSION PROOF"; then
    echo "EXCLUSION"
  elif echo "$output" | grep -q "STATUS: NOT_FOUND"; then
    echo "NOT_FOUND"
  else
    echo "UNKNOWN"
  fi
}

# Check if verification passed in text output
# Args:
#   $1: Text output from get-request
# Returns: 0 if all checks passed, 1 if any failed
# Example:
#   if check_verification_passed_text "$output"; then
#     echo "Verification passed"
#   fi
check_verification_passed_text() {
  local output="${1:?Output required}"

  if echo "$output" | grep -q "✅ ALL CHECKS PASSED"; then
    return 0
  fi

  return 1
}

# Check if verification failed in text output
# Args:
#   $1: Text output from get-request
# Returns: 0 if checks failed, 1 if passed
# Example:
#   if check_verification_failed_text "$output"; then
#     echo "Verification failed"
#   fi
check_verification_failed_text() {
  local output="${1:?Output required}"

  if echo "$output" | grep -q "⚠️ SOME CHECKS FAILED"; then
    return 0
  fi

  return 1
}

# Extract Merkle path step count from text output
# Args:
#   $1: Text output from get-request
# Returns: Number of Merkle path steps
# Example:
#   steps=$(extract_merkle_steps_from_text "$output")
extract_merkle_steps_from_text() {
  local output="${1:?Output required}"

  # Look for "Path Steps: N"
  local steps
  steps=$(echo "$output" | grep "Path Steps:" | sed -E 's/.*Path Steps: ([0-9]+).*/\1/')

  printf "%s" "$steps"
}

# Extract round number from text output
# Args:
#   $1: Text output from get-request
# Returns: Round number
# Example:
#   round=$(extract_round_number_from_text "$output")
extract_round_number_from_text() {
  local output="${1:?Output required}"

  # Look for "Round Number: N"
  local round
  round=$(echo "$output" | grep "Round Number:" | sed -E 's/.*Round Number: ([0-9]+).*/\1/' | head -1)

  printf "%s" "$round"
}

# -----------------------------------------------------------------------------
# Hash Validation Helpers
# -----------------------------------------------------------------------------

# Compute SHA256 hash of a string (for verification)
# Args:
#   $1: Input string
# Returns: SHA256 hash as hex string
# Example:
#   hash=$(compute_sha256 "test-state-data")
compute_sha256() {
  local input="${1:?Input required}"

  if command -v sha256sum >/dev/null 2>&1; then
    echo -n "$input" | sha256sum | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    echo -n "$input" | shasum -a 256 | cut -d' ' -f1
  else
    printf "ERROR: No SHA256 utility found\n" >&2
    return 1
  fi
}

# Verify state hash matches computed hash
# Args:
#   $1: Expected state hash
#   $2: State data string
# Returns: 0 if match, 1 if mismatch
# Example:
#   if verify_state_hash "$state_hash" "$state_data"; then
#     echo "Hash valid"
#   fi
verify_state_hash() {
  local expected_hash="${1:?Expected hash required}"
  local state_data="${2:?State data required}"

  local computed_hash
  computed_hash=$(compute_sha256 "$state_data")

  if [[ "$expected_hash" == "$computed_hash" ]]; then
    if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
      printf "✓ State hash verified\n" >&2
    fi
    return 0
  else
    if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
      printf "✗ State hash mismatch\n" >&2
      printf "  Expected: %s\n" "$expected_hash" >&2
      printf "  Computed: %s\n" "$computed_hash" >&2
    fi
    return 1
  fi
}

# Verify transaction hash matches computed hash
# Args:
#   $1: Expected transaction hash
#   $2: Transaction data string
# Returns: 0 if match, 1 if mismatch
# Example:
#   if verify_transaction_hash "$tx_hash" "$tx_data"; then
#     echo "Hash valid"
#   fi
verify_transaction_hash() {
  local expected_hash="${1:?Expected hash required}"
  local tx_data="${2:?Transaction data required}"

  local computed_hash
  computed_hash=$(compute_sha256 "$tx_data")

  if [[ "$expected_hash" == "$computed_hash" ]]; then
    if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
      printf "✓ Transaction hash verified\n" >&2
    fi
    return 0
  else
    if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
      printf "✗ Transaction hash mismatch\n" >&2
      printf "  Expected: %s\n" "$expected_hash" >&2
      printf "  Computed: %s\n" "$computed_hash" >&2
    fi
    return 1
  fi
}

# -----------------------------------------------------------------------------
# Aggregator-Specific Assertions
# -----------------------------------------------------------------------------

# Assert request ID has correct format (64-char hex)
# Args:
#   $1: Request ID to validate
# Returns: 0 if valid, 1 if invalid
# Example:
#   assert_valid_request_id "$request_id"
assert_valid_request_id() {
  local request_id="${1:?Request ID required}"

  # Check length
  if [[ ${#request_id} -ne 64 ]]; then
    printf "${COLOR_RED}✗ Invalid request ID length: %d (expected 64)${COLOR_RESET}\n" "${#request_id}" >&2
    return 1
  fi

  # Check hex format
  if [[ ! "$request_id" =~ ^[0-9a-fA-F]{64}$ ]]; then
    printf "${COLOR_RED}✗ Invalid request ID format (not hex)${COLOR_RESET}\n" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Valid request ID format${COLOR_RESET}\n" >&2
  fi

  return 0
}

# Assert inclusion proof is present in JSON response
# Args:
#   $1: JSON output from get-request --json
# Returns: 0 if proof present, 1 if missing
# Example:
#   assert_inclusion_proof_present "$output"
assert_inclusion_proof_present() {
  local json="${1:?JSON output required}"

  if has_proof_in_json "$json"; then
    local status
    status=$(extract_status_from_json "$json")

    if [[ "$status" == "INCLUSION" ]]; then
      if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
        printf "${COLOR_GREEN}✓ Inclusion proof present${COLOR_RESET}\n" >&2
      fi
      return 0
    fi
  fi

  printf "${COLOR_RED}✗ Inclusion proof not found${COLOR_RESET}\n" >&2
  return 1
}

# Assert authenticator is present in proof
# Args:
#   $1: JSON output from get-request --json
# Returns: 0 if authenticator present, 1 if missing
# Example:
#   assert_authenticator_present "$output"
assert_authenticator_present() {
  local json="${1:?JSON output required}"

  local authenticator
  authenticator=$(extract_authenticator_from_json "$json")

  if [[ "$authenticator" != "null" ]] && [[ -n "$authenticator" ]]; then
    if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
      printf "${COLOR_GREEN}✓ Authenticator present${COLOR_RESET}\n" >&2
    fi
    return 0
  fi

  printf "${COLOR_RED}✗ Authenticator not found in proof${COLOR_RESET}\n" >&2
  return 1
}

# -----------------------------------------------------------------------------
# Export Functions
# -----------------------------------------------------------------------------

export -f extract_request_id_from_console
export -f extract_state_hash_from_console
export -f extract_transaction_hash_from_console
export -f extract_public_key_from_console
export -f extract_signature_from_console
export -f extract_endpoint_from_console
export -f check_registration_success
export -f check_authenticator_verified
export -f check_registration_failed
export -f extract_all_hashes_from_console

export -f extract_status_from_json
export -f extract_request_id_from_json
export -f extract_endpoint_from_json
export -f has_proof_in_json
export -f extract_authenticator_from_json
export -f extract_merkle_path_from_json
export -f extract_certificate_from_json
export -f validate_inclusion_proof_json
export -f extract_proof_tx_hash_from_json
export -f extract_proof_state_hash_from_json

export -f extract_status_from_text
export -f check_verification_passed_text
export -f check_verification_failed_text
export -f extract_merkle_steps_from_text
export -f extract_round_number_from_text

export -f compute_sha256
export -f verify_state_hash
export -f verify_transaction_hash

export -f assert_valid_request_id
export -f assert_inclusion_proof_present
export -f assert_authenticator_present
