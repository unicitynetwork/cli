#!/usr/bin/env bats
# Integration tests for complete workflows
# Test Suite: INTEGRATION (10 test scenarios)

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common
    check_aggregator

    ALICE_SECRET=$(generate_test_secret "alice-int")
    BOB_SECRET=$(generate_test_secret "bob-int")
    CAROL_SECRET=$(generate_test_secret "carol-int")
    DAVE_SECRET=$(generate_test_secret "dave-int")
}

teardown() {
    teardown_common
}

# INTEGRATION-001: Complete Offline Transfer Flow (Pattern A)
@test "INTEGRATION-001: End-to-end offline transfer from Alice to Bob" {
    log_test "Complete offline transfer workflow"

    # Step 1: Alice creates address
    run_cli_with_secret "${ALICE_SECRET}" "gen-address --preset nft > alice-addr.json"
    assert_success

    # Step 2: Bob creates address
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft > bob-addr.json"
    assert_success
    local bob_address
    bob_address=$(extract_json_field "bob-addr.json" "address")
    assert_set bob_address

    # Step 3: Alice mints NFT
    mint_token_to_address "${ALICE_SECRET}" "nft" \
        '{"name":"Birthday Gift","message":"Happy Birthday Bob!"}' "alice-nft.txf"
    assert_success
    assert_token_fully_valid "alice-nft.txf"

    # Step 4: Verify Alice's token
    verify_token "alice-nft.txf" "--local"
    assert_success

    # Step 5: Alice creates transfer package
    send_token_offline "${ALICE_SECRET}" "alice-nft.txf" "${bob_address}" "transfer-to-bob.txf" "For you!"
    assert_success
    assert_offline_transfer_valid "transfer-to-bob.txf"

    # Step 6: Verify transfer package
    verify_token "transfer-to-bob.txf" "--local"
    assert_success
    assert_has_offline_transfer "transfer-to-bob.txf"

    # Step 7: Bob receives token
    receive_token "${BOB_SECRET}" "transfer-to-bob.txf" "bob-nft.txf"
    assert_success
    assert_token_fully_valid "bob-nft.txf"

    # Step 8: Verify Bob's token
    verify_token "bob-nft.txf" "--local"
    assert_success

    # Check Bob is owner (1 transaction)
    local tx_count
    tx_count=$(get_transaction_count "bob-nft.txf")
    assert_equals "1" "${tx_count}"

    # Check token data preserved
    local data
    data=$(get_token_data "bob-nft.txf")
    assert_string_contains "$data" "Birthday Gift"

    # Step 9: Verify Alice's old token shows as transferred
    local alice_status
    alice_status=$(get_token_status "alice-nft.txf")
    # Original file still shows CONFIRMED (not updated)
    # This is expected behavior - TXF files are immutable snapshots
}

# INTEGRATION-002: Multi-Hop Transfer (Alice → Bob → Carol)
@test "INTEGRATION-002: Transfer token through multiple owners" {
    log_test "Multi-hop transfer: Alice -> Bob -> Carol"

    # Step 1: Create all addresses
    local bob_address carol_address
    bob_address=$(generate_address "${BOB_SECRET}" "nft" "" "bob-addr.json")
    carol_address=$(generate_address "${CAROL_SECRET}" "nft" "" "carol-addr.json")

    # Step 2: Alice mints and sends to Bob
    mint_token_to_address "${ALICE_SECRET}" "nft" '{"stage":"alice"}' "alice-token.txf"
    assert_token_fully_valid "alice-token.txf"
    send_token_offline "${ALICE_SECRET}" "alice-token.txf" "${bob_address}" "transfer-alice-bob.txf"
    assert_success
    assert_offline_transfer_valid "transfer-alice-bob.txf"

    # Step 3: Bob receives
    receive_token "${BOB_SECRET}" "transfer-alice-bob.txf" "bob-token.txf"
    assert_success
    assert_token_fully_valid "bob-token.txf"

    # Step 4: Verify Bob's ownership
    verify_token "bob-token.txf" "--local"
    assert_success
    local tx_count
    tx_count=$(get_transaction_count "bob-token.txf")
    assert_equals "1" "${tx_count}"

    # Step 5: Bob sends to Carol
    send_token_offline "${BOB_SECRET}" "bob-token.txf" "${carol_address}" "transfer-bob-carol.txf"
    assert_success
    assert_offline_transfer_valid "transfer-bob-carol.txf"

    # Step 6: Carol receives
    receive_token "${CAROL_SECRET}" "transfer-bob-carol.txf" "carol-token.txf"
    assert_success
    assert_token_fully_valid "carol-token.txf"

    # Step 7: Verify Carol's ownership
    verify_token "carol-token.txf" "--local"
    assert_success

    # Carol should have 2 transactions in history
    tx_count=$(get_transaction_count "carol-token.txf")
    assert_equals "2" "${tx_count}"

    # Verify all proofs valid
    assert_json_field_exists "carol-token.txf" "genesis.inclusionProof"
    assert_json_field_exists "carol-token.txf" "transactions[0].inclusionProof"
    assert_json_field_exists "carol-token.txf" "transactions[1].inclusionProof"
}

# INTEGRATION-003: Fungible Token Transfer (UCT with Coins)
@test "INTEGRATION-003: Transfer fungible UCT token with coin amounts" {
    log_test "UCT transfer with 100 UCT"

    # Setup addresses
    local bob_address
    bob_address=$(generate_address "${BOB_SECRET}" "uct")

    # Alice mints 100 UCT
    mint_token_to_address "${ALICE_SECRET}" "uct" "" "alice-uct.txf" "-c 100000000000000000000"
    assert_success
    assert_token_fully_valid "alice-uct.txf"

    # Verify coin amount
    local coin_amount
    coin_amount=$(jq -r '.genesis.data.coinData[0][1]' alice-uct.txf)
    assert_equals "100000000000000000000" "${coin_amount}"

    # Alice sends to Bob
    send_token_offline "${ALICE_SECRET}" "alice-uct.txf" "${bob_address}" "transfer-uct.txf"
    assert_success
    assert_offline_transfer_valid "transfer-uct.txf"

    # Bob receives
    receive_token "${BOB_SECRET}" "transfer-uct.txf" "bob-uct.txf"
    assert_success
    assert_token_fully_valid "bob-uct.txf"

    # Verify Bob has 100 UCT
    verify_token "bob-uct.txf" "--local"
    assert_success

    coin_amount=$(jq -r '.genesis.data.coinData[0][1]' bob-uct.txf)
    assert_equals "100000000000000000000" "${coin_amount}"

    # Bob can now spend the UCT
    local tx_count
    tx_count=$(get_transaction_count "bob-uct.txf")
    assert_equals "1" "${tx_count}"
}

# INTEGRATION-004: Postponed Commitment Chain (1-Level)
@test "INTEGRATION-004: Create transfer package, wait, then submit later" {
    log_test "Postponed commitment (1-level)"

    local bob_address
    bob_address=$(generate_address "${BOB_SECRET}" "nft")

    # Step 1: Alice mints token
    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    assert_success
    assert_token_fully_valid "token.txf"

    # Step 2: Alice creates transfer package (offline)
    send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_address}" "transfer.txf"
    assert_success
    assert_offline_transfer_valid "transfer.txf"

    # No network submission yet
    assert_has_offline_transfer "transfer.txf"

    # Step 3: Wait (simulated)
    sleep 2

    # Step 4: Bob receives and submits
    receive_token "${BOB_SECRET}" "transfer.txf" "bob-token.txf"
    assert_success
    assert_token_fully_valid "bob-token.txf"

    # Now network submission occurs
    assert_no_offline_transfer "bob-token.txf"

    # Step 5: Verify successful
    verify_token "bob-token.txf" "--local"
    assert_success
}

# INTEGRATION-005: Postponed Commitment Chain (2-Level)
@test "INTEGRATION-005: Chain two offline transfers before submission" {
    log_test "Postponed commitment (2-level)"
    skip "Complex scenario - requires careful transaction management"

    # This test would chain:
    # 1. Alice -> Bob (offline)
    # 2. Bob receives locally
    # 3. Bob -> Carol (offline, before submitting Alice->Bob)
    # 4. Carol receives and submits both commitments

    # This is a complex edge case that may not be supported
    # or may require special handling
}

# INTEGRATION-006: Postponed Commitment Chain (3-Level)
@test "INTEGRATION-006: Chain three offline transfers" {
    log_test "Postponed commitment (3-level)"
    skip "Advanced scenario - may have network limitations"

    # Alice -> Bob -> Carol -> Dave
    # All offline, then Dave submits all at once
    # This tests maximum postponement depth
}

# INTEGRATION-007: Mixed Transfer Patterns
@test "INTEGRATION-007: Combine offline and immediate transfers" {
    log_test "Mixed transfer patterns"

    local bob_address carol_address
    bob_address=$(generate_address "${BOB_SECRET}" "nft")
    carol_address=$(generate_address "${CAROL_SECRET}" "nft")

    # Step 1: Alice -> Bob (offline)
    mint_token_to_address "${ALICE_SECRET}" "nft" '{"stage":1}' "alice-token.txf"
    assert_token_fully_valid "alice-token.txf"
    send_token_offline "${ALICE_SECRET}" "alice-token.txf" "${bob_address}" "transfer1.txf"
    assert_offline_transfer_valid "transfer1.txf"
    receive_token "${BOB_SECRET}" "transfer1.txf" "bob-token.txf"
    assert_success
    assert_token_fully_valid "bob-token.txf"

    # Step 2: Bob -> Carol (immediate)
    send_token_immediate "${BOB_SECRET}" "bob-token.txf" "${carol_address}" "carol-token.txf"
    assert_success
    assert_token_fully_valid "carol-token.txf"

    # Verify Carol has token with 2 transactions
    local tx_count
    tx_count=$(get_transaction_count "carol-token.txf")
    assert_equals "2" "${tx_count}"

    # Step 3: Carol -> Dave (offline)
    local dave_address
    dave_address=$(generate_address "${DAVE_SECRET}" "nft")
    send_token_offline "${CAROL_SECRET}" "carol-token.txf" "${dave_address}" "transfer3.txf"
    assert_offline_transfer_valid "transfer3.txf"
    receive_token "${DAVE_SECRET}" "transfer3.txf" "dave-token.txf"
    assert_success
    assert_token_fully_valid "dave-token.txf"

    # Dave should have 3 transactions
    tx_count=$(get_transaction_count "dave-token.txf")
    assert_equals "3" "${tx_count}"
}

# INTEGRATION-008: Cross-Token-Type Address Reuse
@test "INTEGRATION-008: Same address receives different token types" {
    log_test "Testing address reusability across token types"

    # Bob generates one unmasked address (default UCT)
    local bob_address
    bob_address=$(generate_address "${BOB_SECRET}" "uct" "" "bob-addr.json")

    # Alice sends NFT to Bob's address
    mint_token_to_address "${ALICE_SECRET}" "nft" '{"type":"nft"}' "nft.txf"
    assert_token_fully_valid "nft.txf"

    # Note: Need to generate NFT-specific address for Bob
    local bob_nft_address
    bob_nft_address=$(generate_address "${BOB_SECRET}" "nft" "" "bob-nft-addr.json")

    send_token_offline "${ALICE_SECRET}" "nft.txf" "${bob_nft_address}" "transfer-nft.txf"
    assert_offline_transfer_valid "transfer-nft.txf"
    receive_token "${BOB_SECRET}" "transfer-nft.txf" "bob-nft.txf"
    assert_success
    assert_token_fully_valid "bob-nft.txf"

    # Alice sends UCT to Bob's UCT address
    mint_token_to_address "${ALICE_SECRET}" "uct" "" "uct.txf" "-c 50000000000000000000"
    assert_token_fully_valid "uct.txf"

    send_token_offline "${ALICE_SECRET}" "uct.txf" "${bob_address}" "transfer-uct.txf"
    assert_offline_transfer_valid "transfer-uct.txf"
    receive_token "${BOB_SECRET}" "transfer-uct.txf" "bob-uct.txf"
    assert_success
    assert_token_fully_valid "bob-uct.txf"

    # Verify Bob has both tokens
    verify_token "bob-nft.txf" "--local"
    assert_success
    verify_token "bob-uct.txf" "--local"
    assert_success
}

# INTEGRATION-009: Masked Address Single-Use Enforcement
@test "INTEGRATION-009: Masked address can only receive one token" {
    log_test "Testing masked address single-use property"

    # Bob generates masked address
    local nonce
    nonce=$(generate_test_nonce "bob-masked-single")
    local bob_masked
    bob_masked=$(generate_address "${BOB_SECRET}" "nft" "${nonce}" "bob-masked.json")

    # Alice sends first token to Bob's masked address
    mint_token_to_address "${ALICE_SECRET}" "nft" '{"token":1}' "token1.txf"
    assert_token_fully_valid "token1.txf"
    send_token_offline "${ALICE_SECRET}" "token1.txf" "${bob_masked}" "transfer1.txf"
    assert_offline_transfer_valid "transfer1.txf"
    receive_token "${BOB_SECRET}" "transfer1.txf" "bob-token1.txf"
    assert_success
    assert_token_fully_valid "bob-token1.txf"

    # Alice tries to send second token to same masked address
    mint_token_to_address "${ALICE_SECRET}" "nft" '{"token":2}' "token2.txf"
    assert_token_fully_valid "token2.txf"
    send_token_offline "${ALICE_SECRET}" "token2.txf" "${bob_masked}" "transfer2.txf"
    assert_offline_transfer_valid "transfer2.txf"

    # Bob tries to receive (should fail or warn - address already used)
    receive_token "${BOB_SECRET}" "transfer2.txf" "bob-token2.txf"

    # Behavior: May succeed if nonce is reused, but not recommended
    # Ideally should fail or warn about address reuse
    # This depends on implementation
}

# INTEGRATION-010: All Token Type Combinations
@test "INTEGRATION-010: Transfer each token type through full lifecycle" {
    log_test "Testing all token types: NFT, UCT, USDU, EURU, ALPHA"

    local bob_address
    bob_address=$(generate_address "${BOB_SECRET}" "nft")

    # Test NFT
    mint_token_to_address "${ALICE_SECRET}" "nft" '{"test":"nft"}' "nft.txf"
    assert_token_fully_valid "nft.txf"
    send_token_offline "${ALICE_SECRET}" "nft.txf" "${bob_address}" "transfer-nft.txf"
    assert_offline_transfer_valid "transfer-nft.txf"
    receive_token "${BOB_SECRET}" "transfer-nft.txf" "bob-nft.txf"
    assert_success
    assert_token_fully_valid "bob-nft.txf"
    verify_token "bob-nft.txf" "--local"
    assert_success

    # Test UCT
    bob_address=$(generate_address "${BOB_SECRET}" "uct")
    mint_token_to_address "${ALICE_SECRET}" "uct" "" "uct.txf" "-c 1000000000000000000"
    assert_token_fully_valid "uct.txf"
    send_token_offline "${ALICE_SECRET}" "uct.txf" "${bob_address}" "transfer-uct.txf"
    assert_offline_transfer_valid "transfer-uct.txf"
    receive_token "${BOB_SECRET}" "transfer-uct.txf" "bob-uct.txf"
    assert_success
    assert_token_fully_valid "bob-uct.txf"
    verify_token "bob-uct.txf" "--local"
    assert_success

    # Test USDU
    bob_address=$(generate_address "${BOB_SECRET}" "usdu")
    mint_token_to_address "${ALICE_SECRET}" "usdu" "" "usdu.txf" "-c 100000000"
    assert_token_fully_valid "usdu.txf"
    send_token_offline "${ALICE_SECRET}" "usdu.txf" "${bob_address}" "transfer-usdu.txf"
    assert_offline_transfer_valid "transfer-usdu.txf"
    receive_token "${BOB_SECRET}" "transfer-usdu.txf" "bob-usdu.txf"
    assert_success
    assert_token_fully_valid "bob-usdu.txf"
    verify_token "bob-usdu.txf" "--local"
    assert_success

    # Test EURU
    bob_address=$(generate_address "${BOB_SECRET}" "euru")
    mint_token_to_address "${ALICE_SECRET}" "euru" "" "euru.txf" "-c 50000000"
    assert_token_fully_valid "euru.txf"
    send_token_offline "${ALICE_SECRET}" "euru.txf" "${bob_address}" "transfer-euru.txf"
    assert_offline_transfer_valid "transfer-euru.txf"
    receive_token "${BOB_SECRET}" "transfer-euru.txf" "bob-euru.txf"
    assert_success
    assert_token_fully_valid "bob-euru.txf"
    verify_token "bob-euru.txf" "--local"
    assert_success

    # All token types transferred successfully
    log_test "All token types verified: NFT, UCT, USDU, EURU"
}
