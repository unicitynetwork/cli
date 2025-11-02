/**
 * Test to check what predicate.encode() actually returns
 */

import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { UnmaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/UnmaskedPredicate.js';
import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';
import { TokenType } from '@unicitylabs/state-transition-sdk/lib/token/TokenType.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import crypto from 'crypto';

async function main() {
  console.log('Testing predicate encoding...\n');

  // Create signing service
  const secret = new TextEncoder().encode('secret1');
  const signingService = await SigningService.createFromSecret(secret);
  console.log('Public Key:', HexConverter.encode(signingService.publicKey));

  // Create token parameters
  const tokenId = new TokenId(crypto.randomBytes(32));
  const tokenType = new TokenType(new Uint8Array(32)); // NFT
  const salt = crypto.randomBytes(32);

  console.log('\nToken ID:', tokenId.toJSON());
  console.log('Salt:', HexConverter.encode(salt));

  // Create predicate
  console.log('\nCreating UnmaskedPredicate...');
  const predicate = await UnmaskedPredicate.create(
    tokenId,
    tokenType,
    signingService,
    HashAlgorithm.SHA256,
    salt
  );

  // Test encode()
  console.log('\nTesting predicate.encode():');
  const encoded = predicate.encode();
  console.log('  Length:', encoded.length, 'bytes');
  console.log('  Hex:', HexConverter.encode(encoded));
  console.log('  First 50 chars:', HexConverter.encode(encoded).substring(0, 50));

  // Test encodeParameters()
  console.log('\nTesting predicate.encodeParameters():');
  const encodedParams = predicate.encodeParameters();
  console.log('  Length:', encodedParams.length, 'bytes');
  console.log('  Hex:', HexConverter.encode(encodedParams));
  console.log('  First 50 chars:', HexConverter.encode(encodedParams).substring(0, 50));

  // Get address
  const predicateRef = await predicate.getReference();
  const address = await predicateRef.toAddress();
  console.log('\nDerived Address:', address.address);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
