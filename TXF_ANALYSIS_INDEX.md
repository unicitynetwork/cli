# TXF File Structure Analysis - Document Index

## Overview

This analysis examined the ACTUAL TXF file structure produced by the Unicity CLI and identified mismatches with test expectations.

**Key Finding:** Tests expect coinData to be objects with `.amount` and `.coinId` properties, but the SDK correctly produces arrays of `[coinId, amount]` tuples as specified in TypeScript definitions.

## Documents

### 1. TXF_STRUCTURE_ANALYSIS.md (Comprehensive Analysis)
**Purpose:** Deep dive into TXF file structure  
**Content:**
- Real TXF file examples (NFT and fungible tokens)
- SDK TypeScript type definitions
- Field-by-field comparison of expectations vs reality
- Helper function recommendations
- Testing strategy

**Key Sections:**
- Examined TXF Files (with real JSON)
- SDK Type Definitions
- Reality: What CLI Actually Produces (table format)
- Test Expectations vs Reality (detailed comparison)
- Mapping: Test Expectations → Correct Assertions
- Helper Function Recommendations
- Files Requiring Updates

### 2. TXF_COINDATA_FIX_SUMMARY.md (Action Plan)
**Purpose:** Focused fix guide for test updates  
**Content:**
- Problem statement with examples
- Affected files and line numbers (21 occurrences across 6 files)
- Fix strategy with search/replace patterns
- Helper function improvements
- Verification script

**Key Sections:**
- The Problem (visual comparison)
- Affected Files (complete list with line numbers)
- Fix Strategy (regex patterns for search/replace)
- Additional Improvements (helper functions)
- Verification Script (bash script to validate fixes)

## Quick Reference

### The Core Issue

**Wrong (what tests do):**
```bash
amount=$(jq -r '.genesis.data.coinData[0].amount' token.txf)  # Returns null
```

**Correct (what works):**
```bash
amount=$(jq -r '.genesis.data.coinData[0][1]' token.txf)  # Returns "1000"
```

### Affected Files

1. `tests/functional/test_mint_token.bats` - 14 occurrences
2. `tests/edge-cases/test_data_boundaries.bats` - 3 occurrences
3. `tests/helpers/token-helpers.bash` - 1 occurrence
4. `tests/functional/test_send_token.bats` - 1 occurrence
5. `tests/functional/test_integration.bats` - 2 occurrences

**Total:** 21 incorrect assertions

### Search Patterns

```bash
# Find all issues
grep -rn "\.coinData\[.*\]\.amount\|\.coinData\[.*\]\.coinId" tests/

# Count occurrences
grep -rn "\.coinData\[.*\]\.amount\|\.coinData\[.*\]\.coinId" tests/ | wc -l
# Output: 21
```

## Key Findings Summary

| Field | Test Expects | Actual Reality | Impact |
|-------|-------------|----------------|---------|
| `.version` | String "2.0" | String "2.0" | ✓ Correct |
| `.state.data` | Could be null | Empty string "" or hex | Minor (tests handle correctly) |
| `.genesis.data.tokenData` | Could be null | Empty string "" or hex | Minor (tests handle correctly) |
| `.genesis.data.coinData` | Object with properties | Array of tuples | **MAJOR - 21 failures** |
| `.genesis.data.tokenId` | Optional | Always present | Minor (tests don't assume optional) |
| `.genesis.data.salt` | Optional | Always present | Minor (tests don't assume optional) |

## SDK Specification

From `@unicitylabs/state-transition-sdk/lib/token/fungible/TokenCoinData.d.ts:4`:

```typescript
/** JSON representation for coin balances. */
export type TokenCoinDataJson = [string, string][];
```

This clearly specifies an **array of tuples**, not objects.

## Verification

### Create Test Token

```bash
SECRET="test-verify" npm run mint-token -- --local --coins "1000,2000,3000" -d '{"type":"USDC"}' --save
```

### Verify Structure

```bash
# Get the latest token file
token=$(ls -t *.txf | head -1)

# Test tuple access (CORRECT)
jq '.genesis.data.coinData[0][0]' "$token"  # CoinId (64 hex chars)
jq '.genesis.data.coinData[0][1]' "$token"  # "1000"

# Test object access (WRONG - returns null)
jq '.genesis.data.coinData[0].amount' "$token"  # null
jq '.genesis.data.coinData[0].coinId' "$token"  # null
```

## Real TXF Examples

### NFT Token (No Coins)
```json
{
  "genesis": {
    "data": {
      "coinData": [],
      "tokenData": "",
      ...
    }
  },
  "state": {
    "data": ""
  }
}
```

### Fungible Token (With Coins)
```json
{
  "genesis": {
    "data": {
      "coinData": [
        ["090513256b916e7a6da4bf15d55dfa5b85cbd0ad9496b9e8dc0c554f809df72a", "1000"],
        ["13cb0221113c586b681b375c7e3788997937904edd069a53c31d51a6e02d621d", "2000"]
      ],
      "tokenData": "7b2274797065223a2255534443227d",
      ...
    }
  },
  "state": {
    "data": "7b2274797065223a2255534443227d"
  }
}
```

## Next Steps

1. **Read** `TXF_COINDATA_FIX_SUMMARY.md` for detailed fix instructions
2. **Update** 21 assertions across 6 test files
3. **Fix** helper function in `token-helpers.bash`
4. **Add** new helper functions for tuple access
5. **Run** verification script to confirm fixes
6. **Execute** full test suite to validate

## Related Files

- Real fungible token: `/home/vrogojin/cli/20251110_154702_1762786022437_0000de691b.txf`
- SDK type definition: `node_modules/@unicitylabs/state-transition-sdk/lib/token/fungible/TokenCoinData.d.ts`
- Test files: `tests/functional/test_mint_token.bats` (primary)

## Conclusion

The CLI and SDK are working correctly. The tests were written with incorrect assumptions about the coinData structure. This is a **test-only issue** requiring updates to 21 assertions to use array tuple access instead of object property access.

**No changes needed to CLI source code.**
