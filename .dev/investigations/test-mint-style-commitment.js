#!/usr/bin/env node

import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { Authenticator } from '@unicitylabs/state-transition-sdk/lib/api/Authenticator.js';
import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';
import { MintTransactionState } from '@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionState.js';

const endpoint = 'http://localhost:3000';

async function testMintStyleCommitment() {
  try {
    // Use our own secret (not the universal MINTER_SECRET)
    const secret = `mint_style_test_${Date.now()}`;
    const state = `state_${Date.now()}`;
    const transition = `transition_${Date.now()}`;

    console.log('=== TESTING MINT-STYLE COMMITMENT WITH CUSTOM SECRET ===');
    console.log(`Secret: ${secret}`);
    console.log(`State: ${state}`);
    console.log(`Transition: ${transition}`);
    console.log('');

    const client = new AggregatorClient(endpoint);

    // Create signing service with our secret
    const secretBytes = new TextEncoder().encode(secret);
    const signingService = await SigningService.createFromSecret(secretBytes);
    console.log(`Public Key: ${Buffer.from(signingService.publicKey).toString('hex')}`);

    // Create TokenId from state hash
    const stateHasher = new DataHasher(HashAlgorithm.SHA256);
    const stateHash = await stateHasher.update(new TextEncoder().encode(state)).digest();
    const tokenId = new TokenId(stateHash.data);
    console.log(`Token ID: ${tokenId.toJSON()}`);

    // Create MintTransactionState (this adds the MINT_SUFFIX)
    const mintState = await MintTransactionState.create(tokenId);
    console.log(`Mint State: ${mintState.toJSON()}`);

    // Hash transition
    const transitionHasher = new DataHasher(HashAlgorithm.SHA256);
    const transactionHash = await transitionHasher.update(new TextEncoder().encode(transition)).digest();
    console.log(`Transaction Hash: ${transactionHash.toJSON()}`);

    // Create RequestId with MintTransactionState
    const requestId = await RequestId.create(signingService.publicKey, mintState);
    console.log(`Request ID: ${requestId.toJSON()}`);
    console.log('');

    // Create Authenticator with MintTransactionState
    const authenticator = await Authenticator.create(signingService, transactionHash, mintState);

    // Submit commitment
    console.log('Submitting mint-style commitment...');
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
          console.log('  This means the mint-style commitment WAS accepted and persisted!');
          console.log('  Authenticator:', proof.authenticator ? 'present' : 'null');
          console.log('  Transaction Hash:', proof.transactionHash);
          return;
        } else {
          console.log('  Status: EXCLUSION (not yet included)');
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n❌ Mint-style commitment was NOT included');
    console.log('This means even using MintTransactionState structure doesn\'t help');

  } catch (error) {
    console.error('Error:', error);
  }
}

testMintStyleCommitment().catch(console.error);