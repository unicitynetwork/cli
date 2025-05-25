import { Command } from 'commander';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { Authenticator } from '@unicitylabs/commons/lib/api/Authenticator.js';
import { DataHash } from '@unicitylabs/commons/lib/hash/DataHash.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { TextEncoder } from 'util';

export function registerRequestCommand(program: Command): void {
  program
    .command('register-request')
    .description('Register a new state transition request')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .argument('<secret>', 'Secret key for signing the request')
    .argument('<state>', 'Source state data (will be hashed)')
    .argument('<transition>', 'Transition data (will be hashed)')
    .action(async (secret: string, state: string, transition: string, options) => {
      // Get the endpoint from options
      const endpoint = options.endpoint;
      try {
        // Create AggregatorClient
        const client = new AggregatorClient(endpoint);
        
        // Create signing service with the secret
        const secretBytes = new TextEncoder().encode(secret);
        const signingService = await SigningService.createFromSecret(secretBytes);
        
        // Calculate state hash and transaction hash
        const stateHasher = new DataHasher(HashAlgorithm.SHA256);
        const stateHash = await stateHasher.update(new TextEncoder().encode(state)).digest();
        
        const transitionHasher = new DataHasher(HashAlgorithm.SHA256);
        const transactionHash = await transitionHasher.update(new TextEncoder().encode(transition)).digest();
        
        // Create a request ID
        const requestId = await RequestId.create(signingService.publicKey, stateHash);
        
        // Create authenticator
        const authenticator = await Authenticator.create(signingService, transactionHash, stateHash);
        
        // Submit the transaction
        const result = await client.submitTransaction(requestId, transactionHash, authenticator);
        
        if (result.status === 'SUCCESS') {
          console.log(`Request successfully registered. Request ID: ${requestId.toDto()}`);
        } else {
          console.error(`Failed to register request: ${result.status}`);
        }
      } catch (error) {
	console.error(JSON.stringify(error));
        console.error(`Error registering request: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
}