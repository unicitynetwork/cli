# hash-data Quick Reference

**Compute deterministic SHA256 hash of JSON data**

## Quick Start

```bash
# Hash inline JSON
npm run hash-data -- --data '{"key":"value"}'

# Hash from file
npm run hash-data -- --file state.json

# Hash from stdin
echo '{"key":"value"}' | npm run hash-data

# Verbose output
npm run hash-data -- --data '{"a":1}' --verbose
```

## Options

| Flag | Description |
|------|-------------|
| `-d, --data <json>` | JSON string to hash |
| `-f, --file <path>` | Read JSON from file |
| `--raw-hash` | Output 64-char hash only |
| `--verbose` | Show normalization details |

## Common Patterns

### Use with send-token

```bash
# 1. Hash recipient data
HASH=$(npm run hash-data -- --data '{"invoice":"INV-001"}')

# 2. Send with hash
npm run send-token -- -f token.txf -r ADDR --recipient-data-hash "$HASH"

# 3. Recipient provides matching data
npm run receive-token -- -f transfer.txf --data '{"invoice":"INV-001"}'
```

### Pipeline Integration

```bash
# Extract and hash
jq '.metadata' token.txf | npm run hash-data

# Generate and hash
node -e 'console.log(JSON.stringify({ts: Date.now()}))' | npm run hash-data
```

## Normalization Rules

✅ **Object keys sorted alphabetically** (recursive)
✅ **Array order preserved**
✅ **Whitespace removed** (compact JSON)
✅ **Deterministic**: Same structure → same hash

## Examples

```bash
# Different key order → same hash
$ npm run hash-data -- --data '{"b":2,"a":1}'
000043258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777

$ npm run hash-data -- --data '{"a":1,"b":2}'
000043258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777
```

## Output Formats

**Default (68 chars):** `0000<64-hex-chars>` - Use with send-token
**Raw (64 chars):** `<64-hex-chars>` - Just the hash (--raw-hash)
**Verbose:** Full details including normalization steps

## See Also

- [Full Guide](./hash-data.md)
- [send-token](./send-token.md)
- [API Reference](../../reference/api-reference.md#hash-data)
