#!/usr/bin/env node

/**
 * Test script to debug the aggregator flow
 * This shows what's actually happening with register-request and get-request
 */

import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { Authenticator } from '@unicitylabs/state-transition-sdk/lib/api/Authenticator.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

async function testAggregatorFlow() {
  const endpoint = process.env.ENDPOINT || 'http://localhost:8080';
  const secret = 'test123';
  const state = 'state1';
  const transition = 'transition1';

  console.log('=== TESTING AGGREGATOR FLOW ===');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Secret: ${secret}`);
  console.log(`State: ${state}`);
  console.log(`Transition: ${transition}`);
  console.log('');

  try {
    // Create client
    const client = new AggregatorClient(endpoint);

    // Create signing service
    const secretBytes = new TextEncoder().encode(secret);
    const signingService = await SigningService.createFromSecret(secretBytes);
    console.log(`Public Key: ${HexConverter.encode(signingService.publicKey)}`);

    // Hash state and transition
    const stateHasher = new DataHasher(HashAlgorithm.SHA256);
    const stateHash = await stateHasher.update(new TextEncoder().encode(state)).digest();
    console.log(`State Hash: ${HexConverter.encode(stateHash.data)}`);

    const transitionHasher = new DataHasher(HashAlgorithm.SHA256);
    const transactionHash = await transitionHasher.update(new TextEncoder().encode(transition)).digest();
    console.log(`Transaction Hash: ${HexConverter.encode(transactionHash.data)}`);

    // Create RequestId
    const requestId = await RequestId.create(signingService.publicKey, stateHash);
    console.log(`Request ID: ${requestId.toJSON()}`);
    console.log('');

    // Create authenticator
    const authenticator = await Authenticator.create(signingService, transactionHash, stateHash);

    // Submit commitment
    console.log('=== SUBMITTING COMMITMENT ===');
    const submitResponse = await client.submitCommitment(requestId, transactionHash, authenticator);
    console.log('Submit Response:', JSON.stringify(submitResponse, null, 2));
    console.log('Response Status:', submitResponse.status);
    console.log('Response Type:', typeof submitResponse);
    console.log('Response Keys:', Object.keys(submitResponse));
    console.log('');

    // Wait a moment for processing
    console.log('Waiting 2 seconds for aggregator processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Query for inclusion proof
    console.log('=== QUERYING INCLUSION PROOF ===');
    const inclusionResponse = await client.getInclusionProof(requestId);
    console.log('Inclusion Response:', JSON.stringify(inclusionResponse, null, 2));
    console.log('Response Type:', typeof inclusionResponse);
    console.log('Response Keys:', inclusionResponse ? Object.keys(inclusionResponse) : 'null');

    if (inclusionResponse) {
      console.log('Has inclusionProof field:', 'inclusionProof' in inclusionResponse);
      console.log('inclusionProof value:', inclusionResponse.inclusionProof);

      // Check the structure
      if (inclusionResponse.inclusionProof) {
        console.log('Inclusion Proof Keys:', Object.keys(inclusionResponse.inclusionProof));
      }
    }
    console.log('');

    // Try to submit the SAME request again (should fail or be rejected)
    console.log('=== TESTING DUPLICATE SUBMISSION ===');
    try {
      const duplicateResponse = await client.submitCommitment(requestId, transactionHash, authenticator);
      console.log('Duplicate Submit Response:', JSON.stringify(duplicateResponse, null, 2));
      console.log('Duplicate Status:', duplicateResponse.status);
    } catch (dupError) {
      console.log('Duplicate submission failed (expected):', dupError.message);
    }
    console.log('');

    // Try with a DIFFERENT transition but same secret+state
    console.log('=== TESTING DIFFERENT TRANSITION (SAME SECRET+STATE) ===');
    const transition2 = 'transition2';
    const transitionHasher2 = new DataHasher(HashAlgorithm.SHA256);
    const transactionHash2 = await transitionHasher2.update(new TextEncoder().encode(transition2)).digest();
    console.log(`New Transaction Hash: ${HexConverter.encode(transactionHash2.data)}`);

    // Same RequestId (because same secret+state)
    console.log(`Request ID (should be same): ${requestId.toJSON()}`);

    const authenticator2 = await Authenticator.create(signingService, transactionHash2, stateHash);

    try {
      const response2 = await client.submitCommitment(requestId, transactionHash2, authenticator2);
      console.log('Second Submit Response:', JSON.stringify(response2, null, 2));
      console.log('Second Submit Status:', response2.status);
    } catch (error2) {
      console.log('Second submission failed:', error2.message);
    }

  } catch (error) {
    console.error('ERROR:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run the test
testAggregatorFlow().catch(console.error);