#!/usr/bin/env bats
# Security Test Suite: Double-Spend Prevention
# Test Scenarios: SEC-DBLSPEND-001 to SEC-DBLSPEND-006
#
# Purpose: Test that the Unicity protocol correctly prevents double-spending
# of tokens. Only ONE spend of each token should succeed, all others must FAIL.
# These tests verify atomic state transitions and network consensus.

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common
    check_aggregator

    export ALICE_SECRET=$(generate_test_secret "alice-dblspend")
    export BOB_SECRET=$(generate_test_secret "bob-dblspend")
    export CAROL_SECRET=$(generate_test_secret "carol-dblspend")
}

teardown() {
    teardown_common
}

# =============================================================================
# SEC-DBLSPEND-001: Submit Same Token to Two Recipients
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Create two transfer packages for same token to different recipients
# Expected: First submission succeeds, second submission FAILS

@test "SEC-DBLSPEND-001: Same token to two recipients - only ONE succeeds" {
    log_test "Testing basic double-spend prevention"

    # Alice mints a token
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success
    assert_file_exists "${alice_token}"
    assert_token_fully_valid "${alice_token}"

    # Generate addresses for Bob and Carol
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_address=$(echo "${output}" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    run_cli_with_secret "${CAROL_SECRET}" "gen-address --preset nft"
    assert_success
    local carol_address=$(echo "${output}" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    # Alice creates transfer to Bob (using ORIGINAL token)
    local transfer_bob="${TEST_TEMP_DIR}/transfer-bob.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_address} --local -o ${transfer_bob}"
    assert_success
    assert_file_exists "${transfer_bob}"
    assert_offline_transfer_valid "${transfer_bob}"

    # ATTACK: Alice creates transfer to Carol using SAME ORIGINAL token
    # This creates two competing transfers for the same token state
    local transfer_carol="${TEST_TEMP_DIR}/transfer-carol.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${carol_address} --local -o ${transfer_carol}"
    assert_success  # Creation of transfer package succeeds (offline operation)
    assert_file_exists "${transfer_carol}"
    assert_offline_transfer_valid "${transfer_carol}"

    # Now both Bob and Carol try to receive their transfers
    # Only ONE should succeed - the other will fail with "already spent"

    local bob_received="${TEST_TEMP_DIR}/bob-token.txf"
    local carol_received="${TEST_TEMP_DIR}/carol-token.txf"

    # Submit both transfers (first to reach network wins)
    local bob_exit=0
    local carol_exit=0

    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer_bob} --local -o ${bob_received}" || bob_exit=$?
    run_cli_with_secret "${CAROL_SECRET}" "receive-token -f ${transfer_carol} --local -o ${carol_received}" || carol_exit=$?

    # Verify EXACTLY ONE succeeded and ONE failed
    local success_count=0
    local failure_count=0

    if [[ $bob_exit -eq 0 ]]; then
        ((success_count++))
        assert_file_exists "${bob_received}"
        assert_token_fully_valid "${bob_received}"
        log_info "Bob successfully received token"
    else
        ((failure_count++))
        log_info "Bob's receive failed (expected for double-spend)"
    fi

    if [[ $carol_exit -eq 0 ]]; then
        ((success_count++))
        assert_file_exists "${carol_received}"
        assert_token_fully_valid "${carol_received}"
        log_info "Carol successfully received token"
    else
        ((failure_count++))
        log_info "Carol's receive failed (expected for double-spend)"
    fi

    # Critical assertion: Exactly ONE success and ONE failure
    assert_equals "1" "${success_count}" "Expected exactly ONE successful transfer"
    assert_equals "1" "${failure_count}" "Expected exactly ONE failed transfer (double-spend prevented)"

    log_success "SEC-DBLSPEND-001: Double-spend successfully prevented - only ONE transfer succeeded"
}

# =============================================================================
# SEC-DBLSPEND-002: Race Condition in Concurrent Submissions
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Submit same commitment from multiple clients simultaneously
# Expected: Network consensus ensures EXACTLY ONE submission succeeds

@test "SEC-DBLSPEND-002: Concurrent submissions - exactly ONE succeeds" {
    log_test "Testing race condition double-spend prevention"

    # Alice mints token
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success
    assert_token_fully_valid "${alice_token}"

    # Bob generates address
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_address=$(echo "${output}" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    # Alice creates ONE transfer to Bob
    local transfer="${TEST_TEMP_DIR}/transfer-bob.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_address} --local -o ${transfer}"
    assert_success
    assert_offline_transfer_valid "${transfer}"

    # ATTACK: Launch multiple parallel receive attempts with SAME transfer file
    # Simulates race condition where multiple clients try to claim same transfer
    local concurrent_count=5
    local success_count=0
    local pids=()

    log_info "Launching ${concurrent_count} concurrent receive attempts..."

    for i in $(seq 1 ${concurrent_count}); do
        local output_file="${TEST_TEMP_DIR}/bob-token-attempt-${i}.txf"
        (
            SECRET="${BOB_SECRET}" "${UNICITY_NODE_BIN:-node}" "$(get_cli_path)" \
                receive-token -f "${transfer}" --local -o "${output_file}" \
                >/dev/null 2>&1
            echo $? > "${TEST_TEMP_DIR}/exit-${i}.txt"
        ) &
        pids+=($!)
    done

    # Wait for all background processes to complete
    for pid in "${pids[@]}"; do
        wait "$pid" || true  # Don't fail if process fails (expected for double-spend)
    done

    # Count how many succeeded vs failed
    success_count=0
    failure_count=0

    for i in $(seq 1 ${concurrent_count}); do
        if [[ -f "${TEST_TEMP_DIR}/exit-${i}.txt" ]]; then
            local exit_code=$(cat "${TEST_TEMP_DIR}/exit-${i}.txt")
            if [[ $exit_code -eq 0 ]]; then
                ((success_count++))
            else
                ((failure_count++))
            fi
        fi
    done

    log_info "Results: ${success_count} succeeded, ${failure_count} failed"

    # Critical assertion: Exactly ONE success despite concurrent attempts
    assert_equals "1" "${success_count}" "Expected exactly ONE successful receive in race condition"
    assert_equals "$((concurrent_count - 1))" "${failure_count}" "Expected all other attempts to fail"

    # Verify exactly ONE valid token file was created
    local valid_tokens=$(ls -1 "${TEST_TEMP_DIR}"/bob-token-attempt-*.txf 2>/dev/null | wc -l)
    assert_equals "1" "${valid_tokens}" "Expected exactly ONE valid token file"

    log_success "SEC-DBLSPEND-002: Race condition handled correctly - only ONE concurrent submission succeeded"
}

# =============================================================================
# SEC-DBLSPEND-003: Re-spend Already Transferred Token
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Attempt to send token that was previously transferred
# Expected: Network rejects with "already spent" or similar error

@test "SEC-DBLSPEND-003: Cannot re-spend already transferred token" {
    log_test "Testing prevention of spending already-spent tokens"

    # Alice mints token
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success
    assert_token_fully_valid "${alice_token}"

    # Bob and Carol generate addresses
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_address=$(echo "${output}" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    run_cli_with_secret "${CAROL_SECRET}" "gen-address --preset nft"
    assert_success
    local carol_address=$(echo "${output}" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    # Alice sends token to Bob and Bob receives it (completes transfer)
    local transfer_bob="${TEST_TEMP_DIR}/transfer-bob.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_address} --local -o ${transfer_bob}"
    assert_success
    assert_offline_transfer_valid "${transfer_bob}"

    local bob_token="${TEST_TEMP_DIR}/bob-token.txf"
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer_bob} --local -o ${bob_token}"
    assert_success
    assert_file_exists "${bob_token}"
    assert_token_fully_valid "${bob_token}"

    # Alice keeps a copy of the original token file (before transfer)
    # ATTACK: Alice tries to send the token AGAIN using her old token file
    local transfer_carol="${TEST_TEMP_DIR}/transfer-carol-attack.txf"
    local exit_code=0
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${carol_address} --local -o ${transfer_carol}" || exit_code=$?

    # The send-token might succeed locally (creates offline package)
    # BUT when Carol tries to receive it, the network will reject it
    if [[ $exit_code -eq 0 ]] && [[ -f "${transfer_carol}" ]]; then
        # Carol tries to receive the stale transfer
        run_cli_with_secret "${CAROL_SECRET}" "receive-token -f ${transfer_carol} --local -o ${TEST_TEMP_DIR}/carol-token.txf"

        # This MUST fail - token already spent
        assert_failure
        assert_output_contains "spent" || assert_output_contains "invalid" || assert_output_contains "outdated"
    fi

    # Verify Bob still has the token (legitimate owner)
    run_cli "verify-token -f ${bob_token} --local"
    assert_success

    log_success "SEC-DBLSPEND-003: Re-spending already-transferred token successfully prevented"
}

# =============================================================================
# SEC-DBLSPEND-004: Offline Package Double-Receive Attempt
# =============================================================================
# HIGH Security Test
# Attack Vector: Recipient tries to claim offline transfer multiple times
# Expected: Only first receive succeeds OR idempotent (returns same result)

@test "SEC-DBLSPEND-004: Cannot receive same offline transfer multiple times" {
    log_test "Testing offline transfer double-receive prevention"

    # Alice mints token and creates offline transfer to Bob
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success
    assert_token_fully_valid "${alice_token}"

    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_address=$(echo "${output}" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    local transfer="${TEST_TEMP_DIR}/transfer-bob.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_address} --local -o ${transfer}"
    assert_success
    assert_offline_transfer_valid "${transfer}"

    # Bob receives the transfer (FIRST TIME - should succeed)
    local bob_token1="${TEST_TEMP_DIR}/bob-token-1.txf"
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer} --local -o ${bob_token1}"
    assert_success
    assert_file_exists "${bob_token1}"
    assert_token_fully_valid "${bob_token1}"

    # ATTACK: Bob tries to receive SAME transfer again
    local bob_token2="${TEST_TEMP_DIR}/bob-token-2.txf"
    local exit_code=0
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer} --local -o ${bob_token2}" || exit_code=$?

    # Expected behavior: Either FAILS or is idempotent (returns same state)
    if [[ $exit_code -eq 0 ]]; then
        # If succeeded, verify it's idempotent (same token state)
        assert_file_exists "${bob_token2}"
        assert_token_fully_valid "${bob_token2}"

        local token1_id=$(jq -r '.genesis.data.tokenId' "${bob_token1}")
        local token2_id=$(jq -r '.genesis.data.tokenId' "${bob_token2}")

        assert_equals "${token1_id}" "${token2_id}" "Token IDs should match (idempotent receive)"

        # Both should represent the same token state
        log_info "Second receive was idempotent (acceptable)"
    else
        # If failed, verify error indicates already processed
        assert_output_contains "already" || assert_output_contains "submitted" || assert_output_contains "duplicate"
        log_info "Second receive rejected as duplicate (expected)"
    fi

    # Verify Bob's first token is valid
    run_cli "verify-token -f ${bob_token1} --local"
    assert_success

    log_success "SEC-DBLSPEND-004: Double-receive prevention verified"
}

# =============================================================================
# SEC-DBLSPEND-005: Multi-Hop Token State Rollback
# =============================================================================
# HIGH Security Test
# Attack Vector: Use intermediate token state to bypass final ownership
# Expected: Network tracks current state; old states are rejected

@test "SEC-DBLSPEND-005: Cannot use intermediate state after subsequent transfer" {
    log_test "Testing state rollback prevention in token chain"

    # Create token transfer chain: Alice → Bob → Carol
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success
    assert_token_fully_valid "${alice_token}"

    # Bob generates address and receives from Alice
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_address=$(echo "${output}" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    local transfer_to_bob="${TEST_TEMP_DIR}/transfer-bob.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_address} --local -o ${transfer_to_bob}"
    assert_success
    assert_offline_transfer_valid "${transfer_to_bob}"

    local bob_token="${TEST_TEMP_DIR}/bob-token.txf"
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer_to_bob} --local -o ${bob_token}"
    assert_success
    assert_token_fully_valid "${bob_token}"

    # Carol generates address and receives from Bob
    run_cli_with_secret "${CAROL_SECRET}" "gen-address --preset nft"
    assert_success
    local carol_address=$(echo "${output}" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    local transfer_to_carol="${TEST_TEMP_DIR}/transfer-carol.txf"
    run_cli_with_secret "${BOB_SECRET}" "send-token -f ${bob_token} -r ${carol_address} --local -o ${transfer_to_carol}"
    assert_success
    assert_offline_transfer_valid "${transfer_to_carol}"

    local carol_token="${TEST_TEMP_DIR}/carol-token.txf"
    run_cli_with_secret "${CAROL_SECRET}" "receive-token -f ${transfer_to_carol} --local -o ${carol_token}"
    assert_success
    assert_token_fully_valid "${carol_token}"

    # Current state: Carol owns the token
    # Bob's intermediate state (bob_token) is now outdated

    # ATTACK: Bob keeps his intermediate token file and tries to send it
    # This should FAIL because the token has already been transferred to Carol
    local dave_secret=$(generate_test_secret "dave-rollback")
    run_cli_with_secret "${dave_secret}" "gen-address --preset nft"
    assert_success
    local dave_address=$(echo "${output}" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    local transfer_to_dave="${TEST_TEMP_DIR}/transfer-dave-attack.txf"
    local exit_code=0
    run_cli_with_secret "${BOB_SECRET}" "send-token -f ${bob_token} -r ${dave_address} --local -o ${transfer_to_dave}" || exit_code=$?

    # Sending might succeed locally, but receiving will fail
    if [[ $exit_code -eq 0 ]]; then
        run_cli_with_secret "${dave_secret}" "receive-token -f ${transfer_to_dave} --local -o ${TEST_TEMP_DIR}/dave-token.txf"

        # This MUST fail - Bob's state is outdated
        assert_failure
        assert_output_contains "spent" || assert_output_contains "outdated" || assert_output_contains "invalid"
    fi

    # Verify Carol still owns the token (current owner)
    run_cli "verify-token -f ${carol_token} --local"
    assert_success

    log_success "SEC-DBLSPEND-005: State rollback attack successfully prevented"
}

# =============================================================================
# SEC-DBLSPEND-006: Coin Split Double-Spend (Fungible Tokens)
# =============================================================================
# HIGH Security Test
# Attack Vector: Attempt to spend same coin in multiple transactions
# Expected: Network tracks coin IDs and prevents double-use

@test "SEC-DBLSPEND-006: Coin double-spend prevention for fungible tokens" {
    log_test "Testing coin ID tracking for fungible tokens"

    # Alice mints a UCT token with coins
    local alice_uct="${TEST_TEMP_DIR}/alice-uct.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset uct --local -o ${alice_uct}"
    assert_success
    assert_token_fully_valid "${alice_uct}"

    # Verify token is fungible (UCT type)
    local token_type=$(jq -r '.genesis.data.tokenType' "${alice_uct}")
    assert_equals "${TOKEN_TYPE_UCT}" "${token_type}"

    # Generate recipient addresses
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset uct"
    assert_success
    local bob_address=$(echo "${output}" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    run_cli_with_secret "${CAROL_SECRET}" "gen-address --preset uct"
    assert_success
    local carol_address=$(echo "${output}" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    # Note: Current CLI may not support coin splitting yet (full token transfers only)
    # This test verifies that if splitting were attempted, the same coin ID cannot be used twice

    # Try to send full token to Bob
    local transfer_bob="${TEST_TEMP_DIR}/transfer-bob-uct.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_uct} -r ${bob_address} --local -o ${transfer_bob}"
    assert_success
    assert_offline_transfer_valid "${transfer_bob}"

    # ATTACK: Try to send same token to Carol (simulating coin splitting attack)
    local transfer_carol="${TEST_TEMP_DIR}/transfer-carol-uct.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_uct} -r ${carol_address} --local -o ${transfer_carol}"
    assert_success  # Offline package creation succeeds
    assert_offline_transfer_valid "${transfer_carol}"

    # Only ONE receive should succeed
    local bob_received=0
    local carol_received=0

    if run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer_bob} --local -o ${TEST_TEMP_DIR}/bob-uct.txf"; then
        bob_received=1
        assert_token_fully_valid "${TEST_TEMP_DIR}/bob-uct.txf"
    fi

    if run_cli_with_secret "${CAROL_SECRET}" "receive-token -f ${transfer_carol} --local -o ${TEST_TEMP_DIR}/carol-uct.txf"; then
        carol_received=1
        assert_token_fully_valid "${TEST_TEMP_DIR}/carol-uct.txf"
    fi

    # Verify exactly ONE succeeded
    local total_received=$((bob_received + carol_received))
    assert_equals "1" "${total_received}" "Expected exactly ONE successful UCT transfer"

    log_success "SEC-DBLSPEND-006: Fungible token coin tracking verified"
}

# =============================================================================
# Test Summary
# =============================================================================
# Total Tests: 6 (SEC-DBLSPEND-001 to SEC-DBLSPEND-006)
# Critical: 3 (001, 002, 003)
# High: 3 (004, 005, 006)
#
# All tests verify that double-spend attacks FAIL as expected.
# Network consensus ensures atomic state transitions.
# Only ONE spend of each token/coin succeeds.
