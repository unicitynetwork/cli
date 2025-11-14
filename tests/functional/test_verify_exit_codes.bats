#!/usr/bin/env bats
# Test verify-token exit codes
#
# Exit code contract:
#   0 - Token is valid and can be used for transfers
#   1 - Verification failed (tampered token, invalid proofs, token spent)
#   2 - File error (file not found, invalid JSON)

load '../helpers/common.bash'
load '../helpers/assertions.bash'

setup() {
    setup_common
}

teardown() {
    teardown_common
}

# ============================================================================
# Exit Code 0: Valid Token
# ============================================================================

@test "EXIT-001: Valid token should exit 0" {
    log_test "Testing exit code 0 for valid token"

    # Mint a valid token
    local token="${TEST_TEMP_DIR}/valid-token.txf"
    run_cli_with_secret "test-exit-001" "mint-token --preset nft --local -o ${token}"
    assert_success

    # Verify token - should exit 0
    run_cli "verify-token -f ${token} --local"
    assert_success
    assert_output_contains "This token is valid"

    log_success "EXIT-001: Valid token exits 0"
}

# ============================================================================
# Exit Code 1: Validation Failures
# ============================================================================

@test "EXIT-002: Tampered predicate should exit 1" {
    log_test "Testing exit code 1 for tampered predicate (CBOR corruption)"

    # Mint a valid token
    local token="${TEST_TEMP_DIR}/valid-token.txf"
    run_cli_with_secret "test-exit-002" "mint-token --preset nft --local -o ${token}"
    assert_success

    # Tamper with predicate (corrupt CBOR encoding)
    local tampered="${TEST_TEMP_DIR}/tampered-token.txf"
    jq '.state.predicate = "ffffffffffffffff"' "${token}" > "${tampered}"

    # Verify tampered token - should exit 1
    run_cli "verify-token -f ${tampered} --local"
    assert_failure
    assert_output_contains "SDK compatible: No"

    log_success "EXIT-002: Tampered predicate exits 1"
}

@test "EXIT-003: Token with invalid proof structure should exit 1" {
    log_test "Testing exit code 1 for invalid proof structure"

    # Mint a valid token
    local token="${TEST_TEMP_DIR}/valid-token.txf"
    run_cli_with_secret "test-exit-003" "mint-token --preset nft --local -o ${token}"
    assert_success

    # Remove authenticator from genesis proof
    local invalid="${TEST_TEMP_DIR}/invalid-proof.txf"
    jq 'del(.genesis.inclusionProof.authenticator)' "${token}" > "${invalid}"

    # Verify token - should exit 1
    run_cli "verify-token -f ${invalid} --local"
    assert_failure
    assert_output_contains "Proof validation failed"

    log_success "EXIT-003: Invalid proof structure exits 1"
}

@test "EXIT-004: Token with missing genesis should exit 1" {
    log_test "Testing exit code 1 for missing genesis"

    # Create token with no genesis
    local invalid="${TEST_TEMP_DIR}/no-genesis.txf"
    echo '{"version":"2.0","state":{},"transactions":[]}' > "${invalid}"

    # Verify token - should exit 1 (SDK cannot load it)
    run_cli "verify-token -f ${invalid} --local"
    assert_failure

    log_success "EXIT-004: Missing genesis exits 1"
}

# ============================================================================
# Exit Code 2: File Errors
# ============================================================================

@test "EXIT-005: File not found should exit 2" {
    log_test "Testing exit code 2 for nonexistent file"

    # Verify nonexistent file - should exit 2
    run_cli "verify-token -f /tmp/nonexistent-token-12345.txf --local"

    # Check exit code is 2
    [ "$status" -eq 2 ]
    assert_output_contains "Cannot read file"

    log_success "EXIT-005: File not found exits 2"
}

@test "EXIT-006: Invalid JSON should exit 2" {
    log_test "Testing exit code 2 for invalid JSON"

    # Create file with invalid JSON
    local invalid="${TEST_TEMP_DIR}/invalid-json.txf"
    echo '{invalid json' > "${invalid}"

    # Verify file - should exit 2
    run_cli "verify-token -f ${invalid} --local"

    # Check exit code is 2
    [ "$status" -eq 2 ]
    assert_output_contains "Invalid JSON"

    log_success "EXIT-006: Invalid JSON exits 2"
}

@test "EXIT-007: Missing --file flag should exit 2" {
    log_test "Testing exit code 2 for missing --file flag"

    # Verify without --file flag - should exit 2
    run_cli "verify-token --local"

    # Check exit code is 2
    [ "$status" -eq 2 ]
    assert_output_contains "option is required"

    log_success "EXIT-007: Missing --file flag exits 2"
}

# ============================================================================
# Exit Code 0 (with warnings): Network Issues
# ============================================================================

@test "EXIT-008: Network unavailable should exit 0 with warning" {
    log_test "Testing exit code 0 when network unavailable (graceful degradation)"

    # Mint a valid token
    local token="${TEST_TEMP_DIR}/valid-token.txf"
    run_cli_with_secret "test-exit-008" "mint-token --preset nft --local -o ${token}"
    assert_success

    # Verify token against nonexistent endpoint
    run_cli "verify-token -f ${token} --endpoint http://localhost:9999 --local"

    # Should exit 0 (network error is warning, not failure)
    assert_success
    assert_output_contains "This token is valid"

    log_success "EXIT-008: Network unavailable exits 0 with warning"
}

# ============================================================================
# Diagnostic Mode: Always Exit 0
# ============================================================================

@test "EXIT-009: Diagnostic mode with valid token should exit 0" {
    log_test "Testing --diagnostic flag with valid token"

    # Mint a valid token
    local token="${TEST_TEMP_DIR}/valid-token.txf"
    run_cli_with_secret "test-exit-009" "mint-token --preset nft --local -o ${token}"
    assert_success

    # Verify with --diagnostic flag
    run_cli "verify-token -f ${token} --local --diagnostic"
    assert_success

    log_success "EXIT-009: Diagnostic mode with valid token exits 0"
}

@test "EXIT-010: Diagnostic mode with tampered token should exit 0" {
    log_test "Testing --diagnostic flag with tampered token (backward compat)"

    # Mint a valid token
    local token="${TEST_TEMP_DIR}/valid-token.txf"
    run_cli_with_secret "test-exit-010" "mint-token --preset nft --local -o ${token}"
    assert_success

    # Tamper with token
    local tampered="${TEST_TEMP_DIR}/tampered-token.txf"
    jq '.state.predicate = "ffffffffffffffff"' "${token}" > "${tampered}"

    # Verify with --diagnostic flag - should exit 0
    run_cli "verify-token -f ${tampered} --local --diagnostic"
    assert_success
    assert_output_contains "SDK compatible: No"

    log_success "EXIT-010: Diagnostic mode with tampered token exits 0"
}

# ============================================================================
# Script Pattern Testing
# ============================================================================

@test "EXIT-011: Script conditional pattern should work correctly" {
    log_test "Testing if/then pattern with verify-token"

    # Mint a valid token
    local valid_token="${TEST_TEMP_DIR}/valid-token.txf"
    run_cli_with_secret "test-exit-011" "mint-token --preset nft --local -o ${valid_token}"
    assert_success

    # Tamper with token
    local tampered_token="${TEST_TEMP_DIR}/tampered-token.txf"
    jq '.state.predicate = "ffffffffffffffff"' "${valid_token}" > "${tampered_token}"

    # Test pattern: if verify succeeds, set flag
    local valid_passed=false
    if npm run verify-token -- -f "${valid_token}" --local > /dev/null 2>&1; then
        valid_passed=true
    fi

    local tampered_passed=false
    if npm run verify-token -- -f "${tampered_token}" --local > /dev/null 2>&1; then
        tampered_passed=true
    fi

    # Assertions
    [ "$valid_passed" = true ]
    [ "$tampered_passed" = false ]

    log_success "EXIT-011: Script conditional pattern works correctly"
}
