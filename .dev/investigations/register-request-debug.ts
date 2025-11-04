import { Command } from 'commander';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { Authenticator } from '@unicitylabs/state-transition-sdk/lib/api/Authenticator.js';
import { DataHash } from '@unicitylabs/state-transition-sdk/lib/hash/DataHash.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { TextEncoder } from 'util';

export function registerRequestDebugCommand(program: Command): void {
  program
    .command('register-request-debug')
    .description('Register a new state transition request with detailed debugging')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('-v, --verbose', 'Show verbose debugging information')
    .argument('<secret>', 'Secret key for signing the request')
    .argument('<state>', 'Source state data (will be hashed)')
    .argument('<transition>', 'Transition data (will be hashed)')
    .action(async (secret: string, state: string, transition: string, options) => {
      const endpoint = options.endpoint;
      const verbose = options.verbose;

      try {
        console.log('\n=== REGISTER REQUEST DEBUG ===\n');
        console.log(`Endpoint: ${endpoint}`);
        console.log(`Secret: ${secret.substring(0, 3)}...`);
        console.log(`State: "${state}"`);
        console.log(`Transition: "${transition}"`);
        console.log('');

        // Create AggregatorClient
        const client = new AggregatorClient(endpoint);

        // Create signing service with the secret
        const secretBytes = new TextEncoder().encode(secret);
        const signingService = await SigningService.createFromSecret(secretBytes);

        if (verbose) {
          console.log(`Public Key: ${HexConverter.encode(signingService.publicKey)}`);
          console.log('');
        }

        // Calculate state hash
        const stateHasher = new DataHasher(HashAlgorithm.SHA256);
        const stateHash = await stateHasher.update(new TextEncoder().encode(state)).digest();
        console.log(`State Hash: ${HexConverter.encode(stateHash.data)}`);

        // Calculate transaction hash
        const transitionHasher = new DataHasher(HashAlgorithm.SHA256);
        const transactionHash = await transitionHasher.update(new TextEncoder().encode(transition)).digest();
        console.log(`Transaction Hash: ${HexConverter.encode(transactionHash.data)}`);
        console.log('');

        // Create a request ID (THIS ONLY USES publicKey + stateHash!)
        const requestId = await RequestId.create(signingService.publicKey, stateHash);

        console.log('⚠️  IMPORTANT: RequestId is generated from:');
        console.log('   - Public Key (from secret)');
        console.log('   - State Hash');
        console.log('   ❌ NOT INCLUDING: Transition data!');
        console.log('');
        console.log(`Request ID: ${requestId.toJSON()}`);
        console.log('');
        console.log('This means:');
        console.log('✓ Same secret + same state = SAME RequestId');
        console.log('✓ Different transitions with same secret+state = SAME RequestId');
        console.log('✓ Second registration will likely OVERWRITE the first!');
        console.log('');

        // Create authenticator
        const authenticator = await Authenticator.create(signingService, transactionHash, stateHash);

        if (verbose) {
          console.log('Authenticator created with:');
          console.log(`  - Signature Algorithm: ${authenticator.algorithm}`);
          console.log(`  - Public Key: ${HexConverter.encode(authenticator.publicKey)}`);
          console.log(`  - Signature: [signature data]`);
          console.log('');
        }

        console.log('Submitting to aggregator...');
        console.log('Payload:');
        console.log(`  - RequestId: ${requestId.toJSON()}`);
        console.log(`  - Transaction Hash: ${HexConverter.encode(transactionHash.data)}`);
        console.log(`  - Authenticator: [signature + publicKey]`);
        console.log('');

        // Submit the commitment
        const result = await client.submitCommitment(requestId, transactionHash, authenticator);

        console.log('=== RESPONSE ===');
        console.log(`Status: ${result.status}`);

        if (result.receipt) {
          console.log('Receipt:', result.receipt);
        }

        if (result.status === 'SUCCESS') {
          console.log(`✅ Request successfully registered`);
          console.log(`Request ID: ${requestId.toJSON()}`);
          console.log('');
          console.log('To verify, run:');
          console.log(`npm run get-request -- -e ${endpoint} ${requestId.toJSON()}`);
        } else {
          console.error(`❌ Failed to register request: ${result.status}`);
          console.log('');
          console.log('Possible reasons:');
          console.log('1. Duplicate RequestId (same secret+state was already registered)');
          console.log('2. Invalid signature');
          console.log('3. Aggregator rejected the request');
        }

      } catch (error) {
        console.error('\n❌ ERROR:', error);

        if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
          console.error('\n📡 Connection refused. Is your aggregator running?');
          console.error(`   Check: ${endpoint}`);
        }

        console.error(`\nFull error: ${error instanceof Error ? error.message : String(error)}`);

        if (verbose && error instanceof Error && error.stack) {
          console.error('\nStack trace:');
          console.error(error.stack);
        }
      }
    });
}