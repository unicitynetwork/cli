# Unicity Consensus Implementation Guide
## Technical Deep Dive for Consensus Experts

---

## Table of Contents

1. [PoW Implementation Details](#pow-implementation-details)
2. [BFT Implementation Details](#bft-implementation-details)
3. [Integration Architecture](#integration-architecture)
4. [Performance Tuning](#performance-tuning)
5. [Deployment Patterns](#deployment-patterns)
6. [Monitoring and Observability](#monitoring-and-observability)
7. [Advanced Topics](#advanced-topics)

---

## PoW Implementation Details

### Alpha Node Architecture (C++)

#### Core Components

```cpp
// Block structure in Alpha
struct Block {
    // Standard Bitcoin fields
    int32_t nVersion;
    uint256 hashPrevBlock;
    uint256 hashMerkleRoot;
    uint32_t nTime;
    uint32_t nBits;          // Difficulty target
    uint32_t nNonce;

    // Alpha-specific: RandomX hash
    uint256 randomXHash;     // 32-byte RandomX proof
};

// Extended header (112 bytes vs Bitcoin's 80 bytes)
// Layout: [80 bytes standard] + [32 bytes RandomX]
```

#### Mining Process

```
Mining Algorithm Flow:

1. Get block template from node
   └─ Includes recent transactions
   └─ Sets difficulty target (nBits)
   └─ Provides block height

2. Create candidates (vary nonce/randomX)
   └─ Keep header constant
   └─ Vary RandomX nonce space (huge)
   └─ Try to find hash < target

3. RandomX Proof Generation
   ├─ Initialize RandomX VM
   ├─ Seed from epoch/difficulty
   ├─ Execute random program
   ├─ Hash result with SHA256
   └─ Check if meets difficulty

4. Validate block
   └─ All transactions valid
   └─ Proof-of-work valid
   └─ Within difficulty target

5. Broadcast to network
   └─ P2P propagation
   └─ Node validation
   └─ Mempool update

6. Receive block reward
   └─ 10 ALPHA per valid block
   └─ Miner address in coinbase
```

#### ASERT Difficulty Adjustment

```cpp
// ASERT formula (simplified)
uint32_t calculateASERTDifficulty(
    uint32_t currentTarget,
    uint64_t currentTime,
    uint64_t previousTime,
    uint32_t blockHeight
) {
    // Time since last block
    int64_t timeDiff = currentTime - previousTime;

    // Exponential adjustment
    // Target: 2 minutes (120 seconds)
    // Half-life: 12 hours (43200 seconds)
    double halfLives = (double)(timeDiff - 120) / 43200;

    // Calculate new difficulty
    // Increases exponentially if blocks too fast
    // Decreases exponentially if blocks too slow
    double adjustment = pow(2.0, halfLives);

    uint32_t newTarget = (uint32_t)(currentTarget * adjustment);
    return newTarget;
}

// Key properties:
// - Adjusts after EVERY block (not every 2016)
// - Smooth convergence to target block time
// - Resistant to hash rate jumps
// - Maintains ~2 minute average
```

#### Single-Input Transaction Model

```cpp
// Transaction validation
bool validateTransaction(const Transaction& tx) {
    // Unicity-specific: exactly ONE input
    if (tx.inputs.size() != 1) {
        return false;  // Reject multi-input
    }

    // Standard validation
    ├─ Check input exists (UTXO)
    ├─ Verify signature
    ├─ Check value balance
    ├─ Verify no double-spend
    └─ Check sequence/locktime

    return true;
}

// Rationale:
// - Enables local verifiability
// - Aligns with off-chain execution model
// - Reduces consensus layer burden
// - Transactions processed off-chain in agents
```

### Mining Implementation

#### alpha-miner Architecture

```
Mining Software Flow:

┌─ Connection Management
│  ├─ RPC to Alpha node (solo)
│  │  └─ getblocktemplate RPC call
│  └─ Stratum V1 to pool
│     └─ Mining.notify protocol
│
├─ RandomX VM Pool
│  ├─ Thread-safe access
│  ├─ Lazy initialization
│  ├─ Realm isolation between threads
│  └─ ~256MB-3GB per thread
│
├─ Mining Loop
│  ├─ 1. Get work (template + difficulty)
│  ├─ 2. Create block candidates
│  ├─ 3. Initialize RandomX VM
│  ├─ 4. Hash with RandomX
│  ├─ 5. Check if meets target
│  ├─ 6. If found: submit block/share
│  └─ 7. Loop until new work
│
├─ Large Page Optimization
│  ├─ Request 2MB pages from OS
│  ├─ Improves RandomX cache performance
│  ├─ ~2x hashrate improvement
│  └─ Optional but recommended
│
└─ Share Submission
   ├─ To node: Full block (eligible for reward)
   └─ To pool: Share proof (partial credit)
```

#### Performance Tuning

```bash
# Large pages setup (Linux)
echo 512 > /proc/sys/vm/nr_hugepages  # Allocate 1GB
cat /proc/meminfo | grep HugePages

# Thread optimization
# For 16-core CPU: Use 14-15 threads (leave 1-2 for OS)
./alphaminer --threads 14 --url ...

# Memory optimization
# RandomX: 2.8GB per thread is standard
# For 8 threads: Need ~24GB RAM total
# Calculation: 2.8GB × threads + system overhead

# CPU affinity (pin threads to cores for cache)
# Linux: taskset -c 0-13 ./alphaminer ...
# Windows: Set CPU affinity in Task Manager
```

### Mining Pool Implementation

#### unicity-mining-core Architecture (C#/.NET)

```
Pool Server Components:

┌─ Stratum Server (Port 3333)
│  ├─ Accepts miner connections
│  ├─ Sends work (block template + difficulty)
│  ├─ Receives share submissions
│  ├─ Adjusts per-miner difficulty
│  └─ Broadcasts block notifications
│
├─ PostgreSQL Database
│  ├─ Miner accounts (shares tracking)
│  ├─ Share records (for payout calculation)
│  ├─ Block records (found blocks)
│  ├─ Pool statistics
│  └─ Configuration
│
├─ Block Manager
│  ├─ Gets templates from Alpha node
│  ├─ Sends to Stratum clients
│  ├─ Validates block submissions
│  ├─ Tracks pool hashrate
│  └─ Manages block rewards
│
├─ Difficulty Manager
│  ├─ Tracks miner shares
│  ├─ Adjusts difficulty per miner
│  │  └─ Target: 1 share every ~30 seconds
│  ├─ Prevents share variance extremes
│  └─ Updates in real-time
│
├─ REST API (Port 4000)
│  ├─ Miner stats: (minerID) -> {shares, hashrate, balance}
│  ├─ Pool stats: {totalHashrate, blocks, difficulty}
│  ├─ Admin endpoints: management/config
│  └─ JSON-RPC: Standard pool interface
│
└─ Payment Processor (Separate Machine)
   ├─ Runs independently (security isolation)
   ├─ Queries database for payout amounts
   ├─ Builds transactions to Alpha node
   ├─ Manages wallet (private keys)
   ├─ Broadcasts transactions
   └─ Records payment proofs
```

#### Stratum V1 Protocol Implementation

```
Stratum Message Flow:

Client → Server:
{
  "id": 1,
  "method": "mining.subscribe",
  "params": ["alphaminer/1.0", "extranonce1"]
}

Server → Client:
{
  "id": 1,
  "result": [["mining.notify", "subscription_id"],
             "extranonce1", extranonce2_size],
  "error": null
}

Server → Client (New Work):
{
  "id": null,
  "method": "mining.notify",
  "params": [
    "job_id",
    "prevhash",
    "coinb1",
    "coinb2",
    ["merkle_branch"],
    "version",
    "nbits",
    "ntime",
    clean_jobs
  ]
}

Client → Server (Share):
{
  "id": 2,
  "method": "mining.submit",
  "params": [
    "username",
    "job_id",
    "extranonce2",
    "ntime",
    "nonce"
  ]
}

Server → Client (Result):
{
  "id": 2,
  "result": true,      # or false if rejected
  "error": null        # or error description
}
```

#### Difficulty Adjustment in Pool

```csharp
// Difficulty management in mining pool
public class DifficultyManager
{
    // Per-miner difficulty adjustment
    // Target: 1 share every 30 seconds (reasonable variance)

    private double CalculateNewDifficulty(
        Miner miner,
        int sharesInWindow,
        TimeSpan timeWindow
    ) {
        // Current difficulty
        double currentDifficulty = miner.Difficulty;

        // Target shares per window
        int targetShares = (int)(timeWindow.TotalSeconds / 30);

        // Actual vs target ratio
        double ratio = (double)sharesInWindow / targetShares;

        // Smooth exponential adjustment
        // Too many shares (>1.5x target): increase difficulty
        // Too few shares (<0.67x target): decrease difficulty
        double newDifficulty = currentDifficulty * ratio;

        // Bounds: Prevent wild swings
        newDifficulty = Math.Max(1, newDifficulty);      // Minimum 1
        newDifficulty = Math.Min(1000000, newDifficulty); // Maximum 1M

        return newDifficulty;
    }

    // Pool maintains accurate difficulty matching
    // Network difficulty increases → Pool difficulty increases
    // Prevents share floods/droughts
}
```

---

## BFT Implementation Details

### bft-core Architecture (Go)

#### Consensus Protocol

```go
// BFT Consensus Round
type ConsensusRound struct {
    Height    int64
    Round     int32
    StartTime time.Time

    // Voting state
    Proposal     *Block
    Prevotes     map[ValidatorID]Vote
    Precommits   map[ValidatorID]Vote

    // Timeouts
    ProposalTimeout  time.Duration  // Time to wait for proposal
    PrevoteTimeout   time.Duration  // Time to wait for prevotes
    PrecommitTimeout time.Duration  // Time to wait for precommits
}

// Single Round Timeline
func (r *ConsensusRound) Execute() error {
    // Step 1: Propose
    if r.isProposer() {
        proposal := r.createProposal()
        r.broadcastProposal(proposal)
    }

    // Step 2: Wait for proposal + prevote
    r.gatherPrevotes()
    if r.hasPrevoteMajority() {
        r.broadcastPrevote()
    }

    // Step 3: Wait for precommit
    r.gatherPrecommits()
    if r.hasPrecommitMajority() {
        r.commitBlock()
        return nil
    }

    // Timeout handling
    return r.handleRoundTimeout()
}
```

#### Validator Network Communication

```go
// Network message types
type Message interface {
    Type() MessageType
    Height() int64
    Round() int32
    ValidatorID() string
}

type ProposalMsg struct {
    Height    int64
    Round     int32
    Block     *Block
    Signature []byte
}

type VoteMsg struct {
    Height    int64
    Round     int32
    BlockID   BlockID
    ValidatorID string
    VoteType  VoteType  // PREVOTE or PRECOMMIT
    Signature []byte
}

// Gossip network protocol
func (v *Validator) broadcastMessage(msg Message) {
    // Send to all other validators
    for _, peer := range v.peers {
        go v.sendToPeer(peer, msg)
    }

    // Also store locally
    v.messageLog.Add(msg)
}

// Receive and validate
func (v *Validator) onReceiveMessage(msg Message) error {
    // 1. Verify signature
    if !msg.VerifySignature() {
        return ErrInvalidSignature
    }

    // 2. Check height/round relevance
    if msg.Height() < v.currentHeight {
        return ErrStaleMessage
    }

    // 3. Apply to consensus state
    return v.applyMessage(msg)
}
```

#### Partition System

```go
// Partition types
type Partition interface {
    ID() int32
    Name() string
    Type() PartitionType  // MONEY or TOKEN
    ValidateTransaction(tx Transaction) error
    ApplyBlock(block *Block) error
}

// Money Partition (primary)
type MoneyPartition struct {
    validators ValidatorSet
    ledger     StateLedger  // Account balances

    // Required: tracks native currency
}

// Token Partition (optional)
type TokenPartition struct {
    validators ValidatorSet
    ledger     StateLedger  // Token balances

    // Dependency: Uses Money partition for fees
    moneyPartition MoneyPartition
}

// Partitioned consensus
func (r *ConsensusRound) executePartitioned() error {
    // Money partition consensus
    if err := r.moneyPartition.Validate(); err != nil {
        return err
    }

    // Token partition consensus (if present)
    if r.hasTokenPartition {
        if err := r.tokenPartition.Validate(); err != nil {
            return err
        }
    }

    // Root chain coordination
    return r.rootChain.CommitRoots()
}
```

#### State Management

```go
// Ledger state for validator
type StateLedger struct {
    // Key-value store (RocksDB typical)
    accounts  map[AccountID]*AccountState
    nonces    map[AccountID]uint64  // Anti-replay
    balances  map[AccountID]uint64

    // Merkle tree for commitments
    merkleTree *SparseTree
}

type AccountState struct {
    ID       AccountID
    Nonce    uint64
    Balance  uint64

    // Additional fields per partition
    // (defined by partition logic)
}

// State transitions
func (l *StateLedger) ApplyTransaction(tx Transaction) error {
    // Atomic update
    l.mu.Lock()
    defer l.mu.Unlock()

    // 1. Check nonce (anti-replay)
    account := l.accounts[tx.From]
    if tx.Nonce != account.Nonce {
        return ErrInvalidNonce
    }

    // 2. Verify balance
    if tx.Amount > account.Balance {
        return ErrInsufficientBalance
    }

    // 3. Apply transfer
    l.accounts[tx.From].Balance -= tx.Amount
    l.accounts[tx.To].Balance += tx.Amount
    l.accounts[tx.From].Nonce++

    // 4. Update Merkle root
    return l.updateMerkleRoot()
}
```

### BFT Protocol Security

#### Byzantine Fault Tolerance Proof

```
Safety Property (Agreement):

Theorem: If <⅓ validators are Byzantine,
all honest validators will commit the same block.

Proof:
1. Assume two different blocks at same height
2. Block A: Prevote majority ≥⅔ validators
3. Block B: Prevote majority ≥⅔ validators
4. Combined: ≥⅔ + ⅔ = ⅘ validators
5. But total validators = ⅓ + ⅔ = 1
6. ⅘ > 1, contradiction!
7. Therefore impossible: exactly one block prevoted

Liveness Property (Progress):

Assumption: Network is synchronous
           <⅓ validators are Byzantine

Guarantee: System will eventually commit a block

Proof:
1. If proposal is delayed, timeout after 1s
2. Leader change selects new proposer
3. Honest proposer will be selected
4. Honest proposer broadcasts block
5. All honest validators (⅔) receive
6. ⅔ prevote → ⅔ precommit → commit
7. QED
```

#### Liveness Conditions

```
Liveness Requirements:

1. Synchronous Network:
   ├─ All messages delivered within timeout
   ├─ Default: 1000ms per round
   └─ Verified by: Message arrival time logs

2. Validator Availability:
   ├─ At least ⅔ validators must be online
   ├─ If >⅓ crash: System halts
   └─ Recovery: Validators rejoin, consensus resumes

3. No Partitions:
   ├─ Network must be connected
   ├─ All validators reachable
   └─ Partition detection: Grace period, then halt

Safety vs Liveness Trade-off:
├─ Can't have both if <⅔ validators
├─ Choose: Safety (won't fork) OR Liveness (will halt)
└─ Unicity chooses Safety (prevents double-spend)
```

---

## Integration Architecture

### PoW ↔ BFT Integration

#### State Root Commitment Flow

```
BFT Round (Every 1 second):
│
├─ 1. Generate state root
│     └─ Merkle tree of all state transitions
│
├─ 2. Validators sign state root
│     └─ Each validator: creates signature proof
│
├─ 3. Accumulate signatures
│     └─ Collect ⅔+ validator signatures
│
└─ 4. Create commitment transaction
      ├─ Include state root in data
      ├─ Include validator signatures
      └─ Sign with pool aggregator key

Every N rounds (typically 10 rounds = 10 seconds):
│
├─ 1. Batch state roots
│     └─ Collect multiple root commits
│
├─ 2. Create Merkle tree of commits
│     └─ Compress multiple roots into one
│
├─ 3. Create PoW transaction
│     └─ Single-input transaction to Alpha chain
│
└─ 4. Submit to mempool
      ├─ Wait for next Alpha block (2 min)
      ├─ Miner includes in block
      └─ PoW finality achieved
```

#### Architecture Diagram

```
Transaction Journey:

User Creates
State Transition
        │
        ▼
   Off-Chain
   Execution
        │
        ▼
   Aggregator
   (Collect & Batch)
        │
        ▼
   BFT Validator Network
   (1 second round)
        │
    ┌───┴────────────────────┐
    │                        │
    ▼                        ▼
BFT Finality         PoW Commitment
(1-2 seconds)        (2 minute block)
    │                        │
    ├────────────────┬───────┘
    │                │
    ▼                ▼
User Feedback    Final Settlement
("Confirmed")    ("Finalized")
```

### Cross-Layer Communication APIs

#### Agent Layer ↔ Aggregator API

```protobuf
// gRPC/REST API definitions

service AggregatorAPI {
  // Submit state transition
  rpc SubmitStateTransition(StateTransitionRequest)
    returns (SubmitResponse);

  // Check status
  rpc GetTransitionStatus(TransitionID)
    returns (TransitionStatus);

  // Get inclusion proof
  rpc GetInclusionProof(TransitionID)
    returns (InclusionProof);

  // Subscribe to updates
  rpc Subscribe(SubscriptionRequest)
    returns (stream TransitionUpdate);
}

message StateTransitionRequest {
  bytes transition_data;
  bytes signature;
  string agent_id;
}

message TransitionStatus {
  enum Status {
    SUBMITTED = 0;      // Received by aggregator
    AGGREGATED = 1;     // Batched for BFT
    BFT_PENDING = 2;    // In consensus
    BFT_CONFIRMED = 3;  // Agreed by BFT
    POW_PENDING = 4;    // Waiting for PoW
    POW_CONFIRMED = 5;  // Finalized on PoW
  }
  Status status;
  int64 timestamp;
  string merkle_root;
}
```

#### Aggregator ↔ Consensus Layer API

```protobuf
service ConsensusAPI {
  // Submit state commitment
  rpc SubmitStateCommitment(StateCommitmentRequest)
    returns (CommitmentResponse);

  // Get current consensus state
  rpc GetConsensusStatus()
    returns (ConsensusStatus);

  // Monitor consensus rounds
  rpc SubscribeToRounds(Empty)
    returns (stream RoundUpdate);
}

message StateCommitmentRequest {
  int64 round;
  bytes merkle_root;
  repeated ValidatorSignature signatures;
  repeated bytes state_transitions;
}

message ValidatorSignature {
  string validator_id;
  bytes signature;
}

message ConsensusStatus {
  int64 current_round;
  int64 current_height;
  repeated string active_validators;
  string last_committed_root;
}
```

---

## Performance Tuning

### PoW Optimization

#### CPU Optimization

```bash
# 1. NUMA configuration (for multi-socket systems)
# Check system layout
lscpu | grep NUMA
numactl -H

# Bind mining to NUMA node 0
numactl -N 0 -m 0 ./alphaminer --threads 16 ...

# 2. Frequency scaling
# Check current frequency
watch -n1 'cat /proc/cpuinfo | grep MHz'

# Disable frequency scaling for performance
echo "performance" | tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# 3. Memory bandwidth
# For best performance: maximize L3 cache usage
# Typical: 1 thread per 512KB L3
# For Ryzen 5950X (64MB L3, 16 threads): 128 threads theoretical max

# 4. Thread scaling
# Practical: Use N-1 cores (leave 1 for OS)
# For 16-core CPU: 15 threads
./alphaminer --threads 15 ...
```

#### Memory Optimization

```bash
# 1. Large pages
# Calculate needed: RandomX (2.8GB) × threads + overhead
# For 4 threads: ~12GB + 2GB = 14GB total

# Allocate huge pages
echo 7000 > /proc/sys/vm/nr_hugepages  # 14GB in 2MB pages
cat /proc/meminfo | grep HugePages

# 2. Memory pinning
# Prevent swapping
mlockall()  # OS call

# 3. Memory bandwidth tuning
# For DDR5: Check BIOS for memory profile settings
# Optimize: Enable XMP/DOCP for rated speed

# Performance impact: ~5-10% improvement
```

#### Network Optimization

```bash
# 1. RPC connection
# For mining pool: Keep persistent connection
# Reuse TCP connection (HTTP Keep-Alive)

# 2. Network latency
# Check pool latency
mtr -c 10 pool.example.com

# Acceptable latency: <100ms
# Poor latency: >500ms (causes stale shares)

# 3. Stratum protocol tuning
# Keep-alive interval: 30-60 seconds
# Difficulty adjustment: Real-time
# Share timeout: 30 seconds typical
```

### BFT Optimization

#### Consensus Round Optimization

```go
// Optimize BFT round execution
func (r *ConsensusRound) optimize() {
    // 1. Batch message processing
    // Instead of: Process each message immediately
    // Better: Buffer messages, process in batches

    // 2. Signature verification
    // Expensive operation: Can use signature aggregation
    // Future: BLS signatures (one sig for ⅔ votes)

    // 3. Proposal optimization
    // Small proposals: <100ms
    // Large proposals: Can increase timeout
    // Configure: Based on network capacity

    // 4. Network latency tuning
    // Current: 1000ms round timeout
    // Adjust based on: Network partition latency
    // P50: 50ms, P95: 100ms, P99: 200ms
    // Recommended timeout: 500-1000ms
}
```

#### Validator Network Optimization

```bash
# Network requirements
# Bandwidth: 50-100 Mbps for 20 validators
# Latency: <100ms for optimal performance
# Connections: All-to-all gossip (n×n connections)

# Optimization: Use dedicated validator network
# - Separate from public API nodes
# - Direct connections (not through routers)
# - Low-latency interconnects (same datacenter)

# Packet size: BFT messages
# - Proposal: ~1MB (block data)
# - Vote: ~200 bytes (signature)
# - Total per round: ~20MB (worst case)

# Throughput calculation:
# 20 validators × 200 bytes votes = 4KB/round
# With blocks: 1MB per round
# Per second: (1MB + 4KB) × 1 = ~1MB/s average
```

---

## Deployment Patterns

### Pattern 1: Solo Mining Node

```bash
#!/bin/bash
# setup-solo-miner.sh

# Prerequisites
apt-get install -y build-essential libcurl4-openssl-dev

# Build Alpha
git clone https://github.com/unicitynetwork/alpha.git
cd alpha
./build.sh
cd ..

# Build alpha-miner
git clone https://github.com/unicitynetwork/alpha-miner.git
cd alpha-miner
make CPU_ARCH=$(uname -m)

# Configure Alpha node
mkdir -p ~/.alpha
cat > ~/.alpha/bitcoin.conf << 'EOF'
listen=1
server=1
rpcuser=alpha
rpcpassword=$(openssl rand -base64 32)
rpcport=8332
dbcache=2000
EOF

# Start node
./alpha -daemon -datadir=~/.alpha

# Wait for sync
while [ $(./alpha-cli -rpcuser=alpha -rpcpassword=... getblockcount) -lt 1 ]; do
  sleep 10
done

# Start mining
./alpha-miner/alphaminer \
  --url http://127.0.0.1:8332 \
  --user alpha \
  --password ... \
  --threads 8 \
  --largePages 1
```

### Pattern 2: Mining Pool

```bash
#!/bin/bash
# setup-mining-pool.sh

# Prerequisites
apt-get install -y dotnet-sdk-7.0 postgresql-14

# Setup database
sudo -u postgres createdb miningpool
sudo -u postgres psql miningpool < initial.sql

# Build pool
git clone https://github.com/unicitynetwork/unicity-mining-core.git
cd unicity-mining-core
dotnet publish -c Release

# Configure pool
cat > config.json << 'JSON'
{
  "pools": [{
    "id": "alpha",
    "coin": "alpha",
    "address": "alpha1q...",
    "daemonEndpoints": [{
      "host": "127.0.0.1",
      "port": 8332,
      "auth": "user:pass"
    }],
    "stratumPort": 3333,
    "difficulty": 256
  }],
  "paymentProcessing": {
    "enabled": true,
    "minimumConfirmations": 10,
    "shareMultiplier": 0.00000001
  }
}
JSON

# Start pool
dotnet ./publish/pool.dll --config config.json

# Miners connect
# ./alphaminer --url stratum+tcp://pool-server:3333 --user wallet --password x
```

### Pattern 3: BFT Validator Network

```bash
#!/bin/bash
# setup-validator-network.sh

# Build bft-core
git clone https://github.com/unicitynetwork/bft-core.git
cd bft-core
make build GO_VERSION=1.24

# Setup 3+ validator nodes
for i in 1 2 3; do
  export UBFT_HOME="$HOME/.ubft$i"
  mkdir -p "$UBFT_HOME"

  # Generate keys
  ubft-keygen \
    --output "$UBFT_HOME/keys" \
    --name "validator$i"

  # Configure
  cat > "$UBFT_HOME/config.props" << EOF
listen.addr=0.0.0.0:$((8081 + i))
partition.id=0
partition.type=money
validators.quorum=0.67
state.dir=$UBFT_HOME/state
EOF

  # Initialize
  ubft init --home "$UBFT_HOME"

  # Create validator set (share keys)
  # In production: Use governance to add validators
done

# Start all validators
for i in 1 2 3; do
  export UBFT_HOME="$HOME/.ubft$i"
  ubft start --home "$UBFT_HOME" &
done

# Monitor
for i in 1 2 3; do
  export UBFT_HOME="$HOME/.ubft$i"
  ubft status --home "$UBFT_HOME"
done
```

---

## Monitoring and Observability

### PoW Node Monitoring

```bash
#!/bin/bash
# monitor-alpha.sh - Monitor PoW node

# Check sync status
function check_sync() {
  local info=$(alpha-cli getblockchaininfo)
  local current=$(echo $info | jq '.blocks')
  local headers=$(echo $info | jq '.headers')

  if [ "$current" -eq "$headers" ]; then
    echo "✓ Fully synced: Block $current"
  else
    echo "⏳ Syncing: $current / $headers ($(( (current * 100) / headers ))%)"
  fi
}

# Monitor mining
function monitor_mining() {
  local info=$(alpha-cli getmininginfo)
  local difficulty=$(echo $info | jq '.difficulty')
  local networkhashps=$(echo $info | jq '.networkhashps')

  echo "Network Difficulty: $difficulty"
  echo "Network Hash Rate: $networkhashps H/s"
}

# Check mempool
function check_mempool() {
  local size=$(alpha-cli getmempoolinfo | jq '.bytes')
  local count=$(alpha-cli getmempoolinfo | jq '.size')

  echo "Mempool: $count transactions, $size bytes"
}

# Main monitoring loop
while true; do
  clear
  echo "=== Alpha Node Monitor ==="
  echo "Time: $(date)"
  echo ""

  check_sync
  echo ""
  monitor_mining
  echo ""
  check_mempool

  sleep 10
done
```

### BFT Validator Monitoring

```bash
#!/bin/bash
# monitor-bft.sh - Monitor BFT validator

# Check consensus status
function check_consensus() {
  local status=$(ubft status --home $UBFT_HOME)
  local height=$(echo $status | jq '.height')
  local round=$(echo $status | jq '.round')

  echo "Height: $height, Round: $round"
}

# Check validator participation
function check_participation() {
  local metrics=$(ubft metrics --home $UBFT_HOME)

  echo "Prevote Rate: $(echo $metrics | jq '.prevote_count')"
  echo "Precommit Rate: $(echo $metrics | jq '.precommit_count')"
}

# Check peers
function check_peers() {
  local peers=$(ubft peers --home $UBFT_HOME | jq 'length')
  echo "Connected Peers: $peers"
}

# Monitor round latency
function monitor_latency() {
  local logs=$(tail -100 $UBFT_HOME/ubft.log)

  # Extract round times
  echo $logs | grep "round completed" | tail -5
}

# Main loop
while true; do
  clear
  echo "=== BFT Validator Monitor ==="
  echo "Time: $(date)"
  echo ""

  check_consensus
  check_participation
  check_peers
  echo ""
  monitor_latency

  sleep 5
done
```

### OpenTelemetry Integration

```yaml
# observability-config.yaml - OpenTelemetry setup

observability:
  # Distributed tracing
  tracing:
    enabled: true
    exporter: otlptracehttp
    endpoint: http://localhost:4318

    # Sampling
    sampler:
      type: traceidratio
      arg: 0.1  # 10% sampling

    # Attributes
    resource:
      service.name: "unicity-validator"
      service.version: "1.0.0"
      deployment.environment: "production"

  # Metrics
  metrics:
    enabled: true
    exporter: prometheus
    endpoint: 0.0.0.0:9090
    interval: 30s

    # Key metrics
    instruments:
      - consensus.round.duration
      - consensus.block.size
      - network.message.latency
      - state.commit.time

  # Logging
  logging:
    level: INFO
    format: json
    outputs:
      - stdout
      - file:///var/log/unicity/validator.log
```

---

## Advanced Topics

### Cryptographic Security Analysis

#### Signature Scheme (secp256k1)

```
Security Level: 128 bits
Key Size: 256 bits
Curve: secp256k1 (same as Bitcoin)

Vulnerability: Quantum computing
├─ Timeline: 15-20 years before quantum threat
├─ Attack: Shor's algorithm breaks ECDLP
└─ Mitigation: Post-quantum upgrade planned

Current Status:
├─ Mathematically proven secure
├─ Widely deployed (Bitcoin, Ethereum)
├─ NIST approval (P-256 variant)
└─ No known classical attacks
```

#### Proof-of-Work Security (RandomX)

```
Memory requirements: 2.8 GB per hash
CPU optimization: Essential
GPU optimization: Possible but poor ROI
ASIC resistance: Designed in (code execution VM)

Attack scenarios:
├─ Hardware advantage: <2x over CPU
├─ Botnet viability: Requires >1M nodes
├─ Energy cost: Must exceed block reward
└─ Economics: Makes 51% attack expensive

Long-term prospects:
├─ Still secure for foreseeable future
├─ May need algorithm change in 10+ years
├─ Plan: Periodic review and upgrade
```

### State Commitment Verification

```go
// Verify state root commitment

type StateCommitment struct {
    Height         int64
    StateRoot      [32]byte  // Merkle root
    Transitions    []byte
    Signatures     []Signature
}

func (s *StateCommitment) Verify(validators ValidatorSet) bool {
    // 1. Verify Merkle root matches transitions
    computedRoot := merkle.Root(s.Transitions)
    if computedRoot != s.StateRoot {
        return false
    }

    // 2. Verify signatures
    signedCount := 0
    for _, sig := range s.Signatures {
        if sig.Verify(s.StateRoot) {
            signedCount++
        }
    }

    // 3. Check threshold (2/3 required)
    required := (len(validators) * 2) / 3
    return signedCount >= required
}
```

### Cross-Chain Anchoring

```
Future Enhancement:

Unicity → Ethereum:
├─ Monitor Unicity PoW blocks
├─ Extract state roots
├─ Create Merkle proofs
└─ Submit to Ethereum smart contract

Ethereum → Unicity:
├─ Listen to Ethereum events
├─ Verify with PoW light client
├─ Include in Unicity transactions
└─ Enable atomic swaps

Implementation:
├─ Separate bridge validators
├─ Multi-signature requirements
├─ Time locks for security
└─ Fee structure for incentives
```

---

## Conclusion

This implementation guide provides:

1. **Deep Technical Understanding**
   - PoW algorithm details (RandomX, ASERT)
   - BFT consensus mechanics
   - Integration architecture

2. **Practical Deployment Knowledge**
   - Build and configuration
   - Performance optimization
   - Monitoring setup

3. **Advanced Expertise**
   - Security analysis
   - Cryptographic foundations
   - Future enhancements

For consensus experts, this document enables:
- Designing custom consensus configurations
- Troubleshooting complex issues
- Optimizing for specific use cases
- Contributing to protocol development

---

**Document Version:** 1.0
**Target Audience:** Consensus Protocol Experts
**Last Updated:** November 4, 2024
**Status:** Ready for Technical Reference
