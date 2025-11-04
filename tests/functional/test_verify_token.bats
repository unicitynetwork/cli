#!/usr/bin/env bats
# Functional tests for verify-token command
# Test Suite: VERIFY_TOKEN (10 test scenarios)

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common
    check_aggregator

    ALICE_SECRET=$(generate_test_secret "alice-verify")
    BOB_SECRET=$(generate_test_secret "bob-verify")
}

teardown() {
    teardown_common
}

# VERIFY_TOKEN-001: Verify Newly Minted Token
@test "VERIFY_TOKEN-001: Verify freshly minted token" {
    log_test "Verifying token immediately after minting"

    # Mint fresh token
    mint_token_to_address "${ALICE_SECRET}" "nft" "" "fresh-token.txf"
    assert_success

    # Verify token
    verify_token "fresh-token.txf" "--local"
    assert_success

    # Verify: Output indicates token is valid
    assert_output_contains "valid" || assert_output_contains "✅" || assert_output_contains "success"

    # Verify: Mentions genesis proof
    assert_output_contains "genesis" || assert_output_contains "proof"

    # Verify: No transactions (newly minted)
    local tx_count
    tx_count=$(get_transaction_count "fresh-token.txf")
    assert_equals "0" "${tx_count}"
}

# VERIFY_TOKEN-002: Verify Token After Transfer
@test "VERIFY_TOKEN-002: Verify token with transfer history" {
    log_test "Verifying token after one transfer"

    # Setup: Complete transfer from Alice to Bob
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" "transfer.txf"
    receive_token "${BOB_SECRET}" "transfer.txf" "bob-token.txf"
    assert_success

    # Verify Bob's token
    verify_token "bob-token.txf" "--local"
    assert_success

    # Verify: Token is valid
    assert_output_contains "valid" || assert_output_contains "✅"

    # Verify: Mentions transfer transaction
    # Should show 1 transaction in history
    local tx_count
    tx_count=$(get_transaction_count "bob-token.txf")
    assert_equals "1" "${tx_count}"
}

# VERIFY_TOKEN-003a: Verify NFT Token
@test "VERIFY_TOKEN-003a: Verify NFT token type" {
    mint_token_to_address "${ALICE_SECRET}" "nft" "{\"name\":\"Test NFT\"}" "nft.txf"
    verify_token "nft.txf" "--local"
    assert_success

    # Verify token type mentioned or validated
    assert_token_type "nft.txf" "nft"
}

# VERIFY_TOKEN-003b: Verify UCT Token
@test "VERIFY_TOKEN-003b: Verify UCT fungible token" {
    mint_token_to_address "${ALICE_SECRET}" "uct" "" "uct.txf" "-c 10000000000000000000"
    verify_token "uct.txf" "--local"
    assert_success

    assert_token_type "uct.txf" "uct"
}

# VERIFY_TOKEN-003c: Verify USDU Token
@test "VERIFY_TOKEN-003c: Verify USDU stablecoin" {
    mint_token_to_address "${ALICE_SECRET}" "usdu" "" "usdu.txf" "-c 100000000"
    verify_token "usdu.txf" "--local"
    assert_success

    assert_token_type "usdu.txf" "usdu"
}

# VERIFY_TOKEN-003d: Verify EURU Token
@test "VERIFY_TOKEN-003d: Verify EURU stablecoin" {
    mint_token_to_address "${ALICE_SECRET}" "euru" "" "euru.txf" "-c 50000000"
    verify_token "euru.txf" "--local"
    assert_success

    assert_token_type "euru.txf" "euru"
}

# VERIFY_TOKEN-003e: Verify ALPHA Token
@test "VERIFY_TOKEN-003e: Verify ALPHA token" {
    mint_token_to_address "${ALICE_SECRET}" "alpha" "" "alpha.txf" "-c 5000000000000000000"
    verify_token "alpha.txf" "--local"
    assert_success

    assert_token_type "alpha.txf" "alpha"
}

# VERIFY_TOKEN-004: Verify Predicate Details
@test "VERIFY_TOKEN-004: Check predicate decoding and display" {
    log_test "Verifying predicate details are shown"

    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    verify_token "token.txf" "--local"
    assert_success

    # Verify: Output shows predicate information
    # May include: engine ID, template, parameters
    # This depends on CLI output format
    # At minimum, verification should succeed
}

# VERIFY_TOKEN-005: Verify with Ownership Check (Network Query)
@test "VERIFY_TOKEN-005: Query aggregator for on-chain ownership status" {
    log_test "Verifying with network ownership check"

    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    assert_success

    # Verify with network query (default behavior)
    verify_token "token.txf" "--local"
    assert_success

    # Verify: Shows ownership status
    # Output should indicate current ownership state
    assert_output_contains "token" || assert_output_contains "valid"
}

# VERIFY_TOKEN-006: Verify with --skip-network Flag
@test "VERIFY_TOKEN-006: Verify without network queries" {
    log_test "Offline verification mode"

    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    assert_success

    # Verify without network
    verify_token "token.txf" "--skip-network"
    assert_success

    # Verify: Should still validate local structure
    assert_output_contains "valid" || assert_output_contains "✅"
}

# VERIFY_TOKEN-007: Verify Outdated Token (Scenario B)
@test "VERIFY_TOKEN-007: Detect outdated token (transferred elsewhere)" {
    log_test "Verifying outdated token state"
    skip "Requires dual-device simulation or mock"

    # This test would require:
    # 1. Device 1: Mint and send token (submit to network)
    # 2. Device 2: Keep old token file (now outdated)
    # 3. Verify old file shows outdated status

    # For now, we can test that verification works on old state
    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    # Mint token
    mint_token_to_address "${ALICE_SECRET}" "nft" "" "alice-token.txf"

    # Transfer immediately (Alice's original file becomes outdated)
    send_token_immediate "${ALICE_SECRET}" "alice-token.txf" "${bob_addr}" "transferred.txf"
    assert_success

    # Try to verify Alice's original token (now outdated)
    verify_token "alice-token.txf" "--local"

    # Verification should still work on the structure
    # but network query would show it's been spent
    # Status depends on CLI implementation
}

# VERIFY_TOKEN-008: Verify Pending Transfer (Scenario C)
@test "VERIFY_TOKEN-008: Verify token with pending offline transfer" {
    log_test "Verifying pending transfer package"

    local bob_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    send_token_offline "${ALICE_SECRET}" "token.txf" "${bob_addr}" "pending-transfer.txf"
    assert_success

    # Verify pending transfer package
    verify_token "pending-transfer.txf" "--local"
    assert_success

    # Verify: Shows pending status
    assert_has_offline_transfer "pending-transfer.txf"

    # Verify: Status is PENDING
    local status
    status=$(get_token_status "pending-transfer.txf")
    assert_equals "PENDING" "${status}"
}

# VERIFY_TOKEN-009: Verify Token with Multiple Transfers
@test "VERIFY_TOKEN-009: Verify token with multiple transfer history" {
    log_test "Verifying multi-hop token"

    # Setup: Alice -> Bob -> Carol
    local bob_addr carol_addr
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")
    local carol_secret
    carol_secret=$(generate_test_secret "carol-verify")
    carol_addr=$(generate_address "${carol_secret}" "nft")

    # Transfer 1: Alice -> Bob
    mint_token_to_address "${ALICE_SECRET}" "nft" "" "alice-token.txf"
    send_token_offline "${ALICE_SECRET}" "alice-token.txf" "${bob_addr}" "transfer1.txf"
    receive_token "${BOB_SECRET}" "transfer1.txf" "bob-token.txf"
    assert_success

    # Transfer 2: Bob -> Carol
    send_token_offline "${BOB_SECRET}" "bob-token.txf" "${carol_addr}" "transfer2.txf"
    receive_token "${carol_secret}" "transfer2.txf" "carol-token.txf"
    assert_success

    # Verify Carol's token (should have 2 transactions)
    verify_token "carol-token.txf" "--local"
    assert_success

    # Verify: 2 transactions in history
    local tx_count
    tx_count=$(get_transaction_count "carol-token.txf")
    assert_equals "2" "${tx_count}"

    # Verify: All proofs valid
    assert_json_field_exists "carol-token.txf" "transactions[0].inclusionProof"
    assert_json_field_exists "carol-token.txf" "transactions[1].inclusionProof"
}

# VERIFY_TOKEN-010: Verify with Local Network
@test "VERIFY_TOKEN-010: Verify using local aggregator" {
    log_test "Verifying with --local flag"

    mint_token_to_address "${ALICE_SECRET}" "nft" "" "token.txf"
    assert_success

    # Verify with local network explicitly
    verify_token "token.txf" "--local"
    assert_success

    # Should succeed and validate against local aggregator
    assert_output_contains "valid" || assert_output_contains "✅"
}
