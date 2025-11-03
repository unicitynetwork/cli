#!/usr/bin/env ts-node
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import { InclusionProof } from '@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { readFileSync } from 'fs';

console.log('='.repeat(80));
console.log('DEBUGGING MERKLE PATH VERIFICATION');
console.log('='.repeat(80));
console.log();

// Read the token file
const tokenData = JSON.parse(readFileSync('/home/vrogojin/cli/20251103_181248_1762189968725_0000d1b185.txf', 'utf8'));

console.log('Inclusion Proof Data:');
console.log(JSON.stringify(tokenData.genesis.inclusionProof, null, 2));
console.log();

// Create InclusionProof from the token
const proof = InclusionProof.fromJSON(tokenData.genesis.inclusionProof);

console.log('Merkle Tree Path:');
console.log('  Root:', proof.merkleTreePath.root.toString('hex'));
console.log('  Steps:', proof.merkleTreePath.steps.length);
proof.merkleTreePath.steps.forEach((step, idx) => {
  console.log(`  [${idx}]:`, {
    data: step.data.toString('hex'),
    path: step.path.toString()
  });
});
console.log();

console.log('Certificate Root Hash:');
console.log('  From unicityCertificate:', proof.unicityCertificate.inputRecord?.hash?.toString('hex'));
console.log('  From merkle path:', proof.merkleTreePath.root.toString('hex'));
console.log();

// Check which requestId to use
const requestIdFromStep0 = proof.merkleTreePath.steps[0].data;
const requestIdHex = Buffer.from(requestIdFromStep0).toString('hex');
console.log('Request ID from step[0].data (hex):', requestIdHex);

// Try creating RequestId differently
const requestIdObj = RequestId.fromJSON(requestIdHex);
console.log('RequestId object:', requestIdObj.toString());
console.log('RequestId as BitString:', requestIdObj.toBitString().toString());
console.log('RequestId as BigInt:', requestIdObj.toBitString().toBigInt().toString());
console.log();

// Try verifying just the merkle path
console.log('Verifying merkle path directly...');
try {
  const pathResult = await proof.merkleTreePath.verify(requestIdObj.toBitString().toBigInt());
  console.log('Path verification result:', pathResult);
  console.log('  isPathValid:', pathResult.isPathValid);
  console.log('  isPathIncluded:', pathResult.isPathIncluded);
} catch (error) {
  console.log('Error:', error.message);
}
console.log();

// Check authenticator
console.log('Authenticator verification...');
if (proof.authenticator && proof.transactionHash) {
  const authResult = await proof.authenticator.verify(proof.transactionHash);
  console.log('  Authenticator.verify():', authResult);

  // Check leaf value
  const { LeafValue } = await import('@unicitylabs/state-transition-sdk/lib/api/LeafValue.js');
  const leafValue = await LeafValue.create(proof.authenticator, proof.transactionHash);
  const step0Data = proof.merkleTreePath.steps[0]?.data;

  console.log('  LeafValue:', leafValue.toString('hex'));
  console.log('  Step[0] data:', step0Data?.toString('hex'));
  console.log('  Match:', leafValue.equals(step0Data));
}
