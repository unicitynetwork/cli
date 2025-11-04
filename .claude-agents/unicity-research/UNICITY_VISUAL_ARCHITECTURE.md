# Unicity Network: Visual Architecture Reference

**Purpose:** Comprehensive visual diagrams and ASCII representations of Unicity Network architecture for quick reference and understanding.

---

## Table of Contents

1. [Five-Layer System Architecture](#five-layer-system-architecture)
2. [Token Lifecycle](#token-lifecycle)
3. [Data Flow Through Layers](#data-flow-through-layers)
4. [Comparison with Traditional Blockchains](#comparison-with-traditional-blockchains)
5. [Security Model Layers](#security-model-layers)
6. [Finality Timeline](#finality-timeline)
7. [Repository Dependency Graph](#repository-dependency-graph)
8. [Component Interaction Matrix](#component-interaction-matrix)

---

## Five-Layer System Architecture

### Complete Stack Visualization

```
╔═══════════════════════════════════════════════════════════════════╗
║                   LAYER 5: AGENT EXECUTION LAYER                  ║
║                 (Off-Chain Turing-Complete Computation)            ║
│                                                                     │
│   ┌─────────────────────────────────────────────────────────┐    │
│   │  Neurosymbolic Agents                                   │    │
│   │  ├─ Natural Language Understanding (LLM)                │    │
│   │  ├─ Method Discovery (HNSW Vector Indexing)             │    │
│   │  ├─ Type-Safe Symbolic Execution                        │    │
│   │  ├─ Agent Composition (Dynamic Method Chaining)         │    │
│   │  └─ SurrealDB Local State Management                    │    │
│   │                                                          │    │
│   │  Example: Trading Agent                                 │    │
│   │  ├─ Parses: "Execute market order for 100 tokens"       │    │
│   │  ├─ Discovers: OrderMethod, SettlementMethod            │    │
│   │  ├─ Chains: Authorize → Order → Settle → Transfer       │    │
│   │  └─ Result: Verifiable on-chain transaction             │    │
│   └─────────────────────────────────────────────────────────┘    │
│                          │                                         │
│              ┌───────────▼──────────────┐                         │
│              │ State Transition SDK     │                         │
│              │ (TS, Java, Go, Rust)     │                         │
│              └───────────▲──────────────┘                         │
│                          │                                         │
╚══════════════════════════╪═════════════════════════════════════════╝
                           │ Commitments + Signatures
┌──────────────────────────▼─────────────────────────────────────────┐
│                  LAYER 4: STATE TRANSITION LAYER                    │
│            (Off-Chain Token Lifecycle Management)                   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Token System                                              │   │
│  │  ├─ Minting: Create with Predicate Ownership              │   │
│  │  ├─ Transfer: Move between Addresses (Predicate Auth)     │   │
│  │  ├─ Burning: Destroy via Burn Predicate                   │   │
│  │  │                                                         │   │
│  │  │  Predicates:                                            │   │
│  │  │  ├─ Unmasked (transparent public key)                  │   │
│  │  │  ├─ Masked (privacy-preserving nonce)                  │   │
│  │  │  ├─ Custom (application-defined conditions)            │   │
│  │  │  └─ Burn (irreversible destruction)                    │   │
│  │  │                                                         │   │
│  │  │  Token Carries:                                         │   │
│  │  │  ├─ Full transaction history                           │   │
│  │  │  ├─ Cryptographic proof lineage                        │   │
│  │  │  ├─ Current owner predicate                            │   │
│  │  │  └─ State data (amounts, metadata)                     │   │
│  │  └─ Ownership Proof: secp256k1 Signatures                 │   │
│  └────────────────────────────────────────────────────────────┘   │
│                          │                                          │
│              ┌───────────▼──────────────┐                          │
│              │ Aggregator Client        │                          │
│              │ (Rest API / gRPC)        │                          │
│              └───────────▲──────────────┘                          │
│                          │                                          │
└──────────────────────────╪──────────────────────────────────────────┘
                           │ Request: {stateHash, signature, data}
┌──────────────────────────▼──────────────────────────────────────────┐
│                   LAYER 3: AGGREGATION LAYER                        │
│          (Trustless Proof Aggregation via Sparse Merkle Trees)      │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Aggregator Process (1-second Batching)                    │   │
│  │                                                            │   │
│  │  Every 1 second:                                           │   │
│  │  ├─ Collect pending commitments                           │   │
│  │  │  └─ Validate:                                           │   │
│  │  │     ├─ secp256k1 signature                             │   │
│  │  │     ├─ requestId = SHA256(publicKey || stateHash)      │   │
│  │  │     ├─ dataHash imprinting (0000 prefix)               │   │
│  │  │     └─ No duplicates                                    │   │
│  │  │                                                         │   │
│  │  ├─ Create block with timestamp                           │   │
│  │  │  └─ Block = {commitments[], timestamp, blockHeight}    │   │
│  │  │                                                         │   │
│  │  ├─ Build Sparse Merkle Tree                              │   │
│  │  │  └─ Compute Merkle root from commitments               │   │
│  │  │                                                         │   │
│  │  ├─ Generate Proofs:                                       │   │
│  │  │  ├─ Inclusion Proof (log N size)                       │   │
│  │  │  │  └─ Path from commitment to Merkle root             │   │
│  │  │  │                                                     │   │
│  │  │  └─ Non-Deletion Proof (optional ZK)                   │   │
│  │  │     └─ Commitment never removed from ledger            │   │
│  │  │                                                         │   │
│  │  └─ Store in MongoDB                                       │   │
│  │     └─ Enable future proof retrieval                       │   │
│  │                                                            │   │
│  │  Parallel Processing:                                      │   │
│  │  ├─ Multiple aggregator instances                          │   │
│  │  ├─ Distributed leader election                           │   │
│  │  ├─ High availability through MongoDB coordination        │   │
│  │  └─ No single point of failure                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                          │                                          │
│              ┌───────────▼──────────────┐                          │
│              │ Batched Merkle Root      │                          │
│              └───────────▲──────────────┘                          │
│                          │                                          │
└──────────────────────────╪──────────────────────────────────────────┘
                           │ Block {commitments[], merkleRoot, height}
┌──────────────────────────▼──────────────────────────────────────────┐
│              LAYER 2: BFT CONSENSUS LAYER                           │
│        (Fast Finality via Byzantine Fault Tolerance)                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  1-Second Consensus Rounds                                 │   │
│  │                                                            │   │
│  │  Round Architecture:                                       │   │
│  │  ├─ Proposer broadcasts candidate block                   │   │
│  │  ├─ Validators receive and validate                       │   │
│  │  ├─ If valid: Broadcast vote                              │   │
│  │  ├─ Collect votes (up to 1 second)                        │   │
│  │  ├─ If >2/3 votes: COMMIT (fast finality achieved)        │   │
│  │  └─ Advance to next 1-second round                        │   │
│  │                                                            │   │
│  │  Byzantine Properties:                                     │   │
│  │  ├─ Safety: <1/3 faulty can't cause divergence            │   │
│  │  ├─ Liveness: >2/3 honest ensure progress                 │   │
│  │  ├─ Equivocation Prevention: Track highest prepared       │   │
│  │  └─ Prevents voting for conflicting blocks                │   │
│  │                                                            │   │
│  │  Partitioned Ledger:                                       │   │
│  │  ├─ Root chain for cross-partition coordination           │   │
│  │  ├─ Money partition (native coins)                        │   │
│  │  ├─ Token partitions (custom tokens)                      │   │
│  │  └─ Transaction routing and settlement                    │   │
│  │                                                            │   │
│  │  Validator Participation:                                  │   │
│  │  ├─ Aggregators participate in consensus                  │   │
│  │  ├─ Stake-weighted voting (optional)                      │   │
│  │  └─ Delegated validators for throughput                   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                          │                                          │
│              ┌───────────▼──────────────┐                          │
│              │ Committed Block          │                          │
│              │ (BFT consensus achieved) │                          │
│              └───────────▲──────────────┘                          │
│                          │                                          │
└──────────────────────────╪──────────────────────────────────────────┘
                           │ Anchor to PoW chain
┌──────────────────────────▼──────────────────────────────────────────┐
│              LAYER 1: PROOF OF WORK TRUST ANCHOR                    │
│     (Immutable Ordering via Bitcoin-compatible Mining)              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Mining Process (2-Minute Block Time)                      │   │
│  │                                                            │   │
│  │  Miner Behavior:                                           │   │
│  │  ├─ Collect recent transactions                           │   │
│  │  ├─ Collect recent BFT consensus blocks                   │   │
│  │  ├─ Create candidate block                                │   │
│  │  ├─ Solve RandomX puzzle:                                 │   │
│  │  │  ├─ Compute: RandomX(blockHeader + nonce)              │   │
│  │  │  ├─ Check: SHA256(RandomX result) < difficulty         │   │
│  │  │  └─ Repeat until valid                                 │   │
│  │  ├─ Broadcast valid block                                 │   │
│  │  ├─ Earn 10 ALPHA block reward                            │   │
│  │  └─ Next block in ~2 minutes (ASERT adjustment)           │   │
│  │                                                            │   │
│  │  Single-Input Transaction Model:                           │   │
│  │  ├─ Each transaction: 1 input, N outputs                  │   │
│  │  ├─ Enables: Coin sub-ledger extraction                   │   │
│  │  ├─ Benefit: Users maintain own UTXO set                  │   │
│  │  └─ Advantage: Local verifiability                        │   │
│  │                                                            │   │
│  │  Immutable Ledger:                                         │   │
│  │  ├─ Each block contains previous block hash               │   │
│  │  ├─ Forms cryptographic chain                             │   │
│  │  ├─ Rewriting history requires 51% attack                 │   │
│  │  ├─ RandomX makes ASICs uneconomical                      │   │
│  │  └─ CPU mining keeps network decentralized                │   │
│  │                                                            │   │
│  │  Difficulty Adjustment (ASERT):                            │   │
│  │  ├─ Target: 2-minute block time                           │   │
│  │  ├─ Adjustment: Every block (responsive)                  │   │
│  │  ├─ Half-life: 12 hours                                   │   │
│  │  └─ Prevents sudden difficulty spikes                     │   │
│  └────────────────────────────────────────────────────────────┘   │
│                          │                                          │
│              ┌───────────▼──────────────┐                          │
│              │ Immutable PoW Blockchain │                          │
│              │ (Ultimate Security)      │                          │
│              └──────────────────────────┘                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Simplified Stack Overview

```
     ┌─────────────────────────────────┐
     │  5. Agent Execution (Off-Chain) │ ← Turing-complete computation
     │     Verifiable Autonomous       │
     │     Agents                      │
     └──────────────┬──────────────────┘
                    │
     ┌──────────────▼──────────────────┐
     │  4. State Transitions (Off-Chain)│ ← Token lifecycle
     │     Tokens & Ownership          │
     │     Predicates                  │
     └──────────────┬──────────────────┘
                    │
     ┌──────────────▼──────────────────┐
     │  3. Proof Aggregation (SMT)     │ ← Trustless verification
     │     Merkle Trees & Proofs       │
     │     1-second batching           │
     └──────────────┬──────────────────┘
                    │
     ┌──────────────▼──────────────────┐
     │  2. BFT Consensus               │ ← Fast finality (1 sec)
     │     Byzantine Fault Tolerance   │
     │     Partitioned architecture    │
     └──────────────┬──────────────────┘
                    │
     ┌──────────────▼──────────────────┐
     │  1. Proof of Work (PoW)         │ ← Ultimate security
     │     RandomX mining              │
     │     2-minute blocks             │
     └─────────────────────────────────┘
```

---

## Token Lifecycle

### Detailed Token Journey

```
┌──────────────────────────────────────────────────────────────────────┐
│                         TOKEN MINTING FLOW                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  User/Agent Action:  "Mint 100 tokens"                              │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 1: Create Signing Service                             │   │
│  │  ├─ Input: User secret (private key)                       │   │
│  │  ├─ Input: Optional nonce (for masked address)             │   │
│  │  └─ Output: Signer with public key                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 2: Generate Predicate                                  │   │
│  │  ├─ Type 1: Unmasked (transparent)                          │   │
│  │  │  └─ Predicate = SHA256(publicKey)                        │   │
│  │  │     ├─ Benefit: Transparent ownership                    │   │
│  │  │     └─ Privacy: None                                     │   │
│  │  │                                                          │   │
│  │  └─ Type 2: Masked (privacy-preserving)                     │   │
│  │     └─ Predicate = SHA256(publicKey || nonce)               │   │
│  │        ├─ Benefit: Identity hidden                          │   │
│  │        └─ Privacy: High                                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 3: Derive Address                                      │   │
│  │  ├─ Input: Predicate hash                                   │   │
│  │  ├─ Computation: Address = Encode(predicate)                │   │
│  │  └─ Format: Bech32 with prefix (alpha1/custom)              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 4: Create Mint Transaction                             │   │
│  │  ├─ Recipient: Derived address                              │   │
│  │  ├─ Amount: 100 tokens                                      │   │
│  │  ├─ Token Type: FUNGIBLE | UNIQUE                           │   │
│  │  ├─ Initial State: {amount, metadata, ...}                  │   │
│  │  ├─ Signature: Sign(stateHash) with private key             │   │
│  │  └─ Package: {state, signature, predicate, history=[]}      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 5: Submit to Aggregator                                │   │
│  │  ├─ Request: {requestId, stateHash, signature, data}        │   │
│  │  ├─ requestId = SHA256(publicKey || stateHash)              │   │
│  │  │                                                          │   │
│  │  │ Aggregator validates:                                    │   │
│  │  ├─ ✓ Signature valid (secp256k1)                           │   │
│  │  ├─ ✓ requestId format correct                              │   │
│  │  ├─ ✓ dataHash has proper imprinting (0000 prefix)          │   │
│  │  ├─ ✓ No duplicate requestId                                │   │
│  │  └─ ✓ Queued for next block                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 6: Batching (Every 1 second)                           │   │
│  │  ├─ Aggregator collects pending commitments                 │   │
│  │  ├─ Creates block: {commitments[], merkleRoot, timestamp}    │   │
│  │  └─ Generates SMT proofs for each commitment                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 7: BFT Consensus (1-second round)                      │   │
│  │  ├─ Block proposed to validators                            │   │
│  │  ├─ Validators verify and vote                              │   │
│  │  ├─ If >2/3 votes: COMMIT (fast finality)                   │   │
│  │  └─ Status: SUBMITTED + proof available                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 8: Retrieve Inclusion Proof                            │   │
│  │  ├─ User polls aggregator: "Get proof for requestId"        │   │
│  │  ├─ Aggregator returns: {proof[], blockHeight, root}        │   │
│  │  ├─ Proof size: ~256 bytes (logarithmic in ledger)          │   │
│  │  └─ User can verify offline                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 9: PoW Anchoring (Next 2-minute block)                 │   │
│  │  ├─ Miners include BFT root hash in PoW block               │   │
│  │  ├─ Block is mined (2-minute average)                       │   │
│  │  ├─ PoW confirms BFT finality                               │   │
│  │  └─ Status: CONFIRMED (ultimate immutable finality)         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                           │
│  TOKEN CREATED: {                                                    │
│    id: requestId,                                                    │
│    owner: address (derived from predicate),                          │
│    amount: 100,                                                      │
│    predicate: unmasked | masked,                                     │
│    state: {amount, metadata, ...},                                   │
│    history: [{                                                       │
│      type: 'MINT',                                                   │
│      from: 'null',                                                   │
│      to: 'address',                                                  │
│      signature: 'sig...',                                            │
│      timestamp: now,                                                 │
│      proof: { path: [...], root, height }                            │
│    }],                                                               │
│    status: 'CONFIRMED'                                               │
│  }                                                                    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Token Transfer Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    TOKEN TRANSFER FLOW                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Owner Action: "Transfer token to recipient address"                │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 1: Verify Ownership                                    │   │
│  │  ├─ Token's current owner matches sender                    │   │
│  │  ├─ Verify owner's predicate conditions                     │   │
│  │  └─ Confirm sender has private key                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 2: Create New Predicate for Recipient                  │   │
│  │  ├─ Option 1: Recipient's public key (unmasked)             │   │
│  │  ├─ Option 2: Recipient's nonce + key (masked)              │   │
│  │  └─ New Address = Encode(new predicate)                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 3: Create State Transition                             │   │
│  │  ├─ New State: {owner: recipient, amount, updated_state}    │   │
│  │  ├─ Hash: stateHash = SHA256(newState)                      │   │
│  │  ├─ Sign: signature = Sign(stateHash) with owner's key      │   │
│  │  └─ Package: {                                              │   │
│  │      from: owner_address,                                   │   │
│  │      to: recipient_address,                                 │   │
│  │      newState: newStateData,                                │   │
│  │      signature: ownerSignature,                             │   │
│  │      timestamp: now                                          │   │
│  │    }                                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 4: Submit to Aggregator                                │   │
│  │  ├─ Same as mint: validate, batch, consensus               │   │
│  │  └─ Status: SUBMITTED (Merkle proof available)              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 5: Recipient Verification                              │   │
│  │  ├─ Obtain inclusion proof from aggregator                  │   │
│  │  ├─ Verify sender's signature (secp256k1)                   │   │
│  │  ├─ Verify predicate authorization (old owner)              │   │
│  │  ├─ Verify proof matches new state                          │   │
│  │  ├─ Trace back to Merkle root                               │   │
│  │  └─ Can verify OFFLINE (no trust required)                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Step 6: Update Token History                                │   │
│  │  ├─ Add transfer to transaction history                     │   │
│  │  ├─ Update owner to recipient                               │   │
│  │  ├─ Record proof and timestamp                              │   │
│  │  └─ Recipient now has full token proof chain                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          │                                           │
│  TRANSFER COMPLETE:                                                  │
│    - Owner verified through signature                               │
│    - Recipient can verify offline                                   │
│    - Double-spending impossible (immutable PoW anchor)              │
│    - Privacy maintained (only commitment on-chain)                  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Through Layers

### Complete Token Transfer Data Flow

```
                            AGENT LAYER
                          (Layer 5)
                               │
                  ┌────────────▼──────────────┐
                  │ Agent Creates Transfer:   │
                  │ "Send 10 tokens to Bob"   │
                  │ ├─ Parse intent (LLM)     │
                  │ ├─ Discover methods       │
                  │ ├─ Execute chain          │
                  │ └─ Create state transition│
                  └────────────┬───────────────┘
                               │
                   ┌───────────▼──────────────┐
                   │ STATE TRANSITION LAYER  │
                   │ (Layer 4)               │
                   │ ├─ Create new predicate │
                   │ ├─ Sign state hash      │
                   │ │                       │
                   │ │ Output: {             │
                   │ │   from: Alice,        │
                   │ │   to: Bob,            │
                   │ │   amount: 10,         │
                   │ │   signature: sig...,  │
                   │ │   state_hash: hash... │
                   │ │ }                     │
                   │ │                       │
                   │ └─ requestId =          │
                   │   SHA256(pk||hash)      │
                   └────────┬────────────────┘
                            │
            ┌───────────────▼──────────────────┐
            │ AGGREGATION LAYER (Layer 3)      │
            │                                  │
            │ 1 second cycle:                  │
            │ ├─ Receive commitment            │
            │ ├─ Validate secp256k1 signature  │
            │ ├─ Check requestId format        │
            │ ├─ Verify no duplicates          │
            │ ├─ Queue for batch               │
            │ │                                │
            │ │ (Every 1 second)               │
            │ ├─ Collect commitments           │
            │ ├─ Build Sparse Merkle Tree      │
            │ ├─ Compute root hash             │
            │ │                                │
            │ │ Output: {                      │
            │ │   commitments: [...],          │
            │ │   merkle_root: root,           │
            │ │   height: N,                   │
            │ │   timestamp: T                 │
            │ │ }                              │
            │ │                                │
            │ ├─ Generate SMT proof for        │
            │ │  commitment                    │
            │ └─ Store in MongoDB              │
            └────────┬─────────────────────────┘
                     │
         ┌───────────▼──────────────────────┐
         │ BFT CONSENSUS LAYER (Layer 2)    │
         │                                  │
         │ 1-second round:                  │
         │ ├─ Leader proposes block         │
         │ ├─ Validators receive            │
         │ ├─ Each validates block:         │
         │ │  ├─ Check signatures valid     │
         │ │  ├─ Check no double-spend      │
         │ │  ├─ Check ordering             │
         │ │  └─ If all OK: VOTE YES        │
         │ │                                │
         │ ├─ Leader collects votes         │
         │ ├─ If >2/3 YES: COMMIT           │
         │ │                                │
         │ │ Output: {                      │
         │ │   block: {...},                │
         │ │   commit_height: N,            │
         │ │   attestations: [sig...],      │
         │ │   timestamp: T+1sec            │
         │ │ }                              │
         │ │                                │
         │ └─ FAST FINALITY ACHIEVED        │
         │    (1-2 seconds)                │
         └────────┬─────────────────────────┘
                  │
      ┌───────────▼──────────────────────┐
      │ PROOF OF WORK LAYER (Layer 1)    │
      │                                  │
      │ Mining process:                  │
      │ ├─ Collect recent transactions   │
      │ ├─ Include BFT block root hash   │
      │ ├─ Solve RandomX puzzle:         │
      │ │  ├─ Try nonce values           │
      │ │  ├─ Compute RandomX(block)     │
      │ │  ├─ Check against difficulty   │
      │ │  └─ Repeat until valid (~2min) │
      │ │                                │
      │ ├─ Broadcast mined block         │
      │ │                                │
      │ │ Output: {                      │
      │ │   height: N,                   │
      │ │   prev_hash: ...,              │
      │ │   bft_root: ...,               │
      │ │   merkle_root: ...,            │
      │ │   nonce: proof_of_work,        │
      │ │   timestamp: T+~2min           │
      │ │ }                              │
      │ │                                │
      │ └─ ULTIMATE FINALITY ANCHORED    │
      │    (Immutable ordering)          │
      └────────┬─────────────────────────┘
               │
      RESULT: Transfer complete
      ├─ Fast finality: 1-2 seconds (BFT)
      ├─ Ultimate finality: 2-10 minutes (PoW)
      ├─ Privacy: Commitment only on-chain
      ├─ Verification: Offline possible with proof
      └─ Security: Immutable PoW anchor
```

---

## Comparison with Traditional Blockchains

### Traditional Blockchain Flow

```
User Transaction
        │
        ▼ (Wait for broadcast)
  [Network Gossip]
  Mempool (seconds)
        │
        ▼ (Compete with others)
  [Consensus/Execution]
  On-chain processing
  (minutes)
        │
        ▼ (Cost proportional)
  [Block Finality]
  Pay gas for every byte
        │
        ▼
  Result: Slow, Expensive, Congested

Bottleneck: Shared blockchain resources
```

### Unicity Network Flow

```
User/Agent Transaction
        │
        ▼ (Instant)
  [Off-Chain Execution]
  Agent processes (milliseconds)
        │
        ▼ (Non-competitive)
  [State Transition Creation]
  Creates commitment (milliseconds)
        │
        ▼ (Batched)
  [Aggregation]
  1-second batch interval
        │
        ▼ (Byzantine agreement)
  [BFT Consensus]
  Fast finality (1-2 seconds)
        │
        ▼ (Immutable anchor)
  [PoW Anchoring]
  Ultimate security (2-10 minutes)
        │
        ▼
  Result: Fast, Cheap, Scalable

Key Difference: Parallel execution (no contention)
```

### Throughput Comparison

```
                    THROUGHPUT (transactions/second)
Bitcoin             ├─ 7 tx/sec
Ethereum            ├─ 15 tx/sec
                    │
                    │  TRADITIONAL BLOCKCHAINS BOTTLENECK HERE
                    │  (All execution competes for block space)
                    │
                    ├─────────────────────────────────────────
                    │
Unicity Network     ├─ Millions of commitments/block
                    │  (Depends on hardware, not consensus)
                    │
                    │  OFF-CHAIN EXECUTION SCALES HORIZONTALLY
```

### Latency Comparison

```
                    FINALITY TIME
Bitcoin             ├─ 10 minutes (1 block) to 60 min (6 blocks)
Ethereum            ├─ 15 seconds (1 block) to 2 minutes (12 blocks)
                    │
                    │  TRADITIONAL BLOCKCHAINS: WAIT FOR BLOCKS
                    │
                    ├─────────────────────────────────────────
                    │
Unicity Network     ├─ 1-2 seconds (BFT - fast finality)
                    ├─ 2-10 minutes (PoW - ultimate finality)
                    │
                    │  OFF-CHAIN: INSTANT EXECUTION
                    │  ON-CHAIN: SECURITY ANCHORING ONLY
```

### Cost Comparison

```
                    AVERAGE TRANSACTION COST
Bitcoin             ├─ $1-20+ (block space auction)
Ethereum            ├─ $0.50-50+ (gas market)
Layer 2             ├─ $0.01-0.10 (compression benefits)
                    │
                    │  TRADITIONAL: COST = BLOCK SPACE SCARCITY
                    │
                    ├─────────────────────────────────────────
                    │
Unicity Network     ├─ Near-zero (off-chain aggregation)
                    │  (Only commitment hash on-chain)
                    │
                    │  COST = INFRASTRUCTURE MAINTENANCE
                    │  (Not proportional to computation)
```

---

## Security Model Layers

### Five-Layer Defense Strategy

```
╔═════════════════════════════════════════════════════════════╗
║              LAYER 5: VERIFIABLE COMPUTATION                ║
║                                                             ║
║  Defense: Type-safe execution, ACID state, audit trail     ║
║  Threat Model: Logic errors, state corruption              ║
║  Mitigation:                                                ║
║    ├─ Type system prevents undefined behavior               ║
║    ├─ ACID transactions ensure consistency                  ║
║    ├─ Ledger maintains precise decimal arithmetic           ║
║    └─ Results cryptographically signable                    ║
╠═════════════════════════════════════════════════════════════╣
║              LAYER 4: CRYPTOGRAPHIC OWNERSHIP                ║
║                                                             ║
║  Defense: secp256k1 ECDSA signatures + predicates           ║
║  Threat Model: Unauthorized transfer, impersonation         ║
║  Mitigation:                                                ║
║    ├─ Signature proves private key possession               ║
║    ├─ Forgery cryptographically impossible                  ║
║    ├─ Masked predicates hide identity                       ║
║    └─ Custom predicates enable complex rules                ║
╠═════════════════════════════════════════════════════════════╣
║           LAYER 3: PROOF VERIFICATION (SMT)                 ║
║                                                             ║
║  Defense: Merkle proofs + non-deletion proofs               ║
║  Threat Model: False history, censorship                    ║
║  Mitigation:                                                ║
║    ├─ Inclusion proofs prevent false claims                 ║
║    ├─ Non-deletion proofs prevent censorship                ║
║    ├─ Logarithmic proof size enables offline verification   ║
║    └─ Optional ZK proofs hide commitment details            ║
╠═════════════════════════════════════════════════════════════╣
║        LAYER 2: BYZANTINE FAULT TOLERANCE (BFT)             ║
║                                                             ║
║  Defense: Consensus despite <1/3 faulty validators          ║
║  Threat Model: Malicious validators, network partition      ║
║  Mitigation:                                                ║
║    ├─ Quorum requirement (>2/3) prevents equivocation       ║
║    ├─ Safety: Conflicting blocks impossible                 ║
║    ├─ Liveness: Honest validators ensure progress           ║
║    └─ Partitioned design provides fault isolation           ║
╠═════════════════════════════════════════════════════════════╣
║      LAYER 1: PROOF OF WORK (IMMUTABLE ORDERING)             ║
║                                                             ║
║  Defense: Computational difficulty prevents reordering      ║
║  Threat Model: 51% attack, transaction reordering           ║
║  Mitigation:                                                ║
║    ├─ RandomX requires computational work                   ║
║    ├─ ASIC-resistant (CPU mining decentralized)             ║
║    ├─ Rewriting history: 51% + all future blocks            ║
║    └─ Each block references previous (cryptographic chain)  ║
╚═════════════════════════════════════════════════════════════╝
```

### Attack Resilience Matrix

```
                        ATTACK TYPE           LAYER DEFENSE
Double-spending         ├─ Immutable proof                      L1 + L3
Censorship              ├─ Non-deletion proofs                  L3
Impersonation           ├─ Signature verification               L4
False history           ├─ Merkle proofs                        L3
Reordering              ├─ PoW immutability                     L1
Validator collusion      ├─ 2/3 quorum requirement              L2
Logic errors            ├─ Type system                          L5
State corruption        ├─ ACID transactions                    L5
Byzantine attack        ├─ BFT consensus                        L2
Sybil attack            ├─ Mining PoW or stake                  L1/L2
51% attack              ├─ PoW difficulty                       L1
Network partition       ├─ Quorum-based safety                  L2
Privacy breach          ├─ Commitment encryption                L3/L4
Proof forgery          ├─ Cryptographic binding                L3
```

---

## Finality Timeline

### Complete Finality Flow

```
TIME    ACTIVITY                            STATUS
────────────────────────────────────────────────────────────────

T+0s    User submits state transition      Pending
        to aggregator

T+1s    ├─ Aggregator batches commitment   1-second batch cycle
        ├─ Creates Sparse Merkle Tree      complete
        ├─ Generates inclusion proof
        ├─ Submits to BFT consensus
        └─ BFT reaches >2/3 agreement      ✓ FAST FINALITY
                                            (1-2 seconds)

T+2s    ├─ Miners begin working on PoW
        │  block containing BFT root
        ├─ Other blocks continue
        └─ Average: 2-minute block time    In progress

T+30s   ├─ Miners approach difficulty      (Varies based on
T+60s   │  solution                        hardware & network)
T+90s   │
T+120s  ├─ Miner finds valid nonce
        ├─ Block broadcasts to network     ✓ ULTIMATE FINALITY
        ├─ Network validates block         (Immutable ordering)
        ├─ Block added to blockchain
        └─ Commitment anchored to PoW      Confirmed

T+180s  ├─ Second PoW block (optional)     ✓ DEEP CONFIRMATION
        └─ High security against reorg     Ultra-safe
```

### Dual Finality Model

```
FAST FINALITY (1-2 seconds):
├─ Achieved through: BFT consensus
├─ Safety: <1/3 validators faulty
├─ Use cases: Most applications (fast enough)
├─ Risk: Minimal (BFT Byzantine tolerance)
└─ Finality: Sufficient for most purposes

              vs.

ULTIMATE FINALITY (2-10 minutes):
├─ Achieved through: PoW anchoring to immutable chain
├─ Safety: Requires 51% attack + all future blocks
├─ Use cases: Critical/irreversible operations
├─ Risk: Negligible (cryptographic impossibility)
└─ Finality: Absolute (immutable PoW ordering)

UNICITY APPROACH: Provide both!
├─ Users choose based on risk tolerance
├─ Fast: Good enough for most (1-2 seconds)
├─ Ultimate: Available if needed (2-10 minutes)
└─ Customers pick finality level per transaction
```

---

## Repository Dependency Graph

### Component Dependencies

```
                          Layer 1 (PoW)
                              │
                 ┌────────────┼────────────┐
                 │            │            │
             alpha         alpha-      unicity-
            (C++)          miner       mining-
            PoW            (C)         core
            node           Mining      (C#)
                           software    Pool

                              │
                ┌─────────────┴─────────────┐
                │                           │
            VALIDATION                   MINING
                │                           │
                └─────────────┬─────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Layer 2 (BFT)     │
                    │                    │
                    ├─ bft-core          │
                    │  (Go)              │
                    │  Consensus         │
                    │  engine            │
                    │                    │
                    ├─ bft-go-base       │
                    │  (Go)              │
                    │  Foundation        │
                    │  library           │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────────┐
                    │  Layer 3 (Aggregation) │
                    │                        │
                    ├─ aggregator-go         │
                    │  (Go)                  │
                    │  SMT Proofs            │
                    │  Batching              │
                    │                        │
                    ├─ aggregators_net       │
                    │  (TS, archived)        │
                    │  REST APIs             │
                    │                        │
                    ├─ aggregator-infra      │
                    │  (Shell)               │
                    │  Deployment            │
                    │                        │
                    └─────────┬──────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
    ┌───────▼─────────┐  ┌────▼─────────┐  ┌──▼──────────┐
    │  Layer 4        │  │   Storage    │  │  Layer 2    │
    │  (Tokens)       │  │              │  │  Part 2     │
    │                 │  │ MongoDB      │  │             │
    ├─ state-        │  │ (Proof)      │  │ aggregator- │
    │  transition-sdk│  │              │  │ subscription│
    │  (TS)          │  └──────────────┘  │ (Java)      │
    │                 │                   │             │
    ├─ java-        │                   └─────────────┘
    │  state-       │
    │  transition-sdk│
    │  (Java)        │
    │                 │
    ├─ commons       │
    │  (TS, archived)│
    │  Crypto utils  │
    │                 │
    └────────┬────────┘
             │
      ┌──────▼────────────┐
      │  Layer 5 (Agents) │
      │                   │
      ├─ unicity-         │
      │  agentic-demo     │
      │  (Rust)           │
      │  Neurosymbolic    │
      │  Agent framework  │
      │                   │
      ├─ SurrealDB        │
      │  (In-memory)      │
      │  State storage    │
      │                   │
      └───────────────────┘

SHARED ACROSS LAYERS:
├─ whitepaper (TeX)          - Architecture documentation
├─ specs (Markdown)          - Technical specifications
├─ Unicity-Explorer (Web)    - Block explorer
├─ guiwallet (HTML/JS)       - Web wallet
└─ unyx-wallet (Kotlin)      - Mobile wallet
```

---

## Component Interaction Matrix

### Inter-Layer Communication

```
SENDER → RECEIVER               PROTOCOL        DATA
──────────────────────────────────────────────────────────────

Agent → State SDK              In-process      StateTransition
State SDK → Aggregator         REST/gRPC       Commitment
Aggregator → BFT               Internal         Block
BFT → Aggregator               Internal        Commit
Aggregator → MongoDB           Database        Proofs/Block
MongoDB → Client              REST API        InclusionProof
PoW Node → BFT Leader          Network        BFT block root
BFT → PoW Node                Network        State root hash
Miner → Network                P2P            PoW block
Client → Aggregator            REST           GetProof request
Agent → Token SDK              In-process      MintRequest
State SDK → Agent              In-process      ProofResult
Wallet → PoW Node              JSON-RPC       UTXO query
Wallet → Aggregator            REST            Token status
```

### Data Format Standards

```
LAYER 1 (PoW)
  ├─ Transaction: Single-input, multiple outputs
  ├─ Block: Header + transactions + BFT root
  └─ Network: P2P gossip (Bitcoin-compatible)

LAYER 2 (BFT)
  ├─ Proposal: Block + proposer signature
  ├─ Vote: Signature on block hash
  └─ Network: Direct validator-to-validator

LAYER 3 (Aggregation)
  ├─ Commitment: {requestId, stateHash, signature, data}
  ├─ Proof: {path[], merkleRoot, blockHeight}
  └─ Storage: MongoDB (structured + indexed)

LAYER 4 (Tokens)
  ├─ Token: {id, state, predicate, history[], status}
  ├─ Predicate: SHA256(publicKey [|| nonce])
  └─ Signature: secp256k1 ECDSA

LAYER 5 (Agents)
  ├─ Method: {name, inputs[], outputs[], semantic_tags[]}
  ├─ Execution: Type-safe method chains
  └─ State: SurrealDB transactions (ACID)

CROSS-LAYER
  ├─ Addresses: Bech32-encoded predicate hashes
  ├─ Hashes: SHA256 (32 bytes, hex-encoded)
  └─ Signatures: secp256k1 DER + recovery byte
```

---

## Conclusion

These visual diagrams and ASCII representations provide quick reference guides to understand Unicity Network's architecture at various levels of abstraction:

- **High-level:** Five-layer stack with responsibilities
- **Medium-level:** Token lifecycle and data flows
- **Detailed:** Security model, finality guarantees, dependencies
- **Comparative:** How Unicity differs from traditional blockchains

Use these diagrams when:
- Teaching Unicity concepts to others
- Designing new components
- Explaining to stakeholders
- Debugging complex interactions
- Planning integrations

*For more detailed information, refer to the comprehensive architecture report and expert agent profile documents.*
