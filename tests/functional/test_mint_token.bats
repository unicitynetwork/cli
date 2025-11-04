#!/usr/bin/env bats
# Functional tests for mint-token command
# Test Suite: MINT_TOKEN (20 test scenarios)

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common
    check_aggregator
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
    assert is_valid_txf "token.txf"

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
    assert_output_contains "Test NFT"
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
    assert is_fungible_token "token.txf"

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
    actual_amount=$(jq -r '.genesis.data.coinData[0].amount' token.txf)
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
    actual_amount=$(jq -r '.genesis.data.coinData[0].amount' token.txf)
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
    actual_amount=$(jq -r '.genesis.data.coinData[0].amount' token.txf)
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
    assert is_valid_txf "my-custom-nft.txf"
    assert_token_fully_valid "my-custom-nft.txf"
}

# MINT_TOKEN-012: Mint with STDOUT Only
@test "MINT_TOKEN-012: Mint with stdout output" {
    log_test "Minting to stdout"

    run_cli_with_secret "${SECRET}" "mint-token --preset nft --local --stdout > captured-token.json"
    assert_success

    # Verify stdout capture
    assert_file_exists "captured-token.json"
    assert is_valid_txf "captured-token.json"
    assert_token_fully_valid "captured-token.json"

    # No auto-generated file should exist
    local auto_files
    auto_files=$(find . -name "202*.txf" 2>/dev/null | wc -l)
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
    assert is_nft_token "token.txf"
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
    assert is_nft_token "token.txf"
}

# MINT_TOKEN-015: Mint UCT Unmasked
@test "MINT_TOKEN-015: Mint UCT with unmasked address" {
    run_cli_with_secret "${SECRET}" "mint-token --preset uct -u --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    local pred_type
    pred_type=$(get_predicate_type "token.txf")
    assert_equals "unmasked" "${pred_type}"
    assert is_fungible_token "token.txf"
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
    assert is_fungible_token "token.txf"
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
    amount1=$(jq -r '.genesis.data.coinData[0].amount' token.txf)
    assert_equals "1000000000000000000" "${amount1}"

    local amount2
    amount2=$(jq -r '.genesis.data.coinData[1].amount' token.txf)
    assert_equals "2000000000000000000" "${amount2}"

    local amount3
    amount3=$(jq -r '.genesis.data.coinData[2].amount' token.txf)
    assert_equals "3000000000000000000" "${amount3}"

    # Verify each coin has unique CoinId
    local coin_id1
    coin_id1=$(jq -r '.genesis.data.coinData[0].coinId' token.txf)
    local coin_id2
    coin_id2=$(jq -r '.genesis.data.coinData[1].coinId' token.txf)
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
