import { MintTransactionData } from '@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionData.js';
import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';
import { TokenType } from '@unicitylabs/state-transition-sdk/lib/token/TokenType.js';
import { TokenCoinData } from '@unicitylabs/state-transition-sdk/lib/token/fungible/TokenCoinData.js';
import { AddressFactory } from '@unicitylabs/state-transition-sdk/lib/address/AddressFactory.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';

(async () => {
  const tokenId = TokenId.create();
  const tokenType = TokenType.fromJSON('0x0001');
  const tokenData = new TextEncoder().encode('test-data');
  const coinData = await TokenCoinData.create(1000n);
  const recipient = await AddressFactory.createAddress('DIRECT://0xabc123def456');
  const salt = crypto.getRandomValues(new Uint8Array(32));
  
  const mintData = await MintTransactionData.create(
    tokenId, tokenType, tokenData, coinData, recipient, salt, null, null
  );
  
  console.log('=== TRANSACTION HASH CALCULATION ===\n');
  console.log('Formula: transactionHash = SHA256(toCBOR())\n');
  console.log('CBOR includes ALL 8 fields:');
  console.log('  1. tokenId');
  console.log('  2. tokenType');
  console.log('  3. tokenData (optional)');
  console.log('  4. coinData (optional)');
  console.log('  5. recipient');
  console.log('  6. salt');
  console.log('  7. recipientDataHash (optional)');
  console.log('  8. reason (optional)\n');
  
  const hash1 = await mintData.calculateHash();
  console.log('Original hash:', hash1.toJSON(), '\n');
  
  // Test changing tokenData
  const mintData2 = await MintTransactionData.create(
    tokenId, tokenType, new TextEncoder().encode('TAMPERED'), coinData, recipient, salt, null, null
  );
  const hash2 = await mintData2.calculateHash();
  console.log('After changing tokenData:', hash2.toJSON());
  console.log('Hashes match?', hash1.toJSON() === hash2.toJSON(), '(NO - data is protected)\n');
  
  // Test changing coinData
  const mintData3 = await MintTransactionData.create(
    tokenId, tokenType, tokenData, await TokenCoinData.create(9999n), recipient, salt, null, null
  );
  const hash3 = await mintData3.calculateHash();
  console.log('After changing coin amount:', hash3.toJSON());
  console.log('Hashes match?', hash1.toJSON() === hash3.toJSON(), '(NO - amounts are protected)');
})();
