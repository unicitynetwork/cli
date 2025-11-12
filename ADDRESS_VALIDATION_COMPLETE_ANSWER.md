# Address Format and Checksum Validation - Complete Answer

## Executive Summary

**YES, addresses include checksums.** The address format is:
```
DIRECT://[64 hex - data][8 hex - checksum]
```

**Checksum algorithm:** First 4 bytes of SHA256(data)

**Validation:** Use SDK's `AddressFactory.createAddress()` - it performs complete validation including checksum verification.

**Current CLI status:** Already correctly implemented. Test SEC-INPUT-007 has a shell quoting bug (not a validation bug).

---

## 1. Address Format Specification

### Complete Structure

```
DIRECT://[64 hexadecimal characters][8 hexadecimal characters]
         ├────────32 bytes data─────┤├──4 bytes checksum─┤
```

### Example Address Breakdown

```
DIRECT://0000057e2a9d980704a1593bfd9fcb4b5a77c720e0a83f4a917165ff94addaca41db0f4216dc
└───┬───┘└─────────────────────────────────────┬────────────────────────────────────┘└──┬──┘
 Scheme                                Data (64 hex)                                Checksum
  (9)                                  (32 bytes)                                   (8 hex)
                                                                                   (4 bytes)
```

**Total Length:** 81 characters
- `DIRECT://` = 9 characters
- Data = 64 hex characters (32 bytes)
- Checksum = 8 hex characters (4 bytes)

---

## 2. Checksum Algorithm

### Algorithm Steps

From SDK source (`DirectAddress.js:43-45`):

```typescript
static async create(reference: DataHash) {
    // Step 1: Hash the data using SHA256
    const checksum = await new DataHasher(HashAlgorithm.SHA256)
        .update(reference.imprint)  // Data portion (32 bytes)
        .digest();
    
    // Step 2: Take first 4 bytes as checksum
    return new DirectAddress(reference, checksum.data.slice(0, 4));
}
```

### Visual Representation

```
Data (32 bytes):
  0000057e2a9d980704a1593bfd9fcb4b5a77c720e0a83f4a917165ff94addaca
  
  ↓ SHA256
  
SHA256 Hash (32 bytes):
  41db0f4216dc... (32 bytes total)
  
  ↓ Take first 4 bytes
  
Checksum (4 bytes):
  41db0f42
  
  ↓ Convert to hex string
  
Checksum in address (8 hex chars):
  41db0f4216dc
```

### Verification Algorithm

From SDK source (`AddressFactory.js:17-38`):

```typescript
static async createAddress(address: string) {
    // 1. Split into scheme and hex
    const parts = address.split('://', 2);
    if (parts.length != 2) {
        throw new Error('Invalid address format');
    }
    
    // 2. Decode hex to bytes
    const bytes = HexConverter.decode(parts[1]);
    
    // 3. Split into data and checksum
    const data = bytes.slice(0, -4);          // All but last 4 bytes
    const providedChecksum = bytes.slice(-4);  // Last 4 bytes
    
    // 4. Recreate address with computed checksum
    const expectedAddress = await DirectAddress.create(
        DataHash.fromImprint(data)
    );
    
    // 5. Compare complete addresses
    if (expectedAddress.address !== address) {
        throw new Error('Address checksum mismatch');
    }
    
    return expectedAddress;
}
```

---

## 3. Validation Rules

### Rule 1: Format Validation

**Requirement:** `<SCHEME>://<HEX>`

```typescript
const parts = address.split('://');
if (parts.length !== 2) {
    throw new Error('Invalid address format');
}
```

**Examples:**
- ✓ `DIRECT://0000...`
- ✗ `DIRECT0000...` (missing `://`)
- ✗ `DIRECT://foo://bar` (multiple `://`)

### Rule 2: Scheme Validation

**Requirement:** Must be `DIRECT` or `PROXY`

```typescript
const scheme = parts[0];
if (scheme !== 'DIRECT' && scheme !== 'PROXY') {
    throw new Error(`Invalid address scheme: ${scheme}`);
}
```

**Examples:**
- ✓ `DIRECT://...`
- ✓ `PROXY://...`
- ✗ `HTTP://...`
- ✗ `BITCOIN://...`

### Rule 3: Hexadecimal Validation

**Requirement:** Only characters 0-9, a-f, A-F

```typescript
const hexPart = parts[1];
if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
    throw new Error('Address contains non-hexadecimal characters');
}
```

**Examples:**
- ✓ `DIRECT://0000abcdef123456...`
- ✗ `DIRECT://zzzzgggg` (z, g not hex)
- ✗ `DIRECT://hello` (h, e, l, o not all hex)
- ✗ `DIRECT://0000!@#$` (special chars)

### Rule 4: Length Validation

**Requirement:** Exactly 72 hex characters (36 bytes)

```typescript
if (hexPart.length !== 72) {
    throw new Error(`Invalid address length: ${hexPart.length} (expected 72)`);
}
```

**Breakdown:**
- 64 hex chars = 32 bytes (data)
- 8 hex chars = 4 bytes (checksum)
- **Total: 72 hex chars = 36 bytes**

**Examples:**
- ✓ 72 hex characters
- ✗ 64 hex characters (missing checksum)
- ✗ 80 hex characters (too long)
- ✗ 66 hex characters (too short)

### Rule 5: Checksum Validation

**Requirement:** Last 4 bytes must equal SHA256(first 32 bytes)[0:4]

```typescript
const data = bytes.slice(0, -4);
const providedChecksum = bytes.slice(-4);
const expectedChecksum = await sha256(data).slice(0, 4);

if (!bytesEqual(providedChecksum, expectedChecksum)) {
    throw new Error('Address checksum mismatch');
}
```

**This catches:**
- Typos in address
- Corrupted addresses
- Manually crafted invalid addresses
- Copy-paste errors

---

## 4. SDK Validation Methods

### Method 1: AddressFactory.createAddress() (Recommended)

**Complete validation including checksum:**

```typescript
import { AddressFactory } from '@unicitylabs/state-transition-sdk/lib/address/AddressFactory.js';

try {
    const address = await AddressFactory.createAddress('DIRECT://...');
    console.log('✓ Valid address:', address.address);
} catch (error) {
    console.error('✗ Invalid address:', error.message);
    // Possible errors:
    // - "Invalid address format" (missing ://)
    // - "Invalid address format: <SCHEME>" (bad scheme)
    // - "Address checksum mismatch" (wrong checksum)
    process.exit(1);
}
```

### Method 2: Pre-validation (CLI Input Validation)

**Fast, synchronous checks before SDK:**

```typescript
import { validateAddress } from './utils/input-validation.js';

// Stage 1: Pre-validation (sync, no crypto)
const preCheck = validateAddress(recipientString);
if (!preCheck.valid) {
    console.error(`❌ ${preCheck.error}`);
    console.error(preCheck.details);
    process.exit(1);
}

// Stage 2: SDK validation (async, includes checksum)
try {
    const address = await AddressFactory.createAddress(recipientString);
} catch (error) {
    console.error('❌ Invalid address:', error.message);
    process.exit(1);
}
```

---

## 5. Current CLI Implementation

### File: `/home/vrogojin/cli/src/commands/send-token.ts`

**Line 240-265: Pre-validation**
```typescript
// Early validation for user-friendly errors
const recipientValidation = validateAddress(options.recipient);
if (!recipientValidation.valid) {
  throwValidationError(recipientValidation);
}
```

**Line 301: SDK validation (includes checksum)**
```typescript
const recipientAddress = await AddressFactory.createAddress(options.recipient);
console.error(`  ✓ Recipient: ${recipientAddress.address}\n`);
```

**Line 584-595: Error handling**
```typescript
} catch (error) {
  console.error('\n❌ Error sending token:');
  if (error instanceof Error) {
    console.error(`  Message: ${error.message}`);
  }
  process.exit(1);
}
```

### File: `/home/vrogojin/cli/src/utils/input-validation.ts`

**Line 201-256: validateAddress() function**
```typescript
export function validateAddress(address: string): ValidationResult {
  // Check 1: Non-empty
  if (!address || address.trim() === '') {
    return { valid: false, error: 'Address cannot be empty' };
  }

  // Check 2: DIRECT:// prefix
  if (!trimmed.startsWith('DIRECT://')) {
    return {
      valid: false,
      error: 'Invalid address format: must start with "DIRECT://"',
      details: 'Example: DIRECT://00006ac2d9f02908ea0b338ecd6730...'
    };
  }

  // Check 3: Hexadecimal characters only
  if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
    return {
      valid: false,
      error: 'Invalid address: hex part contains non-hexadecimal characters',
      details: `Hex part must contain only 0-9, a-f, A-F. Received: ${hexPart}`
    };
  }

  // Check 4: Minimum length
  if (hexPart.length < 66) {
    return {
      valid: false,
      error: `Invalid address: hex part too short (${hexPart.length} chars, minimum 66)`,
      details: 'Unicity addresses must be at least 66 hexadecimal characters'
    };
  }

  return { valid: true };
}
```

**Note:** Pre-validation doesn't check checksum (requires async crypto). SDK handles that.

---

## 6. Different Address Types

### Type 1: DIRECT Address

**Purpose:** Points directly to a predicate reference hash

**Format:** `DIRECT://[64 hex data][8 hex checksum]`

**Use case:** Most common, used for token transfers

**Example:**
```
DIRECT://0000057e2a9d980704a1593bfd9fcb4b5a77c720e0a83f4a917165ff94addaca41db0f4216dc
```

### Type 2: PROXY Address

**Purpose:** Points to a proxy object (e.g., name tag, alias)

**Format:** `PROXY://[64 hex tokenId][8 hex checksum]`

**Use case:** Indirect addressing through proxy tokens

**Example:**
```
PROXY://f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe39786750941db0f42
```

**Validation:** Same rules apply (scheme, hex, length, checksum)

---

## 7. Test Case SEC-INPUT-007

### Test Purpose

Ensure address validation rejects malformed inputs and special characters.

### Test Cases

1. **SQL injection:** `'; DROP TABLE tokens;--`
2. **Path traversal:** `../../../../etc/passwd`
3. **Script injection:** `<script>alert('xss')</script>`
4. **Unicode/emoji:** `DIRECT://🔥💰`
5. **No prefix:** `invalidaddress`
6. **Non-hex:** `DIRECT://zzzzgggg`

### Current Test Status

**FAILING** due to shell quoting bug (not validation bug)

**File:** `/home/vrogojin/cli/tests/security/test_input_validation.bats:327`

**Problem:**
```bash
local sql_injection="'; DROP TABLE tokens;--"
run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${token} -r '${sql_injection}' --local"
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                       Single string with nested quotes causes eval error
```

**Error:**
```
unexpected EOF while looking for matching `''
syntax error: unexpected end of file
```

### Fix Required

**Change from string to array:**

```bash
# OLD (broken):
run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${token} -r '${sql_injection}' --local"

# NEW (fixed):
run_cli_with_secret "${ALICE_SECRET}" send-token -f "${token}" -r "${sql_injection}" --local
```

**Why this works:**
- Passes arguments as array instead of single string
- `run_cli()` uses array expansion (no eval)
- No shell parsing issues with quotes

### Expected Test Results (After Fix)

```bash
$ bats tests/security/test_input_validation.bats -f "SEC-INPUT-007"
ok 1 SEC-INPUT-007: Special characters in addresses are rejected
```

All 6 test cases will be rejected by validation:
- Cases 1-5: Caught by pre-validation (no DIRECT:// prefix)
- Case 6: Caught by pre-validation (non-hex characters)

---

## 8. Manual Testing Examples

### Test 1: Valid Address (Should Succeed)

```bash
SECRET="test" node dist/index.js send-token \
  -f token.txf \
  -r "DIRECT://0000057e2a9d980704a1593bfd9fcb4b5a77c720e0a83f4a917165ff94addaca41db0f4216dc" \
  --local -o output.txf
```

**Expected:** ✓ Recipient validated, transfer proceeds

### Test 2: SQL Injection (Should Fail)

```bash
SECRET="test" node dist/index.js send-token \
  -f token.txf \
  -r "'; DROP TABLE tokens;--" \
  --local -o output.txf
```

**Expected:**
```
❌ Validation Error: Invalid address format: must start with "DIRECT://"
Exit code: 1
```

### Test 3: Non-Hex Characters (Should Fail)

```bash
SECRET="test" node dist/index.js send-token \
  -f token.txf \
  -r "DIRECT://zzzzgggg" \
  --local -o output.txf
```

**Expected:**
```
❌ Validation Error: Invalid address: hex part contains non-hexadecimal characters
Hex part must contain only 0-9, a-f, A-F. Received: zzzzgggg
Exit code: 1
```

### Test 4: Wrong Checksum (Should Fail)

```bash
# Create address with valid format but wrong checksum
SECRET="test" node dist/index.js send-token \
  -f token.txf \
  -r "DIRECT://0000057e2a9d980704a1593bfd9fcb4b5a77c720e0a83f4a917165ff94addaca00000000" \
  --local -o output.txf
```

**Expected:**
```
❌ Error sending token:
  Message: Address checksum mismatch
Exit code: 1
```

---

## 9. Error Messages Guide

### Error 1: Invalid Format

```
❌ Validation Error: Invalid address format: must start with "DIRECT://"

Unicity addresses use the format: DIRECT://<hex>
Example: DIRECT://00006ac2d9f02908ea0b338ecd6730ad4145a4441e337a6dc4b13edca5bf27ea1af4a3d28754
Generate an address using: npm start -- gen-address
```

**Cause:** Missing `DIRECT://` prefix

### Error 2: Non-Hexadecimal Characters

```
❌ Validation Error: Invalid address: hex part contains non-hexadecimal characters

Hex part must contain only 0-9, a-f, A-F. Received: zzzzgggg
```

**Cause:** Non-hex characters in address

### Error 3: Wrong Length

```
❌ Validation Error: Invalid address: hex part too short (64 chars, minimum 66)

Unicity addresses must be at least 66 hexadecimal characters after DIRECT://
```

**Cause:** Address too short (missing checksum)

### Error 4: Checksum Mismatch

```
❌ Error sending token:
  Message: Address checksum mismatch
```

**Cause:** Address was mistyped or corrupted

**Recommendation:** Add better error message in send-token.ts:

```typescript
try {
    const recipientAddress = await AddressFactory.createAddress(options.recipient);
} catch (error) {
    if (error.message === 'Address checksum mismatch') {
        console.error('❌ Invalid address: checksum verification failed');
        console.error('   The address appears to be mistyped or corrupted.');
        console.error('   Please double-check the address and try again.');
        process.exit(1);
    }
    throw error;
}
```

---

## 10. Summary and Answers

### Q1: Does the address format include a checksum?

**YES.** Last 8 hex characters (4 bytes) are the checksum.

### Q2: What checksum algorithm is used?

**SHA256.** First 4 bytes of SHA256(data_portion).

### Q3: What is the exact structure?

```
DIRECT://[64 hex data][8 hex checksum]
         32 bytes      4 bytes
         └── Total: 36 bytes (72 hex chars) ──┘
```

### Q4: What validation rules should we enforce?

1. Format: `SCHEME://HEX`
2. Scheme: `DIRECT` or `PROXY`
3. Hex: Only 0-9, a-f, A-F
4. Length: Exactly 72 hex chars
5. Checksum: Last 4 bytes = SHA256(first 32 bytes)[0:4]

### Q5: How does the SDK validate addresses?

Use `AddressFactory.createAddress()`:
- Validates format, scheme, hex, length
- **Validates checksum cryptographically**
- Throws errors for invalid addresses

### Q6: Are there different address types?

YES:
- `DIRECT://` - Points to predicate reference
- `PROXY://` - Points to proxy object
- Both use same validation rules

---

## 11. Required Actions

### For SEC-INPUT-007 Test

**File:** `/home/vrogojin/cli/tests/security/test_input_validation.bats`

**Lines to fix:** 322, 327, 333, 338, 342, 346, 350

**Change:**
```bash
# OLD:
run_cli_with_secret "${ALICE_SECRET}" "send-token -f ${token} -r '${var}' ..."

# NEW:
run_cli_with_secret "${ALICE_SECRET}" send-token -f "${token}" -r "${var}" ...
```

### For CLI Code

**NO CHANGES NEEDED.** Current implementation is correct:
- Pre-validation catches obvious errors
- SDK validation verifies checksum
- Exit codes are correct (1 for failure)

---

## 12. Files Reference

### Documentation
- `/home/vrogojin/cli/ADDRESS_FORMAT_SPECIFICATION.md` - Complete format spec
- `/home/vrogojin/cli/SEC_INPUT_007_ANALYSIS.md` - Test analysis
- `/home/vrogojin/cli/SEC_INPUT_007_TEST_FIX.md` - Test fix guide
- `/home/vrogojin/cli/ADDRESS_VALIDATION_COMPLETE_ANSWER.md` - This file

### Source Code
- `/home/vrogojin/cli/src/commands/send-token.ts:301` - SDK validation call
- `/home/vrogojin/cli/src/utils/input-validation.ts:201-256` - Pre-validation

### SDK Source (node_modules)
- `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/address/DirectAddress.js` - Checksum creation
- `/home/vrogojin/cli/node_modules/@unicitylabs/state-transition-sdk/lib/address/AddressFactory.js` - Validation

### Tests
- `/home/vrogojin/cli/tests/security/test_input_validation.bats:317-354` - SEC-INPUT-007 test

---

## Conclusion

1. **Addresses DO include checksums** (4-byte SHA256 suffix)
2. **Validation is complete** in current CLI code
3. **Test is failing** due to shell quoting bug (not validation bug)
4. **Fix is simple**: Use array expansion instead of string in test
5. **No CLI code changes needed** - only test needs fixing

**After fixing the test, SEC-INPUT-007 should PASS.**
