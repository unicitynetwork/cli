#!/usr/bin/env node

import { InclusionProof } from '@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.js';

// The raw response we got from the aggregator
const rawResponse = {
  "inclusionProof": {
    "authenticator": null,
    "merkleTreePath": {
      "root": "00000c96af7ee2698488293ad37ee7e46facf59adf19517d05b16d8da0d7cbe03b15",
      "steps": [
        {
          "data": "00003ff855249ec1ad022e7637fce313fbecba54f2659bb8987bcc5f0106682af2b9",
          "path": "237145167613715980951814869850169618431511476173142885640137189315434943467016147"
        },
        {
          "data": "2f25058eaf4eef7aef1f544abb9de67e00bb4767a7bac963e9c62c1c80a90ae2",
          "path": "2"
        },
        {
          "data": "d74b3f2b61a6786e2714cdbaedc4cf1b0cf9b8a56d46f6304441c210ffa4f909",
          "path": "3"
        }
      ]
    },
    "transactionHash": null,
    "unicityCertificate": "d903ef8701d903f08a011a0001fa6800582200000c96af7ee2698488293ad37ee7e46facf59adf19517d05b16d8da0d7cbe03b15582200000c96af7ee2698488293ad37ee7e46facf59adf19517d05b16d8da0d7cbe03b15401a6907527ef600f658208d628a3262c7f9ab69aea544b22e709917dcbcfb135865ae0e6011d60581438a5820cd2d7355610a1db7f78e45b82a39db243f1a3bfd84400a0343680f51c973d85f82418080d903f683010780d903e98801031a000bdeab001a690752815820b51d84fcc0d8c2d8a15663ffd130e356b8b57ea6cdd46ecbae5ae15eaf98564258209146bb88d4ebb622d1155be65696d620d939dd7efb7fd2f5eaffd7abd1368b73a1783531365569753248416b7635686b44465554336346564d544365744a4a6e6f43354857624364324378473434754d5756584e64627a6258417a7e100d8d4712eb0163c5b6f591c28771e77780a1bec55365bc03633aff54ec3b26cce0fa5b1de08f3709d19133015a9d4f2c8a1d91049becd9572043b9329200"
  }
};

console.log('Testing InclusionProof parsing...\n');

// Test 1: Try parsing the whole response
console.log('Test 1: Parsing entire response object');
try {
  const proof1 = InclusionProof.fromJSON(rawResponse);
  console.log('✓ Success! Created InclusionProof from entire response');
} catch (error) {
  console.log('✗ Failed:', error.message);
}

// Test 2: Try parsing just the inclusionProof field
console.log('\nTest 2: Parsing just inclusionProof field');
try {
  const proof2 = InclusionProof.fromJSON(rawResponse.inclusionProof);
  console.log('✓ Success! Created InclusionProof from inclusionProof field');
} catch (error) {
  console.log('✗ Failed:', error.message);
}

// Test 3: Try converting the huge path number to a hex string
console.log('\nTest 3: Converting large path numbers to hex');
const modifiedResponse = JSON.parse(JSON.stringify(rawResponse));
modifiedResponse.inclusionProof.merkleTreePath.steps[0].path = "0x" + BigInt(modifiedResponse.inclusionProof.merkleTreePath.steps[0].path).toString(16);
try {
  const proof3 = InclusionProof.fromJSON(modifiedResponse);
  console.log('✓ Success! Created InclusionProof with hex paths');
} catch (error) {
  console.log('✗ Failed:', error.message);
}

// Test 4: Try with path as number instead of string
console.log('\nTest 4: Path as number');
const modifiedResponse2 = JSON.parse(JSON.stringify(rawResponse));
modifiedResponse2.inclusionProof.merkleTreePath.steps = modifiedResponse2.inclusionProof.merkleTreePath.steps.map(step => ({
  ...step,
  path: parseInt(step.path, 10) // Convert to number
}));
try {
  const proof4 = InclusionProof.fromJSON(modifiedResponse2);
  console.log('✓ Success! Created InclusionProof with numeric paths');
} catch (error) {
  console.log('✗ Failed:', error.message);
  console.log('Full error:', error);
}

// Test 5: Check what the actual structure should be
console.log('\nTest 5: Checking expected structure');
console.log('Step 0 path value:', rawResponse.inclusionProof.merkleTreePath.steps[0].path);
console.log('Step 0 path type:', typeof rawResponse.inclusionProof.merkleTreePath.steps[0].path);
console.log('Step 0 path length:', rawResponse.inclusionProof.merkleTreePath.steps[0].path.length);

// Try to understand the huge number - it's 78 digits long!
const hugePath = rawResponse.inclusionProof.merkleTreePath.steps[0].path;
console.log('\nAnalyzing the huge path number:');
console.log('Decimal:', hugePath);
console.log('As BigInt hex:', '0x' + BigInt(hugePath).toString(16));