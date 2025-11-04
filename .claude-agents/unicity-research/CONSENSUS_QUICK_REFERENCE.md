# Unicity Network Consensus - Quick Reference Guide

**For Consensus Expert Agent Profile**

---

## 1. Core Consensus Mechanisms at a Glance

### Proof of Work (PoW) - Alpha Consensus Layer

```
Algorithm:      Bitcoin fork with RandomX (memory-hard, ASIC-resistant)
Block Time:     2 minutes
Difficulty:     ASERT (Absolutely Scheduled Exponentially Rising Targets)
Supply:         21 million ALPHA (Bitcoin-like halving)
Mining Reward:  10 ALPHA per block
Security:       51% attack requires majority of global hashrate
Finality:       ~2 minutes per block (with reorg risk until multiple confirmations)
Throughput:     ~1-5 transactions/second
```

**Key Advantage**: Ultimate settlement security, censorship resistance, open mining
**Key Disadvantage**: Slow finality (~2 minutes per block)

### Byzantine Fault Tolerance (BFT) - Aggregation Layer

```
Protocol:       BFT consensus with validator set
Round Time:     1 second
Validators:     20-100+ nodes (configurable)
Finality:       Deterministic (after round completion)
Byzantine Tolerance: <1/3 faulty validators allowed
Throughput:     100-1000+ transactions/second
Architecture:   Partitioned (Money + Token partitions)
```

**Key Advantage**: Fast finality, high throughput, deterministic consensus
**Key Disadvantage**: Requires trusted validator set, slower fallback than PoW

### Combined Hybrid Model

```
Fast Path:      BFT aggregation (1 second consensus)
Secure Path:    PoW anchoring (2 minute finality)
Combined Result: Best of both - fast + secure
Total Finality: ~2 seconds (BFT) + ~2 minutes (PoW settlement)
```

---

## 2. Quick Deployment Guide

### PoW: Run an Alpha Node

```bash
# Clone and build
git clone https://github.com/unicitynetwork/alpha.git
cd alpha && ./build.sh

# Configure
mkdir -p ~/.alpha
cat > ~/.alpha/bitcoin.conf << EOF
listen=1
server=1
rpcuser=alphauser
rpcpassword=$(openssl rand -base64 32)
rpcport=8332
dbcache=2000
maxconnections=256
EOF

# Run
./alpha -daemon -datadir=~/.alpha

# Verify
./alpha-cli -rpcuser=alphauser -rpcpassword=alphapass getblockcount
```

### PoW: Start Mining

```bash
# Solo Mining (CPU)
git clone https://github.com/unicitynetwork/alpha-miner.git
cd alpha-miner && ./build.sh

./alphaminer \
  --url http://127.0.0.1:8332 \
  --user alphauser \
  --password alphapass \
  --threads 8 \
  --largePages 1

# Pool Mining
./alphaminer \
  --url stratum+tcp://pool.example.com:3333 \
  --user wallet_address \
  --password x \
  --threads 8
```

### BFT: Run a Validator

```bash
# Clone and build
git clone https://github.com/unicitynetwork/bft-core.git
cd bft-core && make build

# Setup
export UBFT_HOME="$HOME/.ubft"
mkdir -p "$UBFT_HOME"

# Generate keys
ubft-keygen --output "$UBFT_HOME/keys"

# Configure
cat > "$UBFT_HOME/config.props" << 'EOF'
listen.addr=0.0.0.0:8081
p2p.port=8081
rpc.port=8080
partition.id=0
partition.type=money
state.dir=$UBFT_HOME/state
logging.level=INFO
EOF

# Initialize and start
ubft init --home "$UBFT_HOME"
ubft start --home "$UBFT_HOME"

# Monitor
ubft status --home "$UBFT_HOME"
```

---

## 3. Performance Comparison Table

```
╔════════════════════╦═════════════╦═════════════╦════════════════╗
║ Metric             ║ PoW (Alpha) ║ BFT Aggr.   ║ Combined       ║
╠════════════════════╬═════════════╬═════════════╬════════════════╣
║ Block/Round Time   ║ 2 minutes   ║ 1 second    ║ Hybrid         ║
║ Finality Type      ║ Probabilit. ║ Determinist.║ Dual layer     ║
║ Transactions/sec   ║ 1-5 tx/s    ║ 100-1000    ║ Orders of mag. ║
║ Node Requirements  ║ Modest      ║ Moderate    ║ Distributed    ║
║ Decentralization   ║ Very High   ║ Moderate    ║ Balanced       ║
║ Energy per Tx      ║ High        ║ Very Low    ║ Low average    ║
║ Consensus Style    ║ Nakamoto    ║ Practical   ║ Hybrid         ║
║ Fork Risk          ║ Yes         ║ No          ║ No (BFT locks) ║
╚════════════════════╩═════════════╩═════════════╩════════════════╝
```

---

## 4. Security Properties Summary

### PoW Security Guarantees

| Guarantee | Strength | Cost to Break |
|-----------|----------|--------------|
| 51% Attack Resistance | Very High | >50% of global Alpha hashrate |
| Censorship Resistance | Very High | Impossible without 51% |
| Finality Guarantee | High | Grows with block confirmations |
| Network Partition Recovery | Automatic | Longest chain wins |

### BFT Security Guarantees

| Guarantee | Strength | Cost to Break |
|-----------|----------|--------------|
| Safety (Agreement) | Provable | >1/3 Byzantine validators |
| Liveness (Progress) | Requires 2/3+ | Need validator recovery |
| Fork Prevention | Perfect | Proven impossible in BFT |
| Network Sync | Strong | All nodes agree on state |

### Combined Hybrid Security

- **Attack Cost**: Must break BOTH consensus layers simultaneously
- **Effective Strength**: Exponentially higher than either alone
- **Defense Depth**: 4-layer security (crypto → off-chain → BFT → PoW)
- **Graceful Degradation**: If BFT fails, PoW continues (and vice versa)

---

## 5. When to Use Each Consensus

### Use PoW (Alpha) When:

```
✓ Need ultimate settlement security
✓ Want censorship resistance
✓ Require global finality
✓ Need open, permissionless participation
✓ Building critical financial infrastructure
✓ Creating bridge to other blockchains
✓ Establishing dispute resolution
```

**Example**: ALPHA currency settlement, cross-chain anchoring

### Use BFT (Aggregation) When:

```
✓ Need fast consensus (<1 second)
✓ Want high throughput (>100 tx/s)
✓ Building user-facing applications
✓ Aggregating state transitions
✓ Can trust validator set
✓ Need instant user feedback
✓ Operating within known participants
```

**Example**: Exchange settlement, payment aggregation, user-facing apps

### Use Hybrid When:

```
✓ Need both speed AND security
✓ Building production systems
✓ Want scalability with settlement
✓ Designing long-term architecture
✓ Creating decentralized finance
✓ Operating autonomous agents
✓ Managing significant value
```

**Example**: Most production applications, DeFi protocols

---

## 6. Configuration Quick Reference

### Alpha Node Configuration Keys

```properties
# Network
listen=1              # Enable P2P listening
bind=0.0.0.0         # Bind address
port=8333            # P2P port

# RPC
server=1             # Enable RPC
rpcuser=alphauser    # RPC username
rpcpassword=pass     # RPC password
rpcport=8332         # RPC port

# Performance
dbcache=2000         # Database cache (MB)
maxconnections=256   # Max connections
maxmempool=300       # Max mempool (MB)
```

### BFT Validator Configuration Keys

```properties
# Network
listen.addr=0.0.0.0:8081
p2p.port=8081
rpc.port=8080

# Consensus
partition.id=0
partition.type=money         # or token
consensus.round_timeout=1000ms

# State
state.dir=$UBFT_HOME/state
state.snapshot_interval=10000

# Observability
logging.level=INFO
tracing.enabled=true
tracing.exporter=otlptracehttp
```

### Mining Configuration

```bash
# Solo Mining
./alphaminer \
  --url http://localhost:8332 \
  --user rpcuser \
  --password rpcpass \
  --threads 8 \
  --largePages 1

# Pool Mining
./alphaminer \
  --url stratum+tcp://pool.example.com:3333 \
  --user wallet_address \
  --password x \
  --threads 8
```

---

## 7. Key Repositories Cheat Sheet

| Repository | URL | Purpose | Language |
|------------|-----|---------|----------|
| **alpha** | github.com/unicitynetwork/alpha | PoW node (full) | C++ |
| **alpha-miner** | github.com/unicitynetwork/alpha-miner | Mining software | C |
| **bft-core** | github.com/unicitynetwork/bft-core | BFT validator | Go |
| **unicity-mining-core** | github.com/unicitynetwork/unicity-mining-core | Mining pool | C# |
| **guiwallet** | github.com/unicitynetwork/guiwallet | Web wallet | TypeScript |
| **state-transition-sdk** | github.com/unicitynetwork/state-transition-sdk | Token ops SDK | TypeScript |
| **agent-sdk** | github.com/unicitynetwork/agent-sdk | Agent framework | Multiple |
| **whitepaper** | github.com/unicitynetwork/whitepaper | Full spec | LaTeX/PDF |

---

## 8. Critical Performance Numbers

### PoW (Alpha) Layer

```
Metric              Value               Note
─────────────────────────────────────────────────────────
Block Time          2 minutes           Target interval
Block Size          ~1MB                Typical
Hashrate            ~10 Ph/s            Current estimate
Difficulty          Variable            ASERT adjusted
Mining Reward       10 ALPHA/block      Per successful block
Tx Throughput       1-5 tx/s            Limited by single-input model
Confirmation Time   2-10 minutes        Until reasonable finality
```

### BFT (Aggregation) Layer

```
Metric              Value               Note
─────────────────────────────────────────────────────────
Round Duration      1 second            Target
Validator Count     20-100+             Configurable
Finality Type       Deterministic       Immediate after round
Byzantine Tolerance <1/3 faulty         f < n/3 requirement
State Throughput    100-1000+ tx/s      Per partition
Latency             <1000ms             From submission to commit
Network Gossip      Manageable          All-to-all communication
```

### Combined System

```
Metric              Value               Note
─────────────────────────────────────────────────────────
User Feedback       <1s                 BFT acknowledgment
Final Settlement    ~2 minutes          PoW anchor confirmation
Total Throughput    Orders of magnitude Off-chain computation
Security Model      Dual-layer          PoW + BFT protection
```

---

## 9. Troubleshooting Quick Guide

### Alpha Node Issues

```
Problem: Node not syncing
Solution:
  1. Check network connectivity: ping -c 1 8.8.8.8
  2. Verify P2P port open: telnet localhost 8333
  3. Check disk space: df -h
  4. Review logs: tail -f ~/.alpha/debug.log
  5. Restart node: kill $(ps aux | grep alpha | grep -v grep | awk '{print $2}')

Problem: RPC connection refused
Solution:
  1. Verify server=1 in bitcoin.conf
  2. Check rpcuser and rpcpassword match
  3. Ensure rpcport is 8332 (default)
  4. Verify rpcbind includes your IP
  5. Test: curl -u user:pass http://localhost:8332/

Problem: Mining not producing blocks
Solution:
  1. Verify node is fully synced: alpha-cli getblockcount
  2. Check if mining is enabled: alpha-cli getmininginfo
  3. Verify miner connectivity: Check node logs
  4. For pool: Verify shares accepted in pool stats
```

### BFT Validator Issues

```
Problem: Validator not participating in consensus
Solution:
  1. Check status: ubft status --home $UBFT_HOME
  2. Verify validator is in set: ubft validators --home $UBFT_HOME
  3. Check network connectivity: nc -zv localhost 8081
  4. Review logs: tail -f $UBFT_HOME/ubft.log
  5. Restart: ubft stop && ubft start --home $UBFT_HOME

Problem: Consensus rounds not completing
Solution:
  1. Check peers: ubft peers --home $UBFT_HOME
  2. Verify >2/3 validators online
  3. Check network latency: ping other-validator
  4. Review timeout settings in config
  5. Check for validator crashes in logs

Problem: State divergence between validators
Solution:
  1. Resync state: ubft reset --home $UBFT_HOME
  2. Get latest snapshot from peers
  3. Verify validator signatures
  4. Check merkle root consistency
  5. Review consensus logs for divergence point
```

---

## 10. Development Quick Start

### Using State Transition SDK

```typescript
import { SigningService, StateTransitionClient } from '@unicitylabs/state-transition-sdk';

// Create signer
const signer = SigningService.fromSecret(secret);

// Create transition
const transition = {
  type: 'transfer',
  tokenId: 'token1',
  to: 'recipient_address',
  amount: 100,
  nonce: 42
};

// Sign and submit
const signature = await signer.sign(transition);
const client = new StateTransitionClient({ aggregatorUrl: 'https://...' });
const result = await client.submitTransition({ transition, signature });

// Wait for finality
const proof = await client.getInclusionProof(result.transitionHash);
```

### Using Agent SDK

```rust
use unicity_agent_sdk::{Agent, AgentContext, Operation};

pub struct MyAgent { /* ... */ }

#[async_trait]
impl Agent for MyAgent {
  async fn execute(
    &self,
    context: &AgentContext,
    operation: &Operation
  ) -> Result<Vec<Operation>> {
    // Verify and execute operation
    // Generate state transitions
    // Return new operations
    Ok(vec![/* transitions */])
  }
}
```

---

## 11. Network Parameters Summary

### Alpha Network Parameters

```
Parameter               Value           Significance
─────────────────────────────────────────────────────────
Network Name            Alpha           Consensus layer
Chain ID                (Bitcoin-based) Bitcoin-compatible
Genesis Block           2024-06-16      June 16, 2024
Total Supply            ~21 million     Bitcoin-like cap
Block Reward            10 ALPHA         Per block
Halving Interval        210,000 blocks  Similar to Bitcoin
Min Block Version       1               Bitcoin compat.
Tx Version              1-3             Bitcoin compat.
```

### BFT Network Parameters

```
Parameter               Value           Significance
─────────────────────────────────────────────────────────
Network Type            Multi-partition Money + Token
Min Validators          3               BFT minimum (f<n/3)
Recommended Validators  20-50           Optimal performance
Max Byzantine           <1/3            Safety threshold
Round Duration          1 second        Ultra-fast consensus
Idle Timeout            3 seconds       Fallback timing
Proposal Timeout        1 second        Leader timeout
```

---

## 12. Expert Knowledge Checkpoints

**To be a Consensus Expert, know:**

1. ✓ Difference between PoW block time (2 min) and BFT round time (1 sec)
2. ✓ Why RandomX was chosen (ASIC resistance, CPU-optimized)
3. ✓ How ASERT adjusts difficulty (12-hour half-life, per-block)
4. ✓ BFT Byzantine tolerance threshold (⅔ honest minimum)
5. ✓ Integration point: BFT state roots → PoW blockchain
6. ✓ Security model: Either layer can fail without system failure
7. ✓ Off-chain execution reduces on-chain burden orders of magnitude
8. ✓ Validator set governance affects BFT security assumptions
9. ✓ Mining remains open/permissionless (PoW layer)
10. ✓ Finality trade-off: Fast (BFT 1s) vs. Ultimate (PoW 2m)

---

## 13. Common Commands Reference

### Alpha (PoW) Commands

```bash
# Node info
alpha-cli getblockchaininfo
alpha-cli getnetworkinfo
alpha-cli getmininginfo

# Blocks
alpha-cli getblockcount
alpha-cli getblockhash [height]
alpha-cli getblock [hash]

# Transactions
alpha-cli gettransaction [txid]
alpha-cli sendtoaddress [address] [amount]

# Mining
alpha-cli generate [number]              # If miner enabled
alpha-cli generatetoaddress [blocks] [addr]
```

### BFT Commands

```bash
# Status
ubft status --home $UBFT_HOME
ubft validators --home $UBFT_HOME
ubft peers --home $UBFT_HOME

# Metrics
ubft metrics --home $UBFT_HOME
ubft history --home $UBFT_HOME

# RPC Calls
curl http://localhost:8080/rpc -X POST -d '{"jsonrpc":"2.0","method":"GetStatus",...}'

# Logs
tail -f $UBFT_HOME/ubft.log
grep ERROR $UBFT_HOME/ubft.log
```

---

## 14. Blockchain Explorer References

**Alpha Blockchain Explorer:**
- Repository: https://github.com/unicitynetwork/Unicity-Explorer
- Purpose: View blocks, transactions, addresses on PoW chain
- Typical URL: https://explorer.unicity.network (when available)

**RPC API:**
```bash
# Direct RPC access
curl -u user:pass http://localhost:8332/ \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getblockcount","params":[],"id":1}'
```

---

## 15. Additional Resources

### Official Documentation Links

- **Main Whitepaper**: https://github.com/unicitynetwork/whitepaper/releases/tag/latest
- **Aggregator Layer Paper**: https://github.com/unicitynetwork/aggr-layer-paper/releases/tag/latest
- **Execution Model**: https://github.com/unicitynetwork/execution-model-tex

### External References

- **RandomX Algorithm**: https://github.com/tevador/RandomX
- **Bitcoin Cash ASERT**: https://upgradespecs.bitcoincashnode.org/2020-11-15-asert/
- **Practical BFT**: https://pmg.csail.mit.edu/papers/osdi99.pdf

---

**Last Updated:** November 4, 2024
**Status:** Complete - Ready for Quick Reference in Agent Interactions
**Format:** Markdown (optimized for AI reading)

Use this guide for:
- Quick fact lookup during agent interactions
- Configuration examples for deployment
- Performance comparison data
- Troubleshooting steps
- Development templates
