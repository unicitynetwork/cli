# Unicity CLI Documentation Index

## Quick Navigation

### New Users Start Here
- **[Getting Started Guide](getting-started.md)** - 15-minute quick start tutorial
- **[Tutorial Series](tutorials/README.md)** - Progressive learning path (beginner to expert)
- **[Glossary](glossary.md)** - Key terms and concepts

### Command Guides (Detailed)
- **[gen-address Command](guides/commands/gen-address.md)** - Generate addresses from secrets
- **[mint-token Command](guides/commands/mint-token.md)** - Create new tokens (self-mint pattern)
- **[verify-token Command](guides/commands/verify-token.md)** - Verify and inspect token files
- **[send-token Command](guides/commands/send-token.md)** - Send tokens to recipients
- **[receive-token Command](guides/commands/receive-token.md)** - Complete offline token transfers

### Workflows
- **[Transfer Guide](guides/workflows/transfer-guide.md)** - Complete token transfer workflow (Pattern A & B)
- **[Offline Transfer Workflow](guides/workflows/offline-transfer.md)** - End-to-end offline transfer example

### Reference
- **[API Reference](reference/api-reference.md)** - Complete command-line API documentation
- **[README](../README.md)** - Project overview and quick reference
- **[TXF Implementation Guide](reference/txf-format.md)** - Token file format specification

### Developer Resources
- **[CLAUDE.md](../.dev/README.md)** - Developer instructions for Claude Code

---

## Documentation by Use Case

### I want to...

#### Get Started
1. Read [Getting Started Guide](getting-started.md)
2. Follow [Tutorial 1: Your First Token](tutorials/01-first-token.md)
3. Reference [Glossary](glossary.md) for unfamiliar terms

#### Create My First Token
1. Read [mint-token Guide](guides/commands/mint-token.md)
2. Or follow [Tutorial 1](tutorials/01-first-token.md)
3. Verify with [verify-token Guide](guides/commands/verify-token.md)

#### Send Tokens to Someone
1. Read [Transfer Guide](guides/workflows/transfer-guide.md) for overview
2. Read [send-token Guide](guides/commands/send-token.md) for command details
3. Or follow [Tutorial 2: Token Transfers](tutorials/02-token-transfers.md)

#### Receive Tokens from Someone
1. Read [Transfer Guide](guides/workflows/transfer-guide.md) for overview
2. Read [receive-token Guide](guides/commands/receive-token.md) for command details
3. See [Offline Transfer Workflow](guides/workflows/offline-transfer.md) for complete example

#### Understand Token Internals
1. Read [Tutorial 4: Token Internals](tutorials/04-token-internals.md)
2. Reference [TXF Format Guide](reference/txf-format.md)
3. Check [Glossary](glossary.md) for technical terms

#### Deploy to Production
1. Read [Tutorial 5: Production Practices](tutorials/05-production-practices.md)
2. Review [API Reference](reference/api-reference.md) for all options
3. Check security sections in command guides

#### Find a Specific Command Option
1. Use [API Reference](reference/api-reference.md) - quick lookup tables
2. Or check individual command guide for detailed explanation

---

## Documentation Organization

### Core Documentation (Read First)
| Document | Purpose | Audience | Length |
|----------|---------|----------|--------|
| [README.md](README.md) | Project overview | Everyone | 5 min |
| [GETTING_STARTED.md](getting-started.md) | Quick start tutorial | New users | 15 min |
| [API_REFERENCE.md](reference/api-reference.md) | Complete API reference | Developers | Reference |
| [GLOSSARY.md](glossary.md) | Term definitions | Everyone | Reference |

### Tutorial Series (Progressive Learning)
| Tutorial | Topic | Level | Time |
|----------|-------|-------|------|
| [Tutorial 1](tutorials/01-first-token.md) | Your First Token | Beginner | 15 min |
| [Tutorial 2](tutorials/02-token-transfers.md) | Token Transfers | Beginner | 30 min |
| [Tutorial 3](tutorials/03-advanced-operations.md) | Advanced Operations | Intermediate | 45 min |
| [Tutorial 4](tutorials/04-token-internals.md) | Token Internals | Advanced | 60 min |
| [Tutorial 5](tutorials/05-production-practices.md) | Production Practices | Expert | 60 min |

### Command Reference (Detailed Guides)
| Guide | Command | Purpose |
|-------|---------|---------|
| [GEN_ADDRESS_GUIDE.md](guides/commands/gen-address.md) | gen-address | Generate addresses |
| [MINT_TOKEN_GUIDE.md](guides/commands/mint-token.md) | mint-token | Create tokens |
| [VERIFY_TOKEN_GUIDE.md](guides/commands/verify-token.md) | verify-token | Inspect tokens |
| [SEND_TOKEN_GUIDE.md](guides/commands/send-token.md) | send-token | Send tokens |
| [RECEIVE_TOKEN_GUIDE.md](guides/commands/receive-token.md) | receive-token | Receive tokens |

### Workflow Guides (End-to-End)
| Guide | Focus | Use Case |
|-------|-------|----------|
| [TRANSFER_GUIDE.md](guides/workflows/transfer-guide.md) | Complete transfer workflow | Pattern A & B comparison |
| [OFFLINE_TRANSFER_WORKFLOW.md](guides/workflows/offline-transfer.md) | Offline transfers | Mobile wallets, async transfers |

### Technical Reference
| Document | Purpose |
|----------|---------|
| [TXF_IMPLEMENTATION_GUIDE.md](reference/txf-format.md) | Token file format spec |
| [CLAUDE.md](../.dev/README.md) | Developer guidelines |
| [Implementation Documentation](implementation/README.md) | Implementation details |
| [Testing Documentation](testing/README.md) | Test suite documentation |
| [Security Documentation](security/README.md) | Security reports and analysis |
| [Debug Scripts](../scripts/debug/README.md) | Development utilities |

---

## Key Concepts Cross-Reference

### Secret Management
- [GETTING_STARTED.md](getting-started.md) - Basic introduction
- [GLOSSARY.md](GLOSSARY.md#secret) - Definition
- [API_REFERENCE.md](API_REFERENCE.md#environment-variables) - Technical reference
- [TUTORIAL_5_PRODUCTION_PRACTICES.md](tutorials/05-production-practices.md) - Production best practices

### Transfer Patterns
- [TRANSFER_GUIDE.md](TRANSFER_GUIDE.md#transfer-patterns) - Overview
- [SEND_TOKEN_GUIDE.md](guides/commands/send-token.md) - Pattern A & B details
- [OFFLINE_TRANSFER_WORKFLOW.md](guides/workflows/offline-transfer.md) - Complete example
- [TUTORIAL_2_TOKEN_TRANSFERS.md](tutorials/02-token-transfers.md) - Hands-on practice

### Predicate Types
- [GLOSSARY.md](GLOSSARY.md#predicate) - Definition
- [MINT_TOKEN_GUIDE.md](MINT_TOKEN_GUIDE.md#predicate-types) - Usage
- [TUTORIAL_4_TOKEN_INTERNALS.md](tutorials/04-token-internals.md) - Deep dive
- [API_REFERENCE.md](API_REFERENCE.md#common-patterns) - Technical reference

### TXF Format
- [TXF_IMPLEMENTATION_GUIDE.md](reference/txf-format.md) - Complete specification
- [API_REFERENCE.md](API_REFERENCE.md#file-formats) - Quick reference
- [TUTORIAL_4_TOKEN_INTERNALS.md](tutorials/04-token-internals.md) - Internals
- [VERIFY_TOKEN_GUIDE.md](guides/commands/verify-token.md) - Inspection

### Token Status
- [GLOSSARY.md](GLOSSARY.md#token-status) - Definitions
- [API_REFERENCE.md](API_REFERENCE.md#token-status-values) - Reference table
- [TRANSFER_GUIDE.md](TRANSFER_GUIDE.md#status-lifecycle) - Lifecycle
- [TXF_IMPLEMENTATION_GUIDE.md](reference/txf-format.md) - Implementation

---

## Common Questions → Documentation

### "How do I get started?"
→ [GETTING_STARTED.md](getting-started.md)

### "How do I create my first token?"
→ [TUTORIAL_1_FIRST_TOKEN.md](tutorials/01-first-token.md) or [MINT_TOKEN_GUIDE.md](guides/commands/mint-token.md)

### "How do I send tokens to someone?"
→ [TRANSFER_GUIDE.md](guides/workflows/transfer-guide.md) then [SEND_TOKEN_GUIDE.md](guides/commands/send-token.md)

### "What does this term mean?"
→ [GLOSSARY.md](glossary.md)

### "What are all the command options?"
→ [API_REFERENCE.md](reference/api-reference.md)

### "How do offline transfers work?"
→ [OFFLINE_TRANSFER_WORKFLOW.md](guides/workflows/offline-transfer.md)

### "What's the difference between masked and unmasked?"
→ [GLOSSARY.md](glossary.md#predicate-types) or [MINT_TOKEN_GUIDE.md](guides/commands/mint-token.md#predicate-types)

### "How do I secure my secrets in production?"
→ [TUTORIAL_5_PRODUCTION_PRACTICES.md](tutorials/05-production-practices.md#secret-management)

### "What's in a .txf file?"
→ [TXF_IMPLEMENTATION_GUIDE.md](reference/txf-format.md) or [VERIFY_TOKEN_GUIDE.md](guides/commands/verify-token.md)

### "How do I debug errors?"
→ Command-specific troubleshooting sections in guides, or [API_REFERENCE.md](reference/api-reference.md#common-errors)

---

## Documentation Maintenance

### For Contributors

**When adding a new feature:**
1. Update [API_REFERENCE.md](reference/api-reference.md) with new options
2. Add to relevant command guide
3. Update [GLOSSARY.md](glossary.md) if new terms introduced
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
| getting-started.md | ✅ Current | 2025-11 | Complete |
| reference/api-reference.md | ✅ Current | 2025-11 | Complete |
| glossary.md | ✅ Current | 2025-11 | Complete |
| guides/commands/gen-address.md | ✅ Current | 2025-11 | Complete |
| guides/commands/mint-token.md | ✅ Current | 2025-11 | Complete |
| guides/commands/verify-token.md | ✅ Current | 2025-11 | Complete |
| guides/commands/send-token.md | ✅ Current | 2025-11 | Complete |
| guides/commands/receive-token.md | ✅ Current | 2025-11 | Complete |
| guides/workflows/transfer-guide.md | ✅ Current | 2025-11 | Complete |
| guides/workflows/offline-transfer.md | ✅ Current | 2025-11 | Complete |
| reference/txf-format.md | ✅ Current | 2025-11 | Complete |
| tutorials/01-first-token.md | ✅ Current | 2025-11 | Complete |
| tutorials/02-token-transfers.md | ✅ Current | 2025-11 | Complete |
| tutorials/03-advanced-operations.md | ✅ Current | 2025-11 | Complete |
| tutorials/04-token-internals.md | ✅ Current | 2025-11 | Complete |
| tutorials/05-production-practices.md | ✅ Current | 2025-11 | Complete |
| tutorials/README.md | ✅ Current | 2025-11 | Complete |
| ../.dev/README.md | ✅ Current | 2025-11 | Complete |

---

## Quick Links by Role

### **End Users**
Start: [GETTING_STARTED.md](getting-started.md)
Reference: [API_REFERENCE.md](reference/api-reference.md)
Help: [GLOSSARY.md](glossary.md)

### **Developers**
Start: [CLAUDE.md](../.dev/README.md)
Reference: [TXF_IMPLEMENTATION_GUIDE.md](reference/txf-format.md)
Tutorials: [TUTORIALS_INDEX.md](tutorials/README.md)

### **Mobile Wallet Integrators**
Start: [OFFLINE_TRANSFER_WORKFLOW.md](guides/workflows/offline-transfer.md)
Reference: [TXF_IMPLEMENTATION_GUIDE.md](reference/txf-format.md)
API: [API_REFERENCE.md](reference/api-reference.md)

### **System Administrators**
Start: [TUTORIAL_5_PRODUCTION_PRACTICES.md](tutorials/05-production-practices.md)
Reference: [API_REFERENCE.md](reference/api-reference.md)
Workflows: [TRANSFER_GUIDE.md](guides/workflows/transfer-guide.md)

---

*This index provides navigation across all Unicity CLI documentation. For questions or improvements, see the contributing section in [README.md](README.md).*
