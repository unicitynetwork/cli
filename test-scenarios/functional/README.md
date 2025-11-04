# Functional Test Scenarios

Comprehensive functional tests covering all CLI commands and workflows.

## Document
- [Test Scenarios](test-scenarios.md) - Complete functional test suite (96 scenarios)

## Coverage

### Command Tests
- **gen-address**: 16 tests (all presets, masked/unmasked)
- **mint-token**: 20 tests (all token types, predicates, options)
- **send-token**: 13 tests (offline packages, validation)
- **receive-token**: 7 tests (state updates, ownership)
- **verify-token**: 10 tests (all 4 ownership scenarios)

### Integration Tests
- Multi-hop transfers (Alice → Bob → Carol)
- Postponed commitment chains (1-3 levels)
- Complete offline transfer flows

### Error Handling
- Network failures
- Invalid inputs
- Edge cases

## Test Execution
~6 hours estimated for complete functional test suite
