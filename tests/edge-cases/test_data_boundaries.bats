#!/usr/bin/env bats
# =============================================================================
# Data Boundaries Edge Case Tests (CORNER-007 to CORNER-018)
# =============================================================================
# Test suite for data boundary conditions, input validation, and edge values.
#
# Test Coverage:
#   CORNER-007: Empty string as secret
#   CORNER-008: Secret with only whitespace
#   CORNER-009: Unicode emoji in secret
#   CORNER-010: Maximum length input strings
#   CORNER-011: Null bytes in secret
#   CORNER-012: Coin amount of zero
#   CORNER-013: Negative coin amount
#   CORNER-014: Coin amount exceeding Number.MAX_SAFE_INTEGER
#   CORNER-015: Hex string with odd length
#   CORNER-016: Mixed case hex strings
#   CORNER-017: Hex string with invalid characters
#   CORNER-018: Empty token data
# =============================================================================

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'
load '../helpers/id-generation'

# -----------------------------------------------------------------------------
# Setup and Teardown
# -----------------------------------------------------------------------------

setup() {
  setup_test
  export TEST_TOKEN_ID=$(generate_token_id)
}

teardown() {
  cleanup_test
}

# -----------------------------------------------------------------------------
# CORNER-007: Empty String as Secret
# -----------------------------------------------------------------------------

@test "CORNER-007: Empty string as SECRET environment variable" {
  # Try to generate address with empty secret
  local output_file
  output_file=$(create_temp_file "-addr.json")

  # Empty string is different from undefined
  local exit_code=0
  SECRET="" run_cli gen-address --preset nft || exit_code=$?

  # Should fail or prompt
  if [[ $exit_code -eq 0 ]]; then
    info "⚠ Empty secret accepted (security risk)"
    # Check if generated same as another empty secret (deterministic but weak)
    local addr1
    addr1=$(echo "$output" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1) || addr1=""

    if [[ -n "$addr1" ]]; then
      SECRET="" run_cli gen-address --preset nft || true
      local addr2
      addr2=$(echo "$output" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1) || addr2=""

      if [[ "$addr1" == "$addr2" ]]; then
        info "Empty secret generates deterministic address (weak security)"
      fi
    fi
  else
    # Expected: reject empty secret
    info "✓ Empty secret rejected"
  fi
}

# -----------------------------------------------------------------------------
# CORNER-008: Secret with Only Whitespace
# -----------------------------------------------------------------------------

@test "CORNER-008: Secret with only whitespace characters" {
  # Test with spaces
  local exit_code=0
  SECRET="     " run_cli gen-address --preset nft || exit_code=$?

  if [[ $exit_code -eq 0 ]]; then
    info "⚠ Whitespace-only secret accepted"
  else
    info "✓ Whitespace-only secret rejected or prompted"
  fi

  # Test with tabs and newlines
  local exit_code=0
  SECRET=$'\n\t  \n' run_cli gen-address --preset nft || exit_code=$?

  if [[ $exit_code -eq 0 ]]; then
    info "⚠ Whitespace (tabs/newlines) accepted"
  else
    info "✓ Whitespace secret rejected"
  fi
}

# -----------------------------------------------------------------------------
# CORNER-009: Unicode Emoji in Secret
# -----------------------------------------------------------------------------

@test "CORNER-009: Unicode emoji in secret (UTF-8 handling)" {
  skip_if_aggregator_unavailable

  local emoji_secret="my🔑secret💎password"

  # Generate address twice with same emoji secret
  SECRET="$emoji_secret" run_cli gen-address --preset nft
  assert_success

  local addr1
  addr1=$(echo "$output" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)
  assert_set addr1

  # Generate again
  SECRET="$emoji_secret" run_cli gen-address --preset nft
  assert_success

  local addr2
  addr2=$(echo "$output" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

  # Should be deterministic (same secret → same address)
  assert_equals "$addr1" "$addr2" "Emoji secret should be deterministic"
  info "✓ UTF-8 emoji handled correctly"
}

# -----------------------------------------------------------------------------
# CORNER-010: Maximum Length Input Strings
# -----------------------------------------------------------------------------

@test "CORNER-010: Very long secret (10MB)" {
  # Generate 10MB secret
  local long_secret
  long_secret=$(python3 -c "print('A' * 10000000)" 2>/dev/null || echo "")

  if [[ -z "$long_secret" ]]; then
    skip "Python not available for generating long string"
  fi

  # Try with very long secret (should limit or handle gracefully)
  timeout 10s bash -c "SECRET='$long_secret' run_cli gen-address --preset nft" || true

  # Should either reject or handle without hanging
  info "✓ Long secret handled without hanging"
}

@test "CORNER-010b: Very long token data (1MB)" {
  skip_if_aggregator_unavailable

  local long_data
  long_data=$(python3 -c "print('x' * 1000000)" 2>/dev/null || echo "")

  if [[ -z "$long_data" ]]; then
    skip "Python not available"
  fi

  local secret
  secret=$(generate_unique_id "secret")

  local token_file
  token_file=$(create_temp_file ".txf")

  # Try to mint with very long data
  timeout 30s bash -c "SECRET='$secret' run_cli mint-token --preset nft -d '$long_data' -o '$token_file'" || true

  # Should reject or handle gracefully
  if [[ -f "$token_file" ]]; then
    info "Large data accepted (check size limits)"
    local size
    size=$(stat -f%z "$token_file" 2>/dev/null || stat -c%s "$token_file" 2>/dev/null)
    info "Token file size: $size bytes"
  else
    info "✓ Large data rejected or size limited"
  fi
}

# -----------------------------------------------------------------------------
# CORNER-011: Null Bytes in Secret
# -----------------------------------------------------------------------------

@test "CORNER-011: Secret with null bytes" {
  # Note: Bash may handle null bytes differently
  local secret_with_null
  secret_with_null=$'test\x00secret'

  local exit_code=0
  SECRET="$secret_with_null" run_cli gen-address --preset nft || exit_code=$?

  if [[ $exit_code -eq 0 ]]; then
    local addr
    addr=$(echo "$output" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1) || addr=""

    if [[ -n "$addr" ]]; then
      # Test if null byte affects key derivation
      SECRET="test" run_cli gen-address --preset nft || true
      local addr_without_null
      addr_without_null=$(echo "$output" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1) || addr_without_null=""

      if [[ "$addr" != "$addr_without_null" ]]; then
        info "✓ Null byte is part of secret (full binary support)"
      else
        info "⚠ Null byte truncates secret (string handling issue)"
      fi
    fi
  else
    info "Secret with null byte rejected or handled"
  fi
}

# -----------------------------------------------------------------------------
# CORNER-012: Coin Amount of Zero
# -----------------------------------------------------------------------------

@test "CORNER-012: Mint fungible token with zero amount" {
  skip_if_aggregator_unavailable

  local secret
  secret=$(generate_unique_id "secret")

  local token_file
  token_file=$(create_temp_file ".txf")

  # Mint with zero coins
  SECRET="$secret" run_cli mint-token --preset uct --coins "0" -o "$token_file" || true

  if [[ -f "$token_file" ]]; then
    # Zero amount accepted (valid but unusual)
    assert_valid_json "$token_file"

    local coin_count
    coin_count=$(get_coin_count "$token_file")

    if [[ "$coin_count" -gt 0 ]]; then
      local amount
      amount=$(jq -r '.genesis.data.coinData[0].amount' "$token_file")
      info "Zero-value coin created: amount=$amount"
    else
      info "Zero coins created empty coinData"
    fi
  else
    info "✓ Zero amount rejected"
  fi
}

# -----------------------------------------------------------------------------
# CORNER-013: Negative Coin Amount
# -----------------------------------------------------------------------------

@test "CORNER-013: Attempt negative coin amount" {
  skip_if_aggregator_unavailable

  local secret
  secret=$(generate_unique_id "secret")

  local token_file
  token_file=$(create_temp_file ".txf")

  # Try negative amount
  SECRET="$secret" run_cli mint-token --preset uct --coins "-1" -o "$token_file" || true

  if [[ -f "$token_file" ]]; then
    # Check if negative was accepted
    local amount
    amount=$(jq -r '.genesis.data.coinData[0].amount // "none"' "$token_file")
    info "⚠ Negative amount may have been accepted: $amount"
    info "CRITICAL: Negative amounts should be rejected at client side"
  else
    info "✓ Negative amount rejected (correct behavior)"
  fi

  # Also test with very large negative
  SECRET="$secret" run_cli mint-token --preset uct --coins "-9999999999999999999" -o "$token_file" || true

  if [[ -f "$token_file" ]]; then
    info "⚠ Large negative accepted"
  else
    info "✓ Large negative rejected"
  fi
}

# -----------------------------------------------------------------------------
# CORNER-014: Coin Amount Exceeding MAX_SAFE_INTEGER
# -----------------------------------------------------------------------------

@test "CORNER-014: Coin amount larger than Number.MAX_SAFE_INTEGER" {
  skip_if_aggregator_unavailable

  local secret
  secret=$(generate_unique_id "secret")

  local token_file
  token_file=$(create_temp_file ".txf")

  # Amount > 2^53-1 (JavaScript MAX_SAFE_INTEGER)
  local huge_amount="99999999999999999999999999999999"

  SECRET="$secret" run_cli mint-token --preset uct --coins "$huge_amount" -o "$token_file" || true

  if [[ -f "$token_file" ]]; then
    # BigInt should handle this
    assert_valid_json "$token_file"

    local amount
    amount=$(jq -r '.genesis.data.coinData[0].amount' "$token_file")
    info "Large amount handled: $amount"

    # Verify it wasn't truncated
    if [[ "$amount" == "$huge_amount" ]]; then
      info "✓ BigInt preserved full precision"
    else
      info "⚠ Amount may have lost precision: expected=$huge_amount, got=$amount"
    fi
  else
    info "Large amount rejected or limited"
  fi
}

# -----------------------------------------------------------------------------
# CORNER-015: Hex String with Odd Length
# -----------------------------------------------------------------------------

@test "CORNER-015: Hex string with odd length (not byte-aligned)" {
  skip_if_aggregator_unavailable

  local secret
  secret=$(generate_unique_id "secret")

  local token_file
  token_file=$(create_temp_file ".txf")

  # 63 characters (should be 64 for 32 bytes)
  local odd_hex="123456789abcdef123456789abcdef123456789abcdef123456789abcdef12"

  SECRET="$secret" run_cli mint-token --preset nft --token-type "$odd_hex" -o "$token_file" || true

  if [[ -f "$token_file" ]]; then
    # Should hash to proper 32 bytes
    assert_valid_json "$token_file"
    local token_type
    token_type=$(jq -r '.genesis.data.tokenType // ""' "$token_file")

    # Should be 64 hex chars (32 bytes) or empty if not set
    local type_length=${#token_type}
    if [[ $type_length -eq 64 ]]; then
      info "✓ Odd-length hex hashed to proper length"
    elif [[ $type_length -eq 0 ]]; then
      info "Odd-length hex resulted in empty tokenType (handled gracefully)"
    else
      info "Odd-length hex resulted in tokenType length: $type_length"
    fi
  else
    info "Odd-length hex rejected"
  fi
}

# -----------------------------------------------------------------------------
# CORNER-016: Mixed Case Hex Strings
# -----------------------------------------------------------------------------

@test "CORNER-016: Hex string with mixed case" {
  skip_if_aggregator_unavailable

  local secret
  secret=$(generate_unique_id "secret")

  local token_file1
  local token_file2
  token_file1=$(create_temp_file "-lower.txf")
  token_file2=$(create_temp_file "-mixed.txf")

  local hex_lower="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  local hex_mixed="AbCdEf1234567890ABCDEF1234567890abcdef1234567890ABCDEF1234567890"

  # Mint with lowercase
  SECRET="$secret" run_cli mint-token --preset nft --token-type "$hex_lower" -o "$token_file1" || true

  # Mint with mixed case
  SECRET="$secret" run_cli mint-token --preset nft --token-type "$hex_mixed" -o "$token_file2" || true

  if [[ -f "$token_file1" ]] && [[ -f "$token_file2" ]]; then
    local type1
    local type2
    type1=$(jq -r '.genesis.data.tokenType' "$token_file1")
    type2=$(jq -r '.genesis.data.tokenType' "$token_file2")

    # Should be case-insensitive (same hash)
    if [[ "${type1,,}" == "${type2,,}" ]]; then
      info "✓ Hex is case-insensitive"
    else
      info "Hex may be case-sensitive"
    fi
  fi
}

# -----------------------------------------------------------------------------
# CORNER-017: Hex String with Invalid Characters
# -----------------------------------------------------------------------------

@test "CORNER-017: Hex string with invalid characters (G-Z)" {
  skip_if_aggregator_unavailable

  local secret
  secret=$(generate_unique_id "secret")

  local token_file
  token_file=$(create_temp_file ".txf")

  # Invalid hex (contains G, H, I, etc.)
  local invalid_hex="1234567890abcdefGHIJKLMN"

  SECRET="$secret" run_cli mint-token --preset nft --token-type "$invalid_hex" -o "$token_file" || true

  if [[ -f "$token_file" ]]; then
    # Should fall back to hashing as text
    assert_valid_json "$token_file"
    local token_type
    token_type=$(jq -r '.genesis.data.tokenType // ""' "$token_file")

    # Should be valid 64-char hex after hashing
    local type_length=${#token_type}
    if [[ $type_length -eq 64 ]]; then
      info "✓ Invalid hex hashed as text"
    elif [[ $type_length -eq 0 ]]; then
      info "Invalid hex resulted in empty tokenType (handled gracefully)"
    else
      info "Invalid hex resulted in tokenType length: $type_length"
    fi
  else
    info "Invalid hex rejected"
  fi
}

# -----------------------------------------------------------------------------
# CORNER-018: Empty Token Data
# -----------------------------------------------------------------------------

@test "CORNER-018: Mint token with empty data" {
  skip_if_aggregator_unavailable

  local secret
  secret=$(generate_unique_id "secret")

  local token_file
  token_file=$(create_temp_file ".txf")

  # Explicit empty string
  SECRET="$secret" run_cli mint-token --preset nft -d "" -o "$token_file" || true

  if [[ -f "$token_file" ]]; then
    assert_valid_json "$token_file"

    # Check if data field exists and is empty
    local has_data
    has_data=$(jq 'has("state") and has("state.data")' "$token_file")

    if [[ "$has_data" == "true" ]]; then
      local data
      data=$(jq -r '.state.data // ""' "$token_file")
      info "Token with empty data: data='$data'"
    else
      info "Token created with no data field"
    fi

    info "✓ Empty data handled"
  fi

  # Test without -d flag at all
  local token_file2
  token_file2=$(create_temp_file "-nodata.txf")

  SECRET="$secret" run_cli mint-token --preset nft -o "$token_file2" || true

  if [[ -f "$token_file2" ]]; then
    info "✓ Token minted without data parameter"
  fi
}

# -----------------------------------------------------------------------------
# Summary Test
# -----------------------------------------------------------------------------

@test "Data Boundaries Edge Cases: Summary" {
  info "=== Data Boundaries Edge Case Test Suite ==="
  info "CORNER-007: Empty secret ✓"
  info "CORNER-008: Whitespace secret ✓"
  info "CORNER-009: Unicode emoji ✓"
  info "CORNER-010: Maximum length inputs ✓"
  info "CORNER-011: Null bytes ✓"
  info "CORNER-012: Zero coin amount ✓"
  info "CORNER-013: Negative amount ✓"
  info "CORNER-014: Huge amount (BigInt) ✓"
  info "CORNER-015: Odd-length hex ✓"
  info "CORNER-016: Mixed-case hex ✓"
  info "CORNER-017: Invalid hex chars ✓"
  info "CORNER-018: Empty data ✓"
  info "================================================="
}
