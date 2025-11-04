# Unicity Token CLI - Comprehensive Test Scenarios

## Document Overview

This document provides a complete enumeration of test scenarios for the Unicity token CLI application. It covers all command combinations, token types, address types, transaction flows, and ownership verification scenarios.

**Version**: 1.0
**Date**: 2025-11-03
**CLI Version**: Based on codebase analysis

---

## Table of Contents

1. [Test Organization](#test-organization)
2. [Test Environment Setup](#test-environment-setup)
3. [Test Matrix Overview](#test-matrix-overview)
4. [Command Test Suites](#command-test-suites)
5. [Integration Test Scenarios](#integration-test-scenarios)
6. [Edge Cases and Error Scenarios](#edge-cases-and-error-scenarios)
7. [Performance and Load Tests](#performance-and-load-tests)
8. [Test Execution Strategy](#test-execution-strategy)
9. [Success Criteria](#success-criteria)

---

## Test Organization

### Test Categories

1. **Unit Tests**: Individual command functionality
2. **Integration Tests**: Multi-command workflows
3. **End-to-End Tests**: Complete user scenarios
4. **Negative Tests**: Error handling and validation
5. **Performance Tests**: Network timeouts, large data
6. **Security Tests**: Secret handling, file sanitization

### Test Priorities

- **P0 (Critical)**: Core functionality - must pass before release
- **P1 (High)**: Important scenarios - should pass
- **P2 (Medium)**: Edge cases - nice to have
- **P3 (Low)**: Performance/optimization tests

---

## Test Environment Setup

### Prerequisites

```bash
# Install dependencies
npm install

# Build project
npm run build

# Environment variables
export SECRET="test-secret-phrase"
export TRUSTBASE_PATH="./trustbase.json"
```

### Network Modes

1. **Local**: `--local` (http://127.0.0.1:3000)
2. **Production**: `--production` (https://gateway.unicity.network)
3. **Custom**: `-e <endpoint>`

### Test Data Preparation

```bash
# Create test secrets
TEST_SECRET_ALICE="alice-test-secret-12345"
TEST_SECRET_BOB="bob-test-secret-67890"
TEST_SECRET_CAROL="carol-test-secret-abcdef"

# Generate test addresses
SECRET="$TEST_SECRET_ALICE" npm run gen-address > alice_address.json
SECRET="$TEST_SECRET_BOB" npm run gen-address > bob_address.json
SECRET="$TEST_SECRET_CAROL" npm run gen-address > carol_address.json
```

---

## Test Matrix Overview

### Dimensions

| Dimension | Options | Count |
|-----------|---------|-------|
| **Token Types** | NFT, UCT, USDU, EURU, ALPHA, Custom | 6 |
| **Address Types** | Unmasked, Masked | 2 |
| **Commands** | gen-address, mint-token, send-token, receive-token, verify-token | 5 |
| **Transfer Patterns** | Offline (Pattern A), Submit-Now (Pattern B) | 2 |
| **Network Modes** | Local, Production, Custom | 3 |
| **Ownership Scenarios** | Current, Outdated, Pending, Confirmed | 4 |

### Total Combinations

- **Basic Commands**: 5 commands × 6 token types × 2 address types = **60 tests**
- **Transfer Flows**: 6 token types × 2 address types × 2 patterns = **24 tests**
- **Multi-hop Transfers**: 6 token types × 2-5 hops = **24 tests**
- **Postponed Commitments**: 6 token types × 1-3 chains = **18 tests**
- **Error Scenarios**: ~**50 tests**
- **Total Estimated**: **~176 test scenarios**

---

## Command Test Suites

### 1. gen-address Command Tests

**Test Suite ID**: `GEN_ADDR`
**Priority**: P0 (Critical)

#### GEN_ADDR-001: Generate Unmasked Address with Default Preset (UCT)

**Description**: Generate a reusable address with default UCT token type

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test-secret-001" npm run gen-address
```

**Expected Results**:
- JSON output with `type: "unmasked"`
- Address starts with `DIRECT://0000`
- `tokenType` matches UCT preset: `455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89`
- `tokenTypeInfo.preset` is "uct"
- `tokenTypeInfo.name` is "unicity"
- Console shows: "✅ IMPORTANT: This is an UNMASKED (reusable) address."

**Cleanup**: None required

---

#### GEN_ADDR-002: Generate Masked Address with NFT Preset

**Description**: Generate a one-time address for NFT token type

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test-secret-002" npm run gen-address -- --preset nft -n "test-nonce-nft"
```

**Expected Results**:
- JSON output with `type: "masked"`
- Address starts with `DIRECT://0001` (engine ID 1)
- `tokenType` matches NFT preset: `f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509`
- `nonce` field present in output (32-byte hex)
- Console shows: "⚠️ IMPORTANT: This is a MASKED (single-use) address."

**Cleanup**: None required

---

#### GEN_ADDR-003 through GEN_ADDR-012: All Preset Token Types

Test each preset with both masked and unmasked predicates:

| Test ID | Preset | Masked | Expected Token Type |
|---------|--------|--------|---------------------|
| GEN_ADDR-003 | nft | No | f8aa13834268d293... |
| GEN_ADDR-004 | nft | Yes | f8aa13834268d293... |
| GEN_ADDR-005 | uct | No | 455ad8720656b08e... |
| GEN_ADDR-006 | uct | Yes | 455ad8720656b08e... |
| GEN_ADDR-007 | alpha | No | 455ad8720656b08e... (same as UCT) |
| GEN_ADDR-008 | alpha | Yes | 455ad8720656b08e... |
| GEN_ADDR-009 | usdu | No | 8f0f3d7a5e7297be... |
| GEN_ADDR-010 | usdu | Yes | 8f0f3d7a5e7297be... |
| GEN_ADDR-011 | euru | No | 5e160d5e9fdbb03b... |
| GEN_ADDR-012 | euru | Yes | 5e160d5e9fdbb03b... |

---

#### GEN_ADDR-013: Custom Token Type (64-char Hex)

**Description**: Generate address with custom hex token type

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test-secret-013" npm run gen-address -- \
  -y "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
```

**Expected Results**:
- Address generated successfully
- `tokenType` matches input exactly
- No `tokenTypeInfo` field (custom type)
- Console shows "Using custom TokenType: 1234567890abcdef..."

**Cleanup**: None required

---

#### GEN_ADDR-014: Custom Token Type (Text, Hashed)

**Description**: Generate address with text that gets hashed to token type

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test-secret-014" npm run gen-address -- -y "my-custom-token-type"
```

**Expected Results**:
- Address generated successfully
- `tokenType` is SHA256 hash of "my-custom-token-type"
- Console shows "Hashed custom token type ... to: <hash>"
- Hash is deterministic (same input produces same hash)

**Cleanup**: None required

---

#### GEN_ADDR-015: Nonce Processing (64-char Hex)

**Description**: Use explicit 64-char hex nonce

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test-secret-015" npm run gen-address -- \
  -n "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
```

**Expected Results**:
- Masked address generated
- `nonce` in output matches input exactly
- Console shows "Using nonce: fedcba9876543210..."

**Cleanup**: None required

---

#### GEN_ADDR-016: Nonce Processing (Text, Hashed)

**Description**: Use text nonce that gets hashed

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test-secret-016" npm run gen-address -- -n "my-nonce-text"
```

**Expected Results**:
- Masked address generated
- `nonce` is SHA256 hash of "my-nonce-text"
- Console shows "Hashed nonce input to: <hash>"

**Cleanup**: None required

---

### 2. mint-token Command Tests

**Test Suite ID**: `MINT_TOKEN`
**Priority**: P0 (Critical)

#### MINT_TOKEN-001: Mint NFT with Default Settings

**Description**: Mint an NFT with minimal options

**Prerequisites**: Network connectivity to aggregator

**Execution Steps**:
```bash
SECRET="test-secret-mint-001" npm run mint-token -- \
  --preset nft \
  --save
```

**Expected Results**:
- Token file created with pattern `YYYYMMDD_HHMMSS_timestamp_address.txf`
- TXF version is "2.0"
- `genesis` section with mint transaction
- `state` section with unmasked predicate (default)
- `transactions` array is empty
- Status implicitly CONFIRMED
- Console shows all 9 steps complete
- Inclusion proof received and validated
- Token ID generated (random if not specified)

**Cleanup**: Remove generated `.txf` file

---

#### MINT_TOKEN-002: Mint NFT with Custom Token Data (JSON)

**Description**: Mint NFT with JSON metadata

**Prerequisites**: Network connectivity

**Execution Steps**:
```bash
SECRET="test-secret-mint-002" npm run mint-token -- \
  --preset nft \
  -d '{"name":"Test NFT","description":"Test Description","image":"ipfs://Qm..."}' \
  --save
```

**Expected Results**:
- Token created successfully
- `state.data` contains the JSON (hex-encoded)
- When decoded, matches original JSON structure
- Console shows "Serialized JSON token data"

**Cleanup**: Remove generated `.txf` file

---

#### MINT_TOKEN-003: Mint NFT with Custom Token Data (Plain Text)

**Description**: Mint NFT with plain text data

**Prerequisites**: Network connectivity

**Execution Steps**:
```bash
SECRET="test-secret-mint-003" npm run mint-token -- \
  --preset nft \
  -d "This is plain text token data" \
  --save
```

**Expected Results**:
- Token created successfully
- `state.data` contains text (hex-encoded)
- When decoded, matches original text
- Console shows "Serialized text token data"

**Cleanup**: Remove generated `.txf` file

---

#### MINT_TOKEN-004: Mint Fungible Token (UCT) with Default Coin

**Description**: Mint UCT token with default coin configuration

**Prerequisites**: Network connectivity

**Execution Steps**:
```bash
SECRET="test-secret-mint-004" npm run mint-token -- \
  --preset uct \
  --save
```

**Expected Results**:
- Token created successfully
- `genesis.data.coinData` has 1 coin with amount 0
- Console shows "Creating fungible UCT token with default coin (amount: 0)"
- Token is fungible type

**Cleanup**: Remove generated `.txf` file

---

#### MINT_TOKEN-005: Mint Fungible Token (UCT) with Specific Amount

**Description**: Mint UCT with 1.5 UCT (1.5 × 10^18 base units)

**Prerequisites**: Network connectivity

**Execution Steps**:
```bash
SECRET="test-secret-mint-005" npm run mint-token -- \
  --preset uct \
  -c "1500000000000000000" \
  --save
```

**Expected Results**:
- Token created successfully
- `genesis.data.coinData` has 1 coin
- Coin amount is exactly `1500000000000000000`
- Console shows "Creating token with 1 coin(s)"

**Cleanup**: Remove generated `.txf` file

---

#### MINT_TOKEN-006: Mint USDU Stablecoin

**Description**: Mint USDU (6 decimals) with 100 USDU

**Prerequisites**: Network connectivity

**Execution Steps**:
```bash
SECRET="test-secret-mint-006" npm run mint-token -- \
  --preset usdu \
  -c "100000000" \
  --save
```

**Expected Results**:
- Token created successfully
- Token type matches USDU: `8f0f3d7a5e7297be0ee98c63b81bcebb2740f43f616566fc290f9823a54f52d7`
- Coin amount is `100000000` (100 USDU × 10^6)
- Console shows "Creating fungible USDU token"

**Cleanup**: Remove generated `.txf` file

---

#### MINT_TOKEN-007: Mint EURU Stablecoin

**Description**: Mint EURU (6 decimals) with 50.25 EURU

**Prerequisites**: Network connectivity

**Execution Steps**:
```bash
SECRET="test-secret-mint-007" npm run mint-token -- \
  --preset euru \
  -c "50250000" \
  --save
```

**Expected Results**:
- Token created successfully
- Token type matches EURU: `5e160d5e9fdbb03b553fb9c3f6e6c30efa41fa807be39fb4f18e43776e492925`
- Coin amount is `50250000` (50.25 EURU × 10^6)

**Cleanup**: Remove generated `.txf` file

---

#### MINT_TOKEN-008: Mint with Masked Predicate (One-Time Address)

**Description**: Mint token to masked (single-use) address

**Prerequisites**: Network connectivity

**Execution Steps**:
```bash
SECRET="test-secret-mint-008" npm run mint-token -- \
  --preset nft \
  -n "test-nonce-masked-mint" \
  --save
```

**Expected Results**:
- Token created successfully
- `state.predicate` CBOR array has engine ID 1 (masked)
- Address starts with `DIRECT://0001`
- Console shows "Using MASKED predicate (one-time use address)"
- Nonce is hashed and shown in console

**Cleanup**: Remove generated `.txf` file

---

#### MINT_TOKEN-009: Mint with Custom Token ID

**Description**: Mint with specific token ID

**Prerequisites**: Network connectivity

**Execution Steps**:
```bash
SECRET="test-secret-mint-009" npm run mint-token -- \
  --preset nft \
  -i "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" \
  --save
```

**Expected Results**:
- Token created successfully
- Token ID matches input exactly
- Console shows "Using hex tokenId: abcdef1234567890..."

**Cleanup**: Remove generated `.txf` file

---

#### MINT_TOKEN-010: Mint with Custom Salt

**Description**: Mint with explicit salt value

**Prerequisites**: Network connectivity

**Execution Steps**:
```bash
SECRET="test-secret-mint-010" npm run mint-token -- \
  --preset nft \
  --salt "1111111111111111111111111111111111111111111111111111111111111111" \
  --save
```

**Expected Results**:
- Token created successfully
- Genesis data includes specified salt
- Console shows "Salt: 1111111111111111..."

**Cleanup**: Remove generated `.txf` file

---

#### MINT_TOKEN-011: Mint with Output File Path

**Description**: Specify explicit output filename

**Prerequisites**: Network connectivity

**Execution Steps**:
```bash
SECRET="test-secret-mint-011" npm run mint-token -- \
  --preset nft \
  -o "my-custom-nft.txf"
```

**Expected Results**:
- Token file created at `./my-custom-nft.txf`
- File is valid TXF format
- Console shows "✅ Token saved to my-custom-nft.txf"

**Cleanup**: Remove `my-custom-nft.txf`

---

#### MINT_TOKEN-012: Mint with STDOUT Only

**Description**: Output JSON to stdout without saving file

**Prerequisites**: Network connectivity

**Execution Steps**:
```bash
SECRET="test-secret-mint-012" npm run mint-token -- \
  --preset nft \
  --stdout > captured-token.json
```

**Expected Results**:
- Valid TXF JSON written to stdout
- No auto-generated file created
- `captured-token.json` contains valid token
- Console messages go to stderr only

**Cleanup**: Remove `captured-token.json`

---

#### MINT_TOKEN-013 through MINT_TOKEN-018: All Presets with Both Address Types

Test each preset with unmasked and masked:

| Test ID | Preset | Masked | Asset Kind |
|---------|--------|--------|------------|
| MINT_TOKEN-013 | nft | No | non-fungible |
| MINT_TOKEN-014 | nft | Yes | non-fungible |
| MINT_TOKEN-015 | uct | No | fungible |
| MINT_TOKEN-016 | uct | Yes | fungible |
| MINT_TOKEN-017 | usdu | No | fungible |
| MINT_TOKEN-018 | usdu | Yes | fungible |

---

#### MINT_TOKEN-019: Mint with Multiple Coins

**Description**: Create fungible token with multiple coin UTXOs

**Prerequisites**: Network connectivity

**Execution Steps**:
```bash
SECRET="test-secret-mint-019" npm run mint-token -- \
  --preset uct \
  -c "1000000000000000000,2000000000000000000,3000000000000000000" \
  --save
```

**Expected Results**:
- Token created with 3 coins
- `genesis.data.coinData` array has 3 elements
- Each coin has unique CoinId
- Amounts are 1, 2, and 3 UCT respectively
- Console shows "Creating token with 3 coin(s)"

**Cleanup**: Remove generated `.txf` file

---

#### MINT_TOKEN-020: Mint with Local Network

**Description**: Mint using local aggregator

**Prerequisites**: Local aggregator running on port 3000

**Execution Steps**:
```bash
SECRET="test-secret-mint-020" npm run mint-token -- \
  --preset nft \
  --local \
  --save
```

**Expected Results**:
- Token submitted to `http://127.0.0.1:3000`
- Inclusion proof received from local network
- Console shows "Connected to http://127.0.0.1:3000"
- Token created successfully

**Cleanup**: Remove generated `.txf` file

---

### 3. send-token Command Tests

**Test Suite ID**: `SEND_TOKEN`
**Priority**: P0 (Critical)

#### SEND_TOKEN-001: Create Offline Transfer Package (Pattern A)

**Description**: Create offline transfer package for NFT token

**Prerequisites**:
- Minted token file: `test-token-001.txf`
- Recipient address

**Setup**:
```bash
# Mint token
SECRET="alice-secret" npm run mint-token -- \
  --preset nft \
  -o test-token-001.txf

# Get recipient address
SECRET="bob-secret" npm run gen-address > bob-addr.json
BOB_ADDRESS=$(cat bob-addr.json | jq -r '.address')
```

**Execution Steps**:
```bash
SECRET="alice-secret" npm run send-token -- \
  -f test-token-001.txf \
  -r "$BOB_ADDRESS" \
  -m "Test transfer message" \
  --save
```

**Expected Results**:
- Transfer file created with pattern `*_transfer_*.txf`
- File contains `offlineTransfer` section
- `status` field is "PENDING"
- Original token state unchanged (Alice's predicate)
- `offlineTransfer.sender.address` matches Alice's address
- `offlineTransfer.recipient` matches Bob's address
- `offlineTransfer.message` is "Test transfer message"
- `offlineTransfer.commitmentData` present (serialized commitment)
- Console shows "Pattern A: Creating Offline Transfer Package"

**Cleanup**: Remove test files

---

#### SEND_TOKEN-002: Submit Transfer Immediately (Pattern B)

**Description**: Submit transfer directly to network

**Prerequisites**:
- Minted token file: `test-token-002.txf`
- Recipient address
- Network connectivity

**Setup**:
```bash
# Mint token
SECRET="alice-secret" npm run mint-token -- \
  --preset nft \
  -o test-token-002.txf

# Get recipient address
SECRET="bob-secret" npm run gen-address > bob-addr.json
BOB_ADDRESS=$(cat bob-addr.json | jq -r '.address')
```

**Execution Steps**:
```bash
SECRET="alice-secret" npm run send-token -- \
  -f test-token-002.txf \
  -r "$BOB_ADDRESS" \
  --submit-now \
  --save
```

**Expected Results**:
- Transfer submitted to network immediately
- Inclusion proof received
- New transaction added to `transactions` array
- `status` field is "TRANSFERRED"
- NO `offlineTransfer` section (immediate submission)
- Console shows "Pattern B: Submitting to Network"
- Console shows all steps including network submission

**Cleanup**: Remove test files

---

#### SEND_TOKEN-003: Send NFT Token

**Description**: Send NFT with metadata

**Prerequisites**: NFT token with custom data

**Setup**:
```bash
SECRET="alice-secret" npm run mint-token -- \
  --preset nft \
  -d '{"name":"Art NFT","artist":"Alice"}' \
  -o nft-token.txf

SECRET="bob-secret" npm run gen-address > bob-addr.json
BOB_ADDRESS=$(cat bob-addr.json | jq -r '.address')
```

**Execution Steps**:
```bash
SECRET="alice-secret" npm run send-token -- \
  -f nft-token.txf \
  -r "$BOB_ADDRESS" \
  --save
```

**Expected Results**:
- Transfer package created
- Original NFT data preserved in transfer
- Token type remains NFT
- Transfer status PENDING

**Cleanup**: Remove test files

---

#### SEND_TOKEN-004: Send Fungible Token (UCT)

**Description**: Send UCT token with coins

**Prerequisites**: UCT token with coins

**Setup**:
```bash
SECRET="alice-secret" npm run mint-token -- \
  --preset uct \
  -c "5000000000000000000" \
  -o uct-token.txf

SECRET="bob-secret" npm run gen-address > bob-addr.json
BOB_ADDRESS=$(cat bob-addr.json | jq -r '.address')
```

**Execution Steps**:
```bash
SECRET="alice-secret" npm run send-token -- \
  -f uct-token.txf \
  -r "$BOB_ADDRESS" \
  --save
```

**Expected Results**:
- Transfer package created
- Coin data preserved (5 UCT)
- Transfer commitment includes coin information

**Cleanup**: Remove test files

---

#### SEND_TOKEN-005 through SEND_TOKEN-010: All Token Types

Test sending each token type:

| Test ID | Token Type | Preset | Notes |
|---------|------------|--------|-------|
| SEND_TOKEN-005 | NFT | nft | Non-fungible |
| SEND_TOKEN-006 | UCT | uct | Fungible coin |
| SEND_TOKEN-007 | USDU | usdu | Stablecoin 6 decimals |
| SEND_TOKEN-008 | EURU | euru | Stablecoin 6 decimals |
| SEND_TOKEN-009 | ALPHA | alpha | Same as UCT |
| SEND_TOKEN-010 | Custom | Custom hex | User-defined type |

---

#### SEND_TOKEN-011: Send with Local Network

**Description**: Send using local aggregator (Pattern B)

**Prerequisites**:
- Token file
- Local aggregator running

**Execution Steps**:
```bash
SECRET="alice-secret" npm run send-token -- \
  -f test-token.txf \
  -r "$BOB_ADDRESS" \
  --submit-now \
  --local \
  --save
```

**Expected Results**:
- Transfer submitted to `http://127.0.0.1:3000`
- Inclusion proof from local network
- Transfer confirmed

**Cleanup**: Remove test files

---

#### SEND_TOKEN-012: Send to Masked Address

**Description**: Send token to recipient with masked (one-time) address

**Prerequisites**: Token file, masked recipient address

**Setup**:
```bash
# Generate masked address for Bob
SECRET="bob-secret" npm run gen-address -- -n "bob-nonce" > bob-masked.json
BOB_MASKED_ADDRESS=$(cat bob-masked.json | jq -r '.address')
```

**Execution Steps**:
```bash
SECRET="alice-secret" npm run send-token -- \
  -f test-token.txf \
  -r "$BOB_MASKED_ADDRESS" \
  --save
```

**Expected Results**:
- Transfer package created
- Recipient address is masked (starts with DIRECT://0001)
- Transfer valid for Bob with correct nonce

**Cleanup**: Remove test files

---

#### SEND_TOKEN-013: Send Token Already Transferred

**Description**: Attempt to send token that's already been sent

**Prerequisites**: Token that was already sent once

**Setup**:
```bash
# Send first time
SECRET="alice-secret" npm run send-token -- \
  -f original-token.txf \
  -r "$BOB_ADDRESS" \
  --submit-now \
  -o sent-token.txf
```

**Execution Steps**:
```bash
# Try to send again from same state
SECRET="alice-secret" npm run send-token -- \
  -f sent-token.txf \
  -r "$CAROL_ADDRESS"
```

**Expected Results**:
- Command should fail or warn
- Cannot spend already-transferred token
- Status is TRANSFERRED (archived)

**Cleanup**: Remove test files

---

### 4. receive-token Command Tests

**Test Suite ID**: `RECV_TOKEN`
**Priority**: P0 (Critical)

#### RECV_TOKEN-001: Receive Offline Transfer Package

**Description**: Complete offline transfer by receiving package

**Prerequisites**: Valid transfer package file

**Setup**:
```bash
# Alice creates transfer
SECRET="alice-secret" npm run mint-token -- \
  --preset nft \
  -o alice-token.txf

SECRET="bob-secret" npm run gen-address > bob-addr.json
BOB_ADDRESS=$(cat bob-addr.json | jq -r '.address')

SECRET="alice-secret" npm run send-token -- \
  -f alice-token.txf \
  -r "$BOB_ADDRESS" \
  -o transfer-package.txf
```

**Execution Steps**:
```bash
SECRET="bob-secret" npm run receive-token -- \
  -f transfer-package.txf \
  --save
```

**Expected Results**:
- Transfer submitted to network
- Inclusion proof received
- New token file created
- `state.predicate` now contains Bob's predicate (new owner)
- `transactions` array has 1 transfer transaction
- `status` is "CONFIRMED"
- NO `offlineTransfer` section (removed after completion)
- Console shows all 15 steps complete
- Address verification passes

**Cleanup**: Remove test files

---

#### RECV_TOKEN-002: Receive NFT Transfer

**Description**: Receive NFT with preserved metadata

**Prerequisites**: NFT transfer package

**Setup**:
```bash
SECRET="alice-secret" npm run mint-token -- \
  --preset nft \
  -d '{"name":"Test NFT","id":123}' \
  -o nft-token.txf

SECRET="bob-secret" npm run gen-address > bob-addr.json
BOB_ADDRESS=$(cat bob-addr.json | jq -r '.address')

SECRET="alice-secret" npm run send-token -- \
  -f nft-token.txf \
  -r "$BOB_ADDRESS" \
  -o nft-transfer.txf
```

**Execution Steps**:
```bash
SECRET="bob-secret" npm run receive-token -- \
  -f nft-transfer.txf \
  --save
```

**Expected Results**:
- NFT received successfully
- Token data preserved: `{"name":"Test NFT","id":123}`
- Token type still NFT
- Bob is new owner

**Cleanup**: Remove test files

---

#### RECV_TOKEN-003: Receive Fungible Token

**Description**: Receive UCT token with coins

**Prerequisites**: UCT transfer package

**Setup**:
```bash
SECRET="alice-secret" npm run mint-token -- \
  --preset uct \
  -c "10000000000000000000" \
  -o uct-token.txf

SECRET="bob-secret" npm run gen-address > bob-addr.json
BOB_ADDRESS=$(cat bob-addr.json | jq -r '.address')

SECRET="alice-secret" npm run send-token -- \
  -f uct-token.txf \
  -r "$BOB_ADDRESS" \
  -o uct-transfer.txf
```

**Execution Steps**:
```bash
SECRET="bob-secret" npm run receive-token -- \
  -f uct-transfer.txf \
  --save
```

**Expected Results**:
- UCT received successfully
- Coin data intact (10 UCT)
- Bob can now spend the coins

**Cleanup**: Remove test files

---

#### RECV_TOKEN-004: Receive with Wrong Secret

**Description**: Attempt to receive with incorrect secret

**Prerequisites**: Valid transfer package

**Setup**:
```bash
# Create transfer for Bob
SECRET="bob-secret" npm run gen-address > bob-addr.json
BOB_ADDRESS=$(cat bob-addr.json | jq -r '.address')

SECRET="alice-secret" npm run mint-token -- -o token.txf
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  -o transfer.txf
```

**Execution Steps**:
```bash
# Carol tries to receive with her secret (wrong!)
SECRET="carol-secret" npm run receive-token -- -f transfer.txf
```

**Expected Results**:
- Command fails with address mismatch error
- Error message: "Address mismatch!"
- Shows expected address (Bob's) vs actual address (Carol's)
- No network submission occurs

**Cleanup**: Remove test files

---

#### RECV_TOKEN-005: Receive Already Submitted Transfer

**Description**: Run receive-token multiple times (idempotent)

**Prerequisites**: Valid transfer package

**Setup**:
```bash
SECRET="bob-secret" npm run gen-address > bob-addr.json
BOB_ADDRESS=$(cat bob-addr.json | jq -r '.address')

SECRET="alice-secret" npm run mint-token -- -o token.txf
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  -o transfer.txf

# First receive
SECRET="bob-secret" npm run receive-token -- \
  -f transfer.txf \
  -o received.txf
```

**Execution Steps**:
```bash
# Second receive (retry)
SECRET="bob-secret" npm run receive-token -- -f transfer.txf
```

**Expected Results**:
- Command succeeds (idempotent)
- Console shows "ℹ Transfer already submitted (continuing...)"
- Inclusion proof retrieved successfully
- Final token state same as first receive

**Cleanup**: Remove test files

---

#### RECV_TOKEN-006: Receive with Local Network

**Description**: Receive using local aggregator

**Prerequisites**: Local aggregator running, transfer package

**Execution Steps**:
```bash
SECRET="bob-secret" npm run receive-token -- \
  -f transfer.txf \
  --local \
  --save
```

**Expected Results**:
- Submits to `http://127.0.0.1:3000`
- Inclusion proof from local network
- Token received successfully

**Cleanup**: Remove test files

---

#### RECV_TOKEN-007: Receive to Masked Address

**Description**: Receive token at masked (one-time) address

**Prerequisites**: Transfer sent to masked address

**Setup**:
```bash
# Bob generates masked address
SECRET="bob-secret" npm run gen-address -- -n "bob-nonce" > bob-masked.json
BOB_MASKED_ADDRESS=$(cat bob-masked.json | jq -r '.address')

# Alice sends to masked address
SECRET="alice-secret" npm run mint-token -- -o token.txf
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_MASKED_ADDRESS" \
  -o transfer.txf
```

**Execution Steps**:
```bash
# Bob receives with same secret + nonce
SECRET="bob-secret" npm run receive-token -- -f transfer.txf --save
```

**Expected Results**:
- Token received successfully
- Bob's predicate is masked (engine ID 1)
- Address verification passes
- Bob must use same nonce for future operations

**Cleanup**: Remove test files

---

### 5. verify-token Command Tests

**Test Suite ID**: `VERIFY_TOKEN`
**Priority**: P0 (Critical)

#### VERIFY_TOKEN-001: Verify Newly Minted Token

**Description**: Verify a token immediately after minting

**Prerequisites**: Freshly minted token

**Setup**:
```bash
SECRET="test-secret" npm run mint-token -- \
  --preset nft \
  -o fresh-token.txf
```

**Execution Steps**:
```bash
npm run verify-token -- -f fresh-token.txf
```

**Expected Results**:
- All proofs valid
- Genesis proof signature verified
- Token structure valid
- SDK loads token successfully
- Ownership status: "✅ Token is current and ready to use"
- On-chain status: UNSPENT
- No transactions (newly minted)

**Cleanup**: Remove test files

---

#### VERIFY_TOKEN-002: Verify Token After Transfer

**Description**: Verify token that has been transferred once

**Prerequisites**: Token with one transfer

**Setup**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf

SECRET="bob-secret" npm run gen-address > bob-addr.json
BOB_ADDRESS=$(cat bob-addr.json | jq -r '.address')

SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  -o transfer.txf

SECRET="bob-secret" npm run receive-token -- \
  -f transfer.txf \
  -o bob-token.txf
```

**Execution Steps**:
```bash
npm run verify-token -- -f bob-token.txf
```

**Expected Results**:
- All proofs valid
- Genesis proof verified
- 1 transfer transaction proof verified
- Token structure valid
- Ownership status: "✅ Token is current and ready to use"
- Current owner: Bob's address
- Transaction history shows 1 transfer

**Cleanup**: Remove test files

---

#### VERIFY_TOKEN-003: Verify All Token Types

Test verification for each token type:

| Test ID | Preset | Token Data | Expected |
|---------|--------|------------|----------|
| VERIFY_TOKEN-003a | nft | JSON metadata | Valid NFT |
| VERIFY_TOKEN-003b | uct | 1 coin, 10 UCT | Valid fungible |
| VERIFY_TOKEN-003c | usdu | 1 coin, 100 USDU | Valid stablecoin |
| VERIFY_TOKEN-003d | euru | 1 coin, 50 EURU | Valid stablecoin |
| VERIFY_TOKEN-003e | alpha | 1 coin, 5 UCT | Valid fungible |

---

#### VERIFY_TOKEN-004: Verify Predicate Details

**Description**: Check predicate decoding and display

**Prerequisites**: Token with known predicate

**Execution Steps**:
```bash
npm run verify-token -- -f test-token.txf
```

**Expected Results**:
- Predicate section shows:
  - Engine ID (0 for unmasked, 1 for masked)
  - Template (hex)
  - Parameters breakdown:
    - Token ID
    - Token Type
    - Public Key
    - Algorithm (SHA256)
    - Signature

**Cleanup**: None required

---

#### VERIFY_TOKEN-005: Verify with Ownership Check (Network Query)

**Description**: Query aggregator for on-chain ownership status

**Prerequisites**: Token file, network connectivity

**Execution Steps**:
```bash
npm run verify-token -- -f token.txf
```

**Expected Results**:
- Ownership status section displays:
  - Scenario: current/outdated/pending/confirmed
  - On-chain spent: true/false
  - Current owner address
  - Detailed status explanation

**Cleanup**: None required

---

#### VERIFY_TOKEN-006: Verify with --skip-network Flag

**Description**: Verify without querying aggregator

**Prerequisites**: Token file

**Execution Steps**:
```bash
npm run verify-token -- -f token.txf --skip-network
```

**Expected Results**:
- All local validations performed
- Proof structure validated
- SDK compatibility checked
- Ownership status section shows: "Network verification skipped"
- No network queries made

**Cleanup**: None required

---

#### VERIFY_TOKEN-007: Verify Outdated Token (Scenario B)

**Description**: Verify token that was transferred elsewhere

**Prerequisites**: Token transferred from another device

**Setup**:
```bash
# Device 1: Mint and transfer to Bob
SECRET="alice-secret" npm run mint-token -- -o alice-token.txf
SECRET="alice-secret" npm run send-token -- \
  -f alice-token.txf \
  -r "$BOB_ADDRESS" \
  --submit-now \
  -o transferred.txf

# Device 2: Alice still has old token file
# (Use alice-token.txf which is now outdated)
```

**Execution Steps**:
```bash
npm run verify-token -- -f alice-token.txf
```

**Expected Results**:
- Ownership status: "⚠️ Token state is outdated - transferred from another device"
- On-chain status: SPENT
- Shows latest known owner vs current state
- Warning that TXF is out of sync

**Cleanup**: Remove test files

---

#### VERIFY_TOKEN-008: Verify Pending Transfer (Scenario C)

**Description**: Verify token with pending offline transfer

**Prerequisites**: Transfer package (not yet received)

**Setup**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  -o pending-transfer.txf
```

**Execution Steps**:
```bash
npm run verify-token -- -f pending-transfer.txf
```

**Expected Results**:
- Ownership status: "⏳ Pending transfer - not yet submitted to network"
- On-chain status: UNSPENT
- Shows pending recipient
- Indicates transfer package created but not claimed

**Cleanup**: Remove test files

---

#### VERIFY_TOKEN-009: Verify Token with Multiple Transfers

**Description**: Verify token with 3 transfers (multi-hop)

**Prerequisites**: Token with multiple transfers

**Setup**:
```bash
# Alice → Bob → Carol → Dave
# (Setup script creates this chain)
```

**Execution Steps**:
```bash
npm run verify-token -- -f dave-token.txf
```

**Expected Results**:
- Transaction history shows 3 transfers
- All 3 transaction proofs verified
- Current owner: Dave
- Genesis + 3 transaction proofs all valid

**Cleanup**: Remove test files

---

#### VERIFY_TOKEN-010: Verify with Local Network

**Description**: Verify using local aggregator for ownership check

**Prerequisites**: Token, local aggregator

**Execution Steps**:
```bash
npm run verify-token -- -f token.txf --local
```

**Expected Results**:
- Queries `http://127.0.0.1:3000` for status
- All validations against local network
- Ownership status from local state

**Cleanup**: None required

---

## Integration Test Scenarios

### Integration Test Suite ID: `INTEGRATION`

---

### INTEGRATION-001: Complete Offline Transfer Flow (Pattern A)

**Description**: End-to-end offline transfer from Alice to Bob

**Priority**: P0 (Critical)

**Test Steps**:

1. **Alice creates address**:
   ```bash
   SECRET="alice-secret-001" npm run gen-address > alice-addr.json
   ```

2. **Bob creates address**:
   ```bash
   SECRET="bob-secret-001" npm run gen-address > bob-addr.json
   BOB_ADDRESS=$(cat bob-addr.json | jq -r '.address')
   ```

3. **Alice mints NFT**:
   ```bash
   SECRET="alice-secret-001" npm run mint-token -- \
     --preset nft \
     -d '{"name":"Birthday Gift","message":"Happy Birthday Bob!"}' \
     -o alice-nft.txf
   ```

4. **Verify Alice's token**:
   ```bash
   npm run verify-token -- -f alice-nft.txf
   ```
   - Expect: Token valid, Alice is owner, status UNSPENT

5. **Alice creates transfer package**:
   ```bash
   SECRET="alice-secret-001" npm run send-token -- \
     -f alice-nft.txf \
     -r "$BOB_ADDRESS" \
     -m "For you!" \
     -o transfer-to-bob.txf
   ```

6. **Verify transfer package**:
   ```bash
   npm run verify-token -- -f transfer-to-bob.txf
   ```
   - Expect: Status PENDING, has offlineTransfer section

7. **Bob receives token**:
   ```bash
   SECRET="bob-secret-001" npm run receive-token -- \
     -f transfer-to-bob.txf \
     -o bob-nft.txf
   ```

8. **Verify Bob's token**:
   ```bash
   npm run verify-token -- -f bob-nft.txf
   ```
   - Expect: Bob is owner, status CONFIRMED, 1 transaction

9. **Verify Alice's old token is now outdated**:
   ```bash
   npm run verify-token -- -f alice-nft.txf
   ```
   - Expect: Status outdated/spent on-chain

**Expected Results**:
- Complete transfer successful
- Token ownership transferred from Alice to Bob
- All proofs valid at each step
- Original token data preserved

**Cleanup**: Remove all test files

---

### INTEGRATION-002: Multi-Hop Transfer (Alice → Bob → Carol)

**Description**: Transfer token through multiple owners

**Priority**: P0 (Critical)

**Test Steps**:

1. **Create all addresses**:
   ```bash
   SECRET="alice-secret-002" npm run gen-address > alice-addr.json
   SECRET="bob-secret-002" npm run gen-address > bob-addr.json
   SECRET="carol-secret-002" npm run gen-address > carol-addr.json

   BOB_ADDRESS=$(cat bob-addr.json | jq -r '.address')
   CAROL_ADDRESS=$(cat carol-addr.json | jq -r '.address')
   ```

2. **Alice mints and sends to Bob**:
   ```bash
   SECRET="alice-secret-002" npm run mint-token -- \
     --preset nft \
     -o alice-token.txf

   SECRET="alice-secret-002" npm run send-token -- \
     -f alice-token.txf \
     -r "$BOB_ADDRESS" \
     -o transfer-alice-bob.txf
   ```

3. **Bob receives**:
   ```bash
   SECRET="bob-secret-002" npm run receive-token -- \
     -f transfer-alice-bob.txf \
     -o bob-token.txf
   ```

4. **Verify Bob's ownership**:
   ```bash
   npm run verify-token -- -f bob-token.txf
   ```
   - Expect: Bob owns token, 1 transaction

5. **Bob sends to Carol**:
   ```bash
   SECRET="bob-secret-002" npm run send-token -- \
     -f bob-token.txf \
     -r "$CAROL_ADDRESS" \
     -o transfer-bob-carol.txf
   ```

6. **Carol receives**:
   ```bash
   SECRET="carol-secret-002" npm run receive-token -- \
     -f transfer-bob-carol.txf \
     -o carol-token.txf
   ```

7. **Verify Carol's ownership**:
   ```bash
   npm run verify-token -- -f carol-token.txf
   ```
   - Expect: Carol owns token, 2 transactions

**Expected Results**:
- Token successfully transferred through 2 hops
- Transaction history shows both transfers
- Each owner verified at their step
- All proofs valid

**Cleanup**: Remove all test files

---

### INTEGRATION-003: Fungible Token Transfer (UCT with Coins)

**Description**: Transfer fungible UCT token with coin amounts

**Priority**: P1 (High)

**Test Steps**:

1. **Setup addresses**:
   ```bash
   SECRET="alice-secret-003" npm run gen-address > alice-addr.json
   SECRET="bob-secret-003" npm run gen-address > bob-addr.json
   BOB_ADDRESS=$(cat bob-addr.json | jq -r '.address')
   ```

2. **Alice mints 100 UCT**:
   ```bash
   SECRET="alice-secret-003" npm run mint-token -- \
     --preset uct \
     -c "100000000000000000000" \
     -o alice-uct.txf
   ```

3. **Verify coin amount**:
   ```bash
   npm run verify-token -- -f alice-uct.txf
   ```
   - Expect: coinData shows 100 UCT (100 × 10^18)

4. **Alice sends to Bob**:
   ```bash
   SECRET="alice-secret-003" npm run send-token -- \
     -f alice-uct.txf \
     -r "$BOB_ADDRESS" \
     -o transfer-uct.txf
   ```

5. **Bob receives**:
   ```bash
   SECRET="bob-secret-003" npm run receive-token -- \
     -f transfer-uct.txf \
     -o bob-uct.txf
   ```

6. **Verify Bob has 100 UCT**:
   ```bash
   npm run verify-token -- -f bob-uct.txf
   ```
   - Expect: Bob owns token, coin amount still 100 UCT

**Expected Results**:
- Fungible token transferred successfully
- Coin amounts preserved through transfer
- Bob can now spend the UCT

**Cleanup**: Remove all test files

---

### INTEGRATION-004: Postponed Commitment Chain (1-Level)

**Description**: Create transfer package, wait, then submit later

**Priority**: P1 (High)

**Test Steps**:

1. **Alice mints token**:
   ```bash
   SECRET="alice-secret-004" npm run mint-token -- -o token.txf
   ```

2. **Alice creates transfer package (offline)**:
   ```bash
   SECRET="alice-secret-004" npm run send-token -- \
     -f token.txf \
     -r "$BOB_ADDRESS" \
     -o transfer.txf
   ```
   - Note: No network submission yet

3. **Wait 10 seconds** (simulate delay)

4. **Bob receives and submits**:
   ```bash
   SECRET="bob-secret-004" npm run receive-token -- \
     -f transfer.txf \
     -o bob-token.txf
   ```
   - Now network submission occurs

5. **Verify successful**:
   ```bash
   npm run verify-token -- -f bob-token.txf
   ```

**Expected Results**:
- Transfer package can be created offline
- Submission delayed until recipient action
- Transfer succeeds when finally submitted

**Cleanup**: Remove all test files

---

### INTEGRATION-005: Postponed Commitment Chain (2-Level)

**Description**: Chain two offline transfers before any submission

**Priority**: P1 (High)

**Test Steps**:

1. **Alice mints**:
   ```bash
   SECRET="alice-secret-005" npm run mint-token -- -o alice-token.txf
   ```

2. **Alice → Bob (offline)**:
   ```bash
   SECRET="alice-secret-005" npm run send-token -- \
     -f alice-token.txf \
     -r "$BOB_ADDRESS" \
     -o transfer1.txf
   ```

3. **Bob "receives" but creates another transfer immediately** (simulated):
   - This requires Bob to receive, then immediately send to Carol
   - Bob does NOT verify ownership on-chain yet

4. **Bob → Carol (offline)**:
   ```bash
   SECRET="bob-secret-005" npm run send-token -- \
     -f bob-token-temp.txf \
     -r "$CAROL_ADDRESS" \
     -o transfer2.txf
   ```

5. **Carol receives and submits first commitment**:
   ```bash
   SECRET="carol-secret-005" npm run receive-token -- \
     -f transfer2.txf \
     -o carol-token.txf
   ```

**Expected Results**:
- Both transfers created offline
- First commitment submitted when Carol receives
- Network validates chain of commitments
- Carol receives token successfully

**Note**: This scenario tests edge case of chaining commitments before network submission.

**Cleanup**: Remove all test files

---

### INTEGRATION-006: Postponed Commitment Chain (3-Level)

**Description**: Chain three offline transfers: Alice → Bob → Carol → Dave

**Priority**: P2 (Medium)

**Test Steps**:

1. **Mint token**
2. **Create 3 offline transfer packages in sequence**
3. **Final recipient (Dave) receives and submits all commitments**

**Expected Results**:
- All 3 commitments processed
- Dave receives token with 3 transactions in history

**Note**: Complex edge case - may have network limitations

**Cleanup**: Remove all test files

---

### INTEGRATION-007: Mixed Transfer Patterns

**Description**: Combine offline and immediate transfers

**Priority**: P1 (High)

**Test Steps**:

1. **Alice → Bob (offline)**:
   ```bash
   SECRET="alice-secret-007" npm run send-token -- \
     -f token.txf \
     -r "$BOB_ADDRESS" \
     -o transfer1.txf

   SECRET="bob-secret-007" npm run receive-token -- \
     -f transfer1.txf \
     -o bob-token.txf
   ```

2. **Bob → Carol (immediate)**:
   ```bash
   SECRET="bob-secret-007" npm run send-token -- \
     -f bob-token.txf \
     -r "$CAROL_ADDRESS" \
     --submit-now \
     -o carol-token.txf
   ```

3. **Carol → Dave (offline)**:
   ```bash
   SECRET="carol-secret-007" npm run send-token -- \
     -f carol-token.txf \
     -r "$DAVE_ADDRESS" \
     -o transfer3.txf

   SECRET="dave-secret-007" npm run receive-token -- \
     -f transfer3.txf \
     -o dave-token.txf
   ```

**Expected Results**:
- All transfers successful
- Different patterns work together
- Final token has 3 transactions

**Cleanup**: Remove all test files

---

### INTEGRATION-008: Cross-Token-Type Address Reuse

**Description**: Test if same address can receive different token types

**Priority**: P2 (Medium)

**Test Steps**:

1. **Bob generates one unmasked address**:
   ```bash
   SECRET="bob-secret-008" npm run gen-address > bob-addr.json
   BOB_ADDRESS=$(cat bob-addr.json | jq -r '.address')
   ```

2. **Alice sends NFT to Bob's address**:
   ```bash
   SECRET="alice-secret-008" npm run mint-token -- \
     --preset nft \
     -o nft.txf

   SECRET="alice-secret-008" npm run send-token -- \
     -f nft.txf \
     -r "$BOB_ADDRESS" \
     -o transfer-nft.txf

   SECRET="bob-secret-008" npm run receive-token -- \
     -f transfer-nft.txf \
     -o bob-nft.txf
   ```

3. **Alice sends UCT to same Bob address**:
   ```bash
   SECRET="alice-secret-008" npm run mint-token -- \
     --preset uct \
     -c "50000000000000000000" \
     -o uct.txf

   SECRET="alice-secret-008" npm run send-token -- \
     -f uct.txf \
     -r "$BOB_ADDRESS" \
     -o transfer-uct.txf

   SECRET="bob-secret-008" npm run receive-token -- \
     -f transfer-uct.txf \
     -o bob-uct.txf
   ```

4. **Verify Bob has both tokens**:
   ```bash
   npm run verify-token -- -f bob-nft.txf
   npm run verify-token -- -f bob-uct.txf
   ```

**Expected Results**:
- Same address receives different token types
- Both tokens verify successfully
- Unmasked addresses are reusable across types

**Note**: Tests address reusability pattern

**Cleanup**: Remove all test files

---

### INTEGRATION-009: Masked Address Single-Use Enforcement

**Description**: Test that masked address can only receive one token

**Priority**: P1 (High)

**Test Steps**:

1. **Bob generates masked address**:
   ```bash
   SECRET="bob-secret-009" npm run gen-address -- \
     -n "bob-nonce-009" \
     > bob-masked.json
   BOB_MASKED=$(cat bob-masked.json | jq -r '.address')
   ```

2. **Alice sends first token to Bob's masked address**:
   ```bash
   SECRET="alice-secret-009" npm run mint-token -- -o token1.txf
   SECRET="alice-secret-009" npm run send-token -- \
     -f token1.txf \
     -r "$BOB_MASKED" \
     -o transfer1.txf

   SECRET="bob-secret-009" npm run receive-token -- \
     -f transfer1.txf \
     -o bob-token1.txf
   ```
   - Expect: Success

3. **Alice tries to send second token to same masked address**:
   ```bash
   SECRET="alice-secret-009" npm run mint-token -- -o token2.txf
   SECRET="alice-secret-009" npm run send-token -- \
     -f token2.txf \
     -r "$BOB_MASKED" \
     -o transfer2.txf

   SECRET="bob-secret-009" npm run receive-token -- \
     -f transfer2.txf
   ```

**Expected Results**:
- First transfer succeeds
- Second transfer should fail or warn
- Masked address is single-use (burned after first use)

**Cleanup**: Remove all test files

---

### INTEGRATION-010: All Token Type Combinations

**Description**: Transfer each token type through full lifecycle

**Priority**: P1 (High)

**Test Matrix**:

| Token Type | Mint | Transfer | Verify | Expected |
|------------|------|----------|--------|----------|
| NFT | ✓ | Alice → Bob | ✓ | Success |
| UCT | ✓ | Alice → Bob | ✓ | Success |
| USDU | ✓ | Alice → Bob | ✓ | Success |
| EURU | ✓ | Alice → Bob | ✓ | Success |
| ALPHA | ✓ | Alice → Bob | ✓ | Success |
| Custom | ✓ | Alice → Bob | ✓ | Success |

**Test Steps**: For each token type, run INTEGRATION-001 flow

**Expected Results**: All token types transfer successfully

---

## Edge Cases and Error Scenarios

### Error Test Suite ID: `ERROR`

---

### ERROR-001: Mint with Invalid Endpoint

**Description**: Attempt mint with unreachable aggregator

**Priority**: P1 (High)

**Execution Steps**:
```bash
SECRET="test-secret" npm run mint-token -- \
  --preset nft \
  -e "http://invalid-host:9999"
```

**Expected Results**:
- Error: Network connection failed
- Timeout or connection refused error
- No token file created
- Graceful error message

**Cleanup**: None required

---

### ERROR-002: Send Token with Invalid Recipient Address

**Description**: Send with malformed recipient address

**Priority**: P1 (High)

**Setup**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf
```

**Execution Steps**:
```bash
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "not-a-valid-address"
```

**Expected Results**:
- Error: Invalid address format
- Clear error message explaining expected format
- No transfer file created

**Cleanup**: Remove token.txf

---

### ERROR-003: Receive with Missing Transfer Package

**Description**: Receive command on token without offlineTransfer

**Priority**: P1 (High)

**Setup**:
```bash
SECRET="alice-secret" npm run mint-token -- -o regular-token.txf
```

**Execution Steps**:
```bash
SECRET="bob-secret" npm run receive-token -- -f regular-token.txf
```

**Expected Results**:
- Error: No offline transfer package found
- Message: "Use send-token to create offline transfer packages"
- No network submission

**Cleanup**: Remove token files

---

### ERROR-004: Verify Corrupted Token File

**Description**: Verify token with corrupted JSON

**Priority**: P2 (Medium)

**Setup**:
```bash
# Create corrupted token file
echo '{"version": "2.0", "corrupted' > corrupted.txf
```

**Execution Steps**:
```bash
npm run verify-token -- -f corrupted.txf
```

**Expected Results**:
- Error: JSON parse error
- Clear error message
- Does not crash CLI

**Cleanup**: Remove corrupted.txf

---

### ERROR-005: Mint with Invalid JSON Token Data

**Description**: Mint with malformed JSON in -d option

**Priority**: P2 (Medium)

**Execution Steps**:
```bash
SECRET="test-secret" npm run mint-token -- \
  --preset nft \
  -d '{"invalid json'
```

**Expected Results**:
- Either: Treats as plain text (fallback)
- Or: Error with clear message about JSON format
- Should not crash

**Cleanup**: Remove any created files

---

### ERROR-006: Send with Missing Token File

**Description**: Send command with non-existent file

**Priority**: P1 (High)

**Execution Steps**:
```bash
SECRET="alice-secret" npm run send-token -- \
  -f non-existent-token.txf \
  -r "$BOB_ADDRESS"
```

**Expected Results**:
- Error: File not found
- Clear error message with file path
- No network activity

**Cleanup**: None required

---

### ERROR-007: Receive Network Timeout

**Description**: Simulate network timeout during receive

**Priority**: P1 (High)

**Setup**:
- Create valid transfer package
- Use unreachable endpoint or slow network

**Execution Steps**:
```bash
SECRET="bob-secret" npm run receive-token -- \
  -f transfer.txf \
  -e "http://10.255.255.1:3000"
```

**Expected Results**:
- Error: Network timeout after X seconds
- Timeout configurable (currently 60s for inclusion proof)
- Clear timeout message

**Cleanup**: Remove test files

---

### ERROR-008: Verify with Missing Trust Base

**Description**: Verify when trust base file is unavailable

**Priority**: P2 (Medium)

**Setup**:
```bash
# Set invalid trust base path
export TRUSTBASE_PATH="/invalid/path/trustbase.json"
```

**Execution Steps**:
```bash
npm run verify-token -- -f token.txf
```

**Expected Results**:
- Warning: Trust base unavailable
- Fallback to hardcoded trust base or error
- Should continue with validation if possible

**Cleanup**: Unset TRUSTBASE_PATH

---

### ERROR-009: Send Token Already TRANSFERRED

**Description**: Attempt to send token with TRANSFERRED status

**Priority**: P1 (High)

**Setup**:
```bash
# Create transferred token
SECRET="alice-secret" npm run mint-token -- -o token.txf
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  --submit-now \
  -o transferred-token.txf
```

**Execution Steps**:
```bash
SECRET="alice-secret" npm run send-token -- \
  -f transferred-token.txf \
  -r "$CAROL_ADDRESS"
```

**Expected Results**:
- Error or warning: Token already transferred
- Should not allow double-spend
- Clear message about token status

**Cleanup**: Remove test files

---

### ERROR-010: Receive with Address Mismatch

**Description**: Covered in RECV_TOKEN-004 but emphasized here

**Priority**: P0 (Critical)

**Expected Results**:
- Clear address mismatch error
- Shows expected vs actual address
- Security check prevents wrong recipient

---

### ERROR-011: Mint with Empty Secret

**Description**: Attempt mint without providing secret

**Priority**: P1 (High)

**Execution Steps**:
```bash
# Run without SECRET environment variable and skip interactive prompt
echo "" | npm run mint-token -- --preset nft
```

**Expected Results**:
- Error or generates insecure key
- Should warn about security if no secret
- May fail gracefully

**Cleanup**: None required

---

### ERROR-012: Invalid Token Type (Wrong Length Hex)

**Description**: Provide hex token type that's not 64 characters

**Priority**: P2 (Medium)

**Execution Steps**:
```bash
SECRET="test-secret" npm run gen-address -- -y "1234abcd"
```

**Expected Results**:
- System hashes the short hex to 32 bytes
- Console shows "Hashed token type ... to: <hash>"
- Address generated successfully

**Cleanup**: None required

---

### ERROR-013: Send with Both --save and --stdout

**Description**: Test flag conflict resolution

**Priority**: P3 (Low)

**Setup**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf
```

**Execution Steps**:
```bash
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  --save \
  --stdout
```

**Expected Results**:
- Both flags respected or clear precedence
- File saved AND stdout output
- No error, clear behavior

**Cleanup**: Remove test files

---

### ERROR-014: Proof Validation Failure (Invalid Authenticator)

**Description**: Detect token with corrupted proof

**Priority**: P1 (High)

**Setup**:
```bash
# Mint valid token
SECRET="test-secret" npm run mint-token -- -o token.txf

# Manually corrupt the authenticator in genesis.inclusionProof
# Edit token.txf and modify authenticator field
```

**Execution Steps**:
```bash
npm run verify-token -- -f token.txf
```

**Expected Results**:
- Proof validation fails
- Error: "Authenticator signature verification failed"
- Token marked as invalid

**Cleanup**: Remove token.txf

---

### ERROR-015: Multiple Coins with Zero Amounts

**Description**: Mint fungible token with invalid coin data

**Priority**: P2 (Medium)

**Execution Steps**:
```bash
SECRET="test-secret" npm run mint-token -- \
  --preset uct \
  -c "0,0,0"
```

**Expected Results**:
- Token created with 3 coins, all amount 0
- Valid structure but economically meaningless
- No error (valid use case for testing)

**Cleanup**: Remove generated file

---

## Performance and Load Tests

### Performance Test Suite ID: `PERF`

---

### PERF-001: Mint 100 Tokens Sequentially

**Description**: Measure time to mint 100 tokens one after another

**Priority**: P2 (Medium)

**Execution Steps**:
```bash
#!/bin/bash
start=$(date +%s)
for i in {1..100}; do
  SECRET="test-secret-$i" npm run mint-token -- \
    --preset nft \
    -o "token-$i.txf" \
    --stdout > /dev/null
done
end=$(date +%s)
echo "Time: $((end - start)) seconds"
```

**Expected Results**:
- All 100 tokens created successfully
- Average time per mint: < 5 seconds
- No memory leaks

**Cleanup**: Remove all token files

---

### PERF-002: Large Token Data (1MB JSON)

**Description**: Mint token with large JSON data

**Priority**: P2 (Medium)

**Setup**:
```bash
# Generate 1MB JSON file
node -e 'console.log(JSON.stringify({data: "A".repeat(1000000)}))' > large-data.json
```

**Execution Steps**:
```bash
SECRET="test-secret" npm run mint-token -- \
  --preset nft \
  -d "$(cat large-data.json)" \
  -o large-token.txf
```

**Expected Results**:
- Token created successfully
- File size > 1MB
- verify-token can load and validate
- May take longer but should not fail

**Cleanup**: Remove test files

---

### PERF-003: Multi-Hop Transfer (10 Hops)

**Description**: Transfer token through 10 owners

**Priority**: P3 (Low)

**Test Steps**:
1. Create 10 addresses
2. Mint token
3. Transfer through all 10 addresses
4. Verify final owner
5. Check transaction history has 10 transfers

**Expected Results**:
- All 10 transfers succeed
- Transaction array has 10 elements
- Final token file size proportional to transfer count
- All proofs validate

**Cleanup**: Remove all test files

---

### PERF-004: Inclusion Proof Wait Time

**Description**: Measure time to receive inclusion proof

**Priority**: P2 (Medium)

**Execution Steps**:
```bash
# Measure time from submission to proof received
SECRET="test-secret" npm run mint-token -- --preset nft --save
```

**Expected Results**:
- Inclusion proof received in < 10 seconds (typical)
- Times out after 60 seconds (configured timeout)
- Time varies by network load

**Cleanup**: Remove test files

---

### PERF-005: Parallel Transfers (10 Concurrent)

**Description**: Send 10 different tokens simultaneously

**Priority**: P3 (Low)

**Setup**:
```bash
# Mint 10 tokens
for i in {1..10}; do
  SECRET="alice-secret-$i" npm run mint-token -- \
    --preset nft \
    -o "token-$i.txf"
done
```

**Execution Steps**:
```bash
#!/bin/bash
# Send all 10 in parallel
for i in {1..10}; do
  SECRET="alice-secret-$i" npm run send-token -- \
    -f "token-$i.txf" \
    -r "$BOB_ADDRESS" \
    -o "transfer-$i.txf" &
done
wait
```

**Expected Results**:
- All 10 transfers created successfully
- No race conditions
- Each transfer package valid

**Cleanup**: Remove all test files

---

## Test Execution Strategy

### Test Phases

#### Phase 1: Unit Tests (Command-Level)
**Duration**: ~2 hours
**Scope**: All GEN_ADDR, MINT_TOKEN, SEND_TOKEN, RECV_TOKEN, VERIFY_TOKEN tests
**Parallelizable**: Yes (most tests independent)

**Execution**:
```bash
# Run all unit tests
npm run test:unit

# Or specific suite
npm run test:unit -- --suite GEN_ADDR
npm run test:unit -- --suite MINT_TOKEN
```

---

#### Phase 2: Integration Tests
**Duration**: ~3 hours
**Scope**: All INTEGRATION tests
**Parallelizable**: Partial (some tests depend on network state)

**Execution**:
```bash
# Run integration tests
npm run test:integration

# Specific scenario
npm run test:integration -- --scenario INTEGRATION-001
```

---

#### Phase 3: Error and Edge Cases
**Duration**: ~1.5 hours
**Scope**: All ERROR tests
**Parallelizable**: Yes

**Execution**:
```bash
# Run error tests
npm run test:error
```

---

#### Phase 4: Performance Tests
**Duration**: ~1 hour
**Scope**: All PERF tests
**Parallelizable**: No (measures timing)

**Execution**:
```bash
# Run performance tests
npm run test:perf
```

---

### Test Execution Matrix

| Test Suite | Priority | Count | Duration | Parallelizable | Network Required |
|------------|----------|-------|----------|----------------|------------------|
| GEN_ADDR | P0 | 16 | 15 min | Yes | No |
| MINT_TOKEN | P0 | 20 | 40 min | Partial | Yes |
| SEND_TOKEN | P0 | 13 | 30 min | Partial | Yes |
| RECV_TOKEN | P0 | 7 | 25 min | Partial | Yes |
| VERIFY_TOKEN | P0 | 10 | 20 min | Yes | Yes |
| INTEGRATION | P0-P2 | 10 | 90 min | Partial | Yes |
| ERROR | P1-P2 | 15 | 45 min | Yes | Partial |
| PERF | P2-P3 | 5 | 60 min | No | Yes |
| **TOTAL** | - | **96** | **~6 hours** | - | - |

---

### Test Environments

#### Local Development
```bash
export SECRET="test-secret-dev"
export TRUSTBASE_PATH="./trustbase-local.json"
npm run test -- --env local
```

#### CI/CD Pipeline
```bash
# Use test network
export SECRET="ci-test-secret"
npm run test -- --env ci --network test
```

#### Production Validation
```bash
# Use production network (caution!)
npm run test -- --env prod --network production --subset smoke
```

---

### Test Automation

#### Test Script Structure

**File**: `scripts/run-tests.sh`

```bash
#!/bin/bash

# Test runner for Unicity Token CLI

set -e

NETWORK="${NETWORK:-local}"
SUITE="${SUITE:-all}"
PARALLEL="${PARALLEL:-false}"

echo "=== Unicity Token CLI Test Suite ==="
echo "Network: $NETWORK"
echo "Suite: $SUITE"
echo ""

# Setup test environment
setup_test_env() {
  export TEST_SECRET_ALICE="alice-test-secret-12345"
  export TEST_SECRET_BOB="bob-test-secret-67890"
  export TEST_SECRET_CAROL="carol-test-secret-abcdef"

  mkdir -p test-output
  cd test-output
}

# Cleanup
cleanup() {
  cd ..
  rm -rf test-output
}

trap cleanup EXIT

# Run test suite
setup_test_env

if [ "$SUITE" = "all" ] || [ "$SUITE" = "gen-address" ]; then
  echo "Running GEN_ADDR tests..."
  ./scripts/test-gen-address.sh
fi

if [ "$SUITE" = "all" ] || [ "$SUITE" = "mint-token" ]; then
  echo "Running MINT_TOKEN tests..."
  ./scripts/test-mint-token.sh
fi

# ... more suites ...

echo ""
echo "=== Test Summary ==="
echo "Total: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"
```

---

### Continuous Integration

#### GitHub Actions Workflow

**File**: `.github/workflows/test.yml`

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        suite: [gen-address, mint-token, send-token, receive-token, verify-token, integration]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build

      - name: Run tests
        run: |
          export SECRET="ci-test-secret-${{ matrix.suite }}"
          npm run test:${{ matrix.suite }}
        env:
          NETWORK: test

      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: test-results-${{ matrix.suite }}
          path: test-output/
```

---

## Success Criteria

### Critical Success Criteria (Must Pass)

1. **All P0 tests pass**: 100% of critical path tests succeed
   - All basic commands work (gen-address, mint-token, send-token, receive-token, verify-token)
   - Complete offline transfer flow (INTEGRATION-001)
   - Multi-hop transfer (INTEGRATION-002)

2. **No data loss**: Tokens are never lost or corrupted during operations

3. **Security validated**:
   - Secrets never exposed in output files
   - Transfer packages sanitized correctly
   - Address verification prevents wrong recipient

4. **Proof validation works**: All inclusion proofs validate correctly

5. **Network compatibility**: Works with both local and production aggregators

---

### High Priority Success Criteria (Should Pass)

1. **90% of P1 tests pass**: Most important scenarios covered

2. **Error handling robust**:
   - Graceful error messages for common failures
   - No crashes or undefined behavior
   - Clear user guidance on errors

3. **All token types supported**:
   - NFT, UCT, USDU, EURU, ALPHA, Custom all work
   - Both masked and unmasked addresses function

4. **Performance acceptable**:
   - Mint < 5 seconds average
   - Transfer < 10 seconds average
   - Inclusion proof < 30 seconds typical

---

### Medium Priority Success Criteria (Nice to Have)

1. **75% of P2 tests pass**: Edge cases mostly covered

2. **Performance optimized**:
   - Large data handling works
   - Multiple transfers efficient

3. **Documentation accurate**: All test scenarios match actual behavior

---

### Low Priority Success Criteria (Future Work)

1. **50% of P3 tests pass**: Advanced scenarios explored

2. **Load testing completed**: System behavior under stress characterized

3. **Automation complete**: Full CI/CD pipeline operational

---

## Test Maintenance

### Test Data Management

```bash
# Generate test data
npm run test:generate-data

# Clean test data
npm run test:clean

# Reset test environment
npm run test:reset
```

---

### Test Reporting

#### Test Report Format

```json
{
  "summary": {
    "total": 96,
    "passed": 94,
    "failed": 2,
    "skipped": 0,
    "duration": "6h 15m"
  },
  "suites": [
    {
      "name": "GEN_ADDR",
      "tests": 16,
      "passed": 16,
      "failed": 0,
      "duration": "15m"
    },
    // ... more suites
  ],
  "failures": [
    {
      "test": "MINT_TOKEN-012",
      "error": "Network timeout",
      "details": "..."
    }
  ]
}
```

---

### Test Coverage Tracking

Track which scenarios are implemented:

| Category | Total | Implemented | Coverage |
|----------|-------|-------------|----------|
| Command Unit Tests | 66 | 0 | 0% |
| Integration Tests | 10 | 0 | 0% |
| Error Tests | 15 | 0 | 0% |
| Performance Tests | 5 | 0 | 0% |
| **Overall** | **96** | **0** | **0%** |

---

## Appendix

### Test Naming Convention

**Format**: `SUITE_ID-NNN: Description`

- **SUITE_ID**: Short identifier (GEN_ADDR, MINT_TOKEN, etc.)
- **NNN**: Three-digit number (001, 002, ...)
- **Description**: Clear, concise summary

**Examples**:
- `GEN_ADDR-001: Generate Unmasked Address with Default Preset`
- `INTEGRATION-005: Postponed Commitment Chain (2-Level)`

---

### Test Priority Definitions

- **P0 (Critical)**: Core functionality, must work for basic operation
- **P1 (High)**: Important features, should work for production readiness
- **P2 (Medium)**: Edge cases, nice to have for robustness
- **P3 (Low)**: Performance/optimization, future improvements

---

### Test Execution Logs

Each test should produce structured logs:

```
[2025-11-03 14:30:45] [GEN_ADDR-001] START
[2025-11-03 14:30:45] [GEN_ADDR-001] Executing: SECRET="test-secret-001" npm run gen-address
[2025-11-03 14:30:46] [GEN_ADDR-001] Expected: type=unmasked, tokenType=455ad872...
[2025-11-03 14:30:46] [GEN_ADDR-001] Actual: type=unmasked, tokenType=455ad872...
[2025-11-03 14:30:46] [GEN_ADDR-001] PASS (1.2s)
```

---

### Quick Reference: Test Command Matrix

| Command | Token Types | Address Types | Networks | Patterns | Total Combos |
|---------|-------------|---------------|----------|----------|--------------|
| gen-address | 6 | 2 | - | - | 12 |
| mint-token | 6 | 2 | 3 | - | 36 |
| send-token | 6 | 2 | 3 | 2 | 72 |
| receive-token | 6 | 2 | 3 | - | 36 |
| verify-token | 6 | 2 | 3 | - | 36 |

---

## Conclusion

This test scenarios document provides a comprehensive framework for testing the Unicity Token CLI. The **96 test scenarios** cover all major functionality, token types, address types, transaction flows, and error conditions.

**Key Takeaways**:

1. **Complete Coverage**: All commands, token types, and workflows tested
2. **Structured Approach**: Clear test IDs, priorities, and execution steps
3. **Realistic Scenarios**: Based on actual user workflows and use cases
4. **Error Handling**: Extensive negative testing for robustness
5. **Performance Baseline**: Load and performance tests for optimization

**Next Steps**:

1. Implement test automation scripts
2. Set up CI/CD pipeline
3. Execute test suites and track results
4. Iterate based on failures and feedback
5. Maintain test scenarios as CLI evolves

---

**Document Version**: 1.0
**Last Updated**: 2025-11-03
**Authors**: Claude Code (AI Test Automation Engineer)
**Status**: Complete - Ready for Implementation
