# Unicity CLI Documentation Index

## Quick Navigation

### New Users Start Here
- **[Getting Started Guide](GETTING_STARTED.md)** - 15-minute quick start tutorial
- **[Tutorial Series](TUTORIALS_INDEX.md)** - Progressive learning path (beginner to expert)
- **[Glossary](GLOSSARY.md)** - Key terms and concepts

### Command Guides (Detailed)
- **[gen-address Command](GEN_ADDRESS_GUIDE.md)** - Generate addresses from secrets
- **[mint-token Command](MINT_TOKEN_GUIDE.md)** - Create new tokens (self-mint pattern)
- **[verify-token Command](VERIFY_TOKEN_GUIDE.md)** - Verify and inspect token files
- **[send-token Command](SEND_TOKEN_GUIDE.md)** - Send tokens to recipients
- **[receive-token Command](RECEIVE_TOKEN_GUIDE.md)** - Complete offline token transfers

### Workflows
- **[Transfer Guide](TRANSFER_GUIDE.md)** - Complete token transfer workflow (Pattern A & B)
- **[Offline Transfer Workflow](OFFLINE_TRANSFER_WORKFLOW.md)** - End-to-end offline transfer example

### Reference
- **[API Reference](API_REFERENCE.md)** - Complete command-line API documentation
- **[README](README.md)** - Project overview and quick reference
- **[TXF Implementation Guide](TXF_IMPLEMENTATION_GUIDE.md)** - Token file format specification

### Developer Resources
- **[CLAUDE.md](CLAUDE.md)** - Developer instructions for Claude Code
- **[Implementation Summary](IMPLEMENTATION_SUMMARY.md)** - receive-token implementation details

---

## Documentation by Use Case

### I want to...

#### Get Started
1. Read [Getting Started Guide](GETTING_STARTED.md)
2. Follow [Tutorial 1: Your First Token](TUTORIAL_1_FIRST_TOKEN.md)
3. Reference [Glossary](GLOSSARY.md) for unfamiliar terms

#### Create My First Token
1. Read [MINT_TOKEN_GUIDE.md](MINT_TOKEN_GUIDE.md)
2. Or follow [Tutorial 1](TUTORIAL_1_FIRST_TOKEN.md)
3. Verify with [VERIFY_TOKEN_GUIDE.md](VERIFY_TOKEN_GUIDE.md)

#### Send Tokens to Someone
1. Read [TRANSFER_GUIDE.md](TRANSFER_GUIDE.md) for overview
2. Read [SEND_TOKEN_GUIDE.md](SEND_TOKEN_GUIDE.md) for command details
3. Or follow [Tutorial 2: Token Transfers](TUTORIAL_2_TOKEN_TRANSFERS.md)

#### Receive Tokens from Someone
1. Read [TRANSFER_GUIDE.md](TRANSFER_GUIDE.md) for overview
2. Read [RECEIVE_TOKEN_GUIDE.md](RECEIVE_TOKEN_GUIDE.md) for command details
3. See [Offline Transfer Workflow](OFFLINE_TRANSFER_WORKFLOW.md) for complete example

#### Understand Token Internals
1. Read [TUTORIAL_4_TOKEN_INTERNALS.md](TUTORIAL_4_TOKEN_INTERNALS.md)
2. Reference [TXF_IMPLEMENTATION_GUIDE.md](TXF_IMPLEMENTATION_GUIDE.md)
3. Check [GLOSSARY.md](GLOSSARY.md) for technical terms

#### Deploy to Production
1. Read [TUTORIAL_5_PRODUCTION_PRACTICES.md](TUTORIAL_5_PRODUCTION_PRACTICES.md)
2. Review [API_REFERENCE.md](API_REFERENCE.md) for all options
3. Check security sections in command guides

#### Find a Specific Command Option
1. Use [API_REFERENCE.md](API_REFERENCE.md) - quick lookup tables
2. Or check individual command guide for detailed explanation

---

## Documentation Organization

### Core Documentation (Read First)
| Document | Purpose | Audience | Length |
|----------|---------|----------|--------|
| [README.md](README.md) | Project overview | Everyone | 5 min |
| [GETTING_STARTED.md](GETTING_STARTED.md) | Quick start tutorial | New users | 15 min |
| [API_REFERENCE.md](API_REFERENCE.md) | Complete API reference | Developers | Reference |
| [GLOSSARY.md](GLOSSARY.md) | Term definitions | Everyone | Reference |

### Tutorial Series (Progressive Learning)
| Tutorial | Topic | Level | Time |
|----------|-------|-------|------|
| [Tutorial 1](TUTORIAL_1_FIRST_TOKEN.md) | Your First Token | Beginner | 15 min |
| [Tutorial 2](TUTORIAL_2_TOKEN_TRANSFERS.md) | Token Transfers | Beginner | 30 min |
| [Tutorial 3](TUTORIAL_3_ADVANCED_OPERATIONS.md) | Advanced Operations | Intermediate | 45 min |
| [Tutorial 4](TUTORIAL_4_TOKEN_INTERNALS.md) | Token Internals | Advanced | 60 min |
| [Tutorial 5](TUTORIAL_5_PRODUCTION_PRACTICES.md) | Production Practices | Expert | 60 min |

### Command Reference (Detailed Guides)
| Guide | Command | Purpose |
|-------|---------|---------|
| [GEN_ADDRESS_GUIDE.md](GEN_ADDRESS_GUIDE.md) | gen-address | Generate addresses |
| [MINT_TOKEN_GUIDE.md](MINT_TOKEN_GUIDE.md) | mint-token | Create tokens |
| [VERIFY_TOKEN_GUIDE.md](VERIFY_TOKEN_GUIDE.md) | verify-token | Inspect tokens |
| [SEND_TOKEN_GUIDE.md](SEND_TOKEN_GUIDE.md) | send-token | Send tokens |
| [RECEIVE_TOKEN_GUIDE.md](RECEIVE_TOKEN_GUIDE.md) | receive-token | Receive tokens |

### Workflow Guides (End-to-End)
| Guide | Focus | Use Case |
|-------|-------|----------|
| [TRANSFER_GUIDE.md](TRANSFER_GUIDE.md) | Complete transfer workflow | Pattern A & B comparison |
| [OFFLINE_TRANSFER_WORKFLOW.md](OFFLINE_TRANSFER_WORKFLOW.md) | Offline transfers | Mobile wallets, async transfers |

### Technical Reference
| Document | Purpose |
|----------|---------|
| [TXF_IMPLEMENTATION_GUIDE.md](TXF_IMPLEMENTATION_GUIDE.md) | Token file format spec |
| [CLAUDE.md](CLAUDE.md) | Developer guidelines |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | Implementation details |

---

## Key Concepts Cross-Reference

### Secret Management
- [GETTING_STARTED.md](GETTING_STARTED.md) - Basic introduction
- [GLOSSARY.md](GLOSSARY.md#secret) - Definition
- [API_REFERENCE.md](API_REFERENCE.md#environment-variables) - Technical reference
- [TUTORIAL_5_PRODUCTION_PRACTICES.md](TUTORIAL_5_PRODUCTION_PRACTICES.md) - Production best practices

### Transfer Patterns
- [TRANSFER_GUIDE.md](TRANSFER_GUIDE.md#transfer-patterns) - Overview
- [SEND_TOKEN_GUIDE.md](SEND_TOKEN_GUIDE.md) - Pattern A & B details
- [OFFLINE_TRANSFER_WORKFLOW.md](OFFLINE_TRANSFER_WORKFLOW.md) - Complete example
- [TUTORIAL_2_TOKEN_TRANSFERS.md](TUTORIAL_2_TOKEN_TRANSFERS.md) - Hands-on practice

### Predicate Types
- [GLOSSARY.md](GLOSSARY.md#predicate) - Definition
- [MINT_TOKEN_GUIDE.md](MINT_TOKEN_GUIDE.md#predicate-types) - Usage
- [TUTORIAL_4_TOKEN_INTERNALS.md](TUTORIAL_4_TOKEN_INTERNALS.md) - Deep dive
- [API_REFERENCE.md](API_REFERENCE.md#common-patterns) - Technical reference

### TXF Format
- [TXF_IMPLEMENTATION_GUIDE.md](TXF_IMPLEMENTATION_GUIDE.md) - Complete specification
- [API_REFERENCE.md](API_REFERENCE.md#file-formats) - Quick reference
- [TUTORIAL_4_TOKEN_INTERNALS.md](TUTORIAL_4_TOKEN_INTERNALS.md) - Internals
- [VERIFY_TOKEN_GUIDE.md](VERIFY_TOKEN_GUIDE.md) - Inspection

### Token Status
- [GLOSSARY.md](GLOSSARY.md#token-status) - Definitions
- [API_REFERENCE.md](API_REFERENCE.md#token-status-values) - Reference table
- [TRANSFER_GUIDE.md](TRANSFER_GUIDE.md#status-lifecycle) - Lifecycle
- [TXF_IMPLEMENTATION_GUIDE.md](TXF_IMPLEMENTATION_GUIDE.md) - Implementation

---

## Common Questions → Documentation

### "How do I get started?"
→ [GETTING_STARTED.md](GETTING_STARTED.md)

### "How do I create my first token?"
→ [TUTORIAL_1_FIRST_TOKEN.md](TUTORIAL_1_FIRST_TOKEN.md) or [MINT_TOKEN_GUIDE.md](MINT_TOKEN_GUIDE.md)

### "How do I send tokens to someone?"
→ [TRANSFER_GUIDE.md](TRANSFER_GUIDE.md) then [SEND_TOKEN_GUIDE.md](SEND_TOKEN_GUIDE.md)

### "What does this term mean?"
→ [GLOSSARY.md](GLOSSARY.md)

### "What are all the command options?"
→ [API_REFERENCE.md](API_REFERENCE.md)

### "How do offline transfers work?"
→ [OFFLINE_TRANSFER_WORKFLOW.md](OFFLINE_TRANSFER_WORKFLOW.md)

### "What's the difference between masked and unmasked?"
→ [GLOSSARY.md](GLOSSARY.md#predicate-types) or [MINT_TOKEN_GUIDE.md](MINT_TOKEN_GUIDE.md#predicate-types)

### "How do I secure my secrets in production?"
→ [TUTORIAL_5_PRODUCTION_PRACTICES.md](TUTORIAL_5_PRODUCTION_PRACTICES.md#secret-management)

### "What's in a .txf file?"
→ [TXF_IMPLEMENTATION_GUIDE.md](TXF_IMPLEMENTATION_GUIDE.md) or [VERIFY_TOKEN_GUIDE.md](VERIFY_TOKEN_GUIDE.md)

### "How do I debug errors?"
→ Command-specific troubleshooting sections in guides, or [API_REFERENCE.md](API_REFERENCE.md#common-errors)

---

## Documentation Maintenance

### For Contributors

**When adding a new feature:**
1. Update [API_REFERENCE.md](API_REFERENCE.md) with new options
2. Add to relevant command guide
3. Update [GLOSSARY.md](GLOSSARY.md) if new terms introduced
4. Add example to appropriate tutorial
5. Update this index if needed

**When fixing documentation:**
1. Check cross-references remain valid
2. Update version numbers if applicable
3. Test all code examples
4. Update modification date in document

**Consistency Standards:**
- Command examples use `npm run <command>` format
- Secrets shown as `SECRET="example"` (never real secrets)
- File paths use forward slashes
- Address examples use truncation: `DIRECT://0000280c3d...`
- Timestamps in examples use ISO 8601 format

---

## Document Status

| Document | Status | Last Updated | Completeness |
|----------|--------|--------------|--------------|
| README.md | ✅ Current | 2025-11 | Complete |
| GETTING_STARTED.md | ✅ Current | 2025-11 | Complete |
| API_REFERENCE.md | ✅ Current | 2025-11 | Complete |
| GLOSSARY.md | ✅ Current | 2025-11 | Complete |
| GEN_ADDRESS_GUIDE.md | ✅ Current | 2025-11 | Complete |
| MINT_TOKEN_GUIDE.md | ✅ Current | 2025-11 | Complete |
| VERIFY_TOKEN_GUIDE.md | ✅ Current | 2025-11 | Complete |
| SEND_TOKEN_GUIDE.md | ✅ Current | 2025-11 | Complete |
| RECEIVE_TOKEN_GUIDE.md | ✅ Current | 2025-11 | Complete |
| TRANSFER_GUIDE.md | ✅ Current | 2025-11 | Complete |
| OFFLINE_TRANSFER_WORKFLOW.md | ✅ Current | 2025-11 | Complete |
| TXF_IMPLEMENTATION_GUIDE.md | ✅ Current | 2025-11 | Complete |
| TUTORIAL_1_FIRST_TOKEN.md | ✅ Current | 2025-11 | Complete |
| TUTORIAL_2_TOKEN_TRANSFERS.md | ✅ Current | 2025-11 | Complete |
| TUTORIAL_3_ADVANCED_OPERATIONS.md | ✅ Current | 2025-11 | Complete |
| TUTORIAL_4_TOKEN_INTERNALS.md | ✅ Current | 2025-11 | Complete |
| TUTORIAL_5_PRODUCTION_PRACTICES.md | ✅ Current | 2025-11 | Complete |
| TUTORIALS_INDEX.md | ✅ Current | 2025-11 | Complete |
| CLAUDE.md | ✅ Current | 2025-11 | Complete |

---

## Quick Links by Role

### **End Users**
Start: [GETTING_STARTED.md](GETTING_STARTED.md)
Reference: [API_REFERENCE.md](API_REFERENCE.md)
Help: [GLOSSARY.md](GLOSSARY.md)

### **Developers**
Start: [CLAUDE.md](CLAUDE.md)
Reference: [TXF_IMPLEMENTATION_GUIDE.md](TXF_IMPLEMENTATION_GUIDE.md)
Tutorials: [TUTORIALS_INDEX.md](TUTORIALS_INDEX.md)

### **Mobile Wallet Integrators**
Start: [OFFLINE_TRANSFER_WORKFLOW.md](OFFLINE_TRANSFER_WORKFLOW.md)
Reference: [TXF_IMPLEMENTATION_GUIDE.md](TXF_IMPLEMENTATION_GUIDE.md)
API: [API_REFERENCE.md](API_REFERENCE.md)

### **System Administrators**
Start: [TUTORIAL_5_PRODUCTION_PRACTICES.md](TUTORIAL_5_PRODUCTION_PRACTICES.md)
Reference: [API_REFERENCE.md](API_REFERENCE.md)
Workflows: [TRANSFER_GUIDE.md](TRANSFER_GUIDE.md)

---

*This index provides navigation across all Unicity CLI documentation. For questions or improvements, see the contributing section in [README.md](README.md).*
