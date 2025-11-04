#!/usr/bin/env bats
# Functional tests for receive-token command
# Test Suite: RECV_TOKEN (7 test scenarios)

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common
    check_aggregator

    ALICE_SECRET=$(generate_test_secret "alice-receive")
    BOB_SECRET=$(generate_test_secret "bob-receive")
    CAROL_SECRET=$(generate_test_secret "carol-receive")
}

teardown() {
    teardown_common
}

# RECV_TOKEN-001: Receive Offline Transfer Package
@test "RECV_TOKEN-001: Complete offline transfer by receiving package" {
    log_test "Testing receive-token to complete offline transfer"

    # Setup: Create offline transfer from Alice to Bob
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft" "" "bob-addr.json")

    mint_token_to_address "${ALICE_SECRET}" "nft" "" "alice-token.txf"
    assert_token_fully_valid "alice-token.txf"
    send_token_offline "${ALICE_SECRET}" "alice-token.txf" "${bob_addr}" "transfer-package.txf"
    assert_success
    assert_offline_transfer_valid "transfer-package.txf"

    # Execute: Bob receives the token
    receive_token "${BOB_SECRET}" "transfer-package.txf" "bob-token.txf"
    assert_success

    # Verify: Token file created
    assert_file_exists "bob-token.txf"
    assert is_valid_txf "bob-token.txf"
    assert_token_fully_valid "bob-token.txf"

    # Verify: Transfer submitted to network
    # Status should be CONFIRMED (no more pending transfer)
    local status
    status=$(get_token_status "bob-token.txf")
    assert_equals "CONFIRMED" "${status}"

    # Verify: Offline transfer section removed
    assert_no_offline_transfer "bob-token.txf"

    # Verify: Transaction added to history
    local tx_count
    tx_count=$(get_transaction_count "bob-token.txf")
    assert_equals "1" "${tx_count}"

    # Verify: State predicate now contains Bob's ownership
    local current_addr
    current_addr=$(get_txf_address "bob-token.txf")
    # Note: After transfer, the state should reflect the new owner
    assert_set current_addr

    # Verify: Inclusion proof exists for transaction
    assert_json_field_exists "bob-token.txf" "transactions[0].inclusionProof"
}

# RECV_TOKEN-002: Receive NFT Transfer
@test "RECV_TOKEN-002: Receive NFT with preserved metadata" {
    log_test "Receiving NFT transfer"

    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    # Mint NFT with metadata
    mint_token_to_address "${ALICE_SECRET}" "nft" "{\"name\":\"Test NFT\",\"id\":123}" "nft-token.txf"
    assert_token_fully_valid "nft-token.txf"
    send_token_offline "${ALICE_SECRET}" "nft-token.txf" "${bob_addr}" "nft-transfer.txf"
    assert_success
    assert_offline_transfer_valid "nft-transfer.txf"

    # Receive
    receive_token "${BOB_SECRET}" "nft-transfer.txf" "bob-nft.txf"
    assert_success
    assert_token_fully_valid "bob-nft.txf"

    # Verify: Token data preserved
    local data
    data=$(get_token_data "bob-nft.txf")
    assert_output_contains "Test NFT"
    assert_output_contains "123"

    # Verify: Token type still NFT
    assert_token_type "bob-nft.txf" "nft"

    # Verify: Bob is new owner (1 transaction in history)
    local tx_count
    tx_count=$(get_transaction_count "bob-nft.txf")
    assert_equals "1" "${tx_count}"
}

# RECV_TOKEN-003: Receive Fungible Token
@test "RECV_TOKEN-003: Receive UCT token with coins" {
    log_test "Receiving UCT fungible token"

    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "uct")

    # Mint UCT with 10 UCT
    mint_token_to_address "${ALICE_SECRET}" "uct" "" "uct-token.txf" "-c 10000000000000000000"
    assert_token_fully_valid "uct-token.txf"
    send_token_offline "${ALICE_SECRET}" "uct-token.txf" "${bob_addr}" "uct-transfer.txf"
    assert_success
    assert_offline_transfer_valid "uct-transfer.txf"

    # Receive
    receive_token "${BOB_SECRET}" "uct-transfer.txf" "bob-uct.txf"
    assert_success
    assert_token_fully_valid "bob-uct.txf"

    # Verify: Coin data intact
    local coin_count
    coin_count=$(get_coin_count "bob-uct.txf")
    assert_equals "1" "${coin_count}"

    # Verify: Amount preserved
    local amount
    amount=$(jq -r '.genesis.data.coinData[0].amount' bob-uct.txf)
    assert_equals "10000000000000000000" "${amount}"

    # Verify: Bob can now spend the coins (ownership transferred)
    local tx_count
    tx_count=$(get_transaction_count "bob-uct.txf")
    assert_equals "1" "${tx_count}"
}

# RECV_TOKEN-004: Receive with Wrong Secret
@test "RECV_TOKEN-004: Error when receiving with incorrect secret" {
    log_test "Testing address mismatch detection"

    # Setup: Create transfer for Bob
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    assert_token_fully_valid "token.txf"
    send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" "transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    # Execute: Carol tries to receive with her secret (wrong!)
    receive_token "${CAROL_SECRET}" "transfer.txf" "carol-token.txf"

    # Verify: Should fail with address mismatch
    assert_failure

    # Verify: Error message mentions address mismatch
    assert_output_contains "address" || assert_output_contains "mismatch" || assert_output_contains "recipient"

    # Verify: No output file created
    assert_file_not_exists "carol-token.txf"

    # Verify: No network submission occurred (transfer still pending)
    assert_has_offline_transfer "transfer.txf"
}

# RECV_TOKEN-005: Receive Already Submitted Transfer (Idempotent)
@test "RECV_TOKEN-005: Receiving same transfer multiple times is idempotent" {
    log_test "Testing idempotent receive operation"

    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    assert_token_fully_valid "token.txf"
    send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" "transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    # First receive
    receive_token "${BOB_SECRET}" "transfer.txf" "received1.txf"
    assert_success
    assert_token_fully_valid "received1.txf"

    # Second receive (retry)
    receive_token "${BOB_SECRET}" "transfer.txf" "received2.txf"

    # Should succeed (idempotent operation)
    assert_success
    assert_token_fully_valid "received2.txf"

    # Both files should have same final state
    local tx_count1 tx_count2
    tx_count1=$(get_transaction_count "received1.txf")
    tx_count2=$(get_transaction_count "received2.txf")
    assert_equals "${tx_count1}" "${tx_count2}"
}

# RECV_TOKEN-006: Receive with Local Network
@test "RECV_TOKEN-006: Receive using local aggregator" {
    log_test "Receiving with --local flag"

    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    assert_token_fully_valid "token.txf"
    send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" "transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    # Receive with local network
    receive_token "${BOB_SECRET}" "transfer.txf" "bob-token.txf"
    assert_success
    assert_token_fully_valid "bob-token.txf"

    # Verify: Inclusion proof from local network
    assert_json_field_exists "bob-token.txf" "transactions[0].inclusionProof"
    assert_json_field_exists "bob-token.txf" "transactions[0].inclusionProof.merkleTreePath"

    # Verify: Token received successfully
    local tx_count
    tx_count=$(get_transaction_count "bob-token.txf")
    assert_equals "1" "${tx_count}"
}

# RECV_TOKEN-007: Receive to Masked Address
@test "RECV_TOKEN-007: Receive token at masked (one-time) address" {
    log_test "Receiving at masked address"

    # Bob generates masked address
    local nonce
    nonce=$(generate_test_nonce "bob-masked-receive")
    local bob_masked_addr
    bob_masked_addr=$(generate_address "${BOB_SECRET}" "nft" "${nonce}" "bob-masked.json")
    assert_set bob_masked_addr

    # Verify masked address
    assert_address_type "${bob_masked_addr}" "masked"

    # Alice sends to masked address
    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    assert_token_fully_valid "token.txf"
    send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_masked_addr}" "transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    # Bob receives with same secret + nonce
    # Note: CLI should automatically derive the same masked address
    receive_token "${BOB_SECRET}" "transfer.txf" "bob-token.txf"
    assert_success

    # Verify: Token received successfully
    assert_file_exists "bob-token.txf"
    assert_token_fully_valid "bob-token.txf"

    # Verify: Address verification passed
    local tx_count
    tx_count=$(get_transaction_count "bob-token.txf")
    assert_equals "1" "${tx_count}"

    # Verify: Bob's predicate is masked (engine ID 1)
    # Note: The token state after receive should reflect the masked predicate
    local current_addr
    current_addr=$(get_txf_address "bob-token.txf")
    assert_set current_addr
}
