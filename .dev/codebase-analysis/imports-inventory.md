# Complete Import Inventory

## Purpose
Comprehensive reference of all Unicity package imports in the codebase for dependency management and tracking.

---

## Import Counts

### By Package
- **@unicitylabs/state-transition-sdk**: 56 imports
- **@unicitylabs/commons**: 9 imports
- **Total**: 65 imports

### By File
| File | SDK | Commons | Total |
|------|-----|---------|-------|
| mint-token.ts | 16 | 2 | 18 |
| receive-token.ts | 9 | 2 | 11 |
| gen-address.ts | 8 | 1 | 9 |
| send-token.ts | 8 | 2 | 10 |
| verify-token.ts | 1 | 2 | 3 |
| register-request.ts | 6 | 0 | 6 |
| get-request.ts | 4 | 0 | 4 |
| proof-validation.ts | 4 | 1 | 5 |
| **TOTALS** | **56** | **9** | **65** |

---

## Consolidated Import Matrix

### HexConverter (Used in 4 files)

| File | Current Import | Recommended Import |
|------|-----------------|-------------------|
| mint-token.ts | commons/lib/util | sdk/lib/util |
| receive-token.ts | commons/lib/util | sdk/lib/util |
| gen-address.ts | commons/lib/util | sdk/lib/util |
| send-token.ts | commons/lib/util | sdk/lib/util |

**Path difference**:
- Current: `@unicitylabs/commons/lib/util/HexConverter.js`
- Recommended: `@unicitylabs/state-transition-sdk/lib/util/HexConverter.js`

---

### JsonRpcNetworkError (Used in 3 files)

| File | Current Import | Recommended Import |
|------|-----------------|-------------------|
| mint-token.ts | commons/lib/json-rpc | sdk/lib/api/json-rpc |
| receive-token.ts | commons/lib/json-rpc | sdk/lib/api/json-rpc |
| send-token.ts | commons/lib/json-rpc | sdk/lib/api/json-rpc |

**Path difference**:
- Current: `@unicitylabs/commons/lib/json-rpc/JsonRpcNetworkError.js`
- Recommended: `@unicitylabs/state-transition-sdk/lib/api/json-rpc/JsonRpcNetworkError.js`

---

### Keep from Commons (Cannot Consolidate)

#### CborDecoder
**Usage**: verify-token.ts (line 3)
**Status**: Keep - Only available in commons
**Current**: `@unicitylabs/commons/lib/cbor/CborDecoder.js`

#### InclusionProofVerificationStatus
**Usage**: proof-validation.ts (line 2)
**Status**: Keep - Only available in commons
**Current**: `@unicitylabs/commons/lib/api/InclusionProof.js`

---

## Complete File-by-File Import Listing

### 1. src/commands/gen-address.ts

```typescript
// SDK Imports (8)
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { DataHash } from '@unicitylabs/state-transition-sdk/lib/hash/DataHash.js';
import { MaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/MaskedPredicate.js';
import { UnmaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/UnmaskedPredicate.js';
import { TokenType } from '@unicitylabs/state-transition-sdk/lib/token/TokenType.js';
import { DirectAddress } from '@unicitylabs/state-transition-sdk/lib/address/DirectAddress.js';
import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';

// Commons Imports (1) - TO CONSOLIDATE
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
```

**Change**: Line 5 HexConverter import → SDK version

---

### 2. src/commands/mint-token.ts

```typescript
// SDK Imports (16)
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';
import { TokenType } from '@unicitylabs/state-transition-sdk/lib/token/TokenType.js';
import { TokenState } from '@unicitylabs/state-transition-sdk/lib/token/TokenState.js';
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { TokenCoinData } from '@unicitylabs/state-transition-sdk/lib/token/fungible/TokenCoinData.js';
import { CoinId } from '@unicitylabs/state-transition-sdk/lib/token/fungible/CoinId.js';
import { MintCommitment } from '@unicitylabs/state-transition-sdk/lib/transaction/MintCommitment.js';
import { MintTransactionData } from '@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionData.js';
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import { IMintTransactionReason } from '@unicitylabs/state-transition-sdk/lib/transaction/IMintTransactionReason.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { UnmaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/UnmaskedPredicate.js';
import { MaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/MaskedPredicate.js';

// Commons Imports (2) - TO CONSOLIDATE
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';  // Line 4
import { JsonRpcNetworkError } from '@unicitylabs/commons/lib/json-rpc/JsonRpcNetworkError.js';  // Line 13
```

**Changes**:
- Line 4: HexConverter import → SDK version
- Line 13: JsonRpcNetworkError import → SDK version

---

### 3. src/commands/receive-token.ts

```typescript
// SDK Imports (9)
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { TransferCommitment } from '@unicitylabs/state-transition-sdk/lib/transaction/TransferCommitment.js';
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { UnmaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/UnmaskedPredicate.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { TokenState } from '@unicitylabs/state-transition-sdk/lib/token/TokenState.js';
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';

// Commons Imports (2) - TO CONSOLIDATE
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';  // Line 10
import { JsonRpcNetworkError } from '@unicitylabs/commons/lib/json-rpc/JsonRpcNetworkError.js';  // Line 11
```

**Changes**:
- Line 10: HexConverter import → SDK version
- Line 11: JsonRpcNetworkError import → SDK version

---

### 4. src/commands/send-token.ts

```typescript
// SDK Imports (8)
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { TransferCommitment } from '@unicitylabs/state-transition-sdk/lib/transaction/TransferCommitment.js';
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { AddressFactory } from '@unicitylabs/state-transition-sdk/lib/address/AddressFactory.js';

// Commons Imports (2) - TO CONSOLIDATE
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';  // Line 7
import { JsonRpcNetworkError } from '@unicitylabs/commons/lib/json-rpc/JsonRpcNetworkError.js';  // Line 8
```

**Changes**:
- Line 7: HexConverter import → SDK version
- Line 8: JsonRpcNetworkError import → SDK version

---

### 5. src/commands/verify-token.ts

```typescript
// SDK Imports (1)
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';

// Commons Imports (2) - ONE TO CONSOLIDATE, ONE TO KEEP
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';  // Line 3 - CHANGE
import { CborDecoder } from '@unicitylabs/commons/lib/cbor/CborDecoder.js';  // Line 4 - KEEP
```

**Changes**:
- Line 3: HexConverter import → SDK version
- Line 4: KEEP CborDecoder (only in commons)

---

### 6. src/commands/register-request.ts

```typescript
// SDK Imports (6) - ALL GOOD, NO CHANGES
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { Authenticator } from '@unicitylabs/state-transition-sdk/lib/api/Authenticator.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';

// No commons imports
```

**Status**: No changes needed

---

### 7. src/commands/get-request.ts

```typescript
// SDK Imports (4) - ALL GOOD, NO CHANGES
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { DataHash } from '@unicitylabs/state-transition-sdk/lib/hash/DataHash.js';
import { InclusionProof } from '@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.js';

// No commons imports
```

**Status**: No changes needed

---

### 8. src/utils/proof-validation.ts

```typescript
// SDK Imports (4)
import { InclusionProof } from '@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';

// Commons Imports (1) - KEEP (ONLY SOURCE)
import { InclusionProofVerificationStatus } from '@unicitylabs/commons/lib/api/InclusionProof.js';
```

**Status**: No changes needed (InclusionProofVerificationStatus is commons-only)

---

## Quick Reference Table

### Consolidation Summary

| Class | Current Path | New Path | Files | Action |
|-------|-------------|----------|-------|--------|
| HexConverter | commons/lib/util | sdk/lib/util | 4 | Consolidate |
| JsonRpcNetworkError | commons/lib/json-rpc | sdk/lib/api/json-rpc | 3 | Consolidate |
| CborDecoder | commons/lib/cbor | commons/lib/cbor | 1 | Keep |
| InclusionProofVerificationStatus | commons/lib/api | commons/lib/api | 1 | Keep |

---

## Implementation Checklist

### Pre-refactoring
- [ ] Review this document
- [ ] Read DEPENDENCY_ANALYSIS.md
- [ ] Read REFACTORING_GUIDE.md

### Refactoring
- [ ] Update gen-address.ts (1 import)
- [ ] Update mint-token.ts (2 imports)
- [ ] Update receive-token.ts (2 imports)
- [ ] Update send-token.ts (2 imports)
- [ ] Update verify-token.ts (1 import)

### Verification
- [ ] Run `npm run build`
- [ ] Run `npm run lint`
- [ ] Test sample commands
- [ ] Verify no type errors
- [ ] Commit changes

---

## Related Files

- **DEPENDENCY_ANALYSIS.md**: Deep analysis of the dependency structure
- **REFACTORING_GUIDE.md**: Step-by-step refactoring instructions
- **CLAUDE.md**: Project configuration and command reference
- **package.json**: Actual dependency declarations

---

## Notes

1. All imports shown are direct imports from npm packages
2. Path differences are preserved (some in /api subdirectories)
3. SDK re-exports some commons classes internally
4. No code logic changes needed - only import path changes
5. All recommended changes are non-breaking
