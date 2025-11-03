import { Command } from 'commander';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { Authenticator } from '@unicitylabs/state-transition-sdk/lib/api/Authenticator.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { TextEncoder } from 'util';

export function registerRequestCommand(program: Command): void {
  program
    .command('register-request')
    .description('Register a commitment request at generic abstraction level (no token structures)')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('--local', 'Use local aggregator (http://localhost:3001)')
    .option('--production', 'Use production aggregator (https://gateway.unicity.network)')
    .argument('<secret>', 'Secret key for signing the request')
    .argument('<state>', 'State data (will be hashed to derive RequestId)')
    .argument('<transactionData>', 'Transaction data (will be hashed)')
    .action(async (secret: string, state: string, transactionData: string, options) => {
      // Determine endpoint
      let endpoint = options.endpoint;
      if (options.local) {
        endpoint = 'http://localhost:3001';
      } else if (options.production) {
        endpoint = 'https://gateway.unicity.network';
      }

      try {
        console.log('Creating commitment at generic abstraction level...\n');

        // 1. Create signing service from secret
        const secretBytes = new TextEncoder().encode(secret);
        const signingService = await SigningService.createFromSecret(secretBytes);
        console.log(`Public Key: ${Buffer.from(signingService.publicKey).toString('hex')}`);

        // 2. Hash the state to create stateHash
        const stateHasher = new DataHasher(HashAlgorithm.SHA256);
        const stateHash = await stateHasher.update(new TextEncoder().encode(state)).digest();
        console.log(`State Hash: ${stateHash.toJSON()}`);

        // 3. Hash the transaction data to create transactionHash
        const transactionHasher = new DataHasher(HashAlgorithm.SHA256);
        const transactionHash = await transactionHasher.update(new TextEncoder().encode(transactionData)).digest();
        console.log(`Transaction Hash: ${transactionHash.toJSON()}`);

        // 4. Create RequestId = hash(publicKey + stateHash)
        const requestId = await RequestId.create(signingService.publicKey, stateHash);
        console.log(`Request ID: ${requestId.toJSON()}\n`);

        // 5. Create Authenticator = sign(transactionHash) with stateHash
        const authenticator = await Authenticator.create(signingService, transactionHash, stateHash);

        // 6. Submit commitment to aggregator
        console.log(`Submitting to aggregator: ${endpoint}`);
        const client = new AggregatorClient(endpoint);
        const result = await client.submitCommitment(requestId, transactionHash, authenticator);

        if (result.status === 'SUCCESS') {
          console.log('✅ Commitment successfully registered');
          console.log('\nCommitment Details:');
          console.log(`  Request ID: ${requestId.toJSON()}`);
          console.log(`  Transaction Hash: ${transactionHash.toJSON()}`);
          console.log(`  State Hash: ${stateHash.toJSON()}`);
          console.log('\nYou can check the inclusion proof with:');
          console.log(`  npm run get-request -- ${requestId.toJSON()}`);
        } else {
          console.error(`❌ Failed to register commitment: ${result.status}`);
        }
      } catch (error) {
        console.error(`Error registering commitment: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error && error.stack) {
          console.error('Stack trace:', error.stack);
        }
      }
    });
}