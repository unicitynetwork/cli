import { Command } from 'commander';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { Authenticator } from '@unicitylabs/state-transition-sdk/lib/api/Authenticator.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { TextEncoder } from 'util';
import { validateSecret, throwValidationError } from '../utils/input-validation.js';

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
      // Validate secret (CRITICAL: prevent weak/empty secrets)
      const secretValidation = validateSecret(secret, 'register-request');
      if (!secretValidation.valid) {
        throwValidationError(secretValidation);
      }

      // Validate state argument (cannot be empty)
      if (!state || state.trim() === '') {
        console.error('❌ State cannot be empty');
        console.error('\nState data is required for commitment registration.');
        console.error('It will be hashed to derive the RequestId.\n');
        process.exit(1);
      }

      // Validate transactionData argument (cannot be empty)
      if (!transactionData || transactionData.trim() === '') {
        console.error('❌ Transaction data cannot be empty');
        console.error('\nTransaction data is required for commitment registration.');
        console.error('It will be hashed and signed by the authenticator.\n');
        process.exit(1);
      }

      // Determine endpoint
      let endpoint = options.endpoint;
      if (options.local) {
        endpoint = 'http://127.0.0.1:3000';
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

        console.log('\n=== AUTHENTICATOR CREATION DEBUG ===');
        console.log('Authenticator created locally:');
        console.log(`  Public Key: ${Buffer.from(authenticator.publicKey).toString('hex')}`);
        console.log(`  Signature: ${authenticator.signature ? Buffer.from(authenticator.signature.bytes).toString('hex') : 'NULL'}`);
        console.log(`  State Hash: ${authenticator.stateHash ? authenticator.stateHash.toJSON() : 'NULL'}`);

        // TEST: Verify our locally created authenticator BEFORE sending
        console.log('\n=== LOCAL AUTHENTICATOR VERIFICATION TEST ===');
        const localVerifies = await authenticator.verify(transactionHash);
        console.log(`✓ Local authenticator verifies transactionHash: ${localVerifies}`);

        if (!localVerifies) {
          console.error('❌ ERROR: Our locally-created authenticator FAILED verification!');
          console.error('This indicates a problem with Authenticator.create() or verify()');
          console.error('Aborting before submission...');
          process.exit(1);
        }

        console.log('✓ Local authenticator is VALID before submission\n');

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