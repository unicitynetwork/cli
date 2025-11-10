# TXF Structure Analysis - Executive Summary

**Date:** 2025-11-10  
**Analyst:** Claude Code  
**Status:** COMPLETE - Root cause identified

## The Problem

Tests are failing because they expect `coinData` to be an array of objects with `.amount` and `.coinId` properties, but the Unicity SDK correctly produces an array of `[coinId, amount]` tuples as specified in TypeScript definitions.

## Impact

**21 incorrect test assertions across 6 test files** will fail when testing fungible tokens.

## Root Cause

The SDK type definition explicitly specifies:

```typescript
/** JSON representation for coin balances. */
export type TokenCoinDataJson = [string, string][];
```

This is **array of tuples**, not array of objects.

## Evidence

### Real TXF File Structure (VERIFIED)

Fungible token with 3 coins:
```json
{
  "genesis": {
    "data": {
      "coinData": [
        ["090513256b916e7a6da4bf15d55dfa5b85cbd0ad9496b9e8dc0c554f809df72a", "1000"],
        ["13cb0221113c586b681b375c7e3788997937904edd069a53c31d51a6e02d621d", "2000"],
        ["c63fba8f49c882c0ee87aa12635f84733b549cf394cd0b85ae0c9054dfd8a01b", "3000"]
      ]
    }
  }
}
```

### What Tests Do (WRONG)
```bash
amount=$(jq -r '.genesis.data.coinData[0].amount' token.txf)
# Returns: null (property doesn't exist on array)
```

### What Tests Should Do (CORRECT)
```bash
amount=$(jq -r '.genesis.data.coinData[0][1]' token.txf)
# Returns: "1000"
```

## Verification Results

All 10 verification tests passed:

- ✓ coinData[0] is an array (tuple)
- ✓ Tuple has 2 elements [coinId, amount]
- ✓ coinId accessible via [0]
- ✓ amount accessible via [1]
- ✓ Object property access fails/returns null
- ✓ Sum of all coins works with tuple access
- ✓ state.data is hex string (not null)
- ✓ tokenData is hex string (not null)
- ✓ version is string "2.0"
- ✓ tokenId and salt always present

## Affected Files

1. **tests/functional/test_mint_token.bats** - 14 occurrences (PRIMARY)
2. **tests/edge-cases/test_data_boundaries.bats** - 3 occurrences
3. **tests/helpers/token-helpers.bash** - 1 occurrence (helper function)
4. **tests/functional/test_send_token.bats** - 1 occurrence
5. **tests/functional/test_integration.bats** - 2 occurrences

## The Fix

### Simple Replacement Pattern

| Current (WRONG) | Fixed (CORRECT) | Description |
|----------------|-----------------|-------------|
| `.coinData[0].amount` | `.coinData[0][1]` | First coin amount |
| `.coinData[0].coinId` | `.coinData[0][0]` | First coin ID |
| `.coinData[N].amount` | `.coinData[N][1]` | Nth coin amount |
| `.coinData[N].coinId` | `.coinData[N][0]` | Nth coin ID |
| `.coinData[].amount` | `.coinData[][1]` | All amounts (iteration) |

### Example

**Before:**
```bash
coin_id1=$(jq -r '.genesis.data.coinData[0].coinId' token.txf)
amount1=$(jq -r '.genesis.data.coinData[0].amount' token.txf)
```

**After:**
```bash
coin_id1=$(jq -r '.genesis.data.coinData[0][0]' token.txf)
amount1=$(jq -r '.genesis.data.coinData[0][1]' token.txf)
```

## Additional Findings

### Other TXF Fields (All Correct)

| Field | Expected | Actual | Status |
|-------|----------|--------|--------|
| `.version` | string "2.0" | string "2.0" | ✓ Matches |
| `.state.data` | hex or empty | hex or `""` | ✓ Correct (never null) |
| `.genesis.data.tokenData` | hex or empty | hex or `""` | ✓ Correct (never null) |
| `.genesis.data.tokenId` | 64 hex chars | 64 hex chars | ✓ Always present |
| `.genesis.data.salt` | 64 hex chars | 64 hex chars | ✓ Always present |

**Key Insight:** Empty data is represented as `""` (empty string), NOT `null`. This is SDK-compliant behavior.

## Recommendation

**APPROVED for immediate fix**

1. Update 21 assertions from object access to tuple access
2. Fix helper function in `token-helpers.bash`
3. Add new helper functions for cleaner code
4. Run full test suite to verify

**Estimated effort:** 30 minutes  
**Risk:** Low (test-only changes)  
**Breaking changes:** None (no CLI code changes)

## Documentation

Three detailed documents created:

1. **TXF_STRUCTURE_ANALYSIS.md** - Comprehensive analysis (51KB)
   - Real TXF examples (NFT and fungible)
   - SDK type definitions
   - Field-by-field comparison
   - Helper function recommendations

2. **TXF_COINDATA_FIX_SUMMARY.md** - Action plan
   - Problem statement with examples
   - Complete list of affected lines
   - Fix strategy with regex patterns
   - Verification script

3. **TXF_ANALYSIS_INDEX.md** - Navigation guide
   - Quick reference
   - Document overview
   - Real TXF examples

## Verification Script

Created and tested: `/tmp/verify-txf-structure.sh`
- All 10 tests passed
- Confirms tuple structure
- Proves object access fails

## Conclusion

**This is NOT a bug in the CLI or SDK.**

The CLI and SDK are working correctly according to TypeScript specifications. The tests were written with incorrect assumptions about the data structure.

**Action Required:** Update test assertions from object property access to array tuple access.

**No changes needed to CLI source code** (`/home/vrogojin/cli/src/`).

## References

- SDK Source: `node_modules/@unicitylabs/state-transition-sdk/lib/token/fungible/TokenCoinData.d.ts:4`
- Real Fungible Token: `/home/vrogojin/cli/20251110_154702_1762786022437_0000de691b.txf`
- Real NFT Token: `/tmp/test-final.txf`
- Verification Script: `/tmp/verify-txf-structure.sh` (all tests pass)

---

**Analysis complete. Ready for implementation.**
