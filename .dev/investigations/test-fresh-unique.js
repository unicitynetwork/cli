#!/usr/bin/env node

import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { MintCommitment } from '@unicitylabs/state-transition-sdk/lib/transaction/MintCommitment.js';
import { MintTransactionData } from '@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionData.js';
import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';
import { TokenType } from '@unicitylabs/state-transition-sdk/lib/token/TokenType.js';
import { TokenCoinData } from '@unicitylabs/state-transition-sdk/lib/token/fungible/TokenCoinData.js';
import { UnmaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/UnmaskedPredicate.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { createHash } from 'crypto';

const endpoint = 'http://localhost:3000';

async function testFreshUnique() {
  try {
    // Use TRULY UNIQUE data - timestamp + random
    const uniqueId = `FRESH_${Date.now()}_${Math.random().toString(36)}`;
    console.log('=== TESTING WITH FRESH UNIQUE DATA ===');
    console.log(`Unique ID: ${uniqueId}\n`);

    const client = new StateTransitionClient(new AggregatorClient(endpoint));

    // Create unique token ID
    const tokenIdHash = createHash('sha256').update(uniqueId).digest();
    const tokenId = new TokenId(tokenIdHash);
    console.log(`Token ID: ${tokenId.toJSON()}`);

    // Use token type from testnet config (NFT type)
    const nftTypeHex = 'f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509';
    const tokenType = new TokenType(Buffer.from(nftTypeHex, 'hex'));
    console.log(`Token Type: ${tokenType.toJSON()}`);

    // Create token data
    const tokenData = new TextEncoder().encode(JSON.stringify({
      name: `Fresh Test ${uniqueId}`,
      description: 'Testing with completely fresh unique data',
      timestamp: Date.now()
    }));

    // Create empty coin data
    const coinData = TokenCoinData.create([]);

    // Generate NEW random salt (truly unique)
    const salt = crypto.getRandomValues(new Uint8Array(32));

    // Create NEW signing service with unique secret
    const uniqueSecret = new TextEncoder().encode(`secret_${uniqueId}`);
    const signingService = await SigningService.createFromSecret(uniqueSecret);
    console.log(`Public Key: ${Buffer.from(signingService.publicKey).toString('hex')}`);

    // Create predicate
    const predicate = await UnmaskedPredicate.create(
      tokenId,
      tokenType,
      signingService,
      HashAlgorithm.SHA256,
      salt
    );

    const predicateRef = await predicate.getReference();
    const recipientAddress = await predicateRef.toAddress();
    console.log(`Recipient: ${recipientAddress.address}\n`);

    // Hash token data
    const dataHash = await new DataHasher(HashAlgorithm.SHA256)
      .update(tokenData)
      .digest();

    // Create MintTransactionData
    const mintTransactionData = await MintTransactionData.create(
      tokenId,
      tokenType,
      tokenData,
      coinData,
      recipientAddress,
      salt,
      dataHash,
      null
    );

    // Create MintCommitment
    const commitment = await MintCommitment.create(mintTransactionData);
    console.log(`Request ID: ${commitment.requestId.toJSON()}`);
    console.log(`Transaction Hash: ${(await mintTransactionData.calculateHash()).toJSON()}\n`);

    // Submit
    console.log('Submitting FRESH commitment...');
    const submitResponse = await client.submitMintCommitment(commitment);
    console.log('Submit Response:', JSON.stringify(submitResponse, null, 2));
    console.log('');

    // Wait and check
    console.log('Waiting 5 seconds then checking inclusion...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const aggregatorClient = new AggregatorClient(endpoint);
    const response = await aggregatorClient.getInclusionProof(commitment.requestId);

    if (response && response.inclusionProof) {
      const proof = response.inclusionProof;
      const isIncluded = proof.authenticator !== null && proof.transactionHash !== null;

      if (isIncluded) {
        console.log('✅ SUCCESS! INCLUSION PROOF FOUND!');
        console.log('  Authenticator:', proof.authenticator ? 'present' : 'null');
        console.log('  Transaction Hash:', proof.transactionHash);
      } else {
        console.log('❌ EXCLUSION - Not included');
        console.log('  This means the commitment was not persisted to SMT');
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testFreshUnique().catch(console.error);
