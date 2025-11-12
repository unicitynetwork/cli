# Token Data Tests - Quick Reference Card

**For:** Developer implementing the 18 new tests
**Keep:** Open while coding
**Time:** 2-3 weeks, 10-13 hours total

---

## The 3 Test Files You're Creating

### 1. `tests/security/test_recipientDataHash_tampering.bats` (6 tests, 3-4 hours)

**What it tests:** Hash commitment to state.data
**Key insight:** If hash is tampered, SDK verification FAILS

| Test | Purpose | Key Check |
|------|---------|-----------|
| HAH-001 | Hash format validation | Is it 64 hex chars (SHA-256)? |
| HAH-002 | All-zeros tampering | Set to 0x00...00, verify fails |
| HAH-003 | All-F's tampering | Set to 0xFF...FF, verify fails |
| HAH-004 | Partial modification | Flip first 8 chars, verify fails |
| HAH-005 | State/hash inconsistency | Change state AND hash to mismatched values, fails |
| HAH-006 | Null hash rejection | Set to null, verify fails |

**Key jq patterns:**
```bash
# Get recipientDataHash
jq -r '.genesis.transaction.recipientDataHash' token.txf

# Set to zeros
jq --arg hash "0000000000000000000000000000000000000000000000000000000000000000" \
    '.genesis.transaction.recipientDataHash = $hash' token.txf

# Expected: verify-token fails with hash/mismatch error
```

---

### 2. `tests/security/test_data_c4_both.bats` (6 tests, 4-5 hours)

**What it tests:** Dual protection on transferred tokens
**Key insight:** Two independent mechanisms catch different tampering

| Test | Purpose | Key Validation |
|------|---------|-----------------|
| C4-001 | Create C4 (transfer C3) | Both data types present after transfer |
| C4-002 | Genesis tampering on C4 | Genesis signature protects data |
| C4-003 | State tampering on C4 | State hash protects data |
| C4-004 | Hash tampering on C4 | Commitment binding protects hash |
| C4-005 | Independent detection | **EACH tampering caught separately** |
| C4-006 | Multi-transfer preservation | Genesis data survives Alice→Bob→Carol |

**Key scenario (C4-005 - most important):**
```bash
# Test 1: Tamper genesis only
jq '.genesis.data.tokenData = "deadbeef"' token.txf > tampered.txf
verify-token -f tampered.txf  # FAILS (signature)

# Test 2: Tamper state only
jq '.state.data = "deadbeef"' token.txf > tampered.txf
verify-token -f tampered.txf  # FAILS (hash)

# Test 3: Tamper hash only
jq '.genesis.transaction.recipientDataHash = "0000..."' token.txf > tampered.txf
verify-token -f tampered.txf  # FAILS (commitment)

# Each tampering caught INDEPENDENTLY ← This proves both mechanisms work!
```

---

### 3. `tests/security/test_data_c3_genesis_only.bats` (6 tests, 3-4 hours)

**What it tests:** Genesis data immutability on untransferred tokens
**Key insight:** Genesis metadata is protected by transaction signature

| Test | Purpose | Key Check |
|------|---------|-----------|
| C3-001 | Create C3 token | Token created with -d flag has metadata |
| C3-002 | Genesis encoding | Data is hex-encoded correctly |
| C3-003 | Genesis tampering | Modify genesis.data.tokenData, verify fails |
| C3-004 | State matches genesis | Initially, state.data == genesis.data.tokenData |
| C3-005 | State tampering | Modify state.data, verify fails |
| C3-006 | Transfer preserves genesis | Transfer C3→C4, genesis data unchanged |

**Key jq patterns:**
```bash
# Get genesis data (hex)
jq -r '.genesis.data.tokenData' token.txf

# Get state data (hex)
jq -r '.state.data' token.txf

# Tamper genesis (convert JSON to hex first)
local hex_data=$(printf '{"hacked":"data"}' | xxd -p | tr -d '\n')
jq --arg data "${hex_data}" '.genesis.data.tokenData = $data' token.txf
```

---

## Copy-Paste Commands

### Start a Test File

```bash
# Create file with basic structure
cat > tests/security/test_FILENAME.bats << 'EOF'
#!/usr/bin/env bats
# Security Test Suite: [Description]
# Test Scenarios: [IDs]

load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

setup() {
    setup_common
    check_aggregator
    export ALICE_SECRET=$(generate_test_secret "alice-test")
    export BOB_SECRET=$(generate_test_secret "bob-test")
}

teardown() {
    teardown_common
}

@test "TEST-001: Description" {
    log_test "TEST-001: What this does"

    # Test code here

    log_success "TEST-001: Passed"
}
EOF
```

### Basic Test Pattern

```bash
@test "ID: Description" {
    log_test "ID: What this test does"

    # Step 1: Create token
    local token="${TEST_TEMP_DIR}/token.txf"
    run_cli_with_secret "${ALICE_SECRET}" "mint-token --preset nft --local -d '{}' -o ${token}"
    assert_success
    assert_file_exists "${token}"

    # Step 2: Verify it works
    run_cli "verify-token -f ${token} --local"
    assert_success

    # Step 3: Tamper it
    local tampered="${TEST_TEMP_DIR}/tampered.txf"
    cp "${token}" "${tampered}"
    jq '.state.data = "deadbeef"' "${tampered}" > "${tampered}.tmp"
    mv "${tampered}.tmp" "${tampered}"

    # Step 4: Verify tampering is detected
    run_cli "verify-token -f ${tampered} --local"
    assert_failure
    assert_output_contains "hash" || assert_output_contains "state"

    log_success "ID: Tampering correctly detected"
}
```

### Hex Encode JSON

```bash
# Method 1: Quick one-liner
local hex=$(printf '{"key":"value"}' | xxd -p | tr -d '\n')

# Method 2: With variable
local data='{"key":"value"}'
local hex=$(printf '%s' "${data}" | xxd -p | tr -d '\n')

# Use in jq
jq --arg data "${hex}" '.genesis.data.tokenData = $data' token.txf
```

### Run Tests

```bash
# One file
bats tests/security/test_recipientDataHash_tampering.bats

# One test
bats tests/security/test_recipientDataHash_tampering.bats --filter HAH-001

# Full suite
npm test
```

---

## Common Error Patterns

### Assertion Failures

**If you see:**
```
not found in output
```

**Fix:** The error message doesn't match assertion
```bash
# Run to see actual error
bats test_file.bats 2>&1 | grep -A10 "Test name"

# Update assertion
assert_output_contains "actual message here"
```

---

### jq Failures

**If you see:**
```
jq: error ... cannot index
```

**Fix:** Field path is wrong
```bash
# Debug: Print what's in the file
jq '.genesis' token.txf | head

# Verify path: does .genesis.data.tokenData exist?
jq '.genesis.data.tokenData' token.txf
```

---

### Aggregator Connection

**If you see:**
```
Unable to connect to aggregator
```

**Fix:** Aggregator not running
```bash
# Start it
docker run -p 3000:3000 unicity/aggregator

# Wait for startup (30 seconds)
# Then run test again
```

---

## Key Files Reference

| File | Purpose | When to Check |
|------|---------|---------------|
| `TOKEN_DATA_TEST_EXAMPLES.md` | Source for all test code | Copy tests from here |
| `TOKEN_DATA_EXPERT_VALIDATION.md` | Why each test matters | Understanding design |
| `TOKEN_DATA_IMPLEMENTATION_GUIDE.md` | Step-by-step instructions | During implementation |
| `tests/security/test_receive_token_crypto.bats` | Similar tests pattern | If stuck on structure |
| `tests/helpers/common.bats` | Available functions | For helper functions |
| `CLAUDE.md` | Project architecture | Understanding tokens |

---

## Quick Debug Checklist

- [ ] Does aggregator run? `docker ps` should show container
- [ ] Is test file valid BATS? `bats --version` works?
- [ ] Are paths correct? `ls tests/security/test_*.bats`
- [ ] Are secrets generated? `generate_test_secret "test"` works?
- [ ] Is JSON valid? `jq . token.txf` doesn't error?
- [ ] Is hex conversion right? `xxd -p` for encode, `xxd -r -p` for decode?

---

## Timeline

### Week 1, Day 1 (3-4 hours)
- [ ] Create `test_recipientDataHash_tampering.bats`
- [ ] Copy 6 tests from examples
- [ ] Run: `bats tests/security/test_recipientDataHash_tampering.bats`
- [ ] Verify: 6/6 pass (or note error message differences)

### Week 1, Day 2 (4-5 hours)
- [ ] Create `test_data_c4_both.bats`
- [ ] Copy 6 tests from examples
- [ ] Run: `bats tests/security/test_data_c4_both.bats`
- [ ] Verify: 6/6 pass

### Week 2, Day 1-2 (3-4 hours)
- [ ] Create `test_data_c3_genesis_only.bats`
- [ ] Copy 6 tests from examples
- [ ] Run: `bats tests/security/test_data_c3_genesis_only.bats`
- [ ] Verify: 6/6 pass

### Final (1 hour)
- [ ] Run `npm test` (full suite)
- [ ] Verify: All tests pass, no regressions
- [ ] Commit: 18 new tests

---

## Success Indicators

✅ **RecipientDataHash tests all pass**
- HAH-001 through HAH-006: 6/6

✅ **C4 tests all pass**
- C4-001 through C4-006: 6/6

✅ **C3 tests all pass**
- C3-001 through C3-006: 6/6

✅ **Full suite still passes**
- `npm test` shows all tests passing (200+ total)
- No regressions
- Coverage improved

---

## When to Ask for Help

| Issue | Ask In | Example |
|-------|--------|---------|
| Understanding test purpose | Code review | "What's the difference between C3 and C4?" |
| Error message format | Code review | "My error says X, assertion expects Y" |
| jq syntax | Google/SO | `jq '.field | select(.x == 1)'` |
| BATS functions | Check `common.bats` | "What does assert_set do?" |
| Architecture questions | CLAUDE.md | "How does recipientDataHash work?" |

---

## Copy-Paste Checklist

When copying from `TOKEN_DATA_TEST_EXAMPLES.md`:

- [ ] File header (#!/usr/bin/env bats)
- [ ] Imports (load statements for helpers)
- [ ] setup() function
- [ ] teardown() function
- [ ] All @test functions (count: 6 per file)
- [ ] Comments explaining purpose
- [ ] Log statements (log_test, log_success, log_info)
- [ ] Assertions (assert_success, assert_failure, assert_output_contains)

---

## Pro Tips

**Tip 1:** Run tests as you write them
```bash
# After each test function, run it
bats test_file.bats --filter TEST-001
```

**Tip 2:** Use `--filter` to run single test
```bash
bats test_file.bats --filter HAH-002
```

**Tip 3:** Use `2>&1 | tail -20` to see last 20 lines of output
```bash
bats test_file.bats 2>&1 | tail -20
```

**Tip 4:** Check aggregator health
```bash
curl -s http://127.0.0.1:3000/health | jq .
```

**Tip 5:** Use variables for repeated paths
```bash
local token="${TEST_TEMP_DIR}/token.txf"
local tampered="${TEST_TEMP_DIR}/tampered.txf"
# Use $token and $tampered throughout
```

---

## You've Got This!

These tests are **ready to implement**. You're essentially:
1. Copy-paste test code from examples
2. Run tests to verify they work
3. Adjust error message assertions if needed
4. Commit

**Estimated time:** 2-3 weeks
**Difficulty:** Easy to Medium
**Impact:** Close critical security gaps in test coverage

---

**Good luck! Questions? Check TOKEN_DATA_EXPERT_VALIDATION.md or ask in code review.**

