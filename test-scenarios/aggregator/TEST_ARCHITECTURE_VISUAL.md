# Test Architecture Visual Guide

**Purpose:** Visual diagrams and flowcharts for understanding the test architecture

---

## Test Flow Architecture

### Complete Test Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         BATS Test Suite                         │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  @test "AGG-REG-001: Basic flow"                          │ │
│  │                                                            │ │
│  │  1. Setup (setup_common)                                  │ │
│  │     ├─ Create temp directories                            │ │
│  │     ├─ Generate test secrets                              │ │
│  │     └─ Initialize test metadata                           │ │
│  │                                                            │ │
│  │  2. Test Execution                                        │ │
│  │     ├─ Run register-request ──────────┐                   │ │
│  │     │                                  │                   │ │
│  │     │  ┌────────────────────────────┐ │                   │ │
│  │     │  │  CLI Command Execution     │ │                   │ │
│  │     │  │                            │ │                   │ │
│  │     │  │  node dist/index.js        │ │                   │ │
│  │     │  │    register-request        │ │                   │ │
│  │     │  │      <secret>              │ │                   │ │
│  │     │  │      <state>               │ │                   │ │
│  │     │  │      <txdata>              │ │                   │ │
│  │     │  │      --local               │ │                   │ │
│  │     │  └────────────────────────────┘ │                   │ │
│  │     │                  │               │                   │ │
│  │     │                  v               │                   │ │
│  │     │  ┌────────────────────────────┐ │                   │ │
│  │     │  │   Console Text Output      │ │                   │ │
│  │     │  │                            │ │                   │ │
│  │     │  │  Public Key: 03a1b2...     │ │                   │ │
│  │     │  │  State Hash: 7f8e9d...     │ │                   │ │
│  │     │  │  Request ID: 9a0b1c...     │ │                   │ │
│  │     │  │  ✅ Success                │ │                   │ │
│  │     │  └────────────────────────────┘ │                   │ │
│  │     │                  │               │                   │ │
│  │     └──────────────────┘               │                   │ │
│  │                                        │                   │ │
│  │  3. Output Parsing (aggregator-parsing.bash)              │ │
│  │     ├─ extract_request_id_from_console()                  │ │
│  │     ├─ extract_state_hash_from_console()                  │ │
│  │     └─ check_registration_success()                       │ │
│  │                                        │                   │ │
│  │  4. Assertions (assertions.bash)       │                   │ │
│  │     ├─ assert_success                  │                   │ │
│  │     ├─ assert_output_contains          │                   │ │
│  │     └─ is_valid_hex                    │                   │ │
│  │                                        │                   │ │
│  │  5. Retrieval Phase                    │                   │ │
│  │     ├─ Run get-request --json ────────┐                   │ │
│  │     │                                  │                   │ │
│  │     │  ┌────────────────────────────┐ │                   │ │
│  │     │  │  CLI Command Execution     │ │                   │ │
│  │     │  │                            │ │                   │ │
│  │     │  │  node dist/index.js        │ │                   │ │
│  │     │  │    get-request             │ │                   │ │
│  │     │  │      <requestId>           │ │                   │ │
│  │     │  │      --local               │ │                   │ │
│  │     │  │      --json                │ │                   │ │
│  │     │  └────────────────────────────┘ │                   │ │
│  │     │                  │               │                   │ │
│  │     │                  v               │                   │ │
│  │     │  ┌────────────────────────────┐ │                   │ │
│  │     │  │    JSON Output             │ │                   │ │
│  │     │  │                            │ │                   │ │
│  │     │  │  {                         │ │                   │ │
│  │     │  │    "status": "INCLUSION",  │ │                   │ │
│  │     │  │    "requestId": "...",     │ │                   │ │
│  │     │  │    "proof": { ... }        │ │                   │ │
│  │     │  │  }                         │ │                   │ │
│  │     │  └────────────────────────────┘ │                   │ │
│  │     │                  │               │                   │ │
│  │     └──────────────────┘               │                   │ │
│  │                                        │                   │ │
│  │  6. JSON Validation                    │                   │ │
│  │     ├─ assert_valid_json               │                   │ │
│  │     ├─ extract_status_from_json()      │                   │ │
│  │     └─ validate_inclusion_proof_json() │                   │ │
│  │                                        │                   │ │
│  │  7. Teardown (teardown_common)         │                   │ │
│  │     ├─ Clean temp files                │                   │ │
│  │     ├─ Save artifacts (if failed)      │                   │ │
│  │     └─ Report results                  │                   │ │
│  └────────────────────────────────────────┘                   │ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Command Data Flow

### register-request Data Flow

```
┌─────────────┐
│   INPUT     │
│             │
│ • Secret    │
│ • State     │
│ • TxData    │
└──────┬──────┘
       │
       v
┌─────────────────────────────────────────────────────┐
│              register-request Command                │
│                                                      │
│  Step 1: Secret → SigningService                    │
│          ├─ privateKey (derived from secret)        │
│          └─ publicKey (secp256k1)                   │
│                                                      │
│  Step 2: State → SHA256                             │
│          └─ stateHash (64 hex chars)                │
│                                                      │
│  Step 3: TxData → SHA256                            │
│          └─ transactionHash (64 hex chars)          │
│                                                      │
│  Step 4: RequestID = hash(publicKey + stateHash)    │
│          └─ requestId (64 hex chars)                │
│                                                      │
│  Step 5: Authenticator = sign(txHash)               │
│          ├─ publicKey                               │
│          ├─ signature (secp256k1 signature)         │
│          └─ stateHash                               │
│                                                      │
│  Step 6: Submit to Aggregator                       │
│          └─ AggregatorClient.submitCommitment()     │
└──────────────────────┬──────────────────────────────┘
                       │
                       v
┌─────────────────────────────────────────────────────┐
│                  Console Output                      │
│                                                      │
│  Public Key: 03a1b2c3d4e5f6...                      │
│  State Hash: 7f8e9d0c1b2a3d4e...                    │
│  Transaction Hash: 4f5e6d7c8b9a0d1e...              │
│  Request ID: 9a0b1c2d3e4f5a6b...                    │
│                                                      │
│  ✅ Commitment successfully registered              │
└──────────────────────┬──────────────────────────────┘
                       │
                       v
┌─────────────────────────────────────────────────────┐
│              Parsing Functions                       │
│                                                      │
│  extract_request_id_from_console()                  │
│  extract_state_hash_from_console()                  │
│  extract_transaction_hash_from_console()            │
│  extract_public_key_from_console()                  │
└──────────────────────┬──────────────────────────────┘
                       │
                       v
┌─────────────────────────────────────────────────────┐
│                  Test Variables                      │
│                                                      │
│  $request_id  = "9a0b1c2d..."                       │
│  $state_hash  = "7f8e9d0c..."                       │
│  $tx_hash     = "4f5e6d7c..."                       │
│  $pubkey      = "03a1b2c3..."                       │
└─────────────────────────────────────────────────────┘
```

---

### get-request Data Flow

```
┌─────────────┐
│   INPUT     │
│             │
│ RequestID   │
└──────┬──────┘
       │
       v
┌─────────────────────────────────────────────────────┐
│              get-request Command                     │
│                                                      │
│  Step 1: Parse RequestID                            │
│          └─ RequestId.fromJSON(requestIdStr)        │
│                                                      │
│  Step 2: Query Aggregator                           │
│          └─ AggregatorClient.getInclusionProof()    │
│                                                      │
│  Step 3: Receive Inclusion Proof                    │
│          ├─ InclusionProof object                   │
│          ├─ Authenticator                           │
│          ├─ MerkleTreePath                          │
│          └─ UnicityCertificate                      │
│                                                      │
│  Step 4: Format Output (--json flag)                │
│          └─ JSON serialization                      │
└──────────────────────┬──────────────────────────────┘
                       │
                       v
┌─────────────────────────────────────────────────────┐
│                  JSON Output                         │
│                                                      │
│  {                                                   │
│    "status": "INCLUSION",                           │
│    "requestId": "9a0b1c2d...",                      │
│    "endpoint": "http://127.0.0.1:3000",             │
│    "proof": {                                        │
│      "requestId": "9a0b1c2d...",                    │
│      "transactionHash": "4f5e6d7c...",              │
│      "stateHash": "7f8e9d0c...",                    │
│      "authenticator": {                             │
│        "publicKey": "03a1b2c3...",                  │
│        "signature": "a1b2c3d4...",                  │
│        "stateHash": "7f8e9d0c..."                   │
│      },                                              │
│      "merkleTreePath": {                            │
│        "root": "...",                               │
│        "steps": [...]                               │
│      },                                              │
│      "unicityCertificate": {                        │
│        "version": 1,                                │
│        "inputRecord": {...},                        │
│        "unicitySeal": {...}                         │
│      }                                               │
│    }                                                 │
│  }                                                   │
└──────────────────────┬──────────────────────────────┘
                       │
                       v
┌─────────────────────────────────────────────────────┐
│              Parsing Functions                       │
│                                                      │
│  extract_status_from_json()                         │
│  extract_request_id_from_json()                     │
│  extract_authenticator_from_json()                  │
│  validate_inclusion_proof_json()                    │
└──────────────────────┬──────────────────────────────┘
                       │
                       v
┌─────────────────────────────────────────────────────┐
│                  Validation                          │
│                                                      │
│  • Status = "INCLUSION"                             │
│  • Request ID matches                               │
│  • Authenticator present                            │
│  • Merkle path valid                                │
│  • Certificate present                              │
└─────────────────────────────────────────────────────┘
```

---

## Request ID Generation Formula

### Deterministic Request ID Computation

```
┌──────────────────────────────────────────────────────────────┐
│                   Request ID Formula                          │
│                                                               │
│   RequestID = SHA256(publicKey || stateHash)                 │
│                                                               │
│   Where:                                                      │
│   • publicKey = derived from secret (secp256k1)              │
│   • stateHash = SHA256(state_data)                           │
│   • || = concatenation                                       │
└──────────────────────────────────────────────────────────────┘

┌────────────┐
│   Secret   │  "my-secret-key"
└─────┬──────┘
      │
      │  SigningService.createFromSecret()
      v
┌────────────────────────────────┐
│         Private Key            │  (32 bytes, secret)
│         Public Key             │  (33 bytes, compressed secp256k1)
└────────┬───────────────────────┘
         │
         │  Extract publicKey
         v
      ┌──────────────┐
      │  publicKey   │  03a1b2c3d4e5f6... (66 hex chars)
      └──────┬───────┘
             │
             │
             │  ┌──────────────┐
             │  │  State Data  │  "test-state-123"
             │  └──────┬───────┘
             │         │
             │         │  SHA256
             │         v
             │  ┌──────────────┐
             │  │  stateHash   │  7f8e9d0c1b2a... (64 hex chars)
             │  └──────┬───────┘
             │         │
             └─────────┘
                   │
                   │  Concatenate
                   v
      ┌─────────────────────────┐
      │  publicKey + stateHash  │
      └────────────┬────────────┘
                   │
                   │  SHA256
                   v
      ┌─────────────────────────┐
      │      Request ID         │  9a0b1c2d3e4f... (64 hex chars)
      └─────────────────────────┘

Key Properties:
✓ Deterministic: Same inputs → Same request ID
✓ Unique: Different publicKey OR stateHash → Different request ID
✓ Independent: txData does NOT affect request ID
```

---

## Test Scenario Categories Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Test Scenario Categories                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Category 1: Registration Flow (6 tests)                        │
│  Priority: P0 (Critical)                                        │
│                                                                 │
│  AGG-REG-001 ─┐                                                 │
│  AGG-REG-002  ├─ Basic registration and retrieval              │
│  AGG-REG-003  │  Deterministic request ID generation           │
│  AGG-REG-004  │  Request ID uniqueness                         │
│  AGG-REG-005  │  Transaction data independence                 │
│  AGG-REG-006 ─┘  Inclusion proof validation                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Category 2: Request ID Determinism (4 tests)                   │
│  Priority: P0 (Critical)                                        │
│                                                                 │
│  AGG-REG-002 ─┐                                                 │
│  AGG-REG-003  ├─ Same inputs → Same ID                         │
│  AGG-REG-004  │  Different secrets → Different IDs             │
│  AGG-REG-005 ─┘  Different states → Different IDs              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Category 3: Retrieval & Verification (6 tests)                 │
│  Priority: P1 (High)                                            │
│                                                                 │
│  AGG-REG-007 ─┐                                                 │
│  AGG-REG-008  ├─ Non-existent request handling                 │
│  AGG-REG-019  │  Invalid request ID formats                    │
│  AGG-REG-020  │  Authenticator verification                    │
│  AGG-REG-033  │  Merkle path validation                        │
│  AGG-REG-035 ─┘  Certificate validation                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Category 4: Data Encoding (7 tests)                            │
│  Priority: P1 (High)                                            │
│                                                                 │
│  AGG-REG-009a ─┐                                                │
│  AGG-REG-009b  │                                                │
│  AGG-REG-009c  ├─ Unicode, JSON, quotes, escapes               │
│  AGG-REG-009d  │  Special characters in state                  │
│  AGG-REG-010   │  Special characters in txdata                 │
│  AGG-REG-011   │  Empty/minimal data                           │
│  AGG-REG-012  ─┘  Large payloads                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Category 5: Error Handling (4 tests)                           │
│  Priority: P1 (High)                                            │
│                                                                 │
│  AGG-REG-021 ─┐                                                 │
│  AGG-REG-022  ├─ Aggregator unavailable                        │
│  AGG-REG-023  │  Network timeout                               │
│  AGG-REG-024 ─┘  Malformed responses, HTTP errors              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Category 6: Advanced Operations (8 tests)                      │
│  Priority: P2 (Medium)                                          │
│                                                                 │
│  AGG-REG-013 ─┐                                                 │
│  AGG-REG-014  │                                                 │
│  AGG-REG-015  ├─ Multiple/concurrent registrations             │
│  AGG-REG-026  │  Stress testing (1000 reqs)                    │
│  AGG-REG-027  │  Endpoint selection                            │
│  AGG-REG-028  │  Output format validation                      │
│  AGG-REG-030 ─┘  JSON/verbose flags                            │
└─────────────────────────────────────────────────────────────────┘

Total: 35 Test Scenarios
Implemented: 10 (29%)
Remaining: 25 (71%)
```

---

## Helper Function Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Helper Functions                            │
└─────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│  common.bash (Core Test Infrastructure)                       │
│  ─────────────────────────────────────────────────────────────│
│                                                                │
│  • setup_common() / teardown_common()                         │
│  • create_temp_file() / create_temp_dir()                     │
│  • run_cli() / run_cli_with_secret()                          │
│  • require_aggregator()                                       │
│  • extract_json_field()                                       │
│  • generate_test_secret() / generate_test_nonce()             │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│  assertions.bash (Validation Functions)                       │
│  ─────────────────────────────────────────────────────────────│
│                                                                │
│  • assert_success() / assert_failure()                        │
│  • assert_output_contains() / assert_output_matches()         │
│  • assert_valid_json()                                        │
│  • assert_json_field_exists() / assert_json_field_equals()    │
│  • assert_equals() / assert_not_equals()                      │
│  • is_valid_hex()                                             │
│  • assert_set()                                               │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│  aggregator-parsing.bash (Output Parsing)                     │
│  ─────────────────────────────────────────────────────────────│
│                                                                │
│  Console Output Parsing:                                      │
│  • extract_request_id_from_console()                          │
│  • extract_state_hash_from_console()                          │
│  • extract_transaction_hash_from_console()                    │
│  • extract_public_key_from_console()                          │
│  • check_registration_success()                               │
│  • check_authenticator_verified()                             │
│                                                                │
│  JSON Output Parsing:                                         │
│  • extract_status_from_json()                                 │
│  • extract_request_id_from_json()                             │
│  • extract_authenticator_from_json()                          │
│  • extract_merkle_path_from_json()                            │
│  • validate_inclusion_proof_json()                            │
│  • has_proof_in_json()                                        │
│                                                                │
│  Hash Validation:                                             │
│  • compute_sha256()                                           │
│  • verify_state_hash()                                        │
│  • verify_transaction_hash()                                  │
│                                                                │
│  Assertions:                                                   │
│  • assert_valid_request_id()                                  │
│  • assert_inclusion_proof_present()                           │
│  • assert_authenticator_present()                             │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│  Usage Pattern                                                 │
│  ─────────────────────────────────────────────────────────────│
│                                                                │
│  load '../helpers/common'                                     │
│  load '../helpers/assertions'                                 │
│  load '../helpers/aggregator-parsing'                         │
│                                                                │
│  @test "My test" {                                            │
│    require_aggregator                                         │
│    run_cli "register-request ..."                             │
│    assert_success                                             │
│    request_id=$(extract_request_id_from_console "$output")   │
│    is_valid_hex "$request_id" 64                              │
│  }                                                             │
└───────────────────────────────────────────────────────────────┘
```

---

## Inclusion Proof Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    Inclusion Proof Structure                     │
└─────────────────────────────────────────────────────────────────┘

{
  "status": "INCLUSION",
  "requestId": "9a0b1c2d3e4f5a6b...",
  "endpoint": "http://127.0.0.1:3000",
  "proof": {
    │
    ├─ "requestId": "9a0b1c2d..."        ← Request identifier
    │
    ├─ "transactionHash": "4f5e6d7c..."  ← Hash of transaction data
    │
    ├─ "stateHash": "7f8e9d0c..."        ← Hash of state data
    │
    ├─ "authenticator": {                 ← Cryptographic proof
    │    │
    │    ├─ "publicKey": "03a1b2c3..."    ← Signer's public key
    │    │
    │    ├─ "signature": "a1b2c3d4..."    ← Signature over txHash
    │    │
    │    └─ "stateHash": "7f8e9d0c..."    ← State hash (again)
    │  }
    │
    ├─ "merkleTreePath": {                ← Sparse Merkle Tree path
    │    │
    │    ├─ "root": "abc123..."           ← Root hash
    │    │
    │    └─ "steps": [                    ← Path to prove inclusion
    │         {
    │           "path": 123456,           ← Path index
    │           "data": "def789..."       ← Node data
    │         },
    │         ...
    │       ]
    │  }
    │
    └─ "unicityCertificate": {            ← BFT consensus proof
         │
         ├─ "version": 1
         │
         ├─ "inputRecord": {              ← Block metadata
         │    ├─ "version": 1
         │    ├─ "roundNumber": 12345
         │    ├─ "epoch": 1
         │    ├─ "timestamp": 1699123456
         │    ├─ "hash": "..."
         │    ├─ "previousHash": "..."
         │    ├─ "summaryValue": "..."
         │    └─ "sumOfEarnedFees": 0
         │  }
         │
         └─ "unicitySeal": {              ← BFT signatures
              ├─ "version": 1
              ├─ "networkId": 1
              ├─ "rootChainRoundNumber": 12345
              ├─ "epoch": 1
              ├─ "timestamp": 1699123456
              ├─ "hash": "..."
              ├─ "previousHash": "..."
              └─ "signatures": {           ← Validator signatures
                   "node-1": "sig1...",
                   "node-2": "sig2...",
                   "node-3": "sig3..."
                 }
            }
       }
  }
}
```

---

## Test Execution Timeline

```
Timeline: Complete Test Execution
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

t=0ms    ┌─ setup()
         │  ├─ Create temp directories
         │  ├─ Generate test secrets
         │  └─ Initialize metadata
         │
t=10ms   ├─ register-request execution
         │  ├─ SigningService.createFromSecret()
         │  ├─ Hash state data (SHA256)
         │  ├─ Hash transaction data (SHA256)
         │  ├─ Compute request ID
         │  ├─ Create authenticator
         │  └─ Submit to aggregator ──────────┐
         │                                     │
         │                                     │ Network
         │                                     │ Round-trip
         │                                     │ ~50-200ms
t=150ms  │  ← Response received ←──────────────┘
         │
t=160ms  ├─ Parse console output
         │  ├─ Extract request ID
         │  ├─ Extract state hash
         │  ├─ Extract transaction hash
         │  └─ Extract public key
         │
t=170ms  ├─ Assertions
         │  ├─ assert_success
         │  ├─ assert_output_contains
         │  ├─ is_valid_hex (request ID)
         │  └─ verify_state_hash
         │
t=180ms  ├─ get-request execution
         │  ├─ Parse request ID
         │  ├─ Query aggregator ─────────────┐
         │                                    │
         │                                    │ Network
         │                                    │ Round-trip
         │                                    │ ~50-200ms
t=330ms  │  ← Response received ←─────────────┘
         │
t=340ms  ├─ Parse JSON output
         │  ├─ extract_status_from_json
         │  ├─ extract_request_id_from_json
         │  └─ validate_inclusion_proof_json
         │
t=350ms  ├─ Validate proof structure
         │  ├─ Check authenticator
         │  ├─ Check merkle path
         │  └─ Check certificate
         │
t=360ms  ├─ Save artifacts
         │  ├─ Save register output
         │  └─ Save get-request response
         │
t=370ms  └─ teardown()
            ├─ Calculate duration
            ├─ Clean temp files
            └─ Report results

Total: ~370ms per test
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Error Handling Flow                         │
└─────────────────────────────────────────────────────────────────┘

Test Execution
      │
      v
┌─────────────────┐
│  Run Command    │
└────────┬────────┘
         │
         ├─ Success (exit code 0)
         │      │
         │      v
         │  ┌────────────────────┐
         │  │ Parse Output       │
         │  │  • Check success   │
         │  │    indicators      │
         │  │  • Extract values  │
         │  │  • Validate format │
         │  └─────────┬──────────┘
         │            │
         │            v
         │  ┌────────────────────┐
         │  │ Assertions         │
         │  │  Pass? ─────────── Yes ─→ Test PASS ✓
         │  │    │
         │  │    No
         │  │    │
         │  │    v
         │  │  Test FAIL ✗
         │  │  • Save artifacts
         │  │  • Report error
         │  └────────────────────┘
         │
         └─ Failure (exit code != 0)
                │
                v
         ┌────────────────────┐
         │ Check Error Type   │
         │                    │
         │ • Expected error?  │
         │   (e.g., invalid   │
         │    input test)     │
         │   → PASS if        │
         │     intentional    │
         │                    │
         │ • Unexpected error?│
         │   → FAIL           │
         │   • Save output    │
         │   • Log details    │
         └────────────────────┘

Special Cases:

1. Aggregator Unavailable
   ├─ require_aggregator() fails
   ├─ Test FAILS immediately
   └─ Message: "Aggregator not available"

2. JSON Parse Error
   ├─ assert_valid_json() fails
   ├─ Save malformed output
   └─ Test FAILS

3. Network Timeout
   ├─ Command times out (default 30s)
   ├─ Exit code: timeout
   └─ Test FAILS with timeout error

4. Non-Existent Request
   ├─ Command succeeds
   ├─ Status: "NOT_FOUND"
   └─ Test PASSES (expected behavior)
```

---

**End of Visual Guide**
