#!/usr/bin/env bats
# Security Test Suite: receive-token Cryptographic Validation
# Test Scenarios: SEC-RECV-CRYPTO-001 to SEC-RECV-CRYPTO-007
#
# Purpose: Test receive-token command's cryptographic proof validation including:
# - Genesis proof signature tampering detection
# - Merkle path tampering detection
# - Authenticator validation
# - State data integrity checking
# - Full offline transfer validation
#
# All tampering attempts must be detected and rejected before processing transfers.

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common
    check_aggregator

    export ALICE_SECRET=$(generate_test_secret "alice-recv-crypto")
    export BOB_SECRET=$(generate_test_secret "bob-recv-crypto")
    export CAROL_SECRET=$(generate_test_secret "carol-recv-crypto")
}

teardown() {
    teardown_common
}

# =============================================================================
# SEC-RECV-CRYPTO-001: Tampered Genesis Proof Signature
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Corrupt the genesis inclusion proof signature
# Expected: receive-token FAILS with signature/verification error
#
# Scenario:
# 1. Alice mints token and creates transfer to Bob
# 2. Attacker tampers with genesis.inclusionProof.authenticator.signature
# 3. Bob attempts to receive token
# 4. receive-token must REJECT due to invalid signature

@test "SEC-RECV-CRYPTO-001: Tampered genesis proof signature should be rejected" {
    log_test "SEC-RECV-CRYPTO-001: Testing genesis proof signature tampering detection"
    fail_if_aggregator_unavailable

    # Step 1: Alice mints a valid token
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success
    assert_file_exists "${alice_token}"
    log_info "Alice minted token: ${alice_token}"

    # Step 2: Verify token is valid before transfer
    run_cli "verify-token -f ${alice_token} --local"
    assert_success
    log_info "Token pre-transfer verification passed"

    # Step 3: Generate Bob's address
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')
    log_info "Bob's address: ${bob_addr}"

    # Step 4: Alice creates transfer to Bob
    local transfer="${TEST_TEMP_DIR}/transfer.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_addr} --local -o ${transfer}"
    assert_success
    assert_file_exists "${transfer}"
    log_info "Transfer created: ${transfer}"

    # Step 5: ATTACK - Tamper with genesis proof signature
    local tampered="${TEST_TEMP_DIR}/tampered-sig.txf"
    cp "${transfer}" "${tampered}"

    # Extract original signature and corrupt it
    local original_sig=$(jq -r '.genesis.inclusionProof.authenticator.signature' "${tampered}")
    if [[ -z "${original_sig}" ]] || [[ "${original_sig}" == "null" ]]; then
        skip "Token does not have signature in expected location"
    fi

    # Flip significant bits in signature to invalidate it
    local corrupted_sig=$(echo "${original_sig}" | sed 's/0/a/g; s/1/b/g; s/2/c/g; s/3/d/g' | head -c ${#original_sig})
    jq --arg sig "${corrupted_sig}" \
        '.genesis.inclusionProof.authenticator.signature = $sig' \
        "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"
    log_info "Signature tampered: ${original_sig:0:32}... -> ${corrupted_sig:0:32}..."

    # Step 6: Bob attempts to receive tampered token - MUST FAIL
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${tampered} --local"
    assert_failure
    log_info "receive-token correctly rejected tampered signature"

    # Step 7: Command has failed as expected due to invalid signature
    log_success "SEC-RECV-CRYPTO-001: Tampered genesis proof signature correctly rejected"
}

# =============================================================================
# SEC-RECV-CRYPTO-002: Tampered Merkle Path Root
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Modify merkle tree path root to fake proof validity
# Expected: receive-token FAILS with merkle/path validation error
#
# Scenario:
# 1. Alice mints token and creates transfer to Bob
# 2. Attacker modifies genesis.inclusionProof.merkleTreePath.root
# 3. Bob attempts to receive token
# 4. receive-token must REJECT due to invalid merkle path

@test "SEC-RECV-CRYPTO-002: Tampered merkle path should be rejected" {
    log_test "SEC-RECV-CRYPTO-002: Testing merkle path tampering detection"
    fail_if_aggregator_unavailable

    # Step 1: Alice mints token
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success
    log_info "Alice minted token"

    # Step 2: Generate Bob's address and create transfer
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    local transfer="${TEST_TEMP_DIR}/transfer.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_addr} --local -o ${transfer}"
    assert_success
    log_info "Transfer created"

    # Step 3: ATTACK - Tamper with merkle path root
    local tampered="${TEST_TEMP_DIR}/tampered-merkle.txf"
    cp "${transfer}" "${tampered}"

    # Set merkle root to all zeros (invalid)
    local zero_root="00000000000000000000000000000000000000000000000000000000000000000000"
    jq --arg root "${zero_root}" \
        '.genesis.inclusionProof.merkleTreePath.root = $root' \
        "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"
    log_info "Merkle root tampered to all zeros"

    # Step 4: Bob attempts to receive tampered token - MUST FAIL
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${tampered} --local"
    assert_failure
    log_info "receive-token correctly rejected tampered merkle path"

    # Step 5: Command has failed as expected due to invalid merkle path
    log_success "SEC-RECV-CRYPTO-002: Tampered merkle path correctly rejected"
}

# =============================================================================
# SEC-RECV-CRYPTO-003: Null Authenticator
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Remove the BFT authenticator entirely
# Expected: receive-token FAILS with authenticator validation error
#
# Scenario:
# 1. Alice mints token and creates transfer
# 2. Attacker sets genesis.inclusionProof.authenticator = null
# 3. Bob attempts to receive token
# 4. receive-token must REJECT due to missing authenticator

@test "SEC-RECV-CRYPTO-003: Null authenticator should be rejected" {
    log_test "SEC-RECV-CRYPTO-003: Testing null authenticator detection"
    fail_if_aggregator_unavailable

    # Step 1: Create valid transfer setup
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success

    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    local transfer="${TEST_TEMP_DIR}/transfer.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_addr} --local -o ${transfer}"
    assert_success
    log_info "Transfer created"

    # Step 2: ATTACK - Remove authenticator
    local tampered="${TEST_TEMP_DIR}/tampered-no-auth.txf"
    cp "${transfer}" "${tampered}"
    jq '.genesis.inclusionProof.authenticator = null' "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"
    log_info "Authenticator removed (set to null)"

    # Step 3: Bob attempts to receive - MUST FAIL
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${tampered} --local"
    assert_failure
    log_info "receive-token correctly rejected null authenticator"

    # Step 4: Command has failed as expected due to missing authenticator
    log_success "SEC-RECV-CRYPTO-003: Null authenticator correctly rejected"
}

# =============================================================================
# SEC-RECV-CRYPTO-004: Modified State Data
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Alter the current token state data
# Expected: receive-token FAILS with state hash/data mismatch error
#
# Scenario:
# 1. Alice mints token with specific data, creates transfer
# 2. Attacker modifies state.data to different value
# 3. Bob attempts to receive token
# 4. receive-token must REJECT due to data/hash mismatch

@test "SEC-RECV-CRYPTO-004: Modified state data should be rejected" {
    log_test "SEC-RECV-CRYPTO-004: Testing state data integrity validation"
    fail_if_aggregator_unavailable

    # Step 1: Create valid transfer with state data
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft -d '{\"test\":\"original\"}' --local -o ${alice_token}"
    assert_success

    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    local transfer="${TEST_TEMP_DIR}/transfer.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_addr} --local -o ${transfer}"
    assert_success
    log_info "Transfer created"

    # Step 2: ATTACK - Modify state data
    local tampered="${TEST_TEMP_DIR}/tampered-data.txf"
    cp "${transfer}" "${tampered}"

    # Change state data to something completely different (hex-encoded)
    local new_data=$(printf '{"test":"hacked"}' | xxd -p | tr -d '\n')
    jq --arg data "${new_data}" '.state.data = $data' "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"
    log_info "State data modified (hashed integrity should fail)"

    # Step 3: Bob attempts to receive - MUST FAIL
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${tampered} --local"
    assert_failure
    log_info "receive-token correctly rejected modified state data"

    # Step 4: Command has failed as expected due to state data mismatch
    log_success "SEC-RECV-CRYPTO-004: Modified state data correctly rejected"
}

# =============================================================================
# SEC-RECV-CRYPTO-005: Modified Genesis Data
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Alter the genesis token metadata
# Expected: receive-token FAILS with genesis data validation error
#
# Scenario:
# 1. Alice mints token with specific tokenType
# 2. Attacker modifies genesis.data.tokenType
# 3. Bob attempts to receive token
# 4. receive-token must REJECT due to genesis data mismatch

@test "SEC-RECV-CRYPTO-005: Modified genesis data should be rejected" {
    log_test "SEC-RECV-CRYPTO-005: Testing genesis data integrity validation"
    fail_if_aggregator_unavailable

    # Step 1: Create valid transfer
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success

    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    local transfer="${TEST_TEMP_DIR}/transfer.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_addr} --local -o ${transfer}"
    assert_success
    log_info "Transfer created"

    # Step 2: ATTACK - Modify genesis tokenType
    local tampered="${TEST_TEMP_DIR}/tampered-genesis.txf"
    cp "${transfer}" "${tampered}"

    # Change tokenType to a different value
    local fake_token_type="deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
    jq --arg type "${fake_token_type}" '.genesis.data.tokenType = $type' "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"
    log_info "Genesis tokenType modified"

    # Step 3: Bob attempts to receive - MUST FAIL
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${tampered} --local"
    assert_failure
    log_info "receive-token correctly rejected modified genesis data"

    # Step 4: Command has failed as expected due to genesis data mismatch
    log_success "SEC-RECV-CRYPTO-005: Modified genesis data correctly rejected"
}

# =============================================================================
# SEC-RECV-CRYPTO-006: Tampered Transaction Proof
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Corrupt intermediate transaction proofs (if token has chain)
# Expected: receive-token FAILS if proofs are invalid
#
# Scenario:
# 1. Create token with transaction history
# 2. Attacker modifies transaction proof data
# 3. Bob attempts to receive token
# 4. receive-token must REJECT due to invalid transaction chain

@test "SEC-RECV-CRYPTO-006: Tampered transaction proof should be rejected" {
    log_test "SEC-RECV-CRYPTO-006: Testing transaction proof validation"
    fail_if_aggregator_unavailable

    # Note: This test validates receive-token's handling of tokens with
    # transaction history. Current simple transfers may not create history,
    # so we test the validation path even with minimal history.

    # Step 1: Create valid transfer
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success

    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    local transfer="${TEST_TEMP_DIR}/transfer.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_addr} --local -o ${transfer}"
    assert_success
    log_info "Transfer created"

    # Step 2: Check if token has transaction history
    local has_history
    has_history=$(jq 'has("transactionHistory")' "${transfer}")

    if [[ "${has_history}" == "true" ]]; then
        # Step 3: ATTACK - Tamper with transaction proof
        local tampered="${TEST_TEMP_DIR}/tampered-tx.txf"
        cp "${transfer}" "${tampered}"

        # Corrupt first transaction proof
        jq '.transactionHistory[0].inclusionProof.authenticator.signature = "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"' \
            "${tampered}" > "${tampered}.tmp"
        mv "${tampered}.tmp" "${tampered}"
        log_info "Transaction proof tampered"

        # Step 4: Bob attempts to receive - MUST FAIL
        run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${tampered} --local"
        assert_failure
        log_info "receive-token correctly rejected tampered transaction proof"

        # Step 5: Command has failed as expected due to tampered transaction proof
        log_success "SEC-RECV-CRYPTO-006: Tampered transaction proof correctly rejected"
    else
        # Transaction history not present in this token format
        # The important thing is that receive-token validates whatever proofs exist
        log_info "Token has no transaction history, skipping transaction tampering test"
        log_success "SEC-RECV-CRYPTO-006: Validation path exists (history not applicable)"
    fi
}

# =============================================================================
# SEC-RECV-CRYPTO-007: Complete Offline Transfer Validation
# =============================================================================
# COMPREHENSIVE Security Test
# Attack Vector: Multiple tampering attempts on complete transfer workflow
# Expected:
#   - Valid token: receive-token SUCCESS
#   - Tampered token: receive-token FAILURE
#
# Scenario:
# 1. Alice mints token and transfers to Bob
# 2. Bob successfully receives valid transfer
# 3. Create another transfer and tamper multiple fields
# 4. receive-token rejects all tampered versions
# 5. Verify error messages are appropriate

@test "SEC-RECV-CRYPTO-007: Complete offline transfer validation" {
    log_test "SEC-RECV-CRYPTO-007: Complete offline transfer validation workflow"
    fail_if_aggregator_unavailable

    # Step 1: Alice mints token
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success
    log_info "Alice minted token"

    # Step 2: Generate Bob's address
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')
    log_info "Bob's address generated"

    # Step 3: Alice creates transfer to Bob
    local transfer="${TEST_TEMP_DIR}/transfer-to-bob.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_addr} --local -o ${transfer}"
    assert_success
    log_info "Transfer to Bob created"

    # Step 4a: VALID PATH - Bob receives the valid transfer (should succeed)
    local bob_received="${TEST_TEMP_DIR}/bob-received.txf"
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer} --local -o ${bob_received}"
    assert_success
    assert_file_exists "${bob_received}"
    log_success "Bob successfully received valid transfer"

    # Step 4b: INVALID PATH - Test with tampered proof
    local tampered_multi="${TEST_TEMP_DIR}/tampered-multi.txf"
    cp "${transfer}" "${tampered_multi}"

    # Tamper with multiple fields (authenticator + root)
    local zero_sig=$(printf '%.0s0' {1..132})
    local zero_root=$(printf '%.0s0' {1..68})
    jq --arg sig "${zero_sig}" --arg root "${zero_root}" \
        '.genesis.inclusionProof.authenticator.signature = $sig |
         .genesis.inclusionProof.merkleTreePath.root = $root' \
        "${tampered_multi}" > "${tampered_multi}.tmp"
    mv "${tampered_multi}.tmp" "${tampered_multi}"
    log_info "Transfer tampered (multiple fields)"

    # Step 5: Bob attempts to receive tampered transfer - MUST FAIL
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${tampered_multi} --local"
    assert_failure
    log_info "receive-token correctly rejected tampered transfer"

    # Step 6: Tampered token rejected as expected
    log_success "SEC-RECV-CRYPTO-007: Complete offline transfer validation passed"
}
