# Fix TokenId Hashing in Unicity POW

## Problem Summary

The miner-simulator and related scripts incorrectly hash tokenId as a **UTF-8 string** (64 ASCII characters) instead of as **binary data** (32 bytes).

**Current (Wrong):**
```bash
echo -n "$tokenid" | sha256sum
# This hashes: "4bbd49ff3b112cdd..." (64 ASCII characters = 64 bytes)
```

**Correct:**
```bash
echo -n "$tokenid" | xxd -r -p | sha256sum
# This hashes: binary representation (32 bytes)
```

## Cryptographic Rationale

TokenIds are 256-bit (32-byte) values represented as 64 hexadecimal characters. When computing `target = SHA256(tokenId)`, we must hash the **binary value**, not the hex string representation.

**Example:**
- TokenID (hex): `4bbd49ff3b112cdd6ea10f17b5ba2ea6be2bc0fcdfcf52aa0ad225e457e2a981`
- Binary: 32 bytes `[0x4b, 0xbd, 0x49, 0xff, ...]`
- **Wrong**: SHA256("4bbd49ff3b112cdd...") → hashes 64 bytes of ASCII
- **Correct**: SHA256([0x4b, 0xbd, 0x49, 0xff, ...]) → hashes 32 bytes of binary

## Files to Fix

### 1. `/home/vrogojin/cli/ref_materials/unicity-pow/scripts/miner-simulator.sh`

**Location:** Lines 106-109

**Current Code:**
```bash
derive_target_from_tokenid() {
    local tokenid="$1"
    # target = SHA256(tokenId)
    echo -n "$tokenid" | sha256sum | awk '{print $1}'
}
```

**Fixed Code:**
```bash
derive_target_from_tokenid() {
    local tokenid="$1"
    # target = SHA256(tokenId)
    # IMPORTANT: Hash tokenId as binary (32 bytes), not as hex string (64 ASCII chars)
    echo -n "$tokenid" | xxd -r -p | sha256sum | awk '{print $1}'
}
```

**Explanation:**
- `xxd -r -p` converts hex string to binary
- `-r` = reverse (hex to binary)
- `-p` = plain format (no address column or line wrapping)

### 2. Verify `sign-checkpoint.js` (Already Correct)

**Location:** `/home/vrogojin/cli/ref_materials/unicity-pow/scripts/sign-checkpoint.js` lines 106-110

**Current Code (CHECK IF CORRECT):**
```javascript
// Compute merkle root: SHA256(checkpoint || target)
const merkleRootBuffer = crypto.createHash('sha256')
  .update(Buffer.concat([checkpointBuffer, targetBuffer]))
  .digest();
```

**Analysis:**
This is **CORRECT** - it concatenates binary buffers, not hex strings.

### 3. Verify Other Scripts

Search for other usages of tokenId hashing:
```bash
cd /home/vrogojin/cli/ref_materials/unicity-pow/scripts
grep -n "sha256sum" *.sh *.js | grep -i token
```

Check if any other scripts compute `SHA256(tokenId)` and fix them similarly.

## Testing Plan

### Test 1: Verify Hash Computation

Create a test script to verify both methods:

```bash
#!/bin/bash
TOKENID="4bbd49ff3b112cdd6ea10f17b5ba2ea6be2bc0fcdfcf52aa0ad225e457e2a981"

echo "TokenID: $TOKENID"
echo ""

echo "Method 1 (WRONG - String hash):"
TARGET_STRING=$(echo -n "$TOKENID" | sha256sum | awk '{print $1}')
echo "Target: $TARGET_STRING"
echo ""

echo "Method 2 (CORRECT - Binary hash):"
TARGET_BINARY=$(echo -n "$TOKENID" | xxd -r -p | sha256sum | awk '{print $1}')
echo "Target: $TARGET_BINARY"
echo ""

# Compare with JavaScript
node -e "
const crypto = require('crypto');
const tokenId = '$TOKENID';

// Wrong method (what miner-simulator does now)
const wrongTarget = crypto.createHash('sha256')
  .update(tokenId, 'utf8')
  .digest('hex');

// Correct method (what it should do)
const correctTarget = crypto.createHash('sha256')
  .update(Buffer.from(tokenId, 'hex'))
  .digest('hex');

console.log('JavaScript (string):  ' + wrongTarget);
console.log('JavaScript (binary):  ' + correctTarget);
console.log('');
console.log('Match string method:  ' + (wrongTarget === '$TARGET_STRING' ? 'YES' : 'NO'));
console.log('Match binary method:  ' + (correctTarget === '$TARGET_BINARY' ? 'YES' : 'NO'));
"
```

**Expected Output:**
```
TokenID: 4bbd49ff3b112cdd6ea10f17b5ba2ea6be2bc0fcdfcf52aa0ad225e457e2a981

Method 1 (WRONG - String hash):
Target: 9dd93ebad5ddb4bbc6af0fcc92216fef0860bb6e252881a42256cb15ce8c0459

Method 2 (CORRECT - Binary hash):
Target: caf848d96de4d274c6f650034373cffd7c8cebe6d3398595fce57989e213141c

JavaScript (string):  9dd93ebad5ddb4bbc6af0fcc92216fef0860bb6e252881a42256cb15ce8c0459
JavaScript (binary):  caf848d96de4d274c6f650034373cffd7c8cebe6d3398595fce57989e213141c

Match string method:  YES
Match binary method:  YES
```

### Test 2: End-to-End Workflow

After fixing miner-simulator.sh:

1. **Generate a new tokenId:**
   ```bash
   cd /home/vrogojin/cli/ref_materials/unicity-pow/scripts
   ./miner-simulator.sh --passphrase "test-secret" --cycles 1
   ```

2. **Extract tokenId and block height from registry:**
   ```bash
   tail -n 1 tokenid-registry.txt
   # Example: 4bbd49ff...,861,7ca74038...,4854e3a5...,9dd93eba...,1763436333,true
   ```

3. **Test CLI verification:**
   ```bash
   cd /home/vrogojin/cli
   SECRET="test" npm run mint-token -- \
     --local \
     --unct-mine <BLOCK_HEIGHT> \
     --local-unct \
     -i <TOKEN_ID> \
     -o test-unct.txf \
     --unsafe-secret
   ```

4. **Expected Result:**
   ```
   ✓ All verification checks passed:
     ✓ Target matches SHA256(tokenId)
     ✓ Witness contains target
     ✓ Merkle root matches block header
     ✓ Witness composition correct
   ```

### Test 3: Verify Merkle Root Computation

After the fix, verify the entire merkle root computation chain:

```bash
#!/bin/bash
TOKENID="<from_registry>"
BLOCK_HEIGHT="<from_registry>"

# Get witness data
WITNESS=$(cd /home/vrogojin/cli/ref_materials/unicity-pow/scripts && \
          ./dev-chain.sh rpc getwitnessbyheight $BLOCK_HEIGHT)

# Extract fields
LEFT=$(echo "$WITNESS" | jq -r '.result.witness.leftControl')
RIGHT=$(echo "$WITNESS" | jq -r '.result.witness.rightControl')
MERKLE=$(echo "$WITNESS" | jq -r '.result.witness.merkleRoot')

echo "TokenID:       $TOKENID"
echo "leftControl:   $LEFT"
echo "rightControl:  $RIGHT"
echo "merkleRoot:    $MERKLE"
echo ""

# Verify target = SHA256(tokenId) - BINARY
COMPUTED_TARGET=$(echo -n "$TOKENID" | xxd -r -p | sha256sum | awk '{print $1}')
echo "Computed target (binary): $COMPUTED_TARGET"
echo "Witness rightControl:     $RIGHT"
echo "Match: $([ "$COMPUTED_TARGET" = "$RIGHT" ] && echo 'YES ✓' || echo 'NO ✗')"
echo ""

# Verify merkleRoot = SHA256(leftControl || rightControl)
COMPUTED_MERKLE=$(echo -n "${LEFT}${RIGHT}" | xxd -r -p | sha256sum | awk '{print $1}')
echo "Computed merkleRoot: $COMPUTED_MERKLE"
echo "Witness merkleRoot:  $MERKLE"
echo "Match: $([ "$COMPUTED_MERKLE" = "$MERKLE" ] && echo 'YES ✓' || echo 'NO ✗')"
```

## Impact Analysis

### What Will Break

After this fix, **all existing mined tokens in the tokenid-registry.txt will be invalid** because:
1. Old targets were computed using string hashing
2. New verification will use binary hashing
3. `SHA256(string) ≠ SHA256(binary)`

### Migration Strategy

**Option 1: Clean Slate (Recommended for Development)**
1. Stop dev-chain
2. Clear blockchain: `./dev-chain.sh reset`
3. Clear registry: `rm tokenid-registry.txt`
4. Apply the fix
5. Restart and re-mine tokens

**Option 2: Dual Support (Temporary)**
Add a flag to miner-simulator to support both methods during transition:
```bash
derive_target_from_tokenid() {
    local tokenid="$1"
    if [ "$USE_LEGACY_HASH" = "true" ]; then
        # Legacy: hash as string
        echo -n "$tokenid" | sha256sum | awk '{print $1}'
    else
        # Correct: hash as binary
        echo -n "$tokenid" | xxd -r -p | sha256sum | awk '{print $1}'
    fi
}
```

## Rollout Plan

### Phase 1: Fix and Test (Development)
1. Apply fix to `miner-simulator.sh`
2. Run verification tests
3. Reset dev-chain and registry
4. Mine new tokens with fixed hashing
5. Verify CLI can mint using new tokens

### Phase 2: Update CLI (Already Done)
The CLI already uses correct binary hashing:
```javascript
const computedTarget = createHash('sha256')
  .update(Buffer.from(tokenId, 'hex'))  // ✓ Correct - binary hash
  .digest('hex');
```

Revert the temporary UTF-8 fix:
```bash
cd /home/vrogojin/cli
git diff src/utils/pow-client.ts src/commands/mint-token.ts
git checkout src/utils/pow-client.ts src/commands/mint-token.ts
npm run build
```

### Phase 3: Documentation
Update documentation to clarify:
- TokenIds are 256-bit binary values
- All hashing must be done on binary representation
- Hex strings are for display/transport only

## Verification Checklist

- [ ] Fixed `derive_target_from_tokenid()` in miner-simulator.sh
- [ ] Verified sign-checkpoint.js uses binary hashing
- [ ] Searched for other tokenId hash computations
- [ ] Tested hash computation matches between bash and JavaScript
- [ ] Reset dev-chain and cleared registry
- [ ] Mined new token with fixed hashing
- [ ] Verified CLI can mint UNCT token successfully
- [ ] Reverted CLI temporary UTF-8 fix
- [ ] Documented the change in unicity-pow README

## Reference

**Correct Bash Pattern:**
```bash
# Convert hex to binary, then hash
echo -n "<64_hex_chars>" | xxd -r -p | sha256sum
```

**Correct JavaScript Pattern:**
```javascript
// Hash binary buffer, not string
crypto.createHash('sha256')
  .update(Buffer.from(hexString, 'hex'))
  .digest('hex');
```

**Incorrect Patterns to Avoid:**
```bash
# WRONG - hashes ASCII string
echo -n "<hex>" | sha256sum

# WRONG - hashes UTF-8 string
echo -n "<hex>" | sha256sum
```

```javascript
// WRONG - hashes UTF-8 string
crypto.createHash('sha256')
  .update(hexString, 'utf8')
  .digest('hex');
```
