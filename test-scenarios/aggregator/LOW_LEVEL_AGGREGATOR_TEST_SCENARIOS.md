# Comprehensive Test Scenarios for Low-Level Aggregator Operations

**Document Version:** 1.0
**Created:** 2025-11-04
**Purpose:** Design comprehensive test scenarios for `register-request` and `get-request` commands

---

## Table of Contents

1. [Overview](#overview)
2. [Command Output Formats](#command-output-formats)
3. [Test Scenario Categories](#test-scenario-categories)
4. [Detailed Test Scenarios](#detailed-test-scenarios)
5. [Output Parsing Strategies](#output-parsing-strategies)
6. [BATS Implementation Patterns](#bats-implementation-patterns)
7. [Error Handling Scenarios](#error-handling-scenarios)
8. [Performance and Reliability Tests](#performance-and-reliability-tests)

---

## Overview

### Commands Under Test

#### `register-request`
```bash
node dist/index.js register-request <secret> <state> <transactionData> [options]
```

**Options:**
- `--local` - Use local aggregator (http://127.0.0.1:3000)
- `--production` - Use production aggregator
- `-e, --endpoint <url>` - Custom endpoint

**Output Format:** Console output (NOT JSON) with structured text

**Key Outputs:**
- Public Key (hex)
- State Hash (hex)
- Transaction Hash (hex)
- Request ID (hex)
- Success/failure status

#### `get-request`
```bash
node dist/index.js get-request <requestId> [options]
```

**Options:**
- `--local` - Use local aggregator
- `--json` - Output JSON for pipeline processing
- `-v, --verbose` - Show verbose verification details

**Output Formats:**
- **Without `--json`**: Human-readable console output
- **With `--json`**: Structured JSON output

---

## Command Output Formats

### `register-request` Console Output Structure

```
Creating commitment at generic abstraction level...

Public Key: 03a1b2c3d4e5f6...
State Hash: 7f8e9d0c1b2a3d4e...
Transaction Hash: 4f5e6d7c8b9a0d1e...
Request ID: 9a0b1c2d3e4f5a6b...

=== AUTHENTICATOR CREATION DEBUG ===
Authenticator created locally:
  Public Key: 03a1b2c3d4e5f6...
  Signature: a1b2c3d4e5f6...
  State Hash: 7f8e9d0c1b2a3d4e...

=== LOCAL AUTHENTICATOR VERIFICATION TEST ===
✓ Local authenticator verifies transactionHash: true
✓ Local authenticator is VALID before submission

Submitting to aggregator: http://127.0.0.1:3000
✅ Commitment successfully registered

Commitment Details:
  Request ID: 9a0b1c2d3e4f5a6b...
  Transaction Hash: 4f5e6d7c8b9a0d1e...
  State Hash: 7f8e9d0c1b2a3d4e...

You can check the inclusion proof with:
  npm run get-request -- 9a0b1c2d3e4f5a6b...
```

### `get-request` JSON Output Structure

```json
{
  "status": "INCLUSION",
  "requestId": "9a0b1c2d3e4f5a6b...",
  "endpoint": "http://127.0.0.1:3000",
  "proof": {
    "requestId": "9a0b1c2d3e4f5a6b...",
    "transactionHash": "4f5e6d7c8b9a0d1e...",
    "stateHash": "7f8e9d0c1b2a3d4e...",
    "authenticator": {
      "publicKey": "03a1b2c3d4e5f6...",
      "signature": "a1b2c3d4e5f6...",
      "stateHash": "7f8e9d0c1b2a3d4e..."
    },
    "merkleTreePath": {
      "root": "...",
      "steps": [...]
    },
    "unicityCertificate": {
      "version": 1,
      "inputRecord": {...},
      "unicitySeal": {...}
    }
  }
}
```

### `get-request` Non-Existent Request Response

```json
{
  "status": "NOT_FOUND",
  "requestId": "ffffffffffffffff...",
  "endpoint": "http://127.0.0.1:3000",
  "proof": null
}
```

---

## Test Scenario Categories

### Category 1: Commitment Registration Flow
- Basic registration
- Request ID generation
- State hash computation
- Transaction hash computation
- Authenticator creation

### Category 2: Request ID Determinism
- Same inputs produce same request ID
- Different secrets produce different request IDs
- Different state data produces different request IDs
- Request ID format validation

### Category 3: Retrieval and Verification
- Retrieve by request ID
- Inclusion proof structure
- Authenticator validation
- Merkle tree path validation
- Unicity certificate presence

### Category 4: Data Encoding and Special Characters
- Unicode characters in state data
- JSON structures in transaction data
- Quotes and escape sequences
- Binary data encoding
- Empty strings
- Very long data

### Category 5: Error Handling
- Non-existent request IDs
- Invalid request ID formats
- Aggregator unavailable
- Network timeouts
- Malformed responses

### Category 6: Concurrent Operations
- Multiple registrations
- Sequential retrievals
- Registration-then-retrieval chains
- Uniqueness verification

---

## Detailed Test Scenarios

### AGG-REG-001: Basic Commitment Registration and Retrieval

**Objective:** Verify complete flow from registration to retrieval

**Steps:**
1. Generate unique test secret, state, and transaction data
2. Register commitment using `register-request`
3. Extract request ID from console output
4. Retrieve commitment using `get-request --json`
5. Verify all fields match

**Expected Results:**
- `register-request` succeeds (exit code 0)
- Output contains "✅ Commitment successfully registered"
- Request ID is 64-character hex string
- `get-request` returns status "INCLUSION"
- State hash matches
- Transaction hash matches
- Authenticator is present

**Assertions:**
```bash
assert_success
assert_output_contains "✅ Commitment successfully registered"
is_valid_hex "$request_id" 64
assert_json_field_equals "response.json" ".status" "INCLUSION"
```

---

### AGG-REG-002: Request ID Determinism - Same Inputs

**Objective:** Verify request ID is deterministic for same inputs

**Steps:**
1. Register commitment with secret1, state1, data1 → get request_id_1
2. Register commitment with secret1, state1, data1 → get request_id_2
3. Compare request IDs

**Expected Results:**
- Both registrations succeed
- request_id_1 == request_id_2 (identical)
- Formula: RequestID = hash(publicKey + stateHash)

**Assertions:**
```bash
assert_equals "$request_id_1" "$request_id_2" "Request IDs should be identical"
```

**Rationale:** Request ID determinism is critical for idempotency

---

### AGG-REG-003: Request ID Uniqueness - Different Secrets

**Objective:** Verify different secrets produce different request IDs

**Steps:**
1. Register with secret1, state1, data1 → request_id_1
2. Register with secret2, state1, data1 → request_id_2
3. Verify request_id_1 != request_id_2

**Expected Results:**
- Both registrations succeed
- Request IDs are different (different public keys)
- Both requests are retrievable

**Assertions:**
```bash
assert_not_equals "$request_id_1" "$request_id_2" "Different secrets should produce different request IDs"
```

**Rationale:** Each secret derives different public key → different request ID

---

### AGG-REG-004: Request ID Uniqueness - Different State Hashes

**Objective:** Verify different state data produces different request IDs

**Steps:**
1. Register with secret1, state1, data1 → request_id_1
2. Register with secret1, state2, data1 → request_id_2
3. Verify request_id_1 != request_id_2

**Expected Results:**
- Both registrations succeed
- Request IDs are different (different state hashes)
- Same public key, different state hash → different request ID

**Assertions:**
```bash
assert_not_equals "$request_id_1" "$request_id_2" "Different states should produce different request IDs"
```

---

### AGG-REG-005: Transaction Data Independence

**Objective:** Verify transaction data does NOT affect request ID

**Steps:**
1. Register with secret1, state1, txdata1 → request_id_1
2. Register with secret1, state1, txdata2 → request_id_2
3. Verify request_id_1 == request_id_2

**Expected Results:**
- Both registrations succeed
- Request IDs are IDENTICAL (transaction data not part of request ID)
- Different transaction hashes stored
- Same request ID points to latest/both transactions

**Assertions:**
```bash
assert_equals "$request_id_1" "$request_id_2" "Transaction data should not affect request ID"
```

**Rationale:** RequestID = hash(publicKey + stateHash), NOT including transaction data

---

### AGG-REG-006: Inclusion Proof Structure Validation

**Objective:** Verify inclusion proof has all required components

**Steps:**
1. Register commitment
2. Retrieve using `get-request --json`
3. Validate proof structure

**Expected Results:**
- Proof contains:
  - `requestId`
  - `transactionHash`
  - `authenticator` (with publicKey, signature, stateHash)
  - `merkleTreePath` (with root and steps)
  - `unicityCertificate` (with inputRecord and unicitySeal)

**Assertions:**
```bash
assert_json_field_exists "proof.json" ".proof.requestId"
assert_json_field_exists "proof.json" ".proof.authenticator"
assert_json_field_exists "proof.json" ".proof.merkleTreePath"
assert_json_field_exists "proof.json" ".proof.unicityCertificate"
```

---

### AGG-REG-007: Non-Existent Request ID Handling

**Objective:** Verify graceful handling of non-existent requests

**Steps:**
1. Generate random request ID that doesn't exist
2. Call `get-request --json` with fake ID
3. Verify response indicates NOT_FOUND

**Expected Results:**
- Command succeeds (exit code 0 or acceptable failure)
- Response status is "NOT_FOUND"
- Proof is null
- No crashes or exceptions

**Assertions:**
```bash
# Accept either success with NOT_FOUND or failure
if [[ $status -eq 0 ]]; then
  assert_json_field_equals "response.json" ".status" "NOT_FOUND"
  assert_json_field_equals "response.json" ".proof" "null"
else
  assert_failure
fi
```

---

### AGG-REG-008: Invalid Request ID Format Handling

**Objective:** Test error handling for malformed request IDs

**Steps:**
1. Call `get-request` with invalid formats:
   - Too short: "abc123"
   - Too long: "abc123..." (>64 chars)
   - Non-hex: "xyz123..."
   - Empty string
   - Special characters

**Expected Results:**
- Command fails with clear error message
- Error indicates invalid format
- No crashes

**Assertions:**
```bash
assert_failure
assert_output_contains "invalid" || assert_output_contains "error"
```

---

### AGG-REG-009: Special Characters in State Data

**Objective:** Test encoding of special characters in state field

**Test Cases:**

#### 9a. Unicode Characters
```bash
state='{"name":"François","emoji":"🎉🚀"}'
```

#### 9b. JSON Structures
```bash
state='{"nested":{"deep":{"value":"test"}}}'
```

#### 9c. Quotes and Escapes
```bash
state='{"quote":"He said \"hello\"","slash":"path\\/to\\/file"}'
```

#### 9d. Newlines and Tabs
```bash
state='{"multiline":"line1\nline2\ttab"}'
```

**Expected Results:**
- All registrations succeed
- Data is properly encoded/decoded
- Request IDs are valid
- Retrieval returns correct data

**Assertions:**
```bash
assert_success
is_valid_hex "$request_id" 64
```

---

### AGG-REG-010: Special Characters in Transaction Data

**Objective:** Test encoding of special characters in transaction data

**Similar to AGG-REG-009 but for transaction data field**

**Expected Results:**
- Transaction data doesn't affect request ID
- Data is properly stored and retrievable
- Transaction hash correctly computed

---

### AGG-REG-011: Empty and Minimal Data

**Objective:** Test edge cases with minimal data

**Test Cases:**

#### 11a. Empty State
```bash
state=""
```

#### 11b. Empty Transaction Data
```bash
txdata=""
```

#### 11c. Single Character
```bash
state="x"
txdata="y"
```

**Expected Results:**
- Registrations succeed or fail with clear error
- If accepted, request IDs are valid
- Hashes are computed correctly

---

### AGG-REG-012: Large Data Payloads

**Objective:** Test handling of large data (near limits)

**Test Cases:**

#### 12a. Large State (1KB)
```bash
state=$(python3 -c "print('x' * 1024)")
```

#### 12b. Large Transaction Data (10KB)
```bash
txdata=$(python3 -c "print('y' * 10240)")
```

#### 12c. Very Large (100KB)
```bash
txdata=$(python3 -c "print('z' * 102400)")
```

**Expected Results:**
- Reasonable sizes accepted
- Very large sizes may be rejected with clear error
- No memory issues or crashes

**Assertions:**
```bash
if [[ $status -eq 0 ]]; then
  assert_output_contains "✅ Commitment successfully registered"
else
  assert_output_contains "too large" || assert_output_contains "exceeded"
fi
```

---

### AGG-REG-013: Multiple Sequential Registrations

**Objective:** Verify handling of multiple commitments

**Steps:**
1. Register 10 different commitments
2. Store all request IDs
3. Verify all IDs are unique
4. Retrieve all commitments
5. Verify all retrievals succeed

**Expected Results:**
- All 10 registrations succeed
- All request IDs are unique
- All retrievals return correct data
- No conflicts or overwriting

**Assertions:**
```bash
unique_count=$(printf '%s\n' "${request_ids[@]}" | sort -u | wc -l)
assert_equals "10" "$unique_count" "All request IDs should be unique"
```

---

### AGG-REG-014: Same Request ID Multiple Registrations

**Objective:** Test behavior when same request ID is registered multiple times

**Steps:**
1. Register with secret1, state1, data1 (same request ID expected)
2. Register again with secret1, state1, data2 (same request ID, different tx)
3. Retrieve the request
4. Verify behavior (overwrite vs. multiple vs. latest)

**Expected Results:**
- Both registrations succeed
- Same request ID returned
- Retrieval behavior depends on aggregator implementation:
  - May return latest transaction
  - May return first transaction
  - May return multiple transactions

**Note:** Document actual aggregator behavior

---

### AGG-REG-015: Concurrent Registration Safety

**Objective:** Test thread-safety and race conditions

**Steps:**
1. Launch 5 parallel `register-request` calls with different data
2. Wait for all to complete
3. Verify all succeeded
4. Verify all request IDs are unique
5. Retrieve all commitments

**Expected Results:**
- All registrations complete successfully
- No race conditions
- All data correctly stored

**Implementation:**
```bash
# Launch parallel registrations
for i in {1..5}; do
  register_request_async "$secret_$i" "$state_$i" "$data_$i" &
done
wait
```

---

### AGG-REG-016: State Hash Validation

**Objective:** Verify state hash is correctly computed

**Steps:**
1. Register commitment with known state data
2. Extract state hash from output
3. Independently compute SHA256(state)
4. Compare hashes

**Expected Results:**
- Hashes match
- Formula: stateHash = SHA256(state_string)

**Implementation:**
```bash
expected_hash=$(echo -n "$state" | sha256sum | cut -d' ' -f1)
actual_hash=$(extract_state_hash_from_output "$output")
assert_equals "$expected_hash" "$actual_hash"
```

---

### AGG-REG-017: Transaction Hash Validation

**Objective:** Verify transaction hash is correctly computed

**Similar to AGG-REG-016 but for transaction data**

---

### AGG-REG-018: Public Key Derivation Verification

**Objective:** Verify public key is correctly derived from secret

**Steps:**
1. Register with known secret
2. Extract public key from output
3. Independently derive public key from secret using SDK
4. Compare

**Expected Results:**
- Public keys match
- Secp256k1 key derivation is correct

---

### AGG-REG-019: Authenticator Signature Verification

**Objective:** Verify authenticator signature is valid

**Steps:**
1. Register commitment
2. Retrieve with `--json`
3. Extract authenticator
4. Verify signature validates transaction hash

**Expected Results:**
- Signature verification passes
- Uses correct public key
- Signs correct transaction hash

---

### AGG-REG-020: Merkle Path Validation

**Objective:** Verify Merkle tree path proves inclusion

**Steps:**
1. Register commitment
2. Retrieve inclusion proof
3. Extract Merkle path
4. Compute root from path
5. Compare with certificate root

**Expected Results:**
- Root computation matches
- Path is valid
- Proves inclusion in sparse Merkle tree

---

### AGG-REG-021: Network Error Handling - Aggregator Down

**Objective:** Test graceful failure when aggregator is unavailable

**Steps:**
1. Stop aggregator or use invalid endpoint
2. Attempt `register-request`
3. Verify error handling

**Expected Results:**
- Command fails with clear error
- Error message indicates connection issue
- No crashes or hangs
- Reasonable timeout

**Assertions:**
```bash
assert_failure
assert_output_contains "connection" || assert_output_contains "unavailable"
```

---

### AGG-REG-022: Network Error Handling - Timeout

**Objective:** Test timeout handling for slow aggregator

**Steps:**
1. Configure very slow aggregator or network delay
2. Attempt registration with timeout
3. Verify timeout behavior

**Expected Results:**
- Operation times out with error
- No infinite wait
- Clear timeout message

---

### AGG-REG-023: Malformed Aggregator Response

**Objective:** Test handling of invalid aggregator responses

**Steps:**
1. Mock aggregator returning invalid JSON
2. Attempt registration
3. Verify error handling

**Expected Results:**
- Error detected and reported
- No crashes on parse errors

---

### AGG-REG-024: Aggregator 500 Error Response

**Objective:** Test handling of server errors

**Steps:**
1. Mock aggregator returning HTTP 500
2. Attempt registration
3. Verify error handling

**Expected Results:**
- Failure reported clearly
- HTTP status code mentioned in error

---

### AGG-REG-025: Output Format Consistency

**Objective:** Verify output format is consistent across runs

**Steps:**
1. Register same commitment 10 times
2. Parse all outputs
3. Verify format consistency

**Expected Results:**
- All outputs follow same format
- All required fields present
- Parsing logic works reliably

---

### AGG-REG-026: Request ID Collision Detection

**Objective:** Verify extremely rare request ID collisions are handled

**Steps:**
1. Generate millions of requests (stress test)
2. Monitor for any ID collisions
3. Verify collision handling if any occur

**Expected Results:**
- No collisions in reasonable test size
- If collision occurs, handled gracefully

**Note:** This is a theoretical test; actual implementation may skip due to computational cost

---

### AGG-REG-027: Endpoint Selection - Local Flag

**Objective:** Verify `--local` flag uses correct endpoint

**Steps:**
1. Register with `--local` flag
2. Verify connection to http://127.0.0.1:3000
3. Verify NOT connecting to production

**Expected Results:**
- Connects to local aggregator
- Output shows local endpoint

**Assertions:**
```bash
assert_output_contains "http://127.0.0.1:3000"
```

---

### AGG-REG-028: Endpoint Selection - Production Flag

**Objective:** Verify `--production` flag uses correct endpoint

**Steps:**
1. Register with `--production` flag
2. Verify connection to production endpoint

**Expected Results:**
- Connects to https://gateway.unicity.network
- Output shows production endpoint

---

### AGG-REG-029: Endpoint Selection - Custom Endpoint

**Objective:** Verify custom endpoint option works

**Steps:**
1. Register with `-e http://custom:8080`
2. Verify connection to custom endpoint

**Expected Results:**
- Connects to specified endpoint
- Output shows custom URL

---

### AGG-REG-030: JSON Output Flag - get-request

**Objective:** Verify `--json` flag produces valid JSON

**Steps:**
1. Register commitment
2. Retrieve with `--json` flag
3. Validate JSON structure

**Expected Results:**
- Output is valid JSON
- Parseable by `jq`
- Contains all required fields

**Assertions:**
```bash
assert_valid_json "$output"
jq empty <<< "$output"  # Should not fail
```

---

### AGG-REG-031: Verbose Output Flag

**Objective:** Verify `--verbose` flag shows additional details

**Steps:**
1. Retrieve with `--verbose`
2. Compare with non-verbose output

**Expected Results:**
- Verbose shows additional verification details
- More diagnostic information
- Same core data

---

### AGG-REG-032: Inclusion vs Exclusion Proofs

**Objective:** Understand and test exclusion proof behavior

**Steps:**
1. Retrieve non-existent request
2. Check if exclusion proof is returned
3. Validate exclusion proof structure

**Expected Results:**
- Status is "EXCLUSION" or "NOT_FOUND"
- Proof may contain Merkle path showing non-inclusion
- Authenticator is null

---

### AGG-REG-033: Unicity Certificate Validation

**Objective:** Verify Unicity Certificate structure

**Steps:**
1. Register and retrieve commitment
2. Extract Unicity Certificate
3. Validate structure

**Expected Results:**
- Certificate has valid CBOR encoding
- Contains inputRecord
- Contains unicitySeal
- Seal has signatures

**Assertions:**
```bash
assert_json_field_exists "proof.json" ".proof.unicityCertificate.inputRecord"
assert_json_field_exists "proof.json" ".proof.unicityCertificate.unicitySeal"
```

---

### AGG-REG-034: Round Number and Timestamp

**Objective:** Verify certificate contains valid round and timestamp

**Steps:**
1. Retrieve proof
2. Extract round number and timestamp
3. Validate values

**Expected Results:**
- Round number is positive integer
- Timestamp is reasonable Unix time
- Timestamp is recent (not ancient or future)

**Assertions:**
```bash
round=$(extract_json_field ".proof.unicityCertificate.inputRecord.roundNumber")
assert_greater_than "$round" "0"

timestamp=$(extract_json_field ".proof.unicityCertificate.inputRecord.timestamp")
current_time=$(date +%s)
# Timestamp should be within last hour
assert_in_range "$timestamp" "$((current_time - 3600))" "$((current_time + 60))"
```

---

### AGG-REG-035: Signature Map Validation

**Objective:** Verify BFT signatures in Unicity Seal

**Steps:**
1. Retrieve proof
2. Extract signature map
3. Validate signatures

**Expected Results:**
- At least 1 signature present
- Node IDs are valid
- Signatures are hex strings

---

## Output Parsing Strategies

### Parsing `register-request` Console Output

The output is NOT JSON, so we need line-by-line parsing:

```bash
# Extract Request ID from console output
extract_request_id_from_console() {
  local output="$1"
  # Look for "Request ID: <hex>"
  echo "$output" | grep "Request ID:" | sed -E 's/.*Request ID: ([0-9a-fA-F]+).*/\1/'
}

# Extract State Hash from console output
extract_state_hash_from_console() {
  local output="$1"
  echo "$output" | grep "State Hash:" | sed -E 's/.*State Hash: ([0-9a-fA-F]+).*/\1/'
}

# Extract Transaction Hash from console output
extract_transaction_hash_from_console() {
  local output="$1"
  echo "$output" | grep "Transaction Hash:" | sed -E 's/.*Transaction Hash: ([0-9a-fA-F]+).*/\1/'
}

# Extract Public Key from console output
extract_public_key_from_console() {
  local output="$1"
  echo "$output" | grep "Public Key:" | head -1 | sed -E 's/.*Public Key: ([0-9a-fA-F]+).*/\1/'
}

# Check if registration succeeded
check_registration_success() {
  local output="$1"
  if echo "$output" | grep -q "✅ Commitment successfully registered"; then
    return 0
  else
    return 1
  fi
}

# Check if authenticator verification passed
check_authenticator_verified() {
  local output="$1"
  if echo "$output" | grep -q "✓ Local authenticator is VALID before submission"; then
    return 0
  else
    return 1
  fi
}
```

### Parsing `get-request --json` Output

Use `jq` for JSON parsing:

```bash
# Extract fields from JSON response
extract_request_id_from_json() {
  local json="$1"
  echo "$json" | jq -r '.requestId'
}

extract_status_from_json() {
  local json="$1"
  echo "$json" | jq -r '.status'
}

extract_proof_authenticator() {
  local json="$1"
  echo "$json" | jq -r '.proof.authenticator'
}

# Validate proof structure
validate_inclusion_proof_structure() {
  local json="$1"

  # Check required fields exist
  jq -e '.proof.requestId' <<< "$json" >/dev/null || return 1
  jq -e '.proof.authenticator' <<< "$json" >/dev/null || return 1
  jq -e '.proof.merkleTreePath' <<< "$json" >/dev/null || return 1
  jq -e '.proof.unicityCertificate' <<< "$json" >/dev/null || return 1

  return 0
}
```

### Parsing `get-request` Human-Readable Output

Parse structured sections:

```bash
# Extract status from human-readable output
extract_status_from_text() {
  local output="$1"
  if echo "$output" | grep -q "STATUS: INCLUSION PROOF"; then
    echo "INCLUSION"
  elif echo "$output" | grep -q "STATUS: EXCLUSION PROOF"; then
    echo "EXCLUSION"
  elif echo "$output" | grep -q "STATUS: NOT_FOUND"; then
    echo "NOT_FOUND"
  else
    echo "UNKNOWN"
  fi
}

# Check verification results
check_verification_passed() {
  local output="$1"
  if echo "$output" | grep -q "✅ ALL CHECKS PASSED"; then
    return 0
  else
    return 1
  fi
}
```

---

## BATS Implementation Patterns

### Pattern 1: Basic Registration and Retrieval

```bash
@test "AGG-REG-001: Basic commitment registration and retrieval" {
  require_aggregator
  log_test "Testing complete registration and retrieval flow"

  # Setup
  local secret=$(generate_test_secret "agg001")
  local state="test-state-$(date +%s)"
  local txdata="test-txdata-$(date +%s)"

  # Register commitment
  run_cli_with_secret "$secret" "register-request $secret \"$state\" \"$txdata\" --local"
  assert_success

  # Verify success message
  assert_output_contains "✅ Commitment successfully registered"

  # Extract request ID
  local request_id
  request_id=$(extract_request_id_from_console "$output")
  assert_set request_id
  is_valid_hex "$request_id" 64

  # Retrieve commitment
  run_cli "get-request $request_id --local --json"
  assert_success
  save_output_artifact "agg001-response.json" "$output"

  # Validate response
  assert_valid_json "$output"

  local status
  status=$(extract_json_field ".status")
  assert_equals "INCLUSION" "$status"

  # Verify request ID matches
  local retrieved_id
  retrieved_id=$(extract_json_field ".requestId")
  assert_equals "$request_id" "$retrieved_id"
}
```

### Pattern 2: Determinism Testing

```bash
@test "AGG-REG-002: Request ID determinism - same inputs" {
  require_aggregator
  log_test "Verifying request ID is deterministic"

  local secret="secret-determinism-test-$$"
  local state="state-fixed-12345"
  local txdata="txdata-fixed-67890"

  # First registration
  run_cli_with_secret "$secret" "register-request $secret \"$state\" \"$txdata\" --local"
  assert_success
  local request_id_1
  request_id_1=$(extract_request_id_from_console "$output")

  # Second registration with same inputs
  run_cli_with_secret "$secret" "register-request $secret \"$state\" \"$txdata\" --local"
  assert_success
  local request_id_2
  request_id_2=$(extract_request_id_from_console "$output")

  # Verify IDs are identical
  assert_equals "$request_id_1" "$request_id_2" "Request IDs should be deterministic"
}
```

### Pattern 3: Error Handling

```bash
@test "AGG-REG-007: Non-existent request ID handling" {
  require_aggregator
  log_test "Testing retrieval of non-existent request"

  # Use fake request ID (all f's)
  local fake_id="ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

  # Attempt retrieval
  run_cli "get-request $fake_id --local --json"

  # Accept either success with NOT_FOUND or failure
  if [[ $status -eq 0 ]]; then
    # Success - check for NOT_FOUND status
    assert_valid_json "$output"
    local status_value
    status_value=$(extract_json_field ".status")
    assert_equals "NOT_FOUND" "$status_value"

    # Proof should be null
    local proof_value
    proof_value=$(extract_json_field ".proof")
    assert_equals "null" "$proof_value"
  else
    # Failure is also acceptable
    assert_failure
  fi
}
```

### Pattern 4: Special Characters

```bash
@test "AGG-REG-009a: Special characters - unicode" {
  require_aggregator
  log_test "Testing unicode characters in state data"

  local secret=$(generate_test_secret "unicode")
  local state='{"name":"François","emoji":"🎉🚀"}'
  local txdata="test-data"

  # Register with unicode
  run_cli_with_secret "$secret" "register-request $secret '$state' \"$txdata\" --local"
  assert_success

  # Extract and validate request ID
  local request_id
  request_id=$(extract_request_id_from_console "$output")
  assert_set request_id
  is_valid_hex "$request_id" 64

  # Retrieve and verify
  run_cli "get-request $request_id --local --json"
  assert_success
}
```

### Pattern 5: Multiple Sequential Operations

```bash
@test "AGG-REG-013: Multiple sequential registrations" {
  require_aggregator
  log_test "Testing multiple commitment submissions"

  declare -a request_ids
  local count=10

  # Register multiple commitments
  for i in $(seq 1 $count); do
    local secret="secret-seq-$i-$$"
    local state="state-$i-$(date +%s)-${RANDOM}"
    local txdata="txdata-$i-$(date +%s)-${RANDOM}"

    run_cli_with_secret "$secret" "register-request $secret \"$state\" \"$txdata\" --local"
    assert_success

    local request_id
    request_id=$(extract_request_id_from_console "$output")
    request_ids+=("$request_id")
  done

  # Verify all IDs are unique
  local unique_count
  unique_count=$(printf '%s\n' "${request_ids[@]}" | sort -u | wc -l)
  assert_equals "$count" "$unique_count" "All request IDs should be unique"

  # Verify all can be retrieved
  for req_id in "${request_ids[@]}"; do
    run_cli "get-request $req_id --local --json"
    assert_success

    local status_val
    status_val=$(extract_json_field ".status")
    assert_equals "INCLUSION" "$status_val"
  done
}
```

---

## Error Handling Scenarios

### Network Errors

```bash
@test "AGG-REG-021: Network error - aggregator down" {
  skip_if_external_disabled
  log_test "Testing aggregator unavailability handling"

  # Use invalid endpoint
  local secret=$(generate_test_secret "network")
  local state="test-state"
  local txdata="test-data"

  # Attempt registration with invalid endpoint
  run_cli_with_secret "$secret" "register-request $secret \"$state\" \"$txdata\" -e http://localhost:9999"

  # Should fail
  assert_failure

  # Error message should indicate connection issue
  assert_output_contains "connection" || assert_output_contains "refused" || assert_output_contains "unavailable"
}
```

### Malformed Inputs

```bash
@test "AGG-REG-008: Invalid request ID format" {
  require_aggregator
  log_test "Testing invalid request ID formats"

  # Test various invalid formats
  local invalid_ids=(
    "abc123"                    # Too short
    "xyz"                       # Non-hex
    ""                          # Empty
    "!@#$%"                    # Special chars
    "$(printf '%s' $(seq 1 100))"  # Too long
  )

  for invalid_id in "${invalid_ids[@]}"; do
    run_cli "get-request \"$invalid_id\" --local --json"

    # Should fail or return error
    if [[ $status -eq 0 ]]; then
      # If succeeds, should indicate error in response
      assert_output_contains "error" || assert_output_contains "invalid"
    else
      # Failure is acceptable
      assert_failure
    fi
  done
}
```

---

## Performance and Reliability Tests

### Stress Test

```bash
@test "AGG-REG-026: Stress test - 1000 registrations" {
  skip "Stress test - enable manually for performance testing"
  require_aggregator
  log_test "Stress testing with 1000 registrations"

  local count=1000
  local success_count=0

  for i in $(seq 1 $count); do
    local secret="stress-$i-$$"
    local state="state-$i"
    local txdata="data-$i"

    if run_cli_with_secret "$secret" "register-request $secret \"$state\" \"$txdata\" --local"; then
      ((success_count++))
    fi
  done

  # At least 99% success rate
  local min_success=$((count * 99 / 100))
  assert_greater_than "$success_count" "$min_success" "Success rate should be >= 99%"
}
```

### Concurrent Operations

```bash
@test "AGG-REG-015: Concurrent registration safety" {
  require_aggregator
  log_test "Testing concurrent registrations"

  local count=5
  declare -a pids
  declare -a temp_files

  # Launch parallel registrations
  for i in $(seq 1 $count); do
    local secret="concurrent-$i-$$"
    local state="state-$i-${RANDOM}"
    local txdata="data-$i"
    local temp_file=$(create_temp_file ".out")
    temp_files+=("$temp_file")

    # Launch in background
    (
      run_cli_with_secret "$secret" "register-request $secret \"$state\" \"$txdata\" --local" > "$temp_file" 2>&1
      echo $? > "$temp_file.status"
    ) &
    pids+=($!)
  done

  # Wait for all to complete
  for pid in "${pids[@]}"; do
    wait "$pid"
  done

  # Verify all succeeded
  local success_count=0
  for temp_file in "${temp_files[@]}"; do
    local status_code
    status_code=$(cat "$temp_file.status")
    if [[ "$status_code" -eq 0 ]]; then
      ((success_count++))
    fi
  done

  assert_equals "$count" "$success_count" "All concurrent registrations should succeed"
}
```

---

## Summary

This comprehensive test suite covers:

1. **35 detailed test scenarios** spanning all aspects of aggregator operations
2. **Output parsing strategies** for both console and JSON formats
3. **BATS implementation patterns** with reusable code
4. **Error handling** for network, input, and server errors
5. **Performance tests** for stress and concurrency
6. **Special character handling** for unicode, JSON, and edge cases
7. **Determinism verification** for request ID generation
8. **Security validation** for signatures and proofs

### Test Coverage Matrix

| Category | Scenarios | Priority |
|----------|-----------|----------|
| Basic Flow | AGG-REG-001 | P0 |
| Determinism | AGG-REG-002 to AGG-REG-005 | P0 |
| Proof Validation | AGG-REG-006, AGG-REG-019, AGG-REG-020 | P0 |
| Error Handling | AGG-REG-007, AGG-REG-008, AGG-REG-021 to AGG-REG-024 | P1 |
| Special Characters | AGG-REG-009 to AGG-REG-012 | P1 |
| Multiple Operations | AGG-REG-013 to AGG-REG-015 | P1 |
| Hash Validation | AGG-REG-016 to AGG-REG-018 | P2 |
| Advanced Features | AGG-REG-025 to AGG-REG-035 | P2 |

### Implementation Priority

**Phase 1 (P0):** Core functionality
- AGG-REG-001: Basic flow
- AGG-REG-002, AGG-REG-003: Determinism
- AGG-REG-006: Proof structure
- AGG-REG-007: Error handling

**Phase 2 (P1):** Comprehensive coverage
- Special characters (009-012)
- Multiple operations (013-015)
- Network errors (021-024)

**Phase 3 (P2):** Advanced validation
- Hash verification (016-018)
- Certificate validation (033-035)
- Performance tests (026)

---

**End of Document**
