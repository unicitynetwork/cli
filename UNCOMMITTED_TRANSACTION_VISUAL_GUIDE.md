# Uncommitted Transaction - Visual Reference Guide

## The Core Problem: Who Signs What?

```
SENDER (Alice)                          RECIPIENT (Bob)
└─ Has secret: "alice-secret"          └─ Has secret: "bob-secret"
   └─ Private Key: SK_alice               └─ Private Key: SK_bob
   └─ Public Key: PK_alice                └─ Public Key: PK_bob

TOKEN BEFORE TRANSFER:
├─ State Predicate: Contains PK_alice
└─ State Hash: H_state

COMMITMENT SIGNATURE (CRITICAL):
├─ Data to sign: (sourceState, recipient, salt, ...)
├─ Signed by: SK_alice  ← ONLY ALICE CAN DO THIS
├─ Verification: Verify(signature, data, PK_alice) = true ✓
└─ Cannot verify with PK_bob: Verify(signature, data, PK_bob) = false ✗

OFFLINE TRANSFER REQUIREMENT:
├─ Alice creates commitment and signs it
├─ Alice stores signature in file
├─ Alice sends file to Bob
├─ Bob submits file WITHOUT recreating signature
└─ Aggregator verifies signature matches PK_alice in state predicate
```

## Current (Broken) Code Path

```
┌─────────────────────────────────────────────────────────────┐
│ ALICE'S SIDE (send-token --offline)                         │
├─────────────────────────────────────────────────────────────┤
│ 1. Load token with state predicate: PK_alice                │
│ 2. Get secret "alice-secret"                                │
│ 3. Create signingService_alice                              │
│ 4. Create TransferCommitment:                               │
│    ├─ commitment.signature = Sign(data, SK_alice)           │
│    └─ commitment.publicKey = PK_alice                       │
│ 5. Save to file:                                            │
│    ├─ Store transfer data ✓                                 │
│    └─ DO NOT store commitment.signature ✗ BUG!             │
│ 6. Clear memory (forget SK_alice)                           │
│ 7. Send file to Bob                                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
              (file passed to recipient)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ BOB'S SIDE (receive-token)                                  │
├─────────────────────────────────────────────────────────────┤
│ 1. Load file with transfer data                             │
│ 2. Detect NEEDS_RESOLUTION scenario (no authenticator)      │
│ 3. Get secret "bob-secret"                                  │
│ 4. Create signingService_bob                                │
│ 5. Try to recreate TransferCommitment:                      │
│    ├─ new_commitment.signature = Sign(data, SK_bob) ✗ BUG! │
│    └─ new_commitment.publicKey = PK_bob ✗ WRONG KEY!       │
│ 6. Submit to aggregator                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ AGGREGATOR SIDE                                             │
├─────────────────────────────────────────────────────────────┤
│ 1. Receive commitment:                                      │
│    ├─ Signature: Sign(data, SK_bob)                         │
│    └─ Public Key: PK_bob                                    │
│ 2. Load source state:                                       │
│    └─ Predicate: Contains PK_alice                          │
│ 3. Verify signature:                                        │
│    ├─ Expected: PK_alice (from source state predicate)     │
│    ├─ Got: PK_bob (from commitment)                         │
│    └─ Result: MISMATCH! ✗                                   │
│ 4. Return error:                                            │
│    "Authenticator does not match source state predicate"    │
└─────────────────────────────────────────────────────────────┘
```

## Required (Correct) Code Path

```
┌─────────────────────────────────────────────────────────────┐
│ ALICE'S SIDE (send-token --offline) - FIXED                │
├─────────────────────────────────────────────────────────────┤
│ 1. Load token with state predicate: PK_alice                │
│ 2. Get secret "alice-secret"                                │
│ 3. Create signingService_alice                              │
│ 4. Create TransferCommitment:                               │
│    ├─ commitment.signature = Sign(data, SK_alice)           │
│    └─ commitment.publicKey = PK_alice                       │
│ 5. Extract commitment details ← FIXED!                      │
│    ├─ commitmentData.signature = commitment.signature       │
│    ├─ commitmentData.publicKey = commitment.publicKey       │
│    └─ commitmentData.requestId = commitment.requestId       │
│ 6. Save to file:                                            │
│    ├─ Store transfer data ✓                                 │
│    ├─ Store commitment data ✓ FIXED!                        │
│    └─ Proof of Alice's authorization travels with file      │
│ 7. Clear memory (forget SK_alice)                           │
│ 8. Send file to Bob                                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
              (file passed to recipient)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ BOB'S SIDE (receive-token) - FIXED                         │
├─────────────────────────────────────────────────────────────┤
│ 1. Load file with transfer data and commitment              │
│ 2. Detect NEEDS_RESOLUTION scenario (no authenticator)      │
│ 3. Get secret "bob-secret"                                  │
│ 4. Create signingService_bob (NOT USED YET)                 │
│ 5. Extract stored commitment data ← FIXED!                  │
│    ├─ Extract: commitment.signature (from Alice)            │
│    ├─ Extract: commitment.publicKey = PK_alice              │
│    └─ Extract: commitment.requestId                         │
│ 6. Reconstruct TransferCommitment:                          │
│    ├─ Use stored signature (Alice's) ✓ FIXED!              │
│    └─ Use stored public key (PK_alice) ✓ FIXED!            │
│ 7. Submit to aggregator                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ AGGREGATOR SIDE - SUCCESS                                  │
├─────────────────────────────────────────────────────────────┤
│ 1. Receive commitment:                                      │
│    ├─ Signature: Sign(data, SK_alice) ← Stored by Alice    │
│    └─ Public Key: PK_alice ← Stored by Alice               │
│ 2. Load source state:                                       │
│    └─ Predicate: Contains PK_alice                          │
│ 3. Verify signature:                                        │
│    ├─ Expected: PK_alice (from source state predicate)     │
│    ├─ Got: PK_alice (from commitment) ✓ CORRECT!           │
│    └─ Result: MATCH! ✓                                      │
│ 4. Create authenticator (sign with aggregator's key)        │
│ 5. Return proof with authenticator                          │
└─────────────────────────────────────────────────────────────┘
```

## Data Structure Before and After

### File Structure - Before (Broken)

```json
{
  "version": "2.0",
  "state": { /* sender's state - unchanged */ },
  "genesis": { /* token genesis */ },
  "transactions": [
    {
      "type": "transfer",
      "data": {
        "sourceState": { /* alice's state before transfer */ },
        "recipient": "DIRECT://bob-address",
        "salt": "abc123...",
        "recipientDataHash": null,
        "message": null
      }
      /* NO PROOF (uncommitted) */
      /* NO COMMITMENT SIGNATURE (BUG!) */
    }
  ],
  "nametags": [],
  "status": "PENDING"
}
```

**Problem:** When Bob tries to submit, he can't prove Alice authorized the transfer.

### File Structure - After (Correct)

```json
{
  "version": "2.0",
  "state": { /* sender's state - unchanged */ },
  "genesis": { /* token genesis */ },
  "transactions": [
    {
      "type": "transfer",
      "data": {
        "sourceState": { /* alice's state before transfer */ },
        "recipient": "DIRECT://bob-address",
        "salt": "abc123...",
        "recipientDataHash": null,
        "message": null
      },
      "commitment": {
        "requestId": "hash(alice-pubkey + alice-state-hash)",
        "signature": "abcd1234ef5678...",    /* Alice's signature! */
        "publicKey": "5678efgh1234abcd..."   /* Alice's public key */
      }
      /* NO PROOF YET (uncommitted) */
      /* HAS COMMITMENT SIGNATURE (FIXED!) */
    }
  ],
  "nametags": [],
  "status": "PENDING"
}
```

**Solution:** Bob can now prove Alice authorized the transfer (her signature is stored).

## The Cryptographic Binding

```
TRANSFER AUTHORIZATION CHAIN
═════════════════════════════════════════════════════════════

Step 1: Sender (Alice) Creates Commitment
┌──────────────────────────────────────────┐
│ Data: (sourceState, recipient, salt)     │
│ + Alice's Secret (SK_alice)               │
│ ↓                                         │
│ SHA256(data) = hash_value                 │
│ Signature = RSA_Sign(hash_value, SK_alice)│
│ ↓                                         │
│ commitment.signature = Signature          │
│ commitment.publicKey = PK_alice           │
└──────────────────────────────────────────┘

Step 2: Aggregator Verifies Commitment
┌──────────────────────────────────────────┐
│ Received: (commitment.signature,          │
│            commitment.publicKey = PK_alice)│
│ Source State: predicate contains PK_alice │
│ ↓                                         │
│ Verify(signature, data, PK_alice)         │
│ ↓                                         │
│ If true: Signature is valid               │
│ If false: Signature is invalid            │
│                                           │
│ CRITICAL: Can only verify with PK_alice! │
│           Cannot verify with PK_bob       │
│           Even though data is the same    │
└──────────────────────────────────────────┘

KEY INSIGHT:
═══════════════════════════════════════════
Once data is signed with SK_alice, ONLY
PK_alice can verify it. This cryptographic
binding CANNOT be changed by anyone else,
including Bob. This is what makes the
authorization proof secure.
```

## Why Offline Transfers Need Stored Signatures

```
SCENARIO 1: Online Transfer (Works Without Stored Signature)
═══════════════════════════════════════════════════════════════
Alice sends --submit-now (or without --offline):
  1. Alice creates commitment (signed with SK_alice)
  2. Alice submits directly to aggregator
  3. Aggregator verifies signature: PK_alice matches ✓
  4. Aggregator creates proof
  5. No need to store signature (proof is immediate)

SCENARIO 2: Offline Transfer (REQUIRES Stored Signature)
═══════════════════════════════════════════════════════════════
Alice sends --offline:
  1. Alice creates commitment (signed with SK_alice)
  2. Alice stores in file (KEY DIFFERENCE!)
  3. Alice sends file to Bob
  4. Bob submits (without Alice present)
  5. Bob needs Alice's signature to prove authorization
  6. Without stored signature, Bob can't prove it (BUG!)
  7. Bob might try to sign with SK_bob, but that doesn't work
  8. Aggregator rejects: wrong key!

SOLUTION: Store Alice's signature in file
═══════════════════════════════════════════════════════════════
  1. Alice creates commitment (signed with SK_alice)
  2. Alice STORES signature in file
  3. Alice sends file to Bob
  4. Bob submits file WITH stored signature
  5. Aggregator verifies signature: PK_alice matches ✓
  6. Aggregator creates proof
  7. Success!
```

## The Three Keys in Offline Transfer

```
Three Different Keys Involved:
═══════════════════════════════════════════════════════════════

┌─────────────────────────┐
│ SK_alice (sender)       │
│ ├─ Used to create       │
│ │  commitment signature  │
│ ├─ STORED in file ✓     │
│ │  (public key only)     │
│ └─ Used by aggregator   │
│    to verify            │
└─────────────────────────┘

┌─────────────────────────┐
│ SK_bob (recipient)      │
│ ├─ Used to create       │
│ │  recipient predicate   │
│ ├─ NOT used for         │
│ │  commitment ✓         │
│ └─ Only used to create  │
│    new state predicate  │
└─────────────────────────┘

┌─────────────────────────┐
│ SK_aggregator           │
│ ├─ Used to create       │
│ │  authenticator        │
│ ├─ NOT stored in file   │
│ │  (this is aggregator  │
│ │   exclusive)          │
│ └─ Part of proof        │
└─────────────────────────┘

Common Mistake: Using SK_bob for commitment signature
════════════════════════════════════════════════════
This is WRONG because:
  - Commitment proves SOURCE authorization
  - Source state predicate has PK_alice
  - Signature with SK_bob doesn't prove anything
  - Verification fails: PK_alice ≠ PK_bob
```

## Implementation Locations Quick Reference

```
SEND-TOKEN (Sender Creates and Stores)
═════════════════════════════════════════════════════════════
Line 365: Create TransferCommitment
          commitment.signature ← SK_alice
          commitment.publicKey ← PK_alice

Line 358-365: [NEED TO ADD]
              Extract commitment details
              commitmentData.signature = commitment.signature
              commitmentData.publicKey = commitment.publicKey

Line 500: Create uncommitted transaction
          [NEED TO ADD]
          commitment: commitmentData

RECEIVE-TOKEN (Recipient Uses Stored Signature)
═════════════════════════════════════════════════════════════
Line 527: Get Bob's secret
          signingService_bob ← Not used for commitment!

Line 603: [NEED TO CHANGE]
          Don't create new commitment
          Use stored commitment instead
          commitment = lastTx.commitment
          commitment.signature ← Alice's signature (stored)
          commitment.publicKey ← Alice's public key (stored)

AGGREGATOR (Verifies Signature)
═════════════════════════════════════════════════════════════
Verify signature:
  commitment.publicKey (PK_alice from file)
  == sourceState.predicate.publicKey (PK_alice from state)
  → Match! ✓ Transfer authorized
```

## Quick Decision Tree

```
When building a commitment for offline transfer:

┌─ Do I have the source token owner's secret? ─┐
│                                              │
├─ YES: I'm the sender ──→ Sign with my key ──┐
│                                              │
└─ NO: I'm the recipient ───────────┐          │
                                    │         │
                       ┌─ Has commitment ────┐
                       │    signature stored? │
                       │                     │
                       ├─ YES: Use it ─────→│
                       │                     │
                       └─ NO: ─────┐         │
                           Error!  │         │
                           Cannot  └────────→│
                           sign    Cannot recreate
                           with    signature with
                           unknown wrong key!
                           key!

KEY RULE: Only the source token owner can sign!
════════════════════════════════════════════════
```

## Summary Diagram

```
┌────────────────────────────────────────────────────────────┐
│ THE FIX IN ONE PICTURE                                     │
└────────────────────────────────────────────────────────────┘

BEFORE (BROKEN):
────────────────────
Alice: Create commitment with SK_alice
       ✓ commitment.signature = Sign(data, SK_alice)
       ✗ DO NOT STORE IT
       Send file to Bob

Bob:   ✗ Recreate commitment with SK_bob
       ✗ commit.signature = Sign(data, SK_bob)
       ✗ Submit to aggregator

Aggregator: ✗ Verify: SK_bob ≠ PK_alice in predicate
            ✗ FAIL


AFTER (FIXED):
────────────────────
Alice: Create commitment with SK_alice
       ✓ commitment.signature = Sign(data, SK_alice)
       ✓ STORE IT IN FILE
       Send file to Bob

Bob:   ✓ Extract stored commitment from file
       ✓ commitment.signature = Alice's signature (from file)
       ✓ Submit to aggregator

Aggregator: ✓ Verify: SK_alice = PK_alice in predicate
            ✓ SUCCESS!
```

This visual guide explains why the fix works: the sender's signature must be stored because the recipient can't recreate it without the sender's secret.
