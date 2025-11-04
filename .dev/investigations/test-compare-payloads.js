#!/usr/bin/env node

import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { Authenticator } from '@unicitylabs/state-transition-sdk/lib/api/Authenticator.js';
import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';
import { MintTransactionState } from '@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionState.js';
import { SubmitCommitmentRequest } from '@unicitylabs/state-transition-sdk/lib/api/SubmitCommitmentRequest.js';

async function comparePayloads() {
  console.log('=== COMPARING PAYLOADS ===\n');

  const secret = 'test123';
  const state = 'state1';
  const transition = 'transition1';

  // Create signing service
  const secretBytes = new TextEncoder().encode(secret);
  const signingService = await SigningService.createFromSecret(secretBytes);

  console.log('Common values:');
  console.log(`  Public Key: ${Buffer.from(signingService.publicKey).toString('hex')}`);
  console.log('');

  // ===== OUR APPROACH (Manual) =====
  console.log('===== MANUAL APPROACH =====');

  // Hash state
  const stateHasher = new DataHasher(HashAlgorithm.SHA256);
  const stateHash = await stateHasher.update(new TextEncoder().encode(state)).digest();
  console.log(`  State Hash: ${stateHash.toJSON()}`);

  // Hash transition
  const transitionHasher = new DataHasher(HashAlgorithm.SHA256);
  const transactionHash = await transitionHasher.update(new TextEncoder().encode(transition)).digest();
  console.log(`  Transaction Hash: ${transactionHash.toJSON()}`);

  // Create RequestId
  const manualRequestId = await RequestId.create(signingService.publicKey, stateHash);
  console.log(`  Request ID: ${manualRequestId.toJSON()}`);

  // Create Authenticator
  const manualAuthenticator = await Authenticator.create(signingService, transactionHash, stateHash);

  // Create the request
  const manualRequest = new SubmitCommitmentRequest(manualRequestId, transactionHash, manualAuthenticator, false);
  const manualPayload = manualRequest.toJSON();

  console.log('\n  Manual Payload:');
  console.log(JSON.stringify(manualPayload, null, 2));
  console.log('');

  // ===== MINT APPROACH =====
  console.log('===== MINT APPROACH =====');

  // Create TokenId from state hash (32 bytes)
  const tokenId = new TokenId(stateHash.data);
  console.log(`  Token ID: ${tokenId.toJSON()}`);

  // Create MintTransactionState
  const mintState = await MintTransactionState.create(tokenId);
  console.log(`  Mint State: ${mintState.toJSON()}`);

  // Create RequestId with MintTransactionState
  const mintRequestId = await RequestId.create(signingService.publicKey, mintState);
  console.log(`  Request ID: ${mintRequestId.toJSON()}`);

  // Create Authenticator with MintTransactionState
  const mintAuthenticator = await Authenticator.create(signingService, transactionHash, mintState);

  // Create the request
  const mintRequest = new SubmitCommitmentRequest(mintRequestId, transactionHash, mintAuthenticator, false);
  const mintPayload = mintRequest.toJSON();

  console.log('\n  Mint Payload:');
  console.log(JSON.stringify(mintPayload, null, 2));
  console.log('');

  // ===== DIFFERENCES =====
  console.log('===== KEY DIFFERENCES =====');
  console.log(`  Manual Request ID: ${manualRequestId.toJSON()}`);
  console.log(`  Mint Request ID:   ${mintRequestId.toJSON()}`);
  console.log(`  Same? ${manualRequestId.toJSON() === mintRequestId.toJSON()}`);
  console.log('');
  console.log(`  Manual State Hash: ${stateHash.toJSON()}`);
  console.log(`  Mint State Hash:   ${mintState.toJSON()}`);
  console.log(`  Same? ${stateHash.toJSON() === mintState.toJSON()}`);
  console.log('');

  // Show what MintTransactionState actually does
  console.log('===== WHAT MINT STATE DOES =====');
  console.log(`  Input: TokenId = ${tokenId.toJSON()}`);
  console.log(`  MINT_SUFFIX = 9e82002c144d7c5796c50f6db50a0c7bbd7f717ae3af6c6c71a3e9eba3022730`);
  console.log(`  MintState = hash(TokenId + MINT_SUFFIX)`);
  console.log(`  Result: ${mintState.toJSON()}`);
}

comparePayloads().catch(console.error);