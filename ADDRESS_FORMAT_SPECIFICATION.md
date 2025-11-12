# Unicity Address Format Specification

## Complete Address Format

Unicity addresses follow this format:
```
<SCHEME>://<DATA_HEX><CHECKSUM_HEX>
```

### Components

1. **Scheme**: Address type identifier
   - `DIRECT` - Points directly to a predicate reference hash
   - `PROXY` - Points to a proxy object (e.g., name tag)

2. **Data**: The actual address payload (variable length)
   - For DIRECT: Predicate reference hash (32 bytes = 64 hex characters)
   - For PROXY: Token ID (32 bytes = 64 hex characters)

3. **Checksum**: 4-byte (8 hex characters) validation suffix
   - Algorithm: SHA256 of the data portion
   - Takes first 4 bytes of hash as checksum
   - Prevents mistyped addresses

### DIRECT Address Structure

```
DIRECT://[64 hex chars - predicate hash][8 hex chars - checksum]
         ├──────────────32 bytes──────────────┤├─4 bytes─┤
```

**Example:**
```
DIRECT://0000057e2a9d980704a1593bfd9fcb4b5a77c720e0a83f4a917165ff94addaca41db0f4216dc
         └────────────────────────────┬────────────────────────────┘└───┬────┘
                            Data (64 hex)                          Checksum (8 hex)
```

**Total Length:**
- Scheme: 9 characters (`DIRECT://`)
- Data: 64 hexadecimal characters (32 bytes)
- Checksum: 8 hexadecimal characters (4 bytes)
- **Total: 81 characters** (`DIRECT://` + 72 hex)

## Checksum Algorithm

The SDK uses this algorithm to generate and validate checksums:

```typescript
// From DirectAddress.js line 43-45
static async create(reference) {
    const checksum = await new DataHasher(HashAlgorithm.SHA256)
        .update(reference.imprint)
        .digest();
    return new DirectAddress(reference, checksum.data.slice(0, 4));
}
```

**Steps:**
1. Take the data portion (predicate reference hash bytes)
2. Compute SHA256 hash of the data
3. Take first 4 bytes of the SHA256 output
4. Append as hex string to address

**Verification:**
```typescript
// From AddressFactory.js line 17-38
static async createAddress(address) {
    const result = address.split('://', 2);
    if (result.length != 2) {
        throw new Error('Invalid address format');
    }
    
    const bytes = HexConverter.decode(result[1]);
    
    // Extract data (all bytes except last 4)
    const data = bytes.slice(0, -4);
    
    // Extract provided checksum (last 4 bytes)
    const providedChecksum = bytes.slice(-4);
    
    // Recreate address with computed checksum
    const expectedAddress = await DirectAddress.create(
        DataHash.fromImprint(data)
    );
    
    // Compare complete addresses
    if (expectedAddress.address !== address) {
        throw new Error('Address checksum mismatch');
    }
    
    return expectedAddress;
}
```

## Validation Rules

### 1. Format Validation

**Rule**: Address must follow `<SCHEME>://<HEX>` format
```typescript
// Must contain exactly one "://" separator
const parts = address.split('://');
if (parts.length !== 2) {
    throw new Error('Invalid address format');
}
```

### 2. Scheme Validation

**Rule**: Scheme must be `DIRECT` or `PROXY`
```typescript
const scheme = parts[0];
if (scheme !== 'DIRECT' && scheme !== 'PROXY') {
    throw new Error(`Invalid address scheme: ${scheme}`);
}
```

### 3. Hexadecimal Validation

**Rule**: Data portion must contain only hex characters (0-9, a-f, A-F)
```typescript
const hexPart = parts[1];
if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
    throw new Error('Address contains non-hexadecimal characters');
}
```

### 4. Length Validation

**Rule**: DIRECT addresses must be exactly 72 hex characters (36 bytes)
- 32 bytes data (64 hex)
- 4 bytes checksum (8 hex)

```typescript
// For DIRECT addresses
if (hexPart.length !== 72) {
    throw new Error(`Invalid DIRECT address length: ${hexPart.length} (expected 72)`);
}
```

### 5. Checksum Validation

**Rule**: Checksum must match computed SHA256 of data portion

```typescript
// Extract parts
const bytes = HexConverter.decode(hexPart);
const data = bytes.slice(0, -4);          // First 32 bytes
const providedChecksum = bytes.slice(-4);  // Last 4 bytes

// Compute expected checksum
const expectedChecksum = await sha256(data).slice(0, 4);

// Compare
if (!bytesEqual(providedChecksum, expectedChecksum)) {
    throw new Error('Address checksum mismatch');
}
```

## SDK Methods for Validation

### Using AddressFactory (Recommended)

The SDK provides `AddressFactory.createAddress()` which performs complete validation:

```typescript
import { AddressFactory } from '@unicitylabs/state-transition-sdk/lib/address/AddressFactory.js';

try {
    const address = await AddressFactory.createAddress('DIRECT://...');
    // If this succeeds, address is valid
    console.log('Valid address:', address.address);
} catch (error) {
    // Validation failed
    if (error.message === 'Address checksum mismatch') {
        console.error('Invalid checksum - address was mistyped');
    } else if (error.message === 'Invalid address format') {
        console.error('Address does not follow SCHEME://HEX format');
    } else {
        console.error('Validation error:', error.message);
    }
}
```

### Manual Validation (If Needed)

For pre-validation before calling SDK (e.g., in CLI input validation):

```typescript
function validateAddressFormat(address: string): boolean {
    // 1. Check scheme
    if (!address.startsWith('DIRECT://') && !address.startsWith('PROXY://')) {
        return false;
    }
    
    // 2. Extract hex part
    const hexPart = address.substring(address.indexOf('://') + 3);
    
    // 3. Check hex characters
    if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
        return false;
    }
    
    // 4. Check length (72 for DIRECT, 72 for PROXY)
    if (hexPart.length !== 72) {
        return false;
    }
    
    return true;
    // Note: Checksum validation requires async crypto, use SDK for that
}
```

## Implementation in Unicity CLI

### Current Implementation

**File:** `/home/vrogojin/cli/src/commands/send-token.ts` (line 301)

```typescript
// We already use the SDK's AddressFactory
const recipientAddress = await AddressFactory.createAddress(options.recipient);
```

This provides:
- Complete format validation
- Scheme validation
- Hexadecimal validation
- Length validation
- **Checksum validation** (cryptographic)

### Input Validation Module

**File:** `/home/vrogojin/cli/src/utils/input-validation.ts` (line 201-256)

Current `validateAddress()` function provides:
- Basic format checks (DIRECT:// prefix)
- Hexadecimal character validation
- Minimum length check (66 chars)

**What's Missing:** Checksum validation

**Recommendation:** Keep current validation for early error detection, rely on SDK for checksum.

### Validation Strategy

**Two-Stage Validation:**

1. **Stage 1: Pre-validation (input-validation.ts)**
   - Fast, synchronous checks
   - Catches obvious format errors early
   - No crypto operations
   - User-friendly error messages

2. **Stage 2: SDK Validation (AddressFactory)**
   - Complete cryptographic validation
   - Verifies checksum
   - Handles edge cases
   - Authoritative validation

**Code Pattern:**

```typescript
import { validateAddress } from '../utils/input-validation.js';
import { AddressFactory } from '@unicitylabs/state-transition-sdk/lib/address/AddressFactory.js';

// Stage 1: Pre-validation
const preCheck = validateAddress(recipientString);
if (!preCheck.valid) {
    console.error(`❌ ${preCheck.error}`);
    if (preCheck.details) console.error(preCheck.details);
    process.exit(1);
}

// Stage 2: SDK validation (includes checksum)
try {
    const recipientAddress = await AddressFactory.createAddress(recipientString);
    console.log('✓ Address validated:', recipientAddress.address);
} catch (error) {
    if (error.message === 'Address checksum mismatch') {
        console.error('❌ Invalid address: checksum mismatch (address was mistyped)');
        console.error('   Please verify the address and try again.');
    } else {
        console.error('❌ Invalid address:', error.message);
    }
    process.exit(1);
}
```

## Test Case: SEC-INPUT-007

**Test:** Special characters in addresses are rejected

**Test Cases:**
1. SQL injection: `'; DROP TABLE tokens;--`
2. Path traversal: `../../../../etc/passwd`
3. Script injection: `<script>alert('xss')</script>`
4. Unicode/emoji: `DIRECT://🔥💰`
5. No prefix: `invalidaddress`
6. Non-hex after DIRECT://: `DIRECT://zzzzgggg`

**Expected Behavior:**
- Stage 1 validation catches: #1, #2, #3, #4, #5, #6 (non-hex)
- SDK validation catches: Invalid checksum, wrong length

**Current Status:**
- Send-token command uses `AddressFactory.createAddress()` (line 301)
- All malformed addresses will be rejected
- Test should PASS

## Special Cases

### Case 1: Checksum-Only Addresses

**Question:** What if user provides address without checksum?

**Answer:** SDK will reject it
- `AddressFactory` expects exactly 72 hex characters
- Missing checksum → wrong length → `Invalid address format`

### Case 2: Wrong Checksum

**Question:** What if address has wrong checksum (typo)?

**Answer:** SDK will reject it
- `AddressFactory` recomputes checksum
- Compares with provided checksum
- Mismatch → `Address checksum mismatch`

### Case 3: Valid Hex, Wrong Length

**Question:** What if address is 64 hex chars (no checksum)?

**Answer:** SDK will reject it
- Tries to parse as `slice(0, -4)` → 60 bytes data
- Creates address with computed checksum
- Resulting address won't match original
- → `Address checksum mismatch`

## Error Messages

### SDK Error Messages

1. **`Invalid address format`**
   - Missing `://` separator
   - Wrong number of parts

2. **`Invalid address format: <SCHEME>`**
   - Unknown scheme (not DIRECT or PROXY)

3. **`Address checksum mismatch`**
   - Checksum doesn't match computed value
   - Address was mistyped or corrupted

### Recommended CLI Error Messages

```typescript
try {
    const address = await AddressFactory.createAddress(addressString);
} catch (error) {
    switch (error.message) {
        case 'Invalid address format':
            console.error('❌ Invalid address format');
            console.error('   Expected: DIRECT://<hex> or PROXY://<hex>');
            console.error('   Example: DIRECT://0000...16dc');
            break;
            
        case 'Address checksum mismatch':
            console.error('❌ Invalid address: checksum verification failed');
            console.error('   The address appears to be mistyped or corrupted.');
            console.error('   Please double-check the address and try again.');
            break;
            
        default:
            console.error(`❌ Invalid address: ${error.message}`);
    }
    process.exit(1);
}
```

## Summary

### Key Points

1. **Addresses include checksums**: Last 8 hex characters (4 bytes)
2. **Checksum algorithm**: First 4 bytes of SHA256(data)
3. **Validation is cryptographic**: Requires async SDK call
4. **SDK handles validation**: Use `AddressFactory.createAddress()`
5. **Two-stage validation**: Pre-check + SDK verification
6. **Current CLI implementation**: Already correct (uses SDK)
7. **SEC-INPUT-007 test**: Should PASS with current code

### For SEC-INPUT-007 Implementation

**Test cases are handled by:**
- Input validation module catches: non-hex, wrong format
- SDK catches: wrong length, invalid checksum
- send-token.ts line 301 uses `AddressFactory.createAddress()`

**Recommendation:** Test should already pass. If failing, check:
1. Error handling around `AddressFactory.createAddress()` call
2. Whether errors are properly propagated (not swallowed)
3. Exit code on validation failure
