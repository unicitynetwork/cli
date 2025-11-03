# Ownership Verification Design for verify-token Command

## Executive Summary

This design enhances the `verify-token` command to query the aggregator for on-chain state status and display comprehensive ownership information across four key scenarios:
1. Local TXF is current (state not spent)
2. Local TXF is outdated (state spent elsewhere)
3. Local TXF has pending outbound transfer (not submitted)
4. Local TXF has submitted/confirmed transfer

## Background

### Current State
The `verify-token` command currently:
- Reads TXF file and validates structure
- Performs cryptographic proof verification using TrustBase
- Displays token metadata, genesis, state, and transaction history
- **Does NOT query aggregator to check if state is spent**

### Problem
Users cannot determine:
- If their local TXF represents the actual on-chain state
- Whether the token has been transferred elsewhere
- If a pending transfer in the TXF has been submitted/confirmed

## Technical Architecture

### Key SDK Components

#### 1. StateTransitionClient.getTokenStatus()
```typescript
getTokenStatus(
  trustBase: RootTrustBase,
  token: Token<IMintTransactionReason>,
  publicKey: Uint8Array
): Promise<InclusionProofVerificationStatus>
```

**How it works:**
1. Computes `requestId = RequestId.create(publicKey, stateHash)`
2. Queries aggregator for inclusion proof at this requestId
3. Verifies proof and returns status

**Return values:**
- `InclusionProofVerificationStatus.OK` - State IS spent (proof exists)
- `InclusionProofVerificationStatus.PATH_NOT_INCLUDED` - State NOT spent (proof is exclusion)
- `InclusionProofVerificationStatus.NOT_AUTHENTICATED` - Invalid proof
- `InclusionProofVerificationStatus.PATH_INVALID` - Merkle path invalid

**Critical insight:** When a state is spent, the transfer commitment (publicKey + stateHash) is recorded in the Sparse Merkle Tree. An inclusion proof means "this state was consumed by a transfer."

#### 2. Understanding RequestId
```typescript
RequestId.create(publicKey: Uint8Array, stateHash: DataHash): RequestId
```

A RequestId uniquely identifies a state transition request. For transfers:
- `publicKey` - Current owner's public key (from predicate)
- `stateHash` - Hash of the current token state being consumed

### State Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                     Token State Lifecycle                        │
└─────────────────────────────────────────────────────────────────┘

1. MINTED
   └─> State A (Owner: Alice)
       └─> RequestId(AlicePubKey, StateA_Hash) → NOT in SMT

2. TRANSFER SUBMITTED
   └─> Transfer commitment submitted to aggregator
       └─> RequestId(AlicePubKey, StateA_Hash) → INCLUDED in SMT
       └─> Inclusion proof available (status: OK)

3. TRANSFER CONFIRMED
   └─> State B (Owner: Bob) created
       └─> RequestId(BobPubKey, StateB_Hash) → NOT in SMT (yet)
       └─> Old RequestId(AlicePubKey, StateA_Hash) → Still INCLUDED (historical)
```

**Key insight:** A state's RequestId gets included in the SMT when it's spent in a transfer. Checking if RequestId exists tells us if the state has been spent.

## Design Specifications

### 1. New Function: `checkOwnershipStatus()`

```typescript
interface OwnershipStatus {
  scenario: 'current' | 'outdated' | 'pending' | 'confirmed';
  onChainStatus: 'spent' | 'unspent' | 'unknown';
  currentOwner: string | null;
  pendingRecipient: string | null;
  lastKnownOwner: string | null;
  error: string | null;
}

async function checkOwnershipStatus(
  token: Token<any>,
  tokenJson: any,
  endpoint: string
): Promise<OwnershipStatus>
```

**Logic flow:**
1. Extract current state predicate and parse owner address
2. Extract public key from predicate parameters
3. Compute current state hash
4. Create RequestId for current state
5. Query aggregator via `StateTransitionClient.getTokenStatus()`
6. Check if TXF has pending transactions
7. Determine scenario based on on-chain status + local TXF state

### 2. Scenario Detection Logic

```typescript
function determineScenario(
  onChainStatus: InclusionProofVerificationStatus,
  hasPendingTx: boolean,
  hasConfirmedTx: boolean
): 'current' | 'outdated' | 'pending' | 'confirmed' {

  // State is NOT spent on-chain
  if (onChainStatus === InclusionProofVerificationStatus.PATH_NOT_INCLUDED) {
    if (hasPendingTx) {
      return 'pending';  // Has local transfer not yet submitted
    }
    return 'current';  // Up-to-date, no pending transfers
  }

  // State IS spent on-chain
  if (onChainStatus === InclusionProofVerificationStatus.OK) {
    if (hasConfirmedTx) {
      return 'confirmed';  // Local TXF has the transfer recorded
    }
    return 'outdated';  // Transfer happened elsewhere, not in local TXF
  }

  // Error cases
  return 'outdated';  // Conservative fallback
}
```

### 3. Predicate Parsing Helper

```typescript
function extractOwnerInfo(predicateHex: string): {
  publicKey: Uint8Array;
  address: string;
  engineType: 'masked' | 'unmasked' | 'unknown';
} {
  const predicateBytes = HexConverter.decode(predicateHex);
  const predicateArray = CborDecoder.readArray(predicateBytes);

  // Structure: [engineId, template, params]
  const engineId = CborDecoder.readUnsignedInteger(predicateArray[0]);
  const paramsBytes = CborDecoder.readByteString(predicateArray[2]);
  const paramsArray = CborDecoder.readArray(paramsBytes);

  // Params: [tokenId, tokenType, publicKey, algorithm, ...]
  const publicKey = CborDecoder.readByteString(paramsArray[2]);

  // Reconstruct address using AddressFactory
  const tokenId = TokenId.fromCBOR(paramsArray[0]);
  const tokenType = TokenType.fromCBOR(paramsArray[1]);

  // Create predicate and derive address
  let predicate;
  let engineType: 'masked' | 'unmasked' | 'unknown';

  if (engineId === 0) {
    predicate = UnmaskedPredicate.fromCBOR(predicateBytes);
    engineType = 'unmasked';
  } else if (engineId === 1) {
    predicate = MaskedPredicate.fromCBOR(predicateBytes);
    engineType = 'masked';
  } else {
    throw new Error(`Unknown engine ID: ${engineId}`);
  }

  const address = await AddressFactory.createDirectAddress(predicate);

  return {
    publicKey,
    address: address.address,
    engineType
  };
}
```

### 4. Display Format

#### Scenario A: Current (Not Spent)
```
=== Ownership Status ===
✅ On-Chain Status: Active (not spent)
Current Owner: UND://a1b2c3d4e5...
  Public Key: 02cf6a2472...
  Predicate Type: Unmasked (reusable address)

✓ This TXF is up-to-date with the blockchain
✓ You can send this token using the send-token command
```

#### Scenario B: Outdated (Spent Elsewhere)
```
=== Ownership Status ===
❌ On-Chain Status: Spent
⚠️  The state in this TXF has been spent on-chain

Latest Known Owner (from this file): UND://a1b2c3d4e5...
  Public Key: 02cf6a2472...

Current Actual Owner: Unknown
  (This token was transferred elsewhere, not recorded in this TXF)

❌ This TXF is outdated and cannot be used for transfers
💡 The token may have been transferred from another device/wallet
```

#### Scenario C: Pending Transfer (Not Submitted)
```
=== Ownership Status ===
✅ On-Chain Status: Active (not spent)
Current Owner (on-chain): UND://a1b2c3d4e5...
  Public Key: 02cf6a2472...

⏳ Pending Transfer (not yet submitted to network):
  Recipient: UND://xyz789...
  Status: PENDING

💡 This token has a pending transfer that needs to be submitted
   Use the receive-token or complete-transfer command to submit it
```

#### Scenario D: Confirmed Transfer
```
=== Ownership Status ===
✅ On-Chain Status: Spent (transfer confirmed)
Previous Owner: UND://a1b2c3d4e5...
Current Owner: UND://xyz789...

Transfer History:
  └─> Transfer 1: UND://xyz789...
      Status: CONFIRMED (on blockchain)

✓ Transfer successfully recorded on-chain
📝 This TXF shows TRANSFERRED status (archived)
```

### 5. Error Handling

```typescript
try {
  const status = await client.getTokenStatus(trustBase, token, publicKey);
  // Process status
} catch (error) {
  if (error instanceof JsonRpcNetworkError) {
    if (error.status === 404) {
      // Request ID not found - state is unspent
      return { onChainStatus: 'unspent', ... };
    } else if (error.status === 503 || error.message.includes('ECONNREFUSED')) {
      // Network unavailable
      console.error('⚠️  Cannot verify on-chain status: Network unavailable');
      console.error('   Endpoint:', endpoint);
      return { onChainStatus: 'unknown', error: 'Network unavailable' };
    }
  }

  // Other errors
  console.error('⚠️  Cannot verify on-chain status:', error.message);
  return { onChainStatus: 'unknown', error: error.message };
}
```

**Graceful degradation:**
- If network unavailable, display warning but continue with local verification
- Show all available local information
- Make it clear what couldn't be verified

### 6. Command Options

Add optional network endpoint flag:
```typescript
program
  .command('verify-token')
  .option('-f, --file <file>', 'Token file to verify (required)')
  .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
  .option('--local', 'Use local aggregator (http://localhost:3000)')
  .option('--production', 'Use production aggregator (https://gateway.unicity.network)')
  .option('--skip-network', 'Skip network verification (offline mode)')
```

## Implementation Steps

### Phase 1: Core Functionality
1. ✅ Create `extractOwnerInfo()` helper to parse predicate
2. ✅ Create `checkOwnershipStatus()` function
3. ✅ Integrate `StateTransitionClient.getTokenStatus()` call
4. ✅ Implement scenario detection logic
5. ✅ Add error handling with graceful degradation

### Phase 2: Display Enhancement
6. ✅ Create formatted output for each scenario
7. ✅ Add ownership status section to verify-token output
8. ✅ Update verification summary with ownership info

### Phase 3: Testing
9. ✅ Test with unspent token (scenario A)
10. ✅ Test with spent token from different device (scenario B)
11. ✅ Test with pending transfer (scenario C)
12. ✅ Test with confirmed transfer (scenario D)
13. ✅ Test network error handling
14. ✅ Test offline mode

## Code Integration Points

### 1. Modify verify-token.ts

**After line 303 (after displaying predicate info):**
```typescript
// Display ownership status
if (!options.skipNetwork) {
  await displayOwnershipStatus(token, tokenJson, endpoint, trustBase);
} else {
  console.log('\n=== Ownership Status ===');
  console.log('⚠️  Network verification skipped (offline mode)');
}
```

**Add new section before "Verification Summary":**
```typescript
async function displayOwnershipStatus(
  token: Token<any>,
  tokenJson: any,
  endpoint: string,
  trustBase: RootTrustBase
): Promise<void> {
  console.log('\n=== Ownership Status (On-Chain Verification) ===');

  try {
    const ownershipStatus = await checkOwnershipStatus(token, tokenJson, endpoint, trustBase);

    switch (ownershipStatus.scenario) {
      case 'current':
        displayScenarioA(ownershipStatus);
        break;
      case 'outdated':
        displayScenarioB(ownershipStatus);
        break;
      case 'pending':
        displayScenarioC(ownershipStatus);
        break;
      case 'confirmed':
        displayScenarioD(ownershipStatus);
        break;
    }
  } catch (error) {
    console.error('⚠️  Could not verify ownership status:', error.message);
    console.error('   Displaying local TXF information only...');
  }
}
```

### 2. New Helper Functions

Create new file: `src/utils/ownership-verification.ts`

```typescript
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import { InclusionProofVerificationStatus } from '@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import { CborDecoder } from '@unicitylabs/commons/lib/cbor/CborDecoder.js';
import { AddressFactory } from '@unicitylabs/state-transition-sdk/lib/address/AddressFactory.js';

export interface OwnershipStatus {
  scenario: 'current' | 'outdated' | 'pending' | 'confirmed';
  onChainStatus: 'spent' | 'unspent' | 'unknown';
  currentOwner: string | null;
  currentOwnerPublicKey: string | null;
  pendingRecipient: string | null;
  lastKnownOwner: string | null;
  engineType: 'masked' | 'unmasked' | 'unknown';
  transactionCount: number;
  error: string | null;
}

export async function checkOwnershipStatus(
  token: Token<any>,
  tokenJson: any,
  endpoint: string,
  trustBase: RootTrustBase
): Promise<OwnershipStatus> {
  // Implementation here
}

export function extractOwnerInfo(predicateHex: string): {
  publicKey: Uint8Array;
  address: string;
  engineType: 'masked' | 'unmasked' | 'unknown';
} {
  // Implementation here
}
```

## Testing Strategy

### Test Cases

1. **Happy Path - Current Ownership**
   - Mint token
   - Run verify-token
   - Expect: "Active (not spent)"

2. **Outdated State**
   - Mint token (TXF A)
   - Copy TXF to TXF B
   - Transfer from TXF A to recipient
   - Run verify-token on TXF B (outdated copy)
   - Expect: "Spent" + "outdated" warning

3. **Pending Transfer**
   - Create offline transfer with send-token (Pattern A)
   - Run verify-token on sender's TXF
   - Expect: "Active" + "Pending Transfer"

4. **Confirmed Transfer**
   - Send token with send-token --submit-now
   - Run verify-token on sender's TXF (with TRANSFERRED status)
   - Expect: "Spent" + "transfer confirmed"

5. **Network Error**
   - Stop aggregator
   - Run verify-token
   - Expect: Graceful error message + local info displayed

6. **Offline Mode**
   - Run verify-token --skip-network
   - Expect: Skip network check, show local info only

## Security Considerations

1. **Public Key Exposure**: Public keys from predicates are already visible in TXF files (public data)

2. **Network Trust**: Trusts aggregator responses - mitigated by:
   - Using TrustBase for cryptographic verification
   - Verifying inclusion proofs
   - Displaying verification status

3. **Address Derivation**: Reconstructing addresses from predicates uses SDK methods (trusted)

## Performance Considerations

1. **Additional Network Call**: Adds one `getInclusionProof()` call per verification
   - Typically < 100ms for local aggregator
   - May timeout for production network if unavailable
   - Cached TrustBase reduces overhead

2. **Predicate Parsing**: CBOR decoding is fast (< 1ms)

3. **Total Impact**: ~100-200ms additional latency per verification

## Future Enhancements

1. **Batch Verification**: Verify multiple tokens in parallel
2. **Transaction History Tracing**: Show complete transfer chain
3. **Address Book Integration**: Show human-readable names for addresses
4. **Visual Ownership Timeline**: ASCII art showing token lifecycle
5. **Watch Mode**: Continuously monitor token status changes

## Dependencies

### Required SDK Methods
- ✅ `StateTransitionClient.getTokenStatus()`
- ✅ `RequestId.create()`
- ✅ `Token.state.calculateHash()`
- ✅ `InclusionProof.verify()`
- ✅ `AddressFactory.createDirectAddress()`

### Required Utils
- ✅ `HexConverter`
- ✅ `CborDecoder`
- ✅ `getCachedTrustBase()`

### New Files
- `src/utils/ownership-verification.ts` (new)
- `src/commands/verify-token.ts` (modified)

## Summary

This design adds comprehensive ownership verification to the verify-token command by:
1. Querying aggregator for current on-chain state status
2. Parsing predicate to extract owner information
3. Detecting four key scenarios with appropriate user messaging
4. Handling network errors gracefully
5. Maintaining backward compatibility with offline verification

The implementation leverages existing SDK methods (`getTokenStatus`) and follows patterns established in other commands (send-token, receive-token).
