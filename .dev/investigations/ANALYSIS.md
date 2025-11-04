# Analysis: register-request and get-request Command Implementation

## Executive Summary

The `register-request` command has **three critical design issues** that explain the observed behavior:

1. **RequestId does NOT include transition data** - Only public key + state hash
2. **Transition data IS being submitted** - Sent via authenticator to aggregator
3. **Data persistence depends on aggregator** - Registration works, but retrieval requires matching RequestId

---

## Issue 1: RequestId Generation Does Not Include Transition Data

### How RequestId is Created

**File:** `/home/vrogojin/cli/src/commands/register-request.ts:38`
```typescript
const requestId = await RequestId.create(signingService.publicKey, stateHash);
```

**What This Does:**
The RequestId is derived from **only two parameters**:
1. `signingService.publicKey` - The public key derived from the secret
2. `stateHash` - Hash of the state data

**The Problem:**
The `transition` parameter is **completely ignored** in RequestId generation. This means:

- Same secret + state → Same RequestId **regardless of transition value**
- Different transitions with the same state will produce identical RequestIds
- The RequestId serves as a unique identifier, but it's not based on what changed (transition)

### Root Cause Analysis

Looking at the SDK implementation:

**File:** `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/RequestId.js:24-25`
```javascript
static create(id, stateHash) {
    return RequestId.createFromImprint(id, stateHash.imprint);
}
```

The `RequestId.create()` method calls `createFromImprint()`:

**File:** `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/RequestId.js:33-35`
```javascript
static async createFromImprint(id, hashImprint) {
    const hash = await new DataHasher(HashAlgorithm.SHA256)
        .update(id)
        .update(hashImprint)
        .digest();
    return new RequestId(hash);
}
```

The RequestId is computed as: `SHA256(publicKey || stateHash.imprint)`

**The transition data never enters this calculation.**

### Implication

If you register the same secret and state with **different transitions**, you'll get:
- **Same RequestId** (because it's only derived from publicKey + stateHash)
- **Different transactionHash** (because it's derived from transition data)
- **Different authenticator.signature** (because signature is computed over transactionHash)

This is actually by design - the RequestId identifies the *source state*, not the transition applied to it.

---

## Issue 2: Transition Data IS Being Submitted to Aggregator

### What Gets Submitted

**File:** `/home/vrogojin/cli/src/commands/register-request.ts:44`
```typescript
const result = await client.submitCommitment(requestId, transactionHash, authenticator);
```

The `submitCommitment()` method sends three pieces of data to the aggregator:

1. **requestId** - Derived from (publicKey, stateHash)
2. **transactionHash** - Hash of the transition data
3. **authenticator** - Contains signature over transactionHash + stateHash

### What the Aggregator Receives

**File:** `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js:24-27`
```javascript
async submitCommitment(requestId, transactionHash, authenticator, receipt = false) {
    const request = new SubmitCommitmentRequest(requestId, transactionHash, authenticator, receipt);
    const response = await this.transport.request('submit_commitment', request.toJSON(),
        this.key ? new Headers([['X-API-Key', this.key]]) : undefined);
    return SubmitCommitmentResponse.fromJSON(response);
}
```

The request payload sent as JSON-RPC is:

**File:** `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/SubmitCommitmentRequest.js:58-65`
```javascript
toJSON() {
    return {
        authenticator: this.authenticator.toJSON(),
        receipt: this.receipt,
        requestId: this.requestId.toJSON(),
        transactionHash: this.transactionHash.toJSON(),
    };
}
```

### What Authenticator Contains

The authenticator serializes to:

**File:** SDK type definition
```typescript
interface IAuthenticatorJson {
    publicKey: string;          // Public key as hex
    algorithm: string;          // Signature algorithm
    signature: string;          // Signature as hex
    stateHash: string;          // State hash as hex
}
```

The **signature was computed over**:
- The `transactionHash` (derived from transition data)
- The `stateHash` (derived from state data)

So **the transition data is indirectly represented** in the signature.

### Summary

**Transition data IS submitted to the aggregator:**
- ✓ As `transactionHash` (the hash value)
- ✓ As signature input (the hash is signed by the Authenticator)

**However:**
- ✗ The original transition data itself is NOT sent
- ✗ Only its hash (`transactionHash`) is sent
- ✗ This is by design - for cryptographic commitment

---

## Issue 3: Why get-request Returns Empty After Registering

### How get-request Works

**File:** `/home/vrogojin/cli/src/commands/get-request.ts:27`
```typescript
const inclusionProofResponse = await client.getInclusionProof(requestId);
```

The `getInclusionProof()` queries the aggregator using the RequestId to fetch an inclusion proof.

### The Query Parameters

**File:** `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js:32-34`
```javascript
async getInclusionProof(requestId) {
    const data = { requestId: requestId.toJSON() };
    return InclusionProofResponse.fromJSON(await this.transport.request('get_inclusion_proof', data));
}
```

The query sends **only the RequestId** to the aggregator.

### Possible Reasons for Empty Responses

1. **Registration NOT persisted**: The aggregator received `submitCommitment()` but didn't store it
   - Network error
   - Aggregator rejected the submission
   - Wrong endpoint URL

2. **Different RequestIds**: You computed a different RequestId in `get-request`
   - Different secret (leads to different publicKey)
   - Different state value (leads to different stateHash)
   - Because RequestId only depends on (publicKey, stateHash), these must match

3. **Aggregator not synced**: Data committed but not yet included in merkle tree
   - Recent submissions may not have inclusion proofs yet
   - May require waiting for a block

4. **Aggregator endpoint issues**:
   - Default endpoint: `https://gateway.unicity.network`
   - Wrong URL specified
   - Network connectivity

### Critical Design Point

The `get-request` command **cannot verify what transition you submitted** because:
- The RequestId doesn't encode transition information
- The inclusion proof only proves inclusion of (requestId, transactionHash, authenticator)
- To verify the transition, you need the original transition data to:
  1. Compute the same hash
  2. Compare with the returned `transactionHash` in the inclusion proof

---

## Why Same Secret + State with Different Transitions Has Issues

### The Scenario

```bash
npm run register-request -- mysecret "state1" "transition-v1"
# Returns RequestId X

npm run register-request -- mysecret "state1" "transition-v2"
# Returns RequestId X (SAME!)
```

### What Happens at Aggregator

| Field | Value 1 | Value 2 |
|-------|---------|---------|
| RequestId | `SHA256(pubkey \| stateHash)` | `SHA256(pubkey \| stateHash)` |
| transactionHash | `SHA256("transition-v1")` | `SHA256("transition-v2")` |
| signature | Sign(SHA256("transition-v1")) | Sign(SHA256("transition-v2")) |

**Result:** The aggregator receives TWO different submissions with the **same RequestId but different signatures**.

**Aggregator behavior depends on implementation:**
- **Option A:** Last write wins - overwrite the first with second
- **Option B:** Reject duplicates - return error on second submission
- **Option C:** Store both - but only one has the RequestId, other is lost

The CLI shows "SUCCESS" either way, but data retrieval may be ambiguous.

### Root Cause

The RequestId design is intentional for **state-based commitment schemes**:
- RequestId = commitment to a source state
- transactionHash = commitment to the state transition
- Signature = proof of ownership

This allows multiple valid state transitions from the same source state, but the RequestId uniquely identifies the source state, not the transition.

---

## Data Flow Visualization

### register-request Flow

```
User Input:
  secret = "mysecret"
  state = "state1"
  transition = "transition1"

Step 1: Derive Public Key
  secretBytes = TextEncoder.encode("mysecret")
  signingService = SigningService.createFromSecret(secretBytes)
  publicKey = signingService.publicKey

Step 2: Hash State
  stateHash = SHA256(TextEncoder.encode("state1"))

Step 3: Hash Transition
  transactionHash = SHA256(TextEncoder.encode("transition1"))

Step 4: Create RequestId
  requestId = SHA256(publicKey || stateHash.imprint)
  ← Does NOT include transition

Step 5: Create Authenticator
  authenticator = Sign(transactionHash, stateHash)
  Contains: {
    publicKey,
    signature: Sign(transactionHash),
    stateHash,
    algorithm
  }

Step 6: Submit to Aggregator
  POST /submit_commitment
  {
    requestId: "...",
    transactionHash: "...",
    authenticator: {...}
  }
```

### get-request Flow

```
User Input:
  requestId = "the-request-id-from-register"

Step 1: Query Aggregator
  GET /get_inclusion_proof
  { requestId: "the-request-id" }

Step 2: Check Response
  If found:
    - Returns InclusionProof containing merkle path
    - Path proves requestId is in the committed data
  If not found:
    - Aggregator has no record of this RequestId
    - Possible causes:
      * Registration failed silently
      * Different RequestId was used
      * Data not yet committed
```

---

## Key Findings Summary

| Question | Answer | Evidence |
|----------|--------|----------|
| **Does RequestId include transition?** | NO | RequestId computed from (publicKey, stateHash) only |
| **Is transition data submitted?** | YES | Sent as transactionHash + in signature |
| **Is data persisted?** | MAYBE | Depends on aggregator response; success shows "SUCCESS" |
| **Same secret+state, different transitions?** | Same RequestId, different signatures | Allowed by design |
| **Why get-request empty?** | Registration may have failed or different parameters used | Need to verify RequestId matches |

---

## Recommendations

### 1. Add Transition Verification Output
Modify `register-request` to output transactionHash so users can verify later:
```typescript
console.log(`Transaction Hash: ${transactionHash.toJSON()}`);
```

### 2. Add RequestId Validation
Show users what RequestId was generated based on their inputs:
```typescript
console.log(`Computed RequestId: ${requestId.toJSON()}`);
console.log(`Note: RequestId is based on secret + state only, not transition`);
```

### 3. Add Aggregator Response Validation
Check the actual response from `client.submitCommitment()`:
```typescript
console.log(`Aggregator Response: ${JSON.stringify(result)}`);
if (!result || result.status !== 'SUCCESS') {
    console.error('Submission may not have been persisted');
}
```

### 4. Add get-request Debugging
When `get-request` returns empty, show what RequestId was queried:
```typescript
console.log(`Querying for RequestId: ${requestId.toJSON()}`);
console.log(`Note: This RequestId is based on secret + state only`);
```

### 5. Document the Design
Add comments explaining:
- RequestId includes only (publicKey, stateHash)
- Transition is committed via transactionHash and signature
- Multiple transitions can have same RequestId but different signatures
- To verify a specific transition, compare transactionHash values

---

## Files Analyzed

1. **`/home/vrogojin/cli/src/commands/register-request.ts`** - Command implementation
2. **`/home/vrogojin/cli/src/commands/get-request.ts`** - Query implementation
3. **`/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/RequestId.js`** - RequestId generation
4. **`/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js`** - Network submission
5. **`/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/SubmitCommitmentRequest.js`** - Payload structure
6. **`/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/Authenticator.d.ts`** - Signature container

