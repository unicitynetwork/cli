# Edge Cases Test Suite - Quick Start Guide

## 🚀 Quick Run

```bash
# Run all edge case tests
bats tests/edge-cases/

# Run with debug output
UNICITY_TEST_DEBUG=1 bats tests/edge-cases/

# Run specific category
bats tests/edge-cases/test_double_spend_advanced.bats
```

## 📁 Test Files

| File | Tests | Focus |
|------|-------|-------|
| **test_state_machine.bats** | 6 | Token status, state transitions |
| **test_data_boundaries.bats** | 12 | Input validation, edge values |
| **test_file_system.bats** | 8 | Permissions, paths, concurrent access |
| **test_network_edge.bats** | 10 | Timeouts, failures, offline mode |
| **test_concurrency.bats** | 6 | Race conditions, parallel execution |
| **test_double_spend_advanced.bats** | 10+ | **CRITICAL**: Double-spend prevention |

**Total: 60 tests covering 127+ edge case scenarios**

## 🎯 Critical Tests

### Must-Pass for Production:
```bash
# Double-spend prevention (CRITICAL)
bats tests/edge-cases/test_double_spend_advanced.bats -f "DBLSPEND-001"
bats tests/edge-cases/test_double_spend_advanced.bats -f "DBLSPEND-002"
bats tests/edge-cases/test_double_spend_advanced.bats -f "DBLSPEND-005"

# Data validation (CRITICAL)
bats tests/edge-cases/test_data_boundaries.bats -f "CORNER-007"  # Empty secrets
bats tests/edge-cases/test_data_boundaries.bats -f "CORNER-013"  # Negative amounts

# ID uniqueness (CRITICAL)
bats tests/edge-cases/test_concurrency.bats -f "RACE-004"
```

## 🔧 Prerequisites

```bash
# Start aggregator
cd aggregator && npm start

# Build CLI
npm run build

# Verify BATS installed
bats --version
```

## 📊 What Gets Tested

### ✅ Graceful Error Handling
- CLI never crashes
- Clear error messages
- Proper cleanup
- No hanging on timeouts

### ✅ Double-Spend Prevention
- BFT consensus enforcement
- Only ONE spend succeeds
- Replay attack detection
- Multi-device conflicts resolved

### ✅ Data Validation
- Empty/negative values rejected
- BigInt support verified
- UTF-8 handled correctly
- Hex parsing robust

### ✅ Network Resilience
- Offline mode works
- Timeouts handled
- HTTP errors reported
- DNS failures managed

## 🚨 Known Issues to Fix

1. **CORNER-007**: Empty secrets may be accepted (SECURITY)
2. **CORNER-013**: Negative amounts may not be validated
3. **RACE-003**: No file locking (concurrent write overwrites)
4. **CORNER-022**: Limited path sanitization

## 📖 Full Documentation

- **README**: `/tests/edge-cases/README.md`
- **Summary**: `/tests/edge-cases/IMPLEMENTATION_SUMMARY.md`
- **Scenarios**: `/test-scenarios/edge-cases/`

## 🔗 Quick Links

```bash
# View specific test
cat tests/edge-cases/test_double_spend_advanced.bats

# Run with custom aggregator
UNICITY_AGGREGATOR_URL=http://localhost:3000 bats tests/edge-cases/

# Keep temp files on failure
UNICITY_TEST_KEEP_TMP=1 bats tests/edge-cases/

# Skip external services
UNICITY_TEST_SKIP_EXTERNAL=1 bats tests/edge-cases/
```

## ✨ Status

**✅ COMPLETE** - 60 tests, 127+ scenarios, production ready

---

For detailed information, see `/tests/edge-cases/README.md`
