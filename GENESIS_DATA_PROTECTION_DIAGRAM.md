# Genesis Data Protection: Visual Explanation

## The Cryptographic Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                    MINT TRANSACTION DATA                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Field 1: tokenId          = "4ccc2f19f165..."            │ │
│  │ Field 2: tokenType        = "0x0001" (fungible)          │ │
│  │ Field 3: tokenData        = {"name":"My NFT"}  ← CRITICAL│ │
│  │ Field 4: coinData         = {amount: 1000}     ← CRITICAL│ │
│  │ Field 5: recipient        = "DIRECT://0000abc..."        │ │
│  │ Field 6: salt             = "1eaadb6de972..."            │ │
│  │ Field 7: recipientDataHash = null                        │ │
│  │ Field 8: reason           = null                         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│                            ↓ toCBOR()                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │         CBOR Byte Array (all 8 fields encoded)           │ │
│  │  [0x88, 0x58, 0x20, 0x4c, 0xcc, 0x2f, 0x19, ...]        │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                     calculateHash()
                              ↓
                         SHA256()
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      TRANSACTION HASH                           │
│                                                                 │
│  0x00001d11ecf310797b673f1442532500ffd21e7f67116b9a...        │
│                                                                 │
│  ✓ Covers ALL 8 fields (including tokenData and coinData)      │
│  ✓ Changing ANY field changes this hash                        │
│  ✓ Cryptographically binds data to proof                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                   Included in Commitment
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       AUTHENTICATOR                             │
│                                                                 │
│  signature = Sign(transactionHash || stateHash)                │
│  publicKey = 0x03ff59ce1e389270f10cdde50d4a87e4b029...         │
│                                                                 │
│  ✓ Signature covers transactionHash                            │
│  ✓ Cannot be reused with different data                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                   Submitted to Aggregator
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     INCLUSION PROOF                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ authenticator:    (signature + publicKey)                │ │
│  │ transactionHash:  0x00001d11ecf310797b673f144253...      │ │
│  │ merkleTreePath:   (proof of inclusion in SMT)            │ │
│  │ unicitySeal:      (BFT consensus seal)                   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ✓ Stored in TXF file                                          │
│  ✓ Bound to specific transaction data                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Attack Scenario: Attempt to Modify Token Data

```
┌─────────────────────────────────────────────────────────────────┐
│                    ATTACKER'S ACTION                            │
│                                                                 │
│  Opens TXF file and modifies:                                  │
│  tokenData: {"name":"My NFT"} → {"name":"HACKED NFT"}         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Victim runs verification
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  VERIFICATION PROCESS                           │
│                                                                 │
│  Step 1: Load modified token from TXF                          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ tokenData = {"name":"HACKED NFT"}  ← TAMPERED            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 2: Recalculate transaction hash                          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ calculatedHash = SHA256(CBOR([                           │ │
│  │   tokenId,                                               │ │
│  │   tokenType,                                             │ │
│  │   "HACKED NFT",  ← NEW DATA                              │ │
│  │   coinData,                                              │ │
│  │   ...                                                    │ │
│  │ ]))                                                      │ │
│  │ = 0x0000be69cf92feda9394...  ← DIFFERENT HASH            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 3: Extract stored hash from proof                        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ storedHash = inclusionProof.transactionHash              │ │
│  │ = 0x00001d11ecf310797b67...  ← ORIGINAL HASH             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Step 4: Compare hashes                                        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ calculatedHash: 0x0000be69cf92feda9394...                │ │
│  │ storedHash:     0x00001d11ecf310797b67...                │ │
│  │                                                          │ │
│  │ Match? ❌ NO                                              │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                        RESULT
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  ❌ TAMPERING DETECTED                           │
│                                                                 │
│  Error: Genesis data has been TAMPERED!                        │
│  Expected hash: 0x00001d11ecf310797b67...                      │
│  Actual hash:   0x0000be69cf92feda9394...                      │
│  Token is INVALID - REJECT this token!                         │
│                                                                 │
│  Exit code: 1                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why Tampering is Impossible

```
┌─────────────────────────────────────────────────────────────────┐
│             WHAT ATTACKER WOULD NEED TO DO                      │
│                                                                 │
│  To successfully tamper with tokenData or coinData:            │
│                                                                 │
│  1. Modify the data in TXF file                                │
│     ✓ Easy (just edit JSON)                                    │
│                                                                 │
│  2. Recalculate matching transaction hash                      │
│     ❌ IMPOSSIBLE without changing ALL proof data               │
│                                                                 │
│  3. Update authenticator signature                             │
│     ❌ IMPOSSIBLE without private key                           │
│                                                                 │
│  4. Regenerate Merkle tree path                                │
│     ❌ IMPOSSIBLE without aggregator control                    │
│                                                                 │
│  5. Forge Unicity seal                                         │
│     ❌ IMPOSSIBLE without BFT consensus                         │
│                                                                 │
│  Conclusion: Attacker can change data, but cannot update       │
│              the cryptographic proof. Tampering is ALWAYS      │
│              detected during verification.                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Field-by-Field Protection

```
MintTransactionData (8 fields)
├── Field 1: tokenId
│   └── Protection: Hash covers field → Authenticator signs hash
│
├── Field 2: tokenType
│   └── Protection: Hash covers field → Authenticator signs hash
│
├── Field 3: tokenData ← YOUR CONCERN
│   ├── Content: Custom metadata (e.g., {"name":"My NFT"})
│   ├── CBOR: Serialized as byte string in position 3
│   └── Protection:
│       1. Included in CBOR array
│       2. Hashed via SHA256
│       3. Hash signed by authenticator
│       4. Signature verified against stored proof
│       Result: ✓ FULLY PROTECTED
│
├── Field 4: coinData ← YOUR CONCERN
│   ├── Content: TokenCoinData {coinId, amount}
│   ├── Example: {amount: 1000, coinId: "b3df752a5fc9..."}
│   ├── CBOR: Serialized via coinData.toCBOR() in position 4
│   └── Protection:
│       1. Full object (including amount) in CBOR array
│       2. Hashed via SHA256
│       3. Hash signed by authenticator
│       4. Signature verified against stored proof
│       Result: ✓ FULLY PROTECTED
│
├── Field 5: recipient
│   └── Protection: Hash covers field → Authenticator signs hash
│
├── Field 6: salt
│   └── Protection: Hash covers field → Authenticator signs hash
│
├── Field 7: recipientDataHash
│   └── Protection: Hash covers field → Authenticator signs hash
│
└── Field 8: reason
    └── Protection: Hash covers field → Authenticator signs hash
```

---

## Verification Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOAD TOKEN FROM TXF                          │
│                                                                 │
│  const token = await Token.fromJSON(txfJson);                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              RECALCULATE TRANSACTION HASH                       │
│                                                                 │
│  const calculatedHash = await token.genesis.data.calculateHash();│
│                                                                 │
│  This recalculates: SHA256(CBOR([all 8 fields]))               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│            EXTRACT STORED HASH FROM PROOF                       │
│                                                                 │
│  const storedHash = token.genesis.inclusionProof?.transactionHash;│
│                                                                 │
│  This is the hash that was calculated during minting           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    COMPARE HASHES                               │
│                                                                 │
│  if (calculatedHash.equals(storedHash)) {                      │
│    ✓ Data is intact (not tampered)                             │
│  } else {                                                      │
│    ❌ Data has been TAMPERED - REJECT!                          │
│  }                                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mathematical Proof of Security

```
Given:
  - T = MintTransactionData (8 fields)
  - H = SHA256(CBOR(T))  // transaction hash
  - S = Sign(H || stateHash)  // authenticator signature
  - P = InclusionProof containing H and S

Attack: Modify T.tokenData from D1 to D2

Result:
  - T' = MintTransactionData with tokenData = D2
  - H' = SHA256(CBOR(T'))  // new hash
  - H' ≠ H  (because D2 ≠ D1 and SHA256 is collision-resistant)
  - Verification: H' == P.transactionHash?
  - H' == H?  NO
  - Therefore: Verification FAILS

Conclusion: Without ability to forge signature S or update proof P,
            attacker cannot successfully tamper with any field in T.
```

---

## Real-World Example

```
Original Token (alice-token.txf):
┌─────────────────────────────────────────────────────────────────┐
│ tokenData: {"name":"Test NFT"}                                  │
│ transactionHash: 00001d11ecf310797b673f1442532500ffd21e7f...   │
│                                                                 │
│ Verification: ✓ PASS                                            │
│   calculatedHash: 00001d11ecf310797b67...                       │
│   storedHash:     00001d11ecf310797b67...                       │
│   Match: YES                                                    │
└─────────────────────────────────────────────────────────────────┘

Tampered Token (modified alice-token.txf):
┌─────────────────────────────────────────────────────────────────┐
│ tokenData: {"name":"HACKED NFT"}  ← MODIFIED                    │
│ transactionHash: 00001d11ecf310797b673f1442532500ffd21e7f...   │
│                  ↑ UNCHANGED (attacker can't update this)       │
│                                                                 │
│ Verification: ❌ FAIL                                            │
│   calculatedHash: 0000be69cf92feda9394...  ← DIFFERENT          │
│   storedHash:     00001d11ecf310797b67...                       │
│   Match: NO                                                     │
│   Result: TAMPERING DETECTED                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary Diagram

```
                    IS IT PROTECTED?
                           │
                           ▼
        ┌──────────────────┴──────────────────┐
        │                                     │
    tokenData                            coinData
        │                                     │
        ▼                                     ▼
   Field #3 in CBOR                     Field #4 in CBOR
        │                                     │
        └──────────────┬──────────────────────┘
                       ▼
              SHA256(CBOR([all fields]))
                       │
                       ▼
                 transactionHash
                       │
                       ▼
              Authenticator.sign(transactionHash)
                       │
                       ▼
           Stored in InclusionProof
                       │
                       ▼
              Verified on token load
                       │
                       ▼
           ┌───────────┴───────────┐
           │                       │
           ▼                       ▼
    Hash matches              Hash mismatch
           │                       │
           ▼                       ▼
      ✓ ACCEPT                 ❌ REJECT

        ANSWER: YES, FULLY PROTECTED
```

---

**Conclusion**: Both `tokenData` and `coinData` (including amounts) are cryptographically protected by the transaction hash. Any tampering is automatically detected during verification.

**Files**: 
- Full analysis: `/home/vrogojin/cli/TRANSACTION_HASH_SECURITY_ANALYSIS.md`
- Quick reference: `/home/vrogojin/cli/DATA_INTEGRITY_QUICK_REFERENCE.md`
- Test script: `/home/vrogojin/cli/test-data-integrity.mjs`
