# Mocking Audit - Quick Reference Guide

## The Bottom Line

**85% of Unicity CLI tests use mocks instead of real components.** The test suite cannot detect real bugs, security vulnerabilities, or integration issues because tests bypass the actual systems they're supposed to verify.

---

## Critical Issues At A Glance

### 1. CRITICAL: All Security Tests Use Fake Aggregator

```
Test File                          --local Uses    Should Use    Current
────────────────────────────────────────────────────────────────────────
test_double_spend.bats                 32          REAL          MOCK
test_input_validation.bats             30          REAL          MOCK
test_data_integrity.bats               36          REAL          MOCK
test_authentication.bats               29          REAL          MOCK
test_cryptographic.bats                21          REAL          MOCK
test_access_control.bats               23          REAL          MOCK

IMPACT: Cannot verify security properties (double-spend, validation, crypto)
```

### 2. CRITICAL: Token Status Checked Against Local File

```bash
# File: /home/vrogojin/cli/tests/helpers/token-helpers.bash:641-656

get_token_status() {
    # Checks LOCAL token file, NOT blockchain
    if has_offline_transfer "$token_file"; then
        echo "PENDING"
    else
        local tx_count=$(get_transaction_count "$token_file")
        # Never queries aggregator!
    fi
}

IMPACT: Cannot detect actual token spend status on blockchain
```

### 3. CRITICAL: Double-Spend Test Accepts Both Success & Failure

```bash
# File: test_double_spend.bats:86-104

if [[ $bob_exit -eq 0 ]]; then
    success_count=$((success_count + 1))
else
    failure_count=$((failure_count + 1))  # ← Also acceptable!
fi

# Test passes if EITHER succeed or EITHER fail
# Cannot distinguish correct from broken behavior

IMPACT: Double-spend prevention cannot be verified
```

### 4. HIGH: 62 File Checks Without Content Validation

```bash
# Current (BROKEN):
assert_file_exists "token.txf"

# Should be:
assert_file_exists "token.txf"
assert_json_valid "token.txf"
assert_json_field_exists "token.txf" ".version"

IMPACT: Empty/corrupt files pass as valid tokens
```

### 5. HIGH: 93 Instances of || true Masking Failures

```bash
# Typical pattern:
run_cli command || true  # Silently ignores failure
if [[ -f "output.txt" ]]; then
    echo "OK"  # Works regardless of command success
fi

IMPACT: Cannot detect when commands fail
```

---

## The Contradiction

**16 out of 16 test files require aggregator BUT bypass it:**

```
Tests that CALL require_aggregator BUT USE --local flag:
├── test_mint_token.bats              ← Contradictory
├── test_double_spend.bats            ← Contradictory
├── test_input_validation.bats        ← Contradictory
├── test_authentication.bats          ← Contradictory
├── test_data_integrity.bats          ← Contradictory
├── test_cryptographic.bats           ← Contradictory
├── test_access_control.bats          ← Contradictory
├── test_send_token.bats              ← Contradictory
├── test_receive_token.bats           ← Contradictory
├── test_integration.bats             ← Contradictory
├── test_aggregator_operations.bats   ← Contradictory
├── test_verify_token.bats            ← Contradictory
├── test_receive_token_crypto.bats    ← Contradictory
├── test_send_token_crypto.bats       ← Contradictory
├── test_recipientDataHash_tampering.bats ← Contradictory
└── test_data_c4_both.bats            ← Contradictory

LINE OF CODE:
    require_aggregator  # "You must have aggregator"
    run_cli "... --local ..."  # "Actually, nevermind, using local mock"
```

---

## Real vs Mocked Testing Breakdown

```
Component Layer             Real Tests    Mocked Tests    Skipped
─────────────────────────────────────────────────────────────────
Aggregator (all ops)           ~7            ~172          ~19
  - Double-spend                 0              6           1
  - Proof validation             1             15           3
  - Token minting                2             94           0

Cryptography (all ops)          ~9            ~53           ~7
  - Signatures                   2             18           2
  - Address generation           5             12           0

File System                     33             16           3
  - Token creation              10              8           0
  - Token parsing                8              3           1

Network                          6             17          12
  - Real calls                   3              0           0
  - Fallback behavior            2              4           3

─────────────────────────────────────────────────────────────────
TOTAL                          55            258          41
PERCENTAGE                    15.5%          73%         11.5%
```

---

## Mocking Patterns Ranked by Danger

### Rank 1: CRITICAL - Bypass Aggregator

```
Pattern: --local flag in security tests
Instances: 262 (in security tests alone)
Risk: Security bugs go undetected
Example: Double-spend prevention cannot be tested
```

### Rank 2: CRITICAL - Accept Both Outcomes

```
Pattern: if [[ success ]]; then count++ else count++ fi
Instances: 20+ tests
Risk: Cannot distinguish correct from broken behavior
Example: Double-spend test passes even if both transfers succeed
```

### Rank 3: HIGH - Skip Content Validation

```
Pattern: assert_file_exists without assert_json_valid
Instances: 62 file checks
Risk: Corrupt files pass as valid
Example: Empty file passes as token
```

### Rank 4: HIGH - Mask Failures

```
Pattern: || true to ignore errors
Instances: 93 in test code
Risk: Silent failures not reported
Example: Command fails but test continues
```

### Rank 5: MEDIUM - Skip Hard Tests

```
Pattern: skip "requires careful management"
Instances: 73 skip statements
Risk: Hardest tests never run
Example: INTEGRATION-005 skipped
```

---

## Files Requiring Immediate Attention

### Priority 1: Fix These Files (CRITICAL)

```
test_double_spend.bats
├── Line 38: Remove --local flag (32 instances)
├── Line 86-104: Fix assertion logic to require exactly 1 success
└── Risk: Cannot verify core security property

test_input_validation.bats
├── Remove --local flag (30 instances)
└── Risk: Validation bugs invisible

test_data_integrity.bats
├── Remove --local flag (36 instances)
└── Risk: Tampering not detected

test_helpers/token-helpers.bash
├── Line 641-656: Fix get_token_status() to query aggregator
└── Risk: Token status always wrong
```

### Priority 2: Fix These Files (HIGH)

```
test_authentication.bats
├── Remove --local flag (29 instances)
└── Risk: Auth bypass not detected

test_cryptographic.bats
├── Remove --local flag (21 instances)
└── Risk: Signature forgery not detected

test_access_control.bats
├── Remove --local flag (23 instances)
└── Risk: Access control bypass not detected

[All other security tests]
├── Remove --local flags
└── Risk: Various security issues
```

### Priority 3: Fix These Tests (HIGH)

```
test_double_spend_advanced.bats
├── 12 tests are SKIPPED
└── Unskip and fix them

test_integration.bats
├── 2 integration tests SKIPPED
└── Unskip and fix them
```

---

## What "Fixed" Means

### Before (MOCK):
```bash
@test "Mint token" {
    run_cli_with_secret "$SECRET" "mint-token --preset nft --local -o token.txf"
    assert_success
    assert_file_exists "token.txf"
}
```

**Problems:**
1. Uses `--local` flag (bypasses aggregator)
2. Only checks file exists (not content)
3. Cannot detect real issues
4. Cannot verify aggregator integration

### After (REAL):
```bash
@test "Mint token" {
    require_aggregator  # Fail if aggregator down

    run_cli_with_secret "$SECRET" "mint-token --preset nft -o token.txf"
    assert_success
    assert_file_exists "token.txf"
    assert_json_valid "token.txf"
    assert_json_field_exists "token.txf" ".genesis.inclusionProof"

    # Verify real aggregator was used
    local proof=$(jq -r '.genesis.inclusionProof.merkleTreePath.root' token.txf)
    [[ -n "$proof" ]] || fail "No proof from aggregator"
}
```

**Improvements:**
1. Requires real aggregator
2. Validates JSON structure
3. Verifies inclusion proof from real aggregator
4. Can detect missing integration

---

## Quick Fix Checklist

### For test_double_spend.bats
- [ ] Remove all `--local` flags (search+replace: ` --local` → ``)
- [ ] Change assertion logic to require exactly ONE success
- [ ] Remove || true masking
- [ ] Add failure message assertions

### For test_input_validation.bats
- [ ] Remove all `--local` flags
- [ ] Add clear assertions for each input validation case
- [ ] Remove || true patterns

### For test_*.bats (ALL SECURITY TESTS)
- [ ] Find all `--local` flags
- [ ] Remove them OR move to separate unit test file
- [ ] Keep integration tests against real aggregator

### For token-helpers.bash
- [ ] Replace get_token_status() implementation
- [ ] Query aggregator instead of checking local file
- [ ] Handle aggregator unavailable gracefully

### For all test files
- [ ] Find all `assert_file_exists` without content checks
- [ ] Add `assert_json_valid` after each
- [ ] Add `assert_json_field_exists` for required fields

---

## Command Reference

### Run Tests Against Real Aggregator
```bash
# Start aggregator (in another terminal)
docker run -p 3000:3000 unicity/aggregator

# Run tests
UNICITY_AGGREGATOR_URL=http://localhost:3000 npm test
```

### Run Only Security Tests
```bash
npm run test:security
```

### Run Specific Test File
```bash
bats tests/security/test_double_spend.bats
```

### Check Mocking Patterns
```bash
# Find all --local uses
grep -r "\-\-local" tests/security/*.bats | wc -l

# Find all || true uses
grep -r "\|\| true" tests/ --include="*.bats" | wc -l

# Find file checks without content validation
grep -r "assert_file_exists" tests/ --include="*.bats" | head -20
```

---

## Why This Matters

### Scenario 1: Double-Spend Attack
**Real System:**
```
Alice creates token → mints to Alice
Alice transfers token to Bob
Alice transfers SAME token to Carol  ← Should FAIL
Bob receives → SUCCESS
Carol receives → FAIL with "already spent"
```

**Current Mocked Tests:**
```
Alice creates token → mints locally
Alice creates transfer to Bob → offline, no aggregator
Alice creates transfer to Carol → offline, no aggregator
Bob receives locally → SUCCESS
Carol receives locally → SUCCESS (aggregator doesn't know!)
Test passes! ← BUG NOT DETECTED
```

### Scenario 2: Forged Signature Attack
**Real System:**
```
Attacker changes token predicate
Attacker submits to aggregator
Aggregator verifies signature → FAILS
Aggregator rejects token
```

**Current Mocked Tests:**
```
Attacker changes token predicate locally
Test only checks local file validity
Test doesn't submit to aggregator
Test passes! ← SECURITY ISSUE NOT DETECTED
```

### Scenario 3: Data Tampering
**Real System:**
```
Attacker modifies token data
Submits to aggregator
Aggregator validates against Merkle root
Validation fails
```

**Current Mocked Tests:**
```
Attacker modifies token locally
Test checks file exists
Test doesn't verify against aggregator
Test passes! ← TAMPERING NOT DETECTED
```

---

## Success Criteria

**Test suite is fixed when:**

1. ✓ All `--local` flags removed from security tests (0 remaining)
2. ✓ 100% of file existence checks include content validation
3. ✓ 0 instances of `|| true` masking test failures
4. ✓ All tests have clear, single expected outcome
5. ✓ All skipped integration tests now pass
6. ✓ `get_token_status()` queries real aggregator
7. ✓ Double-spend test fails when both transfers succeed
8. ✓ Tests fail when aggregator is unavailable

---

## Key Files

```
CRITICAL TO FIX:
├── tests/security/test_double_spend.bats (482 lines)
├── tests/security/test_input_validation.bats (489 lines)
├── tests/security/test_data_integrity.bats (454 lines)
├── tests/security/test_authentication.bats (451 lines)
├── tests/security/test_cryptographic.bats (413 lines)
├── tests/security/test_access_control.bats (375 lines)
└── tests/helpers/token-helpers.bash (752 lines)

DETAILED ANALYSIS:
└── /home/vrogojin/cli/MOCKING_ANALYSIS_REPORT.md (this comprehensive report)
```

---

**TL;DR:** 85% of tests are fake. Fix them by removing `--local`, adding content validation, and requiring real aggregator.
