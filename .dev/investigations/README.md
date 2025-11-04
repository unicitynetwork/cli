# Claude Code Intermediary Materials

This folder contains all intermediary materials generated during Claude Code operations for debugging, testing, and problem-solving.

## Documentation & Reports

### Investigation & Analysis
- **ANALYSIS.md** - Initial problem analysis
- **CODE_FLOW_ANALYSIS.md** - Detailed code flow analysis
- **INVESTIGATION_SUMMARY.md** - Summary of investigation findings
- **INVESTIGATION_INDEX.md** - Index of all investigation materials
- **README_INVESTIGATION.md** - Investigation overview

### Technical Deep Dives
- **TECHNICAL_DEEP_DIVE.md** - In-depth technical exploration
- **SPARSE_MERKLE_TREE_PROOFS.md** - SMT proof structure documentation
- **EXECUTIVE_SUMMARY.md** - High-level executive summary
- **VISUAL_REFERENCE.md** - Visual aids and diagrams

### Debugging Documentation
- **DEBUGGING_GUIDE.md** - Step-by-step debugging guide
- **AGGREGATOR_DEBUGGING_SUMMARY.md** - Aggregator-specific debugging summary
- **DOCUMENTS_CREATED.txt** - List of all documents created during investigation

## Debug Scripts

### Shell Scripts
- **debug-aggregator-response.sh** - Script to debug aggregator responses
- **test-register-issue.sh** - Script to test registration issues

### JavaScript Test Files
- **test-aggregator-flow.js** - Test aggregator workflow
- **test-check-exists.js** - Test commitment existence checking
- **test-compare-payloads.js** - Compare different payload formats
- **test-fresh-unique.js** - Test with fresh unique commitments
- **test-inclusion-proof-parsing.js** - Test inclusion proof parsing
- **test-mint-style-commitment.js** - Test mint-style commitment format
- **test-raw-aggregator.js** - Raw aggregator API testing
- **test-structured-commitment.js** - Test structured commitment format
- **test-wait-inclusion.js** - Test waiting for inclusion proofs
- **test-with-minter-secret.js** - Test with minter secret handling
- **debug-inclusion-proof.js** - Debug inclusion proof retrieval

## Source Code Artifacts

- **register-request-debug.ts** - Debug version of register-request command (not used in production)

## Purpose

These materials were created during the investigation and resolution of:
1. CLI command refactoring to generic commitment abstraction level
2. Aggregator integration debugging
3. Inclusion/exclusion proof handling
4. Sparse Merkle Tree proof structure understanding
5. Data cleanup and aggregator queue corruption issues

## Notes

- All materials in this folder are intermediary and not part of the production codebase
- Test scripts use local aggregator endpoint (http://localhost:3000)
- Documentation provides historical context for architectural decisions
- These files are excluded from git commits via .gitignore
