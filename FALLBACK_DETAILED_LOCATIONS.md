# Detailed Fallback Pattern Locations
## Line-by-Line Reference for Developers

**Purpose:** Complete reference of every fallback pattern found in test suite
**Usage:** Use Ctrl+F to find specific files or patterns
**Last Updated:** 2025-11-13

---

## Helper Files - Critical Infrastructure

### 1. tests/helpers/common.bash

#### LINE 256-257: Output Capture Fallback ⚠️ CRITICAL
```bash
output=$(cat "$temp_stdout" 2>/dev/null || true)
stderr_output=$(cat "$temp_stderr" 2>/dev/null || true)
```
**Severity:** CRITICAL
**Impact:** Affects ALL 313 tests
**Issue:** Returns empty strings if file read fails
**Fix:** Remove `|| true`, let failures propagate

---

### 2. tests/helpers/assertions.bash

#### LINE 430: jq Field Extraction with || echo ⚠️ CRITICAL
```bash
actual=$(~/.local/bin/jq -r "$field | tostring" "$file" 2>/dev/null || echo "")
```
**Severity:** HIGH
**Function:** `assert_json_field_equals()`
**Issue:** jq failures return empty string instead of failing
**Fix:** Validate file first, let jq failure propagate

#### LINE 1064: Boolean Assignment with || echo
```bash
has_merkle_path=$(~/.local/bin/jq -e '.inclusionProof.merklePath' "$token_file" >/dev/null 2>&1 && echo "true" || echo "false")
```
**Severity:** LOW
**Function:** `assert_inclusion_proof_valid()`
**Issue:** Returns "false" on jq errors (file missing, invalid JSON)
**Status:** Acceptable - function validates file exists first (line 1050)

#### LINE 1067: Similar pattern
```bash
has_block_height=$(~/.local/bin/jq -e '.inclusionProof.blockHeight' "$token_file" >/dev/null 2>&1 && echo "true" || echo "false")
```
**Severity:** LOW
**Status:** Acceptable

#### LINE 1237: Transaction history check
```bash
has_history=$(~/.local/bin/jq -e '.transactionHistory' "$token_file" >/dev/null 2>&1 && echo "true" || echo "false")
```
**Severity:** LOW
**Status:** Acceptable

#### LINE 1421: BFT authenticator check
```bash
has_bft=$(~/.local/bin/jq -e '.inclusionProof.bftAuthenticator' "$token_file" >/dev/null 2>&1 && echo "true" || echo "false")
```
**Severity:** LOW
**Status:** Acceptable

---

### 3. tests/helpers/token-helpers.bash

#### LINE 57: Exit code capture
```bash
local exit_code=0
```
**Severity:** MEDIUM
**Context:** Used throughout file for exit code tracking
**Requires:** Audit to ensure all uses check exit_code afterward

#### LINE 59: Command output capture with exit code
```bash
cmd_output=$(SECRET="$secret" "${UNICITY_NODE_BIN:-node}" "$(get_cli_path)" "${cmd[@]}" 2>&1) || exit_code=$?
```
**Severity:** MEDIUM
**Function:** `generate_address()`
**Status:** SAFE - Lines 61-64 check exit_code and return it
**Pattern:** Proper exit code handling

#### LINE 152-156: Mint token exit code handling
```bash
local exit_code=0
if ! SECRET="$secret" run_cli "${cmd[@]}"; then
  exit_code=$?
  error "Failed to mint token (exit code: $exit_code)"
  return "$exit_code"
fi
```
**Severity:** LOW
**Status:** SAFE - Proper error handling

#### LINE 225-229: Similar pattern in mint_token_to_address
**Severity:** LOW
**Status:** SAFE

#### LINE 289-293: Send token offline
**Severity:** LOW
**Status:** SAFE

#### LINE 357-361: Send token immediate
**Severity:** LOW
**Status:** SAFE

#### LINE 434-443: Receive token with exit code
```bash
local exit_code=0
SECRET="$secret" run_cli "${cmd[@]}" || exit_code=$?

if [[ $exit_code -ne 0 ]]; then
  # Clean up auto-generated output file on failure
  if [[ $auto_generated_output -eq 1 ]] && [[ -f "$output_file" ]]; then
    rm -f "$output_file"
  fi
  error "Failed to receive token (exit code: $exit_code)"
  return "$exit_code"
fi
```
**Severity:** LOW
**Status:** SAFE - Proper error handling with cleanup

---

## Edge Case Tests

### 4. tests/edge-cases/test_concurrency.bats

#### LINES 65-71: Race-001 Success Counter ⚠️ CRITICAL
```bash
wait $pid1 || true
wait $pid2 || true

# Check results
local success_count=0
[[ -f "$file1" ]] && ((success_count++)) || true
[[ -f "$file2" ]] && ((success_count++)) || true
```
**Severity:** CRITICAL
**Test:** RACE-001 Concurrent token creation
**Issue:** Test always passes regardless of outcome
**Fix:** Track exit codes, assert files exist and are valid

#### LINES 131-137: Race-002 Pattern ⚠️ CRITICAL
```bash
wait $pid1 || true
wait $pid2 || true

# Check results
local created_count=0
[[ -f "$out1" ]] && ((created_count++)) || true
[[ -f "$out2" ]] && ((created_count++)) || true
```
**Severity:** CRITICAL
**Test:** RACE-002 Concurrent transfers
**Same Issue:** Identical pattern

#### LINES 192-193: Race-003 ⚠️ CRITICAL
```bash
wait $pid1 || true
wait $pid2 || true
```
**Severity:** CRITICAL
**Test:** RACE-003 File locking

#### LINES 278-286: Race-004 ⚠️ CRITICAL
```bash
wait $pid1 || true
wait $pid2 || true
wait $pid3 || true

# Check results
local success_count=0
[[ -f "${instance1}/token.txf" ]] && ((success_count++)) || true
[[ -f "${instance2}/token.txf" ]] && ((success_count++)) || true
[[ -f "${instance3}/token.txf" ]] && ((success_count++)) || true
```
**Severity:** CRITICAL
**Test:** RACE-004 with 3 parallel instances

#### LINES 341-347: Race-005 ⚠️ CRITICAL
```bash
wait $pid1 || true
wait $pid2 || true

# Check results
local success_count=0
[[ -f "$out1" ]] && ((success_count++)) || true
[[ -f "$out2" ]] && ((success_count++)) || true
```
**Severity:** CRITICAL
**Test:** RACE-005 Parallel test execution

---

### 5. tests/edge-cases/test_network_edge.bats

#### LINE 56: Assert with || true ⚠️ HIGH
```bash
assert_output_contains "connect\|ECONNREFUSED\|refused\|unreachable" || true
```
**Severity:** HIGH
**Test:** CORNER-026 Aggregator unavailable
**Issue:** Assertion failure is ignored, test always passes

#### LINE 82: Network timeout ⚠️ MEDIUM
```bash
" || true
```
**Context:** End of timeout command block
**Severity:** MEDIUM

#### LINE 131: DNS failure ⚠️ HIGH
```bash
assert_output_contains "ENOTFOUND\|getaddrinfo\|DNS\|resolve" || true
```
**Severity:** HIGH
**Test:** CORNER-030 DNS resolution failure

#### LINE 151: Similar pattern
```bash
" || true
```

#### LINE 181: Offline mode ⚠️ HIGH
```bash
assert_output_contains "Offline mode\|local\|skip" || true
```
**Severity:** HIGH

#### LINE 205: Connection refused ⚠️ HIGH
```bash
assert_output_contains "ECONNREFUSED\|refused\|connect" || true
```
**Severity:** HIGH
**Test:** CORNER-034 Connection refused

#### LINES 48-60: Conditional success acceptance ⚠️ MEDIUM
```bash
local exit_code=0
SECRET="$TEST_SECRET" run_cli mint-token \
  --preset nft \
  --endpoint "http://localhost:9999" \
  -o "$token_file" || exit_code=$?

# Should fail with connection error
if [[ $exit_code -ne 0 ]]; then
  assert_output_contains "connect\|ECONNREFUSED\|refused\|unreachable" || true
  info "✓ Connection failure handled"
else
  info "⚠ Unexpectedly succeeded with unavailable aggregator"
fi
```
**Severity:** MEDIUM
**Issue:** Test passes whether operation succeeds OR fails

#### Similar patterns at lines: 103-106, 123-130, 177-182, 197-206, 221-232, 234-245, 247-255

---

### 6. tests/edge-cases/test_double_spend_advanced.bats

#### LINES 75-80: Sequential double-spend ⚠️ CRITICAL
```bash
run receive_token "$CAROL_SECRET" "$transfer_to_carol" "$carol_token" || true

# Exactly one should have succeeded
local success_count=0
[[ -f "$bob_token" ]] && [[ $(jq 'has("offlineTransfer") | not' "$bob_token") == "true" ]] && ((success_count++)) || true
[[ -f "$carol_token" ]] && [[ $(jq 'has("offlineTransfer") | not' "$carol_token") == "true" ]] && ((success_count++)) || true
```
**Severity:** CRITICAL
**Test:** DBLSPEND-001
**Issue:** jq failures cause wrong success counting

#### LINES 130-131: Concurrent double-spend ⚠️ CRITICAL
```bash
wait $pid_bob || true
wait $pid_carol || true
```
**Severity:** CRITICAL
**Test:** DBLSPEND-002

#### LINE 189: Replay attack ⚠️ MEDIUM
```bash
run receive_token "$BOB_SECRET" "$replay_pkg" "$bob_token2" || true
```
**Severity:** MEDIUM
**Test:** DBLSPEND-004

#### LINE 235: Time-based attack ⚠️ MEDIUM
```bash
run receive_token "$CAROL_SECRET" "$tuesday_pkg" "$carol_token" || true
```
**Severity:** MEDIUM
**Test:** DBLSPEND-006

#### LINES 283-292: Multi-recipient ⚠️ CRITICAL
```bash
wait "$pid" || true
done

# Check results
for output in "${outputs[@]}"; do
  if [[ -f "$output" ]]; then
    tx_count=$(get_transaction_count "$output" 2>/dev/null || echo "0")
```
**Severity:** CRITICAL
**Issue:** get_transaction_count with || echo fallback

#### LINE 292: jq with || echo ⚠️ HIGH
```bash
tx_count=$(get_transaction_count "$output" 2>/dev/null || echo "0")
```
**Severity:** HIGH

#### LINE 338: Mitm attack ⚠️ MEDIUM
```bash
run receive_token "$attacker_secret" "$modified_pkg" "$attacker_token" || true
```

#### LINE 349: Legitimate recipient ⚠️ MEDIUM
```bash
run receive_token "$BOB_SECRET" "$transfer_pkg" "$bob_token" || true
```

#### LINES 392-398: Race condition loop ⚠️ CRITICAL
```bash
wait "$pid" || true
done

# Check created packages
local created_count=0
for pkg in "${packages[@]}"; do
  [[ -f "$pkg" ]] && ((created_count++)) || true
done
```

#### LINES 419-428: Receive race ⚠️ CRITICAL
```bash
wait "$pid" || true
done

# Check results - exactly one should succeed
local received_count=0
for result in "${results[@]}"; do
  if [[ -f "$result" ]]; then
    # Check if it's a successfully received token (no offlineTransfer)
    has_offline=$(jq 'has("offlineTransfer") | not' "$result" 2>/dev/null || echo "false")
```
**Severity:** CRITICAL
**Line 428:** jq with || echo "false" fallback

#### LINES 486-487: Network split simulation ⚠️ CRITICAL
```bash
wait $pid1 || true
wait $pid2 || true
```

#### LINE 540: Stale state ⚠️ MEDIUM
```bash
run send_token_immediate "$ALICE_SECRET" "$backup_file" "$carol_addr" "$stale_result" || true
```

---

### 7. tests/edge-cases/test_file_system.bats

#### LINE 53: Permission denied ⚠️ MEDIUM
```bash
local exit_code=0
SECRET="$TEST_SECRET" run_cli mint-token --preset nft -o "$token_file" || exit_code=$?
```
**Note:** Followed by proper exit code check (lines 56-59)
**Status:** SAFE

#### LINE 57: Assert with || true ⚠️ MEDIUM
```bash
assert_output_contains "Permission denied\|EACCES\|read-only\|EROFS" || true
```
**Severity:** MEDIUM

#### LINE 122: Long path ⚠️ MEDIUM
```bash
local exit_code=0
SECRET="$TEST_SECRET" run_cli mint-token --preset nft -o "$long_path" || exit_code=$?
```
**Status:** SAFE - checked at line 125

#### LINE 154: Special characters ⚠️ MEDIUM
```bash
SECRET="$TEST_SECRET" run_cli mint-token --preset nft -o "$file" || true
```

#### LINE 167: Path traversal ⚠️ MEDIUM
```bash
SECRET="$TEST_SECRET" run_cli mint-token --preset nft -o "$attack_file" || true
```

#### LINE 209: Auto-save ⚠️ MEDIUM
```bash
SECRET="$TEST_SECRET" run_cli mint-token --preset nft --save || true
```

#### LINE 221: CWD assumption ⚠️ MEDIUM
```bash
SECRET="$TEST_SECRET" run_cli mint-token --preset nft --save || true
```

#### LINE 262: Symlink ⚠️ MEDIUM
```bash
local exit_code=0
run_cli verify-token --file "$link_file" || exit_code=$?
```
**Status:** SAFE - checked at line 265

#### LINE 278: Symlink transfer ⚠️ MEDIUM
```bash
run send_token_offline "$TEST_SECRET" "$link_file" "$recipient" "$send_file" || true
```

#### LINE 291: Write through symlink ⚠️ MEDIUM
```bash
SECRET="$TEST_SECRET" run_cli mint-token --preset nft -o "$write_through_link" || true
```

---

### 8. tests/edge-cases/test_data_boundaries.bats

#### LINES 50-61: Empty secret ⚠️ MEDIUM
```bash
local exit_code=0
SECRET="" run_cli gen-address --preset nft || exit_code=$?
```
Then at line 61:
```bash
SECRET="" run_cli gen-address --preset nft || true
```
**Severity:** MEDIUM
**Issue:** Duplicate test with different handling

#### LINE 82: Whitespace secret ⚠️ MEDIUM
```bash
local exit_code=0
SECRET="     " run_cli gen-address --preset nft || exit_code=$?
```
**Status:** SAFE

#### LINE 92: Control characters ⚠️ MEDIUM
```bash
local exit_code=0
SECRET=$'\n\t  \n' run_cli gen-address --preset nft || exit_code=$?
```
**Status:** SAFE

#### LINE 137: Long secret generation ⚠️ MEDIUM
```bash
long_secret=$(python3 -c "print('A' * 10000000)" 2>/dev/null || echo "")
```
**Severity:** MEDIUM
**Issue:** Returns empty string if python fails

#### LINE 144: Long secret timeout ⚠️ MEDIUM
```bash
timeout 10s bash -c "SECRET='$long_secret' run_cli gen-address --preset nft" || true
```

#### LINE 154: Long data generation ⚠️ MEDIUM
```bash
long_data=$(python3 -c "print('x' * 1000000)" 2>/dev/null || echo "")
```

#### LINE 167: Long data timeout ⚠️ MEDIUM
```bash
timeout 30s bash -c "SECRET='$secret' run_cli mint-token --preset nft -d '$long_data' -o '$token_file'" || true
```

#### LINE 190: Null byte secret ⚠️ MEDIUM
```bash
local exit_code=0
SECRET="$secret_with_null" run_cli gen-address --preset nft || exit_code=$?
```
**Status:** SAFE

#### LINE 198: Binary data ⚠️ MEDIUM
```bash
local exit_code=0
SECRET="test" run_cli gen-address --preset nft || true
```

#### LINE 227: Zero amount ⚠️ MEDIUM
```bash
SECRET="$secret" run_cli mint-token --preset uct --coins "0" -o "$token_file" || true
```

#### LINE 262: Negative amount ⚠️ MEDIUM
```bash
SECRET="$secret" run_cli mint-token --preset uct --coins "-1" -o "$token_file" || true
```

#### LINE 275: Large negative ⚠️ MEDIUM
```bash
SECRET="$secret" run_cli mint-token --preset uct --coins "-9999999999999999999" -o "$token_file" || true
```

#### LINE 300: Huge amount ⚠️ MEDIUM
```bash
SECRET="$secret" run_cli mint-token --preset uct --coins "$huge_amount" -o "$token_file" || true
```

#### LINE 337: Odd-length hex ⚠️ MEDIUM
```bash
SECRET="$secret" run_cli mint-token --preset nft --token-type "$odd_hex" -o "$token_file" || true
```

#### LINES 378, 381: Case sensitivity ⚠️ MEDIUM
```bash
SECRET="$secret" run_cli mint-token --preset nft --token-type "$hex_lower" -o "$token_file1" || true
SECRET="$secret" run_cli mint-token --preset nft --token-type "$hex_mixed" -o "$token_file2" || true
```

#### LINE 414: Invalid hex ⚠️ MEDIUM
```bash
SECRET="$secret" run_cli mint-token --preset nft --token-type "$invalid_hex" -o "$token_file" || true
```

#### LINE 450: Empty data ⚠️ MEDIUM
```bash
SECRET="$secret" run_cli mint-token --preset nft -d "" -o "$token_file" || true
```

#### LINE 474: Missing data ⚠️ MEDIUM
```bash
SECRET="$secret" run_cli mint-token --preset nft -o "$token_file2" || true
```

---

### 9. tests/edge-cases/test_state_machine.bats

#### LINES 109-131: Invalid token ⚠️ MEDIUM
```bash
local exit_code=0
run_cli verify-token --file "$invalid_file" || exit_code=$?
...
run send_token_offline "$TEST_SECRET" "$invalid_file" "$recipient_addr" "$send_file" || true
```

#### LINES 175-181: Concurrent state updates ⚠️ CRITICAL
```bash
wait $pid1 || true
wait $pid2 || true

local created_count=0
[[ -f "$out1" ]] && ((created_count++)) || true
[[ -f "$out2" ]] && ((created_count++)) || true
```

#### LINES 252-253: Inconsistent token ⚠️ MEDIUM
```bash
local exit_code=0
run_cli verify-token --file "$inconsistent_file" || exit_code=$?
```
**Status:** SAFE

#### LINES 288-289: Invalid state hash ⚠️ MEDIUM
```bash
local exit_code=0
run_cli verify-token --file "$bad_file" || exit_code=$?
```
**Status:** SAFE

#### LINE 344: Double receive ⚠️ MEDIUM
```bash
run receive_token "$recipient_secret" "$received_file" "$received_again" || true
```

---

## Security Tests

### 10. tests/security/test_input_validation.bats

#### LINES 155-156: Path traversal ⚠️ MEDIUM
```bash
local exit_code=0
run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft -o ${traversal_path}" || exit_code=$?
```
**Status:** SAFE - checked afterward

#### LINE 164: Cleanup ⚠️ LOW
```bash
rm -f "${traversal_path}" 2>/dev/null || true
```
**Status:** ACCEPTABLE - cleanup

#### LINES 172-173: Absolute path ⚠️ MEDIUM
```bash
local exit_code=0
run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft -o ${absolute_path}" || exit_code=$?
```
**Status:** SAFE

#### LINES 228-229: Command injection ⚠️ MEDIUM
```bash
local exit_code=0
run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft -d '${cmd_in_data}' -o ${TEST_TEMP_DIR}/safe.txf" || exit_code=$?
```
**Status:** SAFE

#### LINES 239-240: Similar ⚠️ MEDIUM
**Status:** SAFE

#### LINES 269-271: Buffer overflow ⚠️ MEDIUM
```bash
local exit_code=0
run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset uct -c ${huge_amount} -o ${token_file}" || exit_code=$?
```
**Status:** SAFE

#### LINES 308-309: Zero value ⚠️ MEDIUM
**Status:** SAFE

#### LINE 380: OR-chain assertion ⚠️ MEDIUM
```bash
assert_output_contains "address" || assert_output_contains "invalid"
```
**Severity:** MEDIUM

#### LINES 424-425: Null bytes ⚠️ MEDIUM
**Status:** SAFE

#### LINES 445-446: Unicode ⚠️ MEDIUM
**Status:** SAFE

#### LINES 470-471: Boundary data ⚠️ MEDIUM
**Status:** SAFE

---

### 11. tests/security/test_double_spend.bats

#### LINE 167: Wait without check ⚠️ MEDIUM
```bash
wait "$pid" || true
```

#### LINES 392-401: Transfer outdated ⚠️ MEDIUM
```bash
local exit_code=0
run_cli_with_secret "${BOB_SECRET}" "send-token -f ${bob_token} -r ${dave_address} -o ${transfer_to_dave}" || exit_code=$?
...
assert_output_contains "spent" || assert_output_contains "outdated" || assert_output_contains "invalid"
```
**Line 401:** OR-chain assertion

---

### 12. tests/security/test_authentication.bats

#### LINE 201: OR-chain ⚠️ MEDIUM
```bash
assert_output_contains "Major type mismatch" || assert_output_contains "Failed to decode"
```

#### LINES 361-362: Nonce reuse ⚠️ MEDIUM
```bash
local exit_code=0
run_cli_with_secret "${BOB_SECRET}" "receive-token -f ${transfer2} --nonce ${bob_nonce} -o ${TEST_TEMP_DIR}/bob-token2.txf" || exit_code=$?
```
**Status:** SAFE

---

### 13. tests/security/test_recipientDataHash_tampering.bats

#### LINES 100, 150, 188, 226, 279: OR-chain assertions ⚠️ MEDIUM
```bash
assert_output_contains "hash" || assert_output_contains "mismatch" || assert_output_contains "invalid"
```
**Severity:** MEDIUM
**Count:** 5 instances

---

### 14. tests/security/test_data_integrity.bats

#### LINE 61: Corruption simulation ⚠️ LOW
```bash
dd if=/dev/urandom of="${corrupted}" bs=1 count=10 seek=100 conv=notrunc 2>/dev/null || true
```
**Status:** ACCEPTABLE - test setup

#### LINES 304-305, 320-321, 335-336: Exit code patterns ⚠️ MEDIUM
```bash
local exit_code=0
run_cli "verify-token -f ${wrong_status}" || exit_code=$?
```
**Status:** SAFE - checked afterward

---

### 15. tests/security/test_access_control.bats

#### LINE 104: Permission check ⚠️ LOW
```bash
local perms=$(stat -c "%a" "${alice_token}" 2>/dev/null || stat -f "%A" "${alice_token}" 2>/dev/null || echo "unknown")
```
**Status:** ACCEPTABLE - cross-platform fallback

#### LINE 225: Fake trustbase ⚠️ MEDIUM
```bash
TRUSTBASE_PATH="${fake_trustbase}" run_cli_with_secret "${ALICE_SECRET}" "gen-address --preset nft" || true
```

#### LINES 251-252: Environment isolation ⚠️ MEDIUM
```bash
local exit_code=0
run_cli_with_secret "${TEST_SECRET}" "mint-token --preset nft -o ${TEST_TEMP_DIR}/secret-test.txf" || exit_code=$?
```
**Status:** SAFE

---

## Functional Tests

### 16. tests/functional/test_receive_token.bats

#### LINE 163: OR-chain ⚠️ MEDIUM
```bash
assert_output_contains "address" || assert_output_contains "mismatch" || assert_output_contains "recipient"
```

#### LINE 191: Duplicate receive ⚠️ MEDIUM
```bash
receive_token "${BOB_SECRET}" "transfer.txf" "received2.txf" || true
```

#### LINE 393: OR-chain ⚠️ MEDIUM
```bash
assert_output_contains "hash" || assert_output_contains "mismatch" || assert_output_contains "does not match"
```

#### LINE 433: OR-chain ⚠️ MEDIUM
```bash
assert_output_contains "state-data" || assert_output_contains "REQUIRED" || assert_output_contains "required"
```

---

### 17. tests/functional/test_verify_token.bats

#### LINES 34, 37, 63, 145, 160, 264: OR-chain assertions ⚠️ LOW
```bash
assert_output_contains "valid" || assert_output_contains "✅" || assert_output_contains "success"
```
**Severity:** LOW
**Reason:** These are checking for positive validation messages
**Status:** REVIEW - May be acceptable if any form of success is valid

---

### 18. tests/functional/test_mint_token.bats

#### LINE 501: Negative amount ⚠️ MEDIUM
```bash
run_cli_with_secret "${SECRET}" "mint-token --preset uct -c '${negative_amount}' --local -o token.txf" || true
```

---

### 19. tests/functional/test_aggregator_operations.bats

#### LINES 159-164: Not found handling ⚠️ MEDIUM
```bash
run_cli "get-request ${fake_request_id} --local --json" || true
...
[[ "$output" == *"NOT_FOUND"* ]] || [[ "$output" == *"not found"* ]] || true
```

---

## Summary by Severity

### CRITICAL (20 instances)
- common.bash output capture: 2
- test_concurrency.bats success counters: 10
- test_double_spend_advanced.bats jq fallbacks: 8

### HIGH (11 instances)
- test_network_edge.bats assertions: 6
- assertions.bash jq extraction: 1
- test_double_spend_advanced.bats patterns: 4

### MEDIUM (54 instances)
- OR-chain assertions: 24
- File system tests: 8
- Data boundary tests: 15
- Network conditional success: 7

### LOW (12 instances)
- System detection fallbacks: 3
- Cleanup operations: 4
- Informational checks: 5

**TOTAL: 97 patterns requiring review or fix**
