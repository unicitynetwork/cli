# Unicity Expert Agents

Comprehensive AI assistant expert profiles for working with the Unicity Network. These profiles provide specialized, deep expertise in Unicity architecture, consensus mechanisms, aggregator operations, and SDK development across multiple programming languages.

**📦 Total Package:** 608 KB of expert knowledge
- 4 Expert Agent Profiles (148 KB)
- 16 Research Documents (444 KB)
- 25+ Repositories Analyzed
- 100+ Code Examples

## Installation

### Quick Install (Recommended)

Clone this repository directly into your project's `.claude-agents` directory:

```bash
# From your project root
git clone https://github.com/unicitynetwork/unicity-expert-agents.git .claude-agents

# Or as a subdirectory if you already have .claude-agents
cd .claude-agents
git clone https://github.com/unicitynetwork/unicity-expert-agents.git unicity
```

### Install as Git Submodule

For better version control integration:

```bash
# From your project root
git submodule add https://github.com/unicitynetwork/unicity-expert-agents.git .claude-agents/unicity

# Initialize and update
git submodule update --init --recursive
```

### Manual Download

Download and extract the latest release:

```bash
# Download the latest release
curl -L https://github.com/unicitynetwork/unicity-expert-agents/archive/refs/heads/main.zip -o unicity-agents.zip

# Extract to .claude-agents directory
unzip unicity-agents.zip -d .claude-agents/unicity
```

### Verify Installation

After installation, verify the structure:

```bash
ls -la .claude-agents/unicity-experts/
# Should show:
# - unicity-architect.md
# - consensus-expert.md
# - proof-aggregator-expert.md
# - unicity-developers.md

ls -la .claude-agents/unicity-research/
# Should show 16 research documents
```

## Usage

### For AI Assistants (Claude, ChatGPT, etc.)

When a user asks about Unicity Network, load the appropriate expert profile:

```python
# Example: Loading expert profiles programmatically
import os

def load_unicity_expert(topic):
    """Load the appropriate Unicity expert profile based on topic."""

    experts = {
        'architecture': '.claude-agents/unicity-experts/unicity-architect.md',
        'consensus': '.claude-agents/unicity-experts/consensus-expert.md',
        'aggregator': '.claude-agents/unicity-experts/proof-aggregator-expert.md',
        'sdk': '.claude-agents/unicity-experts/unicity-developers.md'
    }

    if topic in experts:
        with open(experts[topic], 'r') as f:
            return f.read()

    return None

# Usage
expert_knowledge = load_unicity_expert('architecture')
```

**Quick Decision Tree:**

- **Architecture questions** → `unicity-experts/unicity-architect.md`
  - "How does Unicity work?"
  - "What makes Unicity different?"
  - "Explain the four-layer architecture"

- **Consensus questions** → `unicity-experts/consensus-expert.md`
  - "How do I set up mining?"
  - "What is BFT consensus?"
  - "How do I run a validator?"

- **Aggregator questions** → `unicity-experts/proof-aggregator-expert.md`
  - "How do I deploy an aggregator?"
  - "What is the API?"
  - "How does proof aggregation work?"

- **Development questions** → `unicity-experts/unicity-developers.md`
  - "How do I create tokens in TypeScript?"
  - "Show me Java SDK examples"
  - "What SDKs are available?"

### For Developers

Use as comprehensive reference documentation:

```bash
# Quick search across all expert knowledge
grep -r "StateTransition" .claude-agents/unicity-experts/

# View specific expert profile
cat .claude-agents/unicity-experts/unicity-architect.md | less

# Search research documentation
grep -r "Sparse Merkle Tree" .claude-agents/unicity-research/
```

### Integration with Claude Code

If you're using Claude Code, add a reference in your project's `CLAUDE.md`:

```markdown
# CLAUDE.md

## Unicity Expert Agents

This project includes comprehensive Unicity Network expert agent profiles.
When answering questions about Unicity, refer to:

- Architecture: `.claude-agents/unicity-experts/unicity-architect.md`
- Consensus: `.claude-agents/unicity-experts/consensus-expert.md`
- Aggregator: `.claude-agents/unicity-experts/proof-aggregator-expert.md`
- SDKs: `.claude-agents/unicity-experts/unicity-developers.md`

Research documentation available in `.claude-agents/unicity-research/`
```

### Integration with Cursor IDE

Add to your `.cursorrules` file:

```
# Unicity Network Expertise

When questions are asked about Unicity Network:
- Load expert profiles from .claude-agents/unicity-experts/
- Refer to research docs in .claude-agents/unicity-research/
- Use code examples from SDK research reports
```

## What's Included

## Expert Agent Profiles

### 1. Unicity Architect (`unicity-experts/unicity-architect.md`)

**Expertise Domain:** Overall Unicity Network architecture, design principles, and system integration

**Key Knowledge Areas:**
- **Core Principles:** Off-chain execution paradigm, proof anchoring, trustless verification
- **Four-Layer Architecture:**
  - Consensus Layer (PoW + BFT hybrid)
  - Proof Aggregation Layer (Sparse Merkle Trees)
  - Token State Transition Layer (offchain tokens)
  - Agentic Layer (autonomous execution)
- **Architectural Innovations:** How Unicity differs from traditional blockchains
- **Component Interactions:** How all layers work together
- **System Design:** Best practices for building on Unicity

**Use Cases:**
- Architecture review and system design
- Technology selection and integration planning
- Performance analysis and optimization strategies
- Migration from traditional blockchain architectures

**Document Size:** 19 KB, 740 lines

---

### 2. Consensus Expert (`unicity-experts/consensus-expert.md`)

**Expertise Domain:** Unicity's hybrid Proof of Work and Byzantine Fault Tolerance consensus mechanisms

**Key Knowledge Areas:**
- **Proof of Work:**
  - RandomX CPU-based mining algorithm
  - ASERT adaptive difficulty adjustment
  - Mining pool operation and optimization
  - Block structure and validation
- **Byzantine Fault Tolerance:**
  - 1-second finality with validator consensus
  - Leader election and rotation
  - Network fault tolerance and recovery
  - Validator setup and management
- **Hybrid Integration:**
  - State root anchoring from BFT to PoW
  - Multi-layer security model (4-layer defense)
  - Consensus parameter tuning

**Use Cases:**
- Mining operation setup and optimization
- BFT validator deployment and management
- Consensus mechanism selection for use cases
- Performance tuning and troubleshooting
- Security analysis of consensus layer

**Document Size:** 21 KB, 805 lines

**Supporting Research:**
- CONSENSUS_EXPERT_REPORT.md (75 KB) - Comprehensive technical reference
- CONSENSUS_IMPLEMENTATION_GUIDE.md (30 KB) - Deployment and code examples
- CONSENSUS_QUICK_REFERENCE.md (18 KB) - Fast lookup guide

---

### 3. Proof Aggregator Expert (`unicity-experts/proof-aggregator-expert.md`)

**Expertise Domain:** Unicity Aggregator layer operation, API, deployment, and proof mechanisms

**Key Knowledge Areas:**
- **Architecture:**
  - Multi-layer aggregation design
  - Sparse Merkle Tree (SMT) implementation
  - High-availability leader election
  - Package structure (12 core packages)
- **Proof Aggregation:**
  - 4-phase aggregation process
  - State transition validation
  - Inclusion proof generation and verification
  - Commitment bundling and block creation
- **API Specification:**
  - JSON-RPC 2.0 endpoints
  - RegisterStateTransition, GetInclusionProof, etc.
  - Complete request/response examples
  - Error handling and edge cases
- **Operations:**
  - Docker and Kubernetes deployment
  - Monitoring with Prometheus/Grafana
  - Configuration and tuning
  - Troubleshooting common issues

**Use Cases:**
- Aggregator deployment and operations
- API integration for dApps
- Performance optimization (1M+ commits/sec)
- Monitoring and alerting setup
- Security hardening and validation

**Document Size:** 61 KB, 2,343 lines

**Performance Characteristics:**
- Throughput: 1,000,000+ commitments/second
- Latency: 1-2 second finality
- Scalability: Horizontal scaling with HA

---

### 4. Unicity Developers (`unicity-experts/unicity-developers.md`)

**Expertise Domain:** Language-specific SDK implementation for building on Unicity

**Covers 3 Programming Languages:**

#### TypeScript/JavaScript Developer
- **SDK:** `@unicitylabs/state-transition-sdk` v1.6.0 (Production)
- **Installation:** npm package manager
- **Ecosystem:** Node.js, Express, React, Next.js
- **Key APIs:** Token, StateTransition, Predicate, AggregatorClient
- **Testing:** Jest, Mocha integration patterns
- **Use Cases:** Web applications, serverless functions, backend APIs

#### Java Developer
- **SDK:** `com.unicitylabs:state-transition-sdk` v1.3.0 (Production)
- **Installation:** JitPack (JVM and Android variants)
- **Ecosystem:** Spring Boot, Android, microservices
- **Key APIs:** Token, StateTransition, Predicate, CompletableFuture
- **Testing:** JUnit, Testcontainers patterns
- **Use Cases:** Enterprise applications, Android apps, backend services

#### Rust Developer
- **SDK:** `unicity-state-transition` v0.1.0 (Experimental)
- **Installation:** GitHub (not yet on crates.io)
- **Ecosystem:** Tokio async runtime, WebAssembly
- **Key APIs:** Token, StateTransition, Predicate, async/await
- **Testing:** Cargo test patterns
- **Use Cases:** High-performance systems, WASM, embedded

**Cross-Language Features:**
- Complete feature parity across all SDKs
- Interoperable token format (create in one language, use in another)
- Consistent cryptography (secp256k1, ECDSA, SHA-256)
- Identical predicate types (masked/unmasked)

**Document Size:** 34 KB, 1,266 lines

**Supporting Research:**
- UNICITY_SDK_RESEARCH_REPORT.md (51 KB) - Complete SDK reference with 37+ code examples
- Installation guides, API reference, best practices for each language

---

## Research Documentation

The `unicity-research/` directory contains comprehensive technical reports and references that support the expert agent profiles:

### Architecture Research
- **UNICITY_ARCHITECTURE_REPORT.md** (38 KB) - Complete technical architecture reference
- **UNICITY_VISUAL_ARCHITECTURE.md** (63 KB) - Architecture diagrams and visual guides
- **INDEX_UNICITY_RESEARCH.md** (17 KB) - Master navigation index
- **README_UNICITY_RESEARCH.md** (18 KB) - Research package overview

### Consensus Research
- **CONSENSUS_EXPERT_REPORT.md** (75 KB) - Comprehensive consensus mechanism analysis
- **CONSENSUS_IMPLEMENTATION_GUIDE.md** (30 KB) - Deployment and configuration guide
- **CONSENSUS_QUICK_REFERENCE.md** (18 KB) - Fast lookup reference
- **README_CONSENSUS_RESEARCH.md** (17 KB) - Consensus research navigation

### Aggregator Research
- **AGGREGATOR_RESEARCH_SUMMARY.md** (16 KB) - Executive overview of aggregator layer
- **UNICITY_AGGREGATOR_RESEARCH_INDEX.md** (16 KB) - Aggregator topic index
- **AGGREGATOR_RESEARCH_README.md** (14 KB) - Aggregator research guide

### SDK Research
- **UNICITY_SDK_RESEARCH_REPORT.md** (51 KB) - Complete SDK reference for all languages
- **UNICITY_RESEARCH_SUMMARY.md** (4.5 KB) - Quick reference summary

---

## How to Use These Expert Agents

### For AI Assistants (Claude, ChatGPT, etc.)

When a user asks about Unicity Network, load the appropriate expert profile based on the question:

**Architecture Questions** → Load `unicity-experts/unicity-architect.md`
- "How does Unicity work?"
- "What makes Unicity different from Ethereum?"
- "Explain the four-layer architecture"

**Consensus Questions** → Load `unicity-experts/consensus-expert.md`
- "How do I set up a miner?"
- "What is the BFT consensus mechanism?"
- "How do I run a validator?"

**Aggregator Questions** → Load `unicity-experts/proof-aggregator-expert.md`
- "How do I deploy an aggregator?"
- "What is the API for state transitions?"
- "How does proof aggregation work?"

**Development Questions** → Load `unicity-experts/unicity-developers.md`
- "How do I create a token in TypeScript?"
- "Show me Java SDK examples"
- "What SDKs are available for Unicity?"

### For Developers

Use the expert profiles as comprehensive reference documentation:

1. **Start with the appropriate expert profile** for your domain
2. **Refer to research documents** for deeper technical details
3. **Follow code examples** from SDK research reports
4. **Use quick references** for fast lookups during development

### For Architects

Use these profiles to:
- Understand Unicity's unique architecture and design principles
- Make informed technology selection decisions
- Design systems that integrate with Unicity
- Evaluate performance and security characteristics

---

## Document Statistics

### Expert Agent Profiles
- **Total Size:** 135 KB (4 profiles)
- **Total Lines:** 5,154 lines of expert knowledge
- **Code Examples:** 60+ production-ready examples
- **Diagrams:** 10+ architecture and flow diagrams

### Research Documentation
- **Total Size:** 440+ KB (15 documents)
- **Total Lines:** 17,000+ lines
- **Code Examples:** 100+ examples across all languages
- **Repositories Analyzed:** 25+ GitHub repositories
- **API Methods Documented:** 150+

---

## Quick Navigation

### I want to...

**Understand Unicity architecture** → Start with `unicity-experts/unicity-architect.md`

**Set up mining or validators** → Go to `unicity-experts/consensus-expert.md`

**Deploy an aggregator** → Read `unicity-experts/proof-aggregator-expert.md`

**Build an application** → Check `unicity-experts/unicity-developers.md` for your language

**Deep dive on architecture** → See `unicity-research/UNICITY_ARCHITECTURE_REPORT.md`

**Get code examples** → Look at `unicity-research/UNICITY_SDK_RESEARCH_REPORT.md`

**Quick reference** → Use `unicity-research/CONSENSUS_QUICK_REFERENCE.md` or `UNICITY_RESEARCH_SUMMARY.md`

---

## Maintenance and Updates

These expert profiles are based on research conducted in November 2024 and reflect the state of:

- **Consensus:** PoW (alpha) and BFT (bft-core) latest versions
- **Aggregator:** proof-aggregation-go latest version
- **SDKs:** TypeScript v1.6.0, Java v1.3.0, Rust v0.1.0

As Unicity evolves, these profiles should be updated to reflect:
- New SDK releases and features
- Architecture changes or improvements
- New deployment patterns or best practices
- Additional programming language SDKs

---

## Contributing

To update or extend these expert profiles:

1. Research the latest Unicity repositories on https://github.com/unicitynetwork
2. Update the relevant expert profile in `unicity-experts/`
3. Update supporting research documents in `unicity-research/`
4. Update this README with any new profiles or significant changes

---

## Resources

### Official Unicity Links
- **GitHub Organization:** https://github.com/unicitynetwork
- **Whitepaper:** Check repositories for latest technical documentation
- **Documentation:** See individual repository README files

### Key Repositories
- **PoW Consensus:** unicitynetwork/alpha
- **BFT Consensus:** unicitynetwork/bft-core
- **Aggregator:** unicitynetwork/proof-aggregation-go
- **TypeScript SDK:** unicitynetwork/state-transition-sdk
- **Java SDK:** unicitynetwork/state-transition-sdk-java
- **Rust SDK:** unicitynetwork/state-transition-sdk-rust

---

## License

These expert profiles are documentation resources for the Unicity Network ecosystem. Refer to individual Unicity repositories for software licenses.

---

**Last Updated:** November 4, 2025
**Research Coverage:** 25+ repositories, 4 expert domains, 3 programming languages
**Total Documentation:** 575+ KB of expert knowledge
