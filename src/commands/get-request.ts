import { Command } from 'commander';

export function getRequestCommand(program: Command): void {
  program
    .command('get-request')
    .description('Get inclusion proof for a specific request ID')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('--local', 'Use local aggregator (http://localhost:3001)')
    .option('--production', 'Use production aggregator (https://gateway.unicity.network)')
    .option('--json', 'Output raw JSON response for pipeline processing')
    .argument('<requestId>', 'Request ID to query')
    .action(async (requestIdStr: string, options) => {
      // Determine endpoint
      let endpoint = options.endpoint;
      if (options.local) {
        endpoint = 'http://localhost:3001';
      } else if (options.production) {
        endpoint = 'https://gateway.unicity.network';
      }
      try {
        // Make raw JSON-RPC call to avoid SDK's deserialization issues
        const requestBody = {
          jsonrpc: '2.0',
          method: 'get_inclusion_proof',
          params: {
            requestId: requestIdStr
          },
          id: 1
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        const jsonResponse = await response.json();

        // If --json flag is set, output raw JSON and exit
        if (options.json) {
          console.log(JSON.stringify(jsonResponse, null, 2));
          return;
        }

        if (jsonResponse.result && jsonResponse.result.inclusionProof) {
          const proofData = jsonResponse.result.inclusionProof;

          // Check if this is an exclusion proof (non-inclusion proof)
          // In the SDK, exclusion proofs would verify as PATH_NOT_INCLUDED
          // Since we can't parse with SDK due to format issues, we check:
          // - null authenticator and transactionHash indicate no commitment exists
          const isExclusionProof = proofData.authenticator === null &&
                                   proofData.transactionHash === null;

          if (isExclusionProof) {
            console.log('STATUS: PATH_NOT_INCLUDED');
            console.log('This is an EXCLUSION PROOF (non-inclusion proof).');
            console.log('');
            console.log('What this means:');
            console.log('  - The RequestId does NOT exist in the Sparse Merkle Tree');
            console.log('  - No commitment with this RequestId has been registered');
            console.log('  - The proof cryptographically demonstrates absence');
            console.log('');
            console.log('Merkle Tree Path:');
            console.log(`  Root Hash: ${proofData.merkleTreePath.root}`);
            console.log(`  Path Length: ${proofData.merkleTreePath.steps.length} steps`);
            console.log('');
            console.log('Hash Path (for pipeline use):');
            if (proofData.merkleTreePath.steps && proofData.merkleTreePath.steps.length > 0) {
              proofData.merkleTreePath.steps.forEach((step: any, index: number) => {
                console.log(`  Step ${index}:`);
                console.log(`    Path: ${step.path ?? 'N/A'}`);
                console.log(`    Data: ${step.data ?? 'N/A'}`);
              });
            } else {
              console.log('  No steps in path (leaf node or empty tree)');
            }
            console.log('');
            console.log('Note: In the SDK, this would verify with status PATH_NOT_INCLUDED');
            return;
          }

          // For actual inclusion proofs
          console.log('STATUS: OK (expected)');
          console.log('This is an INCLUSION PROOF.');
          console.log('');
          console.log('What this means:');
          console.log('  - The RequestId EXISTS in the Sparse Merkle Tree');
          console.log('  - A commitment was successfully registered');
          console.log('');
          console.log('Commitment Data:');
          if (proofData.transactionHash) {
            console.log(`  Transaction Hash: ${proofData.transactionHash}`);
          }
          if (proofData.authenticator) {
            console.log(`  Authenticator:`);
            console.log(`    Signature: ${proofData.authenticator.signature}`);
            console.log(`    Public Key: ${proofData.authenticator.publicKey}`);
          }
          console.log('');
          console.log('Merkle Tree Path:');
          console.log(`  Root Hash: ${proofData.merkleTreePath.root}`);
          console.log(`  Path Length: ${proofData.merkleTreePath.steps.length} steps`);
          console.log('');
          console.log('Hash Path (for pipeline use):');
          if (proofData.merkleTreePath.steps && proofData.merkleTreePath.steps.length > 0) {
            proofData.merkleTreePath.steps.forEach((step: any, index: number) => {
              console.log(`  Step ${index}:`);
              console.log(`    Path: ${step.path ?? 'N/A'}`);
              console.log(`    Data: ${step.data ?? 'N/A'}`);
            });
          } else {
            console.log('  No steps in path (leaf node or empty tree)');
          }
          console.log('');
          if (proofData.unicityCertificate) {
            console.log('Unicity Certificate (CBOR-encoded):');
            console.log(`  ${proofData.unicityCertificate}`);
            console.log('');
          }
          console.log('Note: In the SDK, this would verify with status OK');

        } else {
          console.log('STATUS: NOT_FOUND');
          console.log('No proof available for this request ID');
        }
      } catch (err) {
        console.error(`Error getting request: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
}