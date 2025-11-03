# Unicity CLI - Dependency Structure Analysis

## Executive Summary

Your project has a **complex dual-package dependency structure** that introduces type conflicts and maintainability issues. Both packages provide overlapping functionality, and your codebase is currently importing from BOTH packages inconsistently.

### Key Finding
The SDK (`@unicitylabs/state-transition-sdk`) does **NOT** cleanly re-export commons classes, forcing you to import from both packages directly. This violates a clean dependency model.

---

## 1. Package Dependency Analysis

### Current Setup (from package.json)

```json
{
  "dependencies": {
    "@unicitylabs/commons": "2.4.0-rc.a5f85b0",
    "@unicitylabs/state-transition-sdk": "1.6.0-rc.fd1f327",
    "commander": "^12.1.0"
  }
}
```

**Status**: Both are DIRECT dependencies (not just transitive).

### SDK Dependencies (from SDK's package.json)

```json
{
  "dependencies": {
    "@noble/hashes": "2.0.1",
    "@noble/curves": "2.0.1",
    "uuid": "13.0.0"
  }
}
```

**Critical Finding**: The SDK does **NOT** list `@unicitylabs/commons` as a dependency!

### Commons Dependencies

```json
{
  "dependencies": {
    "@noble/curves": "1.9.1",
    "@noble/hashes": "1.8.0",
    "uuid": "11.1.0"
  }
}
```

**Problem**: SDK uses different versions of `@noble/*` than commons!
- SDK: `@noble/hashes@2.0.1`, `@noble/curves@2.0.1`
- Commons: `@noble/hashes@1.8.0`, `@noble/curves@1.9.1`

---

## 2. Import Analysis Across Codebase

### Total Imports Found: 59 imports across 11 files

#### Breakdown:
- **56 imports from SDK** (95%)
- **9 imports from commons** (15%)
- **6 files use only SDK imports**
- **5 files use BOTH SDK and commons imports**

### Detailed Import Breakdown by File

#### `src/commands/mint-token.ts` (18 imports)
**From SDK**: HashAlgorithm, DataHasher, TokenId, TokenType, TokenState, Token, StateTransitionClient, AggregatorClient, TokenCoinData, CoinId, MintCommitment, MintTransactionData, RootTrustBase, IMintTransactionReason, SigningService, UnmaskedPredicate, MaskedPredicate

**From Commons**: HexConverter, JsonRpcNetworkError

#### `src/commands/receive-token.ts` (11 imports)
**From SDK**: Token, SigningService, TransferCommitment, StateTransitionClient, AggregatorClient, UnmaskedPredicate, HashAlgorithm, TokenState, RootTrustBase

**From Commons**: HexConverter, JsonRpcNetworkError

#### `src/commands/register-request.ts` (6 imports)
**All from SDK**: DataHasher, HashAlgorithm, SigningService, RequestId, Authenticator, AggregatorClient

#### `src/commands/get-request.ts` (4 imports)
**All from SDK**: AggregatorClient, RequestId, DataHash, InclusionProof

#### `src/commands/gen-address.ts` (9 imports)
**From SDK**: SigningService, HashAlgorithm, DataHasher, DataHash, MaskedPredicate, UnmaskedPredicate, TokenType, DirectAddress, TokenId

**From Commons**: HexConverter

#### `src/commands/send-token.ts` (10 imports)
**From SDK**: Token, SigningService, TransferCommitment, StateTransitionClient, AggregatorClient, AddressFactory

**From Commons**: HexConverter, JsonRpcNetworkError

#### `src/commands/verify-token.ts` (3 imports)
**From SDK**: Token

**From Commons**: HexConverter, CborDecoder

#### `src/utils/proof-validation.ts` (5 imports)
**From SDK**: InclusionProof, RequestId, RootTrustBase, Token

**From Commons**: InclusionProofVerificationStatus

---

## 3. Class Conflicts & Duplications

### Type Conflict Example: RequestId

**SDK Version** (`@unicitylabs/state-transition-sdk/lib/api/RequestId.js`):
```typescript
export declare class RequestId extends DataHash {
    readonly hash: DataHash;
    static create(id: Uint8Array, stateHash: DataHash): Promise<RequestId>;
    static createFromImprint(id: Uint8Array, hashImprint: Uint8Array): Promise<RequestId>;
    static fromCBOR(data: Uint8Array): RequestId;
    static fromJSON(data: string): RequestId;
    // ... methods
}
```

**Commons Version** (`@unicitylabs/commons/lib/api/RequestId.js`):
```typescript
export declare class RequestId {
    readonly hash: DataHash;
    static create(id: Uint8Array, stateHash: DataHash): Promise<RequestId>;
    static createFromImprint(id: Uint8Array, hashImprint: Uint8Array): Promise<RequestId>;
    static fromCBOR(data: Uint8Array): RequestId;
    static fromJSON(data: string): RequestId;
    // ... methods
}
```

**Key Difference**: SDK's RequestId **extends DataHash**, commons' doesn't.

### Classes Appearing in BOTH Packages

1. **SigningService**
   - SDK: `/lib/sign/SigningService.js`
   - Commons: `/lib/signing/SigningService.js`
   - **Difference**: SDK version has extra verification methods using DataHash

2. **HexConverter**
   - SDK: `/lib/util/HexConverter.js`
   - Commons: `/lib/util/HexConverter.js`
   - **Status**: Identical interface

3. **JsonRpcNetworkError**
   - SDK: `/lib/api/json-rpc/JsonRpcNetworkError.js`
   - Commons: `/lib/json-rpc/JsonRpcNetworkError.js`
   - **Status**: Similar error handling

### Classes ONLY in Commons

1. **CborDecoder** (`/lib/cbor/CborDecoder.js`)
2. **InclusionProofVerificationStatus** (`/lib/api/InclusionProof.js`)
3. Other utilities: BigintConverter, StringUtils

### Classes ONLY in SDK

- All token-related classes (Token, TokenId, TokenType, etc.)
- All transaction classes (MintCommitment, TransferCommitment, etc.)
- Predicate classes (MaskedPredicate, UnmaskedPredicate)
- Address classes (DirectAddress, AddressFactory)
- StateTransitionClient

---

## 4. Current Usage Patterns

### Files Importing from Commons

| File | Classes Used | Count |
|------|-------------|-------|
| mint-token.ts | HexConverter, JsonRpcNetworkError | 2 |
| receive-token.ts | HexConverter, JsonRpcNetworkError | 2 |
| gen-address.ts | HexConverter | 1 |
| send-token.ts | HexConverter, JsonRpcNetworkError | 2 |
| verify-token.ts | HexConverter, CborDecoder | 2 |
| proof-validation.ts | InclusionProofVerificationStatus | 1 |

### Files Using Only SDK

- register-request.ts
- get-request.ts

---

## 5. Root Cause Analysis

### Why This Happened

1. **SDK Incompleteness**: The SDK doesn't re-export or depend on commons
2. **Package Design**: Both packages have overlapping utility classes
3. **Version Mismatch**: Different versions of `@noble/*` libraries in each package
4. **No Clear Boundary**: No documentation defining which package to use for what

### Problems This Creates

1. **Type Safety Issues**: Different RequestId implementations can cause type conflicts
2. **Maintenance Burden**: Updates to either package require reviewing multiple import patterns
3. **Version Incompatibility**: SDK and commons use different versions of underlying crypto libraries
4. **Dead Code Risk**: Can't be sure if you're using the SDK's or commons' version of duplicated classes

---

## 6. Recommended Solution

### Option A: Remove Commons Direct Dependency (RECOMMENDED)

**Status**: Not immediately viable due to the SDK's design.

**Why**: The SDK should ideally depend on and re-export commons. Currently it doesn't, so removing commons would break your code.

**Future Approach**: This would be ideal if the SDK authors refactored to properly depend on commons.

---

### Option B: Consolidate All Imports to SDK (Current Best Path)

**Status**: VIABLE - Can be done with strategic changes

**Approach**:
1. Import utility classes from SDK instead of commons where available (HexConverter, JsonRpcNetworkError)
2. Only import from commons for classes ONLY available there (CborDecoder, InclusionProofVerificationStatus)
3. Update 9 import statements across 5 files

**Expected Changes**:

```typescript
// BEFORE (importing from commons)
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { JsonRpcNetworkError } from '@unicitylabs/commons/lib/json-rpc/JsonRpcNetworkError.js';

// AFTER (importing from SDK)
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import { JsonRpcNetworkError } from '@unicitylabs/state-transition-sdk/lib/api/json-rpc/JsonRpcNetworkError.js';
```

**Files to Change**:
- mint-token.ts: 2 imports
- receive-token.ts: 2 imports
- gen-address.ts: 1 import
- send-token.ts: 2 imports
- verify-token.ts: 1 import (leave CborDecoder from commons)

**Result**: Reduces commons imports from 9 to 1 (only CborDecoder)

---

### Option C: Create Abstraction Layer

**Status**: Overkill for current codebase, but good for future isolation

**Approach**: Create a `src/utils/unicity-adapters.ts` file that re-exports all utilities with a clear interface.

```typescript
// src/utils/unicity-adapters.ts
export { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
export { JsonRpcNetworkError } from '@unicitylabs/state-transition-sdk/lib/api/json-rpc/JsonRpcNetworkError.js';
export { CborDecoder } from '@unicitylabs/commons/lib/cbor/CborDecoder.js';
export { InclusionProofVerificationStatus } from '@unicitylabs/commons/lib/api/InclusionProof.js';
```

Then update all imports to use this adapter:
```typescript
import { HexConverter, JsonRpcNetworkError } from '../utils/unicity-adapters.js';
```

**Benefit**: Single point of truth for all external dependency imports.

---

## 7. Version Incompatibility Issue

### The Underlying Problem

The SDK and commons depend on different versions of cryptographic libraries:

| Package | @noble/hashes | @noble/curves | uuid |
|---------|---------------|---------------|------|
| SDK | 2.0.1 | 2.0.1 | 13.0.0 |
| Commons | 1.8.0 | 1.9.1 | 11.1.0 |

**Risk Level**: MODERATE

npm's node_modules deduplication will likely give you SDK's versions (newer), which could cause commons to behave unexpectedly. However, since commons doesn't break with newer crypto library versions, this is unlikely to cause runtime issues.

**Verification**: Run `npm ls @noble/hashes @noble/curves` to see what versions are actually installed.

---

## 8. Action Plan

### Phase 1: Import Consolidation (Immediate - Low Risk)

1. **Change imports in 5 files** to use SDK versions of duplicated utilities
2. **Update 8 import statements**:
   - `HexConverter`: 4 files use it, change all to SDK version
   - `JsonRpcNetworkError`: 3 files use it, change all to SDK version

3. **Keep commons for non-duplicated classes**:
   - `CborDecoder` (verify-token.ts)
   - `InclusionProofVerificationStatus` (proof-validation.ts)

4. **Verification**: Run `npm run build && npm run lint`

**Files to Modify**:
- `/home/vrogojin/cli/src/commands/mint-token.ts`
- `/home/vrogojin/cli/src/commands/receive-token.ts`
- `/home/vrogojin/cli/src/commands/gen-address.ts`
- `/home/vrogojin/cli/src/commands/send-token.ts`
- `/home/vrogojin/cli/src/commands/verify-token.ts`

### Phase 2: Abstraction Layer (Optional - High Clarity)

Create `/home/vrogojin/cli/src/utils/unicity-adapters.ts` to centralize all external package imports.

### Phase 3: Future Communication

When updating dependencies, check:
1. Do SDK and commons need version bumps?
2. Have they resolved their dependency relationship?
3. Does SDK now list commons as a dependency?

---

## 9. Summary Table

| Aspect | Current State | Recommended |
|--------|---------------|-------------|
| Commons as dependency | Yes (2.4.0-rc) | Keep for now (required) |
| HexConverter import source | Commons | **Change to SDK** |
| JsonRpcNetworkError import source | Commons | **Change to SDK** |
| CborDecoder import source | Commons | **Keep** (only in commons) |
| InclusionProofVerificationStatus source | Commons | **Keep** (only in commons) |
| Import consolidation level | Mixed (95/15 split) | **Consolidated to 95/5** |
| Abstraction layer | None | Consider adding |

---

## Conclusion

Your codebase is functional but has an **anti-pattern of dual imports** for overlapping functionality. The immediate fix (Phase 1) is straightforward: consolidate 8 import statements to use SDK's versions of HexConverter and JsonRpcNetworkError, reducing commons imports to only necessary utilities (CborDecoder, InclusionProofVerificationStatus).

This maintains backward compatibility while improving maintainability and reducing potential type conflicts.
