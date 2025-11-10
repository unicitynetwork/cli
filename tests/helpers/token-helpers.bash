#!/usr/bin/env bash
# =============================================================================
# Token Operation Helpers for Unicity CLI Tests
# =============================================================================
# This module provides high-level wrappers for token operations (mint, send,
# receive) with proper error handling, validation, and artifact preservation.
#
# Usage:
#   source tests/helpers/token-helpers.bash
#   mint_token "my-secret" 100 "output.json"
#   send_token "input.json" "recipient-address" "output.json"
# =============================================================================

# Strict error handling
set -euo pipefail

# Source common helpers
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=./common.bash
source "${SCRIPT_DIR}/common.bash"

# -----------------------------------------------------------------------------
# Preset Token Types (from unicity-ids)
# -----------------------------------------------------------------------------

export TOKEN_TYPE_NFT="f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509"
export TOKEN_TYPE_UCT="455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89"
export TOKEN_TYPE_ALPHA="455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89"
export TOKEN_TYPE_USDU="8f0f3d7a5e7297be0ee98c63b81bcebb2740f43f616566fc290f9823a54f52d7"
export TOKEN_TYPE_EURU="5e160d5e9fdbb03b553fb9c3f6e6c30efa41fa807be39fb4f18e43776e492925"

# -----------------------------------------------------------------------------
# Address Generation
# -----------------------------------------------------------------------------

# Generate address from secret
# Args:
#   $1: Secret
#   $2: Preset (optional, default: uct)
#   $3: Nonce (optional)
#   $4: Output file (optional)
# Returns: Address string on stdout, 0 on success, 1 on failure
# Outputs: Prints the generated address to stdout
generate_address() {
  local secret="${1:?Secret required}"
  local preset="${2:-uct}"
  local nonce="${3:-}"
  local output_file="${4:-}"

  # Build command
  local -a cmd=(gen-address --preset "$preset" --unsafe-secret)
  if [[ -n "$nonce" ]]; then
    cmd+=(--nonce "$nonce")
  fi

  # Execute command
  local exit_code=0
  local cmd_output
  cmd_output=$(SECRET="$secret" "${UNICITY_NODE_BIN:-node}" "$(get_cli_path)" "${cmd[@]}" 2>&1) || exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    error "Failed to generate address (exit code: $exit_code)"
    error "Output: $cmd_output"
    return "$exit_code"
  fi

  # Extract address from output (looks for DIRECT:// pattern)
  local address
  address=$(printf "%s" "$cmd_output" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

  if [[ -z "$address" ]]; then
    error "Could not extract address from output: $cmd_output"
    return 1
  fi

  # Save to file if requested
  if [[ -n "$output_file" ]]; then
    printf '{"address":"%s"}\n' "$address" > "$output_file"
  fi

  # Print address to stdout
  printf "%s" "$address"

  debug "Generated address: $address"
  return 0
}

# -----------------------------------------------------------------------------
# Token Minting
# -----------------------------------------------------------------------------

# Mint token to address
# Args:
#   $1: Minter secret
#   $2: Preset (nft, uct, alpha, usdu, euru)
#   $3: Output file path (optional)
#   $4: Data (optional JSON string)
# Returns: 0 on success, 1 on failure
# Outputs: Sets $MINT_OUTPUT_FILE with path to minted token file
mint_token() {
  local secret="${1:?Minter secret required}"
  local preset="${2:-nft}"
  local output_file="${3:-}"
  local data="${4:-}"

  # Create output file if not provided
  if [[ -z "$output_file" ]]; then
    output_file=$(create_temp_file ".txf")
  fi

  # Build command
  local -a cmd=(mint-token --preset "$preset" --output "$output_file" --unsafe-secret)

  if [[ -n "$data" ]]; then
    cmd+=(--token-data "$data")
  fi

  cmd+=(--endpoint "${UNICITY_AGGREGATOR_URL}")

  debug "Minting token: preset=$preset, output=$output_file"

  # Execute command
  local exit_code=0
  if ! SECRET="$secret" run_cli "${cmd[@]}"; then
    exit_code=$?
    error "Failed to mint token (exit code: $exit_code)"
    return "$exit_code"
  fi

  # Verify output file was created
  if [[ ! -f "$output_file" ]]; then
    error "Mint succeeded but output file not created: $output_file"
    return 1
  fi

  # Verify output file contains valid JSON
  if ! jq empty "$output_file" 2>/dev/null; then
    error "Mint output file contains invalid JSON: $output_file"
    return 1
  fi

  # Export output file path
  export MINT_OUTPUT_FILE="$output_file"

  # Save as artifact
  if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
    local token_id
    token_id=$(get_token_id "$output_file")
    local artifact_name="mint-token-${token_id}.txf"
    cp "$output_file" "$(create_artifact_file "$artifact_name")"
    info "Minted token saved to artifact: $artifact_name"
  fi

  info "Successfully minted token to: $output_file"
  return 0
}

# Alias for mint_token with different parameter order (used in tests)
# Args:
#   $1: Minter secret
#   $2: Preset (nft, uct, alpha, usdu, euru)
#   $3: Data (optional JSON string)
#   $4: Output file path
#   $5: Additional mint-token arguments (optional, e.g., "-c 1000000")
# Returns: 0 on success, 1 on failure
mint_token_to_address() {
  local secret="${1:?Minter secret required}"
  local preset="${2:-nft}"
  local data="${3:-}"
  local output_file="${4:?Output file required}"
  local extra_args="${5:-}"

  # Create output file directory if needed
  local output_dir
  output_dir=$(dirname "$output_file")
  mkdir -p "$output_dir"

  # Build command
  local -a cmd=(mint-token --preset "$preset" --output "$output_file" --unsafe-secret)

  if [[ -n "$data" ]]; then
    cmd+=(--token-data "$data")
  fi

  # Add extra arguments (like -c for coins)
  if [[ -n "$extra_args" ]]; then
    # shellcheck disable=SC2206
    cmd+=($extra_args)
  fi

  cmd+=(--endpoint "${UNICITY_AGGREGATOR_URL}")

  debug "Minting token to address: preset=$preset, output=$output_file"

  # Execute command
  local exit_code=0
  if ! SECRET="$secret" run_cli "${cmd[@]}"; then
    exit_code=$?
    error "Failed to mint token (exit code: $exit_code)"
    return "$exit_code"
  fi

  # Verify output file was created
  if [[ ! -f "$output_file" ]]; then
    error "Mint succeeded but output file not created: $output_file"
    return 1
  fi

  # Verify output file contains valid JSON
  if ! jq empty "$output_file" 2>/dev/null; then
    error "Mint output file contains invalid JSON: $output_file"
    return 1
  fi

  debug "Successfully minted token to: $output_file"
  return 0
}

# -----------------------------------------------------------------------------
# Token Sending
# -----------------------------------------------------------------------------

# Send token offline (Pattern A - creates transfer file)
# Args:
#   $1: Sender secret
#   $2: Input token file path
#   $3: Recipient address
#   $4: Output file path (optional)
#   $5: Message (optional)
# Returns: 0 on success, 1 on failure
# Outputs: Sets $SEND_OUTPUT_FILE with path to transfer file
send_token_offline() {
  local secret="${1:?Sender secret required}"
  local input_file="${2:?Input token file required}"
  local recipient="${3:?Recipient address required}"
  local output_file="${4:-}"
  local message="${5:-}"

  # Validate input file
  if [[ ! -f "$input_file" ]]; then
    error "Input token file not found: $input_file"
    return 1
  fi

  # Create output file if not provided
  if [[ -z "$output_file" ]]; then
    output_file=$(create_temp_file ".txf")
  fi

  # Build command
  local -a cmd=(send-token --file "$input_file" --recipient "$recipient" --output "$output_file" --unsafe-secret)

  if [[ -n "$message" ]]; then
    cmd+=(--message "$message")
  fi

  debug "Sending token offline: input=$input_file, recipient=$recipient"

  # Execute command
  local exit_code=0
  if ! SECRET="$secret" run_cli "${cmd[@]}"; then
    exit_code=$?
    error "Failed to send token offline (exit code: $exit_code)"
    return "$exit_code"
  fi

  # Verify output file was created
  if [[ ! -f "$output_file" ]]; then
    error "Send succeeded but output file not created: $output_file"
    return 1
  fi

  # Export output file path
  export SEND_OUTPUT_FILE="$output_file"

  # Save as artifact
  if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
    local transfer_id
    transfer_id=$(generate_request_id)
    local artifact_name="send-token-offline-${transfer_id}.txf"
    cp "$output_file" "$(create_artifact_file "$artifact_name")"
    info "Sent token (offline) saved to artifact: $artifact_name"
  fi

  info "Successfully sent token offline to: $output_file"
  return 0
}

# Send token immediately (Pattern B - submits to aggregator)
# Args:
#   $1: Sender secret
#   $2: Input token file path
#   $3: Recipient address
#   $4: Output file path (optional)
# Returns: 0 on success, 1 on failure
# Outputs: Sets $SEND_OUTPUT_FILE with path to updated token file
send_token_immediate() {
  local secret="${1:?Sender secret required}"
  local input_file="${2:?Input token file required}"
  local recipient="${3:?Recipient address required}"
  local output_file="${4:-}"

  # Validate input file
  if [[ ! -f "$input_file" ]]; then
    error "Input token file not found: $input_file"
    return 1
  fi

  # Create output file if not provided
  if [[ -z "$output_file" ]]; then
    output_file=$(create_temp_file ".txf")
  fi

  # Build command
  local -a cmd=(
    send-token
    --file "$input_file"
    --recipient "$recipient"
    --submit-now
    --output "$output_file"
    --endpoint "${UNICITY_AGGREGATOR_URL}"
    --unsafe-secret
  )

  debug "Sending token immediately: input=$input_file, recipient=$recipient"

  # Execute command
  local exit_code=0
  if ! SECRET="$secret" run_cli "${cmd[@]}"; then
    exit_code=$?
    error "Failed to send token immediately (exit code: $exit_code)"
    return "$exit_code"
  fi

  # Verify output file was created
  if [[ ! -f "$output_file" ]]; then
    error "Send succeeded but output file not created: $output_file"
    return 1
  fi

  # Export output file path
  export SEND_OUTPUT_FILE="$output_file"

  # Save as artifact
  if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
    local transfer_id
    transfer_id=$(generate_request_id)
    local artifact_name="send-token-immediate-${transfer_id}.txf"
    cp "$output_file" "$(create_artifact_file "$artifact_name")"
    info "Sent token (immediate) saved to artifact: $artifact_name"
  fi

  info "Successfully sent token immediately to: $output_file"
  return 0
}

# -----------------------------------------------------------------------------
# Token Receiving
# -----------------------------------------------------------------------------

# Receive token from transfer file
# Args:
#   $1: Receiver secret
#   $2: Input transfer file path
#   $3: Output file path (optional)
# Returns: 0 on success, 1 on failure
# Outputs: Sets $RECEIVE_OUTPUT_FILE with path to received token file
receive_token() {
  local secret="${1:?Receiver secret required}"
  local input_file="${2:?Input transfer file required}"
  local output_file="${3:-}"

  # Validate input file
  if [[ ! -f "$input_file" ]]; then
    error "Input transfer file not found: $input_file"
    return 1
  fi

  # Create output file if not provided
  if [[ -z "$output_file" ]]; then
    output_file=$(create_temp_file ".txf")
  fi

  # Build command
  local -a cmd=(
    receive-token
    --file "$input_file"
    --output "$output_file"
    --endpoint "${UNICITY_AGGREGATOR_URL}"
    --unsafe-secret
  )

  debug "Receiving token: input=$input_file"

  # Execute command
  local exit_code=0
  if ! SECRET="$secret" run_cli "${cmd[@]}"; then
    exit_code=$?
    error "Failed to receive token (exit code: $exit_code)"
    return "$exit_code"
  fi

  # Verify output file was created
  if [[ ! -f "$output_file" ]]; then
    error "Receive succeeded but output file not created: $output_file"
    return 1
  fi

  # Export output file path
  export RECEIVE_OUTPUT_FILE="$output_file"

  # Save as artifact
  if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
    local receive_id
    receive_id=$(generate_request_id)
    local artifact_name="receive-token-${receive_id}.txf"
    cp "$output_file" "$(create_artifact_file "$artifact_name")"
    info "Received token saved to artifact: $artifact_name"
  fi

  info "Successfully received token to: $output_file"
  return 0
}

# -----------------------------------------------------------------------------
# Token Verification
# -----------------------------------------------------------------------------

# Verify token structure and integrity
# Args:
#   $1: Token file path
# Returns: 0 if valid, 1 if invalid
verify_token() {
  local token_file="${1:?Token file required}"

  # Check file exists
  if [[ ! -f "$token_file" ]]; then
    error "Token file not found: $token_file"
    return 1
  fi

  # Verify valid JSON
  if ! jq empty "$token_file" 2>/dev/null; then
    error "Token file contains invalid JSON: $token_file"
    return 1
  fi

  # Verify required fields exist
  local required_fields=(
    ".version"
    ".genesis"
    ".genesis.data"
    ".genesis.data.tokenType"
  )

  for field in "${required_fields[@]}"; do
    if ! jq -e "$field" "$token_file" >/dev/null 2>&1; then
      error "Token file missing required field: $field"
      return 1
    fi
  done

  # Verify version
  local version
  version=$(jq -r '.version' "$token_file")
  if [[ "$version" != "2.0" ]]; then
    error "Invalid token version: $version (expected 2.0)"
    return 1
  fi

  debug "Token verification passed: $token_file"
  return 0
}

# Verify token on aggregator
# Args:
#   $1: Token file path
# Returns: 0 if valid on aggregator, 1 if invalid
verify_token_on_aggregator() {
  local token_file="${1:?Token file required}"

  # First verify locally
  if ! verify_token "$token_file"; then
    return 1
  fi

  # Build command
  local -a cmd=(
    verify-token
    --file "$token_file"
    --endpoint "${UNICITY_AGGREGATOR_URL}"
  )

  # Execute command
  if ! run_cli "${cmd[@]}"; then
    error "Token verification failed on aggregator"
    return 1
  fi

  debug "Token verified on aggregator: $token_file"
  return 0
}

# -----------------------------------------------------------------------------
# Token Query Helpers
# -----------------------------------------------------------------------------

# Extract token type from token file
# Args:
#   $1: Token file path
# Returns: Token type
get_token_type() {
  local token_file="${1:?Token file required}"
  jq -r '.genesis.data.tokenType' "$token_file" 2>/dev/null || echo ""
}

# Extract token ID from token file
# Args:
#   $1: Token file path
# Returns: Token ID
get_token_id() {
  local token_file="${1:?Token file required}"
  jq -r '.genesis.data.tokenId // empty' "$token_file" 2>/dev/null || echo ""
}

# Extract recipient address from token file
# Args:
#   $1: Token file path
# Returns: Recipient address
get_token_recipient() {
  local token_file="${1:?Token file required}"
  jq -r '.genesis.data.recipient // empty' "$token_file" 2>/dev/null || echo ""
}

# Get number of transactions in token file
# Args:
#   $1: Token file path
# Returns: Transaction count
get_transaction_count() {
  local token_file="${1:?Token file required}"
  jq '.transactions | length' "$token_file" 2>/dev/null || echo "0"
}

# Check if token has offline transfer section
# Args:
#   $1: Token file path
# Returns: 0 if has offline transfer, 1 if not
has_offline_transfer() {
  local token_file="${1:?Token file required}"
  local has_section
  has_section=$(jq 'has("offlineTransfer")' "$token_file" 2>/dev/null)
  [[ "$has_section" == "true" ]]
}

# Check if token is NFT (no coinData or empty coinData)
# Args:
#   $1: Token file path
# Returns: 0 if NFT, 1 if not
is_nft_token() {
  local token_file="${1:?Token file required}"
  local coin_data_length
  coin_data_length=$(jq '.genesis.data.coinData | length' "$token_file" 2>/dev/null || echo "0")
  [[ "$coin_data_length" -eq 0 ]]
}

# Check if token is fungible (has coinData)
# Args:
#   $1: Token file path
# Returns: 0 if fungible, 1 if not
is_fungible_token() {
  local token_file="${1:?Token file required}"
  ! is_nft_token "$token_file"
}

# Get coin count
# Args:
#   $1: Token file path
# Returns: Number of coins
get_coin_count() {
  local token_file="${1:?Token file required}"
  jq '.genesis.data.coinData | length' "$token_file" 2>/dev/null || echo "0"
}

# Get total coin amount (sum of all coins)
# Args:
#   $1: Token file path
# Returns: Total amount
get_total_coin_amount() {
  local token_file="${1:?Token file required}"
  jq '[.genesis.data.coinData[].amount | tonumber] | add' "$token_file" 2>/dev/null || echo "0"
}

# Get token status
# Args:
#   $1: Token file path
# Returns: Status string (PENDING, TRANSFERRED, CONFIRMED)
get_token_status() {
  local token_file="${1:?Token file required}"

  if has_offline_transfer "$token_file"; then
    echo "PENDING"
  elif [[ $(get_transaction_count "$token_file") -gt 0 ]]; then
    echo "TRANSFERRED"
  else
    echo "CONFIRMED"
  fi
}

# -----------------------------------------------------------------------------
# Additional Helper Functions (aliases and data extraction)
# -----------------------------------------------------------------------------

# Alias for get_token_id for consistency with test naming
# Args:
#   $1: Token file path
# Returns: Token ID
get_txf_token_id() {
  get_token_id "$@"
}

# Extract token data (hex-encoded) from token file
# Args:
#   $1: Token file path
# Returns: Token data as hex string or decoded UTF-8 if possible
get_token_data() {
  local token_file="${1:?Token file required}"

  # Try state.data first (current state), then genesis.data.tokenData (original data)
  local data_hex
  data_hex=$(jq -r '.state.data // .genesis.data.tokenData // empty' "$token_file" 2>/dev/null)

  if [[ -z "$data_hex" ]] || [[ "$data_hex" == "null" ]]; then
    echo ""
    return 0
  fi

  # Check if it's hex encoded (even length, only hex chars)
  if [[ ! "$data_hex" =~ ^[0-9a-fA-F]*$ ]] || [[ $((${#data_hex} % 2)) -ne 0 ]]; then
    # Not hex, return as-is
    printf "%s" "$data_hex"
    return 0
  fi

  # Decode hex to UTF-8 string
  if command -v xxd >/dev/null 2>&1; then
    printf "%s" "$data_hex" | xxd -r -p 2>/dev/null || echo "$data_hex"
  elif command -v perl >/dev/null 2>&1; then
    printf "%s" "$data_hex" | perl -pe 's/([0-9a-f]{2})/chr hex $1/gie' 2>/dev/null || echo "$data_hex"
  else
    # Fallback: return hex if no decoder available
    echo "$data_hex"
  fi
}

# Extract owner address from token state predicate
# Args:
#   $1: Token file path
# Returns: Address from genesis.data.recipient field
# Note: Extracting address from CBOR predicate requires decoder,
#       so we use the genesis recipient field as a workaround
get_txf_address() {
  local token_file="${1:?Token file required}"

  # For newly minted tokens, the address is in genesis.data.recipient
  # This is the address the token was minted to
  local address
  address=$(jq -r '.genesis.data.recipient // empty' "$token_file" 2>/dev/null)

  if [[ -n "$address" ]] && [[ "$address" != "null" ]]; then
    printf "%s" "$address"
    return 0
  fi

  # If not found, return empty
  echo ""
  return 1
}

# -----------------------------------------------------------------------------
# Export Functions
# -----------------------------------------------------------------------------

export -f generate_address
export -f mint_token
export -f send_token_offline
export -f send_token_immediate
export -f receive_token
export -f verify_token
export -f verify_token_on_aggregator
export -f get_token_type
export -f get_token_id
export -f get_token_recipient
export -f get_transaction_count
export -f has_offline_transfer
export -f is_nft_token
export -f is_fungible_token
export -f get_coin_count
export -f get_total_coin_amount
export -f get_token_status
export -f get_txf_token_id
export -f get_token_data
export -f get_txf_address
