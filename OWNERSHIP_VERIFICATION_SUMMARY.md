# Ownership Verification Enhancement - Summary

## Quick Reference

### What We're Adding
Enhance `verify-token` command to query the aggregator and determine if the local TXF file is up-to-date with the on-chain state.

### Key Insight
**RequestId in Sparse Merkle Tree = State is Spent**

When a token state is consumed in a transfer, the RequestId (derived from owner's public key + state hash) gets recorded in the aggregator's Sparse Merkle Tree. By querying for this RequestId, we can determine if the state has been spent.

## SDK Method: getTokenStatus()

### Usage
```typescript
const client = new StateTransitionClient(new AggregatorClient(endpoint));
const status = await client.getTokenStatus(trustBase, token, publicKey);
```

### Return Values
- `PATH_NOT_INCLUDED` → State is **UNSPENT** (active)
- `OK` → State is **SPENT** (consumed in transfer)
- `NOT_AUTHENTICATED` → Error (invalid proof)
- `PATH_INVALID` → Error (merkle path broken)

### How It Works
1. Computes `requestId = RequestId.create(publicKey, stateHash)`
2. Queries aggregator: `getInclusionProof(requestId)`
3. Verifies proof cryptographically
4. Returns status based on proof type (inclusion vs exclusion)

## Four Ownership Scenarios

### A. Current (Up-to-Date) ✅
**Condition:** State not spent + No pending transfers
```
On-Chain: State A (unspent)
Local TXF: State A, no transactions
→ TXF is current and ready for use
```

### B. Outdated (Spent Elsewhere) ⚠️
**Condition:** State spent + No matching transaction in TXF
```
On-Chain: State A (spent → State B)
Local TXF: State A, no transactions
→ Token was transferred from another device
→ This TXF is outdated
```

### C. Pending Transfer ⏳
**Condition:** State not spent + Has offlineTransfer
```
On-Chain: State A (unspent)
Local TXF: State A, offlineTransfer to Bob
→ Transfer created but not yet submitted
→ Recipient needs to submit it
```

### D. Confirmed Transfer ✅
**Condition:** State spent + Has matching transaction in TXF
```
On-Chain: State A (spent)
Local TXF: State A, transaction to Bob, status=TRANSFERRED
→ Transfer recorded in both TXF and blockchain
→ Token successfully transferred
```

## Implementation Plan

### 1. New Helper Module
**File:** `src/utils/ownership-verification.ts`

**Functions:**
- `extractOwnerInfo(predicate)` - Parse CBOR, extract public key and address
- `checkOwnershipStatus(token, tokenJson, endpoint, trustBase)` - Main logic
- `determineScenario(onChainStatus, txfState)` - Scenario detection

### 2. Modify verify-token.ts

**Add after predicate display (line ~303):**
```typescript
// Display ownership status
if (!options.skipNetwork) {
  await displayOwnershipStatus(token, tokenJson, endpoint, trustBase);
}
```

**New command options:**
```typescript
.option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
.option('--local', 'Use local aggregator')
.option('--skip-network', 'Skip network verification')
```

### 3. Display Functions
Create scenario-specific display functions:
- `displayScenarioA()` - Current ownership
- `displayScenarioB()` - Outdated warning
- `displayScenarioC()` - Pending transfer notice
- `displayScenarioD()` - Confirmed transfer

## Error Handling Strategy

### Network Errors
```typescript
catch (JsonRpcNetworkError) {
  if (error.status === 404) {
    // Normal: RequestId not found = unspent
  } else if (error.status === 503 || ECONNREFUSED) {
    // Aggregator down
    console.error('⚠️ Cannot verify - network unavailable');
    // Continue with local verification
  }
}
```

### Graceful Degradation
- Network unavailable → Show warning, display local info only
- Parse error → Show error, continue with what's available
- Never crash - always show something useful

## Code Structure

```
src/
├── commands/
│   └── verify-token.ts (modified)
│       └── Add ownership status section
│
└── utils/
    ├── ownership-verification.ts (new)
    │   ├── checkOwnershipStatus()
    │   ├── extractOwnerInfo()
    │   └── determineScenario()
    │
    └── trustbase-loader.ts (existing)
        └── getCachedTrustBase() - reuse
```

## Testing Checklist

- [ ] Test Scenario A: Mint token → verify immediately
- [ ] Test Scenario B: Copy TXF → transfer from original → verify copy
- [ ] Test Scenario C: Create offline transfer → verify sender's TXF
- [ ] Test Scenario D: Submit transfer → verify with status=TRANSFERRED
- [ ] Test network error: Stop aggregator → verify
- [ ] Test offline mode: --skip-network flag
- [ ] Test with masked predicates
- [ ] Test with unmasked predicates
- [ ] Test with multiple transactions in history

## Security Considerations

✅ **Safe:**
- Public keys from predicates are already public in TXF
- Using SDK's verified methods for address derivation
- TrustBase verification for cryptographic proof checking

⚠️ **Trust Assumptions:**
- Trusts aggregator responses (mitigated by proof verification)
- Assumes SDK correctly implements RequestId derivation
- Assumes TrustBase is authentic (loaded from Docker/environment)

## Performance Impact

**Additional Operations per Verification:**
1. Predicate parsing (CBOR decode) - ~1ms
2. RequestId creation - ~1ms
3. Network call to aggregator - ~50-200ms
4. Proof verification - ~10ms

**Total:** ~60-220ms additional latency

**Mitigations:**
- TrustBase cached (no repeated loading)
- Single network call (not per-transaction)
- Optional --skip-network for offline use

## Key Files to Review

### Understand Patterns
1. `src/commands/send-token.ts` - Network client usage, error handling
2. `src/commands/receive-token.ts` - Predicate creation, state management
3. `src/commands/get-request.ts` - Aggregator queries, proof display

### SDK Documentation
4. `node_modules/@unicitylabs/state-transition-sdk/README.md` - getTokenStatus() examples
5. `node_modules/@unicitylabs/state-transition-sdk/lib/StateTransitionClient.d.ts` - Type definitions

### Existing Utils
6. `src/utils/trustbase-loader.ts` - TrustBase loading pattern
7. `src/utils/proof-validation.ts` - Proof verification patterns

## Questions Addressed

### Q: How do we know if a state is spent?
A: Query aggregator for RequestId derived from `(publicKey, stateHash)`. If RequestId is in the SMT (inclusion proof), the state was spent in a transfer.

### Q: What SDK methods should we use?
A: `StateTransitionClient.getTokenStatus(trustBase, token, publicKey)` - Does everything: creates RequestId, queries aggregator, verifies proof, returns status.

### Q: How do we extract the owner's address?
A: Parse state.predicate CBOR structure to extract public key from params[2], then use `AddressFactory.createDirectAddress(predicate)` to derive address.

### Q: What if the network is unavailable?
A: Catch `JsonRpcNetworkError`, display warning message, continue with local verification. Mark status as 'unknown' and inform user.

### Q: How do we detect pending transfers?
A: Check TXF for `offlineTransfer` field. If present and state is unspent on-chain, it's a pending transfer.

### Q: How do we distinguish outdated vs confirmed transfers?
A: Both have spent state on-chain. Check if TXF has matching transaction in `transactions[]` array:
  - Has matching TX → Confirmed (transfer recorded)
  - No matching TX → Outdated (transfer happened elsewhere)

## Next Steps

1. **Implementation Phase 1:** Create `ownership-verification.ts` with helper functions
2. **Implementation Phase 2:** Modify `verify-token.ts` to add ownership section
3. **Implementation Phase 3:** Add display functions for each scenario
4. **Testing:** Test all scenarios with local aggregator
5. **Documentation:** Update command help text and README
6. **Review:** Code review focusing on error handling and edge cases

## Expected User Experience

### Before Enhancement
```
$ npm run verify-token -- -f token.txf

=== Token Verification ===
✓ Proofs valid
✓ Genesis present
✓ State present

(User doesn't know if token is still spendable)
```

### After Enhancement
```
$ npm run verify-token -- -f token.txf

=== Token Verification ===
✓ Proofs valid
✓ Genesis present
✓ State present

=== Ownership Status ===
✅ On-Chain Status: Active (not spent)
Current Owner: UND://a1b2c3...
  Public Key: 02cf6a24...
  Predicate Type: Unmasked

✓ This TXF is up-to-date
✓ You can send this token
```

## Files to Create/Modify

### Create
- [x] `/home/vrogojin/cli/OWNERSHIP_VERIFICATION_DESIGN.md` - Full design spec
- [x] `/home/vrogojin/cli/OWNERSHIP_VERIFICATION_FLOW.md` - Flow diagrams
- [x] `/home/vrogojin/cli/OWNERSHIP_VERIFICATION_SUMMARY.md` - This file
- [ ] `/home/vrogojin/cli/src/utils/ownership-verification.ts` - Implementation

### Modify
- [ ] `/home/vrogojin/cli/src/commands/verify-token.ts` - Add ownership section
- [ ] `/home/vrogojin/cli/README.md` - Update verify-token documentation

## Estimated Effort

- Design & Planning: 2 hours ✅ (Complete)
- Implementation: 4-6 hours
  - Helper functions: 2 hours
  - Integration: 2 hours
  - Display formatting: 1-2 hours
- Testing: 2-3 hours
- Documentation: 1 hour

**Total: 9-12 hours**

## Success Criteria

✅ User can determine if their TXF is up-to-date with blockchain
✅ Clear messaging for all four scenarios
✅ Graceful error handling for network issues
✅ No breaking changes to existing functionality
✅ Performance impact < 250ms per verification
✅ Works with both masked and unmasked predicates
✅ Comprehensive test coverage
✅ Updated documentation

---

**Ready for Implementation!** All design decisions documented, patterns identified, and implementation path clear.
