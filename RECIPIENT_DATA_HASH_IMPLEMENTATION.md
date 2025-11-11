# Recipient Data Hash Validation - Implementation Guide

**Target File**: `/home/vrogojin/cli/src/commands/receive-token.ts`

---

## Implementation Changes

### Change 1: Add Required Import (Top of File)

Add to imports section (around line 8):

```typescript
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
```

### Change 2: Add CLI Option (Line 122)

Add new option to receive-token command:

```typescript
.option('--state-data <json>', 'State data for new token state (must match sender commitment if hash was provided)')
```

### Change 3: Replace State Creation Logic (Lines 326-330)

**CURRENT CODE**:
```typescript
// STEP 12: Create new token state with recipient's predicate
console.error('Step 12: Creating new token state with recipient predicate...');
const tokenData = token.state.data;  // Preserve token data
const newState = new TokenState(recipientPredicate, tokenData);
console.error('  ✓ New token state created\n');
```

**REPLACE WITH**:
```typescript
// STEP 12: Parse and validate state data
console.error('Step 12: Processing recipient state data...');

// Determine state data source (CLI option or preserve from token)
let tokenData: Uint8Array | null = null;
if (options.stateData) {
  // Recipient explicitly provided state data
  tokenData = new TextEncoder().encode(options.stateData);
  console.error(`  State data provided via --state-data option`);
} else {
  // Preserve existing token data
  tokenData = token.state.data;
  if (tokenData) {
    console.error(`  Preserving existing state data from token`);
  } else {
    console.error(`  No state data (null)`);
  }
}

// STEP 12.5: Validate state data against recipient data hash commitment
console.error('\nStep 12.5: Validating recipient state data against sender commitment...');

// Get the transfer commitment from offline package
const transferCommitmentData = offlineTransfer.commitmentData 
  ? JSON.parse(offlineTransfer.commitmentData) 
  : null;

if (!transferCommitmentData) {
  console.error('  ⚠ Warning: No transfer commitment data found');
} else {
  const recipientDataHash = transferCommitmentData.transactionData?.recipientDataHash;

  if (recipientDataHash) {
    // Hash commitment is present - recipient MUST provide matching data
    console.error(`  Hash commitment present: ${recipientDataHash.substring(0, 16)}...`);

    if (!tokenData) {
      console.error('\n❌ Error: Sender committed to recipient data hash, but no state data available');
      console.error('\nThe sender committed to a specific state data hash.');
      console.error('You must provide matching state data using:');
      console.error('  --state-data \'{"your":"data"}\'');
      console.error('\nThe data must hash to: ' + recipientDataHash);
      process.exit(1);
    }

    // Compute hash of provided data
    const providedDataHash = await new DataHasher(HashAlgorithm.SHA256)
      .update(tokenData)
      .digest();
    
    const providedHashHex = providedDataHash.toJSON();

    // CRITICAL: Validate exact match
    if (providedHashHex !== recipientDataHash) {
      console.error('\n❌ Error: State data does not match sender commitment');
      console.error(`\nExpected hash: ${recipientDataHash}`);
      console.error(`Provided hash: ${providedHashHex}`);
      console.error('\nThe state data does not match the hash the sender committed to.');
      console.error('Please verify the data matches what the sender intended.');
      process.exit(1);
    }

    console.error('  ✓ State data matches sender commitment');
  } else {
    // No hash commitment - recipient has flexibility
    console.error('  No recipient data hash commitment');
    
    if (tokenData) {
      console.error('  ℹ  Note: You are free to modify state data in future transfers');
      console.error('     (sender did not commit to specific data)');
    } else {
      console.error('  ✓ State data is null (no commitment required)');
    }
  }
}

// STEP 12.8: Create new token state with validated data
console.error('\nStep 12.8: Creating new token state with recipient predicate...');
const newState = new TokenState(recipientPredicate, tokenData);
console.error('  ✓ New token state created\n');
```

### Change 4: Add Token Verification (After Line 349)

Add after creating updated token:

```typescript
// STEP 13.5: Verify token integrity (defense in depth)
console.error('Step 13.5: Verifying token integrity...');
try {
  const verificationResult = await updatedToken.verify(trustBase);
  
  if (!verificationResult.isSuccessful) {
    console.error('\n❌ Token verification failed');
    console.error('\nVerification details:');
    console.error(verificationResult.toString());
    console.error('\nThe received token is invalid and cannot be used.');
    console.error('This usually indicates:');
    console.error('  - State data does not match sender commitment');
    console.error('  - Invalid predicate or signature');
    console.error('  - Corrupted transfer package');
    console.error('\nPlease contact the sender to resolve the issue.');
    process.exit(1);
  }
  
  console.error('  ✓ Token verification successful');
  console.error('  ✓ All cryptographic proofs valid');
  console.error('  ✓ State data integrity confirmed\n');
} catch (verifyError) {
  console.error('\n❌ Token verification error:');
  console.error(verifyError instanceof Error ? verifyError.message : String(verifyError));
  console.error('\nThe token may be malformed or invalid.');
  process.exit(1);
}
```

---

## Testing Plan

### Test 1: No Hash Commitment

```bash
# Mint token
SECRET="sender" npm run mint-token -- --local --save

# Send without hash commitment
SECRET="sender" npm run send-token -- \
  -f <token.txf> \
  -r "DIRECT://0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20" \
  --save

# Receive (should succeed, no validation required)
SECRET="recipient" npm run receive-token -- \
  -f <transfer.txf> \
  --save
```

**Expected**: Success, no hash validation

---

### Test 2: Hash Commitment - Correct Data

```bash
# Calculate hash
DATA='{"status":"active"}'
HASH=$(echo -n "$DATA" | sha256sum | awk '{print $1}')

# Send with hash commitment
SECRET="sender" npm run send-token -- \
  -f <token.txf> \
  -r "DIRECT://..." \
  --recipient-data-hash "$HASH" \
  --save

# Receive with matching data
SECRET="recipient" npm run receive-token -- \
  -f <transfer.txf> \
  --state-data '{"status":"active"}' \
  --save
```

**Expected**: Success, validation passes

---

### Test 3: Hash Commitment - Wrong Data

```bash
# Calculate hash for one value
HASH=$(echo -n '{"status":"active"}' | sha256sum | awk '{print $1}')

# Send with hash commitment
SECRET="sender" npm run send-token -- \
  -f <token.txf> \
  -r "DIRECT://..." \
  --recipient-data-hash "$HASH" \
  --save

# Receive with DIFFERENT data
SECRET="recipient" npm run receive-token -- \
  -f <transfer.txf> \
  --state-data '{"status":"inactive"}' \
  --save
```

**Expected**: Error - "State data does not match sender commitment"

---

### Test 4: Hash Commitment - Missing Data

```bash
# Calculate hash
HASH=$(echo -n '{"status":"active"}' | sha256sum | awk '{print $1}')

# Send with hash commitment
SECRET="sender" npm run send-token -- \
  -f <token.txf> \
  -r "DIRECT://..." \
  --recipient-data-hash "$HASH" \
  --save

# Receive WITHOUT providing data
SECRET="recipient" npm run receive-token -- \
  -f <transfer.txf> \
  --save
```

**Expected**: Error - "Sender committed to recipient data hash, but no state data available"

---

## Error Messages Reference

### Error 1: Missing State Data When Hash Present

```
❌ Error: Sender committed to recipient data hash, but no state data available

The sender committed to a specific state data hash.
You must provide matching state data using:
  --state-data '{"your":"data"}'

The data must hash to: abc123...
```

### Error 2: State Data Hash Mismatch

```
❌ Error: State data does not match sender commitment

Expected hash: abc123...
Provided hash: def456...

The state data does not match the hash the sender committed to.
Please verify the data matches what the sender intended.
```

### Error 3: Token Verification Failed

```
❌ Token verification failed

Verification details:
[SDK verification output]

The received token is invalid and cannot be used.
This usually indicates:
  - State data does not match sender commitment
  - Invalid predicate or signature
  - Corrupted transfer package

Please contact the sender to resolve the issue.
```

---

## Code Review Checklist

- [ ] DataHasher import added
- [ ] --state-data CLI option added
- [ ] State data parsing logic implemented
- [ ] Hash validation logic implemented
- [ ] Error messages are clear and actionable
- [ ] Token verification (defense in depth) added
- [ ] All 4 test scenarios pass
- [ ] TypeScript compiles without errors
- [ ] Existing tests still pass

---

## Rollout Plan

1. **Implement changes** in receive-token.ts
2. **Build and test** manually with 4 test scenarios
3. **Run existing test suite** to ensure no regressions
4. **Update documentation** with new --state-data option
5. **Add automated tests** for hash validation scenarios
6. **Deploy to users** with release notes

---

## Security Notes

1. **This is NOT a security vulnerability** - SDK already validates
2. **This IS a UX improvement** - Catch errors early
3. **Defense in depth** - Multiple validation layers
4. **Cryptographic guarantee** - SHA256 hash comparison
5. **Network validation** - Aggregator also checks

---

## Estimated Impact

- **Lines of code**: ~80 lines added
- **Implementation time**: 1-2 hours
- **Testing time**: 1 hour
- **Risk level**: LOW (early validation, no SDK changes)
- **User benefit**: HIGH (better error messages, early failure)

