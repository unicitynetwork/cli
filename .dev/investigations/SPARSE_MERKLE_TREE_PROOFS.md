# Understanding Sparse Merkle Tree Proofs in Unicity

## Key Concepts

### Inclusion vs Exclusion Proofs

In a Sparse Merkle Tree (SMT), every possible key has a predetermined location based on its hash. This allows for two types of proofs:

1. **Inclusion Proof**: Proves that a RequestId EXISTS in the tree
   - Shows the path from the leaf to the root
   - Each step contains the sibling hash needed to reconstruct the root
   - Verification: Following the path with the provided siblings reproduces the known root

2. **Exclusion Proof (Non-Inclusion Proof)**: Proves that a RequestId DOES NOT EXIST in the tree
   - Shows the path to where the RequestId WOULD be if it existed
   - The path demonstrates that the necessary branch doesn't exist
   - Cryptographically proves the RequestId is absent from the tree
   - This is what the aggregator returns for non-existent RequestIds

## Aggregator Behavior

### Correct Behavior
- **Idempotent submissions**: The aggregator correctly allows multiple submissions with the same RequestId IF the transaction data is exactly the same
- **Exclusion proofs**: When querying a non-existent RequestId, the aggregator returns an exclusion proof (what appears as an "inclusion proof" structure but actually proves non-existence)

### Current Issue
- The aggregator incorrectly accepts DIFFERENT transaction data for the same RequestId
- This violates the immutability principle: once a RequestId is registered with specific transaction data, it should be immutable

## Abstraction Layers

### Low-Level (RequestId Operations)
Used in `register-request` and `get-request` commands:
```javascript
// Direct RequestId creation and aggregator interaction
const requestId = await RequestId.create(publicKey, stateHash);
const result = await aggregatorClient.submitCommitment(requestId, transactionHash, authenticator);
const proof = await aggregatorClient.getInclusionProof(requestId);
```

### High-Level (Token/Commitment Operations)
Used in the mint NFT project:
```javascript
// Works with Commitments and Tokens
const commitment = await MintCommitment.create(mintTransactionData);
const response = await client.submitMintCommitment(commitment);
const inclusionProof = await waitInclusionProof(trustBase, client, commitment);
const token = await Token.mint(trustBase, tokenState, mintTransaction, nametagTokens);
```

The high-level approach:
- Abstracts away RequestId management
- Uses SDK utilities like `waitInclusionProof`
- Handles proof verification internally
- Works with semantic objects (Tokens, Commitments) rather than raw cryptographic primitives

## Proof Structure in Responses

When the aggregator returns a proof for a non-existent RequestId:
```json
{
  "inclusionProof": {
    "merkleTreePath": {
      "root": "00000c96af7ee2698488293ad37ee7e46facf59adf19517d05b16d8da0d7cbe03b15",
      "steps": [
        {
          "path": "237145...", // Path direction in the tree
          "data": "00003ff855..." // Sibling hash at this level
        },
        // More steps showing the path that WOULD lead to the RequestId
        // The absence of the required branch proves non-existence
      ]
    },
    "authenticator": null, // No authenticator for non-existent entry
    "transactionHash": null, // No transaction for non-existent entry
    "unicityCertificate": "..." // Proof of the tree state
  }
}
```

The null `authenticator` and `transactionHash` indicate this is an exclusion proof - the RequestId doesn't exist in the tree.

## Implementation Notes

1. **RequestId Generation**: `hash(publicKey + stateHash)` - transition data is NOT included
2. **Same secret + state = Same RequestId** regardless of transition
3. **The aggregator should enforce**: Once a RequestId is registered with specific transaction data, subsequent submissions must have identical transaction data
4. **SDK parsing issues**: The SDK's `InclusionProof.fromJSON()` struggles with the large path numbers in exclusion proofs (81-digit numbers)

## Best Practices

For new implementations:
- Use high-level abstractions (Commitments, Tokens) when possible
- Let SDK utilities handle proof verification
- Avoid direct RequestId manipulation unless necessary
- Use `waitInclusionProof` for proper timeout and retry logic