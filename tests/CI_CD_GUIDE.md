# Unicity CLI - CI/CD Integration Guide

Comprehensive guide to the Unicity CLI test infrastructure, CI/CD pipelines, and testing best practices.

## Table of Contents

- [Quick Start](#quick-start)
- [Test Suites](#test-suites)
- [Local Testing](#local-testing)
- [GitHub Actions Workflow](#github-actions-workflow)
- [Docker Testing Environment](#docker-testing-environment)
- [Pre-commit Hooks](#pre-commit-hooks)
- [Test Coverage Reports](#test-coverage-reports)
- [Debugging Test Failures](#debugging-test-failures)
- [Best Practices](#best-practices)
- [CI/CD Architecture](#cicd-architecture)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Run All Tests

```bash
# Using NPM
npm test

# Using master test runner directly
./tests/run-all-tests.sh

# With specific configuration
./tests/run-all-tests.sh --all --verbose --debug
```

### Run Specific Test Suites

```bash
# Functional tests only
npm run test:functional

# Security tests only
npm run test:security

# Edge case tests only
npm run test:edge-cases

# Unit tests only
npm run test:unit

# Quick smoke tests (unit tests only)
npm run test:quick
```

### Run Tests in Parallel

```bash
# Faster test execution
npm run test:parallel

# Or with master test runner
./tests/run-all-tests.sh --all --parallel
```

### Debug Mode

```bash
# Run with debug output and verbose assertions
npm run test:debug

# Or with custom options
./tests/run-all-tests.sh --all --debug --verbose
```

---

## Test Suites

The Unicity CLI test suite consists of 291+ tests organized into four main categories:

### 1. Functional Tests (96+ tests)
Tests core CLI functionality and command operations.

**Location**: `tests/functional/`

**Test Files**:
- `test_gen_address.bats` - Address generation functionality
- `test_mint_token.bats` - Token minting operations
- `test_send_token.bats` - Token sending functionality
- `test_receive_token.bats` - Token receiving operations
- `test_verify_token.bats` - Token verification logic
- `test_integration.bats` - End-to-end integration scenarios

**Run**:
```bash
npm run test:functional
./tests/run-all-tests.sh --functional
bats tests/functional/*.bats
```

### 2. Security Tests (68+ tests)
Tests security features, vulnerability prevention, and data protection.

**Location**: `tests/security/`

**Test Files**:
- `test_authentication.bats` - Authentication mechanisms
- `test_access_control.bats` - Access control and permissions
- `test_cryptographic.bats` - Cryptographic operations
- `test_data_integrity.bats` - Data integrity verification
- `test_input_validation.bats` - Input validation and sanitization
- `test_double_spend.bats` - Double-spend prevention

**Run**:
```bash
npm run test:security
./tests/run-all-tests.sh --security
bats tests/security/*.bats
```

### 3. Edge Case Tests (127+ tests)
Tests boundary conditions, edge cases, and unusual scenarios.

**Location**: `tests/edge-cases/`

**Test Files**:
- `test_data_boundaries.bats` - Data boundary conditions
- `test_concurrency.bats` - Concurrent operations
- `test_file_system.bats` - File system edge cases
- `test_network_edge.bats` - Network error conditions
- `test_state_machine.bats` - State machine edge cases
- `test_double_spend_advanced.bats` - Advanced double-spend scenarios

**Run**:
```bash
npm run test:edge-cases
./tests/run-all-tests.sh --edge-cases
bats tests/edge-cases/*.bats
```

### 4. Unit Tests
Basic unit tests for individual components.

**Location**: `tests/unit/`

**Test Files**:
- `sample-test.bats` - Sample unit tests

**Run**:
```bash
npm run test:unit
./tests/run-all-tests.sh --unit
bats tests/unit/*.bats
```

---

## Local Testing

### Prerequisites

Ensure all required tools are installed:

```bash
# BATS (Bash Automated Testing System)
# Ubuntu/Debian
sudo apt-get install bats

# macOS
brew install bats-core

# Verify installation
bats --version

# jq (JSON query tool)
# Ubuntu/Debian
sudo apt-get install jq

# macOS
brew install jq

# Node.js and npm (usually pre-installed)
node --version  # Should be 20+
npm --version
```

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the CLI**:
   ```bash
   npm run build
   ```

3. **Start local aggregator** (optional, required for some tests):
   ```bash
   # If running the aggregator locally:
   # Start it on http://localhost:3000
   docker run -p 3000:3000 unicity/aggregator:latest

   # Or set custom endpoint:
   export AGGREGATOR_ENDPOINT=http://custom-aggregator:3000
   ```

### Running Tests Locally

```bash
# Build first
npm run build

# Run all tests
npm test

# Run specific test suite
npm run test:functional

# Run with verbose output
npm run test:debug

# Run tests in parallel
npm run test:parallel

# Generate coverage reports
npm run test:coverage
```

### Test Output

Tests produce output in multiple formats:

- **TAP format** (Test Anything Protocol) - Console output
- **JSON reports** - `tests/reports/test-results.json`
- **HTML reports** - `tests/reports/test-results.html`
- **Coverage reports** - `tests/reports/coverage.{json,html,txt}`

---

## GitHub Actions Workflow

The CI/CD pipeline is configured in `.github/workflows/test.yml` and runs on:

- **Push to main/develop branches**
- **Pull requests**
- **Manual workflow dispatch**

### Pipeline Stages

#### 1. Quick Checks
- Code linting (ESLint)
- Build verification
- Dependencies installation

```yaml
Status: Always required to pass
Critical: Yes
Timeout: 10 minutes
```

#### 2. Test Discovery
- Scans test files
- Counts tests per suite
- Prepares test matrix

```yaml
Status: Informational
Output: Test counts by suite
```

#### 3. Environment Setup
- Starts aggregator service
- Waits for service readiness
- Prepares test environment

```yaml
Status: Prerequisite for tests
Health Check: Aggregator /health endpoint
Timeout: 2 minutes
```

#### 4. Test Execution (Matrix)
Runs tests in parallel by suite:

| Suite | Tests | Timeout | Critical |
|-------|-------|---------|----------|
| Functional | 96+ | 5 min | Yes |
| Security | 68+ | 5 min | Yes |
| Edge Cases | 127+ | 6.5 min | No |
| Unit | - | 3.5 min | Yes |

```yaml
Strategy: Matrix with fail-fast disabled
Services: Docker aggregator
Artifacts: Test results and reports
```

#### 5. Test Summary
- Consolidates results
- Generates summary report
- Comments on PR (if applicable)

```yaml
Status: Always runs (if any test ran)
Output: Consolidated test report
```

#### 6. CI Status Check
Final pass/fail determination.

```yaml
Status: Fail if critical tests failed
Exit Code: 0 (pass) or 1 (fail)
```

### Viewing Results

1. **GitHub Actions**
   - Navigate to repository → Actions
   - Select workflow run
   - View logs and artifacts

2. **Pull Request Comments**
   - Test results appear as PR comments
   - Shows pass/fail for each suite
   - Links to artifacts

3. **Artifacts**
   - Available for 30 days
   - Contains:
     - Test result JSON
     - HTML reports
     - Coverage statistics

### Workflow Configuration

Configure in `.github/workflows/test.yml`:

```yaml
# Environment variables
env:
  NODE_VERSION: '20'
  BATS_VERSION: '1.10.1'
  CI: true

# Schedule tests on specific branches
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

# Custom timeout and other settings
jobs:
  test:
    timeout-minutes: 10
    strategy:
      matrix:
        suite: [functional, security, edge-cases, unit]
```

---

## Docker Testing Environment

Complete isolated test environment using Docker Compose.

### Quick Start

```bash
# Start all services
docker-compose -f docker-compose.test.yml up

# Run tests in Docker
docker-compose -f docker-compose.test.yml run test-runner

# Interactive testing
docker-compose -f docker-compose.test.yml run cli bash

# Debug environment
docker-compose -f docker-compose.test.yml run debug bash

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

### Services

#### 1. Aggregator Service
- **Image**: `unicity/aggregator:latest`
- **Port**: 3000
- **Health Check**: `/health` endpoint
- **Volume**: Persistent data storage

```bash
# Check health
docker-compose -f docker-compose.test.yml exec aggregator curl http://localhost:3000/health
```

#### 2. CLI Service
- **Image**: Built from `Dockerfile.test`
- **Volume**: Entire project mounted
- **Depends On**: Aggregator service
- **Purpose**: Development and testing

```bash
# Run commands
docker-compose -f docker-compose.test.yml run cli npm test
docker-compose -f docker-compose.test.yml run cli npm run test:functional
docker-compose -f docker-compose.test.yml run cli bash
```

#### 3. Test Runner Service
- **Image**: Built from `Dockerfile.test`
- **Command**: Runs full test suite
- **Profile**: `ci` (not started by default)
- **Artifacts**: Generates reports

```bash
# Run full test suite
docker-compose -f docker-compose.test.yml --profile ci up test-runner
```

#### 4. Debug Service
- **Image**: Built from `Dockerfile.test`
- **Interactive**: TTY enabled
- **Profile**: `debug` (not started by default)
- **Purpose**: Debugging test failures

```bash
# Interactive debugging
docker-compose -f docker-compose.test.yml --profile debug run debug
```

### Volumes

```yaml
aggregator-data:        # Aggregator database
test-results:           # Test result outputs
test-reports:           # Generated reports
bats-tmp:              # BATS temporary files
```

### Environment Variables

```bash
# In docker-compose.test.yml or .env file
NODE_VERSION=20                           # Node.js version
BATS_VERSION=1.10.1                       # BATS version
AGGREGATOR_PORT=3000                      # Aggregator port
LOG_LEVEL=info                            # Log level
UNICITY_TEST_DEBUG=0                      # Debug mode
UNICITY_TEST_VERBOSE=0                    # Verbose output
CI=true                                   # CI mode
```

### Example Workflow

```bash
# 1. Build images
docker-compose -f docker-compose.test.yml build

# 2. Start aggregator and CLI
docker-compose -f docker-compose.test.yml up -d

# 3. Wait for aggregator
docker-compose -f docker-compose.test.yml exec aggregator curl -f http://localhost:3000/health

# 4. Run tests
docker-compose -f docker-compose.test.yml run cli npm test

# 5. View reports
docker-compose -f docker-compose.test.yml exec cli ls -la tests/reports/

# 6. Cleanup
docker-compose -f docker-compose.test.yml down -v
```

---

## Pre-commit Hooks

Automatic quality checks before committing code.

### Installation

```bash
# Configure Git to use .githooks
git config core.hooksPath .githooks

# Verify installation
git config core.hooksPath

# Make hook executable (usually done automatically)
chmod +x .githooks/pre-commit
```

### Checks Performed

1. **Sensitive Files Detection**
   - Prevents committing `.env` files
   - Prevents committing private keys
   - Prevents committing credentials

2. **Code Linting**
   - ESLint checks
   - Code style verification
   - Syntax validation

3. **Build Verification**
   - TypeScript compilation check
   - Build artifacts verification
   - Dependencies validation

4. **Quick Smoke Tests**
   - Unit tests (fast subset)
   - Critical functionality tests
   - Basic sanity checks

### Usage

Hooks run automatically on `git commit`:

```bash
# Normal commit (hooks run)
git commit -m "Fix something"

# Skip hooks (not recommended)
git commit --no-verify -m "Fix something"

# Skip hooks via environment variable
PRE_COMMIT_SKIP=1 git commit -m "Fix something"
```

### Customization

Edit `.githooks/pre-commit` to customize checks:

```bash
# Disable specific checks
# Comment out check functions in the script

# Add custom checks
# Add new functions following the pattern

# Modify timeout
TIMEOUT=60  # seconds
```

---

## Test Coverage Reports

Generate and analyze test coverage statistics.

### Generate Reports

```bash
# Generate all report formats
npm run test:coverage

# JSON report only
./tests/generate-coverage.sh --format json

# HTML report only
./tests/generate-coverage.sh --format html

# Text report only
./tests/generate-coverage.sh --format text

# Custom output directory
./tests/generate-coverage.sh --output /tmp/reports --all
```

### Report Formats

#### JSON Report (`coverage.json`)
Machine-readable coverage data:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "summary": {
    "totalFiles": 19,
    "totalTests": 291,
    "testSuites": 4
  },
  "details": [
    {
      "file": "test_gen_address",
      "suite": "functional",
      "testCount": 16,
      "lines": 150
    }
  ]
}
```

#### HTML Report (`coverage.html`)
Interactive web-based report:

- Visual statistics
- Test count by suite
- Detailed file listing
- Responsive design

Open in browser: `tests/reports/coverage.html`

#### Text Report (`coverage.txt`)
Human-readable summary:

```
═══════════════════════════════════════════════════════════════
Unicity CLI - Test Coverage Report
═══════════════════════════════════════════════════════════════

SUMMARY STATISTICS
Total Test Files:        19
Total Test Cases:        291
Average Tests/File:      15.3

TEST COVERAGE BY SUITE
edge-cases              127 tests
functional               96 tests
security                 68 tests
unit                      0 tests
```

### Coverage Analysis

Key metrics:

| Metric | Value | Target |
|--------|-------|--------|
| Total Tests | 291+ | >250 |
| Test Files | 19 | >15 |
| Test Suites | 4 | 4 |
| Coverage | Comprehensive | High |

### Trend Analysis

Track coverage over time:

```bash
# Generate reports weekly
0 0 * * 0 cd /path/to/cli && ./tests/generate-coverage.sh --all

# Archive reports
cp tests/reports/coverage.json archive/coverage-$(date +%Y-%m-%d).json
```

---

## Debugging Test Failures

### Common Issues and Solutions

#### 1. Aggregator Not Available

**Error**: `Aggregator not reachable at http://localhost:3000`

**Solution**:
```bash
# Start aggregator
docker run -p 3000:3000 unicity/aggregator:latest

# Or set custom endpoint
export AGGREGATOR_ENDPOINT=http://custom-host:3000

# Or run tests that don't require aggregator
npm run test:unit
```

#### 2. BATS Not Installed

**Error**: `bats: command not found`

**Solution**:
```bash
# Ubuntu/Debian
sudo apt-get install bats

# macOS
brew install bats-core

# Verify
bats --version
```

#### 3. Test Timeout

**Error**: `timeout: sending signal TERM to command...`

**Solution**:
```bash
# Increase timeout
./tests/run-all-tests.sh --timeout 600

# Or run without timeout (single suite)
bats tests/functional/test_gen_address.bats
```

#### 4. Module Not Found

**Error**: `Cannot find module '@unicitylabs/commons'`

**Solution**:
```bash
# Reinstall dependencies
npm ci

# Rebuild
npm run build

# Clear cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Debug Mode

Enable comprehensive debug output:

```bash
# Full debug mode
npm run test:debug

# Or with environment variable
UNICITY_TEST_DEBUG=1 npm test

# Keep temporary files for inspection
UNICITY_TEST_KEEP_TMP=1 npm test
```

### Verbose Output

```bash
# Show every assertion
UNICITY_TEST_VERBOSE=1 npm test

# With master test runner
./tests/run-all-tests.sh --verbose --debug
```

### Selective Test Execution

Run specific tests:

```bash
# Run single test file
bats tests/functional/test_gen_address.bats

# Run tests matching pattern
bats tests/functional/*.bats

# Run specific test case
bats --filter "should generate valid address" tests/functional/test_gen_address.bats
```

### Inspect Test Environment

```bash
# Run with debug shell
docker-compose -f docker-compose.test.yml run debug bash

# Inside container:
cd /app
npm run build
bats tests/functional/test_gen_address.bats
```

### View Test Output Files

```bash
# Temporary test files (keep with UNICITY_TEST_KEEP_TMP=1)
ls -la /tmp/bats-tmp/

# Test results
cat tests/results/test-output.log

# Test reports
cat tests/reports/test-results.json
```

---

## Best Practices

### Writing Tests

1. **Use Unique IDs**
   ```bash
   local test_id=$(generate_unique_id)
   ```

2. **Clean Up Resources**
   ```bash
   teardown() {
       # Remove temporary files
       rm -f "/tmp/test-${test_id}-*"
   }
   ```

3. **Test One Thing**
   - Each test should verify one behavior
   - Clear, descriptive test names
   - Proper assertions

4. **Use Helper Functions**
   ```bash
   # From helpers/
   source tests/helpers/common.bash
   source tests/helpers/token-helpers.bash
   source tests/helpers/assertions.bash
   ```

### Running Tests

1. **Local Development**
   ```bash
   npm run test:quick      # Fast feedback
   npm run test:functional # Feature work
   npm run test:debug      # Debugging
   ```

2. **Before Committing**
   ```bash
   npm run test:ci  # Generate reports
   ```

3. **Before Pushing**
   ```bash
   npm test  # All tests
   ```

4. **Parallel Execution**
   ```bash
   npm run test:parallel  # When safe
   ```

### Debugging Workflow

1. **Isolate the issue**
   - Run specific test suite
   - Run single test file
   - Run single test case

2. **Enable debug output**
   ```bash
   npm run test:debug
   UNICITY_TEST_DEBUG=1 npm test
   ```

3. **Keep temporary files**
   ```bash
   UNICITY_TEST_KEEP_TMP=1 npm test
   ```

4. **Use interactive shell**
   ```bash
   docker-compose -f docker-compose.test.yml run debug bash
   ```

---

## CI/CD Architecture

### Pipeline Overview

```
┌─────────────────────────────────────────────────────────┐
│ Git Push / Pull Request                                 │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │  Quick Checks (5 min)   │
        │ - Lint Code             │
        │ - Build Verification    │
        │ - Type Checking         │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │ Test Discovery          │
        │ Count tests per suite   │
        └────────────┬────────────┘
                     │
        ┌────────────▼─────────────────────────────┐
        │ Parallel Test Execution (Matrix)         │
        │ ┌─────────────┐ ┌─────────────┐         │
        │ │ Functional  │ │ Security    │         │
        │ │ (5 min)     │ │ (5 min)     │         │
        │ └─────────────┘ └─────────────┘         │
        │ ┌─────────────┐ ┌─────────────┐         │
        │ │ Edge Cases  │ │ Unit        │         │
        │ │ (6.5 min)   │ │ (3.5 min)   │         │
        │ └─────────────┘ └─────────────┘         │
        └────────────┬─────────────────────────────┘
                     │
        ┌────────────▼──────────────┐
        │ Test Summary & Reports    │
        │ - Generate HTML/JSON      │
        │ - Comment PR              │
        │ - Archive results         │
        └────────────┬──────────────┘
                     │
        ┌────────────▼──────────────┐
        │ Final Status Check        │
        │ Pass/Fail Determination   │
        └─────────────┬─────────────┘
                      │
         ┌────────────▼────────────┐
         │  Deployment (if pass)   │
         └─────────────────────────┘
```

### Data Flow

```
Tests               Reports             Artifacts
├─ Functional    ├─ JSON              ├─ test-results
├─ Security      ├─ HTML              ├─ coverage
├─ Edge Cases    ├─ Text              └─ logs
└─ Unit          └─ Coverage
       │               │                      │
       └───────────────┼──────────────────────┘
                       │
                   GitHub
                  Artifacts
                  (30 days)
```

### Environment Configuration

**GitHub Actions**:
- Node.js 20
- BATS 1.10.1
- Ubuntu latest
- Docker services

**Local Development**:
- Node.js 20+
- BATS installed
- jq installed
- Aggregator running (optional)

**Docker**:
- Alpine Linux
- Node.js 20
- BATS 1.10.1
- All dependencies pre-installed

---

## Troubleshooting

### Tests Not Running

1. **Check BATS installation**
   ```bash
   which bats
   bats --version
   ```

2. **Check test files exist**
   ```bash
   ls -la tests/functional/*.bats
   find tests -name "*.bats" -type f | wc -l
   ```

3. **Check permissions**
   ```bash
   chmod +x tests/run-all-tests.sh
   chmod +x .githooks/pre-commit
   chmod +x tests/generate-coverage.sh
   ```

### Intermittent Test Failures

1. **Check aggregator availability**
   ```bash
   curl -f http://localhost:3000/health
   ```

2. **Increase timeouts**
   ```bash
   ./tests/run-all-tests.sh --timeout 600
   ```

3. **Run sequentially**
   ```bash
   ./tests/run-all-tests.sh --all  # Not parallel
   ```

### Docker Issues

1. **Rebuild images**
   ```bash
   docker-compose -f docker-compose.test.yml build --no-cache
   ```

2. **Clean volumes**
   ```bash
   docker-compose -f docker-compose.test.yml down -v
   ```

3. **Check logs**
   ```bash
   docker-compose -f docker-compose.test.yml logs -f
   ```

### Git Hooks Not Working

1. **Verify hook path**
   ```bash
   git config core.hooksPath
   # Should output: .githooks
   ```

2. **Make executable**
   ```bash
   chmod +x .githooks/pre-commit
   ```

3. **Test hook manually**
   ```bash
   ./.githooks/pre-commit
   ```

### Performance Issues

1. **Run in parallel**
   ```bash
   npm run test:parallel
   ```

2. **Use quick tests**
   ```bash
   npm run test:quick
   ```

3. **Profile test execution**
   ```bash
   time npm test
   ```

---

## Additional Resources

- **BATS Documentation**: https://bats-core.readthedocs.io/
- **GitHub Actions**: https://docs.github.com/en/actions
- **Docker Compose**: https://docs.docker.com/compose/
- **Test Report Formats**: See generated reports in `tests/reports/`

---

## Support

For issues or questions:

1. Check this guide
2. Review test logs in `tests/reports/`
3. Run tests with debug mode: `npm run test:debug`
4. Check GitHub Actions logs
5. Open an issue with detailed error messages

---

**Last Updated**: 2024
**Version**: 1.0.0
**Maintained By**: Unicity Network
