import { Command } from 'commander';
import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
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
        
        // Use RequestId.fromDto to parse the hex request ID
        const requestId = RequestId.fromDto(requestIdStr);
        
        // Get inclusion proof from the aggregator
        const inclusionProof = await client.getInclusionProof(requestId);
        
        // Output the result in the same format as the original CLI
        console.log(`STATUS: success`);
        console.log(`PATH: ${JSON.stringify(inclusionProof.merkleTreePath.toDto(), null, 4)}`);
      } catch (err) {
	console.error(JSON.stringify(err));
        console.error(`Error getting request: ${JSON.stringify(err instanceof Error ? err.message : String(err))}`);
      }
    });
}