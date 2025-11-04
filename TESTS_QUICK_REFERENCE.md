# Unicity CLI Tests - Quick Reference Card

**Status**: ✅ Production Ready | **Total Tests**: 313 scenarios | **Framework**: BATS

---

## 🚀 Quick Start (30 seconds)

```bash
# Install, build, run
npm install && npm run build
npm test
```

**Requirements**: Node.js 18+, BATS, jq, local aggregator at port 3000

---

## 📊 Test Suite Overview

| Suite | Tests | Files | Priority | Duration |
|-------|-------|-------|----------|----------|
| Functional | 96 | 6 | P0-P1 | ~5 min |
| Security | 68 | 6 | P0-P1 | ~8 min |
| Edge Cases | 127+ | 6 | P1-P2 | ~7 min |
| **Total** | **291+** | **18** | - | **~20 min** |

---

## 🎯 Common Commands

### Run Tests

```bash
# All tests (sequential)
npm test

# Quick smoke tests (2 min)
npm run test:quick

# Specific suite
npm run test:functional
npm run test:security
npm run test:edge-cases

# Parallel execution (2x faster)
npm run test:parallel

# Single test file
bats tests/functional/test_gen_address.bats

# Single test case
bats tests/functional/test_gen_address.bats -f "GEN_ADDR-001"
```

### Debug Mode

```bash
# Enable debug output
UNICITY_TEST_DEBUG=1 npm test

# Keep temporary files
KEEP_TEST_FILES=1 npm test

# Verbose output
bats --tap tests/functional/

# Full debug
UNICITY_TEST_DEBUG=1 KEEP_TEST_FILES=1 bats -x tests/functional/test_gen_address.bats
```

### Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open tests/reports/coverage/index.html

# CI mode (JSON + HTML + JUnit)
npm run test:ci
```

---

## 📁 Directory Structure

```
tests/
├── functional/          # 96 tests - All commands, all scenarios
├── security/            # 68 tests - OWASP, double-spend, crypto
├── edge-cases/          # 127+ tests - Boundaries, errors, concurrency
├── helpers/             # 4 modules - common, id-gen, token-ops, assertions
├── config/              # 3 files - test-config, ci, endpoints
├── reports/             # Generated - JSON, HTML, JUnit, logs
└── run-all-tests.sh     # Master runner
```

---

## 🔑 Key Features

### Unique ID Generation
Every test generates unique IDs to avoid collisions:
```bash
# Format: test-{timestamp}-{pid}-{counter}-{random}
test-1730739200-12345-001-8f7a2b3c
```

### Test Isolation
- Dedicated temp directory per test
- Automatic cleanup (unless KEEP_TEST_FILES=1)
- No shared state
- Safe parallel execution

### Graceful Degradation
- Skips network tests if aggregator unavailable
- Clear error messages
- No crashes on edge cases

---

## 🧪 Test Categories

### Functional (tests/functional/)
- ✅ gen-address (16 tests) - All presets, masked/unmasked
- ✅ mint-token (20 tests) - All token types, coins, custom data
- ✅ send-token (13 tests) - Offline and immediate patterns
- ✅ receive-token (7 tests) - Transfer completion
- ✅ verify-token (10 tests) - Ownership verification
- ✅ integration (10 tests) - End-to-end workflows

### Security (tests/security/)
- 🔒 authentication (6 tests) - Wrong secrets, forgery
- 🔒 double-spend (6 tests) - Concurrent, sequential, replay
- 🔒 cryptographic (8 tests) - Proofs, signatures, merkle paths
- 🔒 input-validation (9 tests) - Injection attacks
- 🔒 access-control (5 tests) - Ownership, permissions
- 🔒 data-integrity (7 tests) - Tampering detection

### Edge Cases (tests/edge-cases/)
- ⚠️ state-machine (6 tests) - Invalid states, transitions
- ⚠️ data-boundaries (12 tests) - Empty, max, negative values
- ⚠️ file-system (8 tests) - Permissions, symlinks, disk full
- ⚠️ network-edge (10 tests) - Timeouts, failures, offline mode
- ⚠️ concurrency (6 tests) - Race conditions, parallel execution
- ⚠️ double-spend-adv (10+ tests) - Multi-device, time-based

---

## 🛠️ Helper Functions

### Common Operations

```bash
# Load helpers in test file
load '../helpers/common'
load '../helpers/token-helpers'
load '../helpers/assertions'

# Setup/teardown
setup() {
    setup_test  # Creates isolated temp dir
}

teardown() {
    teardown_test  # Cleanup
}

# Generate unique IDs
local test_id=$(generate_test_id "TEST_001")
local secret=$(generate_unique_secret "$test_id")

# Token operations
generate_address "alice"              # Creates alice_ADDRESS, alice_SECRET
mint_token "alice" "nft"              # Creates alice_TOKEN_FILE
send_token_offline "alice" "bob"      # Creates TRANSFER_alice_bob_FILE
receive_token "bob" "TRANSFER_alice_bob_FILE"  # Updates bob_TOKEN_FILE
verify_token "alice"                  # Verifies alice's token
```

### Assertions

```bash
# Basic
assert_success
assert_failure
assert_output "expected text"
assert_output --partial "substring"

# Files
assert_file_exists "$file"
assert_file_not_empty "$file"

# JSON
assert_json_field "$file" ".field" "expected_value"
assert_json_array_length "$file" ".array" 3

# Token-specific
assert_token_valid "$file"
assert_token_ownership "$file" "$expected_address"
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# Aggregator
export AGGREGATOR_URL=http://localhost:3000   # Default
export REQUIRE_AGGREGATOR=1                    # Fail if unavailable

# Test behavior
export UNICITY_TEST_DEBUG=1                    # Enable debug output
export KEEP_TEST_FILES=1                       # Preserve artifacts
export PARALLEL_TESTS=1                        # Enable parallel execution
export TEST_TIMEOUT=120                        # Timeout in seconds

# Output
export UNICITY_TEST_COLOR=1                    # Colored output
export UNICITY_TEST_VERBOSE=1                  # Verbose logging
```

### Files

- **tests/config/test-config.env** - Main configuration
- **tests/config/ci.env** - CI/CD specific
- **tests/config/aggregator-endpoints.env** - Network endpoints

---

## 🐳 Docker Testing

### Complete Environment

```bash
# Run all tests in Docker
docker-compose -f docker-compose.test.yml up

# Or interactive
docker-compose -f docker-compose.test.yml run cli bash
npm test
```

### Services

- `aggregator` - Unicity aggregator on port 3000
- `cli` - CLI with test suite
- `test-runner` - Automated test execution
- `debug` - Debug container

---

## 🔄 CI/CD Integration

### GitHub Actions

**Workflow**: `.github/workflows/test.yml`

**Triggers**:
- Push to main/develop
- Pull requests

**Stages**:
1. Quick checks (lint, build) - 2 min
2. Test discovery - 30 sec
3. Environment setup - 3 min
4. Parallel tests (matrix) - 10 min
5. Summary & reports - 1 min

**Total**: ~15-20 minutes

### Pre-commit Hooks

```bash
# Enable hooks
git config core.hooksPath .githooks

# Runs automatically on commit:
- Sensitive file detection
- Code linting
- Build verification
- Quick smoke tests (2 min)
```

---

## 📈 Reports

### Formats

- **TAP** - BATS native (default)
- **JSON** - Machine-readable
- **HTML** - Interactive browser view
- **JUnit XML** - CI/CD compatible
- **Text** - Human-readable summary

### Locations

```bash
tests/reports/
├── coverage/           # Coverage reports
│   ├── index.html      # Open in browser
│   └── coverage.json   # Machine-readable
├── junit/              # JUnit XML
├── logs/               # Execution logs
└── *.txt               # Text summaries
```

---

## 🚨 Common Issues

### Aggregator Not Running

```bash
# Error: "Aggregator not available"
# Fix: Start local aggregator
docker run -p 3000:3000 unicity/aggregator

# Or skip network tests
export REQUIRE_AGGREGATOR=0
npm test
```

### Test Failures

```bash
# Debug single test
UNICITY_TEST_DEBUG=1 KEEP_TEST_FILES=1 \
  bats tests/functional/test_gen_address.bats -f "GEN_ADDR-001"

# Check logs
cat tests/reports/logs/test-*.log

# View temp files
ls /tmp/unicity-tests-*/
```

### Permission Issues

```bash
# Make scripts executable
chmod +x tests/run-all-tests.sh
chmod +x tests/generate-coverage.sh
chmod +x .githooks/pre-commit
```

---

## 📚 Documentation

- **Quick Start**: `/home/vrogojin/cli/CI_CD_QUICK_START.md`
- **Complete Guide**: `/home/vrogojin/cli/tests/CI_CD_GUIDE.md`
- **Test Suite Overview**: `/home/vrogojin/cli/TEST_SUITE_COMPLETE.md`
- **This File**: `/home/vrogojin/cli/TESTS_QUICK_REFERENCE.md`

**Suite-specific**:
- `tests/functional/README.md`
- `tests/security/README.md`
- `tests/edge-cases/README.md`

---

## 🎯 Priority Tests

### P0 (Critical) - Must Pass
```bash
# Run only critical tests
bats tests/security/test_double_spend.bats
bats tests/security/test_authentication.bats
bats tests/functional/test_integration.bats
```

### Quick Smoke Test (2 min)
```bash
npm run test:quick
```

### Before Commit (5 min)
```bash
npm run build
npm run test:functional
```

### Before Release (20 min)
```bash
npm test
npm run test:coverage
```

---

## 💡 Tips & Best Practices

### Writing Tests

1. **Use unique IDs**: Always call `generate_test_id()` and `generate_unique_secret()`
2. **Load helpers**: `load '../helpers/common'` at top of file
3. **Isolate tests**: Use `setup()` and `teardown()`
4. **Clear names**: Follow pattern `@test "SUITE-NNN: Description"`
5. **Document**: Add comments explaining test logic

### Debugging

1. **One test at a time**: Use `-f` flag to run single test
2. **Enable debug**: `UNICITY_TEST_DEBUG=1`
3. **Keep files**: `KEEP_TEST_FILES=1`
4. **Check logs**: `tests/reports/logs/`
5. **Use verbose**: `bats --tap` or `bats -x`

### Performance

1. **Parallel execution**: `npm run test:parallel` (2x faster)
2. **Quick tests first**: `npm run test:quick`
3. **Skip network**: `export REQUIRE_AGGREGATOR=0`
4. **Selective suites**: Run only what you need

---

## ✅ Verification Checklist

Before running tests:
- [ ] Node.js 18+ installed
- [ ] BATS installed (`sudo apt install bats` or `brew install bats-core`)
- [ ] jq installed (`sudo apt install jq` or `brew install jq`)
- [ ] CLI built (`npm run build`)
- [ ] Aggregator running on port 3000
- [ ] All scripts executable (`chmod +x tests/*.sh`)

Before committing:
- [ ] Tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Linter passes (`npm run lint`)
- [ ] No sensitive files added
- [ ] Git hooks enabled (`git config core.hooksPath .githooks`)

Before releasing:
- [ ] All P0 tests pass
- [ ] Coverage report generated
- [ ] No critical issues identified
- [ ] CI/CD pipeline passes
- [ ] Documentation updated

---

## 🆘 Getting Help

### Documentation
1. Read `/home/vrogojin/cli/CI_CD_QUICK_START.md`
2. Check suite-specific READMEs
3. Review test examples in test files

### Debugging
1. Run with debug flags
2. Check logs in `tests/reports/logs/`
3. Examine temp files in `/tmp/unicity-tests-*/`

### Issues
1. Check CLAUDE.md for project context
2. Review TEST_SUITE_COMPLETE.md for known issues
3. See .dev/ directory for architecture docs

---

**Last Updated**: 2025-11-04
**Version**: 1.0.0
**Status**: Production Ready ✅
