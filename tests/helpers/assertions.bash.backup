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
assert_json_field_equals() {
  local file="${1:?File path required}"
  local field="${2:?JSON field required}"
  local expected="${3:?Expected value required}"

  if [[ ! -f "$file" ]]; then
    printf "${COLOR_RED}✗ Assertion Failed: File not found${COLOR_RESET}\n" >&2
    printf "  File: %s\n" "$file" >&2
    return 1
  fi

  local actual
  actual=$(jq -r "$field" "$file" 2>/dev/null || echo "")

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

  if ! jq -e "$field" "$file" >/dev/null 2>&1; then
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

  if jq -e "$field" "$file" >/dev/null 2>&1; then
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

  if jq -e '.offlineTransfer' "$file" >/dev/null 2>&1; then
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
  actual_type=$(jq -r '.genesis.data.tokenType' "$file" 2>/dev/null)

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
