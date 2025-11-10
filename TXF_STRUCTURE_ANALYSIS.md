# TXF File Structure Analysis: Reality vs Test Expectations

**Date:** 2025-11-10  
**Purpose:** Document the ACTUAL TXF file structure produced by Unicity CLI and compare with test expectations to identify all mismatches.

## Executive Summary

After examining real TXF files produced by the CLI and comparing with SDK specifications and test expectations, I've identified several critical mismatches:

1. **`.version`** - String "2.0" (CORRECT)
2. **`.state.data`** - Hex string or empty string "" (NOT null, NOT object)
3. **`.genesis.data.tokenData`** - Hex string or empty string "" (NOT null, NOT object)
4. **`.genesis.data.coinData`** - Array of `[string, string]` tuples (NOT objects with `.coinId` and `.amount` properties)
5. **`.genesis.data.tokenId`** - ALWAYS present (64-char hex string)
6. **`.genesis.data.salt`** - ALWAYS present (64-char hex string)

## Examined TXF Files

### 1. NFT Token (Non-Fungible)
**File:** `/home/vrogojin/cli/captured-token.json` (lines 4+)
**File:** `/tmp/test-final.txf`
**File:** `/home/vrogojin/cli/my-custom-nft.txf`

```json
{
  "version": "2.0",
  "genesis": {
    "data": {
      "coinData": [],
      "reason": null,
      "recipient": "DIRECT://...",
      "recipientDataHash": null,
      "salt": "b827a7c76563dbf73587cbc6155f721d3b4b7cfb010dc539726a5706b0ade9bb",
      "tokenData": "",
      "tokenId": "bfa5e45065f992d9999358d1d668f71bed7abf49fcd10f095946d4009980fe35",
      "tokenType": "f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509"
    },
    "inclusionProof": { ... }
  },
  "state": {
    "data": "",
    "predicate": "8300410058b5865820..."
  },
  "transactions": [],
  "nametags": []
}
```

**Key Observations:**
- `version`: **string** "2.0"
- `state.data`: **empty string** ""
- `genesis.data.tokenData`: **empty string** ""
- `genesis.data.coinData`: **empty array** []
- `genesis.data.tokenId`: **present** (64 hex chars)
- `genesis.data.salt`: **present** (64 hex chars)

### 2. Fungible Token (With Coins)
**File:** `/home/vrogojin/cli/20251110_154702_1762786022437_0000de691b.txf`
**Command:** `SECRET="test-fungible" npm run mint-token -- --local --coins "1000,2000,3000" -d '{"type":"USDC"}' --save`

```json
{
  "version": "2.0",
  "genesis": {
    "data": {
      "coinData": [
        [
          "090513256b916e7a6da4bf15d55dfa5b85cbd0ad9496b9e8dc0c554f809df72a",
          "1000"
        ],
        [
          "13cb0221113c586b681b375c7e3788997937904edd069a53c31d51a6e02d621d",
          "2000"
        ],
        [
          "c63fba8f49c882c0ee87aa12635f84733b549cf394cd0b85ae0c9054dfd8a01b",
          "3000"
        ]
      ],
      "reason": null,
      "recipient": "DIRECT://...",
      "recipientDataHash": null,
      "salt": "fe68f7fec689fed134915fc0012b9155a61f8a0a96546459f9c506f183af8137",
      "tokenData": "7b2274797065223a2255534443227d",
      "tokenId": "5965121e7d02f5c61bf05e3c80b0effe5cd1143f293925dd94733abd6249c18d",
      "tokenType": "f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509"
    },
    "inclusionProof": { ... }
  },
  "state": {
    "data": "7b2274797065223a2255534443227d",
    "predicate": "8300410058b58658205965..."
  },
  "transactions": [],
  "nametags": []
}
```

**Key Observations:**
- `version`: **string** "2.0"
- `state.data`: **hex string** "7b2274797065223a2255534443227d" (not empty!)
- `genesis.data.tokenData`: **hex string** "7b2274797065223a2255534443227d"
- `genesis.data.coinData`: **array of [coinId, amount] tuples**
  - Each element: `[string (64 hex chars), string (numeric)]`
  - NOT objects like `{coinId: "...", amount: "..."}`
- `genesis.data.tokenId`: **present**
- `genesis.data.salt`: **present**

## SDK Type Definitions

### Token Structure (from SDK v1.6.0-rc)

**File:** `node_modules/@unicitylabs/state-transition-sdk/lib/token/Token.d.ts`

```typescript
export interface ITokenJson {
    readonly version: string;
    readonly state: ITokenStateJson;
    readonly genesis: IMintTransactionJson;
    readonly transactions: ITransferTransactionJson[];
    readonly nametags: ITokenJson[];
}
```

### TokenState (ITokenStateJson)

**File:** `node_modules/@unicitylabs/state-transition-sdk/lib/token/TokenState.d.ts`

```typescript
export interface ITokenStateJson {
    readonly predicate: string;
    readonly data: string | null;  // ← Can be string OR null
}
```

### MintTransactionData (IMintTransactionDataJson)

**File:** `node_modules/@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionData.d.ts`

```typescript
export interface IMintTransactionDataJson {
    readonly tokenId: string;
    readonly tokenType: string;
    readonly tokenData: string | null;  // ← Can be string OR null
    readonly coinData: TokenCoinDataJson | null;  // ← Can be array OR null
    readonly recipient: string;
    readonly salt: string;
    readonly recipientDataHash: string | null;
    readonly reason: unknown | null;
}
```

### TokenCoinData (TokenCoinDataJson)

**File:** `node_modules/@unicitylabs/state-transition-sdk/lib/token/fungible/TokenCoinData.d.ts`

```typescript
/** JSON representation for coin balances. */
export type TokenCoinDataJson = [string, string][];  // ← Array of tuples!
```

## Reality: What CLI Actually Produces

| Field | Type | NFT Value | Fungible Value | Notes |
|-------|------|-----------|----------------|-------|
| `.version` | `string` | `"2.0"` | `"2.0"` | Always string |
| `.state.data` | `string` | `""` (empty) | `"7b227479..."` (hex) | Never null, empty string for no data |
| `.state.predicate` | `string` | `"8300410..."` (hex) | `"8300410..."` (hex) | CBOR hex encoding |
| `.genesis.data.tokenId` | `string` | `"bfa5e450..."` (64 hex) | `"5965121e..."` (64 hex) | Always present |
| `.genesis.data.tokenType` | `string` | `"f8aa1383..."` (64 hex) | `"f8aa1383..."` (64 hex) | Always present |
| `.genesis.data.tokenData` | `string` | `""` (empty) | `"7b227479..."` (hex) | Never null, empty string for no data |
| `.genesis.data.coinData` | `array` | `[]` | `[["coinId1", "1000"], ["coinId2", "2000"]]` | Array of [string, string] tuples |
| `.genesis.data.salt` | `string` | `"b827a7c7..."` (64 hex) | `"fe68f7fe..."` (64 hex) | Always present |
| `.genesis.data.recipient` | `string` | `"DIRECT://..."` | `"DIRECT://..."` | Address string |
| `.genesis.data.recipientDataHash` | `null` | `null` | `null` | Can be string or null |
| `.genesis.data.reason` | `null` | `null` | `null` | Can be object or null |
| `.transactions` | `array` | `[]` | `[]` | Empty for newly minted tokens |
| `.nametags` | `array` | `[]` | `[]` | Empty for tokens without nametags |

## Test Expectations vs Reality

### Issue 1: `.genesis.data.coinData` Structure

**Test Expects:**
```bash
actual_amount=$(jq -r '.genesis.data.coinData[0].amount' token.txf)
coin_id1=$(jq -r '.genesis.data.coinData[0].coinId' token.txf)
```

**Reality:**
```bash
# coinData is array of [coinId, amount] tuples
# .coinData[0] = ["090513256b916e7a...", "1000"]
# .coinData[0].amount = null (no such property!)
# .coinData[0].coinId = null (no such property!)
```

**Correct Assertion:**
```bash
# Access tuple elements by index
actual_amount=$(jq -r '.genesis.data.coinData[0][1]' token.txf)  # Second element
coin_id=$(jq -r '.genesis.data.coinData[0][0]' token.txf)        # First element
```

**Affected Tests:**
- `tests/functional/test_mint_token.bats:134` - `.genesis.data.coinData[0].amount`
- `tests/functional/test_mint_token.bats:153` - `.genesis.data.coinData[0].amount`
- `tests/functional/test_mint_token.bats:172` - `.genesis.data.coinData[0].amount`
- `tests/functional/test_mint_token.bats:360-369` - `.genesis.data.coinData[*].amount`
- `tests/functional/test_mint_token.bats:373-376` - `.genesis.data.coinData[*].coinId`
- `tests/functional/test_mint_token.bats:421` - `.genesis.data.coinData[0].amount`
- `tests/functional/test_mint_token.bats:511` - `.genesis.data.coinData[0].amount`
- `tests/functional/test_mint_token.bats:527-531` - `.genesis.data.coinData[*].coinId`

### Issue 2: `.state.data` Type

**Test Might Expect:**
```bash
# Assumption that .state.data could be null or missing
if [[ -z "$(jq -r '.state.data' token.txf)" ]]; then ...
```

**Reality:**
- NFT: `.state.data` = `""` (empty string)
- Fungible: `.state.data` = `"7b2274797065223a2255534443227d"` (hex string)
- Never `null`

**Correct Assertion:**
```bash
# Check if data is empty
data=$(jq -r '.state.data' token.txf)
if [[ "$data" == "" ]]; then
  echo "No data"
fi

# Check if data exists (non-empty hex string)
if [[ "$data" != "" ]]; then
  echo "Has data: $data"
fi
```

### Issue 3: `.genesis.data.tokenData` Type

**Same as Issue 2:**
- NFT: `.genesis.data.tokenData` = `""` (empty string)
- With data: `.genesis.data.tokenData` = hex string
- Never `null`

### Issue 4: `.genesis.data.tokenId` and `.genesis.data.salt` Always Present

**Test Might Expect:**
```bash
# Assumption these might be optional
if jq -e '.genesis.data.tokenId' token.txf >/dev/null; then ...
```

**Reality:**
- Both fields are **always present** in all TXF files
- Both are 64-character hex strings
- These are fundamental to token identity

**Correct Assertion:**
```bash
# Just read them directly, they're always there
token_id=$(jq -r '.genesis.data.tokenId' token.txf)
salt=$(jq -r '.genesis.data.salt' token.txf)

# Validate format if needed
assert_hex_string "$token_id" 64
assert_hex_string "$salt" 64
```

## Mapping: Test Expectations → Correct Assertions

### coinData Access

| Test Expects | Actual Structure | Correct Assertion |
|--------------|------------------|-------------------|
| `.coinData[0].amount` | `[coinId, amount]` tuple | `.coinData[0][1]` |
| `.coinData[0].coinId` | `[coinId, amount]` tuple | `.coinData[0][0]` |
| `.coinData[i].amount` | `[coinId, amount]` tuple | `.coinData[i][1]` |
| `.coinData[i].coinId` | `[coinId, amount]` tuple | `.coinData[i][0]` |

### Example Fix for test_mint_token.bats

**Before (Line 134):**
```bash
actual_amount=$(jq -r '.genesis.data.coinData[0].amount' token.txf)
```

**After:**
```bash
actual_amount=$(jq -r '.genesis.data.coinData[0][1]' token.txf)
```

**Before (Line 373):**
```bash
coin_id1=$(jq -r '.genesis.data.coinData[0].coinId' token.txf)
coin_id2=$(jq -r '.genesis.data.coinData[1].coinId' token.txf)
```

**After:**
```bash
coin_id1=$(jq -r '.genesis.data.coinData[0][0]' token.txf)
coin_id2=$(jq -r '.genesis.data.coinData[1][0]' token.txf)
```

## Helper Function Recommendations

### 1. Add Coin Data Helpers

```bash
# Get coin amount by index
# Args: $1=token_file, $2=coin_index
get_coin_amount() {
  local token_file="${1:?Token file required}"
  local index="${2:-0}"
  jq -r ".genesis.data.coinData[$index][1]" "$token_file" 2>/dev/null || echo "0"
}

# Get coin ID by index
# Args: $1=token_file, $2=coin_index
get_coin_id() {
  local token_file="${1:?Token file required}"
  local index="${2:-0}"
  jq -r ".genesis.data.coinData[$index][0]" "$token_file" 2>/dev/null || echo ""
}

# Get all coin IDs
# Args: $1=token_file
get_all_coin_ids() {
  local token_file="${1:?Token file required}"
  jq -r '.genesis.data.coinData[][0]' "$token_file" 2>/dev/null
}

# Get all coin amounts
# Args: $1=token_file
get_all_coin_amounts() {
  local token_file="${1:?Token file required}"
  jq -r '.genesis.data.coinData[][1]' "$token_file" 2>/dev/null
}
```

### 2. Update Existing Helpers

**Current `get_total_coin_amount` (if it exists):**
```bash
# WRONG (assumes .amount property)
jq '[.genesis.data.coinData[].amount | tonumber] | add' "$token_file"
```

**Correct:**
```bash
# Access second element of each tuple [coinId, amount]
jq '[.genesis.data.coinData[][1] | tonumber] | add' "$token_file"
```

## SDK Serialization Behavior

Based on SDK type definitions and real output:

1. **`Token.toJSON()`** produces:
   - `version`: string "2.0"
   - `state.data`: string (hex) or empty string "" (never null)
   - `genesis.data.tokenData`: string (hex) or empty string "" (never null)
   - `genesis.data.coinData`: array of tuples or empty array []

2. **Empty Data Representation:**
   - Empty/no data → `""` (empty string)
   - NOT `null`, NOT missing field
   - This is consistent across `.state.data` and `.genesis.data.tokenData`

3. **CoinData Serialization:**
   - `TokenCoinData.toJSON()` returns `[string, string][]`
   - Each coin: `[coinId_hex, amount_string]`
   - CoinId: 64-character hex string (32 bytes)
   - Amount: string representation of bigint

## Testing Strategy Recommendations

### 1. Update All coinData Access Patterns

**Search pattern:**
```bash
grep -rn "\.coinData\[.*\]\.amount" tests/
grep -rn "\.coinData\[.*\]\.coinId" tests/
```

**Replace with:**
- `.coinData[N].amount` → `.coinData[N][1]`
- `.coinData[N].coinId` → `.coinData[N][0]`

### 2. Add Structure Validation Tests

```bash
@test "coinData structure is array of tuples" {
    # Create fungible token
    create_fungible_token "token.txf" 1000
    
    # Verify structure
    local first_element_type
    first_element_type=$(jq -r '.genesis.data.coinData[0] | type' token.txf)
    assert_equals "array" "$first_element_type"
    
    # Verify tuple has 2 elements
    local tuple_length
    tuple_length=$(jq -r '.genesis.data.coinData[0] | length' token.txf)
    assert_equals "2" "$tuple_length"
    
    # Verify first element is coinId (64 hex chars)
    local coin_id
    coin_id=$(jq -r '.genesis.data.coinData[0][0]' token.txf)
    assert_hex_string "$coin_id" 64
    
    # Verify second element is amount (numeric string)
    local amount
    amount=$(jq -r '.genesis.data.coinData[0][1]' token.txf)
    assert_numeric_string "$amount"
}
```

### 3. Document Type Expectations

Add to `tests/helpers/ASSERTIONS_USAGE_GUIDE.md`:

```markdown
## TXF File Structure

### Fungible Token coinData

coinData is an **array of [coinId, amount] tuples**, NOT objects:

```json
{
  "genesis": {
    "data": {
      "coinData": [
        ["090513256b916e7a...", "1000"],  // [coinId, amount]
        ["13cb0221113c586b...", "2000"]
      ]
    }
  }
}
```

**Access patterns:**
- Coin ID: `.genesis.data.coinData[0][0]`
- Amount: `.genesis.data.coinData[0][1]`
```

## Files Requiring Updates

### High Priority (Direct Access to coinData)

1. **`tests/functional/test_mint_token.bats`**
   - Lines: 134, 153, 172, 360-369, 373-376, 421, 511, 527-531
   - All `.coinData[N].amount` → `.coinData[N][1]`
   - All `.coinData[N].coinId` → `.coinData[N][0]`

### Medium Priority (Helper Functions)

2. **`tests/helpers/token-helpers.bash`**
   - Function: `get_total_coin_amount()` (if exists)
   - Function: Any coinData parsing logic
   - Add new helper functions for tuple access

### Low Priority (Documentation)

3. **`tests/helpers/ASSERTIONS_USAGE_GUIDE.md`**
4. **`tests/README.md`**
5. **`TESTS_QUICK_REFERENCE.md`**

## Verification Commands

After making changes, verify with real TXF files:

```bash
# Create test tokens
SECRET="test" npm run mint-token -- --local --save  # NFT
SECRET="test" npm run mint-token -- --local --coins "1000,2000" --save  # Fungible

# Verify structure
token_file="<generated-file>.txf"

# Test NFT
jq '.genesis.data.coinData | length' "$token_file"  # Should be 0
jq '.state.data' "$token_file"  # Should be ""

# Test Fungible
jq '.genesis.data.coinData[0] | type' "$token_file"  # Should be "array"
jq '.genesis.data.coinData[0] | length' "$token_file"  # Should be 2
jq '.genesis.data.coinData[0][0]' "$token_file"  # CoinId (64 hex)
jq '.genesis.data.coinData[0][1]' "$token_file"  # Amount (string number)
```

## Conclusion

The primary issue is **test expectations about coinData structure**:

- **Tests assume:** Object-like access (`.coinData[0].amount`)
- **Reality:** Array tuple access (`.coinData[0][1]`)

This affects approximately **8 test assertions** in `test_mint_token.bats` and potentially more in other test files.

All other fields match SDK specifications correctly. The `state.data` and `genesis.data.tokenData` fields use empty string `""` instead of `null` for "no data", which is SDK-compliant behavior.

**Next Steps:**
1. Update all `.coinData[N].amount` to `.coinData[N][1]`
2. Update all `.coinData[N].coinId` to `.coinData[N][0]`
3. Add helper functions for clean tuple access
4. Run full test suite to verify fixes
5. Document structure in test guides
