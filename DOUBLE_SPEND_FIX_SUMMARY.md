# Double-Spend Prevention Fix - Quick Summary

## The Problem in 3 Lines

1. Alice creates offline transfer to Bob
2. Bob runs `receive-token` 3 times concurrently  
3. **ALL 3 succeed** and create valid tokens (WRONG!)

## Root Cause: ONE LINE OF CODE

**File:** `/home/vrogojin/cli/src/commands/receive-token.ts:568`

```typescript
if (err.message.includes('already exists')) {
  console.error('  ℹ Transfer already submitted (continuing...)\n');
  // ⚠️ CONTINUES EXECUTION - THIS IS THE BUG!
}
```

## How RequestId Works

```
Alice's Transfer Commitment:
  RequestId = hash(Alice_PublicKey + hash(Alice_CurrentTokenState))

All 3 concurrent receive processes compute THE SAME RequestId because:
  - Same source state (Alice's token)
  - Same sender public key (Alice)
  - Same transfer commitment data

Aggregator Response:
  Process 1: "SUCCESS" (RequestId added to SMT)
  Process 2: "REQUEST_ID_EXISTS" (duplicate rejected) ← CLI IGNORES THIS
  Process 3: "REQUEST_ID_EXISTS" (duplicate rejected) ← CLI IGNORES THIS
```

## What Happens Now (Broken)

```
Process 1:
  ✓ submitTransferCommitment() → status: SUCCESS
  ✓ getInclusionProof(requestId) → proof A
  ✓ Creates token ← CORRECT

Process 2:
  ✗ submitTransferCommitment() → throws "already exists"
  ✓ CLI logs warning but CONTINUES (LINE 568 BUG!)
  ✓ getInclusionProof(requestId) → proof A (SAME proof!)
  ✓ Creates token ← WRONG! Should have exited at line 568!

Process 3:
  ✗ submitTransferCommitment() → throws "already exists"  
  ✓ CLI logs warning but CONTINUES (LINE 568 BUG!)
  ✓ getInclusionProof(requestId) → proof A (SAME proof!)
  ✓ Creates token ← WRONG! Should have exited at line 568!
```

**Key Insight:** The aggregator returns the **SAME proof** to all 3 because they query the same RequestId. This is correct behavior - one RequestId = one proof. The CLI must exit if it wasn't the one who submitted.

## The Fix (1 Line)

**File:** `/home/vrogojin/cli/src/commands/receive-token.ts:568`

```diff
  if (err.message.includes('already exists')) {
-   console.error('  ℹ Transfer already submitted (continuing...)\n');
+   console.error('\n❌ Double-Spend Prevention - Transfer Already Submitted');
+   process.exit(1);
  }
```

## What Happens After Fix (Correct)

```
Process 1:
  ✓ submitTransferCommitment() → status: SUCCESS
  ✓ getInclusionProof(requestId) → proof A
  ✓ Creates token ← SUCCESS

Process 2:
  ✗ submitTransferCommitment() → throws "already exists"
  ✗ process.exit(1) ← EXITS IMMEDIATELY
  
Process 3:
  ✗ submitTransferCommitment() → throws "already exists"
  ✗ process.exit(1) ← EXITS IMMEDIATELY
```

## Why the Architecture is Sound

**Unicity Network guarantees:**
- RequestId uniqueness in SMT ✓
- REQUEST_ID_EXISTS status for duplicates ✓  
- Single proof per RequestId ✓

**CLI's responsibility:**
- Check submitResponse.status (EXISTS but may not be reached)
- Exit on exception "already exists" (BROKEN at line 568)
- Only create token if OUR submission succeeded (MISSING)

The aggregator is doing its job correctly. The CLI is ignoring the rejection signal.

## Test the Fix

```bash
# Terminal 1: Start aggregator
docker run -p 3000:3000 unicity/aggregator

# Terminal 2: Setup
SECRET="alice" npm run mint-token -- --local --preset nft --save
# Save output as alice.txf

SECRET="bob" npm run gen-address -- --preset nft
# Copy BOB_ADDR from output

SECRET="alice" npm run send-token -- -f alice.txf -r "$BOB_ADDR" --local --save  
# Save output as transfer.txf

# Terminal 3-5: Concurrent receives
for i in 1 2 3; do
  (SECRET="bob" npm run receive-token -- -f transfer.txf --local -o "bob-$i.txf" 2>&1 | tee "log-$i.txt") &
done
wait

# Verify fix
ls bob-*.txf | wc -l          # Should be 1 (not 3)
grep -c "Already Submitted" log-*.txt  # Should be 2
```

## Files to Change

1. **CRITICAL:** `/home/vrogojin/cli/src/commands/receive-token.ts:568` - Exit instead of continue
2. **RECOMMENDED:** Add `submittedByUs` flag for defense-in-depth
3. **TEST FIX:** `/home/vrogojin/cli/tests/edge-cases/test_concurrency.bats:353` - Fail instead of warn

## Impact

**Severity:** HIGH - Allows double-spend in concurrent scenarios
**Fix Complexity:** LOW - Single line change
**Testing:** Easy to verify with concurrent receives

## Technical Appendix

### RequestId Computation Source Code

```typescript
// node_modules/@unicitylabs/state-transition-sdk/lib/transaction/TransferCommitment.js:31
const sourceStateHash = await transactionData.sourceState.calculateHash();
const requestId = await RequestId.create(signingService.publicKey, sourceStateHash);
```

### Aggregator Status Codes

```typescript
// node_modules/@unicitylabs/state-transition-sdk/lib/api/SubmitCommitmentResponse.d.ts
enum SubmitCommitmentStatus {
  SUCCESS = "SUCCESS",
  REQUEST_ID_EXISTS = "REQUEST_ID_EXISTS"
}
```

### SDK Method

```typescript
// StateTransitionClient.js
async submitTransferCommitment(commitment: TransferCommitment) {
  return this.client.submitCommitment(
    commitment.requestId,
    commitment.transactionHash,
    commitment.authenticator
  );
}
```

## User's Statement: CONFIRMED

> "the aggregator will never produce three alternative Unicity proofs for the same requestId"

**This is 100% CORRECT.** The aggregator returns the **SAME proof** to all 3 processes because they query the same RequestId. One RequestId = One proof = One state transition.

The CLI's bug is accepting a proof it didn't earn the right to use.

---

**Bottom Line:** Change line 568 from "continue" to "exit(1)". That's the entire fix.
