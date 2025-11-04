#!/usr/bin/env node

import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { Authenticator } from '@unicitylabs/state-transition-sdk/lib/api/Authenticator.js';
import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';
import { MintTransactionState } from '@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionState.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';

const endpoint = 'http://localhost:3000';

// The universal MINTER_SECRET used by MintCommitment
const MINTER_SECRET = HexConverter.decode('495f414d5f554e4956455253414c5f4d494e5445525f464f525f');

async function testWithMinterSecret() {
  try {
    const state = `state_${Date.now()}`;
    const transition = `transition_${Date.now()}`;

    console.log('=== TESTING WITH UNIVERSAL MINTER_SECRET ===');
    console.log(`State: ${state}`);
    console.log(`Transition: ${transition}`);
    console.log(`MINTER_SECRET: ${HexConverter.encode(MINTER_SECRET)}`);
    console.log('');

    const client = new AggregatorClient(endpoint);

    // Create TokenId from state
    const stateHasher = new DataHasher(HashAlgorithm.SHA256);
    const stateHash = await stateHasher.update(new TextEncoder().encode(state)).digest();
    const tokenId = new TokenId(stateHash.data);
    console.log(`Token ID: ${tokenId.toJSON()}`);

    // Create signing service with MINTER_SECRET + tokenId (like MintCommitment does)
    const signingService = await SigningService.createFromSecret(MINTER_SECRET, tokenId.bytes);
    console.log(`Public Key: ${Buffer.from(signingService.publicKey).toString('hex')}`);

    // Create MintTransactionState
    const mintState = await MintTransactionState.create(tokenId);
    console.log(`Mint State: ${mintState.toJSON()}`);

    // Hash transition
    const transitionHasher = new DataHasher(HashAlgorithm.SHA256);
    const transactionHash = await transitionHasher.update(new TextEncoder().encode(transition)).digest();
    console.log(`Transaction Hash: ${transactionHash.toJSON()}`);

    // Create RequestId
    const requestId = await RequestId.create(signingService.publicKey, mintState);
    console.log(`Request ID: ${requestId.toJSON()}`);
    console.log('');

    // Create Authenticator
    const authenticator = await Authenticator.create(signingService, transactionHash, mintState);

    // Submit commitment
    console.log('Submitting with MINTER_SECRET...');
    const submitResponse = await client.submitCommitment(requestId, transactionHash, authenticator);
    console.log('Submit Response:', JSON.stringify(submitResponse, null, 2));
    console.log('');

    // Poll for inclusion
    console.log('Polling for inclusion proof (10 attempts, 1s delay)...');
    for (let attempt = 1; attempt <= 10; attempt++) {
      console.log(`\nAttempt ${attempt}/10:`);

      const response = await client.getInclusionProof(requestId);

      if (response && response.inclusionProof) {
        const proof = response.inclusionProof;
        const isIncluded = proof.authenticator !== null && proof.transactionHash !== null;

        if (isIncluded) {
          console.log('✅ INCLUSION PROOF FOUND!');
          console.log('  ★★★ THIS IS THE KEY! The MINTER_SECRET is what makes it work! ★★★');
          console.log('  Authenticator:', proof.authenticator ? 'present' : 'null');
          console.log('  Transaction Hash:', proof.transactionHash);
          return;
        } else {
          console.log('  Status: EXCLUSION (not yet included)');
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n❌ Still not included even with MINTER_SECRET');
    console.log('The aggregator must have additional validation logic');

  } catch (error) {
    console.error('Error:', error);
    console.error('Stack:', error.stack);
  }
}

testWithMinterSecret().catch(console.error);