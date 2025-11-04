# Edge Cases and Corner Cases Test Suite

Comprehensive test coverage for edge cases, boundary conditions, race conditions, and double-spend prevention in the Unicity CLI.

## Overview

This test suite implements **127+ edge case scenarios** documented in `/test-scenarios/edge-cases/`, focusing on:

- **State machine edge cases** - Invalid states, transitions, and consistency
- **Data boundaries** - Empty/null/huge inputs, Unicode, special characters
- **File system edge cases** - Permissions, disk full, symbolic links, concurrent access
- **Network edge cases** - Timeouts, failures, partial responses, offline mode
- **Concurrency** - Race conditions, parallel execution, ID uniqueness
- **Double-spend prevention** - All attack vectors, multi-device scenarios, network resilience

## Test Files

### 1. `test_state_machine.bats` (CORNER-001 to 006)
State machine and token status validation:
- **CORNER-001**: Legacy tokens without status field
- **CORNER-002**: Invalid status enum values
- **CORNER-003**: Concurrent status transitions
- **CORNER-004**: PENDING status with transactions (inconsistent)
- **CORNER-005**: TRANSFERRED status without transactions
- **CORNER-006**: Re-receive already CONFIRMED token

**Run**: `bats tests/edge-cases/test_state_machine.bats`

### 2. `test_data_boundaries.bats` (CORNER-007 to 018)
Input validation and boundary conditions:
- **CORNER-007**: Empty string as secret
- **CORNER-008**: Whitespace-only secrets
- **CORNER-009**: Unicode emoji in secrets (UTF-8)
- **CORNER-010**: Maximum length inputs (10MB+)
- **CORNER-011**: Null bytes in data
- **CORNER-012**: Zero coin amounts
- **CORNER-013**: Negative amounts (CRITICAL)
- **CORNER-014**: BigInt amounts > Number.MAX_SAFE_INTEGER
- **CORNER-015**: Odd-length hex strings
- **CORNER-016**: Mixed-case hex
- **CORNER-017**: Invalid hex characters
- **CORNER-018**: Empty token data

**Run**: `bats tests/edge-cases/test_data_boundaries.bats`

### 3. `test_file_system.bats` (CORNER-019 to 025)
File system edge cases and permissions:
- **CORNER-019**: Read-only filesystems
- **CORNER-020**: File overwrite behavior
- **CORNER-021**: Very long file paths (PATH_MAX)
- **CORNER-022**: Special characters in filenames
- **CORNER-023**: Disk full scenarios (manual)
- **CORNER-024**: Auto-generated filename collisions
- **CORNER-025**: Symbolic links
- **CORNER-025b**: Concurrent file reads

**Run**: `bats tests/edge-cases/test_file_system.bats`

### 4. `test_network_edge.bats` (CORNER-026 to 034)
Network failures and resilience:
- **CORNER-026**: Aggregator unavailable
- **CORNER-027**: Network timeouts
- **CORNER-028**: Partial/truncated JSON responses
- **CORNER-030**: DNS resolution failures
- **CORNER-031**: Very slow networks
- **CORNER-032**: Offline mode (--skip-network)
- **CORNER-033**: Connection refused
- **CORNER-034**: HTTP error codes (4xx, 5xx)

**Run**: `bats tests/edge-cases/test_network_edge.bats`

### 5. `test_concurrency.bats` (RACE-001 to 006)
Race conditions and parallel execution:
- **RACE-001**: Concurrent token creation with same ID
- **RACE-002**: Concurrent transfers from same token
- **RACE-003**: Concurrent writes to same file
- **RACE-004**: ID generation uniqueness
- **RACE-005**: Parallel test execution safety
- **RACE-006**: Concurrent receives of same package

**Run**: `bats tests/edge-cases/test_concurrency.bats`

### 6. `test_double_spend_advanced.bats` (DBLSPEND-001 to 022)
Double-spend attack vectors and prevention:

**Classic Scenarios:**
- **DBLSPEND-001**: Sequential double-spend (Alice→Bob, Alice→Carol)
- **DBLSPEND-002**: Concurrent double-spend (race condition)
- **DBLSPEND-003**: Replay attack (same commitment twice)
- **DBLSPEND-004**: Delayed submission (offline package hold)
- **DBLSPEND-005**: Extreme concurrency (5 simultaneous)
- **DBLSPEND-006**: Modified recipient in flight
- **DBLSPEND-007**: Multiple offline packages

**Time-Based:**
- **DBLSPEND-015**: Stale token file usage (days later)

**Multi-Device:**
- **DBLSPEND-010**: Same token on two devices

**Network Split:**
- **DBLSPEND-020**: Network partition scenarios (manual)

**Run**: `bats tests/edge-cases/test_double_spend_advanced.bats`

## Running Tests

### Run All Edge Case Tests
```bash
# All edge case tests
bats tests/edge-cases/

# With verbose output
UNICITY_TEST_DEBUG=1 bats tests/edge-cases/

# Specific category
bats tests/edge-cases/test_state_machine.bats
bats tests/edge-cases/test_double_spend_advanced.bats
```

### Run Individual Test
```bash
# Run specific test by name
bats tests/edge-cases/test_data_boundaries.bats -f "CORNER-007"

# Run with trace mode
UNICITY_TEST_TRACE=1 bats tests/edge-cases/test_concurrency.bats -f "RACE-004"
```

### Run with Different Aggregator
```bash
# Use custom aggregator
UNICITY_AGGREGATOR_URL=http://localhost:3000 bats tests/edge-cases/

# Skip external services
UNICITY_TEST_SKIP_EXTERNAL=1 bats tests/edge-cases/
```

## Test Configuration

Tests use the following environment variables:

```bash
# Aggregator configuration
export UNICITY_AGGREGATOR_URL="http://localhost:3000"
export UNICITY_AGGREGATOR_MAX_RETRIES=3
export UNICITY_AGGREGATOR_RETRY_DELAY=2

# Test behavior
export UNICITY_TEST_DEBUG=0          # Enable debug output
export UNICITY_TEST_TRACE=0          # Enable bash tracing
export UNICITY_TEST_KEEP_TMP=0       # Preserve temp files
export UNICITY_TEST_SKIP_EXTERNAL=0  # Skip external services

# Test infrastructure
export UNICITY_TEST_USE_UUID=0       # Use UUIDs instead of timestamp IDs
export UNICITY_CLI_TIMEOUT=30        # CLI command timeout (seconds)
```

## Test Helpers

All tests use shared helpers from `tests/helpers/`:

- **common.bash** - Setup, teardown, temp files, CLI execution
- **token-helpers.bash** - Mint, send, receive operations
- **assertions.bash** - Assert functions with detailed error messages
- **id-generation.bash** - Unique ID generation for test isolation

## Expected Behavior

### Graceful Error Handling
All edge case tests verify that the CLI:
- **Never crashes** with uncaught exceptions
- **Shows clear error messages** to users
- **Cleans up resources** even on failure
- **Handles timeouts** without hanging

### Double-Spend Prevention
Network-level prevention mechanisms ensure:
- **BFT consensus** orders all transactions atomically
- **Sparse Merkle Tree** tracks all spent states globally
- **Request ID uniqueness** prevents replay attacks
- **Only ONE** of multiple double-spend attempts can succeed

### File System Safety
Tests verify:
- **No file corruption** during concurrent operations
- **Atomic writes** where possible
- **Clear permission errors** when write fails
- **No security issues** with special characters in paths

## Test Results Interpretation

### Success Criteria
- **CLI exits cleanly** (no crashes)
- **Error messages are clear** and actionable
- **At most ONE** double-spend succeeds
- **File operations are safe** (no corruption)
- **Unique IDs are generated** (no collisions)

### Known Limitations
Some scenarios require manual testing:
- **CORNER-023**: Disk full (requires filesystem setup)
- **DBLSPEND-020**: Network partition (requires infrastructure)

These are documented with `skip` in test files.

### Critical Findings
Tests may identify issues requiring fixes:
- **Empty string secrets** (CORNER-007) - Should reject
- **Negative amounts** (CORNER-013) - CRITICAL validation gap
- **File locking** (RACE-003) - No protection against concurrent writes
- **Path traversal** (CORNER-022) - Should sanitize filenames

## Test Coverage

Total test scenarios: **127+**

| Category | Scenarios | File |
|----------|-----------|------|
| State Machine | 6 | test_state_machine.bats |
| Data Boundaries | 12 | test_data_boundaries.bats |
| File System | 7 | test_file_system.bats |
| Network Edge | 9 | test_network_edge.bats |
| Concurrency | 6 | test_concurrency.bats |
| Double-Spend | 10+ | test_double_spend_advanced.bats |

## Integration with CI/CD

Add to GitHub Actions workflow:

```yaml
- name: Run Edge Case Tests
  run: |
    bats tests/edge-cases/
  env:
    UNICITY_AGGREGATOR_URL: http://localhost:3000
    UNICITY_TEST_KEEP_TMP: 0
```

## Documentation References

- [Corner Case Test Scenarios](/test-scenarios/edge-cases/corner-case-test-scenarios.md)
- [Double-Spend Test Scenarios](/test-scenarios/edge-cases/double-spend-and-concurrency-test-scenarios.md)
- [Test Infrastructure](/tests/INFRASTRUCTURE_SUMMARY.md)
- [Quick Reference](/tests/QUICK_REFERENCE.md)

## Contributing

When adding new edge case tests:

1. **Document scenario** in `/test-scenarios/edge-cases/`
2. **Assign CORNER-XXX ID** following sequence
3. **Add test to appropriate file** (or create new file)
4. **Use unique IDs** via `generate_unique_id()`
5. **Verify graceful failure** (never crash)
6. **Update this README** with new test

## Support

For questions or issues:
- Review [test-scenarios/edge-cases/README.md](/test-scenarios/edge-cases/README.md)
- Check [tests/QUICKSTART.md](/tests/QUICKSTART.md)
- Run with `UNICITY_TEST_DEBUG=1` for detailed output
