# Debugging Guide: register-request and get-request

## Testing Scenarios

### Scenario 1: Verify RequestId is Independent of Transition

**Expected Behavior:**
Different transitions with the same secret + state = Same RequestId

**Test Command:**
```bash
# Register with transition-v1
npm run register-request -- "test-secret" "test-state" "transition-v1"
# Output: Request ID: 0x<RequestIdA>

# Register with transition-v2 (same secret, same state, different transition)
npm run register-request -- "test-secret" "test-state" "transition-v2"
# Output: Request ID: 0x<RequestIdB>
```

**Expected Result:**
RequestIdA == RequestIdB (same value)

**If Different:**
- Problem in public key derivation
- Problem in state hashing
- Check SDK version in package.json

---

### Scenario 2: Verify Different Secrets Produce Different RequestIds

**Test Command:**
```bash
# Register with secret-v1
npm run register-request -- "secret-v1" "test-state" "transition"
# Output: Request ID: 0x<RequestIdA>

# Register with secret-v2 (different secret, same state)
npm run register-request -- "secret-v2" "test-state" "transition"
# Output: Request ID: 0x<RequestIdB>
```

**Expected Result:**
RequestIdA != RequestIdB (different values)

**If Same:**
- Problem in public key derivation
- Check SigningService.createFromSecret() implementation

---

### Scenario 3: Test Complete Register → Get Flow

**Test Commands:**
```bash
# Step 1: Register a request
npm run register-request -- "mysecret" "mystate" "mytransition"
# Output: Request ID: 0x<RequestId>
# Copy this RequestId

# Step 2: Immediately try to get it
npm run get-request -- "0x<RequestId>"
# Should return inclusion proof OR "NOT_FOUND"
```

**Possible Results:**

| Result | Meaning | Action |
|--------|---------|--------|
| Inclusion Proof | Success, data persisted | Compare with stored hash |
| NOT_FOUND | Aggregator has no data | Check endpoint, check RequestId |
| Error | Network/parsing problem | Check console, verify endpoint |

**Debugging Steps if NOT_FOUND:**
```bash
# 1. Verify endpoint is reachable
curl -X POST https://gateway.unicity.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"get_block_height","params":{},"id":1}'
# Should return a blockNumber

# 2. Verify RequestId format
# RequestId should be hex string starting with 0x
# Example: 0xa1b2c3d4e5f6...

# 3. Check aggregator logs (if accessible)
# May show why submission was rejected
```

---

## Code Instrumentation

### Add Debug Logging to register-request.ts

**Changes to make:**
```typescript
// After line 28 (after creating SigningService)
console.log(`[DEBUG] Public Key: ${HexConverter.encode(signingService.publicKey)}`);

// After line 32 (after hashing state)
console.log(`[DEBUG] State Hash: ${stateHash.toJSON()}`);

// After line 35 (after hashing transition)
console.log(`[DEBUG] Transaction Hash: ${transactionHash.toJSON()}`);

// After line 38 (after creating RequestId)
console.log(`[DEBUG] Computed RequestId: ${requestId.toJSON()}`);

// After line 41 (after creating Authenticator)
console.log(`[DEBUG] Authenticator Signature: ${authenticator.signature.toString()}`);

// Before line 44 (before submission)
const submitPayload = new SubmitCommitmentRequest(requestId, transactionHash, authenticator);
console.log(`[DEBUG] Submission Payload: ${JSON.stringify(submitPayload.toJSON(), null, 2)}`);

// After line 44 (after submission)
console.log(`[DEBUG] Aggregator Response: ${JSON.stringify(result, null, 2)}`);
```

### Add Debug Logging to get-request.ts

**Changes to make:**
```typescript
// After line 24 (after parsing RequestId)
console.log(`[DEBUG] Querying for RequestId: ${requestId.toJSON()}`);

// After line 27 (after getting inclusion proof)
console.log(`[DEBUG] Raw Response: ${JSON.stringify(inclusionProofResponse, null, 2)}`);

// After line 31 (after creating InclusionProof)
console.log(`[DEBUG] Merkle Path Length: ${inclusionProof.merkleTreePath.nodes.length}`);

// After verification
console.log(`[DEBUG] Verification Result: ${status}`);
```

---

## Manual Testing with curl

### Test 1: Check Aggregator Health

```bash
curl -X POST https://gateway.unicity.network \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "get_block_height",
    "params": {},
    "id": 1
  }'

# Expected response:
# {"jsonrpc":"2.0","result":{"blockNumber":"12345"},"id":1}
```

### Test 2: Simulate register-request

```bash
# Step 1: Prepare data (using Node.js)
node -e "
const { TextEncoder } = require('util');
const secret = 'test-secret';
const state = 'test-state';
const transition = 'test-transition';

console.log('Secret:', secret);
console.log('State:', state);
console.log('Transition:', transition);
"

# Step 2: Manually compute hashes (requires crypto library)
# This is complex - use the CLI instead

# Step 3: Submit to aggregator (after generating RequestId manually)
curl -X POST https://gateway.unicity.network \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "submit_commitment",
    "params": {
      "requestId": "0x...",
      "transactionHash": "0x...",
      "authenticator": {
        "publicKey": "0x...",
        "algorithm": "Ed25519",
        "signature": "0x...",
        "stateHash": "0x..."
      }
    },
    "id": 1
  }'

# Expected response:
# {"jsonrpc":"2.0","result":{"status":"SUCCESS"},"id":1}
```

### Test 3: Query get_inclusion_proof

```bash
# Replace 0x... with actual RequestId
curl -X POST https://gateway.unicity.network \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "get_inclusion_proof",
    "params": {
      "requestId": "0x..."
    },
    "id": 1
  }'

# Expected response if found:
# {
#   "jsonrpc": "2.0",
#   "result": {
#     "inclusionProof": {
#       "merkleTreePath": {...}
#     }
#   },
#   "id": 1
# }

# Expected response if NOT found:
# {
#   "jsonrpc": "2.0",
#   "result": null,
#   "id": 1
# }
```

---

## Common Issues and Fixes

### Issue 1: "Request successfully registered" but get-request returns NOT_FOUND

**Root Causes:**
1. ✗ Different RequestId computed in get-request
2. ✗ Aggregator endpoint URL mismatch
3. ✗ Network latency - data not yet committed

**Diagnosis:**
```bash
# Compare the RequestIds
echo "From register:"
npm run register-request -- "secret" "state" "trans" | grep "Request ID"

echo "Computing what get-request will use:"
node -e "
// Manually compute what get-request would generate
// (This requires importing SDK, so use console.log from register command)
"

# Check if using same endpoint
npm run register-request -- -e "https://gateway.unicity.network" "secret" "state" "trans"
npm run get-request -- -e "https://gateway.unicity.network" "0x..."
```

**Fix:**
- Verify both commands use same endpoint (default is correct)
- Wait 10+ seconds between register and get (for block commitment)
- Add debug logging (see "Code Instrumentation" section)

### Issue 2: Different transitions produce same RequestId

**Expected Behavior:** YES, this is correct!

**Why:**
RequestId = SHA256(publicKey || stateHash)
Transition is not used in this calculation.

**This is not a bug.**

**To distinguish transitions:**
- Store the `transactionHash` from register output
- Compare it with `transactionHash` in inclusion proof from get-request
- Or compute SHA256 of transition and compare

### Issue 3: Aggregator returns "status": "FAILED"

**Possible Causes:**
1. Invalid signature in Authenticator
2. Invalid RequestId format
3. Aggregator backend error

**Diagnosis:**
```bash
# Check signature validity
node -e "
const { Authenticator } = require('@unicitylabs/state-transition-sdk');
const { DataHash } = require('@unicitylabs/state-transition-sdk');

// Verify the authenticator signature
// (Requires access to transactionHash from registration)
"

# Check for malformed data
echo "Check RequestId format (should be hex):"
npm run register-request -- "s" "s" "t" | grep "Request ID"
# Should be: Request ID: 0x<hex_string>
```

**Fix:**
- Check SDK version compatibility
- Verify secret is being encoded correctly
- Enable request/response logging in AggregatorClient

### Issue 4: Network timeout on get-request

**Cause:**
- Aggregator endpoint unreachable
- Network connectivity issue
- Long-running query (merkle path is large)

**Diagnosis:**
```bash
# Test connectivity to endpoint
curl -v https://gateway.unicity.network/

# Test with timeout
curl --max-time 30 -X POST https://gateway.unicity.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"get_block_height","params":{},"id":1}'
```

**Fix:**
- Specify custom endpoint with `-e` flag
- Check network connectivity
- Increase timeout in SDK (requires code change)

---

## Verification Checklist

After implementing debugging changes, verify:

- [ ] register-request outputs RequestId
- [ ] Two registrations with same secret+state produce same RequestId
- [ ] Two registrations with different secrets produce different RequestIds
- [ ] Transition data is included in transactionHash
- [ ] Authenticator contains valid signature
- [ ] Submission to aggregator returns status "SUCCESS"
- [ ] get-request can retrieve data if RequestId matches
- [ ] Merkle path is included in response

---

## Expected Output Format

### register-request Success

```
Request successfully registered. Request ID: 0x<hex_string_64_chars>
```

### get-request Success (NOT_FOUND)

```
STATUS: NOT_FOUND
No inclusion proof available for this request ID
```

### get-request Success (Found)

```
STATUS: <VERIFICATION_STATUS>
PATH: {
  "nodes": [...],
  "indices": [...],
  ...
}
```

---

## Reproducing the Original Issue

### Step 1: Register Same Secret+State with Different Transitions

```bash
npm run register-request -- "mysecret" "mystate" "transition-v1"
# Record RequestId: A

npm run register-request -- "mysecret" "mystate" "transition-v2"
# Record RequestId: B
```

### Expected Result
A == B (both RequestIds are identical)

### Step 2: Verify Data Submitted

**For transition-v1:**
- RequestId: A
- transactionHash: SHA256("transition-v1")

**For transition-v2:**
- RequestId: A (same!)
- transactionHash: SHA256("transition-v2")

This creates ambiguity at the aggregator:
- Same RequestId = same source state
- Different transactionHash = different transitions
- Aggregator must decide which one to keep

### Step 3: Query with get-request

```bash
npm run get-request -- A
```

**Result:**
- May return proof for transition-v1
- May return proof for transition-v2
- May return error (depends on aggregator logic)

**Why:**
The aggregator received two different commitments for the same RequestId. Its behavior depends on implementation.

---

## Performance Considerations

### Request Sizes

| Component | Approximate Size |
|-----------|-----------------|
| RequestId | 32 bytes (64 hex chars) |
| transactionHash | 32 bytes (64 hex chars) |
| Signature | 64 bytes (128 hex chars) |
| publicKey | 32 bytes (64 hex chars) |
| stateHash | 32 bytes (64 hex chars) |
| **Total per request** | **~200 bytes of hashes** |

### Network Overhead

```
POST /submit_commitment
├─ JSON RPC overhead: ~200 bytes
├─ Hashes and signatures: ~200 bytes
├─ Authenticator metadata: ~100 bytes
└─ Total: ~500 bytes per request

GET /get_inclusion_proof
├─ JSON RPC overhead: ~100 bytes
├─ RequestId: ~70 bytes
├─ Merkle path (variable): 1-10 KB
└─ Total: 1-10 KB per query
```

### Optimization Tips

- Batch multiple registrations if possible (requires aggregator support)
- Cache RequestIds to avoid recomputing
- Reuse endpoint connection for multiple requests

