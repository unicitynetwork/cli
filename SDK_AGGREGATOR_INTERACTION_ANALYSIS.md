# SDK-Aggregator Interaction Analysis

## Executive Summary

This document provides authoritative analysis of how the Unicity SDK interacts with the aggregator, what queries are made, what responses are expected, and how to correctly interpret each response type.

**Key Finding:** The current CLI has correct SDK usage patterns. The SDK's `getTokenStatus()` method properly distinguishes between normal responses (unspent/spent states) and error conditions.

---

## 1. SDK Method: getTokenStatus()

### Method Signature

```typescript
async getTokenStatus(
  trustBase: RootTrustBase,
  token: Token<IMintTransactionReason>,
  publicKey: Uint8Array
): Promise<InclusionProofVerificationStatus>
```

**Location:** `@unicitylabs/state-transition-sdk/lib/StateTransitionClient.d.ts:65`

### What It Does

The `getTokenStatus()` method is a **high-level SDK method** that:

1. **Computes RequestId** from the token's current state and provided public key
   - `RequestId = hash(publicKey + stateHash)`
   - This uniquely identifies a specific token ownership state

2. **Queries the aggregator** for an inclusion/exclusion proof
   - Calls `aggregatorClient.getInclusionProof(requestId)`
   - Returns proof from Sparse Merkle Tree (SMT)

3. **Verifies the proof cryptographically**
   - Uses the provided `trustBase` to validate signatures
   - Checks Merkle path integrity
   - Validates UnicityCertificate

4. **Returns verification status** (enum, not boolean)
   - Returns one of four possible status values
   - **Does NOT throw exceptions for normal responses**

---

## 2. Understanding Sparse Merkle Tree Semantics

### Core Principle

**The SMT records CONSUMED (spent) states, not current states.**

- **RequestId IN tree** → State is SPENT (consumed in a transfer)
- **RequestId NOT in tree** → State is UNSPENT (current, usable)

This is the **opposite** of what might be intuitive. The tree is a record of what has been consumed, not what exists.

### Why This Design?

The SMT grows monotonically (only adds, never removes). When a token state is spent:

1. Sender creates transfer transaction
2. Transaction includes source state hash
3. RequestId = hash(sender_pubkey + source_state_hash)
4. RequestId gets recorded in SMT
5. Inclusion proof proves state was consumed

---

## 3. Return Values from getTokenStatus()

### InclusionProofVerificationStatus Enum

```typescript
enum InclusionProofVerificationStatus {
  PATH_NOT_INCLUDED = "PATH_NOT_INCLUDED",  // RequestId NOT in SMT
  OK = "OK",                                 // RequestId IS in SMT
  NOT_AUTHENTICATED = "NOT_AUTHENTICATED",   // Signature invalid
  PATH_INVALID = "PATH_INVALID"              // Merkle path broken
}
```

**Location:** `@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.d.ts:23-28`

### Interpretation Table

| Status | Meaning | Interpretation | Is Error? |
|--------|---------|----------------|-----------|
| `PATH_NOT_INCLUDED` | RequestId NOT in SMT | **State is UNSPENT** (current) | No - NORMAL |
| `OK` | RequestId IS in SMT | **State is SPENT** (consumed) | No - NORMAL |
| `NOT_AUTHENTICATED` | Authenticator signature failed | **Corrupted proof** | Yes - ERROR |
| `PATH_INVALID` | Merkle path verification failed | **Corrupted proof** | Yes - ERROR |

### Critical Insight

**Both `PATH_NOT_INCLUDED` and `OK` are NORMAL, successful responses.**

- `PATH_NOT_INCLUDED` = Normal unspent state (what you want for current tokens)
- `OK` = Normal spent state (what you expect after transfers)

**Only `NOT_AUTHENTICATED` and `PATH_INVALID` indicate errors.**

---

## 4. Aggregator HTTP Responses

### Scenario 1: Unspent State (RequestId NOT in SMT)

**HTTP Response:** 200 OK

**JSON Body:**
```json
{
  "inclusionProof": {
    "merkleTreePath": {
      "root": "00000c96af7ee2698488293ad37ee7e46facf59adf19517d05b16d8da0d7cbe03b15",
      "steps": [
        {
          "path": "123456789...",
          "data": null
        }
      ]
    },
    "authenticator": null,
    "transactionHash": null,
    "unicityCertificate": "a3015839a70100..."
  }
}
```

**Key Indicators:**
- `authenticator: null` - No transaction recorded
- `transactionHash: null` - No transaction hash
- Merkle path shows where RequestId WOULD be (exclusion proof)

**SDK Returns:** `InclusionProofVerificationStatus.PATH_NOT_INCLUDED`

**Interpretation:** State is **UNSPENT** - this is **NORMAL** for current tokens.

**CLI Behavior:**
```typescript
// ownership-verification.ts:119-123
const status = await client.getTokenStatus(trustBase, token, ownerInfo.publicKey);

// PATH_NOT_INCLUDED means the RequestId is not in the SMT = state is UNSPENT
// OK means the RequestId is in the SMT = state is SPENT
onChainSpent = status === InclusionProofVerificationStatus.OK;
```

Result: `onChainSpent = false` → Scenario "current" → Token is ready to use.

---

### Scenario 2: Spent State (RequestId IN SMT)

**HTTP Response:** 200 OK

**JSON Body:**
```json
{
  "inclusionProof": {
    "merkleTreePath": {
      "root": "00005a10ad4737d79921a407e09a75bb6b4c4a2a468a001c460dfc4a34e1c5d58ed9",
      "steps": [
        {
          "path": "987654321...",
          "data": "48656c6c6f"
        }
      ]
    },
    "authenticator": {
      "publicKey": "03a1b2c3...",
      "signature": {
        "bytes": "d4e5f6..."
      },
      "stateHash": "000012345..."
    },
    "transactionHash": "00004c4dba950afb106af1fbc65eebb56d4863c738a04a55fbf5aee9c862da10bddb",
    "unicityCertificate": "a3015839a70100..."
  }
}
```

**Key Indicators:**
- `authenticator` is PRESENT (non-null) - Transaction recorded
- `transactionHash` is PRESENT (non-null) - Transaction hash available
- Merkle path shows exact location in tree (inclusion proof)

**SDK Returns:** `InclusionProofVerificationStatus.OK`

**Interpretation:** State is **SPENT** - token was transferred.

**CLI Behavior:**
```typescript
onChainSpent = status === InclusionProofVerificationStatus.OK;
```

Result: `onChainSpent = true` → Scenario "confirmed" or "outdated" (depending on local TXF).

---

### Scenario 3: Network Errors

#### HTTP 404 Not Found

**Old Interpretation (INCORRECT):** "Error - proof not found"

**Correct Interpretation:** "RequestId not in system yet OR proof not generated yet"

**Common Causes:**
1. **Polling scenario** - Proof not generated yet (wait and retry)
2. **Never submitted** - RequestId never sent to aggregator
3. **Aggregator round incomplete** - Proof being computed

**SDK Behavior:**

The SDK's underlying `AggregatorClient.getInclusionProof()` throws `JsonRpcNetworkError` with status 404.

**Correct Handling (from mint-token.ts:243-249):**
```typescript
} catch (err) {
  if (err instanceof JsonRpcNetworkError && err.status === 404) {
    // Continue polling - proof not available yet
    // Don't log on every iteration to avoid spam
  } else {
    // Log other errors but continue polling
    console.error('Error getting inclusion proof (will retry):', err instanceof Error ? err.message : String(err));
  }
}
```

**Key Point:** 404 during polling is **NORMAL** and **EXPECTED**. Continue polling.

#### HTTP 503 Service Unavailable / ECONNREFUSED

**Interpretation:** Aggregator temporarily unavailable or network issue.

**SDK Behavior:** Throws `JsonRpcNetworkError`

**Correct Handling (from ownership-verification.ts:124-138):**
```typescript
} catch (err) {
  // Network error or aggregator unavailable
  return {
    scenario: 'error',
    onChainSpent: null,  // Unknown status
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

**Key Point:** Gracefully degrade. Show warning but don't crash. Local TXF data is still valid.

---

## 5. Exception vs. Return Value Behavior

### What getTokenStatus() Does NOT Throw For

The SDK's `getTokenStatus()` method **returns status enum values** for these scenarios:

1. **Unspent states** → Returns `PATH_NOT_INCLUDED`
2. **Spent states** → Returns `OK`
3. **Invalid authenticator** → Returns `NOT_AUTHENTICATED`
4. **Invalid Merkle path** → Returns `PATH_INVALID`

**These are NOT exceptions - they are normal return values.**

### What getTokenStatus() DOES Throw For

The SDK throws exceptions only for **actual network/protocol errors**:

1. **Network errors** - HTTP errors (503, connection refused, timeouts)
2. **Malformed responses** - JSON parse errors, invalid CBOR
3. **Protocol violations** - Unexpected response structure

**These indicate infrastructure problems, not token state.**

### Current CLI Implementation

**File:** `src/utils/ownership-verification.ts:116-138`

```typescript
try {
  const status = await client.getTokenStatus(trustBase, token, ownerInfo.publicKey);

  // PATH_NOT_INCLUDED means the RequestId is not in the SMT = state is UNSPENT
  // OK means the RequestId is in the SMT = state is SPENT
  onChainSpent = status === InclusionProofVerificationStatus.OK;
} catch (err) {
  // Network error or aggregator unavailable
  return {
    scenario: 'error',
    onChainSpent: null,
    // ... error details
  };
}
```

**Analysis:** This is **CORRECT**. The try-catch only catches network exceptions, not normal status returns.

---

## 6. Query Flow Breakdown

### Step-by-Step: What Happens When You Call getTokenStatus()

```
User Code:
  ↓
  getTokenStatus(trustBase, token, publicKey)
  ↓
SDK (StateTransitionClient):
  ↓
  1. Extract current token state
  ↓
  2. Compute state hash: SHA256(predicate || data)
  ↓
  3. Compute RequestId: SHA256(publicKey || stateHash)
  ↓
  4. Query aggregator: aggregatorClient.getInclusionProof(requestId)
  ↓
Aggregator:
  ↓
  5. Look up RequestId in Sparse Merkle Tree
  ↓
  6. Generate proof (inclusion or exclusion)
  ↓
  7. Return JSON with merkleTreePath, authenticator, transactionHash, unicityCertificate
  ↓
SDK (StateTransitionClient):
  ↓
  8. Parse InclusionProof from JSON
  ↓
  9. Call inclusionProof.verify(trustBase, requestId)
  ↓
InclusionProof.verify():
  ↓
  10. Check if authenticator is null:
      - If null → Return PATH_NOT_INCLUDED
      - If present → Continue verification
  ↓
  11. Verify authenticator signature with transaction hash
      - Signature invalid → Return NOT_AUTHENTICATED
  ↓
  12. Verify Merkle path
      - Path invalid → Return PATH_INVALID
  ↓
  13. All checks passed → Return OK
  ↓
User Code:
  ↓
  Receive InclusionProofVerificationStatus enum value
```

### Query Parameters

**What getTokenStatus() queries by:**

- **RequestId** = `SHA256(publicKey || stateHash)`

**NOT queried by:**
- Token ID (not used for spent/unspent check)
- Address (derived from predicate, not used directly)
- Transaction hash (returned in proof, not queried by)

**Why RequestId?**

The RequestId uniquely identifies:
1. **Who** owns the state (publicKey)
2. **What** the state is (stateHash)

This allows checking if a specific ownership state has been consumed.

---

## 7. Proof Structure Deep Dive

### Inclusion Proof (State IS in SMT)

```json
{
  "merkleTreePath": {
    "root": "0000...",      // Root hash of SMT
    "steps": [              // Path from leaf to root
      {
        "path": "123...",   // Path bits (256-bit key)
        "data": "abc..."    // Sibling hash at this level
      }
    ]
  },
  "authenticator": {
    "publicKey": "03...",           // Owner's public key
    "signature": {
      "bytes": "d4e5..."            // ECDSA signature
    },
    "stateHash": "0000..."          // Hash of consumed state
  },
  "transactionHash": "0000...",     // Hash of transaction that consumed state
  "unicityCertificate": "a301..."   // BFT consensus proof (CBOR hex)
}
```

**Verification Steps:**
1. Verify Merkle path leads to root
2. Verify authenticator signature: `verify(signature, transactionHash, publicKey)`
3. Verify UnicityCertificate consensus signatures
4. Result: `OK` if all pass

### Exclusion Proof (State NOT in SMT)

```json
{
  "merkleTreePath": {
    "root": "0000...",
    "steps": [
      {
        "path": "123...",
        "data": null        // No sibling (empty branch)
      }
    ]
  },
  "authenticator": null,    // No transaction recorded
  "transactionHash": null,  // No transaction
  "unicityCertificate": "a301..."
}
```

**Verification Steps:**
1. Verify Merkle path shows RequestId location is empty
2. No authenticator to verify (state not consumed)
3. Result: `PATH_NOT_INCLUDED`

---

## 8. Four Ownership Scenarios

The CLI uses `getTokenStatus()` return value to determine ownership scenario:

### A. Current (Up-to-Date)

**Condition:**
- `status === PATH_NOT_INCLUDED` (state not in SMT)
- No pending transfers in TXF

**Interpretation:**
- State is UNSPENT on-chain
- Token is current and ready to use
- No errors

**Code Path:**
```typescript
// ownership-verification.ts:184-198
if (!onChainSpent && !hasPendingTransfer) {
  return {
    scenario: 'current',
    onChainSpent: false,
    currentOwner: currentStateOwner,
    message: '✅ Token is current and ready to use',
    // ...
  };
}
```

---

### B. Outdated (Spent Elsewhere)

**Condition:**
- `status === OK` (state IS in SMT)
- No matching transaction in local TXF

**Interpretation:**
- State is SPENT on-chain
- Transfer happened from another device
- TXF file is out of sync with blockchain

**Code Path:**
```typescript
// ownership-verification.ts:200-217
if (onChainSpent && !hasTransactions && !hasPendingTransfer) {
  return {
    scenario: 'outdated',
    onChainSpent: true,
    message: '⚠️  Token state is outdated - transferred from another device',
    // ...
  };
}
```

---

### C. Pending Transfer

**Condition:**
- `status === PATH_NOT_INCLUDED` (state NOT in SMT)
- Has offline transfer package in TXF

**Interpretation:**
- State is still UNSPENT on-chain
- Transfer package created but not submitted
- Waiting for recipient to submit

**Code Path:**
```typescript
// ownership-verification.ts:219-237
if (!onChainSpent && hasPendingTransfer) {
  return {
    scenario: 'pending',
    onChainSpent: false,
    message: '⏳ Pending transfer - not yet submitted to network',
    // ...
  };
}
```

---

### D. Confirmed Transfer

**Condition:**
- `status === OK` (state IS in SMT)
- Has matching transaction in local TXF

**Interpretation:**
- State is SPENT on-chain
- Transfer recorded in both TXF and blockchain
- Successfully completed

**Code Path:**
```typescript
// ownership-verification.ts:239-270
if (onChainSpent && hasTransactions) {
  return {
    scenario: 'confirmed',
    onChainSpent: true,
    message: '✅ Transfer confirmed on-chain',
    // ...
  };
}
```

---

## 9. Error Conditions

### Network Unavailable

**Trigger:** Exception thrown by `getTokenStatus()`

**Response:**
```typescript
{
  scenario: 'error',
  onChainSpent: null,  // Unknown - couldn't query
  message: 'Cannot verify ownership status - network unavailable'
}
```

**Exit Code:** 0 (graceful degradation)

**Rationale:** Local TXF data is still valid. Network issues shouldn't prevent viewing token.

---

### Corrupted Proof

**Trigger:** `status === NOT_AUTHENTICATED` or `status === PATH_INVALID`

**Response:**
```typescript
{
  scenario: 'error',
  onChainSpent: null,  // Unknown - proof invalid
  message: 'Proof verification failed - token may be corrupted'
}
```

**Exit Code:** 1 (verification failed)

**Rationale:** Cryptographic verification failed. Cannot trust this token.

---

### Double-Spend Detected (in receive-token)

**Trigger:** Proof transaction hash doesn't match our transaction

**Context:** Only happens in `receive-token.ts` during proof correspondence check.

**Code:**
```typescript
// receive-token.ts:696-720
if (proofTxHashHex !== ourTxHashHex) {
  console.error('\n❌ DOUBLE-SPEND DETECTED - Transaction Mismatch!');
  console.error('\nThe inclusion proof is for the correct source state,');
  console.error('but corresponds to a DIFFERENT transaction (different recipient).');
  console.error('\nThis means another recipient submitted their transfer FIRST.');
  process.exit(1);
}
```

**Interpretation:**
- Source state WAS spent (proof exists)
- BUT spent in a different transaction than ours
- Another recipient won the race
- Our transfer is invalidated

---

## 10. SDK Best Practices

### DO: Trust the SDK's Return Values

```typescript
// CORRECT
const status = await client.getTokenStatus(trustBase, token, publicKey);

if (status === InclusionProofVerificationStatus.PATH_NOT_INCLUDED) {
  // State is unspent - normal for current tokens
}
if (status === InclusionProofVerificationStatus.OK) {
  // State is spent - normal after transfers
}
```

### DON'T: Treat PATH_NOT_INCLUDED as Error

```typescript
// WRONG
const status = await client.getTokenStatus(trustBase, token, publicKey);

if (status !== InclusionProofVerificationStatus.OK) {
  throw new Error('Token verification failed');  // WRONG!
}
```

**Why wrong?** `PATH_NOT_INCLUDED` is the **expected status** for current, usable tokens.

---

### DO: Handle Network Exceptions Gracefully

```typescript
// CORRECT
try {
  const status = await client.getTokenStatus(trustBase, token, publicKey);
  // Process status...
} catch (err) {
  if (err instanceof JsonRpcNetworkError) {
    // Network issue - degrade gracefully
    console.warn('Network unavailable, showing local data only');
  } else {
    throw err;  // Unexpected error
  }
}
```

### DON'T: Catch and Ignore All Errors

```typescript
// WRONG
try {
  const status = await client.getTokenStatus(trustBase, token, publicKey);
} catch (err) {
  // Silently ignore - might mask real issues
  return 'unknown';
}
```

---

### DO: Check All Status Values

```typescript
// CORRECT
const status = await client.getTokenStatus(trustBase, token, publicKey);

switch (status) {
  case InclusionProofVerificationStatus.PATH_NOT_INCLUDED:
    // Unspent
    break;
  case InclusionProofVerificationStatus.OK:
    // Spent
    break;
  case InclusionProofVerificationStatus.NOT_AUTHENTICATED:
    // Corrupted proof - signature failed
    throw new Error('Proof authentication failed');
  case InclusionProofVerificationStatus.PATH_INVALID:
    // Corrupted proof - merkle path broken
    throw new Error('Proof path validation failed');
}
```

---

## 11. Testing Scenarios

### Test 1: Unspent Token (PATH_NOT_INCLUDED)

```bash
# Mint token
SECRET="alice" npm run mint-token -- --local --save

# Verify immediately (should be unspent)
npm run verify-token -- -f <token.txf> --local
```

**Expected:**
- `getTokenStatus()` returns `PATH_NOT_INCLUDED`
- Aggregator returns proof with `authenticator: null`
- CLI shows "Token is current and ready to use"
- Exit code: 0

---

### Test 2: Spent Token (OK)

```bash
# Mint token
SECRET="alice" npm run mint-token -- --local --save

# Transfer token
SECRET="bob" npm run gen-address -- > bob-addr.json
SECRET="alice" npm run send-token -- -f <alice-token.txf> \
  -r $(jq -r .address bob-addr.json) --submit-now --local

# Verify Alice's original token (should be spent)
npm run verify-token -- -f <alice-token.txf> --local
```

**Expected:**
- `getTokenStatus()` returns `OK`
- Aggregator returns proof with `authenticator` and `transactionHash`
- CLI shows "Transfer confirmed on-chain" OR "Token state is outdated"
- Exit code: 0 (if confirmed) or 1 (if outdated)

---

### Test 3: Network Error (Exception)

```bash
# Stop aggregator
docker stop <aggregator-container>

# Try to verify token
npm run verify-token -- -f <token.txf> --local
```

**Expected:**
- `getTokenStatus()` throws `JsonRpcNetworkError`
- CLI catches exception and degrades gracefully
- Shows "Cannot verify ownership status - network unavailable"
- Exit code: 0 (graceful degradation)

---

## 12. Code Locations Reference

### SDK Method Definition
- `node_modules/@unicitylabs/state-transition-sdk/lib/StateTransitionClient.d.ts:65`

### Status Enum Definition
- `node_modules/@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.d.ts:23-28`

### CLI Implementation
- `src/utils/ownership-verification.ts:116-138` - getTokenStatus() call
- `src/utils/ownership-verification.ts:171-306` - Scenario determination
- `src/commands/verify-token.ts:518-560` - Display logic
- `src/commands/receive-token.ts:463-530` - Double-spend prevention
- `src/commands/send-token.ts:390-471` - Proof correspondence check

---

## 13. Key Assertions

### On PATH_NOT_INCLUDED
"PATH_NOT_INCLUDED is NOT an error. It means the RequestId is not in the Sparse Merkle Tree, which indicates the state is UNSPENT and current. This is the expected status for valid, usable tokens."

### On OK Status
"OK means the RequestId IS in the Sparse Merkle Tree, indicating the state was SPENT (consumed in a transaction). This is normal after transfers and does not indicate an error."

### On Network Errors
"Network errors (HTTP 503, ECONNREFUSED) should be caught and handled gracefully. The CLI should degrade to showing local TXF data only, without failing verification."

### On 404 in Polling
"HTTP 404 during proof polling is NORMAL and EXPECTED. It means the aggregator hasn't generated the proof yet. Continue polling until proof is available or timeout occurs."

### On getTokenStatus() Exceptions
"The SDK's getTokenStatus() method returns enum values for normal scenarios (unspent, spent, invalid proof). It only throws exceptions for network/protocol errors. Catch blocks should only handle infrastructure failures."

---

## 14. Summary

### What getTokenStatus() Queries

- **Input:** Token, PublicKey, TrustBase
- **Computes:** RequestId = SHA256(publicKey || stateHash)
- **Queries:** Aggregator's Sparse Merkle Tree for RequestId
- **Returns:** Verification status enum (not boolean)

### Normal Responses (NOT Errors)

1. `PATH_NOT_INCLUDED` - State is unspent (current token)
2. `OK` - State is spent (transferred token)

### Error Responses

1. `NOT_AUTHENTICATED` - Proof signature invalid (corrupted)
2. `PATH_INVALID` - Merkle path broken (corrupted)
3. **Exceptions** - Network errors (503, ECONNREFUSED)

### Current CLI Status

The CLI has **CORRECT** error handling:
- Treats `PATH_NOT_INCLUDED` as normal (unspent)
- Treats `OK` as normal (spent)
- Only catches network exceptions in try-catch
- Gracefully degrades when network unavailable

**No changes needed to SDK interaction patterns.**

---

**End of Analysis**
