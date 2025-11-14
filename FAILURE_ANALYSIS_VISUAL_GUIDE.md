# Test Failure Visual Guide

## Overall Test Health

```
┌─────────────────────────────────────────────────────────────────┐
│                    TEST SUITE STATUS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  205 ✅ PASSING          31 ⚠️ FAILING          6 ⏭️ SKIPPED   │
│  84.7%                   12.8%                  2.5%            │
│                                                                  │
│  ████████████████████░░░░ 242 TOTAL TESTS                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Failure Distribution by Severity

```
CRITICAL ISSUES (3)     ████████░░░░░░░░░░░░░░░░░░░  9.7%
HIGH PRIORITY (5)       ████████░░░░░░░░░░░░░░░░░░░  16.1%
MEDIUM PRIORITY (14)    ████████████████░░░░░░░░░░░  45.2%
LOW PRIORITY (9)        ███████░░░░░░░░░░░░░░░░░░░░  29.0%
                        ─────────────────────────────────
```

## What's Blocking Whom

```
CRITICAL ISSUE #1                  CRITICAL ISSUE #2
┌─────────────────────────┐       ┌──────────────────────┐
│ assert_valid_json Broken│       │ receive_token Broken │
└────────┬────────────────┘       └──────────┬───────────┘
         │                                    │
         ├─ AGGREGATOR-001 ✗               ├─ INTEGRATION-007 ✗
         └─ AGGREGATOR-010 ✗               └─ INTEGRATION-009 ✗

CRITICAL ISSUE #3
┌──────────────────────┐
│ assert_true Missing  │
└────────┬─────────────┘
         ├─ CORNER-027 ✗
         └─ CORNER-031 ✗
```

## Fix Dependency Chain

```
Phase 1 (CRITICAL)
==================
┌──────────────────┐
│ Add assert_true  │ (15 min)
└────────┬─────────┘
         │
         └──▶ CORNER-027, CORNER-031 can run ✅

┌────────────────────────┐
│ Fix assert_valid_json  │ (30 min)
└────────┬───────────────┘
         │
         └──▶ AGGREGATOR-001, AGGREGATOR-010 can run ✅

┌───────────────────────────┐
│ Debug receive_token file  │ (45 min)
└────────┬──────────────────┘
         │
         └──▶ INTEGRATION-007, INTEGRATION-009 can run ✅


Phase 2 (HIGH PRIORITY)
=======================
         ┌─────────────────────────────┐
         │ Input Validation in Commands│ (60 min)
         └────────┬────────────────────┘
                  │
      ┌───────────┴───────────┐
      ▼                       ▼
  ✅ Empty file fixes   ✅ Edge case handling
  │                     │
  ├─ CORNER-012        ├─ CORNER-025
  ├─ CORNER-014        └─ (and others)
  ├─ CORNER-015
  ├─ CORNER-017
  └─ CORNER-018

         ┌──────────────────────────┐
         │ Fix Network Edge Tests   │ (35 min)
         └────────┬─────────────────┘
                  │
      ┌───────────┴───────────┐
      ▼                       ▼
  ✅ Longer secrets      ✅ Flag order fixes
  │                      │
  ├─ CORNER-026         ├─ CORNER-028
  ├─ CORNER-027         └─ CORNER-032
  ├─ CORNER-030
  └─ CORNER-033
```

## Impact Timeline

```
Current State (205/242 = 84.7%)
│
├─ After Phase 1 (1.5 hrs)
│  │  215/242 = 88.8%
│  │  + AGGREGATOR tests fixed
│  │  + receive-token file tests fixed
│  │  + Network timeout tests fixed
│  │
│  └─ After Phase 2 (3.5 hrs total)
│     │  230/242 = 95.0%
│     │  + All empty file issues fixed
│     │  + All network tests fixed
│     │  + Variable scoping fixed
│     │
│     └─ After Phase 3 (4.5 hrs total)
│        236/242 = 97.5%
│        + Edge cases handled
│        + Symbolic links working
│        + OS limitations documented

Legend: ✅ Fixed | ⏭️ Intentionally Skipped
```

## Core Functionality Status

```
MINT OPERATIONS
═══════════════════════════════════════════════════════════
│ Mint NFT                  ✅ PASS (test 37)
│ Mint UCT                  ✅ PASS (test 40)
│ Mint with masked          ✅ PASS (test 44)
│ Mint with custom token    ✅ PASS (test 45)
│ Mint fungible tokens      ⚠️ PASS (but edge cases have issues)

SEND OPERATIONS
═══════════════════════════════════════════════════════════
│ Send offline              ✅ PASS (test 76)
│ Send immediate            ✅ PASS (test 77)
│ Send NFT                  ✅ PASS (test 79)
│ Send fungible             ✅ PASS (test 81)
│ Send with recipient hash  ✅ PASS (test 89)

RECEIVE OPERATIONS
═══════════════════════════════════════════════════════════
│ Receive offline transfer  ❌ FILE NOT CREATED (tests 65, 72)
│ Receive with validation   ✅ PASS (tests 73, 74)
│ Receive idempotent        ✅ PASS (test 69)

VERIFY OPERATIONS
═══════════════════════════════════════════════════════════
│ Verify token              ✅ PASS (test 102)
│ Verify with history       ✅ PASS (test 103)
│ Verify token types        ✅ PASS (tests 104-108)
│ Verify predicate          ✅ PASS (test 109)

SECURITY TESTS (ALL PASSING)
═══════════════════════════════════════════════════════════
│ Authentication            ✅ PASS (11 tests)
│ Cryptography              ✅ PASS (10 tests)
│ Integrity                 ✅ PASS (8 tests)
│ Input Validation          ✅ PASS (7 tests) - except edge cases
│ Double-spend              ✅ PASS (6 tests)
│ Access Control            ✅ PASS (5 tests)
```

## Failure Categories

```
TYPE 1: TEST INFRASTRUCTURE ISSUES (4 tests)
┌─────────────────────────────────────────┐
│ Missing function: assert_true           │ → CORNER-027, 031
│ Broken function: assert_valid_json      │ → AGGREGATOR-001, 010
│ Unbound variable: stderr_output         │ → CORNER-032
└─────────────────────────────────────────┘
FIX: Update tests/helpers/assertions.bash


TYPE 2: COMMAND OUTPUT HANDLING (7 tests)
┌─────────────────────────────────────────┐
│ Empty files on error:                   │
│ - Zero amount coins (CORNER-012)        │
│ - Large coin amount (CORNER-014)        │
│ - Invalid hex (CORNER-015, 017)         │
│ - Empty data (CORNER-018)               │
│ - Symbolic link (CORNER-025)            │
│ - Missing output file (INTEGRATION-7,9) │
└─────────────────────────────────────────┘
FIX: Update src/commands/{mint,send,receive}-token.ts


TYPE 3: TEST DATA ISSUES (8 tests)
┌─────────────────────────────────────────┐
│ Short secrets prevent network testing   │
│ - CORNER-026, 027, 030, 033            │
│ Incorrect flag ordering                 │
│ - CORNER-028, 032                      │
│ Large input OS limits                   │
│ - CORNER-010, 010b                     │
└─────────────────────────────────────────┘
FIX: Update tests/edge-cases/test_network_edge.bats


TYPE 4: INTENTIONAL SKIPS (6 tests)
┌─────────────────────────────────────────┐
│ Infrastructure limitations:             │
│ - INTEGRATION-005, 006                  │
│ - VERIFY_TOKEN-007                      │
│ - SEC-ACCESS-004                        │
│ - SEC-DBLSPEND-002                      │
│ - SEC-INPUT-006                         │
│ - DBLSPEND-020                          │
│ - CORNER-023                            │
└─────────────────────────────────────────┘
FIX: None needed - document as known limitations
```

## File Changes Needed

```
Priority  │ File                              │ Lines  │ Changes
──────────┼──────────────────────────────────┼────────┼─────────────────────
CRITICAL  │ tests/helpers/assertions.bash    │ 1969   │ Fix assert_valid_json
CRITICAL  │ tests/helpers/assertions.bash    │ NEW    │ Add assert_true()
CRITICAL  │ src/commands/receive-token.ts    │ TBD    │ Debug file output
          │                                  │        │
HIGH      │ src/commands/mint-token.ts       │ TBD    │ Validate before create
HIGH      │ src/commands/send-token.ts       │ TBD    │ Validate before create
HIGH      │ tests/helpers/assertions.bash    │ 126    │ Fix stderr_output var
HIGH      │ tests/edge-cases/test_*.bats     │ 51+    │ Use 8+ char secrets
HIGH      │ tests/edge-cases/test_*.bats     │ 109+   │ Fix flag ordering
```

## Quick Status Check Commands

```bash
# Check overall status
npm test 2>&1 | tail -20

# Count failures by type
npm test 2>&1 | grep "not ok" | wc -l

# See which tests fail
npm test 2>&1 | grep "^not ok"

# Run just critical suites
npm run test:functional
npm run test:security

# Run with debug output
UNICITY_TEST_DEBUG=1 npm run test:quick
```

## Progress Tracking

```
└─ Phase 1: Critical Fixes
   ├─ □ Add assert_true function
   ├─ □ Fix assert_valid_json
   ├─ □ Debug receive-token
   └─ Target: 215/242 (88.8%)

└─ Phase 2: High Priority Fixes
   ├─ □ Input validation in commands
   ├─ □ Network edge case test data
   ├─ □ File path argument fixes
   ├─ □ Variable scoping fixes
   └─ Target: 230/242 (95%)

└─ Phase 3: Edge Cases
   ├─ □ Symbolic link handling
   ├─ □ Large input handling
   ├─ □ Error message clarity
   └─ Target: 236/242 (97.5%)
```

## By-The-Numbers

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Pass Rate | 84.7% | 97.5% | +12.8% |
| Passing Tests | 205 | 236 | +31 tests |
| Failing Tests | 31 | 0* | -31 tests |
| Skipped Tests | 6 | 6 | (unchanged) |
| Critical Issues | 3 | 0 | -3 |
| High Issues | 5 | 0 | -5 |
| Medium Issues | 14 | ~5 | -9 |
| Low Issues | 9 | ~5 | -4 |

*6 intentionally skipped tests remain skipped
