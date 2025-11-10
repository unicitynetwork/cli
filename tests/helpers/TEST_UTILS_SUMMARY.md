# Test Utilities - Quick Reference

## Summary

Created comprehensive utility functions to help with BATS test development. These utilities handle hex decoding, CBOR predicate parsing, and TXF validation.

## Files Created

1. **`test-utils.cjs`** (Node.js) - Core utility implementations
2. **`txf-utils.bash`** - Bash wrapper functions for BATS tests
3. **`test-utils-demo.bash`** - Demonstration script
4. **`TEST_UTILS_README.md`** - Complete documentation

## Quick Usage

```bash
# In your BATS test:
source tests/helpers/txf-utils.bash

# Decode hex
decoded=$(decode_hex "7b226e616d65223a2254657374227d")

# Extract from TXF
token_id=$(extract_token_id "$txf_file")
address=$(extract_txf_address "$txf_file")
token_data=$(extract_token_data "$txf_file")

# Validate proof
if has_valid_inclusion_proof "$txf_file"; then
  echo "Proof valid"
fi

# Decode predicate
predicate=$(extract_predicate "$txf_file")
pubkey=$(extract_predicate_pubkey "$predicate")
if is_predicate_masked "$predicate"; then
  echo "One-time address"
fi
```

## Key Functions

### Hex Decoding
- `decode_hex <hex>` - Decode hex to UTF-8

### TXF Extraction
- `extract_token_data <txf>` - Extract tokenData
- `extract_token_id <txf>` - Extract tokenId
- `extract_token_type <txf>` - Extract tokenType
- `extract_txf_address <txf>` - Extract address
- `extract_predicate <txf>` - Extract predicate

### Predicate Decoding
- `decode_predicate <hex>` - Full CBOR decode (returns JSON)
- `extract_predicate_pubkey <hex>` - Get public key
- `get_predicate_engine <hex>` - Get engine name
- `is_predicate_masked <hex>` - Check if masked (returns 0/1)

### Proof Validation
- `validate_inclusion_proof <txf>` - Validate proof (returns JSON)
- `has_valid_inclusion_proof <txf>` - Boolean check (returns 0/1)
- `has_authenticator <txf>` - Check for authenticator
- `has_merkle_tree_path <txf>` - Check for merkle path
- `has_transaction_hash <txf>` - Check for tx hash
- `has_unicity_certificate <txf>` - Check for certificate

### Structure Validation
- `is_valid_json <file>` - Validate JSON
- `is_valid_txf <file>` - Validate TXF structure

## Testing

Run the demo to see all functions in action:

```bash
./tests/helpers/test-utils-demo.bash /path/to/token.txf
```

Example output:
```
=============================================================================
TXF Utilities Demonstration
=============================================================================
Testing with file: /home/vrogojin/cli/token1.txf

--- Test 1: Hex Decoding ---
Input hex: 7b226e616d65223a2254657374204e4654227d
Decoded: {"name":"Test NFT"}

--- Test 2: Token Data Extraction ---
Token data: ''
Token ID: 8639a4331dcb1a01862a3e93462b04ff7fa376c4582af53aeae6ddf2f08e4e4d
Token type: f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509

--- Test 3: Address Extraction ---
Address: DIRECT://00007012b731927b81f1622aa5c5e5ea1c474d0d673aa5bc647195fe6b03af491faef4e9e554

--- Test 4: Predicate Decoding ---
Predicate information:
{
  "engineId": 0,
  "template": "00",
  "engineName": "unmasked (reusable address)",
  "tokenId": "8639a4331dcb1a01862a3e93462b04ff7fa376c4582af53aeae6ddf2f08e4e4d",
  "tokenType": "f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509",
  "publicKey": "03a96d50ab9f47f0f2f2c1b55ac333a5f4a5894e072956b46a9784bd936df346c4",
  "algorithm": "secp256k1",
  "signature": "4d72dc80b32344143c51e7d56367a43c47bcdf310f69489a5de11ab22a305c19...",
  "isMasked": false
}

--- Test 5: Inclusion Proof Validation ---
✓ Inclusion proof is VALID
  ✓ Has authenticator
  ✓ Has merkle tree path
  ✓ Has transaction hash
  ✓ Has unicity certificate

--- Test 6: TXF Structure Validation ---
✓ File is valid JSON
✓ File is valid TXF format
```

## Architecture

### Node.js Layer (`test-utils.cjs`)
Handles complex operations requiring SDK libraries:
- CBOR decoding (via @unicitylabs/commons)
- Hex conversion (via @unicitylabs/state-transition-sdk)
- JSON parsing and validation

### Bash Layer (`txf-utils.bash`)
Provides bash-native interface:
- Simple function calls from BATS tests
- Wraps Node.js utilities
- Returns values suitable for bash processing

### Why Two Layers?

1. **Simplicity** - BATS tests use simple bash functions
2. **Power** - Complex operations leverage SDK libraries
3. **Debugging** - Can call Node script directly for testing
4. **Performance** - Batch operations in Node, simple checks in bash

## Predicate Structure

Predicates are CBOR-encoded:
```
[engineId, template, params]
```

Where params contains:
```
[tokenId, tokenType, publicKey, algorithm, flags, signature, ...mask?]
```

### Engine Types
- **Engine 0** - Unmasked (reusable address)
- **Engine 1** - Masked (one-time address)

## Common Patterns

### Validate Token After Mint
```bash
@test "mint creates valid token" {
  SECRET="test" run_cli mint-token --local --save
  txf=$(echo "$output" | grep -o '/tmp/[^[:space:]]*.txf' | head -1)

  assert is_valid_txf "$txf"
  assert has_valid_inclusion_proof "$txf"
}
```

### Check Predicate Type
```bash
@test "default address is masked" {
  SECRET="test" run_cli gen-address
  address=$(echo "$output" | grep 'DIRECT://' | awk '{print $2}')

  SECRET="test" run_cli mint-token --local -r "$address" --save
  txf=$(echo "$output" | grep -o '/tmp/[^[:space:]]*.txf' | head -1)

  predicate=$(extract_predicate "$txf")
  assert is_predicate_masked "$predicate"
}
```

### Decode Token Data
```bash
@test "token data is preserved" {
  data='{"name":"Test","value":100}'
  SECRET="test" run_cli mint-token --local -d "$data" --save
  txf=$(echo "$output" | grep -o '/tmp/[^[:space:]]*.txf' | head -1)

  token_data=$(extract_token_data "$txf")
  assert_equals "$token_data" "$data"
}
```

## Dependencies

- Node.js (for test-utils.cjs)
- jq (for JSON parsing in bash)
- @unicitylabs/commons (for CBOR)
- @unicitylabs/state-transition-sdk (for utilities)

## Testing Results

All utilities tested successfully against:
- `/tmp/test-final.txf` - Valid unmasked token
- `/home/vrogojin/cli/token1.txf` - Valid unmasked token
- Various edge cases (empty strings, missing fields, etc.)

## Next Steps

These utilities can now be used to:
1. Fix failing BATS tests
2. Add new test assertions
3. Validate test outputs
4. Debug token structures
5. Verify proof integrity

## Documentation

- **Complete Guide**: `TEST_UTILS_README.md`
- **Demo Script**: `test-utils-demo.bash`
- **Source Code**: `test-utils.cjs`, `txf-utils.bash`
