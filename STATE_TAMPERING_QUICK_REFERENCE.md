# State Tampering Detection - Quick Reference

## The Problem

**Current verify-token CANNOT detect if `state.data` has been modified in a TXF file.**

## Why It Happens

The Unicity protocol verifies **state transitions** (from old state → new state), not **final state integrity**.

### For Mint Transactions:
- Genesis proof covers: `SHA256(tokenId || "MINT")` (source state)
- Genesis proof does NOT cover: `TokenState(predicate, data)` (destination state)
- Result: Tampering with `state.data` goes undetected

### For Transfer Transactions:
- Transfer proof covers: previous owner's state hash (source state)
- Transfer proof does NOT cover: new owner's state hash (destination state)
- Result: Tampering with `state.data` goes undetected

## What Gets Verified

| Component | Verified? | Why? |
|-----------|-----------|------|
| Token ID | ✅ Yes | Embedded in predicate structure |
| Token Type | ✅ Yes | Embedded in predicate structure |
| Owner Public Key | ✅ Yes | Signed in predicate, verified by authenticator |
| Inclusion Proofs | ✅ Yes | Merkle path verification |
| Authenticator Signatures | ✅ Yes | Cryptographic signature verification |
| **State Data** | ❌ **NO** | **Not covered by genesis proof** |

## Quick Fix

Add this check to `verify-token.ts`:

```typescript
// After token loads (around line 314)
if (token && token.genesis && token.genesis.data) {
    const genesisData = token.genesis.data.tokenData 
        ? HexConverter.decode(token.genesis.data.tokenData) 
        : new Uint8Array(0);
    const currentData = token.state.data || new Uint8Array(0);
    
    const areEqual = (a: Uint8Array, b: Uint8Array) => 
        a.length === b.length && a.every((val, i) => val === b[i]);
    
    if (!areEqual(genesisData, currentData)) {
        console.log('❌ STATE TAMPERING DETECTED!');
        console.log(`  Genesis data: ${HexConverter.encode(genesisData)}`);
        console.log(`  Current data: ${HexConverter.encode(currentData)}`);
        exitCode = 1;
    } else {
        console.log('✅ State data integrity verified');
    }
}
```

## Testing the Fix

```bash
# 1. Mint token with data
SECRET="test" npm run mint-token -- --local -d '{"test":"data"}' --save

# 2. Get the token file
TOKEN_FILE=$(ls -t *.txf | head -1)

# 3. Tamper with state.data (manually edit JSON)
# Change state.data from original to "deadbeef"

# 4. Verify - should fail
npm run verify-token -- -f "$TOKEN_FILE"
# Expected output: ❌ STATE TAMPERING DETECTED!
```

## Answers to Your Questions

### 1. Does the predicate signature cover TokenState?
**No.** The predicate signature covers:
- Source state hash (for mint: `SHA256(tokenId || "MINT")`)
- Transaction data (tokenId, tokenType, recipient)

It does NOT cover the destination TokenState or `state.data`.

### 2. Should predicate verification fail if I change state.data?
**No.** The current SDK design intentionally verifies **source states** (what was spent), not **destination states** (what was created).

### 3. Is there a method to verify predicate against current state?
**No built-in method.** You must manually compare:
- `token.state.data` (current state)
- `token.genesis.data.tokenData` (original minted data)

### 4. Should I call predicate.verify() in verify-token?
**Yes, but it's insufficient.** You need:
1. `predicate.verify()` - validates source state & signature
2. **Manual data comparison** - detects tampering

## Security Model

### What Proofs Verify
- Transaction was included in blockchain ✅
- Transaction was signed by correct key ✅
- Source state (previous owner) is correct ✅
- Merkle path is cryptographically sound ✅

### What Proofs DON'T Verify
- Destination state data is correct ❌
- TXF file hasn't been tampered with ❌
- Metadata in `state.data` is accurate ❌

### User Protection
1. **Only accept TXF files from trusted sources**
2. **Verify state.data matches expected values**
3. **For minted tokens: compare with genesis.data.tokenData**
4. **Treat TXF files like private keys** (they represent ownership)

## Implementation Files

- **Analysis**: `/home/vrogojin/cli/STATE_TAMPERING_DETECTION_ANALYSIS.md` (full details)
- **Fix location**: `/home/vrogojin/cli/src/commands/verify-token.ts` (line ~314)
- **SDK source**: `node_modules/@unicitylabs/state-transition-sdk/lib/token/TokenState.js:71`
- **Predicate verify**: `node_modules/@unicitylabs/state-transition-sdk/lib/predicate/embedded/DefaultPredicate.js:72`

## Next Steps

1. **Immediate**: Add genesis data validation to verify-token
2. **Short-term**: Add transfer chain validation
3. **Long-term**: Document security model for users
