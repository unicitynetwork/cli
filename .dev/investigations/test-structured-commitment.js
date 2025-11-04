#!/usr/bin/env node

import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { MintCommitment } from '@unicitylabs/state-transition-sdk/lib/transaction/MintCommitment.js';
import { MintTransactionData } from '@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionData.js';
import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';
import { TokenType } from '@unicitylabs/state-transition-sdk/lib/token/TokenType.js';
import { TokenCoinData } from '@unicitylabs/state-transition-sdk/lib/token/fungible/TokenCoinData.js';
import { UnmaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/UnmaskedPredicate.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { createHash } from 'crypto';

const endpoint = 'http://localhost:3000';

async function testStructuredCommitment() {
  try {
    console.log('=== TESTING PROPERLY STRUCTURED COMMITMENT ===');
    console.log('This test creates a MintTransactionData structure just like the working mint does\n');

    const client = new StateTransitionClient(new AggregatorClient(endpoint));

    // Create a simple test token
    const testData = `test_${Date.now()}`;
    const tokenIdHash = createHash('sha256').update(testData).digest();
    const tokenId = new TokenId(tokenIdHash);
    console.log(`Token ID: ${tokenId.toJSON()}`);

    // Create token type (using type 1 for testing)
    const tokenType = new TokenType(new Uint8Array([0, 0, 0, 1]));
    console.log(`Token Type: ${tokenType.toJSON()}`);

    // Create token data
    const tokenData = new TextEncoder().encode(JSON.stringify({
      name: 'Test Token',
      description: 'Testing structured commitment'
    }));

    // Create empty coin data
    const coinData = TokenCoinData.create([]);

    // Generate random salt
    const salt = crypto.getRandomValues(new Uint8Array(32));

    // Create a simple signing service for the recipient
    const recipientSecret = new TextEncoder().encode('recipient_secret');
    const signingService = await SigningService.createFromSecret(recipientSecret);

    // Create predicate for recipient
    const predicate = await UnmaskedPredicate.create(
      tokenId,
      tokenType,
      signingService,
      HashAlgorithm.SHA256,
      salt
    );

    // Get recipient address
    const predicateRef = await predicate.getReference();
    const recipientAddress = await predicateRef.toAddress();
    console.log(`Recipient: ${recipientAddress.address}\n`);

    // Hash the token data
    const dataHash = await new DataHasher(HashAlgorithm.SHA256)
      .update(tokenData)
      .digest();

    // Create PROPERLY STRUCTURED MintTransactionData
    const mintTransactionData = await MintTransactionData.create(
      tokenId,
      tokenType,
      tokenData,
      coinData,
      recipientAddress,
      salt,
      dataHash,
      null // no parent token
    );

    console.log('MintTransactionData created:');
    console.log(`  Token ID: ${mintTransactionData.tokenId.toJSON()}`);
    console.log(`  Token Type: ${mintTransactionData.tokenType.toJSON()}`);
    console.log(`  Recipient: ${mintTransactionData.recipient.address}`);
    console.log('');

    // Create MintCommitment (this handles RequestId and Authenticator creation)
    const commitment = await MintCommitment.create(mintTransactionData);

    console.log('MintCommitment created:');
    console.log(`  Request ID: ${commitment.requestId.toJSON()}`);
    console.log(`  Transaction Hash: ${(await mintTransactionData.calculateHash()).toJSON()}`);
    console.log('');

    // Submit using StateTransitionClient (like the working mint does)
    console.log('Submitting structured commitment...');
    const submitResponse = await client.submitMintCommitment(commitment);
    console.log('Submit Response:', JSON.stringify(submitResponse, null, 2));
    console.log('');

    // Poll for inclusion
    console.log('Polling for inclusion proof (10 attempts, 1s delay)...');
    for (let attempt = 1; attempt <= 10; attempt++) {
      console.log(`\nAttempt ${attempt}/10:`);

      const aggregatorClient = new AggregatorClient(endpoint);
      const response = await aggregatorClient.getInclusionProof(commitment.requestId);

      if (response && response.inclusionProof) {
        const proof = response.inclusionProof;
        const isIncluded = proof.authenticator !== null && proof.transactionHash !== null;

        if (isIncluded) {
          console.log('✅ INCLUSION PROOF FOUND!');
          console.log('  ★★★ SUCCESS! Properly structured commitments ARE persisted! ★★★');
          console.log('  Authenticator:', proof.authenticator ? 'present' : 'null');
          console.log('  Transaction Hash:', proof.transactionHash);
          console.log('');
          console.log('CONCLUSION:');
          console.log('  The aggregator requires structured MintTransactionData, not just string hashes!');
          return;
        } else {
          console.log('  Status: EXCLUSION (not yet included)');
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n❌ Commitment was not included');
    console.log('Even with proper structure, something else might be wrong');

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testStructuredCommitment().catch(console.error);
