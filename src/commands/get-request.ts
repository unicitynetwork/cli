import { Command } from 'commander';
import { InclusionProof, InclusionProofVerificationStatus } from '@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import { DataHash } from '@unicitylabs/commons/lib/hash/DataHash.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

export function getRequestCommand(program: Command): void {
  program
    .command('get-request')
    .description('Get inclusion proof for a specific request ID')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .argument('<requestId>', 'Request ID to query')
    .action(async (requestIdStr: string, options) => {
      // Get the endpoint from options
      const endpoint = options.endpoint;
      try {
        // Create AggregatorClient with the specified endpoint
        const client = new AggregatorClient(endpoint);
        
        // Use RequestId.fromJSON to parse the hex request ID
        const requestId = RequestId.fromJSON(requestIdStr);
        
        // Get inclusion proof from the aggregator
        const inclusionProofResponse = await client.getInclusionProof(requestId);

        if (inclusionProofResponse && inclusionProofResponse.inclusionProof) {
          // Create InclusionProof from the response
          const inclusionProof = InclusionProof.fromJSON(inclusionProofResponse);

          // Create a trust base for verification (using minimal trust base for now)
          const trustBase = RootTrustBase.fromJSON({
            version: "1",
            networkId: 1,
            epoch: "0",
            epochStartRound: "0",
            rootNodes: [],
            quorumThreshold: "0",
            stateHash: HexConverter.encode(new Uint8Array(32)),
            changeRecordHash: null,
            previousEntryHash: null,
            signatures: {}
          });

          // Verify the inclusion proof
          const status = await inclusionProof.verify(trustBase, requestId);

          // Output the result
          console.log(`STATUS: ${status}`);
          console.log(`PATH: ${JSON.stringify(inclusionProof.merkleTreePath.toJSON(), null, 4)}`);
        } else {
          console.log('STATUS: NOT_FOUND');
          console.log('No inclusion proof available for this request ID');
        }
      } catch (err) {
	console.error(JSON.stringify(err));
        console.error(`Error getting request: ${JSON.stringify(err instanceof Error ? err.message : String(err))}`);
      }
    });
}