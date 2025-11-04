# Visual Reference: RequestId & Data Flow

## Quick Visual: RequestId Computation

```
┌─────────────────────────────────────────────────────────────────┐
│ User Input: secret, state, transition                           │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ├─────────────────┬──────────────────┬──────────────────┐
               │                 │                  │                  │
               ▼                 ▼                  ▼                  ▼
         ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
         │ secret   │      │ state    │      │transition│      │endpoint  │
         └──────────┘      └──────────┘      └──────────┘      └──────────┘
               │                 │                  │
               │ Ed25519         │ SHA256           │ SHA256
               │ Derivation      │ Hash             │ Hash
               ▼                 ▼                  ▼
         ┌──────────┐      ┌──────────┐      ┌──────────┐
         │publicKey │      │stateHash │      │tranHash  │
         │(32 bytes)│      │(32 bytes)│      │(32 bytes)│
         └─────┬────┘      └────┬─────┘      └────┬─────┘
               │                │                  │
               └────────┬───────┘                  │
                        │                         │
                        │ SHA256(pk || sh)       │
                        ▼                         │
                  ┌──────────────┐                │
                  │   RequestId  │                │
                  │  (32 bytes)  │                │
                  └──────────────┘                │
                                                  │
                                    ┌─────────────┘
                                    │
                              ┌─────┴──────────┐
                              │                │
                         transactionHash       authenticator
                         (sent to agg)      (contains signature)
```

**KEY POINT:** RequestId does NOT use transactionHash!

---

## Data Submission to Aggregator

```
┌────────────────────────────────────────────────────────────────────┐
│ register-request CLI                                               │
└─────────────────────────────────────┬──────────────────────────────┘
                                      │
                                      │ Prepares submission:
                                      ▼
                    ┌──────────────────────────────────┐
                    │ SubmitCommitmentRequest Object   │
                    ├──────────────────────────────────┤
                    │ - requestId                      │
                    │ - transactionHash                │
                    │ - authenticator                  │
                    │   ├─ publicKey                   │
                    │   ├─ signature                   │
                    │   ├─ stateHash                   │
                    │   └─ algorithm                   │
                    └──────────────────┬───────────────┘
                                      │
                                      │ Converts to JSON
                                      ▼
                    ┌──────────────────────────────────┐
                    │ JSON-RPC Request                 │
                    ├──────────────────────────────────┤
                    │ POST /                           │
                    │ method: submit_commitment        │
                    │ params: {...}                    │
                    └──────────────────┬───────────────┘
                                      │
                                      │ HTTP POST
                                      ▼
                    ┌──────────────────────────────────┐
                    │ Aggregator Gateway               │
                    ├──────────────────────────────────┤
                    │ https://gateway.unicity.network  │
                    └──────────────────┬───────────────┘
                                      │
                                      │ Processes request:
                                      │ 1. Validate signature
                                      │ 2. Store in database
                                      │ 3. Add to merkle tree
                                      ▼
                    ┌──────────────────────────────────┐
                    │ Response                         │
                    ├──────────────────────────────────┤
                    │ { "status": "SUCCESS" }          │
                    └──────────────────────────────────┘
```

---

## Data Persistence in Aggregator

```
┌─────────────────────────────────────────────────────────────────┐
│ Aggregator Database                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Database[RequestId] = {                                        │
│    "transactionHash": "0x7c4a...",                              │
│    "authenticator": {                                           │
│      "publicKey": "0xa1b2...",                                  │
│      "signature": "0x9f8e...",                                  │
│      "stateHash": "0x5ebf..."                                   │
│    },                                                           │
│    "timestamp": 1234567890                                      │
│  }                                                              │
│                                                                 │
│  🔴 Original "transition" string NOT stored!                    │
│  ✓ transactionHash (SHA256 of transition) IS stored            │
│  ✓ Signature (proof of transition knowledge) IS stored          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Same Secret+State with Different Transitions

```
┌──────────────────────────────────────────────────────────────────┐
│ Registration 1:                                                  │
│ register(..., "secret", "state", "transition-v1")                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ RequestId = SHA256(publicKey || stateHash) = X                  │
│ transactionHash = SHA256("transition-v1")                       │
│ signature = Sign(transactionHash)                               │
│                                                                  │
│ Stored: DB[X] = {transactionHash: hash1, signature: sig1}       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                            │
                            │
┌──────────────────────────────────────────────────────────────────┐
│ Registration 2:                                                  │
│ register(..., "secret", "state", "transition-v2")                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ RequestId = SHA256(publicKey || stateHash) = X  ← SAME KEY!     │
│ transactionHash = SHA256("transition-v2")  ← DIFFERENT VALUE     │
│ signature = Sign(transactionHash)  ← DIFFERENT SIGNATURE         │
│                                                                  │
│ Aggregator Decision:                                             │
│   Option A: Overwrite → DB[X] = {transactionHash: hash2}        │
│   Option B: Reject → ERROR "duplicate RequestId"                │
│   Option C: Store both → Ambiguity on retrieval                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                            │
                            │
┌──────────────────────────────────────────────────────────────────┐
│ Query:                                                           │
│ get-request X                                                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Result: transactionHash = hash1 or hash2                        │
│         (Cannot tell which transition was stored!)               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## RequestId vs TransactionHash

```
RequestId                      TransactionHash
═══════════════════════════════════════════════════════════
├─ Source: publicKey + state      ├─ Source: transition
├─ Computation: SHA256(pk||sh)    ├─ Computation: SHA256(tr)
├─ Represents: Source state       ├─ Represents: Change/action
├─ Used for: Database key         ├─ Used for: Signature input
├─ Changes with: secret, state    ├─ Changes with: transition
├─ Does NOT change: transition    ├─ Does NOT change: secret/state
├─ Can be recomputed: Yes         ├─ Can be recomputed: Yes
├─ Can identify: Source           ├─ Can identify: Transition
│                                  │
└─ Query in get-request: ✓        └─ Query in get-request: ✗
```

---

## Information Flow: Register → Get

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: User runs register-request                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  npm run register-request -- "secret" "state" "transition" │
│                                                             │
│  Output: "Request ID: 0xd4e5f6..."                         │
│                                                             │
│  User saves: RequestId = 0xd4e5f6...                       │
│                                                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Data sent to aggregator:
                         │ ├─ RequestId
                         │ ├─ transactionHash
                         │ └─ authenticator
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Aggregator                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Stores: DB[RequestId] = {transactionHash, authenticator}   │
│                                                             │
│ Adds to merkle tree                                         │
│                                                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Several seconds later...
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: User runs get-request                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  npm run get-request -- "0xd4e5f6..."                      │
│                                                             │
│  Query: "Where is RequestId 0xd4e5f6 in merkle tree?"      │
│                                                             │
│  Response:                                                 │
│    ✓ Found → Returns merkle path + verification status     │
│    ✗ Not found → STATUS: NOT_FOUND                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## What Information is Lost?

```
Original Data               Aggregator Stores           Can Recover?
════════════════════════════════════════════════════════════════════
"mysecret"                  publicKey (derived)         ✗ One-way
"mystate"                   stateHash                   ✓ If you remember
"mytransition"              transactionHash             ✗ One-way (hashed)
                            signature                   ✓ Proves knowledge
                            originalSecret              ✗ Not stored

To verify you submitted:
- Secret: Recompute publicKey and check if it matches
- State: Check what you provided, compare stateHash
- Transition: Compute SHA256 and compare with transactionHash
```

---

## Decision Tree: Why is get-request empty?

```
                        get-request returns NOT_FOUND
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
         Did you use          Is RequestId       Check aggregator
         same secret+state?   correct format?    endpoint & status
              │                    │                    │
         No ──┼──→ Different       No ──→ Parse error  Not responding
             │  RequestId         │                    ──→ Check network
         Yes ▼                Yes ▼
             │                    │
        Check if agg         Wait 10+ seconds
        has any data         (data not committed)
             │                    │
        Empty? ──→ Reg failed  Returns data ✓
             │
        Yes ──→ Error at
             │  aggregator
             ▼
        Check agg logs
        Fix validation error
```

---

## Security Considerations

```
┌────────────────────────────────────────────────────────┐
│ What's Cryptographically Secured?                      │
├────────────────────────────────────────────────────────┤
│                                                        │
│ ✓ publicKey    - Ed25519 derived from secret         │
│ ✓ Signature    - Proves knowledge of private key     │
│ ✓ stateHash    - Commitment to source state          │
│ ✓ RequestId    - Linked to publicKey + stateHash     │
│                                                        │
│ What's NOT Secured?                                   │
│                                                        │
│ ✗ Transition data - Only hash is secured              │
│ ✗ Original state  - Only hash is secured              │
│ ✗ Original secret - Never sent or stored              │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Timing Diagram

```
Time →
═════════════════════════════════════════════════════════════════

T=0s    ┌─ register-request starts
        │
T=0.1s  ├─ Compute RequestId
        │
T=0.2s  ├─ Create authenticator
        │
T=0.3s  ├─ Submit to aggregator
        │  └─ Response: SUCCESS (doesn't mean persisted)
        │
T=0.5s  ├─ Registration "complete" (from CLI perspective)
        │  
        │  ⚠️ Data NOT YET in merkle tree
        │
T=1s    ├─ Aggregator receives and validates
        │
T=2s    ├─ Added to pending pool
        │
T=5s    ├─ Aggregator commits block
        │  └─ Data now in merkle tree
        │
T=6s    ├─ get-request can now find it ✓
        │  └─ Returns merkle proof
        │
        └─ Timeline shows why immediate get-request fails
```

---

## Code Organization

```
register-request.ts
├─ Line 27-28: Create signing service
│  └─ Derives publicKey from secret
├─ Line 31-32: Hash state
│  └─ Creates stateHash
├─ Line 34-35: Hash transition
│  └─ Creates transactionHash
├─ Line 38: ⭐ Create RequestId
│  └─ SHA256(publicKey || stateHash)
│     TRANSITION NOT USED HERE!
├─ Line 41: Create authenticator
│  └─ Sign(transactionHash + stateHash)
│     TRANSITION INCLUDED HERE (via hash)
└─ Line 44: Submit to aggregator
   └─ Send requestId, transactionHash, authenticator

get-request.ts
├─ Line 24: Parse RequestId (from user input)
├─ Line 27: Query aggregator
│  └─ Only sends requestId (NO transition info)
└─ Line 31-52: Process response
   └─ Return merkle proof or NOT_FOUND
```

---

## Comparison: Three Scenarios

```
Scenario 1: Same secret+state+transition (repeat)
═════════════════════════════════════════════════════
RequestId₁ = RequestId₂ ✓ (same)
transactionHash₁ = transactionHash₂ ✓ (same)
signature₁ = signature₂ ✓ (same)
Result: Exact duplicate submission


Scenario 2: Same secret+state, different transition
════════════════════════════════════════════════════
RequestId₁ = RequestId₂ ✓ (same - ISSUE!)
transactionHash₁ ≠ transactionHash₂ (different)
signature₁ ≠ signature₂ (different)
Result: Ambiguous storage in aggregator


Scenario 3: Different secret, same state
══════════════════════════════════════════
RequestId₁ ≠ RequestId₂ (different publicKeys)
transactionHash₁ = transactionHash₂ (same)
signature₁ ≠ signature₂ (different keys)
Result: Two separate database entries
```

---

## FAQ Reference Guide

```
Q: "Does RequestId include transition?"
A: NO - See RequestId computation diagram

Q: "Is transition data submitted?"
A: YES (as hash) - See Data Submission diagram

Q: "Can I query by transition?"
A: NO - See Query limitations in information flow

Q: "Is this a bug?"
A: NO - See Design Philosophy in ANALYSIS.md

Q: "Why is get-request empty?"
A: See Decision Tree diagram

Q: "How do I verify my transition?"
A: See Information Flow diagram + keep original data

Q: "Same secret+state = same RequestId?"
A: YES - See Same Secret+State with Different Transitions
```

