# Dependency Consolidation Refactoring Guide

## Overview

This guide provides step-by-step instructions to consolidate imports from `@unicitylabs/commons` to `@unicitylabs/state-transition-sdk` where both packages provide the same functionality.

## Refactoring Changes Required

### Summary of Changes
- **Files to modify**: 5
- **Import lines to change**: 8
- **Modules to consolidate**: 2 (HexConverter, JsonRpcNetworkError)
- **Estimated time**: 5-10 minutes

---

## File-by-File Changes

### 1. `/home/vrogojin/cli/src/commands/mint-token.ts`

**Current state**: 2 commons imports

**Changes**:
```diff
- import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
+ import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
...
- import { JsonRpcNetworkError } from '@unicitylabs/commons/lib/json-rpc/JsonRpcNetworkError.js';
+ import { JsonRpcNetworkError } from '@unicitylabs/state-transition-sdk/lib/api/json-rpc/JsonRpcNetworkError.js';
```

**Lines affected**: 4, 13

**Verification command**: `npm run build && npm run mint-token -- --help`

---

### 2. `/home/vrogojin/cli/src/commands/receive-token.ts`

**Current state**: 2 commons imports

**Changes**:
```diff
- import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
+ import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
...
- import { JsonRpcNetworkError } from '@unicitylabs/commons/lib/json-rpc/JsonRpcNetworkError.js';
+ import { JsonRpcNetworkError } from '@unicitylabs/state-transition-sdk/lib/api/json-rpc/JsonRpcNetworkError.js';
```

**Lines affected**: 10, 11

**Verification command**: `npm run build && npm run receive-token -- --help`

---

### 3. `/home/vrogojin/cli/src/commands/gen-address.ts`

**Current state**: 1 commons import

**Changes**:
```diff
- import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
+ import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
```

**Lines affected**: 5

**Verification command**: `npm run build && npm run gen-address -- --help`

---

### 4. `/home/vrogojin/cli/src/commands/send-token.ts`

**Current state**: 2 commons imports

**Changes**:
```diff
- import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
+ import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
...
- import { JsonRpcNetworkError } from '@unicitylabs/commons/lib/json-rpc/JsonRpcNetworkError.js';
+ import { JsonRpcNetworkError } from '@unicitylabs/state-transition-sdk/lib/api/json-rpc/JsonRpcNetworkError.js';
```

**Lines affected**: 7, 8

**Verification command**: `npm run build && npm run send-token -- --help`

---

### 5. `/home/vrogojin/cli/src/commands/verify-token.ts`

**Current state**: 2 commons imports (1 consolidation, 1 keep)

**Changes**:
```diff
- import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
+ import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import { CborDecoder } from '@unicitylabs/commons/lib/cbor/CborDecoder.js';  // KEEP - Only in commons
```

**Lines affected**: 3 (change HexConverter import)

**Note**: Keep CborDecoder import as-is - this class is ONLY available in commons.

**Verification command**: `npm run build && npm run verify-token -- --help`

---

### 6. `/home/vrogojin/cli/src/utils/proof-validation.ts`

**Current state**: 1 commons import - NO CHANGE NEEDED

**Status**: KEEP AS-IS
```typescript
import { InclusionProofVerificationStatus } from '@unicitylabs/commons/lib/api/InclusionProof.js';
```

**Reason**: `InclusionProofVerificationStatus` is only available in commons.

---

## No Changes Required

The following files already import only from SDK:
- `/home/vrogojin/cli/src/commands/register-request.ts`
- `/home/vrogojin/cli/src/commands/get-request.ts`

---

## Consolidated Import Summary

### Before Consolidation
```
Commons imports: 9 total
- HexConverter: 4 occurrences
- JsonRpcNetworkError: 3 occurrences
- CborDecoder: 1 occurrence
- InclusionProofVerificationStatus: 1 occurrence

SDK imports: 56 total
```

### After Consolidation
```
Commons imports: 2 total
- CborDecoder: 1 occurrence (in verify-token.ts)
- InclusionProofVerificationStatus: 1 occurrence (in proof-validation.ts)

SDK imports: 63 total
- HexConverter: 4 occurrences
- JsonRpcNetworkError: 3 occurrences
- Plus existing 56
```

---

## Why These Changes Are Safe

1. **Identical Interfaces**: HexConverter and JsonRpcNetworkError have identical public interfaces in both packages
2. **No Logic Changes**: Your code using these classes doesn't need to change
3. **No Runtime Impact**: These are pure utility/error classes with no state management
4. **Fully Compatible**: SDK's versions are drop-in replacements for commons' versions
5. **Tested**: Both packages export the same functionality with the same signatures

---

## Verification Steps

### Step 1: Build Check
```bash
cd /home/vrogojin/cli
npm run build
```

Expected output: No TypeScript errors

### Step 2: Type Check
```bash
npm run lint
```

Expected output: No linting errors

### Step 3: Command Verification (sample)
```bash
npm run gen-address
npm run mint-token -- --help
npm run verify-token -- --help
```

Expected: Commands respond normally without import errors

### Step 4: Verify commons is still a dependency
```bash
npm ls @unicitylabs/commons
```

Expected: Still shows version 2.4.0-rc.a5f85b0 (now only needed for CborDecoder)

---

## Rollback Procedure

If any issues arise, revert all changes with:
```bash
git checkout -- src/
```

---

## Implementation Options

### Option 1: Manual Changes (Quick)
Edit each file individually and make the import changes shown above.

**Estimated time**: 5 minutes
**Risk**: Low (straightforward find/replace)

### Option 2: Automated Changes (Scripted)
Use sed/awk to batch replace all imports:

```bash
# In /home/vrogojin/cli directory

# Change HexConverter imports
find src -name "*.ts" -type f -exec sed -i \
  "s|from '@unicitylabs/commons/lib/util/HexConverter.js'|from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js'|g" {} \;

# Change JsonRpcNetworkError imports
find src -name "*.ts" -type f -exec sed -i \
  "s|from '@unicitylabs/commons/lib/json-rpc/JsonRpcNetworkError.js'|from '@unicitylabs/state-transition-sdk/lib/api/json-rpc/JsonRpcNetworkError.js'|g" {} \;

# Verify changes
grep -r "from '@unicitylabs" src/ | grep commons
```

---

## Expected Outcome

### Dependency Clarity
After these changes, the dependency structure will be:
- Primary: `@unicitylabs/state-transition-sdk` (63 imports)
- Secondary: `@unicitylabs/commons` (2 imports for specialized utilities)

### Benefits
1. **Reduced cognitive load**: Fewer packages to track
2. **Clearer intent**: When you use commons, it's for specialized utilities
3. **Type consistency**: Unified imports reduce type mismatch risks
4. **Maintenance**: Single source of truth for duplicated functionality
5. **Future-proof**: If SDK adds new utilities, imports don't change

---

## Future Considerations

### Monitor Package Updates
After this refactoring, watch for:
1. Does SDK ever add CborDecoder or similar utilities?
2. Do SDK and commons versions align in future releases?
3. Does SDK list commons as a dependency?

### Complete Consolidation (Phase 2)
If/when SDK properly depends on commons:
- Remove commons from direct dependencies
- It becomes a transitive dependency through SDK
- No import changes needed in your code

---

## Related Documentation
- See `DEPENDENCY_ANALYSIS.md` for detailed analysis
- See `CLAUDE.md` for command and architecture documentation
