/**
 * Test script to investigate if we can derive a predicate from an address
 *
 * This explores whether we can mint to an external address without having
 * the recipient's private key/signing service.
 */

import { AddressFactory } from '@unicitylabs/state-transition-sdk/lib/address/AddressFactory.js';
import { DirectAddress } from '@unicitylabs/state-transition-sdk/lib/address/DirectAddress.js';

async function main() {
  console.log('=== Testing Address to Predicate Derivation ===\n');

  // Use the address from our recent mint test
  const testAddress = 'DIRECT://00001416858a469ab52f5c96b7b31bdf04f7dfc787a4064098a040ba1fc5346a3ba1266650c8';

  console.log('1. Parse address using AddressFactory');
  console.log(`   Input: ${testAddress}\n`);

  const address = await AddressFactory.createAddress(testAddress);
  console.log('   Parsed address object:', address);
  console.log('   - scheme:', address.scheme);
  console.log('   - address string:', address.address);
  console.log('   - Type:', address.constructor.name);
  console.log();

  // Check if DirectAddress has any methods to extract predicate info
  if (address instanceof DirectAddress) {
    console.log('2. Address is a DirectAddress instance');
    console.log('   Available properties and methods:');
    console.log('   - Properties:', Object.getOwnPropertyNames(address));
    console.log('   - Prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(address)));
    console.log();

    // Try to access internal data (even though it's private)
    console.log('3. Attempt to inspect internal structure:');
    console.log(JSON.stringify(address, null, 2));
    console.log();
  }

  console.log('4. Can we create UnmaskedPredicateReference from public info?');
  console.log('   UnmaskedPredicateReference.create() requires:');
  console.log('   - tokenType: TokenType');
  console.log('   - signingAlgorithm: string');
  console.log('   - publicKey: Uint8Array');
  console.log('   - hashAlgorithm: HashAlgorithm');
  console.log();
  console.log('   Problem: We do NOT have the public key from just the address!');
  console.log('   The address contains a HASH of the predicate reference, not the key itself.');
  console.log();

  console.log('5. Can we create UnmaskedPredicate without private key?');
  console.log('   UnmaskedPredicate.create() requires:');
  console.log('   - tokenId: TokenId');
  console.log('   - tokenType: TokenType');
  console.log('   - signingService: SigningService (requires private key!)');
  console.log('   - hashAlgorithm: HashAlgorithm');
  console.log('   - salt: Uint8Array');
  console.log();
  console.log('   Problem: SigningService REQUIRES the private key!');
  console.log();

  console.log('6. Alternative: UnmaskedPredicate.fromCBOR()');
  console.log('   This could reconstruct a predicate from serialized CBOR bytes.');
  console.log('   But we would need the recipient to provide their predicate CBOR,');
  console.log('   which defeats the purpose of just knowing their address.');
  console.log();

  console.log('=== CONCLUSION ===');
  console.log('❌ Cannot create a predicate from just an address string');
  console.log('❌ Address contains hash(predicate reference), not the actual key');
  console.log('❌ Creating UnmaskedPredicate requires the private key (SigningService)');
  console.log();
  console.log('📋 The address scheme works like this:');
  console.log('   Private Key → Public Key → Predicate → Predicate Ref → Hash → Address');
  console.log('   This is a ONE-WAY process - cannot reverse it!');
  console.log();
  console.log('💡 IMPLICATIONS:');
  console.log('   1. To mint to external address: Cannot use Token.mint() properly');
  console.log('   2. Recipient needs predicate to unlock the token');
  console.log('   3. Two possible approaches:');
  console.log('      a) Mint to self-controlled masked address, then transfer');
  console.log('      b) Save mint commitment as "mint receipt", recipient claims it');
  console.log();
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
