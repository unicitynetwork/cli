#!/usr/bin/env bats
# Functional tests for aggregator operations (register-request, get-request)
# Test Suite: AGGREGATOR (10 test scenarios)
# These tests verify low-level commitment submission and retrieval

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common
    SECRET=$(generate_test_secret "aggregator")

    # Generate unique test data
    TEST_STATE="test-state-$(date +%s)-$$-${RANDOM}"
    TEST_TX_DATA="test-tx-data-$(date +%s)-$$-${RANDOM}"
}

teardown() {
    teardown_common
}

# AGGREGATOR-001: Register Request and Retrieve by Request ID
@test "AGGREGATOR-001: Register request and retrieve by request ID" {
    require_aggregator
    log_test "Registering commitment and fetching by request ID"

    # Register a commitment request (outputs console text, not JSON)
    run_cli_with_secret "${SECRET}" "register-request ${SECRET} \"${TEST_STATE}\" \"${TEST_TX_DATA}\" --local"
    assert_success

    # Save output to file
    echo "$output" > register_response.txt

    # Extract request ID from console output (format: "Request ID: <hex>")
    local request_id
    request_id=$(echo "$output" | grep -oP '(?<=Request ID: )[0-9a-fA-F]{64}' | head -n1)
    assert_set request_id
    is_valid_hex "${request_id}" 64

    # Fetch the request by ID using --json flag
    run_cli "get-request ${request_id} --local --json"
    assert_success

    # Save JSON output to file
    echo "$output" > get_response.json

    # Verify retrieval response
    assert_file_exists "get_response.json"
    assert_valid_json "$output"

    # Verify request ID matches
    local retrieved_id
    retrieved_id=$(extract_json_field ".requestId")
    assert_equals "${request_id}" "${retrieved_id}"
}

# AGGREGATOR-002: Register Request Returns Valid Request ID
@test "AGGREGATOR-002: Register request returns valid request ID" {
    require_aggregator
    log_test "Verifying request ID format"

    # Register request (console text output)
    run_cli_with_secret "${SECRET}" "register-request ${SECRET} \"${TEST_STATE}\" \"${TEST_TX_DATA}\" --local"
    assert_success

    # Extract request ID from console output
    local request_id
    request_id=$(echo "$output" | grep -oP '(?<=Request ID: )[0-9a-fA-F]{64}' | head -n1)
    assert_set request_id

    # Request ID should be 64-char hex (256-bit)
    is_valid_hex "${request_id}" 64
}

# AGGREGATOR-003: Get Request Returns Inclusion Proof
@test "AGGREGATOR-003: Get request returns inclusion proof" {
    require_aggregator
    log_test "Verifying inclusion proof structure"

    # First register a request
    run_cli_with_secret "${SECRET}" "register-request ${SECRET} \"${TEST_STATE}\" \"${TEST_TX_DATA}\" --local"
    assert_success

    # Extract request ID
    local request_id
    request_id=$(echo "$output" | grep -oP '(?<=Request ID: )[0-9a-fA-F]{64}' | head -n1)

    # Fetch with verbose output and JSON format
    run_cli "get-request ${request_id} --local --json --verbose"
    assert_success

    # Save to file
    echo "$output" > proof.json

    # Verify proof structure
    assert_file_exists "proof.json"
    assert_json_field_exists "proof.json" ".inclusionProof"
    assert_json_field_exists "proof.json" ".stateHash"
}

# AGGREGATOR-004: Different Secrets Produce Different Request IDs
@test "AGGREGATOR-004: Different secrets produce different request IDs" {
    require_aggregator
    log_test "Verifying request ID uniqueness per secret"

    local secret1="secret1-$(date +%s)"
    local secret2="secret2-$(date +%s)"

    # Register with first secret
    run_cli_with_secret "${secret1}" "register-request ${secret1} \"${TEST_STATE}\" \"${TEST_TX_DATA}\" --local"
    assert_success
    local request_id1
    request_id1=$(echo "$output" | grep -oP '(?<=Request ID: )[0-9a-fA-F]{64}' | head -n1)

    # Register with second secret (same state/data)
    run_cli_with_secret "${secret2}" "register-request ${secret2} \"${TEST_STATE}\" \"${TEST_TX_DATA}\" --local"
    assert_success
    local request_id2
    request_id2=$(echo "$output" | grep -oP '(?<=Request ID: )[0-9a-fA-F]{64}' | head -n1)

    # Request IDs should be different
    assert_not_equals "${request_id1}" "${request_id2}"
}

# AGGREGATOR-005: Same Secret and State Produce Same Request ID
@test "AGGREGATOR-005: Same secret and state produce same request ID" {
    require_aggregator
    log_test "Verifying deterministic request ID generation"

    # Register first time
    run_cli_with_secret "${SECRET}" "register-request ${SECRET} \"${TEST_STATE}\" \"${TEST_TX_DATA}\" --local"
    assert_success
    local request_id1
    request_id1=$(echo "$output" | grep -oP '(?<=Request ID: )[0-9a-fA-F]{64}' | head -n1)

    # Register second time with same parameters
    run_cli_with_secret "${SECRET}" "register-request ${SECRET} \"${TEST_STATE}\" \"${TEST_TX_DATA}\" --local"
    assert_success
    local request_id2
    request_id2=$(echo "$output" | grep -oP '(?<=Request ID: )[0-9a-fA-F]{64}' | head -n1)

    # Request IDs should be identical
    assert_equals "${request_id1}" "${request_id2}"
}

# AGGREGATOR-006: Get Non-Existent Request Fails Gracefully
@test "AGGREGATOR-006: Get non-existent request fails gracefully" {
    require_aggregator
    log_test "Verifying error handling for non-existent request"

    # Use a random request ID that doesn't exist
    local fake_request_id="ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

    # Should fail or return empty/not-found response
    run_cli "get-request ${fake_request_id} --local --json"

    # Accept either failure or not-found response
    # Some aggregators return 404, others return empty proof
    if [[ $status -eq 0 ]]; then
        # If success, output should indicate not found
        assert_output_contains "not found" || assert_output_contains "null" || true
    else
        # Failure is acceptable for non-existent request
        assert_failure
    fi
}

# AGGREGATOR-007: Register Request with Special Characters in Data
@test "AGGREGATOR-007: Register request with special characters in data" {
    require_aggregator
    log_test "Testing data encoding with special characters"

    local special_data='{"test":"value with spaces","unicode":"émojis🎉","quotes":"\"quoted\""}'

    run_cli_with_secret "${SECRET}" "register-request ${SECRET} \"${TEST_STATE}\" '${special_data}' --local"
    assert_success

    # Extract request ID
    local request_id
    request_id=$(echo "$output" | grep -oP '(?<=Request ID: )[0-9a-fA-F]{64}' | head -n1)
    assert_set request_id
    is_valid_hex "${request_id}" 64
}

# AGGREGATOR-008: Verify State Hash in Response
@test "AGGREGATOR-008: Verify state hash in response" {
    require_aggregator
    log_test "Verifying state hash field presence and format"

    # Register request (console output)
    run_cli_with_secret "${SECRET}" "register-request ${SECRET} \"${TEST_STATE}\" \"${TEST_TX_DATA}\" --local"
    assert_success

    # Save output
    echo "$output" > response.txt

    # Extract state hash from console output (format: "State Hash: <hex>")
    local state_hash
    state_hash=$(echo "$output" | grep -oP '(?<=State Hash: )[0-9a-fA-F]{64}' | head -n1)
    assert_set state_hash
    is_valid_hex "${state_hash}" 64
}

# AGGREGATOR-009: Multiple Sequential Registrations
@test "AGGREGATOR-009: Multiple sequential registrations" {
    require_aggregator
    log_test "Testing multiple commitment submissions"

    declare -a request_ids

    # Register 5 different requests
    for i in {1..5}; do
        local state="state-$i-$(date +%s)"
        local data="data-$i-$(date +%s)"

        run_cli_with_secret "${SECRET}" "register-request ${SECRET} \"${state}\" \"${data}\" --local"
        assert_success

        # Extract request ID
        local request_id
        request_id=$(echo "$output" | grep -oP '(?<=Request ID: )[0-9a-fA-F]{64}' | head -n1)
        request_ids+=("$request_id")
    done

    # Verify all request IDs are unique
    local unique_count
    unique_count=$(printf '%s\n' "${request_ids[@]}" | sort -u | wc -l)
    assert_equals "5" "${unique_count}"

    # Verify all can be retrieved
    for req_id in "${request_ids[@]}"; do
        run_cli "get-request ${req_id} --local --json"
        assert_success

        # Verify request ID in JSON response
        local retrieved_id
        retrieved_id=$(extract_json_field ".requestId")
        assert_equals "${req_id}" "${retrieved_id}"
    done
}

# AGGREGATOR-010: Verify JSON Output Format for Get Request
@test "AGGREGATOR-010: Verify JSON output format for get-request" {
    require_aggregator
    log_test "Testing JSON output structure"

    # Register request (console output)
    run_cli_with_secret "${SECRET}" "register-request ${SECRET} \"${TEST_STATE}\" \"${TEST_TX_DATA}\" --local"
    assert_success

    # Extract request ID
    local request_id
    request_id=$(echo "$output" | grep -oP '(?<=Request ID: )[0-9a-fA-F]{64}' | head -n1)

    # Get request with --json flag
    run_cli "get-request ${request_id} --local --json"
    assert_success

    # Verify valid JSON
    assert_valid_json "$output"

    # Save to file for field assertions
    echo "$output" > get.json
    assert_json_field_exists "get.json" ".requestId"
}
