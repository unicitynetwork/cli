# hash-data Command Guide

## Overview

The `hash-data` command computes deterministic SHA256 hashes of JSON data using canonical JSON normalization. This ensures that different string representations of the same JSON structure always produce identical hashes.

**Primary Use Case:** Generate recipient data hashes for use with `send-token --recipient-data-hash`

## Quick Start

```bash
# Hash JSON data
npm run hash-data -- --data '{"key":"value"}'

# Hash JSON from file
npm run hash-data -- --file state.json

# Hash JSON from stdin
echo '{"key":"value"}' | npm run hash-data

# Verbose output (shows normalization steps)
npm run hash-data -- --data '{"b":2,"a":1}' --verbose
```

## Command Syntax

```bash
npm run hash-data [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-d, --data <json>` | JSON string to hash |
| `-f, --file <path>` | Read JSON from file |
| `--raw-hash` | Output only 64-char hash (without algorithm prefix) |
| `--verbose` | Show normalization steps and details |
| `-h, --help` | Display help |

## How It Works

### JSON Normalization

The command normalizes JSON to ensure deterministic hashing:

1. **Parse JSON** - Validates input is valid JSON
2. **Recursively sort object keys** - All object keys sorted alphabetically
3. **Preserve array order** - Arrays maintain their original ordering
4. **Compact serialization** - No whitespace in output
5. **SHA256 hash** - Compute hash of normalized UTF-8 bytes
6. **Add algorithm prefix** - Prepend "0000" (SHA256 identifier) to create 68-char imprint

### Normalization Examples

**Different key order produces same hash:**
```bash
$ npm run hash-data -- --data '{"b":2,"a":1}'
000043258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777

$ npm run hash-data -- --data '{"a":1,"b":2}'
000043258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777
```

**Different whitespace produces same hash:**
```bash
$ npm run hash-data -- --data '{ "a" : 1 , "b" : 2 }'
000043258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777
```

**Nested objects are normalized:**
```bash
# Input: {"nested":{"z":3,"a":1},"top":"value"}
# Normalized: {"nested":{"a":1,"z":3},"top":"value"}
```

**Arrays preserve order:**
```bash
$ npm run hash-data -- --data '{"arr":[3,1,2]}' --verbose
Normalized JSON: {"arr":[3,1,2]}  # Array order unchanged
```

**Objects within arrays get normalized:**
```bash
# Input: {"users":[{"name":"Bob","id":2},{"name":"Alice","id":1}]}
# Normalized: {"users":[{"id":2,"name":"Bob"},{"id":1,"name":"Alice"}]}
# - Array order preserved
# - Object keys within array elements sorted
```

## Input Methods

### 1. Direct JSON String (--data)

```bash
npm run hash-data -- --data '{"key":"value"}'
```

**When to use:**
- Quick one-off hashes
- Small JSON structures
- Inline data

**Pros:**
- Fast and convenient
- No file creation needed

**Cons:**
- Shell escaping can be tricky
- Not suitable for large JSON

### 2. JSON File (--file)

```bash
npm run hash-data -- --file /path/to/state.json
```

**When to use:**
- Pre-existing JSON files
- Large JSON structures
- Repeated hashing of same data

**Pros:**
- No escaping issues
- Works with any file size
- Can version control the data

**Cons:**
- Requires file creation

### 3. stdin (pipe)

```bash
echo '{"key":"value"}' | npm run hash-data

cat state.json | npm run hash-data

# From another command
jq '.metadata' token.txf | npm run hash-data
```

**When to use:**
- Pipeline workflows
- Dynamic data generation
- Scripting scenarios

**Pros:**
- Composable with other tools
- No temp files
- Works in pipelines

**Cons:**
- Can't easily re-run with same input

## Output Formats

### Default: 68-character Imprint

```bash
$ npm run hash-data -- --data '{"a":1,"b":2}'
000043258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777
```

**Format:** `<algorithm-prefix><hash>`
- First 4 chars: `0000` = SHA256 algorithm identifier
- Next 64 chars: Hex-encoded hash

**Use with:** `send-token --recipient-data-hash`

### --raw-hash: 64-character Hash Only

```bash
$ npm run hash-data -- --data '{"a":1,"b":2}' --raw-hash
43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777
```

**Use when:**
- You need just the hash value
- Working with systems that don't expect algorithm prefix
- Debugging or testing

### --verbose: Full Details

```bash
$ npm run hash-data -- --data '{"b":2,"a":1}' --verbose
Input JSON:      {"b":2,"a":1}
Normalized JSON: {"a":1,"b":2}
Bytes (UTF-8):   7b 22 61 22 3a 31 2c 22 62 22 3a 32 7d  (13 bytes)
Algorithm:       SHA256
Raw Hash:        43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777
Imprint:         000043258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777

✅ Hash computed successfully

Usage with send-token:
  npm run send-token -- -f token.txf -r <address> --recipient-data-hash 000043258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777
```

**Use when:**
- Debugging normalization issues
- Learning how the tool works
- Verifying byte-level encoding

## Integration with send-token

### Basic Workflow

1. **Define recipient state data:**
```json
{
  "purpose": "payment",
  "invoice": "INV-12345",
  "timestamp": 1699123456789
}
```

2. **Compute hash:**
```bash
$ npm run hash-data -- --data '{"purpose":"payment","invoice":"INV-12345","timestamp":1699123456789}'
0000a1b2c3d4e5f6...
```

3. **Send token with data hash:**
```bash
npm run send-token -- \
  -f token.txf \
  -r "DIRECT://..." \
  --recipient-data-hash 0000a1b2c3d4e5f6...
```

4. **Recipient provides matching data when receiving:**
```bash
npm run receive-token -- \
  -f transfer.txf \
  --data '{"purpose":"payment","invoice":"INV-12345","timestamp":1699123456789}'
```

### Why Use Data Hashes?

**Sender Control:** Sender can enforce specific state data without revealing it in the transfer package.

**Use Cases:**
- **Payment references:** Require invoice numbers or payment IDs
- **Metadata constraints:** Enforce specific metadata format
- **Auditing:** Link tokens to specific documents or events
- **Compliance:** Require regulatory data fields

**Security Note:** The hash only commits to the structure, not confidentiality. If the data is secret, encrypt it separately.

## Practical Examples

### Example 1: Payment Invoice

```bash
# Create invoice data
cat > invoice.json <<EOF
{
  "invoice_id": "INV-2024-001",
  "amount": 1000,
  "currency": "UCT",
  "date": "2024-11-10",
  "vendor": "Acme Corp"
}
EOF

# Compute hash
HASH=$(npm run hash-data -- --file invoice.json)

# Send token with invoice hash
npm run send-token -- \
  -f token.txf \
  -r "DIRECT://..." \
  --recipient-data-hash "$HASH" \
  --save

# Later: Recipient must provide matching invoice data
npm run receive-token -- \
  -f transfer.txf \
  --file invoice.json \
  --save
```

### Example 2: Timestamped Transfer

```bash
# Generate timestamp and compute hash inline
TIMESTAMP=$(date +%s)
DATA="{\"timestamp\":$TIMESTAMP,\"purpose\":\"milestone_payment\"}"
HASH=$(echo "$DATA" | npm run hash-data)

# Send with hash
npm run send-token -- \
  -f token.txf \
  -r "DIRECT://..." \
  --recipient-data-hash "$HASH"

# Send data separately (email, chat, etc.)
echo "$DATA" > transfer_metadata.json
# Send transfer_metadata.json to recipient
```

### Example 3: Multi-Field Validation

```bash
# Complex nested structure
npm run hash-data -- --data '{
  "contract": {
    "id": "CONTRACT-001",
    "parties": ["Alice Corp", "Bob Inc"],
    "terms": {
      "amount": 5000,
      "delivery_date": "2024-12-01"
    }
  },
  "approval": {
    "approver": "legal@example.com",
    "signature": "0x1234..."
  }
}' --verbose
```

### Example 4: Pipeline Integration

```bash
# Extract metadata from existing token, hash it, use in new transfer
jq '.state.data' current-token.txf | \
  npm run hash-data > /tmp/datahash.txt

npm run send-token -- \
  -f current-token.txf \
  -r "DIRECT://..." \
  --recipient-data-hash "$(cat /tmp/datahash.txt)"
```

## Edge Cases and Primitives

### Null
```bash
$ npm run hash-data -- --data 'null'
000074234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b
```

### Numbers
```bash
$ npm run hash-data -- --data '123'
0000a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3
```

### Strings
```bash
$ npm run hash-data -- --data '"hello"'
00005aa762ae383fbb727af3c7a36d4940a5b8c40a989452d2304fc958ff3f354e7a
```

### Booleans
```bash
$ npm run hash-data -- --data 'true'
0000b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b
```

### Empty Objects/Arrays
```bash
$ npm run hash-data -- --data '{}'
000044136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a

$ npm run hash-data -- --data '[]'
00004f53cda18c2baa0c0354bb5f9a3ecbe5ed12edbf416b8ac287a9e7caea12d694
```

## Error Handling

### Invalid JSON
```bash
$ npm run hash-data -- --data 'not json'

❌ Error normalizing JSON:
  Invalid JSON: Unexpected token 'o', "not json" is not valid JSON

Make sure your input is valid JSON.
```

### No Input
```bash
$ npm run hash-data

❌ Error reading input:
  stdin is empty

Usage:
  npm run hash-data -- --data '{"key":"value"}'
  npm run hash-data -- --file state.json
  echo '{"key":"value"}' | npm run hash-data
```

### File Not Found
```bash
$ npm run hash-data -- --file /nonexistent.json

❌ Error reading input:
  File not found: /nonexistent.json
```

## Best Practices

### 1. Version Your Data Schemas

```bash
# Include schema version in your data
npm run hash-data -- --data '{
  "schema_version": "1.0",
  "payload": {
    "field1": "value1"
  }
}'
```

### 2. Document Hash Commitments

```bash
# Create a manifest
cat > transfer-manifest.md <<EOF
# Transfer Manifest

**Data Hash:** 0000abc123...
**Purpose:** Q4 2024 milestone payment
**Data Schema:**
\`\`\`json
{
  "invoice_id": "string",
  "amount": number,
  "currency": "UCT" | "USDU"
}
\`\`\`
EOF
```

### 3. Validate Before Sending

```bash
# Hash the data you'll require
HASH=$(npm run hash-data -- --file required-data.json)

# Send it in transfer
npm run send-token -- -f token.txf -r ADDR --recipient-data-hash "$HASH"

# Include the required data file with transfer package for recipient
tar -czf transfer-package.tar.gz transfer.txf required-data.json
```

### 4. Test Determinism

```bash
# Verify different inputs produce same hash
HASH1=$(npm run hash-data -- --data '{"b":2,"a":1}')
HASH2=$(npm run hash-data -- --data '{"a":1,"b":2}')

if [ "$HASH1" = "$HASH2" ]; then
  echo "✓ Deterministic hashing verified"
else
  echo "✗ Hash mismatch!"
fi
```

## Troubleshooting

### Shell Escaping Issues

**Problem:** Bash interprets special characters
```bash
# This fails
npm run hash-data -- --data {"key":"value"}
```

**Solution:** Use single quotes
```bash
# This works
npm run hash-data -- --data '{"key":"value"}'
```

### Different Hashes for "Same" Data

**Problem:** Whitespace or key ordering differs
```bash
# These produce different hashes if not normalized
'{"a":1,"b":2}'
'{ "a": 1, "b": 2 }'
```

**Solution:** The tool handles this automatically! Both produce the same hash.

### Array Order Matters

**Problem:** Arrays in different order produce different hashes

**Why:** Arrays are ordered data structures, so `[1,2,3]` ≠ `[3,2,1]`

**Solution:** This is intentional. Ensure arrays are in the expected order.

## Technical Details

### Normalization Algorithm

```
1. Parse JSON string into object
2. Recursively process:
   - Objects: Sort keys alphabetically, recurse on values
   - Arrays: Preserve order, recurse on elements
   - Primitives: Return as-is
3. Serialize with JSON.stringify (compact, no whitespace)
4. Encode as UTF-8 bytes
5. Compute SHA256 hash
6. Prepend algorithm prefix "0000"
```

### Output Format

**Imprint Format:** `<algo><hash>`
- `algo`: 4 hex chars (0000 = SHA256)
- `hash`: 64 hex chars (32 bytes)
- Total: 68 characters

**Compatibility:** Compatible with SDK's `DataHash.toJSON()` format

### Character Encoding

All JSON is encoded as UTF-8 before hashing. Ensure your JSON files use UTF-8 encoding.

## See Also

- [send-token Command Guide](./send-token.md) - Using data hashes in transfers
- [receive-token Command Guide](./receive-token.md) - Providing state data on receipt
- [API Reference](../../reference/api-reference.md) - Complete command reference
- [Transfer Workflows](../workflows/token-transfers.md) - End-to-end transfer patterns
