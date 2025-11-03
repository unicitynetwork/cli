#!/usr/bin/env node

import { UnicityCertificate } from '@unicitylabs/state-transition-sdk/lib/bft/UnicityCertificate.js';

const certHex = "d903ef8701d903f08a01190c96005822000079ad4460652d6b93ca4c04908c7f972f550d76d97db838e3d36683e3982b418458220000b39e733ea52e709ba6cd1736c3c2a6f81588b3a8b1d9309695c99b305dcd4981401a6908e28c58220000b39e733ea52e709ba6cd1736c3c2a6f81588b3a8b1d9309695c99b305dcd498100f65820a722fd9f8526663c82ef2a9a3aba5a0026af910ea2b42bd6450365fb86c87b825820ff9003d825203f33a3df4b223f588abdc9d2596935e8760acee0cb6029ce0d4982418080d903f683010780d903e9880103194ba0001a6908e28f5820c290b556995280833ed9f9dcea31556569e3335f3bd3df7e99a673b9a96aa36b5820690e467dbd661828226fb179e87e96dc9b809830c384a4f55baaeae8eb066c16a1783531365569753248416d3659697a4e69345855715563434633616f45565a61537a503358537247654b413162383933524c74434c667558413dfda72d271551d360fd496a752880a26a7f06fbd5e0162b1201c7eae1dd7f6d241d5894870172f5b6f95922823c8d655920d3023a0798200f82584bcc2cdc8000";

console.log('='.repeat(80));
console.log('UNICITY CERTIFICATE ANALYSIS');
console.log('='.repeat(80));
console.log();

// Decode the hex to bytes
const certBytes = new Uint8Array(certHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

// Create UnicityCertificate from bytes
const cert = UnicityCertificate.fromCBOR(certBytes);

console.log('CERTIFICATE DETAILS:');
console.log('-'.repeat(80));
console.log('Network ID:', cert.unicitySeal?.networkId);
console.log('Epoch:', cert.unicitySeal?.epoch);
console.log('Round:', cert.unicitySeal?.round);
console.log('Block Hash:', cert.unicitySeal?.blockHash?.toString('hex'));
console.log('State Hash:', cert.unicitySeal?.stateHash?.toString('hex'));
console.log('Root Hash:', cert.unicitySeal?.rootHash?.toString('hex'));
console.log('Previous Block Hash:', cert.unicitySeal?.previousBlockHash?.toString('hex'));
console.log('Timestamp:', cert.unicitySeal?.timestamp);
console.log();

console.log('SIGNATURES (Validators):');
console.log('-'.repeat(80));
const signatures = cert.unicitySeal?.signatures;
if (signatures) {
  console.log('Type:', signatures.constructor.name);
  console.log('Size:', signatures.size);
  console.log();

  let idx = 0;
  for (const [nodeId, signature] of signatures.entries()) {
    console.log(`[${idx}] Node ID: ${nodeId}`);
    console.log(`    Signature: ${signature.toString('hex')}`);
    console.log();
    idx++;
  }
}

console.log('='.repeat(80));
console.log('INPUT RECORD (if exists):');
console.log('-'.repeat(80));
const inputRecord = cert.inputRecord;
if (inputRecord) {
  console.log('Hash:', inputRecord.hash?.toString('hex'));
  console.log('Previous Hash:', inputRecord.previousHash?.toString('hex'));
  console.log('Block Hash:', inputRecord.blockHash?.toString('hex'));
  console.log('Summary Value:', inputRecord.summaryValue?.toString('hex'));
  console.log('Round Number:', inputRecord.roundNumber);
} else {
  console.log('No input record');
}
console.log();

console.log('='.repeat(80));
console.log('CURRENT TRUSTBASE COMPARISON:');
console.log('='.repeat(80));
console.log();
console.log('Expected node in trustBase:');
console.log('  Node ID: 16Uiu2HAkv5hkDFUT3cFVMTCetJJnoC5HWbCd2CxG44uMWVXNdbzb');
console.log('  Public Key: 03384d4d4ad517fb94634910e0c88cb4551a483017c03256de4310afa4b155dfad');
console.log();

if (signatures && signatures.size > 0) {
  const certNodeIds = Array.from(signatures.keys());
  const trustBaseNodeId = '16Uiu2HAkv5hkDFUT3cFVMTCetJJnoC5HWbCd2CxG44uMWVXNdbzb';

  console.log('Certificate has node IDs:', certNodeIds);
  console.log('TrustBase expects:', [trustBaseNodeId]);
  console.log();

  const match = certNodeIds.includes(trustBaseNodeId);
  console.log('NODE ID MATCH:', match ? '✓ YES' : '✗ NO');

  if (!match) {
    console.log();
    console.log('*** MISMATCH DETECTED ***');
    console.log('The certificate was signed by a different validator than what the trustBase expects!');
    console.log('This is why proof.verify() returns NOT_AUTHENTICATED.');
  }
}

console.log();
console.log('='.repeat(80));
console.log('AGGREGATOR INFO NEEDED:');
console.log('='.repeat(80));
console.log('To fix this, we need to query http://127.0.0.1:3000 to get:');
console.log('  1. The actual validator node ID');
console.log('  2. The validator public key');
console.log('  3. Network ID');
console.log('  4. Epoch/round information');
console.log();
