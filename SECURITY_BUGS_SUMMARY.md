# Security Test Bugs - Quick Reference

## TL;DR

Out of 59 failing security tests, only **3 are real CLI bugs**. The rest are test design issues expecting CLI-level validation of security properties that are enforced by the SDK/network.

## Real Bugs to Fix

### 1. Path Traversal in mint-token.ts (MEDIUM)
**Location:** `/home/vrogojin/cli/src/commands/mint-token.ts:519-533`
**Problem:** Output path not validated before fs.writeFileSync()
**Fix:** Add validateFilePath() call before line 519

```typescript
if (options.output) {
  const validation = validateFilePath(options.output, 'Output file');
  if (!validation.valid) {
    throwValidationError(validation);
  }
  outputFile = options.output;
}
```

### 2. Filename Sanitization (LOW)
**Location:** `/home/vrogojin/cli/src/commands/mint-token.ts:528`
**Problem:** Shell metacharacters in auto-generated filenames
**Fix:** Sanitize the address prefix

```typescript
const addressPrefix = addressBody.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '');
```

### 3. Coin Amount Validation (LOW)
**Location:** `/home/vrogojin/cli/src/commands/mint-token.ts:411`
**Problem:** Negative amounts and non-numeric input not rejected
**Fix:** Validate before creating BigInt

```typescript
const coinAmounts = options.coins.split(',').map((s: string) => {
  const trimmed = s.trim();
  
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(`Invalid coin amount: "${trimmed}" - must be numeric`);
  }
  
  const amount = BigInt(trimmed);
  
  if (amount < 0n) {
    throw new Error(`Invalid coin amount: ${amount} - must be non-negative`);
  }
  
  return amount;
});
```

## Not Bugs (56 tests)

### Access Control (3 tests)
- SEC-ACCESS-001: Signature validation is SDK/network responsibility
- SEC-ACCESS-003: Proof validation exists, field integrity is SDK
- SEC-ACCESS-EXTRA: Network enforces spent/unspent state

### Authentication (6 tests)
- ALL: CLI is thin client, doesn't validate ownership
- By design: Allows offline operation, zero-knowledge principle

### Data Integrity (7 tests)  
- ALL: SDK validates during deserialization
- CLI validates proofs, not field-level integrity

### Double-Spend (6 tests)
- ALL: Network consensus property, not CLI
- CLI is stateless, aggregator tracks global state

### Input Validation (4 passing, 1 not a bug)
- SEC-INPUT-006: Node.js handles large data fine

## Fix Priority

1. **Today:** BUG #1 (path traversal) - 10 minutes
2. **This week:** BUG #2 and #3 - 15 minutes total
3. **Document:** Add architecture notes to tests

## Test Suite Changes Needed

Mark as network-dependent or move to integration tests:
- All SEC-AUTH-* tests
- All SEC-DBLSPEND-* tests  
- SEC-ACCESS-001, 003, EXTRA
- Most SEC-INTEGRITY-* tests

Keep as CLI unit tests:
- SEC-INPUT-* tests (correctly identify CLI issues)
- SEC-ACCESS-002, 004 (file permissions awareness)

## Architecture Reminder

```
CLI Security Model:
├── Input Validation ✓ (CLI responsibility)
├── File I/O Safety ✓ (CLI responsibility)
├── Proof Validation ✓ (CLI calls SDK)
└── Ownership/Double-Spend ✗ (SDK/Network responsibility)
```

**Principle:** Thin Client, Thick Protocol

For full analysis, see `SECURITY_TEST_ANALYSIS.md` (15 KB detailed report)
