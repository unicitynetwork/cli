#!/usr/bin/env node

import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { InclusionProof } from '@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.js';

const endpoint = 'http://localhost:3000';
const requestIdStr = '000099692ceaa0f8c1ff5b33214dc993b78fe1861481327ffdaabc67b1454bd4e02e';

async function debugInclusionProof() {
  try {
    console.log('=== DEBUG INCLUSION PROOF PARSING ===\n');

    const client = new AggregatorClient(endpoint);
    const requestId = RequestId.fromJSON(requestIdStr);

    console.log('Fetching inclusion proof from aggregator...');
    const response = await client.getInclusionProof(requestId);

    console.log('\nRaw response type:', typeof response);
    console.log('Response keys:', response ? Object.keys(response) : 'null');

    if (response && response.inclusionProof) {
      console.log('\ninclusionProof keys:', Object.keys(response.inclusionProof));
      console.log('merkleTreePath keys:', Object.keys(response.inclusionProof.merkleTreePath));

      // Check the problematic path values
      const steps = response.inclusionProof.merkleTreePath.steps;
      console.log('\nSteps analysis:');
      steps.forEach((step, i) => {
        console.log(`Step ${i}:`);
        console.log(`  data: ${step.data}`);
        console.log(`  path (raw): ${step.path}`);
        console.log(`  path type: ${typeof step.path}`);
        console.log(`  path length: ${String(step.path).length}`);

        // Check if it's a huge number
        if (String(step.path).length > 10) {
          console.log(`  path as BigInt hex: 0x${BigInt(step.path).toString(16)}`);
        }
      });

      console.log('\n=== ATTEMPTING TO PARSE ===');

      // Try method 1: Pass entire response (as mint-token does)
      console.log('\nMethod 1: Passing entire response object');
      try {
        const proof1 = InclusionProof.fromJSON(response);
        console.log('✓ Success with entire response!');
        console.log('Proof type:', proof1.constructor.name);
      } catch (e1) {
        console.log('✗ Failed:', e1.message);

        // Check if it's a specific field causing the issue
        if (e1.message.includes('Invalid JSON structure')) {
          console.log('  SDK rejected the JSON structure');
        }
      }

      // Try method 2: Pass just the inclusionProof field
      console.log('\nMethod 2: Passing just inclusionProof field');
      try {
        const proof2 = InclusionProof.fromJSON(response.inclusionProof);
        console.log('✓ Success with inclusionProof field!');
      } catch (e2) {
        console.log('✗ Failed:', e2.message);
      }

    } else {
      console.log('No inclusion proof in response');
    }

  } catch (error) {
    console.error('ERROR:', error);
  }
}

debugInclusionProof().catch(console.error);