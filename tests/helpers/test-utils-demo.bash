#!/usr/bin/env bash
# =============================================================================
# Test Utilities Demonstration Script
# =============================================================================
# This script demonstrates all the utility functions available for BATS tests
#
# Usage: ./tests/helpers/test-utils-demo.bash [txf-file]
# =============================================================================

set -euo pipefail

# Source the utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/txf-utils.bash"

# Use provided TXF file or default
TXF_FILE="${1:-/tmp/test-final.txf}"

if [[ ! -f "$TXF_FILE" ]]; then
  echo "Error: TXF file not found: $TXF_FILE"
  echo "Usage: $0 [txf-file]"
  exit 1
fi

echo "============================================================================="
echo "TXF Utilities Demonstration"
echo "============================================================================="
echo "Testing with file: $TXF_FILE"
echo ""

# =============================================================================
# Test 1: Hex Decoding
# =============================================================================
echo "--- Test 1: Hex Decoding ---"
echo ""

HEX_TEST="7b226e616d65223a2254657374204e4654227d"
echo "Input hex: $HEX_TEST"
DECODED=$(decode_hex "$HEX_TEST")
echo "Decoded: $DECODED"
echo ""

EMPTY_HEX=""
echo "Empty hex string:"
EMPTY_DECODED=$(decode_hex "$EMPTY_HEX")
echo "Decoded: '$EMPTY_DECODED'"
echo ""

# =============================================================================
# Test 2: Token Data Extraction
# =============================================================================
echo "--- Test 2: Token Data Extraction ---"
echo ""

TOKEN_DATA=$(extract_token_data "$TXF_FILE")
echo "Token data: '$TOKEN_DATA'"
echo ""

TOKEN_ID=$(extract_token_id "$TXF_FILE")
echo "Token ID: $TOKEN_ID"
echo ""

TOKEN_TYPE=$(extract_token_type "$TXF_FILE")
echo "Token type: $TOKEN_TYPE"
echo ""

# =============================================================================
# Test 3: Address Extraction
# =============================================================================
echo "--- Test 3: Address Extraction ---"
echo ""

ADDRESS=$(extract_txf_address "$TXF_FILE")
echo "Address: $ADDRESS"
echo ""

# =============================================================================
# Test 4: Predicate Decoding
# =============================================================================
echo "--- Test 4: Predicate Decoding ---"
echo ""

PREDICATE=$(extract_predicate "$TXF_FILE")
echo "Predicate hex: ${PREDICATE:0:80}..."
echo ""

PREDICATE_INFO=$(decode_predicate "$PREDICATE")
echo "Predicate information:"
echo "$PREDICATE_INFO" | jq '.'
echo ""

ENGINE=$(get_predicate_engine "$PREDICATE")
echo "Engine: $ENGINE"
echo ""

PUBKEY=$(extract_predicate_pubkey "$PREDICATE")
echo "Public key: $PUBKEY"
echo ""

if is_predicate_masked "$PREDICATE"; then
  echo "Predicate type: MASKED (one-time address)"
else
  echo "Predicate type: UNMASKED (reusable address)"
fi
echo ""

# =============================================================================
# Test 5: Inclusion Proof Validation
# =============================================================================
echo "--- Test 5: Inclusion Proof Validation ---"
echo ""

if validate_inclusion_proof "$TXF_FILE" >/dev/null 2>&1; then
  echo "✓ Inclusion proof is VALID"
else
  echo "✗ Inclusion proof is INVALID"
  echo "Validation result:"
  validate_inclusion_proof "$TXF_FILE" | jq '.errors'
fi
echo ""

echo "Individual proof component checks:"
if has_authenticator "$TXF_FILE"; then
  echo "  ✓ Has authenticator"
else
  echo "  ✗ Missing authenticator"
fi

if has_merkle_tree_path "$TXF_FILE"; then
  echo "  ✓ Has merkle tree path"
else
  echo "  ✗ Missing merkle tree path"
fi

if has_transaction_hash "$TXF_FILE"; then
  echo "  ✓ Has transaction hash"
else
  echo "  ✗ Missing transaction hash"
fi

if has_unicity_certificate "$TXF_FILE"; then
  echo "  ✓ Has unicity certificate"
else
  echo "  ✗ Missing unicity certificate"
fi
echo ""

# =============================================================================
# Test 6: TXF Structure Validation
# =============================================================================
echo "--- Test 6: TXF Structure Validation ---"
echo ""

if is_valid_json "$TXF_FILE"; then
  echo "✓ File is valid JSON"
else
  echo "✗ File is NOT valid JSON"
fi

if is_valid_txf "$TXF_FILE"; then
  echo "✓ File is valid TXF format"
else
  echo "✗ File is NOT valid TXF format"
fi
echo ""

# =============================================================================
# Summary
# =============================================================================
echo "============================================================================="
echo "All tests completed successfully!"
echo "============================================================================="
echo ""
echo "Available functions for BATS tests:"
echo "  - decode_hex <hex>                    # Decode hex to UTF-8"
echo "  - extract_token_data <txf>            # Extract tokenData field"
echo "  - extract_token_id <txf>              # Extract tokenId"
echo "  - extract_token_type <txf>            # Extract tokenType"
echo "  - extract_txf_address <txf>           # Extract recipient address"
echo "  - extract_predicate <txf>             # Extract predicate hex"
echo "  - decode_predicate <hex>              # Decode CBOR predicate"
echo "  - extract_predicate_pubkey <hex>      # Extract public key from predicate"
echo "  - get_predicate_engine <hex>          # Get engine name"
echo "  - is_predicate_masked <hex>           # Check if masked"
echo "  - validate_inclusion_proof <txf>      # Validate proof"
echo "  - has_valid_inclusion_proof <txf>     # Boolean check"
echo "  - has_authenticator <txf>             # Check for authenticator"
echo "  - has_merkle_tree_path <txf>          # Check for merkle path"
echo "  - has_transaction_hash <txf>          # Check for tx hash"
echo "  - has_unicity_certificate <txf>       # Check for certificate"
echo "  - is_valid_json <file>                # Validate JSON"
echo "  - is_valid_txf <file>                 # Validate TXF structure"
echo ""
