#!/usr/bin/env node

import { UnicityCertificate } from '@unicitylabs/state-transition-sdk/lib/bft/UnicityCertificate.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';

const certHex = "d903ef8701d903f08a01190c96005822000079ad4460652d6b93ca4c04908c7f972f550d76d97db838e3d36683e3982b418458220000b39e733ea52e709ba6cd1736c3c2a6f81588b3a8b1d9309695c99b305dcd4981401a6908e28c58220000b39e733ea52e709ba6cd1736c3c2a6f81588b3a8b1d9309695c99b305dcd498100f65820a722fd9f8526663c82ef2a9a3aba5a0026af910ea2b42bd6450365fb86c87b825820ff9003d825203f33a3df4b223f588abdc9d2596935e8760acee0cb6029ce0d4982418080d903f683010780d903e9880103194ba0001a6908e28f5820c290b556995280833ed9f9dcea31556569e3335f3bd3df7e99a673b9a96aa36b5820690e467dbd661828226fb179e87e96dc9b809830c384a4f55baaeae8eb066c16a1783531365569753248416d3659697a4e69345855715563434633616f45565a61537a503358537247654b413162383933524c74434c667558413dfda72d271551d360fd496a752880a26a7f06fbd5e0162b1201c7eae1dd7f6d241d5894870172f5b6f95922823c8d655920d3023a0798200f82584bcc2cdc8000";

console.log('='.repeat(80));
console.log('EXTRACTING VALIDATOR PUBLIC KEY FROM CERTIFICATE SIGNATURE');
console.log('='.repeat(80));
console.log();

// Decode certificate
const certBytes = new Uint8Array(certHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
const cert = UnicityCertificate.fromCBOR(certBytes);

const signatures = cert.unicitySeal?.signatures;
if (!signatures || signatures.size === 0) {
  console.log('No signatures found in certificate');
  process.exit(1);
}

// Get the first (and only) signature
const [nodeId, signatureBytes] = Array.from(signatures.entries())[0];

console.log('Certificate Validator Info:');
console.log('-'.repeat(80));
console.log('Node ID:', nodeId);
console.log('Signature (hex):', signatureBytes.toString('hex'));
console.log('Signature length:', signatureBytes.length, 'bytes');
console.log();

// The signature should be 65 bytes for secp256k1 (64 byte signature + 1 byte recovery ID)
// Let's try to recover the public key from the signature
const unicitySeal = cert.unicitySeal;
const DataHasher = (await import('@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js')).DataHasher;
const HashAlgorithm = (await import('@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js')).HashAlgorithm;

// Hash the unicity seal without signatures (this is what was signed)
const hash = await new DataHasher(HashAlgorithm.SHA256).update(unicitySeal.withoutSignatures().toCBOR()).digest();
console.log('Unicity Seal Hash (signed data):', hash.toString('hex'));
console.log();

// Try to recover public key from signature
try {
  const { secp256k1 } = await import('@noble/curves/secp256k1');

  // Signature is 65 bytes: 64 bytes signature + 1 byte recovery ID
  const sig = signatureBytes.slice(0, 64);
  const recoveryId = signatureBytes[64];

  console.log('Recovery ID:', recoveryId);
  console.log();

  // Recover public key using noble/curves
  // Convert DataHash to Uint8Array
  const hashBytes = hash instanceof Uint8Array ? hash : new Uint8Array(hash.bytes);
  const publicKey = secp256k1.Signature.fromCompact(sig).recoverPublicKey(hashBytes);
  const publicKeyBytes = publicKey.toRawBytes(false); // uncompressed
  const publicKeyHex = Buffer.from(publicKeyBytes).toString('hex');

  console.log('Recovered Public Key (uncompressed):', publicKeyHex);

  // Get compressed version
  const compressedBytes = publicKey.toRawBytes(true);
  const compressedHex = Buffer.from(compressedBytes).toString('hex');

  console.log('Recovered Public Key (compressed):', compressedHex);
  console.log();

  console.log('='.repeat(80));
  console.log('CORRECTED TRUSTBASE CONFIGURATION:');
  console.log('='.repeat(80));
  console.log();

  const correctedTrustBase = {
    version: '1',
    networkId: 3,  // From certificate
    epoch: '0',     // From certificate (was 0n)
    epochStartRound: '1',
    rootNodes: [
      {
        nodeId: nodeId,
        sigKey: compressedHex,
        stake: '1'
      }
    ],
    quorumThreshold: '1',
    stateHash: '0000000000000000000000000000000000000000000000000000000000000000',
    changeRecordHash: null,
    previousEntryHash: null,
    signatures: {}
  };

  console.log('const trustBase = RootTrustBase.fromJSON(');
  console.log(JSON.stringify(correctedTrustBase, null, 2));
  console.log(');');
  console.log();

} catch (error) {
  console.error('Error recovering public key:', error.message);
}
