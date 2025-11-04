# Unicity CLI Repository Structure

This document provides an overview of the folder organization for the Unicity CLI repository.

## Repository Root Structure

```
/home/vrogojin/cli/
├── docs/                        # All documentation
│   ├── security/               # Security reports and advisories
│   ├── testing/                # Test documentation
│   ├── implementation/         # Implementation details
│   ├── archive/                # Historical documents
│   ├── guides/                 # User guides
│   ├── reference/              # Technical reference
│   └── tutorials/              # Tutorial series
├── scripts/                    # Utility scripts
│   └── debug/                  # Debug and development tools
├── src/                        # Source code
├── test/                       # Test files
├── .dev/                       # Development resources
├── README.md                   # Project overview
├── CLAUDE.md                   # Developer guidelines
└── package.json                # Project configuration
```

## Documentation Organization (/docs)

### Security Documentation (/docs/security)

Critical security reports and vulnerability analysis.

**Contents:**
- `CRITICAL_BUG_REPORT_AGGREGATOR_DOS.md` - DoS vulnerability documentation
- `SECURITY_ADVISORY_DOS_VULNERABILITY.md` - Security advisory
- `SECURITY_BUG_REPORT.md` - Additional security findings
- `REQUESTID_FORMAT_ANALYSIS.md` - Request ID security analysis
- `README.md` - Index and security reporting guidelines

### Testing Documentation (/docs/testing)

Comprehensive test suite documentation and guides.

**Contents:**
- `BATS_TEST_IMPLEMENTATION_SUMMARY.md` - Test framework guide
- `TEST_SUITE_COMPLETE.md` - Complete test suite documentation
- `TEST_FIX_PATTERN.md` - Test debugging patterns
- `TEST_AUDIT_FIXES.md` - Test audit results
- `AGGREGATOR_TESTS_SUMMARY.md` - Aggregator test coverage
- `TESTS_QUICK_REFERENCE.md` - Quick testing reference
- `CI_CD_QUICK_START.md` - CI/CD integration guide
- `EDGE_CASES_QUICK_START.md` - Edge case testing guide
- `README.md` - Testing documentation index

**Test Coverage:** 313 test scenarios covering all CLI commands and edge cases.

### Implementation Documentation (/docs/implementation)

Detailed implementation summaries and technical reports.

**Contents:**
- `IMPLEMENTATION_SUMMARY.md` - Overall implementation overview
- `FINAL_IMPLEMENTATION_SUMMARY.md` - Final implementation report
- `VALIDATION_FUNCTIONS_IMPLEMENTATION_SUMMARY.md` - Validation layer docs
- `VALIDATION_IMPLEMENTATION_REPORT.txt` - Technical validation report
- `VALIDATION_IMPLEMENTATION_COMPLETE.md` - Validation completion status
- `UNICITY_DATA_VALIDATION_AUDIT_REPORT.md` - Comprehensive validation audit
- `README.md` - Implementation documentation index

**Key Topics:** Command handlers, validation strategies, SDK integration, error handling.

### Archive (/docs/archive)

Historical documents and research artifacts.

**Contents:**
- `RESEARCH_COMPLETION_CERTIFICATE.txt` - Research phase completion record
- `README.md` - Archive index

### User Documentation (/docs/guides, /docs/reference, /docs/tutorials)

User-facing documentation organized by type:

- **guides/** - Detailed command and workflow guides
- **reference/** - Technical API reference and specifications
- **tutorials/** - Progressive learning path (beginner to expert)

See `/docs/README.md` for complete user documentation index.

## Scripts Organization (/scripts)

### Debug Scripts (/scripts/debug)

Development and debugging utilities.

**Contents:**
- `extract-pubkey.js` - Extract public keys from certificates
- `debug-cert-simple.js` - Certificate debugging tool
- `test-authenticator.js` - Authentication system testing
- `test-sdk-verify.js` - SDK verification utility
- `reproduce_bug.js` - Bug reproduction script
- `README.md` - Debug scripts documentation

**Usage:** Development and debugging only. Not part of production CLI.

### Main Scripts (/scripts)

Production utility scripts:
- `aggregator.sh` - Aggregator management script

## Source Code Organization (/src)

Main CLI source code organized by functionality:

- **commands/** - Individual command implementations
- **utils/** - Shared utility functions
- **validation/** - Input validation and sanitization
- **config/** - Configuration management

## Test Organization (/test)

Test files organized by test type:

- Unit tests for individual functions
- Integration tests for commands
- Edge case and boundary testing
- Security vulnerability testing

See `/docs/testing/` for comprehensive test documentation.

## Development Resources (/.dev)

Internal development documentation:

- `README.md` - Developer guidelines (CLAUDE.md)
- `codebase-analysis/` - Code analysis reports
- `reorganization-plan.md` - Repository structure planning

## Root Files

**Keep in Root:**
- `README.md` - Project overview and quick start
- `CLAUDE.md` - Developer instructions
- `FOLDER_STRUCTURE.md` - This document
- `package.json`, `package-lock.json` - Node.js configuration
- `tsconfig.json` - TypeScript configuration
- `.gitignore` - Git ignore rules
- `LICENSE` - Project license

**Organized Into Folders:**
- Documentation files → `/docs/`
- Debug scripts → `/scripts/debug/`
- Test artifacts → Removed

## Navigation Quick Reference

| Need | Location |
|------|----------|
| User documentation | `/docs/README.md` |
| Security reports | `/docs/security/README.md` |
| Test documentation | `/docs/testing/README.md` |
| Implementation details | `/docs/implementation/README.md` |
| Debug tools | `/scripts/debug/README.md` |
| Developer guidelines | `/CLAUDE.md` or `/.dev/README.md` |
| API reference | `/docs/reference/api-reference.md` |
| Getting started | `/docs/getting-started.md` |
| Tutorials | `/docs/tutorials/README.md` |

## Maintenance Guidelines

### When Adding Documentation

1. **Security reports** → `/docs/security/`
2. **Test documentation** → `/docs/testing/`
3. **Implementation details** → `/docs/implementation/`
4. **User guides** → `/docs/guides/`
5. **API reference** → `/docs/reference/`
6. **Tutorials** → `/docs/tutorials/`
7. Update the appropriate README.md index file

### When Adding Scripts

1. **Production utilities** → `/scripts/`
2. **Debug/development tools** → `/scripts/debug/`
3. **Test scripts** → `/test/`
4. Add documentation in the script's README.md

### When Archiving Documents

Move to `/docs/archive/` with context note in archive README.

## Benefits of This Structure

1. **Clear Organization**: Related documents grouped together
2. **Easy Navigation**: Index files in each directory
3. **Separation of Concerns**: User docs separate from technical reports
4. **Professional Appearance**: Clean root directory
5. **Maintainability**: Clear guidelines for where new files go
6. **Discoverability**: Logical folder names and comprehensive indexes

## Recent Changes (2025-11-04)

Reorganized documentation from flat root structure into organized folders:

- Moved 15+ documentation files from root to appropriate subdirectories
- Moved 5 debug scripts from root to `/scripts/debug/`
- Created index files (README.md) in each documentation subdirectory
- Removed test artifacts (register_response.txt, response.txt)
- Updated cross-references in existing documentation
- Added this FOLDER_STRUCTURE.md guide

All documentation remains accessible through index files and cross-references.

---

*Last Updated: 2025-11-04*
