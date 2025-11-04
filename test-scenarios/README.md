# Test Scenarios

Comprehensive test documentation for the Unicity CLI.

**Total Test Coverage: 313 Scenarios**

## Test Categories

### Functional Tests
- **[functional/test-scenarios.md](functional/test-scenarios.md)** - 96 comprehensive functional test scenarios covering all commands, token types, and workflows

### Security Tests
- **[security/security-test-scenarios.md](security/security-test-scenarios.md)** - 68 security-focused test scenarios
- **[security/security-audit-summary.md](security/security-audit-summary.md)** - Security audit results (4/5 stars)
- **[security/security-hardening-examples.md](security/security-hardening-examples.md)** - Security hardening code examples

### Edge Cases & Concurrency
- **[edge-cases/corner-case-test-scenarios.md](edge-cases/corner-case-test-scenarios.md)** - 127 corner cases and edge conditions
- **[edge-cases/double-spend-and-concurrency-test-scenarios.md](edge-cases/double-spend-and-concurrency-test-scenarios.md)** - 22 double-spend prevention and concurrency tests

## Test Priorities

- **P0 (Critical)**: 68 tests - Core functionality, must pass before release
- **P1 (High)**: 106 tests - Important scenarios, should pass
- **P2 (Medium)**: 93 tests - Edge cases, nice to have
- **P3 (Low)**: 46 tests - Performance/optimization tests

## Test Execution Strategy

### Phase 1: Critical Tests (1-2 days)
- All P0/Critical tests from each document
- Focus: Core functionality + security blockers
- Success criteria: 100% pass rate required

### Phase 2: High Priority (3-4 days)
- All P1/High tests
- Focus: Important scenarios + attack vectors
- Success criteria: 95% pass rate

### Phase 3: Medium Priority (5-7 days)
- All P2/Medium tests
- Focus: Edge cases + additional security
- Success criteria: 80% pass rate

### Phase 4: Low Priority (As time permits)
- All P3/Low tests
- Focus: Performance + optimization
- Success criteria: 50% pass rate

**Total Time Estimate**: ~12-15 days for complete coverage

## Related Documentation
- **[../docs/](../docs/)** - User-facing documentation
- **[../.dev/](../.dev/)** - Developer documentation
