#!/usr/bin/env bats
# Functional tests for gen-address command
# Test Suite: GEN_ADDR (16 test scenarios)

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common
    SECRET=$(generate_test_secret "gen-addr")
}

teardown() {
    teardown_common
}

# GEN_ADDR-001: Generate Unmasked Address with Default Preset (UCT)
@test "GEN_ADDR-001: Generate unmasked address with default UCT preset" {
    log_test "Generating unmasked UCT address"

    # Execute command without nonce (unmasked)
    run_cli_with_secret "${SECRET}" "gen-address > address.json"
    assert_success

    # Verify JSON structure
    assert_file_exists "address.json"

    # Check address type is unmasked
    local addr_type
    addr_type=$(extract_json_field "address.json" "type")
    assert_equals "unmasked" "${addr_type}"

    # Check address format
    local address
    address=$(extract_json_field "address.json" "address")
    assert_address_type "${address}" "unmasked"

    # Check token type is UCT
    assert_json_field_equals "address.json" "tokenType" "${TOKEN_TYPE_UCT}"

    # Check preset info
    assert_json_field_equals "address.json" "tokenTypeInfo.preset" "uct"
    assert_json_field_equals "address.json" "tokenTypeInfo.name" "unicity"
}

# GEN_ADDR-002: Generate Masked Address with NFT Preset
@test "GEN_ADDR-002: Generate masked address with NFT preset" {
    log_test "Generating masked NFT address"

    local nonce
    nonce=$(generate_test_nonce "nft")

    # Execute with nonce (masked) and NFT preset
    run_cli_with_secret "${SECRET}" "gen-address --preset nft -n '${nonce}' > address.json"
    assert_success

    # Verify masked address
    assert_file_exists "address.json"
    local addr_type
    addr_type=$(extract_json_field "address.json" "type")
    assert_equals "masked" "${addr_type}"

    # Check address has engine ID 1 (masked)
    local address
    address=$(extract_json_field "address.json" "address")
    assert_address_type "${address}" "masked"

    # Check nonce is present
    assert_json_field_exists "address.json" "nonce"

    # Check token type is NFT
    assert_json_field_equals "address.json" "tokenType" "${TOKEN_TYPE_NFT}"
    assert_json_field_equals "address.json" "tokenTypeInfo.preset" "nft"
}

# GEN_ADDR-003: NFT Unmasked
@test "GEN_ADDR-003: Generate unmasked NFT address" {
    run_cli_with_secret "${SECRET}" "gen-address --preset nft > address.json"
    assert_success

    assert_json_field_equals "address.json" "type" "unmasked"
    assert_json_field_equals "address.json" "tokenType" "${TOKEN_TYPE_NFT}"
}

# GEN_ADDR-004: NFT Masked
@test "GEN_ADDR-004: Generate masked NFT address" {
    local nonce
    nonce=$(generate_test_nonce)

    run_cli_with_secret "${SECRET}" "gen-address --preset nft -n '${nonce}' > address.json"
    assert_success

    assert_json_field_equals "address.json" "type" "masked"
    assert_json_field_equals "address.json" "tokenType" "${TOKEN_TYPE_NFT}"
}

# GEN_ADDR-005: UCT Unmasked
@test "GEN_ADDR-005: Generate unmasked UCT address" {
    run_cli_with_secret "${SECRET}" "gen-address --preset uct > address.json"
    assert_success

    assert_json_field_equals "address.json" "type" "unmasked"
    assert_json_field_equals "address.json" "tokenType" "${TOKEN_TYPE_UCT}"
}

# GEN_ADDR-006: UCT Masked
@test "GEN_ADDR-006: Generate masked UCT address" {
    local nonce
    nonce=$(generate_test_nonce)

    run_cli_with_secret "${SECRET}" "gen-address --preset uct -n '${nonce}' > address.json"
    assert_success

    assert_json_field_equals "address.json" "type" "masked"
    assert_json_field_equals "address.json" "tokenType" "${TOKEN_TYPE_UCT}"
}

# GEN_ADDR-007: ALPHA Unmasked
@test "GEN_ADDR-007: Generate unmasked ALPHA address" {
    run_cli_with_secret "${SECRET}" "gen-address --preset alpha > address.json"
    assert_success

    assert_json_field_equals "address.json" "type" "unmasked"
    assert_json_field_equals "address.json" "tokenType" "${TOKEN_TYPE_ALPHA}"
}

# GEN_ADDR-008: ALPHA Masked
@test "GEN_ADDR-008: Generate masked ALPHA address" {
    local nonce
    nonce=$(generate_test_nonce)

    run_cli_with_secret "${SECRET}" "gen-address --preset alpha -n '${nonce}' > address.json"
    assert_success

    assert_json_field_equals "address.json" "type" "masked"
    assert_json_field_equals "address.json" "tokenType" "${TOKEN_TYPE_ALPHA}"
}

# GEN_ADDR-009: USDU Unmasked
@test "GEN_ADDR-009: Generate unmasked USDU address" {
    run_cli_with_secret "${SECRET}" "gen-address --preset usdu > address.json"
    assert_success

    assert_json_field_equals "address.json" "type" "unmasked"
    assert_json_field_equals "address.json" "tokenType" "${TOKEN_TYPE_USDU}"
}

# GEN_ADDR-010: USDU Masked
@test "GEN_ADDR-010: Generate masked USDU address" {
    local nonce
    nonce=$(generate_test_nonce)

    run_cli_with_secret "${SECRET}" "gen-address --preset usdu -n '${nonce}' > address.json"
    assert_success

    assert_json_field_equals "address.json" "type" "masked"
    assert_json_field_equals "address.json" "tokenType" "${TOKEN_TYPE_USDU}"
}

# GEN_ADDR-011: EURU Unmasked
@test "GEN_ADDR-011: Generate unmasked EURU address" {
    run_cli_with_secret "${SECRET}" "gen-address --preset euru > address.json"
    assert_success

    assert_json_field_equals "address.json" "type" "unmasked"
    assert_json_field_equals "address.json" "tokenType" "${TOKEN_TYPE_EURU}"
}

# GEN_ADDR-012: EURU Masked
@test "GEN_ADDR-012: Generate masked EURU address" {
    local nonce
    nonce=$(generate_test_nonce)

    run_cli_with_secret "${SECRET}" "gen-address --preset euru -n '${nonce}' > address.json"
    assert_success

    assert_json_field_equals "address.json" "type" "masked"
    assert_json_field_equals "address.json" "tokenType" "${TOKEN_TYPE_EURU}"
}

# GEN_ADDR-013: Custom Token Type (64-char Hex)
@test "GEN_ADDR-013: Generate address with custom 64-char hex token type" {
    local custom_type="1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

    run_cli_with_secret "${SECRET}" "gen-address -y ${custom_type} > address.json"
    assert_success

    # Should use custom type directly (no hashing for 64-char hex)
    assert_json_field_equals "address.json" "tokenType" "${custom_type}"

    # No tokenTypeInfo for custom types
    local has_info
    has_info=$(jq 'has("tokenTypeInfo")' address.json)
    assert_equals "false" "${has_info}" "Custom type should not have tokenTypeInfo"
}

# GEN_ADDR-014: Custom Token Type (Text, Hashed)
@test "GEN_ADDR-014: Generate address with text token type (hashed)" {
    local custom_text="my-custom-token-type"

    run_cli_with_secret "${SECRET}" "gen-address -y '${custom_text}' > address.json"
    assert_success

    # Should hash the text to 256-bit
    local token_type
    token_type=$(extract_json_field "address.json" "tokenType")
    assert_set token_type
    is_valid_hex "${token_type}" 64

    # No tokenTypeInfo for custom types
    local has_info
    has_info=$(jq 'has("tokenTypeInfo")' address.json)
    assert_equals "false" "${has_info}"
}

# GEN_ADDR-015: Nonce Processing (64-char Hex)
@test "GEN_ADDR-015: Generate masked address with explicit 64-char hex nonce" {
    local hex_nonce="fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"

    run_cli_with_secret "${SECRET}" "gen-address -n ${hex_nonce} > address.json"
    assert_success

    # Nonce should be used directly (no hashing)
    assert_json_field_equals "address.json" "nonce" "${hex_nonce}"
    assert_json_field_equals "address.json" "type" "masked"
}

# GEN_ADDR-016: Nonce Processing (Text, Hashed)
@test "GEN_ADDR-016: Generate masked address with text nonce (hashed)" {
    local text_nonce="my-nonce-text"

    run_cli_with_secret "${SECRET}" "gen-address -n '${text_nonce}' > address.json"
    assert_success

    # Nonce should be hashed to 256-bit
    local nonce
    nonce=$(extract_json_field "address.json" "nonce")
    assert_set nonce
    is_valid_hex "${nonce}" 64

    # Should be masked address
    assert_json_field_equals "address.json" "type" "masked"
}
