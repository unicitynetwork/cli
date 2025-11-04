# Unicity Network Expert Agent Profile

**Purpose:** Quick reference guide for implementing expert agents and AI systems specialized in Unicity Network technologies.

---

## Agent Specialization Matrix

### Layer Specialization Profiles

#### 1. Consensus Layer Expert

**Specialization Focus:** PoW consensus, mining, block validation

**Core Knowledge:**
- RandomX hash function and ASIC resistance
- 2-minute block time optimization
- Single-input transaction model
- ASERT difficulty adjustment
- Mining pool software operation

**Key Repositories:**
- `unicitynetwork/alpha` (C++)
- `unicitynetwork/alpha-miner` (C)
- `unicitynetwork/unicity-mining-core` (C#)

**Typical Queries:**
- "How does the mining process work?"
- "Explain the single-input transaction model"
- "What are the block reward parameters?"
- "How does RandomX improve decentralization?"
- "Walk me through block validation"

**Expertise Assertions:**
```
"The Unicity PoW layer uses RandomX hash function for ASIC resistance,
maintaining 2-minute block times. Single-input transactions enable
coin sub-ledgers to be extracted for off-chain use, providing a
foundation for all higher layers."
```

---

#### 2. BFT Consensus Architect

**Specialization Focus:** Byzantine Fault Tolerance, fast finality, consensus coordination

**Core Knowledge:**
- 1-second BFT consensus rounds
- Partitioned ledger architecture
- Root chain coordination
- Transaction routing across partitions
- Validator selection and quorum

**Key Repositories:**
- `unicitynetwork/bft-core` (Go)
- `unicitynetwork/bft-go-base` (Go)

**Typical Queries:**
- "How does BFT achieve 1-second finality?"
- "Explain the partitioned architecture"
- "What role do aggregators play in consensus?"
- "How does Byzantine tolerance protect the network?"
- "What's the validator quorum requirement?"

**Expertise Assertions:**
```
"The BFT consensus layer achieves fast finality through 1-second
rounds of Byzantine Fault Tolerant consensus. The partitioned
architecture allows separate transaction chains for different
asset types while coordinating through a root chain."
```

---

#### 3. Aggregation & Proof Systems Engineer

**Specialization Focus:** Sparse Merkle Trees, proof generation, data aggregation

**Core Knowledge:**
- Sparse Merkle Tree structure and optimization
- Inclusion proof generation
- Non-deletion proofs
- Zero-knowledge proofs for privacy
- MongoDB storage and retrieval
- Merkle root computation
- Proof verification algorithms

**Key Repositories:**
- `unicitynetwork/aggregator-go` (Go)
- `unicitynetwork/specs` (specifications)

**Typical Queries:**
- "How are Sparse Merkle Tree proofs generated?"
- "What's the difference between inclusion and non-deletion proofs?"
- "How do you verify a commitment without the full ledger?"
- "What privacy properties do ZK proofs provide?"
- "Explain the aggregator batching process"

**Expertise Assertions:**
```
"Sparse Merkle Trees enable logarithmic-sized proofs of inclusion
in exponentially-large ledgers. Non-deletion proofs prevent
censorship by cryptographically binding all historical data.
This architecture allows trustless verification of any state
transition with minimal on-chain storage."
```

---

#### 4. Token & State Transition Specialist

**Specialization Focus:** Token lifecycle, predicates, state management

**Core Knowledge:**
- Token minting, transfer, and burning
- Unmasked vs. masked predicates
- Address generation and derivation
- State transition creation
- secp256k1 signature verification
- UTXO management
- Transaction history tracking

**Key Repositories:**
- `unicitynetwork/state-transition-sdk` (TypeScript)
- `unicitynetwork/java-state-transition-sdk` (Java)
- `unicitynetwork/commons` (cryptography utilities)

**Typical Queries:**
- "How do I mint a new token?"
- "What's the difference between masked and unmasked addresses?"
- "How does predicate-based ownership work?"
- "Explain the token transfer process"
- "How do you verify token ownership?"

**Expertise Assertions:**
```
"Unicity's predicate system enables flexible ownership models.
Unmasked predicates provide transparent ownership, while masked
predicates hide identity behind cryptographic nonces. Each token
carries its complete transaction history, enabling offline
verification without trusting any third party."
```

---

#### 5. Verifiable Agent Architect

**Specialization Focus:** Off-chain computation, autonomous agents, verifiable execution

**Core Knowledge:**
- Neurosymbolic computation (neural + symbolic)
- Agent method discovery (HNSW vector indexing)
- SurrealDB in-memory storage
- Type-safe symbolic execution
- Natural language processing for intent parsing
- Agent composability and method chaining
- Turing-complete off-chain computation
- Agent signature and verification

**Key Repositories:**
- `unicitynetwork/unicity-agentic-demo` (Rust)
- Implied TypeScript agent framework

**Typical Queries:**
- "How do agents execute off-chain computation?"
- "Explain the neurosymbolic pipeline"
- "How do agents discover available methods?"
- "Can agents compose other agents?"
- "What makes agent computation verifiable?"
- "Show me how to create a trading agent"

**Expertise Assertions:**
```
"Verifiable autonomous agents combine neural language understanding
with symbolic execution. The neural component parses natural language
intent, while the symbolic component ensures deterministic, auditable
computation. Agents discover methods through semantic vector indexing
and can compose complex workflows from simpler primitives."
```

---

#### 6. System Architect (Full Stack)

**Specialization Focus:** Inter-layer communication, end-to-end flows, system design

**Core Knowledge:**
- All five layers and their interactions
- Data flow through the system
- Latency and finality guarantees
- Privacy properties across layers
- Scalability characteristics
- Security guarantees
- Trade-offs between different design choices
- Network topology and peer discovery

**Key Repositories:**
- All layers (cross-cutting knowledge)
- `unicitynetwork/whitepaper`
- `unicitynetwork/specs`

**Typical Queries:**
- "Walk me through a complete token transfer"
- "How do fast finality and ultimate finality work together?"
- "What's the security model of the entire system?"
- "How does privacy preservation work across layers?"
- "Explain the throughput and latency characteristics"
- "How does Unicity compare to traditional blockchains?"

**Expertise Assertions:**
```
"Unicity's five-layer architecture achieves scalability through
radical separation of concerns. Off-chain execution (Layers 4-5)
scales independently from the consensus anchor (Layers 1-2).
Fast finality arrives in 1-2 seconds through BFT consensus,
while ultimate immutable ordering comes from PoW anchoring."
```

---

## Domain-Specific Knowledge Bases

### Cryptography Domain

**Critical Functions:**
- secp256k1 ECDSA signature scheme
- SHA256 hashing for commitment IDs
- RandomX for PoW
- CBOR encoding for compact serialization

**Standard Queries:**
- "How are signatures verified?"
- "What's the signature format?"
- "How do you generate a public key from a secret?"
- "Explain the cryptographic guarantees"

**Reference:** secp256k1 standard, ECDSA specifications, CBOR RFC 7049

---

### Privacy & Security Domain

**Core Concepts:**
- Masked vs. unmasked predicates
- Commitment scheme (hide transaction details)
- Non-deletion proofs (censorship resistance)
- Zero-knowledge proofs
- Signature verification

**Standard Queries:**
- "How are transactions kept private?"
- "What information appears on-chain?"
- "Can the aggregator see transaction details?"
- "How do masked addresses work?"
- "What prevents censorship?"

**Key Principle:**
```
"Only commitment hashes appear on-chain. The full transaction
details (amounts, recipients, data) remain off-chain. Masked
addresses hide identity through cryptographic nonces. Non-deletion
proofs prevent aggregator censorship of historical data."
```

---

### Performance & Scalability Domain

**Key Metrics:**
- **Throughput:** Millions of commitments per block (vs. 7-15 traditional blockchains)
- **Latency:** 1-2 seconds fast finality, 2-10 minutes ultimate finality
- **Cost:** Near-zero (off-chain aggregation vs. block space fees)
- **Scalability:** Horizontal (parallel execution) vs. vertical (larger blocks)

**Standard Queries:**
- "What's the maximum throughput?"
- "How fast are transactions finalized?"
- "What are typical transaction costs?"
- "How does it scale compared to Bitcoin/Ethereum?"
- "What's the latency vs. finality trade-off?"

**Key Principle:**
```
"Unicity achieves massive scalability through off-chain execution.
Applications don't compete for shared blockchain resources; instead,
each operates in parallel. The blockchain serves only to prevent
double-spending, anchoring fast off-chain consensus through slower
but immutable PoW."
```

---

### Architecture & Design Domain

**Design Patterns:**
- Layered architecture (5-layer stack)
- Separation of concerns
- Modularity (independent optimization per layer)
- Multi-stage finality
- Off-chain execution paradigm

**Standard Queries:**
- "Why five layers instead of monolithic blockchain?"
- "What's the rationale for off-chain execution?"
- "How do layers interact?"
- "What are the trade-offs?"
- "How does this compare to other scaling solutions?"

**Key Principle:**
```
"The five-layer architecture optimizes each function independently.
PoW provides immutable ordering (Layer 1), BFT provides fast consensus
(Layer 2), SMT provides proof aggregation (Layer 3), cryptography
provides ownership verification (Layer 4), and agents provide
computation (Layer 5). This modular design enables orders of magnitude
higher throughput than traditional blockchains."
```

---

## Knowledge Organization by Use Case

### Use Case: Build a Token Application

**Required Expert:** Token & State Transition Specialist + System Architect

**Key Concepts:**
1. Predicate selection (masked vs. unmasked)
2. Token minting flow
3. Transfer authorization
4. Ownership verification
5. Inclusion proof retrieval

**Recommended Resources:**
- State Transition SDK documentation
- Token lifecycle diagrams (this guide)
- Example: Simple transfer flow

**Key Assertion:**
```
"To build a token app, use the State Transition SDK to create
tokens with predicates. Masked predicates provide privacy (identity
hidden), unmasked provide transparency. Always wait for inclusion
proofs before marking transfers as final."
```

---

### Use Case: Run an Aggregator Node

**Required Expert:** Aggregation & Proof Systems Engineer + BFT Consensus Architect

**Key Concepts:**
1. Commitment validation
2. Block creation (1-second intervals)
3. Merkle root computation
4. Proof generation and storage
5. Leader election and consensus participation

**Recommended Resources:**
- aggregator-go repository
- BFT consensus specifications
- Mining/validator requirements

**Key Assertion:**
```
"Aggregators batch commitments every second, compute Merkle roots,
participate in BFT consensus, and generate proofs. They must validate
secp256k1 signatures and request ID formats before accepting
commitments."
```

---

### Use Case: Create a Trading Agent

**Required Expert:** Verifiable Agent Architect

**Key Concepts:**
1. Natural language intent parsing
2. Method discovery via semantic vectors
3. Order creation and settlement
4. Token transfers
5. Verifiable computation

**Recommended Resources:**
- unicity-agentic-demo repository
- Agent method patterns
- SurrealDB transaction model

**Key Assertion:**
```
"Trading agents combine neural language understanding with symbolic
execution. They discover order methods through semantic similarity,
maintain local state in SurrealDB, and settle trades through the
State Transition Layer with full cryptographic verifiability."
```

---

### Use Case: Deploy Mining Operation

**Required Expert:** Consensus Layer Expert

**Key Concepts:**
1. RandomX mining algorithm
2. Difficulty adjustment (ASERT)
3. Pool mining setup
4. Block validation
5. Reward collection

**Recommended Resources:**
- alpha-miner repository
- unicity-mining-core for pool setup
- Mining pool documentation

**Key Assertion:**
```
"Unicity uses RandomX for ASIC-resistant mining, maintaining
2-minute block times. Mining pools distribute work across
multiple miners, with difficulty adjusting every block via
ASERT to target consistent block intervals."
```

---

## Quick Reference: Layer-by-Layer Operations

### Layer 1: PoW Operations
```
Mine Block:
  1. Collect recent transactions
  2. Solve RandomX puzzle
  3. Build block with valid nonce
  4. Broadcast to network
  5. Earn 10 ALPHA reward

Validate Block:
  1. Check RandomX proof-of-work
  2. Verify single-input transactions
  3. Check timestamp ordering
  4. Update UTXO set
```

### Layer 2: BFT Operations
```
Participate in Consensus:
  1. Propose candidate block (leader round)
  2. Broadcast proposal to validators
  3. Receive votes from peers
  4. If > 2/3 agreement: commit
  5. Advance to next 1-second round

Prevent Equivocation:
  1. Track highest prepared round
  2. Refuse conflicting proposals
  3. Maintain safety even with malicious peers
```

### Layer 3: Aggregation Operations
```
Batch Commitments:
  1. Receive commitment from user
  2. Validate: signature, format, request ID
  3. Add to pending batch
  4. Every 1 second: create block
  5. Compute SMT Merkle root
  6. Store proofs in MongoDB

Generate Proofs:
  1. Retrieve commitment from batch
  2. Trace path to Merkle root
  3. Collect sibling hashes
  4. Return SMT proof (logarithmic size)
```

### Layer 4: Token Operations
```
Mint Token:
  1. Create signing service from secret
  2. Generate predicate (masked/unmasked)
  3. Derive recipient address
  4. Submit to aggregator
  5. Await inclusion proof

Transfer Token:
  1. Create state transition
  2. Sign with private key
  3. Submit to aggregator
  4. Recipient verifies signature
  5. Wait for inclusion proof

Verify Ownership:
  1. Retrieve token state
  2. Check predicate conditions
  3. Verify owner's signature
  4. Confirm inclusion in PoW blockchain
```

### Layer 5: Agent Operations
```
Create Agent:
  1. Define agent methods
  2. Register semantic descriptions
  3. Initialize SurrealDB state
  4. Expose through API

Execute Computation:
  1. Receive natural language intent
  2. Parse into transaction flows (neural)
  3. Discover matching methods (vectors)
  4. Execute type-safe chains (symbolic)
  5. Maintain state consistency
  6. Submit to State Transition Layer

Compose Agents:
  1. Agent A discovers Agent B's methods
  2. Vector similarity matching
  3. Chain methods together
  4. Execute composed workflow
  5. Delegate transactions
```

---

## Common Expert Assertions by Domain

### Consensus Security
```
"Unicity's PoW layer uses RandomX, making it ASIC-resistant and
more decentralized than SHA256D Bitcoin mining. Single-input
transactions enable each user to maintain their own UTXO set
without synchronizing full blockchain state."
```

### Proof Verification
```
"Sparse Merkle Tree proofs are logarithmic in size—regardless
whether the tree contains 1,000 or 1 billion commitments.
Non-deletion proofs cryptographically bind all historical data,
preventing aggregators from censoring past transactions."
```

### Privacy Properties
```
"Transaction details never appear on-chain. Only cryptographic
commitments (hashes) are published. Masked addresses hide identity
through secp256k1-resistant nonces. An on-chain observer cannot
determine if a commitment represents a transfer, mint, or burn."
```

### Scalability Model
```
"Unicity's horizontal scalability comes from off-chain execution.
Applications don't compete for blockchain resources. Each operates
in parallel, scaling independently. The blockchain's only role is
preventing double-spending through immutable ordering."
```

### Performance Comparison
```
"Bitcoin: 7 tx/sec, 10-minute finality
Ethereum: 15 tx/sec, 15-second finality
Unicity: Millions of commitments/block, 1-2 second finality

Traditional blockchains: Vertical scaling (bigger blocks)
Unicity: Horizontal scaling (parallel execution)"
```

### Security Philosophy
```
"Unicity achieves security through layered defense: PoW provides
immutable ordering, BFT provides fast consensus, SMT provides
trustless verification, cryptography provides ownership, agents
provide verifiable computation. No single layer is a bottleneck."
```

---

## Recommended Training Sequence

### Phase 1: Foundational Understanding (Week 1)
1. Read executive summary of architecture report
2. Study five-layer diagram
3. Understand off-chain execution paradigm
4. Review comparison with traditional blockchains

### Phase 2: Layer Deep Dive (Weeks 2-3)
1. **Week 2:** Layers 1-3 (PoW, BFT, SMT)
   - Mining and consensus
   - Proof generation
   - Verification algorithms

2. **Week 3:** Layers 4-5 (Tokens, Agents)
   - Token lifecycle
   - Predicate systems
   - Agent computation

### Phase 3: Hands-On Implementation (Weeks 4-5)
1. Set up development environment
2. Build simple token with SDK
3. Create and transfer token
4. Verify offline
5. Create basic agent
6. Connect agent to token operations

### Phase 4: Advanced Topics (Weeks 6-8)
1. Study whitepaper mathematics
2. Understand cryptographic proofs
3. Implement custom predicates
4. Build complex agent workflows
5. Participate in network (run node/aggregator)

### Phase 5: Specialization (Ongoing)
- Choose layer specialization
- Deep dive into specialized repositories
- Contribute to ecosystem
- Participate in governance

---

## Knowledge Verification Checklist

### Consensus Layer Expert
- [ ] Explain RandomX advantage over SHA256D
- [ ] Describe single-input transaction model
- [ ] Calculate block time from ASERT parameters
- [ ] Verify block proof-of-work validity
- [ ] Explain mining pool architecture

### BFT Architect
- [ ] Describe 1-second consensus round
- [ ] Explain Byzantine tolerance (1/3 faulty)
- [ ] Explain partitioned ledger coordination
- [ ] Describe validator quorum requirements
- [ ] Explain safety and liveness properties

### Aggregation Engineer
- [ ] Compute SMT proof size for N commitments
- [ ] Explain inclusion vs. non-deletion proofs
- [ ] Describe offline proof verification
- [ ] Explain MongoDB storage design
- [ ] Describe Merkle root computation

### Token Specialist
- [ ] Explain masked vs. unmasked addresses
- [ ] Describe token minting flow
- [ ] Explain predicate authorization
- [ ] Verify secp256k1 signature
- [ ] Confirm token ownership chain

### Agent Architect
- [ ] Explain neurosymbolic pipeline
- [ ] Describe HNSW vector indexing
- [ ] Design agent method interface
- [ ] Explain SurrealDB transaction model
- [ ] Compose multiple agents

### System Architect
- [ ] Draw complete data flow diagram
- [ ] Explain finality timeline
- [ ] Describe security model (all layers)
- [ ] Explain privacy properties
- [ ] Compare performance vs. alternatives

---

*This expert profile guide provides the foundation for training specialized agents and AI systems in Unicity Network technologies. Use the layer specializations, domain knowledge bases, and verification checklists to build deep expertise.*
