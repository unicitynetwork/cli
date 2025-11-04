# Unicity CLI Test Suite - Quick Start Guide

Get started with the BATS test suite in 5 minutes!

## TL;DR - Run Tests Now

```bash
# 1. Install BATS (if not already installed)
sudo apt-get install bats jq  # Ubuntu/Debian
# OR
brew install bats-core jq      # macOS

# 2. Build the CLI
npm install && npm run build

# 3. Start local aggregator
# (Adjust command for your setup)
docker run -p 3000:3000 unicity/aggregator

# 4. Run all tests
./tests/run-tests.sh

# OR run specific suite
./tests/run-tests.sh mint-token
```

## What's Included

📦 **80 Functional Tests** covering:
- ✅ gen-address (16 tests)
- ✅ mint-token (20 tests)
- ✅ send-token (13 tests)
- ✅ receive-token (7 tests)
- ✅ verify-token (10 tests)
- ✅ integration workflows (10 tests)

🛠️ **Helper Libraries**:
- `common.bash` - Core utilities
- `token-helpers.bash` - Token operations
- `assertions.bash` - Enhanced assertions

📚 **Documentation**:
- `README.md` - Full documentation
- `QUICKSTART.md` - This guide
- Inline comments in all tests

## Prerequisites Checklist

- [ ] **BATS installed** - `which bats` shows path
- [ ] **jq installed** - `which jq` shows path
- [ ] **CLI built** - `dist/index.js` exists
- [ ] **Aggregator running** - `curl http://localhost:3000/health` succeeds

## Common Use Cases

### Run All Tests
```bash
./tests/run-tests.sh
```

### Run Specific Command Tests
```bash
./tests/run-tests.sh gen-address   # Address generation tests
./tests/run-tests.sh mint-token    # Token minting tests
./tests/run-tests.sh send-token    # Token sending tests
./tests/run-tests.sh receive-token # Token receiving tests
./tests/run-tests.sh verify-token  # Token verification tests
./tests/run-tests.sh integration   # Integration workflows
```

### Run Single Test
```bash
# By test ID
bats tests/functional/test_gen_address.bats -f "GEN_ADDR-001"

# By description pattern
bats tests/functional/test_mint_token.bats -f "NFT with default"
```

### Run with Custom Aggregator
```bash
AGGREGATOR_ENDPOINT=http://localhost:4000 ./tests/run-tests.sh
```

### Run in Parallel (Faster)
```bash
# Requires GNU parallel
PARALLEL=true ./tests/run-tests.sh
```

### Debug Failing Test
```bash
# Enable debug output
DEBUG_TESTS=true VERBOSE=true bats tests/functional/test_mint_token.bats -f "MINT_TOKEN-001"

# Preserve test files (comment out teardown in test)
# Edit test file and comment: # teardown() { ... }
```

## Expected Output

### Successful Run
```
=== Checking Prerequisites ===
✓ BATS installed
✓ jq installed
✓ CLI built
✓ Aggregator running at http://localhost:3000

=== Running gen_address tests ===
✓ GEN_ADDR-001: Generate unmasked address with default UCT preset
✓ GEN_ADDR-002: Generate masked address with NFT preset
...
✓ GEN_ADDR-016: Generate masked address with text nonce (hashed)
✓ gen_address tests passed

=== Test Summary ===
Total suites: 6
Passed: 6
Failed: 0
✓ All test suites passed!
```

### Failed Test
```
✗ MINT_TOKEN-001: Mint NFT with default settings
  (in test file tests/functional/test_mint_token.bats, line 25)
    `assert_success' failed
  Expected: success (exit code 0)
  Actual: failure (exit code 1)
  Output: Error: Aggregator not reachable at http://localhost:3000
```

## Troubleshooting

### "BATS not found"
```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get install bats

# macOS
brew install bats-core

# From source
git clone https://github.com/bats-core/bats-core.git
cd bats-core
sudo ./install.sh /usr/local
```

### "Aggregator not reachable"
```bash
# Check if aggregator is running
curl http://localhost:3000/health

# If not running, start it:
# (Adjust command for your setup)
docker run -p 3000:3000 unicity/aggregator

# Or use a different endpoint
AGGREGATOR_ENDPOINT=http://your-aggregator:3000 ./tests/run-tests.sh

# Or skip network tests
# Tests will automatically skip if aggregator unavailable
```

### "CLI not built"
```bash
# Build the CLI
npm install
npm run build

# Verify build succeeded
ls -lh dist/index.js
```

### "Permission denied"
```bash
# Make test runner executable
chmod +x tests/run-tests.sh

# Make helper files readable
chmod +r tests/helpers/*.bash
```

### Tests Hanging
```bash
# Check if aggregator is responding
curl -v http://localhost:3000/health

# Increase timeout (if needed)
export BATS_TEST_TIMEOUT=300  # 5 minutes

# Run with verbose output to see where it hangs
VERBOSE=true ./tests/run-tests.sh
```

## Test File Structure

```
tests/
├── README.md              # Full documentation
├── QUICKSTART.md          # This guide
├── run-tests.sh           # Automated test runner
├── helpers/               # Helper function libraries
│   ├── common.bash        # Core utilities
│   ├── token-helpers.bash # Token operations
│   └── assertions.bash    # Enhanced assertions
└── functional/            # Functional test suites
    ├── test_gen_address.bats   # 16 address generation tests
    ├── test_mint_token.bats    # 20 token minting tests
    ├── test_send_token.bats    # 13 token sending tests
    ├── test_receive_token.bats # 7 token receiving tests
    ├── test_verify_token.bats  # 10 token verification tests
    └── test_integration.bats   # 10 integration tests
```

## Next Steps

1. **Run the tests** to verify everything works
2. **Read the full README** at `tests/README.md`
3. **Explore helper functions** in `tests/helpers/`
4. **Review test scenarios** in test files
5. **Add your own tests** following the existing patterns

## Test Examples

### Simple Test Structure
```bash
@test "GEN_ADDR-001: Generate unmasked address with default UCT preset" {
    # Arrange
    SECRET=$(generate_test_secret "gen-addr")

    # Act
    run_cli_with_secret "${SECRET}" "gen-address > address.json"

    # Assert
    assert_success
    assert_file_exists "address.json"
    assert_json_field_equals "address.json" "type" "unmasked"
}
```

### Complete Transfer Flow
```bash
@test "INTEGRATION-001: End-to-end offline transfer" {
    # Generate addresses
    bob_addr=$(generate_address "${BOB_SECRET}" "nft")

    # Mint token
    mint_token_to_address "${ALICE_SECRET}" "nft" '{"data":"test"}' "alice-token.txf"

    # Send offline
    send_token_offline "${ALICE_SECRET}" "alice-token.txf" "${bob_addr}" "transfer.txf"

    # Receive
    receive_token "${BOB_SECRET}" "transfer.txf" "bob-token.txf"

    # Verify
    verify_token "bob-token.txf" "--local"
    assert_success
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGGREGATOR_ENDPOINT` | `http://localhost:3000` | Aggregator URL |
| `PARALLEL` | `false` | Run tests in parallel |
| `VERBOSE` | `false` | Enable verbose output |
| `DEBUG_TESTS` | `false` | Enable debug output in tests |
| `TEST_DATA_DIR` | `/tmp/unicity-test-data` | Test file directory |

## Quick Reference

### Helper Functions

#### Common (`common.bash`)
- `generate_test_secret()` - Unique secret generation
- `run_cli_with_secret()` - Run CLI with SECRET
- `extract_json_field()` - Get JSON field value
- `is_valid_address()` - Validate address format

#### Token Helpers (`token-helpers.bash`)
- `generate_address()` - Generate address
- `mint_token_to_address()` - Mint token
- `send_token_offline()` - Create transfer package
- `receive_token()` - Complete transfer
- `verify_token()` - Verify token file

#### Assertions (`assertions.bash`)
- `assert_success` - Command succeeded
- `assert_failure` - Command failed
- `assert_output_contains` - Output contains text
- `assert_file_exists` - File exists
- `assert_json_field_equals` - JSON field matches value

## Support

- **Full Documentation**: See `tests/README.md`
- **Test Scenarios**: See `test-scenarios/functional/test-scenarios.md`
- **GitHub Issues**: Report problems or ask questions
- **Code Examples**: Review existing test files for patterns

## Summary

You now have a comprehensive test suite that:
- ✅ Covers all CLI commands
- ✅ Tests all token types and scenarios
- ✅ Provides robust helper libraries
- ✅ Includes detailed documentation
- ✅ Supports parallel execution
- ✅ Integrates with CI/CD

Happy testing! 🚀
