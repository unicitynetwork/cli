# Address Checksum - Quick Reference

## Format

```
DIRECT://[64 hex data][8 hex checksum]
         ├──32 bytes──┤├─4 bytes─┤
         
Example:
DIRECT://0000057e2a9d980704a1593bfd9fcb4b5a77c720e0a83f4a917165ff94addaca41db0f4216dc
         └────────────────────data────────────────────────┘└checksum┘
```

## Checksum Algorithm

```
SHA256(data)[0:4] → 4-byte checksum → 8 hex characters
```

## Validation

```typescript
import { AddressFactory } from '@unicitylabs/state-transition-sdk/lib/address/AddressFactory.js';

try {
    const addr = await AddressFactory.createAddress('DIRECT://...');
    // Valid - checksum verified
} catch (error) {
    // Invalid - error.message explains why
}
```

## Validation Rules

1. **Format:** `SCHEME://HEX`
2. **Scheme:** `DIRECT` or `PROXY`
3. **Hex:** Only `0-9a-fA-F`
4. **Length:** Exactly 72 hex chars
5. **Checksum:** Last 4 bytes = SHA256(first 32 bytes)[0:4]

## Current CLI Status

- ✓ Pre-validation: `/home/vrogojin/cli/src/utils/input-validation.ts:201-256`
- ✓ SDK validation: `/home/vrogojin/cli/src/commands/send-token.ts:301`
- ✓ Error handling: Exit code 1 on failure
- ✓ User-friendly error messages

## SEC-INPUT-007 Test

**Status:** FAILING (shell quoting bug in test, not validation bug)

**Fix:** Change from string to array in test_input_validation.bats:

```bash
# OLD (broken):
run_cli_with_secret "${SECRET}" "send-token -f ${token} -r '${addr}' ..."

# NEW (fixed):
run_cli_with_secret "${SECRET}" send-token -f "${token}" -r "${addr}" ...
```

**Lines to fix:** 322, 327, 333, 338, 342, 346, 350

## Files

- `ADDRESS_FORMAT_SPECIFICATION.md` - Complete spec
- `SEC_INPUT_007_ANALYSIS.md` - Test analysis
- `SEC_INPUT_007_TEST_FIX.md` - Fix instructions
- `ADDRESS_VALIDATION_COMPLETE_ANSWER.md` - Full Q&A
- `ADDRESS_CHECKSUM_QUICK_REFERENCE.md` - This file

## Summary

- **YES, addresses include checksums** (last 8 hex chars)
- **Checksum algorithm:** SHA256 (first 4 bytes)
- **CLI validation:** Already correct
- **Test fix needed:** Array args instead of string
