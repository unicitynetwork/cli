# Edge Case Test Scenarios

Corner cases, race conditions, and concurrency tests.

## Documents
- [Corner Case Test Scenarios](corner-case-test-scenarios.md) - 127 unusual scenarios and edge cases
- [Double-Spend and Concurrency Test Scenarios](double-spend-and-concurrency-test-scenarios.md) - 22 race conditions and concurrent operations

## Focus Areas

### Corner Cases (127 scenarios)
- State machine edge cases
- Data type boundaries
- File system edge cases
- Network edge cases
- Cryptographic edge cases
- Transaction chains
- Predicates
- JSON/CBOR encoding
- Time-based scenarios
- Environment issues

### Concurrency & Double-Spend (22 scenarios)
- Double-spend attack vectors (7 tests)
- Race conditions (5 tests)
- Transaction chain manipulation (4 tests)
- Multi-device scenarios (3 tests)
- Network timing issues (3 tests)

## Critical Gaps Identified
- Empty string secrets bypass (CRITICAL)
- Negative amounts not validated (CRITICAL)
- Atomic file writes needed (HIGH)
- Nonce verification (CRITICAL)
- Timeout wrappers (MEDIUM)
