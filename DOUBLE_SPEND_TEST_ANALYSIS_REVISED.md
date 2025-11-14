# Double-Spend Test Analysis - Revised Understanding

**Date**: November 13, 2025
**Context**: After consulting Unicity proof aggregation expert
**Status**: Tests are CORRECT - They expose REAL bugs

---

## Correct Understanding of Unicity Proof System

### Idempotent Resubmission (SAME commitment)

**Scenario**: Alice creates 5 identical transfers to Bob
- All 5 have the **SAME RequestId** (hash of publicKey + stateHash)
- All 5 have the **SAME commitment** (same destination, same state hash)

**Expected Behavior**:
1. First submission → Returns `SUCCESS` status + inclusion proof
2. Submissions 2-5 → Return `REQUEST_ID_EXISTS` status
3. All 5 can retrieve the SAME valid inclusion proof
4. Result: **This is idempotent and correct** ✅

---

### Double-Spend Prevention (DIFFERENT commitments)

**Scenario**: Alice creates 5 transfers to different recipients (Bob, Carol, Dave, Eve, Frank)
- Each has a **DIFFERENT RequestId** (different destination states)
- RequestId₁ = hash(Alice_pk + hash(S1→S2_Bob))
- RequestId₂ = hash(Alice_pk + hash(S1→S3_Carol))
- etc.

**Expected Behavior** (per Unicity expert):
1. First submission (Bob) → Returns `SUCCESS`, gets valid proof
2. Source state S1 marked as **SPENT** by the aggregator
3. Submissions 2-5 (Carol, Dave, etc.) → **REJECTED with exception**
4. CLI command exits with code 1 for submissions 2-5
5. Only Bob's token file is created
6. Result: **Exactly 1 success, 4 failures** ✅

---

## Analysis of Failing Tests

### DBLSPEND-005: Extreme concurrent submit-now race

**Location**: `tests/edge-cases/test_double_spend_advanced.bats:260-311`

**What the test does**:
1. Mints one Alice token
2. Generates **5 different recipient addresses** (line 262-269)
3. Launches 5 concurrent `send-token --submit-now` to **different recipients**
4. Waits for all to complete
5. Counts how many have transactions (tx_count > 0)
6. **Expects**: Exactly 1 success, 4 failures

**Actual Result**: All 5 succeeded (all have tx_count > 0) ❌

---

### DBLSPEND-007: Create multiple offline packages rapidly

**Location**: `tests/edge-cases/test_double_spend_advanced.bats:362-452`

**What the test does**:
1. Mints one Alice token
2. Generates **5 different recipient addresses** with secrets
3. Creates 5 offline transfer packages to **different recipients**
4. Has all 5 recipients attempt to receive (submit to aggregator)
5. Counts successful receives
6. **Expects**: Exactly 1 success, 4 failures

**Actual Result**: All 5 receives succeeded ❌

---

## The Real Bugs Identified

Based on Unicity expert consultation, the tests are **CORRECT** and they're exposing **REAL BUGS**.

### Bug Analysis

**Expected Behavior** (per Unicity design):
- First `send-token --submit-now` to Bob → Aggregator accepts, returns SUCCESS
- Subsequent `send-token --submit-now` to Carol → Aggregator rejects (source spent)
- CLI should throw exception and exit with code 1

**Actual Behavior** (test results):
- All 5 `send-token --submit-now` operations appear to succeed
- All 5 create token files with transactions
- All 5 have tx_count > 0

### Possible Root Causes

#### Hypothesis 1: CLI Not Actually Submitting Immediately
**Issue**: `--submit-now` flag might not be working
- CLI creates transaction but doesn't submit to aggregator
- Or submits asynchronously without waiting for response
- Test sees local file creation, assumes success

**Evidence Needed**: Check if `send-token --submit-now` actually waits for aggregator response

---

#### Hypothesis 2: Aggregator Not Enforcing Source State Spending
**Issue**: Aggregator accepts multiple different commitments from same source state
- First commit doesn't properly mark source as spent
- Or there's a race condition in aggregator's state tracking
- Multiple commits get accepted before state lock takes effect

**Evidence Needed**: Query aggregator directly for all 5 RequestIds to see which ones actually got proofs

---

#### Hypothesis 3: Test Validation Method is Wrong
**Issue**: Test counts local `tx_count` instead of querying actual on-chain state
- CLI optimistically adds transaction to local file
- But aggregator may have rejected it
- Test doesn't verify aggregator actually accepted it

**Fix**: Test should query aggregator for actual proof existence

---

## Correct Test Pattern (From Unicity Expert)

According to the expert analysis, the proper double-spend test should:

```bash
# Create TWO different transfers
send-token -f alice_token -r bob_address -o transfer_bob.txf
send-token -f alice_token -r carol_address -o transfer_carol.txf

# Both recipients submit
receive-token -f transfer_bob.txf -o bob_received.txf
bob_exit=$?

receive-token -f transfer_carol.txf -o carol_received.txf
carol_exit=$?

# Verify EXACTLY one success via exit codes
success_count=0
[[ $bob_exit -eq 0 ]] && ((success_count++))
[[ $carol_exit -eq 0 ]] && ((success_count++))

assert_equals "1" "${success_count}"  # ONE succeeds, ONE fails
```

**Key Insight**: Use `receive-token` exit codes, not `send-token` success count.
- `receive-token` actually submits to aggregator and waits for response
- Exit code 0 = aggregator accepted
- Exit code 1 = aggregator rejected (double-spend detected)

---

## Investigation Plan

### Step 1: Verify CLI Behavior

Run manual test to see what actually happens:

```bash
# Mint token
SECRET="alice" npm run mint-token -- --local --preset nft -o alice.txf

# Generate 2 recipients
SECRET="bob" npm run gen-address -- --preset nft > bob-addr.json
SECRET="carol" npm run gen-address -- --preset nft > carol-addr.json

# Extract addresses
BOB_ADDR=$(jq -r '.address' bob-addr.json)
CAROL_ADDR=$(jq -r '.address' carol-addr.json)

# Try concurrent sends
SECRET="alice" npm run send-token -- -f alice.txf -r "$BOB_ADDR" --local --submit-now -o bob.txf &
SECRET="alice" npm run send-token -- -f alice.txf -r "$CAROL_ADDR" --local --submit-now -o carol.txf &

wait

# Check results
echo "Bob exit: $?"
echo "Carol exit: $?"
ls -l bob.txf carol.txf

# Check transactions
jq '.transactions | length' bob.txf
jq '.transactions | length' carol.txf
```

**Expected**: One should succeed (file created), one should fail (no file or error)
**If both succeed**: Bug confirmed

---

### Step 2: Query Aggregator Directly

```bash
# Get RequestIds from both token files
BOB_REQ=$(jq -r '.transactions[0].requestId' bob.txf)
CAROL_REQ=$(jq -r '.transactions[0].requestId' carol.txf)

# Query aggregator for proofs
curl http://localhost:3000/api/v1/requests/$BOB_REQ
curl http://localhost:3000/api/v1/requests/$CAROL_REQ
```

**Expected**: Only ONE should return valid proof (200), other should 404
**If both return 200**: Aggregator bug confirmed

---

### Step 3: Check send-token Implementation

Look at `src/commands/send-token.ts` for `--submit-now` handling:
- Does it wait for aggregator response?
- Does it check for rejection/errors?
- Does it validate the response?

---

## Recommended Fixes

### Fix Option 1: Update Test to Check Exit Codes

If CLI is correctly rejecting double-spends but test validation is wrong:

```bash
# DBLSPEND-005 fix
local exit_codes=()
for i in {0..4}; do
  (send_token_immediate "$ALICE_SECRET" "$alice_token" "${recipients[$i]}" "$output") &
  pids+=($!)
done

for pid in "${pids[@]}"; do
  wait "$pid"
  exit_codes+=($?)
done

# Count successes by exit code, not file existence
success_count=0
for code in "${exit_codes[@]}"; do
  [[ $code -eq 0 ]] && ((success_count++))
done

# Should be exactly 1
assert_equals "1" "$success_count"
```

---

### Fix Option 2: Improve Test to Query Aggregator

```bash
# After operations complete, query aggregator for each RequestId
local on_chain_successes=0
for output in "${outputs[@]}"; do
  if [[ -f "$output" ]]; then
    local req_id=$(jq -r '.transactions[0].requestId' "$output")
    # Query aggregator
    if curl -s "http://localhost:3000/api/v1/requests/$req_id" | grep -q "proof"; then
      ((on_chain_successes++))
    fi
  fi
done

assert_equals "1" "$on_chain_successes"
```

---

### Fix Option 3: Fix CLI Double-Spend Handling

If CLI isn't properly handling aggregator rejections:

**Location**: `src/commands/send-token.ts`

```typescript
// After submitting to aggregator
try {
  const response = await aggregatorClient.submitTransferCommitment(...);

  if (response.status === 'REQUEST_ID_EXISTS') {
    // This is OK for idempotent resubmission
    console.log('Transfer already submitted (idempotent)');
  } else if (response.status === 'SUCCESS') {
    // New submission accepted
    console.log('Transfer submitted successfully');
  }
} catch (err) {
  // Check for double-spend rejection
  if (err.message.includes('already spent') ||
      err.message.includes('double') ||
      err.message.includes('duplicate')) {
    console.error('❌ Double-Spend Prevention: Source token already spent');
    process.exit(1);  // Exit with error
  }
  throw err;
}
```

---

## Summary

### Tests Are Correct ✅
- DBLSPEND-005 and DBLSPEND-007 properly test double-spend prevention
- They send to **different recipients** (different RequestIds)
- They expect **only 1 to succeed** (correct expectation)

### Real Bug Exists ❌
- All 5 operations succeed when only 1 should
- This indicates **either**:
  1. CLI not properly handling aggregator responses
  2. Aggregator not properly enforcing single-spend
  3. Test validation checking wrong thing (local files vs on-chain state)

### Next Actions Required

1. **Immediate**: Run manual investigation (Step 1-3 above)
2. **Identify**: Determine if bug is in CLI, aggregator, or test
3. **Fix**: Implement appropriate solution (Option 1, 2, or 3)
4. **Verify**: Re-run tests to confirm fix

---

**Priority**: HIGH - This is a real double-spend vulnerability if CLI/aggregator aren't enforcing properly

**Estimated Effort**: 1-2 days investigation + 2-3 days fix + testing

---

**Report Generated**: November 13, 2025
**Analysis Based On**: Unicity proof aggregation expert consultation + SDK documentation
