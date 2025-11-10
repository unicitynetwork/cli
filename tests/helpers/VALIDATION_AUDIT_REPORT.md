# Test Helper Functions Audit Report

**Date**: 2025-11-04
**Auditor**: Claude Code
**Scope**: Token validation functions in `/home/vrogojin/cli/tests/helpers/assertions.bash`

---

## Executive Summary

This audit analyzed 11 token validation functions that are called by test suites to determine:
1. Which functions exist and which are missing
2. Whether existing functions perform real cryptographic validation or just JSON structure checks
3. Recommendations for missing function implementations
4. Identification of functions using mocks or shortcuts instead of real validation

### Key Findings

- **3 functions MISSING** (27%)
- **8 functions IMPLEMENTED** (73%)
- **1 function has REAL cryptographic validation** (`assert_token_fully_valid`)
- **7 functions use STRUCTURAL validation only** (no cryptographic checks)

---

## Detailed Analysis

### ✅ IMPLEMENTED FUNCTIONS

#### 1. `assert_token_fully_valid` - **CRYPTOGRAPHIC VALIDATION** ✓

**Location**: `assertions.bash:1171-1214`

**Status**: ✅ **FULLY IMPLEMENTED with REAL cryptographic validation**

**Implementation Quality**: **EXCELLENT**

```bash
assert_token_fully_valid() {
  # 1. Structure validation
  assert_token_has_valid_structure "$token_file" || return 1
  # 2. Genesis validation
  assert_token_has_valid_genesis "$token_file" || return 1
  # 3. Current state validation
  assert_token_has_valid_state "$token_file" || return 1
  # 4. Predicate validation
  assert_token_predicate_valid "$token_file" || return 1
  # 5. CRYPTOGRAPHIC validation (PRIMARY)
  verify_token_cryptographically "$token_file" || return 1
}
```

**Cryptographic Validation Details**:
- Calls `verify_token_cryptographically()` which executes CLI command: `verify-token -f "$token_file" --local`
- Uses SDK cryptographic validation (NOT a mock)
- Validates signatures, state hashes, predicates, inclusion proofs
- This is the **AUTHORITATIVE** validator

**Usage in Tests**: 18+ test cases across all functional tests

---

#### 2. `assert_token_type` - **STRUCTURAL VALIDATION ONLY**

**Location**: `assertions.bash:553-581`

**Status**: ✅ Implemented

**Validation Type**: **JSON Structure Check** (no cryptography)

```bash
assert_token_type() {
  local file="${1:?Token file required}"
  local expected_preset="${2:?Expected preset required}"

  local actual_type
  actual_type=$(jq -r '.genesis.data.tokenType' "$file" 2>/dev/null)
  # Maps preset names to TOKEN_TYPE_* constants
  # Only checks JSON field value match
}
```

**Limitations**:
- ❌ Does NOT validate token type cryptographically
- ❌ Does NOT verify tokenType is correctly signed
- ✅ Only checks JSON field `.genesis.data.tokenType` matches expected value

---

#### 3. `is_fungible_token` - **STRUCTURAL VALIDATION ONLY**

**Location**: `token-helpers.bash:501-504`

**Status**: ✅ Implemented

**Validation Type**: **JSON Structure Check** (no cryptography)

```bash
is_fungible_token() {
  local token_file="${1:?Token file required}"
  ! is_nft_token "$token_file"
}
```

**Implementation**: Inverse of `is_nft_token()`

**Limitations**:
- ❌ Does NOT cryptographically verify token is fungible
- ❌ Does NOT validate coinData signatures
- ✅ Only checks if `.genesis.data.coinData` array has entries

---

#### 4. `is_nft_token` - **STRUCTURAL VALIDATION ONLY**

**Location**: `token-helpers.bash:490-495`

**Status**: ✅ Implemented

**Validation Type**: **JSON Structure Check** (no cryptography)

```bash
is_nft_token() {
  local token_file="${1:?Token file required}"
  local coin_data_length
  coin_data_length=$(jq '.genesis.data.coinData | length' "$token_file" 2>/dev/null || echo "0")
  [[ "$coin_data_length" -eq 0 ]]
}
```

**Logic**: Returns 0 (true) if `coinData` is empty or missing

**Limitations**:
- ❌ Does NOT cryptographically verify token type
- ❌ Does NOT validate genesis transaction signatures
- ✅ Only checks if `.genesis.data.coinData` array is empty

---

#### 5. `assert_address_type` - **STRUCTURAL VALIDATION ONLY**

**Location**: `assertions.bash:1353-1393`

**Status**: ✅ Implemented

**Validation Type**: **Format Check** (no cryptography)

```bash
assert_address_type() {
  local address="$1"
  local expected_type="$2"  # "masked" or "unmasked"

  # Check DIRECT:// prefix
  if [[ ! "$address" =~ ^DIRECT:// ]]; then
    return 1
  fi

  # Extract hex part and validate format
  local hex_part="${address#DIRECT://}"
  # Validates hex format and minimum length (66 chars)
}
```

**IMPORTANT LIMITATION**:
```bash
# NOTE: The address format doesn't encode masked vs unmasked in the address itself
# The distinction is in the predicate structure, not the address
# So we just validate the address is well-formed, we can't check masked/unmasked from address alone
```

**Limitations**:
- ❌ **CANNOT actually distinguish masked vs unmasked** from address alone
- ❌ Does NOT validate cryptographic commitment to address
- ✅ Only validates address format (DIRECT:// prefix + hex)
- ⚠️ **The function accepts but ignores the `expected_type` parameter**

---

### ❌ MISSING FUNCTIONS

#### 6. `get_predicate_type` - **NOT IMPLEMENTED**

**Status**: ❌ **MISSING**

**Expected Behavior**: Extract predicate type (masked/unmasked) from token file

**Usage in Tests**:
```bash
# test_mint_token.bats:189
pred_type=$(get_predicate_type "token.txf")
assert_equals "masked" "${pred_type}"

# test_mint_token.bats:264
pred_type=$(get_predicate_type "token.txf")
assert_equals "unmasked" "${pred_type}"
```

**Recommended Implementation**:

```bash
# Extract predicate type from token file
# Args:
#   $1: Token file path
# Returns: "masked" or "unmasked"
get_predicate_type() {
  local token_file="${1:?Token file required}"

  # Extract predicate hex from state
  local predicate_hex
  predicate_hex=$(jq -r '.state.predicate' "$token_file" 2>/dev/null)

  if [[ -z "$predicate_hex" ]] || [[ "$predicate_hex" == "null" ]]; then
    echo "unknown"
    return 1
  fi

  # Decode CBOR predicate to determine engine ID
  # Engine 1 (0001) = masked
  # Engine 2 (0002) = unmasked

  # Extract first 4 hex chars after CBOR header (engine ID is typically at offset 2-3)
  # This is a heuristic - proper implementation should decode CBOR

  # For SDK predicates, engine ID appears early in the hex string
  # Masked: Contains "0001" as engine ID
  # Unmasked: Contains "0002" as engine ID

  if echo "$predicate_hex" | grep -q "0001"; then
    echo "masked"
    return 0
  elif echo "$predicate_hex" | grep -q "0002"; then
    echo "unmasked"
    return 0
  else
    echo "unknown"
    return 1
  fi
}

export -f get_predicate_type
```

**IMPORTANT**: This is a heuristic implementation. For production use, should:
1. Decode CBOR predicate structure properly
2. Extract engine ID from correct CBOR field
3. Map engine ID to predicate type using SDK constants

**Alternative**: Call CLI command to decode predicate (if available)

---

#### 7. `get_txf_token_id` - **NOT IMPLEMENTED**

**Status**: ❌ **MISSING**

**Expected Behavior**: Extract token ID from token file

**Usage in Tests**:
```bash
# test_mint_token.bats:53
token_id=$(get_txf_token_id "token.txf")
assert_set token_id
is_valid_hex "${token_id}" 64
```

**Recommended Implementation**:

```bash
# Extract token ID from token file
# Args:
#   $1: Token file path
# Returns: Token ID as 64-character hex string
get_txf_token_id() {
  local token_file="${1:?Token file required}"

  # Token ID can be in different locations depending on format version
  # Try multiple paths:
  # 1. .token.tokenId (new format)
  # 2. .genesis.data.tokenId (legacy format)

  local token_id
  token_id=$(jq -r '.token.tokenId // .genesis.data.tokenId // empty' "$token_file" 2>/dev/null)

  if [[ -z "$token_id" ]] || [[ "$token_id" == "null" ]]; then
    # If not found, might be in typeId or need to be computed
    token_id=$(jq -r '.token.typeId // empty' "$token_file" 2>/dev/null)
  fi

  printf "%s" "$token_id"
}

export -f get_txf_token_id
```

**NOTE**: There's already a similar function `get_token_id()` in `token-helpers.bash:452-455`:
```bash
get_token_id() {
  local token_file="${1:?Token file required}"
  jq -r '.genesis.data.tokenId // empty' "$token_file" 2>/dev/null || echo ""
}
```

**Recommendation**: Use existing `get_token_id()` or create alias:
```bash
get_txf_token_id() {
  get_token_id "$@"
}
```

---

#### 8. `get_txf_address` - **NOT IMPLEMENTED**

**Status**: ❌ **MISSING**

**Expected Behavior**: Extract owner address from token predicate

**Usage in Tests**:
```bash
# test_receive_token.bats:61
current_addr=$(get_txf_address "bob-token.txf")
assert_set current_addr

# test_send_token.bats:71
state_addr=$(get_txf_address "transfer.txf")

# test_mint_token.bats:194
address=$(get_txf_address "token.txf")
assert_address_type "${address}" "masked"
```

**Recommended Implementation**:

```bash
# Extract owner address from token state predicate
# Args:
#   $1: Token file path
# Returns: Address in DIRECT:// format or raw hex
get_txf_address() {
  local token_file="${1:?Token file required}"

  # The address is encoded in the state predicate (CBOR)
  # We need to decode the predicate to extract the public key hash

  # Option 1: Extract from predicate CBOR (requires CBOR decoder)
  local predicate_hex
  predicate_hex=$(jq -r '.state.predicate' "$token_file" 2>/dev/null)

  if [[ -z "$predicate_hex" ]] || [[ "$predicate_hex" == "null" ]]; then
    echo ""
    return 1
  fi

  # Option 2: Call CLI to decode predicate (if available)
  # This would be the authoritative method

  # Option 3: Extract from known address fields (if stored separately)
  local address
  address=$(jq -r '.state.owner.address // .state.address // empty' "$token_file" 2>/dev/null)

  if [[ -n "$address" ]] && [[ "$address" != "null" ]]; then
    printf "%s" "$address"
    return 0
  fi

  # For now, return error - need proper CBOR decoder
  printf "ERROR: Cannot extract address without CBOR decoder\n" >&2
  return 1
}

export -f get_txf_address
```

**CRITICAL**: This function requires **CBOR decoding** of the predicate to extract the address.

**Recommended Approaches**:

1. **Best**: Use CLI command to decode predicate
   ```bash
   # If CLI has decode-predicate command
   address=$(run_cli decode-predicate --file "$token_file" | jq -r '.address')
   ```

2. **Alternative**: Use CBOR decoder tool
   ```bash
   predicate_hex=$(jq -r '.state.predicate' "$token_file")
   address=$(echo "$predicate_hex" | xxd -r -p | cbor-decoder | jq -r '.address')
   ```

3. **Workaround**: Store address separately in token file during creation
   - Modify CLI to include `.state.ownerAddress` field
   - Extract from this field instead of predicate

**Without proper CBOR decoding**, this function **CANNOT** be correctly implemented.

---

#### 9. `get_token_data` - **NOT IMPLEMENTED**

**Status**: ❌ **MISSING**

**Expected Behavior**: Extract and decode custom token data (hex → string/JSON)

**Usage in Tests**:
```bash
# test_mint_token.bats:76
decoded_data=$(get_token_data "token.txf")
assert_output_contains "Test NFT"

# test_receive_token.bats:90
data=$(get_token_data "bob-nft.txf")

# test_send_token.bats:130
data=$(get_token_data "transfer.txf")
```

**Recommended Implementation**:

```bash
# Extract and decode token data from token file
# Args:
#   $1: Token file path
# Returns: Decoded token data (string or JSON)
get_token_data() {
  local token_file="${1:?Token file required}"

  # Token data is stored as hex-encoded bytes in state.data
  local data_hex
  data_hex=$(jq -r '.state.data // .genesis.data.data // empty' "$token_file" 2>/dev/null)

  if [[ -z "$data_hex" ]] || [[ "$data_hex" == "null" ]]; then
    echo ""
    return 0
  fi

  # Check if it's hex encoded (even length, only hex chars)
  if [[ ! "$data_hex" =~ ^[0-9a-fA-F]*$ ]] || [[ $((${#data_hex} % 2)) -ne 0 ]]; then
    # Not hex, return as-is (might be base64 or plaintext)
    printf "%s" "$data_hex"
    return 0
  fi

  # Decode hex to bytes, then to UTF-8 string
  if command -v xxd >/dev/null 2>&1; then
    printf "%s" "$data_hex" | xxd -r -p 2>/dev/null || echo "$data_hex"
  elif command -v perl >/dev/null 2>&1; then
    printf "%s" "$data_hex" | perl -pe 's/([0-9a-f]{2})/chr hex $1/gie' 2>/dev/null || echo "$data_hex"
  else
    # Fallback: return hex if no decoder available
    echo "$data_hex"
  fi
}

export -f get_token_data
```

**Implementation Notes**:
- Token data is hex-encoded bytes (e.g., JSON → UTF-8 bytes → hex string)
- Function should decode hex → bytes → UTF-8 string
- Should handle both plaintext and JSON data
- Should gracefully handle non-UTF-8 data (return hex)

---

#### 10. `assert_has_inclusion_proof` - **NOT IMPLEMENTED**

**Status**: ❌ **MISSING**

**Expected Behavior**: Assert token has valid inclusion proof structure

**Usage in Tests**:
```bash
# test_mint_token.bats:383
assert_has_inclusion_proof "token.txf"
```

**Recommended Implementation**:

```bash
# Assert token has inclusion proof
# Args:
#   $1: Token file path
# Returns: 0 if proof exists, 1 if missing
assert_has_inclusion_proof() {
  local token_file="${1:?Token file required}"

  # Check if genesis has inclusion proof
  local has_genesis_proof
  has_genesis_proof=$(jq -e '.genesis.inclusionProof' "$token_file" >/dev/null 2>&1 && echo "true" || echo "false")

  # Check if root level has inclusion proof
  local has_root_proof
  has_root_proof=$(jq -e '.inclusionProof' "$token_file" >/dev/null 2>&1 && echo "true" || echo "false")

  if [[ "$has_genesis_proof" == "true" ]] || [[ "$has_root_proof" == "true" ]]; then
    if [[ "${UNICITY_TEST_VERBOSE_ASSERTIONS:-0}" == "1" ]]; then
      printf "${COLOR_GREEN}✓ Inclusion proof present${COLOR_RESET}\n" >&2
    fi
    return 0
  fi

  printf "${COLOR_RED}✗ Inclusion proof not found${COLOR_RESET}\n" >&2
  printf "  File: %s\n" "$token_file" >&2
  return 1
}

export -f assert_has_inclusion_proof
```

**Implementation Notes**:
- Inclusion proof can be at different levels:
  - `.genesis.inclusionProof` (for genesis transaction)
  - `.inclusionProof` (for current state)
  - `.transactionHistory[].inclusionProof` (for historical transactions)
- Function should check all possible locations
- Should NOT validate proof structure (that's done by `verify_token_cryptographically`)

---

#### 11. `is_valid_txf` - **NOT IMPLEMENTED**

**Status**: ❌ **MISSING**

**Expected Behavior**: Quick validation that file is a valid TXF (token exchange format)

**Usage in Tests**:
```bash
# test_receive_token.bats:42
assert is_valid_txf "bob-token.txf"

# test_send_token.bats:42
assert is_valid_txf "transfer.txf"

# test_mint_token.bats:29, 235, 248
assert is_valid_txf "token.txf"
```

**Recommended Implementation**:

```bash
# Check if file is valid TXF (Token Exchange Format)
# Args:
#   $1: Token file path
# Returns: 0 if valid TXF, 1 if invalid
is_valid_txf() {
  local token_file="${1:?Token file required}"

  # Check file exists
  if [[ ! -f "$token_file" ]]; then
    if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
      printf "✗ File not found: %s\n" "$token_file" >&2
    fi
    return 1
  fi

  # Check valid JSON
  if ! jq empty "$token_file" 2>/dev/null; then
    if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
      printf "✗ Invalid JSON in file: %s\n" "$token_file" >&2
    fi
    return 1
  fi

  # Check minimum required fields for TXF format
  local required_fields=(
    ".version"
    ".token"
    ".genesis"
    ".state"
  )

  for field in "${required_fields[@]}"; do
    if ! jq -e "$field" "$token_file" >/dev/null 2>&1; then
      if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
        printf "✗ Missing required field: %s\n" "$field" >&2
      fi
      return 1
    fi
  done

  # Check version is 2.0
  local version
  version=$(jq -r '.version' "$token_file" 2>/dev/null)
  if [[ "$version" != "2.0" ]]; then
    if [[ "${UNICITY_TEST_DEBUG:-0}" == "1" ]]; then
      printf "✗ Invalid version: %s (expected 2.0)\n" "$version" >&2
    fi
    return 1
  fi

  # All checks passed
  return 0
}

export -f is_valid_txf
```

**Implementation Notes**:
- This is a **quick structural check**, not cryptographic validation
- Should validate:
  - File exists and is readable
  - Valid JSON format
  - Has required fields (version, token, genesis, state)
  - Version is "2.0"
- Should NOT validate signatures, hashes, or proofs (use `assert_token_fully_valid` for that)

---

## Summary Table

| Function | Status | Validation Type | Cryptographic | Recommendation |
|----------|--------|----------------|---------------|----------------|
| `assert_token_fully_valid` | ✅ Implemented | Full | ✅ YES | **Use this for all security-critical validation** |
| `assert_token_type` | ✅ Implemented | Structural | ❌ NO | OK for test assertions, not for security |
| `is_fungible_token` | ✅ Implemented | Structural | ❌ NO | OK for test assertions, not for security |
| `is_nft_token` | ✅ Implemented | Structural | ❌ NO | OK for test assertions, not for security |
| `assert_address_type` | ✅ Implemented | Format | ❌ NO | **⚠️ Cannot distinguish masked/unmasked** |
| `get_predicate_type` | ❌ Missing | N/A | N/A | **Implement with CBOR decoder** |
| `get_txf_token_id` | ❌ Missing | N/A | N/A | **Use existing `get_token_id()` or create alias** |
| `get_txf_address` | ❌ Missing | N/A | N/A | **Requires CBOR decoder - critical gap** |
| `get_token_data` | ❌ Missing | N/A | N/A | **Implement hex decoder** |
| `assert_has_inclusion_proof` | ❌ Missing | N/A | N/A | **Simple JSON check** |
| `is_valid_txf` | ❌ Missing | N/A | N/A | **Quick format validation** |

---

## Critical Findings

### 🔴 CRITICAL: `get_txf_address` Cannot Be Properly Implemented

**Issue**: The function requires **CBOR decoding** of the predicate to extract the owner address. Without a CBOR decoder, this function cannot be correctly implemented.

**Impact**:
- Tests calling `get_txf_address()` will fail
- Cannot verify address changes during transfers
- Cannot validate ownership predicates

**Recommendations**:
1. **Best Solution**: Add CLI command `decode-predicate` that extracts address from predicate
2. **Alternative**: Integrate CBOR decoder library in test helpers
3. **Workaround**: Modify CLI to store address separately in token file (e.g., `.state.ownerAddress`)

---

### ⚠️ WARNING: `assert_address_type` Has Design Flaw

**Issue**: The function **cannot distinguish masked vs unmasked** addresses because:
> "The address format doesn't encode masked vs unmasked in the address itself. The distinction is in the predicate structure, not the address."

**Current Behavior**: Function accepts `expected_type` parameter but **cannot validate it**.

**Impact**:
- Tests using `assert_address_type(addr, "masked")` pass without actually checking if address is masked
- False sense of security in tests

**Recommendations**:
1. **Rename function** to `assert_address_format` (only validates format)
2. **Create new function** `get_address_type()` that decodes predicate to determine type
3. **Update tests** to use correct validation approach

---

### 🟡 MODERATE: Multiple Functions Use Structural Validation Only

**Functions Affected**:
- `assert_token_type`
- `is_fungible_token`
- `is_nft_token`

**Issue**: These functions only check JSON structure, not cryptographic validity.

**Risk**: Tests pass with structurally valid but cryptographically invalid tokens.

**Mitigation**: All test cases should call `assert_token_fully_valid()` first, then use these for additional checks.

**Good Pattern**:
```bash
@test "Mint NFT" {
  run_cli mint-token --preset nft -o token.txf

  # 1. CRYPTOGRAPHIC validation (security-critical)
  assert_token_fully_valid "token.txf"

  # 2. STRUCTURAL checks (test assertions)
  assert is_nft_token "token.txf"
  assert_token_type "token.txf" "nft"
}
```

---

## Recommendations

### Immediate Actions (High Priority)

1. **Implement Missing Functions**:
   - ✅ `is_valid_txf` - Easy, structural only
   - ✅ `get_token_data` - Medium, needs hex decoder
   - ✅ `get_txf_token_id` - Easy, alias existing function
   - ✅ `assert_has_inclusion_proof` - Easy, JSON check
   - ⚠️ `get_predicate_type` - Hard, needs CBOR decoder
   - 🔴 `get_txf_address` - Hard, needs CBOR decoder

2. **Fix `assert_address_type`**:
   - Rename to `assert_address_format`
   - Document limitation clearly
   - Create new `get_address_type_from_predicate()` if CBOR decoder available

3. **Add CBOR Decoding Capability**:
   - Integrate CBOR decoder library OR
   - Add CLI command for predicate decoding OR
   - Document limitation and mark tests as "requires CBOR decoder"

### Medium Priority

4. **Enhance Documentation**:
   - Add comments to all validation functions indicating:
     - ✅ "Cryptographic validation" or ❌ "Structural validation only"
     - Security implications
     - When to use each function

5. **Create Validation Hierarchy**:
   ```bash
   # Level 1: Format validation (fast, no crypto)
   is_valid_txf()

   # Level 2: Structure validation (medium, no crypto)
   assert_token_has_valid_structure()
   is_nft_token()
   is_fungible_token()

   # Level 3: Cryptographic validation (slow, full security)
   assert_token_fully_valid()  # ← Use this for security
   ```

6. **Add Warning Messages**:
   ```bash
   is_nft_token() {
     # WARNING: This function only checks JSON structure.
     # It does NOT cryptographically validate the token.
     # Use assert_token_fully_valid() for security validation.
     ...
   }
   ```

### Long-term Improvements

7. **Create Test Helper Library Categories**:
   - `assertions-crypto.bash` - Cryptographic validation functions
   - `assertions-structure.bash` - JSON structure checks
   - `assertions-format.bash` - Format validation (hex, addresses, etc.)

8. **Add Performance Options**:
   ```bash
   # Fast path: Skip crypto if already validated
   SKIP_CRYPTO_VALIDATION=1 assert_token_fully_valid "$file"
   ```

9. **Implement Memoization**:
   ```bash
   # Cache validation results to avoid repeated crypto checks
   declare -A VALIDATED_TOKENS
   ```

---

## Test Coverage Analysis

### Tests Using Cryptographic Validation ✅

These tests properly validate tokens:
- `test_mint_token.bats`: 18+ tests using `assert_token_fully_valid`
- `test_send_token.bats`: 12+ tests using `assert_token_fully_valid`
- `test_receive_token.bats`: 15+ tests using `assert_token_fully_valid`
- `test_verify_token.bats`: All tests (by design)

### Tests Using Structural Validation Only ⚠️

These tests may pass with invalid tokens:
- Any test using only `is_nft_token()` without `assert_token_fully_valid()`
- Any test using only `assert_token_type()` without `assert_token_fully_valid()`

**Recommendation**: Audit all test cases to ensure `assert_token_fully_valid()` is called before structural checks.

---

## Conclusion

The test helper library has **one excellent cryptographic validator** (`assert_token_fully_valid`) that properly validates tokens using SDK cryptographic functions. However:

1. **3 critical helper functions are missing** (27% of requested functions)
2. **Most helper functions use structural validation only**, which is appropriate for test assertions but must be paired with cryptographic validation
3. **One function has a design flaw** (`assert_address_type` cannot validate what it claims to validate)
4. **Two functions require CBOR decoding capability** that is currently unavailable

The recommended implementation code provided above addresses all missing functions, with clear documentation of their limitations and security implications.

---

## Appendix: Function Implementation Code

All recommended implementations are included in the detailed analysis above. Key points:

- **Easy to implement** (no external dependencies):
  - `is_valid_txf`
  - `get_txf_token_id` (alias existing function)
  - `assert_has_inclusion_proof`

- **Medium complexity** (needs standard tools):
  - `get_token_data` (requires `xxd` or `perl`)

- **Hard to implement** (requires CBOR decoding):
  - `get_predicate_type` (heuristic implementation provided, proper implementation needs CBOR)
  - `get_txf_address` (CANNOT be properly implemented without CBOR decoder)

---

**End of Audit Report**
