#!/usr/bin/env bash
# =============================================================================
# Unique ID Generation for Unicity CLI Tests
# =============================================================================
# This module provides thread-safe, collision-resistant unique ID generation
# for test scenarios. The aggregator is append-only, so each test must use
# globally unique identifiers to avoid conflicts.
#
# Design:
#   - Combines timestamp, PID, counter, and random data for uniqueness
#   - Thread-safe counter with atomic increment
#   - Supports both UUID v4 and custom timestamp-based formats
#   - Prevents collisions even with parallel test execution
#
# Usage:
#   source tests/helpers/id-generation.bash
#   id=$(generate_unique_id)
#   token_id=$(generate_token_id)
# =============================================================================

# Strict error handling for this module
set -euo pipefail

# -----------------------------------------------------------------------------
# Module State
# -----------------------------------------------------------------------------

# Global counter for ID generation (initialized per shell session)
declare -g UNICITY_ID_COUNTER="${UNICITY_ID_COUNTER:-0}"

# Lock file for counter synchronization (prevents race conditions)
declare -g UNICITY_ID_LOCK_FILE="${TMPDIR:-/tmp}/unicity-id-counter-${USER:-unknown}.lock"

# Session identifier (unique per test runner process)
declare -g UNICITY_SESSION_ID=""

# -----------------------------------------------------------------------------
# Initialization
# -----------------------------------------------------------------------------

# Initialize session ID (called automatically on module load)
_init_session_id() {
  # Generate session ID from timestamp + PID + random
  # Format: YYYYMMDD-HHMMSS-PID-RANDOM
  local timestamp random_suffix
  timestamp=$(date +%Y%m%d-%H%M%S)
  random_suffix=$(printf "%04x" $((RANDOM * RANDOM % 65536)))
  UNICITY_SESSION_ID="${timestamp}-$$-${random_suffix}"
}

# Initialize on module load
_init_session_id

# -----------------------------------------------------------------------------
# Counter Management
# -----------------------------------------------------------------------------

# Atomically increment the global counter
# Returns: Next counter value
# Thread-safe: Uses flock for synchronization
_increment_counter() {
  local counter_value

  # Use flock for atomic counter increment
  (
    # Acquire exclusive lock (timeout after 5 seconds)
    if ! flock -x -w 5 200; then
      printf "ERROR: Failed to acquire lock for counter increment\n" >&2
      return 1
    fi

    # Read current counter value
    counter_value=$((UNICITY_ID_COUNTER + 1))
    UNICITY_ID_COUNTER=$counter_value

    # Output new counter value
    printf "%d" "$counter_value"

  ) 200>"${UNICITY_ID_LOCK_FILE}"
}

# -----------------------------------------------------------------------------
# Random Data Generation
# -----------------------------------------------------------------------------

# Generate cryptographically secure random hex string
# Args:
#   $1: Number of bytes (default: 8)
# Returns: Hex string
generate_random_hex() {
  local num_bytes="${1:-8}"

  # Try multiple sources in order of preference
  if [[ -c /dev/urandom ]]; then
    # Most Unix/Linux systems
    od -An -N"$num_bytes" -tx1 /dev/urandom | tr -d ' \n'
  elif command -v openssl >/dev/null 2>&1; then
    # Fallback to OpenSSL
    openssl rand -hex "$num_bytes" | tr -d '\n'
  else
    # Last resort: use RANDOM (not cryptographically secure)
    local hex=""
    for ((i=0; i<num_bytes*2; i++)); do
      hex+=$(printf "%x" $((RANDOM % 16)))
    done
    printf "%s" "$hex"
  fi
}

# -----------------------------------------------------------------------------
# UUID Generation
# -----------------------------------------------------------------------------

# Generate UUID v4 (random UUID)
# Returns: UUID in format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
generate_uuid_v4() {
  local uuid

  # Try uuidgen first (most systems)
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr '[:upper:]' '[:lower:]'
    return 0
  fi

  # Generate UUID v4 manually
  local hex
  hex=$(generate_random_hex 16)

  # Format as UUID v4
  # Set version (4) and variant (8, 9, a, or b) bits
  uuid=$(printf "%s" "$hex" | sed -E 's/^(.{8})(.{4})(.{4})(.{4})(.{12})$/\1-\2-4\3-\4-\5/')

  # Ensure variant bits are correct (set bit 6 and clear bit 7)
  printf "%s\n" "$uuid" | sed -E 's/-([0-9a-f]{4})-/-\1-/2' | sed -E 's/(-.{3})/\18/'
}

# -----------------------------------------------------------------------------
# Timestamp-Based ID Generation
# -----------------------------------------------------------------------------

# Generate timestamp-based unique ID
# Format: {prefix}-{timestamp}-{pid}-{counter}-{random}
# Args:
#   $1: Prefix (default: from config or "test")
# Returns: Unique ID string
generate_timestamp_id() {
  local prefix="${1:-${UNICITY_TEST_ID_PREFIX:-test}}"
  local timestamp counter random_suffix

  # High-resolution timestamp (nanoseconds if available)
  if [[ -n "${EPOCHREALTIME:-}" ]]; then
    # Bash 5.2+: microsecond precision
    timestamp=$(printf "%.0f" "$(echo "${EPOCHREALTIME} * 1000000" | bc 2>/dev/null || echo "${EPOCHREALTIME}000000")")
  else
    # Fallback: millisecond precision
    timestamp=$(date +%s%3N 2>/dev/null || echo "$(date +%s)000")
  fi

  # Atomic counter increment
  counter=$(_increment_counter)

  # Random suffix (8 bytes = 16 hex chars)
  random_suffix=$(generate_random_hex 8)

  # Construct ID
  printf "%s-%s-%d-%06d-%s" "$prefix" "$timestamp" "$$" "$counter" "$random_suffix"
}

# -----------------------------------------------------------------------------
# Public API
# -----------------------------------------------------------------------------

# Generate unique ID (respects UNICITY_TEST_USE_UUID config)
# Args:
#   $1: Prefix (optional, only used for timestamp-based IDs)
# Returns: Unique ID string
generate_unique_id() {
  local prefix="${1:-}"

  if [[ "${UNICITY_TEST_USE_UUID:-0}" == "1" ]]; then
    generate_uuid_v4
  else
    generate_timestamp_id "$prefix"
  fi
}

# Generate token-specific unique ID
# Format: token-{session}-{counter}-{random}
# Returns: Token ID string
generate_token_id() {
  local counter random_suffix

  counter=$(_increment_counter)
  random_suffix=$(generate_random_hex 4)

  printf "token-%s-%06d-%s" "$UNICITY_SESSION_ID" "$counter" "$random_suffix"
}

# Generate address-specific unique ID
# Format: addr-{session}-{counter}-{random}
# Returns: Address ID string
generate_address_id() {
  local counter random_suffix

  counter=$(_increment_counter)
  random_suffix=$(generate_random_hex 4)

  printf "addr-%s-%06d-%s" "$UNICITY_SESSION_ID" "$counter" "$random_suffix"
}

# Generate request-specific unique ID
# Format: req-{session}-{counter}-{random}
# Returns: Request ID string
generate_request_id() {
  local counter random_suffix

  counter=$(_increment_counter)
  random_suffix=$(generate_random_hex 4)

  printf "req-%s-%06d-%s" "$UNICITY_SESSION_ID" "$counter" "$random_suffix"
}

# Generate test-run-specific unique ID
# Format: run-{timestamp}-{pid}
# Returns: Test run ID string
generate_test_run_id() {
  local timestamp
  timestamp=$(date +%Y%m%d-%H%M%S)
  printf "run-%s-%d" "$timestamp" "$$"
}

# -----------------------------------------------------------------------------
# Utility Functions
# -----------------------------------------------------------------------------

# Reset counter (useful for testing this module)
# WARNING: Not thread-safe, only use in isolated tests
reset_id_counter() {
  UNICITY_ID_COUNTER=0
}

# Get current counter value
# Returns: Current counter value
get_current_counter() {
  printf "%d" "$UNICITY_ID_COUNTER"
}

# Get session ID
# Returns: Current session ID
get_session_id() {
  printf "%s" "$UNICITY_SESSION_ID"
}

# Validate ID format
# Args:
#   $1: ID string to validate
# Returns: 0 if valid, 1 if invalid
validate_id_format() {
  local id="${1:-}"

  if [[ -z "$id" ]]; then
    return 1
  fi

  # Check for UUID format
  if [[ "$id" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]]; then
    return 0
  fi

  # Check for timestamp-based format
  if [[ "$id" =~ ^[a-z]+-[0-9]+-[0-9]+-[0-9]+-[0-9a-f]+$ ]]; then
    return 0
  fi

  return 1
}

# -----------------------------------------------------------------------------
# Debug Functions
# -----------------------------------------------------------------------------

# Print ID generation statistics
print_id_stats() {
  cat <<EOF
=============================================================================
ID Generation Statistics
=============================================================================
Session ID:               ${UNICITY_SESSION_ID}
Current Counter:          ${UNICITY_ID_COUNTER}
Process ID:               $$
Lock File:                ${UNICITY_ID_LOCK_FILE}
UUID Mode:                ${UNICITY_TEST_USE_UUID:-0}
=============================================================================
EOF
}

# Export all public functions
export -f generate_unique_id
export -f generate_token_id
export -f generate_address_id
export -f generate_request_id
export -f generate_test_run_id
export -f generate_uuid_v4
export -f generate_random_hex
export -f validate_id_format
export -f reset_id_counter
export -f get_current_counter
export -f get_session_id
export -f print_id_stats
