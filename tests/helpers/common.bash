#!/usr/bin/env bash
# =============================================================================
# Common Test Helpers for Unicity CLI Test Suite
# =============================================================================
# This module provides common setup, teardown, and utility functions used
# across all test categories. It handles test environment initialization,
# temporary file management, and core test infrastructure.
#
# Usage:
#   source tests/helpers/common.bash
#   setup_test
#   cleanup_test
# =============================================================================

# Strict error handling
set -euo pipefail

# -----------------------------------------------------------------------------
# Path Resolution
# -----------------------------------------------------------------------------

# Get absolute path to tests directory
# Returns: Absolute path to tests/ directory
get_tests_dir() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
  printf "%s" "$script_dir"
}

# Get absolute path to project root
# Returns: Absolute path to project root directory
get_project_root() {
  local tests_dir
  tests_dir="$(get_tests_dir)"
  printf "%s" "$(dirname "$tests_dir")"
}

# Get absolute path to CLI binary
# Returns: Absolute path to CLI binary
get_cli_path() {
  local project_root
  project_root="$(get_project_root)"
  printf "%s/%s" "$project_root" "${UNICITY_CLI_BIN:-dist/index.js}"
}

# -----------------------------------------------------------------------------
# Test Environment Setup
# -----------------------------------------------------------------------------

# Global setup for all tests
# Initializes test environment, loads configuration, creates temp directories
setup_test() {
  # Enable trace mode if configured
  if [[ "${UNICITY_TEST_TRACE:-0}" == "1" ]]; then
    set -x
  fi

  # Load configuration
  local tests_dir
  tests_dir="$(get_tests_dir)"

  # Source configuration if not already loaded
  if [[ -z "${UNICITY_AGGREGATOR_URL:-}" ]]; then
    # shellcheck source=../config/test-config.env
    source "${tests_dir}/config/test-config.env"
  fi

  # Source ID generation helpers
  # shellcheck source=./id-generation.bash
  source "${tests_dir}/helpers/id-generation.bash"

  # Create temporary directory for this test
  export BATS_TEST_TMPDIR="${TMPDIR:-/tmp}/bats-test-$$-${RANDOM}"
  mkdir -p "$BATS_TEST_TMPDIR"

  # Create test-specific temp directory
  export TEST_TEMP_DIR="${BATS_TEST_TMPDIR}/test-${BATS_TEST_NUMBER:-0}"
  mkdir -p "$TEST_TEMP_DIR"

  # Set up test artifacts directory
  export TEST_ARTIFACTS_DIR="${TEST_TEMP_DIR}/artifacts"
  mkdir -p "$TEST_ARTIFACTS_DIR"

  # Initialize test metadata
  export TEST_START_TIME=$(date +%s)
  export TEST_RUN_ID=$(generate_test_run_id)

  # Debug output
  if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
    printf "=== Test Setup ===\n" >&2
    printf "Test Run ID: %s\n" "$TEST_RUN_ID" >&2
    printf "Temp Dir: %s\n" "$TEST_TEMP_DIR" >&2
    printf "Artifacts Dir: %s\n" "$TEST_ARTIFACTS_DIR" >&2
  fi
}

# Global teardown for all tests
# Cleans up temporary files and directories
cleanup_test() {
  local exit_code=$?

  # Calculate test duration
  if [[ -n "${TEST_START_TIME:-}" ]]; then
    local end_time duration
    end_time=$(date +%s)
    duration=$((end_time - TEST_START_TIME))

    if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
      printf "=== Test Teardown ===\n" >&2
      printf "Duration: %d seconds\n" "$duration" >&2
      printf "Exit Code: %d\n" "$exit_code" >&2
    fi
  fi

  # Keep temp files if configured or test failed
  if [[ "${UNICITY_TEST_KEEP_TMP:-0}" == "1" ]] || [[ "$exit_code" -ne 0 ]]; then
    if [[ -n "${TEST_TEMP_DIR:-}" ]] && [[ -d "$TEST_TEMP_DIR" ]]; then
      printf "Test artifacts preserved at: %s\n" "$TEST_TEMP_DIR" >&2
    fi
  else
    # Clean up temporary directory
    if [[ -n "${BATS_TEST_TMPDIR:-}" ]] && [[ -d "$BATS_TEST_TMPDIR" ]]; then
      rm -rf -- "$BATS_TEST_TMPDIR"
    fi
  fi

  # Disable trace mode
  if [[ "${UNICITY_TEST_TRACE:-0}" == "1" ]]; then
    set +x
  fi

  return "$exit_code"
}

# -----------------------------------------------------------------------------
# Temporary File Management
# -----------------------------------------------------------------------------

# Create temporary file in test directory
# Args:
#   $1: File suffix (optional)
# Returns: Path to temporary file
create_temp_file() {
  local suffix="${1:-}"
  local temp_file

  if [[ -n "$suffix" ]]; then
    temp_file="${TEST_TEMP_DIR}/tmp-${RANDOM}${suffix}"
  else
    temp_file="${TEST_TEMP_DIR}/tmp-${RANDOM}"
  fi

  touch "$temp_file"
  printf "%s" "$temp_file"
}

# Create temporary directory in test directory
# Args:
#   $1: Directory suffix (optional)
# Returns: Path to temporary directory
create_temp_dir() {
  local suffix="${1:-}"
  local temp_dir

  if [[ -n "$suffix" ]]; then
    temp_dir="${TEST_TEMP_DIR}/tmpdir-${RANDOM}-${suffix}"
  else
    temp_dir="${TEST_TEMP_DIR}/tmpdir-${RANDOM}"
  fi

  mkdir -p "$temp_dir"
  printf "%s" "$temp_dir"
}

# Create artifact file (preserved even if test passes)
# Args:
#   $1: Artifact name
# Returns: Path to artifact file
create_artifact_file() {
  local name="${1:?Artifact name required}"
  local artifact_file="${TEST_ARTIFACTS_DIR}/${name}"

  mkdir -p "$(dirname "$artifact_file")"
  touch "$artifact_file"
  printf "%s" "$artifact_file"
}

# -----------------------------------------------------------------------------
# CLI Execution Helpers
# -----------------------------------------------------------------------------

# Run CLI command with proper error handling
# Args:
#   $@: CLI command and arguments
# Returns: CLI exit code
# Outputs: Sets $output variable with command output
run_cli() {
  local cli_path
  cli_path="$(get_cli_path)"

  # Check CLI binary exists
  if [[ ! -f "$cli_path" ]]; then
    printf "ERROR: CLI binary not found at: %s\n" "$cli_path" >&2
    printf "Hint: Run 'npm run build' to compile the CLI\n" >&2
    return 1
  fi

  # Execute CLI with timeout
  local timeout_cmd=""
  if command -v timeout >/dev/null 2>&1; then
    timeout_cmd="timeout ${UNICITY_CLI_TIMEOUT:-30}"
  fi

  # Capture output and exit code
  # Note: Only capture stdout, not stderr (diagnostic messages go to stderr)
  # Handle command string by using eval to properly parse arguments
  local exit_code=0
  if [[ -n "$timeout_cmd" ]]; then
    output=$(eval $timeout_cmd "${UNICITY_NODE_BIN:-node}" "$cli_path" "$@") || exit_code=$?
  else
    output=$(eval "${UNICITY_NODE_BIN:-node}" "$cli_path" "$@") || exit_code=$?
  fi

  # Debug output
  if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
    printf "=== CLI Execution ===\n" >&2
    printf "Command: %s %s\n" "$cli_path" "$*" >&2
    printf "Exit Code: %d\n" "$exit_code" >&2
    printf "Output:\n%s\n" "$output" >&2
  fi

  return "$exit_code"
}

# Run CLI command and expect success
# Args:
#   $@: CLI command and arguments
# Returns: 0 on success, 1 on failure
run_cli_expect_success() {
  if ! run_cli "$@"; then
    printf "ERROR: CLI command failed: %s\n" "$*" >&2
    printf "Output: %s\n" "$output" >&2
    return 1
  fi
  return 0
}

# Run CLI command and expect failure
# Args:
#   $@: CLI command and arguments
# Returns: 0 if command failed, 1 if command succeeded
run_cli_expect_failure() {
  if run_cli "$@"; then
    printf "ERROR: CLI command unexpectedly succeeded: %s\n" "$*" >&2
    printf "Output: %s\n" "$output" >&2
    return 1
  fi
  return 0
}

# -----------------------------------------------------------------------------
# Aggregator Health Check
# -----------------------------------------------------------------------------

# Check if aggregator is reachable
# Returns: 0 if reachable, 1 if not
check_aggregator_health() {
  local url="${UNICITY_AGGREGATOR_URL:-http://localhost:3000}"
  local max_retries="${UNICITY_AGGREGATOR_MAX_RETRIES:-3}"
  local retry_delay="${UNICITY_AGGREGATOR_RETRY_DELAY:-2}"

  for ((i=1; i<=max_retries; i++)); do
    if curl --silent --fail --max-time 5 "${url}/health" >/dev/null 2>&1; then
      return 0
    fi

    if [[ "$i" -lt "$max_retries" ]]; then
      if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
        printf "Aggregator health check failed, retrying in %d seconds... (%d/%d)\n" \
          "$retry_delay" "$i" "$max_retries" >&2
      fi
      sleep "$retry_delay"
    fi
  done

  return 1
}

# Wait for aggregator to be ready
# Returns: 0 if ready, 1 if timeout
wait_for_aggregator() {
  local timeout="${UNICITY_TEST_AGGREGATOR_WAIT_TIMEOUT:-60}"
  local start_time
  start_time=$(date +%s)

  if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
    printf "Waiting for aggregator at %s (timeout: %ds)...\n" \
      "${UNICITY_AGGREGATOR_URL}" "$timeout" >&2
  fi

  while true; do
    if check_aggregator_health; then
      if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
        printf "Aggregator is ready!\n" >&2
      fi
      return 0
    fi

    local current_time elapsed
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))

    if [[ "$elapsed" -ge "$timeout" ]]; then
      printf "ERROR: Aggregator not ready after %d seconds\n" "$timeout" >&2
      return 1
    fi

    sleep 2
  done
}

# Require aggregator to be available - FAIL if not available
# Usage: Call at the beginning of tests that require aggregator
# This function will FAIL the test (not skip) if aggregator is unavailable
# Tests requiring aggregator MUST fail when aggregator is down
require_aggregator() {
  if [[ "${UNICITY_TEST_SKIP_EXTERNAL:-0}" == "1" ]]; then
    skip "External services disabled (UNICITY_TEST_SKIP_EXTERNAL=1)"
  fi

  if ! check_aggregator_health; then
    printf "FATAL: Aggregator required but not available at %s\n" "${UNICITY_AGGREGATOR_URL}" >&2
    printf "Test requires aggregator. Cannot proceed.\n" >&2
    return 1  # FAIL the test, do not skip
  fi
}

# Legacy function for backwards compatibility - now calls require_aggregator
# DEPRECATED: Use require_aggregator() instead
skip_if_aggregator_unavailable() {
  require_aggregator
}

# -----------------------------------------------------------------------------
# Output Capture and Validation
# -----------------------------------------------------------------------------

# Save output to artifact file
# Args:
#   $1: Artifact name
#   $2: Content to save (optional, defaults to $output)
save_output_artifact() {
  local name="${1:?Artifact name required}"
  local content="${2:-${output:-}}"
  local artifact_file

  artifact_file=$(create_artifact_file "$name")
  printf "%s" "$content" > "$artifact_file"

  if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
    printf "Saved artifact: %s\n" "$artifact_file" >&2
  fi
}

# Extract JSON field from output
# Args:
#   $1: JSON path (e.g., ".data.token")
#   $2: Input JSON (optional, defaults to $output)
# Returns: Extracted value
extract_json_field() {
  local path="${1:?JSON path required}"
  local json="${2:-${output:-}}"

  if command -v jq >/dev/null 2>&1; then
    printf "%s" "$json" | jq -r "$path"
  else
    printf "ERROR: jq not found, cannot extract JSON field\n" >&2
    return 1
  fi
}

# Check if output contains string
# Args:
#   $1: String to search for
#   $2: Input to search (optional, defaults to $output)
# Returns: 0 if found, 1 if not found
output_contains() {
  local search="${1:?Search string required}"
  local text="${2:-${output:-}}"

  if printf "%s" "$text" | grep -qF -- "$search"; then
    return 0
  fi
  return 1
}

# Check if output matches regex
# Args:
#   $1: Regex pattern
#   $2: Input to search (optional, defaults to $output)
# Returns: 0 if matches, 1 if not
output_matches() {
  local pattern="${1:?Pattern required}"
  local text="${2:-${output:-}}"

  if printf "%s" "$text" | grep -qE -- "$pattern"; then
    return 0
  fi
  return 1
}

# -----------------------------------------------------------------------------
# Utility Functions
# -----------------------------------------------------------------------------

# Skip test with message
# Args:
#   $1: Skip message
skip() {
  printf "SKIP: %s\n" "${1:-Test skipped}" >&2
  exit 77  # Special exit code for skipped tests
}

# Print debug message
# Args:
#   $@: Message to print
debug() {
  if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
    printf "[DEBUG] %s\n" "$*" >&2
  fi
}

# Print info message
# Args:
#   $@: Message to print
info() {
  printf "[INFO] %s\n" "$*" >&2
}

# Print warning message
# Args:
#   $@: Message to print
warn() {
  printf "[WARN] %s\n" "$*" >&2
}

# Print error message
# Args:
#   $@: Message to print
error() {
  printf "[ERROR] %s\n" "$*" >&2
}

# Wrapper functions for BATS compatibility
setup_common() {
  setup_test
}

teardown_common() {
  cleanup_test
}

# Test logging function
log_test() {
  if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
    printf "[TEST] %s\n" "$*" >&2
  fi
}

# Generate test secret with unique suffix
generate_test_secret() {
  local prefix="${1:-test}"
  printf "secret-%s-%s-%d" "$prefix" "$(date +%s)" "$$"
}

# Generate test nonce
generate_test_nonce() {
  local prefix="${1:-test}"
  printf "nonce-%s-%s-%d" "$prefix" "$(date +%s)" "$$"
}

# Run CLI with secret in environment
run_cli_with_secret() {
  local secret="$1"
  shift
  SECRET="$secret" run_cli "$@"
}

# Validate test environment
validate_test_environment() {
  local missing=()

  # Check for required commands
  command -v node >/dev/null 2>&1 || missing+=("node")
  command -v jq >/dev/null 2>&1 || missing+=("jq")
  command -v curl >/dev/null 2>&1 || missing+=("curl")

  # Check CLI binary exists
  local cli_path
  cli_path="$(get_cli_path)"
  if [[ ! -f "$cli_path" ]]; then
    printf "ERROR: CLI binary not found at: %s\n" "$cli_path" >&2
    printf "Run 'npm run build' to compile the CLI\n" >&2
    return 1
  fi

  # Report missing dependencies
  if [[ ${#missing[@]} -gt 0 ]]; then
    printf "ERROR: Missing required commands: %s\n" "${missing[*]}" >&2
    return 1
  fi

  return 0
}

# Print test configuration
print_test_config() {
  printf "=== Test Configuration ===\n" >&2
  printf "Aggregator URL: %s\n" "${UNICITY_AGGREGATOR_URL:-http://localhost:3000}" >&2
  printf "CLI Path: %s\n" "$(get_cli_path)" >&2
  printf "Test Timeout: %s\n" "${UNICITY_CLI_TIMEOUT:-30}" >&2
  printf "Debug Mode: %s\n" "${UNICITY_TEST_DEBUG:-0}" >&2
}

# Export all public functions
export -f get_tests_dir
export -f get_project_root
export -f get_cli_path
export -f setup_test
export -f cleanup_test
export -f setup_common
export -f teardown_common
export -f create_temp_file
export -f create_temp_dir
export -f create_artifact_file
export -f run_cli
export -f run_cli_expect_success
export -f run_cli_expect_failure
export -f check_aggregator_health
export -f wait_for_aggregator
export -f skip_if_aggregator_unavailable
export -f save_output_artifact
export -f extract_json_field
export -f output_contains
export -f output_matches
export -f skip
export -f debug
export -f info
export -f warn
export -f error
export -f log_test
export -f generate_test_secret
export -f generate_test_nonce
export -f run_cli_with_secret
export -f validate_test_environment
export -f print_test_config
