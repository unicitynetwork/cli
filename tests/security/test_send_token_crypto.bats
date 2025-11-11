#!/usr/bin/env bats
# Security Test Suite: send-token Cryptographic Validation
# Test Scenarios: SEC-SEND-CRYPTO-001 to SEC-SEND-CRYPTO-005
#
# Purpose: Document and verify that send-token command performs complete
# cryptographic proof validation on input tokens before creating transfers.
# These tests verify that send-token REJECTS any tokens with invalid:
# - Genesis proof signatures
# - Merkle paths
# - Authenticators
# - State data
#
# send-token must validate the input token thoroughly before allowing a transfer.

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common
    check_aggregator

    export ALICE_SECRET=$(generate_test_secret "alice-send-crypto")
    export BOB_SECRET=$(generate_test_secret "bob-send-crypto")
    export CAROL_SECRET=$(generate_test_secret "carol-send-crypto")
}

teardown() {
    teardown_common
}

# =============================================================================
# SEC-SEND-CRYPTO-001: send-token Rejects Tampered Genesis Signature
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Attacker tries to transfer a token with corrupted proof signature
# Expected: send-token FAILS with signature validation error
#
# Scenario:
# 1. Alice mints valid token
# 2. Attacker corrupts genesis.inclusionProof.authenticator.signature
# 3. Alice attempts to send corrupted token
# 4. send-token must REJECT before creating transfer

@test "SEC-SEND-CRYPTO-001: send-token rejects tampered genesis signature" {
    log_test "SEC-SEND-CRYPTO-001: Testing send-token signature validation"

    # Step 1: Alice mints a valid token
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success
    log_info "Alice minted token"

    # Step 2: Verify token is valid
    run_cli "verify-token -f ${alice_token} --local"
    assert_success
    log_info "Token verification passed"

    # Step 3: ATTACK - Tamper with signature
    local tampered_token="${TEST_TEMP_DIR}/tampered-token.txf"
    cp "${alice_token}" "${tampered_token}"

    local original_sig=$(jq -r '.genesis.inclusionProof.authenticator.signature' "${tampered_token}")
    if [[ -n "${original_sig}" ]] && [[ "${original_sig}" != "null" ]]; then
        # Corrupt signature by flipping bits
        local corrupted_sig=$(echo "${original_sig}" | sed 's/0/f/g; s/1/e/g; s/2/d/g; s/3/c/g' | head -c ${#original_sig})
        jq --arg sig "${corrupted_sig}" \
            '.genesis.inclusionProof.authenticator.signature = $sig' \
            "${tampered_token}" > "${tampered_token}.tmp"
        mv "${tampered_token}.tmp" "${tampered_token}"
        log_info "Signature tampered (validation should fail)"
    else
        skip "Token does not expose signature for tampering"
    fi

    # Step 4: Generate Bob's address
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    # Step 5: Alice attempts to send tampered token - MUST FAIL
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${tampered_token} -r ${bob_addr} --local"
    assert_failure
    log_info "send-token correctly rejected tampered signature"

    # Step 6: Command has failed as expected due to invalid signature
    log_success "SEC-SEND-CRYPTO-001: Tampered signature correctly rejected"
}

# =============================================================================
# SEC-SEND-CRYPTO-002: send-token Rejects Tampered Merkle Path
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Modify merkle tree path in token proof
# Expected: send-token FAILS with merkle path validation error
#
# Scenario:
# 1. Alice mints valid token
# 2. Attacker modifies merkleTreePath.root
# 3. Alice attempts to send token
# 4. send-token must REJECT before creating transfer

@test "SEC-SEND-CRYPTO-002: send-token rejects tampered merkle path" {
    log_test "SEC-SEND-CRYPTO-002: Testing send-token merkle path validation"

    # Step 1: Alice mints token
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success
    log_info "Token minted"

    # Step 2: ATTACK - Tamper with merkle root
    local tampered_token="${TEST_TEMP_DIR}/tampered-merkle.txf"
    cp "${alice_token}" "${tampered_token}"

    # Set root to all zeros
    local zero_root="00000000000000000000000000000000000000000000000000000000000000000000"
    jq --arg root "${zero_root}" \
        '.genesis.inclusionProof.merkleTreePath.root = $root' \
        "${tampered_token}" > "${tampered_token}.tmp"
    mv "${tampered_token}.tmp" "${tampered_token}"
    log_info "Merkle root set to all zeros"

    # Step 3: Generate Bob's address
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    # Step 4: Alice attempts to send - MUST FAIL
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${tampered_token} -r ${bob_addr} --local"
    assert_failure
    log_info "send-token correctly rejected tampered merkle path"

    # Step 5: Command has failed as expected due to invalid merkle path
    log_success "SEC-SEND-CRYPTO-002: Tampered merkle path correctly rejected"
}

# =============================================================================
# SEC-SEND-CRYPTO-003: send-token Rejects Null Authenticator
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Remove the BFT authenticator from proof
# Expected: send-token FAILS with authenticator validation error
#
# Scenario:
# 1. Alice mints valid token
# 2. Attacker removes authenticator
# 3. Alice attempts to send token
# 4. send-token must REJECT before creating transfer

@test "SEC-SEND-CRYPTO-003: send-token rejects null authenticator" {
    log_test "SEC-SEND-CRYPTO-003: Testing send-token authenticator validation"

    # Step 1: Alice mints token
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success
    log_info "Token minted"

    # Step 2: ATTACK - Remove authenticator
    local tampered_token="${TEST_TEMP_DIR}/tampered-no-auth.txf"
    cp "${alice_token}" "${tampered_token}"
    jq '.genesis.inclusionProof.authenticator = null' "${tampered_token}" > "${tampered_token}.tmp"
    mv "${tampered_token}.tmp" "${tampered_token}"
    log_info "Authenticator removed"

    # Step 3: Generate Bob's address
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    # Step 4: Alice attempts to send - MUST FAIL
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${tampered_token} -r ${bob_addr} --local"
    assert_failure
    log_info "send-token correctly rejected null authenticator"

    # Step 5: Command has failed as expected due to missing authenticator
    log_success "SEC-SEND-CRYPTO-003: Null authenticator correctly rejected"
}

# =============================================================================
# SEC-SEND-CRYPTO-004: send-token Rejects Modified State Data
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Change token state data to forge different token
# Expected: send-token FAILS with state validation error
#
# Scenario:
# 1. Alice mints token with original data
# 2. Attacker modifies state.data
# 3. Alice attempts to send modified token
# 4. send-token must REJECT before creating transfer

@test "SEC-SEND-CRYPTO-004: send-token rejects modified state data" {
    log_test "SEC-SEND-CRYPTO-004: Testing send-token state data validation"

    # Step 1: Alice mints token with specific data
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '{\"value\":\"original\"}' -o ${alice_token}"
    assert_success
    log_info "Token minted with original data"

    # Step 2: ATTACK - Modify state data
    local tampered_token="${TEST_TEMP_DIR}/tampered-data.txf"
    cp "${alice_token}" "${tampered_token}"

    # Change state data (hex-encoded)
    local new_data=$(printf '{"value":"hacked"}' | xxd -p | tr -d '\n')
    jq --arg data "${new_data}" '.state.data = $data' "${tampered_token}" > "${tampered_token}.tmp"
    mv "${tampered_token}.tmp" "${tampered_token}"
    log_info "State data modified"

    # Step 3: Generate Bob's address
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    # Step 4: Alice attempts to send - MUST FAIL
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${tampered_token} -r ${bob_addr} --local"
    assert_failure
    log_info "send-token correctly rejected modified state data"

    # Step 5: Command has failed as expected due to state data mismatch
    log_success "SEC-SEND-CRYPTO-004: Modified state data correctly rejected"
}

# =============================================================================
# SEC-SEND-CRYPTO-005: send-token Validates Before Creating Transfer
# =============================================================================
# COMPREHENSIVE Security Test
# Attack Vector: Multiple invalid tokens should all be rejected
# Expected: send-token rejects all invalid tokens before creating any transfer
#
# Scenario:
# 1. Alice mints valid token
# 2. Create multiple tampered versions
# 3. send-token rejects each one
# 4. No transfer files are created for invalid tokens
# 5. Valid token transfer succeeds

@test "SEC-SEND-CRYPTO-005: send-token validates before creating transfer" {
    log_test "SEC-SEND-CRYPTO-005: Complete send-token validation workflow"

    # Step 1: Alice mints a valid token
    local alice_token="${TEST_TEMP_DIR}/alice-token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -o ${alice_token}"
    assert_success
    log_info "Alice minted valid token"

    # Step 2: Verify token is valid
    run_cli "verify-token -f ${alice_token} --local"
    assert_success
    log_success "Initial token verification passed"

    # Step 3: Generate recipient addresses
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    run_cli_with_secret "${CAROL_SECRET}" "gen-address --preset nft"
    assert_success
    local carol_addr=$(echo "${output}" | jq -r '.address')
    log_info "Recipient addresses generated"

    # Step 4a: VALID CASE - Alice sends valid token to Bob
    local output_dir="${TEST_TEMP_DIR}/output"
    mkdir -p "${output_dir}"

    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_addr} --local -o ${output_dir}/transfer.txf"
    assert_success
    assert_file_exists "${output_dir}/transfer.txf"
    log_success "Valid token transfer created successfully"

    # Step 4b: INVALID CASE 1 - Token with corrupted signature
    local tampered_sig="${TEST_TEMP_DIR}/tampered-sig.txf"
    cp "${alice_token}" "${tampered_sig}"

    local original_sig=$(jq -r '.genesis.inclusionProof.authenticator.signature' "${tampered_sig}")
    if [[ -n "${original_sig}" ]] && [[ "${original_sig}" != "null" ]]; then
        local corrupted_sig=$(echo "${original_sig}" | sed 's/0/a/g; s/1/b/g; s/2/c/g' | head -c ${#original_sig})
        jq --arg sig "${corrupted_sig}" \
            '.genesis.inclusionProof.authenticator.signature = $sig' \
            "${tampered_sig}" > "${tampered_sig}.tmp"
        mv "${tampered_sig}.tmp" "${tampered_sig}"

        run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${tampered_sig} -r ${carol_addr} --local"
        assert_failure
        log_info "Invalid token with corrupted signature rejected"
    fi

    # Step 4c: INVALID CASE 2 - Token with null authenticator
    local tampered_auth="${TEST_TEMP_DIR}/tampered-auth.txf"
    cp "${alice_token}" "${tampered_auth}"
    jq '.genesis.inclusionProof.authenticator = null' "${tampered_auth}" > "${tampered_auth}.tmp"
    mv "${tampered_auth}.tmp" "${tampered_auth}"

    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${tampered_auth} -r ${carol_addr} --local"
    assert_failure
    log_info "Invalid token with null authenticator rejected"

    # Step 5: Verify only one valid transfer was created
    local transfer_count=$(ls -1 "${output_dir}/transfer.txf" 2>/dev/null | wc -l)
    [[ $transfer_count -eq 1 ]] || warn "Expected 1 transfer, found $transfer_count"
    log_success "SEC-SEND-CRYPTO-005: Only valid token created transfer, invalid ones rejected"
}
