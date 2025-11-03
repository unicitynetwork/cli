# verify-token Command Guide

## Overview

The `verify-token` command inspects and validates TXF (Token eXchange Format) files, displaying comprehensive human-readable information about token structure, ownership, and blockchain inclusion. It performs full CBOR deserialization of predicates to show the public key, signature, and all ownership parameters.

## Basic Usage

```bash
npm run verify-token -- -f <token_file.txf>
```

### Required Option

- **`-f, --file <file>`** - Path to the token file to verify (required)

## What It Shows

The command displays:

1. **SDK Compatibility**: Whether the token can be loaded with `Token.fromJSON()`
2. **Token Data**: Decoded as UTF-8/JSON (or hex if binary)
3. **Genesis Transaction**: Original mint transaction details
4. **Inclusion Proof**: Merkle path and Unicity certificate proving blockchain inclusion
5. **Current State**: Token data and full predicate deserialization
6. **Predicate Details**: Complete CBOR structure breakdown showing:
   - Engine ID (masked vs unmasked)
   - Template bytes
   - All 6 parameters: tokenId, tokenType, **publicKey**, algorithm, signatureScheme, **signature**
7. **Transaction History**: All transfers and state changes
8. **Verification Summary**: Overall token validity and SDK compatibility

## Example Output

```bash
$ npm run verify-token -- -f 20251102_205623_1762113383329_00005812b0.txf

=== Token Verification ===
File: 20251102_205623_1762113383329_00005812b0.txf

=== Basic Information ===
Version: 2.0
✅ Token loaded successfully with SDK
Token ID: eaf0f2acbc090fcfef0d08ad1ddbd0016d2777a1b68e2d101824cdcf3738ff86
Token Type: f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509

=== Genesis Transaction (Mint) ===

Mint Transaction Data:
  Token ID: eaf0f2acbc090fcfef0d08ad1ddbd0016d2777a1b68e2d101824cdcf3738ff86
  Token Type: f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509
  Recipient: DIRECT://00005812b08f9c5ed1ed446a3acecf0094aba65b31a2ab381f951892c8d236a8682968756375

  Token Data (hex): 7b226e616d65223a2253444b2054657374222c227665727369...
  Token Data (decoded): {"name":"SDK Test","version":1}

  Salt: c845a590c905922e1f03c0e621e02fcdcad1738146a925ad6a7c0f8238b36f3e

Inclusion Proof:
  ✓ Token included in blockchain
  Merkle Root: 000090344643f1623e8b63011da7e062aca9cec173935bc98293638b7479535e3cd4
  Merkle Path Steps: 4
  Unicity Certificate: d903ef8701d903f08a011a00021dab005822000090344643f1... (768 chars)

=== Current State ===

State Data (hex): 7b226e616d65223a2253444b2054657374222c227665727369...
State Data (decoded):
{"name":"SDK Test","version":1}

=== Predicate Details ===
Raw Length: 187 bytes
Raw Hex (first 50 chars): 8300410058b5865820eaf0f2acbc090fcfef0d08ad1ddbd001...

✅ Valid CBOR structure: [engine_id, template, params]

Engine ID: 0 - UnmaskedPredicate (reusable address)
Template: 00 (1 byte)

Parameters: 181 bytes

Parameter Structure (6 elements):
  [0] Token ID: eaf0f2acbc090fcfef0d08ad1ddbd0016d2777a1b68e2d101824cdcf3738ff86
  [1] Token Type: f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509
  [2] Public Key: 0364d7f0d4c1c7a3ac3aaca74a860c7e9fd421b244016de642caf57d638fdd8fc6
  [3] Algorithm: secp256k1
  [4] Signature Scheme: 0 (0x00)
  [5] Signature: 0a60dc84699975e45c3c08d7e9707ea3e6d0876dd84b263c2433a2b9840d668d125a397b71dcb5067dac0ee21e8293d2c36a0321b418b2f7dfa854ff3407825a

=== Transaction History ===
Number of transfers: 0
(No transfer transactions - newly minted token)

=== Verification Summary ===
✓ File format: TXF v2.0
✓ Has genesis: true
✓ Has state: true
✓ Has predicate: true
✓ SDK compatible: Yes

💡 This token can be transferred using the transfer-token command
```

## Understanding the Output

### Basic Information

- **Version**: TXF format version (should be "2.0")
- **SDK Compatibility**: Whether `Token.fromJSON()` succeeds
- **Token ID**: 256-bit unique identifier for this token
- **Token Type**: 256-bit identifier for the token type/collection

### Genesis Transaction

The original mint transaction that created the token:

- **Token ID/Type**: Identifiers for the token
- **Recipient**: The address that received the token (your address if you minted it)
- **Token Data**: The initial data/metadata (decoded as JSON or UTF-8 if possible)
- **Salt**: Random value used in token creation
- **Coin Data**: For fungible tokens, shows coin amounts

### Inclusion Proof

Cryptographic proof that the token was included in the Unicity blockchain:

- **Merkle Root**: Root hash of the Merkle tree
- **Merkle Path Steps**: Number of hops in the proof path
- **Unicity Certificate**: Signed certificate from validators

### Current State

The token's current data and ownership predicate:

- **State Data**: Current token data (decoded as JSON/UTF-8 or shown as hex)
- **Predicate**: Ownership predicate (see Predicate Details below)

### Predicate Details (MOST IMPORTANT)

Full CBOR deserialization of the ownership predicate:

1. **Engine ID**:
   - `0` = UnmaskedPredicate (reusable address)
   - `1` = MaskedPredicate (one-time address)

2. **Template**: The predicate template (usually `0x00`)

3. **Parameters** (6 elements):
   - **[0] Token ID**: Must match the token (for binding)
   - **[1] Token Type**: Must match the token type
   - **[2] Public Key**: 🔑 **Owner's public key** (33 bytes for secp256k1)
   - **[3] Algorithm**: Signature algorithm (e.g., "secp256k1")
   - **[4] Signature Scheme**: Usually `0`
   - **[5] Signature**: 🔐 **Cryptographic signature** proving ownership

**This is how you can spend the token**: The predicate contains your public key and signature, proving you own the token.

### Transaction History

Shows all state transitions the token has undergone:

- **0 transfers**: Newly minted, never transferred
- **1+ transfers**: Shows each transfer with new owner information

### Verification Summary

Quick checklist of token validity:

- ✓ **File format**: Correct TXF version
- ✓ **Has genesis**: Original mint transaction present
- ✓ **Has state**: Current state data present
- ✓ **Has predicate**: Ownership predicate present
- ✓ **SDK compatible**: Can be loaded and used with SDK

## Use Cases

### 1. Verify After Minting

After minting a token, verify it was created correctly:

```bash
SECRET="my-secret" npm run mint-token -- \
  -d '{"name":"My NFT"}' \
  -o token.txf

npm run verify-token -- -f token.txf
```

Check:
- ✅ SDK compatible: Yes
- ✅ Predicate has your public key
- ✅ Inclusion proof present

### 2. Check Token Ownership

To see who owns a token, look at the predicate public key:

```bash
npm run verify-token -- -f token.txf | grep "Public Key"
```

Output:
```
  [2] Public Key: 0364d7f0d4c1c7a3ac3aaca74a860c7e9fd421b244016de642caf57d638fdd8fc6
```

### 3. Inspect Token Data

To see what data is stored in the token:

```bash
npm run verify-token -- -f token.txf | grep -A 5 "State Data"
```

Output shows decoded JSON or text if possible.

### 4. Verify Inclusion in Blockchain

Check that the token was actually included in the blockchain:

```bash
npm run verify-token -- -f token.txf | grep -A 3 "Inclusion Proof"
```

Output:
```
Inclusion Proof:
  ✓ Token included in blockchain
  Merkle Root: 000090344643f1623e8b63011da7e062aca9cec173935bc98293638b7479535e3cd4
  Merkle Path Steps: 4
```

### 5. Debug SDK Loading Issues

If you suspect a token file is malformed:

```bash
npm run verify-token -- -f suspicious-token.txf
```

Look for:
- ❌ "Could not load token with SDK" - indicates format issues
- ✅ "Token loaded successfully with SDK" - format is correct

## Common Issues

### "Error: ENOENT: no such file or directory"

**Problem**: File path is incorrect or file doesn't exist.

**Solution**:
```bash
# Use correct path
npm run verify-token -- -f ./path/to/token.txf

# List files in current directory
ls *.txf
```

### "Failed to decode predicate"

**Problem**: Predicate is corrupted or not in CBOR format.

**Likely Cause**: Token file was created with older, buggy version of mint-token (before 2024-11-02 fix).

**Solution**: Re-mint the token with updated mint-token command.

### "Could not load token with SDK"

**Problem**: Token file format is incompatible with SDK.

**Likely Cause**: Manual JSON editing or old mint-token version.

**Solution**:
1. Check error message for specific issue
2. Re-mint with current mint-token command
3. Don't manually edit TXF files

### "No predicate found"

**Problem**: Token state has no predicate.

**This is unusual**: All minted tokens should have predicates.

**Possible Cause**: Corrupted file or incomplete mint operation.

## Predicate Structure Deep Dive

### CBOR Encoding

The predicate is a CBOR-encoded array with 3 elements:

```
Hex: 8300410058b5865820...
     ^^-- CBOR array marker (0x83 = array with 3 elements)
       ^^-- Element 1: unsigned int 0 (engine ID)
         ^^^^-- Element 2: byte string with 1 byte (template: 0x00)
             ^^^^-- Element 3: byte string with 181 bytes (parameters)
```

### Parameters CBOR Structure

The 181-byte parameters field is another CBOR array with 6 elements:

```
86 -- CBOR array with 6 elements
  5820 -- byte string, 32 bytes (tokenId)
    eaf0f2ac...
  5820 -- byte string, 32 bytes (tokenType)
    f8aa1383...
  5821 -- byte string, 33 bytes (publicKey - compressed secp256k1)
    0364d7f0...
  69 -- text string, 9 bytes (algorithm)
    736563703235366b31 ("secp256k1")
  00 -- unsigned int 0 (signature scheme)
  5840 -- byte string, 64 bytes (signature)
    0a60dc84...
```

### Why This Matters

The predicate proves ownership because:

1. It contains your **public key**
2. It contains a **signature** created with your private key
3. The signature signs over the tokenId, tokenType, and public key
4. Only someone with the corresponding private key can create a valid signature
5. To transfer the token, you need to provide a new valid signature

## Best Practices

### 1. Always Verify After Minting

```bash
SECRET="my-secret" npm run mint-token -- -d '{"name":"NFT"}' -o token.txf
npm run verify-token -- -f token.txf
```

Ensures the token was created correctly.

### 2. Check SDK Compatibility

Look for this line:
```
✅ Token loaded successfully with SDK
```

If you see:
```
⚠ Could not load token with SDK: ...
```

The token may not work with SDK operations.

### 3. Save Verification Output

For audit trails:

```bash
npm run verify-token -- -f important-token.txf > token-verification-report.txt
```

### 4. Verify Tokens Before Transfer

Before transferring a token, verify it's valid:

```bash
npm run verify-token -- -f token-to-transfer.txf
# Check for ✅ SDK compatible: Yes
# Check predicate has your public key
```

## Technical Details

### Implementation

The verify-token command (src/commands/verify-token.ts):

1. Reads the TXF file as JSON
2. Attempts to load with `Token.fromJSON()` for SDK validation
3. Decodes token data from hex to UTF-8/JSON (if possible)
4. Decodes predicate CBOR structure:
   - Uses `CborDecoder.readArray()` for outer array
   - Uses `CborDecoder.readByteString()` for template and params
   - Uses `CborDecoder.readArray()` for params array
   - Decodes each parameter with appropriate method
5. Displays all information in human-readable format

### CBOR Decoding Methods Used

- `CborDecoder.readArray(bytes)`: Decode CBOR array
- `CborDecoder.readByteString(bytes)`: Decode CBOR byte string
- `CborDecoder.readTextString(bytes)`: Decode CBOR text string
- `CborDecoder.readUnsignedInteger(bytes)`: Decode CBOR unsigned int

## See Also

- **`mint-token`** - Create new tokens (generates SDK-compliant TXF files)
- **`gen-address`** - Generate addresses from secrets
- **`transfer-token`** - Transfer token ownership
- **TXF_IMPLEMENTATION_GUIDE.md** - Complete TXF format specification
