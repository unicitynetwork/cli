# Mint-Token Test Failures - Quick Reference

## Overview
All 28 mint-token tests fail with **timeout (exit code 124)** at the same point while waiting for the BFT authenticator to be populated in the inclusion proof.

---

## Failure Categories

### CATEGORY A: Aggregator Authenticator Missing (BLOCKING)
**Severity:** CRITICAL - Blocks all 28 tests
**Trigger Point:** Step 6 in mint-token command (~30 seconds into test)

#### Details
- **Root Cause:** Local aggregator not populating `authenticator` field in inclusion proof response
- **Expected:** `proof.authenticator` contains BFT consensus signatures
- **Actual:** `proof.authenticator` is `null` or `undefined`
- **Result:** Command polls for 300 seconds, BATS kills at 30 seconds with exit code 124

#### Affected Code
```
File: src/commands/mint-token.ts
Lines: 236-244
Function: waitForInclusionProof()
```

```typescript
if (proofJson.authenticator !== null && proofJson.authenticator !== undefined) {
  console.error('Authenticator populated - proof complete');
  return proof;
} else {
  if (proofReceived) {
    console.error('Waiting for authenticator to be populated...');  // ← LOOPS HERE
  }
}
```

#### Evidence
All test output shows:
```
Step 6: Waiting for inclusion proof...
Inclusion proof received
Waiting for authenticator to be populated...
Waiting for authenticator to be populated...
[... 30+ iterations ...]
[TIMEOUT]
```

#### What Tests Fail
- MINT_TOKEN-001 through MINT_TOKEN-028 (all 28 tests)

#### Failed Assertions
- `assert_success` (line 26, 66, 88, 102, etc. in test_mint_token.bats)
- `assert_token_fully_valid` (would fail if reached, since verify-token needs authenticator)
- `verify_token_cryptographically` (assertions.bash:636)

#### Required Fix
Update or configure the local aggregator to include BFT authenticator in proof responses

---

### CATEGORY B: JSON Type Mismatch - Version Field (HIDDEN)
**Severity:** HIGH - Will fail after Category A is fixed
**Trigger Point:** Line 36 in test_mint_token.bats (assertion)

#### Details
- **Root Cause:** String vs numeric comparison of JSON version field
- **Location:** Multiple tests at line 36
- **Helper Function:** `assert_json_field_equals` (assertions.bash:240-267)
- **Issue:** jq with `-r` flag converts numbers to strings; comparison may fail

#### Affected Code
```bash
File: tests/functional/test_mint_token.bats
Line: 36
Code: assert_json_field_equals "token.txf" "version" "2.0"
```

```bash
File: tests/helpers/assertions.bash
Lines: 240-267
Function: assert_json_field_equals()
Code:
  actual=$(~/.local/bin/jq -r "$field" "$file")
  if [[ "$actual" != "$expected" ]]; then
    # STRING COMPARISON FAILS if actual="2" and expected="2.0"
  fi
```

#### Problematic Comparisons
All these tests at their line 36 assertions:
- MINT_TOKEN-001 (test_mint_token.bats:36)
- MINT_TOKEN-013 (test_mint_token.bats:266) - no version check
- MINT_TOKEN-020 (test_mint_token.bats:391) - no version check

#### What Would Fail
- Any test that checks version field with `assert_json_field_equals`

#### Required Fix
Use numeric comparison or ensure type consistency:
```bash
# Option 1: Use jq numeric comparison
if ! jq -e '.version == 2.0' "$file" >/dev/null 2>&1; then
  # fail
fi

# Option 2: Compare as string using jq
version=$(jq -r '.version' "$file")
assert_equals "2.0" "$version"
```

---

### CATEGORY C: Timeout Mismatch (SECONDARY)
**Severity:** MEDIUM - Exacerbates Category A
**Trigger Point:** Test harness timeout configuration

#### Details
- **BATS Timeout:** 30 seconds (default, from common.bash:211)
- **Command Timeout:** 300 seconds (hardcoded in mint-token.ts:200)
- **Mismatch:** 30s < 300s → BATS kills process before command times out

#### Affected Code
```bash
File: tests/helpers/common.bash
Line: 211
Code: timeout_cmd="timeout ${UNICITY_CLI_TIMEOUT:-30}"
```

```typescript
File: src/commands/mint-token.ts
Line: 200
Code: const timeoutMs = 300000;  // 300 seconds
```

#### Impact
- Process killed with exit code 124 (timeout signal) at 30 seconds
- Misleading error message (appears to be command failure, not timeout)
- Prevents full 300-second timeout from being reached

#### Required Fix
Increase BATS timeout to accommodate command timeout:
```bash
# Change from:
timeout_cmd="timeout ${UNICITY_CLI_TIMEOUT:-30}"

# To:
timeout_cmd="timeout ${UNICITY_CLI_TIMEOUT:-320}"  # 300s + 20s buffer
```

---

### CATEGORY D: Numeric Field Comparisons (HIDDEN)
**Severity:** LOW - Will fail after Category A is fixed
**Trigger Point:** Lines 49-50, 113-114, 129-130, etc.

#### Details
- **Root Cause:** Inconsistent handling of numeric vs string comparison
- **Location:** Multiple assertions using `get_transaction_count` and `get_coin_count`
- **Risk:** May pass or fail depending on bash/jq version

#### Affected Code
```bash
File: tests/functional/test_mint_token.bats
Lines: 49-50 (MINT_TOKEN-001)
  tx_count=$(get_transaction_count "token.txf")
  assert_equals "0" "${tx_count}"

Lines: 113-114 (MINT_TOKEN-004)
  coin_count=$(get_coin_count "token.txf")
  assert_equals "1" "${coin_count}"

Lines: 129-130 (MINT_TOKEN-005)
  coin_count=$(get_coin_count "token.txf")
  assert_equals "1" "${coin_count}"
```

```bash
File: tests/helpers/token-helpers.bash
Lines: 470-473
Function: get_transaction_count()
  jq '.transactions | length' "$token_file"  # Returns: 0 (number)

Lines: 510-513
Function: get_coin_count()
  jq '.genesis.data.coinData | length'  # Returns: 0 (number)
```

#### Affected Tests
- MINT_TOKEN-001 (line 49-50)
- MINT_TOKEN-004, 005 (lines 113-114, 129-130)
- MINT_TOKEN-019, 027 (lines 354-356, 527-531)

#### What Would Fail
- Assertion would fail if numeric 0 doesn't match string "0" in comparison

#### Required Fix
Ensure consistent string format:
```bash
# Option 1: Ensure output is string
tx_count=$(get_transaction_count "token.txf" | jq -r .)
assert_equals "0" "${tx_count}"

# Option 2: Compare as numbers
local tx_count_num
tx_count_num=$(get_transaction_count "token.txf")
[[ "$tx_count_num" -eq 0 ]] || return 1
```

---

## Summary Table

| Category | Severity | Tests Affected | Fix Location | Fix Type |
|----------|----------|---|---|---|
| A: Missing Authenticator | CRITICAL | All 28 | Aggregator config | Infrastructure |
| B: Version Type Mismatch | HIGH | ~15 | test_mint_token.bats:36 | Test assertion |
| C: Timeout Mismatch | MEDIUM | All 28 | common.bash:211 | Config |
| D: Numeric Comparisons | LOW | ~8 | test_mint_token.bats:49+, assertions.bash | Test helpers |

---

## Fix Priority

### MUST FIX (Blocking Tests)
1. **Category A:** Update aggregator to populate authenticator field
2. **Category C:** Increase BATS timeout to 320 seconds

### SHOULD FIX (Before Next Test Run)
3. **Category B:** Fix version field comparison logic
4. **Category D:** Standardize numeric field comparisons

---

## Verification Steps After Fixes

```bash
# 1. Verify aggregator is running with correct version
docker ps | grep aggregator
docker logs <container-name> | grep authenticator

# 2. Verify trust-base.json exists
ls -la ./config/trust-base.json

# 3. Query aggregator directly
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"state_getInclusionProof","params":["REQUEST_ID"],"id":1}' \
  | jq '.result.authenticator'
  # Should return authenticator data, not null

# 4. Run single test with debug
UNICITY_TEST_DEBUG=1 UNICITY_TEST_VERBOSE_ASSERTIONS=1 bats tests/functional/test_mint_token.bats --filter "MINT_TOKEN-001"

# 5. Run all tests
npm test:quick  # Quick smoke test
npm test:functional  # Full functional tests
```

---

## Line-by-Line Issue Reference

### Test File: test_mint_token.bats

| Line | Test | Issue | Category |
|------|------|-------|----------|
| 25 | MINT_TOKEN-001 | Timeout waiting for authenticator | A |
| 36 | MINT_TOKEN-001 | Version string comparison | B |
| 49-50 | MINT_TOKEN-001 | Numeric transaction count | D |
| 65 | MINT_TOKEN-002 | Timeout waiting for authenticator | A |
| 87 | MINT_TOKEN-003 | Timeout waiting for authenticator | A |
| 101 | MINT_TOKEN-004 | Timeout waiting for authenticator | A |
| 113-114 | MINT_TOKEN-004 | Numeric coin count | D |

(Same pattern repeats for all 28 tests)

### Helper Files

| File | Line | Function | Issue | Category |
|------|------|----------|-------|----------|
| assertions.bash | 240-267 | assert_json_field_equals | Type mismatch | B |
| assertions.bash | 636-682 | verify_token_cryptographically | Requires authenticator | A |
| common.bash | 211 | run_cli | Timeout configuration | C |
| token-helpers.bash | 470-473 | get_transaction_count | Numeric output | D |
| token-helpers.bash | 510-513 | get_coin_count | Numeric output | D |

---

## Related Documentation

- Full detailed analysis: `TEST_FAILURE_ANALYSIS.md`
- Test configuration: `tests/config/test-config.env`
- Command source: `src/commands/mint-token.ts:200-265`
- Assertion helpers: `tests/helpers/assertions.bash`
