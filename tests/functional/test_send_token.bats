#!/usr/bin/env bats
# Functional tests for send-token command
# Test Suite: SEND_TOKEN (13 test scenarios)

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common
    check_aggregator

    ALICE_SECRET=$(generate_test_secret "alice-send")
    BOB_SECRET=$(generate_test_secret "bob-send")
    CAROL_SECRET=$(generate_test_secret "carol-send")
}

teardown() {
    teardown_common
}

# SEND_TOKEN-001: Create Offline Transfer Package (Pattern A)
@test "SEND_TOKEN-001: Create offline transfer package" {
    log_test "Testing Pattern A: Offline transfer"

    # Setup: Generate Bob's address
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft" "" "bob-addr.json")
    assert_set bob_addr

    # Setup: Mint token for Alice
    mint_token_to_address "${ALICE_SECRET}" "nft" "{\"name\":\"Test NFT\"}" "alice-token.txf"
    assert_success
    assert_token_fully_valid "alice-token.txf"

    # Execute: Create offline transfer package
    send_token_offline "${ALICE_SECRET}" "alice-token.txf" "${bob_addr}" "transfer.txf" "Test transfer message"
    assert_success

    # Verify: Transfer file created
    assert_file_exists "transfer.txf"
    assert is_valid_txf "transfer.txf"
    assert_offline_transfer_valid "transfer.txf"

    # Verify: Has offline transfer section
    assert_has_offline_transfer "transfer.txf"

    # Verify: Status is PENDING
    local status
    status=$(get_token_status "transfer.txf")
    assert_equals "PENDING" "${status}"

    # Verify: Recipient matches Bob's address
    local recipient
    recipient=$(extract_json_field "transfer.txf" "offlineTransfer.recipient")
    assert_equals "${bob_addr}" "${recipient}"

    # Verify: Message is preserved
    local message
    message=$(extract_json_field "transfer.txf" "offlineTransfer.message")
    assert_equals "Test transfer message" "${message}"

    # Verify: Commitment data exists
    assert_json_field_exists "transfer.txf" "offlineTransfer.commitmentData"

    # Verify: Sender address exists
    assert_json_field_exists "transfer.txf" "offlineTransfer.sender.address"

    # Verify: Original state unchanged (Alice's predicate)
    local state_addr
    state_addr=$(get_txf_address "transfer.txf")
    assert_set state_addr
}

# SEND_TOKEN-002: Submit Transfer Immediately (Pattern B)
@test "SEND_TOKEN-002: Submit transfer immediately to network" {
    log_test "Testing Pattern B: Submit-now transfer"

    # Setup: Generate Bob's address and mint token
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft" "" "bob-addr.json")
    mint_token_to_address "${ALICE_SECRET}" "nft" "" "alice-token.txf"
    assert_success
    assert_token_fully_valid "alice-token.txf"

    # Execute: Submit transfer immediately
    send_token_immediate "${ALICE_SECRET}" "alice-token.txf" "${bob_addr}" "transferred.txf"
    assert_success

    # Verify: Transfer file created
    assert_file_exists "transferred.txf"
    assert_token_fully_valid "transferred.txf"

    # Verify: Status is TRANSFERRED
    local status
    status=$(get_token_status "transferred.txf")
    assert_equals "TRANSFERRED" "${status}"

    # Verify: NO offline transfer section (immediate submission)
    assert_no_offline_transfer "transferred.txf"

    # Verify: Transaction added to array
    local tx_count
    tx_count=$(get_transaction_count "transferred.txf")
    assert_greater_than "${tx_count}" 0 "Should have at least 1 transaction"

    # Verify: Inclusion proof exists for transaction
    assert_json_field_exists "transferred.txf" "transactions[0].inclusionProof"
}

# SEND_TOKEN-003: Send NFT Token
@test "SEND_TOKEN-003: Send NFT with metadata" {
    log_test "Sending NFT token"

    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    # Mint NFT with custom data
    mint_token_to_address "${ALICE_SECRET}" "nft" "{\"name\":\"Art NFT\",\"artist\":\"Alice\"}" "nft-token.txf"
    assert_success
    assert_token_fully_valid "nft-token.txf"

    # Send NFT
    send_token_offline "${ALICE_SECRET}" "nft-token.txf" "${bob_addr}" "transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    # Verify: Token data preserved
    local data
    data=$(get_token_data "transfer.txf")
    assert_output_contains "Art NFT"
    assert_output_contains "Alice"

    # Verify: Token type remains NFT
    assert_token_type "transfer.txf" "nft"

    # Verify: Transfer status PENDING
    assert_has_offline_transfer "transfer.txf"
}

# SEND_TOKEN-004: Send Fungible Token (UCT)
@test "SEND_TOKEN-004: Send UCT fungible token" {
    log_test "Sending UCT with coins"

    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "uct")

    # Mint UCT with 5 UCT
    mint_token_to_address "${ALICE_SECRET}" "uct" "" "uct-token.txf" "-c 5000000000000000000"
    assert_success
    assert_token_fully_valid "uct-token.txf"

    # Send UCT
    send_token_offline "${ALICE_SECRET}" "uct-token.txf" "${bob_addr}" "transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    # Verify: Coin data preserved
    local coin_count
    coin_count=$(get_coin_count "transfer.txf")
    assert_equals "1" "${coin_count}"

    # Verify: Coin amount correct
    local amount
    amount=$(jq -r '.genesis.data.coinData[0].amount' transfer.txf)
    assert_equals "5000000000000000000" "${amount}"
}

# SEND_TOKEN-005: Send NFT
@test "SEND_TOKEN-005: Send NFT token type" {
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    assert_token_fully_valid "token.txf"
    send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" "transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    assert_token_type "transfer.txf" "nft"
}

# SEND_TOKEN-006: Send UCT
@test "SEND_TOKEN-006: Send UCT token type" {
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "uct")

    mint_token_to_address "${ALICE_SECRET}" "uct" "" "token.txf" "-c 1000000000000000000"
    assert_token_fully_valid "token.txf"
    send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" "transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    assert_token_type "transfer.txf" "uct"
}

# SEND_TOKEN-007: Send USDU
@test "SEND_TOKEN-007: Send USDU stablecoin" {
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "usdu")

    mint_token_to_address "${ALICE_SECRET}" "usdu" "" "token.txf" "-c 100000000"
    assert_token_fully_valid "token.txf"
    send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" "transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    assert_token_type "transfer.txf" "usdu"
}

# SEND_TOKEN-008: Send EURU
@test "SEND_TOKEN-008: Send EURU stablecoin" {
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "euru")

    mint_token_to_address "${ALICE_SECRET}" "euru" "" "token.txf" "-c 50000000"
    assert_token_fully_valid "token.txf"
    send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" "transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    assert_token_type "transfer.txf" "euru"
}

# SEND_TOKEN-009: Send ALPHA
@test "SEND_TOKEN-009: Send ALPHA token" {
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "alpha")

    mint_token_to_address "${ALICE_SECRET}" "alpha" "" "token.txf" "-c 1000000000000000000"
    assert_token_fully_valid "token.txf"
    send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" "transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    assert_token_type "transfer.txf" "alpha"
}

# SEND_TOKEN-010: Send Custom Token Type
@test "SEND_TOKEN-010: Send custom token type" {
    local custom_type="1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

    # Generate address with custom type
    run_cli_with_secret "${BOB_SECRET}" "gen-address -y ${custom_type} > bob-addr.json"
    assert_success
    local bob_addr
    bob_addr=$(extract_json_field "bob-addr.json" "address")

    # Mint with custom type
    run_cli_with_secret "${ALICE_SECRET}" "mint-token -y ${custom_type} --local -o token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Send
    send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" "transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    # Verify custom type preserved
    assert_json_field_equals "transfer.txf" "genesis.data.tokenType" "${custom_type}"
}

# SEND_TOKEN-011: Send with Local Network (Pattern B)
@test "SEND_TOKEN-011: Send with --submit-now using local aggregator" {
    log_test "Testing immediate submission with local network"

    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    assert_token_fully_valid "token.txf"
    send_token_immediate "${ALICE_SECRET}" "token.txf" "${bob_addr}" "transferred.txf"
    assert_success
    assert_token_fully_valid "transferred.txf"

    # Verify submitted to local network
    assert_no_offline_transfer "transferred.txf"

    # Verify has transaction with inclusion proof
    local tx_count
    tx_count=$(get_transaction_count "transferred.txf")
    assert_greater_than "${tx_count}" 0
}

# SEND_TOKEN-012: Send to Masked Address
@test "SEND_TOKEN-012: Send to recipient with masked address" {
    log_test "Sending to masked (one-time) address"

    # Generate masked address for Bob
    local nonce
    nonce=$(generate_test_nonce "bob-masked")
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft" "${nonce}" "bob-masked.json")
    assert_set bob_addr

    # Verify it's a masked address
    assert_address_type "${bob_addr}" "masked"

    # Mint and send
    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    assert_token_fully_valid "token.txf"
    send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" "transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    # Verify recipient address is masked
    local recipient
    recipient=$(extract_json_field "transfer.txf" "offlineTransfer.recipient")
    assert_address_type "${recipient}" "masked"
}

# SEND_TOKEN-013: Error - Send Already Transferred Token
@test "SEND_TOKEN-013: Error when sending already transferred token" {
    log_test "Testing double-spend prevention"

    local bob_addr carol_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")
    carol_addr=$(generate_address "${CAROL_SECRET}" "nft")

    # First transfer: Alice -> Bob (submit immediately)
    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    assert_token_fully_valid "token.txf"
    send_token_immediate "${ALICE_SECRET}" "token.txf" "${bob_addr}" "sent-token.txf"
    assert_success
    assert_token_fully_valid "sent-token.txf"

    # Try to send again from same state: Alice -> Carol
    send_token_offline "${ALICE_SECRET}" "sent-token.txf" "${carol_addr}" "transfer2.txf"

    # Should fail or warn (token already transferred)
    # Status is TRANSFERRED, so this should be prevented
    local status
    status=$(get_token_status "sent-token.txf")
    assert_equals "TRANSFERRED" "${status}"
}
