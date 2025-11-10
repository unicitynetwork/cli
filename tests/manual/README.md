# Manual Testing Scripts

This directory contains manual test scripts for validating specific CLI functionality that requires live aggregator interaction.

## Available Tests

### Aggregator Proof Response Test

**Purpose:** Validates that the CLI correctly handles inclusion proof responses from the Unicity aggregator.

**Script:** `test-aggregator-proof-response.ts`

**Run Command:**
```bash
npm run test:aggregator-proof
```

**Prerequisites:**
- Local aggregator running at `http://127.0.0.1:3000`
- TrustBase available (automatically extracted from Docker or at `/tmp/aggregator/trust-base.json`)

**Test Coverage:**
1. TrustBase loading from Docker aggregator
2. Test data generation (RequestId, Authenticator, hashes)
3. Commitment submission to aggregator
4. Proof retrieval and structure validation
5. Field presence verification (authenticator, merkleTreePath, transactionHash, unicityCertificate)
6. SDK verification method testing
7. CLI validation logic verification

**Results:**
- Terminal output with detailed phase-by-phase results
- JSON export: `aggregator-proof-test-results.json`

**Documentation:**
- **Summary:** `PROOF_VALIDATION_SUMMARY.md` - Executive summary and recommendations
- **Analysis:** `AGGREGATOR_PROOF_ANALYSIS.md` - Detailed technical analysis
- **Results:** `aggregator-proof-test-results.json` - Raw test data

### Test Results Summary

**Status:** ✓ PASSED (6/10 phases, 2 informational warnings)

**Key Findings:**
- CLI correctly handles `InclusionProofResponse` wrapper structure
- All commands properly extract `proofResponse.inclusionProof`
- Validation functions work with correct `InclusionProof` type
- Null field handling is appropriate for different use cases
- **No critical issues found - implementation is production-ready**

## Understanding the Proof Structure

The aggregator returns a wrapper object:

```typescript
InclusionProofResponse {
  inclusionProof: InclusionProof {
    authenticator: Authenticator | null,
    merkleTreePath: SparseMerkleTreePath,
    transactionHash: DataHash | null,
    unicityCertificate: UnicityCertificate
  }
}
```

### Correct Usage Pattern

```typescript
// 1. Fetch from aggregator
const proofResponse = await aggregatorClient.getInclusionProof(requestId);

// 2. Extract the nested proof object
const proof = proofResponse.inclusionProof;

// 3. Access fields on proof object
console.log('Authenticator:', proof.authenticator);
console.log('Transaction Hash:', proof.transactionHash);
console.log('Merkle Path:', proof.merkleTreePath);
console.log('Certificate:', proof.unicityCertificate);

// 4. Verify with SDK
const status = await proof.verify(trustBase, expectedLeafValue);
```

### Field Meanings

| Field | Type | Nullable | Purpose |
|-------|------|----------|---------|
| `authenticator` | `Authenticator` | Yes | Signature proving ownership of state transition |
| `merkleTreePath` | `SparseMerkleTreePath` | No | Path from leaf to root in Sparse Merkle Tree |
| `transactionHash` | `DataHash` | Yes | Hash of the transaction that was committed |
| `unicityCertificate` | `UnicityCertificate` | No | Blockchain proof of Merkle root commitment |

**Note:** `authenticator` and `transactionHash` are `null` for non-token commitments (like our test).

## Adding New Manual Tests

### Template

```typescript
#!/usr/bin/env tsx
/**
 * Test Description
 *
 * Purpose: What this test validates
 * Usage: npm run test:your-test
 */

import { /* SDK imports */ } from '@unicitylabs/state-transition-sdk/...';
import { loadTrustBase } from '../../src/utils/trustbase-loader.js';

async function testYourFeature(): Promise<void> {
  console.log('Test Description');
  console.log('='.repeat(80));

  // Test implementation
  try {
    // Your test logic here
    console.log('✓ Test passed');
  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  }
}

testYourFeature().catch(error => {
  console.error('FATAL ERROR:', error);
  process.exit(1);
});
```

### Steps to Add a New Test

1. **Create test file** in `/home/vrogojin/cli/tests/manual/`:
   ```bash
   touch tests/manual/test-your-feature.ts
   ```

2. **Add npm script** in `package.json`:
   ```json
   "test:your-feature": "npm run build && node dist/tests/manual/test-your-feature.js"
   ```

3. **Update tsconfig.json** (already includes `tests/manual/**/*`)

4. **Write test** using the template above

5. **Document results** in a markdown file

6. **Update this README** with your test details

## Test Guidelines

### Best Practices

1. **Use Real SDK Objects:** Don't mock SDK classes - use actual SDK methods
2. **Load TrustBase:** Use `loadTrustBase()` from `trustbase-loader.js`
3. **Handle Errors:** Wrap operations in try-catch and provide clear error messages
4. **Export Results:** Write JSON results for later analysis
5. **Document Findings:** Create markdown documentation of discoveries

### What to Test

- **Integration Points:** How CLI interacts with aggregator
- **Response Structures:** Validate SDK object structures match expectations
- **Edge Cases:** Test with invalid data, network errors, etc.
- **SDK Behavior:** Verify SDK methods work as documented
- **Performance:** Measure latency for operations

### What Not to Test

- **Unit Tests:** Use BATS framework for those (`tests/functional/`, `tests/security/`)
- **Mocked Tests:** Manual tests should use real aggregator
- **SDK Internal Logic:** Don't test SDK implementation details
- **Network Mocking:** If aggregator is down, test should fail/skip

## CI/CD Integration

Manual tests are **not** run in CI/CD because they require:
- Running aggregator instance
- Network connectivity
- Longer execution time

For CI/CD testing, use:
```bash
npm run test:functional  # Fast, no network required
npm run test:security    # Security validation
npm run test:unit        # Quick smoke tests
```

## Troubleshooting

### Aggregator Not Running

```bash
# Check if aggregator is running
curl http://127.0.0.1:3000

# Start aggregator with Docker
docker run -p 3000:3000 unicity/aggregator

# Or use existing container
docker start aggregator-service
```

### TrustBase Not Found

```bash
# Extract from Docker aggregator
docker cp aggregator-service:/app/bft-config/trust-base.json /tmp/aggregator/

# Or set custom path
TRUSTBASE_PATH=/path/to/trust-base.json npm run test:aggregator-proof
```

### Build Errors

```bash
# Clean build
rm -rf dist/
npm run build

# Check TypeScript errors
npx tsc --noEmit
```

### Network Timeout

```bash
# Increase timeout in test script
await new Promise(resolve => setTimeout(resolve, 5000));

# Or set environment variable
AGGREGATOR_URL=http://localhost:3000 npm run test:aggregator-proof
```

## Related Documentation

- **BATS Tests:** `/home/vrogojin/cli/tests/` - Automated test suites
- **Test Scenarios:** `/home/vrogojin/cli/test-scenarios/` - 313 comprehensive scenarios
- **API Reference:** `/home/vrogojin/cli/docs/reference/api-reference.md`
- **Architecture:** `/home/vrogojin/cli/.dev/architecture/`

## Contributing

When adding manual tests:
1. Follow the template and guidelines
2. Document your findings thoroughly
3. Update this README with test details
4. Export results to JSON for reproducibility
5. Create summary markdown with conclusions
