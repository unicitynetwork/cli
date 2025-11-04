# Double-Spend Prevention & Concurrency Test Scenarios

**Version**: 1.0
**Date**: 2025-11-03
**Purpose**: Comprehensive testing of double-spend attack vectors, race conditions, and concurrent operation safety

---

## Document Overview

This document provides **in-depth test scenarios** specifically focused on:
1. **Double-spend attack vectors** - All possible ways an attacker could spend the same token twice
2. **Race conditions** - Concurrent operations that could lead to inconsistent state
3. **Transaction ordering** - Out-of-order submission and chain integrity
4. **Multi-device scenarios** - Same user operating from multiple devices
5. **Network timing issues** - Delays, retries, and partial submissions

This complements existing test documentation:
- TEST_SCENARIOS.md (96 functional tests)
- SECURITY_TEST_SCENARIOS.md (68 security tests including SEC-DBLSPEND-001 to 006)
- CORNER_CASE_TEST_SCENARIOS.md (127 edge case tests)

**Total Scenarios in This Document**: 22 (All P0 or P1 priority)

---

## Table of Contents

1. [Double-Spend Attack Vectors](#1-double-spend-attack-vectors)
2. [Race Conditions in Concurrent Operations](#2-race-conditions-in-concurrent-operations)
3. [Transaction Chain Manipulation](#3-transaction-chain-manipulation)
4. [Multi-Device Scenarios](#4-multi-device-scenarios)
5. [Network Timing and Retry Scenarios](#5-network-timing-and-retry-scenarios)
6. [File System Concurrency](#6-file-system-concurrency)
7. [Prevention Mechanisms Summary](#7-prevention-mechanisms-summary)

---

## Architecture Context

### How Double-Spend Prevention Works

The Unicity network prevents double-spending through:

1. **Sparse Merkle Tree (SMT)**: Tracks all spent token states on-chain
2. **Request ID Uniqueness**: Each transaction has a unique request ID
3. **State Hash Verification**: Token state is cryptographically committed
4. **BFT Consensus**: Validators agree on transaction order atomically
5. **Inclusion Proofs**: Cryptographic proof of transaction inclusion

### Key SDK Methods

```typescript
// Check if token state is spent on-chain
StateTransitionClient.getTokenStatus(trustBase, token, ownerPublicKey)
// Returns: InclusionProofVerificationStatus.OK (SPENT) or PATH_NOT_INCLUDED (UNSPENT)

// Submit transfer commitment
StateTransitionClient.submitTransferCommitment(transferCommitment)
// Network validates: signature, state exists, state not already spent

// Get inclusion proof (polls until available)
StateTransitionClient.getInclusionProof(commitment)
// Returns proof with authenticator once transaction is in SMT
```

---

## 1. Double-Spend Attack Vectors

### DBLSPEND-001: Same State, Different Recipients (Sequential)

**Priority**: P0 (Critical)
**Category**: Classic Double-Spend

**Description**: Alice mints token, sends to Bob, then tries to send same source state to Carol.

**Attack Vector**: Attacker creates two transfer commitments from the same token state, attempts to submit both.

**Prerequisites**:
```bash
# Alice mints a token
SECRET="alice-secret-12345" npm run mint-token -- \
  --preset nft \
  -d '{"name":"test-nft"}' \
  -o alice-nft.txf
```

**Execution Steps**:
```bash
# Terminal 1: Alice creates transfer to Bob
SECRET="alice-secret-12345" npm run send-token -- \
  -f alice-nft.txf \
  -r "DIRECT://$(SECRET="bob-secret" npm run gen-address | jq -r '.address')" \
  -o transfer-to-bob.txf

# Terminal 2: Alice tries to send ORIGINAL token to Carol (same source state)
SECRET="alice-secret-12345" npm run send-token -- \
  -f alice-nft.txf \
  -r "DIRECT://$(SECRET="carol-secret" npm run gen-address | jq -r '.address')" \
  -o transfer-to-carol.txf

# Bob submits first
SECRET="bob-secret" npm run receive-token -- \
  -f transfer-to-bob.txf \
  -o bob-nft.txf

# Carol tries to submit second
SECRET="carol-secret" npm run receive-token -- \
  -f transfer-to-carol.txf \
  -o carol-nft.txf
```

**Expected Behavior**:
- ✅ Bob's `receive-token` succeeds
- ✅ Token state marked as SPENT in network SMT
- ❌ Carol's `receive-token` fails with error: "Token state already spent" or "Request already exists"
- ❌ Carol does not get valid token file
- ✅ Clear error message: "This token has already been transferred"

**Prevention Mechanism**:
- Network tracks token state hash in SMT
- Once Bob's transaction is included, Alice's original state is marked SPENT
- Carol's submission references same source state → network rejects

**Verification**:
```bash
# Verify Bob owns the token
npm run verify-token -- -f bob-nft.txf
# Should show: Status CONFIRMED, Owner: Bob's address

# Verify Alice's original token is outdated
npm run verify-token -- -f alice-nft.txf
# Should show: "Token state is outdated - transferred elsewhere"
```

---

### DBLSPEND-002: Same State, Different Recipients (Concurrent)

**Priority**: P0 (Critical)
**Category**: Race Condition Double-Spend

**Description**: Alice creates offline transfers to both Bob and Carol simultaneously, both try to submit at the same time.

**Attack Vector**: Race condition - two recipients submit transfer commitments concurrently.

**Prerequisites**:
```bash
# Alice mints token
SECRET="alice-secret" npm run mint-token -- --preset nft -o alice-nft.txf
```

**Execution Steps**:
```bash
# Alice creates TWO offline packages from SAME source token
SECRET="alice-secret" npm run send-token -- \
  -f alice-nft.txf \
  -r "DIRECT://bob-address" \
  -o package-for-bob.txf

SECRET="alice-secret" npm run send-token -- \
  -f alice-nft.txf \
  -r "DIRECT://carol-address" \
  -o package-for-carol.txf

# Bob and Carol submit SIMULTANEOUSLY in different terminals
# Terminal 1:
SECRET="bob-secret" npm run receive-token -- -f package-for-bob.txf &

# Terminal 2 (immediately, within 100ms):
SECRET="carol-secret" npm run receive-token -- -f package-for-carol.txf &

# Wait for both to complete
wait
```

**Expected Behavior**:
- ✅ ONE submission succeeds (Bob OR Carol, not both)
- ❌ OTHER submission fails with network error
- ✅ Network consensus ensures atomic decision
- ✅ Loser gets error: "Request already exists" or "Token already spent"
- ✅ No partial state - either fully accepted or fully rejected
- ✅ Only one valid token file created

**Prevention Mechanism**:
- BFT consensus orders transactions atomically
- Network validators agree on single transaction order
- First commitment to be ordered wins
- Second commitment is rejected as duplicate spend

**Verification**:
```bash
# Check both result files
test -f bob-nft.txf && echo "Bob succeeded" || echo "Bob failed"
test -f carol-nft.txf && echo "Carol succeeded" || echo "Carol failed"

# Verify winner has valid token
npm run verify-token -- -f <winner>-nft.txf
# Should show: CONFIRMED status, valid ownership
```

---

### DBLSPEND-003: Replay Attack (Same Commitment, Multiple Times)

**Priority**: P0 (Critical)
**Category**: Replay Attack

**Description**: Attacker intercepts a valid transfer commitment and tries to replay it multiple times.

**Attack Vector**: Submit the same transfer commitment multiple times to network.

**Prerequisites**:
```bash
# Alice creates transfer to Bob
SECRET="alice-secret" npm run mint-token -- --preset nft -o alice.txf
SECRET="alice-secret" npm run send-token -- \
  -f alice.txf \
  -r "DIRECT://bob-address" \
  -o bob-package.txf
```

**Execution Steps**:
```bash
# Bob receives token (first submission)
SECRET="bob-secret" npm run receive-token -- \
  -f bob-package.txf \
  -o bob-token-1.txf

# Attacker copies bob-package.txf and tries to receive again
# (simulating Bob trying to receive same package twice)
cp bob-package.txf bob-package-replay.txf

SECRET="bob-secret" npm run receive-token -- \
  -f bob-package-replay.txf \
  -o bob-token-2.txf
```

**Expected Behavior**:
- ✅ First submission succeeds
- ✅ Network records request ID in SMT
- ❌ Second submission fails immediately
- ❌ Error: "Request already submitted" or "Duplicate transaction"
- ✅ No duplicate tokens created
- ✅ Network ignores replay attempt

**Prevention Mechanism**:
- Each `TransferCommitment` has unique `requestId` based on:
  - Token ID
  - Current state hash
  - Transfer salt
  - Recipient address
- Network tracks all request IDs in SMT
- Duplicate request ID → immediate rejection

**Verification**:
```bash
# Check that only one token file exists
test -f bob-token-1.txf && echo "First submission succeeded"
test ! -f bob-token-2.txf && echo "Replay prevented"

# Verify original package is now outdated
npm run verify-token -- -f bob-package.txf
# Should show: "Pending transfer already submitted" or similar
```

---

### DBLSPEND-004: Postponed Double-Spend (Offline Package Hold)

**Priority**: P0 (Critical)
**Category**: Time-Delayed Double-Spend

**Description**: Alice creates offline transfer to Bob, Bob delays submission. Meanwhile, Alice creates another transfer to Carol. Bob submits first → succeeds. Carol submits second → should fail.

**Attack Vector**: Offline package created but not immediately submitted; sender creates competing package.

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- --preset nft -o alice.txf
```

**Execution Steps**:
```bash
# Day 1: Alice creates transfer to Bob (offline package)
SECRET="alice-secret" npm run send-token -- \
  -f alice.txf \
  -r "DIRECT://bob-address" \
  -m "For Bob, created Monday" \
  -o monday-package-for-bob.txf

# Bob receives the file but DOES NOT SUBMIT yet

# Day 2: Alice (not knowing Bob hasn't submitted) creates transfer to Carol
# This uses the SAME source state from alice.txf
SECRET="alice-secret" npm run send-token -- \
  -f alice.txf \
  -r "DIRECT://carol-address" \
  -m "For Carol, created Tuesday" \
  -o tuesday-package-for-carol.txf

# Day 3: Bob finally submits (2 days later)
SECRET="bob-secret" npm run receive-token -- \
  -f monday-package-for-bob.txf \
  -o bob-token.txf

# Day 4: Carol tries to submit
SECRET="carol-secret" npm run receive-token -- \
  -f tuesday-package-for-carol.txf \
  -o carol-token.txf
```

**Expected Behavior**:
- ✅ Bob's submission succeeds (Monday package processed on Wednesday)
- ✅ Token state marked SPENT when Bob submits
- ❌ Carol's submission fails (Tuesday package now invalid)
- ❌ Error: "Token state already spent" or "Source state not found"
- ✅ Network doesn't care about creation time, only submission order
- ✅ Offline packages can become invalid while waiting

**Prevention Mechanism**:
- Network only cares about submission order, not creation time
- Both packages reference same source state hash
- Whoever submits first wins
- Loser's package references spent state → rejected

**User Impact**:
- Senders should mark original token as TRANSFERRED after creating offline package
- Recipients should submit packages promptly
- CLI shows warning when token is in PENDING status

**Verification**:
```bash
# Bob has valid token
npm run verify-token -- -f bob-token.txf
# Status: CONFIRMED

# Alice's original token is outdated
npm run verify-token -- -f alice.txf
# Shows: "Token state is outdated - transferred elsewhere"

# Carol's package is invalid
test ! -f carol-token.txf && echo "Carol's submission failed correctly"
```

---

### DBLSPEND-005: Submit-Now Race (10 Concurrent Submissions)

**Priority**: P0 (Critical)
**Category**: Extreme Race Condition

**Description**: Simulate extreme race condition with 10 concurrent `send-token --submit-now` attempts from the same token.

**Attack Vector**: Mass concurrent submission to stress-test network consensus.

**Prerequisites**:
```bash
# Alice mints token
SECRET="alice-secret" npm run mint-token -- --preset nft -o alice.txf

# Generate 10 recipient addresses
for i in {1..10}; do
  SECRET="recipient-$i" npm run gen-address > recipient-$i.json
done
```

**Execution Steps**:
```bash
# Launch 10 concurrent send-token operations with --submit-now
for i in {1..10}; do
  RECIPIENT=$(jq -r '.address' recipient-$i.json)
  (
    SECRET="alice-secret" npm run send-token -- \
      -f alice.txf \
      -r "$RECIPIENT" \
      --submit-now \
      -o result-$i.txf 2>&1 | tee log-$i.txt
  ) &
done

# Wait for all to complete
wait

# Count successes and failures
ls result-*.txf 2>/dev/null | wc -l
grep -l "error\|Error\|ERROR" log-*.txt | wc -l
```

**Expected Behavior**:
- ✅ Exactly ONE submission succeeds
- ❌ All 9 other submissions fail
- ✅ No race condition allows multiple successes
- ✅ Network consensus atomic across all validators
- ✅ Failures report: "Request already exists" or "Token spent"
- ✅ Only ONE result-*.txf file with TRANSFERRED status
- ✅ No network state corruption

**Prevention Mechanism**:
- BFT consensus ensures total ordering of transactions
- Network validators must agree (2/3+ majority) on order
- First transaction to achieve consensus wins
- All others rejected as duplicate spend
- Request ID uniqueness enforced globally

**Verification**:
```bash
# Count successful token files
SUCCESS_COUNT=$(ls result-*.txf 2>/dev/null | wc -l)
if [ "$SUCCESS_COUNT" -eq 1 ]; then
  echo "✅ Exactly one success - double-spend prevented"
else
  echo "❌ FAILURE: $SUCCESS_COUNT successes (expected 1)"
fi

# Verify the successful token
SUCCESS_FILE=$(ls result-*.txf | head -1)
npm run verify-token -- -f "$SUCCESS_FILE"
# Should show: TRANSFERRED status
```

---

### DBLSPEND-006: Modified Recipient in Flight

**Priority**: P1 (High)
**Category**: Commitment Manipulation

**Description**: Attacker intercepts offline package, modifies recipient address in `offlineTransfer` field (but can't modify signed commitment), tries to submit.

**Attack Vector**: Man-in-the-middle modifies package metadata.

**Prerequisites**:
```bash
# Alice creates transfer to Bob
SECRET="alice-secret" npm run mint-token -- --preset nft -o alice.txf
SECRET="alice-secret" npm run send-token -- \
  -f alice.txf \
  -r "DIRECT://bob-address" \
  -o bob-package.txf
```

**Execution Steps**:
```bash
# Attacker intercepts bob-package.txf
# Manually edit JSON: change offlineTransfer.recipient to attacker's address
# (But can't change commitmentData because it's cryptographically signed)

jq '.offlineTransfer.recipient = "DIRECT://attacker-address"' \
  bob-package.txf > modified-package.txf

# Attacker tries to receive with their secret
SECRET="attacker-secret" npm run receive-token -- \
  -f modified-package.txf \
  -o attacker-token.txf
```

**Expected Behavior**:
- ❌ Submission fails with signature verification error
- ❌ Network rejects because:
  - Commitment is signed with Bob's address as recipient
  - Attacker's predicate doesn't match commitment
- ❌ Error: "Signature verification failed" or "Predicate mismatch"
- ✅ Attacker cannot steal transfer by modifying package

**Prevention Mechanism**:
- `TransferCommitment` cryptographically commits to recipient address
- Signature covers entire commitment including recipient
- Network validates signature against recipient in commitment
- Metadata modification doesn't affect cryptographic verification

**Verification**:
```bash
# Attacker should not get token
test ! -f attacker-token.txf && echo "✅ Attack prevented"

# Original package still valid for Bob
SECRET="bob-secret" npm run receive-token -- \
  -f bob-package.txf \
  -o bob-token.txf
# Should succeed
```

---

### DBLSPEND-007: Parallel Offline Package Creation

**Priority**: P1 (High)
**Category**: Multiple Offline Packages

**Description**: Create multiple offline transfer packages from same token in rapid succession (without --submit-now).

**Attack Vector**: Generate many offline packages quickly, distribute to multiple recipients, see if multiple can be fulfilled.

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- --preset nft -o alice.txf

# Generate recipient addresses
for i in {1..5}; do
  SECRET="recipient-$i" npm run gen-address > recipient-$i.json
done
```

**Execution Steps**:
```bash
# Create 5 offline packages simultaneously
for i in {1..5}; do
  RECIPIENT=$(jq -r '.address' recipient-$i.json)
  SECRET="alice-secret" npm run send-token -- \
    -f alice.txf \
    -r "$RECIPIENT" \
    -o package-$i.txf &
done
wait

# Verify all 5 packages created
ls package-*.txf | wc -l

# Try to submit all 5 packages
for i in {1..5}; do
  SECRET="recipient-$i" npm run receive-token -- \
    -f package-$i.txf \
    -o result-$i.txf 2>&1 | tee submit-log-$i.txt &
done
wait
```

**Expected Behavior**:
- ✅ All 5 offline packages create successfully (all have PENDING status)
- ✅ CLI allows creating multiple offline packages (no client-side prevention)
- ✅ When submitted to network:
  - Exactly ONE submission succeeds
  - All 4 others fail with "Token already spent"
- ⚠️ Warning: This behavior is allowed but dangerous
- 💡 Best Practice: Mark original token as TRANSFERRED after creating package

**Prevention Mechanism**:
- Client allows multiple package creation (by design for flexibility)
- Network enforces single-spend rule at submission time
- All packages reference same source state
- First to submit wins, others rejected

**User Education**:
- Creating multiple offline packages is technically possible
- Only ONE can ever be successfully submitted
- Sender should track which package they intend to honor
- CLI should warn: "Warning: Multiple offline packages from same token detected"

**Verification**:
```bash
# Count successful submissions
SUCCESS_COUNT=$(ls result-*.txf 2>/dev/null | wc -l)
echo "Successful submissions: $SUCCESS_COUNT (expected: 1)"

# Check error messages in logs
grep -h "error\|Error" submit-log-*.txt
# Should show 4 errors about "already spent"
```

---

## 2. Race Conditions in Concurrent Operations

### RACE-001: Concurrent Receive Operations (Same Package)

**Priority**: P0 (Critical)
**Category**: File System Race

**Description**: Two processes try to receive the same offline package simultaneously (e.g., user double-clicks or runs command twice).

**Attack Vector**: Accidental double-submission from same device.

**Prerequisites**:
```bash
# Alice creates transfer to Bob
SECRET="alice-secret" npm run mint-token -- --preset nft -o alice.txf
SECRET="alice-secret" npm run send-token -- \
  -f alice.txf \
  -r "DIRECT://bob-address" \
  -o bob-package.txf
```

**Execution Steps**:
```bash
# Bob accidentally runs receive-token twice simultaneously
SECRET="bob-secret" npm run receive-token -- \
  -f bob-package.txf \
  -o bob-token-1.txf &

# Immediately (within 10ms)
SECRET="bob-secret" npm run receive-token -- \
  -f bob-package.txf \
  -o bob-token-2.txf &

wait
```

**Expected Behavior**:
- ✅ First process succeeds, submits to network
- ❌ Second process fails with "Request already submitted"
- ✅ Network prevents duplicate submission
- ✅ Only one output file created
- ⚠️ Potential issue: Both processes might try to write same file
  - If `-o` not specified, auto-generated filename might conflict

**Prevention Mechanism**:
- Network-level: Request ID deduplication
- Client-level: File system handles concurrent writes
- Recommendation: Add client-side lock file or check before submission

**Verification**:
```bash
# Check output files
test -f bob-token-1.txf && echo "Process 1 output exists"
test -f bob-token-2.txf && echo "Process 2 output exists"

# Both should not exist (or one should be error)
# At most one should be valid CONFIRMED token
npm run verify-token -- -f bob-token-1.txf 2>/dev/null
npm run verify-token -- -f bob-token-2.txf 2>/dev/null
```

---

### RACE-002: Concurrent Send Operations (Different Recipients)

**Priority**: P1 (High)
**Category**: Token Modification Race

**Description**: Two processes try to create offline packages from same token file simultaneously.

**Attack Vector**: User opens two terminals and creates two transfers at exactly the same time.

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- --preset nft -o alice.txf
```

**Execution Steps**:
```bash
# Terminal 1 and 2 simultaneously
SECRET="alice-secret" npm run send-token -- \
  -f alice.txf \
  -r "DIRECT://bob-address" \
  -o package-bob.txf &

SECRET="alice-secret" npm run send-token -- \
  -f alice.txf \
  -r "DIRECT://carol-address" \
  -o package-carol.txf &

wait
```

**Expected Behavior**:
- ✅ Both offline packages create successfully
- ✅ Both reference same source state
- ✅ No file corruption (read-only operation on alice.txf)
- ⚠️ User now has two competing packages
- 💡 User must choose which one to honor

**Prevention Mechanism**:
- No prevention at creation time (by design)
- Prevention happens at network submission
- User responsibility to manage offline packages

**Current Behavior**:
- CLI allows this scenario
- No warning issued

**Recommendation**:
```bash
# Add check in send-token command:
if [ token.status == "PENDING" ]; then
  echo "⚠️  Warning: Token already has pending transfer"
  echo "Creating multiple offline packages is risky"
  echo "Only ONE package can be successfully submitted"
fi
```

---

### RACE-003: Concurrent Verify Operations (Network Query Storm)

**Priority**: P2 (Medium)
**Category**: Network Resource Usage

**Description**: Multiple processes verify same token simultaneously, causing concurrent `getTokenStatus()` calls.

**Attack Vector**: Resource exhaustion or rate limiting issues.

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- --preset nft -o alice.txf
```

**Execution Steps**:
```bash
# Launch 20 concurrent verify operations
for i in {1..20}; do
  npm run verify-token -- -f alice.txf > verify-$i.txt &
done
wait

# Check all results are consistent
md5sum verify-*.txt | awk '{print $1}' | sort -u | wc -l
# Should be 1 (all identical outputs)
```

**Expected Behavior**:
- ✅ All 20 operations succeed
- ✅ All return consistent results
- ✅ Network handles concurrent read queries
- ✅ No rate limiting issues (reasonable concurrent queries)
- ⚠️ Higher counts (100+) might trigger rate limits

**Prevention Mechanism**:
- Read operations are safe (no state modification)
- Network designed for high read throughput
- Aggregator may implement rate limiting

**Verification**:
```bash
# All outputs should be identical
UNIQUE_OUTPUTS=$(md5sum verify-*.txt | awk '{print $1}' | sort -u | wc -l)
if [ "$UNIQUE_OUTPUTS" -eq 1 ]; then
  echo "✅ Consistent results across all concurrent verifications"
else
  echo "⚠️ Inconsistent results detected"
fi
```

---

### RACE-004: Send Then Immediately Verify

**Priority**: P1 (High)
**Category**: State Propagation Timing

**Description**: User sends token with --submit-now, immediately verifies in another terminal before inclusion proof completes.

**Attack Vector**: Verify operation sees inconsistent state during transaction processing.

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- --preset nft -o alice.txf
```

**Execution Steps**:
```bash
# Terminal 1: Send token (will take ~2-5 seconds for inclusion proof)
SECRET="alice-secret" npm run send-token -- \
  -f alice.txf \
  -r "DIRECT://bob-address" \
  --submit-now \
  -o sent-token.txf &

# Terminal 2: Immediately verify (within 100ms)
sleep 0.1
npm run verify-token -- -f alice.txf > verify-during-send.txt

# Wait for send to complete
wait

# Verify after send completes
npm run verify-token -- -f alice.txf > verify-after-send.txt
```

**Expected Behavior**:
- During send (verify-during-send.txt):
  - ⚠️ May show: "Token is current and ready to use" (state not yet spent)
  - ⚠️ Or: "Token state is outdated" (if send already submitted)
  - Depends on exact timing
- After send (verify-after-send.txt):
  - ✅ Should show: "Token state is outdated - transferred elsewhere"
  - ✅ On-chain status: SPENT

**Prevention Mechanism**:
- No prevention needed - this is expected behavior
- Verify shows point-in-time state
- User should wait for send to complete before verifying

**User Impact**:
- Brief window where verify might show "current" while send is in progress
- Once inclusion proof obtained, state immediately reflects as SPENT

---

### RACE-005: File Read During Write

**Priority**: P2 (Medium)
**Category**: File System Synchronization

**Description**: One process writes token file while another process reads it.

**Attack Vector**: Partial or corrupted file read.

**Prerequisites**:
```bash
# Create token
SECRET="alice-secret" npm run mint-token -- --preset nft -o alice.txf

# Create transfer package
SECRET="alice-secret" npm run send-token -- \
  -f alice.txf \
  -r "DIRECT://bob-address" \
  -o package.txf
```

**Execution Steps**:
```bash
# Terminal 1: Receive token (writes bob-token.txf)
SECRET="bob-secret" npm run receive-token -- \
  -f package.txf \
  -o bob-token.txf &

# Terminal 2: Repeatedly try to read the same file
for i in {1..100}; do
  npm run verify-token -- -f bob-token.txf 2>&1 | tee verify-attempt-$i.txt &
  sleep 0.01
done
wait
```

**Expected Behavior**:
- Before write completes:
  - ❌ File doesn't exist → "File not found" errors
- During write:
  - ⚠️ Possible partial read → JSON parse error
  - File system should provide atomicity
- After write completes:
  - ✅ Successful reads with valid token data

**Prevention Mechanism**:
- File system provides atomic write guarantees for `fs.writeFileSync()`
- Reads might see old version or new version, not partial
- Recommendation: Use atomic file write pattern (write temp file, then rename)

**Current Implementation**:
```typescript
// send-token.ts and receive-token.ts
fs.writeFileSync(outputFile, outputJson);
// Direct write - not atomic across all file systems
```

**Recommendation**:
```typescript
// Use atomic write pattern
import { writeFileSync, renameSync } from 'fs';
const tempFile = `${outputFile}.tmp.${Date.now()}`;
writeFileSync(tempFile, outputJson);
renameSync(tempFile, outputFile);  // Atomic on POSIX systems
```

---

## 3. Transaction Chain Manipulation

### CHAIN-001: Out-of-Order Transaction Submission

**Priority**: P0 (Critical)
**Category**: Chain Integrity

**Description**: Attacker tries to submit transactions out of chronological order (e.g., submit transaction 3 before transaction 2).

**Attack Vector**: Break transaction chain continuity.

**Prerequisites**:
```bash
# Create chain: Alice -> Bob -> Carol -> Dave
SECRET="alice-secret" npm run mint-token -- --preset nft -o alice.txf

SECRET="alice-secret" npm run send-token -- \
  -f alice.txf -r "DIRECT://bob-address" -o pkg1.txf

SECRET="bob-secret" npm run receive-token -- -f pkg1.txf -o bob.txf

SECRET="bob-secret" npm run send-token -- \
  -f bob.txf -r "DIRECT://carol-address" -o pkg2.txf

SECRET="carol-secret" npm run receive-token -- -f pkg2.txf -o carol.txf

# Now carol.txf represents state after 2 transfers
```

**Execution Steps**:
```bash
# Carol creates transfer to Dave (pkg3.txf references Carol's state)
SECRET="carol-secret" npm run send-token -- \
  -f carol.txf -r "DIRECT://dave-address" -o pkg3.txf

# Attacker tries to re-submit pkg2 (Bob->Carol) after Carol already spent
SECRET="carol-secret" npm run receive-token -- -f pkg2.txf -o attack.txf
```

**Expected Behavior**:
- ❌ Re-submission of pkg2 fails
- ❌ Error: "Request already exists" (if pkg2 was already submitted)
- ❌ Or: "State already spent" (if Carol's send already processed)
- ✅ Network enforces linear chain progression
- ✅ Cannot replay old transactions after state has evolved

**Prevention Mechanism**:
- Each transaction references specific source state hash
- Network tracks which states are spent
- Once Carol sends to Dave, her state is spent
- Cannot go back and re-execute Bob->Carol transition

---

### CHAIN-002: Forked Transaction Chain

**Priority**: P1 (High)
**Category**: Chain Branching

**Description**: Create two different transaction chains from same genesis (simulate blockchain fork).

**Attack Vector**: Attempt to maintain two parallel histories for same token.

**Prerequisites**:
```bash
# Mint token
SECRET="alice-secret" npm run mint-token -- --preset nft -o genesis.txf
```

**Execution Steps**:
```bash
# Branch A: Alice -> Bob
SECRET="alice-secret" npm run send-token -- \
  -f genesis.txf -r "DIRECT://bob-address" --submit-now -o branch-a-bob.txf

# Try Branch B: Alice -> Carol (from same genesis)
SECRET="alice-secret" npm run send-token -- \
  -f genesis.txf -r "DIRECT://carol-address" --submit-now -o branch-b-carol.txf
```

**Expected Behavior**:
- ✅ Branch A succeeds (Bob gets token)
- ❌ Branch B fails (Carol doesn't get token)
- ✅ Network only accepts one branch
- ✅ State is globally unique - no forking possible
- ❌ Error: "Token state already spent"

**Prevention Mechanism**:
- Global state consensus via BFT
- Token state hash is unique across entire network
- No parallel histories possible
- Linear transaction chain enforced

---

### CHAIN-003: Missing Transaction in Chain

**Priority**: P1 (High)
**Category**: Chain Completeness

**Description**: Token file has gap in transaction history (transaction 2 missing, but has 1 and 3).

**Attack Vector**: Manipulate token file to hide intermediate transactions.

**Prerequisites**:
```bash
# Create 3-transaction chain
SECRET="alice-secret" npm run mint-token -- --preset nft -o t0.txf
SECRET="alice-secret" npm run send-token -- \
  -f t0.txf -r "DIRECT://bob" --submit-now -o t1.txf
SECRET="bob-secret" npm run send-token -- \
  -f t1.txf -r "DIRECT://carol" --submit-now -o t2.txf
SECRET="carol-secret" npm run send-token -- \
  -f t2.txf -r "DIRECT://dave" --submit-now -o t3.txf
```

**Execution Steps**:
```bash
# Manually edit t3.txf and remove transaction 2 (Bob->Carol)
# Keep genesis, tx1 (Alice->Bob), tx3 (Carol->Dave)
jq '.transactions = [.transactions[0], .transactions[2]]' t3.txf > modified.txf

# Try to use modified token
npm run verify-token -- -f modified.txf
SECRET="dave-secret" npm run send-token -- -f modified.txf -r "DIRECT://eve"
```

**Expected Behavior**:
- ❌ Verification should detect chain break
- ❌ Error: "Transaction chain integrity violated"
- ❌ State hash doesn't match transaction history
- ✅ Cannot use token with incomplete history

**Prevention Mechanism**:
- Each transaction commits to previous state hash
- State evolution must be verifiable
- Missing transaction breaks hash chain
- Proof validation detects tampering

**Current Gap**: CLI may not fully validate chain continuity
**Recommendation**: Add validation in `verify-token`:
```typescript
// Verify transaction chain continuity
for (let i = 1; i < transactions.length; i++) {
  const prevTx = transactions[i-1];
  const currentTx = transactions[i];
  // Verify currentTx references prevTx's output state
}
```

---

### CHAIN-004: Receive Before Sender's State is Spent

**Priority**: P0 (Critical)
**Category**: Premature Receipt

**Description**: Recipient tries to spend token before submitting their receive transaction (tries to spend pending state).

**Attack Vector**: Skip receive step and directly create transfer from pending state.

**Prerequisites**:
```bash
# Alice creates offline package for Bob
SECRET="alice-secret" npm run mint-token -- --preset nft -o alice.txf
SECRET="alice-secret" npm run send-token -- \
  -f alice.txf -r "DIRECT://bob-address" -o bob-package.txf
```

**Execution Steps**:
```bash
# Bob receives package but doesn't submit to network yet
# Instead, Bob manually constructs token with:
#   - Alice's state (not yet transferred)
#   - Bob's predicate (not yet valid)
# This is difficult to do without modifying CLI

# Simulate: Bob manually creates token file showing himself as owner
# without actually having received the token on-chain

# Bob tries to send this "fake" token to Carol
SECRET="bob-secret" npm run send-token -- \
  -f fake-bob-token.txf \
  -r "DIRECT://carol-address" \
  --submit-now
```

**Expected Behavior**:
- ❌ Network rejects Bob's transfer
- ❌ Error: "Source state not found" or "Invalid state"
- ✅ Bob's predicate doesn't match on-chain state
- ✅ Network only recognizes Alice's state (still unspent)
- ✅ Bob must complete receive before he can send

**Prevention Mechanism**:
- Network validates source state exists and matches token
- Bob's transfer references his state (which doesn't exist on-chain yet)
- Must submit receive first to create Bob's state on-chain
- Linear progression enforced

---

## 4. Multi-Device Scenarios

### MULTIDEV-001: Same Token on Two Devices

**Priority**: P0 (Critical)
**Category**: Multi-Device Double-Spend

**Description**: User has same token file on laptop and phone, tries to send from both.

**Attack Vector**: User accidentally sends token from two devices thinking they have different tokens.

**Prerequisites**:
```bash
# User mints token and syncs to multiple devices
SECRET="user-secret" npm run mint-token -- --preset nft -o token.txf

# Copy to "device 2"
cp token.txf device2-token.txf
```

**Execution Steps**:
```bash
# Device 1: User sends to Bob
SECRET="user-secret" npm run send-token -- \
  -f token.txf \
  -r "DIRECT://bob-address" \
  --submit-now \
  -o device1-result.txf &

# Device 2: User sends to Carol (simultaneously)
SECRET="user-secret" npm run send-token -- \
  -f device2-token.txf \
  -r "DIRECT://carol-address" \
  --submit-now \
  -o device2-result.txf &

wait
```

**Expected Behavior**:
- ✅ One device succeeds (Bob OR Carol gets token)
- ❌ Other device fails with "Token already spent"
- ✅ Network prevents double-spend across devices
- ⚠️ User confused why one device failed
- 💡 User needs device synchronization strategy

**Prevention Mechanism**:
- Network consensus doesn't care about device
- Same source state, same prevention mechanism
- BFT ordering ensures one transaction wins

**User Education Needed**:
- Token files should have authoritative location
- After sending, mark token as TRANSFERRED
- Implement sync mechanism to update all devices
- Consider wallet architecture with single source of truth

---

### MULTIDEV-002: Offline Package on Multiple Devices

**Priority**: P1 (High)
**Category**: Offline Package Distribution

**Description**: Alice sends offline package to Bob via email AND messenger (two copies), Bob tries to receive both.

**Attack Vector**: User receives duplicate packages, tries to claim twice.

**Prerequisites**:
```bash
# Alice creates package
SECRET="alice-secret" npm run mint-token -- --preset nft -o alice.txf
SECRET="alice-secret" npm run send-token -- \
  -f alice.txf -r "DIRECT://bob-address" -o package.txf

# Alice sends package.txf to Bob via two channels
cp package.txf package-email.txf
cp package.txf package-messenger.txf
```

**Execution Steps**:
```bash
# Bob downloads from email, receives token
SECRET="bob-secret" npm run receive-token -- \
  -f package-email.txf -o bob-token-1.txf

# Bob also downloads from messenger, tries to receive again
SECRET="bob-secret" npm run receive-token -- \
  -f package-messenger.txf -o bob-token-2.txf
```

**Expected Behavior**:
- ✅ First receive succeeds
- ❌ Second receive fails: "Request already submitted"
- ✅ Network deduplicates identical requests
- ✅ Bob only gets one token

**Prevention Mechanism**:
- Request ID is deterministic based on commitment
- Identical packages have identical request IDs
- Network rejects duplicate request ID

---

### MULTIDEV-003: Stale Token File Usage

**Priority**: P1 (High)
**Category**: State Synchronization

**Description**: User transfers token on device 1, then tries to use stale copy on device 2 days later.

**Attack Vector**: Outdated token files not updated across devices.

**Prerequisites**:
```bash
# User mints token
SECRET="user-secret" npm run mint-token -- --preset nft -o token.txf
cp token.txf device2-token.txf

# Device 1: User transfers to Bob
SECRET="user-secret" npm run send-token -- \
  -f token.txf -r "DIRECT://bob-address" --submit-now -o sent.txf
```

**Execution Steps**:
```bash
# Days later, on device 2 (not updated)
# User tries to send from stale token file
SECRET="user-secret" npm run send-token -- \
  -f device2-token.txf \
  -r "DIRECT://carol-address" \
  --submit-now
```

**Expected Behavior**:
- ❌ Send fails: "Token state already spent"
- ⚠️ User sees error but may be confused
- 💡 `verify-token` would show: "Token is outdated"

**Prevention Mechanism**:
- Network tracks current state
- Stale file references old state hash
- Network rejects transaction from spent state

**User Experience Improvement**:
```bash
# Before sending, verify token is current
npm run verify-token -- -f device2-token.txf
# Shows: "⚠️ Token state is outdated - transferred elsewhere"
# User realizes they need to sync devices
```

---

## 5. Network Timing and Retry Scenarios

### TIMING-001: Submission Timeout and Retry

**Priority**: P1 (High)
**Category**: Network Reliability

**Description**: Network slow to respond, user cancels and retries submission.

**Attack Vector**: User thinks first attempt failed, submits again.

**Prerequisites**:
```bash
# Create transfer package
SECRET="alice-secret" npm run mint-token -- --preset nft -o alice.txf
SECRET="alice-secret" npm run send-token -- \
  -f alice.txf -r "DIRECT://bob-address" -o package.txf
```

**Execution Steps**:
```bash
# Bob starts receive (simulates slow network)
SECRET="bob-secret" npm run receive-token -- \
  -f package.txf -o bob-token.txf &

PID1=$!

# Wait a bit, then user gets impatient and hits Ctrl+C
sleep 3
kill $PID1

# User tries again
SECRET="bob-secret" npm run receive-token -- \
  -f package.txf -o bob-token-retry.txf
```

**Expected Behavior**:
Case 1: First attempt submitted but not yet confirmed
- ✅ Second attempt sees "Request already submitted"
- ✅ Can safely complete second attempt
- ✅ Both attempts reference same request ID

Case 2: First attempt only partially sent
- ✅ Second attempt completes submission
- ✅ Network handles idempotently

**Prevention Mechanism**:
- Request ID makes submissions idempotent
- Network tracks request ID, not submission count
- Safe to retry if uncertain

**Current Behavior**:
```typescript
// receive-token.ts handles this:
try {
  await client.submitTransferCommitment(transferCommitment);
} catch (err) {
  if (err instanceof Error && err.message.includes('already exists')) {
    console.error('ℹ Transfer already submitted (continuing...)');
  } else {
    throw err;
  }
}
```

---

### TIMING-002: Inclusion Proof Timeout

**Priority**: P1 (High)
**Category**: Proof Availability

**Description**: Submission succeeds but inclusion proof never arrives (network issue).

**Attack Vector**: Transaction submitted but proof polling times out.

**Prerequisites**:
```bash
# Create package
SECRET="alice-secret" npm run mint-token -- --preset nft -o alice.txf
SECRET="alice-secret" npm run send-token -- \
  -f alice.txf -r "DIRECT://bob-address" -o package.txf
```

**Execution Steps**:
```bash
# Simulate network that accepts submission but doesn't provide proof
# (Requires network manipulation or mock)

# In real scenario, this would timeout after 60 seconds
SECRET="bob-secret" npm run receive-token -- \
  -f package.txf -o bob-token.txf
```

**Expected Behavior**:
- ✅ Submission succeeds (transaction in network)
- ❌ Polling times out after 60 seconds
- ❌ Error: "Timeout waiting for inclusion proof"
- ⚠️ Token state updated but proof not received
- 💡 User can retry later with `get-request` command

**Recovery Path**:
```bash
# Extract request ID from error message or package
REQUEST_ID="<request_id_from_package>"

# Use get-request to retrieve proof later
npm run get-request -- -e https://gateway.unicity.network $REQUEST_ID
```

**Current Implementation**:
```typescript
// send-token.ts and receive-token.ts
const inclusionProof = await waitInclusionProof(
  client,
  transferCommitment,
  60000,  // 60 second timeout
  1000    // 1 second polling interval
);
```

---

### TIMING-003: Partial Network Partition

**Priority**: P2 (Medium)
**Category**: Network Partition

**Description**: User submits transaction, network partition occurs, transaction included but user doesn't receive confirmation.

**Attack Vector**: Network split during transaction processing.

**Prerequisites**: Requires network manipulation (difficult to test in production)

**Execution Steps**:
```bash
# Submit transaction
SECRET="alice-secret" npm run send-token -- \
  -f token.txf -r "DIRECT://bob" --submit-now -o result.txf

# Simulate network partition during inclusion proof wait
# (Requires iptables or network emulation)
```

**Expected Behavior**:
- Transaction may be included in network
- Client timeout error
- User should verify status later
- Can use `verify-token` to check final state

**Prevention Mechanism**:
- BFT consensus tolerates network partitions
- Transaction either committed or not (atomic)
- User can verify later to determine outcome

---

## 6. File System Concurrency

### FILESYS-001: Simultaneous Write to Same Output File

**Priority**: P2 (Medium)
**Category**: File System Race

**Description**: Two processes try to write to exact same output file path.

**Attack Vector**: File corruption or data loss.

**Prerequisites**:
```bash
# Create two different packages
SECRET="alice-secret" npm run mint-token -- --preset nft -o token1.txf
SECRET="alice-secret" npm run mint-token -- --preset nft -o token2.txf

SECRET="alice-secret" npm run send-token -- \
  -f token1.txf -r "DIRECT://bob" -o pkg1.txf
SECRET="alice-secret" npm run send-token -- \
  -f token2.txf -r "DIRECT://bob" -o pkg2.txf
```

**Execution Steps**:
```bash
# Two processes write to same output file
SECRET="bob-secret" npm run receive-token -- \
  -f pkg1.txf -o result.txf &

SECRET="bob-secret" npm run receive-token -- \
  -f pkg2.txf -o result.txf &

wait
```

**Expected Behavior**:
- ⚠️ One write overwrites the other
- ⚠️ result.txf contains only one token (whichever finished last)
- ⚠️ No error reported to user
- ❌ Silent data loss of first token

**Prevention Mechanism**:
- Currently no prevention
- File system allows concurrent writes
- Last write wins

**Recommendation**:
```typescript
// Check if output file exists before writing
if (fs.existsSync(outputFile)) {
  console.error(`⚠️  Warning: ${outputFile} already exists`);
  console.error('Overwriting existing file. Consider using different filename.');
}
```

---

### FILESYS-002: Directory Permission Race

**Priority**: P3 (Low)
**Category**: File System Permissions

**Description**: Output directory permissions change between check and write.

**Attack Vector**: TOCTOU (Time of Check, Time of Use) vulnerability.

**Prerequisites**:
```bash
mkdir output-dir
chmod 755 output-dir

SECRET="alice-secret" npm run mint-token -- --preset nft -o alice.txf
SECRET="alice-secret" npm run send-token -- \
  -f alice.txf -r "DIRECT://bob" -o pkg.txf
```

**Execution Steps**:
```bash
# Start receive operation
SECRET="bob-secret" npm run receive-token -- \
  -f pkg.txf -o output-dir/result.txf &

# Immediately change directory permissions
sleep 0.5
chmod 000 output-dir

wait
```

**Expected Behavior**:
- ❌ Write fails with EACCES error
- ✅ Clear error message
- ✅ No partial file written

**Prevention Mechanism**:
- File system enforces permissions
- Node.js fs operations fail with exception
- CLI error handling catches and reports

---

## 7. Prevention Mechanisms Summary

### Network-Level Protections

| Mechanism | What It Prevents | Implementation |
|-----------|------------------|----------------|
| **Sparse Merkle Tree (SMT)** | Tracks spent states globally | Network consensus layer |
| **Request ID Uniqueness** | Duplicate transaction submission | Deterministic ID based on commitment |
| **State Hash Verification** | Token state tampering | Cryptographic commitment |
| **BFT Consensus** | Race conditions in concurrent submissions | 2/3+ validator agreement required |
| **Inclusion Proofs** | Unconfirmed transactions | Cryptographic proof of inclusion in SMT |
| **Signature Verification** | Unauthorized spending | Public key cryptography |

### Client-Level Protections

| Mechanism | What It Prevents | Implementation |
|-----------|------------------|----------------|
| **Proof Validation** | Invalid inclusion proofs | `validateInclusionProof()` in CLI |
| **Structure Validation** | Malformed token files | `validateTokenProofsJson()` |
| **Status Tracking** | Spending pending/transferred tokens | TokenStatus enum enforcement |
| **Ownership Verification** | Using outdated tokens | `checkOwnershipStatus()` in verify-token |

### Current Gaps

1. **Client-Side Status Enforcement** (P1):
   - `send-token` doesn't check if token status is PENDING or TRANSFERRED
   - User can create multiple offline packages without warning

2. **Concurrent File Operations** (P2):
   - No locking mechanism for file writes
   - Simultaneous writes to same file can cause silent data loss

3. **Device Synchronization** (P2):
   - No built-in mechanism to sync token state across devices
   - Users must manually manage file copies

4. **Retry Guidance** (P3):
   - When inclusion proof times out, user isn't guided on recovery
   - Should recommend using `get-request` command

---

## Test Execution Priority

### Phase 1: Critical Double-Spend Tests (P0)
Run these first - blocking issues:
- DBLSPEND-001: Same State, Different Recipients (Sequential)
- DBLSPEND-002: Same State, Different Recipients (Concurrent)
- DBLSPEND-003: Replay Attack
- DBLSPEND-004: Postponed Double-Spend
- DBLSPEND-005: Submit-Now Race (10 Concurrent)
- RACE-001: Concurrent Receive Operations
- CHAIN-001: Out-of-Order Transaction Submission
- CHAIN-004: Receive Before Sender's State is Spent
- MULTIDEV-001: Same Token on Two Devices

### Phase 2: High Priority Race Conditions (P1)
Important but not blocking:
- DBLSPEND-006: Modified Recipient in Flight
- DBLSPEND-007: Parallel Offline Package Creation
- RACE-002: Concurrent Send Operations
- RACE-004: Send Then Immediately Verify
- CHAIN-002: Forked Transaction Chain
- CHAIN-003: Missing Transaction in Chain
- MULTIDEV-002: Offline Package on Multiple Devices
- MULTIDEV-003: Stale Token File Usage
- TIMING-001: Submission Timeout and Retry
- TIMING-002: Inclusion Proof Timeout

### Phase 3: Medium Priority Edge Cases (P2)
Nice to have coverage:
- RACE-003: Concurrent Verify Operations
- RACE-005: File Read During Write
- TIMING-003: Partial Network Partition
- FILESYS-001: Simultaneous Write to Same Output File

### Phase 4: Low Priority Edge Cases (P3)
Performance and rare scenarios:
- FILESYS-002: Directory Permission Race

---

## Automated Test Script

```bash
#!/bin/bash
# double-spend-test-suite.sh

echo "=== Double-Spend Prevention Test Suite ==="
echo "Running critical tests..."

PASS=0
FAIL=0

# Test DBLSPEND-001
echo "Running DBLSPEND-001: Sequential Double-Spend"
SECRET="alice" npm run mint-token -- --preset nft -o /tmp/test-token.txf
SECRET="alice" npm run send-token -- -f /tmp/test-token.txf -r "DIRECT://bob" -o /tmp/pkg1.txf
SECRET="alice" npm run send-token -- -f /tmp/test-token.txf -r "DIRECT://carol" -o /tmp/pkg2.txf

SECRET="bob" npm run receive-token -- -f /tmp/pkg1.txf -o /tmp/bob.txf
if [ $? -eq 0 ]; then
  echo "✅ Bob received token"
  PASS=$((PASS+1))
else
  echo "❌ Bob failed to receive"
  FAIL=$((FAIL+1))
fi

SECRET="carol" npm run receive-token -- -f /tmp/pkg2.txf -o /tmp/carol.txf
if [ $? -ne 0 ]; then
  echo "✅ Carol correctly rejected"
  PASS=$((PASS+1))
else
  echo "❌ Carol should have been rejected"
  FAIL=$((FAIL+1))
fi

echo ""
echo "=== Test Results ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
```

---

## Conclusion

This document provides **22 comprehensive test scenarios** specifically focused on double-spend prevention, race conditions, and concurrent operations. These tests are critical for ensuring:

1. **Network Security**: Double-spend attacks are prevented at protocol level
2. **Data Integrity**: Token state remains consistent across operations
3. **User Safety**: Multi-device and concurrent usage doesn't cause loss
4. **System Reliability**: Race conditions don't corrupt state

**Key Findings**:
- ✅ Network-level double-spend prevention is robust (BFT + SMT)
- ⚠️ Client-level protections have some gaps (status enforcement, file locking)
- ⚠️ User education needed for multi-device scenarios
- ⚠️ Retry and recovery paths need better documentation

**Recommended Immediate Actions**:
1. Add status check before send-token (prevent PENDING/TRANSFERRED sends)
2. Implement atomic file write pattern (prevent file corruption)
3. Add warning for multiple offline package creation
4. Document recovery paths for timeout scenarios
5. Create device synchronization best practices guide

---

**Document Status**: ✅ Complete
**Test Coverage**: 22 scenarios covering all major double-spend attack vectors
**Priority**: P0 (Critical) - Essential for production deployment
