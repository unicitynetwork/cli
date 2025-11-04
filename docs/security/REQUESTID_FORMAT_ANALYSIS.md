# RequestId Format Analysis: 256-bit vs 272-bit Bug

## Visual Breakdown

### Correct RequestId Structure (272 bits)

```
┌─────────────────────────────────────────────────────────────────┐
│                      RequestId (68 hex chars)                    │
├─────────┬───────────────────────────────────────────────────────┤
│  0000   │ ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055 │
├─────────┴───────────────────────────────────────────────────────┤
│  ^^^^                                                            │
│ 4 hex chars = 2 bytes = 16 bits                                 │
│ Algorithm ID (SHA256 = 0x0000)                                  │
│                                                                  │
│         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ │
│         64 hex chars = 32 bytes = 256 bits                      │
│         Hash Data (SHA256 output)                               │
│                                                                  │
│ TOTAL: 68 hex chars = 34 bytes = 272 bits                      │
└──────────────────────────────────────────────────────────────────┘
```

### Incorrect RequestId (User Error - 256 bits)

```
┌──────────────────────────────────────────────────────────────────┐
│              Hash Data Only (64 hex chars)                       │
├──────────────────────────────────────────────────────────────────┤
│ ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055 │
├──────────────────────────────────────────────────────────────────┤
│ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ │
│ 64 hex chars = 32 bytes = 256 bits                              │
│ Missing 2-byte algorithm prefix!                                │
│                                                                  │
│ PROBLEM: Aggregator expects 272 bits, receives 256 bits         │
│ ERROR: "invalid key length 256, should be 272"                  │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flow Analysis

### Step 1: RequestId Generation (register-request)

```
┌───────────────────────────────────────────────────────────────────┐
│ INPUT                                                             │
├───────────────────────────────────────────────────────────────────┤
│ secret: "test-secret"                                             │
│ state: "test-state"                                               │
│ transaction: "test-transaction"                                   │
└───────────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────────┐
│ STEP 1: Derive Public Key                                        │
├───────────────────────────────────────────────────────────────────┤
│ publicKey = Ed25519.derive("test-secret")                        │
│ = 32 bytes (256 bits)                                             │
└───────────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────────┐
│ STEP 2: Hash State Data                                          │
├───────────────────────────────────────────────────────────────────┤
│ stateHash = SHA256("test-state")                                 │
│ stateHash.data = 32 bytes (256 bits)                             │
│ stateHash.imprint = [0x00, 0x00] + data = 34 bytes (272 bits)   │
└───────────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────────┐
│ STEP 3: Create RequestId                                         │
├───────────────────────────────────────────────────────────────────┤
│ requestId = SHA256(publicKey || stateHash.imprint)               │
│           = SHA256(32 bytes || 34 bytes)                         │
│           = SHA256(66 bytes total input)                         │
│                                                                   │
│ requestId.data = 32 bytes (256 bits)                             │
│ requestId.imprint = [0x00, 0x00] + data = 34 bytes (272 bits)   │
└───────────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────────┐
│ STEP 4: Serialize to JSON                                        │
├───────────────────────────────────────────────────────────────────┤
│ requestId.toJSON() = HexConverter.encode(requestId.imprint)      │
│                    = "0000ecbf70baaa355dc2d52a6a565fc3..."        │
│                    = 68 hex characters                            │
│                                                                   │
│ OUTPUT: "0000ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055" │
└───────────────────────────────────────────────────────────────────┘
```

### Step 2: RequestId Parsing (get-request)

#### Correct Format (272 bits)

```
┌───────────────────────────────────────────────────────────────────┐
│ INPUT: 68 hex characters                                          │
├───────────────────────────────────────────────────────────────────┤
│ "0000ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055" │
└───────────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────────┐
│ STEP 1: Decode Hex String                                        │
├───────────────────────────────────────────────────────────────────┤
│ bytes = HexConverter.decode("0000ecbf70...")                     │
│       = Uint8Array(34) [0x00, 0x00, 0xec, 0xbf, ...]            │
│       = 34 bytes (272 bits) ✓                                    │
└───────────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────────┐
│ STEP 2: Parse Imprint                                            │
├───────────────────────────────────────────────────────────────────┤
│ algorithm = (bytes[0] << 8) | bytes[1]                           │
│           = (0x00 << 8) | 0x00                                   │
│           = 0x0000 (SHA256) ✓                                    │
│                                                                   │
│ data = bytes.subarray(2)                                         │
│      = Uint8Array(32) [0xec, 0xbf, 0x70, ...]                  │
│      = 32 bytes (256 bits) ✓                                     │
│                                                                   │
│ requestId = new RequestId(new DataHash(SHA256, data))            │
│ requestId.imprint = 34 bytes (272 bits) ✓                        │
└───────────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────────┐
│ STEP 3: Query Aggregator                                         │
├───────────────────────────────────────────────────────────────────┤
│ aggregator.getInclusionProof(requestId)                          │
│ → Sends 272-bit key to aggregator ✓                             │
│ → Aggregator accepts and returns proof ✓                        │
└───────────────────────────────────────────────────────────────────┘
```

#### Incorrect Format (256 bits) - THE BUG

```
┌───────────────────────────────────────────────────────────────────┐
│ INPUT: 64 hex characters (missing algorithm prefix!)             │
├───────────────────────────────────────────────────────────────────┤
│ "ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055" │
│  ^^^^ First 4 chars will be misinterpreted as algorithm!          │
└───────────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────────┐
│ STEP 1: Decode Hex String                                        │
├───────────────────────────────────────────────────────────────────┤
│ bytes = HexConverter.decode("ecbf70baaa...")                     │
│       = Uint8Array(32) [0xec, 0xbf, 0x70, ...]                  │
│       = 32 bytes (256 bits) ✗                                    │
└───────────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────────┐
│ STEP 2: Parse Imprint (INCORRECTLY!)                             │
├───────────────────────────────────────────────────────────────────┤
│ algorithm = (bytes[0] << 8) | bytes[1]                           │
│           = (0xec << 8) | 0xbf                                   │
│           = 0xecbf (UNKNOWN ALGORITHM!) ✗                        │
│                                                                   │
│ data = bytes.subarray(2)                                         │
│      = Uint8Array(30) [0x70, 0xba, 0xaa, ...]                  │
│      = 30 bytes (240 bits) ✗                                     │
│                                                                   │
│ requestId = new RequestId(new DataHash(UNKNOWN, data))           │
│ requestId.imprint = 32 bytes (256 bits) ✗                        │
└───────────────────────────────────────────────────────────────────┘
                            ↓
┌───────────────────────────────────────────────────────────────────┐
│ STEP 3: Query Aggregator                                         │
├───────────────────────────────────────────────────────────────────┤
│ aggregator.getInclusionProof(requestId)                          │
│ → Sends 256-bit key to aggregator ✗                             │
│ → Aggregator: "invalid key length 256, should be 272"           │
│ → Aggregator PANICS and CRASHES ✗✗✗                             │
└───────────────────────────────────────────────────────────────────┘
```

## Byte-Level Comparison

### Correct Format (272 bits)

```
Hex Input: 0000ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055
           ^^^^ Algorithm prefix (SHA256)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Hash data

Byte Array:
[0]  [1]  [2]  [3]  [4]  [5]  ... [33]
0x00 0x00 0xec 0xbf 0x70 0xba ... 0x55
└────┴────┴────────────────────────────┘
Algorithm   Hash Data (32 bytes)
(2 bytes)

Total: 34 bytes = 272 bits ✓
```

### Incorrect Format (256 bits)

```
Hex Input: ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055
           ^^^^ Misinterpreted as algorithm!
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Truncated hash

Byte Array:
[0]  [1]  [2]  [3]  [4]  [5]  ... [31]
0xec 0xbf 0x70 0xba 0xaa 0x35 ... 0x55
└────┴────┴──────────────────────────┘
Misread     Incomplete Hash (30 bytes)
Algorithm

Total: 32 bytes = 256 bits ✗
```

## Algorithm Identifiers

```
┌──────────────┬────────────┬───────────────┐
│ Algorithm    │ ID (hex)   │ ID (decimal)  │
├──────────────┼────────────┼───────────────┤
│ SHA256       │ 0x0000     │ 0             │
│ SHA384       │ 0x0001     │ 1             │
│ SHA512       │ 0x0002     │ 2             │
│ UNKNOWN      │ 0xecbf     │ 60607         │ ← Bug creates this!
└──────────────┴────────────┴───────────────┘
```

## Error Messages

### What User Sees (Current)

```bash
$ npm run get-request -- ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055

Error getting request: aggregator panic: invalid key length 256, should be 272
fatal error: nil pointer dereference at service.go:202
```

### What User Should See (After Fix)

```bash
$ npm run get-request -- ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055

❌ Invalid RequestId format!

Expected: 68 hexadecimal characters (34 bytes = 272 bits)
Example:  0000ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055
          ^^^^ 2-byte algorithm prefix (0000 = SHA256)
               ^^^^^^^^^^^^^^^^ 32-byte hash data

Received: ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055
Length:   64 characters (32 bytes = 256 bits)

Missing the 2-byte algorithm prefix!

Hint: When copying RequestId from 'register-request' output, make sure to
      include the FULL 68-character string, not just the hash portion.
```

## Common User Mistakes

### Mistake 1: Copying from Wrong Source

```bash
# User sees in logs (some debugging output might show only hash)
Hash: ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055

# User copies hash instead of full RequestId
npm run get-request -- ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055
# ✗ This is wrong! Missing "0000" prefix
```

### Mistake 2: Following Incorrect Documentation

```bash
# Current README.md example (line 124) shows short format
npm run get-request -- -e https://gateway.unicity.network 7c8a9b0f1d2e3f4a5b6c7d8e9f0a1b2c
                                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                          Only 32 characters! Wrong!

# Should be:
npm run get-request -- -e https://gateway.unicity.network 00007c8a9b0f1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8
                                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                          68 characters with "0000" prefix!
```

### Mistake 3: Programmatic Extraction

```typescript
// User tries to extract RequestId from object
const requestId = someObject.requestId;

// If object stores only .data (32 bytes) instead of .imprint (34 bytes)
const hex = Buffer.from(requestId.data).toString('hex');  // ✗ Only 64 chars
// Should be:
const hex = Buffer.from(requestId.imprint).toString('hex');  // ✓ 68 chars
// Or better:
const hex = requestId.toJSON();  // ✓ Correct serialization
```

## Testing Matrix

| Input Format | Length | Expected Result | Aggregator Response |
|-------------|--------|-----------------|---------------------|
| `0000ecbf...` (68 chars) | 34 bytes (272 bits) | ✓ Accept | ✓ Returns proof |
| `ecbf70ba...` (64 chars) | 32 bytes (256 bits) | ✗ Reject | ✗ Crashes (current) |
| `0000abcd` (8 chars) | 4 bytes (32 bits) | ✗ Reject | ✗ Invalid |
| `xyz123...` (non-hex) | N/A | ✗ Reject | ✗ Parse error |
| Empty string | 0 bytes | ✗ Reject | ✗ Invalid |
| `0000` (prefix only) | 2 bytes (16 bits) | ✗ Reject | ✗ Too short |

## Summary

**The Bug**: Users can accidentally query with 256-bit RequestIds (64 hex chars) instead of the required 272-bit format (68 hex chars), causing aggregator crashes.

**Root Cause**: Missing validation in CLI + misleading documentation examples.

**Impact**: HIGH - Aggregator denial of service, user confusion, lost commitments.

**Solution**: Add format validation in `get-request` command + update documentation examples.

**Files Affected**:
- `/home/vrogojin/cli/src/commands/get-request.ts:58` (add validation)
- `/home/vrogojin/cli/src/commands/register-request.ts:86` (enhance output)
- `/home/vrogojin/cli/README.md:124` (fix example)
