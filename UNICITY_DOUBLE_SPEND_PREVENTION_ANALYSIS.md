# Unicity Network Double-Spend Prevention Mechanism

## Executive Summary

**The Issue:** Current CLI implementation allows 3 concurrent `receive-token` processes to ALL succeed when receiving the same offline transfer, creating 3 "valid" tokens from one transfer. This violates the fundamental single-spend guarantee.

**Root Cause:** The CLI correctly submits the same `RequestId` to the aggregator for all 3 attempts, but doesn't properly handle the `REQUEST_ID_EXISTS` response status from attempts 2 and 3.

**The Fix:** Properly handle `submitResponse.status === 'REQUEST_ID_EXISTS'` in `receive-token.ts` (lines 541-561) - this code exists but may not be reached due to timing or exception handling issues.

---

## 1. Understanding RequestId in Transfers

### What is RequestId?

```typescript
// From SDK: node_modules/@unicitylabs/state-transition-sdk/lib/api/RequestId.js
class RequestId extends DataHash {
  static async create(publicKey: Uint8Array, stateHash: DataHash): Promise<RequestId> {
    // RequestId = hash(publicKey + stateHash)
    return RequestId.createFromImprint(publicKey, stateHash.imprint);
  }
}
```

**RequestId is deterministic:** It's computed as `hash(publicKey + stateHash)`.

### RequestId in Transfer Scenario

When Alice transfers a token to Bob:

```typescript
// From TransferCommitment.create() - line 31 in TransferCommitment.js
const sourceStateHash = await transactionData.sourceState.calculateHash();
const requestId = await RequestId.create(signingService.publicKey, sourceStateHash);
```

**Critical Insight:** The `RequestId` is computed from the **SOURCE state** (Alice's current token state), NOT the destination state (Bob's new state).

**Formula:**
```
RequestId = hash(Alice_PublicKey + hash(Alice_CurrentState))
```

This means:
- All 3 concurrent receive attempts compute the **EXACT SAME RequestId**
- The RequestId identifies "Alice is spending state X"
- The aggregator's Sparse Merkle Tree (SMT) uses RequestId as the key

---

## 2. Aggregator's Double-Spend Prevention

### How the Aggregator Prevents Double-Spends

The aggregator maintains a Sparse Merkle Tree (SMT) where:
- **Key:** RequestId (identifies which state is being spent)
- **Value:** Commitment data (the state transition)

**Critical Property:** SMT keys are unique. Once a RequestId is in the tree, it cannot be added again.

### Aggregator Response Status Codes

```typescript
// From SubmitCommitmentResponse.js
enum SubmitCommitmentStatus {
  SUCCESS = "SUCCESS",              // First submission - RequestId added to SMT
  REQUEST_ID_EXISTS = "REQUEST_ID_EXISTS"  // Duplicate - RequestId already in SMT
}
```

**What happens with 3 concurrent receives:**

```
Process 1: submitTransferCommitment(commitment) 
  → Aggregator: "RequestId not in SMT, adding..."
  → Response: { status: "SUCCESS" }
  → Gets inclusion proof for this RequestId

Process 2: submitTransferCommitment(commitment) [same RequestId]
  → Aggregator: "RequestId already in SMT, rejecting..."
  → Response: { status: "REQUEST_ID_EXISTS" }
  → SHOULD fail, but may get proof for existing RequestId

Process 3: submitTransferCommitment(commitment) [same RequestId]  
  → Aggregator: "RequestId already in SMT, rejecting..."
  → Response: { status: "REQUEST_ID_EXISTS" }
  → SHOULD fail, but may get proof for existing RequestId
```

**The aggregator DOES enforce single-spend** - it will only add the RequestId once. The user's statement is correct: **"the aggregator will never produce three alternative Unicity proofs for the same requestId"**

However, the aggregator WILL return the **same proof** to all 3 processes if they query `getInclusionProof(requestId)`, because the RequestId is now in the tree.

---

## 3. Current CLI Implementation Analysis

### The Good: Response Status Checking EXISTS

File: `src/commands/receive-token.ts`, lines 536-561

```typescript
submitResponse = await client.submitTransferCommitment(transferCommitment);

// CRITICAL SECURITY: Validate response status
if (submitResponse.status !== 'SUCCESS') {
  if (submitResponse.status === 'REQUEST_ID_EXISTS') {
    // Duplicate submission - another process already submitted this commitment
    console.error('\n❌ Double-Spend Prevention - Transfer Already Submitted');
    console.error(`\nAnother process has already submitted this transfer commitment.`);
    console.error(`Request ID: ${transferCommitment.requestId.toJSON()}`);
    console.error(`\nThis can happen when:`);
    console.error(`  1. Multiple concurrent receive attempts for the same transfer`);
    console.error(`  2. You already received this transfer in a previous attempt`);
    console.error(`\nThe token has already been transferred. Check your wallet for the received token.`);
    console.error();
    process.exit(1);  // ✓ CORRECT: Exits with failure
  } else {
    // Other non-success status
    console.error(`\n❌ Transfer Submission Failed`);
    console.error(`\nStatus: ${submitResponse.status}`);
    console.error(`Request ID: ${transferCommitment.requestId.toJSON()}`);
    console.error();
    process.exit(1);  // ✓ CORRECT: Exits with failure
  }
}
```

**This code is CORRECT** - it checks for `REQUEST_ID_EXISTS` and exits with failure.

### The Problem: Exception Handling May Bypass Status Check

File: `src/commands/receive-token.ts`, lines 564-589

```typescript
} catch (err) {
  // Check for specific error types (exceptions)
  if (err instanceof Error) {
    if (err.message.includes('already exists')) {
      console.error('  ℹ Transfer already submitted (continuing...)\n');
      // ⚠️ DANGER: Continues execution instead of exiting!
    } else if (
      err.message.includes('spent') ||
      err.message.includes('SPENT') ||
      err.message.includes('double') ||
      err.message.includes('duplicate') ||
      err.message.toLowerCase().includes('already')
    ) {
      // Aggregator rejected due to double-spend
      console.error('\n❌ Double-Spend Prevention - Aggregator Rejected Transfer');
      console.error(`\nError: ${err.message}`);
      console.error(`\nThe aggregator detected that this token was already transferred.`);
      console.error(`This is expected protection against double-spending.`);
      console.error();
      process.exit(1);  // ✓ CORRECT: Exits
    } else {
      throw err;  // Re-throw unknown errors
    }
  } else {
    throw err;
  }
}
```

**CRITICAL BUG:** Line 568 - if the SDK throws an exception with message "already exists", the CLI logs a warning but **CONTINUES EXECUTION** instead of exiting.

This means:
- Process 1: Gets `status: SUCCESS`, continues normally
- Process 2: SDK throws exception "already exists", CLI continues to line 592 (waitInclusionProof)
- Process 3: SDK throws exception "already exists", CLI continues to line 592 (waitInclusionProof)

### What Happens Next: All 3 Get the SAME Proof

Lines 592-594:
```typescript
// STEP 9: Wait for inclusion proof
console.error('Step 9: Waiting for inclusion proof...');
const inclusionProof = await waitInclusionProof(client, transferCommitment);
```

The `waitInclusionProof` function calls:
```typescript
const proofResponse = await client.getInclusionProof(commitment);
```

**Key Insight:** The aggregator's `getInclusionProof(requestId)` API returns the proof for ANY RequestId that's in the tree, regardless of which process submitted it.

Since all 3 processes use the **SAME RequestId**, they all query `getInclusionProof(sameRequestId)` and all receive the **SAME proof**.

Result:
- Process 1: Submits commitment → Gets proof → Creates token ✓
- Process 2: Fails to submit → Gets same proof → Creates token ✗ (WRONG!)
- Process 3: Fails to submit → Gets same proof → Creates token ✗ (WRONG!)

---

## 4. Missing Verification Step

### What's Missing: Proof Correspondence Verification

The CLI validates the proof cryptographically (line 597-617) but doesn't verify:

**"Did this proof come from MY submission, or someone else's?"**

Current validation (lines 597-617):
```typescript
// STEP 9.5: Validate the transfer inclusion proof
const transferProofValidation = await validateInclusionProof(
  inclusionProof,
  transferCommitment.requestId,
  trustBase
);

if (!transferProofValidation.valid) {
  console.error('\n❌ Transfer proof validation failed:');
  transferProofValidation.errors.forEach(err => console.error(`  - ${err}`));
  console.error('\nCannot proceed with invalid proof.');
  process.exit(1);
}
```

This verifies:
- Proof's Merkle path is valid ✓
- Proof's authenticator signature is valid ✓
- RequestId matches the proof ✓

But doesn't verify:
- **Did my submission succeed, or did I get someone else's proof?** ✗

### Why This Matters

In a concurrent scenario:
- Process 1 submits → Aggregator returns proof A with transactionHash "0xabc123"
- Process 2 submits (fails with REQUEST_ID_EXISTS) → Queries proof → Gets proof A (same transactionHash "0xabc123")
- Process 3 submits (fails with REQUEST_ID_EXISTS) → Queries proof → Gets proof A (same transactionHash "0xabc123")

All 3 processes get the **SAME inclusion proof** because they all queried the same RequestId.

The aggregator doesn't return "alternative" proofs - it returns the **ONE** proof that exists for that RequestId. This is architecturally correct (one state transition = one proof), but the CLI must handle the case where it receives a proof it didn't create.

---

## 5. The Fix: Two-Pronged Approach

### Fix 1: Remove Dangerous Exception Handler (IMMEDIATE)

**File:** `src/commands/receive-token.ts`, lines 567-569

**Current (WRONG):**
```typescript
if (err.message.includes('already exists')) {
  console.error('  ℹ Transfer already submitted (continuing...)\n');
  // ⚠️ DANGER: Continues to next step!
}
```

**Fixed (CORRECT):**
```typescript
if (err.message.includes('already exists')) {
  console.error('\n❌ Double-Spend Prevention - Transfer Already Submitted');
  console.error(`\nAnother process has already submitted this transfer commitment.`);
  console.error(`Request ID: ${transferCommitment.requestId.toJSON()}`);
  console.error(`\nThe token has already been transferred. Check your wallet.`);
  console.error();
  process.exit(1);  // Exit instead of continuing
}
```

### Fix 2: Track Submission Success (DEFENSE IN DEPTH)

**File:** `src/commands/receive-token.ts`, after line 563

Add a flag to track whether OUR submission succeeded:

```typescript
// STEP 8: Submit transfer commitment to network
console.error('Step 8: Submitting transfer to network...');
let submitResponse;
let submittedByUs = false;  // ← NEW FLAG

try {
  submitResponse = await client.submitTransferCommitment(transferCommitment);

  // CRITICAL SECURITY: Validate response status
  if (submitResponse.status !== 'SUCCESS') {
    if (submitResponse.status === 'REQUEST_ID_EXISTS') {
      // Duplicate submission - another process already submitted
      console.error('\n❌ Double-Spend Prevention - Transfer Already Submitted');
      console.error(`Request ID: ${transferCommitment.requestId.toJSON()}`);
      console.error('\nAnother process has already submitted this transfer.');
      process.exit(1);
    } else {
      console.error(`\n❌ Transfer Submission Failed: ${submitResponse.status}`);
      process.exit(1);
    }
  }

  submittedByUs = true;  // ← MARK SUCCESS
  console.error('  ✓ Transfer submitted to network\n');

} catch (err) {
  // All exceptions should exit - no "continue" branches
  if (err instanceof Error) {
    if (err.message.includes('already exists') || 
        err.message.includes('duplicate') ||
        err.message.includes('already submitted')) {
      console.error('\n❌ Double-Spend Prevention - Transfer Already Submitted');
      console.error(`\nError: ${err.message}`);
      console.error(`\nAnother process submitted this transfer first.`);
      process.exit(1);  // ← EXIT IMMEDIATELY
    } else if (
      err.message.includes('spent') ||
      err.message.includes('SPENT') ||
      err.message.includes('double')
    ) {
      console.error('\n❌ Double-Spend Prevention - Aggregator Rejected Transfer');
      console.error(`\nError: ${err.message}`);
      process.exit(1);
    } else {
      throw err;
    }
  } else {
    throw err;
  }
}

// CRITICAL ASSERTION: At this point, submittedByUs MUST be true
if (!submittedByUs) {
  console.error('\n❌ INTERNAL ERROR: Reached proof retrieval without successful submission');
  console.error('This indicates a bug in error handling. Aborting for safety.');
  process.exit(1);
}
```

### Fix 3: Additional Safety Check Before Creating Token (OPTIONAL)

After line 617, add final verification:

```typescript
console.error('  ✓ Transfer proof validated');
console.error('  ✓ Authenticator verified\n');

// FINAL SAFETY CHECK: Verify we're the one who submitted
if (!submittedByUs) {
  console.error('\n❌ SECURITY ERROR: Cannot proceed without confirmed submission');
  console.error('The inclusion proof may belong to another process.');
  process.exit(1);
}
```

---

## 6. Why Tests Currently Pass (False Positive)

The test `RACE-006: Concurrent receive of same transfer package` expects:

```bash
# Only one should succeed (network prevents duplicate)
local success_count=0
[[ -f "$out1" ]] && ((success_count++)) || true
[[ -f "$out2" ]] && ((success_count++)) || true

if [[ $success_count -eq 1 ]]; then
  info "✓ Only one concurrent receive succeeded (correct)"
elif [[ $success_count -eq 2 ]]; then
  info "⚠ Both receives succeeded (possible duplicate submission)"
else
  info "Both receives failed (may be network issue)"
fi
```

**The test doesn't FAIL when 2 succeed** - it just logs a warning. This allows the bug to go unnoticed.

**Fix the test:**
```bash
if [[ $success_count -ne 1 ]]; then
  fail "Expected exactly 1 success, got $success_count"
fi
```

---

## 7. Verification Strategy

### Test Scenario

```bash
# Terminal 1: Start aggregator
docker run -p 3000:3000 unicity/aggregator

# Terminal 2: Create transfer
SECRET="alice" npm run mint-token -- --local --preset nft --save
SECRET="bob" npm run gen-address -- --preset nft > bob-addr.json
BOB_ADDR=$(grep "DIRECT://" bob-addr.json)
SECRET="alice" npm run send-token -- -f <alice-token.txf> -r "$BOB_ADDR" --local --save

# Terminal 3-5: 3 concurrent receives
for i in 1 2 3; do
  (SECRET="bob" npm run receive-token -- -f <transfer.txf> --local -o "bob-$i.txf" 2>&1 | tee "log-$i.txt") &
done
wait

# Check results
ls -la bob-*.txf  # Should only see ONE file
grep -l "Transfer Already Submitted" log-*.txt  # Should see 2 logs with this error
```

**Expected Result:**
- 1 process: Creates `bob-1.txf` successfully
- 2 processes: Exit with "Transfer Already Submitted" error

**Current (Broken) Result:**
- 3 processes: All create tokens `bob-1.txf`, `bob-2.txf`, `bob-3.txf`

---

## 8. Summary of Architectural Guarantees

### What Unicity Network Guarantees

1. **RequestId Uniqueness:** Each RequestId can only be in the SMT once
2. **Single Proof per RequestId:** One RequestId = One inclusion proof
3. **Status Code Enforcement:** `REQUEST_ID_EXISTS` returned for duplicates

### What the CLI Must Enforce

1. **Status Code Handling:** Exit on `REQUEST_ID_EXISTS` (CURRENTLY BROKEN)
2. **Exception Handling:** Never continue on "already exists" errors (CURRENTLY BROKEN)
3. **Submission Tracking:** Only create token if OUR submission succeeded (MISSING)

### The Architecture is Sound

The Unicity Network's double-spend prevention is **architecturally correct**. The aggregator DOES prevent double-spends by rejecting duplicate RequestIds.

The bug is **purely in the CLI's error handling** - it receives the rejection signal but ignores it and continues anyway.

---

## 9. Recommended Implementation

### Minimal Fix (Addresses Root Cause)

**Change 1 line in `receive-token.ts:568`:**

```diff
  if (err.message.includes('already exists')) {
-   console.error('  ℹ Transfer already submitted (continuing...)\n');
+   console.error('\n❌ Transfer Already Submitted\n');
+   process.exit(1);
  }
```

### Comprehensive Fix (Defense in Depth)

Apply all 3 fixes listed in Section 5:
1. Remove dangerous exception handler ← CRITICAL
2. Track submission success with `submittedByUs` flag ← RECOMMENDED
3. Add final safety check before token creation ← OPTIONAL

### Test Fix

Update `test_concurrency.bats:353`:

```diff
  if [[ $success_count -eq 1 ]]; then
    info "✓ Only one concurrent receive succeeded (correct)"
  elif [[ $success_count -eq 2 ]]; then
-   info "⚠ Both receives succeeded (possible duplicate submission)"
+   fail "SECURITY BUG: Both receives succeeded (double-spend vulnerability)"
  else
    info "Both receives failed (may be network issue)"
  fi
```

---

## 10. Technical Details: SDK Behavior

### SDK Method: submitTransferCommitment

```typescript
// From StateTransitionClient.js
async submitTransferCommitment(commitment: TransferCommitment) {
  return this.client.submitCommitment(
    commitment.requestId,
    commitment.transactionHash,
    commitment.authenticator
  );
}
```

### Aggregator API Response

**First submission:**
```json
{
  "status": "SUCCESS",
  "requestId": "00001234..."
}
```

**Duplicate submission:**
```json
{
  "status": "REQUEST_ID_EXISTS",
  "requestId": "00001234..."
}
```

OR SDK may throw exception:
```
Error: RequestId already exists in SMT
```

**The CLI MUST handle BOTH cases** - checking `response.status` AND catching exceptions.

---

## Conclusion

**Root Cause:** Exception handler at line 568 continues execution instead of exiting.

**Impact:** HIGH - Allows double-spend via concurrent receives.

**Fix Complexity:** LOW - Single line change (+ defense-in-depth enhancements).

**Architectural Soundness:** The Unicity Network's design is correct. The aggregator properly prevents double-spends. This is purely a CLI error handling bug.

**User's Statement Confirmed:** "The aggregator will never produce three alternative Unicity proofs for the same requestId" is **100% CORRECT**. All 3 processes get the **SAME** proof because they query the same RequestId. The CLI's job is to ensure only the process that successfully submitted creates a token.
