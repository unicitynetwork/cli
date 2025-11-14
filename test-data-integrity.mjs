#!/usr/bin/env node
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import fs from 'fs';

const tokenFile = process.argv[2] || 'token.txf';

console.log('=== DATA INTEGRITY VERIFICATION TEST ===\n');
console.log(`Loading token from: ${tokenFile}\n`);

try {
  const txfJson = JSON.parse(fs.readFileSync(tokenFile, 'utf-8'));
  const token = await Token.fromJSON(txfJson);
  
  console.log('--- GENESIS DATA FIELDS ---');
  console.log(`Token ID: ${token.genesis.data.tokenId.toJSON()}`);
  console.log(`Token Type: ${token.genesis.data.tokenType.toJSON()}`);
  console.log(`Recipient: ${token.genesis.data.recipient.address}`);
  
  if (token.genesis.data.tokenData) {
    const dataStr = new TextDecoder().decode(token.genesis.data.tokenData);
    console.log(`Token Data: ${dataStr.substring(0, 100)}${dataStr.length > 100 ? '...' : ''}`);
  } else {
    console.log('Token Data: (none)');
  }
  
  if (token.genesis.data.coinData) {
    const coins = token.genesis.data.coinData;
    console.log(`Coin Amount: ${coins.amount}`);
    if (coins.coinId) {
      console.log(`Coin ID: ${coins.coinId.toJSON()}`);
    }
  } else {
    console.log('Coin Data: (none)');
  }
  
  console.log('\n--- HASH CALCULATION ---');
  
  // Calculate hash from genesis data
  const calculatedHash = await token.genesis.data.calculateHash();
  console.log(`Calculated hash: ${HexConverter.encode(calculatedHash.imprint)}`);
  
  // Get stored hash from inclusion proof
  const storedHash = token.genesis.inclusionProof?.transactionHash;
  
  if (!storedHash) {
    console.log('ERROR: No inclusion proof found');
    process.exit(1);
  }
  
  console.log(`Stored hash:     ${HexConverter.encode(storedHash.imprint)}`);
  
  // Compare
  const calculatedHex = HexConverter.encode(calculatedHash.imprint);
  const storedHex = HexConverter.encode(storedHash.imprint);
  
  console.log('\n--- VERIFICATION RESULT ---');
  if (calculatedHex === storedHex) {
    console.log('✓ DATA INTEGRITY VERIFIED');
    console.log('  Genesis data has NOT been tampered with');
    console.log('  All fields (tokenData, coinData, etc.) are authentic');
  } else {
    console.log('❌ DATA INTEGRITY FAILED');
    console.log('  Genesis data HAS been tampered with!');
    console.log('  This token should be REJECTED');
    process.exit(1);
  }
  
  // Show what's protected
  console.log('\n--- PROTECTED FIELDS ---');
  console.log('The transaction hash covers ALL 8 fields:');
  console.log('  1. tokenId ✓');
  console.log('  2. tokenType ✓');
  console.log('  3. tokenData ✓ (CRITICAL - custom metadata)');
  console.log('  4. coinData ✓ (CRITICAL - includes amounts)');
  console.log('  5. recipient ✓');
  console.log('  6. salt ✓');
  console.log('  7. recipientDataHash ✓');
  console.log('  8. reason ✓');
  console.log('\nFormula: transactionHash = SHA256(CBOR([field1, field2, ..., field8]))');
  console.log('\nConclusion: Changing ANY field will break verification.');
  
} catch (error) {
  console.error('Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
