# Ownership Verification Flow Diagram

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    verify-token Command Flow                         │
└─────────────────────────────────────────────────────────────────────┘

1. Read TXF File
   │
   ├─> Parse JSON
   ├─> Load with SDK (Token.fromJSON)
   └─> Validate proofs
   │
2. Extract Current State Info
   │
   ├─> Get state.predicate (hex)
   ├─> Parse CBOR: [engineId, template, params]
   ├─> Extract params[2] = publicKey
   └─> Compute stateHash = SHA256(state)
   │
3. Query Aggregator for State Status
   │
   ├─> Create requestId = RequestId.create(publicKey, stateHash)
   ├─> Call client.getTokenStatus(trustBase, token, publicKey)
   └─> Get InclusionProofVerificationStatus
   │
4. Analyze Local TXF
   │
   ├─> Check for offlineTransfer field
   ├─> Check transactions array
   └─> Determine if transfers are pending/confirmed
   │
5. Determine Scenario
   │
   ├─> Compare on-chain status + local state
   └─> Map to: current | outdated | pending | confirmed
   │
6. Display Ownership Status
   │
   └─> Formatted output for scenario
```

## RequestId Concept

```
┌─────────────────────────────────────────────────────────────────────┐
│              Understanding RequestId and State Spending              │
└─────────────────────────────────────────────────────────────────────┘

Token Lifecycle:

Step 1: Token Minted
   State A: { predicate: PredicateAlice, data: "Hello" }
   StateHash A = SHA256(State A)
   RequestId A = Hash(AlicePubKey, StateHash A)

   Aggregator SMT: RequestId A → NOT INCLUDED
   Status: UNSPENT ✅

Step 2: Alice Creates Transfer to Bob
   TransferCommitment:
     - Input: State A (consumed)
     - Output: State B (created)
     - Signed by Alice

   RequestId A = Hash(AlicePubKey, StateHash A)  ← This gets submitted

Step 3: Transfer Submitted to Aggregator
   Aggregator SMT: RequestId A → INCLUDED ✅
   Status: SPENT ⚠️

   (State A is now consumed, cannot be spent again)

Step 4: Bob Receives Token
   State B: { predicate: PredicateBob, data: "Hello" }
   StateHash B = SHA256(State B)
   RequestId B = Hash(BobPubKey, StateHash B)

   Aggregator SMT:
     - RequestId A → INCLUDED (historical)
     - RequestId B → NOT INCLUDED (unspent)

   Bob's Status: UNSPENT ✅
```

## InclusionProofVerificationStatus Mapping

```
┌─────────────────────────────────────────────────────────────────────┐
│           SDK Status → Ownership Interpretation                      │
└─────────────────────────────────────────────────────────────────────┘

SDK Status                      Meaning                 Our Term
──────────────────────────────────────────────────────────────────────
PATH_NOT_INCLUDED              RequestId not in SMT     UNSPENT ✅
                              (Exclusion proof)         (Active)

OK                             RequestId in SMT         SPENT ⚠️
                              (Inclusion proof)         (Consumed)

NOT_AUTHENTICATED              Proof signature invalid  ERROR ❌

PATH_INVALID                   Merkle path invalid      ERROR ❌
```

## Four Ownership Scenarios

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Scenario Decision Tree                         │
└─────────────────────────────────────────────────────────────────────┘

Query: getTokenStatus(token, publicKey)
│
├─> PATH_NOT_INCLUDED (State is UNSPENT)
│   │
│   ├─> Has offlineTransfer field?
│   │   │
│   │   ├─> YES → Scenario C: PENDING TRANSFER ⏳
│   │   │         "Transfer created but not submitted"
│   │   │
│   │   └─> NO  → Scenario A: CURRENT OWNERSHIP ✅
│   │             "TXF is up-to-date"
│   │
│
└─> OK (State is SPENT)
    │
    ├─> Last transaction in TXF matches this spend?
    │   │
    │   ├─> YES → Scenario D: CONFIRMED TRANSFER ✅
    │   │         "Transfer recorded in TXF and on-chain"
    │   │
    │   └─> NO  → Scenario B: OUTDATED TXF ⚠️
    │             "State spent elsewhere, TXF outdated"
```

## Detailed Scenario Flows

### Scenario A: Current (Up-to-Date)

```
Local TXF:                         Aggregator:
┌─────────────────────┐           ┌─────────────────────┐
│ State A             │           │ SMT:                │
│ Owner: Alice        │           │   RequestId A       │
│ Status: (none)      │           │   → NOT_INCLUDED    │
│ Transactions: []    │           │                     │
└─────────────────────┘           └─────────────────────┘
         │                                  │
         └──────────> Query  ──────────────┘

         Result: PATH_NOT_INCLUDED + No pending TX

Display:
  ✅ On-Chain Status: Active (not spent)
  ✅ Current Owner: Alice
  ✅ TXF is up-to-date
```

### Scenario B: Outdated (Spent Elsewhere)

```
Local TXF (Copy A):                Aggregator:
┌─────────────────────┐           ┌─────────────────────┐
│ State A             │           │ SMT:                │
│ Owner: Alice        │           │   RequestId A       │
│ Status: (none)      │           │   → INCLUDED ✅     │
│ Transactions: []    │           │   (Transfer to Bob) │
└─────────────────────┘           └─────────────────────┘
         │                                  │
         └──────────> Query  ──────────────┘

Note: User transferred from another device (Copy B)
      Copy A never saw the transfer

         Result: OK (spent) + No matching TX in local TXF

Display:
  ❌ On-Chain Status: Spent
  ⚠️  Latest Known Owner (from file): Alice
  ⚠️  Current Actual Owner: Unknown
  ❌ TXF is outdated
```

### Scenario C: Pending Transfer

```
Local TXF:                         Aggregator:
┌─────────────────────┐           ┌─────────────────────┐
│ State A             │           │ SMT:                │
│ Owner: Alice        │           │   RequestId A       │
│ offlineTransfer:    │           │   → NOT_INCLUDED    │
│   recipient: Bob    │           │                     │
│   status: PENDING   │           │                     │
│ Transactions: []    │           │ (Not submitted yet) │
└─────────────────────┘           └─────────────────────┘
         │                                  │
         └──────────> Query  ──────────────┘

         Result: PATH_NOT_INCLUDED + Has offlineTransfer

Display:
  ✅ On-Chain Status: Active (not spent)
  ✅ Current Owner (on-chain): Alice
  ⏳ Pending Transfer To: Bob (not submitted)
```

### Scenario D: Confirmed Transfer

```
Local TXF:                         Aggregator:
┌─────────────────────┐           ┌─────────────────────┐
│ State A             │           │ SMT:                │
│ Owner: Alice        │           │   RequestId A       │
│ Status: TRANSFERRED │           │   → INCLUDED ✅     │
│ Transactions: [     │           │   (Transfer to Bob) │
│   Transfer to Bob   │           │                     │
│ ]                   │           │                     │
└─────────────────────┘           └─────────────────────┘
         │                                  │
         └──────────> Query  ──────────────┘

         Result: OK (spent) + Matching TX in local TXF

Display:
  ✅ On-Chain Status: Spent (transfer confirmed)
  ✓  Previous Owner: Alice
  ✓  Current Owner: Bob
  ✓  Transfer recorded on-chain
```

## Code Flow in verify-token.ts

```
verifyTokenCommand()
│
├─> Read & Parse TXF
│   └─> Token.fromJSON()
│
├─> Validate Proofs (existing)
│   └─> validateTokenProofs()
│
├─> Display Genesis (existing)
│
├─> Display Current State (existing)
│
├─> NEW: Display Ownership Status
│   │
│   ├─> checkOwnershipStatus()
│   │   │
│   │   ├─> extractOwnerInfo(token.state.predicate)
│   │   │   └─> Returns: { publicKey, address, engineType }
│   │   │
│   │   ├─> Create AggregatorClient + StateTransitionClient
│   │   │
│   │   ├─> Call client.getTokenStatus(trustBase, token, publicKey)
│   │   │   └─> Returns: InclusionProofVerificationStatus
│   │   │
│   │   ├─> Analyze TXF:
│   │   │   ├─> Has offlineTransfer?
│   │   │   └─> Has transactions[]?
│   │   │
│   │   └─> determineScenario()
│   │       └─> Returns: 'current' | 'outdated' | 'pending' | 'confirmed'
│   │
│   └─> displayOwnershipStatus(scenario)
│       │
│       ├─> displayScenarioA() [current]
│       ├─> displayScenarioB() [outdated]
│       ├─> displayScenarioC() [pending]
│       └─> displayScenarioD() [confirmed]
│
└─> Display Transaction History (existing)
```

## Error Handling Flow

```
checkOwnershipStatus()
│
├─> try {
│     client.getTokenStatus(...)
│   }
│
├─> catch (JsonRpcNetworkError)
│   │
│   ├─> error.status === 404
│   │   └─> RequestId not found
│   │       → State is unspent (normal)
│   │
│   ├─> error.status === 503 || ECONNREFUSED
│   │   └─> Aggregator unavailable
│   │       → Display: "⚠️ Cannot verify - network unavailable"
│   │       → Set onChainStatus = 'unknown'
│   │       → Continue with local verification
│   │
│   └─> Other network errors
│       └─> Display: "⚠️ Network error: {message}"
│           → Set onChainStatus = 'unknown'
│
└─> catch (Error)
    └─> Display: "⚠️ Verification error: {message}"
        → Show local TXF info only
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Data Flow Overview                             │
└─────────────────────────────────────────────────────────────────────┘

Input:
  └─> TXF File (token.txf)

Parse:
  ├─> JSON.parse()
  └─> Token.fromJSON()
       │
       └─> Token {
             id: TokenId
             type: TokenType
             state: TokenState {
               predicate: Uint8Array
               data: Uint8Array
             }
             genesis: MintTransaction
             transactions: TransferTransaction[]
           }

Extract:
  └─> Predicate CBOR:
       [engineId, template, params]
        │
        └─> params: [tokenId, tokenType, publicKey, algorithm, ...]
                                            │
                                            └─> Extract publicKey

Compute:
  └─> stateHash = SHA256(token.state)
  └─> requestId = RequestId.create(publicKey, stateHash)

Query:
  └─> aggregator.getInclusionProof(requestId)
       │
       └─> InclusionProof {
             merkleTreePath: SparseMerkleTreePath
             authenticator: Authenticator | null
             transactionHash: DataHash | null
             unicityCertificate: UnicityCertificate
           }
       │
       └─> inclusionProof.verify(trustBase, requestId)
            │
            └─> InclusionProofVerificationStatus:
                 - OK (state spent)
                 - PATH_NOT_INCLUDED (state unspent)
                 - NOT_AUTHENTICATED (error)
                 - PATH_INVALID (error)

Analyze:
  └─> Combine:
       - onChainStatus (from verification)
       - hasOfflineTransfer (from TXF.offlineTransfer)
       - hasTransactions (from TXF.transactions)
       │
       └─> Scenario: 'current' | 'outdated' | 'pending' | 'confirmed'

Display:
  └─> Formatted output for scenario
```

## Integration Points

### New Dependencies
```typescript
// Add to verify-token.ts
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { InclusionProofVerificationStatus } from '@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.js';
import { checkOwnershipStatus } from '../utils/ownership-verification.js';
```

### New Command Options
```typescript
// Add to command definition
.option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
.option('--local', 'Use local aggregator (http://localhost:3000)')
.option('--production', 'Use production aggregator (https://gateway.unicity.network)')
.option('--skip-network', 'Skip network verification (offline mode)')
```

### Modified Output Structure
```
=== Token Verification ===
File: token.txf

=== Basic Information ===
Version: 2.0

=== Proof Validation (JSON) ===
✅ All proofs structurally valid

=== Cryptographic Proof Verification ===
✅ All proofs cryptographically verified

=== Genesis Transaction (Mint) ===
[existing output]

=== Current State ===
[existing output]

=== Predicate Details ===
[existing output]

=== Ownership Status (On-Chain Verification) ===  ← NEW SECTION
[scenario-specific output]

=== Transaction History ===
[existing output]

=== Verification Summary ===
[existing output]
```

## Testing Scenarios

### Test 1: Fresh Mint (Current)
```bash
# Mint new token
npm run mint-token -- -e http://localhost:3000 --save

# Verify immediately
npm run verify-token -- -f token.txf -e http://localhost:3000

# Expected: Scenario A (current)
```

### Test 2: Outdated Copy
```bash
# Mint token
npm run mint-token -- -e http://localhost:3000 -o token_a.txf

# Copy TXF
cp token_a.txf token_b.txf

# Transfer from token_a
npm run send-token -- -f token_a.txf -r UND://... --submit-now

# Verify outdated copy token_b
npm run verify-token -- -f token_b.txf -e http://localhost:3000

# Expected: Scenario B (outdated)
```

### Test 3: Pending Transfer
```bash
# Create offline transfer
npm run send-token -- -f token.txf -r UND://... --save

# Verify sender's copy (still has offlineTransfer)
npm run verify-token -- -f token.txf -e http://localhost:3000

# Expected: Scenario C (pending)
```

### Test 4: Confirmed Transfer
```bash
# Send with submit-now
npm run send-token -- -f token.txf -r UND://... --submit-now -o sent.txf

# Verify sent token
npm run verify-token -- -f sent.txf -e http://localhost:3000

# Expected: Scenario D (confirmed)
```

### Test 5: Network Error
```bash
# Stop aggregator
docker stop aggregator-service

# Verify token
npm run verify-token -- -f token.txf -e http://localhost:3000

# Expected: Error message + local info displayed
```
