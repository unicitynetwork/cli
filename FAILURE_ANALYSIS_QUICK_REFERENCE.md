# Test Failure Quick Reference

## One-Minute Summary
- **242 total tests** | **205 passing (84.7%)** | **31 failing (12.8%)** | **6 skipped (2.5%)**
- **3 CRITICAL issues** blocking core functionality
- **5 HIGH issues** affecting test execution
- **23 MEDIUM/LOW issues** affecting edge cases

---

## Critical Issues to Fix NOW

| Issue | Root Cause | Impact | Severity |
|-------|-----------|--------|----------|
| `assert_valid_json` failure | Function receives string instead of filename | AGGREGATOR-001, AGGREGATOR-010 fail | CRITICAL |
| `receive_token` no output file | File not created despite success | INTEGRATION-007, INTEGRATION-009 fail | CRITICAL |
| Missing `assert_true` function | Function not defined in test helpers | CORNER-027, CORNER-031 fail | CRITICAL |

---

## High Priority Issues to Fix Next

| Issue | Tests Affected | Files to Check | Quick Fix |
|-------|---------------|-----------------|-----------|
| Empty file output on invalid input | CORNER-012, 14, 15, 17, 18, 25 | mint-token.ts, send-token.ts | Validate before opening output file |
| Short secret fails before network test | CORNER-026, 27, 30, 33 | test_network_edge.bats | Use 8+ char secrets like "testnetwork123" |
| File path argument confusion | CORNER-028, 32 | test_network_edge.bats | Fix flag order: `-f <path> --local` |
| Unbound variable stderr_output | CORNER-032 | assertions.bash:126 | Fix variable name mismatch |

---

## What's NOT Actually Broken

✅ Core functionality (mint, send, verify, receive) works
✅ Security tests all passing (auth, integrity, crypto)
✅ Integration tests mostly passing
✅ Exit codes and error handling mostly correct
✅ Token validation working
✅ Crypto operations working

---

## File Locations

| Component | File | Issue |
|-----------|------|-------|
| Test assertion helpers | `tests/helpers/assertions.bash` | `assert_valid_json`, `assert_true`, variable scoping |
| Receive command | `src/commands/receive-token.ts` | Output file not being saved |
| Mint command | `src/commands/mint-token.ts` | Empty files on errors |
| Send command | `src/commands/send-token.ts` | Empty files on errors |
| Network edge tests | `tests/edge-cases/test_network_edge.bats` | Secret length, flag order |

---

## Estimated Fix Time

- **Phase 1 (CRITICAL):** 1-2 hours → Fixes ~10 tests
- **Phase 2 (HIGH):** 1-2 hours → Fixes ~15 tests
- **Phase 3 (MEDIUM/LOW):** 30 min → Fixes ~6 tests

**Total:** 3-4.5 hours to get to ~231/242 passing (95%+)

---

## Test Run Command (To Verify Fixes)

```bash
# Full test suite
npm test

# Quick feedback on key suites
npm run test:quick

# With detailed output for debugging
UNICITY_TEST_DEBUG=1 npm run test:functional
```

---

## For Detailed Analysis

See `/home/vrogojin/cli/FAILURE_ANALYSIS_REPORT.md` for:
- Full root cause analysis for each issue
- Detailed evidence from test logs
- Specific line numbers in source files
- Implementation guidance for fixes
