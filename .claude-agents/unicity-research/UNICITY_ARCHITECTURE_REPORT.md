# Unicity Network Architecture: Comprehensive Technical Report

**Date:** November 4, 2025
**Source:** Primary research from GitHub repositories, whitepapers, and technical documentation
**Organization:** https://github.com/unicitynetwork

---

## Executive Summary

Unicity Network represents a paradigm shift in blockchain architecture, introducing the first blockchain platform where **all execution happens off-chain**. Rather than competing for shared resources on a monolithic blockchain, applications and users operate in parallel execution environments that scale independently.

The platform's core innovation is moving assets, transfers, and smart contract execution entirely off-chain while using a blockchain as infrastructure to prevent double-spending through enforcement of non-forking protocols. This architectural shift unlocks orders of magnitude higher throughput and significantly reduced friction compared to traditional blockchain systems.

**Key Differentiator:** Traditional blockchains execute all operations on-chain (bottleneck); Unicity executes all operations off-chain with on-chain security guarantees.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Five-Layer Architecture](#five-layer-architecture)
3. [Core Components and Their Interactions](#core-components-and-their-interactions)
4. [Key Innovations](#key-innovations)
5. [Technology Stack](#technology-stack)
6. [Repository Ecosystem](#repository-ecosystem)
7. [Comparison with Traditional Blockchains](#comparison-with-traditional-blockchains)
8. [Implementation Details](#implementation-details)
9. [Security Model](#security-model)

---

## Architecture Overview

### Fundamental Philosophy

Unicity Network operates on the principle that **each asset is its own ledger with only aggregate state transitions recorded on-chain**. This design enables:

- **Parallel Execution:** Applications operate independently without competing for shared blockchain resources
- **Off-Chain Computation:** Turing-complete computation executes entirely off-chain with cryptographic verifiability
- **Scalability:** Millions of transaction commitments per block capability through aggregation
- **Privacy:** Transaction details remain private; only cryptographic commitments appear on-chain

### High-Level Data Flow

```
User/Agent Request
        ↓
    [Off-Chain Execution]
        ↓
    State Transition (Predicate-based ownership)
        ↓
    Aggregator (Batch & validate commitments)
        ↓
    Consensus Layer (Proof of Work anchor)
        ↓
    Inclusion Proof (Sparse Merkle Tree proof)
        ↓
    Finality Assurance (Non-deletion proof)
```

---

## Five-Layer Architecture

### Layer 1: Proof of Work Trust Anchor

**Purpose:** Foundational security layer providing immutable ordering and coin issuance

**Characteristics:**
- **Implementation:** Bitcoin fork with RandomX hash function (ASIC-resistant)
- **Block Time:** 2 minutes
- **Block Reward:** 10 ALPHA tokens
- **Difficulty Adjustment:** ASERT (Automated Easy Difficulty Retargeting) with 12-hour half-life
- **Transaction Model:** Single-input-per-transaction to ensure local verifiability and off-chain sub-ledger extraction

**Repository:** `unicitynetwork/alpha` (C++)

**Key Innovation:** Single-input transactions enable coin sub-ledgers to be extracted from the main ledger and used entirely off-chain in higher layers.

**Mining:**
- Supported through `unicitynetwork/alpha-miner` (C) for individual mining
- Pool mining via `unicitynetwork/unicity-mining-core` (forked from MiningCore)
- CPU-friendly RandomX algorithm promotes decentralization

---

### Layer 2: Consensus Layer (Byzantine Fault Tolerant)

**Purpose:** Fast, deterministic consensus with 1-second block rounds to anchor the aggregation layer

**Characteristics:**
- **Consensus Type:** Byzantine Fault Tolerant (BFT)
- **Block Rounds:** 1-second intervals for rapid finality
- **Validator Role:** Aggregators participate in consensus
- **Partitioned Architecture:** Supports sharded ledger design with root chain coordination

**Repository:** `unicitynetwork/bft-core` (Go), `unicitynetwork/bft-go-base` (Go)

**Architecture Components:**
- Root chain for cross-partition coordination
- Transaction system with partition routing
- State management across sharded domains
- RPC interfaces for external communication
- Network layer for peer communication

**Relationship to PoW Layer:**
The BFT consensus layer receives anchoring from the Proof of Work layer, providing fast finality for the aggregation layer while ultimate security derives from the immutable PoW chain.

---

### Layer 3: Proof Aggregation Layer

**Purpose:** Trustless aggregation of state transitions using Sparse Merkle Trees

**Characteristics:**
- **Data Structure:** Sparse Merkle Trees (SMT) with optional zero-knowledge proofs for non-deletion
- **Block Generation:** Batches commitments every 1 second with Merkle root hashing
- **Proof Types:**
  - **Inclusion Proofs:** Demonstrate a commitment's presence in a specific block
  - **Non-Deletion Proofs:** Confirm data has never been removed from the ledger
- **Storage:** MongoDB-backed for scalability
- **Leadership:** Distributed leader election enabling multiple aggregator instances

**Repository:** `unicitynetwork/aggregator-go` (Go)

**Core Responsibilities:**

1. **State Transition Aggregation**
   - Accepts cryptographically-signed commitment requests from agents
   - Validates secp256k1 signatures before acceptance
   - Validates format: requestId = SHA256(publicKey || stateHash)
   - Verifies DataHash imprinting (0000 prefix for SHA256)

2. **Proof Generation**
   - Computes Merkle proofs for block inclusion
   - Generates cryptographic evidence of commitment persistence
   - Enables offline verification of state transitions

3. **Block Management**
   - Creates blocks in 1-second intervals
   - Batches validated commitments with timestamp
   - Maintains ledger permanence guarantees

**Privacy Feature:** Commitments contain no information about tokens, their state, or transaction nature, enabling "off-chain privacy" while preventing double-spending through inclusion proofs.

---

### Layer 4: State Transition Layer

**Purpose:** Off-chain token lifecycle management with cryptographic security guarantees

**Characteristics:**
- **Assets:** Tokens exist entirely off-chain as self-contained entities
- **Transaction History:** Each token carries full cryptographic proof lineage
- **On-Chain Presence:** Only commitment hashes appear on-chain (massive privacy benefit)
- **Ownership Model:** Predicates (conditions) control token access
- **Portability:** Tokens transfer peer-to-peer, chain-to-chain with cryptographic verification

**Repository:** `unicitynetwork/state-transition-sdk` (TypeScript), `unicitynetwork/java-state-transition-sdk` (Java)

**Token Lifecycle:**

```
Minting
  ├─ Create signing service from secret
  ├─ Generate predicate (masked/unmasked)
  ├─ Create recipient address from predicate
  ├─ Submit mint transaction to network
  └─ Receive minted token with state and transaction history

Transfer
  ├─ Create state transition (predicate-based authorization)
  ├─ Sign transaction with current owner
  ├─ Submit to aggregator
  └─ Receive inclusion proof from aggregation layer

Completion
  ├─ Obtain inclusion proof from Sparse Merkle Tree
  ├─ Obtain non-deletion proof for finality
  └─ Token marked as CONFIRMED with updated owner
```

**Predicate System:**

- **Unmasked Predicates:** Direct public key ownership (transparent)
- **Masked Predicates:** Privacy-preserving ownership hiding keys behind cryptographic masks
- **Burn Predicates:** One-way destruction predicates for token burning
- **Custom Predicates:** Extensible for application-specific ownership rules

**Security Guarantees:**
- Double-spending prevention through single-spend proofs verified against blockchain
- Offline transaction creation and verification
- Cryptographic proof of ownership lineage
- Transfer atomicity across peer-to-peer networks

---

### Layer 5: Agent Execution Layer

**Purpose:** Framework for development, deployment, and composability of verifiable off-chain Turing-complete computations

**Characteristics:**
- **Execution Model:** Entirely off-chain with cryptographic verifiability
- **Agent Architecture:** Autonomous entities with discoverable semantic capabilities
- **Neurosymbolic Pipeline:** Combines LLM-based natural language understanding with deterministic symbolic execution
- **Composition:** Agents dynamically compose methods without hardcoded integrations
- **Storage:** In-memory SurrealDB for local state management
- **Discovery:** HNSW vector indexing for semantic method matching

**Repository:** `unicitynetwork/unicity-agentic-demo` (Rust)

**Agent Execution Flow:**

```
Natural Language Input
        ↓
    [Neural Phase - LLM]
    Parse intent, resolve ambiguities
        ↓
    Structured Transaction Flows
        ↓
    [Symbolic Phase - Type-safe execution]
    Method chaining with precise state management
        ↓
    Deterministic, Verifiable Results
        ↓
    Token Operations
    ├─ Mint tokens
    ├─ Transfer tokens
    ├─ Burn tokens
    └─ Execute complex financial workflows
```

**Key Capabilities:**

1. **Method Discovery:** HNSW vector indexing semantically matches user intent to agent methods
2. **Flexibility:** LLM natural language understanding handles ambiguity
3. **Reliability:** Deterministic symbolic execution ensures verifiable results
4. **Composability:** Agents discover and compose other agents' methods dynamically
5. **Turing Completeness:** Execute arbitrary algorithms off-chain

**Example Applications:**
- High-performance decentralized exchanges with centralized-level order book performance
- Subscription and access management with microtransaction efficiency
- Cross-chain bridges and fiat gateways
- Complex financial instruments and derivatives

---

## Core Components and Their Interactions

### Component Interaction Diagram

```
                    ┌─────────────────────────────────┐
                    │   Layer 5: Agent Execution      │
                    │  ┌──────────────────────────┐   │
                    │  │ Verifiable Autonomous    │   │
                    │  │ Agents (Rust/Any Lang)   │   │
                    │  └──────────────────────────┘   │
                    └─────────────┬───────────────────┘
                                  │ State Transitions
                    ┌─────────────▼───────────────────┐
                    │ Layer 4: State Transition       │
                    │  ┌──────────────────────────┐   │
                    │  │ Off-Chain Tokens         │   │
                    │  │ Predicates & Ownership   │   │
                    │  │ SDK (TS, Java, Any)      │   │
                    │  └──────────────────────────┘   │
                    └─────────────┬───────────────────┘
                                  │ Commitments + Signatures
                    ┌─────────────▼───────────────────┐
                    │ Layer 3: Aggregation            │
                    │  ┌──────────────────────────┐   │
                    │  │ Sparse Merkle Trees      │   │
                    │  │ Proof Generation         │   │
                    │  │ 1-second batching        │   │
                    │  │ (aggregator-go)          │   │
                    │  └──────────────────────────┘   │
                    └─────────────┬───────────────────┘
                                  │ Batched Proofs
                    ┌─────────────▼───────────────────┐
                    │ Layer 2: BFT Consensus          │
                    │  ┌──────────────────────────┐   │
                    │  │ Fast Finality (1 sec)    │   │
                    │  │ Partitioned Architecture │   │
                    │  │ (bft-core/bft-go-base)   │   │
                    │  └──────────────────────────┘   │
                    └─────────────┬───────────────────┘
                                  │ Root hash
                    ┌─────────────▼───────────────────┐
                    │ Layer 1: PoW Trust Anchor       │
                    │  ┌──────────────────────────┐   │
                    │  │ Bitcoin Fork (RandomX)   │   │
                    │  │ 2-minute blocks          │   │
                    │  │ Immutable ordering       │   │
                    │  │ (alpha)                  │   │
                    │  └──────────────────────────┘   │
                    └─────────────────────────────────┘
```

### Data Flow Through Layers

**Scenario: Agent Mints and Transfers Token**

```
1. Agent Layer (Layer 5)
   - Agent receives "mint 100 tokens" request
   - Creates state transition with predicate ownership
   - Signs with agent's private key

2. State Transition Layer (Layer 4)
   - Creates transaction with:
     * Token specification
     * Predicate (masked/unmasked)
     * Recipient address
     * Signature proof
   - Serializes transaction

3. Aggregation Layer (Layer 3)
   - Aggregator receives commitment
   - Validates secp256k1 signature
   - Validates format (requestId = SHA256(pk || stateHash))
   - Includes in next 1-second batch
   - Generates Merkle proof

4. BFT Consensus Layer (Layer 2)
   - Receives aggregated block with Merkle root
   - 1-second consensus round
   - Achieves Byzantine agreement
   - Generates fast finality

5. PoW Trust Anchor (Layer 1)
   - BFT root hash included in PoW blocks
   - 2-minute immutable ordering
   - Provides ultimate security anchor

6. Proof Retrieval (Reverse Flow)
   - Token owner requests inclusion proof
   - SMT proof retrieved from aggregator
   - Non-deletion proof confirms permanence
   - Token marked CONFIRMED
```

---

## Key Innovations

### 1. Off-Chain Execution Paradigm

**Innovation:** All computation happens off-chain; blockchain only prevents double-spending

**Advantages:**
- No shared resource contention between applications
- Independent scaling: applications scale with their own capacity, not blockchain throughput
- Orders of magnitude higher throughput than on-chain execution
- Reduced latency and lower costs

**Comparison:**
- **Traditional Blockchains:** "Execute on-chain, verify on-chain" (throughput-limited)
- **Unicity:** "Execute off-chain, verify with on-chain anchoring" (throughput-unlimited)

### 2. Single-Input Transaction Model

**Innovation:** Each transaction has exactly one input, enabling local verifiability

**Advantages:**
- Coin sub-ledgers can be extracted and used entirely off-chain
- Each user maintains their own UTXO set independently
- Enables peer-to-peer token transfers without full state synchronization
- Reduces validator computational burden

### 3. Sparse Merkle Tree Aggregation

**Innovation:** Trustless proof aggregation using SMT with optional ZK proofs for non-deletion

**Advantages:**
- Constant-size inclusion proofs regardless of ledger size
- Non-deletion proofs prevent censorship
- Optional zero-knowledge proofs preserve privacy
- Enables offline verification of any state transition

**Technical Details:**
- Path compression for efficient proof representation
- Configurable tree depth for different use cases
- Support for both sparse and compact variants

### 4. Predicate-Based Ownership

**Innovation:** Flexible ownership model using cryptographic conditions (predicates)

**Predicates:**
- **Unmasked:** Direct public key visibility
- **Masked:** Privacy-preserving, hiding keys behind cryptographic masks
- **Custom:** Application-defined ownership rules
- **Burn:** Irreversible destruction

**Advantages:**
- Privacy options (masked predicates hide transaction recipients)
- Flexible access control (custom predicates for complex ownership)
- Atomic transfers (predicates ensure atomic state transitions)
- Forward compatibility (new predicate types can be added)

### 5. Verifiable Autonomous Agents

**Innovation:** Off-chain Turing-complete computations with cryptographic verifiability

**Neurosymbolic Pipeline:**
- **Neural Component:** LLM parses natural language, resolves ambiguities
- **Symbolic Component:** Type-safe method chaining creates deterministic execution
- **Result:** Flexible yet reliable agent execution

**Advantages:**
- Agents execute complex logic without blockchain constraints
- Natural language interfaces for non-technical users
- Composable agent methods enable emergent behaviors
- Verifiable results provide auditability

### 6. Multi-Layer Security Model

**Innovation:** Combines five specialized layers, each optimized for its purpose

**Strengths:**
- **Layer 1 (PoW):** Immutable ordering, resistant to 51% attacks
- **Layer 2 (BFT):** Fast consensus for aggregation coordination
- **Layer 3 (SMT):** Trustless proof verification
- **Layer 4 (State):** Cryptographic ownership and transfer
- **Layer 5 (Agents):** Turing-complete off-chain execution

**Security Properties:**
- Transactions achieve fast finality through BFT (seconds)
- Ultimate security anchors to immutable PoW chain (minutes)
- Double-spending impossible through inclusion proof verification
- Censorship resistant through non-deletion proofs

---

## Technology Stack

### Core Languages by Layer

| Layer | Primary Language | Alternative Languages | Purpose |
|-------|------------------|----------------------|---------|
| Layer 1 (PoW) | C++ | C (miner) | Consensus node, mining software |
| Layer 2 (BFT) | Go | - | Fast Byzantine consensus |
| Layer 3 (Aggregation) | Go | TypeScript (legacy) | Proof aggregation, batching |
| Layer 4 (State Transition) | TypeScript | Java, Go, Rust, Python | Token operations, SDKs |
| Layer 5 (Agents) | Rust | JavaScript, TypeScript | Autonomous agents, computation |

### Key Dependencies

**Cryptography:**
- secp256k1 (ECDSA signatures)
- SHA256 (hashing)
- RandomX (PoW hash function)

**Data Structures:**
- Sparse Merkle Trees (SMT)
- Merkle Patricia Tries (alternative)
- CBOR encoding (compact serialization)

**Runtime Environments:**
- Node.js (TypeScript SDKs)
- JVM (Java SDK)
- Rust runtime (Agents)
- Go runtime (Consensus/Aggregation)

**External Services:**
- SurrealDB (agent state storage)
- MongoDB (aggregator storage)
- HNSW (vector indexing for agent discovery)

### Development Tools

- **Build Systems:** Gradle (Java), Cargo (Rust), Make (C/C++), npm (TypeScript)
- **Testing:** Jest (TypeScript), custom test suites (Go), Hardhat-style (if applicable)
- **Version Control:** Git with monorepo organization
- **CI/CD:** GitHub Actions (visible in workflows)

---

## Repository Ecosystem

### Complete Repository Inventory

#### Core Infrastructure (13 repositories)

| Repository | Language | Purpose | Status |
|------------|----------|---------|--------|
| `alpha` | C++ | PoW consensus layer full node | Active |
| `alpha-miner` | C | CPU mining software | Active |
| `unicity-mining-core` | C# | Mining pool (MiningCore fork) | Active |
| `bft-core` | Go | Byzantine fault-tolerant consensus | Active |
| `bft-go-base` | Go | BFT foundation library | Active |
| `aggregator-go` | Go | Proof aggregation & SMT | Active |
| `aggregators_net` | TypeScript | Aggregator-consensus APIs | Archived |
| `aggregator-infra` | Shell | Infrastructure configuration | Active |
| `aggregator-subscription` | Java | Subscription management | Active |
| `Unicity-Explorer` | Web | Block explorer UI/UX | Active |
| `guiwallet` | HTML/JavaScript | Web-based wallet | Active |
| `commons` | TypeScript | Shared cryptographic utilities | Archived |
| `specs` | Markdown | Technical specifications | Active |

#### SDK Implementations (4 repositories)

| Repository | Language | Target Platform | Status |
|------------|----------|-----------------|--------|
| `state-transition-sdk` | TypeScript | Node.js, Browsers | Active |
| `java-state-transition-sdk` | Java | JVM (11+), Android (12+) | Active |
| Agent SDK (implied) | Go | Server-side agents | Active |
| Agent SDK (implied) | Python | Python ecosystem | Likely planned |

#### Agent & Execution (2 repositories)

| Repository | Language | Purpose | Status |
|------------|----------|---------|--------|
| `unicity-agentic-demo` | Rust | Neurosymbolic agent framework | Active |
| Agent framework | TypeScript | Alternative agent implementation | Implied |

#### Documentation (2 repositories)

| Repository | Language | Purpose | Status |
|------------|----------|---------|--------|
| `whitepaper` | LaTeX/TeX | Technical whitepaper + appendices | Active |
| `execution-model-tex` | TeX | Execution model documentation | Active |

#### Wallets & User Interfaces (2 repositories)

| Repository | Language | Platform | Status |
|------------|----------|----------|--------|
| `guiwallet` | HTML/JavaScript | Web browser | Active |
| `unyx-wallet` | Kotlin | Android mobile | Active |

#### Deprecated/Archived (1+ repositories)

- `commons` - Functionality integrated into other projects
- `aggregators_net` - Replaced by newer aggregator implementations

### Repository Organization Pattern

Most repositories follow this structure:
```
repository-name/
├── README.md
├── src/
├── tests/
├── docs/
├── .github/workflows/    (CI/CD)
├── Makefile / gradle.build / Cargo.toml
└── Configuration files
```

---

## Comparison with Traditional Blockchains

### Architecture Paradigm Shift

#### Traditional Blockchain Model

```
User Transaction
    ↓
[Network Gossip]
    ↓
[Mempool Competition]
    ↓
[On-Chain Execution]
    ↓
[Consensus Verification]
    ↓
[State Update]
    ↓
Finality (slow, costly)

Limitations:
- All transactions compete for same block space
- Execution throughput = blockchain throughput
- Latency = block time (minutes)
- Costs scale with on-chain data
```

#### Unicity Network Model

```
User/Agent Transaction
    ↓
[Off-Chain Execution]
    ↓
[State Transition Creation]
    ↓
[Aggregation (1 second)]
    ↓
[BFT Consensus (1 second)]
    ↓
[PoW Anchoring (2 minutes)]
    ↓
[Finality - Fast & Cheap]

Advantages:
- Parallel execution (applications don't interfere)
- Execution throughput >> blockchain throughput
- Latency = 1-2 seconds (not minutes)
- Costs independent of computation complexity
```

### Key Differences

| Aspect | Traditional Blockchains | Unicity Network |
|--------|------------------------|-----------------|
| **Execution Location** | On-chain (bottleneck) | Off-chain (scalable) |
| **Throughput** | Limited by block space | Orders of magnitude higher |
| **Latency** | Minutes (block time) | Seconds (aggregation + BFT) |
| **Transaction Costs** | High (compete for block space) | Low (off-chain aggregation) |
| **Privacy** | Public transactions | Privacy-preserving commitments |
| **Scalability Model** | Vertical (bigger blocks) | Horizontal (parallel execution) |
| **Smart Contracts** | On-chain VMs | Off-chain Turing-complete agents |
| **Consensus Type** | PoW/PoS alone | Multi-layer (PoW + BFT + SMT) |
| **Token Ownership** | Account-based or UTXO | Predicate-based (flexible) |
| **Data Availability** | Full state on-chain | Commitments on-chain, data off-chain |

### Performance Implications

**Throughput:**
- Bitcoin: ~7 tx/sec
- Ethereum: ~15 tx/sec
- Unicity: Millions of commitments per block potential

**Latency:**
- Bitcoin: ~10 minutes
- Ethereum: ~15 seconds
- Unicity: ~2 seconds (BFT) + 2 minutes (final anchor)

**Cost per Transaction:**
- Bitcoin: $1-20+ (congestion-dependent)
- Ethereum: $0.50-50+ (gas-dependent)
- Unicity: Near-zero (off-chain aggregation)

---

## Implementation Details

### State Transition SDK Architecture (TypeScript)

**Core Modules:**

```typescript
// Signing & Cryptography
interface SigningService {
  sign(data: bytes): Signature
  getAddress(): Address
  getMaskedAddress(nonce?: number): Address
}

// Token Management
interface Token {
  id: string
  state: TokenState
  owner: Address
  predicate: Predicate
  transactionHistory: Transaction[]
}

// State Transitions
interface StateTransition {
  from: Address
  to: Address
  newState: TokenState
  signature: Signature
  timestamp: number
  proof?: InclusionProof
}

// Address Generation
type Address = string // Derived from predicate

// Predicate System
type Predicate =
  | UnmaskedPredicate    // Direct public key
  | MaskedPredicate      // Hidden with nonce
  | BurnPredicate        // Irreversible destruction
```

**Token Lifecycle Implementation:**

```typescript
// Minting
const token = await aggregator.mintToken({
  secret: userSecret,
  tokenType: 'FUNGIBLE' | 'UNIQUE',
  initialState: tokenData,
  recipientPredicate: 'masked' | 'unmasked',
  nonce: optional, // for masked addresses
})

// Transferring
const transition = await token.transfer({
  newOwner: recipientAddress,
  signature: ownerSignature,
})

// Obtaining Proof
const proof = await aggregator.getInclusionProof(requestId)
const nonDeletionProof = await aggregator.getNonDeletionProof(requestId)
```

### Aggregator Implementation (Go)

**Request Processing Flow:**

```go
// 1. Receive commitment from agent/user
commitment := {
  requestId: SHA256(publicKey || stateHash),
  stateHash: userProvidedHash,
  signature: secp256k1Signature,
  dataHash: "0000..." + sha256Hash,  // Imprinting
}

// 2. Validation checks
- Verify secp256k1 signature
- Validate requestId format
- Confirm dataHash imprinting (0000 prefix)
- Check for duplicate submissions

// 3. Queue for next block
commitmentQueue.push(commitment)

// 4. Every 1 second: Create block
block := {
  commitments: commitmentQueue,
  merkleRoot: computeMerkleRoot(commitmentQueue),
  timestamp: currentTime,
}

// 5. Generate proofs
for each commitment in block:
  proof := generateSMTProof(commitment, merkleRoot)
  store(commitment.requestId, proof)
```

### BFT Consensus (Go)

**Fast Finality Model:**

```
Aggregator broadcasts block
        ↓
[1-second BFT round]
        ↓
Validators reach Byzantine agreement
        ↓
Block commits with ~1-second latency
        ↓
[Block included in PoW chain]
        ↓
Ultimate immutable ordering
```

### Agent Execution (Rust)

**Neurosymbolic Computation:**

```rust
// 1. Neural Phase: Parse Intent
let intent = nlp_parse("mint 100 tokens");
// Output: Transaction flow specification

// 2. Vector Discovery: Find Methods
let methods = agent.discover_methods(intent);
// Uses HNSW indexing for semantic similarity

// 3. Symbolic Phase: Type-Safe Execution
let result = agent.execute_methods(methods, state);
// Deterministic, verifiable computation

// 4. Token Operations
agent.mint_tokens(owner, amount, predicate)?
agent.transfer_tokens(from, to, amount)?
agent.burn_tokens(owner, amount)?

// 5. State Transition
let transition = StateTransition {
  from: agent.address,
  to: recipient,
  newState: updatedState,
  signature: agent.sign(newState),
}

// 6. Submission to Aggregator
aggregator.submit(transition).await?
```

---

## Security Model

### Multi-Layer Defense Strategy

#### Layer 1: Proof of Work (Immutable Ordering)

**Security Property:** Prevents transaction reordering through computational difficulty

**Mechanism:**
- RandomX hash function requires computational work
- ASIC-resistant (unlike SHA256D Bitcoin)
- 51% attack requires controlling majority of mining power
- 2-minute blocks anchor aggregation layer

**Attack Resistance:**
- Double-spending prevention (consensus on canonical chain)
- Censorship resistance (immutable ordering)
- Finality guarantee after multiple confirmations

#### Layer 2: Byzantine Fault Tolerance (Fast Consensus)

**Security Property:** Agreement despite malicious validators (up to 1/3 faulty)

**Mechanism:**
- 1-second consensus rounds
- Validator quorum reaches agreement
- BFT guarantees safety and liveness
- Partitioned architecture prevents single points of failure

**Attack Resistance:**
- Sybil attacks mitigated by validator selection
- Equivocation (voting both ways) prevented by protocol rules
- Network partition tolerance through multiple partitions

#### Layer 3: Sparse Merkle Tree Verification (Proof Verification)

**Security Property:** Enables offline verification of commitments

**Mechanism:**
- Inclusion proofs are logarithmic-sized
- SMT structure allows verification without full ledger
- Non-deletion proofs prevent censorship
- Optional ZK proofs hide commitment details

**Attack Resistance:**
- Proof forgery prevented by cryptographic binding
- Censorship prevented by non-deletion proofs
- Privacy maintained through ZK proofs

#### Layer 4: Cryptographic Ownership (Predicate-Based)

**Security Property:** Only rightful owner can authorize transfers

**Mechanism:**
- secp256k1 signatures prove private key possession
- Predicates define valid ownership conditions
- Masked predicates hide identities
- Custom predicates enable complex ownership rules

**Attack Resistance:**
- Private key theft (protected by wallet security)
- Signature forgery (cryptographically impossible)
- Unauthorized transfers (require valid predicate conditions)

#### Layer 5: Verifiable Computation (Agent Execution)

**Security Property:** Deterministic, auditable computation

**Mechanism:**
- Type-safe symbolic execution prevents undefined behavior
- Ledger system maintains precise state
- SurrealDB transactions ensure consistency
- Results are cryptographically signable for verification

**Attack Resistance:**
- Logic errors (type system prevents many bugs)
- State corruption (ACID transactions)
- Denial of service (off-chain execution limits blast radius)

### Double-Spending Prevention

**Prevention Mechanism:**

```
1. User creates state transition with single nonce
2. Signs transition with private key (proves ownership)
3. Submits to aggregator with request ID = SHA256(pk || stateHash)
4. Aggregator includes commitment in next 1-second batch
5. BFT consensus anchors batch
6. PoW chain includes BFT commitment
7. Token marked CONFIRMED with inclusion proof
8. Recipient can verify:
   - Commitment in specific PoW block (immutable)
   - Only one commitment for this token
   - Previous owner's valid signature
```

**Impossibility of Double-Spend:**
- Once included in PoW block, commitment is immutable
- Attempting second spend would create different requestId
- Aggregator rejects duplicate requestIds
- Recipient verifies immutable PoW inclusion

### Privacy Model

**Transaction Privacy:**

```
Traditional Blockchain:
Token Transfer → Visible to all (sender, recipient, amount)

Unicity Network:
Token Transfer → Encrypted/Hashed Commitment
                 ↓
            Only hash appears on-chain
            ↓
        Full transfer details remain off-chain
            ↓
        Recipient verifies through zero-knowledge proof
```

**Privacy Guarantees:**
- Commitments reveal no token information
- Transaction amounts remain private
- Recipient privacy (masked predicates)
- Sender privacy (masked predicates)
- On-chain observer cannot link commitment to transaction

### Finality Guarantees

**Finality Timeline:**

```
T+0: User submits state transition to aggregator
T+1: Commitment included in SMT batch (1-second block)
T+1: BFT consensus (fast finality - <1 second)
T+2: Commitment anchored in PoW block (ultimate finality)

Fast Finality: 1-2 seconds (sufficient for most applications)
Ultimate Finality: 2-10 minutes (immutable anchor)
```

---

## Key Repositories and Their Purposes

### Consensus Layer
- **`alpha`** (C++) - Full PoW node implementation using RandomX
- **`alpha-miner`** (C) - CPU mining software
- **`unicity-mining-core`** (C#) - Mining pool implementation

### Consensus Coordination
- **`bft-core`** (Go) - Byzantine Fault Tolerant consensus engine
- **`bft-go-base`** (Go) - BFT foundation and utilities

### Proof Aggregation
- **`aggregator-go`** (Go) - Sparse Merkle Tree proof aggregation
- **`aggregators_net`** (TypeScript, archived) - Legacy aggregator APIs
- **`aggregator-infra`** (Shell) - Deployment infrastructure
- **`aggregator-subscription`** (Java) - Subscription service management

### Token & State Management
- **`state-transition-sdk`** (TypeScript) - Primary SDK for state transitions
- **`java-state-transition-sdk`** (Java) - JVM implementation
- **`commons`** (TypeScript, archived) - Shared cryptographic utilities

### Agent & Computation
- **`unicity-agentic-demo`** (Rust) - Agent framework implementation

### User Interfaces
- **`guiwallet`** (HTML/JavaScript) - Web-based wallet
- **`unyx-wallet`** (Kotlin) - Mobile Android wallet
- **`Unicity-Explorer`** (Web) - Block explorer

### Documentation
- **`whitepaper`** (LaTeX) - Technical whitepaper and appendices
- **`execution-model-tex`** (TeX) - Execution model specification
- **`specs`** (Markdown) - Technical specifications

---

## Recommended Learning Path

### 1. Foundational Understanding
- Read: Five-layer architecture overview (this document)
- Study: PoW consensus basics (Bitcoin understanding helpful)
- Explore: `unicitynetwork/alpha` repository

### 2. Core Innovation Understanding
- Study: State Transition Layer design
- Explore: Off-chain execution paradigm
- Review: Predicate-based ownership model
- Code: `unicitynetwork/state-transition-sdk`

### 3. Technical Deep Dive
- Read: Technical whitepaper (LaTeX)
- Study: Sparse Merkle Tree implementation
- Explore: BFT consensus coordination
- Code: `unicitynetwork/aggregator-go`, `unicitynetwork/bft-core`

### 4. Practical Implementation
- Build: Simple token with TypeScript SDK
- Experiment: Transfer between addresses
- Test: Offline verification of proofs
- Deploy: Simple agent

### 5. Advanced Topics
- Study: Neurosymbolic agent execution
- Explore: Privacy-preserving predicates
- Research: Verifiable computation architectures
- Contribute: New agent methods or SDK features

---

## Key Takeaways

### For Architects
- Unicity represents a fundamental architectural paradigm shift
- Off-chain execution with on-chain security provides massive scalability
- Five-layer design optimizes each function independently
- Multi-stage finality (fast BFT + ultimate PoW) balances speed and security

### For Developers
- Multiple SDK options (TypeScript, Java, likely more coming)
- Flexible predicate system enables custom ownership logic
- Agent framework supports arbitrary computation off-chain
- Well-documented APIs and comprehensive examples

### For Researchers
- Novel combination of PoW, BFT, SMT, and verifiable computation
- Privacy-preserving commitment scheme (off-chain transaction details)
- Horizontal scalability through parallel execution
- Agent-based model for autonomous systems

### For Users
- Near-zero transaction costs (off-chain aggregation)
- Privacy by default (commitments hide transaction details)
- Fast finality (1-2 seconds via BFT)
- Ultimate security (anchored to immutable PoW blockchain)

---

## References and Resources

### Official Documentation
- **GitHub Organization:** https://github.com/unicitynetwork
- **Whitepaper:** https://github.com/unicitynetwork/whitepaper
- **Technical Specifications:** https://github.com/unicitynetwork/specs
- **Execution Model:** https://github.com/unicitynetwork/execution-model-tex

### Core Repositories
- **Consensus Layer:** https://github.com/unicitynetwork/alpha
- **Aggregation Layer:** https://github.com/unicitynetwork/aggregator-go
- **State Transition SDK:** https://github.com/unicitynetwork/state-transition-sdk
- **Agent Framework:** https://github.com/unicitynetwork/unicity-agentic-demo

### SDKs by Language
- **TypeScript:** https://github.com/unicitynetwork/state-transition-sdk
- **Java:** https://github.com/unicitynetwork/java-state-transition-sdk
- **Rust (Agents):** https://github.com/unicitynetwork/unicity-agentic-demo

### User Interfaces
- **Web Wallet:** https://github.com/unicitynetwork/guiwallet
- **Mobile Wallet:** https://github.com/unicitynetwork/unyx-wallet
- **Block Explorer:** https://github.com/unicitynetwork/Unicity-Explorer

### Infrastructure
- **Mining:** https://github.com/unicitynetwork/alpha-miner
- **Mining Pool:** https://github.com/unicitynetwork/unicity-mining-core
- **Aggregator Infrastructure:** https://github.com/unicitynetwork/aggregator-infra

---

## Document Metadata

**Author:** Research conducted via GitHub analysis and technical documentation
**Date:** November 4, 2025
**Version:** 1.0
**Repository Count Analyzed:** 25+
**Key Sources:** Official GitHub repos, whitepapers, technical specifications
**Target Audience:** Architects, developers, researchers, technical decision makers

---

*This report provides a comprehensive technical overview of Unicity Network's architecture. For the latest information, always refer to the official GitHub repositories and technical documentation.*
