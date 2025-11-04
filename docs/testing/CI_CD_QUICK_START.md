# Unicity CLI - CI/CD Quick Start

Quick reference guide for running tests and understanding the CI/CD pipeline.

## One-Minute Setup

```bash
# 1. Install dependencies
npm install

# 2. Build CLI
npm run build

# 3. Configure Git hooks (optional but recommended)
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit

# 4. Start aggregator (in separate terminal)
docker run -p 3000:3000 unicity/aggregator:latest
```

## Common Commands

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm run test:functional       # Functional tests (96+)
npm run test:security         # Security tests (68+)
npm run test:edge-cases       # Edge cases (127+)
npm run test:unit             # Unit tests
npm run test:quick            # Quick smoke tests (unit only)
```

### Run Tests in Parallel
```bash
npm run test:parallel
```

### Debug Mode
```bash
npm run test:debug            # Full debug output
UNICITY_TEST_DEBUG=1 npm test # With environment variable
```

### Generate Reports
```bash
npm run test:coverage         # Generate all report formats
npm run test:ci               # CI mode with reports
```

### Using Docker
```bash
docker-compose -f docker-compose.test.yml run cli npm test
```

## Test Statistics

| Suite | Tests | Time |
|-------|-------|------|
| Functional | 96+ | 5 min |
| Security | 68+ | 5 min |
| Edge Cases | 127+ | 6.5 min |
| Unit | - | 3.5 min |
| **Total** | **291+** | **20 min** |

## GitHub Actions Workflow

Tests run automatically on:
- **Push** to `main` or `develop`
- **Pull requests** to `main` or `develop`
- **Manual trigger** (workflow_dispatch)

### Pipeline Stages
1. Quick Checks (linting, build verification)
2. Test Discovery
3. Environment Setup (start aggregator)
4. Parallel Test Execution (matrix strategy)
5. Test Summary & Reports
6. Final Status Check

### View Results
- GitHub Actions tab → Select workflow → View logs
- Pull request comments (test results appear as comments)
- Artifacts tab (JSON/HTML reports, 30-day retention)

## Directory Structure

```
unicity-cli/
├── .github/
│   └── workflows/
│       └── test.yml                 # GitHub Actions workflow
├── .githooks/
│   ├── pre-commit                   # Pre-commit quality checks
│   └── README.md                    # Hooks documentation
├── docker-compose.test.yml          # Docker test environment
├── Dockerfile.test                  # Test image build
├── tests/
│   ├── run-all-tests.sh            # Master test runner
│   ├── generate-coverage.sh         # Coverage report generator
│   ├── CI_CD_GUIDE.md              # Comprehensive guide
│   ├── config/
│   │   └── ci.env                  # CI configuration
│   ├── functional/                  # Functional tests
│   ├── security/                    # Security tests
│   ├── edge-cases/                 # Edge case tests
│   ├── unit/                       # Unit tests
│   ├── helpers/                    # Test helpers
│   ├── results/                    # Test results (generated)
│   ├── reports/                    # Reports (generated)
│   └── setup.bash                  # Global test setup
├── package.json                     # NPM scripts
└── src/                            # Source code
```

## NPM Scripts Reference

```bash
# Building
npm run build                        # Compile TypeScript

# Testing
npm test                            # Run all tests
npm run test:all                    # All tests (same as above)
npm run test:functional             # Functional tests only
npm run test:security               # Security tests only
npm run test:edge-cases             # Edge cases only
npm run test:unit                   # Unit tests only
npm run test:quick                  # Quick smoke tests

# Advanced testing
npm run test:ci                     # CI mode with reports
npm run test:parallel               # Parallel execution
npm run test:debug                  # Debug mode
npm run test:coverage               # Generate coverage reports
npm run test:docker                 # Run in Docker

# Code quality
npm run lint                        # Run ESLint

# CLI commands
npm run gen-address                 # Generate address
npm run mint-token                  # Mint token
npm run send-token                  # Send token
npm run receive-token               # Receive token
npm run verify-token                # Verify token
```

## Troubleshooting

### Tests Won't Run
```bash
# Ensure CLI is built
npm run build

# Ensure BATS is installed
bats --version
# Ubuntu/Debian: sudo apt-get install bats
# macOS: brew install bats-core

# Ensure aggregator is running
curl -f http://localhost:3000/health
# docker run -p 3000:3000 unicity/aggregator:latest
```

### Tests Timeout
```bash
# Increase timeout
./tests/run-all-tests.sh --timeout 600

# Or skip external services
UNICITY_TEST_SKIP_EXTERNAL=1 npm test
```

### Module Not Found
```bash
# Reinstall and rebuild
npm ci
npm run build
```

### Git Hooks Not Working
```bash
# Configure hooks path
git config core.hooksPath .githooks

# Make executable
chmod +x .githooks/*

# Test directly
./.githooks/pre-commit
```

## Environment Variables

```bash
# Test execution
UNICITY_TEST_DEBUG=1              # Enable debug output
UNICITY_TEST_VERBOSE=1            # Enable verbose assertions
UNICITY_TEST_SKIP_EXTERNAL=1      # Skip aggregator dependency

# Test configuration
AGGREGATOR_ENDPOINT=http://custom:3000  # Custom aggregator URL
BATS_TMPDIR=/custom/tmp           # Custom temp directory
NODE_ENV=test                      # Node environment

# CI/CD
CI=true                            # CI mode
CI_PROVIDER=github                 # CI platform

# Performance
PARALLEL=true                      # Run tests in parallel
TIMEOUT=600                        # Test timeout (seconds)
```

## Docker Quick Reference

```bash
# Build test image
docker build -f Dockerfile.test -t unicity-cli-test .

# Run tests in Docker
docker-compose -f docker-compose.test.yml run cli npm test

# Interactive shell
docker-compose -f docker-compose.test.yml run debug bash

# View services
docker-compose -f docker-compose.test.yml ps

# View logs
docker-compose -f docker-compose.test.yml logs -f

# Clean up
docker-compose -f docker-compose.test.yml down -v
```

## Common Workflows

### Before Committing
```bash
npm run build
npm run test:quick     # Fast validation
npm run lint
```

### Before Pushing
```bash
npm test               # Full test suite
npm run test:coverage  # Generate reports
git push
```

### Debugging Test Failure
```bash
npm run test:debug                    # Full debug output
UNICITY_TEST_KEEP_TMP=1 npm test     # Keep temp files
ls -la /tmp/bats-tmp/                # Inspect temp files
```

### Running in CI/CD
```bash
# Docker
npm run test:docker

# Local (simulating CI)
npm run test:ci
./tests/run-all-tests.sh --all --reporter json --reporter html
```

## Report Locations

- **JSON**: `tests/reports/test-results.json`
- **HTML**: `tests/reports/test-results.html`
- **Coverage JSON**: `tests/reports/coverage.json`
- **Coverage HTML**: `tests/reports/coverage.html`
- **Coverage Text**: `tests/reports/coverage.txt`
- **Test Logs**: `tests/results/test.log`

Open HTML reports in browser:
```bash
open tests/reports/test-results.html    # macOS
xdg-open tests/reports/test-results.html # Linux
start tests/reports/test-results.html    # Windows
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `.github/workflows/test.yml` | GitHub Actions workflow |
| `.githooks/pre-commit` | Pre-commit quality checks |
| `tests/run-all-tests.sh` | Master test runner |
| `tests/generate-coverage.sh` | Coverage report generator |
| `docker-compose.test.yml` | Docker test environment |
| `Dockerfile.test` | Test image build file |
| `package.json` | NPM scripts and config |
| `tests/CI_CD_GUIDE.md` | Comprehensive guide |

## Getting Help

1. **Read the full guide**: `tests/CI_CD_GUIDE.md`
2. **Check hook docs**: `.githooks/README.md`
3. **View test output**: `tests/reports/` and `tests/results/`
4. **Run with debug**: `npm run test:debug`
5. **Check GitHub Actions logs** for CI failures

## Key Contacts

- **Documentation**: `tests/CI_CD_GUIDE.md`
- **Issues**: GitHub Issues
- **Questions**: Review this guide or CI_CD_GUIDE.md

---

**Last Updated**: 2024
**Version**: 1.0.0
**Maintained By**: Unicity Network
