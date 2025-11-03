#!/usr/bin/env ts-node
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import { InclusionProof } from '@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { readFileSync } from 'fs';

console.log('='.repeat(80));
console.log('TESTING DIFFERENT TRUSTBASE CONFIGURATIONS');
console.log('='.repeat(80));
console.log();

// Read the token file
const tokenData = JSON.parse(readFileSync('/home/vrogojin/cli/20251103_181248_1762189968725_0000d1b185.txf', 'utf8'));

// Create InclusionProof from the token
const proof = InclusionProof.fromJSON(tokenData.genesis.inclusionProof);
const requestIdHex = tokenData.genesis.inclusionProof.merkleTreePath.steps[0].data;
const requestId = RequestId.fromJSON(requestIdHex);

console.log('Request ID:', requestId.toString());
console.log();

// Test 1: Original trustBase (should FAIL)
console.log('TEST 1: Original TrustBase');
console.log('-'.repeat(80));
const originalTrustBase = RootTrustBase.fromJSON({
  version: '1',
  networkId: 1,
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
});

try {
  const result1 = await proof.verify(originalTrustBase, requestId);
  console.log('Result:', result1);
} catch (error) {
  console.log('Error:', error.message);
}
console.log();

// Test 2: Corrected networkId only (should still FAIL because node ID is wrong)
console.log('TEST 2: Corrected NetworkId (3) but wrong node ID');
console.log('-'.repeat(80));
const trustBase2 = RootTrustBase.fromJSON({
  version: '1',
  networkId: 3,
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
});

try {
  const result2 = await proof.verify(trustBase2, requestId);
  console.log('Result:', result2);
} catch (error) {
  console.log('Error:', error.message);
}
console.log();

// Test 3: Correct node ID but need public key - we'll try with a placeholder first
console.log('TEST 3: Correct Node ID (from certificate) but placeholder public key');
console.log('-'.repeat(80));
const trustBase3 = RootTrustBase.fromJSON({
  version: '1',
  networkId: 3,
  epoch: '0',
  epochStartRound: '1',
  rootNodes: [
    {
      nodeId: '16Uiu2HAm6YizNi4XUqUcCF3aoEVZaSzP3XSrGeKA1b893RLtCLfu',
      sigKey: '03384d4d4ad517fb94634910e0c88cb4551a483017c03256de4310afa4b155dfad', // Placeholder
      stake: '1'
    }
  ],
  quorumThreshold: '1',
  stateHash: '0000000000000000000000000000000000000000000000000000000000000000',
  changeRecordHash: null,
  previousEntryHash: null,
  signatures: {}
});

try {
  const result3 = await proof.verify(trustBase3, requestId);
  console.log('Result:', result3);
} catch (error) {
  console.log('Error:', error.message);
}
console.log();

console.log('='.repeat(80));
console.log('The correct public key is needed to make this work.');
console.log('We need to get it from the aggregator configuration or logs.');
console.log('='.repeat(80));
