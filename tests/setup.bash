#!/usr/bin/env bash
# =============================================================================
# Global Test Setup for Unicity CLI Test Suite
# =============================================================================
# This file is sourced by BATS before running any tests. It loads all helper
# modules, validates the environment, and optionally waits for the aggregator
# to be ready.
#
# Usage:
#   BATS automatically loads this file if present in tests/ directory
#   Can also be manually sourced: source tests/setup.bash
# =============================================================================

# Strict error handling
set -euo pipefail

# -----------------------------------------------------------------------------
# Module Loading
# -----------------------------------------------------------------------------

# Get directory of this script
TESTS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

# Load configuration
# shellcheck source=./config/test-config.env
source "${TESTS_ROOT}/config/test-config.env"

# Load core helpers
# shellcheck source=./helpers/common.bash
source "${TESTS_ROOT}/helpers/common.bash"

# shellcheck source=./helpers/id-generation.bash
source "${TESTS_ROOT}/helpers/id-generation.bash"

# shellcheck source=./helpers/token-helpers.bash
source "${TESTS_ROOT}/helpers/token-helpers.bash"

# shellcheck source=./helpers/assertions.bash
source "${TESTS_ROOT}/helpers/assertions.bash"

# -----------------------------------------------------------------------------
# Environment Validation
# -----------------------------------------------------------------------------

# Validate test environment (binaries, CLI, etc.)
if ! validate_test_environment; then
  printf "ERROR: Test environment validation failed\n" >&2
  printf "Please ensure all required dependencies are installed and the CLI is built\n" >&2
  exit 1
fi

# -----------------------------------------------------------------------------
# Aggregator Readiness
# -----------------------------------------------------------------------------

# Wait for aggregator if configured
if [[ "${UNICITY_TEST_WAIT_FOR_AGGREGATOR:-1}" == "1" ]]; then
  if [[ "${UNICITY_TEST_SKIP_EXTERNAL:-0}" != "1" ]]; then
    # Only wait if not skipping external services
    if ! wait_for_aggregator; then
      printf "ERROR: Aggregator not ready at %s\n" "${UNICITY_AGGREGATOR_URL}" >&2
      printf "Cannot run tests without aggregator. Tests MUST fail if aggregator unavailable.\n" >&2
      printf "To skip tests requiring external services, set UNICITY_TEST_SKIP_EXTERNAL=1\n" >&2
      exit 1
    fi
  fi
fi

# -----------------------------------------------------------------------------
# Test Configuration Summary
# -----------------------------------------------------------------------------

if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
  print_test_config
  print_id_stats
fi

# -----------------------------------------------------------------------------
# Global Cleanup Hook
# -----------------------------------------------------------------------------

# Register cleanup handler for test suite
# This runs when the entire test suite finishes
cleanup_test_suite() {
  if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
    printf "\n=============================================================================\n" >&2
    printf "Test Suite Complete\n" >&2
    printf "=============================================================================\n" >&2
  fi

  # Clean up lock files
  if [[ -n "${UNICITY_ID_LOCK_FILE:-}" ]] && [[ -f "$UNICITY_ID_LOCK_FILE" ]]; then
    if ! rm -f -- "$UNICITY_ID_LOCK_FILE" 2>/dev/null; then
      printf "WARNING: Failed to remove lock file: %s\n" "$UNICITY_ID_LOCK_FILE" >&2
    fi
  fi
}

# Register cleanup (will run on EXIT)
trap cleanup_test_suite EXIT

# -----------------------------------------------------------------------------
# Test Suite Information
# -----------------------------------------------------------------------------

if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
  printf "\n=============================================================================\n" >&2
  printf "Unicity CLI Test Suite\n" >&2
  printf "=============================================================================\n" >&2
  printf "BATS Version: %s\n" "$(bats --version 2>/dev/null || echo 'unknown')" >&2
  printf "Shell: %s\n" "${BASH_VERSION}" >&2
  printf "=============================================================================\n\n" >&2
fi
