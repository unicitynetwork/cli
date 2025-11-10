# Missing Helper Functions - Quick Summary

**Status Date**: 2025-11-04

## Missing Functions Overview

| Function | Difficulty | Blocker | Priority |
|----------|-----------|---------|----------|
| `is_valid_txf` | ⚡ Easy | None | HIGH |
| `assert_has_inclusion_proof` | ⚡ Easy | None | HIGH |
| `get_txf_token_id` | ⚡ Easy | None | HIGH |
| `get_token_data` | ⚙️ Medium | Needs hex decoder | HIGH |
| `get_predicate_type` | 🔴 Hard | Needs CBOR decoder | MEDIUM |
| `get_txf_address` | 🔴 Hard | Needs CBOR decoder | HIGH |

---

## Quick Implementation Guide

### 1. `is_valid_txf` ⚡ EASY

**Add to**: `/home/vrogojin/cli/tests/helpers/token-helpers.bash`

**Location**: After line 560 (before exports)

**Code**:
```bash
# Check if file is valid TXF (Token Exchange Format)
# Args:
#   $1: Token file path
# Returns: 0 if valid TXF, 1 if invalid
is_valid_txf() {
  local token_file="${1:?Token file required}"

  [[ -f "$token_file" ]] || return 1
  jq empty "$token_file" 2>/dev/null || return 1

  local required_fields=(".version" ".token" ".genesis" ".state")
  for field in "${required_fields[@]}"; do
    jq -e "$field" "$token_file" >/dev/null 2>&1 || return 1
  done

  local version
  version=$(jq -r '.version' "$token_file" 2>/dev/null)
  [[ "$version" == "2.0" ]] || return 1

  return 0
}
```

**Export**: Add to exports section
```bash
export -f is_valid_txf
```

---

### 2. `assert_has_inclusion_proof` ⚡ EASY

**Add to**: `/home/vrogojin/cli/tests/helpers/assertions.bash`

**Location**: After line 918 (in inclusion proof section)

**Code**:
```bash
# Assert token has inclusion proof
# Args:
#   $1: Token file path
# Returns: 0 if proof exists, 1 if missing
assert_has_inclusion_proof() {
  local token_file="${1:?Token file required}"

  if jq -e '.genesis.inclusionProof' "$token_file" >/dev/null 2>&1; then
    return 0
  fi

  if jq -e '.inclusionProof' "$token_file" >/dev/null 2>&1; then
    return 0
  fi

  printf "${COLOR_RED}✗ Inclusion proof not found${COLOR_RESET}\n" >&2
  printf "  File: %s\n" "$token_file" >&2
  return 1
}
```

**Export**: Add to exports section (around line 1410)
```bash
export -f assert_has_inclusion_proof
```

---

### 3. `get_txf_token_id` ⚡ EASY

**Solution**: This function already exists as `get_token_id()`!

**Add alias to**: `/home/vrogojin/cli/tests/helpers/token-helpers.bash`

**Location**: After line 455

**Code**:
```bash
# Alias for get_token_id (compatibility with tests)
get_txf_token_id() {
  get_token_id "$@"
}
```

**Export**: Add to exports section
```bash
export -f get_txf_token_id
```

---

### 4. `get_token_data` ⚙️ MEDIUM

**Add to**: `/home/vrogojin/cli/tests/helpers/token-helpers.bash`

**Location**: After line 560 (before exports)

**Code**:
```bash
# Extract and decode token data from token file
# Args:
#   $1: Token file path
# Returns: Decoded token data (string or JSON)
get_token_data() {
  local token_file="${1:?Token file required}"

  local data_hex
  data_hex=$(jq -r '.state.data // .genesis.data.data // empty' "$token_file" 2>/dev/null)

  if [[ -z "$data_hex" ]] || [[ "$data_hex" == "null" ]]; then
    echo ""
    return 0
  fi

  # Check if hex encoded
  if [[ ! "$data_hex" =~ ^[0-9a-fA-F]*$ ]] || [[ $((${#data_hex} % 2)) -ne 0 ]]; then
    printf "%s" "$data_hex"
    return 0
  fi

  # Decode hex to UTF-8
  if command -v xxd >/dev/null 2>&1; then
    printf "%s" "$data_hex" | xxd -r -p 2>/dev/null || echo "$data_hex"
  elif command -v perl >/dev/null 2>&1; then
    printf "%s" "$data_hex" | perl -pe 's/([0-9a-f]{2})/chr hex $1/gie' 2>/dev/null || echo "$data_hex"
  else
    echo "$data_hex"
  fi
}
```

**Export**:
```bash
export -f get_token_data
```

**Dependencies**: Requires `xxd` (usually available) or `perl`

---

### 5. `get_predicate_type` 🔴 HARD

**Add to**: `/home/vrogojin/cli/tests/helpers/token-helpers.bash`

**Location**: After line 560 (before exports)

**Code** (Heuristic Implementation):
```bash
# Extract predicate type from token file
# Args:
#   $1: Token file path
# Returns: "masked" or "unmasked" or "unknown"
# NOTE: This is a heuristic implementation
get_predicate_type() {
  local token_file="${1:?Token file required}"

  local predicate_hex
  predicate_hex=$(jq -r '.state.predicate' "$token_file" 2>/dev/null)

  if [[ -z "$predicate_hex" ]] || [[ "$predicate_hex" == "null" ]]; then
    echo "unknown"
    return 1
  fi

  # Heuristic: Engine ID appears in predicate hex
  # Engine 1 (0001) = masked
  # Engine 2 (0002) = unmasked
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
```

**⚠️ WARNING**: This is a **heuristic** that may produce false positives.

**Proper Solution**: Requires CBOR decoder to parse predicate structure.

**Export**:
```bash
export -f get_predicate_type
```

---

### 6. `get_txf_address` 🔴 HARD - BLOCKED

**Status**: ⛔ **CANNOT BE PROPERLY IMPLEMENTED WITHOUT CBOR DECODER**

**Why**: The owner address is encoded inside the CBOR predicate structure. Extracting it requires:
1. Decoding CBOR from hex
2. Parsing predicate structure
3. Extracting public key hash
4. Formatting as DIRECT:// address

**Temporary Workaround**:
```bash
# Extract owner address from token predicate
# Args:
#   $1: Token file path
# Returns: Address or error message
get_txf_address() {
  local token_file="${1:?Token file required}"

  # Check if address is stored separately (if CLI was modified)
  local address
  address=$(jq -r '.state.ownerAddress // .state.owner.address // empty' "$token_file" 2>/dev/null)

  if [[ -n "$address" ]] && [[ "$address" != "null" ]]; then
    printf "%s" "$address"
    return 0
  fi

  # Cannot extract from predicate without CBOR decoder
  printf "ERROR: Address extraction requires CBOR decoder\n" >&2
  return 1
}
```

**Recommended Solutions**:

1. **Add CLI command**:
   ```bash
   # Modify CLI to add:
   unicity-cli decode-predicate --file token.txf --output-address
   ```

2. **Modify token format**:
   ```bash
   # Add field to token file:
   .state.ownerAddress: "DIRECT://..."
   ```

3. **Integrate CBOR decoder**:
   ```bash
   # Install CBOR tools in test environment
   sudo apt-get install cbor-diag  # or similar
   ```

**Export**:
```bash
export -f get_txf_address
```

---

## Implementation Checklist

### Phase 1: Easy Wins (30 minutes)

- [ ] Add `is_valid_txf()` to `token-helpers.bash`
- [ ] Add `assert_has_inclusion_proof()` to `assertions.bash`
- [ ] Add `get_txf_token_id()` alias to `token-helpers.bash`
- [ ] Update export sections in both files
- [ ] Run tests to verify no syntax errors

### Phase 2: Medium Complexity (1 hour)

- [ ] Add `get_token_data()` to `token-helpers.bash`
- [ ] Test hex decoding with sample token files
- [ ] Verify UTF-8 decoding works correctly
- [ ] Test with JSON metadata
- [ ] Update export section

### Phase 3: Hard Problems (Requires Decision)

- [ ] **Decision Point**: How to implement CBOR decoding?
  - [ ] Option A: Add CLI command `decode-predicate`
  - [ ] Option B: Integrate CBOR library in tests
  - [ ] Option C: Modify token format to include address field
  - [ ] Option D: Document limitation and skip affected tests

- [ ] Implement `get_predicate_type()` (heuristic or proper)
- [ ] Implement `get_txf_address()` (blocked on CBOR)
- [ ] Update tests that use these functions
- [ ] Document limitations clearly

---

## Testing After Implementation

### Validation Script

```bash
#!/usr/bin/env bash
# Test all helper functions

source tests/helpers/common.bash
source tests/helpers/token-helpers.bash
source tests/helpers/assertions.bash

# Test is_valid_txf
echo "Testing is_valid_txf..."
if is_valid_txf "tests/fixtures/sample-token.txf"; then
  echo "✓ is_valid_txf works"
else
  echo "✗ is_valid_txf failed"
fi

# Test assert_has_inclusion_proof
echo "Testing assert_has_inclusion_proof..."
if assert_has_inclusion_proof "tests/fixtures/sample-token.txf"; then
  echo "✓ assert_has_inclusion_proof works"
else
  echo "✗ assert_has_inclusion_proof failed"
fi

# Test get_txf_token_id
echo "Testing get_txf_token_id..."
token_id=$(get_txf_token_id "tests/fixtures/sample-token.txf")
if [[ -n "$token_id" ]]; then
  echo "✓ get_txf_token_id works: $token_id"
else
  echo "✗ get_txf_token_id failed"
fi

# Test get_token_data
echo "Testing get_token_data..."
data=$(get_token_data "tests/fixtures/sample-token.txf")
echo "✓ get_token_data returned: $data"

# Test get_predicate_type (if implemented)
echo "Testing get_predicate_type..."
pred_type=$(get_predicate_type "tests/fixtures/sample-token.txf")
echo "Predicate type: $pred_type"

# Test get_txf_address (if implemented)
echo "Testing get_txf_address..."
address=$(get_txf_address "tests/fixtures/sample-token.txf" 2>&1)
echo "Address: $address"
```

### Run Existing Tests

```bash
# Run tests that use these functions
bats tests/functional/test_mint_token.bats -f "MINT_TOKEN-001"
bats tests/functional/test_mint_token.bats -f "MINT_TOKEN-002"
bats tests/functional/test_receive_token.bats -f "RECEIVE_TOKEN-001"
bats tests/functional/test_send_token.bats -f "SEND_TOKEN-001"
```

---

## Known Issues & Limitations

### 1. `assert_address_type()` Design Flaw

**Issue**: Cannot actually distinguish masked vs unmasked addresses.

**Current Code** (line 1353-1393 in `assertions.bash`):
```bash
# NOTE: The address format doesn't encode masked vs unmasked in the address itself
# The distinction is in the predicate structure, not the address
```

**Fix**: Rename function and document limitation:
```bash
# Rename: assert_address_type → assert_address_format
# Update: Tests should use get_predicate_type() instead
```

### 2. CBOR Decoding Dependency

**Affected Functions**:
- `get_predicate_type()` - Partially works with heuristic
- `get_txf_address()` - Completely blocked

**Status**: Waiting on decision for CBOR decoder integration.

---

## Additional Resources

- **Full Audit Report**: `VALIDATION_AUDIT_REPORT.md`
- **Existing Functions**: `token-helpers.bash`, `assertions.bash`
- **Test Examples**: `tests/functional/test_*.bats`
- **SDK Documentation**: Check CLI source code for CBOR handling

---

## Questions?

If you have questions about implementation:

1. Check `VALIDATION_AUDIT_REPORT.md` for detailed analysis
2. Look at existing similar functions in `token-helpers.bash`
3. Review test usage in `tests/functional/test_*.bats`
4. Consider security implications (cryptographic vs structural validation)

---

**Last Updated**: 2025-11-04
