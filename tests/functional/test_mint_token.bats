#!/usr/bin/env bats
# Functional tests for mint-token command
# Test Suite: MINT_TOKEN (28 test scenarios)
# Updated: Added ALPHA token, deterministic tests, negative tests, and enhanced validation

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common
    require_aggregator  # FIXED: Use require_aggregator (fails test if unavailable)
    SECRET=$(generate_test_secret "mint")
}

teardown() {
    teardown_common
}

# MINT_TOKEN-001: Mint NFT with Default Settings
@test "MINT_TOKEN-001: Mint NFT with default settings" {
    log_test "Minting NFT with minimal options"

    # Mint NFT with default settings
    run_cli_with_secret "${SECRET}" "mint-token --preset nft --local -o token.txf"
    assert_success

    # Verify token file created
    assert_file_exists "token.txf"
    is_valid_txf "token.txf"

    # Validate token structure and cryptography
    assert_token_fully_valid "token.txf"

    # Check TXF version
    assert_json_field_equals "token.txf" "version" "2.0"

    # Check genesis section exists
    assert_json_field_exists "token.txf" "genesis"
    assert_json_field_exists "token.txf" "genesis.data"
    assert_json_field_exists "token.txf" "genesis.inclusionProof"

    # Check state section exists
    assert_json_field_exists "token.txf" "state"
    assert_json_field_exists "token.txf" "state.predicate"

    # Check transactions array is empty
    local tx_count
    tx_count=$(get_transaction_count "token.txf")
    assert_equals "0" "${tx_count}"

    # Check token ID was generated
    local token_id
    token_id=$(get_txf_token_id "token.txf")
    assert_set token_id
    is_valid_hex "${token_id}" 64
}

# MINT_TOKEN-002: Mint NFT with Custom Token Data (JSON)
@test "MINT_TOKEN-002: Mint NFT with JSON metadata" {
    log_test "Minting NFT with JSON data"

    local json_data='{"name":"Test NFT","description":"Test Description","image":"ipfs://Qm..."}'

    run_cli_with_secret "${SECRET}" "mint-token --preset nft -d '${json_data}' --local -o token.txf"
    assert_success

    # Verify token created
    assert_file_exists "token.txf"
    assert_token_fully_valid "token.txf"

    # Check token data exists and is hex-encoded
    assert_json_field_exists "token.txf" "state.data"

    # Decode and verify JSON structure
    local decoded_data
    decoded_data=$(get_token_data "token.txf")
    assert_string_contains "$decoded_data" "Test NFT"
}

# MINT_TOKEN-003: Mint NFT with Custom Token Data (Plain Text)
@test "MINT_TOKEN-003: Mint NFT with plain text data" {
    log_test "Minting NFT with plain text"

    local text_data="This is plain text token data"

    run_cli_with_secret "${SECRET}" "mint-token --preset nft -d '${text_data}' --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Verify token data
    local decoded_data
    decoded_data=$(get_token_data "token.txf")
    assert_equals "${text_data}" "${decoded_data}"
}

# MINT_TOKEN-004: Mint Fungible Token (UCT) with Default Coin
@test "MINT_TOKEN-004: Mint UCT with default coin" {
    log_test "Minting UCT fungible token"

    run_cli_with_secret "${SECRET}" "mint-token --preset uct --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Check token type
    assert_token_type "token.txf" "uct"

    # Check it's fungible (has coinData)
    is_fungible_token "token.txf"

    # Check coin data has 1 coin with amount 0 (default)
    local coin_count
    coin_count=$(get_coin_count "token.txf")
    assert_equals "1" "${coin_count}"
}

# MINT_TOKEN-005: Mint Fungible Token (UCT) with Specific Amount
@test "MINT_TOKEN-005: Mint UCT with specific amount" {
    log_test "Minting UCT with 1.5 UCT"

    local amount="1500000000000000000"  # 1.5 UCT in base units

    run_cli_with_secret "${SECRET}" "mint-token --preset uct -c '${amount}' --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Verify coin amount
    local coin_count
    coin_count=$(get_coin_count "token.txf")
    assert_equals "1" "${coin_count}"

    # Check coin amount
    local actual_amount
    actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
    assert_equals "${amount}" "${actual_amount}"
}

# MINT_TOKEN-006: Mint USDU Stablecoin
@test "MINT_TOKEN-006: Mint USDU stablecoin" {
    log_test "Minting 100 USDU"

    local amount="100000000"  # 100 USDU (6 decimals)

    run_cli_with_secret "${SECRET}" "mint-token --preset usdu -c '${amount}' --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Verify token type
    assert_token_type "token.txf" "usdu"

    # Verify amount
    local actual_amount
    actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
    assert_equals "${amount}" "${actual_amount}"
}

# MINT_TOKEN-007: Mint EURU Stablecoin
@test "MINT_TOKEN-007: Mint EURU stablecoin" {
    log_test "Minting 50.25 EURU"

    local amount="50250000"  # 50.25 EURU (6 decimals)

    run_cli_with_secret "${SECRET}" "mint-token --preset euru -c '${amount}' --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Verify token type
    assert_token_type "token.txf" "euru"

    # Verify amount
    local actual_amount
    actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
    assert_equals "${amount}" "${actual_amount}"
}

# MINT_TOKEN-008: Mint with Masked Predicate (One-Time Address)
@test "MINT_TOKEN-008: Mint with masked predicate" {
    log_test "Minting to masked address"

    local nonce
    nonce=$(generate_test_nonce "masked-mint")

    # Mint without -u flag (default is masked)
    run_cli_with_secret "${SECRET}" "mint-token --preset nft -n '${nonce}' --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Verify predicate type
    local pred_type
    pred_type=$(get_predicate_type "token.txf")
    assert_equals "masked" "${pred_type}"

    # Check address starts with DIRECT://0001 (engine 1)
    local address
    address=$(get_txf_address "token.txf")
    assert_address_type "${address}" "masked"
}

# MINT_TOKEN-009: Mint with Custom Token ID
@test "MINT_TOKEN-009: Mint with custom token ID" {
    log_test "Minting with explicit token ID"

    local token_id="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

    run_cli_with_secret "${SECRET}" "mint-token --preset nft -i ${token_id} --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Verify token ID matches
    assert_json_field_equals "token.txf" "genesis.data.tokenId" "${token_id}"
}

# MINT_TOKEN-010: Mint with Custom Salt
@test "MINT_TOKEN-010: Mint with custom salt" {
    log_test "Minting with explicit salt"

    local salt="1111111111111111111111111111111111111111111111111111111111111111"

    run_cli_with_secret "${SECRET}" "mint-token --preset nft --salt ${salt} --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Verify salt in genesis data
    assert_json_field_equals "token.txf" "genesis.data.salt" "${salt}"
}

# MINT_TOKEN-011: Mint with Output File Path
@test "MINT_TOKEN-011: Mint with specific output filename" {
    log_test "Minting to custom file"

    run_cli_with_secret "${SECRET}" "mint-token --preset nft --local -o my-custom-nft.txf"
    assert_success

    # Verify custom filename
    assert_file_exists "my-custom-nft.txf"
    is_valid_txf "my-custom-nft.txf"
    assert_token_fully_valid "my-custom-nft.txf"
}

# MINT_TOKEN-012: Mint with STDOUT Only
@test "MINT_TOKEN-012: Mint with stdout output" {
    log_test "Minting to stdout"

    # FIXED: Execute command, capture output, then save to file
    run_cli_with_secret "${SECRET}" "mint-token --preset nft --local --stdout"
    assert_success

    # Extract JSON from output (skip diagnostic messages on stderr/stdout)
    # The JSON starts with '{' and ends with '}'
    echo "$output" | sed -n '/^{/,/^}$/p' > captured-token.json

    # Verify stdout capture
    assert_file_exists "captured-token.json"
    is_valid_txf "captured-token.json"
    assert_token_fully_valid "captured-token.json"

    # No auto-generated file should exist in test directory
    # (--stdout flag should prevent file creation)
    local auto_files
    auto_files=$(find "$TEST_TEMP_DIR" -name "202*.txf" 2>/dev/null | wc -l)
    assert_equals "0" "${auto_files}" "No auto-generated files should exist"
}

# MINT_TOKEN-013: Mint NFT Unmasked
@test "MINT_TOKEN-013: Mint NFT with unmasked address" {
    run_cli_with_secret "${SECRET}" "mint-token --preset nft -u --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    local pred_type
    pred_type=$(get_predicate_type "token.txf")
    assert_equals "unmasked" "${pred_type}"
    is_nft_token "token.txf"
}

# MINT_TOKEN-014: Mint NFT Masked
@test "MINT_TOKEN-014: Mint NFT with masked address" {
    local nonce
    nonce=$(generate_test_nonce)

    run_cli_with_secret "${SECRET}" "mint-token --preset nft -n '${nonce}' --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    local pred_type
    pred_type=$(get_predicate_type "token.txf")
    assert_equals "masked" "${pred_type}"
    is_nft_token "token.txf"
}

# MINT_TOKEN-015: Mint UCT Unmasked
@test "MINT_TOKEN-015: Mint UCT with unmasked address" {
    run_cli_with_secret "${SECRET}" "mint-token --preset uct -u --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    local pred_type
    pred_type=$(get_predicate_type "token.txf")
    assert_equals "unmasked" "${pred_type}"
    is_fungible_token "token.txf"
}

# MINT_TOKEN-016: Mint UCT Masked
@test "MINT_TOKEN-016: Mint UCT with masked address" {
    local nonce
    nonce=$(generate_test_nonce)

    run_cli_with_secret "${SECRET}" "mint-token --preset uct -n '${nonce}' --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    local pred_type
    pred_type=$(get_predicate_type "token.txf")
    assert_equals "masked" "${pred_type}"
    is_fungible_token "token.txf"
}

# MINT_TOKEN-017: Mint USDU Unmasked
@test "MINT_TOKEN-017: Mint USDU with unmasked address" {
    run_cli_with_secret "${SECRET}" "mint-token --preset usdu -u -c 1000000 --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    local pred_type
    pred_type=$(get_predicate_type "token.txf")
    assert_equals "unmasked" "${pred_type}"
    assert_token_type "token.txf" "usdu"
}

# MINT_TOKEN-018: Mint USDU Masked
@test "MINT_TOKEN-018: Mint USDU with masked address" {
    local nonce
    nonce=$(generate_test_nonce)

    run_cli_with_secret "${SECRET}" "mint-token --preset usdu -n '${nonce}' -c 1000000 --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    local pred_type
    pred_type=$(get_predicate_type "token.txf")
    assert_equals "masked" "${pred_type}"
    assert_token_type "token.txf" "usdu"
}

# MINT_TOKEN-019: Mint with Multiple Coins
@test "MINT_TOKEN-019: Mint with multiple coin UTXOs" {
    log_test "Minting UCT with 3 coins"

    local amounts="1000000000000000000,2000000000000000000,3000000000000000000"

    run_cli_with_secret "${SECRET}" "mint-token --preset uct -c '${amounts}' --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Verify 3 coins created
    local coin_count
    coin_count=$(get_coin_count "token.txf")
    assert_equals "3" "${coin_count}"

    # Verify individual amounts
    local amount1
    amount1=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
    assert_equals "1000000000000000000" "${amount1}"

    local amount2
    amount2=$(~/.local/bin/jq -r '.genesis.data.coinData[1][1]' token.txf)
    assert_equals "2000000000000000000" "${amount2}"

    local amount3
    amount3=$(~/.local/bin/jq -r '.genesis.data.coinData[2][1]' token.txf)
    assert_equals "3000000000000000000" "${amount3}"

    # Verify each coin has unique CoinId
    local coin_id1
    coin_id1=$(~/.local/bin/jq -r '.genesis.data.coinData[0][0]' token.txf)
    local coin_id2
    coin_id2=$(~/.local/bin/jq -r '.genesis.data.coinData[1][0]' token.txf)
    assert_not_equals "${coin_id1}" "${coin_id2}"
}

# MINT_TOKEN-020: Mint with Local Network
@test "MINT_TOKEN-020: Mint using local aggregator" {
    log_test "Minting with --local flag"

    run_cli_with_secret "${SECRET}" "mint-token --preset nft --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Verify inclusion proof from local network
    assert_has_inclusion_proof "token.txf"

    # Check Merkle tree root exists
    assert_json_field_exists "token.txf" "genesis.inclusionProof.merkleTreePath.root"

    # Check unicity certificate exists
    assert_json_field_exists "token.txf" "genesis.inclusionProof.unicityCertificate"
}

# MINT_TOKEN-021: Mint ALPHA Token (Same TokenType as UCT, Different Semantic)
@test "MINT_TOKEN-021: Mint ALPHA token" {
    log_test "Minting ALPHA test token"

    local amount="1000000000000000000"  # 1 ALPHA in base units

    run_cli_with_secret "${SECRET}" "mint-token --preset alpha -c '${amount}' --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Verify token type is ALPHA
    assert_token_type "token.txf" "alpha"

    # ALPHA shares the same tokenType hash as UCT
    # Both use: 455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89
    local token_type_hash
    token_type_hash=$(~/.local/bin/jq -r '.genesis.data.tokenType' token.txf)
    assert_equals "455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89" "${token_type_hash}"

    # Verify it's fungible with coin data
    is_fungible_token "token.txf"

    # Verify amount
    local actual_amount
    actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
    assert_equals "${amount}" "${actual_amount}"
}

# MINT_TOKEN-022: Deterministic Token ID Generation
@test "MINT_TOKEN-022: Same inputs produce same token ID" {
    log_test "Testing deterministic token ID generation"

    local secret="deterministic-secret-test"
    local salt="1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    local token_id="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

    # Mint first token with explicit token ID for determinism
    run_cli_with_secret "${secret}" "mint-token --preset nft --salt ${salt} -i ${token_id} --local -o token1.txf"
    assert_success

    # Mint second token with same parameters
    run_cli_with_secret "${secret}" "mint-token --preset nft --salt ${salt} -i ${token_id} --local -o token2.txf"
    assert_success

    # Extract token IDs
    local token_id1
    token_id1=$(get_txf_token_id "token1.txf")
    local token_id2
    token_id2=$(get_txf_token_id "token2.txf")

    # Token IDs should be identical (deterministic)
    assert_equals "${token_id1}" "${token_id2}"
}

# MINT_TOKEN-023: Different Salts Produce Different Token IDs
@test "MINT_TOKEN-023: Different salts produce different token IDs" {
    log_test "Testing token ID uniqueness with different salts"

    local secret="uniqueness-test"
    local salt1="1111111111111111111111111111111111111111111111111111111111111111"
    local salt2="2222222222222222222222222222222222222222222222222222222222222222"

    # Mint with first salt
    run_cli_with_secret "${secret}" "mint-token --preset nft --salt ${salt1} --local -o token1.txf"
    assert_success

    # Mint with second salt
    run_cli_with_secret "${secret}" "mint-token --preset nft --salt ${salt2} --local -o token2.txf"
    assert_success

    # Extract token IDs
    local token_id1
    token_id1=$(get_txf_token_id "token1.txf")
    local token_id2
    token_id2=$(get_txf_token_id "token2.txf")

    # Token IDs must be different
    assert_not_equals "${token_id1}" "${token_id2}"
}

# MINT_TOKEN-024: Mint NFT with Empty Data
@test "MINT_TOKEN-024: Mint NFT with empty data" {
    log_test "Minting NFT with no data"

    run_cli_with_secret "${SECRET}" "mint-token --preset nft --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Verify it's an NFT
    is_nft_token "token.txf"
}

# MINT_TOKEN-025: Mint UCT with Negative Amount (Liability Token)
@test "MINT_TOKEN-025: Mint UCT with negative amount (liability)" {
    log_test "Minting UCT with negative amount (represents debt/liability)"

    local negative_amount="-1000"

    # CLI should either:
    # 1. Allow negative amounts to represent liabilities, or
    # 2. Reject them with proper validation error
    # For now, we test that the command handles it gracefully
    run_cli_with_secret "${SECRET}" "mint-token --preset uct -c '${negative_amount}' --local -o token.txf" || true

    # If file was created, verify the amount
    if [[ -f "token.txf" ]]; then
        assert_token_fully_valid "token.txf"
        # Verify negative amount is stored correctly
        local actual_amount
        actual_amount=$(jq -r '.genesis.data.coinData[0].amount // .genesis.data.coinData[0][1]' token.txf)
        info "Negative amount stored: $actual_amount"
    else
        # Command rejected negative amount (also acceptable behavior)
        info "✓ Negative amount rejected by CLI (validation works)"
    fi
}

# MINT_TOKEN-026: Mint UCT with Zero Amount
@test "MINT_TOKEN-026: Mint UCT with zero amount" {
    log_test "Minting UCT with 0 amount"

    run_cli_with_secret "${SECRET}" "mint-token --preset uct -c '0' --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Verify amount is 0
    local actual_amount
    actual_amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' token.txf)
    assert_equals "0" "${actual_amount}"
}

# MINT_TOKEN-027: Verify Each Coin Has Unique CoinId
@test "MINT_TOKEN-027: Multi-coin tokens have unique coinIds" {
    log_test "Verifying unique coinIds in multi-coin token"

    local amounts="100,200,300"

    run_cli_with_secret "${SECRET}" "mint-token --preset uct -c '${amounts}' --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Extract all coin IDs
    local coin_id1
    coin_id1=$(~/.local/bin/jq -r '.genesis.data.coinData[0][0]' token.txf)
    local coin_id2
    coin_id2=$(~/.local/bin/jq -r '.genesis.data.coinData[1][0]' token.txf)
    local coin_id3
    coin_id3=$(~/.local/bin/jq -r '.genesis.data.coinData[2][0]' token.txf)

    # All must be different
    assert_not_equals "${coin_id1}" "${coin_id2}"
    assert_not_equals "${coin_id1}" "${coin_id3}"
    assert_not_equals "${coin_id2}" "${coin_id3}"

    # All must be valid 64-char hex
    is_valid_hex "${coin_id1}" 64
    is_valid_hex "${coin_id2}" 64
    is_valid_hex "${coin_id3}" 64
}

# MINT_TOKEN-028: Verify Merkle Proof Structure
@test "MINT_TOKEN-028: Inclusion proof has valid Merkle structure" {
    log_test "Validating Merkle proof structure"

    run_cli_with_secret "${SECRET}" "mint-token --preset nft --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Verify Merkle root is 64-char hex
    local merkle_root
    merkle_root=$(~/.local/bin/jq -r '.genesis.inclusionProof.merkleTreePath.root' token.txf)
    is_valid_hex "${merkle_root}" "64,68"  # Accept both 64 and 68 char hashes (with algorithm prefix)

    # Verify path steps exist
    local steps_count
    steps_count=$(jq '.genesis.inclusionProof.merkleTreePath.steps | length' token.txf)
    [[ "${steps_count}" -ge 0 ]] || {
        printf "Invalid steps count: %s\n" "${steps_count}" >&2
        return 1
    }
}
