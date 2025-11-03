# Unicity CLI Tutorials - Complete Learning Path

Welcome! This is your comprehensive guide to mastering the Unicity CLI through progressive, hands-on tutorials.

## Overview

The tutorial series takes you from complete beginner to production-ready expert in 5 structured lessons:

```
Tutorial 1: Your First Token (15 min)
    ↓ Learn: Setup, address generation, minting, verification
    ↓
Tutorial 2: Token Transfers (20 min)
    ↓ Learn: Two identities, offline transfers, complete workflow
    ↓
Tutorial 3: Advanced Operations (25 min)
    ↓ Learn: Token types, batch operations, scripting, immediate transfers
    ↓
Tutorial 4: Token Internals (30 min)
    ↓ Learn: TXF format, predicates, transfers, inclusion proofs
    ↓
Tutorial 5: Production Practices (20 min)
    ↓ Learn: Security, backups, testing, monitoring
    ↓
You're Production Ready!
```

**Total Time**: ~2 hours of focused learning

---

## Tutorial Quick Navigation

### Tutorial 1: Your First Token (Beginner)
**File**: [01-first-token.md](01-first-token.md)

**What You'll Learn**:
- System setup and installation
- Generate your first cryptographic address
- Mint your first token
- Verify token validity
- Understand basic concepts (secrets, addresses, tokens)

**Prerequisites**: None - perfect for beginners!

**Key Commands**:
```bash
npm run gen-address
npm run mint-token -- -d '{"data":"here"}'
npm run verify-token -- -f token.txf
```

**Learning Time**: 15 minutes

**Key Concepts**:
- Secret (private password)
- Address (wallet ID)
- Token (digital asset)
- TXF file (portable format)
- Verification (proving authenticity)

**Next Step**: Move to Tutorial 2 when comfortable with minting

---

### Tutorial 2: Token Transfers (Intermediate)
**File**: [02-token-transfers.md](02-token-transfers.md)

**What You'll Learn**:
- Create multiple identities (Alice and Bob)
- Complete offline transfer workflow
- Understand Pattern A (asynchronous transfers)
- How tokens change ownership
- File transfer in real-world scenarios

**Prerequisites**: Complete Tutorial 1

**Key Commands**:
```bash
# Alice creates address and mints
SECRET="alice-secret" npm run gen-address
SECRET="alice-secret" npm run mint-token -- -d '{"gift":"for Bob"}'

# Alice creates transfer package
SECRET="alice-secret" npm run send-token -- -f token.txf -r BOB_ADDRESS --save

# Bob receives token
SECRET="bob-secret" npm run receive-token -- -f transfer.txf --save
```

**Learning Time**: 20 minutes

**Key Concepts**:
- Multiple identities
- Offline transfers (Pattern A)
- Transfer packages
- Address verification
- Ownership transfer
- Network commitment

**Next Step**: Move to Tutorial 3 for advanced features

---

### Tutorial 3: Advanced Operations (Advanced)
**File**: [03-advanced-operations.md](03-advanced-operations.md)

**What You'll Learn**:
- All token type presets (UCT, NFT, USDU)
- Custom token IDs and metadata
- Rich, complex metadata structures
- Pattern B (immediate transfers with --submit-now)
- Custom endpoints (staging, local, production)
- Batch operations and scripting
- Error recovery strategies

**Prerequisites**: Complete Tutorial 2

**Key Commands**:
```bash
# Different token types
npm run mint-token -- --preset nft -d '{"art":"metadata"}'
npm run mint-token -- --preset usdu -d '{"amount":"100"}'

# Custom IDs
npm run mint-token -- -i "meaningful-id" -d '{"data":"here"}'

# Pattern B - immediate transfer
npm run send-token -- -f token.txf -r ADDRESS --submit-now

# Custom endpoints
npm run mint-token -- -e https://staging.unicity.network -d '{"test":true}'

# Batch scripting
npm run send-token -- -f token.txf -r ADDR1 --save
npm run send-token -- -f token.txf -r ADDR2 --save
```

**Learning Time**: 25 minutes

**Key Concepts**:
- Token type presets
- Custom metadata
- Immediate vs offline transfers
- Network endpoints
- Batch operations
- Scripting strategies
- Error handling

**Next Step**: Move to Tutorial 4 for technical understanding

---

### Tutorial 4: Token Internals (Technical Deep-Dive)
**File**: [04-token-internals.md](04-token-internals.md)

**What You'll Learn**:
- TXF file format and structure
- Token state and genesis sections
- Predicates (ownership proofs)
- Unmasked vs Masked predicates
- How transfers work at protocol level
- Inclusion proofs and network commitment
- CBOR encoding
- Token lifecycle states

**Prerequisites**: Complete Tutorial 3

**Key Concepts**:
```json
{
  "version": "2.0",           // Format version
  "state": {                  // Current state
    "predicate": [...],       // Ownership proof
    "data": "hex-data"        // Your metadata
  },
  "genesis": {...},           // Immutable origin
  "transactions": [...],      // Transfer history
  "status": "CONFIRMED"       // Current status
}
```

**Learning Time**: 30 minutes

**Key Concepts**:
- TXF structure and sections
- Predicate types and ownership
- Transfer protocol
- Inclusion proofs
- CBOR encoding
- Cryptographic security
- Token lifecycle
- Debugging techniques

**Next Step**: Move to Tutorial 5 for production readiness

---

### Tutorial 5: Production Best Practices (Advanced)
**File**: [05-production-practices.md](05-production-practices.md)

**What You'll Learn**:
- Secure secret management (vault, HSM, environment)
- Backup and recovery strategies (3-2-1 rule)
- Address verification workflows
- Testing before production (dev → staging → prod)
- Monitoring and auditing operations
- Troubleshooting production issues
- Compliance and documentation

**Prerequisites**: Complete Tutorial 4

**Key Practices**:
```bash
# Secret management
export SECRET=$(vault kv get -field=SECRET secret/unicity/main)

# Backup strategy
tar -czf backup.tar.gz tokens/ && gpg --symmetric backup.tar.gz

# Address verification
grep "address" recipient-registry.json

# Testing workflow
npm run mint-token -- --local -d '{"test":true}'  # Local
npm run mint-token -- -e staging.unicity.network -d '{"test":true}'  # Staging
npm run mint-token -- -d '{"test":true}'  # Production
```

**Learning Time**: 20 minutes

**Key Concepts**:
- Secret management strategies
- Backup and recovery procedures
- Address verification
- Testing environments
- Monitoring and logging
- Compliance and auditing
- Incident response
- Production deployment

**This is the final tutorial - you're now production-ready!**

---

## Learning Path Flowchart

```
START (No Experience)
  ↓
Tutorial 1: Basics
├─ Learn: Installation, address generation, minting
├─ Time: 15 minutes
├─ Hands-on: Create your first token
└─ Skills: Independent token creation

  ↓
Tutorial 2: Transfers
├─ Learn: Multi-party workflows, transfers
├─ Time: 20 minutes
├─ Hands-on: Send token from Alice to Bob
└─ Skills: Token ownership transfer

  ↓
Tutorial 3: Advanced
├─ Learn: Custom types, batch ops, scripting
├─ Time: 25 minutes
├─ Hands-on: Automate token operations
└─ Skills: Complex workflows, automation

  ↓
Tutorial 4: Internals
├─ Learn: How it all works internally
├─ Time: 30 minutes
├─ Hands-on: Analyze token structures
└─ Skills: Debug, understand architecture

  ↓
Tutorial 5: Production
├─ Learn: Security, backups, monitoring
├─ Time: 20 minutes
├─ Hands-on: Deploy production system
└─ Skills: Production-ready deployment

  ↓
EXPERT STATUS - Ready for any scenario!
```

---

## Learning Outcomes by Tutorial

### After Tutorial 1: Beginner
You can:
- [x] Install and set up Unicity CLI
- [x] Generate a unique cryptographic address
- [x] Mint a token with metadata
- [x] Verify a token is authentic
- [x] Understand basic token concepts

**Scenario**: Create your own digital asset

---

### After Tutorial 2: Intermediate
You can additionally:
- [x] Set up multiple independent identities
- [x] Create offline transfer packages
- [x] Transfer tokens between addresses
- [x] Receive and claim tokens
- [x] Verify ownership transfer
- [x] Understand complete workflows

**Scenario**: Send a digital gift to a friend

---

### After Tutorial 3: Advanced
You can additionally:
- [x] Use different token types (NFT, USDU, UCT)
- [x] Create complex metadata structures
- [x] Perform immediate transfers (Pattern B)
- [x] Work with custom network endpoints
- [x] Write batch scripts
- [x] Automate token operations
- [x] Recover from errors

**Scenario**: Build an NFT distribution system

---

### After Tutorial 4: Technical Expert
You can additionally:
- [x] Read and understand TXF file format
- [x] Understand predicates and ownership proofs
- [x] Debug transfer issues
- [x] Understand inclusion proofs
- [x] Analyze token internals
- [x] Design custom applications

**Scenario**: Build a custom wallet or integrate into applications

---

### After Tutorial 5: Production Ready
You can additionally:
- [x] Securely manage secrets in production
- [x] Implement backup and recovery
- [x] Verify addresses correctly
- [x] Test before production
- [x] Monitor operations
- [x] Handle incidents
- [x] Maintain compliance

**Scenario**: Deploy production token system with confidence

---

## Recommended Learning Schedule

### Option 1: Intensive (One Day)
```
Morning:    Tutorial 1 (15 min) + Tutorial 2 (20 min)
Lunch:      Break
Afternoon:  Tutorial 3 (25 min) + Tutorial 4 (30 min)
Evening:    Tutorial 5 (20 min) + Practice exercises
Result:     Full day intensive training
```

### Option 2: Gradual (One Week)
```
Day 1:  Tutorial 1 - Basics (15 min)
Day 2:  Tutorial 2 - Transfers (20 min)
Day 3:  Practice exercises with Tutorials 1-2
Day 4:  Tutorial 3 - Advanced (25 min)
Day 5:  Tutorial 4 - Internals (30 min)
Day 6:  Tutorial 5 - Production (20 min)
Day 7:  Complete end-to-end practice project
Result: Thorough, spaced learning
```

### Option 3: Self-Paced (Reference)
```
Read tutorials as needed for your use case
- Just starting? → Tutorial 1
- Ready to transfer? → Tutorial 2
- Need automation? → Tutorial 3
- Debugging issues? → Tutorial 4
- Going to production? → Tutorial 5
```

---

## Supplementary Guides

While tutorials provide comprehensive learning, these guides offer deeper detail on specific topics:

### For Tutorial 1
- [GETTING_STARTED.md](../getting-started.md) - Quick start overview
- [GEN_ADDRESS_GUIDE.md](../guides/commands/gen-address.md) - Address generation deep-dive
- [MINT_TOKEN_GUIDE.md](../guides/commands/mint-token.md) - Minting options reference
- [VERIFY_TOKEN_GUIDE.md](../guides/commands/verify-token.md) - Verification documentation

### For Tutorial 2
- [OFFLINE_TRANSFER_WORKFLOW.md](../guides/workflows/offline-transfer.md) - Transfer details
- [SEND_TOKEN_GUIDE.md](../guides/commands/send-token.md) - Send command reference
- [RECEIVE_TOKEN_GUIDE.md](../guides/commands/receive-token.md) - Receive command reference

### For Tutorial 3
- [MINT_TOKEN_GUIDE.md](../guides/commands/mint-token.md) - All token type presets
- [SEND_TOKEN_GUIDE.md](../guides/commands/send-token.md) - Pattern A vs Pattern B

### For Tutorial 4
- [TXF_IMPLEMENTATION_GUIDE.md](../reference/txf-format.md) - TXF format specification

### For All Tutorials
- [GLOSSARY.md](../glossary.md) - Term definitions
- [TROUBLESHOOTING.md](../troubleshooting.md) - Common issues and solutions
- [FAQ.md](../faq.md) - Frequently asked questions
- [README.md](../README.md) - Complete command reference

---

## Practice Projects

After each tutorial, try these exercises:

### Tutorial 1 Exercises
1. **Create Multiple Tokens**: Mint 3 tokens with different metadata
2. **Verify Each**: Verify all 3 tokens are authentic
3. **Explore Metadata**: Try complex JSON structures in token data

### Tutorial 2 Exercises
1. **Three-Person Transfer**: Create Alice → Bob → Carol transfer chain
2. **Offline Scenario**: Transfer a token to someone without internet
3. **Address Registry**: Maintain a registry of recipient addresses

### Tutorial 3 Exercises
1. **Token Types**: Mint one of each type (UCT, NFT, USDU)
2. **Batch Mint**: Create a script that mints 10 tokens automatically
3. **Certificate System**: Build an issuer → recipient certification workflow

### Tutorial 4 Exercises
1. **Analyze Structure**: Open a token file and trace the complete structure
2. **Track Transfer**: Follow a token through a complete transfer lifecycle
3. **Decode Data**: Manually decode hex metadata from a token

### Tutorial 5 Exercises
1. **Setup Backup**: Implement the 3-2-1 backup strategy
2. **Create Test Plan**: Write a test suite for token operations
3. **Deploy to Staging**: Create a complete staging environment

---

## Key Milestones

Track your progress:

```
[x] Tutorial 1 Complete - Basic token operations understood
[x] Tutorial 2 Complete - Transfers mastered
[x] Tutorial 3 Complete - Advanced features understood
[x] Tutorial 4 Complete - Architecture understood
[x] Tutorial 5 Complete - Production ready!

Next: Build something amazing with Unicity!
```

---

## Troubleshooting Your Learning

### "I'm stuck on Tutorial 1"
- Review the Prerequisites section
- Ensure Node.js 18+ is installed
- Run the verification command again
- Check [TROUBLESHOOTING.md](../troubleshooting.md)

### "Tutorial 2 seems complicated"
- This is normal! Re-read carefully
- Especially focus on "The Scenario" section
- Run each command individually, not all at once
- Verify output matches expected output

### "I don't understand Tutorial 4"
- This is technical - normal to struggle
- Watch the tutorial walkthrough video (if available)
- Focus on "Hands-On: Analyzing Your Token" section
- Then re-read with your own token file open

### "Stuck on production practices (Tutorial 5)"
- Implement ONE thing at a time
- Start with secret management, then backups
- Test each step before moving to next
- Reference the checklists provided

---

## Getting Help

When stuck:

1. **Check the Glossary**: [GLOSSARY.md](../glossary.md)
2. **Search Troubleshooting**: [TROUBLESHOOTING.md](../troubleshooting.md)
3. **Review FAQ**: [FAQ.md](../faq.md)
4. **Re-read the specific tutorial** section
5. **Check supplementary guides** for command reference
6. **File an issue**: https://github.com/unicitynetwork/cli/issues

---

## Feedback and Suggestions

Found a problem with the tutorials?
- Unclear explanation? Please tell us!
- Missing information? We'll add it!
- Better way to teach something? Let's improve!

Submit feedback: [Issues on GitHub](https://github.com/unicitynetwork/cli/issues)

---

## Summary: Your Learning Path

| Tutorial | Topic | Time | Difficulty | Status |
|----------|-------|------|-----------|--------|
| 1 | Your First Token | 15 min | Beginner | [Start](TUTORIAL_1_FIRST_TOKEN.md) |
| 2 | Token Transfers | 20 min | Intermediate | [Start](TUTORIAL_2_TOKEN_TRANSFERS.md) |
| 3 | Advanced Operations | 25 min | Advanced | [Start](TUTORIAL_3_ADVANCED_OPERATIONS.md) |
| 4 | Token Internals | 30 min | Expert | [Start](TUTORIAL_4_TOKEN_INTERNALS.md) |
| 5 | Production Practices | 20 min | Expert | [Start](TUTORIAL_5_PRODUCTION_PRACTICES.md) |

**Total Learning Time**: ~2 hours
**Total Practice Time**: Variable (recommended 2-4 hours)

---

## You're Ready!

Pick a tutorial and start learning. Each one builds on the previous, so start with Tutorial 1 even if you have experience.

**Happy learning!**

---

## Quick Links

- Start learning: [Tutorial 1 - Your First Token](01-first-token.md)
- Commands reference: [README.md](../README.md)
- Definitions: [GLOSSARY.md](../glossary.md)
- Issues: [TROUBLESHOOTING.md](../troubleshooting.md)
- FAQ: [FAQ.md](../faq.md)

---

*Last updated: 2025-11-02*
*Tutorial series v1.0*
