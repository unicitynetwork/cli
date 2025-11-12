# Proof Verification Audit: Unicity CLI Commands

## Executive Summary

**Audit Status:** PARTIAL - Critical gaps identified in proof correspondence verification

This audit analyzes how all Unicity CLI commands that work with inclusion proofs handle cryptographic proof verification, specifically **proof correspondence checking** (verifying that a proof matches its associated state and transaction).

### Key Findings:

1. **receive-token.ts** ✅ **IMPLEMENTED** - Steps 10.5 includes complete proof correspondence verification
2. **send-token.ts** ⚠️ **PARTIAL** - Validates proof structure only, missing correspondence checks for submitted transfers
3. **mint-token.ts** ⚠️ **PARTIAL** - Validates proof structure only, missing correspondence checks for genesis
4. **verify-token.ts** ⚠️ **PARTIAL** - Validates proof structure and cryptographic signatures, missing correspondence checks for display purposes
5. **get-request.ts** ✅ **N/A** - Does not work with proofs (fetch only)
6. **register-request.ts** ✅ **N/A** - Does not work with proofs (registration only)

## Detailed Command Analysis

### 1. receive-token.ts - Complete Implementation ✅

**Status:** FULLY IMPLEMENTED

#### Current Implementation (Lines 606-724):

The command performs comprehensive proof correspondence verification in **Step 10.5**:

**Verification 1: Source State Correspondence (CRITICAL)**
```typescript
// Lines 642-671
const proofSourceStateHash = proofAuthenticator.stateHash;
const ourSourceState = transferCommitment.transactionData.sourceState;
const ourSourceStateHash = await ourSourceState.calculateHash();

if (!proofSourceStateHash.equals(ourSourceStateHash)) {
  // SECURITY ERROR: Proof is for WRONG source state
  process.exit(1);
}
```

**Verification 2: Transaction Hash Match (Double-Spend Detection)**
```typescript
// Lines 675-721
const proofTxHash = inclusionProof.transactionHash;
const ourTxHash = await transferCommitment.transactionData.calculateHash();

if (proofTxHashHex !== ourTxHashHex) {
  // DOUBLE-SPEND DETECTED - different recipient's transaction
  process.exit(1);
}
```

**What it checks:**
- ✅ Proof authenticator.stateHash matches source state hash
- ✅ Proof transactionHash matches our transfer transaction hash
- ✅ Detects if another recipient's transfer was submitted first
- ✅ Prevents accepting proofs for wrong states or transactions

**What it doesn't check:**
- Recipient data hash correspondence (covered by Step 4.5 state data validation)
- Proof matches transfer commitment expectations (Step 9.5 validates proof structure)

---

### 2. send-token.ts - Partial Implementation ⚠️

**Status:** MISSING CRITICAL PROOF CORRESPONDENCE CHECKS

#### Current Implementation:

**Pattern A (Offline Transfer) - Lines 410-450:**
```typescript
// Creates offline transfer package WITHOUT submitting to network
// NO PROOF involvement - this is correct
// Returns TXF with PENDING status and commitmentData
```

**Pattern B (Submit Now) - Lines 372-407:**
```typescript
// Step 6: Create transfer commitment
const transferCommitment = await TransferCommitment.create(...)

// Step 7: Submit to network
await client.submitTransferCommitment(transferCommitment);

// Step 8: Wait for inclusion proof
const inclusionProof = await waitInclusionProof(client, transferCommitment);

// Step 9: Create transfer transaction
const transferTransaction = transferCommitment.toTransaction(inclusionProof);
```

**PROBLEM IDENTIFIED:**
The command does **NOT verify proof correspondence** after receiving the proof!

Missing verification (similar to receive-token Step 10.5):
1. ❌ Does NOT verify proof.authenticator.stateHash matches our source state
2. ❌ Does NOT verify proof.transactionHash matches our transaction hash
3. ❌ Does NOT check for double-spend (another recipient's tx in aggregator)

#### Risk Analysis:

**Scenario 1: Byzantine Aggregator Returns Wrong Proof**
```
Sender submits: Transfer from State_A to Recipient_Bob
Aggregator returns: Proof for Transfer from State_A to Recipient_Eve

Send-token (current):
  - Creates transaction with this proof
  - Trusts proof.transactionHash without verification
  - Returns token with WRONG transaction data

Result: Bob receives token but data is for Eve's transfer
```

**Scenario 2: Transaction Hash Mismatch Undetected**
```
Sender creates: Transfer requesting 100 tokens
Aggregator returns: Proof for transfer of 1000 tokens

Send-token (current):
  - Accepts the proof blindly
  - Creates transaction with wrong transaction hash
  - Returns invalid token
```

#### Recommended Fix:

Add proof correspondence verification after Step 8 (receiving proof):

```typescript
// AFTER: const inclusionProof = await waitInclusionProof(...)

// NEW STEP 8.5: Verify proof corresponds to our transfer
console.error('Step 8.5: Verifying proof corresponds to our transfer...');

// Check 1: Source state correspondence
const proofSourceStateHash = inclusionProof.authenticator.stateHash;
const ourSourceStateHash = await transferCommitment.transactionData.sourceState.calculateHash();

if (!proofSourceStateHash.equals(ourSourceStateHash)) {
  console.error('SECURITY ERROR: Proof is for wrong source state');
  process.exit(1);
}

// Check 2: Transaction hash match
const proofTxHash = inclusionProof.transactionHash;
const ourTxHash = await transferCommitment.transactionData.calculateHash();

if (!HexConverter.encode(proofTxHash.imprint).equals(
    HexConverter.encode(ourTxHash.imprint))) {
  console.error('SECURITY ERROR: Proof is for wrong transaction (double-spend or corruption)');
  process.exit(1);
}

console.error('  ✓ Proof corresponds to our transfer');
```

---

### 3. mint-token.ts - Partial Implementation ⚠️

**Status:** MISSING CORRESPONDENCE CHECKS FOR GENESIS PROOFS

#### Current Implementation (Lines 476-503):

```typescript
// Step 6: Wait for inclusion proof
const inclusionProof = await waitInclusionProof(client, mintCommitment);

// Step 6.5: Validate the inclusion proof
const proofValidation = await validateInclusionProof(
  inclusionProof,
  mintCommitment.requestId,
  trustBase
);

if (!proofValidation.valid) {
  // Error handling
}
```

**What it checks:**
- ✅ Proof structure (authenticator, transactionHash, merkleTreePath)
- ✅ Authenticator signature verification (via validateInclusionProof)
- ✅ Merkle path verification

**What it DOESN'T check:**
- ❌ Genesis proof authenticator.stateHash corresponds to what?
  - For genesis (mint), the source state is special: SHA256(tokenId || "MINT")
  - The proof's authenticator.stateHash should be hash of MintTransactionState
  - This is NOT verified against the mint's transaction data

#### Special Genesis Considerations:

Genesis transactions have a unique source state (not a previous token state):
```
Source State Hash (for genesis) = SHA256(tokenId || "MINT")
```

The proof's authenticator.stateHash should correspond to this computed hash.

#### Risk Analysis:

**Scenario: Invalid Genesis Proof Accepted**
```
Aggregator returns proof for:
  - Different tokenId
  - Different mint data

Mint-token (current):
  - Checks proof signature (correct)
  - Checks merkle path (correct)
  - Does NOT verify source state matches expected genesis source
  - Creates token with invalid genesis

Result: Token has unverifiable genesis state
```

#### Recommended Fix:

Add genesis source state verification after Step 6.5:

```typescript
// AFTER: const proofValidation = await validateInclusionProof(...)

// NEW STEP 6.7: Verify genesis proof source state correspondence
console.error('Step 6.7: Verifying genesis proof source state...');

const genesisSourceStateHash = await MintTransactionState.create(tokenId).calculateHash();
const proofSourceStateHash = inclusionProof.authenticator.stateHash;

if (!genesisSourceStateHash.equals(proofSourceStateHash)) {
  console.error('SECURITY ERROR: Proof source state does not match expected genesis source');
  console.error(`  Expected: ${HexConverter.encode(genesisSourceStateHash.imprint)}`);
  console.error(`  Proof has: ${HexConverter.encode(proofSourceStateHash.imprint)}`);
  process.exit(1);
}

// Also verify transaction hash matches our mint transaction
const proofTxHash = inclusionProof.transactionHash;
const ourTxHash = await mintCommitment.transactionData.calculateHash();

if (!HexConverter.encode(proofTxHash.imprint).equals(
    HexConverter.encode(ourTxHash.imprint))) {
  console.error('SECURITY ERROR: Proof transaction hash does not match our mint transaction');
  process.exit(1);
}

console.error('  ✓ Genesis proof source state corresponds correctly');
```

---

### 4. verify-token.ts - Partial Implementation ⚠️

**Status:** VALIDATES SIGNATURES BUT MISSING CORRESPONDENCE CHECKS

#### Current Implementation (Lines 247-324):

```typescript
// Step 1: JSON structural validation
console.log('\n=== Proof Validation (JSON) ===');
const jsonProofValidation = validateTokenProofsJson(tokenJson);

// Step 2: SDK proof loading and cryptographic validation
token = await Token.fromJSON(tokenJson);
const trustBase = await getCachedTrustBase(...);
const sdkProofValidation = await validateTokenProofs(token, trustBase);
```

**What it checks:**
- ✅ Proof structure completeness (authenticator, transactionHash, merkleTreePath)
- ✅ Authenticator signature validity (line 273, 289 in proof-validation.ts)
- ✅ Merkle path verification using SDK
- ✅ SDK comprehensive verification (state data hash matching)

**What it DOESN'T check:**
- ❌ Genesis proof source state correspondence
- ❌ Transaction proof source state correspondence (does proof match expected source?)

#### Risk Analysis:

**Scenario: Verify-token Accepts Mismatched Proofs**
```
Token contains:
  Transaction 1: Transfer from State_A to Bob
  Proof 1: Contains different source state hash

verify-token (current):
  - Checks proof signature (valid)
  - Checks merkle path (valid)
  - Verifies state.data hash matches transaction
  - But does NOT verify proof.authenticator.stateHash == source state hash

Result: User verifies token as valid, but proof is for wrong source state
         If transferred elsewhere, could detect double-spend during receive
```

#### Note on Verify-Token Purpose:

Verify-token is primarily a **diagnostic/display tool** and signature validator, not a **transfer validator**. However, it should:
- Warn if proof source state doesn't match expected state
- Flag suspicious mismatches for manual investigation

#### Recommended Enhancement:

Add optional correspondence validation warnings:

```typescript
// AFTER: SDK proof validation (around line 289)

// OPTIONAL ENHANCEMENT: Verify proof correspondence
if (token && !options.skipCorrespondenceCheck) {
  console.log('\n=== Proof Correspondence Validation (Optional) ===');

  // For genesis
  if (token.genesis && token.genesis.inclusionProof) {
    try {
      const genesisSourceHash = await MintTransactionState.create(token.id).calculateHash();
      const proofSourceHash = token.genesis.inclusionProof.authenticator.stateHash;

      if (!genesisSourceHash.equals(proofSourceHash)) {
        console.log('⚠ WARNING: Genesis proof source state does not match expected');
      } else {
        console.log('✓ Genesis proof source state matches');
      }
    } catch (err) {
      console.log('⚠ Could not verify genesis proof source state correspondence');
    }
  }

  // For transactions
  // Similar checks for each transaction...
}
```

---

### 5. get-request.ts - Not Applicable ✅

**Status:** N/A - Command does not work with proofs

This command only **fetches** inclusion proofs from the aggregator, it does not create or verify them.

No action needed.

---

### 6. register-request.ts - Not Applicable ✅

**Status:** N/A - Command does not work with proofs

This command only **registers** state transitions, it does not handle inclusion proofs.

No action needed.

---

## Proof Correspondence Verification Concepts

### What is Proof Correspondence?

In Unicity Network, a proof must correspond to specific data:

**For Genesis (Mint) Transactions:**
```
Expected Source State = SHA256(tokenId || "MINT")
Proof must have: authenticator.stateHash = Expected Source State

Expected Transaction = Hash of MintTransactionData
Proof must have: transactionHash = Expected Transaction
```

**For Transfer Transactions:**
```
Expected Source State = Hash of previous token state
Proof must have: authenticator.stateHash = Expected Source State

Expected Transaction = Hash of TransferTransactionData
Proof must have: transactionHash = Expected Transaction
```

### Why Correspondence Matters (Security Model):

1. **Byzantine Aggregator Protection:**
   - Aggregator could return proofs for wrong states/transactions
   - Correspondence verification ensures we got the right proof

2. **Double-Spend Detection:**
   - If multiple recipients submit transfers from same source
   - Aggregator accepts first one
   - Subsequent recipients' proofs show DIFFERENT transactionHash
   - Correspondence verification detects this mismatch

3. **State Integrity:**
   - Ensures proof's source state matches our expectations
   - Prevents accepting proofs for corrupted/tampered state data

### Implementation Pattern (Tested in receive-token):

```typescript
// Step 1: Calculate expected values
const expectedSourceStateHash = await sourceState.calculateHash();
const expectedTxHash = await transactionData.calculateHash();

// Step 2: Compare with proof values
const proofSourceStateHash = proof.authenticator.stateHash;
const proofTxHash = proof.transactionHash;

// Step 3: Reject if mismatch
if (!expectedSourceStateHash.equals(proofSourceStateHash)) {
  throw new Error('Proof is for wrong source state');
}

if (!proofTxHash.equals(expectedTxHash)) {
  throw new Error('Proof is for wrong transaction (double-spend detected)');
}
```

---

## Test Coverage Analysis

### Current Test Coverage:

**Tests verifying proof correspondence in receive-token:**
- ✅ `test_receive_token_crypto.bats` - Tests cryptographic validation
- ✅ `test_double_spend.bats` - Tests transaction hash mismatch detection
- ✅ `test_double_spend_advanced.bats` - Tests advanced double-spend scenarios

**Tests for send-token proof handling:**
- ⚠️ Limited - No tests specifically validating proof correspondence for Pattern B
- ✅ Test structure validation (proof has required fields)
- ❌ Missing: Tests for wrong source state detection
- ❌ Missing: Tests for transaction hash mismatch detection

**Tests for mint-token proof handling:**
- ⚠️ Limited - No tests specifically validating genesis proof correspondence
- ✅ Test structure validation
- ✅ Test signature verification
- ❌ Missing: Tests for wrong source state hash
- ❌ Missing: Tests for wrong tokenId in proof

**Tests for verify-token:**
- ✅ Comprehensive - Tests all proof validation aspects
- ✅ Tests signature verification
- ✅ Tests merkle path validation
- ❌ Missing: Tests for proof/state correspondence (optional enhancement)

### Recommended New Tests:

#### For send-token (Pattern B):

1. **TEST-SEND-PATTERN-B-001: Proof source state mismatch detection**
   ```
   Scenario:
   1. Alice sends token to Bob
   2. Aggregator returns proof with wrong source state hash
   3. send-token must reject with SECURITY ERROR
   ```

2. **TEST-SEND-PATTERN-B-002: Proof transaction hash mismatch detection**
   ```
   Scenario:
   1. Alice sends to Bob, aggregator returns proof for different recipient
   2. send-token detects transactionHash mismatch
   3. Must reject with DOUBLE-SPEND warning
   ```

#### For mint-token:

1. **TEST-MINT-001: Genesis proof source state correspondence**
   ```
   Scenario:
   1. Mint token, aggregator returns proof with wrong tokenId in source
   2. mint-token must reject with SECURITY ERROR
   ```

2. **TEST-MINT-002: Genesis transaction hash mismatch**
   ```
   Scenario:
   1. Mint token, aggregator returns proof for different mint data
   2. mint-token must reject
   ```

---

## Implementation Priority and Roadmap

### Priority 1 (CRITICAL - Security Vulnerability):

**send-token Pattern B - Add Proof Correspondence Verification**

**File:** `/home/vrogojin/cli/src/commands/send-token.ts`

**Changes:**
- Add Step 8.5 after receiving proof (line 388)
- Verify source state hash correspondence
- Verify transaction hash correspondence
- Exit with error if mismatch

**Estimated Effort:** 15-20 minutes
**Risk Level:** Low (receive-token already has working implementation)
**Security Impact:** CRITICAL - Prevents Byzantine aggregator attacks

### Priority 2 (HIGH - Security Hardening):

**mint-token - Add Genesis Proof Correspondence Verification**

**File:** `/home/vrogojin/cli/src/commands/mint-token.ts`

**Changes:**
- Add Step 6.7 after proof validation (line 503)
- Verify genesis source state hash
- Verify transaction hash correspondence
- Warn if mismatch

**Estimated Effort:** 15-20 minutes
**Risk Level:** Low
**Security Impact:** HIGH - Detects invalid genesis proofs

### Priority 3 (MEDIUM - Assurance):

**verify-token - Add Optional Correspondence Validation**

**File:** `/home/vrogojin/cli/src/commands/verify-token.ts`

**Changes:**
- Add optional flag `--check-correspondence`
- Display warnings if proofs don't match expected values
- Purely informational (doesn't block verification)

**Estimated Effort:** 20-25 minutes
**Risk Level:** Very Low (optional, diagnostic only)
**Security Impact:** MEDIUM - Better diagnostics for problem investigation

### Priority 4 (DOCUMENTATION):

**Update CLAUDE.md with proof verification guidance**

**File:** `/home/vrogojin/cli/CLAUDE.md`

**Add section:**
- Proof correspondence verification pattern
- When to verify source state vs transaction hash
- Common pitfalls (genesis special case)

**Estimated Effort:** 10 minutes

---

## Security Impact Summary

### Current State:

| Command | Proof Validation | Correspondence | Risk |
|---------|------------------|-----------------|------|
| receive-token | ✅ Full | ✅ Full | SECURE |
| send-token | ✅ Structure | ❌ None | **VULNERABLE** |
| mint-token | ✅ Structure + Sig | ❌ Genesis source | **VULNERABLE** |
| verify-token | ✅ Full | ⚠️ Optional | MEDIUM |

### After Fixes:

| Command | Proof Validation | Correspondence | Risk |
|---------|------------------|-----------------|------|
| receive-token | ✅ Full | ✅ Full | SECURE |
| send-token | ✅ Full | ✅ Full | SECURE |
| mint-token | ✅ Full | ✅ Full | SECURE |
| verify-token | ✅ Full | ⚠️ Optional | SECURE |

---

## Detailed Implementation Guide

### Pattern: Proof Correspondence Verification

**Location:** After receiving proof from aggregator, before using it

**Code Template:**

```typescript
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';

// Step: Verify proof corresponds to our commitment
console.error('Step X.Y: Verifying proof correspondence...');

// 1. Get the expected source state hash
const expectedSourceStateHash = await sourceState.calculateHash();
const proofSourceStateHash = proof.authenticator.stateHash;

// 2. Verify source state correspondence
if (!expectedSourceStateHash.equals(proofSourceStateHash)) {
  console.error('\n❌ SECURITY ERROR: Proof is for wrong source state!');
  console.error(`Expected: ${HexConverter.encode(expectedSourceStateHash.imprint)}`);
  console.error(`Proof has: ${HexConverter.encode(proofSourceStateHash.imprint)}`);
  console.error('\nThis indicates Byzantine aggregator behavior or proof corruption.');
  process.exit(1);
}

// 3. Get the expected transaction hash
const expectedTxHash = await transactionData.calculateHash();
const proofTxHash = proof.transactionHash;
const expectedTxHashHex = HexConverter.encode(expectedTxHash.imprint);
const proofTxHashHex = HexConverter.encode(proofTxHash.imprint);

// 4. Verify transaction hash correspondence
if (expectedTxHashHex !== proofTxHashHex) {
  console.error('\n❌ DOUBLE-SPEND OR CORRUPTION DETECTED!');
  console.error(`Expected transaction hash: ${expectedTxHashHex}`);
  console.error(`Proof transaction hash:    ${proofTxHashHex}`);
  console.error('\nThis indicates the aggregator has a different transaction in the tree.');
  process.exit(1);
}

console.error('  ✓ Proof corresponds to our transaction');
```

---

## Architectural Notes

### Why Genesis is Special:

Genesis (mint) transactions don't have a "previous" token state. The source state for genesis is artificial:

```typescript
// MintTransactionState has fixed structure
const genesisSourceState = new MintTransactionState(tokenId);
const genesisSourceHash = await genesisSourceState.calculateHash();

// Proof's authenticator.stateHash should equal this
```

This is why mint-token needs special handling compared to transfers.

### RequestId Computation:

RequestId is computed from:
```
RequestId = SHA256(publicKey || stateHash)
```

The aggregator uses RequestId to:
1. Store the proof in the merkle tree
2. Prevent duplicate submissions
3. Allow recipients to query proof status

Proof correspondence verification ensures RequestId is computed from the state we expect.

---

## Checklist for Implementation

- [ ] **send-token Pattern B proof correspondence check**
  - [ ] Verify source state hash
  - [ ] Verify transaction hash
  - [ ] Exit on mismatch
  - [ ] Add test case

- [ ] **mint-token genesis proof correspondence check**
  - [ ] Compute expected genesis source state
  - [ ] Verify authenticator.stateHash
  - [ ] Verify transactionHash
  - [ ] Exit on mismatch
  - [ ] Add test case

- [ ] **verify-token optional correspondence validation**
  - [ ] Add `--check-correspondence` flag
  - [ ] Display results
  - [ ] Don't fail on mismatch
  - [ ] Add test case

- [ ] **Documentation updates**
  - [ ] Update CLAUDE.md
  - [ ] Add proof verification pattern
  - [ ] Document genesis special case
  - [ ] Add security notes

- [ ] **Test additions**
  - [ ] Send-token Pattern B mismatch tests
  - [ ] Mint-token genesis mismatch tests
  - [ ] Verify-token correspondence tests
  - [ ] All tests should verify correct rejection

---

## Conclusion

The Unicity CLI has implemented robust proof verification for the **receive-token** command, including critical proof correspondence checks that detect double-spending and Byzantine aggregator behavior.

However, **send-token** and **mint-token** commands are missing these crucial verification steps, creating a security gap when users submit transactions to the network via the "Pattern B" mechanism or when initially minting tokens.

Implementing the recommended fixes for send-token and mint-token will ensure end-to-end cryptographic proof validation across all commands that interact with the aggregator, providing complete protection against:
- Byzantine aggregator attacks
- Double-spend attempts
- Proof tampering and corruption
- Invalid genesis states

**Estimated Total Implementation Time:** 45-60 minutes for all three commands + documentation + tests

