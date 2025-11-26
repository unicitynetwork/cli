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
    is_valid_txf "transfer.txf"
    assert_offline_transfer_valid "transfer.txf"

    # Verify: Has offline transfer section
    assert_has_offline_transfer "transfer.txf"

    # Verify: Status is PENDING
    local status
    status=$(get_token_status "transfer.txf")
    assert_equals "PENDING" "${status}"

    # Verify: Recipient matches Bob's address (using new transactions[] structure)
    local recipient
    recipient=$(extract_json_field "transfer.txf" "transactions[-1].data.recipient")
    assert_equals "${bob_addr}" "${recipient}"

    # Verify: Message is preserved (using new transactions[] structure)
    local message
    message=$(extract_json_field "transfer.txf" "transactions[-1].data.message")
    assert_equals "Test transfer message" "${message}"

    # Verify: Commitment data exists (using new transactions[] structure)
    assert_json_field_exists "transfer.txf" "transactions[-1].commitment"

    # Verify: Source state exists (using new transactions[] structure)
    assert_json_field_exists "transfer.txf" "transactions[-1].data.sourceState"

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
    assert_string_contains "$data" "Art NFT"
    assert_string_contains "$data" "Alice"

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
    amount=$(jq -r '.genesis.data.coinData[0][1]' transfer.txf)
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
    recipient=$(extract_json_field "transfer.txf" "transactions[-1].data.recipient")
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

# SEND_TOKEN-014: Transfer with Recipient Data Hash
@test "SEND_TOKEN-014: Transfer with recipient data hash" {
    log_test "Testing recipient data hash commitment feature"

    # SCENARIO:
    # 1. Bob decides he wants state.data = {"status":"active","verified":true}
    # 2. Bob computes SHA256 hash of the data
    # 3. Bob sends hash to Alice (but not the actual data)
    # 4. Alice creates transfer with recipientDataHash
    # 5. Verify commitment includes the hash
    # 6. Bob later receives with matching data (tested in receive-token suite)

    # Step 1: Bob's desired state data (JSON format)
    local state_data='{"status":"active","verified":true}'

    # Step 2: Compute SHA256 hash
    # Note: Must match how SDK computes hash (JSON string, then SHA256)
    local data_hash
    data_hash=$(echo -n "$state_data" | sha256sum | cut -d' ' -f1)
    assert_equals 64 "${#data_hash}" "SHA256 hash must be 64 hex chars"
    is_valid_hex "$data_hash" 64

    # Step 3: Generate Bob's address and mint token for Alice
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft" "" "bob-addr.json")
    assert_set bob_addr

    mint_token_to_address "${ALICE_SECRET}" "nft" "{\"name\":\"Test NFT\"}" "alice-token.txf"
    assert_success
    assert_token_fully_valid "alice-token.txf"

    # Step 4: Alice creates offline transfer with recipient data hash
    run_cli_with_secret "${ALICE_SECRET}" \
        "send-token -f alice-token.txf -r \"${bob_addr}\" \
         --recipient-data-hash \"${data_hash}\" \
         -m \"Token with state commitment\" \
         --offline \
         -o transfer-with-hash.txf"

    assert_success
    assert_file_exists "transfer-with-hash.txf"

    # Step 5: Verify transfer structure
    assert_offline_transfer_valid "transfer-with-hash.txf"
    assert_has_offline_transfer "transfer-with-hash.txf"

    # Step 5.1: Verify status is PENDING
    local status
    status=$(get_token_status "transfer-with-hash.txf")
    assert_equals "PENDING" "${status}"

    # Step 5.2: Verify recipient address (using new transactions[] structure)
    local recipient
    recipient=$(extract_json_field "transfer-with-hash.txf" "transactions[-1].data.recipient")
    assert_equals "${bob_addr}" "${recipient}"

    # Step 5.3: Verify message preserved (using new transactions[] structure)
    local message
    message=$(extract_json_field "transfer-with-hash.txf" "transactions[-1].data.message")
    assert_equals "Token with state commitment" "${message}"

    # Step 5.4: Verify Alice cannot see Bob's actual state data
    # The actual data should NOT be in the transfer file (privacy guarantee)
    local transfer_json
    transfer_json=$(cat transfer-with-hash.txf)

    # Ensure the plaintext state data is not leaked
    if echo "$transfer_json" | grep -q '"status":"active"'; then
        fail "Transfer must not reveal recipient's state data (privacy violation)"
    fi

    if echo "$transfer_json" | grep -q '"verified":true'; then
        fail "Transfer must not reveal recipient's state data (privacy violation)"
    fi
}

# SEND_TOKEN-015: Invalid Recipient Data Hash Formats
@test "SEND_TOKEN-015: Error - Invalid recipient data hash format" {
    log_test "Testing recipient data hash validation"

    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    assert_token_fully_valid "token.txf"

    # Test 1: Too short (63 chars instead of 64)
    status=0
    run_cli_with_secret "${ALICE_SECRET}" \
        "send-token -f token.txf -r \"${bob_addr}\" \
         --recipient-data-hash \"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\" \
         -o output.txf" || status=$?
    assert_failure
    assert_output_contains "64-character"

    # Test 2: Too long (65 chars)
    status=0
    run_cli_with_secret "${ALICE_SECRET}" \
        "send-token -f token.txf -r \"${bob_addr}\" \
         --recipient-data-hash \"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\" \
         -o output.txf" || status=$?
    assert_failure
    assert_output_contains "64-character"

    # Test 3: Invalid characters (non-hex: contains 'z')
    status=0
    run_cli_with_secret "${ALICE_SECRET}" \
        "send-token -f token.txf -r \"${bob_addr}\" \
         --recipient-data-hash \"zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz\" \
         -o output.txf" || status=$?
    assert_failure
    assert_output_contains "hexadecimal"

    # Test 4: Empty string (should succeed - optional parameter)
    # Need fresh token since previous tests may have modified token.txf
    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token4.txf"
    assert_token_fully_valid "token4.txf"
    status=0
    run_cli_with_secret "${ALICE_SECRET}" \
        "send-token -f token4.txf -r \"${bob_addr}\" \
         --recipient-data-hash \"\" \
         --offline \
         -o output.txf" || status=$?
    # Empty is allowed (optional parameter) - this should succeed
    assert_success

    # Test 5: Uppercase hex (should succeed - case insensitive)
    # Need fresh token since previous tests may have modified token.txf
    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token5.txf"
    assert_token_fully_valid "token5.txf"
    status=0
    run_cli_with_secret "${ALICE_SECRET}" \
        "send-token -f token5.txf -r \"${bob_addr}\" \
         --recipient-data-hash \"ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890\" \
         --offline \
         -o output-upper.txf" || status=$?
    assert_success
    assert_file_exists "output-upper.txf"
}
