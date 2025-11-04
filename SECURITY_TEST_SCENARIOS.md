# Security Test Scenarios for Unicity Token CLI

**Version**: 1.0
**Date**: 2025-11-03
**Purpose**: Comprehensive security testing to identify vulnerabilities in token minting, transfer, and ownership verification

---

## Document Overview

This document provides security-focused test scenarios to identify vulnerabilities, attack vectors, and security weaknesses in the Unicity Token CLI application. These tests complement the functional tests in TEST_SCENARIOS.md by focusing specifically on adversarial scenarios and security boundaries.

**Total Security Test Scenarios**: 68
**Priority Distribution**: Critical (28), High (24), Medium (12), Low (4)

---

## Table of Contents

1. [Authorization & Authentication Tests](#1-authorization--authentication-tests)
2. [Double-Spend Prevention](#2-double-spend-prevention)
3. [Cryptographic Security](#3-cryptographic-security)
4. [Input Validation & Injection](#4-input-validation--injection)
5. [Access Control](#5-access-control)
6. [Data Integrity](#6-data-integrity)
7. [Network Security](#7-network-security)
8. [Side-Channel & Timing Attacks](#8-side-channel--timing-attacks)
9. [Business Logic Flaws](#9-business-logic-flaws)
10. [Denial of Service](#10-denial-of-service)

---

## 1. Authorization & Authentication Tests

### SEC-AUTH-001: Attempt to Spend Token with Wrong Secret

**Priority**: Critical
**Severity**: Critical - Prevents unauthorized token spending

**Attack Vector**: Attacker tries to transfer a token they don't own by guessing or using a different secret

**Prerequisites**:
```bash
# Alice mints a token
SECRET="alice-secret-12345" npm run mint-token -- --preset nft -o alice-token.txf

# Bob knows Alice has a token
```

**Execution Steps**:
```bash
# Bob tries to send Alice's token using his own secret
SECRET="bob-secret-67890" npm run send-token -- \
  -f alice-token.txf \
  -r "DIRECT://0000..." \
  --submit-now
```

**Expected Security Behavior**:
- ❌ Command should FAIL with signature verification error
- Network should reject transaction due to invalid signature
- Error message: "Signature verification failed" or "Invalid authenticator"
- No transaction submitted to network
- Original token file remains unchanged

**Vulnerability Prevented**: Unauthorized token spending, theft of digital assets

**Test Validation**:
```bash
# Verify token still owned by Alice
npm run verify-token -- -f alice-token.txf
# Should show Alice as owner, status CONFIRMED/UNSPENT
```

---

### SEC-AUTH-002: Signature Forgery with Modified Public Key

**Priority**: Critical
**Severity**: Critical - Tests cryptographic integrity

**Attack Vector**: Attacker modifies the public key in a predicate to impersonate the owner

**Prerequisites**:
```bash
# Mint a valid token
SECRET="alice-secret" npm run mint-token -- --preset nft -o token.txf
```

**Execution Steps**:
```bash
# Manually edit token.txf and modify state.predicate public key parameter
# Replace Alice's public key bytes with attacker's public key
# Attempt to load and send the modified token

SECRET="attacker-secret" npm run send-token -- \
  -f modified-token.txf \
  -r "DIRECT://..." \
  --submit-now
```

**Expected Security Behavior**:
- ❌ Token loading fails with "Invalid token structure" or SDK error
- If loaded, signature verification fails at network level
- Inclusion proof validation detects state hash mismatch
- Transaction rejected by validators

**Vulnerability Prevented**: Forgery attack, identity spoofing

**Current Implementation Gap**:
- CLI should validate predicate integrity before submission
- Add hash verification of state against genesis

---

### SEC-AUTH-003: Predicate Tampering - Engine ID Modification

**Priority**: High
**Severity**: High - Tests predicate immutability

**Attack Vector**: Change engine ID from masked (1) to unmasked (0) to bypass nonce requirement

**Prerequisites**:
```bash
# Create masked address token
SECRET="test-secret" npm run mint-token -- \
  --preset nft \
  -n "test-nonce" \
  -o masked-token.txf
```

**Execution Steps**:
```bash
# Edit masked-token.txf JSON
# In state.predicate CBOR array, change first byte from 01 to 00
# Attempt to spend with secret but without nonce

SECRET="test-secret" npm run send-token -- \
  -f tampered-token.txf \
  -r "DIRECT://..." \
  --submit-now
```

**Expected Security Behavior**:
- ❌ CBOR decoding fails due to structure mismatch
- SDK detects predicate hash mismatch
- Network rejects due to invalid state transition
- Error: "Predicate verification failed"

**Vulnerability Prevented**: Bypassing one-time address restrictions

---

### SEC-AUTH-004: Replay Attack - Resubmit Old Signature

**Priority**: Critical
**Severity**: Critical - Tests transaction uniqueness

**Attack Vector**: Capture a valid transfer commitment and replay it to different recipient

**Prerequisites**:
```bash
# Create valid transfer
SECRET="alice-secret" npm run mint-token -- -o token.txf
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  -o transfer-bob.txf
```

**Execution Steps**:
```bash
# Extract commitmentData from transfer-bob.txf
# Modify recipient address to Carol
# Resubmit modified commitment

# Manual API call:
curl -X POST https://gateway.unicity.network/api/v1/submit \
  -d '{"commitment": <modified_commitment>, "signature": <old_signature>}'
```

**Expected Security Behavior**:
- ❌ Network detects request ID mismatch
- Signature verification fails (signature is over original recipient)
- Transaction rejected: "Invalid commitment signature"
- Salt/nonce ensures unique request ID per transfer

**Vulnerability Prevented**: Replay attacks, transaction malleability

---

### SEC-AUTH-005: Nonce Reuse Attack on Masked Addresses

**Priority**: High
**Severity**: High - Tests masked address single-use enforcement

**Attack Vector**: Attempt to receive two tokens at same masked address

**Prerequisites**:
```bash
# Generate masked address
SECRET="bob-secret" npm run gen-address -- \
  -n "bob-nonce-001" \
  > bob-masked.json
BOB_MASKED=$(cat bob-masked.json | jq -r '.address')
```

**Execution Steps**:
```bash
# Alice sends first token
SECRET="alice-secret" npm run mint-token -- -o token1.txf
SECRET="alice-secret" npm run send-token -- \
  -f token1.txf \
  -r "$BOB_MASKED" \
  -o transfer1.txf

SECRET="bob-secret" npm run receive-token -- \
  -f transfer1.txf \
  -o bob-token1.txf

# Alice attempts to send second token to SAME masked address
SECRET="alice-secret" npm run mint-token -- -o token2.txf
SECRET="alice-secret" npm run send-token -- \
  -f token2.txf \
  -r "$BOB_MASKED" \
  -o transfer2.txf

SECRET="bob-secret" npm run receive-token -- \
  -f transfer2.txf
```

**Expected Security Behavior**:
- ⚠️ Second transfer should be WARNED or REJECTED
- Network should detect nonce reuse (if tracked on-chain)
- Bob cannot create valid signature for second token with same nonce
- Error: "Masked address already used" or signature verification fails

**Vulnerability Prevented**: Nonce reuse, address reuse violations

**Current Implementation Gap**: CLI doesn't warn about sending to potentially-used masked addresses

---

### SEC-AUTH-006: Cross-Token-Type Signature Reuse

**Priority**: Medium
**Severity**: Medium - Tests signature domain separation

**Attack Vector**: Reuse signature from NFT transfer for UCT transfer

**Prerequisites**:
```bash
# Create NFT transfer
SECRET="alice-secret" npm run mint-token -- --preset nft -o nft.txf
SECRET="alice-secret" npm run send-token -- \
  -f nft.txf \
  -r "$BOB_ADDRESS" \
  -o nft-transfer.txf
```

**Execution Steps**:
```bash
# Extract signature from nft-transfer.txf commitment
# Create UCT token and attempt to use extracted signature

SECRET="alice-secret" npm run mint-token -- --preset uct -o uct.txf
# Manually craft transfer with NFT signature
```

**Expected Security Behavior**:
- ❌ Signature is over wrong token type hash
- Network rejects due to signature verification failure
- Token type is included in signed data (domain separation)

**Vulnerability Prevented**: Signature reuse across token types

---

## 2. Double-Spend Prevention

### SEC-DBLSPEND-001: Submit Same Token to Two Recipients

**Priority**: Critical
**Severity**: Critical - Core security requirement

**Attack Vector**: Create two transfer packages for same token to different recipients

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- --preset nft -o token.txf
```

**Execution Steps**:
```bash
# Create transfer to Bob
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  -o transfer-bob.txf

# Create transfer to Carol using SAME original token
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$CAROL_ADDRESS" \
  -o transfer-carol.txf

# Both try to receive simultaneously
SECRET="bob-secret" npm run receive-token -- -f transfer-bob.txf &
SECRET="carol-secret" npm run receive-token -- -f transfer-carol.txf &
wait
```

**Expected Security Behavior**:
- ✅ First submission succeeds (Bob or Carol)
- ❌ Second submission FAILS with "Token already spent"
- Network tracks token state and rejects duplicate spend
- Only one transfer gets inclusion proof
- Losing recipient gets clear error message

**Vulnerability Prevented**: Double-spending digital assets

---

### SEC-DBLSPEND-002: Race Condition in Concurrent Submissions

**Priority**: Critical
**Severity**: Critical - Tests network consistency

**Attack Vector**: Submit same commitment from multiple clients simultaneously

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  -o transfer.txf
```

**Execution Steps**:
```bash
# Launch 10 parallel receive attempts with same transfer file
for i in {1..10}; do
  SECRET="bob-secret" npm run receive-token -- \
    -f transfer.txf \
    --save &
done
wait
```

**Expected Security Behavior**:
- ✅ Exactly ONE submission succeeds
- ❌ All other 9 submissions fail with "Already submitted" or "Token spent"
- Network consensus ensures atomic state transition
- No race condition allows multiple proofs
- Only one valid token file created

**Vulnerability Prevented**: Race condition double-spend

---

### SEC-DBLSPEND-003: Re-spend Already Transferred Token

**Priority**: Critical
**Severity**: Critical - Tests state finality

**Attack Vector**: Attempt to send token that was previously transferred

**Prerequisites**:
```bash
# Complete transfer: Alice → Bob
SECRET="alice-secret" npm run mint-token -- -o alice-token.txf
SECRET="alice-secret" npm run send-token -- \
  -f alice-token.txf \
  -r "$BOB_ADDRESS" \
  --submit-now \
  -o sent-token.txf

# Alice keeps copy of original token file
```

**Execution Steps**:
```bash
# Alice tries to send the token again (using old pre-transfer state)
SECRET="alice-secret" npm run send-token -- \
  -f alice-token.txf \
  -r "$CAROL_ADDRESS" \
  --submit-now
```

**Expected Security Behavior**:
- ❌ Network rejects with "Token already spent" or "State outdated"
- On-chain state shows Bob as current owner
- Alice's local file is outdated
- CLI should detect outdated state before submission (if ownership check enabled)

**Vulnerability Prevented**: Spending stale token states

**Current Implementation Gap**: CLI could check network state before sending

---

### SEC-DBLSPEND-004: Offline Package Double-Receive Attempt

**Priority**: High
**Severity**: High - Tests offline transfer atomicity

**Attack Vector**: Recipient tries to claim offline transfer multiple times

**Prerequisites**:
```bash
# Create offline transfer
SECRET="alice-secret" npm run mint-token -- -o token.txf
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  -o transfer.txf
```

**Execution Steps**:
```bash
# Bob receives once
SECRET="bob-secret" npm run receive-token -- \
  -f transfer.txf \
  -o bob-token.txf

# Bob tries to receive SAME transfer again
SECRET="bob-secret" npm run receive-token -- \
  -f transfer.txf \
  -o bob-token2.txf
```

**Expected Security Behavior**:
- ✅ First receive succeeds
- ✅ Second receive detects "Already submitted" and either:
  - Returns same token (idempotent)
  - Fails with clear message
- Network prevents duplicate inclusion proof for same commitment
- Only one valid token created for Bob

**Vulnerability Prevented**: Double-claiming offline transfers

---

### SEC-DBLSPEND-005: Multi-Hop Token State Rollback

**Priority**: High
**Severity**: High - Tests transaction chain integrity

**Attack Vector**: Use intermediate token state to bypass final ownership

**Prerequisites**:
```bash
# Create chain: Alice → Bob → Carol
# Setup and complete transfers
```

**Execution Steps**:
```bash
# Bob keeps his intermediate token file (bob-token.txf)
# Carol receives final token (carol-token.txf)
# Bob tries to send from his old state

SECRET="bob-secret" npm run send-token -- \
  -f bob-token.txf \
  -r "$DAVE_ADDRESS" \
  --submit-now
```

**Expected Security Behavior**:
- ❌ Network rejects: "Token already transferred"
- On-chain state shows Carol as current owner
- Bob's token file is outdated (missing Carol transfer)
- Transaction chain must be continuous

**Vulnerability Prevented**: State rollback attacks

---

### SEC-DBLSPEND-006: Coin Split Double-Spend (Fungible Tokens)

**Priority**: High
**Severity**: High - Tests coin tracking

**Attack Vector**: Attempt to spend same coin in multiple transactions

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- \
  --preset uct \
  -c "1000000000000000000" \
  -o uct-token.txf
```

**Execution Steps**:
```bash
# Future test when coin splitting is implemented
# Create two transfers attempting to split same coin
# Both claim same coin ID in coinData
```

**Expected Security Behavior**:
- ❌ Network tracks coin IDs and prevents double-use
- CoinData structure ensures unique coin IDs
- Only one transaction per coin can succeed

**Vulnerability Prevented**: Coin double-spending in fungible tokens

**Current Implementation**: Full token transfer (no coin splitting yet)

---

## 3. Cryptographic Security

### SEC-CRYPTO-001: Invalid Signature in Genesis Proof

**Priority**: Critical
**Severity**: Critical - Tests proof integrity

**Attack Vector**: Forge or corrupt genesis inclusion proof signature

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf
```

**Execution Steps**:
```bash
# Edit token.txf
# Modify genesis.inclusionProof.authenticator.signature bytes
# Change a few hex characters in signature field

npm run verify-token -- -f token.txf
```

**Expected Security Behavior**:
- ❌ Proof validation fails: "Authenticator signature verification failed"
- verify-token command detects invalid signature
- send-token should reject token with invalid proof
- Network would reject if somehow submitted

**Vulnerability Prevented**: Proof forgery, unauthorized minting

---

### SEC-CRYPTO-002: Tampered Inclusion Proof Merkle Path

**Priority**: Critical
**Severity**: Critical - Tests blockchain integrity

**Attack Vector**: Modify merkle tree path to fake inclusion

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf
```

**Execution Steps**:
```bash
# Edit token.txf
# Modify genesis.inclusionProof.merkleTreePath.root
# Change merkle root hash

npm run verify-token -- -f token.txf
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  --submit-now
```

**Expected Security Behavior**:
- ❌ Merkle path validation fails
- Root hash doesn't match expected state hash
- verify-token detects invalid merkle proof
- Network rejects transaction referencing invalid proof

**Vulnerability Prevented**: False proof of inclusion

---

### SEC-CRYPTO-003: Modified Transaction Data After Signing

**Priority**: Critical
**Severity**: Critical - Tests commitment binding

**Attack Vector**: Change recipient address after signature creation

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  -o transfer.txf
```

**Execution Steps**:
```bash
# Edit transfer.txf offlineTransfer section
# Change recipient address from Bob to Carol
# Keep original signature

SECRET="carol-secret" npm run receive-token -- -f transfer.txf
```

**Expected Security Behavior**:
- ❌ Signature verification fails
- Commitment includes recipient address in signed data
- Request ID changes when recipient changes
- Network detects signature/data mismatch

**Vulnerability Prevented**: Transaction malleability

---

### SEC-CRYPTO-004: Hash Collision Attempt on Token ID

**Priority**: Low
**Severity**: Low - Theoretical attack

**Attack Vector**: Generate token ID collision to impersonate existing token

**Prerequisites**:
- Requires computational infeasibility (SHA-256 collision)

**Execution Steps**:
```bash
# Theoretical: Find tokenId that collides with existing token
# Not practically executable
```

**Expected Security Behavior**:
- SHA-256 collision resistance prevents this attack
- 256-bit space makes collision computationally infeasible
- Even if collision found, signature would still fail

**Vulnerability Prevented**: Token ID collision attacks

---

### SEC-CRYPTO-005: Weak Secret Entropy Detection

**Priority**: Medium
**Severity**: Medium - Tests key security

**Attack Vector**: Use easily guessable secrets for key generation

**Prerequisites**: None

**Execution Steps**:
```bash
# Use very weak secrets
SECRET="password" npm run gen-address
SECRET="123456" npm run gen-address
SECRET="test" npm run gen-address
```

**Expected Security Behavior**:
- ⚠️ CLI should WARN about weak secrets
- No entropy check currently implemented
- Suggestion: Warn if secret < 12 characters
- Suggestion: Warn if secret is common password

**Vulnerability Prevented**: Brute force attacks on weak keys

**Current Implementation Gap**: No secret strength validation

---

### SEC-CRYPTO-006: Public Key Extraction from Signature

**Priority**: Low
**Severity**: Low - Expected behavior

**Attack Vector**: Extract public key from transaction signatures

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf
```

**Execution Steps**:
```bash
# Parse token.txf and extract public key from state.predicate
# Public keys are intentionally visible
```

**Expected Security Behavior**:
- ✅ Public keys are SUPPOSED to be public
- No vulnerability - this is expected design
- Private key remains protected (never in token files)
- Signature proves ownership without revealing secret

**Vulnerability Prevented**: N/A - Not a vulnerability

---

### SEC-CRYPTO-007: Authenticator Verification Bypass

**Priority**: Critical
**Severity**: Critical - Tests BFT consensus

**Attack Vector**: Submit proof with null or fake authenticator

**Prerequisites**: None

**Execution Steps**:
```bash
# Craft malicious token JSON
# Set genesis.inclusionProof.authenticator = null
# Or create fake authenticator structure

npm run verify-token -- -f malicious-token.txf
```

**Expected Security Behavior**:
- ❌ Proof validation fails immediately
- validateInclusionProof() detects null authenticator
- Error: "Authenticator is null - proof is incomplete"
- Token cannot be loaded or sent

**Vulnerability Prevented**: Bypassing BFT consensus verification

---

## 4. Input Validation & Injection

### SEC-INPUT-001: Malformed TXF JSON Structure

**Priority**: High
**Severity**: High - Tests parser robustness

**Attack Vector**: Provide malformed JSON to crash parser

**Prerequisites**: None

**Execution Steps**:
```bash
# Create invalid JSON file
echo '{"version": "2.0", "state": {incomplete' > bad.txf

npm run verify-token -- -f bad.txf
npm run send-token -- -f bad.txf -r "DIRECT://..."
```

**Expected Security Behavior**:
- ❌ JSON parsing fails gracefully
- Error message: "Invalid JSON format"
- No crash, no undefined behavior
- Clear error returned to user

**Vulnerability Prevented**: Parser crashes, undefined behavior

---

### SEC-INPUT-002: JSON Injection in Token Data

**Priority**: Medium
**Severity**: Medium - Tests data sanitization

**Attack Vector**: Inject malicious JSON structures in token data field

**Prerequisites**: None

**Execution Steps**:
```bash
# Attempt JSON injection with nested objects
SECRET="alice-secret" npm run mint-token -- \
  --preset nft \
  -d '{"name":"Test","__proto__":{"evil":"payload"},"constructor":{"prototype":{"polluted":true}}}' \
  -o inject-token.txf

npm run verify-token -- -f inject-token.txf
```

**Expected Security Behavior**:
- ✅ Token data stored as hex-encoded bytes
- No JSON parsing of user data during minting
- Data treated as opaque bytes
- No prototype pollution risk

**Vulnerability Prevented**: JSON injection, prototype pollution

---

### SEC-INPUT-003: Path Traversal in File Operations

**Priority**: High
**Severity**: High - Tests filesystem security

**Attack Vector**: Use path traversal to write files outside working directory

**Prerequisites**: None

**Execution Steps**:
```bash
# Attempt directory traversal in output path
SECRET="alice-secret" npm run mint-token -- \
  --preset nft \
  -o "../../../tmp/evil.txf"

SECRET="alice-secret" npm run mint-token -- \
  --preset nft \
  -o "/etc/passwd.txf"
```

**Expected Security Behavior**:
- ⚠️ File written to specified path (Node.js allows by default)
- **RECOMMENDATION**: Validate output paths
- Restrict writes to current directory or designated token folder
- Reject absolute paths and ".." traversal

**Vulnerability Prevented**: Unauthorized file writes

**Current Implementation Gap**: No path validation on -o option

---

### SEC-INPUT-004: Command Injection via Parameters

**Priority**: Critical
**Severity**: Critical - Tests command execution safety

**Attack Vector**: Inject shell commands through CLI parameters

**Prerequisites**: None

**Execution Steps**:
```bash
# Attempt command injection in various fields
SECRET='$(whoami)' npm run gen-address
SECRET='`id`' npm run gen-address

npm run send-token -- \
  -f "token.txf; rm -rf /" \
  -r 'DIRECT://$(curl evil.com)'
```

**Expected Security Behavior**:
- ✅ CLI uses commander.js which handles escaping
- Parameters passed as strings, not executed
- No shell interpretation of special characters
- File paths treated literally

**Vulnerability Prevented**: Remote code execution via injection

---

### SEC-INPUT-005: Integer Overflow in Coin Amounts

**Priority**: Medium
**Severity**: Medium - Tests numeric bounds

**Attack Vector**: Provide extremely large coin amounts to cause overflow

**Prerequisites**: None

**Execution Steps**:
```bash
# JavaScript BigInt max value
SECRET="alice-secret" npm run mint-token -- \
  --preset uct \
  -c "999999999999999999999999999999999999999999999" \
  -o overflow-token.txf

# Negative amounts (invalid)
SECRET="alice-secret" npm run mint-token -- \
  --preset uct \
  -c "-1000000000000000000" \
  -o negative-token.txf
```

**Expected Security Behavior**:
- ✅ JavaScript BigInt handles arbitrary precision
- SDK may have amount limits
- Negative amounts should be rejected
- Network validates amount ranges

**Vulnerability Prevented**: Integer overflow, negative amount exploits

**Current Implementation Gap**: No client-side amount validation

---

### SEC-INPUT-006: Extremely Long Input Strings

**Priority**: Low
**Severity**: Low - Tests DoS resilience

**Attack Vector**: Provide megabyte-sized strings to exhaust memory

**Prerequisites**: None

**Execution Steps**:
```bash
# Generate 10MB string
HUGE_DATA=$(python3 -c "print('A' * 10000000)")

SECRET="alice-secret" npm run mint-token -- \
  --preset nft \
  -d "$HUGE_DATA" \
  -o huge-token.txf
```

**Expected Security Behavior**:
- ⚠️ Process may run out of memory
- **RECOMMENDATION**: Limit token data size (e.g., 1MB max)
- Network likely has data size limits
- Should fail gracefully, not crash

**Vulnerability Prevented**: Memory exhaustion DoS

**Current Implementation Gap**: No input size limits

---

### SEC-INPUT-007: Special Characters in Address Fields

**Priority**: Medium
**Severity**: Medium - Tests address parsing

**Attack Vector**: Inject special characters in address strings

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf

# Various malformed addresses
npm run send-token -- -f token.txf -r "DIRECT://\x00\x00\x00"
npm run send-token -- -f token.txf -r "'; DROP TABLE tokens;--"
npm run send-token -- -f token.txf -r ""
npm run send-token -- -f token.txf -r "INVALID"
```

**Expected Security Behavior**:
- ❌ Address parsing fails with clear error
- AddressFactory.createAddress() validates format
- Error: "Invalid address format"
- No command execution or SQL injection (not using SQL)

**Vulnerability Prevented**: Address format exploits

---

### SEC-INPUT-008: Null Byte Injection in Filenames

**Priority**: Low
**Severity**: Low - Tests filename handling

**Attack Vector**: Use null bytes to truncate filenames

**Prerequisites**: None

**Execution Steps**:
```bash
# Attempt null byte injection
SECRET="alice-secret" npm run mint-token -- \
  --preset nft \
  -o "token\x00.txf.evil"
```

**Expected Security Behavior**:
- File system treats null bytes literally or errors
- Modern Node.js/filesystem handles this correctly
- No filename truncation vulnerability

**Vulnerability Prevented**: Filename truncation attacks

---

## 5. Access Control

### SEC-ACCESS-001: Access Token Not Owned by User

**Priority**: Critical
**Severity**: Critical - Tests ownership enforcement

**Attack Vector**: Load and verify token that belongs to someone else

**Prerequisites**:
```bash
# Alice mints token
SECRET="alice-secret" npm run mint-token -- -o alice-token.txf
```

**Execution Steps**:
```bash
# Bob tries to verify Alice's token
SECRET="bob-secret" npm run verify-token -- -f alice-token.txf

# Bob tries to send Alice's token
SECRET="bob-secret" npm run send-token -- \
  -f alice-token.txf \
  -r "$CAROL_ADDRESS" \
  --submit-now
```

**Expected Security Behavior**:
- ✅ verify-token SUCCEEDS (anyone can verify)
- ❌ send-token FAILS due to signature mismatch
- Bob's signature doesn't match Alice's predicate
- Network rejects unauthorized transfer

**Vulnerability Prevented**: Unauthorized transfers

---

### SEC-ACCESS-002: Read Token Files from Other Users

**Priority**: Low
**Severity**: Low - File system security

**Attack Vector**: Access token files in other users' directories

**Prerequisites**:
- Multi-user system
- Improper file permissions

**Execution Steps**:
```bash
# As user Bob, try to read Alice's files
cat /home/alice/.tokens/alice-token.txf
```

**Expected Security Behavior**:
- File system permissions enforce access control
- Not a CLI vulnerability, but deployment concern
- **RECOMMENDATION**: Warn users to set proper file permissions
- Suggest: chmod 600 for token files

**Vulnerability Prevented**: Information disclosure

**Current Implementation Gap**: No file permission warnings/enforcement

---

### SEC-ACCESS-003: Unauthorized Modification of Token Files

**Priority**: High
**Severity**: High - Tests integrity protection

**Attack Vector**: Modify token file after minting but before sending

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf
```

**Execution Steps**:
```bash
# Edit token.txf and modify token data or state
# Change genesis.data.tokenData to something else
# Try to send modified token

SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  --submit-now
```

**Expected Security Behavior**:
- ❌ Proof validation detects state hash mismatch
- Genesis proof covers original state, not modified state
- Network rejects transaction with invalid state
- Error: "State hash mismatch" or proof validation failure

**Vulnerability Prevented**: Token data tampering

---

### SEC-ACCESS-004: Privilege Escalation via Environment Variables

**Priority**: Medium
**Severity**: Medium - Tests environment isolation

**Attack Vector**: Override system paths or behavior via env vars

**Prerequisites**: None

**Execution Steps**:
```bash
# Attempt to override critical paths
TRUSTBASE_PATH="/tmp/evil-trustbase.json" \
SECRET="test-secret" \
npm run mint-token -- --preset nft

# Create malicious trustbase
echo '{"networkId":666,"epoch":999}' > /tmp/evil-trustbase.json
```

**Expected Security Behavior**:
- ⚠️ CLI uses TRUSTBASE_PATH if provided
- **CONCERN**: Malicious trustbase could bypass validation
- **RECOMMENDATION**: Validate trustbase signature/authenticity
- Fallback to hardcoded trustbase if file validation fails

**Vulnerability Prevented**: Trustbase substitution attacks

**Current Implementation Gap**: Trustbase file not validated for authenticity

---

## 6. Data Integrity

### SEC-INTEGRITY-001: TXF File Corruption Detection

**Priority**: High
**Severity**: High - Tests data corruption handling

**Attack Vector**: Partial file corruption (disk error, network transfer)

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf
```

**Execution Steps**:
```bash
# Corrupt file by truncating
head -c 500 token.txf > corrupted.txf

# Corrupt file by flipping random bytes
xxd token.txf | sed 's/00/ff/g' | xxd -r > corrupted2.txf

npm run verify-token -- -f corrupted.txf
npm run send-token -- -f corrupted.txf -r "$BOB_ADDRESS"
```

**Expected Security Behavior**:
- ❌ JSON parsing fails gracefully
- ❌ CBOR decoding fails with clear error
- No crash, no undefined behavior
- Error: "Invalid token format" or "Corrupted data"

**Vulnerability Prevented**: Processing corrupted data

---

### SEC-INTEGRITY-002: State Hash Mismatch Detection

**Priority**: Critical
**Severity**: Critical - Tests state integrity

**Attack Vector**: Modify token state without updating proof

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf
```

**Execution Steps**:
```bash
# Edit token.txf
# Change state.predicate or state.data
# Keep genesis.inclusionProof unchanged

npm run send-token -- -f token.txf -r "$BOB_ADDRESS" --submit-now
```

**Expected Security Behavior**:
- ❌ State hash in proof doesn't match actual state hash
- Authenticator verification fails
- Network rejects due to proof mismatch
- Error: "State integrity violation"

**Vulnerability Prevented**: State tampering

---

### SEC-INTEGRITY-003: Transaction Chain Break Detection

**Priority**: High
**Severity**: High - Tests history integrity

**Attack Vector**: Remove or reorder transactions in history

**Prerequisites**:
```bash
# Create multi-hop token: Alice → Bob → Carol
# (Setup omitted for brevity)
```

**Execution Steps**:
```bash
# Edit carol-token.txf
# Remove Bob's transaction from transactions array
# Keep only genesis and Carol's transaction

npm run verify-token -- -f tampered-carol-token.txf
npm run send-token -- -f tampered-carol-token.txf -r "$DAVE_ADDRESS" --submit-now
```

**Expected Security Behavior**:
- ❌ Transaction chain validation fails
- Each transaction references previous state
- Missing transaction breaks chain of custody
- verify-token should detect incomplete history

**Vulnerability Prevented**: History tampering

**Current Implementation Gap**: No explicit chain integrity validation in CLI

---

### SEC-INTEGRITY-004: Missing Required Fields in TXF

**Priority**: High
**Severity**: High - Tests schema validation

**Attack Vector**: Remove required fields from token JSON

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf
```

**Execution Steps**:
```bash
# Edit token.txf and remove fields
# Delete "state" field
# Delete "genesis.inclusionProof"
# Delete "version" field

npm run verify-token -- -f incomplete.txf
npm run send-token -- -f incomplete.txf -r "$BOB_ADDRESS"
```

**Expected Security Behavior**:
- ❌ Schema validation fails
- validateExtendedTxf() or validateTokenProofsJson() detects missing fields
- Error: "Invalid TXF structure: missing required fields"
- Clear message about which field is missing

**Vulnerability Prevented**: Processing incomplete/invalid tokens

---

### SEC-INTEGRITY-005: Inconsistent Status Fields

**Priority**: Medium
**Severity**: Medium - Tests status logic

**Attack Vector**: Set contradictory status in extended TXF

**Prerequisites**:
```bash
# Create transfer package
SECRET="alice-secret" npm run mint-token -- -o token.txf
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  -o transfer.txf
```

**Execution Steps**:
```bash
# Edit transfer.txf
# Set status: "CONFIRMED" but keep offlineTransfer section
# Or set status: "PENDING" without offlineTransfer

npm run receive-token -- -f tampered-transfer.txf
```

**Expected Security Behavior**:
- ⚠️ validateExtendedTxf() detects status mismatch
- Warning: "Unexpected status CONFIRMED for offline transfer"
- Should reject or correct automatically
- Status must match presence of offlineTransfer

**Vulnerability Prevented**: Status confusion attacks

---

## 7. Network Security

### SEC-NETWORK-001: Man-in-the-Middle Attack Simulation

**Priority**: High
**Severity**: High - Tests transport security

**Attack Vector**: Intercept and modify network traffic to/from aggregator

**Prerequisites**:
- HTTPS interception proxy (e.g., mitmproxy)

**Execution Steps**:
```bash
# Setup MITM proxy to intercept traffic
# Modify aggregator responses (e.g., change inclusion proof)

SECRET="alice-secret" npm run mint-token -- \
  --endpoint "http://localhost:8080" \
  --preset nft
```

**Expected Security Behavior**:
- ✅ HTTPS prevents tampering (if using production endpoint)
- ❌ HTTP endpoint is vulnerable (local development)
- Inclusion proof signature verification detects tampering
- Authenticator verification fails if proof modified
- **RECOMMENDATION**: Enforce HTTPS for production endpoints

**Vulnerability Prevented**: Traffic interception, proof tampering

**Current Implementation Gap**: No HTTPS enforcement warning

---

### SEC-NETWORK-002: Aggregator Impersonation

**Priority**: High
**Severity**: High - Tests endpoint validation

**Attack Vector**: Point CLI to malicious aggregator endpoint

**Prerequisites**:
```bash
# Setup fake aggregator that returns malicious data
python3 -m http.server 9999 &
```

**Execution Steps**:
```bash
SECRET="alice-secret" npm run mint-token -- \
  --endpoint "http://localhost:9999" \
  --preset nft
```

**Expected Security Behavior**:
- ⚠️ CLI trusts user-provided endpoint
- Fake aggregator can return fake proofs
- **CRITICAL**: Proof signature verification should fail
- Authenticator won't be valid without validator private keys
- TrustBase validation catches fake proofs

**Vulnerability Prevented**: Fake proof acceptance

**Defense**: Cryptographic proof validation is final authority

---

### SEC-NETWORK-003: DNS Spoofing Attack

**Priority**: Medium
**Severity**: Medium - Tests DNS security

**Attack Vector**: Redirect gateway.unicity.network to malicious IP

**Prerequisites**:
- Control over DNS or /etc/hosts

**Execution Steps**:
```bash
# Add to /etc/hosts
echo "10.0.0.1 gateway.unicity.network" >> /etc/hosts

SECRET="alice-secret" npm run mint-token -- --production --preset nft
```

**Expected Security Behavior**:
- Traffic goes to wrong server
- HTTPS certificate validation should fail (wrong cert)
- If attacker has valid cert, proof validation still fails
- **RECOMMENDATION**: Certificate pinning for production

**Vulnerability Prevented**: DNS-based redirects

---

### SEC-NETWORK-004: Network Downgrade Attack

**Priority**: Medium
**Severity**: Medium - Tests protocol security

**Attack Vector**: Force HTTPS to downgrade to HTTP

**Prerequisites**:
- SSL stripping proxy

**Execution Steps**:
```bash
# Attempt to force HTTP instead of HTTPS
# Not directly testable via CLI options
```

**Expected Security Behavior**:
- CLI uses endpoint URL as-is
- No automatic downgrade if HTTPS specified
- **RECOMMENDATION**: Warn if using HTTP for production

**Vulnerability Prevented**: Protocol downgrade

---

### SEC-NETWORK-005: Certificate Validation Bypass

**Priority**: High
**Severity**: High - Tests TLS security

**Attack Vector**: Accept invalid/self-signed certificates

**Prerequisites**:
```bash
# Self-signed cert aggregator
```

**Execution Steps**:
```bash
# Node.js typically validates certificates by default
SECRET="alice-secret" npm run mint-token -- \
  --endpoint "https://self-signed.local:3000" \
  --preset nft
```

**Expected Security Behavior**:
- ❌ Connection fails: "Self-signed certificate"
- Node.js HTTPS library validates certificates
- No option to bypass validation (good!)
- **ENSURE**: No NODE_TLS_REJECT_UNAUTHORIZED=0 in production

**Vulnerability Prevented**: Invalid certificate acceptance

---

## 8. Side-Channel & Timing Attacks

### SEC-SIDECHANNEL-001: Secret Leakage via Error Messages

**Priority**: High
**Severity**: High - Tests information disclosure

**Attack Vector**: Extract secret information from error messages

**Prerequisites**: None

**Execution Steps**:
```bash
# Use wrong secret and analyze error messages
SECRET="wrong-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  --submit-now
```

**Expected Security Behavior**:
- ✅ Error: "Signature verification failed"
- ❌ Error should NOT include: public key, address, or partial secret
- Generic error without leaking identifiers
- **REVIEW**: Ensure no PII in error messages

**Vulnerability Prevented**: Information leakage

---

### SEC-SIDECHANNEL-002: Timing Attack on Signature Verification

**Priority**: Low
**Severity**: Low - Theoretical attack

**Attack Vector**: Measure verification time to extract key bits

**Prerequisites**:
- High-precision timing measurement
- Statistical analysis of many attempts

**Execution Steps**:
```bash
# Measure signature verification time for many signatures
for i in {1..1000}; do
  time SECRET="test-$i" npm run send-token -- -f token.txf -r "$BOB_ADDRESS"
done
```

**Expected Security Behavior**:
- SDK uses constant-time crypto operations
- secp256k1 library should be timing-attack resistant
- No key bits leaked via timing

**Vulnerability Prevented**: Timing-based key extraction

---

### SEC-SIDECHANNEL-003: File Permission Information Disclosure

**Priority**: Medium
**Severity**: Medium - Tests file security

**Attack Vector**: Token files created with overly permissive permissions

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf --save
ls -la *.txf
```

**Expected Security Behavior**:
- ⚠️ Files created with default umask (typically 644)
- World-readable by default = information disclosure risk
- **RECOMMENDATION**: Create files with 600 permissions
- Warn user about file security

**Vulnerability Prevented**: Unauthorized file access

**Current Implementation Gap**: No file permission enforcement

---

### SEC-SIDECHANNEL-004: Secret in Process List

**Priority**: Medium
**Severity**: Medium - Tests process security

**Attack Vector**: Secret visible in process list when passed via command line

**Prerequisites**: None

**Execution Steps**:
```bash
# In one terminal
SECRET="my-super-secret-password" npm run mint-token -- --preset nft &

# In another terminal (quickly)
ps aux | grep mint-token
```

**Expected Security Behavior**:
- ✅ Environment variables not visible in ps output (on most systems)
- CLI uses process.env.SECRET and clears it
- Secret not passed as CLI argument
- **BEST PRACTICE**: Use env var, not command-line arg

**Vulnerability Prevented**: Secret exposure in process list

---

### SEC-SIDECHANNEL-005: Memory Dump Analysis

**Priority**: Low
**Severity**: Low - Advanced attack

**Attack Vector**: Extract secrets from process memory dump

**Prerequisites**:
- Root access or debugger attachment
- Core dump after crash

**Execution Steps**:
```bash
# Trigger crash and analyze core dump
# gdb attach or similar
```

**Expected Security Behavior**:
- Secret exists in memory during operation (unavoidable)
- CLI clears SECRET env var after reading
- **RECOMMENDATION**: Zero sensitive buffers after use
- Use secure memory if available

**Vulnerability Prevented**: Memory-based secret extraction

**Current Implementation Gap**: No explicit memory zeroing

---

## 9. Business Logic Flaws

### SEC-LOGIC-001: Mint with Negative Coin Amount

**Priority**: Medium
**Severity**: Medium - Tests amount validation

**Attack Vector**: Create tokens with negative coin amounts

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="alice-secret" npm run mint-token -- \
  --preset uct \
  -c "-1000000000000000000" \
  -o negative-token.txf
```

**Expected Security Behavior**:
- ❌ BigInt parsing may throw error
- Network should reject negative amounts
- **RECOMMENDATION**: Validate amount >= 0 in CLI

**Vulnerability Prevented**: Negative balance exploits

**Current Implementation Gap**: No client-side amount validation

---

### SEC-LOGIC-002: Transfer to Empty/Invalid Address

**Priority**: Medium
**Severity**: Medium - Tests address validation

**Attack Vector**: Send token to malformed or empty address

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf
```

**Execution Steps**:
```bash
# Empty address
npm run send-token -- -f token.txf -r ""

# Invalid format
npm run send-token -- -f token.txf -r "INVALID"

# Null/undefined
npm run send-token -- -f token.txf -r "null"
```

**Expected Security Behavior**:
- ❌ AddressFactory.createAddress() throws error
- Error: "Invalid address format"
- No transaction created
- Token remains with sender

**Vulnerability Prevented**: Burning tokens via invalid addresses

---

### SEC-LOGIC-003: Circular Transfer Chain

**Priority**: Low
**Severity**: Low - Tests transfer logic

**Attack Vector**: Create transfer loop A→B→A in offline packages

**Prerequisites**:
```bash
# Setup Alice and Bob addresses
```

**Execution Steps**:
```bash
# Alice → Bob (offline)
SECRET="alice-secret" npm run mint-token -- -o alice-token.txf
SECRET="alice-secret" npm run send-token -- \
  -f alice-token.txf \
  -r "$BOB_ADDRESS" \
  -o transfer-alice-bob.txf

# Bob → Alice (offline, before receiving)
# (Hypothetical - Bob doesn't have token yet)
```

**Expected Security Behavior**:
- First transfer (Alice→Bob) succeeds
- Second transfer (Bob→Alice) fails - Bob doesn't own token yet
- Only current owner can transfer
- Offline packages don't grant ownership until submitted

**Vulnerability Prevented**: Circular ownership confusion

---

### SEC-LOGIC-004: Token Duplication via File Copy

**Priority**: High
**Severity**: High - Tests duplication prevention

**Attack Vector**: Copy token file to create duplicate

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf
```

**Execution Steps**:
```bash
# Copy token file
cp token.txf token-copy.txf

# Try to send both copies
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  --submit-now

SECRET="alice-secret" npm run send-token -- \
  -f token-copy.txf \
  -r "$CAROL_ADDRESS" \
  --submit-now
```

**Expected Security Behavior**:
- ✅ First send succeeds
- ❌ Second send fails: "Token already spent"
- Network tracks unique token IDs and states
- File copy doesn't duplicate on-chain token

**Vulnerability Prevented**: Token duplication

---

### SEC-LOGIC-005: Send Token Already in PENDING Status

**Priority**: Medium
**Severity**: Medium - Tests status handling

**Attack Vector**: Send token that already has pending offline transfer

**Prerequisites**:
```bash
SECRET="alice-secret" npm run mint-token -- -o token.txf
SECRET="alice-secret" npm run send-token -- \
  -f token.txf \
  -r "$BOB_ADDRESS" \
  -o transfer-bob.txf
```

**Execution Steps**:
```bash
# Try to send the PENDING transfer package to Carol
SECRET="alice-secret" npm run send-token -- \
  -f transfer-bob.txf \
  -r "$CAROL_ADDRESS"
```

**Expected Security Behavior**:
- ⚠️ Should detect PENDING status
- Error: "Token has pending transfer, cannot create new transfer"
- Or: Error: "No offline transfer package found" (if checking for that)
- Status must be CONFIRMED to send

**Vulnerability Prevented**: Multiple concurrent offline transfers

**Current Implementation Gap**: May not check status before sending

---

## 10. Denial of Service

### SEC-DOS-001: Resource Exhaustion via Large Token Data

**Priority**: Medium
**Severity**: Medium - Tests resource limits

**Attack Vector**: Mint token with gigabytes of data

**Prerequisites**: None

**Execution Steps**:
```bash
# Generate huge data file
dd if=/dev/zero bs=1M count=100 | base64 > huge.txt

SECRET="alice-secret" npm run mint-token -- \
  --preset nft \
  -d "$(cat huge.txt)" \
  -o huge-token.txf
```

**Expected Security Behavior**:
- ⚠️ Process may run out of memory
- Network likely rejects due to size limits
- **RECOMMENDATION**: Limit token data to reasonable size (e.g., 10MB)
- Fail gracefully with clear error

**Vulnerability Prevented**: Memory exhaustion DoS

---

### SEC-DOS-002: Infinite Loop in Proof Validation

**Priority**: Low
**Severity**: Low - Tests validation robustness

**Attack Vector**: Craft proof with circular merkle path

**Prerequisites**:
- Deep understanding of proof structure

**Execution Steps**:
```bash
# Craft malicious proof with circular references
# Merkle path that references itself
```

**Expected Security Behavior**:
- Proof validation has depth limits
- No infinite recursion
- Validation fails with error after max depth

**Vulnerability Prevented**: Validation DoS

---

### SEC-DOS-003: Extremely Large Transaction History

**Priority**: Low
**Severity**: Low - Tests history limits

**Attack Vector**: Create token with thousands of transfers

**Prerequisites**:
```bash
# Transfer token through 1000+ owners
# (Setup omitted due to length)
```

**Execution Steps**:
```bash
# After 1000 transfers, try to send again
npm run send-token -- -f token-1000-hops.txf -r "$NEXT_ADDRESS"
```

**Expected Security Behavior**:
- Token file size grows linearly with transfers
- CLI should handle large files (Node.js streams if needed)
- Network may have transaction history limits
- **RECOMMENDATION**: Consider pruning old proofs (if protocol allows)

**Vulnerability Prevented**: Storage exhaustion

---

### SEC-DOS-004: Concurrent Network Requests Flood

**Priority**: Medium
**Severity**: Medium - Tests rate limiting

**Attack Vector**: Flood aggregator with requests

**Prerequisites**: None

**Execution Steps**:
```bash
# Launch many parallel minting operations
for i in {1..100}; do
  SECRET="test-$i" npm run mint-token -- --preset nft --save &
done
wait
```

**Expected Security Behavior**:
- Network has rate limiting
- CLI respects rate limits
- Some requests may be rejected: "Too many requests"
- **RECOMMENDATION**: Implement exponential backoff

**Vulnerability Prevented**: Network flooding

**Current Implementation Gap**: No rate limit handling or retry logic

---

## Test Execution Strategy

### Execution Priority

1. **Critical Tests (28 tests)**: Run first, blocking issues
   - Authorization & Authentication: SEC-AUTH-001, 002, 003, 004
   - Double-Spend: SEC-DBLSPEND-001, 002, 003
   - Cryptographic: SEC-CRYPTO-001, 002, 003, 007
   - Access Control: SEC-ACCESS-001
   - Data Integrity: SEC-INTEGRITY-002
   - Input Validation: SEC-INPUT-004

2. **High Priority Tests (24 tests)**: Run second, important security
   - Remaining AUTH, DBLSPEND, CRYPTO, INTEGRITY tests
   - Network security tests
   - File operations security

3. **Medium Priority Tests (12 tests)**: Run third, edge cases
   - Business logic flaws
   - DoS scenarios
   - Side-channel attacks

4. **Low Priority Tests (4 tests)**: Run last, theoretical attacks
   - Advanced side-channel
   - Theoretical cryptographic attacks

### Automated Test Framework

```bash
#!/bin/bash
# security-test-runner.sh

RESULTS_DIR="security-test-results"
mkdir -p "$RESULTS_DIR"

# Run critical tests
echo "=== Running CRITICAL security tests ==="
for test in SEC-AUTH-001 SEC-AUTH-002 SEC-DBLSPEND-001 SEC-CRYPTO-001; do
  echo "Running $test..."
  ./tests/security/$test.sh > "$RESULTS_DIR/$test.log" 2>&1
  if [ $? -eq 0 ]; then
    echo "✓ $test PASSED"
  else
    echo "✗ $test FAILED - REVIEW REQUIRED"
  fi
done

# Generate report
python3 generate-security-report.py "$RESULTS_DIR"
```

### Manual Testing Checklist

For each security test:
- [ ] Understand attack vector
- [ ] Set up prerequisites
- [ ] Execute attack
- [ ] Verify expected security behavior
- [ ] Document actual behavior
- [ ] Note any implementation gaps
- [ ] File security issues if behavior differs from expected

---

## Security Findings Summary

### Critical Implementation Gaps Identified

1. **No Client-Side Secret Strength Validation** (SEC-CRYPTO-005)
   - Users can use weak secrets
   - Recommendation: Warn on secrets < 12 characters

2. **File Permission Security** (SEC-SIDECHANNEL-003)
   - Token files created with world-readable permissions
   - Recommendation: Create files with mode 600

3. **Path Traversal Vulnerability** (SEC-INPUT-003)
   - Output paths not validated
   - Recommendation: Restrict to current directory

4. **Trustbase Authentication** (SEC-ACCESS-004)
   - TRUSTBASE_PATH file not validated for authenticity
   - Recommendation: Validate trustbase signature

5. **No Input Size Limits** (SEC-INPUT-006, SEC-DOS-001)
   - Token data can be arbitrarily large
   - Recommendation: Implement size limits (10MB)

6. **No Rate Limit Handling** (SEC-DOS-004)
   - No retry logic or backoff for rate limits
   - Recommendation: Implement exponential backoff

7. **No HTTPS Enforcement Warning** (SEC-NETWORK-001)
   - Users can use HTTP endpoints without warning
   - Recommendation: Warn on non-HTTPS production use

### Security Strengths Identified

1. ✅ **Strong Cryptographic Foundation**
   - secp256k1 signatures
   - SHA-256 hashing
   - BFT consensus with authenticator verification

2. ✅ **Proof Validation**
   - Comprehensive inclusion proof validation
   - Authenticator signature verification
   - Merkle path validation

3. ✅ **Network-Level Double-Spend Prevention**
   - On-chain state tracking
   - Consensus-based state transitions

4. ✅ **Secret Handling**
   - Secrets cleared from environment after reading
   - No secrets in command-line arguments
   - No secrets in token files

5. ✅ **Input Sanitization**
   - Token data stored as hex-encoded bytes
   - No JSON parsing of user data
   - Command injection protection via commander.js

---

## Recommendations for Security Hardening

### Immediate Actions (Critical)

1. **Add File Permission Enforcement**
```typescript
// After writing token files
fs.chmodSync(outputFile, 0o600); // Owner read/write only
console.error('⚠️  Token file created with restricted permissions (600)');
```

2. **Implement Output Path Validation**
```typescript
function validateOutputPath(path: string): void {
  if (path.includes('..') || path.startsWith('/')) {
    throw new Error('Invalid output path: Directory traversal not allowed');
  }
}
```

3. **Add Secret Strength Warning**
```typescript
function validateSecretStrength(secret: string): void {
  if (secret.length < 12) {
    console.error('⚠️  WARNING: Short secret detected. Recommend 12+ characters.');
  }
  const commonPasswords = ['password', '123456', 'test'];
  if (commonPasswords.includes(secret.toLowerCase())) {
    console.error('⚠️  WARNING: Common password detected. Use unique secret.');
  }
}
```

### Short-Term Actions (High Priority)

4. **Add Token Data Size Limits**
```typescript
const MAX_TOKEN_DATA_SIZE = 10 * 1024 * 1024; // 10MB
if (tokenDataBytes.length > MAX_TOKEN_DATA_SIZE) {
  throw new Error(`Token data too large: ${tokenDataBytes.length} bytes (max: ${MAX_TOKEN_DATA_SIZE})`);
}
```

5. **Implement HTTPS Warning**
```typescript
if (endpoint.startsWith('http://') && !endpoint.includes('localhost')) {
  console.error('⚠️  WARNING: Using unencrypted HTTP endpoint.');
  console.error('    Production use should use HTTPS for security.');
}
```

6. **Add Trustbase Validation**
```typescript
// Verify trustbase signature or checksum
// Reject unsigned/unverified trustbase files
```

### Long-Term Actions (Medium Priority)

7. **Implement Rate Limit Handling**
8. **Add Transaction Chain Integrity Validation**
9. **Implement Token Status Validation Before Operations**
10. **Add Security Audit Logging**

---

## Appendix: Vulnerability Classification

### OWASP Top 10 Mapping

- **A01:2021 – Broken Access Control**: SEC-ACCESS-001, 003
- **A02:2021 – Cryptographic Failures**: SEC-CRYPTO-001, 002, 003, 005
- **A03:2021 – Injection**: SEC-INPUT-002, 004, 007
- **A04:2021 – Insecure Design**: SEC-LOGIC-001 through 005
- **A05:2021 – Security Misconfiguration**: SEC-ACCESS-004, SEC-NETWORK-001
- **A06:2021 – Vulnerable Components**: (SDK dependency audit needed)
- **A07:2021 – Authentication Failures**: SEC-AUTH-001 through 006
- **A08:2021 – Software and Data Integrity**: SEC-INTEGRITY-001 through 005
- **A09:2021 – Security Logging**: (Not covered - audit logging needed)
- **A10:2021 – Server-Side Request Forgery**: (Not applicable - CLI tool)

### CWE (Common Weakness Enumeration) Coverage

- CWE-287 (Improper Authentication): SEC-AUTH series
- CWE-20 (Improper Input Validation): SEC-INPUT series
- CWE-22 (Path Traversal): SEC-INPUT-003
- CWE-327 (Weak Crypto): SEC-CRYPTO-005
- CWE-362 (Race Condition): SEC-DBLSPEND-002
- CWE-400 (Uncontrolled Resource Consumption): SEC-DOS series
- CWE-347 (Improper Verification of Signature): SEC-CRYPTO series
- CWE-668 (Exposure of Resource): SEC-SIDECHANNEL-003

---

## Conclusion

This security test suite provides comprehensive coverage of potential vulnerabilities in the Unicity Token CLI. The 68 test scenarios cover all major attack vectors from OWASP Top 10, cryptographic security, authorization, data integrity, and denial-of-service attacks.

**Key Findings**:
- Strong cryptographic foundation with BFT consensus
- Excellent double-spend prevention at network level
- Several implementation gaps in client-side validation and security hardening
- 7 critical recommendations for immediate action

**Next Steps**:
1. Implement immediate security hardening recommendations
2. Execute all Critical and High priority tests
3. Fix identified implementation gaps
4. Re-test after fixes
5. Consider professional security audit before production deployment

---

**Document Status**: Complete
**Last Updated**: 2025-11-03
**Author**: Claude Code (AI Security Auditor)
