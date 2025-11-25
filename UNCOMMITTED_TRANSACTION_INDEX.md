# Uncommitted Transaction Error - Complete Analysis Index

## Quick Start

**Error:** "Ownership verification failed: Authenticator does not match source state predicate."

**When:** receive-token processes an offline transfer created with send-token --offline

**Root Cause:** Commitment signature not stored in uncommitted transaction; recreated with wrong key during submission

**Solution:** Store sender's commitment signature in uncommitted transaction, use pre-signed commitment in receive-token

## Documentation Files

This analysis includes 6 comprehensive documents:

### 1. UNCOMMITTED_TRANSACTION_ANALYSIS_SUMMARY.md
**Start here for a quick overview**
- Executive summary of the problem
- Evidence from the code
- Two-part solution explanation
- Files affected and implementation impact
- Testing strategy
- Conclusion

**Read this if you want:** A high-level understanding of what's wrong and how to fix it

---

### 2. UNCOMMITTED_TRANSACTION_ROOT_CAUSE.md
**Detailed technical analysis**
- Error message explanation
- Critical issue location with code snippets
- Why it's wrong (cryptographic explanation)
- What should happen (correct behavior)
- Two-part fix with detailed implementation
- Files to modify
- Why the ownership verification error occurs
- Testing approach

**Read this if you want:** To understand the deep technical details of why the error occurs

---

### 3. UNCOMMITTED_TRANSACTION_DATA_FLOW.md
**Data structures and flow diagrams**
- Key insight about the commitment signature
- Data structures involved (TransferCommitment, uncommitted transaction, token structures)
- Detailed flow comparison: current (broken) vs required (correct)
- Why recipient can't sign
- Cryptographic properties
- Code locations for implementation
- Analogy: check signature
- TypeScript type updates needed
- Summary with key insight

**Read this if you want:** To understand how data flows through the system and why signatures matter

---

### 4. UNCOMMITTED_TRANSACTION_CODE_LOCATIONS.md
**Exact code locations and changes needed**
- Issue summary
- Exact file and line locations for all changes:
  - Where commitment IS created (send-token.ts line 358)
  - Where uncommitted transaction IS created (send-token.ts line 500)
  - Where commitment IS RECREATED WITH WRONG KEY (receive-token.ts line 603)
- Data flow in committed vs uncommitted transactions
- Extract transfer details function
- Type definitions
- Scenario detection logic
- Implementation checklist
- Summary table showing current vs required behavior

**Read this if you want:** The exact code locations and what changes are needed at each location

---

### 5. UNCOMMITTED_TRANSACTION_FIX_REFERENCE.md
**Quick implementation guide**
- Problem in one sentence
- Root cause summary
- The fix in two parts with code examples:
  - Part 1: Store sender's signature in send-token.ts
  - Part 2: Use stored signature in receive-token.ts
- Key properties of TransferCommitment
- Type definitions to update
- Testing checklist
- Error messages (before and after fix)
- Summary
- Files to modify

**Read this if you want:** A practical guide to implementing the fix

---

### 6. UNCOMMITTED_TRANSACTION_VISUAL_GUIDE.md
**Diagrams and visual explanations**
- Core problem: Who signs what?
- Current (broken) code path with full diagram
- Required (correct) code path with full diagram
- Data structure before and after (with JSON examples)
- Cryptographic binding explanation
- Why offline transfers need stored signatures
- The three keys involved (with common mistakes)
- Implementation locations quick reference
- Decision tree for when to use what key
- Summary diagram showing before/after

**Read this if you want:** Visual explanations and diagrams to understand the flow

---

## Reading Paths

### Path 1: "Just Tell Me What's Wrong" (5 minutes)
1. UNCOMMITTED_TRANSACTION_ANALYSIS_SUMMARY.md - Problem and solution overview

### Path 2: "I Need to Implement the Fix" (20 minutes)
1. UNCOMMITTED_TRANSACTION_ANALYSIS_SUMMARY.md - Understand the problem
2. UNCOMMITTED_TRANSACTION_CODE_LOCATIONS.md - Find exact locations
3. UNCOMMITTED_TRANSACTION_FIX_REFERENCE.md - Implementation guide

### Path 3: "I Want to Understand Everything" (45 minutes)
1. UNCOMMITTED_TRANSACTION_ANALYSIS_SUMMARY.md - Overview
2. UNCOMMITTED_TRANSACTION_ROOT_CAUSE.md - Technical details
3. UNCOMMITTED_TRANSACTION_DATA_FLOW.md - Data structures and flows
4. UNCOMMITTED_TRANSACTION_VISUAL_GUIDE.md - Diagrams
5. UNCOMMITTED_TRANSACTION_CODE_LOCATIONS.md - Exact locations
6. UNCOMMITTED_TRANSACTION_FIX_REFERENCE.md - Implementation

### Path 4: "I'm a Visual Learner" (15 minutes)
1. UNCOMMITTED_TRANSACTION_VISUAL_GUIDE.md - All the diagrams
2. UNCOMMITTED_TRANSACTION_FIX_REFERENCE.md - Code examples

### Path 5: "I'm Implementing and Need Reference" (10 minutes)
1. UNCOMMITTED_TRANSACTION_CODE_LOCATIONS.md - Exact locations and changes
2. UNCOMMITTED_TRANSACTION_FIX_REFERENCE.md - Implementation guide
3. Keep UNCOMMITTED_TRANSACTION_VISUAL_GUIDE.md open for reference

## Key Files to Modify

1. **`/home/vrogojin/cli/src/commands/send-token.ts`**
   - **Line 356-367:** After creating TransferCommitment, extract signature
   - **Line 496-532:** Add `commitment` field to uncommitted transaction

2. **`/home/vrogojin/cli/src/commands/receive-token.ts`**
   - **Line 497-610:** In NEEDS_RESOLUTION scenario, use pre-signed commitment instead of recreating it

3. **`/home/vrogojin/cli/src/types/extended-txf.ts`**
   - Add `commitment` field to transaction type definition

4. **`/home/vrogojin/cli/src/utils/state-resolution.ts`**
   - Add `extractCommitment()` helper function
   - Update scenario detection to check for stored signature

## The Core Problem

The commitment signature **proves the sender authorized the transfer**. In offline mode:
- The sender creates the commitment and signs it with their key
- The signature is not stored
- When the recipient tries to submit, they recreate the commitment with their own key
- The recreated signature doesn't match the source state predicate (which has the sender's key)
- Aggregator rejects with "Authenticator does not match source state predicate"

## The Core Solution

Store the sender's commitment signature in the uncommitted transaction:
- After creating the commitment, extract its signature
- Store in the transaction structure
- When receiving, extract and use the pre-signed commitment
- Submit with the original signature (no recreation needed)
- Aggregator verifies the original signature matches the source state predicate
- Success!

## Key Insight

**You cannot sign on someone else's behalf.**

In offline transfers with different sender and recipient:
- Only the sender can create a valid signature with their key
- The recipient can't recreate the signature without the sender's secret
- The signature must be stored in the file
- This is cryptographic security 101

## Implementation Complexity

- **Lines of code to modify:** ~50-100
- **Files to change:** 4
- **Complexity level:** Medium
- **Risk level:** Low (isolated to offline transfer flow)
- **Breaking changes:** Yes, for files created with old code (need format migration or new creation)

## Testing Coverage

After fix, test:
1. Create offline transfer (verify commitment field exists)
2. Submit offline transfer (verify it succeeds)
3. Verify final state is CONFIRMED
4. Round-trip transfers (Alice → Bob → Charlie)
5. Offline transfers with state data commitment
6. Offline transfers with message
7. Edge cases (corrupted files, missing fields, etc.)

## Success Criteria

After implementing the fix:
1. Offline transfers create files with `commitment` field
2. receive-token can successfully submit offline transfers
3. Aggregator returns proof (not error)
4. Final status is CONFIRMED (or PENDING if using --offline)
5. No regression in online transfers or other commands

## Related Architecture

This fix relates to:
- Unicity Network's single-spend proof system (signatures prove ownership)
- Sparse Merkle Tree commitment model (aggregator creates proofs)
- Offline transfer pattern (asynchronous submission)
- State transition signing requirements (sender must authorize)

See `.dev/architecture/` for related documentation.

## Questions Answered

**Q: Why is the signature important?**
A: It proves the token owner (sender) authorized the transfer. Without it, anyone could claim to transfer someone else's token.

**Q: Why can't the recipient recreate the signature?**
A: Because it requires the sender's private key. The recipient doesn't have (and shouldn't have) the sender's secret.

**Q: Why wasn't this caught earlier?**
A: Because online transfers don't need stored signatures (aggregator is contacted immediately). Offline transfers expose this requirement.

**Q: Will this break existing files?**
A: Yes, files without `commitment` field won't work. Consider migration or versioning.

**Q: Is this a design flaw?**
A: No, it's a fundamental requirement of cryptographic proof systems. Any offline two-party transfer system needs this.

## Additional Resources

- `.dev/architecture/ownership-verification-summary.md` - How ownership verification works
- `.dev/architecture/trustbase-loading.md` - TrustBase configuration
- `tests/security/` - Security test suite covering transfers
- `CLAUDE.md` - Project documentation and conventions

---

**Last Updated:** 2025-11-25
**Analysis Scope:** send-token.ts and receive-token.ts offline/uncommitted transaction flow
**Error Reference:** "Ownership verification failed: Authenticator does not match source state predicate"
