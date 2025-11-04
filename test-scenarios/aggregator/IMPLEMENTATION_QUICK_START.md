# Quick Start Guide: Implementing Aggregator Tests

**Purpose:** Rapid implementation reference for writing BATS tests for `register-request` and `get-request` commands

---

## Table of Contents

1. [Setup](#setup)
2. [Basic Test Template](#basic-test-template)
3. [Common Test Patterns](#common-test-patterns)
4. [Output Parsing Examples](#output-parsing-examples)
5. [Troubleshooting](#troubleshooting)

---

## Setup

### Load Required Helpers

```bash
#!/usr/bin/env bats

load '../helpers/common'
load '../helpers/assertions'
load '../helpers/aggregator-parsing'

setup() {
    setup_common
    SECRET=$(generate_test_secret "agg")
    TEST_STATE="test-state-$(date +%s)-$$"
    TEST_TX_DATA="test-tx-data-$(date +%s)-$$"
}

teardown() {
    teardown_common
}
```

---

## Basic Test Template

### Template 1: Registration + Retrieval Flow

```bash
@test "AGG-XXX: Test description" {
  require_aggregator
  log_test "Detailed test description"

  # STEP 1: Register commitment
  run_cli_with_secret "$SECRET" "register-request $SECRET \"$TEST_STATE\" \"$TEST_TX_DATA\" --local"
  assert_success

  # STEP 2: Verify registration succeeded
  assert_output_contains "✅ Commitment successfully registered"

  # STEP 3: Extract request ID from console output
  local request_id
  request_id=$(extract_request_id_from_console "$output")
  assert_set request_id
  is_valid_hex "$request_id" 64

  # STEP 4: Retrieve commitment
  run_cli "get-request $request_id --local --json"
  assert_success

  # STEP 5: Validate JSON response
  assert_valid_json "$output"

  # STEP 6: Verify status is INCLUSION
  local status
  status=$(extract_status_from_json "$output")
  assert_equals "INCLUSION" "$status"

  # STEP 7: Verify request ID matches
  local retrieved_id
  retrieved_id=$(extract_request_id_from_json "$output")
  assert_equals "$request_id" "$retrieved_id"
}
```

### Template 2: Determinism Test

```bash
@test "AGG-XXX: Request ID determinism test" {
  require_aggregator
  log_test "Verifying deterministic request ID generation"

  # Register first time
  run_cli_with_secret "$SECRET" "register-request $SECRET \"$TEST_STATE\" \"$TEST_TX_DATA\" --local"
  assert_success
  local request_id_1
  request_id_1=$(extract_request_id_from_console "$output")

  # Register second time with SAME inputs
  run_cli_with_secret "$SECRET" "register-request $SECRET \"$TEST_STATE\" \"$TEST_TX_DATA\" --local"
  assert_success
  local request_id_2
  request_id_2=$(extract_request_id_from_console "$output")

  # Verify IDs are IDENTICAL
  assert_equals "$request_id_1" "$request_id_2" "Request IDs should be deterministic"
}
```

### Template 3: Error Handling Test

```bash
@test "AGG-XXX: Error handling test" {
  require_aggregator
  log_test "Testing error scenario"

  # Use invalid input
  local fake_request_id="ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

  # Attempt retrieval
  run_cli "get-request $fake_request_id --local --json"

  # Accept either success with NOT_FOUND or failure
  if [[ $status -eq 0 ]]; then
    # Success - verify NOT_FOUND status
    local status_value
    status_value=$(extract_status_from_json "$output")
    assert_equals "NOT_FOUND" "$status_value"

    # Proof should be null
    if ! has_proof_in_json "$output"; then
      # No proof - expected
      return 0
    fi
  else
    # Failure is also acceptable
    assert_failure
  fi
}
```

---

## Common Test Patterns

### Pattern 1: Extract All Values from Registration

```bash
# Register and extract all values at once
run_cli_with_secret "$SECRET" "register-request $SECRET \"$TEST_STATE\" \"$TEST_TX_DATA\" --local"
assert_success

# Method 1: Extract individually
local request_id=$(extract_request_id_from_console "$output")
local state_hash=$(extract_state_hash_from_console "$output")
local tx_hash=$(extract_transaction_hash_from_console "$output")
local pubkey=$(extract_public_key_from_console "$output")

# Method 2: Extract all at once (sets global variables)
extract_all_hashes_from_console "$output"
# Now available: $REQUEST_ID, $STATE_HASH, $TX_HASH, $PUBLIC_KEY
```

### Pattern 2: Validate Registration Success

```bash
run_cli_with_secret "$SECRET" "register-request $SECRET \"$TEST_STATE\" \"$TEST_TX_DATA\" --local"
assert_success

# Check success indicator
if ! check_registration_success "$output"; then
  fail "Registration did not succeed"
fi

# Check authenticator verification
if ! check_authenticator_verified "$output"; then
  fail "Authenticator verification failed"
fi
```

### Pattern 3: Validate Inclusion Proof Structure

```bash
# Retrieve with JSON output
run_cli "get-request $request_id --local --json"
assert_success

# Quick validation
if ! validate_inclusion_proof_json "$output"; then
  fail "Inclusion proof structure is invalid"
fi

# Detailed validation
assert_inclusion_proof_present "$output"
assert_authenticator_present "$output"

# Extract and validate components
local authenticator=$(extract_authenticator_from_json "$output")
assert_not_equals "null" "$authenticator"

local merkle_path=$(extract_merkle_path_from_json "$output")
assert_not_equals "null" "$merkle_path"

local certificate=$(extract_certificate_from_json "$output")
assert_not_equals "null" "$certificate"
```

### Pattern 4: Compare Request IDs (Uniqueness)

```bash
# Register two different commitments
run_cli_with_secret "$SECRET1" "register-request $SECRET1 \"$STATE1\" \"$DATA1\" --local"
local id1=$(extract_request_id_from_console "$output")

run_cli_with_secret "$SECRET2" "register-request $SECRET2 \"$STATE2\" \"$DATA2\" --local"
local id2=$(extract_request_id_from_console "$output")

# Verify uniqueness
assert_not_equals "$id1" "$id2" "Different inputs should produce different request IDs"
```

### Pattern 5: Hash Verification

```bash
# Register commitment
run_cli_with_secret "$SECRET" "register-request $SECRET \"$TEST_STATE\" \"$TEST_TX_DATA\" --local"
assert_success

# Extract state hash
local state_hash=$(extract_state_hash_from_console "$output")

# Verify hash computation
if ! verify_state_hash "$state_hash" "$TEST_STATE"; then
  fail "State hash verification failed"
fi

# Extract transaction hash
local tx_hash=$(extract_transaction_hash_from_console "$output")

# Verify transaction hash
if ! verify_transaction_hash "$tx_hash" "$TEST_TX_DATA"; then
  fail "Transaction hash verification failed"
fi
```

### Pattern 6: Multiple Sequential Registrations

```bash
declare -a request_ids
local count=10

# Register multiple commitments
for i in $(seq 1 $count); do
  local secret="secret-$i-$$"
  local state="state-$i-${RANDOM}"
  local txdata="txdata-$i-${RANDOM}"

  run_cli_with_secret "$secret" "register-request $secret \"$state\" \"$txdata\" --local"
  assert_success

  local req_id=$(extract_request_id_from_console "$output")
  request_ids+=("$req_id")
done

# Verify all IDs are unique
local unique_count=$(printf '%s\n' "${request_ids[@]}" | sort -u | wc -l)
assert_equals "$count" "$unique_count" "All request IDs should be unique"

# Verify all can be retrieved
for req_id in "${request_ids[@]}"; do
  run_cli "get-request $req_id --local --json"
  assert_success

  local status=$(extract_status_from_json "$output")
  assert_equals "INCLUSION" "$status"
done
```

### Pattern 7: Special Characters Test

```bash
# Test with unicode
local special_state='{"name":"François","emoji":"🎉🚀"}'

run_cli_with_secret "$SECRET" "register-request $SECRET '$special_state' \"$TEST_TX_DATA\" --local"
assert_success

local request_id=$(extract_request_id_from_console "$output")
assert_set request_id
is_valid_hex "$request_id" 64

# Verify retrieval works
run_cli "get-request $request_id --local --json"
assert_success
```

### Pattern 8: Save Outputs for Debugging

```bash
# Register commitment
run_cli_with_secret "$SECRET" "register-request $SECRET \"$TEST_STATE\" \"$TEST_TX_DATA\" --local"
assert_success

# Save registration output
save_output_artifact "register-output.txt" "$output"

# Extract request ID
local request_id=$(extract_request_id_from_console "$output")

# Retrieve commitment
run_cli "get-request $request_id --local --json"
assert_success

# Save retrieval output
save_output_artifact "get-request-response.json" "$output"

# Artifacts will be preserved in TEST_ARTIFACTS_DIR
# Especially useful if test fails
```

---

## Output Parsing Examples

### Example 1: Parse `register-request` Console Output

**Input:**
```
Creating commitment at generic abstraction level...

Public Key: 03a1b2c3d4e5f6789...
State Hash: 7f8e9d0c1b2a3d4e5f6789...
Transaction Hash: 4f5e6d7c8b9a0d1e2f3a4b...
Request ID: 9a0b1c2d3e4f5a6b7c8d9e...

✅ Commitment successfully registered
```

**Parsing:**
```bash
request_id=$(extract_request_id_from_console "$output")
# Result: "9a0b1c2d3e4f5a6b7c8d9e..."

state_hash=$(extract_state_hash_from_console "$output")
# Result: "7f8e9d0c1b2a3d4e5f6789..."

if check_registration_success "$output"; then
  echo "Success!"
fi
```

### Example 2: Parse `get-request --json` Output

**Input:**
```json
{
  "status": "INCLUSION",
  "requestId": "9a0b1c2d...",
  "endpoint": "http://127.0.0.1:3000",
  "proof": {
    "requestId": "9a0b1c2d...",
    "transactionHash": "4f5e6d7c...",
    "authenticator": {
      "publicKey": "03a1b2c3...",
      "signature": "a1b2c3d4..."
    }
  }
}
```

**Parsing:**
```bash
status=$(extract_status_from_json "$output")
# Result: "INCLUSION"

request_id=$(extract_request_id_from_json "$output")
# Result: "9a0b1c2d..."

if validate_inclusion_proof_json "$output"; then
  echo "Valid proof structure"
fi

if has_proof_in_json "$output"; then
  echo "Proof exists"
fi
```

### Example 3: Parse `get-request` Text Output

**Input:**
```
=== Fetching Inclusion Proof ===
Endpoint: http://127.0.0.1:3000
Request ID: 9a0b1c2d...

STATUS: INCLUSION PROOF

=== Verification Summary ===
✅ Authenticator Signature: VERIFIED
✅ ALL CHECKS PASSED
```

**Parsing:**
```bash
status=$(extract_status_from_text "$output")
# Result: "INCLUSION"

if check_verification_passed_text "$output"; then
  echo "Verification passed"
fi
```

---

## Troubleshooting

### Issue: Request ID Not Extracted

**Problem:**
```bash
request_id=$(extract_request_id_from_console "$output")
# $request_id is empty
```

**Solutions:**

1. **Check output format:**
```bash
echo "$output" >&2  # Print to stderr for debugging
```

2. **Verify command succeeded:**
```bash
assert_success  # Add before extraction
```

3. **Check for errors in output:**
```bash
if check_registration_failed "$output"; then
  echo "Registration failed" >&2
  echo "$output" >&2
fi
```

4. **Manual extraction:**
```bash
# Debug: Show lines containing "Request ID"
echo "$output" | grep "Request ID" >&2

# Manual extraction with sed
request_id=$(echo "$output" | grep "Request ID:" | sed -E 's/.*Request ID: ([0-9a-fA-F]+).*/\1/')
```

---

### Issue: JSON Parsing Fails

**Problem:**
```bash
status=$(extract_status_from_json "$output")
# jq parse error
```

**Solutions:**

1. **Validate JSON first:**
```bash
assert_valid_json "$output"
```

2. **Check jq is installed:**
```bash
if ! command -v jq >/dev/null 2>&1; then
  skip "jq not found"
fi
```

3. **Debug JSON structure:**
```bash
echo "$output" | jq . >&2  # Pretty-print JSON
```

4. **Save JSON to file:**
```bash
echo "$output" > debug.json
jq . debug.json  # Validate
```

---

### Issue: Aggregator Not Available

**Problem:**
```bash
require_aggregator
# Test fails with "aggregator not available"
```

**Solutions:**

1. **Check aggregator is running:**
```bash
curl http://127.0.0.1:3000/health
```

2. **Start aggregator:**
```bash
# In separate terminal:
npm run aggregator:local
```

3. **Use correct port:**
```bash
# Check if using port 3000 or 3001
grep "local" src/commands/register-request.ts
```

4. **Skip if aggregator unavailable (for CI):**
```bash
setup() {
  setup_common
  if [[ "${UNICITY_TEST_SKIP_EXTERNAL:-0}" == "1" ]]; then
    skip "External services disabled"
  fi
}
```

---

### Issue: Hash Verification Fails

**Problem:**
```bash
verify_state_hash "$state_hash" "$TEST_STATE"
# Verification fails
```

**Solutions:**

1. **Check hash computation:**
```bash
expected=$(compute_sha256 "$TEST_STATE")
echo "Expected: $expected" >&2
echo "Actual: $state_hash" >&2
```

2. **Check for extra whitespace:**
```bash
# Trim whitespace
state_hash=$(echo "$state_hash" | tr -d '[:space:]')
```

3. **Verify input data:**
```bash
echo "State data: $TEST_STATE" >&2
echo -n "$TEST_STATE" | sha256sum
```

---

### Issue: Tests Pass Locally But Fail in CI

**Problem:**
Tests work on local machine but fail in CI pipeline

**Solutions:**

1. **Check aggregator availability:**
```bash
@test "Verify aggregator is available" {
  require_aggregator
  run_cli "get-request ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff --local --json"
  # Should not crash
}
```

2. **Add retries for timing issues:**
```bash
# Retry registration up to 3 times
local retries=3
for i in $(seq 1 $retries); do
  if run_cli_with_secret "$SECRET" "register-request $SECRET \"$STATE\" \"$DATA\" --local"; then
    break
  fi
  sleep 2
done
```

3. **Use longer timeouts:**
```bash
export UNICITY_CLI_TIMEOUT=60  # Increase from default 30
```

4. **Check for port conflicts:**
```bash
# Use unique ports in CI
if [[ -n "${CI:-}" ]]; then
  export AGGREGATOR_PORT=3000
else
  export AGGREGATOR_PORT=3000
fi
```

---

### Issue: Special Characters Not Handled

**Problem:**
```bash
state='{"name":"François"}'
# Parsing fails
```

**Solutions:**

1. **Use single quotes:**
```bash
run_cli_with_secret "$SECRET" "register-request $SECRET '$state' \"$txdata\" --local"
```

2. **Escape properly:**
```bash
state="{\"name\":\"François\"}"
```

3. **Use heredoc for complex data:**
```bash
state=$(cat <<'EOF'
{"name":"François","data":"🎉"}
EOF
)
```

---

### Debugging Tips

1. **Enable debug mode:**
```bash
export UNICITY_TEST_DEBUG=1
bats tests/functional/test_aggregator_operations.bats
```

2. **Enable verbose assertions:**
```bash
export UNICITY_TEST_VERBOSE_ASSERTIONS=1
```

3. **Keep temp files:**
```bash
export UNICITY_TEST_KEEP_TMP=1
# Temp files preserved in /tmp/bats-test-*/
```

4. **Run single test:**
```bash
bats tests/functional/test_aggregator_operations.bats --filter "AGG-001"
```

5. **Save all outputs:**
```bash
@test "My test" {
  # ... test code ...

  # Always save outputs for debugging
  save_output_artifact "register.txt" "$register_output"
  save_output_artifact "get.json" "$get_output"
}
```

---

## Complete Working Example

Here's a complete, working test file:

```bash
#!/usr/bin/env bats
# Complete example: test_aggregator_example.bats

load '../helpers/common'
load '../helpers/assertions'
load '../helpers/aggregator-parsing'

setup() {
    setup_common
    SECRET=$(generate_test_secret "example")
    TEST_STATE="test-state-$(date +%s)-$$"
    TEST_TX_DATA="test-tx-data-$(date +%s)-$$"
}

teardown() {
    teardown_common
}

@test "EXAMPLE-001: Complete registration and retrieval flow" {
  require_aggregator
  log_test "Full end-to-end test with all validations"

  # Step 1: Register commitment
  run_cli_with_secret "$SECRET" "register-request $SECRET \"$TEST_STATE\" \"$TEST_TX_DATA\" --local"
  assert_success
  save_output_artifact "register-console.txt" "$output"

  # Step 2: Validate registration
  assert_output_contains "✅ Commitment successfully registered"
  if ! check_authenticator_verified "$output"; then
    fail "Authenticator verification failed"
  fi

  # Step 3: Extract all values
  extract_all_hashes_from_console "$output"
  assert_set REQUEST_ID
  assert_set STATE_HASH
  assert_set TX_HASH
  assert_set PUBLIC_KEY

  # Step 4: Validate formats
  is_valid_hex "$REQUEST_ID" 64
  is_valid_hex "$STATE_HASH" 64
  is_valid_hex "$TX_HASH" 64

  # Step 5: Verify hash computation
  if ! verify_state_hash "$STATE_HASH" "$TEST_STATE"; then
    fail "State hash verification failed"
  fi
  if ! verify_transaction_hash "$TX_HASH" "$TEST_TX_DATA"; then
    fail "Transaction hash verification failed"
  fi

  # Step 6: Retrieve commitment
  run_cli "get-request $REQUEST_ID --local --json"
  assert_success
  save_output_artifact "get-response.json" "$output"

  # Step 7: Validate JSON structure
  assert_valid_json "$output"
  if ! validate_inclusion_proof_json "$output"; then
    fail "Inclusion proof structure invalid"
  fi

  # Step 8: Verify status
  local status=$(extract_status_from_json "$output")
  assert_equals "INCLUSION" "$status"

  # Step 9: Verify request ID matches
  local retrieved_id=$(extract_request_id_from_json "$output")
  assert_equals "$REQUEST_ID" "$retrieved_id"

  # Step 10: Verify proof components
  assert_inclusion_proof_present "$output"
  assert_authenticator_present "$output"

  # Success!
  if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
    echo "✅ All validations passed" >&2
  fi
}
```

---

**End of Quick Start Guide**
