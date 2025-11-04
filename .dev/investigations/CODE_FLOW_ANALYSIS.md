# Code Flow Analysis: Complete Execution Trace

## Complete Flow: register-request Command

### File: `/home/vrogojin/cli/src/commands/register-request.ts`

```typescript
export function registerRequestCommand(program: Command): void {
  program
    .command('register-request')
    .description('Register a new state transition request')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .argument('<secret>', 'Secret key for signing the request')
    .argument('<state>', 'Source state data (will be hashed)')
    .argument('<transition>', 'Transition data (will be hashed)')
    .action(async (secret: string, state: string, transition: string, options) => {
      const endpoint = options.endpoint;

      try {
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 1: Create AggregatorClient
        // ═══════════════════════════════════════════════════════════════════════
        const client = new AggregatorClient(endpoint);
        // ↓ Creates HTTP client for "https://gateway.unicity.network"
        // ↓ Will use JSON-RPC for communication

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 2: Create SigningService from Secret
        // ═══════════════════════════════════════════════════════════════════════
        const secretBytes = new TextEncoder().encode(secret);
        // ↓ Input: "mysecret"
        // ↓ Output: Uint8Array [109, 121, 115, 101, 99, 114, 101, 116]

        const signingService = await SigningService.createFromSecret(secretBytes);
        // ↓ Input: Uint8Array of secret bytes
        // ↓ Derivation: Uses cryptographic key derivation
        // ↓ Output: SigningService with:
        //    - publicKey (32-byte Ed25519 public key)
        //    - privateKey (used internally for signing)
        // ↓ Example publicKey: 0xa1b2c3d4e5f6... (64 hex chars)

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 3: Hash the State
        // ═══════════════════════════════════════════════════════════════════════
        const stateHasher = new DataHasher(HashAlgorithm.SHA256);
        const stateHash = await stateHasher
          .update(new TextEncoder().encode(state))  // "mystate" → bytes
          .digest();
        // ↓ Input: "mystate"
        // ↓ Process: SHA256("mystate")
        // ↓ Output: DataHash object with:
        //    - algorithm: "SHA256"
        //    - data: Uint8Array (32 bytes)
        //    - imprint: Uint8Array (compressed representation)
        // ↓ Example: 0x5ebf5d... (64 hex chars)

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 4: Hash the Transition
        // ═══════════════════════════════════════════════════════════════════════
        const transitionHasher = new DataHasher(HashAlgorithm.SHA256);
        const transactionHash = await transitionHasher
          .update(new TextEncoder().encode(transition))  // "mytransition" → bytes
          .digest();
        // ↓ Input: "mytransition"
        // ↓ Process: SHA256("mytransition")
        // ↓ Output: DataHash object (32 bytes)
        // ↓ Example: 0x7c4a9e... (64 hex chars)
        // NOTE: Original "mytransition" string is NOT stored/sent

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 5: Create RequestId (CRITICAL - Transition NOT included!)
        // ═══════════════════════════════════════════════════════════════════════
        const requestId = await RequestId.create(
          signingService.publicKey,  // 32-byte public key
          stateHash                  // State hash (NOT transition!)
        );
        // ↓ Calls: RequestId.create(publicKey, stateHash)
        // ↓   ↓ Which calls: RequestId.createFromImprint(publicKey, stateHash.imprint)
        // ↓   ↓   ↓ Which computes: SHA256(publicKey || stateHash.imprint)
        // ↓ Output: RequestId object
        // ↓ Example: 0xd4e5f6... (64 hex chars)
        //
        // 🔴 KEY FINDING 🔴
        // The 'transition' variable is NOT used here!
        // RequestId = SHA256(publicKey || stateHash)
        // Only depends on: secret (via publicKey) + state
        // Does NOT depend on: transition
        //
        // Implication:
        //   register(..., "secret", "state", "trans-v1") → RequestId X
        //   register(..., "secret", "state", "trans-v2") → RequestId X (SAME!)

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 6: Create Authenticator (Transition IS included here!)
        // ═══════════════════════════════════════════════════════════════════════
        const authenticator = await Authenticator.create(
          signingService,
          transactionHash,  // ← Hash of TRANSITION (finally included!)
          stateHash
        );
        // ↓ Calls: Authenticator.create(signingService, transactionHash, stateHash)
        // ↓   ↓ Computes signature: Sign(transactionHash + stateHash)
        // ↓ Output: Authenticator object with:
        //    {
        //      publicKey: "0x...",
        //      algorithm: "Ed25519",
        //      signature: "0x...",  // ← Sign(transactionHash + stateHash)
        //      stateHash: "0x..."
        //    }
        //
        // 🟢 KEY FINDING 🟢
        // The 'transactionHash' (derived from transition) IS included!
        // The signature DOES commit to the transition (indirectly)
        // This ensures:
        // - Different transitions → Different transactionHash → Different signature
        // - Aggregator can verify signature matches claimed transaction

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 7: Submit Commitment to Aggregator
        // ═══════════════════════════════════════════════════════════════════════
        const result = await client.submitCommitment(
          requestId,       // SHA256(publicKey || stateHash)
          transactionHash, // SHA256(transition)
          authenticator    // {publicKey, signature, stateHash, algorithm}
        );
        // ↓ Calls: AggregatorClient.submitCommitment(...)
        // ↓   ↓ Creates SubmitCommitmentRequest with three fields
        // ↓   ↓ Converts to JSON:
        //        {
        //          "requestId": "0x...",
        //          "transactionHash": "0x...",
        //          "authenticator": {
        //            "publicKey": "0x...",
        //            "algorithm": "Ed25519",
        //            "signature": "0x...",
        //            "stateHash": "0x..."
        //          }
        //        }
        // ↓   ↓ Sends as JSON-RPC POST request to aggregator:
        //        POST https://gateway.unicity.network
        //        {
        //          "jsonrpc": "2.0",
        //          "method": "submit_commitment",
        //          "params": {...},
        //          "id": 1
        //        }
        // ↓ Receives response from aggregator
        // ↓ Returns: SubmitCommitmentResponse with:
        //    {
        //      "status": "SUCCESS"  or  "FAILED"
        //    }

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 8: Handle Result
        // ═══════════════════════════════════════════════════════════════════════
        if (result.status === 'SUCCESS') {
          console.log(`Request successfully registered. Request ID: ${requestId.toJSON()}`);
          // ↓ Output to console: "Request successfully registered. Request ID: 0x..."
          // ✓ But this doesn't mean data is persisted (depends on aggregator)
          // ✓ Aggregator could have accepted but not stored
        } else {
          console.error(`Failed to register request: ${result.status}`);
          // ↓ Aggregator rejected submission
          // ↓ Check aggregator logs for reason
        }
      } catch (error) {
        console.error(JSON.stringify(error));
        console.error(`Error registering request: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
}
```

---

## Complete Flow: get-request Command

### File: `/home/vrogojin/cli/src/commands/get-request.ts`

```typescript
export function getRequestCommand(program: Command): void {
  program
    .command('get-request')
    .description('Get inclusion proof for a specific request ID')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .argument('<requestId>', 'Request ID to query')
    .action(async (requestIdStr: string, options) => {
      const endpoint = options.endpoint;

      try {
        // ═══════════════════════════════════════════════════════════════════════
        // STEP 1: Create AggregatorClient
        // ═══════════════════════════════════════════════════════════════════════
        const client = new AggregatorClient(endpoint);
        // ↓ Same as in register-request (creates HTTP JSON-RPC client)

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 2: Parse RequestId
        // ═══════════════════════════════════════════════════════════════════════
        const requestId = RequestId.fromJSON(requestIdStr);
        // ↓ Input: "0xa1b2c3d4e5f6..." (hex string from user)
        // ↓ Parses: Converts hex string to RequestId object
        // ↓ Output: RequestId object
        //
        // ⚠️ KEY POINT ⚠️
        // The user provides the RequestId string from register-request output
        // This RequestId is already computed based on (publicKey, stateHash)
        // If different secret or state used, RequestId will be different!

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 3: Query Aggregator for Inclusion Proof
        // ═══════════════════════════════════════════════════════════════════════
        const inclusionProofResponse = await client.getInclusionProof(requestId);
        // ↓ Calls: AggregatorClient.getInclusionProof(requestId)
        // ↓   ↓ Constructs query: { requestId: requestId.toJSON() }
        // ↓   ↓ Sends as JSON-RPC POST request:
        //        POST https://gateway.unicity.network
        //        {
        //          "jsonrpc": "2.0",
        //          "method": "get_inclusion_proof",
        //          "params": {
        //            "requestId": "0x..."
        //          },
        //          "id": 1
        //        }
        // ↓ Aggregator looks up RequestId in database
        // ↓ If found: Returns inclusion proof (merkle path)
        // ↓ If not found: Returns null

        // ═══════════════════════════════════════════════════════════════════════
        // STEP 4: Process Response
        // ═══════════════════════════════════════════════════════════════════════
        if (inclusionProofResponse && inclusionProofResponse.inclusionProof) {
          // ┌─────────────────────────────────────────────────────────────┐
          // │ Case A: Data Found - Inclusion Proof Available              │
          // └─────────────────────────────────────────────────────────────┘

          // Create InclusionProof from the response
          const inclusionProof = InclusionProof.fromJSON(inclusionProofResponse);
          // ↓ Input: Response containing merkle tree path
          // ↓ Output: InclusionProof object with:
          //    - merkleTreePath: [node1, node2, ...]
          //    - root: merkle tree root hash
          //    - index: position in tree

          // Create a trust base for verification
          const trustBase = RootTrustBase.fromJSON({
            version: "1",
            networkId: 1,
            epoch: "0",
            epochStartRound: "0",
            rootNodes: [],
            quorumThreshold: "0",
            stateHash: HexConverter.encode(new Uint8Array(32)),
            changeRecordHash: null,
            previousEntryHash: null,
            signatures: {}
          });
          // ↓ Creates a trust base (minimal, for verification)
          // ↓ In production, would contain real BFT consensus data

          // Verify the inclusion proof
          const status = await inclusionProof.verify(trustBase, requestId);
          // ↓ Verifies: merkle path proves RequestId is in merkle tree
          // ↓ Status: "VALID" or "INVALID"

          // Output the result
          console.log(`STATUS: ${status}`);
          console.log(`PATH: ${JSON.stringify(inclusionProof.merkleTreePath.toJSON(), null, 4)}`);
          // ↓ Shows: Verification status
          // ↓ Shows: Merkle path to root
        } else {
          // ┌─────────────────────────────────────────────────────────────┐
          // │ Case B: Data Not Found                                       │
          // └─────────────────────────────────────────────────────────────┘
          console.log('STATUS: NOT_FOUND');
          console.log('No inclusion proof available for this request ID');
          // ↓ RequestId not in aggregator database
          // ↓ Possible causes:
          //    1. Registration failed (aggregator error)
          //    2. Different RequestId was used
          //    3. Data not yet committed (wait for block)
          //    4. Wrong endpoint (querying different aggregator)
          //    5. Aggregator data loss/reset
        }
      } catch (err) {
        // ┌─────────────────────────────────────────────────────────────┐
        // │ Case C: Error During Execution                              │
        // └─────────────────────────────────────────────────────────────┘
        console.error(JSON.stringify(err));
        console.error(`Error getting request: ${JSON.stringify(err instanceof Error ? err.message : String(err))}`);
        // ↓ Network error (endpoint unreachable)
        // ↓ Parsing error (invalid response format)
        // ↓ Timeout (aggregator not responding)
      }
    });
}
```

---

## Data Transformation Chain

### register-request: Input → Output

```
USER INPUT:
  secret = "mysecret"
  state = "mystate"
  transition = "mytransition"

         ↓ Step 1: Secret → Public Key
  publicKey = 0xa1b2c3d4... (Ed25519 derived from secret)

         ↓ Step 2: State → Hash
  stateHash = 0x5ebf5d... (SHA256("mystate"))

         ↓ Step 3: Transition → Hash
  transactionHash = 0x7c4a9e... (SHA256("mytransition"))

         ↓ Step 4: RequestId = SHA256(publicKey || stateHash)
  requestId = 0xd4e5f6...

         ↓ Step 5: Authenticator = Sign(transactionHash + stateHash)
  authenticator = {
    publicKey: 0xa1b2...,
    signature: 0x9f8e... (Sign(transactionHash + stateHash)),
    stateHash: 0x5ebf...,
    algorithm: "Ed25519"
  }

         ↓ Step 6: Submit (requestId, transactionHash, authenticator)
  POST /submit_commitment
  {
    "requestId": "0xd4e5f6...",
    "transactionHash": "0x7c4a9e...",
    "authenticator": {
      "publicKey": "0xa1b2...",
      "signature": "0x9f8e...",
      "stateHash": "0x5ebf...",
      "algorithm": "Ed25519"
    }
  }

         ↓ Step 7: Aggregator Response
  {
    "status": "SUCCESS"
  }

OUTPUT:
  "Request successfully registered. Request ID: 0xd4e5f6..."
```

### get-request: Input → Output

```
USER INPUT:
  requestId = "0xd4e5f6..." (from previous register-request output)

         ↓ Step 1: Parse RequestId
  requestId = RequestId object

         ↓ Step 2: Query Aggregator
  GET /get_inclusion_proof
  {
    "requestId": "0xd4e5f6..."
  }

         ↓ Step 3: Aggregator Response
  {
    "inclusionProof": {
      "merkleTreePath": [
        { "hash": "0x...", "isLeft": true },
        { "hash": "0x...", "isLeft": false },
        ...
      ],
      "root": "0x...",
      "index": 42
    }
  }

         ↓ Step 4: Verify Merkle Path
  status = "VALID" or "INVALID"

OUTPUT:
  "STATUS: VALID"
  "PATH: { ... }"
```

---

## Key Code Locations Reference

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `registerRequestCommand()` | register-request.ts | 11-56 | Command definition |
| Create signing service | register-request.ts | 27-28 | Derive public key |
| Hash state | register-request.ts | 31-32 | Create stateHash |
| Hash transition | register-request.ts | 34-35 | Create transactionHash |
| Create RequestId | register-request.ts | 38 | **KEY: Transition NOT used** |
| Create authenticator | register-request.ts | 41 | **KEY: Transition IS used (via hash)** |
| Submit to aggregator | register-request.ts | 44 | Send all three items |
| `RequestId.create()` | SDK RequestId.js | 24-25 | Public method |
| `RequestId.createFromImprint()` | SDK RequestId.js | 33-35 | **KEY: Transition excluded** |
| `AggregatorClient.submitCommitment()` | SDK AggregatorClient.js | 24-27 | Network submission |
| `getRequestCommand()` | get-request.ts | 10-62 | Command definition |
| Query inclusion proof | get-request.ts | 27 | Network query |
| `AggregatorClient.getInclusionProof()` | SDK AggregatorClient.js | 32-34 | Network query |

---

## Critical Findings Matrix

| Finding | Evidence | Impact |
|---------|----------|--------|
| RequestId ≠ Transition | Line 38 in register-request.ts | Same secret+state → Same RequestId regardless of transition |
| Transition IS submitted | Lines 44 in register-request.ts | transactionHash and signature sent to aggregator |
| Original transition NOT sent | Line 35-36 vs line 44 | Original "transition" string is hashed, original lost |
| Signature covers transition | Line 41 in register-request.ts | Signature proves knowledge of transition (indirectly) |
| get-request only queries by RequestId | Line 27 in get-request.ts | Cannot query by transition, only by source state |
| get-request cannot distinguish transitions | Inherent design | Multiple transitions with same RequestId are ambiguous |

---

## Execution Sequences

### Scenario 1: Normal Flow
```
register(..., "secret", "state", "trans-v1")
  ↓ RequestId = SHA256(publicKey || stateHash) = X
  ↓ transactionHash = SHA256("trans-v1")
  ↓ signature = Sign(transactionHash)
  ↓ Aggregator stores: DB[X] = {transactionHash, signature}
  ↓ Returns: "SUCCESS"

get-request X
  ↓ Query Aggregator: get_inclusion_proof(X)
  ↓ Aggregator finds: DB[X] exists
  ↓ Returns: inclusion proof for X
  ↓ Status: "VALID" or "INVALID"
```

### Scenario 2: Same Secret+State, Different Transition
```
register(..., "secret", "state", "trans-v1")
  ↓ RequestId = X
  ↓ transactionHash = SHA256("trans-v1")
  ↓ Aggregator stores: DB[X] = {transactionHash=hash1, signature=sig1}

register(..., "secret", "state", "trans-v2")
  ↓ RequestId = X (SAME!)
  ↓ transactionHash = SHA256("trans-v2") (DIFFERENT)
  ↓ Aggregator behavior:
    Option A: DB[X] = {transactionHash=hash2, signature=sig2} (overwrite)
    Option B: Error "duplicate RequestId"
    Option C: Store both (ambiguous retrieval)

get-request X
  ↓ Returns proof for: hash1 or hash2 (depends on aggregator)
  ↓ Cannot distinguish which transition was stored
```

### Scenario 3: Different Secret, Same State
```
register(..., "secret-v1", "state", "trans")
  ↓ publicKey-v1 = derive("secret-v1")
  ↓ RequestId = SHA256(publicKey-v1 || stateHash) = X

register(..., "secret-v2", "state", "trans")
  ↓ publicKey-v2 = derive("secret-v2") (DIFFERENT)
  ↓ RequestId = SHA256(publicKey-v2 || stateHash) = Y (DIFFERENT!)

get-request X
  ↓ Finds first registration

get-request Y
  ↓ Finds second registration
```

