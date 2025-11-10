#!/usr/bin/env bash
# =============================================================================
# TXF Utility Functions for BATS Tests
# =============================================================================
# This module provides bash functions that wrap Node.js utilities for working
# with TXF files, hex encoding, and CBOR predicates in tests.
#
# Usage:
#   source tests/helpers/txf-utils.bash
#
# Functions:
#   decode_hex <hex-string>              - Decode hex to UTF-8
#   decode_predicate <predicate-hex>     - Decode CBOR predicate
#   validate_inclusion_proof <txf-file>  - Check if TXF has valid proof
#   extract_txf_address <txf-file>       - Extract recipient address
#   extract_token_data <txf-file>        - Extract and decode tokenData
# =============================================================================

# Strict error handling
set -euo pipefail

# -----------------------------------------------------------------------------
# Path Resolution
# -----------------------------------------------------------------------------

# Get path to test-utils.cjs
get_test_utils_path() {
  local tests_dir
  tests_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
  printf "%s/helpers/test-utils.cjs" "$tests_dir"
}

# Get path to project root (for node_modules)
get_utils_project_root() {
  local tests_dir
  tests_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
  printf "%s" "$(dirname "$tests_dir")"
}

# -----------------------------------------------------------------------------
# Hex Decoding
# -----------------------------------------------------------------------------

# Decode hex string to UTF-8 text
# Args:
#   $1: Hex-encoded string (optional, can be empty)
# Returns: Decoded UTF-8 string
# Example:
#   decoded=$(decode_hex "7b226e616d65223a2254657374227d")
#   # Returns: {"name":"Test"}
decode_hex() {
  local hex="${1:-}"
  local utils_path
  utils_path="$(get_test_utils_path)"

  if [[ ! -f "$utils_path" ]]; then
    printf "ERROR: test-utils.cjs not found at: %s\n" "$utils_path" >&2
    return 1
  fi

  # Handle empty string
  if [[ -z "$hex" ]]; then
    printf ""
    return 0
  fi

  # Run Node.js utility
  local project_root
  project_root="$(get_utils_project_root)"

  cd "$project_root" && node "$utils_path" decode-hex "$hex"
}

# Decode hex string using pure bash/xxd (fallback method)
# Args:
#   $1: Hex-encoded string
# Returns: Decoded UTF-8 string
decode_hex_xxd() {
  local hex="${1:?Hex string required}"

  if [[ -z "$hex" ]]; then
    printf ""
    return 0
  fi

  # Use xxd if available
  if command -v xxd >/dev/null 2>&1; then
    printf "%s" "$hex" | xxd -r -p
  else
    printf "ERROR: xxd not found (required for decode_hex_xxd)\n" >&2
    return 1
  fi
}

# -----------------------------------------------------------------------------
# CBOR Predicate Decoding
# -----------------------------------------------------------------------------

# Decode CBOR predicate and extract information
# Args:
#   $1: Hex-encoded CBOR predicate
# Returns: JSON object with predicate information
# Example:
#   info=$(decode_predicate "$predicate_hex")
#   engine_id=$(echo "$info" | jq -r '.engineId')
decode_predicate() {
  local predicate_hex="${1:?Predicate hex required}"
  local utils_path
  utils_path="$(get_test_utils_path)"

  if [[ ! -f "$utils_path" ]]; then
    printf "ERROR: test-utils.cjs not found at: %s\n" "$utils_path" >&2
    return 1
  fi

  # Run Node.js utility
  local project_root
  project_root="$(get_utils_project_root)"

  cd "$project_root" && node "$utils_path" decode-predicate "$predicate_hex"
}

# Extract public key from predicate
# Args:
#   $1: Hex-encoded CBOR predicate
# Returns: Public key hex string
extract_predicate_pubkey() {
  local predicate_hex="${1:?Predicate hex required}"
  local info

  info=$(decode_predicate "$predicate_hex")

  if command -v jq >/dev/null 2>&1; then
    printf "%s" "$info" | jq -r '.publicKey // empty'
  else
    printf "ERROR: jq not found\n" >&2
    return 1
  fi
}

# Check if predicate is masked
# Args:
#   $1: Hex-encoded CBOR predicate
# Returns: 0 if masked, 1 if not masked
is_predicate_masked() {
  local predicate_hex="${1:?Predicate hex required}"
  local info

  info=$(decode_predicate "$predicate_hex")

  if command -v jq >/dev/null 2>&1; then
    local is_masked
    is_masked=$(printf "%s" "$info" | jq -r '.isMasked // false')
    [[ "$is_masked" == "true" ]]
  else
    printf "ERROR: jq not found\n" >&2
    return 1
  fi
}

# Get predicate engine name
# Args:
#   $1: Hex-encoded CBOR predicate
# Returns: Engine name (e.g., "masked", "unmasked")
get_predicate_engine() {
  local predicate_hex="${1:?Predicate hex required}"
  local info

  info=$(decode_predicate "$predicate_hex")

  if command -v jq >/dev/null 2>&1; then
    printf "%s" "$info" | jq -r '.engineName // empty'
  else
    printf "ERROR: jq not found\n" >&2
    return 1
  fi
}

# -----------------------------------------------------------------------------
# Inclusion Proof Validation
# -----------------------------------------------------------------------------

# Validate inclusion proof in TXF file
# Args:
#   $1: Path to TXF file
# Returns: 0 if valid, 1 if invalid
# Output: JSON validation result
# Example:
#   if validate_inclusion_proof "$txf_file"; then
#     echo "Proof is valid"
#   fi
validate_inclusion_proof() {
  local txf_file="${1:?TXF file path required}"
  local utils_path
  utils_path="$(get_test_utils_path)"

  if [[ ! -f "$utils_path" ]]; then
    printf "ERROR: test-utils.cjs not found at: %s\n" "$utils_path" >&2
    return 1
  fi

  if [[ ! -f "$txf_file" ]]; then
    printf "ERROR: TXF file not found: %s\n" "$txf_file" >&2
    return 1
  fi

  # Run Node.js utility (returns 0 for valid, 1 for invalid)
  local project_root
  project_root="$(get_utils_project_root)"

  cd "$project_root" && node "$utils_path" validate-proof "$txf_file"
}

# Check if TXF has valid inclusion proof (simple boolean)
# Args:
#   $1: Path to TXF file
# Returns: 0 if valid, 1 if invalid (no output)
has_valid_inclusion_proof() {
  local txf_file="${1:?TXF file path required}"

  validate_inclusion_proof "$txf_file" >/dev/null 2>&1
}

# Check if TXF has authenticator field
# Args:
#   $1: Path to TXF file
# Returns: 0 if present and non-null, 1 otherwise
has_authenticator() {
  local txf_file="${1:?TXF file path required}"

  if [[ ! -f "$txf_file" ]]; then
    return 1
  fi

  if command -v jq >/dev/null 2>&1; then
    local auth
    auth=$(jq -r '.genesis.inclusionProof.authenticator // empty' "$txf_file")
    [[ -n "$auth" && "$auth" != "null" ]]
  else
    printf "ERROR: jq not found\n" >&2
    return 1
  fi
}

# Check if TXF has merkleTreePath field
# Args:
#   $1: Path to TXF file
# Returns: 0 if present and non-null, 1 otherwise
has_merkle_tree_path() {
  local txf_file="${1:?TXF file path required}"

  if [[ ! -f "$txf_file" ]]; then
    return 1
  fi

  if command -v jq >/dev/null 2>&1; then
    local path
    path=$(jq -r '.genesis.inclusionProof.merkleTreePath // empty' "$txf_file")
    [[ -n "$path" && "$path" != "null" ]]
  else
    printf "ERROR: jq not found\n" >&2
    return 1
  fi
}

# Check if TXF has transactionHash field
# Args:
#   $1: Path to TXF file
# Returns: 0 if present and non-null, 1 otherwise
has_transaction_hash() {
  local txf_file="${1:?TXF file path required}"

  if [[ ! -f "$txf_file" ]]; then
    return 1
  fi

  if command -v jq >/dev/null 2>&1; then
    local hash
    hash=$(jq -r '.genesis.inclusionProof.transactionHash // empty' "$txf_file")
    [[ -n "$hash" && "$hash" != "null" ]]
  else
    printf "ERROR: jq not found\n" >&2
    return 1
  fi
}

# Check if TXF has unicityCertificate field
# Args:
#   $1: Path to TXF file
# Returns: 0 if present and non-null, 1 otherwise
has_unicity_certificate() {
  local txf_file="${1:?TXF file path required}"

  if [[ ! -f "$txf_file" ]]; then
    return 1
  fi

  if command -v jq >/dev/null 2>&1; then
    local cert
    cert=$(jq -r '.genesis.inclusionProof.unicityCertificate // empty' "$txf_file")
    [[ -n "$cert" && "$cert" != "null" ]]
  else
    printf "ERROR: jq not found\n" >&2
    return 1
  fi
}

# -----------------------------------------------------------------------------
# TXF Field Extraction
# -----------------------------------------------------------------------------

# Extract recipient address from TXF file
# Args:
#   $1: Path to TXF file
# Returns: Address string (e.g., "DIRECT://...")
extract_txf_address() {
  local txf_file="${1:?TXF file path required}"
  local utils_path
  utils_path="$(get_test_utils_path)"

  if [[ ! -f "$utils_path" ]]; then
    printf "ERROR: test-utils.cjs not found at: %s\n" "$utils_path" >&2
    return 1
  fi

  if [[ ! -f "$txf_file" ]]; then
    printf "ERROR: TXF file not found: %s\n" "$txf_file" >&2
    return 1
  fi

  # Run Node.js utility
  local project_root
  project_root="$(get_utils_project_root)"

  cd "$project_root" && node "$utils_path" extract-address "$txf_file"
}

# Extract and decode tokenData from TXF file
# Args:
#   $1: Path to TXF file
# Returns: Decoded token data (empty string if not present)
extract_token_data() {
  local txf_file="${1:?TXF file path required}"
  local utils_path
  utils_path="$(get_test_utils_path)"

  if [[ ! -f "$utils_path" ]]; then
    printf "ERROR: test-utils.cjs not found at: %s\n" "$utils_path" >&2
    return 1
  fi

  if [[ ! -f "$txf_file" ]]; then
    printf "ERROR: TXF file not found: %s\n" "$txf_file" >&2
    return 1
  fi

  # Run Node.js utility
  local project_root
  project_root="$(get_utils_project_root)"

  cd "$project_root" && node "$utils_path" extract-token-data "$txf_file"
}

# Extract tokenId from TXF file using jq
# Args:
#   $1: Path to TXF file
# Returns: Token ID hex string
extract_token_id() {
  local txf_file="${1:?TXF file path required}"

  if [[ ! -f "$txf_file" ]]; then
    printf "ERROR: TXF file not found: %s\n" "$txf_file" >&2
    return 1
  fi

  if command -v jq >/dev/null 2>&1; then
    jq -r '.genesis.data.tokenId // empty' "$txf_file"
  else
    printf "ERROR: jq not found\n" >&2
    return 1
  fi
}

# Extract tokenType from TXF file using jq
# Args:
#   $1: Path to TXF file
# Returns: Token type hex string
extract_token_type() {
  local txf_file="${1:?TXF file path required}"

  if [[ ! -f "$txf_file" ]]; then
    printf "ERROR: TXF file not found: %s\n" "$txf_file" >&2
    return 1
  fi

  if command -v jq >/dev/null 2>&1; then
    jq -r '.genesis.data.tokenType // empty' "$txf_file"
  else
    printf "ERROR: jq not found\n" >&2
    return 1
  fi
}

# Extract predicate from TXF file using jq
# Args:
#   $1: Path to TXF file
# Returns: Predicate hex string
extract_predicate() {
  local txf_file="${1:?TXF file path required}"

  if [[ ! -f "$txf_file" ]]; then
    printf "ERROR: TXF file not found: %s\n" "$txf_file" >&2
    return 1
  fi

  if command -v jq >/dev/null 2>&1; then
    jq -r '.state.predicate // empty' "$txf_file"
  else
    printf "ERROR: jq not found\n" >&2
    return 1
  fi
}

# -----------------------------------------------------------------------------
# TXF Structure Validation
# -----------------------------------------------------------------------------

# Check if file is valid JSON
# Args:
#   $1: Path to file
# Returns: 0 if valid JSON, 1 otherwise
is_valid_json() {
  local file="${1:?File path required}"

  if [[ ! -f "$file" ]]; then
    return 1
  fi

  if command -v jq >/dev/null 2>&1; then
    jq empty "$file" >/dev/null 2>&1
  else
    printf "ERROR: jq not found\n" >&2
    return 1
  fi
}

# Check if file is valid TXF format
# Args:
#   $1: Path to file
# Returns: 0 if valid TXF, 1 otherwise
is_valid_txf() {
  local file="${1:?File path required}"

  if ! is_valid_json "$file"; then
    return 1
  fi

  # Check required top-level fields
  local has_version has_genesis has_state
  has_version=$(jq -r '.version // empty' "$file")
  has_genesis=$(jq -r '.genesis // empty' "$file")
  has_state=$(jq -r '.state // empty' "$file")

  [[ -n "$has_version" && -n "$has_genesis" && -n "$has_state" ]]
}

# -----------------------------------------------------------------------------
# Export Functions
# -----------------------------------------------------------------------------

export -f get_test_utils_path
export -f get_utils_project_root
export -f decode_hex
export -f decode_hex_xxd
export -f decode_predicate
export -f extract_predicate_pubkey
export -f is_predicate_masked
export -f get_predicate_engine
export -f validate_inclusion_proof
export -f has_valid_inclusion_proof
export -f has_authenticator
export -f has_merkle_tree_path
export -f has_transaction_hash
export -f has_unicity_certificate
export -f extract_txf_address
export -f extract_token_data
export -f extract_token_id
export -f extract_token_type
export -f extract_predicate
export -f is_valid_json
export -f is_valid_txf
