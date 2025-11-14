# Aggregator API Quick Reference

## Critical Assertion

**404 = TECHNICAL ERROR**

A correctly functioning aggregator NEVER returns 404. It ALWAYS returns 200 OK with either:
- **Inclusion proof** (authenticator non-null) = RequestId in tree = SPENT state
- **Exclusion proof** (authenticator null) = RequestId NOT in tree = UNSPENT state

---

## Two Main Endpoints

### 1. submit_commitment
```json
POST /
{
  "method": "submit_commitment",
  "params": {
    "requestId": "0x...",
    "transactionHash": "0x...",
    "authenticator": { ... }
  }
}
```

**Returns:**
- `200 OK` + `{ status: "SUCCESS" }` = Commitment registered
- `200 OK` + Error = Duplicate with different data
- `503` = Temporarily unavailable
- `404` = **AGGREGATOR BROKEN** (should never happen)

---

### 2. get_inclusion_proof
```json
POST /
{
  "method": "get_inclusion_proof",
  "params": {
    "requestId": "0x..."
  }
}
```

**Returns (ALWAYS 200 OK):**

**Scenario A: RequestId IN tree (SPENT)**
```json
{
  "inclusionProof": {
    "authenticator": { "publicKey": "...", "signature": "..." },
    "transactionHash": "0x...",
    "merkleTreePath": { ... }
  }
}
```
SDK Status: `InclusionProofVerificationStatus.OK`

**Scenario B: RequestId NOT in tree (UNSPENT)**
```json
{
  "inclusionProof": {
    "authenticator": null,
    "transactionHash": null,
    "merkleTreePath": { ... }
  }
}
```
SDK Status: `InclusionProofVerificationStatus.PATH_NOT_INCLUDED`

**THIS IS NORMAL! Not an error!**

---

## SDK Method: getTokenStatus()

```typescript
async getTokenStatus(
  trustBase: RootTrustBase,
  token: Token<any>,
  publicKey: Uint8Array
): Promise<InclusionProofVerificationStatus>
```

### Returns (does NOT throw!)

| Return Value | Meaning |
|--------------|---------|
| `PATH_NOT_INCLUDED` | RequestId NOT in SMT = **UNSPENT** (normal) |
| `OK` | RequestId IN SMT = **SPENT** |
| `NOT_AUTHENTICATED` | Signature invalid = corrupted proof |
| `PATH_INVALID` | Merkle path broken = corrupted proof |

### Throws (only network errors!)

- HTTP 503 (aggregator down)
- ECONNREFUSED (network unreachable)
- Timeout
- JSON parse error

---

## Common Mistakes

### Mistake 1: Treating PATH_NOT_INCLUDED as Error

**WRONG:**
```typescript
try {
  const status = await client.getTokenStatus(...);
  spent = (status === OK);
} catch (err) {
  // PATH_NOT_INCLUDED doesn't throw!
  return 'error';
}
```

**CORRECT:**
```typescript
try {
  const status = await client.getTokenStatus(...);
  
  if (status === OK) {
    spent = true;
  } else if (status === PATH_NOT_INCLUDED) {
    spent = false; // NORMAL!
  } else {
    return 'corrupted';
  }
} catch (err) {
  // Only network errors
  return 'network_error';
}
```

---

### Mistake 2: Expecting 404 as Normal

**WRONG:**
```typescript
if (err.status === 404) {
  // "Normal - proof not ready"
  return null;
}
```

**CORRECT:**
```typescript
if (err.status === 404) {
  // TECHNICAL ERROR!
  throw new Error('Aggregator broken - 404 should never occur');
}
```

---

## Idempotency Rules

**Same RequestId + Same Transaction Data:**
- First submission: SUCCESS
- Second submission: SUCCESS (idempotent)

**Same RequestId + Different Transaction Data:**
- First submission: SUCCESS
- Second submission: ERROR "attempt to modify existing leaf"

---

## Error Code Reference

| HTTP Status | Meaning | Action |
|-------------|---------|--------|
| `200 OK` | Always returned for valid queries | Parse result |
| `400 Bad Request` | Malformed request | Fix request format |
| `404 Not Found` | **AGGREGATOR BROKEN** | Report to ops |
| `500 Internal Error` | Aggregator crashed | Retry once, then report |
| `503 Service Unavailable` | Temporarily down | Retry with backoff |

---

## Quick Diagnostic

**Problem:** Token verification fails with "network error"

**Check:**
1. Is aggregator running?
2. Is response 200 OK? (should be!)
3. Is `authenticator` null or non-null?
   - `null` = UNSPENT (normal!)
   - `non-null` = SPENT
4. Are you treating PATH_NOT_INCLUDED as error? (don't!)

**Problem:** Getting 404 errors

**Check:**
- Aggregator endpoint correct? (http://127.0.0.1:3000 for local)
- Aggregator service running?
- If yes to both: **AGGREGATOR IS BROKEN** - report to ops

---

## Files to Fix

### /home/vrogojin/cli/src/utils/ownership-verification.ts
**Lines 116-138:** Change error handling
- Handle PATH_NOT_INCLUDED as normal (unspent)
- Handle OK as normal (spent)
- Only catch network exceptions

### /home/vrogojin/cli/src/commands/verify-token.ts
**Lines 518-560:** Remove redundant try-catch
- Trust checkOwnershipStatus() to handle errors
- Set exit code based on scenario

---

## Further Reading

- Full specification: `/home/vrogojin/cli/AGGREGATOR_API_SPECIFICATION.md`
- Error handling guide: `/home/vrogojin/cli/AGGREGATOR_ERROR_HANDLING_GUIDE.md`
- Architecture docs: `/home/vrogojin/cli/.dev/architecture/ownership-verification-summary.md`
