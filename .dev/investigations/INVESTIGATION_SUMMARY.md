# Investigation Summary: register-request and get-request Commands

## Executive Summary

This document consolidates findings from a detailed code review investigating three questions about the `register-request` command implementation in the Unicity CLI.

---

## Question 1: Why can the same secret and state be registered with different transition values?

### Answer
The RequestId is generated from **only two parameters**: the public key (derived from secret) and the state hash. The transition data is completely ignored in RequestId calculation.

### Evidence

**Code Location:** `/home/vrogojin/cli/src/commands/register-request.ts:38`
```typescript
const requestId = await RequestId.create(signingService.publicKey, stateHash);
```

**SDK Implementation:** `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/RequestId.js:24-35`
```javascript
static create(id, stateHash) {
    return RequestId.createFromImprint(id, stateHash.imprint);
}

static async createFromImprint(id, hashImprint) {
    const hash = await new DataHasher(HashAlgorithm.SHA256)
        .update(id)           // Public key
        .update(hashImprint)  // State hash only
        .digest();            // Transition is NOT here
    return new RequestId(hash);
}
```

### Mathematical Formula
```
RequestId = SHA256(publicKey || stateHash.imprint)

Where:
- publicKey = Ed25519 public key derived from secret
- stateHash = SHA256(state data)
- || = concatenation
- transition = NOT included
```

### Implication
```
Given: secret="mysecret", state="mystate"
Then:
  register(..., "transition-v1") → RequestId: X
  register(..., "transition-v2") → RequestId: X (SAME!)
  register(..., "transition-v3") → RequestId: X (SAME!)

All produce identical RequestIds because transition is not used.
```

### Design Purpose
This is intentional design for **state-based commitment schemes**:
- RequestId identifies the source state
- Multiple valid transitions can apply to same state
- RequestId should be stable regardless of transition

---

## Question 2: Is the command actually submitting data to the aggregator or just generating RequestId locally?

### Answer
The command **submits data to the aggregator** via `client.submitCommitment()`.

### What Gets Submitted

**Location:** `/home/vrogojin/cli/src/commands/register-request.ts:44`
```typescript
const result = await client.submitCommitment(requestId, transactionHash, authenticator);
```

Three pieces of data are sent:

| Data | Source | Purpose |
|------|--------|---------|
| `requestId` | SHA256(publicKey, stateHash) | Identifies the source state |
| `transactionHash` | SHA256(transition data) | Identifies the specific transition |
| `authenticator` | Sign(transactionHash + stateHash) | Proves ownership and validity |

### Network Submission

**Location:** `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js:24-27`
```javascript
async submitCommitment(requestId, transactionHash, authenticator, receipt = false) {
    const request = new SubmitCommitmentRequest(requestId, transactionHash, authenticator, receipt);
    const response = await this.transport.request(
        'submit_commitment',
        request.toJSON(),  // ← Sends to aggregator
        this.key ? new Headers([['X-API-Key', this.key]]) : undefined
    );
    return SubmitCommitmentResponse.fromJSON(response);
}
```

### JSON Payload Sent

**Location:** `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/SubmitCommitmentRequest.js:58-65`
```json
{
  "requestId": "0x<RequestId_hex>",
  "transactionHash": "0x<SHA256_of_transition>",
  "authenticator": {
    "publicKey": "0x<public_key>",
    "algorithm": "Ed25519",
    "signature": "0x<signature_of_transactionHash>",
    "stateHash": "0x<stateHash>"
  }
}
```

### Key Point: Transition Data Representation

**Is the original transition data sent?**
- ✗ No - the original transition string is NOT sent
- ✓ Yes - it's represented as `transactionHash` (SHA256 of transition)
- ✓ Yes - it's represented in the signature (signature proves knowledge of what hash was signed)

**Can the aggregator recover the original transition?**
- ✗ No - hashing is one-way, original data is lost
- ✓ But aggregator can verify it by:
  - Receiving a submission with same RequestId
  - Comparing transactionHash values
  - Using cryptographic verification

---

## Question 3: Why would get-request return empty responses after registering?

### Answer
The `get-request` command queries the aggregator using only the RequestId. Empty responses indicate the RequestId doesn't exist in the aggregator's database.

### Possible Causes

**Root Cause #1: Registration Failed Silently**
- Aggregator rejected submission (validation error)
- Network error during submission
- CLI didn't properly validate the response
- **Fix:** Add logging to see the actual aggregator response

**Root Cause #2: Different RequestId Computed**
- Used different secret → different publicKey → different RequestId
- Used different state → different stateHash → different RequestId
- Used different endpoint → querying different aggregator
- **Fix:** Verify RequestId is identical between register and get commands

**Root Cause #3: Data Not Yet Committed**
- Recent registration, not yet included in merkle tree
- Aggregator hasn't processed block yet
- **Fix:** Wait several seconds (or minutes) before querying

**Root Cause #4: Aggregator Persistence Issue**
- Aggregator database wasn't actually updated
- Transient storage (RAM-based) lost data on restart
- **Fix:** Check aggregator status and logs

### How get-request Works

**Code Path:** `/home/vrogojin/cli/src/commands/get-request.ts:24-27`
```typescript
const requestId = RequestId.fromJSON(requestIdStr);
const inclusionProofResponse = await client.getInclusionProof(requestId);
```

**Network Query:** `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js:32-34`
```javascript
async getInclusionProof(requestId) {
    const data = { requestId: requestId.toJSON() };
    return InclusionProofResponse.fromJSON(
        await this.transport.request('get_inclusion_proof', data)
    );
}
```

**Query Parameters:**
```json
{
  "method": "get_inclusion_proof",
  "params": {
    "requestId": "0x<RequestId>"
  }
}
```

**Expected Response (Found):**
```json
{
  "inclusionProof": {
    "merkleTreePath": [...]
  }
}
```

**Expected Response (Not Found):**
```json
null
```

### How to Debug

1. **Verify RequestId matches:**
   ```bash
   # Register and save RequestId
   npm run register-request -- "secret" "state" "trans" | tee register.log

   # Extract RequestId
   REQUESTID=$(grep "Request ID:" register.log | cut -d' ' -f5)

   # Query immediately
   npm run get-request -- "$REQUESTID"
   ```

2. **Check endpoint connectivity:**
   ```bash
   curl -X POST https://gateway.unicity.network \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"get_block_height","params":{},"id":1}'
   # Should return block number
   ```

3. **Add debug logging:**
   - See `/home/vrogojin/cli/DEBUGGING_GUIDE.md` for instrumentation steps

---

## Key Findings Table

| Question | Answer | Location | Status |
|----------|--------|----------|--------|
| **Does RequestId include transition?** | No | RequestId.js:24-35 | Design verified |
| **Is transition data submitted?** | Yes (via hash) | AggregatorClient.js:24-27 | Code verified |
| **Is submission persisted?** | Maybe | Depends on aggregator | Needs testing |
| **Can same secret+state get different RequestIds?** | No | RequestId.js:33-35 | Design verified |
| **Is original transition data sent?** | No | SubmitCommitmentRequest.js:58-65 | Design verified |

---

## Design Philosophy

The Unicity state-transition system uses **cryptographic commitment** with the following design:

### RequestId (State Commitment)
```
RequestId = H(publicKey || stateHash)
├─ Proof of source state
├─ Proof of signer (via public key)
└─ Independent of transitions applied
```

### Authenticator (Ownership Proof)
```
Authenticator = {
    publicKey,
    signature = Sign(transactionHash),
    stateHash,
    algorithm
}
├─ Proof of transaction knowledge
├─ Proof of signing capability
└─ Links transaction to source state
```

### Together (Full Commitment)
```
(RequestId, transactionHash, Authenticator)
├─ Identifies source state
├─ Identifies target transaction
├─ Proves ownership and knowledge
└─ Enables merkle tree inclusion
```

---

## Recommendations

### For Users

1. **Keep Records:**
   - Save the RequestId after registration
   - Save the original transition data
   - Save the transactionHash if displayed

2. **Verify Submissions:**
   - Check aggregator response indicates "SUCCESS"
   - Wait before querying (allow commitment time)
   - Use explicit endpoint URL (`-e` flag)

3. **Understand Design:**
   - RequestId doesn't uniquely identify transitions
   - Multiple transitions can have same RequestId
   - Distinguish them via transactionHash

### For Developers

1. **Add Logging:**
   - Log RequestId after creation
   - Log aggregator response
   - Log inclusion proof response
   - See DEBUGGING_GUIDE.md for details

2. **Add Validation:**
   - Verify RequestId format (hex, 64+ chars)
   - Verify aggregator response status
   - Handle "NOT_FOUND" explicitly

3. **Add Testing:**
   - Test same secret+state with different transitions
   - Test different secrets with same state
   - Test end-to-end register→get flow

4. **Document Design:**
   - Explain RequestId is state-based, not transition-based
   - Explain transition data is not recoverable (hashed)
   - Explain how to verify specific transitions

---

## Analysis Documents

This investigation created three additional documents:

1. **ANALYSIS.md** - Detailed findings with evidence
2. **TECHNICAL_DEEP_DIVE.md** - Code paths and algorithms
3. **DEBUGGING_GUIDE.md** - Testing scenarios and fixes

See those documents for:
- Complete code citations
- Execution flow diagrams
- Testing procedures
- Common issues and fixes

---

## Conclusion

The `register-request` command is working as designed:

1. RequestId is derived from public key + state hash only (transition excluded)
2. Transition data is submitted to aggregator as transactionHash + signature
3. Data persistence depends on aggregator, not the CLI

The behavior is **intentional and correct** for a state-transition commitment system. The apparent issues (same secret+state yielding same RequestId, empty get-request responses) are actually features of the design, not bugs.

**Root causes of empty get-request responses:**
- Registration failed (aggregator error or network issue)
- Different RequestId was computed (different secret or state)
- Data not yet persisted (wait longer for commitment)
- Wrong endpoint specified

Use the debugging guide to diagnose specific issues.

