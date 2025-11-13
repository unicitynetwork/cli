#!/usr/bin/env bats
# Security Test Suite: RecipientDataHash Tampering Detection
# Test Scenarios: HASH-001 to HASH-006
#
# Purpose: Explicitly test recipientDataHash (state.data commitment)
# tampering detection and validation.
#
# The recipientDataHash is a critical field that commits to state.data
# via SHA-256 hash. Tampering must be detected by hash mismatch.

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common
    check_aggregator

    export ALICE_SECRET=$(generate_test_secret "alice-hash")
    export BOB_SECRET=$(generate_test_secret "bob-hash")
}

teardown() {
    teardown_common
}

# =============================================================================
# HASH-001: Verify RecipientDataHash Matches State Data
# =============================================================================
@test "HASH-001: RecipientDataHash correctly computes state.data hash" {
    log_test "HASH-001: Verifying recipientDataHash computation correctness"
    fail_if_aggregator_unavailable

    local test_data='{"metadata":"test"}'
    local token="${TEST_TEMP_DIR}/hash-verify.txf"

    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft -d '${test_data}' -o ${token}"
    assert_success
    assert_file_exists "${token}"
    log_info "Token created with test data"

    # Extract state.data and recipientDataHash
    local state_data=$(jq -r '.state.data' "${token}")
    local recipient_hash=$(jq -r '.genesis.data.recipientDataHash' "${token}")

    assert_set state_data "state.data must be present"
    assert_set recipient_hash "recipientDataHash must be present"

    log_info "state.data: ${state_data:0:32}..."
    log_info "recipientDataHash: ${recipient_hash:0:32}... (length: ${#recipient_hash})"

    # Verify hash is non-null and hex-encoded
    [[ "${recipient_hash}" =~ ^[0-9a-f]+$ ]] || assert_failure "recipientDataHash should be hex-encoded"
    [[ ${#recipient_hash} -gt 20 ]] || assert_failure "recipientDataHash should be a substantial hash value"

    # Verify token is valid
    run_cli "verify-token -f ${token}"
    assert_success
    log_info "Token verification passed"

    log_success "HASH-001: RecipientDataHash format and computation verified"
}

# =============================================================================
# HASH-002: Mismatched recipientDataHash - Hash Doesn't Match Data
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Change hash to not match state.data
# Expected: Verification fails with hash mismatch error
@test "HASH-002: Mismatched recipientDataHash (hash != data) should be rejected" {
    log_test "HASH-002: Testing hash/data mismatch detection"
    fail_if_aggregator_unavailable

    local token="${TEST_TEMP_DIR}/hash-mismatch.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft -d '{\"data\":\"value\"}' -o ${token}"
    assert_success
    log_info "Token created"

    # Verify original is valid
    run_cli "verify-token -f ${token}"
    assert_success
    log_info "Original token verification passed"

    # ATTACK: Set recipientDataHash to wrong value (doesn't match state.data)
    local tampered="${TEST_TEMP_DIR}/hash-mismatch-tampered.txf"
    cp "${token}" "${tampered}"

    # Create a wrong hash (not all zeros, not the correct one)
    local wrong_hash="1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    jq --arg hash "${wrong_hash}" \
        '.genesis.data.recipientDataHash = $hash' \
        "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"

    log_info "Hash changed to wrong value: ${wrong_hash:0:16}..."

    # Try to verify tampered token - MUST FAIL
    run_cli "verify-token -f ${tampered}"
    assert_failure
    assert_output_contains "hash" || assert_output_contains "mismatch" || assert_output_contains "invalid"
    log_info "verify-token correctly rejected mismatched hash"

    # Try to send tampered token - MUST FAIL
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${tampered} -r ${bob_addr}"
    assert_failure
    log_info "send-token correctly rejected token with mismatched hash"

    log_success "HASH-002: Hash/data mismatch correctly detected and rejected"
}

# =============================================================================
# HASH-003: All-Zeros recipientDataHash (Invalid Hash)
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Set hash to all zeros (obviously fake)
# Expected: Verification fails
@test "HASH-003: All-zeros recipientDataHash should be rejected" {
    log_test "HASH-003: Testing all-zeros hash tampering"
    fail_if_aggregator_unavailable

    local token="${TEST_TEMP_DIR}/hash-zeros.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft -d '{\"data\":\"value\"}' -o ${token}"
    assert_success
    log_info "Token created"

    # Verify original is valid
    run_cli "verify-token -f ${token}"
    assert_success
    log_info "Original token verification passed"

    # ATTACK: Set hash to all zeros
    local tampered="${TEST_TEMP_DIR}/hash-zeros-tampered.txf"
    cp "${token}" "${tampered}"

    local zero_hash="0000000000000000000000000000000000000000000000000000000000000000"
    jq --arg hash "${zero_hash}" \
        '.genesis.data.recipientDataHash = $hash' \
        "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"

    log_info "RecipientDataHash set to all zeros"

    # Verify must fail
    run_cli "verify-token -f ${tampered}"
    assert_failure
    assert_output_contains "hash" || assert_output_contains "mismatch" || assert_output_contains "invalid"

    log_success "HASH-003: All-zeros hash tampering correctly detected"
}

# =============================================================================
# HASH-004: Missing recipientDataHash When Data Present
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Remove recipientDataHash from token
# Expected: Verification fails due to missing commitment
@test "HASH-004: Missing recipientDataHash when data present should be rejected" {
    log_test "HASH-004: Testing missing hash with present data"
    fail_if_aggregator_unavailable

    local token="${TEST_TEMP_DIR}/hash-missing.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft -d '{\"data\":\"value\"}' -o ${token}"
    assert_success
    log_info "Token created"

    # Verify original is valid
    run_cli "verify-token -f ${token}"
    assert_success
    log_info "Original token verification passed"

    # ATTACK: Remove recipientDataHash while data is still present
    local tampered="${TEST_TEMP_DIR}/hash-missing-tampered.txf"
    cp "${token}" "${tampered}"

    jq '.genesis.data.recipientDataHash = null' \
        "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"

    log_info "RecipientDataHash removed"

    # Verify must fail
    run_cli "verify-token -f ${tampered}"
    assert_failure
    assert_output_contains "null" || assert_output_contains "missing" || assert_output_contains "hash" || assert_output_contains "invalid"

    log_success "HASH-004: Missing hash correctly detected and rejected"
}

# =============================================================================
# HASH-005: RecipientDataHash Present But Data is Null
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Remove state.data but keep hash (should fail)
# Expected: Verification fails due to inconsistency
@test "HASH-005: Hash present but state data null should be rejected" {
    log_test "HASH-005: Testing state data removed but hash present"
    fail_if_aggregator_unavailable

    local token="${TEST_TEMP_DIR}/hash-data-null.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft -d '{\"data\":\"value\"}' -o ${token}"
    assert_success
    log_info "Token created with state data"

    # Verify original is valid
    run_cli "verify-token -f ${token}"
    assert_success
    log_info "Original token verification passed"

    # ATTACK: Remove state.data but keep hash
    local tampered="${TEST_TEMP_DIR}/hash-data-null-tampered.txf"
    cp "${token}" "${tampered}"

    jq '.state.data = null' \
        "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"

    log_info "State.data set to null"

    # Verify must fail (hash cannot commit to null data)
    run_cli "verify-token -f ${tampered}"
    assert_failure
    assert_output_contains "hash" || assert_output_contains "mismatch" || assert_output_contains "invalid" || assert_output_contains "state"

    log_success "HASH-005: Null state data with hash correctly detected"
}

# =============================================================================
# HASH-006: RecipientDataHash Tampering in Transferred Token
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Tamper hash after token has been transferred
# Expected: receive-token rejects token due to hash mismatch
@test "HASH-006: RecipientDataHash tampering in transfer should be detected" {
    log_test "HASH-006: Testing hash tampering in offline transfer"
    fail_if_aggregator_unavailable

    # Step 1: Alice mints token with data
    local alice_token="${TEST_TEMP_DIR}/hash-transfer-original.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft -d '{\"sensitive\":\"data\"}' -o ${alice_token}"
    assert_success
    log_info "Alice created token with sensitive data"

    # Step 2: Alice generates Bob's address
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')
    log_info "Bob's address: ${bob_addr}"

    # Step 3: Alice creates transfer to Bob
    local transfer="${TEST_TEMP_DIR}/hash-transfer-pkg.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_addr} -o ${transfer}"
    assert_success
    log_info "Transfer package created"

    # Verify transfer is valid before tampering
    run_cli "verify-token -f ${transfer}"
    assert_success
    log_info "Transfer package verified"

    # ATTACK: Tamper with recipientDataHash in transfer
    local tampered_transfer="${TEST_TEMP_DIR}/hash-transfer-tampered.txf"
    cp "${transfer}" "${tampered_transfer}"

    local wrong_hash="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
    jq --arg hash "${wrong_hash}" \
        '.genesis.data.recipientDataHash = $hash' \
        "${tampered_transfer}" > "${tampered_transfer}.tmp"
    mv "${tampered_transfer}.tmp" "${tampered_transfer}"

    log_info "RecipientDataHash tampered in transfer package"

    # Step 4: Bob tries to receive tampered transfer - MUST FAIL
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${tampered_transfer}"
    assert_failure
    assert_output_contains "hash" || assert_output_contains "mismatch" || assert_output_contains "invalid"
    log_info "receive-token correctly rejected tampered hash"

    # Step 5: Verify original transfer still works
    local bob_token="${TEST_TEMP_DIR}/hash-transfer-bob.txf"
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer} -o ${bob_token}"
    assert_success
    log_info "Original transfer accepted and received"

    # Step 6: Verify received token is valid
    run_cli "verify-token -f ${bob_token}"
    assert_success
    log_info "Received token verified"

    log_success "HASH-006: Hash tampering in transfer correctly detected"
}
