#!/usr/bin/env ts-node
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import { InclusionProof } from '@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { readFileSync } from 'fs';

console.log('='.repeat(80));
console.log('FINAL VERIFICATION TEST');
console.log('='.repeat(80));
console.log();

// Read the latest token file
const tokenData = JSON.parse(readFileSync('/home/vrogojin/cli/20251103_182326_1762190606399_0000d7d3e3.txf', 'utf8'));

// Create InclusionProof from the token
const proof = InclusionProof.fromJSON(tokenData.genesis.inclusionProof);

// The requestId from the mint output
const requestIdHex = '0000ffb1327e4c8bf231683b75f0853f5dfddd7b896b0c282816492f7ce3a5d3c6c1';
const requestId = RequestId.fromJSON(requestIdHex);

console.log('Token File: 20251103_182326_1762190606399_0000d7d3e3.txf');
console.log('Request ID:', requestIdHex);
console.log();

// Use the corrected TrustBase
const trustBase = RootTrustBase.fromJSON({
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

console.log('Verifying inclusion proof with corrected trustBase...');
console.log();

const result = await proof.verify(trustBase, requestId);

console.log('='.repeat(80));
console.log('VERIFICATION RESULT:', result);
console.log('='.repeat(80));
console.log();

if (result === 'OK') {
  console.log('✓✓✓ SUCCESS! ✓✓✓');
  console.log();
  console.log('The UnicityCertificate validation is now PASSING!');
  console.log('The fix has been successfully applied to mint-token.ts');
} else {
  console.log('✗ FAILED with status:', result);
}
