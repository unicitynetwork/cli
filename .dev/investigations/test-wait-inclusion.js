#!/usr/bin/env node

import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { Authenticator } from '@unicitylabs/state-transition-sdk/lib/api/Authenticator.js';

const endpoint = 'http://localhost:3000';

async function testWithPolling() {
  try {
    // Create unique data
    const timestamp = Date.now() + Math.random();
    const secret = `polling_test_${timestamp}`;
    const state = `state_${timestamp}`;
    const transition = `transition_${timestamp}`;

    console.log('=== TESTING WITH POLLING ===');
    console.log(`Secret: ${secret}`);
    console.log(`State: ${state}`);
    console.log(`Transition: ${transition}`);
    console.log('');

    const client = new AggregatorClient(endpoint);

    // Create signing service
    const secretBytes = new TextEncoder().encode(secret);
    const signingService = await SigningService.createFromSecret(secretBytes);

    // Hash state and transition
    const stateHasher = new DataHasher(HashAlgorithm.SHA256);
    const stateHash = await stateHasher.update(new TextEncoder().encode(state)).digest();

    const transitionHasher = new DataHasher(HashAlgorithm.SHA256);
    const transactionHash = await transitionHasher.update(new TextEncoder().encode(transition)).digest();

    // Create RequestId and Authenticator
    const requestId = await RequestId.create(signingService.publicKey, stateHash);
    const authenticator = await Authenticator.create(signingService, transactionHash, stateHash);

    console.log(`RequestId: ${requestId.toJSON()}`);
    console.log('');

    // Submit commitment
    console.log('Submitting commitment...');
    const submitResponse = await client.submitCommitment(requestId, transactionHash, authenticator);
    console.log('Submit Response:', JSON.stringify(submitResponse, null, 2));
    console.log('');

    // Poll for inclusion
    console.log('Polling for inclusion proof...');
    const maxAttempts = 10;
    const delayMs = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`\nAttempt ${attempt}/${maxAttempts}:`);

      const response = await client.getInclusionProof(requestId);

      if (response && response.inclusionProof) {
        const proof = response.inclusionProof;

        // Check if it's an inclusion proof (non-null authenticator/transactionHash)
        const isIncluded = proof.authenticator !== null && proof.transactionHash !== null;

        if (isIncluded) {
          console.log('✅ INCLUSION PROOF FOUND!');
          console.log('  Authenticator:', proof.authenticator ? 'present' : 'null');
          console.log('  Transaction Hash:', proof.transactionHash);
          console.log('  Root:', proof.merkleTreePath.root);
          console.log('  Path steps:', proof.merkleTreePath.steps.length);
          return;
        } else {
          console.log('  Status: EXCLUSION (not yet included)');
          console.log('  Root:', proof.merkleTreePath.root);
        }
      } else {
        console.log('  No proof response');
      }

      if (attempt < maxAttempts) {
        console.log(`  Waiting ${delayMs}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log('\n❌ Commitment was not included after', maxAttempts, 'attempts');
    console.log('This confirms that regular commitments are not being persisted by the aggregator');

  } catch (error) {
    console.error('Error:', error);
  }
}

testWithPolling().catch(console.error);