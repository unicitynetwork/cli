# Assertions Usage Guide - JSON Type Handling & Hex Validation

**Quick Reference for Test Authors**

---

## JSON Type Comparison: `assert_json_field_equals`

### ✅ Correct Usage

```bash
# Comparing JSON number to string - NOW WORKS CORRECTLY
assert_json_field_equals "$token_file" ".version" "2.0"
# Works for both: {"version": 2.0} and {"version": "2.0"}

# Comparing boolean to string
assert_json_field_equals "$file" ".enabled" "true"
# Works for: {"enabled": true}

# Comparing null to string
assert_json_field_equals "$file" ".deleted" "null"
# Works for: {"deleted": null}
```

### 🔧 How It Works

The function now uses `jq -r "$field | tostring"` which:
1. Extracts the JSON value
2. Converts it to string representation
3. Compares as strings in bash

**Type Conversion Rules:**
- JSON number `2.0` → string `"2.0"`
- JSON boolean `true` → string `"true"`
- JSON null → string `"null"`
- JSON string `"hello"` → string `"hello"` (unchanged)
- JSON array `[1,2,3]` → string `"[1,2,3]"`
- JSON object `{"a":1}` → string `"{\"a\":1}"`

---

## Hex Validation: `is_valid_hex`

### ✅ Single Length Validation

```bash
# Validate exactly 64-char hex (32 bytes - SHA256 hash)
is_valid_hex "$state_hash" 64

# Validate exactly 68-char hex (34 bytes - RequestID)
is_valid_hex "$request_id" 68

# Default is 64 chars if not specified
is_valid_hex "$token_id"
```

### ✅ Multiple Length Validation (NEW)

```bash
# Accept 64 OR 68-char hex
is_valid_hex "$flexible_id" "64,68"

# Accept 64, 128, or 130-char hex (signature lengths)
is_valid_hex "$signature" "64,128,130"

# Spaces are trimmed automatically
is_valid_hex "$value" "64, 68, 72"
```

### 🎯 Common Use Cases

#### 1. RequestID Validation (64 or 68 chars)
```bash
# RequestID can be 64 or 68-char hex depending on version
request_id=$(echo "$output" | grep -oP '[0-9a-fA-F]{68}' | head -n1)
is_valid_hex "$request_id" "64,68"
```

#### 2. State Hash Validation (always 64 chars)
```bash
state_hash=$(jq -r '.state.stateHash' "$token_file")
is_valid_hex "$state_hash" 64
```

#### 3. Token ID Validation (always 64 chars)
```bash
token_id=$(jq -r '.genesis.data.tokenId' "$token_file")
is_valid_hex "$token_id" 64
```

#### 4. Public Key Validation (always 66 chars for secp256k1)
```bash
pubkey=$(jq -r '.publicKey' "$address_file")
is_valid_hex "$pubkey" 66
```

#### 5. Flexible Validation for Multiple Versions
```bash
# Support multiple protocol versions with different hash sizes
identifier=$(get_identifier "$file")
is_valid_hex "$identifier" "64,68,72"
```

---

## Error Messages

### `assert_json_field_equals` Errors

```bash
✗ Assertion Failed: JSON field mismatch
  File: /tmp/token.txf
  Field: .version
  Expected: 2.0
  Actual: 1.0
```

### `is_valid_hex` Errors

#### Single Length Error
```bash
✗ Not valid hex of length 64: length is 68
```

#### Multiple Length Error
```bash
✗ Not valid hex of expected lengths 64,68: length is 70
```

#### Invalid Characters Error
```bash
✗ Not valid hex (contains non-hex characters): xyz123
```

---

## Migration Guide

### Before (Problematic)
```bash
# This could fail if JSON contains number type
version=$(jq -r '.version' "$file")
[[ "$version" == "2.0" ]] || fail "Version mismatch"
```

### After (Robust)
```bash
# This always works regardless of JSON type
assert_json_field_equals "$file" ".version" "2.0"
```

---

### Before (Limited)
```bash
# Could only validate exact length
is_valid_hex "$id" 64 || is_valid_hex "$id" 68
```

### After (Flexible)
```bash
# Validates either length in single call
is_valid_hex "$id" "64,68"
```

---

## Best Practices

### 1. Always Use Type-Safe Comparisons
```bash
# ✅ GOOD - Type-safe
assert_json_field_equals "$file" ".count" "42"

# ❌ BAD - Type-sensitive
count=$(jq -r '.count' "$file")
[[ "$count" == "42" ]]
```

### 2. Be Explicit About Expected Lengths
```bash
# ✅ GOOD - Clear intent
is_valid_hex "$hash" 64

# ❌ BAD - Relies on default
is_valid_hex "$hash"
```

### 3. Use Multi-Length When Appropriate
```bash
# ✅ GOOD - Handles version differences
is_valid_hex "$request_id" "64,68"

# ❌ BAD - Fragile
[[ ${#request_id} -eq 64 ]] || [[ ${#request_id} -eq 68 ]]
```

### 4. Document Why You're Using Multi-Length
```bash
# ✅ GOOD - Documented
# RequestID changed from 64 to 68 chars in v2.0
is_valid_hex "$request_id" "64,68"

# ❌ BAD - Unclear
is_valid_hex "$request_id" "64,68"
```

---

## Common Patterns

### Pattern 1: Validate and Extract
```bash
# Extract value
token_id=$(jq -r '.genesis.data.tokenId' "$token_file")

# Validate format
assert_set "$token_id"
is_valid_hex "$token_id" 64

# Use value
echo "Token ID: $token_id"
```

### Pattern 2: Conditional Validation
```bash
# Check if field exists
if jq -e '.requestId' "$file" >/dev/null 2>&1; then
  # Validate if present
  request_id=$(jq -r '.requestId' "$file")
  is_valid_hex "$request_id" "64,68"
fi
```

### Pattern 3: Multiple Field Validation
```bash
# Validate related fields
state_hash=$(jq -r '.state.stateHash' "$file")
token_id=$(jq -r '.genesis.data.tokenId' "$file")

is_valid_hex "$state_hash" 64
is_valid_hex "$token_id" 64
```

---

## Testing Your Tests

### Quick Validation Script
```bash
#!/usr/bin/env bash
source tests/helpers/assertions.bash

# Test JSON type handling
echo '{"version": 2.0}' > /tmp/test.json
assert_json_field_equals "/tmp/test.json" ".version" "2.0"
echo "✓ JSON type handling works"

# Test hex validation
is_valid_hex "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" 64
echo "✓ 64-char hex validation works"

is_valid_hex "00020123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" "64,68"
echo "✓ Multi-length hex validation works"

echo "All assertions working correctly!"
```

---

## Troubleshooting

### Issue: Version comparison fails
**Problem:** `assert_json_field_equals "$file" ".version" "2.0"` fails
**Solution:** Ensure you've sourced the updated `assertions.bash` file

### Issue: Hex validation too strict
**Problem:** `is_valid_hex` rejects valid 68-char RequestID
**Solution:** Use multi-length: `is_valid_hex "$id" "64,68"`

### Issue: Error messages unclear
**Problem:** Don't understand why validation failed
**Solution:** Check the actual vs expected values in error output

---

## Reference

### Function Signatures

```bash
# JSON field comparison with type coercion
assert_json_field_equals <file> <json_path> <expected_string>

# Hex validation with single length
is_valid_hex <value> [expected_length]

# Hex validation with multiple valid lengths
is_valid_hex <value> "length1,length2,length3"
```

### Exit Codes
- `0` = Success / Validation passed
- `1` = Failure / Validation failed

---

## Related Documentation

- **Full Assertions Reference:** `/home/vrogojin/cli/tests/helpers/assertions.bash`
- **Audit Report:** `/home/vrogojin/cli/tests/helpers/ASSERTIONS_AUDIT_FIX_SUMMARY.md`
- **Test Suite Documentation:** `/home/vrogojin/cli/test-scenarios/README.md`
- **jq Manual:** https://stedolan.github.io/jq/manual/

---

**Last Updated:** 2025-11-10
**Version:** 2.0 (Type-safe comparisons)
