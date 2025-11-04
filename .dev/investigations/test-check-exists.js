#!/usr/bin/env node

import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';

const endpoint = 'http://localhost:3000';

async function checkRequestExists() {
  try {
    // Create a completely unique request
    const timestamp = Date.now() + Math.random();
    const secret = `test_secret_${timestamp}`;
    const state = `test_state_${timestamp}`;

    console.log(`Checking with secret: ${secret}`);
    console.log(`Checking with state: ${state}`);

    const client = new AggregatorClient(endpoint);

    // Create signing service with the secret
    const secretBytes = new TextEncoder().encode(secret);
    const signingService = await SigningService.createFromSecret(secretBytes);

    // Calculate state hash
    const stateHasher = new DataHasher(HashAlgorithm.SHA256);
    const stateHash = await stateHasher.update(new TextEncoder().encode(state)).digest();

    // Create a request ID
    const requestId = await RequestId.create(signingService.publicKey, stateHash);
    console.log(`Generated RequestId: ${requestId.toJSON()}`);

    // Check if it exists
    console.log('\nChecking if RequestId exists in aggregator...');
    const response = await client.getInclusionProof(requestId);

    console.log('Response:', JSON.stringify(response, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }, 2));

    if (response && response.inclusionProof) {
      console.log('✓ Response has inclusionProof field');
      console.log('inclusionProof is null:', response.inclusionProof === null);
      console.log('inclusionProof type:', typeof response.inclusionProof);

      if (response.inclusionProof === null) {
        console.log('→ RequestId does NOT exist (inclusionProof is null)');
      } else {
        console.log('→ RequestId EXISTS (has inclusion proof data)');
      }
    } else {
      console.log('→ No inclusion proof in response - RequestId does not exist');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkRequestExists().catch(console.error);