# Unicity CLI Test Suite

Comprehensive test infrastructure for the Unicity CLI using the BATS (Bash Automated Testing System) framework.

## Overview

This test suite provides production-ready testing infrastructure for 313 test scenarios across 4 categories:
- **Unit Tests**: Individual command and function testing
- **Integration Tests**: Multi-step workflows and component integration
- **E2E Tests**: Complete end-to-end scenarios
- **Regression Tests**: Prevent previously fixed bugs from reappearing

## Directory Structure

```
tests/
├── README.md                    # This file
├── setup.bash                   # Global test setup (auto-loaded by BATS)
├── config/
│   └── test-config.env          # Test configuration and environment variables
├── helpers/
│   ├── common.bash              # Common utilities and CLI execution helpers
│   ├── id-generation.bash       # Unique ID generation (collision-resistant)
│   ├── token-helpers.bash       # Token operation wrappers (mint/send/receive)
│   └── assertions.bash          # Custom assertion functions with colored output
├── fixtures/                    # Test fixtures and sample data
├── tmp/                         # Temporary files (auto-cleaned)
├── unit/                        # Unit tests
├── integration/                 # Integration tests
├── e2e/                         # End-to-end tests
└── regression/                  # Regression tests
```

## Requirements

### Dependencies

- **BATS** (v1.5.0+): Bash testing framework
  ```bash
  # Install on macOS
  brew install bats-core

  # Install on Ubuntu/Debian
  sudo apt-get install bats

  # Install from source
  git clone https://github.com/bats-core/bats-core.git
  cd bats-core
  sudo ./install.sh /usr/local
  ```

- **jq**: JSON processor
  ```bash
  # macOS
  brew install jq

  # Ubuntu/Debian
  sudo apt-get install jq
  ```

- **curl**: HTTP client (usually pre-installed)

### Environment Setup

1. Build the CLI:
   ```bash
   npm run build
   ```

2. Start the local aggregator:
   ```bash
   # Run aggregator on http://localhost:3000
   ```

3. Configure test environment (optional):
   ```bash
   # Set custom aggregator URL
   export UNICITY_AGGREGATOR_URL=http://localhost:3000

   # Enable debug mode
   export UNICITY_TEST_DEBUG=1

   # Keep temporary files after tests
   export UNICITY_TEST_KEEP_TMP=1
   ```

## Running Tests

### All Tests

```bash
npm test
# or
npm run test:all
```

### By Category

```bash
npm run test:unit          # Run unit tests only
npm run test:integration   # Run integration tests only
npm run test:e2e           # Run end-to-end tests only
npm run test:regression    # Run regression tests only
```

### With Debug Output

```bash
npm run test:debug         # Enable debug messages
npm run test:verbose       # Enable verbose assertions
npm run test:keep-tmp      # Keep temporary files for inspection
```

### Direct BATS Execution

```bash
# Run specific test file
bats tests/unit/test-mint-token.bats

# Run all tests in directory
bats tests/unit/

# Run with verbose output
bats -t tests/unit/

# Run specific test by name
bats -f "should mint NFT token" tests/unit/test-mint-token.bats
```

## Configuration

All configuration is managed through environment variables in `/home/vrogojin/cli/tests/config/test-config.env`.

### Key Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `UNICITY_AGGREGATOR_URL` | `http://localhost:3000` | Aggregator endpoint |
| `UNICITY_TEST_DEBUG` | `0` | Enable debug output (0=off, 1=on) |
| `UNICITY_TEST_KEEP_TMP` | `0` | Keep temp files after tests |
| `UNICITY_TEST_PARALLEL` | `0` | Enable parallel test execution |
| `UNICITY_TEST_SKIP_EXTERNAL` | `0` | Skip tests requiring external services |
| `UNICITY_CLI_BIN` | `dist/index.js` | Path to CLI binary |
| `UNICITY_TEST_COLOR` | `1` | Enable colored output |

## Writing Tests

### Test File Template

Create test files in the appropriate category directory (`unit/`, `integration/`, `e2e/`, `regression/`):

```bash
#!/usr/bin/env bats
# Test description goes here

# Load test helpers
load ../setup

# Setup function (runs before each test)
setup() {
  setup_test
  skip_if_aggregator_unavailable
}

# Teardown function (runs after each test)
teardown() {
  cleanup_test
}

@test "descriptive test name" {
  # Your test code here
  local secret="test-secret-$(generate_unique_id)"

  mint_token "$secret" "nft" "$TEST_TEMP_DIR/token.txf"

  assert_file_exists "$MINT_OUTPUT_FILE"
  assert_valid_token "$MINT_OUTPUT_FILE"
  assert_token_type "$MINT_OUTPUT_FILE" "nft"
}
```

### Available Helper Functions

#### ID Generation
- `generate_unique_id [prefix]` - Generate collision-resistant unique ID
- `generate_token_id` - Generate token-specific ID
- `generate_address_id` - Generate address-specific ID
- `generate_request_id` - Generate request-specific ID

#### Token Operations
- `generate_address <secret> [preset] [nonce]` - Generate address
- `mint_token <secret> <preset> [output] [data]` - Mint token
- `send_token_offline <secret> <input> <recipient> [output]` - Send offline
- `send_token_immediate <secret> <input> <recipient> [output]` - Send immediate
- `receive_token <secret> <input> [output]` - Receive token
- `verify_token <file>` - Verify token structure
- `verify_token_on_aggregator <file>` - Verify on aggregator

#### Token Queries
- `get_token_type <file>` - Extract token type
- `get_token_id <file>` - Extract token ID
- `get_token_recipient <file>` - Extract recipient
- `get_transaction_count <file>` - Count transactions
- `has_offline_transfer <file>` - Check for offline transfer
- `is_nft_token <file>` - Check if NFT
- `is_fungible_token <file>` - Check if fungible
- `get_coin_count <file>` - Get number of coins
- `get_total_coin_amount <file>` - Sum coin amounts

#### Assertions
- `assert_success` - Assert command succeeded (exit code 0)
- `assert_failure` - Assert command failed
- `assert_exit_code <code>` - Assert specific exit code
- `assert_output_contains <string>` - Assert output contains string
- `assert_output_matches <pattern>` - Assert output matches regex
- `assert_file_exists <file>` - Assert file exists
- `assert_valid_json <file>` - Assert valid JSON
- `assert_json_field_equals <file> <path> <value>` - Assert JSON field value
- `assert_json_field_exists <file> <path>` - Assert JSON field exists
- `assert_valid_token <file>` - Assert valid token structure
- `assert_has_offline_transfer <file>` - Assert has offline transfer
- `assert_token_type <file> <preset>` - Assert token type matches

#### Utilities
- `create_temp_file [suffix]` - Create temporary file
- `create_temp_dir [suffix]` - Create temporary directory
- `create_artifact_file <name>` - Create artifact file (preserved)
- `skip <message>` - Skip test with message
- `debug <message>` - Print debug message
- `info <message>` - Print info message
- `warn <message>` - Print warning message
- `error <message>` - Print error message

## Test Categories

### Unit Tests (`/home/vrogojin/cli/tests/unit/`)

Test individual CLI commands in isolation:
- Command argument parsing
- Input validation
- Output format verification
- Error handling

### Integration Tests (`/home/vrogojin/cli/tests/integration/`)

Test multi-step workflows:
- Mint + Send + Receive flows
- Multi-hop transfers
- State transitions
- Aggregator interactions

### E2E Tests (`/home/vrogojin/cli/tests/e2e/`)

Complete end-to-end scenarios:
- Full user journeys
- Real-world use cases
- Performance benchmarks
- Edge case handling

### Regression Tests (`/home/vrogojin/cli/tests/regression/`)

Prevent previously fixed bugs:
- Bug reproduction tests
- Edge case coverage
- Historical issue verification

## Unique ID Generation

The test suite uses a sophisticated ID generation system to prevent collisions in the append-only aggregator:

**Format**: `{prefix}-{timestamp}-{pid}-{counter}-{random}`

**Components**:
- **Timestamp**: Nanosecond precision (when available)
- **PID**: Process ID (for parallel test isolation)
- **Counter**: Thread-safe atomic counter
- **Random**: Cryptographically secure random bytes

**Thread Safety**: Uses `flock` for atomic counter increments, safe for parallel execution.

## Debugging Tests

### Debug Output

```bash
# Enable all debug output
UNICITY_TEST_DEBUG=1 bats tests/unit/test-mint-token.bats

# Enable verbose assertions
UNICITY_TEST_VERBOSE_ASSERTIONS=1 bats tests/

# Keep temp files for inspection
UNICITY_TEST_KEEP_TMP=1 bats tests/
```

### Inspect Test Artifacts

When `UNICITY_TEST_KEEP_TMP=1` is set, test artifacts are preserved:

```bash
# Temp files are saved to:
/tmp/bats-test-<pid>-<random>/test-<number>/

# Artifacts directory contains:
- mint-token-*.txf
- send-token-*.txf
- receive-token-*.txf
```

### Trace Mode

Enable bash trace mode for detailed execution:

```bash
UNICITY_TEST_TRACE=1 bats tests/unit/test-mint-token.bats
```

## Troubleshooting

### Aggregator Not Available

If tests fail with "Aggregator not available":

1. Check aggregator is running: `curl http://localhost:3000/health`
2. Configure correct URL: `export UNICITY_AGGREGATOR_URL=http://localhost:3000`
3. Skip external tests: `export UNICITY_TEST_SKIP_EXTERNAL=1`

### CLI Binary Not Found

If tests fail with "CLI binary not found":

1. Build the CLI: `npm run build`
2. Verify binary exists: `ls -la dist/index.js`
3. Configure correct path: `export UNICITY_CLI_BIN=dist/index.js`

### jq Not Found

Install jq:
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq
```

### BATS Not Found

Install BATS:
```bash
# macOS
brew install bats-core

# Ubuntu/Debian
sudo apt-get install bats
```

## Best Practices

1. **Use Unique IDs**: Always use `generate_unique_id()` for test data to avoid collisions
2. **Clean Up**: Use `setup_test()` and `cleanup_test()` for proper resource management
3. **Skip Unavailable Services**: Use `skip_if_aggregator_unavailable()` for external dependencies
4. **Descriptive Names**: Use clear, descriptive test names that explain what is being tested
5. **Assertions**: Use specific assertions (`assert_json_field_equals`) over generic ones
6. **Debug Mode**: Enable debug mode when developing tests to see detailed output
7. **Artifacts**: Save important test outputs as artifacts for debugging

## Performance

- **Test Duration**: Most tests complete in < 5 seconds
- **Parallel Execution**: Support for parallel test runs (set `UNICITY_TEST_PARALLEL=1`)
- **Resource Usage**: Minimal resource footprint with automatic cleanup

## Contributing

When adding new tests:

1. Follow the test file template structure
2. Add appropriate assertions with descriptive messages
3. Use helper functions for common operations
4. Include setup/teardown for proper isolation
5. Document complex test scenarios
6. Ensure tests are idempotent and can run in any order

## License

ISC
