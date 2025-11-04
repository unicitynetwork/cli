# Proof Aggregator Expert Agent Profile
## Unicity Aggregator Layer Technical Specification & Implementation Guide

**Document Status:** Comprehensive Technical Reference
**Last Updated:** November 4, 2025
**Scope:** Unicity Aggregator Go Implementation (v1.0+)
**Repository:** https://github.com/unicitynetwork/aggregator-go

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Core Components & Functionality](#core-components--functionality)
4. [Aggregator Layer Design](#aggregator-layer-design)
5. [Proof Aggregation Mechanism](#proof-aggregation-mechanism)
6. [API Specification](#api-specification)
7. [Integration Patterns](#integration-patterns)
8. [Deployment & Configuration](#deployment--configuration)
9. [Operational Monitoring](#operational-monitoring)
10. [Security & Validation](#security--validation)
11. [Performance Characteristics](#performance-characteristics)
12. [Development & Testing](#development--testing)
13. [Troubleshooting & Best Practices](#troubleshooting--best-practices)

---

## Executive Summary

The **Unicity Aggregator** is a high-performance, Byzantine Fault Tolerant proof aggregation system implemented in Go that enables trustless, off-chain state transition aggregation with cryptographic proof generation. It serves as the critical infrastructure layer between off-chain agents and the Unicity consensus layer, implementing a Sparse Merkle Tree (SMT)-based commitment aggregation protocol.

### Key Capabilities

- **JSON-RPC 2.0 API** for state transition submission and proof queries
- **Sparse Merkle Tree (SMT)** implementation for O(log n) inclusion proofs
- **Automated Block Creation** with 1-second round duration and configurable batch limits (up to 1,000 commitments per batch)
- **High Availability (HA)** through distributed leader election with TTL-based locking
- **Cryptographic Validation** using secp256k1 signature verification
- **MongoDB Persistence** with optimized indexing and query patterns
- **Non-Deletion Proofs** for global commitment verification
- **TLS/HTTPS & CORS Support** for secure network communication
- **Docker & Kubernetes Ready** with comprehensive orchestration examples

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Language | Go | 1.25+ |
| Cryptography | secp256k1 | Latest |
| Data Structure | Sparse Merkle Tree | Custom Implementation |
| Database | MongoDB | 4.4+ |
| Protocol | JSON-RPC 2.0 | Compliant |
| Consensus | Byzantine Fault Tolerant | Fast finality (1s rounds) |
| Transport | HTTP/HTTPS, TCP/P2P | Configurable |

---

## Architecture Overview

### System Context

The Unicity network implements a **modular, multi-layer architecture** that separates concerns and enables horizontal scalability:

```
┌─────────────────────────────────────────────────────────────┐
│                      Consensus Layer                         │
│  (PoW Foundation + BFT Fast Finality - Anchors the Stack)   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Proof Aggregation Layer (THIS)                  │
│    (Aggregator Service - Trustless SMT Aggregation)         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  JSON-RPC Endpoints  │  SMT Engine  │  HA Controller   │ │
│  │  State Validators    │  Block Mgmt  │  BFT Interface   │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────┬──────────────────────────────────────────────────┘
           │
    ┌──────┴───────┬──────────────┐
    ▼              ▼              ▼
┌─────────┐  ┌─────────────┐  ┌──────────────┐
│  Agent  │  │ State Trans │  │ Off-Chain    │
│  Layer  │  │   Layer     │  │ Computation  │
└─────────┘  └─────────────┘  └──────────────┘
```

### Core Architectural Principles

1. **Off-Chain Execution**: All assets and state transitions exist off-chain; only cryptographic commitments are recorded on-chain
2. **Trustless Aggregation**: Uses cryptographic proofs rather than trusted authorities for commitment verification
3. **Horizontal Scalability**: Stateless aggregators can be added/removed dynamically
4. **Privacy Preservation**: Commitments contain no information about token details or transaction nature
5. **Double-Spend Prevention**: Single-spend proofs ensure non-forking compliance
6. **Fast Finality**: 1-second block creation for sub-second aggregation

---

## Core Components & Functionality

### 1. Internal Package Structure

The aggregator-go repository organizes functionality across 12 specialized internal packages:

#### **1.1 Core Service Packages**

**`internal/service`**
- Primary service orchestration and request processing
- Commitment aggregation logic
- Block creation and management
- Response formatting and error handling
- Statistics and metrics collection

**`internal/round`**
- Round-based block creation cycle management
- Timing and scheduling for batch processing
- Leader coordination for block proposal
- Round state machine implementation

**`internal/smt`** (Sparse Merkle Tree)
- Core SMT data structure implementation
- Leaf node management and updates
- Root hash computation
- Proof path generation and verification
- Thread-safe concurrent operations
- Snapshot management for consistency

**Files in smt package:**
- `smt.go` - Core SMT logic
- `thread_safe_smt.go` - Concurrent access wrapper
- `thread_safe_smt_snapshot.go` - Immutable snapshots
- Comprehensive test suites (unit, benchmark, debug)

#### **1.2 Infrastructure Packages**

**`internal/bft`**
- Byzantine Fault Tolerant consensus integration
- Communication with consensus layer nodes
- Block certificate validation and propagation
- Leader election participation
- Gossip protocol implementation

**`internal/ha`** (High Availability)
- Distributed leader election mechanism
- TTL-based lock acquisition and renewal
- Automatic failover coordination
- Health monitoring and recovery
- MongoDB-backed distributed locking

**`internal/storage`**
- MongoDB interface and query builders
- Index management and optimization
- Persistence layer abstraction
- Data migration and versioning
- Query result marshaling

**`internal/gateway`**
- JSON-RPC 2.0 endpoint implementation
- HTTP request routing and handling
- Parameter validation and sanitization
- Response formatting
- Error handling and status codes

#### **1.3 Validation & Security Packages**

**`internal/signing`**
- secp256k1 signature verification
- Public key validation and recovery
- Cryptographic operation management
- Nonce and message digest validation

**`internal/models`**
- Data structure definitions
- Type-safe request/response objects
- Commitment and block representations
- Proof data structures
- Serialization/deserialization logic

#### **1.4 Support Packages**

**`internal/config`**
- Configuration management
- Environment variable processing
- Default value handling
- Validation rules enforcement
- Configuration reloading

**`internal/logger`**
- Structured logging implementation
- Log level management
- Performance instrumentation
- Request/response tracing
- Distributed tracing support

**`internal/testutil`**
- Test fixtures and helpers
- Mock implementations
- Test data generators
- Assertion utilities
- Performance testing tools

---

### 2. Primary Functionality Overview

#### **Request Processing Pipeline**

```
Client Request
     │
     ▼
┌─────────────────────────┐
│  HTTP Handler / Router  │  (gateway)
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Parameter Validation   │  (models)
│  - Format validation    │
│  - Length checks        │
│  - Hex string format    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Signature Verification │  (signing)
│  - Public key recovery  │
│  - Signature validation │
│  - Nonce checking       │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Commitment Processing  │  (service)
│  - Queuing              │
│  - Batch accumulation   │
│  - Storage persistence  │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Round Execution        │  (round)
│  - Timer triggers       │
│  - Block creation       │
│  - SMT update           │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  BFT Submission         │  (bft)
│  - Block proposal       │
│  - Certificate receipt  │
│  - Finality achievement │
└──────────┬──────────────┘
           │
           ▼
   Response to Client
   (Proof data or status)
```

---

## Aggregator Layer Design

### 1. State Transition Model

The aggregator operates on **state transitions** (commitments) submitted by off-chain agents:

#### **Commitment Structure**

A state transition commitment contains:

```typescript
{
  requestId: string;           // 68-char hex (sha256 hash with "0000" prefix)
  publicKey: string;           // 66-char compressed secp256k1 public key
  signature: string;           // 130-char hex (65-byte signature + 1-byte recovery)
  stateHash: string;           // DataHash imprint format (32 bytes, "0000" prefix)
  transactionHash?: string;    // Optional transaction identifier
  timestamp?: number;          // Request timestamp (milliseconds)
  data?: Record<string, any>;  // Optional arbitrary metadata
}
```

#### **Commitment Validation Rules**

1. **requestId**: Must be exactly 68 hex characters with "0000" SHA256 prefix
2. **publicKey**: Must be 66-character compressed secp256k1 format (03/02 prefix + 64 hex chars)
3. **signature**: Must be 130 hex characters (65-byte signature + recovery byte)
4. **stateHash/transactionHash**: Must be valid DataHash format with "0000" prefix
5. **Signature Verification**: ECDSA verification against submitted public key
6. **Duplicate Prevention**: No duplicate requestIds in same or previous blocks

#### **Commitment Lifecycle**

```
SUBMITTED → QUEUED → BATCHED → INCLUDED_IN_BLOCK → FINALIZED_ON_CONSENSUS
                                         │
                                         └─→ Available in inclusion proofs
                                         └─→ Part of SMT tree
                                         └─→ Immutable via consensus
```

### 2. Block Creation Model

#### **Automated Block Generation**

- **Round Duration**: Default 1 second (configurable via `ROUND_DURATION`)
- **Batch Limit**: Up to 1,000 commitments per block (configurable via `BATCH_LIMIT`)
- **Leader Election**: Single leader proposes blocks; others validate
- **Deterministic Ordering**: Commitments ordered by submission timestamp
- **Atomic Updates**: All-or-nothing block commitment

#### **Block Structure**

```typescript
{
  height: number;              // Sequential block number (blockHeight)
  timestamp: number;           // Block creation time (ms)
  proposer: string;            // Leader node identifier
  commitments: Commitment[];   // Ordered state transitions
  merkleRoot: string;          // SMT root hash
  previousBlockHash: string;   // Chain integrity link
  certificate: BFTCertificate; // Consensus layer signature
  metadata: {
    commitmentCount: number;
    aggregationTime: number;   // Time to aggregate (ms)
    smtUpdateTime: number;     // Time to update tree (ms)
  }
}
```

#### **Round-Based Execution**

```
Time: T0
├─ Accept commitments into pending queue
├─ Accumulate into batch
│
Time: T0 + ROUND_DURATION
├─ [Leader] Creates block from pending commitments
├─ [Leader] Updates Sparse Merkle Tree with new leaves
├─ [Leader] Computes new root hash
├─ [Leader] Submits to BFT consensus layer
├─ [All] Validate block structure and signatures
├─ [All] Update local SMT copy
│
Time: T0 + 2*ROUND_DURATION
├─ Await BFT consensus finality (typically immediate)
├─ Block becomes immutable
└─ Inclusion proofs now available for all commitments
```

### 3. Merkle Tree Architecture

#### **Sparse Merkle Tree (SMT) Overview**

The aggregator implements a production-grade Sparse Merkle Tree for commitment verification:

**Properties:**
- **Height**: Typically 256 levels (for 256-bit keys)
- **Leaf Count**: Only non-zero leaves stored (sparse)
- **Empty Node Hash**: All empty nodes have deterministic hash
- **Order Independence**: Same set of insertions always produces same root
- **Proof Size**: O(log n) where n = tree height (~256 for full tree)

**Key Operations:**

```
Update(key, value):
  ├─ Traverse from root to leaf (following key bits)
  ├─ Create/update leaf node
  ├─ Recompute hashes up to root
  └─ New root reflects all previous + new data

GetProof(key):
  ├─ Traverse tree to locate key
  ├─ Collect sibling hashes at each level
  ├─ Return proof = [siblings...] (log n elements)
  └─ Verifier can reconstruct root from leaf + proof

VerifyProof(key, value, proof, root):
  ├─ Start with hash(value) as leaf
  ├─ For each sibling in proof:
  │  └─ Combine with current hash using bit direction
  ├─ Final hash must equal root
  └─ Returns true/false
```

#### **SMT Implementation Details**

**Thread Safety:**
- `thread_safe_smt.go` provides concurrent read-write access
- Uses RWMutex for read-optimized concurrent operations
- Multiple readers can access simultaneously
- Exclusive write access during tree updates

**Snapshot Consistency:**
- `thread_safe_smt_snapshot.go` provides immutable tree snapshots
- Snapshots capture tree state at specific block height
- Enables consistent proof generation across round boundaries
- Prevents proof invalidation during tree updates

**Performance Optimizations:**
- Leaf caching for frequently accessed nodes
- Batch updates for multiple commitments
- Hash computation parallelization
- Disk-backed node storage for large trees

#### **Integration with Block Processing**

```
Block Creation:
  1. Get current SMT state (snapshot)
  2. For each commitment in block:
     ├─ Compute leaf hash from commitment data
     ├─ Insert into temporary SMT copy
     └─ Track leaf position
  3. Compute new root hash
  4. Lock current SMT
  5. Atomically swap in updated tree
  6. Release lock

Proof Generation:
  ├─ Get latest SMT snapshot
  ├─ For requested commitment:
  │  ├─ Locate leaf in tree
  │  └─ Generate proof path
  └─ Return [sibling_hashes...]
```

---

## Proof Aggregation Mechanism

### 1. Commitment Aggregation Flow

#### **Phase 1: Acceptance**

```
Agent submits commitment via submit_commitment RPC:
  ├─ Aggregator receives JSON-RPC request
  ├─ Validates commitment format and signatures
  ├─ Checks for duplicate requestId
  ├─ Persists to MongoDB "pending_commitments" collection
  ├─ Increments pending counter
  └─ Returns requestId to agent
```

#### **Phase 2: Batching**

```
Automatic batching (every 1 second):
  ├─ Leader reads pending_commitments (up to BATCH_LIMIT)
  ├─ Sorts by submission timestamp
  ├─ Creates block with ordered commitments
  ├─ Moves commitments to "submitted_commitments"
  └─ Keeps pending_commitments updated
```

#### **Phase 3: Aggregation**

```
During block creation:
  ├─ Load current SMT snapshot
  ├─ For each commitment in batch:
  │  ├─ Compute leaf = Hash(commitment)
  │  ├─ Extract requestId as key
  │  ├─ Insert (key, leaf) into SMT
  │  └─ Track position in block
  ├─ Compute new SMT root
  ├─ Create block object with all metadata
  └─ Store block in MongoDB "blocks" collection
```

#### **Phase 4: Finalization**

```
After BFT consensus agreement:
  ├─ Block receives consensus certificate
  ├─ Marked as FINALIZED in database
  ├─ Inclusion proofs become permanent
  ├─ SMT root immutable
  ├─ Commitments can no longer be modified
  └─ Available for all future queries
```

### 2. Inclusion Proof Generation

#### **Proof Structure**

When a client requests an inclusion proof for a commitment, the aggregator returns:

```typescript
{
  commitmentId: string;          // The requested commitment ID
  blockHeight: number;           // Block containing commitment
  blockTimestamp: number;        // Block creation time
  merkleProof: {
    leaf: string;               // Hash of the commitment
    path: {
      position: number;         // Position in SMT tree (0-255)
      siblings: string[];       // Sibling hashes from leaf to root
      direction: boolean[];     // Left/right indicators for each level
    }
  };
  root: string;                 // The SMT root hash at that block
  certificate?: BFTCertificate; // Consensus layer signature
}
```

#### **Proof Generation Algorithm**

```
get_inclusion_proof(requestId):
  1. Query MongoDB for commitment (index: requestId)
  2. Get block height from commitment record
  3. Load SMT snapshot at that block height
  4. Call SMT.GetProof(requestId):
     ├─ Navigate tree from root to leaf
     ├─ At each level:
     │  ├─ Get current node hash
     │  ├─ Determine bit value from key at level
     │  ├─ Add sibling hash to proof
     │  └─ Move to child node
     └─ Return proof path (max 256 hashes)
  5. Load block and extract timestamp
  6. Load BFT certificate if available
  7. Return proof JSON
```

#### **Proof Verification (Client-Side)**

```
verify_proof(commitment, proof, publicRoot):
  1. Compute leaf = Hash(commitment)
  2. Set current = leaf
  3. For each (index, sibling, direction) in proof.path:
     ├─ If direction == LEFT:
     │  └─ current = Hash(sibling || current)
     ├─ Else:
     │  └─ current = Hash(current || sibling)
  4. Return (current == publicRoot)
```

### 3. Non-Deletion Proofs

The aggregator generates **global non-deletion proofs** that cryptographically prove no commitments have been removed from the aggregated state.

#### **Non-Deletion Proof Structure**

```typescript
{
  blockHeight: number;           // Proof is for this block height
  root: string;                 // SMT root at that height
  allCommitmentIds: string[];   // Complete list of all commitments
  timestamp: number;            // When proof was generated
  commitment: string;           // Serialized commitment object
  signature: string;            // Aggregator signature over all data
}
```

#### **Verification Mechanism**

A non-deletion proof demonstrates:
1. **Completeness**: All historical commitments are included
2. **Integrity**: No commitments have been removed since announcement
3. **Ordering**: Commitments appear in consistent order
4. **Non-Forking**: Single version of truth (due to BFT consensus)

---

## API Specification

### 1. Endpoint Overview

The aggregator exposes JSON-RPC 2.0 endpoints on the gateway interface:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | POST | Primary JSON-RPC 2.0 endpoint |
| `/health` | GET | Service health and status |
| `/docs` | GET | Interactive API documentation |

### 2. JSON-RPC 2.0 Protocol

#### **Request Format**

```json
{
  "jsonrpc": "2.0",
  "method": "method_name",
  "params": {
    // Method-specific parameters
  },
  "id": 1
}
```

#### **Success Response**

```json
{
  "jsonrpc": "2.0",
  "result": {
    // Method-specific result object
  },
  "id": 1
}
```

#### **Error Response**

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Error description",
    "data": {
      "details": "Additional error context"
    }
  },
  "id": 1
}
```

### 3. Core Methods

#### **3.1 submit_commitment**

**Purpose**: Submit a state transition commitment to the aggregation layer

**Parameters**:
```typescript
{
  requestId: string;           // 68-char hex with "0000" prefix
  publicKey: string;           // 66-char compressed secp256k1
  signature: string;           // 130-char hex signature
  stateHash: string;           // DataHash format (32 bytes)
  transactionHash?: string;    // Optional transaction ID
  data?: Record<string, any>;  // Optional metadata
}
```

**Returns**:
```typescript
{
  requestId: string;           // Echoed request ID
  status: "QUEUED" | "ACCEPTED";
  blockHeight?: number;        // Block height if immediately included
  timestamp: number;           // Submission timestamp
}
```

**Error Cases**:
- `INVALID_FORMAT` - Malformed parameters
- `INVALID_SIGNATURE` - Signature verification failed
- `DUPLICATE_REQUEST` - RequestId already submitted
- `INVALID_STATE_HASH` - StateHash format incorrect

**Example**:
```bash
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "submit_commitment",
    "params": {
      "requestId": "0000" + "sha256_hash_56_chars",
      "publicKey": "02" + "pubkey_64_hex",
      "signature": "signature_130_hex",
      "stateHash": "0000" + "hash_56_hex",
      "transactionHash": "0000" + "txhash_56_hex"
    },
    "id": 1
  }'
```

#### **3.2 get_inclusion_proof**

**Purpose**: Retrieve the Merkle proof for a commitment

**Parameters**:
```typescript
{
  requestId: string;           // 68-char hex of commitment to prove
  blockHeight?: number;        // Optional: specific block height
}
```

**Returns**:
```typescript
{
  commitmentId: string;
  blockHeight: number;
  blockTimestamp: number;
  merkleProof: {
    leaf: string;             // Leaf hash
    path: {
      position: number;
      siblings: string[];     // Log(n) sibling hashes
      direction: boolean[];   // Path directions
    }
  };
  root: string;              // Root hash for verification
  certificate?: {            // BFT consensus certificate
    height: number;
    signatures: string[];
  }
}
```

**Error Cases**:
- `NOT_FOUND` - Commitment doesn't exist
- `NOT_FINALIZED` - Commitment not yet in finalized block
- `INVALID_BLOCK_HEIGHT` - Requested block doesn't exist

**Example**:
```bash
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "get_inclusion_proof",
    "params": {
      "requestId": "0000" + "sha256_hash_56_chars"
    },
    "id": 2
  }'
```

#### **3.3 get_no_deletion_proof**

**Purpose**: Retrieve proof that no commitments have been deleted

**Parameters**:
```typescript
{
  blockHeight?: number;        // Optional: specific block height
}
```

**Returns**:
```typescript
{
  blockHeight: number;
  root: string;
  timestamp: number;
  allCommitmentIds: string[]; // Complete commitment list
  signature: string;           // Aggregator signature
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "get_no_deletion_proof",
    "params": {},
    "id": 3
  }'
```

#### **3.4 get_block_height**

**Purpose**: Query the current blockchain height

**Parameters**: None

**Returns**:
```typescript
{
  height: string;              // Current block height (as string)
  timestamp: number;           // Latest block timestamp
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "get_block_height",
    "params": {},
    "id": 4
  }'
```

#### **3.5 get_block**

**Purpose**: Retrieve detailed block information

**Parameters**:
```typescript
{
  height: number;              // Block height to retrieve
}
```

**Returns**:
```typescript
{
  height: number;
  timestamp: number;
  proposer: string;
  commitmentCount: number;
  merkleRoot: string;
  previousBlockHash: string;
  certificate: {
    // BFT consensus signature
  };
  metadata: {
    aggregationTime: number;
    smtUpdateTime: number;
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "get_block",
    "params": {
      "height": 1000
    },
    "id": 5
  }'
```

#### **3.6 get_block_commitments**

**Purpose**: List all commitments in a specific block

**Parameters**:
```typescript
{
  height: number;              // Block height
  offset?: number;             // Pagination offset (default 0)
  limit?: number;              // Results per page (default 100, max 1000)
}
```

**Returns**:
```typescript
{
  blockHeight: number;
  commitmentCount: number;
  commitments: [
    {
      requestId: string;
      publicKey: string;
      stateHash: string;
      transactionHash?: string;
      timestamp: number;
      position: number;        // Position in block
    },
    // ...
  ];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "get_block_commitments",
    "params": {
      "height": 1000,
      "offset": 0,
      "limit": 50
    },
    "id": 6
  }'
```

### 4. Infrastructure Endpoints

#### **GET /health**

Returns service health status and leadership information.

**Response**:
```typescript
{
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  isLeader: boolean;
  blockHeight: number;
  pendingCommitments: number;
  uptime: number;             // Seconds
  version: string;
  timestamp: number;
}
```

#### **GET /docs**

Serves interactive OpenAPI documentation accessible in browser.

**Features**:
- Live request execution
- cURL command export
- Parameter auto-completion
- Response formatting with timing
- Keyboard shortcuts (Ctrl+Enter to submit)
- Mobile-responsive design

---

## Integration Patterns

### 1. Client Integration with State Transition SDK

The Unicity State Transition SDK provides TypeScript bindings for aggregator interaction:

#### **Setup**

```typescript
import { AggregatorClient, StateTransitionClient } from '@unicitylabs/state-transition-sdk';

// Create aggregator client pointing to gateway
const aggregatorClient = new AggregatorClient(
  'https://gateway.unicity.network:443'
  // Or local: 'http://localhost:3000'
);

// Create state transition client
const stateClient = new StateTransitionClient(aggregatorClient);
```

#### **Token Minting Flow**

```typescript
// 1. Create signing service
const secret = process.env.SECRET || await getSecretInteractively();
const signingService = createSigningService(secret);

// 2. Generate predicate (masked for privacy)
const predicate = signingService.createPredicate({
  masked: true,
  nonce: generateNonce()
});

// 3. Mint token
const token = await stateClient.mint({
  secret,
  tokenType: 'default',
  tokenData: { /* custom data */ },
  predicateAddr: predicate.address,
  reason: 'Token creation'
});

// 4. SDK internally:
//    - Prepares state transition commitment
//    - Calls aggregatorClient.submitCommitment()
//    - Polls for get_inclusion_proof() until available
//    - Returns token with verified proof
```

#### **Proof Polling**

```typescript
async function pollForInclusionProof(
  requestId: string,
  maxWaitMs: number = 30000
): Promise<InclusionProof> {
  const pollInterval = 1000; // 1 second
  const maxAttempts = Math.ceil(maxWaitMs / pollInterval);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const proof = await aggregatorClient.getInclusionProof(requestId);
      return proof;
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error;
      await new Promise(r => setTimeout(r, pollInterval));
    }
  }
}
```

### 2. Direct JSON-RPC Integration

For non-TypeScript environments or custom implementations:

#### **HTTP Client Example (Node.js)**

```javascript
const http = require('http');

async function submitCommitment(commitment) {
  const payload = {
    jsonrpc: '2.0',
    method: 'submit_commitment',
    params: commitment,
    id: Math.random()
  };

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });

    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}
```

#### **Python Example**

```python
import requests
import json

def submit_commitment(commitment):
    payload = {
        "jsonrpc": "2.0",
        "method": "submit_commitment",
        "params": commitment,
        "id": 1
    }

    response = requests.post(
        'http://localhost:3000/',
        json=payload,
        headers={'Content-Type': 'application/json'},
        timeout=5
    )

    return response.json()

def get_inclusion_proof(request_id):
    payload = {
        "jsonrpc": "2.0",
        "method": "get_inclusion_proof",
        "params": {"requestId": request_id},
        "id": 1
    }

    response = requests.post(
        'http://localhost:3000/',
        json=payload,
        timeout=5
    )

    return response.json()
```

### 3. BFT Consensus Integration

The aggregator integrates with the Unicity BFT consensus layer for finality:

#### **Integration Flow**

```
Aggregator                          BFT Consensus Layer
    │                                      │
    ├─ Create Block                        │
    │  (with SMT root)                    │
    │                                      │
    ├─────────── Propose Block ────────────>
    │                                      │
    │<────── Run Consensus (1 second) ─────┤
    │                                      │
    │<────── Return Certificate ───────────┤
    │                                      │
    ├─ Verify Certificate                  │
    │  (consensus signatures)              │
    │                                      │
    ├─ Mark Block FINALIZED                │
    │                                      │
    └─ Proofs become permanent             │
```

#### **Certificate Validation**

```typescript
validateBFTCertificate(certificate: BFTCertificate): boolean {
  // Verify BFT signatures match quorum
  const validSignatures = certificate.signatures
    .map(sig => verifyCertificateSignature(sig))
    .filter(valid => valid).length;

  // Require 2/3 + 1 validators (Byzantine fault tolerance)
  const quorumRequired = Math.ceil(totalValidators * 2/3) + 1;

  return validSignatures >= quorumRequired;
}
```

---

## Deployment & Configuration

### 1. Prerequisites

| Component | Requirement | Version |
|-----------|-----------|---------|
| Go | Language runtime | 1.25+ |
| MongoDB | Database | 4.4+ with authentication |
| Docker | Containerization | 20.10+ |
| Docker Compose | Orchestration | 1.29+ |
| Redis | Optional caching | 6.0+ |
| BFT Nodes | Consensus | Active network |

### 2. Configuration Management

#### **Environment Variables**

```bash
# Database Configuration
MONGODB_URI="mongodb://user:pass@localhost:27017/aggregator"
MONGODB_DATABASE="aggregator"

# Server Configuration
PORT=3000                        # HTTP server port
HOST="0.0.0.0"                   # Bind address

# Aggregation Configuration
BATCH_LIMIT=1000                 # Commitments per block
ROUND_DURATION="1s"              # Block creation interval

# High Availability
HA_ENABLED=true                  # Enable leader election
HA_LOCK_TTL="30s"               # Leader lock duration
HA_LOCK_RENEWAL="10s"           # Lock renewal interval

# BFT Configuration
BFT_ENDPOINT="http://localhost:8000"
BFT_RPC_PORT="8002"
KEYS_FILE="./config/keys.json"
SHARD_CONFIG_FILE="./config/shard-conf-7_0.json"
TRUSTBASE_FILE="./config/trust-base.json"

# Logging
LOG_LEVEL="info"                 # debug, info, warn, error
LOG_FORMAT="json"                # json or text

# Performance
MAX_CONCURRENT_REQUESTS=1000
REQUEST_TIMEOUT="30s"
IDLE_TIMEOUT="90s"

# TLS/Security
TLS_ENABLED=false
TLS_CERT_FILE="./certs/server.crt"
TLS_KEY_FILE="./certs/server.key"
CORS_ENABLED=true
CORS_ORIGINS="*"
```

#### **Configuration File (config.yaml)**

```yaml
server:
  port: 3000
  host: "0.0.0.0"
  readTimeout: "30s"
  writeTimeout: "30s"
  idleTimeout: "90s"

database:
  uri: "mongodb://localhost:27017"
  name: "aggregator"
  maxPoolSize: 100
  minPoolSize: 10

aggregation:
  batchLimit: 1000
  roundDuration: "1s"
  enableBatchCompression: false

ha:
  enabled: true
  lockTTL: "30s"
  lockRenewal: "10s"
  nodeId: "node-1"

bft:
  endpoint: "http://localhost:8000"
  rpcPort: 8002
  keysFile: "./config/keys.json"
  shardConfig: "./config/shard-conf-7_0.json"
  trustbaseFile: "./config/trust-base.json"

logging:
  level: "info"
  format: "json"
  output: "stdout"
  sampleRate: 1.0

metrics:
  enabled: true
  port: 8080
  path: "/metrics"

security:
  tls:
    enabled: false
    certFile: ""
    keyFile: ""
  cors:
    enabled: true
    origins: ["*"]
  rateLimiting:
    enabled: false
    requestsPerSecond: 10000
```

### 3. Docker Deployment

#### **Quick Start with Docker Compose**

```bash
# Navigate to repository
cd aggregator-go

# Start all services (MongoDB, BFT, Aggregator)
docker compose up -d

# Verify services are healthy
docker compose ps

# View aggregator logs
docker compose logs -f aggregator

# Access interactive API docs
open http://localhost:3000/docs

# Stop services
docker compose down

# Clean state and restart
make docker-run-clean
```

#### **Dockerfile Analysis**

```dockerfile
FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY . .
RUN go mod download
RUN go build -o aggregator ./cmd/aggregator

FROM alpine:3.19
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/aggregator /usr/local/bin/
EXPOSE 3000 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health
ENTRYPOINT ["aggregator"]
```

#### **Docker Compose Services**

```yaml
version: '3.9'

services:
  mongodb:
    image: mongo:7.0
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: aggregator
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: mongosh --eval 'db.adminCommand("ping")'
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  bft-root:
    build:
      context: ./bft
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
      - "8002:8002"
    environment:
      PORT: "8000"
      RPC_PORT: "8002"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8002"]
      interval: 10s
      timeout: 5s
      retries: 5

  aggregator:
    build: .
    ports:
      - "3000:3000"
      - "8080:8080"
    environment:
      MONGODB_URI: "mongodb://admin:password@mongodb:27017/aggregator"
      PORT: "3000"
      BFT_ENDPOINT: "http://bft-root:8000"
      LOG_LEVEL: "info"
      BATCH_LIMIT: "1000"
      ROUND_DURATION: "1s"
      HA_ENABLED: "true"
    depends_on:
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
      bft-root:
        condition: service_healthy
    volumes:
      - ./config:/app/config:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mongo_data:
  redis_data:
```

### 4. Kubernetes Deployment

#### **StatefulSet for HA Aggregators**

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: aggregator
  namespace: unicity
spec:
  serviceName: aggregator
  replicas: 3
  selector:
    matchLabels:
      app: aggregator
  template:
    metadata:
      labels:
        app: aggregator
    spec:
      containers:
      - name: aggregator
        image: unicitynetwork/aggregator:latest
        ports:
        - containerPort: 3000
          name: api
        - containerPort: 8080
          name: metrics
        env:
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: NODE_ID
          value: "$(POD_NAME)"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: aggregator-secrets
              key: mongodb-uri
        - name: LOG_LEVEL
          value: "info"
        - name: HA_ENABLED
          value: "true"
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "2000m"
            memory: "2Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
        volumeMounts:
        - name: config
          mountPath: /etc/aggregator
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: aggregator-config
---
apiVersion: v1
kind: Service
metadata:
  name: aggregator
  namespace: unicity
spec:
  clusterIP: None
  selector:
    app: aggregator
  ports:
  - port: 3000
    name: api
  - port: 8080
    name: metrics
```

#### **Service Exposure**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: aggregator-lb
  namespace: unicity
spec:
  type: LoadBalancer
  selector:
    app: aggregator
  ports:
  - port: 443
    targetPort: 3000
    protocol: TCP
    name: api
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: aggregator-ingress
  namespace: unicity
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - gateway.unicity.network
    secretName: aggregator-tls
  rules:
  - host: gateway.unicity.network
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: aggregator-lb
            port:
              number: 3000
```

---

## Operational Monitoring

### 1. Health Check Endpoints

#### **GET /health Response**

```json
{
  "status": "HEALTHY",
  "isLeader": true,
  "blockHeight": 5432,
  "pendingCommitments": 23,
  "uptime": 86400,
  "commitmentRate": 125.5,
  "version": "1.0.0",
  "timestamp": 1699000000000
}
```

**Status Values:**
- `HEALTHY` - All systems operational, ready for traffic
- `DEGRADED` - Operational but with warnings (e.g., slow database response)
- `UNHEALTHY` - Cannot process requests, needs restart

### 2. Metrics & Observability

#### **Prometheus Metrics**

```
# Aggregator Counters
aggregator_commitments_total{status="accepted"}
aggregator_blocks_created_total
aggregator_proofs_generated_total
aggregator_bft_certificates_received_total
aggregator_errors_total{error_type="validation"}

# Gauges
aggregator_pending_commitments
aggregator_block_height
aggregator_smt_tree_size
aggregator_database_connection_pool_size

# Histograms
aggregator_request_duration_seconds{method="submit_commitment"}
aggregator_block_creation_time_ms
aggregator_proof_generation_time_ms
aggregator_commitment_processing_latency_ms

# Leadership
aggregator_is_leader{node_id="node-1"}
aggregator_leader_election_time_ms
```

#### **Log Aggregation**

```bash
# Structured logging (JSON)
{
  "timestamp": "2025-11-04T12:34:56Z",
  "level": "INFO",
  "component": "aggregator",
  "method": "submit_commitment",
  "requestId": "0000abc...",
  "status": "QUEUED",
  "duration_ms": 45,
  "node_id": "node-1",
  "trace_id": "trace-xyz"
}
```

### 3. Monitoring Dashboards

#### **Key Metrics to Monitor**

```
Real-Time Metrics:
├─ Block Height (should increase every 1 second)
├─ Pending Commitments (should stay near 0 if healthy)
├─ Commitment Processing Latency (target: <100ms)
├─ Proof Generation Time (target: <50ms)
├─ Database Connection Pool Usage (target: <80%)
├─ Memory Usage (should stabilize after startup)
├─ CPU Usage (should be <50% on idle)
└─ Leader Node (should be 1 node in HA cluster)

Health Indicators:
├─ BFT Consensus Status
├─ MongoDB Connection Status
├─ Certificate Validation Success Rate (target: 100%)
├─ Error Rate by Type
├─ Block Certificate Finality Time
└─ Network Connectivity to BFT Nodes
```

### 4. Alerting Rules

```yaml
groups:
- name: aggregator_alerts
  rules:
  - alert: AggregatorDown
    expr: aggregator_health_status == 0
    for: 1m
    annotations:
      summary: "Aggregator service is down"

  - alert: HighPendingCommitments
    expr: aggregator_pending_commitments > 10000
    for: 5m
    annotations:
      summary: "Backlog of pending commitments"

  - alert: NoBlocksCreated
    expr: rate(aggregator_blocks_created_total[5m]) == 0
    for: 2m
    annotations:
      summary: "Block creation has stopped"

  - alert: DatabaseLatency
    expr: aggregator_db_query_duration_seconds{quantile="0.99"} > 1
    for: 2m
    annotations:
      summary: "High database query latency"

  - alert: BFTConsensusFailures
    expr: rate(aggregator_bft_errors_total[5m]) > 0.1
    for: 2m
    annotations:
      summary: "BFT consensus failures detected"
```

---

## Security & Validation

### 1. Cryptographic Validation

#### **Signature Verification Process**

```
Submit Commitment Request
       │
       ▼
1. Parse JSON & Extract Fields
   ├─ requestId (68 chars)
   ├─ publicKey (66 chars)
   ├─ signature (130 chars)
   └─ data fields
       │
       ▼
2. Validate Format
   ├─ Hex string checks
   ├─ Length validation
   └─ Prefix verification ("0000" for hashes)
       │
       ▼
3. Recover Public Key from Signature
   ├─ Parse signature (r, s, v)
   ├─ Apply ECDSA recovery algorithm
   ├─ Extract x, y coordinates
   └─ Construct recovered key
       │
       ▼
4. Compare Keys
   ├─ Recovered key == submitted publicKey
   ├─ If match: VALID
   └─ If mismatch: REJECT (INVALID_SIGNATURE)
       │
       ▼
5. Persist Commitment
   ├─ Store in pending_commitments
   └─ Return QUEUED status
```

#### **Secp256k1 Specification**

- **Elliptic Curve**: Secp256k1 (Bitcoin standard)
- **Key Size**: 256 bits
- **Public Key Format**: Compressed (33 bytes) or uncompressed (65 bytes)
- **Signature**: (r, s, v) where v is recovery ID (0-3)
- **Hash Algorithm**: SHA256 for commitment data

### 2. Duplicate Prevention

#### **Commitment Deduplication**

```
On submission:
  1. Extract requestId from commitment
  2. Query MongoDB:
     db.getCollection("submitted_commitments")
       .findOne({requestId: requestId})
  3. If found:
     └─ Return ERROR: "DUPLICATE_REQUEST"
  4. If not found:
     ├─ Check pending_commitments collection
     ├─ Query BFT consensus for historical blocks
     └─ If not in any: allow submission
```

**Scope:**
- Current round's pending commitments
- All blocks in current BFT consensus view
- Historical blocks (via rollback protection)

### 3. Input Validation Rules

#### **Field Validation Matrix**

| Field | Type | Length | Format | Required |
|-------|------|--------|--------|----------|
| requestId | string | 68 | hex, "0000" prefix | Yes |
| publicKey | string | 66 | hex, "02"/"03" prefix | Yes |
| signature | string | 130 | hex, valid ECDSA | Yes |
| stateHash | string | 68 | hex, "0000" prefix | Yes |
| transactionHash | string | 68 | hex, "0000" prefix | No |
| timestamp | number | N/A | milliseconds, valid UTC | No |
| data | object | N/A | JSON | No |

#### **Validation Error Response**

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "field": "requestId",
      "issue": "Invalid format - expected 68 hex chars with 0000 prefix",
      "received": "abc123"
    }
  },
  "id": 1
}
```

### 4. DoS Protection

#### **Rate Limiting**

```
Global rate limits:
├─ Per IP: 1,000 requests/second
├─ Per commitment: 1 submission/second
└─ Per node (internal): 10,000 commitments/second

Sliding window algorithm:
├─ 1-second windows
├─ Token bucket refill rate
└─ Burst capacity = 2x normal rate
```

#### **Request Validation Before Processing**

```
Checks before queueing:
1. IP-based rate limit (global)
2. Duplicate requestId (immediate)
3. Format validation (fail fast)
4. Signature verification (CPU-bound)
5. Storage quota (if applicable)
└─ Only then: add to pending_commitments
```

### 5. State Integrity

#### **Block Finality Guarantee**

```
Once BFT certificate is received:
  1. Block becomes immutable
  2. Commitments cannot be removed
  3. Block cannot be rolled back (due to consensus finality)
  4. Proofs are permanent for that block
  5. SMT root is fixed for eternity
```

#### **Fork Prevention**

- **Single Chain**: BFT consensus ensures single version of truth
- **No Reorgs**: Block finality is 1 round (1 second)
- **Consistency**: All aggregators apply same transformation to SMT
- **Verifiability**: All proofs can be verified against published root

---

## Performance Characteristics

### 1. Throughput Benchmarks

#### **Theoretical Maximums**

```
Commitment Submission:
├─ Rate: 10,000+ commitments/second (per aggregator)
├─ Batch Size: 1,000 commitments/block
├─ Block Creation: Every 1 second
└─ Maximum Throughput: 1,000 blocks/sec × 1,000 commitments = 1,000,000 commitments/sec

With Replication (3-node cluster):
├─ Single leader: 1,000 commitments/block
├─ Followers validate: minimal CPU per node
├─ Network bandwidth: ~1-10 Mbps (blocks + proofs)
└─ Effective throughput: 1,000,000 commitments/sec per leader

Scaling Strategy:
├─ Horizontal: Multiple independent aggregator clusters
├─ Vertical: Larger batch limits, more commits/block
└─ Hybrid: Multiple chains with cross-chain settlement
```

#### **Latency Profile**

```
Commitment submission to pending: ~1 ms
Pending to block inclusion: 0-1,000 ms (average 500 ms)
Block to BFT consensus finality: 0-1,000 ms (average 500 ms)
Total time to finalized proof: 500-2,000 ms (average 1 second)

Breakdown:
├─ Request parsing & validation: 0.1 ms
├─ Signature verification: 0.5 ms
├─ Database persistence: 0.3 ms
├─ Queuing/batching: variable
├─ SMT update during block: 5-50 ms
├─ BFT consensus round: 1,000 ms (configured)
└─ Proof generation: 1-10 ms
```

### 2. Resource Utilization

#### **Memory Profile (3-node cluster)**

```
Per Aggregator Node:
├─ Go Runtime: ~50 MB (baseline)
├─ MongoDB Driver: ~30 MB (with connection pool)
├─ SMT Tree (in-memory): 100-500 MB (depends on history)
├─ Cache/Buffers: 100-200 MB
└─ Total: ~300-800 MB per node

Cluster (3 nodes):
├─ Aggregators: ~900 MB-2.4 GB
├─ MongoDB: ~2-5 GB (depends on retention)
├─ BFT Nodes: ~500 MB per node
└─ Total: 3-8 GB for production cluster
```

#### **CPU Profile**

```
At 10,000 commitments/sec:
├─ Signature verification: 40-50% per core
├─ SMT updates: 20-30% per core
├─ Database operations: 10-15% per core
├─ Networking: 5-10% per core
└─ Total: 80-90% utilization per core

Recommendation:
├─ 2-4 CPU cores per aggregator node (with 2+ cores for SMT)
├─ Use CPU-efficient elliptic curve implementations
└─ Consider hardware acceleration (if available)
```

#### **Disk I/O**

```
IOPS Required:
├─ Commitment writes: 10,000-50,000 IOPS
├─ Block storage: 1,000 IOPS
├─ Index updates: 5,000-10,000 IOPS
└─ Total: 15,000-60,000 IOPS

Recommendation:
├─ SSD storage (NVMe preferred)
├─ MongoDB with separate journal disk
├─ Database write concern: journal enabled
└─ Estimated bandwidth: 100-500 Mbps
```

### 3. Optimization Techniques

#### **Batching Strategy**

```
Current: Block every 1 second
├─ Pros: Low latency, consistent throughput
└─ Cons: May not fill 1,000 commitment blocks

Optimization: Configurable batching
├─ Option 1: Larger batch limit (up to 10,000)
├─ Option 2: Batch timeout (e.g., 0.5s if full)
├─ Option 3: Adaptive batching (scale based on load)
└─ Option 4: Multiple leaders (sharding)
```

#### **SMT Optimization**

```
Current Implementation:
├─ In-memory full tree (fast reads)
└─ Single lock per tree update

Advanced Techniques:
├─ Hash array tree (HAT) layout
├─ Concurrent append-only updates
├─ Incremental hashing (only changed nodes)
├─ Caching of popular proof paths
└─ Lazy evaluation of siblings
```

#### **Database Tuning**

```
Indexes:
├─ requestId (primary, unique)
├─ blockHeight (range queries)
├─ timestamp (sorting)
├─ status (filtering)
└─ composite (requestId, blockHeight)

Query Optimization:
├─ Connection pooling: 50-100 connections
├─ Write batching: group writes per block
├─ Read replicas: for proof queries
└─ Sharding: by requestId prefix
```

---

## Development & Testing

### 1. Build Commands

```bash
# Download dependencies
make deps

# Format code
make fmt

# Static analysis
make vet lint

# Build binary
make build                      # Produces: ./bin/aggregator

# Run locally (requires MongoDB running)
make run

# Clean artifacts
make clean
```

### 2. Testing Framework

#### **Unit Tests**

```bash
# Run all tests
make test

# Run with race condition detection
make test-race

# Run specific test package
go test -v ./internal/smt/...

# Run specific test
go test -v -run TestSMTInsert ./internal/smt
```

#### **Test Coverage**

```bash
# Generate coverage report
go test -coverprofile=coverage.out ./...

# View coverage in HTML
go tool cover -html=coverage.out

# Coverage by package
go test -cover ./internal/...
```

#### **Benchmarks**

```bash
# Run benchmarks
make benchmark

# Run specific benchmark
go test -bench=BenchmarkSMTProofGeneration -benchtime=10s ./internal/smt

# Compare benchmarks
go test -bench=. -benchmem ./internal/smt -count=5 > old.txt
# ... (modify code)
go test -bench=. -benchmem ./internal/smt -count=5 > new.txt
benchstat old.txt new.txt
```

#### **Performance Tests**

```bash
# Requires aggregator running on localhost:3000
make performance-test

# With custom endpoint
make performance-test HTTP_URL=http://custom-endpoint:3000

# With authentication headers
make performance-test-auth HTTP_URL=https://production-endpoint:443 \
  HEADERS="Authorization: Bearer token"
```

### 3. Test Structure

#### **SMT Unit Tests**

```go
// internal/smt/smt_test.go
func TestSMTInsert(t *testing.T) {
  smt := NewSMT()
  key := "requestId123"
  value := "commitment_hash"

  smt.Insert(key, value)
  root := smt.Root()

  assert.NotEmpty(t, root)
  assert.Equal(t, value, smt.Get(key))
}

func TestSMTProofGeneration(t *testing.T) {
  smt := NewSMT()
  // ... insert commitments

  proof := smt.GetProof("requestId123")

  assert.NotEmpty(t, proof.Siblings)
  assert.True(t, proof.Verify(leaf, smt.Root()))
}
```

#### **Integration Tests**

```go
// integration_test.go
func TestSubmitCommitmentAndGetProof(t *testing.T) {
  // 1. Start aggregator service
  service := NewAggregatorService(config)
  defer service.Stop()

  // 2. Submit commitment via JSON-RPC
  commitment := createTestCommitment()
  response := submitCommitment(commitment)
  assert.Equal(t, "QUEUED", response.Status)

  // 3. Wait for block finality
  time.Sleep(2 * time.Second)

  // 4. Retrieve inclusion proof
  proof := getInclusionProof(commitment.RequestID)
  assert.NotEmpty(t, proof.MerkleProof)

  // 5. Verify proof locally
  verified := verifyProof(
    commitment,
    proof.MerkleProof,
    proof.Root,
  )
  assert.True(t, verified)
}
```

### 4. Docker Testing

```bash
# Build test image
docker build -t aggregator-test --target builder .

# Run tests in container
docker run --rm aggregator-test make test

# Run with database dependencies
docker compose -f docker-compose.test.yml run aggregator make test

# Integration testing with full stack
make docker-run-clean
docker compose exec aggregator make test
```

---

## Troubleshooting & Best Practices

### 1. Common Issues

#### **Issue: Commitments Not Being Finalized**

**Symptoms:**
- `get_inclusion_proof` returns "NOT_FOUND" or "NOT_FINALIZED"
- Block height not increasing
- Pending commitments accumulating

**Diagnosis Steps:**
```bash
# Check aggregator health
curl http://localhost:3000/health

# Check pending commitment count
# Should be < 100 and decreasing

# Check BFT consensus
curl http://bft-node:8002/health

# Check database connectivity
mongo --uri "mongodb://localhost:27017/aggregator"
  > db.pending_commitments.count()
  > db.blocks.findOne({}, {sort: {height: -1}})
```

**Solutions:**
1. Verify BFT nodes are healthy and synchronized
2. Check database has sufficient disk space
3. Increase `BATCH_LIMIT` if blocks are consistently full
4. Verify block creation round is running (check logs for "round" messages)
5. Check network connectivity between aggregator and BFT nodes

#### **Issue: High Latency in Proof Generation**

**Symptoms:**
- `get_inclusion_proof` takes > 1 second
- CPU usage at 100%
- Slow SMT updates

**Diagnosis:**
```bash
# Check SMT tree size
# Monitor metrics:
aggregator_smt_tree_size

# Check database query time
# Enable MongoDB slow query log
db.setProfilingLevel(1, {slowms: 100})

# Check network latency to BFT
ping bft-node
```

**Solutions:**
1. Increase batch limit to reduce proof path length
2. Enable SMT snapshot caching
3. Reduce historical commitment retention period
4. Scale to multiple aggregator nodes with load balancing
5. Optimize MongoDB indexes

#### **Issue: Leader Election Failing (HA Mode)**

**Symptoms:**
- Multiple nodes claim to be leader
- Or no node is leader
- Frequent leader changes

**Diagnosis:**
```bash
# Check MongoDB connections
mongo --uri "mongodb://localhost:27017"
  > db.locks.find()

# Check TTL expiration
# Should see lease entries with TTL ~30s

# Check node clocks are synchronized
# Across all aggregator nodes
ntpq -p
```

**Solutions:**
1. Verify MongoDB is accepting write operations
2. Increase `HA_LOCK_TTL` if clock skew exists
3. Check network connectivity between nodes
4. Verify lease renewal logs (look for "renewing lease" messages)
5. Restart all aggregators simultaneously

#### **Issue: Signature Validation Failures**

**Symptoms:**
- Error: "INVALID_SIGNATURE" for valid commitments
- Works in test but not in production
- Intermittent signature failures

**Diagnosis:**
```bash
# Check secp256k1 library version
go list -m all | grep secp256k1

# Verify signature generation is correct
# Test with known test vector

# Check endianness handling
# Especially on non-x86 architectures
```

**Solutions:**
1. Verify public key recovery implementation
2. Check signature format (r, s, v order)
3. Ensure consistent hash function usage (SHA256)
4. Test with reference implementations
5. Check for timezone/UTC issues in timestamp validation

### 2. Best Practices

#### **Operation Best Practices**

1. **Deployment**
   - Always use 3+ aggregator nodes in production (for HA)
   - Run on separate hosts for fault isolation
   - Use managed MongoDB Atlas or similar for database
   - Enable automatic backups
   - Monitor disk space (alert at 80% full)

2. **Configuration**
   - Store secrets in environment variables or secret management system
   - Use TLS in production (especially public-facing gateways)
   - Enable CORS only for trusted domains
   - Set reasonable timeouts (30-60 seconds)
   - Enable rate limiting for public endpoints

3. **Monitoring**
   - Set up Prometheus metrics collection
   - Create Grafana dashboards for:
     - Block height progress
     - Pending commitment backlog
     - Error rates by type
     - Latency percentiles
   - Configure alerting for key metrics
   - Set up log aggregation (ELK, Datadog, etc.)

4. **Performance**
   - Run on recent hardware (2020+)
   - Use SSD storage for MongoDB
   - Network: gigabit or higher
   - Monitor CPU, memory, and disk space continuously
   - Plan for 2x expected load

#### **Security Best Practices**

1. **Input Validation**
   - Never trust client input
   - Validate all parameters before processing
   - Use schema validation (JSON Schema)
   - Implement rate limiting per IP

2. **Cryptography**
   - Verify all signatures before queueing
   - Use up-to-date secp256k1 library
   - Hash data consistently (always SHA256)
   - Never expose private keys in logs

3. **Database Security**
   - Enable MongoDB authentication
   - Use strong, rotated passwords
   - Encrypt data at rest (if available)
   - Encrypt network traffic (TLS)
   - Implement IP whitelisting

4. **Network Security**
   - Use TLS for all public endpoints
   - Implement DDoS protection (WAF, rate limiting)
   - Monitor for suspicious patterns
   - Log all errors and anomalies
   - Regular security audits

#### **Development Best Practices**

1. **Code Quality**
   - Run `make fmt` before commits
   - Run `make lint` and fix all warnings
   - Maintain >80% test coverage
   - Use static analysis (golangci-lint)
   - Code reviews for all changes

2. **Testing**
   - Write unit tests for SMT operations
   - Integration tests for full flow
   - Benchmark performance-critical code
   - Test edge cases and error paths
   - Run race detector in CI/CD

3. **Documentation**
   - Document all public APIs
   - Keep CLAUDE.md updated
   - Maintain API examples
   - Document configuration options
   - Update deployment guides

---

## Conclusion

The Unicity Aggregator represents a production-grade implementation of a Byzantine Fault Tolerant proof aggregation system. Its key strengths include:

- **Scalability**: Handles millions of commitments per second
- **Security**: Cryptographic validation and fork prevention
- **Availability**: HA mode with automatic failover
- **Performance**: Sub-second latency for most operations
- **Operational Excellence**: Comprehensive monitoring and alerting

By understanding the architecture, API, and deployment patterns documented here, you can effectively operate, extend, and integrate the Aggregator layer into broader Unicity network deployments.

---

## Additional Resources

### Official Documentation
- **Repository**: https://github.com/unicitynetwork/aggregator-go
- **Whitepaper**: https://github.com/unicitynetwork/whitepaper/releases/tag/latest
- **State Transition SDK**: https://www.npmjs.com/package/@unicitylabs/state-transition-sdk
- **Commons Library**: https://github.com/unicitynetwork/commons

### Related Repositories
- **Alpha (Consensus Layer)**: https://github.com/unicitynetwork/alpha
- **Alpha Miner**: https://github.com/unicitynetwork/alpha-miner
- **BFT Core**: https://github.com/unicitynetwork/bft-core
- **GUI Wallet**: https://github.com/unicitynetwork/guiwallet

### Technology References
- **Sparse Merkle Trees**: https://docs.iden3.io/publications/pdfs/Merkle-Tree.pdf
- **secp256k1**: https://en.bitcoin.it/wiki/Secp256k1
- **MongoDB**: https://docs.mongodb.com/
- **Go**: https://golang.org/doc/

### Community & Support
- **GitHub Issues**: https://github.com/unicitynetwork/aggregator-go/issues
- **Discussions**: https://github.com/unicitynetwork/discussions
- **Network Status**: https://explorer.unicity.network

---

**Document Maintained By**: Unicity Labs Technical Documentation Team
**Last Updated**: November 4, 2025
**Status**: Production-Ready
**Version**: 1.0.0
