# Test Utilities for BATS Tests

This directory contains utility functions for working with TXF files, hex encoding, CBOR predicates, and inclusion proofs in BATS tests.

## Files

- **`test-utils.cjs`** - Node.js utility script for hex decoding, CBOR parsing, and TXF validation
- **`txf-utils.bash`** - Bash wrapper functions that can be called from BATS tests
- **`test-utils-demo.bash`** - Demonstration script showing all available functions

## Quick Start

```bash
# In your BATS test file:
source tests/helpers/txf-utils.bash

@test "example test" {
  # Extract and decode token data
  token_data=$(extract_token_data "$txf_file")

  # Validate inclusion proof
  if validate_inclusion_proof "$txf_file"; then
    echo "Proof is valid"
  fi

  # Check predicate type
  predicate=$(extract_predicate "$txf_file")
  if is_predicate_masked "$predicate"; then
    echo "This is a masked (one-time) address"
  fi
}
```

## Available Functions

### Hex Encoding/Decoding

#### `decode_hex <hex-string>`
Decode hex-encoded string to UTF-8 text.

**Example:**
```bash
decoded=$(decode_hex "7b226e616d65223a2254657374227d")
# Returns: {"name":"Test"}
```

**Parameters:**
- `$1`: Hex-encoded string (can be empty)

**Returns:** Decoded UTF-8 string

---

### TXF Field Extraction

#### `extract_token_data <txf-file>`
Extract and decode the `tokenData` field from a TXF file.

**Example:**
```bash
token_data=$(extract_token_data "/path/to/token.txf")
```

**Parameters:**
- `$1`: Path to TXF file

**Returns:** Decoded token data (empty string if not present or empty)

---

#### `extract_token_id <txf-file>`
Extract the `tokenId` from a TXF file.

**Example:**
```bash
token_id=$(extract_token_id "/path/to/token.txf")
# Returns: bfa5e45065f992d9999358d1d668f71bed7abf49fcd10f095946d4009980fe35
```

**Parameters:**
- `$1`: Path to TXF file

**Returns:** Token ID hex string

---

#### `extract_token_type <txf-file>`
Extract the `tokenType` from a TXF file.

**Example:**
```bash
token_type=$(extract_token_type "/path/to/token.txf")
# Returns: f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509
```

**Parameters:**
- `$1`: Path to TXF file

**Returns:** Token type hex string

---

#### `extract_txf_address <txf-file>`
Extract the recipient address from a TXF file.

**Example:**
```bash
address=$(extract_txf_address "/path/to/token.txf")
# Returns: DIRECT://000050490f41d9cd157f144a8396f9f1bbebf4323799fdfd17d6aaaa767777ea1c7068f338e4
```

**Parameters:**
- `$1`: Path to TXF file

**Returns:** Address string (e.g., `DIRECT://...`)

---

#### `extract_predicate <txf-file>`
Extract the predicate hex string from a TXF file.

**Example:**
```bash
predicate=$(extract_predicate "/path/to/token.txf")
# Returns: 8300410058b5865820bfa5e45065f992d9999358d1d668f71b...
```

**Parameters:**
- `$1`: Path to TXF file

**Returns:** Predicate hex string

---

### CBOR Predicate Decoding

#### `decode_predicate <predicate-hex>`
Decode a CBOR-encoded predicate and extract all information.

**Example:**
```bash
predicate_info=$(decode_predicate "$predicate_hex")
echo "$predicate_info" | jq '.'
# Returns JSON with: engineId, template, tokenId, tokenType, publicKey, algorithm, signature, etc.
```

**Parameters:**
- `$1`: Hex-encoded CBOR predicate

**Returns:** JSON object containing:
- `engineId` - Engine ID (0 = unmasked, 1 = masked)
- `engineName` - Human-readable engine name
- `template` - Template hash
- `tokenId` - Token ID
- `tokenType` - Token type
- `publicKey` - Public key hex string
- `algorithm` - Signature algorithm (e.g., "secp256k1")
- `signature` - Signature hex string
- `isMasked` - Boolean indicating if predicate is masked
- `mask` - Mask value (only for masked predicates)

---

#### `extract_predicate_pubkey <predicate-hex>`
Extract just the public key from a predicate.

**Example:**
```bash
pubkey=$(extract_predicate_pubkey "$predicate_hex")
# Returns: 028e242fc373fb03cce985fc7b86374b6ef9dcf04d75da4f8fd8c9cc138a4e6332
```

**Parameters:**
- `$1`: Hex-encoded CBOR predicate

**Returns:** Public key hex string

---

#### `get_predicate_engine <predicate-hex>`
Get the human-readable engine name from a predicate.

**Example:**
```bash
engine=$(get_predicate_engine "$predicate_hex")
# Returns: "unmasked (reusable address)" or "masked (one-time address)"
```

**Parameters:**
- `$1`: Hex-encoded CBOR predicate

**Returns:** Engine name string

---

#### `is_predicate_masked <predicate-hex>`
Check if a predicate is masked (one-time address).

**Example:**
```bash
if is_predicate_masked "$predicate_hex"; then
  echo "This is a one-time address"
else
  echo "This is a reusable address"
fi
```

**Parameters:**
- `$1`: Hex-encoded CBOR predicate

**Returns:**
- Exit code 0 if masked
- Exit code 1 if not masked

---

### Inclusion Proof Validation

#### `validate_inclusion_proof <txf-file>`
Validate the inclusion proof in a TXF file.

**Example:**
```bash
if validate_inclusion_proof "$txf_file"; then
  echo "Proof is valid"
else
  echo "Proof is invalid"
  validate_inclusion_proof "$txf_file" | jq '.errors'
fi
```

**Parameters:**
- `$1`: Path to TXF file

**Returns:**
- Exit code 0 if valid
- Exit code 1 if invalid
- JSON output with validation details

---

#### `has_valid_inclusion_proof <txf-file>`
Boolean check for valid inclusion proof (no output).

**Example:**
```bash
if has_valid_inclusion_proof "$txf_file"; then
  # Proof is valid
fi
```

**Parameters:**
- `$1`: Path to TXF file

**Returns:**
- Exit code 0 if valid
- Exit code 1 if invalid

---

#### `has_authenticator <txf-file>`
Check if TXF has an authenticator field in the inclusion proof.

**Example:**
```bash
if has_authenticator "$txf_file"; then
  echo "Authenticator present"
fi
```

**Parameters:**
- `$1`: Path to TXF file

**Returns:** Exit code 0 if present and non-null, 1 otherwise

---

#### `has_merkle_tree_path <txf-file>`
Check if TXF has a merkleTreePath field in the inclusion proof.

**Parameters:**
- `$1`: Path to TXF file

**Returns:** Exit code 0 if present and non-null, 1 otherwise

---

#### `has_transaction_hash <txf-file>`
Check if TXF has a transactionHash field in the inclusion proof.

**Parameters:**
- `$1`: Path to TXF file

**Returns:** Exit code 0 if present and non-null, 1 otherwise

---

#### `has_unicity_certificate <txf-file>`
Check if TXF has a unicityCertificate field in the inclusion proof.

**Parameters:**
- `$1`: Path to TXF file

**Returns:** Exit code 0 if present and non-null, 1 otherwise

---

### TXF Structure Validation

#### `is_valid_json <file>`
Check if a file contains valid JSON.

**Example:**
```bash
if is_valid_json "$txf_file"; then
  echo "Valid JSON"
fi
```

**Parameters:**
- `$1`: Path to file

**Returns:** Exit code 0 if valid JSON, 1 otherwise

---

#### `is_valid_txf <file>`
Check if a file is a valid TXF format (has version, genesis, state fields).

**Example:**
```bash
if is_valid_txf "$txf_file"; then
  echo "Valid TXF file"
fi
```

**Parameters:**
- `$1`: Path to file

**Returns:** Exit code 0 if valid TXF, 1 otherwise

---

## Node.js CLI Interface

The `test-utils.cjs` script can also be called directly from the command line:

```bash
# Decode hex
node tests/helpers/test-utils.cjs decode-hex "7b226e616d65223a2254657374227d"

# Decode predicate
node tests/helpers/test-utils.cjs decode-predicate "$predicate_hex"

# Validate proof
node tests/helpers/test-utils.cjs validate-proof "/path/to/token.txf"

# Extract address
node tests/helpers/test-utils.cjs extract-address "/path/to/token.txf"

# Extract token data
node tests/helpers/test-utils.cjs extract-token-data "/path/to/token.txf"
```

## Testing the Utilities

Run the demonstration script to see all utilities in action:

```bash
./tests/helpers/test-utils-demo.bash /path/to/token.txf
```

This will:
1. Test hex encoding/decoding
2. Extract token data, ID, type
3. Extract and validate addresses
4. Decode CBOR predicates
5. Validate inclusion proofs
6. Validate TXF structure

## Predicate Structure

Predicates are CBOR-encoded arrays with the following structure:

```
[engineId, template, params]
```

Where:
- **engineId**: 0 = unmasked (reusable), 1 = masked (one-time)
- **template**: Byte string (hash of predicate template)
- **params**: Byte string containing CBOR array:
  ```
  [tokenId, tokenType, publicKey, algorithm, flags, signature, ...mask?]
  ```

### Unmasked Predicate (Engine 0)
- Reusable address
- 6 parameters: tokenId, tokenType, publicKey, algorithm, flags, signature

### Masked Predicate (Engine 1)
- One-time address
- 7 parameters: tokenId, tokenType, publicKey, algorithm, flags, signature, mask

## Common Test Patterns

### Example 1: Validate Token After Minting

```bash
@test "mint-token creates valid TXF with inclusion proof" {
  # Mint token
  SECRET="test-secret" run_cli mint-token --local --save
  txf_file=$(echo "$output" | grep -o '/tmp/[^[:space:]]*.txf' | head -1)

  # Validate structure
  assert is_valid_txf "$txf_file"

  # Validate inclusion proof
  assert has_valid_inclusion_proof "$txf_file"
  assert has_authenticator "$txf_file"
  assert has_merkle_tree_path "$txf_file"
  assert has_transaction_hash "$txf_file"
  assert has_unicity_certificate "$txf_file"
}
```

### Example 2: Check Predicate Type

```bash
@test "gen-address creates masked address by default" {
  SECRET="test-secret" run_cli gen-address
  address=$(echo "$output" | grep 'DIRECT://' | awk '{print $2}')

  # Mint token to this address
  SECRET="test-secret" run_cli mint-token --local --save -r "$address"
  txf_file=$(echo "$output" | grep -o '/tmp/[^[:space:]]*.txf' | head -1)

  # Check predicate is masked
  predicate=$(extract_predicate "$txf_file")
  assert is_predicate_masked "$predicate"
}
```

### Example 3: Decode and Validate Token Data

```bash
@test "mint-token with custom data stores data correctly" {
  data='{"name":"Test NFT","value":100}'
  SECRET="test-secret" run_cli mint-token --local --save -d "$data"
  txf_file=$(echo "$output" | grep -o '/tmp/[^[:space:]]*.txf' | head -1)

  # Extract and decode token data
  token_data=$(extract_token_data "$txf_file")

  # Validate decoded data
  assert_equals "$token_data" "$data"

  # Check specific fields
  name=$(echo "$token_data" | jq -r '.name')
  assert_equals "$name" "Test NFT"
}
```

## Dependencies

- **Node.js** - For running test-utils.cjs
- **jq** - For JSON parsing in bash functions
- **@unicitylabs/commons** - For CBOR decoding
- **@unicitylabs/state-transition-sdk** - For hex conversion and other utilities

## Troubleshooting

### "test-utils.cjs not found" Error

Make sure you're running tests from the project root directory:
```bash
cd /home/vrogojin/cli
bats tests/functional/test_mint_token.bats
```

### "jq not found" Error

Install jq:
```bash
# Ubuntu/Debian
sudo apt install jq

# macOS
brew install jq
```

### CBOR Decoding Errors

If you see "paramsDecodeError" in predicate decoding output, this usually means:
1. The predicate has a newer format not yet supported
2. The predicate is corrupted
3. The CBOR structure is non-standard

Check the raw predicate hex and compare with known good predicates.

## Architecture Notes

### Why Two Files?

- **`test-utils.cjs`**: Handles complex operations requiring SDK libraries (CBOR parsing, hex conversion)
- **`txf-utils.bash`**: Provides bash-native interface that's easy to call from BATS tests

This separation allows:
1. Tests to use simple bash functions
2. Complex logic to leverage SDK libraries
3. Easy debugging (can call Node script directly)
4. Flexibility to add pure-bash alternatives (e.g., `decode_hex_xxd`)

### Performance

Most functions are fast (<100ms), but CBOR decoding can take longer for complex predicates. If you need to extract multiple fields from the same predicate, consider:

1. Calling `decode_predicate` once and storing the result
2. Using `jq` to extract multiple fields from the JSON output

Example:
```bash
# Good (one call)
predicate_info=$(decode_predicate "$predicate_hex")
engine=$(echo "$predicate_info" | jq -r '.engineName')
pubkey=$(echo "$predicate_info" | jq -r '.publicKey')

# Less efficient (two calls)
engine=$(get_predicate_engine "$predicate_hex")
pubkey=$(extract_predicate_pubkey "$predicate_hex")
```

## Contributing

When adding new utility functions:

1. Add the Node.js implementation to `test-utils.cjs`
2. Add the bash wrapper to `txf-utils.bash`
3. Export the bash function at the end of `txf-utils.bash`
4. Add a test case to `test-utils-demo.bash`
5. Document the function in this README

## License

Same as parent project.
