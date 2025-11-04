# Corner Case Test Scenarios for Unicity Token CLI

**Version**: 1.0
**Date**: 2025-11-03
**Purpose**: Comprehensive identification of corner cases, boundary conditions, and edge scenarios not covered in existing test documentation

---

## Document Overview

This document identifies **corner cases and edge conditions** discovered through deep code analysis of the Unicity Token CLI implementation. These scenarios represent boundary conditions, unusual inputs, race conditions, and edge cases that are **not already covered** in TEST_SCENARIOS.md (96 tests) or SECURITY_TEST_SCENARIOS.md (68 tests).

**Total New Corner Case Scenarios**: 127
**Priority Distribution**: Critical (15), High (38), Medium (52), Low (22)

---

## Table of Contents

1. [State Machine Edge Cases](#1-state-machine-edge-cases)
2. [Data Type Boundaries](#2-data-type-boundaries)
3. [File System Edge Cases](#3-file-system-edge-cases)
4. [Network Edge Cases](#4-network-edge-cases)
5. [Cryptographic Edge Cases](#5-cryptographic-edge-cases)
6. [Transaction Chain Edge Cases](#6-transaction-chain-edge-cases)
7. [Predicate Edge Cases](#7-predicate-edge-cases)
8. [JSON/CBOR Edge Cases](#8-jsoncbor-edge-cases)
9. [Time-Based Edge Cases](#9-time-based-edge-cases)
10. [Environment Edge Cases](#10-environment-edge-cases)

---

## 1. State Machine Edge Cases

### CORNER-001: Token with Undefined Status Field

**Priority**: High
**Category**: State Lifecycle

**Description**: Token file missing the `status` field entirely (legacy TXF v2.0 without extended fields)

**Why Corner Case**: Code uses `upgradeTxfToExtended()` but might not handle all legacy formats

**Prerequisites**:
```bash
# Create legacy token without status field
```

**Execution Steps**:
```bash
# Manually create TXF without status field
cat > legacy-token.txf <<EOF
{
  "version": "2.0",
  "genesis": {...},
  "state": {...},
  "transactions": []
}
EOF

# Try to send it
SECRET="test" npm run send-token -- -f legacy-token.txf -r "DIRECT://..."
```

**Expected Behavior**:
- `upgradeTxfToExtended()` should add `status: "CONFIRMED"`
- Send operation should succeed
- No crashes due to undefined status

**Impact**: Medium - Could affect backward compatibility

---

### CORNER-002: Token with Invalid Status Enum Value

**Priority**: High
**Category**: State Validation

**Description**: Token with status field set to non-enum value like "PROCESSING" or "INVALID"

**Why Corner Case**: TypeScript enums don't prevent runtime string values from JSON

**Prerequisites**:
```bash
SECRET="test" npm run mint-token -- -o test.txf
```

**Execution Steps**:
```bash
# Manually edit test.txf and set status to invalid value
sed -i 's/"status": "CONFIRMED"/"status": "INVALID_STATE"/' test.txf

npm run verify-token -- -f test.txf
npm run send-token -- -f test.txf -r "DIRECT://..."
```

**Expected Behavior**:
- Validation should detect invalid status
- Error: "Invalid status value: INVALID_STATE"
- Should not allow operations on invalid-status tokens

**Current Gap**: No runtime validation of status enum values

---

### CORNER-003: Simultaneous Status Transitions

**Priority**: Medium
**Category**: Race Conditions

**Description**: Two processes trying to update same token file simultaneously

**Why Corner Case**: File-based token storage without locking

**Prerequisites**:
```bash
SECRET="test" npm run mint-token -- -o token.txf
```

**Execution Steps**:
```bash
# Launch two send operations simultaneously
SECRET="test" npm run send-token -- -f token.txf -r "$ADDR1" -o out1.txf &
SECRET="test" npm run send-token -- -f token.txf -r "$ADDR2" -o out2.txf &
wait
```

**Expected Behavior**:
- Only one should succeed (first to network)
- Second should fail with "token already spent"
- No file corruption

**Impact**: High - Real-world concurrent operations

---

### CORNER-004: Token with Both PENDING Status and Transactions Array

**Priority**: High
**Category**: State Consistency

**Description**: Token has `status: "PENDING"` but also has items in `transactions` array

**Why Corner Case**: Inconsistent state - pending transfers shouldn't have confirmed transactions in same batch

**Prerequisites**: Manual file creation

**Execution Steps**:
```bash
# Create inconsistent token
{
  "version": "2.0",
  "status": "PENDING",
  "offlineTransfer": {...},
  "transactions": [
    {...} // Some transaction
  ]
}

npm run receive-token -- -f inconsistent.txf
```

**Expected Behavior**:
- `validateExtendedTxf()` should detect inconsistency
- Warning: "Unexpected status PENDING with transaction history"
- Either fail or auto-correct status

**Current Gap**: Check exists but only as warning, not blocker

---

### CORNER-005: Token with TRANSFERRED Status but No Transactions

**Priority**: High
**Category**: State Consistency

**Description**: Token marked as TRANSFERRED but transactions array is empty

**Why Corner Case**: Status doesn't match transaction history

**Prerequisites**: Manual file manipulation

**Execution Steps**:
```bash
{
  "version": "2.0",
  "status": "TRANSFERRED",
  "transactions": []
}

npm run verify-token -- -f bad-status.txf
```

**Expected Behavior**:
- Validation should detect mismatch
- Error: "Status TRANSFERRED requires at least one transaction"

**Current Gap**: No validation that status matches transaction count

---

### CORNER-006: Receive Token That's Already CONFIRMED

**Priority**: Medium
**Category**: Idempotency

**Description**: Running receive-token on a token that's already been received and is CONFIRMED

**Why Corner Case**: Tests idempotency and state guards

**Prerequisites**:
```bash
# Create and receive transfer
SECRET="alice" npm run mint-token -- -o token.txf
SECRET="alice" npm run send-token -- -f token.txf -r "$BOB" -o transfer.txf
SECRET="bob" npm run receive-token -- -f transfer.txf -o received.txf
```

**Execution Steps**:
```bash
# Try to receive again
SECRET="bob" npm run receive-token -- -f received.txf
```

**Expected Behavior**:
- Error: "No offline transfer package found"
- Or: Detect already confirmed and exit gracefully

**Impact**: Medium - Users might retry operations

---

## 2. Data Type Boundaries

### CORNER-007: Empty String as Secret

**Priority**: Critical
**Category**: Input Validation

**Description**: Provide empty string as SECRET environment variable

**Why Corner Case**: Empty string != undefined, might bypass checks

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="" npm run gen-address
```

**Expected Behavior**:
- Should reject empty secret
- Error: "Secret cannot be empty"
- Or prompt for input

**Current Gap**: Code checks `process.env.SECRET` but not if it's empty

---

### CORNER-008: Secret with Only Whitespace

**Priority**: High
**Category**: Input Validation

**Description**: Secret is "   " (spaces/tabs/newlines only)

**Why Corner Case**: Trimming might make it empty

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="     " npm run gen-address
SECRET=$'\n\t  \n' npm run mint-token -- --preset nft
```

**Expected Behavior**:
- Should detect and reject whitespace-only secrets
- Warning about weak entropy

**Current Gap**: No trimming or whitespace validation

---

### CORNER-009: Unicode Emoji in Secret

**Priority**: Medium
**Category**: Encoding

**Description**: Secret contains emoji or special Unicode characters

**Why Corner Case**: TextEncoder might handle differently

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="my🔑secret💎password" npm run gen-address
```

**Expected Behavior**:
- Should handle UTF-8 encoding correctly
- Key derivation should be deterministic
- Same emoji secret produces same address

**Impact**: Medium - International users might use Unicode

---

### CORNER-010: Maximum Length Input Strings

**Priority**: High
**Category**: Buffer Overflow

**Description**: Extremely long strings in various input fields

**Why Corner Case**: Memory allocation and buffer limits

**Prerequisites**: None

**Execution Steps**:
```bash
# 10MB secret
LONG_SECRET=$(python3 -c "print('A' * 10000000)")
SECRET="$LONG_SECRET" npm run gen-address

# Very long token data
npm run mint-token -- --preset nft -d "$(python3 -c "print('x' * 100000000)")"

# Long nonce
npm run gen-address -- -n "$(python3 -c "print('B' * 1000000)")"
```

**Expected Behavior**:
- Should impose length limits
- Error: "Input exceeds maximum length (Xmb)"
- Process should not crash or hang

**Current Gap**: No input size validation

---

### CORNER-011: Null Bytes in Secret

**Priority**: Medium
**Category**: Binary Data

**Description**: Secret contains null byte (\x00) characters

**Why Corner Case**: Null bytes can terminate strings unexpectedly

**Prerequisites**: None

**Execution Steps**:
```bash
# Note: Bash handles this differently, might need Node.js test
SECRET=$'test\x00secret' npm run gen-address
```

**Expected Behavior**:
- Should handle full binary secret
- Key derivation uses full bytes including nulls
- Or: Reject secrets with null bytes

**Impact**: Low - Unusual but possible

---

### CORNER-012: Coin Amount of Zero

**Priority**: Medium
**Category**: Business Logic

**Description**: Mint fungible token with explicit coin amount of 0

**Why Corner Case**: Zero amount is valid but unusual

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset uct -c "0"
```

**Expected Behavior**:
- Should succeed (0 is valid amount)
- Token created with 0-value coin
- Transferable but economically meaningless

**Impact**: Low - Edge case for testing

---

### CORNER-013: Negative Coin Amount via String Manipulation

**Priority**: High
**Category**: Input Validation

**Description**: Attempt to pass negative amount in various ways

**Why Corner Case**: BigInt construction might accept negative

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset uct -c "-1"
SECRET="test" npm run mint-token -- --preset uct -c "-9999999999999999999"
```

**Expected Behavior**:
- BigInt("-1") creates negative value
- Should reject before submission
- Error: "Coin amount must be non-negative"

**Current Gap**: No client-side amount validation

---

### CORNER-014: Coin Amount Exceeding JavaScript Number.MAX_SAFE_INTEGER

**Priority**: Medium
**Category**: Numeric Boundaries

**Description**: Coin amounts larger than 2^53-1 (Number.MAX_SAFE_INTEGER)

**Why Corner Case**: JavaScript number precision limits

**Prerequisites**: None

**Execution Steps**:
```bash
# Amount > 2^53-1
SECRET="test" npm run mint-token -- --preset uct \
  -c "99999999999999999999999999999999999999"
```

**Expected Behavior**:
- BigInt should handle arbitrary precision
- SDK should accept large amounts
- Network may have limits

**Impact**: Medium - Large token amounts

---

### CORNER-015: Hex String with Odd Length

**Priority**: High
**Category**: Input Parsing

**Description**: Provide hex string with odd number of characters (not byte-aligned)

**Why Corner Case**: `HexConverter.decode()` requires even length

**Prerequisites**: None

**Execution Steps**:
```bash
# 63 characters (should be 64)
SECRET="test" npm run gen-address -- -y "123456789abcdef123456789abcdef123456789abcdef123456789abcdef12"

# 65 characters
SECRET="test" npm run mint-token -- --preset nft \
  -i "123456789abcdef123456789abcdef123456789abcdef123456789abcdef12345"
```

**Expected Behavior**:
- Detect odd-length hex
- Hash it to proper 32 bytes
- Console: "Hex string is 63 chars (expected 64), hashing..."

**Current Behavior**: Code path exists, should test

---

### CORNER-016: Mixed Case Hex Strings

**Priority**: Low
**Category**: Input Normalization

**Description**: Hex strings with mixed upper/lowercase

**Why Corner Case**: Hex should be case-insensitive

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run gen-address -- \
  -y "AbCdEf1234567890ABCDEF1234567890abcdef1234567890ABCDEF1234567890"
```

**Expected Behavior**:
- Should parse correctly (case-insensitive)
- Same hash as all-lowercase version

**Impact**: Low - Should work by default

---

### CORNER-017: Hex String with Invalid Characters

**Priority**: High
**Category**: Input Validation

**Description**: Hex string contains non-hex characters (G-Z, special chars)

**Why Corner Case**: Regex validation before decoding

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run gen-address -- -y "1234567890abcdefGHIJKLMN"
SECRET="test" npm run mint-token -- --preset nft -i "test@#$%^&*()"
```

**Expected Behavior**:
- Regex pattern fails to match
- Falls through to text hashing
- Console: "Hashed custom token type ..."

**Current Behavior**: Falls back to hashing, which is correct

---

### CORNER-018: Empty Token Data

**Priority**: Medium
**Category**: Data Boundaries

**Description**: Mint token with explicitly empty token data

**Why Corner Case**: Tests minimum valid token

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft -d ""
SECRET="test" npm run mint-token -- --preset nft # No -d option
```

**Expected Behavior**:
- Both should create token with empty data (0 bytes)
- Valid token with no metadata
- Transfer should work

**Impact**: Low - Minimal tokens are valid

---

## 3. File System Edge Cases

### CORNER-019: Write to Read-Only File System

**Priority**: High
**Category**: File Operations

**Description**: Attempt to save token to read-only mount point

**Why Corner Case**: Docker volumes or restricted filesystems

**Prerequisites**:
```bash
# Create read-only directory
mkdir /tmp/readonly
sudo mount -o ro,bind /tmp/readonly /tmp/readonly
```

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft \
  -o /tmp/readonly/token.txf
```

**Expected Behavior**:
- Error: "Permission denied" or "EROFS: read-only file system"
- Clear error message to user
- No partial writes

**Impact**: Medium - Production deployment scenarios

---

### CORNER-020: File Already Exists (No --save Flag)

**Priority**: Medium
**Category**: File Conflicts

**Description**: Output file already exists when using -o option

**Why Corner Case**: Overwrite behavior

**Prerequisites**:
```bash
touch existing-token.txf
```

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft \
  -o existing-token.txf
```

**Expected Behavior**:
- Overwrites existing file silently
- Or: Prompts user for confirmation
- Or: Errors with "File already exists, use --force"

**Current Behavior**: Likely overwrites silently

---

### CORNER-021: Very Long File Path

**Priority**: Medium
**Category**: Path Limits

**Description**: Output path exceeding filesystem limits (typically 255 chars for filename, 4096 for path)

**Why Corner Case**: Filename generation creates long names

**Prerequisites**: None

**Execution Steps**:
```bash
# PATH_MAX test (4096 bytes on Linux)
LONG_PATH=$(python3 -c "print('/tmp/' + 'a/'*500 + 'token.txf')")
mkdir -p "$(dirname $LONG_PATH)"
SECRET="test" npm run mint-token -- --preset nft -o "$LONG_PATH"
```

**Expected Behavior**:
- Error: "Filename too long" (ENAMETOOLONG)
- Graceful error handling

**Impact**: Low - Rare in practice

---

### CORNER-022: Special Characters in Filename

**Priority**: High
**Category**: Path Injection

**Description**: Filename with special shell characters, newlines, or path separators

**Why Corner Case**: Security and parsing issues

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft -o 'token;rm -rf /.txf'
SECRET="test" npm run mint-token -- --preset nft -o $'token\nmalicious.txf'
SECRET="test" npm run mint-token -- --preset nft -o 'token/../../../etc/passwd.txf'
```

**Expected Behavior**:
- Should sanitize or reject dangerous filenames
- No path traversal
- No command injection

**Current Gap**: Minimal filename validation (SEC-INPUT-003 covers this)

---

### CORNER-023: Disk Full During Write

**Priority**: High
**Category**: Error Handling

**Description**: Filesystem runs out of space during token file write

**Why Corner Case**: Partial file writes

**Prerequisites**:
```bash
# Create small filesystem
dd if=/dev/zero of=/tmp/small.img bs=1M count=1
mkfs.ext4 /tmp/small.img
mkdir /tmp/smallfs
sudo mount /tmp/small.img /tmp/smallfs
```

**Execution Steps**:
```bash
# Fill filesystem
dd if=/dev/zero of=/tmp/smallfs/filler bs=1M count=1

# Try to write token
SECRET="test" npm run mint-token -- --preset nft \
  -o /tmp/smallfs/token.txf
```

**Expected Behavior**:
- Error: "ENOSPC: no space left on device"
- No corrupted partial file left
- Clear error to user

**Impact**: Medium - Can happen in production

---

### CORNER-024: Auto-Generated Filename Collision

**Priority**: Medium
**Category**: Naming Conflicts

**Description**: --save flag generates filename that already exists

**Why Corner Case**: Timestamp-based names might collide in rapid operations

**Prerequisites**:
```bash
SECRET="test" npm run mint-token -- --preset nft --save
# Immediately run again (same timestamp possible)
SECRET="test" npm run mint-token -- --preset nft --save
```

**Execution Steps**: See above

**Expected Behavior**:
- Second operation should either:
  - Append random suffix
  - Increment counter
  - Overwrite with warning
  - Error with conflict

**Current Behavior**: Uses millisecond timestamp, low collision chance

---

### CORNER-025: Symlink to File

**Priority**: Low
**Category**: File References

**Description**: Input/output file is a symbolic link

**Why Corner Case**: Follow vs. don't follow symlinks

**Prerequisites**:
```bash
SECRET="test" npm run mint-token -- -o real-token.txf
ln -s real-token.txf symlink-token.txf
```

**Execution Steps**:
```bash
npm run verify-token -- -f symlink-token.txf
SECRET="test" npm run send-token -- -f symlink-token.txf -r "$ADDR"
```

**Expected Behavior**:
- Should follow symlink and operate on target
- Normal operation

**Impact**: Low - Should work by default

---

## 4. Network Edge Cases

### CORNER-026: Aggregator Returns 204 No Content

**Priority**: High
**Category**: HTTP Edge Cases

**Description**: Aggregator returns 204 instead of expected response

**Why Corner Case**: Edge case in HTTP status handling

**Prerequisites**: Mock aggregator or proxy

**Execution Steps**:
```bash
# Configure proxy to return 204 for specific requests
SECRET="test" npm run mint-token -- --preset nft -e http://mock-aggregator:3000
```

**Expected Behavior**:
- Handle as error (expected data but got none)
- Error: "Unexpected empty response from aggregator"

**Impact**: Low - Unlikely from real aggregator

---

### CORNER-027: Aggregator Returns Partial JSON

**Priority**: High
**Category**: Network Reliability

**Description**: Connection drops mid-response, JSON is truncated

**Why Corner Case**: Network instability

**Prerequisites**: Network simulation tool

**Execution Steps**:
```bash
# Use tcpkill or similar to drop connection mid-response
SECRET="test" npm run mint-token -- --preset nft
```

**Expected Behavior**:
- JSON.parse() throws error
- Error: "Invalid JSON response from aggregator"
- Retry logic or clear failure message

**Impact**: Medium - Real-world network issues

---

### CORNER-028: Aggregator Returns Inclusion Proof Without Authenticator Forever

**Priority**: Critical
**Category**: Timeout Handling

**Description**: Proof appears but authenticator never gets populated

**Why Corner Case**: Tests timeout logic in `waitInclusionProof()`

**Prerequisites**: Mock aggregator

**Execution Steps**:
```bash
# Mock aggregator returns proof with authenticator: null indefinitely
SECRET="test" npm run mint-token -- --preset nft -e http://mock:3000
```

**Expected Behavior**:
- After 60 seconds: "Timeout waiting for authenticator to be populated"
- Clear error message about partial proof
- Exit gracefully

**Current Behavior**: Code handles this, should test

---

### CORNER-029: Inclusion Proof Polling - 404 Then 200 Then 404

**Priority**: Medium
**Category**: Network Flakiness

**Description**: Aggregator returns inconsistent responses during polling

**Why Corner Case**: Distributed system consistency

**Prerequisites**: Flaky mock aggregator

**Execution Steps**:
```bash
# Mock aggregator returns: 404 -> 404 -> 200 (proof) -> 404 -> 200 (complete)
SECRET="test" npm run mint-token -- --preset nft
```

**Expected Behavior**:
- Should continue polling through 404s
- Eventually get complete proof
- Or timeout after 60 seconds

**Impact**: Low - Real aggregators should be consistent

---

### CORNER-030: DNS Resolution Failure

**Priority**: High
**Category**: Network Configuration

**Description**: Endpoint hostname cannot be resolved

**Why Corner Case**: Misconfiguration or DNS issues

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft \
  -e https://nonexistent-aggregator-xyz.invalid
```

**Expected Behavior**:
- Error: "getaddrinfo ENOTFOUND nonexistent-aggregator-xyz.invalid"
- Clear message: "Cannot connect to aggregator"

**Impact**: Medium - Configuration errors

---

### CORNER-030: IPv6-Only Network

**Priority**: Medium
**Category**: Network Protocol

**Description**: Running on IPv6-only network with IPv4 endpoint

**Why Corner Case**: Dual-stack vs. single-stack networking

**Prerequisites**: IPv6-only environment

**Execution Steps**:
```bash
# Disable IPv4
sudo sysctl -w net.ipv6.conf.all.disable_ipv6=0
sudo sysctl -w net.ipv4.conf.all.disable_ipv4=1

SECRET="test" npm run mint-token -- --preset nft -e http://127.0.0.1:3000
```

**Expected Behavior**:
- Should use IPv6 if available
- Error if IPv4 required but unavailable
- Clear network error message

**Impact**: Low - Most environments are dual-stack

---

### CORNER-032: Very Slow Network (1KB/s)

**Priority**: Medium
**Category**: Performance

**Description**: Network is extremely slow but not timing out

**Why Corner Case**: Tests responsiveness to slow networks

**Prerequisites**: Traffic shaping tool

**Execution Steps**:
```bash
# Limit bandwidth to 1KB/s
tc qdisc add dev eth0 root tbf rate 1kbit burst 1kbit

SECRET="test" npm run mint-token -- --preset nft
```

**Expected Behavior**:
- Should complete eventually (if within timeout)
- Progress indicators would help
- Or timeout with clear message

**Impact**: Low - Users would notice immediately

---

### CORNER-033: Aggregator Returns 429 Rate Limit

**Priority**: High
**Category**: Rate Limiting

**Description**: Aggregator returns 429 Too Many Requests

**Why Corner Case**: Tests rate limit handling

**Prerequisites**: Rate-limited aggregator or proxy

**Execution Steps**:
```bash
# Make many rapid requests
for i in {1..100}; do
  SECRET="test-$i" npm run mint-token -- --preset nft &
done
wait
```

**Expected Behavior**:
- Detect 429 status
- Implement exponential backoff
- Retry after delay
- Or: Error with "Rate limit exceeded, try again later"

**Current Gap**: No rate limit handling or backoff

---

### CORNER-034: Aggregator Returns 503 Service Unavailable

**Priority**: High
**Category**: Service Health

**Description**: Aggregator is temporarily unavailable

**Why Corner Case**: Maintenance or overload

**Prerequisites**: Mock aggregator

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft -e http://mock:3000
```

**Expected Behavior**:
- Error: "Aggregator service unavailable"
- Suggest retry
- Exit cleanly

**Impact**: Medium - Real-world outages

---

## 5. Cryptographic Edge Cases

### CORNER-035: All-Zero Token ID

**Priority**: Medium
**Category**: Cryptographic Values

**Description**: Token ID is 32 bytes of zeros

**Why Corner Case**: Special value that might have meaning

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft \
  -i "0000000000000000000000000000000000000000000000000000000000000000"
```

**Expected Behavior**:
- Should accept (valid 32-byte value)
- Generates token with all-zero ID
- Transfer should work normally

**Impact**: Low - Unusual but valid

---

### CORNER-036: All-Ones Token ID

**Priority**: Medium
**Category**: Cryptographic Values

**Description**: Token ID is 32 bytes of 0xFF

**Why Corner Case**: Maximum value

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft \
  -i "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
```

**Expected Behavior**:
- Should accept (valid 32-byte value)
- No special handling needed

**Impact**: Low - Edge value test

---

### CORNER-037: Nonce Equals Token ID

**Priority**: Low
**Category**: Cryptographic Coincidence

**Description**: Masked address nonce happens to equal the token ID

**Why Corner Case**: Unlikely collision, tests independence

**Prerequisites**: None

**Execution Steps**:
```bash
TOKEN_ID="1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
SECRET="test" npm run mint-token -- --preset nft \
  -i "$TOKEN_ID" \
  -n "$TOKEN_ID"
```

**Expected Behavior**:
- Should work normally
- Nonce and token ID are independent parameters

**Impact**: Low - Cosmetic coincidence

---

### CORNER-038: Public Key Extraction from State

**Priority**: Low
**Category**: Information Leakage

**Description**: Extract public key from token state predicate

**Why Corner Case**: Public keys are intentionally public

**Prerequisites**:
```bash
SECRET="test" npm run mint-token -- -o token.txf
```

**Execution Steps**:
```bash
# Extract public key from state.predicate CBOR
npm run verify-token -- -f token.txf | grep "Public Key"
```

**Expected Behavior**:
- Public key should be visible
- This is expected behavior (not a vulnerability)
- No private key exposure

**Impact**: None - Expected design

---

### CORNER-039: Same Secret Different Nonce Generates Different Addresses

**Priority**: High
**Category**: Cryptographic Correctness

**Description**: Verify that changing nonce changes address for same secret

**Why Corner Case**: Tests masked predicate derivation

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="same-secret" npm run gen-address -- -n "nonce1" > addr1.json
SECRET="same-secret" npm run gen-address -- -n "nonce2" > addr2.json

# Compare addresses
diff <(jq -r '.address' addr1.json) <(jq -r '.address' addr2.json)
```

**Expected Behavior**:
- Addresses should be DIFFERENT
- Nonce affects key derivation
- No nonce leakage

**Impact**: Critical - Security requirement

---

### CORNER-040: Salt Reuse Across Multiple Transfers

**Priority**: Medium
**Category**: Cryptographic Best Practices

**Description**: Manually forcing same salt for multiple transfers

**Why Corner Case**: Tests if system allows salt reuse (it shouldn't matter for security)

**Prerequisites**: Code modification to fix salt

**Execution Steps**:
```bash
# Would require code modification to test
# Salt is randomly generated in send-token
```

**Expected Behavior**:
- Different transfers should use different salts
- Salt reuse doesn't break security but reduces anonymity
- Each transfer has unique RequestId

**Impact**: Low - Salts are random by default

---

## 6. Transaction Chain Edge Cases

### CORNER-041: Empty Transactions Array vs. Undefined

**Priority**: Medium
**Category**: Data Structure

**Description**: Token with `transactions: []` vs. `transactions: undefined` vs. no field

**Why Corner Case**: Different JSON representations

**Prerequisites**: Manual file creation

**Execution Steps**:
```bash
# Create three tokens with different transaction representations
echo '{"transactions": []}' > token1.json
echo '{"transactions": null}' > token2.json
echo '{}' > token3.json # No transactions field

npm run verify-token -- -f token1.json
npm run verify-token -- -f token2.json
npm run verify-token -- -f token3.json
```

**Expected Behavior**:
- All should be treated equivalently (no transactions)
- Validation should handle all cases
- No crashes

**Impact**: Medium - Affects JSON parsing

---

### CORNER-042: Single Transaction in Chain

**Priority**: Low
**Category**: Boundary Condition

**Description**: Token with exactly one transfer (Alice → Bob)

**Why Corner Case**: Minimum transfer chain length

**Prerequisites**:
```bash
SECRET="alice" npm run mint-token -- -o token.txf
SECRET="alice" npm run send-token -- -f token.txf -r "$BOB" -o transfer.txf
SECRET="bob" npm run receive-token -- -f transfer.txf -o bob-token.txf
```

**Execution Steps**:
```bash
npm run verify-token -- -f bob-token.txf
```

**Expected Behavior**:
- Verify shows 1 transaction
- All proofs valid
- Bob is current owner

**Impact**: Low - Normal case, should work

---

### CORNER-043: Maximum Transaction Chain Depth

**Priority**: Medium
**Category**: Scalability

**Description**: Token transferred 100+ times

**Why Corner Case**: Tests file size growth and validation performance

**Prerequisites**: Script to automate many transfers

**Execution Steps**:
```bash
# Transfer token through 100 owners
for i in {1..100}; do
  SECRET="owner-$i" npm run gen-address > addr-$i.json
  ADDR=$(jq -r '.address' addr-$i.json)
  SECRET="owner-$((i-1))" npm run send-token -- -f token.txf -r "$ADDR" --submit-now -o token.txf
done

npm run verify-token -- -f token.txf
```

**Expected Behavior**:
- All 100 transfers validate
- File size grows linearly (~1KB per transfer)
- Verification completes in reasonable time (<5 sec)

**Impact**: Low - Rare but should work

---

### CORNER-044: Gap in Transaction Sequence

**Priority**: High
**Category**: Chain Integrity

**Description**: Transaction #2 missing from chain (genesis → tx1 → tx3)

**Why Corner Case**: Tests chain validation

**Prerequisites**: Manual file manipulation

**Execution Steps**:
```bash
# Create token with 3 transactions
# Then manually remove transaction[1] from JSON

npm run verify-token -- -f broken-chain.txf
SECRET="test" npm run send-token -- -f broken-chain.txf -r "$ADDR"
```

**Expected Behavior**:
- Validation should detect gap
- Error: "Transaction chain broken or incomplete"
- Should not allow further operations

**Current Gap**: No explicit chain continuity validation

---

### CORNER-045: Duplicate Transaction in Array

**Priority**: High
**Category**: Data Integrity

**Description**: Same transaction appears twice in transactions array

**Why Corner Case**: Data duplication or corruption

**Prerequisites**: Manual file manipulation

**Execution Steps**:
```bash
# Duplicate transactions[0] to transactions[1]
npm run verify-token -- -f duplicate-tx.txf
```

**Expected Behavior**:
- Validation should detect duplicate
- Warning or error: "Duplicate transaction detected"

**Current Gap**: No duplicate detection

---

### CORNER-046: Transactions Out of Chronological Order

**Priority**: Medium
**Category**: Temporal Ordering

**Description**: Transaction with later timestamp appears before earlier one

**Why Corner Case**: Clock skew or manual manipulation

**Prerequisites**: Manual file manipulation

**Execution Steps**:
```bash
# Swap transactions[0] and transactions[1] (reverse order)
npm run verify-token -- -f unordered-tx.txf
```

**Expected Behavior**:
- Should validate proof signatures regardless of order
- Warning: "Transactions not in chronological order" (optional)
- Or: No error if proofs are valid

**Impact**: Low - Order might not be enforced

---

## 7. Predicate Edge Cases

### CORNER-047: Predicate with Empty Parameters

**Priority**: High
**Category**: CBOR Structure

**Description**: Predicate CBOR has [engine_id, template, ""] (empty params)

**Why Corner Case**: Malformed predicate

**Prerequisites**: Manual CBOR construction

**Execution Steps**:
```bash
# Create token with malformed predicate
npm run verify-token -- -f empty-params.txf
SECRET="test" npm run send-token -- -f empty-params.txf -r "$ADDR"
```

**Expected Behavior**:
- Validation should fail
- Error: "Invalid predicate structure"
- SDK should reject

**Impact**: High - Security boundary

---

### CORNER-048: Predicate with Wrong CBOR Array Length

**Priority**: High
**Category**: CBOR Structure

**Description**: Predicate CBOR is [engine_id, template] (2 elements) or [engine_id, template, params, extra] (4 elements)

**Why Corner Case**: Tests structural validation

**Prerequisites**: Manual CBOR construction

**Execution Steps**:
```bash
npm run verify-token -- -f wrong-length-predicate.txf
```

**Expected Behavior**:
- Error: "Unexpected CBOR structure: X elements (expected 3)"
- Token cannot be loaded

**Impact**: High - Malformed data

---

### CORNER-049: Predicate with Unknown Engine ID

**Priority**: High
**Category**: Engine Validation

**Description**: Engine ID is 99 (not 0 or 1)

**Why Corner Case**: Tests engine ID validation

**Prerequisites**: Manual CBOR construction

**Execution Steps**:
```bash
# CBOR: [99, template, params]
npm run verify-token -- -f unknown-engine.txf
```

**Expected Behavior**:
- Error: "Unknown engine ID: 99"
- Or: SDK handles as custom engine

**Impact**: High - Unknown predicate type

---

### CORNER-050: Mixed Engine IDs in Transaction Chain

**Priority**: Medium
**Category**: Chain Consistency

**Description**: Genesis has engine 0 (unmasked), first transfer has engine 1 (masked), second back to 0

**Why Corner Case**: Tests if chain allows mixing types

**Prerequisites**: Manual construction or intentional mixing

**Execution Steps**:
```bash
# Alice (unmasked) → Bob (masked) → Carol (unmasked)
SECRET="alice" npm run mint-token -- -o token.txf
SECRET="bob" npm run gen-address -- -n "bob-nonce" > bob.json
SECRET="alice" npm run send-token -- -f token.txf -r "$(jq -r '.address' bob.json)" -o t1.txf
SECRET="bob" npm run receive-token -- -f t1.txf -o bob-token.txf
SECRET="carol" npm run gen-address > carol.json
SECRET="bob" npm run send-token -- -f bob-token.txf -r "$(jq -r '.address' carol.json)" -o t2.txf
```

**Expected Behavior**:
- Should work fine
- Engine ID is per-predicate, not per-token
- Each owner can use any engine

**Impact**: Low - This is correct behavior

---

### CORNER-051: Predicate Public Key Doesn't Match Genesis Recipient

**Priority**: Critical
**Category**: Ownership Validation

**Description**: State predicate's public key doesn't correspond to genesis recipient address

**Why Corner Case**: Detects tampering or corruption

**Prerequisites**: Manual predicate modification

**Execution Steps**:
```bash
# Modify state.predicate to use different public key
npm run verify-token -- -f mismatched-key.txf
SECRET="test" npm run send-token -- -f mismatched-key.txf -r "$ADDR"
```

**Expected Behavior**:
- Validation should detect mismatch
- Error: "Predicate public key doesn't match recipient"
- SDK load should fail

**Current Gap**: Implicit validation through proof, not explicit check

---

## 8. JSON/CBOR Edge Cases

### CORNER-052: JSON with Comments

**Priority**: Low
**Category**: JSON Parsing

**Description**: Token file has // or /* */ comments (invalid JSON)

**Why Corner Case**: Users might manually edit and add comments

**Prerequisites**: Manual file creation

**Execution Steps**:
```bash
cat > commented-token.txf <<EOF
{
  "version": "2.0",
  // This is a comment
  "state": {...}
}
EOF

npm run verify-token -- -f commented-token.txf
```

**Expected Behavior**:
- JSON.parse() should fail
- Error: "Unexpected token / in JSON at position X"
- Clear error message

**Impact**: Low - Invalid JSON

---

### CORNER-053: JSON with Trailing Comma

**Priority**: Low
**Category**: JSON Parsing

**Description**: JSON object with trailing comma (non-standard but common)

**Why Corner Case**: Some parsers allow it

**Prerequisites**: Manual file creation

**Execution Steps**:
```bash
cat > trailing-comma.txf <<EOF
{
  "version": "2.0",
  "state": {...},
}
EOF

npm run verify-token -- -f trailing-comma.txf
```

**Expected Behavior**:
- Node.js JSON.parse() should fail (strict mode)
- Error: "Unexpected token } in JSON"

**Impact**: Low - Invalid JSON

---

### CORNER-054: JSON with Duplicate Keys

**Priority**: Medium
**Category**: JSON Parsing

**Description**: JSON object has same key twice

**Why Corner Case**: JSON spec allows it, last value wins

**Prerequisites**: Manual file creation

**Execution Steps**:
```bash
cat > duplicate-key.txf <<EOF
{
  "version": "2.0",
  "version": "1.0",
  "state": {...}
}
EOF

npm run verify-token -- -f duplicate-key.txf
```

**Expected Behavior**:
- JSON.parse() succeeds, uses last value
- version would be "1.0"
- Validation might detect inconsistency

**Impact**: Low - Unusual but valid JSON

---

### CORNER-055: Deeply Nested JSON (100+ levels)

**Priority**: Low
**Category**: Stack Limits

**Description**: JSON with extreme nesting depth

**Why Corner Case**: Tests parser stack limits

**Prerequisites**: Generate deep JSON

**Execution Steps**:
```bash
# Generate JSON with 1000 levels of nesting
python3 -c "print('{' * 1000 + '\"value\": 1' + '}' * 1000)" > deep.json
npm run verify-token -- -f deep.json
```

**Expected Behavior**:
- JSON.parse() should succeed (Node.js handles deep nesting)
- Or: Error if exceeds limit
- No crash

**Impact**: Low - Extremely rare

---

### CORNER-056: CBOR with Invalid Length Prefix

**Priority**: High
**Category**: CBOR Parsing

**Description**: Predicate CBOR has length prefix that doesn't match actual length

**Why Corner Case**: Corrupted or malicious data

**Prerequisites**: Manual CBOR construction

**Execution Steps**:
```bash
# Create predicate with wrong length byte
npm run verify-token -- -f bad-cbor.txf
```

**Expected Behavior**:
- CborDecoder should throw error
- Error: "CBOR length mismatch" or similar
- Token cannot be loaded

**Impact**: High - Corrupted data

---

### CORNER-057: CBOR with Undefined Tag

**Priority**: Medium
**Category**: CBOR Parsing

**Description**: CBOR uses tag that's not in standard

**Why Corner Case**: Future compatibility

**Prerequisites**: Manual CBOR construction

**Execution Steps**:
```bash
# Use CBOR tag 999 (undefined)
npm run verify-token -- -f tagged-cbor.txf
```

**Expected Behavior**:
- CborDecoder might ignore unknown tags
- Or: Error "Unsupported CBOR tag"
- Should fail gracefully

**Impact**: Low - Unlikely

---

### CORNER-058: JSON with Very Large Number

**Priority**: Medium
**Category**: Number Precision

**Description**: JSON contains number larger than Number.MAX_VALUE

**Why Corner Case**: JSON.parse() precision limits

**Prerequisites**: Manual file creation

**Execution Steps**:
```bash
cat > large-number.txf <<EOF
{
  "version": "2.0",
  "largeValue": 9999999999999999999999999999999
}
EOF

npm run verify-token -- -f large-number.txf
```

**Expected Behavior**:
- JSON.parse() succeeds but loses precision
- Number becomes Infinity or imprecise
- Validation should catch if used in critical field

**Impact**: Medium - Numeric precision matters

---

### CORNER-059: UTF-8 BOM in JSON File

**Priority**: Low
**Category**: Encoding

**Description**: Token file starts with UTF-8 Byte Order Mark (0xEF 0xBB 0xBF)

**Why Corner Case**: Windows editors often add BOM

**Prerequisites**: Create file with BOM

**Execution Steps**:
```bash
# Add BOM to file
printf '\xEF\xBB\xBF' | cat - token.txf > token-bom.txf
npm run verify-token -- -f token-bom.txf
```

**Expected Behavior**:
- Node.js should handle BOM transparently
- JSON.parse() succeeds
- No issues

**Impact**: Low - Should work automatically

---

## 9. Time-Based Edge Cases

### CORNER-060: Timestamp in Year 2038 (Unix Epoch Overflow)

**Priority**: Low
**Category**: Y2038 Problem

**Description**: Token with timestamp >= 2^31-1 (January 19, 2038)

**Why Corner Case**: 32-bit time_t overflow

**Prerequisites**: Set system clock to future date

**Execution Steps**:
```bash
# Set clock to 2038
sudo date -s "2038-01-19 03:14:07"

SECRET="test" npm run mint-token -- --preset nft --save

# Check timestamp in file
cat *.txf | jq '.offlineTransfer.commitment.timestamp'
```

**Expected Behavior**:
- JavaScript Date.now() returns 64-bit timestamp
- Should work fine (no 32-bit limit)
- Timestamp > 2^31

**Impact**: Low - JavaScript handles it

---

### CORNER-061: Transaction with Timestamp Zero

**Priority**: Low
**Category**: Epoch Time

**Description**: Transfer commitment with timestamp = 0 (Unix epoch start)

**Why Corner Case**: Special time value

**Prerequisites**: Manual modification

**Execution Steps**:
```bash
# Modify offlineTransfer.commitment.timestamp to 0
npm run receive-token -- -f zero-time.txf
```

**Expected Behavior**:
- Should accept (valid timestamp)
- Represents 1970-01-01 00:00:00 UTC
- No special handling needed

**Impact**: Low - Valid but unusual

---

### CORNER-062: Future-Dated Transaction

**Priority**: Medium
**Category**: Clock Skew

**Description**: Transfer commitment timestamp is in the future

**Why Corner Case**: Clock synchronization issues

**Prerequisites**: Manual modification

**Execution Steps**:
```bash
# Set timestamp to 2030
# commitment.timestamp = Date.now() + 10 years
npm run receive-token -- -f future-tx.txf
```

**Expected Behavior**:
- Should accept (network doesn't validate timestamp)
- Timestamp is informational, not cryptographic
- No rejection

**Impact**: Low - Not validated by system

---

### CORNER-063: Two Transactions with Identical Timestamp

**Priority**: Low
**Category**: Timestamp Collision

**Description**: Multiple transfers with same millisecond timestamp

**Why Corner Case**: Ordering ambiguity

**Prerequisites**: Rapid successive transfers

**Execution Steps**:
```bash
# Transfer twice in same millisecond (difficult but possible)
SECRET="test" npm run send-token -- -f token.txf -r "$ADDR1" -o t1.txf &
SECRET="test" npm run send-token -- -f token.txf -r "$ADDR2" -o t2.txf &
```

**Expected Behavior**:
- Both get same timestamp (possible)
- Network sequence determines order
- Only first succeeds (second is double-spend)

**Impact**: Low - Network ordering is authoritative

---

### CORNER-064: Very Old Token (Created 5 Years Ago)

**Priority**: Low
**Category**: Aging Data

**Description**: Token file from old SDK version or old genesis

**Why Corner Case**: Tests backward compatibility

**Prerequisites**: Archive old token or modify timestamp

**Execution Steps**:
```bash
# Use old token from 2020
npm run verify-token -- -f ancient-token.txf
SECRET="test" npm run send-token -- -f ancient-token.txf -r "$ADDR"
```

**Expected Behavior**:
- Should work if TXF format compatible
- Proofs still valid (no expiration)
- Transfer succeeds

**Impact**: Low - Tokens don't expire

---

## 10. Environment Edge Cases

### CORNER-065: Missing NODE_ENV Variable

**Priority**: Low
**Category**: Environment

**Description**: NODE_ENV is undefined

**Why Corner Case**: Some code paths might check NODE_ENV

**Prerequisites**: None

**Execution Steps**:
```bash
unset NODE_ENV
SECRET="test" npm run mint-token -- --preset nft
```

**Expected Behavior**:
- Should work normally
- No dependency on NODE_ENV
- Default to production behavior

**Impact**: Low - Should be independent

---

### CORNER-066: $HOME Directory Not Writable

**Priority**: Medium
**Category**: Permissions

**Description**: User home directory is read-only

**Why Corner Case**: Affects cache and config file locations

**Prerequisites**:
```bash
chmod 555 $HOME
```

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft --save
```

**Expected Behavior**:
- Should work (writes to current directory, not $HOME)
- Or: Error if tries to write to $HOME

**Impact**: Low - CLI doesn't write to $HOME

---

### CORNER-067: Multiple SECRET Environment Variables

**Priority**: Low
**Category**: Environment Conflict

**Description**: SECRET set multiple times in environment

**Why Corner Case**: Shell behavior

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="first" SECRET="second" npm run gen-address
```

**Expected Behavior**:
- Last value wins ("second")
- Normal shell behavior

**Impact**: Low - User error

---

### CORNER-068: SECRET with Newline at End

**Priority**: Medium
**Category**: Input Handling

**Description**: SECRET="mypassword\n" (trailing newline)

**Why Corner Case**: Affects key derivation

**Prerequisites**: None

**Execution Steps**:
```bash
export SECRET=$'mypassword\n'
npm run gen-address > addr1.json

export SECRET="mypassword"
npm run gen-address > addr2.json

# Compare
diff addr1.json addr2.json
```

**Expected Behavior**:
- Addresses should be DIFFERENT
- Newline is part of secret
- No automatic trimming

**Impact**: Medium - User might copy-paste with newline

---

### CORNER-069: TRUSTBASE_PATH Points to Directory

**Priority**: High
**Category**: Configuration Error

**Description**: TRUSTBASE_PATH is a directory, not a file

**Why Corner Case**: User error in configuration

**Prerequisites**:
```bash
mkdir /tmp/trustbase-dir
export TRUSTBASE_PATH=/tmp/trustbase-dir
```

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft
```

**Expected Behavior**:
- Error: "EISDIR: illegal operation on a directory"
- Fall back to default trust base
- Clear error message

**Impact**: Medium - Configuration mistake

---

### CORNER-070: TRUSTBASE_PATH File is Empty

**Priority**: High
**Category**: Configuration Error

**Description**: Trust base file exists but is 0 bytes

**Why Corner Case**: Incomplete download or corruption

**Prerequisites**:
```bash
touch /tmp/empty-trustbase.json
export TRUSTBASE_PATH=/tmp/empty-trustbase.json
```

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft
```

**Expected Behavior**:
- JSON.parse() fails on empty string
- Error: "Unexpected end of JSON input"
- Fall back to default trust base

**Impact**: Medium - Corrupted config

---

### CORNER-071: Running on Different OS (Windows vs. Linux vs. Mac)

**Priority**: High
**Category**: Cross-Platform

**Description**: Test token files created on one OS work on another

**Why Corner Case**: Path separators, line endings

**Prerequisites**: Multi-OS environment

**Execution Steps**:
```bash
# On Windows: Create token
SECRET="test" npm run mint-token -- --preset nft -o token.txf

# Copy to Linux
scp token.txf linux-host:

# On Linux: Verify and send
ssh linux-host 'npm run verify-token -- -f token.txf'
```

**Expected Behavior**:
- Should work cross-platform
- JSON is platform-independent
- No line ending issues

**Impact**: High - Real-world usage

---

### CORNER-072: $SHELL is /bin/sh (Not Bash)

**Priority**: Low
**Category**: Shell Compatibility

**Description**: Running in POSIX sh instead of bash

**Why Corner Case**: Different shell features

**Prerequisites**:
```bash
SHELL=/bin/sh npm run gen-address
```

**Execution Steps**: See above

**Expected Behavior**:
- Should work (npm run doesn't depend on shell features)
- No bashisms in package.json scripts

**Impact**: Low - npm handles this

---

### CORNER-073: Locale Set to Non-English

**Priority**: Low
**Category**: Internationalization

**Description**: LC_ALL=ja_JP.UTF-8 (Japanese locale)

**Why Corner Case**: Error messages and output

**Prerequisites**:
```bash
export LC_ALL=ja_JP.UTF-8
```

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft
```

**Expected Behavior**:
- CLI output still in English (hardcoded)
- No character encoding issues
- Dates might format differently

**Impact**: Low - English-only UI

---

### CORNER-074: TZ Set to Unusual Timezone

**Priority**: Low
**Category**: Timezone Handling

**Description**: TZ=Pacific/Chatham (UTC+12:45, unusual offset)

**Why Corner Case**: Timestamp formatting

**Prerequisites**:
```bash
export TZ=Pacific/Chatham
```

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft --save
# Check filename timestamp
ls -la *.txf
```

**Expected Behavior**:
- Filename timestamps use UTC or local time
- Should work regardless of timezone

**Impact**: Low - Cosmetic

---

### CORNER-075: Running as Root User

**Priority**: High
**Category**: Security

**Description**: Running CLI with root privileges

**Why Corner Case**: Security implications

**Prerequisites**: Root access

**Execution Steps**:
```bash
sudo SECRET="test" npm run mint-token -- --preset nft
```

**Expected Behavior**:
- Should work but warn
- Warning: "Running as root is not recommended"
- File permissions might be root-owned

**Impact**: Medium - Security consideration

---

### CORNER-076: Process Receives SIGTERM During Operation

**Priority**: High
**Category**: Signal Handling

**Description**: Kill process during network operation

**Why Corner Case**: Graceful shutdown

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft &
PID=$!
sleep 2
kill $PID
```

**Expected Behavior**:
- Process exits cleanly
- No partial/corrupted files left
- Or: File marked as incomplete

**Impact**: High - Real-world interruptions

---

### CORNER-077: Out of Memory (Node.js Heap)

**Priority**: High
**Category**: Resource Limits

**Description**: Process exceeds memory limit

**Why Corner Case**: Large data handling

**Prerequisites**:
```bash
# Limit heap to 100MB
node --max-old-space-size=100 dist/index.js mint-token --preset nft -d "$(python3 -c 'print("x"*100000000)')"
```

**Execution Steps**: See above

**Expected Behavior**:
- Error: "JavaScript heap out of memory"
- Process exits with error code
- Clear error message

**Impact**: Medium - Should have size limits

---

### CORNER-078: CPU Affinity Limited to 1 Core

**Priority**: Low
**Category**: Performance

**Description**: Process pinned to single CPU core

**Why Corner Case**: Performance in constrained environments

**Prerequisites**:
```bash
taskset -c 0 npm run mint-token -- --preset nft
```

**Execution Steps**: See above

**Expected Behavior**:
- Should work (CLI is not CPU-intensive)
- Slightly slower cryptographic operations
- No functional issues

**Impact**: Low - Performance only

---

## Additional Corner Cases by Category

### Predicate and Address Generation

### CORNER-079: Generate 10,000 Addresses from Same Secret

**Priority**: Medium
**Category**: Performance and Uniqueness

**Description**: Generate many masked addresses with sequential nonces

**Why Corner Case**: Tests address uniqueness and performance

**Prerequisites**: None

**Execution Steps**:
```bash
for i in {1..10000}; do
  SECRET="same-secret" npm run gen-address -- -n "nonce-$i" >> addresses.txt
done

# Check for duplicates
cat addresses.txt | jq -r '.address' | sort | uniq -d
```

**Expected Behavior**:
- All 10,000 addresses unique
- Completes in reasonable time (<5 min)
- No duplicates

**Impact**: Medium - Bulk operations

---

### CORNER-080: Nonce as Empty String vs. No Nonce

**Priority**: High
**Category**: Input Interpretation

**Description**: `-n ""` vs. no -n flag

**Why Corner Case**: Different code paths

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run gen-address -- -n "" > addr1.json
SECRET="test" npm run gen-address > addr2.json

# Compare types
jq '.type' addr1.json
jq '.type' addr2.json
```

**Expected Behavior**:
- `-n ""` might be treated as:
  - Hash of empty string (32 bytes)
  - Or same as no nonce (unmasked)
- Should be consistent

**Current Code**: Empty string would be hashed to 32 bytes (masked)

---

### CORNER-081: Preset Name with Wrong Case

**Priority**: Medium
**Category**: Input Normalization

**Description**: `--preset NFT` or `--preset UcT`

**Why Corner Case**: Case sensitivity

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset NFT
SECRET="test" npm run mint-token -- --preset UcT
SECRET="test" npm run mint-token -- --preset UsD
```

**Expected Behavior**:
- Should work (code does `.toLowerCase()`)
- All case variations accepted

**Current Code**: Correctly handles case

---

### Network and Proof Handling

### CORNER-082: Inclusion Proof with Empty Merkle Steps Array

**Priority**: High
**Category**: Proof Structure

**Description**: Merkle path has `steps: []` (empty array)

**Why Corner Case**: Leaf node in tree

**Prerequisites**: Single transaction in block

**Execution Steps**: Would occur naturally with single-transaction block

**Expected Behavior**:
- Valid proof (leaf node has no siblings)
- Should validate successfully

**Impact**: Low - Valid edge case

---

### CORNER-083: Authenticator Signature with All-Zero Values

**Priority**: High
**Category**: Cryptographic Validation

**Description**: Authenticator signature is 64 bytes of zeros

**Why Corner Case**: Invalid signature

**Prerequisites**: Manual modification

**Execution Steps**:
```bash
# Modify inclusionProof.authenticator.signature to all zeros
npm run verify-token -- -f zero-sig.txf
```

**Expected Behavior**:
- Signature verification fails
- Error: "Authenticator signature verification failed"
- Token invalid

**Impact**: High - Security boundary

---

### CORNER-084: Network Returns Proof with Different RequestId

**Priority**: Critical
**Category**: Network Integrity

**Description**: Aggregator returns proof for wrong request

**Why Corner Case**: Network error or attack

**Prerequisites**: Mock aggregator

**Execution Steps**: Mock aggregator swaps RequestIds

**Expected Behavior**:
- Validation detects mismatch
- Error: "Proof RequestId doesn't match commitment"
- Reject proof

**Impact**: Critical - Security requirement

---

### File Operations

### CORNER-085: Token File with No Read Permissions

**Priority**: Medium
**Category**: File Permissions

**Description**: Token file exists but user cannot read it

**Why Corner Case**: Permission issues

**Prerequisites**:
```bash
touch secret-token.txf
chmod 000 secret-token.txf
```

**Execution Steps**:
```bash
npm run verify-token -- -f secret-token.txf
```

**Expected Behavior**:
- Error: "EACCES: permission denied"
- Clear error message

**Impact**: Medium - Permission problems

---

### CORNER-086: Stdout Redirected to /dev/null

**Priority**: Low
**Category**: Output Handling

**Description**: User redirects output to /dev/null

**Why Corner Case**: Silent operation

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft --stdout > /dev/null
```

**Expected Behavior**:
- Should work normally
- No errors from missing stdout
- stderr still shows progress

**Impact**: Low - Valid usage

---

### CORNER-087: Atomic Write Failure

**Priority**: High
**Category**: File Safety

**Description**: System crashes during fs.writeFileSync()

**Why Corner Case**: Data corruption

**Prerequisites**: Simulate crash or power loss

**Execution Steps**: Hard to test - would need kill -9 at exact moment

**Expected Behavior**:
- Old file preserved OR new file written
- No partial/corrupted file
- Atomic write if possible

**Current Implementation**: writeFileSync() is not atomic

**Recommendation**: Use write-to-temp-then-rename pattern

---

### Input Processing

### CORNER-088: JSON Token Data with Unescaped Quotes

**Priority**: Medium
**Category**: JSON Escaping

**Description**: Token data JSON contains unescaped " characters

**Why Corner Case**: Nested JSON escaping

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft \
  -d '{"name":"Alice "The Great""}'
```

**Expected Behavior**:
- Should fail (invalid JSON)
- Error: "Unexpected token T in JSON"
- User must escape properly

**Impact**: Medium - User error

---

### CORNER-089: Token Data as Valid JSON Array

**Priority**: Low
**Category**: Data Structure

**Description**: Token data is JSON array instead of object

**Why Corner Case**: Tests JSON type handling

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft \
  -d '[1, 2, 3, "test"]'
```

**Expected Behavior**:
- Should accept (valid JSON)
- Array serialized as UTF-8 bytes
- Transfer preserves array

**Impact**: Low - Valid use case

---

### CORNER-090: Recipient Address with Query Parameters

**Priority**: Low
**Category**: Address Parsing

**Description**: Address like `DIRECT://0000...?param=value`

**Why Corner Case**: URI format might support query strings

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- -o token.txf
npm run send-token -- -f token.txf -r "DIRECT://0000...?extra=data"
```

**Expected Behavior**:
- Should reject (invalid address format)
- Error: "Invalid address format"
- Or: Parse and ignore query params

**Impact**: Low - Invalid format

---

### Ownership and Verification

### CORNER-091: Verify Token with Mismatched TrustBase

**Priority**: High
**Category**: Network Mismatch

**Description**: Token from network A verified with trustbase from network B

**Why Corner Case**: Multi-network scenarios

**Prerequisites**: Two different networks

**Execution Steps**:
```bash
# Mint on network A
SECRET="test" npm run mint-token -- --preset nft -e http://network-a:3000 -o token-a.txf

# Verify with network B trustbase
TRUSTBASE_PATH=/path/to/network-b-trustbase.json npm run verify-token -- -f token-a.txf
```

**Expected Behavior**:
- Authenticator verification fails
- Error: "Authenticator public key not in trust base"
- Or: Warning about network mismatch

**Impact**: High - Multi-network deployments

---

### CORNER-092: Check Ownership of Token Never Submitted

**Priority**: Medium
**Category**: Ownership Verification

**Description**: Create offline transfer package but never submit, check ownership

**Why Corner Case**: Tests pending state

**Prerequisites**:
```bash
SECRET="alice" npm run mint-token -- -o token.txf
SECRET="alice" npm run send-token -- -f token.txf -r "$BOB" -o transfer.txf
```

**Execution Steps**:
```bash
# Don't receive, just verify
npm run verify-token -- -f transfer.txf
```

**Expected Behavior**:
- Status: PENDING
- On-chain: UNSPENT (still owned by Alice)
- Shows pending recipient
- "Transfer not yet submitted"

**Current Behavior**: Code handles this (Scenario C)

---

### CORNER-093: Token State Public Key Doesn't Match Any Transaction

**Priority**: High
**Category**: Data Corruption

**Description**: State predicate's public key doesn't appear in any transaction or genesis

**Why Corner Case**: Corruption detection

**Prerequisites**: Manual state modification

**Execution Steps**:
```bash
# Replace state.predicate with random predicate
npm run verify-token -- -f corrupted-state.txf
```

**Expected Behavior**:
- Warning: "State owner cannot be determined from transaction history"
- Shows public key but "Unknown" address

**Current Behavior**: extractOwnerInfo() handles gracefully

---

### Concurrent Operations

### CORNER-094: Two Processes Reading Same Token File

**Priority**: Low
**Category**: Concurrent Read

**Description**: Multiple processes verify same token simultaneously

**Why Corner Case**: File locking

**Prerequisites**:
```bash
SECRET="test" npm run mint-token -- -o token.txf
```

**Execution Steps**:
```bash
npm run verify-token -- -f token.txf &
npm run verify-token -- -f token.txf &
npm run verify-token -- -f token.txf &
wait
```

**Expected Behavior**:
- All three succeed
- No file locking issues
- Read-only operations are safe

**Impact**: Low - Should work fine

---

### CORNER-095: Modify Token File While Process is Reading

**Priority**: High
**Category**: Race Condition

**Description**: Token file modified between read and operation

**Why Corner Case**: TOCTOU (Time-of-Check-Time-of-Use)

**Prerequisites**: Two terminal windows

**Execution Steps**:
```bash
# Terminal 1: Start long operation
SECRET="test" npm run send-token -- -f token.txf -r "$ADDR" --submit-now

# Terminal 2: Quickly modify token.txf
sleep 1
echo '{"corrupted": true}' > token.txf
```

**Expected Behavior**:
- Operation uses in-memory token (already loaded)
- Or: Detects file changed and errors
- No use of corrupted data

**Impact**: Medium - Race condition

---

### Docker and Containerization

### CORNER-096: Extract TrustBase from Non-Running Container

**Priority**: Medium
**Category**: Docker Integration

**Description**: trustbase-loader tries to extract from stopped container

**Why Corner Case**: Container lifecycle

**Prerequisites**:
```bash
docker stop aggregator-service
```

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft --local
```

**Expected Behavior**:
- findAggregatorContainer() returns null
- Falls back to default trustbase
- Warning: "No running aggregator container found"

**Current Behavior**: Code handles this

---

### CORNER-097: Multiple Aggregator Containers Running

**Priority**: Medium
**Category**: Docker Integration

**Description**: Two aggregator containers with different trustbases

**Why Corner Case**: Multi-instance deployment

**Prerequisites**:
```bash
docker run -d --name aggregator-1 ...
docker run -d --name aggregator-2 ...
```

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft --local
```

**Expected Behavior**:
- findAggregatorContainer() returns first match
- Warning: "Multiple aggregator containers found"
- User should specify TRUSTBASE_PATH explicitly

**Current Behavior**: Uses first match

---

### Command Line Parsing

### CORNER-098: Unknown Command Line Flags

**Priority**: Low
**Category**: CLI Parsing

**Description**: Provide flag that doesn't exist

**Why Corner Case**: Typos and help messages

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft --unknown-flag
```

**Expected Behavior**:
- Commander.js shows error
- Error: "error: unknown option '--unknown-flag'"
- Shows help message

**Impact**: Low - User error, handled by library

---

### CORNER-099: Conflicting Flags

**Priority**: High
**Category**: CLI Validation

**Description**: Provide mutually exclusive flags

**Why Corner Case**: Input validation

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft --local --production
SECRET="test" npm run mint-token -- --preset nft --stdout --save
SECRET="test" npm run send-token -- -f token.txf -r "$ADDR" --submit-now -o offline.txf
```

**Expected Behavior**:
- Detect conflicts
- Error: "--local and --production are mutually exclusive"
- Or: Use precedence (last flag wins)

**Current Behavior**: No conflict detection, likely last wins

---

### CORNER-100: Flag Value with Equals Sign

**Priority**: Low
**Category**: CLI Parsing

**Description**: Use `--endpoint=http://...` instead of `--endpoint http://...`

**Why Corner Case**: Different CLI styles

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset=nft --endpoint=http://localhost:3000
```

**Expected Behavior**:
- Should work (Commander.js supports both)
- Same as space-separated

**Impact**: Low - Should work automatically

---

### SDK Integration

### CORNER-101: SDK Throws Unexpected Error Type

**Priority**: High
**Category**: Error Handling

**Description**: SDK throws non-Error object

**Why Corner Case**: Error handling assumptions

**Prerequisites**: Mock SDK that throws string

**Execution Steps**: Requires SDK modification to test

**Expected Behavior**:
- `error instanceof Error` check fails
- Falls back to `String(error)`
- No crash

**Current Code**: Has fallback: `error instanceof Error ? error.message : String(error)`

---

### CORNER-102: SDK Returns Promise That Never Resolves

**Priority**: High
**Category**: Timeout Handling

**Description**: SDK method hangs indefinitely

**Why Corner Case**: Network issues or SDK bugs

**Prerequisites**: Mock SDK

**Execution Steps**: Would require SDK mock

**Expected Behavior**:
- Timeout after reasonable duration
- Error: "Operation timed out after X seconds"
- Process doesn't hang forever

**Current Gap**: No global timeout wrapper

---

### CORNER-103: Token.fromJSON() Succeeds But Returns Invalid Token

**Priority**: High
**Category**: SDK Validation

**Description**: SDK loads token but internal state is invalid

**Why Corner Case**: SDK bug or version mismatch

**Prerequisites**: Carefully crafted malformed JSON

**Execution Steps**:
```bash
# Create JSON that SDK accepts but is semantically invalid
npm run verify-token -- -f edge-case-token.txf
```

**Expected Behavior**:
- Subsequent operations should detect issues
- Validation catches problems
- Error messages indicate SDK/token mismatch

**Impact**: Medium - SDK should be robust

---

### Extended TXF Format

### CORNER-104: Status Field is Null

**Priority**: Medium
**Category**: Data Types

**Description**: `"status": null` instead of string or undefined

**Why Corner Case**: Different from undefined or missing

**Prerequisites**: Manual file creation

**Execution Steps**:
```bash
echo '{"version": "2.0", "status": null, ...}' > null-status.txf
npm run verify-token -- -f null-status.txf
```

**Expected Behavior**:
- Validation should handle null
- Treat as undefined (unknown status)
- Or: Error "Invalid status value: null"

**Impact**: Medium - Data hygiene

---

### CORNER-105: OfflineTransfer Version Mismatch

**Priority**: Medium
**Category**: Version Compatibility

**Description**: offlineTransfer.version is "2.0" instead of "1.1"

**Why Corner Case**: Future version handling

**Prerequisites**: Manual modification

**Execution Steps**:
```bash
# Set offlineTransfer.version to "2.0"
SECRET="test" npm run receive-token -- -f future-version.txf
```

**Expected Behavior**:
- Warning: "Offline transfer version 2.0 may not be compatible"
- Attempt to process anyway
- Or: Error if truly incompatible

**Current Behavior**: Generates warning

---

### CORNER-106: OfflineTransfer with Invalid commitmentData JSON

**Priority**: High
**Category**: Data Validation

**Description**: commitmentData field contains invalid JSON

**Why Corner Case**: Corruption detection

**Prerequisites**: Manual modification

**Execution Steps**:
```bash
# Set commitmentData to invalid JSON
SECRET="test" npm run receive-token -- -f bad-commitment.txf
```

**Expected Behavior**:
- Error during validation
- "Commitment data is not valid JSON"
- Fail before network submission

**Current Behavior**: validateExtendedTxf() catches this

---

### Secret Management

### CORNER-107: SECRET from File Descriptor

**Priority**: Low
**Category**: Secret Input

**Description**: Read secret from file descriptor instead of env var

**Why Corner Case**: More secure than env var

**Prerequisites**:
```bash
echo "my-secret" > secret.txt
```

**Execution Steps**:
```bash
SECRET=$(cat secret.txt) npm run gen-address
# Or read from stdin
echo "my-secret" | SECRET=$(cat) npm run gen-address
```

**Expected Behavior**:
- Should work (SECRET is just a string)
- Same as normal env var

**Impact**: Low - More secure pattern

---

### CORNER-108: Interactive Secret Prompt Times Out

**Priority**: Low
**Category**: User Input

**Description**: User doesn't enter secret when prompted (terminal hangs)

**Why Corner Case**: Unattended operation

**Prerequisites**: No SECRET env var

**Execution Steps**:
```bash
# Run without SECRET and don't type anything
npm run gen-address
# Wait indefinitely...
```

**Expected Behavior**:
- Readline waits forever (no timeout)
- User must Ctrl+C to exit
- Or: Implement timeout

**Current Behavior**: No timeout on readline

---

### CORNER-109: Secret Prompt on Non-TTY

**Priority**: Medium
**Category**: Automation

**Description**: CLI tries to prompt for secret in non-interactive environment

**Why Corner Case**: CI/CD pipelines

**Prerequisites**: None

**Execution Steps**:
```bash
echo "" | npm run gen-address
# Or in Docker without -it flags
```

**Expected Behavior**:
- Detect non-TTY
- Error: "SECRET environment variable required in non-interactive mode"
- Don't hang

**Current Behavior**: Readline might read empty line

---

### Miscellaneous

### CORNER-110: Zero-Length Output File Path

**Priority**: Low
**Category**: Path Handling

**Description**: `-o ""` (empty string output path)

**Why Corner Case**: Invalid input

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft -o ""
```

**Expected Behavior**:
- Error: "Invalid output path"
- Or: Create file with empty name (weird but possible)

**Impact**: Low - User error

---

### CORNER-111: Token Data Contains Control Characters

**Priority**: Low
**Category**: Data Sanitization

**Description**: Token data with ASCII control characters (0x00-0x1F)

**Why Corner Case**: Binary data handling

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft -d $'\x00\x01\x02\x03\x04'
```

**Expected Behavior**:
- Should accept (valid UTF-8 bytes)
- Data preserved as-is
- Transfer works

**Impact**: Low - Binary data is valid

---

### CORNER-112: Address Encoding with Mixed Case

**Priority**: Low
**Category**: Address Normalization

**Description**: Recipient address with mixed-case hex (if applicable)

**Why Corner Case**: Case sensitivity

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run send-token -- -f token.txf \
  -r "DIRECT://00000000AbCdEf..."
```

**Expected Behavior**:
- Address parsing should be case-insensitive
- Or: Case is preserved

**Impact**: Low - AddressFactory handles this

---

### CORNER-113: Filesystem with No Execute Permission on Directory

**Priority**: Medium
**Category**: Permissions

**Description**: Working directory has no execute permission

**Why Corner Case**: Unusual permissions

**Prerequisites**:
```bash
mkdir /tmp/no-exec
chmod 644 /tmp/no-exec
cd /tmp/no-exec
```

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft
```

**Expected Behavior**:
- Error: "Permission denied" when accessing directory
- Clear error message

**Impact**: Low - Rare configuration

---

### CORNER-114: Token with TXF Version 1.0

**Priority**: Medium
**Category**: Version Compatibility

**Description**: Old TXF format from earlier CLI version

**Why Corner Case**: Backward compatibility

**Prerequisites**: Create v1.0 token

**Execution Steps**:
```bash
echo '{"version": "1.0", ...}' > old-token.txf
npm run verify-token -- -f old-token.txf
```

**Expected Behavior**:
- Error: "Unsupported TXF version: 1.0"
- Or: Attempt to upgrade to v2.0

**Current Validation**: Checks for version "2.0"

---

### CORNER-115: Coin Amount Specified as String "0x..." (Hex)

**Priority**: Low
**Category**: Input Parsing

**Description**: Coin amount in hexadecimal format

**Why Corner Case**: Different number representations

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset uct -c "0x1000000000000000"
```

**Expected Behavior**:
- BigInt("0x...") should parse hex
- Or: Error "Invalid coin amount format"

**Impact**: Low - Unusual input

---

### CORNER-116: Transfer Message with Emoji

**Priority**: Low
**Category**: Unicode Handling

**Description**: Transfer message contains emoji characters

**Why Corner Case**: UTF-8 multi-byte characters

**Prerequisites**:
```bash
SECRET="test" npm run mint-token -- -o token.txf
```

**Execution Steps**:
```bash
SECRET="test" npm run send-token -- -f token.txf -r "$ADDR" \
  -m "Great token! 🎉💎🚀"
```

**Expected Behavior**:
- Should encode and transfer correctly
- Emoji preserved in UTF-8
- Recipient sees emoji

**Impact**: Low - Should work automatically

---

### CORNER-117: Verify Token with --skip-network on PENDING Token

**Priority**: Medium
**Category**: Verification Modes

**Description**: Skip network check on pending transfer

**Why Corner Case**: Offline verification

**Prerequisites**:
```bash
SECRET="alice" npm run mint-token -- -o token.txf
SECRET="alice" npm run send-token -- -f token.txf -r "$BOB" -o transfer.txf
```

**Execution Steps**:
```bash
npm run verify-token -- -f transfer.txf --skip-network
```

**Expected Behavior**:
- Shows PENDING status
- Shows offline transfer details
- No network query
- Cannot determine on-chain state

**Impact**: Low - Useful for offline verification

---

### CORNER-118: Both --output and --save Flags Together

**Priority**: Low
**Category**: Flag Precedence

**Description**: Use both -o and --save simultaneously

**Why Corner Case**: Conflicting output instructions

**Prerequisites**: None

**Execution Steps**:
```bash
SECRET="test" npm run mint-token -- --preset nft -o explicit.txf --save
```

**Expected Behavior**:
- Use explicit filename (precedence)
- Or: Error about conflicting flags
- Or: Save to both locations

**Current Code**: -o takes precedence if both present

---

### CORNER-119: Auto-Generated Filename Exceeds Filesystem Limit

**Priority**: Low
**Category**: Filename Length

**Description**: Generated filename exceeds 255 chars

**Why Corner Case**: Very long timestamp or address

**Prerequisites**: Unlikely but possible

**Execution Steps**: Generate with very long address

**Expected Behavior**:
- Truncate filename
- Or: Error "Filename too long"
- Fallback to shorter name

**Impact**: Low - Extremely rare

---

### CORNER-120: Receive Token with Different Nonce

**Priority**: Critical
**Category**: Masked Address Validation

**Description**: Alice sends to Bob's masked address, but Carol tries to receive with her nonce

**Why Corner Case**: Security boundary for masked addresses

**Prerequisites**:
```bash
SECRET="bob" npm run gen-address -- -n "bob-nonce" > bob-masked.json
BOB_ADDR=$(jq -r '.address' bob-masked.json)

SECRET="alice" npm run mint-token -- -o token.txf
SECRET="alice" npm run send-token -- -f token.txf -r "$BOB_ADDR" -o transfer.txf
```

**Execution Steps**:
```bash
# Carol tries to receive with her secret (wrong!)
SECRET="carol" npm run receive-token -- -f transfer.txf
```

**Expected Behavior**:
- Address mismatch detected
- Error: "Generated address doesn't match recipient"
- Cannot steal token

**Impact**: Critical - Security requirement

---

### CORNER-121: Mint with Multiple Coins Having Same CoinId

**Priority**: High
**Category**: Data Validation

**Description**: Manually create token with duplicate CoinIds

**Why Corner Case**: Invalid coin data

**Prerequisites**: Manual JSON construction

**Execution Steps**: Would require SDK modification to create

**Expected Behavior**:
- SDK should reject duplicate CoinIds
- Or: Network rejects on submission
- Error: "Duplicate CoinId detected"

**Impact**: High - Data integrity

---

### CORNER-122: Genesis Without Inclusion Proof

**Priority**: Critical
**Category**: Token Validity

**Description**: Token JSON has genesis but no inclusionProof field

**Why Corner Case**: Incomplete mint

**Prerequisites**: Manual JSON construction

**Execution Steps**:
```bash
echo '{"version": "2.0", "genesis": {"data": {...}}, "state": {...}}' > no-proof.txf
npm run verify-token -- -f no-proof.txf
```

**Expected Behavior**:
- Validation fails
- Error: "Genesis transaction missing inclusion proof"
- Cannot use token

**Current Behavior**: validateTokenProofsJson() catches this

---

### CORNER-123: Transaction Proof with NULL transactionHash

**Priority**: High
**Category**: Proof Completeness

**Description**: Inclusion proof has authenticator but transactionHash is null

**Why Corner Case**: Incomplete proof

**Prerequisites**: Manual modification

**Execution Steps**:
```bash
# Set inclusionProof.transactionHash to null
npm run verify-token -- -f null-txhash.txf
```

**Expected Behavior**:
- Validation fails
- Error: "Transaction hash is null - proof is incomplete"

**Current Behavior**: validateInclusionProofJson() checks this

---

### CORNER-124: Salt in Transfer is Same as Genesis Salt

**Priority**: Low
**Category**: Salt Reuse

**Description**: Transfer commitment uses same salt as genesis

**Why Corner Case**: Salt collision (unlikely with random generation)

**Prerequisites**: Extremely unlikely without manipulation

**Execution Steps**: Would require forcing same random salt

**Expected Behavior**:
- Should work (salts are independent)
- Different RequestIds (different contexts)
- No security issue

**Impact**: Low - Extremely unlikely

---

### CORNER-125: Predicate Template Field is Zero-Length

**Priority**: High
**Category**: Predicate Structure

**Description**: CBOR predicate has empty template field

**Why Corner Case**: Invalid predicate

**Prerequisites**: Manual CBOR construction

**Execution Steps**: Create predicate with empty template

**Expected Behavior**:
- SDK rejects invalid predicate
- Error: "Invalid predicate template"

**Impact**: High - Structural validation

---

### CORNER-126: Network Returns Different Transaction Data

**Priority**: Critical
**Category**: Data Integrity

**Description**: Inclusion proof is valid but transaction data differs from submitted

**Why Corner Case**: Network tampering or corruption

**Prerequisites**: Malicious or corrupted aggregator

**Execution Steps**: Would require compromised aggregator

**Expected Behavior**:
- Hash verification detects tampering
- Error: "Transaction data hash mismatch"
- Reject proof

**Impact**: Critical - Detects data corruption

---

### CORNER-127: Very Old Node.js Version

**Priority**: Medium
**Category**: Version Compatibility

**Description**: Running on Node.js 14 or older

**Why Corner Case**: Compatibility with older runtimes

**Prerequisites**: Node.js 14 environment

**Execution Steps**:
```bash
nvm use 14
npm install
npm run build
SECRET="test" npm run mint-token -- --preset nft
```

**Expected Behavior**:
- Check package.json engines requirement
- Error if incompatible: "Requires Node.js >= X"
- Or: Works if compatible

**Impact**: Medium - Support policy

---

## Summary and Recommendations

### Critical Corner Cases Requiring Immediate Attention

1. **CORNER-007**: Empty string as secret (bypass validation)
2. **CORNER-013**: Negative coin amounts
3. **CORNER-039**: Masked address nonce validation
4. **CORNER-084**: Network returns wrong RequestId proof
5. **CORNER-120**: Cross-nonce token stealing attempt

### High Priority Testing Recommendations

1. **State Consistency**: Tests CORNER-002, 004, 005 (invalid status values and mismatches)
2. **Input Validation**: Tests CORNER-010, 015, 017 (size limits, hex validation)
3. **Network Reliability**: Tests CORNER-026, 027, 028, 033 (partial responses, timeouts)
4. **File Operations**: Tests CORNER-019, 023, 087 (permissions, disk full, atomicity)
5. **Cryptographic Boundaries**: Tests CORNER-035, 036, 083 (zero values, invalid signatures)

### Medium Priority Edge Cases

- Transaction chain integrity (CORNER-041 through 046)
- Predicate structure validation (CORNER-047 through 051)
- JSON/CBOR parsing edge cases (CORNER-052 through 059)
- Environment configuration (CORNER-069, 070, 071)

### Implementation Gaps Identified

1. **No input size limits** on token data, secrets, or other fields
2. **No explicit chain continuity validation** for transaction history
3. **No duplicate transaction detection** in transactions array
4. **No client-side amount validation** (negative or overflow)
5. **Atomic file writes not implemented** (use temp file + rename)
6. **No timeout wrapper** for SDK operations that might hang
7. **No conflict detection** for mutually exclusive CLI flags
8. **No trimming or whitespace validation** for secrets
9. **File write is not atomic** - partial writes possible on crash

### Test Coverage Enhancement

These 127 corner cases complement the existing 96 functional tests and 68 security tests, bringing total documented scenarios to **291 test cases**.

### Execution Priority

**Phase 1 (Critical - P0)**: Tests 007, 013, 039, 084, 120
**Phase 2 (High - P1)**: Tests 002, 004, 010, 015, 019, 023, 026-028, 033
**Phase 3 (Medium - P2)**: Tests 041-046, 047-051, 052-059, 069-071
**Phase 4 (Low - P3)**: Remaining edge cases as time permits

---

**Document Status**: Complete
**Last Updated**: 2025-11-03
**Author**: Claude Code (AI Code Reviewer)
**Total Corner Cases Identified**: 127
