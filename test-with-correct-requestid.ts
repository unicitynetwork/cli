#!/usr/bin/env ts-node
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import { InclusionProof } from '@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { readFileSync } from 'fs';

console.log('='.repeat(80));
console.log('TESTING WITH CORRECT TRUSTBASE AND REQUEST ID');
console.log('='.repeat(80));
console.log();

// Read the token file
const tokenData = JSON.parse(readFileSync('/home/vrogojin/cli/20251103_181248_1762189968725_0000d1b185.txf', 'utf8'));

// Create InclusionProof from the token
const proof = InclusionProof.fromJSON(tokenData.genesis.inclusionProof);

// The ACTUAL requestId from when we minted (from console output)
const actualRequestIdHex = '00006cccbbcbf6f3c19825a98d9ffa78a2d638b1c77ef37d25e16b78501a2a21edce';
const requestId = RequestId.fromJSON(actualRequestIdHex);

console.log('Using Request ID from mint output:', actualRequestIdHex);
console.log('RequestId object:', requestId.toString());
console.log();

// Correct TrustBase from aggregator
const correctTrustBase = RootTrustBase.fromJSON({
  version: '1',
  networkId: 3,
  epoch: '1',
  epochStartRound: '1',
  rootNodes: [
    {
      nodeId: '16Uiu2HAm6YizNi4XUqUcCF3aoEVZaSzP3XSrGeKA1b893RLtCLfu',
      sigKey: '02cf6a24725f81b38431f3ddb92ed89a01b06a07f4e15945096c2e11a13916ff6d',
      stake: '1'
    }
  ],
  quorumThreshold: '1',
  stateHash: '0000000000000000000000000000000000000000000000000000000000000000',
  changeRecordHash: null,
  previousEntryHash: null,
  signatures: {
    '16Uiu2HAm6YizNi4XUqUcCF3aoEVZaSzP3XSrGeKA1b893RLtCLfu': 'c6a2603d88ed172ef492f3b55bc6f0651ca7fde037b8651c83c33e8fd4884e5d72ef863fac564a0863e2bdea4ef73a1b2de2abe36485a3fa95d3cda1c51dcc2300'
  }
});

console.log('VERIFICATION RESULT:');
console.log('-'.repeat(80));
try {
  const result = await proof.verify(correctTrustBase, requestId);
  console.log('✓ Result:', result);
  console.log();

  if (result === 'OK') {
    console.log('='.repeat(80));
    console.log('✓✓✓ SUCCESS! ✓✓✓');
    console.log('='.repeat(80));
    console.log();
    console.log('The proof verification PASSED!');
    console.log();
    console.log('ROOT CAUSE IDENTIFIED:');
    console.log('='.repeat(80));
    console.log();
    console.log('The UnicityCertificate validation was failing because:');
    console.log();
    console.log('1. MISMATCH: Wrong Node ID in TrustBase');
    console.log('   - Current:  16Uiu2HAkv5hkDFUT3cFVMTCetJJnoC5HWbCd2CxG44uMWVXNdbzb');
    console.log('   - Required: 16Uiu2HAm6YizNi4XUqUcCF3aoEVZaSzP3XSrGeKA1b893RLtCLfu');
    console.log();
    console.log('2. MISMATCH: Wrong Public Key in TrustBase');
    console.log('   - Current:  03384d4d4ad517fb94634910e0c88cb4551a483017c03256de4310afa4b155dfad');
    console.log('   - Required: 02cf6a24725f81b38431f3ddb92ed89a01b06a07f4e15945096c2e11a13916ff6d');
    console.log();
    console.log('HOW TO FIX:');
    console.log('='.repeat(80));
    console.log('Update /home/vrogojin/cli/src/commands/mint-token.ts lines 351-370');
    console.log();
    console.log('Replace the rootNodes entry with:');
    console.log(`  {
    nodeId: '16Uiu2HAm6YizNi4XUqUcCF3aoEVZaSzP3XSrGeKA1b893RLtCLfu',
    sigKey: '02cf6a24725f81b38431f3ddb92ed89a01b06a07f4e15945096c2e11a13916ff6d',
    stake: '1'
  }`);
    console.log();
    console.log('And update the signatures:');
    console.log(`  signatures: {
    '16Uiu2HAm6YizNi4XUqUcCF3aoEVZaSzP3XSrGeKA1b893RLtCLfu': 'c6a2603d88ed172ef492f3b55bc6f0651ca7fde037b8651c83c33e8fd4884e5d72ef863fac564a0863e2bdea4ef73a1b2de2abe36485a3fa95d3cda1c51dcc2300'
  }`);
    console.log();
  } else {
    console.log('Still failed with result:', result);
  }
} catch (error) {
  console.log('✗ Error:', error.message);
  console.error(error);
}
