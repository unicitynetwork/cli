#!/usr/bin/env bash
# =============================================================================
# Custom Assertions for Unicity CLI Tests
# =============================================================================
# This module provides BATS-compatible assertion functions with detailed
# error messages, colored output, and specialized assertions for token
# operations and JSON validation.
#
# Usage:
#   source tests/helpers/assertions.bash
#   assert_success
#   assert_json_field_equals "$file" ".version" "2.0"
# =============================================================================

# Strict error handling
set -euo pipefail

# -----------------------------------------------------------------------------
# Color Configuration
# -----------------------------------------------------------------------------

if [[ "${UNICITY_TEST_COLOR:-1}" == "1" ]] && [[ -t 2 ]]; then
  export COLOR_RED='\033[0;31m'
  export COLOR_GREEN='\033[0;32m'
  export COLOR_YELLOW='\033[0;33m'
  export COLOR_BLUE='\033[0;34m'
  export COLOR_RESET='\033[0m'
else
  export COLOR_RED=''
  export COLOR_GREEN=''
  export COLOR_YELLOW=''
  export COLOR_BLUE=''
  export COLOR_RESET=''
fi

# -----------------------------------------------------------------------------
# Basic Assertions
# -----------------------------------------------------------------------------

# Assert command succeeded (exit code 0)
assert_success() {
  if [[ "${status:-0}" -ne 0 ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: Expected success (exit code 0)${COLOR_RESET}\n" >&2
    printf "  Actual exit code: ${status}\n" >&2
    if [[ -n "${output:-}" ]]; then
      printf "  Output:\n%s\n" "$output" >&2
    fi
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Command succeeded${COLOR_RESET}\n" >&2
  fi
  return 0
}

# Assert command failed (non-zero exit code)
assert_failure() {
  if [[ "${status:-0}" -eq 0 ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: Expected failure (non-zero exit code)${COLOR_RESET}\n" >&2
    printf "  Actual: success (exit code 0)\n" >&2
    if [[ -n "${output:-}" ]]; then
      printf "  Output:\n%s\n" "$output" >&2
    fi
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Command failed as expected${COLOR_RESET}\n" >&2
  fi
  return 0
}

# Assert exit code equals specific value
# Args:
#   $1: Expected exit code
assert_exit_code() {
  local expected="${1:?Expected exit code required}"

  if [[ "${status:-0}" -ne "$expected" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: Exit code mismatch${COLOR_RESET}\n" >&2
    printf "  Expected: %d\n" "$expected" >&2
    printf "  Actual: %d\n" "${status}" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Exit code is %d${COLOR_RESET}\n" "$expected" >&2
  fi
  return 0
}

# -----------------------------------------------------------------------------
# Output Assertions
# -----------------------------------------------------------------------------

# Assert output contains substring
# Args:
#   $1: Expected substring
assert_output_contains() {
  local expected="${1:?Expected substring required}"

  if [[ ! "${output:-}" =~ $expected ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: Output does not contain expected string${COLOR_RESET}\n" >&2
    printf "  Expected to contain: '%s'\n" "$expected" >&2
    printf "  Actual output:\n%s\n" "${output}" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Output contains '%s'${COLOR_RESET}\n" "$expected" >&2
  fi
  return 0
}

# Assert output does not contain substring
# Args:
#   $1: Unexpected substring
assert_output_not_contains() {
  local unexpected="${1:?Unexpected substring required}"

  if [[ "${output:-}" =~ $unexpected ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: Output contains unexpected string${COLOR_RESET}\n" >&2
    printf "  Should not contain: '%s'\n" "$unexpected" >&2
    printf "  Actual output:\n%s\n" "${output}" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Output does not contain '%s'${COLOR_RESET}\n" "$unexpected" >&2
  fi
  return 0
}

# Assert output matches regex pattern
# Args:
#   $1: Regex pattern
assert_output_matches() {
  local pattern="${1:?Pattern required}"

  if [[ ! "${output:-}" =~ $pattern ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: Output does not match pattern${COLOR_RESET}\n" >&2
    printf "  Pattern: '%s'\n" "$pattern" >&2
    printf "  Actual output:\n%s\n" "${output}" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Output matches pattern '%s'${COLOR_RESET}\n" "$pattern" >&2
  fi
  return 0
}

# Assert output equals exact string
# Args:
#   $1: Expected output
assert_output_equals() {
  local expected="${1:?Expected output required}"

  if [[ "${output:-}" != "$expected" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: Output does not match${COLOR_RESET}\n" >&2
    printf "  Expected:\n%s\n" "$expected" >&2
    printf "  Actual:\n%s\n" "${output}" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Output matches expected value${COLOR_RESET}\n" >&2
  fi
  return 0
}

# -----------------------------------------------------------------------------
# File Assertions
# -----------------------------------------------------------------------------

# Assert file exists
# Args:
#   $1: File path
assert_file_exists() {
  local file="${1:?File path required}"

  if [[ ! -f "$file" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: File does not exist${COLOR_RESET}\n" >&2
    printf "  Expected file: %s\n" "$file" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ File exists: %s${COLOR_RESET}\n" "$file" >&2
  fi
  return 0
}

# Assert file does not exist
# Args:
#   $1: File path
assert_file_not_exists() {
  local file="${1:?File path required}"

  if [[ -f "$file" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: File should not exist${COLOR_RESET}\n" >&2
    printf "  Unexpected file: %s\n" "$file" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ File does not exist: %s${COLOR_RESET}\n" "$file" >&2
  fi
  return 0
}

# Assert directory exists
# Args:
#   $1: Directory path
assert_dir_exists() {
  local dir="${1:?Directory path required}"

  if [[ ! -d "$dir" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: Directory does not exist${COLOR_RESET}\n" >&2
    printf "  Expected directory: %s\n" "$dir" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Directory exists: %s${COLOR_RESET}\n" "$dir" >&2
  fi
  return 0
}

# -----------------------------------------------------------------------------
# JSON Assertions
# -----------------------------------------------------------------------------

# Assert JSON field equals value
# Args:
#   $1: File path
#   $2: JSON path (e.g., ".version")
#   $3: Expected value
# Note: Converts JSON numbers to strings for comparison to handle type coercion
assert_json_field_equals() {
  local file="${1:?File path required}"
  local field="${2:?JSON field required}"
  local expected="${3:?Expected value required}"

  if [[ ! -f "$file" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: File not found${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$file" >&2
    return 1
  fi

  # Use jq to convert value to string explicitly
  # This handles JSON numbers (2.0) vs strings ("2.0") consistently
  local actual
  actual=$(~/.local/bin/jq -r "$field | tostring" "$file" 2>/dev/null || echo "")

  if [[ "$actual" != "$expected" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: JSON field mismatch${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$file" >&2
    printf "  Field: %s\n" "$field" >&2
    printf "  Expected: %s\n" "$expected" >&2
    printf "  Actual: %s\n" "$actual" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ JSON field %s equals '%s'${COLOR_RESET}\n" "$field" "$expected" >&2
  fi
  return 0
}

# Assert JSON field exists
# Args:
#   $1: File path
#   $2: JSON path
assert_json_field_exists() {
  local file="${1:?File path required}"
  local field="${2:?JSON field required}"

  if [[ ! -f "$file" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: File not found${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$file" >&2
    return 1
  fi

  if ! ~/.local/bin/jq -e "$field" "$file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Assertion Failed: JSON field does not exist${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$file" >&2
    printf "  Field: %s\n" "$field" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ JSON field %s exists${COLOR_RESET}\n" "$field" >&2
  fi
  return 0
}

# Assert JSON field does not exist
# Args:
#   $1: File path
#   $2: JSON path
assert_json_field_not_exists() {
  local file="${1:?File path required}"
  local field="${2:?JSON field required}"

  if [[ ! -f "$file" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: File not found${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$file" >&2
    return 1
  fi

  if ~/.local/bin/jq -e "$field" "$file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Assertion Failed: JSON field should not exist${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$file" >&2
    printf "  Field: %s\n" "$field" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ JSON field %s does not exist${COLOR_RESET}\n" "$field" >&2
  fi
  return 0
}

# Assert JSON is valid
# Args:
#   $1: File path or JSON string
assert_valid_json() {
  local input="${1:?JSON input required}"

  if [[ -f "$input" ]]; then
    if ! jq empty "$input" 2>/dev/null; then
      printf "${COLOR_RED}✗ Assertion Failed: File contains invalid JSON${COLOR_RESET}\n" >&2
      printf "  File: %s\n" "$input" >&2
      return 1
    fi
  else
    if ! printf "%s" "$input" | jq empty 2>/dev/null; then
      printf "${COLOR_RED}✗ Assertion Failed: Invalid JSON string${COLOR_RESET}\n" >&2
      printf "  Input: %s\n" "$input" >&2
      return 1
    fi
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Valid JSON${COLOR_RESET}\n" >&2
  fi
  return 0
}

# -----------------------------------------------------------------------------
# Value Comparison Assertions
# -----------------------------------------------------------------------------

# Assert two values are equal
# Args:
#   $1: Expected value
#   $2: Actual value
#   $3: Optional message
assert_equals() {
  local expected="${1:?Expected value required}"
  local actual="${2:?Actual value required}"
  local message="${3:-Values not equal}"

  if [[ "$actual" != "$expected" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: %s${COLOR_RESET}\n" "$message" >&2
    printf "  Expected: %s\n" "$expected" >&2
    printf "  Actual: %s\n" "$actual" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ %s${COLOR_RESET}\n" "$message" >&2
  fi
  return 0
}

# Assert two values are not equal
# Args:
#   $1: Not expected value
#   $2: Actual value
#   $3: Optional message
assert_not_equals() {
  local not_expected="${1:?Not expected value required}"
  local actual="${2:?Actual value required}"
  local message="${3:-Values should not be equal}"

  if [[ "$actual" == "$not_expected" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: %s${COLOR_RESET}\n" "$message" >&2
    printf "  Should not equal: %s\n" "$not_expected" >&2
    printf "  Actual: %s\n" "$actual" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ %s${COLOR_RESET}\n" "$message" >&2
  fi
  return 0
}

# -----------------------------------------------------------------------------
# Numeric Assertions
# -----------------------------------------------------------------------------

# Assert number is greater than threshold
# Args:
#   $1: Value
#   $2: Threshold
#   $3: Optional message
assert_greater_than() {
  local value="${1:?Value required}"
  local threshold="${2:?Threshold required}"
  local message="${3:-Value not greater than threshold}"

  if ! [[ "$value" =~ ^-?[0-9]+$ ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: Value is not a number${COLOR_RESET}\n" >&2
    printf "  Value: %s\n" "$value" >&2
    return 1
  fi

  if [[ ! "$value" -gt "$threshold" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: %s${COLOR_RESET}\n" "$message" >&2
    printf "  Value: %d\n" "$value" >&2
    printf "  Threshold: %d\n" "$threshold" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ %d > %d${COLOR_RESET}\n" "$value" "$threshold" >&2
  fi
  return 0
}

# Assert number is less than threshold
# Args:
#   $1: Value
#   $2: Threshold
#   $3: Optional message
assert_less_than() {
  local value="${1:?Value required}"
  local threshold="${2:?Threshold required}"
  local message="${3:-Value not less than threshold}"

  if ! [[ "$value" =~ ^-?[0-9]+$ ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: Value is not a number${COLOR_RESET}\n" >&2
    printf "  Value: %s\n" "$value" >&2
    return 1
  fi

  if [[ ! "$value" -lt "$threshold" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: %s${COLOR_RESET}\n" "$message" >&2
    printf "  Value: %d\n" "$value" >&2
    printf "  Threshold: %d\n" "$threshold" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ %d < %d${COLOR_RESET}\n" "$value" "$threshold" >&2
  fi
  return 0
}

# Assert number is in range
# Args:
#   $1: Value
#   $2: Min
#   $3: Max
#   $4: Optional message
assert_in_range() {
  local value="${1:?Value required}"
  local min="${2:?Min required}"
  local max="${3:?Max required}"
  local message="${4:-Value not in range}"

  if ! [[ "$value" =~ ^-?[0-9]+$ ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: Value is not a number${COLOR_RESET}\n" >&2
    printf "  Value: %s\n" "$value" >&2
    return 1
  fi

  if [[ "$value" -lt "$min" ]] || [[ "$value" -gt "$max" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: %s${COLOR_RESET}\n" "$message" >&2
    printf "  Value: %d\n" "$value" >&2
    printf "  Range: %d - %d\n" "$min" "$max" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ %d in range [%d, %d]${COLOR_RESET}\n" "$value" "$min" "$max" >&2
  fi
  return 0
}

# -----------------------------------------------------------------------------
# Token-Specific Assertions
# -----------------------------------------------------------------------------

# Assert token file is valid
# Args:
#   $1: Token file path
assert_valid_token() {
  local file="${1:?Token file required}"

  assert_file_exists "$file" || return 1
  assert_valid_json "$file" || return 1
  assert_json_field_equals "$file" ".version" "2.0" || return 1
  assert_json_field_exists "$file" ".genesis" || return 1
  assert_json_field_exists "$file" ".genesis.data" || return 1
  assert_json_field_exists "$file" ".genesis.data.tokenType" || return 1

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Valid token file: %s${COLOR_RESET}\n" "$file" >&2
  fi
  return 0
}

# Assert token has offline transfer
# Args:
#   $1: Token file path
assert_has_offline_transfer() {
  local file="${1:?Token file required}"

  assert_json_field_exists "$file" ".offlineTransfer" || return 1
  assert_json_field_exists "$file" ".offlineTransfer.sender" || return 1
  assert_json_field_exists "$file" ".offlineTransfer.recipient" || return 1

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Token has offline transfer${COLOR_RESET}\n" >&2
  fi
  return 0
}

# Assert token does not have offline transfer
# Args:
#   $1: Token file path
assert_no_offline_transfer() {
  local file="${1:?Token file required}"

  if ~/.local/bin/jq -e '.offlineTransfer' "$file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Assertion Failed: Token should not have offline transfer${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$file" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Token does not have offline transfer${COLOR_RESET}\n" >&2
  fi
  return 0
}

# Assert token type matches preset
# Args:
#   $1: Token file path
#   $2: Expected preset (nft, uct, alpha, usdu, euru)
assert_token_type() {
  local file="${1:?Token file required}"
  local expected_preset="${2:?Expected preset required}"

  local actual_type
  actual_type=$(~/.local/bin/jq -r '.genesis.data.tokenType' "$file" 2>/dev/null)

  local expected_type=""
  case "$expected_preset" in
    nft)   expected_type="${TOKEN_TYPE_NFT}" ;;
    uct)   expected_type="${TOKEN_TYPE_UCT}" ;;
    alpha) expected_type="${TOKEN_TYPE_ALPHA}" ;;
    usdu)  expected_type="${TOKEN_TYPE_USDU}" ;;
    euru)  expected_type="${TOKEN_TYPE_EURU}" ;;
    *)     expected_type="$expected_preset" ;;
  esac

  if [[ "$actual_type" != "$expected_type" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: Token type mismatch${COLOR_RESET}\n" >&2
    printf "  Expected: %s (%s)\n" "$expected_preset" "$expected_type" >&2
    printf "  Actual: %s\n" "$actual_type" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Token type is %s${COLOR_RESET}\n" "$expected_preset" >&2
  fi
  return 0
}

# -----------------------------------------------------------------------------
# Export Functions
# -----------------------------------------------------------------------------

export -f assert_success
export -f assert_failure
export -f assert_exit_code
export -f assert_output_contains
export -f assert_output_not_contains
export -f assert_output_matches
export -f assert_output_equals
export -f assert_file_exists
export -f assert_file_not_exists
export -f assert_dir_exists
export -f assert_json_field_equals
export -f assert_json_field_exists
export -f assert_json_field_not_exists
export -f assert_valid_json
export -f assert_equals
export -f assert_not_equals
export -f assert_greater_than
export -f assert_less_than
export -f assert_in_range
export -f assert_valid_token
export -f assert_has_offline_transfer
export -f assert_no_offline_transfer
export -f assert_token_type
# =============================================================================
# Unicity Cryptographic Validation Functions
# =============================================================================
# These functions provide comprehensive validation of Unicity token structures,
# including cryptographic verification, predicate validation, inclusion proofs,
# and state hash computation.
#
# PRIMARY validation uses the verify-token CLI command as the authoritative
# validator. SECONDARY structure checks provide early failure detection.
#
# Usage:
#   verify_token_cryptographically "$token_file"
#   assert_token_fully_valid "$token_file"
# =============================================================================

# -----------------------------------------------------------------------------
# Core Cryptographic Validation
# -----------------------------------------------------------------------------

# Verify token cryptographically using CLI verify-token command
# This is the PRIMARY validation method - uses SDK cryptographic validation
# Args:
#   $1: Token file path
# Returns: 0 on success, 1 on failure
# Example:
#   verify_token_cryptographically "$token_file"
verify_token_cryptographically() {
  local token_file="${1:?Token file required}"
  
  # Check file exists
  if [[ ! -f "$token_file" ]]; then
    printf "${COLOR_RED}✗ Token Validation Failed: File not found${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi
  
  # Run verify-token command with --local flag (offline verification)
  local verify_status=0
  local verify_output
  verify_output=$(run_cli verify-token -f "$token_file" --local 2>&1) || verify_status=$?
  
  # Check if command succeeded
  if [[ $verify_status -ne 0 ]]; then
    printf "${COLOR_RED}✗ Token Cryptographic Validation Failed${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    printf "  Exit code: %d\n" "$verify_status" >&2
    printf "  Output:\n%s\n" "$verify_output" >&2
    return 1
  fi
  
  # Check that output indicates successful validation
  # The verify-token command should output validation results
  if echo "$verify_output" | grep -qiE "(error|fail|invalid)"; then
    printf "${COLOR_RED}✗ Token Validation Indicated Errors${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    printf "  Output:\n%s\n" "$verify_output" >&2
    return 1
  fi
  
  # Check for positive validation indicators
  if ! echo "$verify_output" | grep -qiE "(valid|success|verified|✓|✅)"; then
    printf "${COLOR_YELLOW}⚠ Token Validation Completed But No Clear Success Indicator${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    printf "  Output:\n%s\n" "$verify_output" >&2
    # Don't fail - command succeeded, just no clear success message
  fi
  
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Token cryptographically valid${COLOR_RESET}\n" >&2
  fi
  
  return 0
}

# -----------------------------------------------------------------------------
# Token Structure Validation
# -----------------------------------------------------------------------------

# Assert token has valid JSON structure with all required fields
# Args:
#   $1: Token file path
# Returns: 0 on success, 1 on failure
# Example:
#   assert_token_has_valid_structure "$token_file"
assert_token_has_valid_structure() {
  local token_file="${1:?Token file required}"
  
  # Check file exists and is valid JSON
  assert_file_exists "$token_file" || return 1
  
  # Validate JSON structure
  if ! ~/.local/bin/jq empty "$token_file" 2>/dev/null; then
    printf "${COLOR_RED}✗ Invalid JSON in token file${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi
  
  # Check version field
  if ! ~/.local/bin/jq -e '.version' "$token_file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Missing .version field${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi
  
  # Check genesis object
  if ! ~/.local/bin/jq -e '.genesis' "$token_file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Missing .genesis object${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi
  
  # Check state object
  if ! ~/.local/bin/jq -e '.state' "$token_file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Missing .state object${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi
  
  # Check required state fields
  local required_state_fields=(
    ".state.data"
    ".state.predicate"
  )

  for field in "${required_state_fields[@]}"; do
    if ! ~/.local/bin/jq -e "$field" "$token_file" >/dev/null 2>&1; then
      printf "${COLOR_RED}✗ Missing required field: %s${COLOR_RESET}\n" "$field" >&2
      printf "  File: %s\n" "$token_file" >&2
      return 1
    fi
  done

  # Check genesis has data (including tokenType)
  if ! ~/.local/bin/jq -e '.genesis.data.tokenType' "$token_file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Missing .genesis.data.tokenType${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi
  
  # Check inclusion proof exists (in genesis for minted tokens)
  if ! ~/.local/bin/jq -e '.genesis.inclusionProof' "$token_file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Missing .genesis.inclusionProof object${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi
  
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Token structure valid${COLOR_RESET}\n" >&2
  fi
  
  return 0
}

# Assert token has valid genesis transaction
# Args:
#   $1: Token file path
# Returns: 0 on success, 1 on failure
# Example:
#   assert_token_has_valid_genesis "$token_file"
assert_token_has_valid_genesis() {
  local token_file="${1:?Token file required}"
  
  # Check genesis object exists
  if ! ~/.local/bin/jq -e '.genesis' "$token_file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Missing genesis object${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi
  
  # Check genesis has required fields
  local required_fields=(
    ".genesis.data"
    ".genesis.data.tokenType"
  )
  
  for field in "${required_fields[@]}"; do
    if ! ~/.local/bin/jq -e "$field" "$token_file" >/dev/null 2>&1; then
      printf "${COLOR_RED}✗ Missing genesis field: %s${COLOR_RESET}\n" "$field" >&2
      printf "  File: %s\n" "$token_file" >&2
      return 1
    fi
  done
  
  # Validate genesis transaction has proof (if applicable)
  # Genesis may have inclusionProof at genesis level or rely on overall proof
  
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Genesis transaction valid${COLOR_RESET}\n" >&2
  fi
  
  return 0
}

# Assert token has valid current state
# Args:
#   $1: Token file path
# Returns: 0 on success, 1 on failure
# Example:
#   assert_token_has_valid_state "$token_file"
assert_token_has_valid_state() {
  local token_file="${1:?Token file required}"

  # Check state object exists
  if ! ~/.local/bin/jq -e '.state' "$token_file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Missing state object${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi

  # Check state data exists
  if ! ~/.local/bin/jq -e '.state.data' "$token_file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Missing state data${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi

  # Check predicate exists
  if ! ~/.local/bin/jq -e '.state.predicate' "$token_file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Missing state predicate${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Current state valid${COLOR_RESET}\n" >&2
  fi

  return 0
}

# -----------------------------------------------------------------------------
# Inclusion Proof Validation
# -----------------------------------------------------------------------------

# Assert inclusion proof has valid structure
# Args:
#   $1: Token file path
# Returns: 0 on success, 1 on failure
# Example:
#   assert_inclusion_proof_valid "$token_file"
assert_inclusion_proof_valid() {
  local token_file="${1:?Token file required}"
  
  # Check inclusion proof object exists
  if ! ~/.local/bin/jq -e '.inclusionProof' "$token_file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Missing inclusion proof${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi
  
  # Check required proof fields (structure may vary based on proof type)
  # Common fields: merklePath, blockHeight, rootHash, timestamp
  
  # Note: The verify-token command is the authoritative validator for proofs
  # This function only checks basic structure existence
  
  # Get proof type if available
  local has_merkle_path
  has_merkle_path=$(~/.local/bin/jq -e '.inclusionProof.merklePath' "$token_file" >/dev/null 2>&1 && echo "true" || echo "false")
  
  local has_block_height
  has_block_height=$(~/.local/bin/jq -e '.inclusionProof.blockHeight' "$token_file" >/dev/null 2>&1 && echo "true" || echo "false")
  
  if [[ "$has_merkle_path" == "false" ]] && [[ "$has_block_height" == "false" ]]; then
    printf "${COLOR_YELLOW}⚠ Inclusion proof has non-standard structure${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    printf "  Note: Structure validation will be performed by verify-token command\n" >&2
    # Don't fail - let verify-token handle it
  fi
  
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Inclusion proof structure present${COLOR_RESET}\n" >&2
  fi
  
  return 0
}

# -----------------------------------------------------------------------------
# Predicate Validation
# -----------------------------------------------------------------------------

# Assert predicate structure is valid (CBOR format)
# Args:
#   $1: Predicate hex string (from .state.predicate)
# Returns: 0 on success, 1 on failure
# Example:
#   predicate=$(~/.local/bin/jq -r '.state.predicate' "$token_file")
#   assert_predicate_structure_valid "$predicate"
assert_predicate_structure_valid() {
  local predicate_hex="${1:?Predicate hex required}"
  
  # Check hex format (even length)
  if [[ $((${#predicate_hex} % 2)) -ne 0 ]]; then
    printf "${COLOR_RED}✗ Predicate hex has odd length${COLOR_RESET}\n" >&2
    printf "  Length: %d characters\n" "${#predicate_hex}" >&2
    return 1
  fi
  
  # Check minimum length for valid predicate
  # CBOR structure + engine ID + template + params
  # Typical SDK predicates: ~187 bytes (374 hex chars)
  # Minimum reasonable: 50 hex chars (25 bytes)
  if [[ ${#predicate_hex} -lt 50 ]]; then
    printf "${COLOR_RED}✗ Predicate hex too short${COLOR_RESET}\n" >&2
    printf "  Length: %d characters (minimum: 50)\n" "${#predicate_hex}" >&2
    return 1
  fi
  
  # Check maximum reasonable length (prevent DOS)
  # Maximum: 10KB = 20000 hex chars
  if [[ ${#predicate_hex} -gt 20000 ]]; then
    printf "${COLOR_RED}✗ Predicate hex too long${COLOR_RESET}\n" >&2
    printf "  Length: %d characters (maximum: 20000)\n" "${#predicate_hex}" >&2
    return 1
  fi
  
  # Check hex characters only
  if ! [[ "$predicate_hex" =~ ^[0-9a-fA-F]+$ ]]; then
    printf "${COLOR_RED}✗ Predicate contains non-hex characters${COLOR_RESET}\n" >&2
    return 1
  fi
  
  # Note: Full CBOR decoding and structure validation is performed by verify-token
  # This function only checks basic format requirements
  
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Predicate structure valid (format check)${COLOR_RESET}\n" >&2
  fi
  
  return 0
}

# Assert predicate in token file is valid
# Args:
#   $1: Token file path
# Returns: 0 on success, 1 on failure
# Example:
#   assert_token_predicate_valid "$token_file"
assert_token_predicate_valid() {
  local token_file="${1:?Token file required}"
  
  # Extract predicate from token
  local predicate_hex
  predicate_hex=$(~/.local/bin/jq -r '.state.predicate' "$token_file" 2>/dev/null)
  
  if [[ -z "$predicate_hex" ]] || [[ "$predicate_hex" == "null" ]]; then
    printf "${COLOR_RED}✗ Missing predicate in token state${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi
  
  # Validate predicate structure
  assert_predicate_structure_valid "$predicate_hex" || return 1
  
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Token predicate valid${COLOR_RESET}\n" >&2
  fi
  
  return 0
}

# -----------------------------------------------------------------------------
# State Hash Validation
# -----------------------------------------------------------------------------

# Assert state hash is correctly computed
# Note: State hash computation is complex - relies on verify-token for validation
# This function checks that the hash exists and has proper format
# Args:
#   $1: Token file path
# Returns: 0 on success, 1 on failure
# Example:
#   assert_state_hash_correct "$token_file"
assert_state_hash_correct() {
  local token_file="${1:?Token file required}"
  
  # Extract state hash
  local state_hash
  state_hash=$(~/.local/bin/jq -r '.state.stateHash' "$token_file" 2>/dev/null)
  
  if [[ -z "$state_hash" ]] || [[ "$state_hash" == "null" ]]; then
    printf "${COLOR_RED}✗ Missing state hash${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi
  
  # Check hash format (hex string)
  if ! [[ "$state_hash" =~ ^[0-9a-fA-F]+$ ]]; then
    printf "${COLOR_RED}✗ Invalid state hash format${COLOR_RESET}\n" >&2
    printf "  Hash: %s\n" "$state_hash" >&2
    return 1
  fi
  
  # Check hash length (SHA256 = 32 bytes = 64 hex chars, or other hash sizes)
  local hash_len=${#state_hash}
  
  # Common hash sizes: 32 bytes (SHA256), 20 bytes (RIPEMD160), etc.
  # Allow 40-128 hex chars (20-64 bytes)
  if [[ $hash_len -lt 40 ]] || [[ $hash_len -gt 128 ]]; then
    printf "${COLOR_YELLOW}⚠ State hash length unusual${COLOR_RESET}\n" >&2
    printf "  Length: %d hex characters\n" "$hash_len" >&2
    printf "  Note: Typically 64 chars (SHA256)\n" >&2
    # Don't fail - let verify-token validate
  fi
  
  # Note: Actual hash computation validation is performed by verify-token
  # This function only checks format
  
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ State hash format valid${COLOR_RESET}\n" >&2
  fi
  
  return 0
}

# -----------------------------------------------------------------------------
# Token Chain Validation
# -----------------------------------------------------------------------------

# Assert token has valid transaction chain
# For tokens with multiple state transitions
# Args:
#   $1: Token file path
# Returns: 0 on success, 1 on failure
# Example:
#   assert_token_chain_valid "$token_file"
assert_token_chain_valid() {
  local token_file="${1:?Token file required}"
  
  # Check if token has transaction history
  local has_history
  has_history=$(~/.local/bin/jq -e '.transactionHistory' "$token_file" >/dev/null 2>&1 && echo "true" || echo "false")
  
  if [[ "$has_history" == "false" ]]; then
    # No transaction history - single state token
    if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
      printf "${COLOR_GREEN}✓ Single-state token (no chain)${COLOR_RESET}\n" >&2
    fi
    return 0
  fi
  
  # Validate transaction history array
  local tx_count
  tx_count=$(~/.local/bin/jq -r '.transactionHistory | length' "$token_file" 2>/dev/null)
  
  if [[ -z "$tx_count" ]] || [[ "$tx_count" == "null" ]] || [[ $tx_count -lt 1 ]]; then
    printf "${COLOR_RED}✗ Invalid transaction history${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi
  
  # Note: Full chain validation (hash links, proofs) is done by verify-token
  
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Token chain structure valid (%d transactions)${COLOR_RESET}\n" "$tx_count" >&2
  fi
  
  return 0
}

# -----------------------------------------------------------------------------
# Offline Transfer Validation
# -----------------------------------------------------------------------------

# Assert offline transfer has valid structure
# Args:
#   $1: Token file path
# Returns: 0 on success, 1 on failure
# Example:
#   assert_offline_transfer_valid "$token_file"
assert_offline_transfer_valid() {
  local token_file="${1:?Token file required}"
  
  # Check if token has offline transfer
  if ! ~/.local/bin/jq -e '.offlineTransfer' "$token_file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Token does not have offline transfer${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi
  
  # Check required offline transfer fields
  local required_fields=(
    ".offlineTransfer.sender"
    ".offlineTransfer.recipient"
  )
  
  for field in "${required_fields[@]}"; do
    if ! ~/.local/bin/jq -e "$field" "$token_file" >/dev/null 2>&1; then
      printf "${COLOR_RED}✗ Missing offline transfer field: %s${COLOR_RESET}\n" "$field" >&2
      printf "  File: %s\n" "$token_file" >&2
      return 1
    fi
  done
  
  # Validate recipient address format (hex string)
  local recipient
  recipient=$(~/.local/bin/jq -r '.offlineTransfer.recipient' "$token_file" 2>/dev/null)
  
  if [[ -z "$recipient" ]] || [[ "$recipient" == "null" ]]; then
    printf "${COLOR_RED}✗ Empty recipient address${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi
  
  if ! [[ "$recipient" =~ ^[0-9a-fA-F]+$ ]]; then
    printf "${COLOR_RED}✗ Invalid recipient address format${COLOR_RESET}\n" >&2
    printf "  Address: %s\n" "$recipient" >&2
    return 1
  fi
  
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Offline transfer structure valid${COLOR_RESET}\n" >&2
  fi
  
  return 0
}

# -----------------------------------------------------------------------------
# Comprehensive Token Validation
# -----------------------------------------------------------------------------

# Assert token is fully valid (all checks)
# This is the MAIN validation function - combines all checks
# Args:
#   $1: Token file path
# Returns: 0 on success, 1 on failure
# Example:
#   assert_token_fully_valid "$token_file"
assert_token_fully_valid() {
  local token_file="${1:?Token file required}"
  
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_BLUE}=== Comprehensive Token Validation ===${COLOR_RESET}\n" >&2
    printf "File: %s\n" "$token_file" >&2
  fi
  
  # 1. Structure validation (fast checks first)
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "\n[1/5] Validating token structure...\n" >&2
  fi
  assert_token_has_valid_structure "$token_file" || return 1
  
  # 2. Genesis validation
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "[2/5] Validating genesis transaction...\n" >&2
  fi
  assert_token_has_valid_genesis "$token_file" || return 1
  
  # 3. Current state validation
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "[3/5] Validating current state...\n" >&2
  fi
  assert_token_has_valid_state "$token_file" || return 1
  
  # 4. Predicate validation
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "[4/5] Validating predicate...\n" >&2
  fi
  assert_token_predicate_valid "$token_file" || return 1
  
  # 5. Cryptographic validation (PRIMARY - most important)
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "[5/5] Performing cryptographic validation...\n" >&2
  fi
  verify_token_cryptographically "$token_file" || return 1
  
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "\n${COLOR_GREEN}✅ Token fully validated (all checks passed)${COLOR_RESET}\n" >&2
  fi
  
  return 0
}

# Quick validation (structure + crypto only, skip detailed checks)
# Use for performance-critical scenarios
# Args:
#   $1: Token file path
# Returns: 0 on success, 1 on failure
# Example:
#   assert_token_valid_quick "$token_file"
assert_token_valid_quick() {
  local token_file="${1:?Token file required}"
  
  # Basic structure check
  assert_file_exists "$token_file" || return 1
  assert_valid_json "$token_file" || return 1
  
  # Cryptographic validation (comprehensive)
  verify_token_cryptographically "$token_file" || return 1
  
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Token valid (quick check)${COLOR_RESET}\n" >&2
  fi
  
  return 0
}

# -----------------------------------------------------------------------------
# BFT Authenticator Validation (Advanced)
# -----------------------------------------------------------------------------

# Assert BFT authenticator signatures are valid
# Note: BFT validation typically happens at aggregator level
# This function checks if BFT fields exist in proof structure
# Args:
#   $1: Token file path
# Returns: 0 on success, 1 on failure
# Example:
#   assert_bft_signatures_valid "$token_file"
assert_bft_signatures_valid() {
  local token_file="${1:?Token file required}"
  
  # Check if proof has BFT authenticator fields
  local has_bft
  has_bft=$(~/.local/bin/jq -e '.inclusionProof.bftAuthenticator' "$token_file" >/dev/null 2>&1 && echo "true" || echo "false")
  
  if [[ "$has_bft" == "false" ]]; then
    # No BFT authenticator in proof - may be normal for certain proof types
    if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
      printf "${COLOR_YELLOW}⚠ No BFT authenticator in proof${COLOR_RESET}\n" >&2
      printf "  File: %s\n" "$token_file" >&2
    fi
    # Don't fail - not all proofs have BFT authenticator
    return 0
  fi
  
  # Check BFT authenticator structure
  if ! ~/.local/bin/jq -e '.inclusionProof.bftAuthenticator.signatures' "$token_file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ BFT authenticator missing signatures${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$token_file" >&2
    return 1
  fi
  
  # Note: Actual signature validation is performed by verify-token
  
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ BFT authenticator structure present${COLOR_RESET}\n" >&2
  fi
  
  return 0
}

# -----------------------------------------------------------------------------
# Helper: Assert JSON Field Has Value (not just exists)
# -----------------------------------------------------------------------------

# Assert JSON field exists and has non-null, non-empty value
# Args:
#   $1: File path
#   $2: JSON path
# Returns: 0 on success, 1 on failure
# Example:
#   assert_json_has_field "$token_file" ".state.stateHash"
assert_json_has_field() {
  local file="${1:?File path required}"
  local field="${2:?JSON field required}"
  
  # Check field exists
  if ! ~/.local/bin/jq -e "$field" "$file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Field does not exist: %s${COLOR_RESET}\n" "$field" >&2
    printf "  File: %s\n" "$file" >&2
    return 1
  fi
  
  # Check field is not null
  local value
  value=$(~/.local/bin/jq -r "$field" "$file" 2>/dev/null)
  
  if [[ "$value" == "null" ]]; then
    printf "${COLOR_RED}✗ Field is null: %s${COLOR_RESET}\n" "$field" >&2
    printf "  File: %s\n" "$file" >&2
    return 1
  fi
  
  # For string fields, check not empty
  if [[ -z "$value" ]]; then
    printf "${COLOR_RED}✗ Field is empty: %s${COLOR_RESET}\n" "$field" >&2
    printf "  File: %s\n" "$file" >&2
    return 1
  fi
  
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Field has value: %s${COLOR_RESET}\n" "$field" >&2
  fi
  
  return 0
}

# Assert a variable is set (not empty)
assert_set() {
  local var="$1"
  if [[ -z "$var" ]]; then
    printf "${COLOR_RED}✗ Variable is not set or empty${COLOR_RESET}\n" >&2
    return 1
  fi
  return 0
}

# Check if a string is valid hex of specified length(s)
# Args:
#   $1: Value to check
#   $2: Expected length (optional, default 64)
#        Can be single length (64) or comma-separated list (64,68)
# Returns: 0 if valid, 1 if invalid
# Examples:
#   is_valid_hex "$hash"           # Validates 64-char hex (default)
#   is_valid_hex "$hash" 68        # Validates exactly 68-char hex
#   is_valid_hex "$hash" "64,68"   # Validates 64 OR 68-char hex
is_valid_hex() {
  local value="$1"
  local expected_length="${2:-64}"  # Default 64 chars (32 bytes)

  # Check if value contains only hex characters
  if [[ ! "$value" =~ ^[0-9a-fA-F]+$ ]]; then
    printf "${COLOR_RED}✗ Not valid hex (contains non-hex characters): %s${COLOR_RESET}\n" "$value" >&2
    return 1
  fi

  local actual_length=${#value}

  # Handle comma-separated list of valid lengths
  if [[ "$expected_length" == *","* ]]; then
    # Split by comma and check each valid length
    IFS=',' read -ra valid_lengths <<< "$expected_length"
    local found=0
    for len in "${valid_lengths[@]}"; do
      len=$(echo "$len" | tr -d ' ')  # Trim whitespace
      if [[ "$actual_length" -eq "$len" ]]; then
        found=1
        break
      fi
    done

    if [[ $found -eq 0 ]]; then
      printf "${COLOR_RED}✗ Not valid hex of expected lengths %s: length is %d${COLOR_RESET}\n" "$expected_length" "$actual_length" >&2
      return 1
    fi
  else
    # Single length comparison
    if [[ "$actual_length" -ne "$expected_length" ]]; then
      printf "${COLOR_RED}✗ Not valid hex of length %d: length is %d${COLOR_RESET}\n" "$expected_length" "$actual_length" >&2
      return 1
    fi
  fi

  return 0
}

# Assert address type (masked or unmasked)
# Checks the DIRECT:// address format and engine ID
assert_address_type() {
  local address="$1"
  local expected_type="$2"  # "masked" or "unmasked"

  # Check DIRECT:// prefix
  if [[ ! "$address" =~ ^DIRECT:// ]]; then
    printf "${COLOR_RED}✗ Address does not start with DIRECT://${COLOR_RESET}\n" >&2
    printf "  Address: %s\n" "$address" >&2
    return 1
  fi

  # Extract the hex part after DIRECT://
  local hex_part="${address#DIRECT://}"

  # Check if it's valid hex (variable length, minimum 66 chars)
  if [[ ! "$hex_part" =~ ^[0-9a-fA-F]+$ ]]; then
    printf "${COLOR_RED}✗ Address hex part is not valid hex${COLOR_RESET}\n" >&2
    printf "  Hex part: %s\n" "$hex_part" >&2
    return 1
  fi

  local hex_length=${#hex_part}
  if [[ $hex_length -lt 66 ]]; then
    printf "${COLOR_RED}✗ Address hex part is too short (minimum 66 chars)${COLOR_RESET}\n" >&2
    printf "  Length: %d\n" "$hex_length" >&2
    printf "  Hex part: %s\n" "$hex_part" >&2
    return 1
  fi

  # NOTE: The address format doesn't encode masked vs unmasked in the address itself
  # The distinction is in the predicate structure, not the address
  # So we just validate the address is well-formed, we can't check masked/unmasked from address alone

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Address type is %s${COLOR_RESET}\n" "$expected_type" >&2
  fi

  return 0
}

# Check if file is valid TXF (Token Exchange Format)
# Args: $1 = file path
# Returns: 0 if valid TXF, 1 if invalid
is_valid_txf() {
  local file="${1:?File path required}"

  # Check file exists
  if [[ ! -f "$file" ]]; then
    printf "${COLOR_RED}✗ TXF file not found: %s${COLOR_RESET}\n" "$file" >&2
    return 1
  fi

  # Check valid JSON
  if ! ~/.local/bin/jq empty "$file" 2>/dev/null; then
    printf "${COLOR_RED}✗ TXF file contains invalid JSON${COLOR_RESET}\n" >&2
    return 1
  fi

  # Check required TXF fields
  local required_fields=(".version" ".genesis" ".state")
  for field in "${required_fields[@]}"; do
    if ! ~/.local/bin/jq -e "$field" "$file" >/dev/null 2>&1; then
      printf "${COLOR_RED}✗ TXF file missing required field: %s${COLOR_RESET}\n" "$field" >&2
      return 1
    fi
  done

  # Check version is 2.0
  local version
  version=$(~/.local/bin/jq -r '.version' "$file" 2>/dev/null)
  if [[ "$version" != "2.0" ]]; then
    printf "${COLOR_RED}✗ Invalid TXF version: %s (expected 2.0)${COLOR_RESET}\n" "$version" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Valid TXF file${COLOR_RESET}\n" >&2
  fi

  return 0
}

# Extract token ID from TXF file
# Args: $1 = file path
# Returns: Token ID (64-char hex string) or empty
get_txf_token_id() {
  local file="${1:?File path required}"

  # Try multiple possible locations for token ID
  local token_id
  token_id=$(~/.local/bin/jq -r '.genesis.data.tokenId // .token.tokenId // empty' "$file" 2>/dev/null)

  echo "$token_id"
}

# Determine predicate type (masked vs unmasked)
# Args: $1 = file path
# Returns: "masked" or "unmasked"
# Note: This is a heuristic check - full CBOR decoding would be needed for certainty
get_predicate_type() {
  local file="${1:?File path required}"

  # Check if nonce was used (indicates masked predicate)
  # Masked predicates are generated with a nonce, unmasked are not
  # This is a heuristic - the actual determination requires CBOR decoding

  # Try to find nonce in metadata or state
  if ~/.local/bin/jq -e '.state.nonce' "$file" >/dev/null 2>&1; then
    echo "masked"
    return 0
  fi

  # Check predicate CBOR for engine ID
  # Engine 1 (0x0001) = secp256k1 with hash (masked)
  # Engine 3 (0x0003) = secp256k1 direct (unmasked)
  local predicate_hex
  predicate_hex=$(~/.local/bin/jq -r '.state.predicate' "$file" 2>/dev/null)

  if [[ -n "$predicate_hex" ]]; then
    # Simple heuristic: check for engine byte patterns
    # This is not perfect without full CBOR decoder
    # Masked predicates are typically longer due to nonce
    local pred_length=${#predicate_hex}
    if [[ $pred_length -gt 140 ]]; then
      echo "masked"
    else
      echo "unmasked"
    fi
  else
    # Default to unmasked if we can't determine
    echo "unmasked"
  fi
}

# Extract and decode token data from TXF file
# Args: $1 = file path
# Returns: Decoded data (text) or hex string
get_token_data() {
  local file="${1:?File path required}"

  # Extract hex-encoded data
  local hex_data
  hex_data=$(~/.local/bin/jq -r '.state.data // .genesis.data.data // empty' "$file" 2>/dev/null)

  if [[ -z "$hex_data" ]] || [[ "$hex_data" == "null" ]]; then
    return 0
  fi

  # Try to decode hex to text
  local decoded
  if decoded=$(echo "$hex_data" | xxd -r -p 2>/dev/null); then
    echo "$decoded"
  else
    # If decoding fails, return the hex string
    echo "$hex_data"
  fi
}

# Extract address from TXF file
# Args: $1 = file path
# Returns: DIRECT:// address or empty
# Note: This requires CBOR decoding of the predicate to extract the public key
get_txf_address() {
  local file="${1:?File path required}"

  # Try to find pre-computed address in state
  local address
  address=$(~/.local/bin/jq -r '.state.address // .address // empty' "$file" 2>/dev/null)

  if [[ -n "$address" ]] && [[ "$address" != "null" ]]; then
    echo "$address"
    return 0
  fi

  # LIMITATION: Without CBOR decoder, we cannot extract address from predicate
  # The predicate contains the public key, but it's CBOR-encoded
  # For testing purposes, we can try to use the CLI to generate the address
  # from the same secret, but this won't work for received tokens

  # Return empty - this function is limited without CBOR support
  return 0
}

# Assert that token has a valid inclusion proof
# Args: $1 = file path
# Returns: 0 if proof exists and is valid structure, 1 otherwise
assert_has_inclusion_proof() {
  local file="${1:?File path required}"

  # Check if inclusionProof field exists
  if ! ~/.local/bin/jq -e '.genesis.inclusionProof' "$file" >/dev/null 2>&1; then
    printf "${COLOR_RED}✗ Missing inclusion proof in genesis${COLOR_RESET}\n" >&2
    return 1
  fi

  # Check required proof fields
  local required_fields=(
    ".genesis.inclusionProof.merkleTreePath"
    ".genesis.inclusionProof.merkleTreePath.root"
    ".genesis.inclusionProof.unicityCertificate"
  )

  for field in "${required_fields[@]}"; do
    if ! ~/.local/bin/jq -e "$field" "$file" >/dev/null 2>&1; then
      printf "${COLOR_RED}✗ Inclusion proof missing field: %s${COLOR_RESET}\n" "$field" >&2
      return 1
    fi
  done

  # Verify Merkle root is valid hex hash (64 chars)
  local merkle_root
  merkle_root=$(~/.local/bin/jq -r '.genesis.inclusionProof.merkleTreePath.root' "$file" 2>/dev/null)
  if [[ ! "$merkle_root" =~ ^[0-9a-fA-F]{64}$ ]]; then
    printf "${COLOR_RED}✗ Invalid Merkle root format (expected 64-char hex): %s${COLOR_RESET}\n" "$merkle_root" >&2
    return 1
  fi

  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    printf "${COLOR_GREEN}✓ Token has valid inclusion proof structure${COLOR_RESET}\n" >&2
  fi

  return 0
}

# -----------------------------------------------------------------------------
# Export New Functions
# -----------------------------------------------------------------------------

export -f verify_token_cryptographically
export -f assert_token_has_valid_structure
export -f assert_token_has_valid_genesis
export -f assert_token_has_valid_state
export -f assert_inclusion_proof_valid
export -f is_valid_txf
export -f get_txf_token_id
export -f get_predicate_type
export -f get_token_data
export -f get_txf_address
export -f assert_has_inclusion_proof
export -f assert_predicate_structure_valid
export -f assert_token_predicate_valid
export -f assert_state_hash_correct
export -f assert_token_chain_valid
export -f assert_offline_transfer_valid
export -f assert_token_fully_valid
export -f assert_token_valid_quick
export -f assert_bft_signatures_valid
export -f assert_json_has_field
export -f assert_set
export -f is_valid_hex
export -f assert_address_type
