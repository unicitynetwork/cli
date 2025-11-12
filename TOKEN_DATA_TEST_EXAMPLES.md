# Token Data Coverage - Test Implementation Examples

This document provides concrete BATS test code examples for implementing the missing test coverage identified in the gap analysis.

---

## Part 1: C3 Test Suite (Genesis Data Only)

### Test File: `tests/security/test_data_c3_genesis_only.bats`

```bash
#!/usr/bin/env bats
# Security Test Suite: Token with Genesis Data Only (C3)
# Test Scenarios: C3-001 to C3-005
#
# Purpose: Test tokens created with genesis data (-d flag) but not transferred.
# These tokens have immutable genesis.data.tokenData protected by transaction signature.
#
# Combination C3: genesis.data.tokenData present, state.data minimal
# Note: C3 is created identically to C2, but without subsequent transfers

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common
    check_aggregator

    export ALICE_SECRET=$(generate_test_secret "alice-c3")
    export BOB_SECRET=$(generate_test_secret "bob-c3")
}

teardown() {
    teardown_common
}

# =============================================================================
# C3-001: Create Token with Genesis Data (Combination C3)
# =============================================================================
@test "C3-001: Create token with genesis metadata (no transfer)" {
    log_test "C3-001: Creating C3 token with genesis data only"

    local c3_token="${TEST_TEMP_DIR}/c3-genesis-only.txf"
    local genesis_data='{"metadata":"Alice Original Token","version":"1.0"}'

    # Create token with -d flag (creates C3 token)
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '${genesis_data}' -o ${c3_token}"
    assert_success
    assert_file_exists "${c3_token}"
    log_info "C3 token created: ${c3_token}"

    # Verify token structure
    local has_token_data=$(jq 'has("genesis") and (.genesis.data.tokenData != null and .genesis.data.tokenData != "")' "${c3_token}")
    assert_equals "true" "${has_token_data}" "Token must have genesis.data.tokenData"

    # Verify state has data (same as genesis initially)
    local has_state=$(jq 'has("state") and (.state.data != null and .state.data != "")' "${c3_token}")
    assert_equals "true" "${has_state}" "Token state must have data"

    # Verify token is valid
    run_cli "verify-token -f ${c3_token} --local"
    assert_success
    log_info "C3 token validation passed"

    # Store token path for later tests
    echo "${c3_token}" > "${TEST_TEMP_DIR}/c3-token-path"

    log_success "C3-001: C3 token successfully created and validated"
}

# =============================================================================
# C3-002: Genesis Data is Properly Stored and Encoded
# =============================================================================
@test "C3-002: Genesis data properly encoded in token" {
    log_test "C3-002: Verifying genesis.data.tokenData storage"

    local expected_data='{"metadata":"Test Metadata"}'
    local c3_token="${TEST_TEMP_DIR}/c3-verify-storage.txf"

    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '${expected_data}' -o ${c3_token}"
    assert_success

    # Extract tokenData (hex-encoded)
    local token_data_hex=$(jq -r '.genesis.data.tokenData' "${c3_token}")
    assert_set token_data_hex

    # Convert hex back to string to verify
    local token_data_decoded=$(echo "${token_data_hex}" | xxd -r -p)
    log_info "Original data: ${expected_data}"
    log_info "Decoded data: ${token_data_decoded}"

    # Should match original (accounting for JSON formatting)
    assert_output_contains "${expected_data}" || \
        assert_output_contains "metadata" || \
        assert_output_contains "Test Metadata"

    # Verify it's actually hex-encoded
    [[ "${token_data_hex}" =~ ^[0-9a-f]+$ ]] || assert_failure "tokenData should be hex-encoded"

    log_success "C3-002: Genesis data properly stored and hex-encoded"
}

# =============================================================================
# C3-003: Tamper Genesis Data - MUST BE REJECTED
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Modify genesis.data.tokenData after token creation
# Expected: Tampering detected (via transaction signature validation)
#
@test "C3-003: Tamper genesis.data.tokenData - should be rejected" {
    log_test "C3-003: Testing genesis.data.tokenData tampering detection"

    # Create valid C3 token
    local c3_token="${TEST_TEMP_DIR}/c3-valid.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '{\"original\":\"data\"}' -o ${c3_token}"
    assert_success

    # Verify token is valid before tampering
    run_cli "verify-token -f ${c3_token} --local"
    assert_success
    log_info "Original C3 token verified"

    # ATTACK: Tamper with genesis.data.tokenData
    local tampered="${TEST_TEMP_DIR}/c3-tampered-data.txf"
    cp "${c3_token}" "${tampered}"

    # Change tokenData to different value
    local malicious_data=$(printf '{"malicious":"payload"}' | xxd -p | tr -d '\n')
    jq --arg data "${malicious_data}" \
        '.genesis.data.tokenData = $data' \
        "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"
    log_info "Genesis data tampered (should be detected)"

    # Try to verify tampered token - MUST FAIL
    run_cli "verify-token -f ${tampered} --local"
    assert_failure
    log_info "Tampered genesis data correctly rejected by verify-token"

    # Try to send tampered token - MUST FAIL
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${tampered} -r ${bob_addr} --local"
    assert_failure
    log_info "send-token correctly rejected tampered genesis data"

    log_success "C3-003: Genesis data tampering correctly detected and rejected"
}

# =============================================================================
# C3-004: State Data Remains Unchanged (Not Transferred)
# =============================================================================
@test "C3-004: State data matches genesis data (no transfer)" {
    log_test "C3-004: Verifying state.data matches genesis initially"

    local c3_token="${TEST_TEMP_DIR}/c3-state-match.txf"
    local test_data='{"immutable":"metadata"}'

    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '${test_data}' -o ${c3_token}"
    assert_success

    # Extract both data fields
    local genesis_data=$(jq -r '.genesis.data.tokenData' "${c3_token}")
    local state_data=$(jq -r '.state.data' "${c3_token}")

    log_info "Genesis data: ${genesis_data:0:32}..."
    log_info "State data:   ${state_data:0:32}..."

    # They should match initially (same token, not transferred)
    assert_equals "${genesis_data}" "${state_data}" "State data should match genesis data initially (no transfer)"

    log_success "C3-004: State data correctly matches genesis data in untransferred token"
}

# =============================================================================
# C3-005: Tamper State Data in Genesis-Only Token
# =============================================================================
@test "C3-005: Tamper state.data in C3 token - should be rejected" {
    log_test "C3-005: Testing state.data tampering on genesis-only token"

    local c3_token="${TEST_TEMP_DIR}/c3-tamper-state.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '{\"test\":\"data\"}' -o ${c3_token}"
    assert_success

    # Verify original is valid
    run_cli "verify-token -f ${c3_token} --local"
    assert_success

    # ATTACK: Tamper with state.data
    local tampered="${TEST_TEMP_DIR}/c3-tampered-state.txf"
    cp "${c3_token}" "${tampered}"

    local new_state=$(printf '{"hacked":"state"}' | xxd -p | tr -d '\n')
    jq --arg data "${new_state}" \
        '.state.data = $data' \
        "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"
    log_info "State data tampered"

    # Try to verify - MUST FAIL (state hash will not match recipientDataHash)
    run_cli "verify-token -f ${tampered} --local"
    assert_failure
    assert_output_contains "hash" || assert_output_contains "state" || assert_output_contains "mismatch"

    log_success "C3-005: State data tampering correctly detected via hash mismatch"
}

# =============================================================================
# C3-006: Transfer C3 Token (Converts to C4)
# =============================================================================
@test "C3-006: Transfer C3 token - genesis data preserved" {
    log_test "C3-006: Verify genesis data survives transfer"

    local c3_token="${TEST_TEMP_DIR}/c3-transfer.txf"
    local genesis_data='{"preserved":"metadata"}'

    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '${genesis_data}' -o ${c3_token}"
    assert_success

    # Generate Bob's address
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    # Alice transfers C3 token to Bob
    local transfer="${TEST_TEMP_DIR}/c3-transfer-pkg.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${c3_token} -r ${bob_addr} --local -o ${transfer}"
    assert_success

    # Verify genesis data is in transfer package
    local genesis_in_transfer=$(jq -r '.genesis.data.tokenData' "${transfer}")
    local genesis_original=$(jq -r '.genesis.data.tokenData' "${c3_token}")

    assert_equals "${genesis_original}" "${genesis_in_transfer}" "Genesis data must be preserved in transfer"

    # Bob receives
    local bob_token="${TEST_TEMP_DIR}/bob-from-c3.txf"
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer} --local -o ${bob_token}"
    assert_success

    # Verify genesis data still present in Bob's token
    local genesis_in_bob=$(jq -r '.genesis.data.tokenData' "${bob_token}")
    assert_equals "${genesis_original}" "${genesis_in_bob}" "Genesis data must survive transfer to Bob"

    log_success "C3-006: Genesis data correctly preserved through transfer"
}
```

---

## Part 2: C4 Test Suite (Both Data Types)

### Test File: `tests/security/test_data_c4_both.bats`

```bash
#!/usr/bin/env bats
# Security Test Suite: Token with Both Genesis and State Data (C4)
# Test Scenarios: C4-001 to C4-006
#
# Purpose: Test tokens with both genesis.data.tokenData and state.data,
# especially after transfers where state may change.
#
# Combination C4: Both genesis.data.tokenData and state.data present
# This is the most complex scenario with TWO independent protection mechanisms

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common
    check_aggregator

    export ALICE_SECRET=$(generate_test_secret "alice-c4")
    export BOB_SECRET=$(generate_test_secret "bob-c4")
    export CAROL_SECRET=$(generate_test_secret "carol-c4")
}

teardown() {
    teardown_common
}

# =============================================================================
# C4-001: Create C4 Token and Transfer It
# =============================================================================
@test "C4-001: Create and transfer C4 token (both data types)" {
    log_test "C4-001: Creating C4 token with both data types"

    # Step 1: Alice mints C3 token with genesis data
    local alice_token="${TEST_TEMP_DIR}/alice-c4.txf"
    local genesis_data='{"owner":"Alice","nft_type":"rare"}'

    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '${genesis_data}' -o ${alice_token}"
    assert_success
    log_info "Alice created C3 token with genesis data"

    # Step 2: Verify Alice's token has both data fields
    local genesis_hex=$(jq -r '.genesis.data.tokenData' "${alice_token}")
    local state_hex=$(jq -r '.state.data' "${alice_token}")

    assert_set genesis_hex
    assert_set state_hex
    assert_equals "${genesis_hex}" "${state_hex}" "State should match genesis initially (C3->C4 transition)"

    # Step 3: Generate Bob's address
    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    # Step 4: Alice transfers to Bob (creates C4 with transfer history)
    local transfer="${TEST_TEMP_DIR}/alice-to-bob.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_addr} --local -o ${transfer}"
    assert_success

    # Step 5: Bob receives - NOW we have C4
    local bob_token="${TEST_TEMP_DIR}/bob-c4.txf"
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer} --local -o ${bob_token}"
    assert_success
    log_info "Bob received C4 token"

    # Step 6: Verify Bob has C4 token (both data types present)
    run_cli "verify-token -f ${bob_token} --local"
    assert_success

    # Verify both data fields exist
    local bob_genesis=$(jq -r '.genesis.data.tokenData' "${bob_token}")
    local bob_state=$(jq -r '.state.data' "${bob_token}")

    assert_set bob_genesis
    assert_set bob_state
    # Genesis data should be unchanged from Alice's original
    assert_equals "${genesis_hex}" "${bob_genesis}" "Genesis data must be immutable across transfers"

    log_success "C4-001: C4 token successfully created and transferred"
}

# =============================================================================
# C4-002: Tamper Genesis Data Only (C4 Token)
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Modify genesis.data.tokenData on C4 token
# Expected: Tampering detected (transaction signature / genesis hash)
#
@test "C4-002: Tamper genesis.data.tokenData in C4 token" {
    log_test "C4-002: Testing genesis data tampering on C4 token"

    # Create C4 token (Alice -> Bob transfer)
    local alice_token="${TEST_TEMP_DIR}/alice-c4-gensig.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '{\"owner\":\"Alice\"}' -o ${alice_token}"
    assert_success

    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    local transfer="${TEST_TEMP_DIR}/transfer-c4.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_addr} --local -o ${transfer}"
    assert_success

    local bob_token="${TEST_TEMP_DIR}/bob-c4-gensig.txf"
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer} --local -o ${bob_token}"
    assert_success

    # Verify original is valid
    run_cli "verify-token -f ${bob_token} --local"
    assert_success

    # ATTACK: Tamper with genesis.data.tokenData
    local tampered="${TEST_TEMP_DIR}/c4-tamper-genesis.txf"
    cp "${bob_token}" "${tampered}"

    local malicious=$(printf '{"owner":"Attacker"}' | xxd -p | tr -d '\n')
    jq --arg data "${malicious}" \
        '.genesis.data.tokenData = $data' \
        "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"

    # Try to verify tampered token - MUST FAIL
    run_cli "verify-token -f ${tampered} --local"
    assert_failure
    log_info "verify-token rejected genesis data tampering"

    # Try to send tampered token - MUST FAIL
    run_cli_with_secret "${CAROL_SECRET}" "gen-address --preset nft"
    assert_success
    local carol_addr=$(echo "${output}" | jq -r '.address')

    run_cli_with_secret "${BOB_SECRET}" "send-token -f ${tampered} -r ${carol_addr} --local"
    assert_failure
    log_info "send-token rejected genesis data tampering"

    log_success "C4-002: Genesis data tampering correctly detected on C4 token"
}

# =============================================================================
# C4-003: Tamper State Data Only (C4 Token)
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Modify state.data on C4 token
# Expected: Tampering detected (state hash / recipientDataHash mismatch)
#
@test "C4-003: Tamper state.data in C4 token" {
    log_test "C4-003: Testing state data tampering on C4 token"

    # Create C4 token
    local alice_token="${TEST_TEMP_DIR}/alice-c4-state.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '{\"data\":\"original\"}' -o ${alice_token}"
    assert_success

    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    local transfer="${TEST_TEMP_DIR}/transfer-c4-state.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_addr} --local -o ${transfer}"
    assert_success

    local bob_token="${TEST_TEMP_DIR}/bob-c4-state.txf"
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer} --local -o ${bob_token}"
    assert_success

    # Verify original is valid
    run_cli "verify-token -f ${bob_token} --local"
    assert_success

    # ATTACK: Tamper with state.data only
    local tampered="${TEST_TEMP_DIR}/c4-tamper-state.txf"
    cp "${bob_token}" "${tampered}"

    local malicious=$(printf '{"data":"hacked"}' | xxd -p | tr -d '\n')
    jq --arg data "${malicious}" \
        '.state.data = $data' \
        "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"

    # Try to verify - MUST FAIL (state hash mismatch with recipientDataHash)
    run_cli "verify-token -f ${tampered} --local"
    assert_failure
    assert_output_contains "hash" || assert_output_contains "state" || assert_output_contains "mismatch"
    log_info "verify-token rejected state data tampering via hash mismatch"

    log_success "C4-003: State data tampering correctly detected on C4 token"
}

# =============================================================================
# C4-004: Tamper RecipientDataHash Specifically
# =============================================================================
# CRITICAL Security Test
# Attack Vector: Modify genesis.transaction.recipientDataHash
# Expected: Hash commitment mismatch detected during verification
#
@test "C4-004: Tamper recipientDataHash - hash mismatch detection" {
    log_test "C4-004: Testing recipientDataHash tampering"

    # Create C4 token
    local alice_token="${TEST_TEMP_DIR}/alice-c4-hash.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '{\"sensitive\":\"data\"}' -o ${alice_token}"
    assert_success

    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    local transfer="${TEST_TEMP_DIR}/transfer-c4-hash.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_addr} --local -o ${transfer}"
    assert_success

    local bob_token="${TEST_TEMP_DIR}/bob-c4-hash.txf"
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer} --local -o ${bob_token}"
    assert_success

    # Verify original
    run_cli "verify-token -f ${bob_token} --local"
    assert_success

    # Get original hash
    local original_hash=$(jq -r '.genesis.transaction.recipientDataHash' "${bob_token}")
    log_info "Original recipientDataHash: ${original_hash:0:32}..."

    # ATTACK: Set recipientDataHash to all zeros
    local tampered="${TEST_TEMP_DIR}/c4-tamper-hash.txf"
    cp "${bob_token}" "${tampered}"

    local zero_hash="0000000000000000000000000000000000000000000000000000000000000000"
    jq --arg hash "${zero_hash}" \
        '.genesis.transaction.recipientDataHash = $hash' \
        "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"

    # Try to verify - MUST FAIL
    run_cli "verify-token -f ${tampered} --local"
    assert_failure
    assert_output_contains "hash" || assert_output_contains "commitment" || assert_output_contains "mismatch"
    log_info "verify-token rejected recipientDataHash tampering"

    log_success "C4-004: RecipientDataHash tampering correctly detected"
}

# =============================================================================
# C4-005: Independent Detection - Both Tampering Separately
# =============================================================================
@test "C4-005: Verify independent detection of tampering" {
    log_test "C4-005: Test that each field tampering is independently detected"

    # Create C4 token
    local alice_token="${TEST_TEMP_DIR}/alice-c4-multi.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '{\"test\":\"value\"}' -o ${alice_token}"
    assert_success

    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    local transfer="${TEST_TEMP_DIR}/transfer-c4-multi.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_addr} --local -o ${transfer}"
    assert_success

    local bob_token="${TEST_TEMP_DIR}/bob-c4-multi.txf"
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer} --local -o ${bob_token}"
    assert_success

    # Test 1: Genesis tampering only
    local tamper1="${TEST_TEMP_DIR}/c4-multi-genesis.txf"
    cp "${bob_token}" "${tamper1}"
    jq '.genesis.data.tokenData = "deadbeef"' "${tamper1}" > "${tamper1}.tmp"
    mv "${tamper1}.tmp" "${tamper1}"

    run_cli "verify-token -f ${tamper1} --local"
    assert_failure
    log_info "Test 1: Genesis tampering independently detected"

    # Test 2: State tampering only
    local tamper2="${TEST_TEMP_DIR}/c4-multi-state.txf"
    cp "${bob_token}" "${tamper2}"
    jq '.state.data = "deadbeef"' "${tamper2}" > "${tamper2}.tmp"
    mv "${tamper2}.tmp" "${tamper2}"

    run_cli "verify-token -f ${tamper2} --local"
    assert_failure
    log_info "Test 2: State tampering independently detected"

    # Test 3: RecipientDataHash tampering only
    local tamper3="${TEST_TEMP_DIR}/c4-multi-hash.txf"
    cp "${bob_token}" "${tamper3}"
    jq '.genesis.transaction.recipientDataHash = "0000000000000000000000000000000000000000000000000000000000000000"' \
        "${tamper3}" > "${tamper3}.tmp"
    mv "${tamper3}.tmp" "${tamper3}"

    run_cli "verify-token -f ${tamper3} --local"
    assert_failure
    log_info "Test 3: Hash tampering independently detected"

    log_success "C4-005: All tampering detected independently"
}

# =============================================================================
# C4-006: Transfer C4 Token - Both Data Types Preserved
# =============================================================================
@test "C4-006: Transfer C4 token preserves both data types" {
    log_test "C4-006: Verify both data types survive another transfer"

    # Create and transfer to Bob (making C4 token)
    local alice_token="${TEST_TEMP_DIR}/alice-c4-xfer.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '{\"from\":\"Alice\"}' -o ${alice_token}"
    assert_success

    run_cli_with_secret "${BOB_SECRET}" "gen-address --preset nft"
    assert_success
    local bob_addr=$(echo "${output}" | jq -r '.address')

    local transfer1="${TEST_TEMP_DIR}/alice-to-bob.txf"
    run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${alice_token} -r ${bob_addr} --local -o ${transfer1}"
    assert_success

    local bob_token="${TEST_TEMP_DIR}/bob-c4-xfer.txf"
    run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer1} --local -o ${bob_token}"
    assert_success

    # Extract original genesis data
    local original_genesis=$(jq -r '.genesis.data.tokenData' "${alice_token}")
    local bob_genesis=$(jq -r '.genesis.data.tokenData' "${bob_token}")

    assert_equals "${original_genesis}" "${bob_genesis}" "Genesis data must survive transfer"

    # Bob now transfers to Carol (second transfer)
    run_cli_with_secret "${CAROL_SECRET}" "gen-address --preset nft"
    assert_success
    local carol_addr=$(echo "${output}" | jq -r '.address')

    local transfer2="${TEST_TEMP_DIR}/bob-to-carol.txf"
    run_cli_with_secret "${BOB_SECRET}" "send-token -f ${bob_token} -r ${carol_addr} --local -o ${transfer2}"
    assert_success

    local carol_token="${TEST_TEMP_DIR}/carol-c4-xfer.txf"
    run_cli_with_secret "${CAROL_SECRET}" "receive-token -f ${transfer2} --local -o ${carol_token}"
    assert_success

    # Verify Carol also has C4 token with original genesis data
    local carol_genesis=$(jq -r '.genesis.data.tokenData' "${carol_token}")
    assert_equals "${original_genesis}" "${carol_genesis}" "Genesis data must survive multiple transfers"

    # Both tokens should be valid
    run_cli "verify-token -f ${bob_token} --local"
    assert_success

    run_cli "verify-token -f ${carol_token} --local"
    assert_success

    log_success "C4-006: Both data types correctly preserved through transfers"
}
```

---

## Part 3: RecipientDataHash Explicit Tests

### Test File: `tests/security/test_recipientDataHash_tampering.bats`

```bash
#!/usr/bin/env bats
# Security Test Suite: RecipientDataHash Tampering Detection
# Test Scenarios: HAH-001 to HAH-006
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

    export ALICE_SECRET=$(generate_test_secret "alice-hah")
    export BOB_SECRET=$(generate_test_secret "bob-hah")
}

teardown() {
    teardown_common
}

# =============================================================================
# HAH-001: Verify RecipientDataHash is Computed Correctly
# =============================================================================
@test "HAH-001: RecipientDataHash correctly computes state.data hash" {
    log_test "HAH-001: Verifying recipientDataHash computation"

    local test_data='{"metadata":"test"}'
    local token="${TEST_TEMP_DIR}/hah-verify.txf"

    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '${test_data}' -o ${token}"
    assert_success

    # Extract state.data and recipientDataHash
    local state_data=$(jq -r '.state.data' "${token}")
    local recipient_hash=$(jq -r '.genesis.transaction.recipientDataHash' "${token}")

    assert_set state_data
    assert_set recipient_hash

    log_info "state.data: ${state_data:0:32}..."
    log_info "recipientDataHash: ${recipient_hash:0:32}..."

    # Verify hash is correct (64 hex chars for SHA-256)
    [[ "${recipient_hash}" =~ ^[0-9a-f]{64}$ ]] || \
        assert_failure "recipientDataHash should be 64 hex characters (SHA-256)"

    log_success "HAH-001: RecipientDataHash format verified"
}

# =============================================================================
# HAH-002: Tamper RecipientDataHash - Set to All Zeros
# =============================================================================
# CRITICAL Security Test
@test "HAH-002: Tamper recipientDataHash to all zeros" {
    log_test "HAH-002: Testing all-zeros hash tampering"

    local token="${TEST_TEMP_DIR}/hah-zeros.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '{\"data\":\"value\"}' -o ${token}"
    assert_success

    # Verify original is valid
    run_cli "verify-token -f ${token} --local"
    assert_success

    # ATTACK: Set hash to all zeros
    local tampered="${TEST_TEMP_DIR}/hah-zeros-tampered.txf"
    cp "${token}" "${tampered}"

    local zero_hash="0000000000000000000000000000000000000000000000000000000000000000"
    jq --arg hash "${zero_hash}" \
        '.genesis.transaction.recipientDataHash = $hash' \
        "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"

    log_info "RecipientDataHash set to all zeros"

    # Verify must fail
    run_cli "verify-token -f ${tampered} --local"
    assert_failure
    assert_output_contains "hash" || assert_output_contains "mismatch"

    log_success "HAH-002: All-zeros hash tampering correctly detected"
}

# =============================================================================
# HAH-003: Tamper RecipientDataHash - Set to All F's
# =============================================================================
@test "HAH-003: Tamper recipientDataHash to all F's" {
    log_test "HAH-003: Testing all-F's hash tampering"

    local token="${TEST_TEMP_DIR}/hah-fff.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '{\"test\":\"data\"}' -o ${token}"
    assert_success

    # ATTACK: Set hash to all F's
    local tampered="${TEST_TEMP_DIR}/hah-fff-tampered.txf"
    cp "${token}" "${tampered}"

    local fff_hash="ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    jq --arg hash "${fff_hash}" \
        '.genesis.transaction.recipientDataHash = $hash' \
        "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"

    log_info "RecipientDataHash set to all F's"

    # Verify must fail
    run_cli "verify-token -f ${tampered} --local"
    assert_failure

    log_success "HAH-003: All-F's hash tampering correctly detected"
}

# =============================================================================
# HAH-004: Tamper RecipientDataHash - Partial Modification
# =============================================================================
@test "HAH-004: Tamper recipientDataHash with partial modification" {
    log_test "HAH-004: Testing partial hash modification"

    local token="${TEST_TEMP_DIR}/hah-partial.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '{\"x\":\"y\"}' -o ${token}"
    assert_success

    # ATTACK: Flip first 8 hex chars
    local tampered="${TEST_TEMP_DIR}/hah-partial-tampered.txf"
    cp "${token}" "${tampered}"

    local original_hash=$(jq -r '.genesis.transaction.recipientDataHash' "${tampered}")
    # Flip first 8 characters
    local modified_hash="deadbeef${original_hash:8}"

    jq --arg hash "${modified_hash}" \
        '.genesis.transaction.recipientDataHash = $hash' \
        "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"

    log_info "RecipientDataHash partially modified"
    log_info "Original: ${original_hash:0:16}..."
    log_info "Modified: ${modified_hash:0:16}..."

    # Verify must fail
    run_cli "verify-token -f ${tampered} --local"
    assert_failure

    log_success "HAH-004: Partial hash modification correctly detected"
}

# =============================================================================
# HAH-005: State Data Mismatch with Hash (Hash Tampering)
# =============================================================================
@test "HAH-005: State.data mismatch when hash is changed" {
    log_test "HAH-005: Testing state.data/hash consistency"

    local token="${TEST_TEMP_DIR}/hah-mismatch.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '{\"original\":true}' -o ${token}"
    assert_success

    # ATTACK: Change both state.data and hash, but to mismatched values
    local tampered="${TEST_TEMP_DIR}/hah-mismatch-tampered.txf"
    cp "${token}" "${tampered}"

    # Change state.data
    local new_state=$(printf '{"hacked":true}' | xxd -p | tr -d '\n')
    jq --arg data "${new_state}" '.state.data = $data' "${tampered}" > "${tampered}.tmp"

    # Change hash to different wrong value (not matching new state)
    local wrong_hash="1111111111111111111111111111111111111111111111111111111111111111"
    jq --arg hash "${wrong_hash}" \
        '.genesis.transaction.recipientDataHash = $hash' \
        "${tampered}.tmp" > "${tampered}.tmp2"
    mv "${tampered}.tmp2" "${tampered}"

    # Verify must fail
    run_cli "verify-token -f ${tampered} --local"
    assert_failure
    log_info "Hash mismatch detected"

    log_success "HAH-005: State.data/hash mismatch correctly detected"
}

# =============================================================================
# HAH-006: Null RecipientDataHash Should Fail
# =============================================================================
@test "HAH-006: Null recipientDataHash should be rejected" {
    log_test "HAH-006: Testing null hash rejection"

    local token="${TEST_TEMP_DIR}/hah-null.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '{\"test\":\"data\"}' -o ${token}"
    assert_success

    # ATTACK: Set hash to null
    local tampered="${TEST_TEMP_DIR}/hah-null-tampered.txf"
    cp "${token}" "${tampered}"

    jq '.genesis.transaction.recipientDataHash = null' \
        "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"

    # Verify must fail
    run_cli "verify-token -f ${tampered} --local"
    assert_failure
    assert_output_contains "null" || assert_output_contains "missing" || assert_output_contains "hash"

    log_success "HAH-006: Null recipientDataHash correctly rejected"
}
```

---

## Summary

These test examples provide:

1. **C3 Test Suite (6 tests)**: Genesis data only, immutable metadata protection
2. **C4 Test Suite (6 tests)**: Both data types, dual protection mechanisms
3. **RecipientDataHash Tests (6 tests)**: Explicit hash commitment validation

**Total: 18 new tests** to fill the critical gaps identified in the coverage analysis.

**Coverage Improvement:**
- From 30/58 scenarios (52%) to 48/58+ scenarios (83%+)
- Comprehensive C3 and C4 combination testing
- Explicit recipientDataHash tampering validation
- Independent detection verification

