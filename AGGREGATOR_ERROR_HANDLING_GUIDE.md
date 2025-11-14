# Aggregator Error Handling Guide - Correct SDK Interpretation

## Executive Summary

The CLI has **incorrect error handling** that treats normal "unspent" states as errors. This guide provides the authoritative interpretation of Unicity SDK aggregator responses.

---

## Core Principle: Sparse Merkle Tree Semantics

### RequestId in SMT = State is SPENT
### RequestId NOT in SMT = State is UNSPENT

The Sparse Merkle Tree (SMT) records **consumed states**. When a token state is spent in a transfer, its RequestId (derived from `hash(publicKey + stateHash)`) gets recorded in the tree.

---

## SDK Method: getTokenStatus()

### Method Signature
```typescript
async getTokenStatus(
  trustBase: RootTrustBase, 
  token: Token<any>, 
  publicKey: Uint8Array
): Promise<InclusionProofVerificationStatus>
```

### Return Values

| Status | Meaning | Interpretation |
|--------|---------|----------------|
| `PATH_NOT_INCLUDED` | RequestId NOT in SMT | **State is UNSPENT** (normal, current) |
| `OK` | RequestId IS in SMT | **State is SPENT** (consumed in transfer) |
| `NOT_AUTHENTICATED` | Authenticator signature invalid | **Error** (corrupted proof) |
| `PATH_INVALID` | Merkle path broken | **Error** (corrupted proof) |

### How It Works Internally

```typescript
// 1. Compute RequestId from token state
const requestId = await RequestId.create(publicKey, stateHash);

// 2. Query aggregator for inclusion proof
const proof = await aggregatorClient.getInclusionProof(requestId);

// 3. Verify proof cryptographically
const status = await proof.verify(trustBase, requestId);

// 4. Return status
return status;
```

---

## Understanding HTTP Responses

### Scenario 1: RequestId NOT in SMT (Unspent State)

**Aggregator Response:**
```json
{
  "inclusionProof": {
    "merkleTreePath": {
      "root": "00000c96af7ee2698488293ad37ee7e46facf59adf19517d05b16d8da0d7cbe03b15",
      "steps": [ /* Exclusion proof path */ ]
    },
    "authenticator": null,
    "transactionHash": null,
    "unicityCertificate": "..."
  }
}
```

**Key Indicators:**
- `authenticator: null`
- `transactionHash: null`
- Merkle path shows where RequestId WOULD be if it existed

**SDK Status:** `PATH_NOT_INCLUDED`

**Interpretation:** State is **UNSPENT** - this is **NORMAL** and **EXPECTED** for current tokens.

---

### Scenario 2: RequestId IN SMT (Spent State)

**Aggregator Response:**
```json
{
  "inclusionProof": {
    "merkleTreePath": {
      "root": "00005a10ad4737d79921a407e09a75bb6b4c4a2a468a001c460dfc4a34e1c5d58ed9",
      "steps": [ /* Inclusion proof path */ ]
    },
    "authenticator": {
      "stateHash": "000012345...",
      "signature": "..."
    },
    "transactionHash": "00004c4dba950afb106af1fbc65eebb56d4863c738a04a55fbf5aee9c862da10bddb",
    "unicityCertificate": "..."
  }
}
```

**Key Indicators:**
- `authenticator` is present (non-null)
- `transactionHash` is present (non-null)
- Merkle path shows exact location in tree

**SDK Status:** `OK`

**Interpretation:** State is **SPENT** - token was transferred.

---

### Scenario 3: Network Errors

**HTTP 404 Response:**
- **OLD INTERPRETATION (WRONG):** "Error - proof not found"
- **CORRECT INTERPRETATION:** "RequestId not in SMT yet - proof not available"

**Common Causes:**
1. Proof not generated yet (polling scenario)
2. RequestId never submitted
3. Aggregator round not complete

**Handling:**
```typescript
try {
  const proof = await aggregatorClient.getInclusionProof(requestId);
} catch (err) {
  if (err instanceof JsonRpcNetworkError && err.status === 404) {
    // NORMAL: Proof not available yet (continue polling)
    // OR: RequestId never submitted
    // NOT an error condition!
  }
}
```

**HTTP 503 / ECONNREFUSED:**
- Aggregator temporarily unavailable
- Network connectivity issue
- Should gracefully degrade, not fail

---

## Problem in Current Code

### ownership-verification.ts (Lines 116-138)

**CURRENT CODE (INCORRECT):**
```typescript
try {
  const status = await client.getTokenStatus(trustBase, token, ownerInfo.publicKey);
  
  // PATH_NOT_INCLUDED means the RequestId is not in the SMT = state is UNSPENT
  // OK means the RequestId is in the SMT = state is SPENT
  onChainSpent = status === InclusionProofVerificationStatus.OK;
} catch (err) {
  // PROBLEM: Catches ALL errors, including 404
  // This treats UNSPENT states as errors!
  return {
    scenario: 'error',
    onChainSpent: null,
    currentOwner: ownerInfo.address,
    latestKnownOwner: ownerInfo.address,
    pendingRecipient: null,
    message: 'Cannot verify ownership status - network unavailable',
    details: [
      `Local TXF shows owner: ${ownerInfo.address || 'Unknown'}`,
      `Error: ${err instanceof Error ? err.message : String(err)}`
    ]
  };
}
```

**ISSUE:** 
The SDK's `getTokenStatus()` method does NOT throw exceptions for normal scenarios. It **returns** `PATH_NOT_INCLUDED` or `OK`.

The catch block should only handle **actual network errors**, not normal proof responses.

---

## Correct Implementation

### ownership-verification.ts (Fixed)

```typescript
try {
  const status = await client.getTokenStatus(trustBase, token, ownerInfo.publicKey);
  
  // Interpret status
  if (status === InclusionProofVerificationStatus.OK) {
    // RequestId IN tree = state is SPENT
    onChainSpent = true;
  } else if (status === InclusionProofVerificationStatus.PATH_NOT_INCLUDED) {
    // RequestId NOT in tree = state is UNSPENT
    onChainSpent = false;
  } else {
    // NOT_AUTHENTICATED or PATH_INVALID = corrupted proof
    console.warn(`⚠ Unexpected proof status: ${status}`);
    return {
      scenario: 'error',
      onChainSpent: null,
      currentOwner: ownerInfo.address,
      latestKnownOwner: ownerInfo.address,
      pendingRecipient: null,
      message: 'Proof verification failed - token may be corrupted',
      details: [
        `Proof status: ${status}`,
        `This indicates cryptographic verification failure`
      ]
    };
  }
  
} catch (err) {
  // Only network errors should reach here
  console.warn(`⚠ Network error querying aggregator: ${err instanceof Error ? err.message : String(err)}`);
  
  return {
    scenario: 'error',
    onChainSpent: null,
    currentOwner: ownerInfo.address,
    latestKnownOwner: ownerInfo.address,
    pendingRecipient: null,
    message: 'Cannot verify ownership status - network unavailable',
    details: [
      `Local TXF shows owner: ${ownerInfo.address || 'Unknown'}`,
      `Network error: ${err instanceof Error ? err.message : String(err)}`,
      'Verification requires network connection to aggregator'
    ]
  };
}
```

---

### verify-token.ts (Lines 518-560)

**CURRENT CODE (INCORRECT):**
```typescript
try {
  const ownershipStatus = await checkOwnershipStatus(token, tokenJson, client, trustBase);
  
  console.log(`\n${ownershipStatus.message}`);
  ownershipStatus.details.forEach(detail => {
    console.log(`  ${detail}`);
  });
  
  // Token is spent/outdated = cannot be used
  if (ownershipStatus.scenario === 'outdated') {
    exitCode = 1;
  }
} catch (err) {
  console.log('  ⚠ Cannot verify ownership status');
  console.log(`  Error: ${err instanceof Error ? err.message : String(err)}`);
}
```

**ISSUE:**
The outer try-catch is redundant because `checkOwnershipStatus()` already handles all errors internally and returns a status object. This can mask errors.

**CORRECT CODE:**
```typescript
// checkOwnershipStatus() handles all errors internally
const ownershipStatus = await checkOwnershipStatus(token, tokenJson, client, trustBase);

console.log(`\n${ownershipStatus.message}`);
ownershipStatus.details.forEach(detail => {
  console.log(`  ${detail}`);
});

// Set exit code based on scenario
if (ownershipStatus.scenario === 'outdated') {
  // Token spent elsewhere = cannot be used
  exitCode = 1;
} else if (ownershipStatus.scenario === 'error' && ownershipStatus.onChainSpent !== null) {
  // Cryptographic verification failed (corrupted proof)
  exitCode = 1;
}
// Network errors (onChainSpent === null) do NOT fail verification
```

---

## SDK Behavior Reference

### getTokenStatus() Does NOT Throw For:

1. **Unspent states** - Returns `PATH_NOT_INCLUDED`
2. **Spent states** - Returns `OK`
3. **Exclusion proofs** - Returns `PATH_NOT_INCLUDED`
4. **Inclusion proofs** - Returns `OK`

### getTokenStatus() DOES Throw For:

1. **Network errors** - HTTP errors (503, ECONNREFUSED)
2. **Malformed responses** - JSON parse errors
3. **Connection timeouts** - Network timeouts

### getTokenStatus() Returns Error Status For:

1. **Invalid authenticator** - Returns `NOT_AUTHENTICATED`
2. **Broken merkle path** - Returns `PATH_INVALID`

---

## Idempotent Submissions

### Question: What if same RequestId submitted twice?

**Answer:** The aggregator **allows idempotent submissions** with exact same transaction data.

**Behavior:**
```typescript
// First submission
await client.submitCommitment(commitment1);
// Returns: { requestId: "abc123" }

// Second submission (SAME transaction data)
await client.submitCommitment(commitment1);
// Returns: { requestId: "abc123" } (same as before, idempotent)

// Third submission (DIFFERENT transaction data, same requestId)
await client.submitCommitment(commitment2);
// ERROR: "smt: attempt to modify an existing leaf"
```

**Rule:** Once a RequestId is registered with specific transaction data, it is **immutable**. Attempts to modify will fail.

---

## Polling Patterns

### Correct 404 Handling in Polling

```typescript
async function waitForInclusionProof(
  aggregatorClient: AggregatorClient,
  requestId: RequestId,
  maxAttempts: number = 60
): Promise<InclusionProof> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const proof = await aggregatorClient.getInclusionProof(requestId);
      
      // SUCCESS: Proof available
      console.log('✓ Inclusion proof received');
      return proof;
      
    } catch (err) {
      if (err instanceof JsonRpcNetworkError && err.status === 404) {
        // NORMAL: Proof not generated yet, continue polling
        if (attempt < maxAttempts) {
          await sleep(1000); // Wait 1 second
          continue;
        } else {
          throw new Error('Timeout waiting for inclusion proof');
        }
      } else {
        // ACTUAL ERROR: Network down, malformed response, etc.
        throw err;
      }
    }
  }
}
```

---

## Four Ownership Scenarios

### A. Current (Up-to-Date)

**Condition:** `status === PATH_NOT_INCLUDED` + No pending transfers

**Interpretation:**
- State NOT in SMT (unspent)
- Token is current and ready to use
- No errors

**Display:**
```
✅ Token is current and ready to use
Current Owner: UND://abc123...
On-chain status: UNSPENT
No pending transfers
```

---

### B. Outdated (Spent Elsewhere)

**Condition:** `status === OK` + No matching transaction in TXF

**Interpretation:**
- State IS in SMT (spent)
- Transfer happened from another device
- TXF is out of sync

**Display:**
```
⚠️ Token state is outdated - transferred from another device
Latest Known Owner (from this file): UND://abc123...
On-chain status: SPENT
Current owner: Unknown (no transaction in this TXF)
This TXF file is out of sync with the blockchain
```

---

### C. Pending Transfer

**Condition:** `status === PATH_NOT_INCLUDED` + Has offlineTransfer

**Interpretation:**
- State NOT in SMT (unspent)
- Transfer package created but not submitted
- Waiting for recipient to submit

**Display:**
```
⏳ Pending transfer - not yet submitted to network
Current Owner (on-chain): UND://abc123...
On-chain status: UNSPENT
Pending Transfer To: UND://xyz789...
Transfer package created but recipient has not submitted it yet
```

---

### D. Confirmed Transfer

**Condition:** `status === OK` + Has matching transaction

**Interpretation:**
- State IS in SMT (spent)
- Transfer recorded in both TXF and blockchain
- Successfully completed

**Display:**
```
✅ Transfer confirmed on-chain
Previous Owner: UND://abc123...
Current Owner: UND://xyz789...
On-chain status: SPENT
Transfer recorded in TXF (1 transaction)
```

---

## Testing Verification

### Test Case 1: Current Token (UNSPENT)

```bash
# Mint token
SECRET="alice" npm run mint-token -- --local -d '{"test":"data"}' --save

# Verify immediately
npm run verify-token -- -f <token.txf> --local
```

**Expected:**
- `getTokenStatus()` returns `PATH_NOT_INCLUDED`
- Scenario: "current"
- Exit code: 0

---

### Test Case 2: Spent Token

```bash
# Mint token
SECRET="alice" npm run mint-token -- --local -d '{"test":"data"}' --save

# Transfer token
SECRET="alice" npm run send-token -- -f <token.txf> -r "DIRECT://bob-address" --local

# Verify sender's original file
npm run verify-token -- -f <token.txf> --local
```

**Expected:**
- `getTokenStatus()` returns `OK`
- Scenario: "confirmed" (if transfer recorded) or "outdated" (if not)
- Exit code: 1 (if outdated)

---

### Test Case 3: Network Unavailable

```bash
# Stop aggregator
docker stop aggregator-service

# Verify token
npm run verify-token -- -f <token.txf> --local
```

**Expected:**
- `getTokenStatus()` throws network error
- Scenario: "error" with `onChainSpent: null`
- Exit code: 0 (graceful degradation)
- Warning message about network unavailable

---

## Summary of Fixes Needed

### File: src/utils/ownership-verification.ts

**Lines 116-138:** Modify error handling to:

1. Handle `PATH_NOT_INCLUDED` as normal (unspent)
2. Handle `OK` as normal (spent)
3. Handle `NOT_AUTHENTICATED` / `PATH_INVALID` as errors
4. Only catch network exceptions

### File: src/commands/verify-token.ts

**Lines 518-560:** Simplify error handling:

1. Remove outer try-catch (redundant)
2. Trust `checkOwnershipStatus()` to handle errors
3. Set exit code based on `scenario` and `onChainSpent`

---

## Key Assertions

### On PATH_NOT_INCLUDED
"PATH_NOT_INCLUDED is NOT an error. It means the RequestId is not in the Sparse Merkle Tree, which indicates the state is UNSPENT and current."

### On HTTP 404
"HTTP 404 during polling is NOT an error. It means the aggregator hasn't generated the proof yet. Continue polling."

### On getTokenStatus() Exceptions
"getTokenStatus() should NOT throw exceptions for normal proof responses. It returns enum values. Only network errors throw exceptions."

### On Idempotency
"The aggregator allows multiple submissions of the same RequestId IF the transaction data is identical. This is by design for retry logic."

---

## References

**Architecture Documentation:**
- `/home/vrogojin/cli/.dev/architecture/ownership-verification-summary.md`
- `/home/vrogojin/cli/.dev/investigations/SPARSE_MERKLE_TREE_PROOFS.md`
- `/home/vrogojin/cli/.dev/investigations/AGGREGATOR_DEBUGGING_SUMMARY.md`

**SDK Source:**
- `node_modules/@unicitylabs/state-transition-sdk/lib/StateTransitionClient.d.ts`
- `node_modules/@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.d.ts`

**Code Locations:**
- `/home/vrogojin/cli/src/utils/ownership-verification.ts:116-138`
- `/home/vrogojin/cli/src/commands/verify-token.ts:518-560`

---

**End of Guide**
