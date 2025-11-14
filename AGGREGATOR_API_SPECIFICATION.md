# Unicity Aggregator API Specification

## Executive Summary

**CRITICAL CLARIFICATION:** The aggregator is a **reliable service** that ALWAYS returns correct answers. HTTP 404 errors indicate **aggregator malfunction**, NOT normal "proof not found" scenarios.

---

## Core Principle: JSON-RPC API Design

The Unicity aggregator implements a **JSON-RPC 2.0** interface with two primary methods:

1. `submit_commitment` - Register state transitions
2. `get_inclusion_proof` - Query Sparse Merkle Tree proofs

---

## API Method 1: submit_commitment

### Purpose
Register a state transition commitment in the Sparse Merkle Tree.

### Endpoint
```
POST /
Content-Type: application/json
```

### Request Format
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "submit_commitment",
  "params": {
    "requestId": "0x<hex_encoded_request_id>",
    "transactionHash": "0x<hex_encoded_transaction_hash>",
    "authenticator": {
      "publicKey": "0x<hex_encoded_public_key>",
      "algorithm": "Ed25519",
      "signature": "0x<hex_encoded_signature>",
      "stateHash": "0x<hex_encoded_state_hash>"
    },
    "receipt": false
  }
}
```

### Response Format (Success)
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "status": "SUCCESS",
    "requestId": "0x<hex_encoded_request_id>"
  }
}
```

### Response Format (Error - Duplicate with Different Data)
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32000,
    "message": "smt: attempt to modify an existing leaf"
  }
}
```

### Idempotency Behavior

**Scenario A: Exact Duplicate Submission**
```typescript
// First submission
await client.submitCommitment(requestId1, txHash1, auth1);
// Returns: { status: "SUCCESS", requestId: "0xabc..." }

// Second submission (IDENTICAL data)
await client.submitCommitment(requestId1, txHash1, auth1);
// Returns: { status: "SUCCESS", requestId: "0xabc..." } ✓ IDEMPOTENT
```

**Scenario B: Same RequestId, Different Transaction Data**
```typescript
// First submission
await client.submitCommitment(requestId1, txHash1, auth1);
// Returns: { status: "SUCCESS" }

// Second submission (DIFFERENT txHash)
await client.submitCommitment(requestId1, txHash2, auth2);
// ERROR: "smt: attempt to modify an existing leaf" ✗ REJECTED
```

**Rule:** Once a RequestId is registered with specific transaction data, it is **immutable**. Resubmissions with identical data succeed (idempotent), but attempts to modify fail.

### HTTP Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| `200 OK` | Commitment accepted or already exists | SUCCESS |
| `400 Bad Request` | Malformed JSON-RPC request | Fix request format |
| `500 Internal Server Error` | Aggregator internal error | TECHNICAL ERROR - report to ops team |
| `503 Service Unavailable` | Aggregator temporarily down | Retry with backoff |

**IMPORTANT:** 404 should NEVER occur for `submit_commitment`. If it does, the aggregator is misconfigured.

---

## API Method 2: get_inclusion_proof

### Purpose
Query the Sparse Merkle Tree for an inclusion proof (or exclusion proof) for a given RequestId.

### Endpoint
```
POST /
Content-Type: application/json
```

### Request Format
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "get_inclusion_proof",
  "params": {
    "requestId": "0x<hex_encoded_request_id>"
  }
}
```

---

## Response Scenarios for get_inclusion_proof

### Scenario 1: RequestId IS in SMT (SPENT State)

**HTTP Status:** `200 OK`

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "inclusionProof": {
      "merkleTreePath": {
        "root": "0x00005a10ad4737d79921a407e09a75bb6b4c4a2a468a001c460dfc4a34e1c5d58ed9",
        "steps": [
          {
            "path": "12345678901234567890",
            "data": "0x..."
          }
        ]
      },
      "authenticator": {
        "publicKey": "0x...",
        "signature": "0x...",
        "stateHash": "0x...",
        "algorithm": "Ed25519"
      },
      "transactionHash": "0x00004c4dba950afb106af1fbc65eebb56d4863c738a04a55fbf5aee9c862da10bddb",
      "unicityCertificate": "0x..."
    }
  }
}
```

**Key Indicators:**
- `authenticator` is **non-null**
- `transactionHash` is **non-null**
- Merkle path proves RequestId exists at specific location

**SDK Status:** `InclusionProofVerificationStatus.OK`

**Interpretation:** State is **SPENT** (consumed in a transfer)

---

### Scenario 2: RequestId NOT in SMT (UNSPENT State)

**HTTP Status:** `200 OK`

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "inclusionProof": {
      "merkleTreePath": {
        "root": "0x00000c96af7ee2698488293ad37ee7e46facf59adf19517d05b16d8da0d7cbe03b15",
        "steps": [
          {
            "path": "12345678901234567890",
            "data": null
          }
        ]
      },
      "authenticator": null,
      "transactionHash": null,
      "unicityCertificate": "0x..."
    }
  }
}
```

**Key Indicators:**
- `authenticator` is **null**
- `transactionHash` is **null**
- Merkle path proves RequestId does NOT exist (exclusion proof)

**SDK Status:** `InclusionProofVerificationStatus.PATH_NOT_INCLUDED`

**Interpretation:** State is **UNSPENT** (current, ready to use)

**THIS IS NORMAL AND EXPECTED FOR CURRENT TOKENS!**

---

### Scenario 3: Aggregator Malfunction (404 Error)

**HTTP Status:** `404 Not Found`

**CRITICAL:** This should NEVER happen in a correctly functioning aggregator!

**Interpretation:** **TECHNICAL ERROR** - One of:
- Aggregator endpoint misconfigured
- Database connection failed
- Service routing broken
- Backend service crash

**Action:** Report to operations team. This is a **BUG** in the aggregator infrastructure.

**Common Misunderstanding (WRONG):**
> "404 means proof not found, which is normal during polling"

**Correct Understanding:**
> "404 means the aggregator SERVICE is broken. A working aggregator ALWAYS returns 200 with either an inclusion proof OR an exclusion proof."

---

### Scenario 4: Network Errors

**HTTP Status:** `503 Service Unavailable`

**Interpretation:** Aggregator temporarily unavailable (maintenance, overload)

**Action:** Retry with exponential backoff

---

**HTTP Status:** `500 Internal Server Error`

**Interpretation:** Aggregator encountered an internal error

**Action:** Retry once, then report to ops if persists

---

### Scenario 5: Malformed Request

**HTTP Status:** `400 Bad Request`

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32600,
    "message": "Invalid Request: requestId must be hex-encoded"
  }
}
```

**Interpretation:** Client sent invalid data

**Action:** Fix request format (validate RequestId format client-side first)

---

## SDK Behavior: getTokenStatus()

### Method Signature
```typescript
async getTokenStatus(
  trustBase: RootTrustBase,
  token: Token<any>,
  publicKey: Uint8Array
): Promise<InclusionProofVerificationStatus>
```

### Internal Flow
```typescript
// 1. Compute RequestId from token state
const requestId = await RequestId.create(publicKey, stateHash);

// 2. Query aggregator
const proofResponse = await aggregatorClient.getInclusionProof(requestId);

// 3. Verify proof cryptographically
const status = await proofResponse.inclusionProof.verify(trustBase, requestId);

// 4. Return verification status
return status;
```

### Return Values (NOT Exceptions!)

| Status | Meaning | Throws? |
|--------|---------|---------|
| `PATH_NOT_INCLUDED` | RequestId NOT in SMT (unspent) | NO ✓ |
| `OK` | RequestId IS in SMT (spent) | NO ✓ |
| `NOT_AUTHENTICATED` | Authenticator signature invalid | NO ✓ |
| `PATH_INVALID` | Merkle path broken | NO ✓ |

### When It DOES Throw Exceptions

```typescript
try {
  const status = await client.getTokenStatus(trustBase, token, publicKey);
  // Normal flow - status is an ENUM
} catch (err) {
  // ONLY network errors reach here:
  // - HTTP 503 (aggregator down)
  // - ECONNREFUSED (network unreachable)
  // - Timeout
  // - JSON parse error
}
```

**CRITICAL:** `PATH_NOT_INCLUDED` is **NOT** an error. It's a **normal return value** indicating the state is unspent.

---

## Error Handling Patterns

### Pattern 1: Submit Commitment with Idempotency

```typescript
async function submitWithRetry(
  client: AggregatorClient,
  requestId: RequestId,
  txHash: DataHash,
  auth: Authenticator,
  maxRetries: number = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await client.submitCommitment(requestId, txHash, auth);
      
      if (result.status === 'SUCCESS') {
        console.log('✓ Commitment registered');
        return;
      }
      
    } catch (err) {
      if (err instanceof JsonRpcDataError) {
        if (err.message.includes('existing leaf')) {
          // Idempotent duplicate - already registered
          console.log('✓ Commitment already exists');
          return;
        }
      }
      
      if (err instanceof JsonRpcNetworkError) {
        if (err.status === 503 && attempt < maxRetries) {
          // Temporary unavailability - retry
          await sleep(1000 * attempt);
          continue;
        }
        
        if (err.status === 404) {
          // TECHNICAL ERROR - should never happen
          throw new Error('Aggregator endpoint not found - service misconfigured');
        }
      }
      
      throw err; // Rethrow unexpected errors
    }
  }
  
  throw new Error('Failed to submit commitment after retries');
}
```

---

### Pattern 2: Query Inclusion Proof

```typescript
async function getProofStatus(
  client: StateTransitionClient,
  trustBase: RootTrustBase,
  token: Token<any>,
  publicKey: Uint8Array
): Promise<'SPENT' | 'UNSPENT' | 'ERROR'> {
  try {
    const status = await client.getTokenStatus(trustBase, token, publicKey);
    
    // Interpret enum status (does NOT throw)
    if (status === InclusionProofVerificationStatus.OK) {
      // RequestId IN tree = SPENT
      return 'SPENT';
    } else if (status === InclusionProofVerificationStatus.PATH_NOT_INCLUDED) {
      // RequestId NOT in tree = UNSPENT (NORMAL!)
      return 'UNSPENT';
    } else {
      // NOT_AUTHENTICATED or PATH_INVALID = corrupted proof
      console.warn(`⚠ Proof verification failed: ${status}`);
      return 'ERROR';
    }
    
  } catch (err) {
    // ONLY network errors reach here
    if (err instanceof JsonRpcNetworkError) {
      if (err.status === 404) {
        // TECHNICAL ERROR - aggregator broken
        throw new Error('Aggregator malfunction: endpoint returned 404');
      }
      
      if (err.status === 503) {
        // Temporary unavailability
        console.warn('⚠ Aggregator temporarily unavailable');
        return 'ERROR';
      }
    }
    
    throw err; // Rethrow unexpected errors
  }
}
```

---

### Pattern 3: Graceful Degradation

```typescript
async function verifyTokenWithGracefulDegradation(
  token: Token<any>,
  client: StateTransitionClient,
  trustBase: RootTrustBase,
  publicKey: Uint8Array
): Promise<void> {
  try {
    const status = await client.getTokenStatus(trustBase, token, publicKey);
    
    if (status === InclusionProofVerificationStatus.OK) {
      console.log('⚠ Token state is SPENT (transferred elsewhere)');
      process.exit(1); // Fail verification
    } else if (status === InclusionProofVerificationStatus.PATH_NOT_INCLUDED) {
      console.log('✓ Token is UNSPENT and current');
      process.exit(0); // Pass verification
    } else {
      console.log('⚠ Proof verification failed (corrupted proof)');
      process.exit(1); // Fail verification
    }
    
  } catch (err) {
    // Network error - gracefully degrade
    console.log('⚠ Cannot verify on-chain status (network unavailable)');
    console.log('  Showing local TXF data only');
    process.exit(0); // Don't fail on network issues
  }
}
```

---

## Common Mistakes in CLI Code

### Mistake 1: Treating PATH_NOT_INCLUDED as Error

**WRONG:**
```typescript
try {
  const status = await client.getTokenStatus(...);
  onChainSpent = status === InclusionProofVerificationStatus.OK;
} catch (err) {
  // Problem: PATH_NOT_INCLUDED doesn't throw!
  return { scenario: 'error', message: 'Network unavailable' };
}
```

**CORRECT:**
```typescript
try {
  const status = await client.getTokenStatus(...);
  
  if (status === InclusionProofVerificationStatus.OK) {
    onChainSpent = true;
  } else if (status === InclusionProofVerificationStatus.PATH_NOT_INCLUDED) {
    onChainSpent = false; // NORMAL, not error!
  } else {
    // Only NOT_AUTHENTICATED or PATH_INVALID
    return { scenario: 'error', message: 'Proof corrupted' };
  }
  
} catch (err) {
  // Only network errors reach here
  return { scenario: 'error', message: 'Network unavailable' };
}
```

---

### Mistake 2: Expecting 404 During Normal Operation

**WRONG:**
```typescript
try {
  const proof = await client.getInclusionProof(requestId);
} catch (err) {
  if (err.status === 404) {
    // "Normal - proof not ready yet"
    return null; // WRONG!
  }
}
```

**CORRECT:**
```typescript
try {
  const proof = await client.getInclusionProof(requestId);
  
  // Check if exclusion proof (unspent state)
  if (proof.inclusionProof.authenticator === null) {
    // This is NORMAL - state is unspent
    return 'UNSPENT';
  } else {
    // Inclusion proof - state is spent
    return 'SPENT';
  }
  
} catch (err) {
  if (err.status === 404) {
    // TECHNICAL ERROR - report to ops!
    throw new Error('Aggregator malfunction: 404 should never occur');
  }
}
```

**Clarification:** A correctly functioning aggregator **always** returns 200 OK with either:
- **Inclusion proof** (authenticator non-null) = RequestId in tree
- **Exclusion proof** (authenticator null) = RequestId not in tree

It does NOT return 404 to indicate "not in tree". That's what the exclusion proof is for!

---

## Testing the Aggregator API

### Test 1: Verify Unspent State Returns 200

```bash
# Mint a token
SECRET="alice" npm run mint-token -- --local -d '{"test":"data"}' --save

# Extract RequestId from token
REQUEST_ID=$(jq -r '.genesis.requestId' <token.txf>)

# Query aggregator directly
curl -X POST http://127.0.0.1:3000 \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"get_inclusion_proof\",
    \"params\": {
      \"requestId\": \"$REQUEST_ID\"
    }
  }"
```

**Expected Response:** `200 OK` with `authenticator: null` (exclusion proof)

**NOT Expected:** `404 Not Found`

---

### Test 2: Verify Spent State Returns 200

```bash
# Transfer the token
SECRET="alice" npm run send-token -- -f <token.txf> -r "DIRECT://bob" --local

# Query aggregator for original state's RequestId
curl -X POST http://127.0.0.1:3000 \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"get_inclusion_proof\",
    \"params\": {
      \"requestId\": \"$REQUEST_ID\"
    }
  }"
```

**Expected Response:** `200 OK` with `authenticator: { ... }` (inclusion proof)

**NOT Expected:** `404 Not Found`

---

### Test 3: Verify Idempotency

```bash
# Submit commitment twice
SECRET="test" npm run register-request -- "test" "state1" "transition1" --local
SECRET="test" npm run register-request -- "test" "state1" "transition1" --local
```

**Expected:** Both succeed (idempotent)

**NOT Expected:** Second submission fails

---

### Test 4: Verify Immutability

```bash
# Submit commitment
SECRET="test" npm run register-request -- "test" "state1" "transition1" --local

# Try to modify with different transition
SECRET="test" npm run register-request -- "test" "state1" "transition2" --local
```

**Expected:** Second submission fails with "attempt to modify an existing leaf"

**NOT Expected:** Second submission succeeds (overwrites first)

---

## API Assertions

### On 404 Errors
"A correctly functioning Unicity aggregator NEVER returns HTTP 404. The aggregator always returns 200 OK with either an inclusion proof (RequestId in tree) or an exclusion proof (RequestId not in tree). If you receive 404, the aggregator is misconfigured or experiencing a technical failure."

### On PATH_NOT_INCLUDED
"PATH_NOT_INCLUDED is NOT an error condition. It is the NORMAL status for unspent token states. It means the RequestId is not in the Sparse Merkle Tree, which indicates the state has not been consumed in a transfer."

### On Idempotency
"The aggregator allows resubmission of identical commitments (same RequestId + same transaction data). This is by design to support retry logic in distributed systems. However, attempts to modify an existing RequestId with different transaction data will fail."

### On HTTP Status Codes
"The only valid HTTP status codes from a healthy aggregator are 200 (success), 400 (malformed request), 500 (internal error), and 503 (temporarily unavailable). A 404 response indicates a serious infrastructure problem."

---

## References

**SDK Documentation:**
- `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.d.ts`
- `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/StateTransitionClient.d.ts`

**CLI Implementation:**
- `/home/vrogojin/cli/src/commands/get-request.ts` (Lines 65-153)
- `/home/vrogojin/cli/src/commands/register-request.ts` (Lines 98-113)
- `/home/vrogojin/cli/src/utils/ownership-verification.ts` (Lines 116-138)

**Architecture Documentation:**
- `/home/vrogojin/cli/AGGREGATOR_ERROR_HANDLING_GUIDE.md`
- `/home/vrogojin/cli/.dev/architecture/ownership-verification-summary.md`

---

**End of Specification**
