# Investigation Index: register-request and get-request Analysis

This directory contains a comprehensive investigation of the `register-request` and `get-request` command implementation. The investigation answers three key questions about how the commands handle state, transition, and RequestId generation.

---

## Quick Answers

### Q1: Why can the same secret and state be registered with different transition values?

**A:** RequestId is generated from only `publicKey + stateHash`, completely excluding the transition parameter. See `/home/vrogojin/cli/INVESTIGATION_SUMMARY.md#question-1` for details.

**Evidence:**
- File: `/home/vrogojin/cli/src/commands/register-request.ts:38`
- Code: `const requestId = await RequestId.create(signingService.publicKey, stateHash);`
- Result: Same secret+state → Same RequestId, regardless of transition

---

### Q2: Is the command actually submitting data to the aggregator?

**A:** Yes, the command submits data via `client.submitCommitment()` which sends `requestId`, `transactionHash`, and `authenticator` to the aggregator endpoint. See `/home/vrogojin/cli/INVESTIGATION_SUMMARY.md#question-2` for details.

**Evidence:**
- File: `/home/vrogojin/cli/src/commands/register-request.ts:44`
- Code: `const result = await client.submitCommitment(requestId, transactionHash, authenticator);`
- Result: Data is sent to aggregator via JSON-RPC POST request

**Important:** The original transition data is NOT sent, only its hash (transactionHash) and signature.

---

### Q3: Why would get-request return empty responses after registering?

**A:** The `get-request` command queries the aggregator using only the RequestId. Empty responses indicate the RequestId doesn't exist in the aggregator's database, which could be due to:
1. Registration failed silently
2. Different RequestId computed (different secret or state)
3. Data not yet persisted (wait for block commitment)
4. Wrong endpoint specified

See `/home/vrogojin/cli/INVESTIGATION_SUMMARY.md#question-3` for details.

---

## Documents Overview

### 1. INVESTIGATION_SUMMARY.md (START HERE)
**Purpose:** Concise summary of all findings with evidence
**Length:** ~300 lines
**Contents:**
- Answer to all three questions
- Evidence from code
- Mathematical formulas
- Design philosophy
- Recommendations

**Best for:** Getting a quick understanding of the issues

---

### 2. ANALYSIS.md (DETAILED FINDINGS)
**Purpose:** Deep analysis with complete code citations
**Length:** ~400 lines
**Contents:**
- Issue 1: RequestId generation details
- Issue 2: Data submission analysis
- Issue 3: Empty response diagnosis
- Design point: Why same secret+state yields same RequestId
- Data flow visualization
- Key findings table
- Recommendations for users and developers

**Best for:** Understanding the "why" behind each behavior

---

### 3. TECHNICAL_DEEP_DIVE.md (ALGORITHMS & CODE PATHS)
**Purpose:** Algorithm-level analysis with pseudocode
**Length:** ~400 lines
**Contents:**
- RequestId generation algorithm with pseudocode
- Data submission breakdown
- JSON-RPC request payloads
- Aggregator processing flow
- The transition data paradox
- Cryptographic commitment structure
- Import chain analysis
- Type definitions used

**Best for:** Developers who want to understand the technical implementation

---

### 4. CODE_FLOW_ANALYSIS.md (EXECUTION TRACE)
**Purpose:** Step-by-step execution trace with inline annotations
**Length:** ~500 lines
**Contents:**
- Complete annotated code for register-request.ts
- Complete annotated code for get-request.ts
- Data transformation chains
- Code locations reference table
- Critical findings matrix
- Execution sequences for different scenarios

**Best for:** Tracing exact execution paths and understanding data transformations

---

### 5. DEBUGGING_GUIDE.md (TESTING & TROUBLESHOOTING)
**Purpose:** Testing procedures and debugging techniques
**Length:** ~400 lines
**Contents:**
- Testing scenarios with expected results
- Code instrumentation suggestions
- Manual testing with curl
- Common issues and fixes
- Verification checklist
- Performance considerations

**Best for:** Testing the system and diagnosing actual problems

---

### 6. This File (INVESTIGATION_INDEX.md)
**Purpose:** Navigation guide for all investigation documents
**Best for:** Finding the right document for your needs

---

## Reading Paths by Use Case

### I want a quick answer
1. Read this file (INVESTIGATION_INDEX.md)
2. Read INVESTIGATION_SUMMARY.md (5 minutes)

### I want to understand the design
1. INVESTIGATION_SUMMARY.md
2. ANALYSIS.md (focus on "Design Philosophy" section)
3. TECHNICAL_DEEP_DIVE.md (focus on "Cryptographic Commitment Structure")

### I want to trace code execution
1. CODE_FLOW_ANALYSIS.md
2. Cross-reference with actual files in src/commands/

### I want to debug a problem
1. DEBUGGING_GUIDE.md
2. Run suggested test scenarios
3. Check "Common Issues and Fixes" table

### I'm a developer implementing changes
1. ANALYSIS.md (read "Recommendations for Developers")
2. CODE_FLOW_ANALYSIS.md (understand execution)
3. DEBUGGING_GUIDE.md (add logging and test)

### I want complete information
Read in this order:
1. INVESTIGATION_SUMMARY.md (overview)
2. ANALYSIS.md (detailed findings)
3. TECHNICAL_DEEP_DIVE.md (algorithms)
4. CODE_FLOW_ANALYSIS.md (execution)
5. DEBUGGING_GUIDE.md (testing)

---

## Key Files Referenced

### Source Code
- `/home/vrogojin/cli/src/commands/register-request.ts` - Register command implementation
- `/home/vrogojin/cli/src/commands/get-request.ts` - Get command implementation

### SDK Files (node_modules)
- `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/RequestId.js` - RequestId generation
- `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js` - Network submission
- `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/SubmitCommitmentRequest.js` - Payload structure
- `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/api/Authenticator.d.ts` - Signature container

---

## Critical Code Locations

| Question | Answer Location | Code Location |
|----------|-----------------|----------------|
| How is RequestId created? | TECHNICAL_DEEP_DIVE.md | RequestId.js:24-35 |
| What gets submitted? | ANALYSIS.md | AggregatorClient.js:24-27 |
| Does transition get included? | INVESTIGATION_SUMMARY.md | register-request.ts:38 vs 41 |
| Why same secret+state? | CODE_FLOW_ANALYSIS.md | RequestId.js:33-35 |
| How does get-request work? | CODE_FLOW_ANALYSIS.md | get-request.ts:27 |

---

## Findings Summary Table

| Finding | Answer | Document | Evidence |
|---------|--------|----------|----------|
| RequestId includes transition? | NO | ANALYSIS.md | RequestId.js:24-35 |
| Transition data submitted? | YES (as hash) | TECHNICAL_DEEP_DIVE.md | AggregatorClient.js:24-27 |
| Original transition sent? | NO | ANALYSIS.md | SubmitCommitmentRequest.js:58-65 |
| Same secret+state → Same RequestId? | YES | CODE_FLOW_ANALYSIS.md | RequestId.js:33-35 |
| Data persisted on aggregator? | DEPENDS | DEBUGGING_GUIDE.md | Needs actual aggregator |
| get-request queries by transition? | NO | CODE_FLOW_ANALYSIS.md | get-request.ts:27 |
| Can distinguish transitions? | NO (without keeping data) | ANALYSIS.md | Design analysis |

---

## Recommendations by Role

### For CLI Users
1. Keep the RequestId output after registration
2. Keep the original transition data if you need to verify later
3. Wait several seconds before calling get-request (for commitment)
4. Use explicit endpoint URL with `-e` flag
5. Check aggregator response indicates "SUCCESS"

See: INVESTIGATION_SUMMARY.md#recommendations

### For CLI Developers
1. Add debug logging to show RequestId computation
2. Add aggregator response validation
3. Add endpoint URL verification
4. Document that RequestId is state-based, not transition-based
5. Add tests for same secret+state with different transitions

See: ANALYSIS.md#recommendations and DEBUGGING_GUIDE.md

### For SDK Users
1. Understand RequestId design (state-based commitment)
2. Keep original data for later verification
3. Use transactionHash for transaction identification
4. Verify signatures match claimed transactions
5. Design systems around state + transition architecture

See: TECHNICAL_DEEP_DIVE.md#cryptographic-commitment-structure

---

## Testing Scenarios

All testing scenarios are documented in DEBUGGING_GUIDE.md with:
- Commands to run
- Expected results
- Interpretation of results
- Fixes if wrong

Quick reference:
1. **Scenario 1:** Same secret+state, different transitions → Same RequestId
2. **Scenario 2:** Different secrets, same state → Different RequestIds
3. **Scenario 3:** Register → Get flow → Verify persistence
4. **Scenario 4:** Aggregator health check

---

## Common Questions Answered

**Q: Is the transition data lost?**
A: The original transition string is hashed and not recoverable. However, you can verify a specific transition by:
1. Computing its hash (SHA256)
2. Comparing with transactionHash from aggregator

See: ANALYSIS.md#issue-2

**Q: Can I query by transition instead of RequestId?**
A: No. The query interface only accepts RequestId. To identify which transition was stored, you need to:
1. Query by RequestId
2. Get the transactionHash from response
3. Compare with SHA256 of each possible transition

See: CODE_FLOW_ANALYSIS.md#scenario-2

**Q: Why does register show SUCCESS but get-request finds nothing?**
A: Possible causes:
1. Registration failed at aggregator (despite "SUCCESS" message)
2. Different RequestId computed (different secret or state)
3. Data not yet committed (wait longer)
4. Wrong endpoint (querying different aggregator)

See: DEBUGGING_GUIDE.md#common-issues-and-fixes

**Q: Is this a bug?**
A: No, it's intentional design. RequestId is derived from source state, not transition. This allows multiple state transitions from the same source state.

See: ANALYSIS.md#design-philosophy

---

## Version Information

- SDK Version: @unicitylabs/state-transition-sdk 1.6.0-rc.fd1f327
- CLI Version: 1.0.0
- Investigation Date: 2025-11-02

---

## File Structure

```
/home/vrogojin/cli/
├── src/
│   └── commands/
│       ├── register-request.ts  ← Main focus
│       ├── get-request.ts       ← Main focus
│       └── ...
├── node_modules/
│   └── @unicitylabs/
│       ├── state-transition-sdk/
│       │   ├── RequestId.js     ← Critical implementation
│       │   ├── AggregatorClient.js
│       │   └── ...
│       └── commons/
├── INVESTIGATION_SUMMARY.md     ← START HERE
├── ANALYSIS.md
├── TECHNICAL_DEEP_DIVE.md
├── CODE_FLOW_ANALYSIS.md
├── DEBUGGING_GUIDE.md
└── INVESTIGATION_INDEX.md       ← YOU ARE HERE
```

---

## How to Use This Investigation

### For Quick Understanding (5 minutes)
1. Read this file
2. Read the quick answers at the top

### For Complete Understanding (30 minutes)
1. Read INVESTIGATION_SUMMARY.md
2. Skim ANALYSIS.md and TECHNICAL_DEEP_DIVE.md

### For Implementation or Debugging (varies)
1. Identify your use case in "Reading Paths by Use Case"
2. Follow the suggested reading order
3. Reference specific code locations and documents

### For Verification
1. Follow test scenarios in DEBUGGING_GUIDE.md
2. Compare actual results with expected results
3. Check "Common Issues and Fixes" if results differ

---

## Additional Resources

- Package.json: See build and test commands
- CLAUDE.md: Project-specific guidelines and architecture
- Git history: `git log` shows recent changes to these commands
- SDK documentation: Would be in @unicitylabs package docs

---

## Contact & Follow-up

If you need to investigate further:
1. Add debug logging per DEBUGGING_GUIDE.md
2. Run test scenarios per DEBUGGING_GUIDE.md
3. Check aggregator logs (if accessible)
4. Verify network connectivity with curl tests

For specific implementation changes, see ANALYSIS.md#recommendations section.

