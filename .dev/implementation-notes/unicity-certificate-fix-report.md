# UnicityCertificate Validation Fix Report

## Executive Summary

Successfully identified and fixed the `NOT_AUTHENTICATED` error in UnicityCertificate validation when calling `proof.verify(trustBase, requestId)` in the Unicity CLI.

**Status**: ✅ RESOLVED

## Problem Statement

When minting tokens with the local aggregator at `http://127.0.0.1:3000`:
- ✅ Authenticator validation worked: `authenticator.verify(transactionHash)` returned `true`
- ❌ UnicityCertificate validation failed: `proof.verify(trustBase, requestId)` returned `NOT_AUTHENTICATED`

## Root Cause Analysis

### Investigation Process

1. **Decoded UnicityCertificate from minted token**
   - Extracted the CBOR-encoded certificate from a `.txf` file
   - Parsed the certificate structure to examine validator signatures

2. **Identified validator mismatch**
   - Certificate was signed by: `16Uiu2HAm6YizNi4XUqUcCF3aoEVZaSzP3XSrGeKA1b893RLtCLfu`
   - TrustBase expected: `16Uiu2HAkv5hkDFUT3cFVMTCetJJnoC5HWbCd2CxG44uMWVXNdbzb`

3. **Retrieved actual aggregator configuration**
   - Queried docker container: `aggregator-latest-bft-root-1`
   - Extracted from `/genesis/trust-base.json`

### Root Cause

The hardcoded TrustBase configuration in `/home/vrogojin/cli/src/commands/mint-token.ts` (lines 351-370) contained **incorrect validator information** that did not match the local aggregator's actual configuration.

**Specific Mismatches**:

| Field | Current (Incorrect) | Required (Correct) |
|-------|--------------------|--------------------|
| **Node ID** | `16Uiu2HAkv5hkDFUT3cFVMTCetJJnoC5HWbCd2CxG44uMWVXNdbzb` | `16Uiu2HAm6YizNi4XUqUcCF3aoEVZaSzP3XSrGeKA1b893RLtCLfu` |
| **Public Key** | `03384d4d4ad517fb94634910e0c88cb4551a483017c03256de4310afa4b155dfad` | `02cf6a24725f81b38431f3ddb92ed89a01b06a07f4e15945096c2e11a13916ff6d` |
| **Signature** | `843bc1fd...694a17601` | `c6a2603d...c51dcc2300` |

## Technical Details

### SDK Verification Flow

The SDK's `InclusionProof.verify()` method (in `@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.js`) performs validation in this order:

1. **UnicityCertificate Validation** (line 105)
   - Verifies UnicitySeal signatures against TrustBase root nodes
   - Uses `UnicityCertificateVerificationRule`
   - Checks if quorum threshold is met
   - **Fails here if node IDs don't match** → returns `NOT_AUTHENTICATED`

2. **Merkle Path Validation** (line 109)
   - Only runs if certificate validation passes

3. **Authenticator Validation** (lines 113-121)
   - Verifies transaction signature
   - Only runs if certificate validation passes

### Why Authenticator Passed But Certificate Failed

The authenticator validates the **transaction signature** (created by the CLI's secret key), while the UnicityCertificate validates the **network validator signatures** (created by the aggregator's BFT root node).

These are independent cryptographic operations:
- **Authenticator**: Proves the transaction was created by the token owner
- **UnicityCertificate**: Proves the transaction was included in the network state

## Solution Applied

### Changes Made to `/home/vrogojin/cli/src/commands/mint-token.ts`

#### 1. Updated Root Node Configuration (lines 356-361)

```typescript
rootNodes: [
  {
    nodeId: '16Uiu2HAm6YizNi4XUqUcCF3aoEVZaSzP3XSrGeKA1b893RLtCLfu',
    sigKey: '02cf6a24725f81b38431f3ddb92ed89a01b06a07f4e15945096c2e11a13916ff6d',
    stake: '1'
  }
]
```

#### 2. Updated Signatures (lines 367-369)

```typescript
signatures: {
  '16Uiu2HAm6YizNi4XUqUcCF3aoEVZaSzP3XSrGeKA1b893RLtCLfu': 'c6a2603d88ed172ef492f3b55bc6f0651ca7fde037b8651c83c33e8fd4884e5d72ef863fac564a0863e2bdea4ef73a1b2de2abe36485a3fa95d3cda1c51dcc2300'
}
```

#### 3. Fixed Network ID Detection (line 353)

```typescript
networkId: endpoint.includes('localhost') || endpoint.includes('127.0.0.1') ? 3 : 1,
```

Previously only checked for 'localhost', but the default local endpoint is `http://127.0.0.1:3000`.

## Verification Results

### Before Fix
```
Step 6.5: Validating inclusion proof...
  ✓ Proof structure validated (authenticator, transaction hash, merkle path)
  ✓ Authenticator signature verified
  ⚠ Warnings:
    - SDK proof.verify() returned: NOT_AUTHENTICATED
```

### After Fix
```
Step 6.5: Validating inclusion proof...
  ✓ Proof structure validated (authenticator, transaction hash, merkle path)
  ✓ Authenticator signature verified
```

### Manual Verification Test
```bash
$ npx tsx verify-final-token.ts
================================================================================
FINAL VERIFICATION TEST
================================================================================

Token File: 20251103_182326_1762190606399_0000d7d3e3.txf
Request ID: 0000ffb1327e4c8bf231683b75f0853f5dfddd7b896b0c282816492f7ce3a5d3c6c1

Verifying inclusion proof with corrected trustBase...

================================================================================
VERIFICATION RESULT: OK
================================================================================

✓✓✓ SUCCESS! ✓✓✓

The UnicityCertificate validation is now PASSING!
```

## How to Get Aggregator Configuration

For future reference, to get the correct TrustBase configuration from a running aggregator:

```bash
# Find the BFT root container
docker ps | grep bft-root

# Extract trust base configuration
docker exec aggregator-latest-bft-root-1 cat /genesis/trust-base.json

# Output format:
{
  "version": 1,
  "networkId": 3,
  "epoch": 1,
  "epochStartRound": 1,
  "rootNodes": [
    {
      "nodeId": "16Uiu2HAm6YizNi4XUqUcCF3aoEVZaSzP3XSrGeKA1b893RLtCLfu",
      "sigKey": "0x02cf6a24725f81b38431f3ddb92ed89a01b06a07f4e15945096c2e11a13916ff6d",
      "stake": 1
    }
  ],
  "quorumThreshold": 1,
  ...
}
```

## Debug Scripts Created

Several debugging scripts were created during the investigation:

1. **`/home/vrogojin/cli/debug-cert-simple.js`**
   - Decodes UnicityCertificate CBOR
   - Extracts validator node IDs and signatures
   - Compares with expected TrustBase

2. **`/home/vrogojin/cli/test-trustbase.ts`**
   - Tests different TrustBase configurations
   - Shows which validations pass/fail

3. **`/home/vrogojin/cli/verify-final-token.ts`**
   - Verifies a minted token with corrected TrustBase
   - Confirms the fix works end-to-end

## Recommendations

1. **Dynamic TrustBase Retrieval**: Consider fetching TrustBase configuration from the aggregator at runtime instead of hardcoding it.

2. **Configuration Validation**: Add startup validation that checks if the TrustBase matches the target aggregator.

3. **Better Error Messages**: When `proof.verify()` fails, provide more detailed error messages indicating which validation step failed (certificate vs authenticator vs merkle path).

4. **Network ID Auto-detection**: Enhance endpoint detection to automatically determine the correct network ID.

## Files Modified

- `/home/vrogojin/cli/src/commands/mint-token.ts` - Lines 353, 356-361, 367-369

## Test Results

✅ Token minting with local aggregator now completes successfully
✅ UnicityCertificate validation passes
✅ Authenticator validation passes (still working)
✅ No warnings in output
✅ Manual proof verification returns `OK`

## Conclusion

The UnicityCertificate validation failure was caused by a mismatch between the hardcoded TrustBase validator configuration and the actual validator running in the local aggregator. The fix ensures the CLI uses the correct validator node ID and public key that match the aggregator's BFT root node.

---

**Date**: 2025-11-03
**Investigator**: Claude Code (AI Assistant)
**Status**: Resolved ✅
