# UNCT Architecture & Design - Comprehensive Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [Component Design](#component-design)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Security Model](#security-model)
6. [Cryptographic Primitives](#cryptographic-primitives)
7. [Integration Points](#integration-points)

---

## System Overview

### Unicity vs Bitcoin: Key Differences

| Aspect | Bitcoin | Unicity |
|--------|---------|---------|
| **Coin Storage** | Public blockchain ledger | Offline client-side tokens |
| **Balance Tracking** | UTXO set in blockchain | Individual token containers |
| **Verification** | Query blockchain | Self-contained proofs in token |
| **Privacy** | Pseudo-anonymous | Enhanced (offline storage) |
| **Origin Proof** | Coinbase transaction | Merkle root + segregated witness |

### Three-Layer Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  LAYER 3: Token State Transition (CLI Tools)                 │
│  • Mint UNCT tokens with proofs                              │
│  • Verify UNCT tokens                                        │
│  • Transfer tokens (future)                                  │
└──────────────────────────────────────────────────────────────┘
                          ↑ RPC Queries ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 2: Segregated Witness Storage                         │
│  • Stores (checkpoint, target, signature) tuples             │
│  • Indexed by merkle root and block height                   │
│  • Provides proof retrieval API                              │
└──────────────────────────────────────────────────────────────┘
                          ↑ References ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 1: PoW Blockchain (Unicity PoW)                       │
│  • Bitcoin-like RandomX PoW chain                            │
│  • Block headers contain merkle roots                        │
│  • Provides immutable timestamp anchoring                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Architecture Principles

### 1. **Separation of Concerns**

```
Data Structures (types/)
    ↓ used by
Utilities (utils/)
    ↓ used by
Commands (commands/)
    ↓ registered in
Main CLI (index.ts)
```

- **Types**: Pure data structures with no business logic
- **Utils**: Reusable components (PoW client, crypto operations)
- **Commands**: User-facing CLI logic
- **Index**: Application entry point and command registration

### 2. **Security-First Design**

```
Pre-Generation Phase (Secret):
  tokenId → NEVER transmitted until block is mined
  target → Derived but can be shared with miner

Mining Phase:
  target → Submitted to PoW chain
  tokenId → Still secret

Finalization Phase:
  tokenId → Revealed only in final token
  Proof → Cryptographically binds tokenId to block
```

**Why tokenId must be secret during mining:**
- Prevents front-running attacks
- Ensures only pre-generator can claim the mined coin
- Creates unforgeable link between secret and blockchain proof

### 3. **Immutable Proof Chain**

```
tokenId (secret)
  ↓ SHA256
target (public after mining)
  ↓ included in
Segregated Witness
  ↓ merkle root in
Block Header (immutable)
  ↓ validated by
PoW Consensus
```

Once a block is mined, the proof chain is immutable and verifiable by anyone.

### 4. **Client-Side Verification**

No need to trust centralized servers - anyone can:
1. Query block header from PoW node
2. Query witness from witness service
3. Verify proof mathematically
4. Confirm coin origin independently

---

## Component Design

### Component: CoinOriginProof

**Purpose**: Cryptographic proof that a coin was mined into the PoW blockchain

**Design Decisions:**

1. **Version Field**: Enables future protocol upgrades without breaking compatibility
2. **TokenId Inclusion**: Binds proof to specific token (prevents proof reuse)
3. **Block Height**: Fast lookup without scanning entire chain
4. **Merkle Root**: Cryptographic anchor to immutable blockchain
5. **Target**: Enables verification without re-computation
6. **Optional Fields**: Balance between proof size and additional context

**Data Flow:**
```
Input: Block height, witness data, tokenId
  ↓
Construct CoinOriginProof {
  version: "1.0",
  tokenId: <from pre-mine>,
  blockHeight: <from registry>,
  merkleRoot: <from block header>,
  target: SHA256(tokenId),
  checkpoint: <from witness>
}
  ↓
Embed in token.data as JSON
  ↓
Output: Token with embedded proof
```

---

### Component: PreMineData

**Purpose**: Secure storage of secret data during multi-phase minting

**Design Decisions:**

1. **Status Tracking**: Prevents accidental double-minting
2. **Timestamp**: Audit trail for debugging
3. **Target Pre-computation**: Miner doesn't need tokenId
4. **File-Based Storage**: Simple, human-readable, version-controllable

**State Machine:**
```
[pending] → pre-generation complete, not yet submitted
    ↓
[submitted] → sent to miner, waiting for mining
    ↓
[mined] → block found, ready for finalization
    ↓
[finalized] → token created, process complete
```

**Security Considerations:**
- File should have restrictive permissions (600)
- Should be encrypted at rest (future enhancement)
- Should be backed up securely
- Should be deleted after finalization (optional)

---

### Component: PoWClient

**Purpose**: Abstract RPC interactions with PoW blockchain

**Architecture:**

```
┌──────────────────────────────────────────┐
│ PoWClient                                 │
├──────────────────────────────────────────┤
│ - devChainScript: string                 │
│ - rpcEndpoint?: string                   │
├──────────────────────────────────────────┤
│ + executeRPC(method, ...params)          │
│ + getBlockHeader(heightOrHash)           │
│ + getBlockCount()                        │
│ + getWitnessByHeight(height)             │
│ + getWitnessByMerkleRoot(root)           │
│ + queryTokenIdRegistry(tokenId, path)    │
│ + verifyTokenIdInBlock(tokenId, height)  │
└──────────────────────────────────────────┘
```

**Design Patterns:**

1. **Facade Pattern**: Hides complexity of RPC calls behind simple methods
2. **Strategy Pattern**: Can use either dev-chain.sh wrapper or direct RPC
3. **Error Handling**: Wraps all RPC errors with descriptive messages
4. **Type Safety**: Converts JSON responses to TypeScript interfaces

**Error Handling Strategy:**
```typescript
try {
  const result = await executeRPC(method, params);
  return parseAndValidate(result);
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    throw new Error('PoW node not running');
  } else if (error.message.includes('not found')) {
    throw new Error(`Block/witness not found: ${params}`);
  } else {
    throw new Error(`RPC error: ${error.message}`);
  }
}
```

---

## Data Flow Diagrams

### Complete Minting Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ USER: Run CLI command                                            │
│ $ unicity mint-uct-coin --pre-generate -o pre-mine.json         │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ CLI: mint-uct-coin.ts                                            │
│ • Generate random 32 bytes → tokenId                            │
│ • Compute SHA256(tokenId) → target                              │
│ • Create PreMineData { tokenId, target, status: 'pending' }     │
│ • Save to pre-mine.json                                          │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ USER: Submit to miner (external process)                         │
│ $ ./scripts/miner-simulator.sh reads pre-mine.json              │
│   OR real miner in production                                    │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ MINER: Mining process                                            │
│ 1. Read target from pre-mine.json                               │
│ 2. Fetch BFT checkpoint from network                            │
│ 3. Sign checkpoint with private key                             │
│ 4. Create witness:                                               │
│     leftControl = signed checkpoint (32 bytes)                  │
│     rightControl = target (32 bytes)                            │
│ 5. Compute merkle root:                                          │
│     merkleRoot = SHA256(leftControl || rightControl)            │
│ 6. Submit witness to PoW node via setmerkleroot RPC             │
│ 7. Wait for block to be mined (or mine it in regtest)          │
│ 8. Record: tokenId → blockHeight in tokenid-registry.txt       │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ POW BLOCKCHAIN: Block mined                                      │
│ • Block header includes merkle root from witness                │
│ • Block is validated by network consensus                       │
│ • Segregated witness stored separately                          │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ USER: Finalize token                                             │
│ $ unicity mint-uct-coin --finalize pre-mine.json -o token.txf  │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ CLI: mint-uct-coin.ts (finalize phase)                          │
│ 1. Load pre-mine.json                                            │
│ 2. Query registry: tokenId → blockHeight                        │
│ 3. Query PoW RPC: getblockheader(blockHeight) → merkleRoot     │
│ 4. Query witness RPC: getwitnessbyheight(blockHeight) → witness │
│ 5. Verify: SHA256(tokenId) == witness.target                    │
│ 6. Create CoinOriginProof                                        │
│ 7. Embed proof in token.data                                     │
│ 8. Mint token via SDK with proof                                │
│ 9. Save token to token.txf                                       │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ OUTPUT: UNCT Token file (token.txf)                             │
│ • Contains self-verifiable coin origin proof                    │
│ • Can be transferred to other parties                           │
│ • Can be verified independently                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Complete Verification Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ USER: Verify token                                               │
│ $ unicity verify-uct-coin -f token.txf                          │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ CLI: verify-uct-coin.ts                                          │
│ STEP 1: Load token from file                                    │
│ • Parse TXF JSON                                                 │
│ • Extract token.state.data                                       │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Standard SDK verification                               │
│ • Verify genesis inclusion proof                                │
│ • Verify transaction chain                                      │
│ • Verify signatures                                             │
│ • Verify state integrity                                        │
│ Result: PASS or FAIL                                             │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Extract CoinOriginProof                                 │
│ • Decode token.data from hex                                     │
│ • Parse JSON: { type: 'UNCT', coinOriginProof: {...} }         │
│ • Validate proof structure                                       │
│ • Extract: tokenId, blockHeight, merkleRoot, target             │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Query PoW blockchain                                    │
│ • RPC: getblockheader(blockHeight)                              │
│ • Extract: actual_merkleRoot, blockHash, timestamp              │
│ • RPC: getwitnessbyheight(blockHeight)                          │
│ • Extract: leftControl, rightControl (target), signature        │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Cryptographic verification                              │
│ Check 1: SHA256(tokenId) == witness.rightControl (target)       │
│ Check 2: proof.merkleRoot == blockHeader.merkleRoot             │
│ Check 3: witness.merkleRoot == blockHeader.merkleRoot           │
│ Check 4: SHA256(leftControl || rightControl) == merkleRoot      │
│ Result: ALL CHECKS PASS → VALID                                 │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ OUTPUT: Verification result                                      │
│ • STATUS: VALID or INVALID                                      │
│ • Details: Which checks passed/failed                           │
│ • Block info: height, hash, timestamp                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Security Model

### Threat Model

**Threats Mitigated:**

1. **Double-Spending**: Token has unique tokenId bound to specific block
2. **Coin Forgery**: Cannot create valid proof without mining
3. **Proof Reuse**: TokenId binding prevents using same proof for different tokens
4. **Front-Running**: Secret tokenId prevents attackers from claiming mined coin
5. **Tampered Proofs**: Merkle root in immutable blockchain prevents modification

**Threats NOT Mitigated (Require Additional Measures):**

1. **Private Key Theft**: Need secure key management
2. **Registry Manipulation**: Registry file should be append-only or in secure storage
3. **Network Attacks**: TLS/authentication needed for production RPC endpoints
4. **Eclipse Attacks**: Need connection to multiple PoW nodes

### Attack Scenarios & Defenses

#### Scenario 1: Attacker Tries to Forge Coin Origin

**Attack:**
1. Attacker creates fake CoinOriginProof
2. Claims coin was mined in block X
3. Attempts to pass verification

**Defense:**
```
Verification checks:
1. Query actual block header → merkleRoot
2. Query witness → target
3. Compute SHA256(tokenId) → must match target
4. Without mining, attacker cannot produce valid target-to-merkleRoot link
Result: FAIL - proof is invalid
```

#### Scenario 2: Attacker Tries to Steal Mined Coin

**Attack:**
1. Miner submits target to PoW chain
2. Attacker sees target in blockchain
3. Attacker tries to create token with proof

**Defense:**
```
Problem: Attacker doesn't know tokenId (only target is public)
  • target = SHA256(tokenId)
  • SHA256 is one-way function → cannot reverse
  • Attacker cannot create token without tokenId
Result: FAIL - cannot reconstruct pre-image
```

#### Scenario 3: Replay Attack (Reuse Proof)

**Attack:**
1. Attacker obtains valid UNCT token with proof
2. Extracts CoinOriginProof
3. Creates new token with same proof

**Defense:**
```
Verification checks tokenId binding:
1. Extract proof.tokenId
2. Check if token.id == proof.tokenId
3. If different: FAIL
4. Additionally: SDK prevents duplicate tokenIds in system
Result: FAIL - proof is bound to specific tokenId
```

---

## Cryptographic Primitives

### SHA-256 Hash Function

**Usage:**
```typescript
import crypto from 'crypto';

// Derive target from tokenId
const target = crypto.createHash('sha256')
  .update(Buffer.from(tokenId, 'hex'))
  .digest('hex');

// Compute merkle root
const merkleRoot = crypto.createHash('sha256')
  .update(Buffer.concat([leftControl, rightControl]))
  .digest('hex');
```

**Properties Utilized:**
- **Collision Resistance**: Infeasible to find two inputs with same hash
- **Pre-image Resistance**: Infeasible to reverse hash to find input
- **Avalanche Effect**: Small input change → completely different output

### BIP340 Schnorr Signatures (in PoW layer)

**Used For:**
- Signing BFT checkpoints
- Authenticating witness submissions

**Properties:**
- **Linearity**: Enables aggregation (future use)
- **Non-Malleability**: Signature cannot be altered
- **Batch Verification**: Can verify multiple signatures efficiently

### Merkle Trees (Conceptual)

**Role:**
```
Segregated Witness:
  leftControl (32 bytes) + rightControl (32 bytes)
       ↓ SHA256
  merkleRoot (32 bytes)
       ↓ Stored in
  Block Header (immutable)
```

---

## Integration Points

### Integration with PoW Blockchain

**RPC Methods Used:**

```typescript
// Get block header
getblockheader(height: number | hash: string): BlockHeader
// Returns: { height, hash, merkleRoot, timestamp, ... }

// Get current height
getblockcount(): number

// Get witness by height
getwitnessbyheight(height: number): WitnessData
// Returns: { found, witness: { leftControl, rightControl, signature, ... } }

// Get witness by merkle root
getwitness(merkleRoot: string): WitnessData
```

**Error Handling:**
- Connection refused → "PoW node not running"
- Block not found → "Block height X does not exist"
- Witness not found → "No witness for block X"

### Integration with Unicity SDK

**Token Minting:**
```typescript
import { Token } from '@unicitylabs/state-transition-sdk';

// Mint token with embedded proof
const token = await Token.mint({
  tokenId: preMineData.tokenId,
  tokenType: UCT_TYPE_ID,
  data: embedProofInTokenData(coinOriginProof),
  coins: [{ amount: '1000000000000000000' }],  // 1 UCT
  // ... other SDK parameters
});

await token.save('token.txf');
```

**Token Loading:**
```typescript
// Load and verify
const tokenJson = JSON.parse(fs.readFileSync('token.txf', 'utf8'));
const token = await Token.fromJSON(tokenJson);

// SDK verification (standard)
await token.verify();

// Extract coin origin proof (our addition)
const proof = extractProofFromTokenData(token.state.data);
```

### Integration with TokenId Registry

**File Format:**
```
tokenId<TAB>blockHeight
5cb2392...c17802c8d<TAB>105
734c86e...698abf6e32<TAB>106
```

**Operations:**
```typescript
// Append new entry (done by miner-simulator)
fs.appendFileSync(registryPath, `${tokenId}\t${blockHeight}\n`);

// Query (done by CLI)
const lines = fs.readFileSync(registryPath, 'utf8').split('\n');
const entry = lines.find(line => line.startsWith(tokenId));
const blockHeight = parseInt(entry.split('\t')[1]);
```

**Future Enhancements:**
- Use database (SQLite/PostgreSQL) for faster lookups
- Add indexing by block height
- Include merkle root in registry for validation
- Add timestamp and status fields

---

**Document Version**: 1.0
**Last Updated**: 2025-01-18
**Maintained by**: Unicity Development Team
