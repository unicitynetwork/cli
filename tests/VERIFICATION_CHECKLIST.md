# Test Infrastructure Verification Checklist

Use this checklist to verify the test infrastructure is properly set up and functional.

## Prerequisites

### ✓ Required Tools

- [ ] **BATS** installed and accessible
  ```bash
  bats --version
  # Should show: Bats 1.x.x or higher
  ```

- [ ] **jq** installed
  ```bash
  jq --version
  # Should show: jq-1.x or higher
  ```

- [ ] **curl** installed
  ```bash
  curl --version
  # Should show: curl 7.x.x or higher
  ```

- [ ] **node** installed
  ```bash
  node --version
  # Should show: v16.x.x or higher
  ```

### ✓ Build Status

- [ ] **CLI built successfully**
  ```bash
  npm run build
  ls -la dist/index.js
  # File should exist and be recent
  ```

### ✓ Optional: Aggregator

- [ ] **Aggregator running** (optional, can skip external tests)
  ```bash
  curl http://localhost:3000/health
  # Should return 200 OK or equivalent
  ```

## File Structure Verification

### ✓ Configuration Files

- [ ] `/home/vrogojin/cli/tests/config/test-config.env` exists
  ```bash
  ls -la /home/vrogojin/cli/tests/config/test-config.env
  ```

### ✓ Helper Files

- [ ] `/home/vrogojin/cli/tests/helpers/common.bash` exists (465 lines)
- [ ] `/home/vrogojin/cli/tests/helpers/id-generation.bash` exists (298 lines)
- [ ] `/home/vrogojin/cli/tests/helpers/token-helpers.bash` exists (560 lines)
- [ ] `/home/vrogojin/cli/tests/helpers/assertions.bash` exists (609 lines)

  ```bash
  ls -la /home/vrogojin/cli/tests/helpers/*.bash
  wc -l /home/vrogojin/cli/tests/helpers/*.bash
  ```

### ✓ Setup File

- [ ] `/home/vrogojin/cli/tests/setup.bash` exists (70 lines)
  ```bash
  ls -la /home/vrogojin/cli/tests/setup.bash
  ```

### ✓ Directory Structure

- [ ] All test directories exist
  ```bash
  ls -ld /home/vrogojin/cli/tests/{unit,integration,e2e,regression,fixtures,tmp}
  ```

### ✓ Documentation

- [ ] `/home/vrogojin/cli/tests/README.md` exists
- [ ] `/home/vrogojin/cli/tests/INFRASTRUCTURE_SUMMARY.md` exists
- [ ] `/home/vrogojin/cli/tests/QUICK_REFERENCE.md` exists
- [ ] `/home/vrogojin/cli/tests/VERIFICATION_CHECKLIST.md` exists (this file)

  ```bash
  ls -la /home/vrogojin/cli/tests/*.md
  ```

### ✓ Sample Test

- [ ] `/home/vrogojin/cli/tests/unit/sample-test.bats` exists
  ```bash
  ls -la /home/vrogojin/cli/tests/unit/sample-test.bats
  ```

## Functionality Tests

### ✓ Helper Loading

- [ ] **Configuration loads without errors**
  ```bash
  bash -c "source /home/vrogojin/cli/tests/config/test-config.env && echo 'Config loaded'"
  ```

- [ ] **Common helpers load without errors**
  ```bash
  bash -c "source /home/vrogojin/cli/tests/helpers/common.bash && echo 'Common loaded'"
  ```

- [ ] **ID generation loads without errors**
  ```bash
  bash -c "source /home/vrogojin/cli/tests/helpers/id-generation.bash && echo 'ID gen loaded'"
  ```

- [ ] **Token helpers load without errors**
  ```bash
  bash -c "source /home/vrogojin/cli/tests/helpers/token-helpers.bash && echo 'Token helpers loaded'"
  ```

- [ ] **Assertions load without errors**
  ```bash
  bash -c "source /home/vrogojin/cli/tests/helpers/assertions.bash && echo 'Assertions loaded'"
  ```

- [ ] **Setup loads without errors**
  ```bash
  bash -c "source /home/vrogojin/cli/tests/setup.bash && echo 'Setup loaded'"
  ```

### ✓ ID Generation

- [ ] **Generate unique ID**
  ```bash
  bash -c "source /home/vrogojin/cli/tests/setup.bash && generate_unique_id"
  # Should output unique ID like: test-1699564321000000-12345-000001-a1b2c3d4e5f6g7h8
  ```

- [ ] **Generate token ID**
  ```bash
  bash -c "source /home/vrogojin/cli/tests/setup.bash && generate_token_id"
  # Should output token ID like: token-20231109-...
  ```

- [ ] **IDs are unique**
  ```bash
  bash -c "source /home/vrogojin/cli/tests/setup.bash && \
    id1=\$(generate_unique_id) && \
    id2=\$(generate_unique_id) && \
    [[ \$id1 != \$id2 ]] && echo 'IDs are unique' || echo 'ERROR: IDs match'"
  ```

### ✓ File Operations

- [ ] **Create temp file**
  ```bash
  bash -c "source /home/vrogojin/cli/tests/setup.bash && \
    setup_test && \
    file=\$(create_temp_file '.txt') && \
    [[ -f \$file ]] && echo 'Temp file created: '\$file || echo 'ERROR'"
  ```

- [ ] **Create temp directory**
  ```bash
  bash -c "source /home/vrogojin/cli/tests/setup.bash && \
    setup_test && \
    dir=\$(create_temp_dir) && \
    [[ -d \$dir ]] && echo 'Temp dir created: '\$dir || echo 'ERROR'"
  ```

### ✓ Environment Variables

- [ ] **Configuration variables set**
  ```bash
  bash -c "source /home/vrogojin/cli/tests/config/test-config.env && \
    echo 'UNICITY_AGGREGATOR_URL: '\$UNICITY_AGGREGATOR_URL && \
    echo 'UNICITY_CLI_BIN: '\$UNICITY_CLI_BIN"
  ```

- [ ] **CLI path resolution**
  ```bash
  bash -c "source /home/vrogojin/cli/tests/setup.bash && \
    cli_path=\$(get_cli_path) && \
    [[ -f \$cli_path ]] && echo 'CLI found: '\$cli_path || echo 'ERROR: CLI not found'"
  ```

### ✓ Sample Test Execution

- [ ] **Sample test runs successfully**
  ```bash
  bats /home/vrogojin/cli/tests/unit/sample-test.bats
  # Should pass all tests (or skip if aggregator unavailable)
  ```

- [ ] **Sample test with debug output**
  ```bash
  UNICITY_TEST_DEBUG=1 bats /home/vrogojin/cli/tests/unit/sample-test.bats -t | head -50
  # Should show debug output
  ```

## NPM Scripts Verification

### ✓ Test Scripts Defined

- [ ] **package.json has test scripts**
  ```bash
  npm run | grep test
  # Should show: test, test:all, test:unit, test:integration, test:e2e, test:regression, test:debug, test:verbose, test:keep-tmp
  ```

### ✓ Script Execution

- [ ] **Unit tests can be run**
  ```bash
  npm run test:unit 2>&1 | head -20
  # Should execute without errors (may skip tests if aggregator unavailable)
  ```

- [ ] **Debug mode works**
  ```bash
  npm run test:debug 2>&1 | head -20
  # Should show debug output
  ```

## Assertion Testing

### ✓ Basic Assertions Work

Run in bash:
```bash
bash <<'EOF'
source /home/vrogojin/cli/tests/setup.bash

# Test assert_equals
if assert_equals "foo" "foo" "Test equals"; then
  echo "✓ assert_equals works"
else
  echo "✗ assert_equals failed"
fi

# Test assert_not_equals
if assert_not_equals "foo" "bar" "Test not equals"; then
  echo "✓ assert_not_equals works"
else
  echo "✗ assert_not_equals failed"
fi

# Test assert_greater_than
if assert_greater_than 10 5 "Test greater than"; then
  echo "✓ assert_greater_than works"
else
  echo "✗ assert_greater_than failed"
fi

# Test file operations
setup_test
file=$(create_temp_file ".json")
echo '{"test": "value"}' > "$file"

if assert_file_exists "$file"; then
  echo "✓ assert_file_exists works"
else
  echo "✗ assert_file_exists failed"
fi

if assert_valid_json "$file"; then
  echo "✓ assert_valid_json works"
else
  echo "✗ assert_valid_json failed"
fi

if assert_json_field_equals "$file" ".test" "value"; then
  echo "✓ assert_json_field_equals works"
else
  echo "✗ assert_json_field_equals failed"
fi

cleanup_test
EOF
```

- [ ] All assertion tests pass

## Token Preset Constants

- [ ] **Token type constants defined**
  ```bash
  bash -c "source /home/vrogojin/cli/tests/helpers/token-helpers.bash && \
    echo 'TOKEN_TYPE_NFT: '\$TOKEN_TYPE_NFT && \
    echo 'TOKEN_TYPE_UCT: '\$TOKEN_TYPE_UCT && \
    echo 'TOKEN_TYPE_ALPHA: '\$TOKEN_TYPE_ALPHA && \
    echo 'TOKEN_TYPE_USDU: '\$TOKEN_TYPE_USDU && \
    echo 'TOKEN_TYPE_EURU: '\$TOKEN_TYPE_EURU"
  ```

- [ ] All constants are 64-character hex strings

## Integration Test (Optional)

If aggregator is running:

- [ ] **Can generate address**
  ```bash
  bash -c "source /home/vrogojin/cli/tests/setup.bash && \
    setup_test && \
    generate_address 'test-secret-$(generate_unique_id)' 'nft' && \
    echo 'Generated address: '\$GENERATED_ADDRESS"
  ```

- [ ] **Full integration test passes**
  ```bash
  # This would require the aggregator to be running
  # Run: npm run test:integration
  ```

## Cleanup Verification

- [ ] **Temp files are cleaned up**
  ```bash
  bash <<'EOF'
  source /home/vrogojin/cli/tests/setup.bash
  setup_test
  temp_dir=$TEST_TEMP_DIR
  echo "Temp dir: $temp_dir"
  cleanup_test
  [[ ! -d $temp_dir ]] && echo "✓ Cleanup works" || echo "✗ Cleanup failed"
EOF
  ```

- [ ] **Artifacts are preserved on failure**
  ```bash
  # Set UNICITY_TEST_KEEP_TMP=1 and verify files remain
  ```

## Documentation Verification

- [ ] **README is complete and readable**
  ```bash
  wc -l /home/vrogojin/cli/tests/README.md
  # Should show ~375 lines
  ```

- [ ] **Quick reference is accessible**
  ```bash
  head -20 /home/vrogojin/cli/tests/QUICK_REFERENCE.md
  # Should show quick reference header
  ```

- [ ] **Infrastructure summary is detailed**
  ```bash
  wc -l /home/vrogojin/cli/tests/INFRASTRUCTURE_SUMMARY.md
  # Should show ~450+ lines
  ```

## Final Checks

### ✓ All Components

- [ ] Configuration system working
- [ ] All helper modules loading
- [ ] ID generation producing unique IDs
- [ ] File operations creating files/directories
- [ ] Assertions functioning correctly
- [ ] Sample test passing (or skipping appropriately)
- [ ] NPM scripts defined and working
- [ ] Documentation complete and accurate
- [ ] Cleanup working properly

### ✓ Ready for Test Implementation

- [ ] Infrastructure is production-ready
- [ ] All 80+ helper functions available
- [ ] 25+ custom assertions available
- [ ] 30+ configuration options available
- [ ] Full documentation available
- [ ] Sample test demonstrates all features

## Summary

```
Total Files Created: 13
- Configuration: 1 file (test-config.env)
- Helpers: 4 files (common.bash, id-generation.bash, token-helpers.bash, assertions.bash)
- Setup: 1 file (setup.bash)
- Documentation: 4 files (README.md, INFRASTRUCTURE_SUMMARY.md, QUICK_REFERENCE.md, VERIFICATION_CHECKLIST.md)
- Sample: 1 file (sample-test.bats)
- Package.json: Updated with test scripts
- Directories: 8 directories (unit, integration, e2e, regression, config, helpers, fixtures, tmp)

Total Lines of Code: ~2,200+ lines
Helper Functions: 80+ functions
Assertions: 25+ custom assertions
Configuration Options: 30+ options
Documentation: 1,100+ lines
```

## Next Steps

Once all checks pass:
1. ✅ Infrastructure is ready for actual test implementation
2. ✅ Start implementing 313 test scenarios
3. ✅ Use helpers and assertions for all tests
4. ✅ Follow patterns from sample test
5. ✅ Leverage unique ID generation to avoid collisions
6. ✅ Use appropriate test categories (unit/integration/e2e/regression)

---

**Status**: Infrastructure implementation complete and ready for testing! 🚀
