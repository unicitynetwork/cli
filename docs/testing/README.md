# Testing Documentation

This directory contains comprehensive testing documentation for the Unicity CLI project, including test summaries, implementation guides, and quick reference materials.

## Contents

### Test Implementation Guides

- **[BATS_TEST_IMPLEMENTATION_SUMMARY.md](./BATS_TEST_IMPLEMENTATION_SUMMARY.md)**
  Complete guide to the Bats test framework implementation, including setup, structure, and best practices.

- **[TEST_SUITE_COMPLETE.md](./TEST_SUITE_COMPLETE.md)**
  Documentation of the complete test suite covering all CLI commands and scenarios.

- **[TEST_FIX_PATTERN.md](./TEST_FIX_PATTERN.md)**
  Patterns and approaches for fixing common test issues and failures.

- **[TEST_AUDIT_FIXES.md](./TEST_AUDIT_FIXES.md)**
  Audit results and fixes applied to the test suite.

### Test Summaries

- **[AGGREGATOR_TESTS_SUMMARY.md](./AGGREGATOR_TESTS_SUMMARY.md)**
  Summary of aggregator-specific test coverage and results.

- **[TESTS_QUICK_REFERENCE.md](./TESTS_QUICK_REFERENCE.md)**
  Quick reference guide for running and understanding tests.

### Quick Start Guides

- **[CI_CD_QUICK_START.md](./CI_CD_QUICK_START.md)**
  Quick start guide for setting up and running tests in CI/CD pipelines.

- **[EDGE_CASES_QUICK_START.md](./EDGE_CASES_QUICK_START.md)**
  Guide to edge case testing and validation scenarios.

## Running Tests

```bash
# Run all tests
bats test/

# Run specific test file
bats test/register.bats

# Run with verbose output
bats -p test/
```

## Test Structure

The test suite is organized into the following categories:

- **Unit Tests**: Individual function and component testing
- **Integration Tests**: Command-level testing with real SDK interactions
- **Edge Case Tests**: Boundary conditions and error scenarios
- **Security Tests**: Input validation and security vulnerability testing

## Test Coverage

The test suite includes 313 test scenarios covering:

- All CLI commands (register, add-key, set-proof-aggregator, etc.)
- Input validation and error handling
- Edge cases and boundary conditions
- Security vulnerabilities
- Configuration management
- Error messages and user feedback

## Related Documentation

- [Security Documentation](../security/) - Security test cases and vulnerabilities
- [Implementation Documentation](../implementation/) - Implementation details for tested features
- [Main Test Directory](/home/vrogojin/cli/test/) - Actual test files
