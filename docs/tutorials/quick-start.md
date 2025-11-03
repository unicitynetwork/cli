# Unicity CLI Tutorials - Quick Start Guide

## Where Do I Start?

Answer these questions to find the right tutorial:

### Question 1: Have you installed the CLI before?

**No** → Start with [Tutorial 1: Your First Token](01-first-token.md)

**Yes** → Go to Question 2

---

### Question 2: Can you currently mint tokens?

**No** → Go back to [Tutorial 1](01-first-token.md)

**Yes** → Go to Question 3

---

### Question 3: What do you want to learn?

#### "I want to send tokens to other people"
→ [Tutorial 2: Token Transfers](02-token-transfers.md)
- Learn offline and immediate transfers
- Understand complete transfer workflows
- Set up multiple identities

#### "I want to use advanced features"
→ [Tutorial 3: Advanced Operations](03-advanced-operations.md)
- Different token types (NFT, USDU, etc.)
- Batch operations and scripting
- Custom metadata and IDs
- Immediate transfers

#### "I want to understand how tokens work"
→ [Tutorial 4: Token Internals](04-token-internals.md)
- TXF file structure
- Predicates and ownership
- Network commitments
- Cryptographic proofs

#### "I want to deploy to production"
→ [Tutorial 5: Production Practices](05-production-practices.md)
- Secret management
- Backup and recovery
- Monitoring and compliance
- Error handling

---

## Quick Command Reference

### 🔑 Address Generation
```bash
# Simple address (reusable)
SECRET="my-secret" npm run gen-address

# Masked address (private)
SECRET="my-secret" npm run gen-address -n "unique-nonce"
```
→ Tutorial: [Tutorial 1](01-first-token.md)

### 💎 Token Minting
```bash
# Simple token
SECRET="my-secret" npm run mint-token -- -d '{"data":"here"}'

# NFT token
SECRET="my-secret" npm run mint-token -- --preset nft -d '{"name":"My NFT"}'

# USDU stablecoin
SECRET="my-secret" npm run mint-token -- --preset usdu -d '{"amount":"100"}'
```
→ Tutorial: [Tutorial 1](01-first-token.md), [Tutorial 3](03-advanced-operations.md)

### ✅ Token Verification
```bash
# Verify a token
npm run verify-token -- -f token.txf
```
→ Tutorial: [Tutorial 1](01-first-token.md)

### 📤 Send Token (Offline)
```bash
# Create transfer package
SECRET="my-secret" npm run send-token -- \
  -f token.txf \
  -r "RECIPIENT_ADDRESS" \
  --save
```
→ Tutorial: [Tutorial 2](02-token-transfers.md)

### 📤 Send Token (Immediate)
```bash
# Send to network immediately
SECRET="my-secret" npm run send-token -- \
  -f token.txf \
  -r "RECIPIENT_ADDRESS" \
  --submit-now --save
```
→ Tutorial: [Tutorial 3](03-advanced-operations.md)

### 📥 Receive Token
```bash
# Claim a transferred token
SECRET="my-secret" npm run receive-token -- \
  -f transfer-package.txf \
  --save
```
→ Tutorial: [Tutorial 2](02-token-transfers.md)

---

## Common Scenarios

### Scenario 1: "I just installed the CLI"
1. Read: [Tutorial 1](01-first-token.md) (15 min)
2. Do: Install, generate address, mint token, verify
3. Next: [Tutorial 2](02-token-transfers.md)

### Scenario 2: "I want to send a token to someone"
1. If new: First complete [Tutorial 1](01-first-token.md)
2. Read: [Tutorial 2](02-token-transfers.md) (20 min)
3. Do: Set up two identities, mint, transfer, receive
4. Optional: [Tutorial 3](03-advanced-operations.md) for advanced patterns

### Scenario 3: "I want to mint many tokens automatically"
1. Prerequisites: Complete [Tutorials 1-2](TUTORIAL_1_FIRST_TOKEN.md)
2. Read: [Tutorial 3](03-advanced-operations.md) - Part 6 (15 min)
3. Do: Write batch scripts from examples
4. Next: [Tutorial 5](05-production-practices.md) for production

### Scenario 4: "My transfer isn't working"
1. Check: [TROUBLESHOOTING.md](../troubleshooting.md)
2. Understand: [Tutorial 4](04-token-internals.md) - How transfers work
3. Debug: Use verification commands from [Tutorial 1](01-first-token.md)

### Scenario 5: "I'm deploying to production"
1. Prerequisites: Complete [Tutorials 1-4](TUTORIAL_1_FIRST_TOKEN.md)
2. Read: [Tutorial 5](05-production-practices.md) (20 min)
3. Do: Set up secrets, backups, monitoring
4. Follow: Production deployment checklist

---

## Estimated Learning Times

| Path | Content | Time |
|------|---------|------|
| **Minimal** | Tutorial 1 only | 15 min |
| **Practical** | Tutorials 1-2 | 35 min |
| **Full** | Tutorials 1-5 | 2 hours |
| **With Practice** | Tutorials 1-5 + exercises | 4-5 hours |

---

## Prerequisites by Tutorial

### Tutorial 1: Your First Token
- [ ] Node.js 18+
- [ ] Terminal access
- [ ] Internet connection
- [ ] 15 minutes

### Tutorial 2: Token Transfers
- [ ] Completed Tutorial 1
- [ ] 20 minutes

### Tutorial 3: Advanced Operations
- [ ] Completed Tutorial 2
- [ ] Comfortable with terminal
- [ ] 25 minutes

### Tutorial 4: Token Internals
- [ ] Completed Tutorial 3
- [ ] Basic cryptography knowledge
- [ ] 30 minutes

### Tutorial 5: Production Practices
- [ ] Completed Tutorial 4
- [ ] Understanding of security concepts
- [ ] 20 minutes

---

## Checking Your Progress

### After Tutorial 1
- [ ] Can run `npm run gen-address`
- [ ] Can mint a token with metadata
- [ ] Can verify a token file
- [ ] Understand addresses and secrets

**Status**: Beginner ✓

### After Tutorial 2
- [ ] Can create two identities
- [ ] Can create transfer package
- [ ] Can receive a token
- [ ] Understand complete transfer workflow

**Status**: Intermediate ✓

### After Tutorial 3
- [ ] Can mint different token types
- [ ] Can create batch scripts
- [ ] Can use custom endpoints
- [ ] Can write automation scripts

**Status**: Advanced ✓

### After Tutorial 4
- [ ] Can read TXF files
- [ ] Understand predicates
- [ ] Can debug issues
- [ ] Know how network confirms transfers

**Status**: Expert ✓

### After Tutorial 5
- [ ] Secure secret management
- [ ] Backup and recovery procedures
- [ ] Testing before production
- [ ] Monitoring and compliance

**Status**: Production Ready ✓

---

## Video Walkthrough Chapters

If video tutorials are available (check documentation), here's how they align:

**Video 1**: Tutorial 1 - Installation & First Token (15 min)
**Video 2**: Tutorial 2 - Transfers (20 min)
**Video 3**: Tutorial 3 - Advanced Features (25 min)
**Video 4**: Tutorial 4 - Technical Deep Dive (30 min)
**Video 5**: Tutorial 5 - Going to Production (20 min)

---

## Troubleshooting Learning Issues

### "I don't understand something in a tutorial"
1. Re-read the specific section
2. Check the [GLOSSARY.md](../glossary.md) for terms
3. Look at supplementary guides (linked in tutorial)
4. Try the hands-on exercise again
5. Check [TROUBLESHOOTING.md](../troubleshooting.md)

### "I'm moving too slow"
- That's okay! Better to understand deeply than rush
- Spend extra time on practice exercises
- Take breaks between tutorials
- Progress at your own pace

### "I'm moving too fast"
- Try the practice exercises after each tutorial
- Build a small project (certificate issuer, NFT collection)
- Go back and re-read sections
- Help someone else learn - teaching solidifies knowledge

### "The technical details are confusing"
- This is normal for Tutorial 4
- Focus on the practical explanations first
- Don't worry about CBOR encoding details initially
- Come back to technical sections later
- It becomes clearer with practice

---

## Learning Tips

### Tip 1: Read the Entire Tutorial First
Don't jump between sections. Read through completely to understand flow.

### Tip 2: Run Every Command
Don't just read - actually execute each command and see output.

### Tip 3: Examine Your Own Files
Open a token file and compare against examples in the tutorials.

### Tip 4: Keep Notes
Write down key commands and concepts as you learn.

### Tip 5: Practice Between Tutorials
Don't rush to next tutorial - practice what you learned.

### Tip 6: Explain It Back
Try explaining what you learned to someone else - clarifies understanding.

### Tip 7: Solve the Practice Exercises
These aren't optional - they cement learning.

---

## Common Learning Mistakes

### Mistake 1: Skipping Installation Verification
**Wrong**: "I'll skip the verification command"
**Right**: Run `npm run gen-address -- --help` - confirms everything works

### Mistake 2: Using Same Secret for Everyone
**Wrong**: Everyone uses `secret="password"`
**Right**: Alice uses `alice-secret`, Bob uses `bob-secret`

### Mistake 3: Not Saving Output
**Wrong**: "I'll remember the address/filename"
**Right**: Save addresses in a file, note exact filenames

### Mistake 4: Rushing Through
**Wrong**: Skipping explanations to get to next part
**Right**: Understand each section before moving on

### Mistake 5: Not Following Instructions Exactly
**Wrong**: "That flag doesn't matter, I'll skip it"
**Right**: Follow exact commands at first, customize later

---

## Success Stories

### Story 1: Complete Beginner
*"I had zero blockchain experience. Tutorial 1 made it so clear. I'm now running token operations daily!"*

### Story 2: Experienced Developer
*"I understood the concepts but needed to see how to use the CLI. Tutorial 2 and 3 gave me exactly what I needed."*

### Story 3: Production Deployment
*"Tutorials 1-5 taught me everything I needed for secure production. Tutorial 5 is a lifesaver."*

---

## After You Complete All Tutorials

Congratulations! You're now an Unicity CLI expert. Here are next steps:

### Continue Learning
- Explore [Unicity Network documentation](https://unicity.network)
- Read [SDK documentation](https://github.com/unicitynetwork/cli)
- Contribute to the project

### Build Something
- Create an NFT distribution system
- Build a token-based certificate system
- Integrate tokens into an application

### Share Your Knowledge
- Write a blog post about your experience
- Share scripts you created
- Help others learn the CLI

### Get Involved
- File issues and suggestions
- Contribute to documentation
- Join the community

---

## Still Have Questions?

### For Command Details
Check: [README.md](../README.md) - Complete command reference

### For Troubleshooting
Check: [TROUBLESHOOTING.md](../troubleshooting.md) - Common issues and solutions

### For Terms/Concepts
Check: [GLOSSARY.md](../glossary.md) - Definitions of all terms

### For FAQ
Check: [FAQ.md](../faq.md) - Frequently asked questions

### For Everything Else
1. Check supplementary guides linked in tutorials
2. Search the documentation
3. File an issue on GitHub

---

## Your Learning Journey

```
START HERE ↓

🟢 Tutorial 1: Your First Token (15 min)
   ↓ (Understand basics)

🟢 Tutorial 2: Token Transfers (20 min)
   ↓ (Can transfer tokens)

🟡 Tutorial 3: Advanced Operations (25 min)
   ↓ (Can automate operations)

🟡 Tutorial 4: Token Internals (30 min)
   ↓ (Understand architecture)

🔴 Tutorial 5: Production Practices (20 min)
   ↓ (Production ready)

✨ EXPERT STATUS ✨
```

---

## Start Your Learning Now!

Ready? Pick your starting point:

1. **Brand new?** → [Tutorial 1: Your First Token](TUTORIAL_1_FIRST_TOKEN.md)
2. **Can already mint?** → [Tutorial 2: Token Transfers](TUTORIAL_2_TOKEN_TRANSFERS.md)
3. **Know the basics?** → [Tutorial 3: Advanced Operations](TUTORIAL_3_ADVANCED_OPERATIONS.md)
4. **Need deep knowledge?** → [Tutorial 4: Token Internals](TUTORIAL_4_TOKEN_INTERNALS.md)
5. **Going to production?** → [Tutorial 5: Production Practices](TUTORIAL_5_PRODUCTION_PRACTICES.md)

---

**Good luck with your learning journey!**

Questions? Check the [full tutorials index](README.md).

---

*Last updated: 2025-11-02*
