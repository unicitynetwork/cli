#!/usr/bin/env node
import { CborDecoder } from '@unicitylabs/commons/lib/cbor/CborDecoder.js';
import { UnicityCertificate } from '@unicitylabs/commons/lib/api/UnicityCertificate.js';
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';

const certHex = "d903ef8701d903f08a01190c96005822000079ad4460652d6b93ca4c04908c7f972f550d76d97db838e3d36683e3982b418458220000b39e733ea52e709ba6cd1736c3c2a6f81588b3a8b1d9309695c99b305dcd4981401a6908e28c58220000b39e733ea52e709ba6cd1736c3c2a6f81588b3a8b1d9309695c99b305dcd498100f65820a722fd9f8526663c82ef2a9a3aba5a0026af910ea2b42bd6450365fb86c87b825820ff9003d825203f33a3df4b223f588abdc9d2596935e8760acee0cb6029ce0d4982418080d903f683010780d903e9880103194ba0001a6908e28f5820c290b556995280833ed9f9dcea31556569e3335f3bd3df7e99a673b9a96aa36b5820690e467dbd661828226fb179e87e96dc9b809830c384a4f55baaeae8eb066c16a1783531365569753248416d3659697a4e69345855715563434633616f45565a61537a503358537247654b413162383933524c74434c667558413dfda72d271551d360fd496a752880a26a7f06fbd5e0162b1201c7eae1dd7f6d241d5894870172f5b6f95922823c8d655920d3023a0798200f82584bcc2cdc8000";

console.log('='.repeat(80));
console.log('DECODING UNICITY CERTIFICATE');
console.log('='.repeat(80));
console.log();

// Decode the hex to bytes
const certBytes = new Uint8Array(certHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
console.log(`Certificate hex length: ${certHex.length} chars (${certBytes.length} bytes)`);
console.log();

// Decode CBOR
const decoder = new CborDecoder(certBytes);
const certData = decoder.popNext();

console.log('Raw CBOR decoded structure:');
console.log(JSON.stringify(certData, null, 2));
console.log();
console.log('='.repeat(80));

// Create UnicityCertificate from bytes
const cert = UnicityCertificate.fromCbor(certBytes);

console.log('PARSED UNICITY CERTIFICATE:');
console.log('='.repeat(80));
console.log();

// Access certificate properties
console.log('Network ID:', cert.unicitySeal?.networkId);
console.log('Epoch:', cert.unicitySeal?.epoch);
console.log('Round:', cert.unicitySeal?.round);
console.log('Block Hash:', cert.unicitySeal?.blockHash?.toString('hex'));
console.log('Previous Block Hash:', cert.unicitySeal?.previousBlockHash?.toString('hex'));
console.log('State Hash:', cert.unicitySeal?.stateHash?.toString('hex'));
console.log('Root Hash:', cert.unicitySeal?.rootHash?.toString('hex'));
console.log('Timestamp:', cert.unicitySeal?.timestamp);
console.log();

console.log('Validators in certificate:');
const signatures = cert.unicitySeal?.signatures;
if (signatures) {
  if (Array.isArray(signatures)) {
    console.log(`  Found ${signatures.length} signatures (array format)`);
    signatures.forEach((sig: any, idx: number) => {
      console.log(`  [${idx}]:`, sig);
    });
  } else if (typeof signatures === 'object') {
    console.log(`  Found ${Object.keys(signatures).length} signatures (object format)`);
    Object.entries(signatures).forEach(([nodeId, sig]) => {
      console.log(`  Node ID: ${nodeId}`);
      console.log(`    Signature: ${sig}`);
    });
  }
}
console.log();

console.log('='.repeat(80));
console.log('CURRENT TRUSTBASE CONFIGURATION');
console.log('='.repeat(80));
console.log();

const currentTrustBase = {
  version: '1',
  networkId: 1, // Changed from 3 to 1 based on endpoint check
  epoch: '1',
  epochStartRound: '1',
  rootNodes: [
    {
      nodeId: '16Uiu2HAkv5hkDFUT3cFVMTCetJJnoC5HWbCd2CxG44uMWVXNdbzb',
      sigKey: '03384d4d4ad517fb94634910e0c88cb4551a483017c03256de4310afa4b155dfad',
      stake: '1'
    }
  ],
  quorumThreshold: '1',
  stateHash: '0000000000000000000000000000000000000000000000000000000000000000',
  changeRecordHash: null,
  previousEntryHash: null,
  signatures: {
    '16Uiu2HAkv5hkDFUT3cFVMTCetJJnoC5HWbCd2CxG44uMWVXNdbzb': '843bc1fd04f31a6eee7c584de67c6985fd6021e912622aacaa7278a56a10ec7e42911d6a5c53604c60849a61911f1dc6276a642a7df7c4d57cac8d893694a17601'
  }
};

console.log('Current TrustBase:');
console.log(JSON.stringify(currentTrustBase, null, 2));
console.log();

console.log('='.repeat(80));
console.log('COMPARISON: CERTIFICATE vs TRUSTBASE');
console.log('='.repeat(80));
console.log();

const certNetworkId = cert.unicitySeal?.networkId;
const certEpoch = cert.unicitySeal?.epoch;
const certRound = cert.unicitySeal?.round;

console.log('Network ID:');
console.log(`  Certificate: ${certNetworkId}`);
console.log(`  TrustBase:   ${currentTrustBase.networkId}`);
console.log(`  ✓ Match:     ${certNetworkId === currentTrustBase.networkId}`);
console.log();

console.log('Epoch:');
console.log(`  Certificate: ${certEpoch}`);
console.log(`  TrustBase:   ${currentTrustBase.epoch}`);
console.log(`  ✓ Match:     ${certEpoch?.toString() === currentTrustBase.epoch}`);
console.log();

console.log('Round:');
console.log(`  Certificate: ${certRound}`);
console.log(`  TrustBase:   ${currentTrustBase.epochStartRound}`);
console.log();

console.log('State Hash:');
console.log(`  Certificate: ${cert.unicitySeal?.stateHash?.toString('hex')}`);
console.log(`  TrustBase:   ${currentTrustBase.stateHash}`);
console.log();

// Extract validator info from certificate if available
console.log('Validator signatures comparison:');
console.log(`  Certificate has signatures: ${signatures ? 'YES' : 'NO'}`);
console.log(`  TrustBase has 1 root node: 16Uiu2HAkv5hkDFUT3cFVMTCetJJnoC5HWbCd2CxG44uMWVXNdbzb`);
console.log();
