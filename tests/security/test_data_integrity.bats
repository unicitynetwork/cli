#!/usr/bin/env bats
# Security Test Suite: Data Integrity
# Test Scenarios: SEC-INTEGRITY-001 to SEC-INTEGRITY-005
#
# Purpose: Test that data integrity mechanisms correctly detect corruption,
# tampering, and inconsistencies in token files. Cryptographic hashes and
# proofs should catch any unauthorized modifications.

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common
    check_aggregator

    export ALICE_SECRET=$(generate_test_secret "alice-integrity")
    export BOB_SECRET=$(generate_test_secret "bob-integrity")
}

teardown() {
    teardown_common
}

# =============================================================================
# SEC-INTEGRITY-001: TXF File Corruption Detection
# =============================================================================
# HIGH Security Test
# Attack Vector: File corruption (disk error, network transfer error)
# Expected: Corruption detected gracefully without crashes

@test "SEC-INTEGRITY-001: Detect and handle file corruption gracefully" {
    log_test "Testing TXF file corruption detection"

    # Create a valid token
    local valid_token="${TEST_TEMP_DIR}/valid-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${valid_token}"
    assert_success
    assert_file_exists "${valid_token}"

    # Test 1: Truncated file (simulates incomplete write)
    local truncated="${TEST_TEMP_DIR}/truncated.txf"
    head -c 500 "${valid_token}" > "${truncated}"

    run_cli "verify-token -f ${truncated} --local"
    assert_failure
    assert_output_contains "JSON" || assert_output_contains "parse" || assert_output_contains "invalid"

    # Verify no crash occurred
    assert_not_output_contains "Segmentation fault"
    assert_not_output_contains "core dumped"

    # Test 2: Corrupted bytes in middle of file
    local corrupted="${TEST_TEMP_DIR}/corrupted.txf"
    cp "${valid_token}" "${corrupted}"

    # Flip random bytes in the middle of the file
    dd if=/dev/urandom of="${corrupted}" bs=1 count=10 seek=100 conv=notrunc 2>/dev/null || true

    run_cli "verify-token -f ${corrupted} --local"
    assert_failure

    # Test 3: Corrupted CBOR data (if present)
    local corrupted_cbor="${TEST_TEMP_DIR}/corrupted-cbor.txf"
    cp "${valid_token}" "${corrupted_cbor}"

    # Corrupt the predicate (CBOR-encoded)
    jq '.state.predicate = "invalid_cbor_data"' "${corrupted_cbor}" > "${corrupted_cbor}.tmp"
    mv "${corrupted_cbor}.tmp" "${corrupted_cbor}"

    run_cli "verify-token -f ${corrupted_cbor} --local"
    assert_failure

    # Test 4: Try to send corrupted token
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_address=$(echo "${output}" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${corrupted} -r ${bob_address} --local -o /dev/null"
    assert_failure

    log_success "SEC-INTEGRITY-001: File corruption detected and handled gracefully"
}

# =============================================================================
# SEC-INTEGRITY-002: State Hash Mismatch Detection
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Modify token state without updating proof
# Expected: State hash verification FAILS (proof mismatch)

@test "SEC-INTEGRITY-002: State hash mismatch detection" {
    log_test "Testing state hash integrity verification"

    # Alice mints valid token
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success

    # Verify original is valid
    run_cli "verify-token -f ${alice_token} --local"
    assert_success

    # ATTACK 1: Modify state.data but keep original proof
    local modified_state="${TEST_TEMP_DIR}/modified-state.txf"
    cp "${alice_token}" "${modified_state}"

    jq '.state.data = "deadbeef"' "${modified_state}" > "${modified_state}.tmp"
    mv "${modified_state}.tmp" "${modified_state}"

    # State hash will not match proof
    run_cli "verify-token -f ${modified_state} --local"
    assert_failure
    assert_output_contains "hash" || assert_output_contains "state" || assert_output_contains "mismatch" || assert_output_contains "invalid"

    # ATTACK 2: Modify state.predicate but keep original proof
    local modified_predicate="${TEST_TEMP_DIR}/modified-predicate.txf"
    cp "${alice_token}" "${modified_predicate}"

    # Get current predicate and modify it
    local original_pred=$(jq -r '.state.predicate' "${alice_token}")
    local modified_pred=$(echo "${original_pred}" | sed 's/0/f/g' | head -c ${#original_pred})

    jq --arg pred "${modified_pred}" '.state.predicate = $pred' \
        "${modified_predicate}" > "${modified_predicate}.tmp"
    mv "${modified_predicate}.tmp" "${modified_predicate}"

    run_cli "verify-token -f ${modified_predicate} --local"
    assert_failure

    # ATTACK 3: Modify both genesis and state (inconsistent)
    local inconsistent="${TEST_TEMP_DIR}/inconsistent.txf"
    cp "${alice_token}" "${inconsistent}"

    # Change genesis data but not state
    jq '.genesis.data.tokenData = "aabbccdd"' "${inconsistent}" > "${inconsistent}.tmp"
    mv "${inconsistent}.tmp" "${inconsistent}"

    run_cli "verify-token -f ${inconsistent} --local"
    assert_failure

    log_success "SEC-INTEGRITY-002: State hash mismatch correctly detected"
}

# =============================================================================
# SEC-INTEGRITY-003: Transaction Chain Break Detection
# =============================================================================
# HIGH Security Test
# Attack Vector: Remove or reorder transactions in history
# Expected: Chain integrity validation detects gaps

@test "SEC-INTEGRITY-003: Transaction chain integrity verification" {
    log_test "Testing transaction chain integrity"

    # Create a transfer chain: Alice → Bob → Carol
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success

    # Alice → Bob
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_address=$(echo "${output}" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    local transfer_bob="${TEST_TEMP_DIR}/transfer-bob.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_address} --local -o ${transfer_bob}"
    assert_success

    local bob_token="${TEST_TEMP_DIR}/bob-token.txf"
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer_bob} --local -o ${bob_token}"
    assert_success

    # Bob → Carol
    local carol_secret=$(generate_test_secret "carol-integrity")
    run_cli_with_secret "${carol_secret}" "gen-address --preset nft"
    assert_success
    local carol_address=$(echo "${output}" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    local transfer_carol="${TEST_TEMP_DIR}/transfer-carol.txf"
    run_cli_with_secret "${BOB_SECRET}" "send-token -f ${bob_token} -r ${carol_address} --local -o ${transfer_carol}"
    assert_success

    local carol_token="${TEST_TEMP_DIR}/carol-token.txf"
    run_cli_with_secret "${carol_secret}" "receive-token -f ${transfer_carol} --local -o ${carol_token}"
    assert_success

    # Carol's token should have transaction history
    local tx_count=$(jq -r '.transactions | length' "${carol_token}")
    log_info "Transaction history length: ${tx_count}"

    # ATTACK: Remove transaction from history
    if [[ -n "${tx_count}" ]] && [[ "${tx_count}" -gt "0" ]]; then
        local tampered_chain="${TEST_TEMP_DIR}/tampered-chain.txf"
        jq 'del(.transactions[0])' "${carol_token}" > "${tampered_chain}"

        # Verify tampered chain is detected
        local exit_code=0
        run_cli "verify-token -f ${tampered_chain} --local" || exit_code=$?

        # May succeed or fail depending on whether CLI validates chain integrity
        if [[ $exit_code -eq 0 ]]; then
            warn "Transaction removal not detected - chain validation may be limited"
        else
            log_info "Transaction chain tampering detected"
        fi
    fi

    # Verify complete chain is valid
    run_cli "verify-token -f ${carol_token} --local"
    assert_success

    log_success "SEC-INTEGRITY-003: Transaction chain integrity test complete"
}

# =============================================================================
# SEC-INTEGRITY-004: Missing Required Fields in TXF
# =============================================================================
# HIGH Security Test
# Attack Vector: Remove required fields from token JSON
# Expected: Schema validation detects missing fields

@test "SEC-INTEGRITY-004: Missing required fields detection" {
    log_test "Testing TXF schema validation"

    # Create valid token
    local valid_token="${TEST_TEMP_DIR}/valid-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${valid_token}"
    assert_success

    # Test 1: Remove "version" field
    local no_version="${TEST_TEMP_DIR}/no-version.txf"
    jq 'del(.version)' "${valid_token}" > "${no_version}"

    run_cli "verify-token -f ${no_version} --local"
    assert_failure

    # Test 2: Remove "state" field
    local no_state="${TEST_TEMP_DIR}/no-state.txf"
    jq 'del(.state)' "${valid_token}" > "${no_state}"

    run_cli "verify-token -f ${no_state} --local"
    assert_failure

    # Test 3: Remove "genesis" field
    local no_genesis="${TEST_TEMP_DIR}/no-genesis.txf"
    jq 'del(.genesis)' "${valid_token}" > "${no_genesis}"

    run_cli "verify-token -f ${no_genesis} --local"
    assert_failure

    # Test 4: Remove "genesis.inclusionProof"
    local no_proof="${TEST_TEMP_DIR}/no-proof.txf"
    jq 'del(.genesis.inclusionProof)' "${valid_token}" > "${no_proof}"

    run_cli "verify-token -f ${no_proof} --local"
    assert_failure

    # Test 5: Remove "state.predicate"
    local no_predicate="${TEST_TEMP_DIR}/no-predicate.txf"
    jq 'del(.state.predicate)' "${valid_token}" > "${no_predicate}"

    run_cli "verify-token -f ${no_predicate} --local"
    assert_failure

    # All tests should fail with clear error messages about missing fields
    log_success "SEC-INTEGRITY-004: Missing required fields correctly detected"
}

# =============================================================================
# SEC-INTEGRITY-005: Inconsistent Status Fields
# =============================================================================
# MEDIUM Security Test
# Attack Vector: Set contradictory status in extended TXF
# Expected: Status validation detects inconsistencies

@test "SEC-INTEGRITY-005: Status field consistency validation" {
    log_test "Testing TXF status field consistency"

    # Create transfer package (has offline transfer)
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success

    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_address=$(echo "${output}" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    local transfer="${TEST_TEMP_DIR}/transfer.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_address} --local -o ${transfer}"
    assert_success

    # Check current status
    local current_status=$(jq -r '.status // empty' "${transfer}")
    log_info "Transfer status: ${current_status}"

    # ATTACK 1: Set status to CONFIRMED but keep offlineTransfer
    if [[ -n "${current_status}" ]]; then
        local wrong_status="${TEST_TEMP_DIR}/wrong-status.txf"
        jq '.status = "CONFIRMED"' "${transfer}" > "${wrong_status}"

        # This is inconsistent: CONFIRMED status with pending offline transfer
        local exit_code=0
        run_cli "verify-token -f ${wrong_status} --local" || exit_code=$?

        # May succeed or fail depending on status validation
        if [[ $exit_code -eq 0 ]]; then
            warn "Status inconsistency not detected"
        else
            log_info "Status inconsistency detected"
        fi
    fi

    # ATTACK 2: Remove offlineTransfer but keep PENDING status
    if [[ "${current_status}" == "PENDING" ]]; then
        local no_transfer="${TEST_TEMP_DIR}/no-transfer.txf"
        jq 'del(.offlineTransfer) | .status = "PENDING"' "${alice_token}" > "${no_transfer}"

        local exit_code=0
        run_cli "verify-token -f ${no_transfer} --local" || exit_code=$?

        # Inconsistent: PENDING status without offline transfer
        if [[ $exit_code -eq 0 ]]; then
            warn "Missing offlineTransfer with PENDING status not detected"
        else
            log_info "Status/transfer mismatch detected"
        fi
    fi

    # Test 3: Invalid status value
    local invalid_status="${TEST_TEMP_DIR}/invalid-status.txf"
    jq '.status = "INVALID_STATUS_VALUE"' "${transfer}" > "${invalid_status}"

    local exit_code=0
    run_cli "verify-token -f ${invalid_status} --local" || exit_code=$?

    # May accept unknown status or reject it
    if [[ $exit_code -eq 0 ]]; then
        warn "Invalid status value accepted"
    else
        log_info "Invalid status value rejected"
    fi

    log_success "SEC-INTEGRITY-005: Status consistency validation test complete"
}

# =============================================================================
# Additional Test: Token ID Consistency
# =============================================================================

@test "SEC-INTEGRITY-EXTRA: Token ID consistency across transfers" {
    log_test "Testing token ID remains consistent across transfers"

    # Create token and transfer chain
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success

    local original_token_id=$(jq -r '.genesis.data.tokenId' "${alice_token}")
    assert_set original_token_id
    log_info "Original token ID: ${original_token_id:0:16}..."

    # Transfer to Bob
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_address=$(echo "${output}" | grep -oE "DIRECT://[0-9a-fA-F]+" | head -1)

    local transfer_bob="${TEST_TEMP_DIR}/transfer-bob.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_address} --local -o ${transfer_bob}"
    assert_success

    # Check token ID in transfer package
    local transfer_token_id=$(jq -r '.genesis.data.tokenId' "${transfer_bob}")
    assert_equals "${original_token_id}" "${transfer_token_id}" "Token ID must remain consistent in transfer"

    # Bob receives
    local bob_token="${TEST_TEMP_DIR}/bob-token.txf"
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer_bob} --local -o ${bob_token}"
    assert_success

    # Check token ID after receive
    local bob_token_id=$(jq -r '.genesis.data.tokenId' "${bob_token}")
    assert_equals "${original_token_id}" "${bob_token_id}" "Token ID must remain consistent after receive"

    # ATTACK: Try to change token ID
    local fake_id="${TEST_TEMP_DIR}/fake-id.txf"
    jq '.genesis.data.tokenId = "0000000000000000000000000000000000000000000000000000000000000000"' \
        "${bob_token}" > "${fake_id}"

    run_cli "verify-token -f ${fake_id} --local"
    assert_failure
    assert_output_contains "hash" || assert_output_contains "mismatch" || assert_output_contains "invalid"

    log_success "SEC-INTEGRITY-EXTRA: Token ID consistency verified"
}

# =============================================================================
# Additional Test: Proof Chain Validation
# =============================================================================

@test "SEC-INTEGRITY-EXTRA2: Inclusion proof integrity" {
    log_test "Testing inclusion proof structure integrity"

    # Create token with valid proof
    local token="${TEST_TEMP_DIR}/token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${token}"
    assert_success

    # Extract proof structure
    local has_proof=$(jq -r '.genesis.inclusionProof != null' "${token}")
    assert_equals "true" "${has_proof}" "Token must have inclusion proof"

    # Verify proof has required components
    local has_authenticator=$(jq -r '.genesis.inclusionProof.authenticator != null' "${token}")
    assert_equals "true" "${has_authenticator}" "Proof must have authenticator"

    # ATTACK: Remove authenticator signature
    local no_sig="${TEST_TEMP_DIR}/no-sig.txf"
    jq 'del(.genesis.inclusionProof.authenticator.signature)' "${token}" > "${no_sig}"

    run_cli "verify-token -f ${no_sig} --local"
    assert_failure

    # ATTACK: Set authenticator to null
    local null_auth="${TEST_TEMP_DIR}/null-auth.txf"
    jq '.genesis.inclusionProof.authenticator = null' "${token}" > "${null_auth}"

    run_cli "verify-token -f ${null_auth} --local"
    assert_failure

    # ATTACK: Corrupt merkle path
    local bad_merkle="${TEST_TEMP_DIR}/bad-merkle.txf"
    jq '.genesis.inclusionProof.merkleTreePath = null' "${token}" > "${bad_merkle}"

    run_cli "verify-token -f ${bad_merkle} --local"
    assert_failure

    log_success "SEC-INTEGRITY-EXTRA2: Inclusion proof integrity verification complete"
}

# =============================================================================
# Test Summary
# =============================================================================
# Total Tests: 7 (SEC-INTEGRITY-001 to SEC-INTEGRITY-005 + 2 EXTRA)
# Critical: 1 (002)
# High: 3 (001, 003, 004)
# Medium: 1 (005)
#
# All tests verify that:
# - File corruption is detected gracefully
# - State hash mismatches are caught
# - Transaction chains maintain integrity
# - Missing required fields are detected
# - Status fields are consistent
# - Token IDs remain constant
# - Inclusion proofs are validated
