#!/bin/bash
# Test script to demonstrate smart serialization in mint-token command

echo "=== Testing Smart Serialization in mint-token ==="
echo ""

cd /home/vrogojin/cli

# Test 1: TokenId as plain text (will be hashed to 256-bit)
echo "Test 1: TokenId as plain text"
echo "Command: npm run mint-token -- unicity:direct:abc123 -i 'my-custom-token' --stdout 2>&1 | head -20"
echo "Expected: TokenId will be hashed from text to 256-bit hex"
echo ""

# Test 2: TokenId as valid 256-bit hex (will be used directly)
echo "Test 2: TokenId as 256-bit hex string"
echo "Command: npm run mint-token -- unicity:direct:abc123 -i 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890' --stdout"
echo "Expected: TokenId will be used directly (64 hex chars)"
echo ""

# Test 3: Metadata as JSON (will be serialized as UTF-8 bytes)
echo "Test 3: Metadata as JSON"
echo "Command: npm run mint-token -- unicity:direct:abc123 -m '{\"name\":\"My NFT\",\"description\":\"Test\"}' --stdout"
echo "Expected: JSON will be serialized as UTF-8 bytes, not hashed"
echo ""

# Test 4: Metadata as plain text (will be serialized as UTF-8 bytes)
echo "Test 4: Metadata as plain text"
echo "Command: npm run mint-token -- unicity:direct:abc123 -m 'This is my NFT description' --stdout"
echo "Expected: Text will be serialized as UTF-8 bytes"
echo ""

# Test 5: State as hex string (will be used directly)
echo "Test 5: State data as hex string"
echo "Command: npm run mint-token -- unicity:direct:abc123 -s '0x1234abcd' --stdout"
echo "Expected: Hex will be decoded to bytes directly"
echo ""

# Test 6: TokenType as text (will be hashed)
echo "Test 6: TokenType as text"
echo "Command: npm run mint-token -- unicity:direct:abc123 -y 'MyCustomTokenType' --stdout"
echo "Expected: TokenType will be hashed to 256-bit"
echo ""

# Test 7: Reason as plain text
echo "Test 7: Mint reason as text"
echo "Command: npm run mint-token -- unicity:direct:abc123 -r 'Initial airdrop for community members' --stdout"
echo "Expected: Reason stored as metadata in TXF"
echo ""

# Test 8: Fungible token with coins
echo "Test 8: Fungible token with multiple coins"
echo "Command: npm run mint-token -- unicity:direct:abc123 -c '100,200,300' --stdout"
echo "Expected: Creates fungible token with 3 coins"
echo ""

echo "=== Smart Serialization Rules ==="
echo ""
echo "TokenId & TokenType (requireHash: true):"
echo "  - 64 hex chars (256-bit) → Used directly"
echo "  - <64 hex chars → Hashed to 256-bit"
echo "  - Plain text → Hashed to 256-bit"
echo "  - JSON → Hashed to 256-bit"
echo ""
echo "Metadata & State Data (requireHash: false):"
echo "  - Valid hex string → Decoded to bytes"
echo "  - JSON (starts with { or [) → Serialized as UTF-8"
echo "  - Plain text → Serialized as UTF-8"
echo ""
echo "Reason:"
echo "  - Stored as metadata in TXF file"
echo "  - SDK receives null (simple mint)"
echo ""
