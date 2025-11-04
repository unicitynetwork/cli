# Technical Deep Dive: RequestId Generation & Data Submission

## RequestId Generation Algorithm

### Code Path

```
register-request.ts:38
    ↓
RequestId.create(publicKey, stateHash)
    ↓
RequestId.createFromImprint(publicKey, stateHash.imprint)
    ↓
SHA256(publicKey || stateHash.imprint)
```

### Pseudocode
```javascript
// File: state-transition-sdk/lib/api/RequestId.js (line 24-35)

static async create(publicKey, stateHash) {
    // Takes public key and state hash
    return RequestId.createFromImprint(publicKey, stateHash.imprint);
}

static async createFromImprint(publicKey, hashImprint) {
    // Hash the public key and state hash imprint together
    const requestIdHash = await new DataHasher(HashAlgorithm.SHA256)
        .update(publicKey)           // ← Public key bytes
        .update(hashImprint)         // ← State hash digest
        .digest();
    // Transition data NEVER processed here
    return new RequestId(requestIdHash);
}
```

### What Gets Hashed

```
RequestId = SHA256(
    publicKey (32 bytes) ||
    stateHash.imprint (variable)
)
```

**Notably absent:** `transactionHash` (derived from transition)

---

## Data Submission Breakdown

### What register-request Submits

**File:** `/home/vrogojin/cli/src/commands/register-request.ts:38-44`

```typescript
// Create Request ID (publicKey + stateHash only)
const requestId = await RequestId.create(signingService.publicKey, stateHash);

// Create Authenticator (signs the transactionHash)
const authenticator = await Authenticator.create(
    signingService,
    transactionHash,    // ← Derived from TRANSITION
    stateHash
);

// Submit all three
const result = await client.submitCommitment(
    requestId,          // SHA256(publicKey || stateHash)
    transactionHash,    // SHA256(transition)
    authenticator       // Sign(transactionHash), contains publicKey + stateHash
);
```

### JSON-RPC Request Payload

**File:** `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/SubmitCommitmentRequest.js:58-65`

```json
{
  "jsonrpc": "2.0",
  "method": "submit_commitment",
  "params": {
    "requestId": "0x<hex_RequestId>",
    "transactionHash": "0x<hex_transactionHash>",
    "authenticator": {
      "publicKey": "0x<hex_publicKey>",
      "algorithm": "Ed25519",
      "signature": "0x<hex_signature>",
      "stateHash": "0x<hex_stateHash>"
    },
    "receipt": false
  }
}
```

### What Happens in Aggregator

```
┌─────────────────────────────────────────────────────────┐
│ Aggregator receives SubmitCommitmentRequest              │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ 1. Extract RequestId                                    │
│    ├─ Use as primary key for storage                    │
│    └─ Index in merkle tree                              │
│                                                           │
│ 2. Validate Authenticator                               │
│    ├─ Verify signature over transactionHash             │
│    ├─ Extract publicKey from Authenticator              │
│    └─ Check signature validity                          │
│                                                           │
│ 3. Store Commitment                                     │
│    ├─ Key: RequestId                                    │
│    └─ Value: {                                          │
│        transactionHash,                                 │
│        authenticator,                                   │
│        timestamp                                        │
│       }                                                 │
│                                                           │
│ 4. Return Success/Failure                               │
│    └─ Client sees "SUCCESS"                             │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## The Transition Data Paradox

### Claim: "Transition data is submitted"
**True** - but indirectly via transactionHash

### Claim: "I can verify my transition later"
**False** - unless you keep the original transition data

### Why?

```
Original Data:                  Aggregator Stores:
┌──────────────┐               ┌──────────────────────────┐
│ transition1  │               │ transactionHash          │
│              │────SHA256──→  │ (hash of transition)     │
└──────────────┘               │                          │
                                │ ← Lost original data     │
                                └──────────────────────────┘

Later Verification:
┌──────────────────────────┐
│ You have: "transition1"  │
│ Compute: SHA256(data)    │  ← Must match stored hash
│ Compare: with aggregator │     to verify your data
└──────────────────────────┘
```

**Without the original transition data, you cannot prove what you submitted.**

---

## Same Secret+State, Different Transitions

### Scenario 1: First Registration

```bash
$ npm run register-request -- "mysecret" "state1" "transition-v1"
```

**Computation:**
```
secretBytes = encode("mysecret")
publicKey = derive(secretBytes)

stateHash = SHA256("state1")
requestId = SHA256(publicKey || stateHash)  ← Key #1

transactionHash = SHA256("transition-v1")
signature = Sign(transactionHash + stateHash)

Submission to aggregator:
  POST /submit_commitment
  {
    requestId: <RequestId>,
    transactionHash: <hash of "transition-v1">,
    authenticator: {signature, ...}
  }
```

**Aggregator Storage:**
```
Database[RequestId] = {
    transactionHash: hash("transition-v1"),
    authenticator: {
        signature: Sign(hash("transition-v1")),
        ...
    }
}
```

### Scenario 2: Second Registration (Same Secret+State, Different Transition)

```bash
$ npm run register-request -- "mysecret" "state1" "transition-v2"
```

**Computation:**
```
secretBytes = encode("mysecret")  ← Same as before
publicKey = derive(secretBytes)    ← Same as before

stateHash = SHA256("state1")       ← Same as before
requestId = SHA256(publicKey || stateHash)  ← Key #1 (SAME!)

transactionHash = SHA256("transition-v2")   ← DIFFERENT!
signature = Sign(transactionHash + stateHash)  ← DIFFERENT!

Submission to aggregator:
  POST /submit_commitment
  {
    requestId: <RequestId>,  ← SAME as first
    transactionHash: <hash of "transition-v2">,  ← DIFFERENT
    authenticator: {
        signature: Sign(hash("transition-v2")), ← DIFFERENT
        ...
    }
  }
```

**Aggregator Behavior:**

Option A - "Last Write Wins":
```
Database[RequestId] = {
    transactionHash: hash("transition-v2"),  ← Overwritten!
    authenticator: {
        signature: Sign(hash("transition-v2")),
        ...
    }
}
```
Result: First registration lost.

Option B - "Reject Duplicates":
```
POST /submit_commitment returns ERROR
"RequestId already exists"
```
Result: Second registration fails.

Option C - "Store Both":
```
Database[RequestId] = [
    {transactionHash: hash("transition-v1"), ...},
    {transactionHash: hash("transition-v2"), ...}
]
```
Result: Ambiguity on retrieval.

### Verification Complexity

To verify which transition you submitted:
1. Keep original "transition-v1" and "transition-v2"
2. Call `get-request` with RequestId
3. Receive `transactionHash` from aggregator
4. Compute `SHA256("transition-v1")` and `SHA256("transition-v2")`
5. Compare with received `transactionHash` to identify which was stored

**This is why the transition data should be kept by the user.**

---

## The get-request Query

### How It Retrieves Data

**File:** `/home/vrogojin/cli/src/commands/get-request.ts`

```typescript
// User provides RequestId
const requestId = RequestId.fromJSON(requestIdStr);

// Query aggregator
const inclusionProofResponse = await client.getInclusionProof(requestId);

// Returns:
{
    inclusionProof: {
        merkleTreePath: [...],
        // Proves RequestId exists in merkle tree
    }
}
```

### What the Aggregator Receives

**File:** `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js:32-34`

```javascript
async getInclusionProof(requestId) {
    const data = { requestId: requestId.toJSON() };
    return InclusionProofResponse.fromJSON(
        await this.transport.request('get_inclusion_proof', data)
    );
}
```

**JSON-RPC Request:**
```json
{
  "method": "get_inclusion_proof",
  "params": {
    "requestId": "0x<hex_RequestId>"
  }
}
```

### Why It Might Return Empty

```
Possible Causes:
├─ Registration failed silently
│  └─ Aggregator returned 500 error
│  └─ Network timeout
│  └─ CLI didn't properly check response
│
├─ Different RequestId computed
│  └─ Different secret → Different publicKey
│  └─ Different state → Different stateHash
│  └─ Result: Different RequestId, no match in aggregator
│
└─ Data not yet persisted
   └─ Recent registration, not yet committed
   └─ Wait for next block
```

---

## Cryptographic Commitment Structure

### RequestId Design

```
RequestId = H(publicKey || stateHash)

Purpose:
- Identify the source state uniquely
- Tied to signer (via publicKey)
- Independent of what transition is applied

Usage:
- Primary key in aggregator database
- Deterministic given secret + state
- Can be recomputed by knowing secret + state
```

### Authenticator Design

```
Authenticator {
    publicKey,
    signature = Sign(transactionHash),
    stateHash,
    algorithm
}

Purpose:
- Prove ownership of RequestId
- Prove knowledge of specific transition
- Allow verification of commitment

Usage:
- Signature verification: verify(signature, transactionHash) → boolean
- Request authentication: only owner can sign the transactionHash
```

### Complete Commitment

```
Commitment = (RequestId, transactionHash, Authenticator)

Properties:
- RequestId proves source state
- transactionHash proves specific transition
- Authenticator proves signer ownership
- Together: cryptographic commitment to state + transition by owner
```

---

## Code Paths Summary

### register-request.ts Line Numbers

| Line | Operation |
|------|-----------|
| 27-28 | Create SigningService from secret |
| 31-32 | Hash the state parameter |
| 34-35 | Hash the transition parameter |
| 38 | **Create RequestId (state only)** |
| 41 | Create Authenticator (transition in signature) |
| 44 | Submit to aggregator (all three) |
| 47 | Display RequestId to user |

### Key Line: Line 38
```typescript
const requestId = await RequestId.create(signingService.publicKey, stateHash);
```
This is where the transition parameter is **completely ignored**.

The `transition` variable is only used to create `transactionHash` on line 35, which is then used in the `Authenticator` (line 41) and in submission (line 44).

---

## Import Chain Analysis

```
register-request.ts imports:
├─ RequestId from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js'
│  └─ Uses: RequestId.create(publicKey, stateHash)
│     └─ Internally calls: createFromImprint()
│        └─ Hashes: (publicKey || stateHash.imprint)
│           └─ Transition: NOT included
│
├─ Authenticator from '@unicitylabs/state-transition-sdk/lib/api/Authenticator.js'
│  └─ Uses: Authenticator.create(signingService, transactionHash, stateHash)
│     └─ Signs: transactionHash
│        └─ Transition: Included (via hash)
│
└─ AggregatorClient from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js'
   └─ Uses: client.submitCommitment(requestId, transactionHash, authenticator)
      └─ Sends all three to: /submit_commitment
         └─ Transition: Included (via transactionHash + signature)
```

---

## Type Definitions Used

### RequestId

**from state-transition-sdk/lib/api/RequestId.d.ts**
```typescript
export declare class RequestId extends DataHash {
    static create(
        id: Uint8Array,        // publicKey
        stateHash: DataHash    // NOT transactionHash
    ): Promise<RequestId>;
}
```

### Authenticator

**from state-transition-sdk/lib/api/Authenticator.d.ts**
```typescript
export declare class Authenticator {
    static create(
        signingService: SigningService,
        transactionHash: DataHash,  // ← From transition
        stateHash: DataHash
    ): Promise<Authenticator>;
}
```

### AggregatorClient

**from state-transition-sdk/lib/api/AggregatorClient.d.ts**
```typescript
export declare class AggregatorClient {
    submitCommitment(
        requestId: RequestId,
        transactionHash: DataHash,
        authenticator: Authenticator
    ): Promise<SubmitCommitmentResponse>;
}
```

