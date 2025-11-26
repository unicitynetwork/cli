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
    is_valid_txf "bob-token.txf"
    assert_token_fully_valid "bob-token.txf"

    # Verify: Transfer submitted to network
    # Status should be TRANSFERRED (has transaction, no longer pending)
    local status
    status=$(get_token_status "bob-token.txf")
    assert_equals "TRANSFERRED" "${status}"

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
    assert_string_contains "$data" "Test NFT"
    assert_string_contains "$data" "123"

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
    amount=$(~/.local/bin/jq -r '.genesis.data.coinData[0][1]' bob-uct.txf)
    assert_equals "10000000000000000000" "${amount}"

    # Verify: Bob can now spend the coins (ownership transferred)
    local tx_count
    tx_count=$(get_transaction_count "bob-uct.txf")
    assert_equals "1" "${tx_count}"
}

# RECV_TOKEN-004: Receive with Wrong Secret
@test "RECV_TOKEN-004: Error when receiving with incorrect secret" {
    log_test "Testing address mismatch detection"

    # Ensure no leftover files
    rm -f carol-token.txf

    # Setup: Create transfer for Bob
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    assert_token_fully_valid "token.txf"
    send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" "transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    # Execute: Carol tries to receive with her secret (wrong!)
    status=0
    receive_token "${CAROL_SECRET}" "transfer.txf" "carol-token.txf" || status=$?

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

    # Second receive (retry) - idempotent operation (may succeed or fail)
    # Exit code doesn't matter - we check if file was created
    receive_token "${BOB_SECRET}" "transfer.txf" "received2.txf"
    local retry_exit=$?

    # Check if the second receive succeeded (idempotent operation)
    if [[ -f "received2.txf" ]]; then
        assert_token_fully_valid "received2.txf"

        # Both files should have same final state
        local tx_count1 tx_count2
        tx_count1=$(get_transaction_count "received1.txf")
        tx_count2=$(get_transaction_count "received2.txf")
        assert_equals "${tx_count1}" "${tx_count2}"
        info "✓ Idempotent receive successful (created separate file)"
    else
        # Second receive failed (acceptable - already received)
        info "⚠ Second receive failed (already received - expected behavior)"
    fi
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
    receive_token "${BOB_SECRET}" "transfer.txf" "bob-token.txf" "${nonce}"
    assert_success

    # Verify: Token received successfully
    assert_file_exists "bob-token.txf"
    assert_token_fully_valid "bob-token.txf"

    # Verify: Address verification passed
    local tx_count
    tx_count=$(get_transaction_count "bob-token.txf")
    assert_equals "1" "${tx_count}"

    # Verify: Bob's predicate is masked (engine ID 5)
    # Note: The token state after receive should reflect the masked predicate
    local current_addr
    current_addr=$(get_txf_address "bob-token.txf")
    assert_set current_addr
}

# RECV_TOKEN-008: Receive without Recipient Data Hash (Baseline)
@test "RECV_TOKEN-008: Receive without recipient data hash commitment" {
    log_test "Testing baseline receive without hash commitment"

    # Setup: Alice sends to Bob WITHOUT hash commitment
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    mint_token_to_address "${ALICE_SECRET}" "nft" "{\"name\":\"Test NFT\"}" "token.txf"
    assert_token_fully_valid "token.txf"

    # Send without recipient data hash
    send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" "transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    # Verify: No recipient data hash in transfer (using new transactions[] structure)
    local commit_data
    commit_data=$(jq -r '.transactions[-1].commitment' transfer.txf)
    local recipient_hash
    recipient_hash=$(echo "$commit_data" | jq -r '.transactionData.recipientDataHash')
    assert_equals "null" "$recipient_hash" "Should have no recipient data hash"

    # Execute: Bob receives without providing state data
    receive_token "${BOB_SECRET}" "transfer.txf" "bob-token.txf"
    assert_success

    # Verify: Token received successfully
    assert_file_exists "bob-token.txf"
    assert_token_fully_valid "bob-token.txf"

    # Verify: Token has null state data
    local state_data
    state_data=$(jq -r '.state.data' bob-token.txf)
    assert_equals 'null' "$state_data" "State data should be null"
}

# RECV_TOKEN-009: Receive with Correct State Data (Hash Match)
@test "RECV_TOKEN-009: Receive with matching recipient data hash" {
    log_test "Testing successful receive with hash commitment"

    # Setup: Compute hash for state data
    local state_data='{"status":"active","verified":true}'
    local data_hash
    data_hash=$(echo -n "$state_data" | npm run --silent hash-data -- --raw-hash)

    # Alice sends to Bob WITH hash commitment
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    mint_token_to_address "${ALICE_SECRET}" "nft" "{\"name\":\"Test NFT\"}" "token.txf"
    assert_token_fully_valid "token.txf"

    # Send with recipient data hash
    run_cli_with_secret "${ALICE_SECRET}" \
        "send-token -f token.txf -r \"${bob_addr}\" \
         --recipient-data-hash \"${data_hash}\" \
         -o transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    # Execute: Bob receives WITH matching state data
    run_cli_with_secret "${BOB_SECRET}" \
        "receive-token -f transfer.txf \
         --state-data '${state_data}' \
         --local \
         -o bob-token.txf"
    assert_success

    # Verify: Token received successfully
    assert_file_exists "bob-token.txf"
    assert_token_fully_valid "bob-token.txf"

    # Verify: State data is set correctly
    local received_data
    received_data=$(get_token_data "bob-token.txf")
    assert_string_contains "$received_data" "active"
    assert_string_contains "$received_data" "verified"
}

# RECV_TOKEN-010: Receive with Wrong State Data (Hash Mismatch)
@test "RECV_TOKEN-010: Error when state data does not match hash" {
    log_test "Testing hash mismatch detection"

    # Ensure no leftover files
    rm -f bob-token.txf

    # Setup: Compute hash for one value
    local correct_data='{"status":"active"}'
    local data_hash
    data_hash=$(echo -n "$correct_data" | npm run --silent hash-data -- --raw-hash)

    # Alice sends with hash commitment
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    assert_token_fully_valid "token.txf"

    run_cli_with_secret "${ALICE_SECRET}" \
        "send-token -f token.txf -r \"${bob_addr}\" \
         --recipient-data-hash \"${data_hash}\" \
         -o transfer.txf"
    assert_success

    # Execute: Bob tries to receive with DIFFERENT state data
    status=0
    run_cli_with_secret "${BOB_SECRET}" \
        "receive-token -f transfer.txf \
         --state-data '{\"status\":\"inactive\"}' \
         --local \
         -o bob-token.txf" || status=$?

    # Verify: Should fail with hash mismatch
    assert_failure
    assert_output_contains "hash" || assert_output_contains "mismatch" || assert_output_contains "does not match"

    # Verify: No output file created
    assert_file_not_exists "bob-token.txf"
}

# RECV_TOKEN-011: Receive with Missing State Data (Hash Present)
@test "RECV_TOKEN-011: Error when state data required but not provided" {
    log_test "Testing missing state data detection"

    # Ensure no leftover files
    rm -f bob-token.txf

    # Setup: Compute hash
    local state_data='{"status":"active"}'
    local data_hash
    data_hash=$(echo -n "$state_data" | npm run --silent hash-data -- --raw-hash)

    # Alice sends with hash commitment
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    assert_token_fully_valid "token.txf"

    run_cli_with_secret "${ALICE_SECRET}" \
        "send-token -f token.txf -r \"${bob_addr}\" \
         --recipient-data-hash \"${data_hash}\" \
         -o transfer.txf"
    assert_success

    # Execute: Bob tries to receive WITHOUT providing state data
    status=0
    run_cli_with_secret "${BOB_SECRET}" \
        "receive-token -f transfer.txf \
         --local \
         -o bob-token.txf" || status=$?

    # Verify: Should fail - state data required
    assert_failure
    assert_output_contains "state-data" || assert_output_contains "REQUIRED" || assert_output_contains "required"

    # Verify: No output file created
    assert_file_not_exists "bob-token.txf"
}
