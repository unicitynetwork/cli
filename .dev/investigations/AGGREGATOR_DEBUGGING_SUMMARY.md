# Aggregator Debugging Summary

## Problem Discovered

The CLI's `register-request` command was failing because:
1. **Incorrect transaction hash structure** - Using simple string hashing instead of CBOR-encoded `MintTransactionData`
2. **Corrupted aggregator queue** - Thousands of duplicate/conflicting commitments from earlier testing

## Root Cause Analysis

### Issue 1: Transaction Hash Structure

**What was wrong:**
```typescript
// OLD INCORRECT APPROACH
const transactionHash = await hasher.update(new TextEncoder().encode(transition)).digest();
```

**What's required:**
```typescript
// CORRECT APPROACH
const mintTransactionData = await MintTransactionData.create(
  tokenId, tokenType, tokenData, coinData, recipientAddress, salt, dataHash, null
);
const transactionHash = await mintTransactionData.calculateHash();
```

The transaction hash must be computed from a CBOR-encoded structured array containing:
- tokenId
- tokenType
- tokenData
- coinData
- recipient address
- salt
- recipientDataHash
- reason

### Issue 2: Corrupted Aggregator Queue

**Symptoms:**
- Every round processed 10,000 commitments
- ~9,985 failures with error: `"smt: attempt to modify an existing leaf"`
- Only 15 valid commitments remained
- Error: `"expected at least 10000 pending entries but only found 15"`

**Root cause:**
- Persistent MongoDB/Redis data contained duplicate RequestIds with conflicting transaction data
- These were continuously retried, blocking all new valid commitments

## Solution Implemented

### Step 1: Clear Corrupted Data

```bash
# Stop aggregator
docker compose -f /path/to/docker-compose.yml down

# Clear MongoDB data
docker run --rm -v /path/to/mongodb_data:/data alpine sh -c "rm -rf /data/*"

# Clear Redis data
docker run --rm -v /path/to/redis_data:/data alpine sh -c "rm -rf /data/*"

# Restart with clean state
docker compose -f /path/to/docker-compose.yml up -d
```

### Step 2: Fix register-request Command

Updated `/home/vrogojin/cli/src/commands/register-request.ts` to:

1. **Create proper TokenId from state:**
   ```typescript
   const tokenIdHash = createHash('sha256').update(state).digest();
   const tokenId = new TokenId(tokenIdHash);
   ```

2. **Use official NFT token type:**
   ```typescript
   const tokenType = new TokenType(Buffer.from('f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509', 'hex'));
   ```

3. **Create structured token data:**
   ```typescript
   const metadata = { name: 'CLI Registered Token', state, timestamp: Date.now() };
   const tokenData = new TextEncoder().encode(JSON.stringify(metadata));
   ```

4. **Generate predicate and recipient address:**
   ```typescript
   const salt = crypto.getRandomValues(new Uint8Array(32));
   const signingService = await SigningService.createFromSecret(secretBytes);
   const predicate = await UnmaskedPredicate.create(tokenId, tokenType, signingService, HashAlgorithm.SHA256, salt);
   const recipientAddress = await (await predicate.getReference()).toAddress();
   ```

5. **Create MintTransactionData (CBOR-encodable):**
   ```typescript
   const mintTransactionData = await MintTransactionData.create(
     tokenId, tokenType, tokenData, TokenCoinData.create([]),
     recipientAddress, salt, dataHash, null
   );
   ```

6. **Create and submit MintCommitment:**
   ```typescript
   const commitment = await MintCommitment.create(mintTransactionData);
   const client = new StateTransitionClient(new AggregatorClient(endpoint));
   await client.submitMintCommitment(commitment);
   ```

### Step 3: Update Default Endpoints

Changed default endpoint from production to localhost:
```typescript
.option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'http://localhost:3000')
```

## Test Results

### ✅ Test 1: Register Request
```bash
$ npm run register-request -- my_secret_key my_state_data

Creating properly structured commitment...
Token ID: ffa86f553e53797300c246977cee054bf36d24641948f3658170e7c29bb82a71
Request ID: 000095b63519aae293343635afb037a75ff9b8fa802008fc79f78cc83cecf34d2f5e
✅ Request successfully registered and submitted to aggregator
```

### ✅ Test 2: Get Inclusion Proof
```bash
$ npm run get-request -- 000095b63519aae293343635afb037a75ff9b8fa802008fc79f78cc83cecf34d2f5e

STATUS: OK (expected)
This is an INCLUSION PROOF.
  - The RequestId EXISTS in the Sparse Merkle Tree
  - A commitment was successfully registered
  Root: 00005a10ad4737d79921a407e09a75bb6b4c4a2a468a001c460dfc4a34e1c5d58ed9
  Transaction hash: 00004c4dba950afb106af1fbc65eebb56d4863c738a04a55fbf5aee9c862da10bddb
  Has authenticator: yes
```

### ✅ Test 3: Get Exclusion Proof
```bash
$ npm run get-request -- 0000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff

STATUS: PATH_NOT_INCLUDED
This is an EXCLUSION PROOF (non-inclusion proof).
  - The RequestId does NOT exist in the Sparse Merkle Tree
  - The proof cryptographically demonstrates absence
  Root: 00005a10ad4737d79921a407e09a75bb6b4c4a2a468a001c460dfc4a34e1c5d58ed9
```

## Key Learnings

### 1. Transaction Structure Requirements

The aggregator requires properly structured transaction data, not simple string hashes. The structure must be:
- **CBOR-encodable** - Uses standard CBOR serialization
- **Complete** - Includes all required fields (tokenId, tokenType, recipient, salt, etc.)
- **Properly hashed** - Transaction hash = SHA256(CBOR-encoded MintTransactionData)

### 2. Aggregator Validation

The aggregator validates:
- ✅ **Signature authenticity** - Must be valid ECDSA signature
- ✅ **RequestId derivation** - Must equal hash(publicKey + stateHash)
- ✅ **Transaction structure** - Must be properly CBOR-encoded
- ❌ **NOT validated** - Token metadata, business logic, token existence

### 3. Sparse Merkle Tree Proofs

**Inclusion Proof (OK status):**
- Non-null `authenticator` field
- Non-null `transactionHash` field
- Proves RequestId exists in tree

**Exclusion Proof (PATH_NOT_INCLUDED status):**
- Null `authenticator` field
- Null `transactionHash` field
- Proves RequestId does NOT exist in tree
- Cryptographically demonstrates the absence

### 4. RequestId Immutability

Once a RequestId is registered with specific transaction data:
- ✅ Can resubmit with SAME transaction data (idempotent)
- ❌ Cannot submit with DIFFERENT transaction data
- Attempting to modify will cause "attempt to modify an existing leaf" error

## CLI Usage Examples

### Register a new commitment
```bash
# Basic usage
npm run register-request -- <secret> <state>

# With custom metadata
npm run register-request -- my_secret my_state --metadata '{"description":"My token"}'

# With custom token type
npm run register-request -- my_secret my_state --token-type <hex_type_id>

# With production endpoint
npm run register-request -- my_secret my_state -e https://gateway.unicity.network
```

### Query inclusion/exclusion proof
```bash
# Check if request exists
npm run get-request -- <requestId>

# With custom endpoint
npm run get-request -- <requestId> -e https://gateway.unicity.network
```

## Architecture Diagram

```
┌─────────────┐
│ CLI Command │
└──────┬──────┘
       │
       ├─ Create TokenId from state hash
       ├─ Create SigningService from secret
       ├─ Generate salt & predicate
       ├─ Create recipient address
       ├─ Build MintTransactionData (CBOR-encodable)
       │   ├─ tokenId
       │   ├─ tokenType
       │   ├─ tokenData (metadata)
       │   ├─ coinData
       │   ├─ recipient
       │   ├─ salt
       │   ├─ recipientDataHash
       │   └─ reason
       ├─ Create MintCommitment
       │   ├─ RequestId = hash(publicKey + stateHash)
       │   ├─ TransactionHash = hash(CBOR(MintTransactionData))
       │   └─ Authenticator = sign(TransactionHash)
       │
       ▼
┌──────────────────────┐
│ StateTransitionClient│
└──────────┬───────────┘
           │
           ▼
┌──────────────────┐
│ AggregatorClient │
└──────────┬───────┘
           │
           ▼
┌────────────────────┐      ┌──────────┐
│  Aggregator Queue  │─────▶│ MongoDB  │
│  (Redis)           │      │ (State)  │
└────────────────────┘      └──────────┘
           │
           ▼
┌────────────────────────────┐
│ Round Processing           │
│ - Validate signatures      │
│ - Verify RequestId         │
│ - Check for duplicates     │
│ - Add to Sparse Merkle Tree│
└────────────────────────────┘
           │
           ▼
┌────────────────────────────┐
│ Inclusion/Exclusion Proof  │
│ - Merkle path              │
│ - Root hash                │
│ - Authenticator (if exists)│
└────────────────────────────┘
```

## Files Modified

1. **`/home/vrogojin/cli/src/commands/register-request.ts`**
   - Complete rewrite using MintTransactionData structure
   - Added support for token types and metadata
   - Changed default endpoint to localhost

2. **`/home/vrogojin/cli/src/commands/get-request.ts`**
   - Changed default endpoint to localhost
   - Already had proper inclusion/exclusion proof handling

## Aggregator Data Cleanup

Cleaned the following directories:
- `/home/vrogojin/cli/ref_materials/aggregator-latest/data/mongodb_data/`
- `/home/vrogojin/cli/ref_materials/aggregator-latest/data/redis_data/`

## Next Steps

Potential improvements:
1. Add `--wait-for-inclusion` flag to register-request for automatic polling
2. Support for token transfers (not just mints)
3. Add `--verify` flag to validate proof cryptographically
4. Export token to TXF format after successful registration
5. Batch registration command for multiple requests

## Conclusion

The CLI now properly:
- ✅ Creates structured commitments using MintTransactionData
- ✅ Submits to aggregator using StateTransitionClient
- ✅ Gets included in Sparse Merkle Tree
- ✅ Retrieves valid inclusion proofs
- ✅ Handles exclusion proofs correctly
- ✅ Works with clean local aggregator

The root issues were:
1. **Incorrect transaction structure** (simple hash vs CBOR-encoded structure)
2. **Corrupted aggregator queue** (cleared by removing persistent data)

Both are now resolved and the system is working as designed.
