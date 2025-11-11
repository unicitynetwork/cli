# Recipient Data Hash Security Analysis

**Date**: 2025-11-10  
**Investigator**: Security Audit  
**Severity**: CRITICAL - Data Integrity Vulnerability

---

## Executive Summary

**SECURITY STATUS: VALIDATED - SDK PROVIDES PROTECTION**

The Unicity SDK **DOES** validate that recipient state data matches the sender's `recipientDataHash` commitment. The validation occurs during token verification via `Token.verifyRecipientData()` which calls `Transaction.containsRecipientData()`.

**However**, the CLI's `receive-token` command does **NOT** expose this validation to the user in a user-friendly way. The recipient can provide mismatched data, and the error will only surface when the token is later verified (not immediately during receive).

---

## SDK Validation Report

### 1. SDK Architecture

The SDK implements a multi-layer validation system:

```
Token.verify(trustBase)
  └─> Token.verifyRecipientData()
       └─> Transaction.containsRecipientData(stateData)
            └─> Hash state data and compare with recipientDataHash
```

### 2. Core Validation Logic

**File**: `node_modules/@unicitylabs/state-transition-sdk/lib/transaction/Transaction.js`

```javascript
async containsRecipientData(data) {
    if (this.data.recipientDataHash) {
        // Case 1: Hash is present - data MUST match
        if (!data) {
            return false;  // ERROR: Hash present but no data provided
        }
        const dataHash = await new DataHasher(this.data.recipientDataHash.algorithm)
            .update(data)
            .digest();
        return dataHash.equals(this.data.recipientDataHash);  // Cryptographic comparison
    }
    // Case 2: No hash - data MUST be null
    return !data;  // ERROR if data is present when hash is null
}
```

**Security Properties**:
- **Cryptographically binding**: Uses SHA256 hash comparison
- **Mandatory validation**: If hash is present, data MUST match exactly
- **Null policy**: If hash is null, data MUST also be null

### 3. Validation Trigger Points

**When is validation performed?**

1. **Token.verify(trustBase)** - Full token verification (line 136 in Token.js)
2. **Token.update(trustBase, state, transaction)** - State update (line 121 in Token.js)
3. **TransferTransaction.verify(trustBase, token)** - Transfer verification (line 30 in TransferTransaction.js)

**When is validation NOT performed?**

- During `TokenState` construction (line 19 in TokenState.js)
- During `Token.fromJSON()` parsing (line 88 in Token.js)
- During `receive-token` command execution (receive-token.ts line 329)

---

## CLI Implementation Analysis

### Current Behavior in `receive-token.ts`

**Line 328-330**:
```typescript
const tokenData = token.state.data;  // Preserve token data
const newState = new TokenState(recipientPredicate, tokenData);
console.error('  ✓ New token state created\n');
```

**PROBLEM**: The CLI accepts ANY state data without validation against `recipientDataHash`.

### What Happens Now?

1. **Scenario A**: Recipient provides mismatched data
   - CLI creates TokenState with wrong data
   - Token is saved to file
   - **No error occurs during receive-token**
   - Error surfaces later when token is verified (send-token, verify-token)

2. **Scenario B**: Recipient provides no data when hash is present
   - CLI creates TokenState with null data
   - **No error occurs during receive-token**
   - Error surfaces during verification

### User Experience Problem

```bash
# Sender commits to specific data hash
$ send-token -f token.txf -r "DIRECT://..." --recipient-data-hash "abc123..."

# Recipient provides WRONG data (no validation error!)
$ receive-token -f transfer.txf --state-data '{"wrong":"data"}' --save
✓ Token saved successfully  # <-- FALSE SUCCESS

# Error only appears later
$ send-token -f received.txf -r "DIRECT://..."
❌ Error: State data hash does not match previous transaction recipient data hash
```

---

## Security Model Analysis

### Cryptographic Guarantees

**Q: Is the hash cryptographically binding?**  
**A: YES** - The SDK uses SHA256 hash comparison via `DataHasher.equals()`.

**Q: Can the recipient create alternative states?**  
**A: NO** - The SDK will reject any state where `calculateHash(stateData) !== recipientDataHash`.

**Q: Where is validation enforced?**  
**A: Client-side** - During token verification before submitting transactions.

**Q: Can malicious recipient bypass validation?**  
**A: NO** - The aggregator will also validate when the token is used in a transaction.

### Hash Commitment Policy

**Policy 1: Hash Present (recipientDataHash !== null)**
- Recipient MUST provide state data
- State data MUST hash to recipientDataHash
- Validation is cryptographically enforced

**Policy 2: Hash Null (recipientDataHash === null)**
- Recipient MUST NOT provide state data (data must be null)
- Recipient has full control over state data in FUTURE transfers
- This is the DEFAULT behavior when sender doesn't specify --recipient-data-hash

---

## Vulnerability Assessment

### Severity: MEDIUM

**Type**: User Experience / Early Validation Gap

**Impact**:
- Recipient can create invalid tokens that appear valid
- Errors surface late (during next transfer, not during receive)
- Confusing user experience (success message followed by failure later)

**Likelihood**: HIGH
- Users may not understand recipientDataHash semantics
- No CLI validation guidance
- Easy to make mistakes

**Exploitability**: LOW
- Cannot bypass SDK validation
- Cannot submit invalid tokens to network
- Invalid tokens are caught before network submission

### NOT a Vulnerability

This is **NOT** a critical security vulnerability because:
1. SDK enforces validation before network submission
2. Aggregator rejects invalid state transitions
3. Cryptographic binding cannot be bypassed

### IS a UX Problem

This **IS** a user experience issue because:
1. Errors appear late (after receive-token succeeds)
2. No early feedback for data mismatches
3. Users waste time with invalid tokens

---

## Recommended Fixes

### Fix 1: Add Explicit Validation in receive-token (RECOMMENDED)

**Location**: `/home/vrogojin/cli/src/commands/receive-token.ts` (after line 326)

```typescript
// STEP 11.5: Validate state data against recipient data hash (if present)
console.error('Step 11.5: Validating recipient state data...');

const lastTransaction = token.transactions.length > 0 
  ? token.transactions[token.transactions.length - 1]
  : token.genesis;

if (lastTransaction.data.recipientDataHash) {
  // Hash is present - recipient MUST provide matching data
  if (!tokenData) {
    console.error('\n❌ Error: Sender specified recipient data hash, but no state data provided');
    console.error('The sender committed to a specific state data hash.');
    console.error('You must provide matching state data using --state-data option.');
    process.exit(1);
  }

  // Compute hash of provided data
  const providedDataHash = await new DataHasher(HashAlgorithm.SHA256)
    .update(tokenData)
    .digest();

  // Validate match
  if (!providedDataHash.equals(lastTransaction.data.recipientDataHash)) {
    console.error('\n❌ Error: State data does not match sender commitment');
    console.error(`Expected hash: ${lastTransaction.data.recipientDataHash.toJSON()}`);
    console.error(`Provided hash: ${providedDataHash.toJSON()}`);
    console.error('\nThe state data you provided does not match the hash the sender committed to.');
    process.exit(1);
  }

  console.error('  ✓ State data matches sender commitment');
} else {
  // No hash commitment - data should be null
  if (tokenData) {
    console.error('  ⚠  Warning: Sender did not commit to state data hash');
    console.error('     You are free to set any state data (or none)');
  } else {
    console.error('  ✓ No recipient data hash commitment (data is null)');
  }
}
console.error();
```

### Fix 2: Add --state-data CLI Option

**Location**: `/home/vrogojin/cli/src/commands/receive-token.ts` (line 115)

```typescript
.option('--state-data <json>', 'State data for new token state (must match sender commitment if hash was provided)')
```

**Parsing logic** (line 328):
```typescript
// Parse state data from CLI option or preserve from token
let tokenData: Uint8Array | null = null;
if (options.stateData) {
  tokenData = new TextEncoder().encode(options.stateData);
} else {
  tokenData = token.state.data;  // Preserve existing data
}

const newState = new TokenState(recipientPredicate, tokenData);
```

### Fix 3: Add Token Verification After Construction (DEFENSE IN DEPTH)

**Location**: After creating updated token (line 348)

```typescript
// STEP 13.5: Verify token integrity before saving
console.error('Step 13.5: Verifying token integrity...');
const verificationResult = await updatedToken.verify(trustBase);

if (!verificationResult.isSuccessful) {
  console.error('\n❌ Token verification failed:');
  console.error(verificationResult.toString());
  console.error('\nThe received token is invalid and cannot be used.');
  console.error('Please contact the sender to resolve the issue.');
  process.exit(1);
}

console.error('  ✓ Token verification successful\n');
```

---

## Test Scenarios

### Test A: Empty Hash, Non-Empty Data

**Setup**:
```bash
# Sender creates transfer with NO recipient data hash
SECRET="sender" npm run mint-token -- --local --save
SECRET="sender" npm run send-token -- -f token.txf -r "DIRECT://..." --save
```

**Test**:
```bash
# Recipient tries to set state data (should succeed - no hash constraint)
SECRET="recipient" npm run receive-token -- -f transfer.txf \
  --state-data '{"custom":"data"}' --save
```

**Expected**: SUCCESS (no hash commitment means recipient controls data)

---

### Test B: Non-Empty Hash, Empty Data

**Setup**:
```bash
# Sender commits to specific data hash
hash=$(echo -n '{"status":"active"}' | sha256sum | awk '{print $1}')
SECRET="sender" npm run send-token -- -f token.txf -r "DIRECT://..." \
  --recipient-data-hash "$hash" --save
```

**Test**:
```bash
# Recipient provides NO data (should fail - hash requires data)
SECRET="recipient" npm run receive-token -- -f transfer.txf --save
```

**Expected**: ERROR - "Sender specified recipient data hash, but no state data provided"

---

### Test C: Hash Mismatch - Different Data

**Setup**:
```bash
# Sender commits to hash of '{"status":"active"}'
hash=$(echo -n '{"status":"active"}' | sha256sum | awk '{print $1}')
SECRET="sender" npm run send-token -- -f token.txf -r "DIRECT://..." \
  --recipient-data-hash "$hash" --save
```

**Test**:
```bash
# Recipient provides DIFFERENT data
SECRET="recipient" npm run receive-token -- -f transfer.txf \
  --state-data '{"status":"inactive"}' --save
```

**Expected**: ERROR - "State data does not match sender commitment"

---

### Test D: Correct Hash Match

**Setup**:
```bash
# Sender commits to hash
hash=$(echo -n '{"status":"active"}' | sha256sum | awk '{print $1}')
SECRET="sender" npm run send-token -- -f token.txf -r "DIRECT://..." \
  --recipient-data-hash "$hash" --save
```

**Test**:
```bash
# Recipient provides EXACT matching data
SECRET="recipient" npm run receive-token -- -f transfer.txf \
  --state-data '{"status":"active"}' --save
```

**Expected**: SUCCESS - "State data matches sender commitment"

---

## Implementation Priority

### High Priority (Implement Immediately)

1. **Fix 1**: Add explicit validation in receive-token
   - Prevents confusing UX
   - Catches errors early
   - ~30 lines of code

2. **Fix 2**: Add --state-data CLI option
   - Allows recipient to specify data
   - Required for hash commitments
   - ~10 lines of code

### Medium Priority (Implement Soon)

3. **Fix 3**: Add token verification after construction
   - Defense in depth
   - Catches SDK-level validation errors
   - ~15 lines of code

### Low Priority (Consider for Future)

4. Add interactive prompts for state data
5. Add hash calculation utility
6. Add data hash verification utility

---

## Conclusion

**SDK Security**: EXCELLENT
- Cryptographically enforced hash validation
- Multi-layer verification system
- Cannot bypass validation

**CLI Security**: GOOD
- Relies on SDK validation
- No immediate validation in receive-token
- Errors surface during later operations

**Recommendation**: Implement Fixes 1-3 to improve early error detection and user experience.

**Risk Level**: MEDIUM (UX issue, not security vulnerability)

**Estimated Fix Time**: 1-2 hours

---

## References

- SDK Source: `node_modules/@unicitylabs/state-transition-sdk/lib/transaction/Transaction.js:21-30`
- SDK Source: `node_modules/@unicitylabs/state-transition-sdk/lib/token/Token.js:168-176`
- CLI Source: `src/commands/receive-token.ts:328-330`
- CLI Source: `src/commands/send-token.ts:266-288`

