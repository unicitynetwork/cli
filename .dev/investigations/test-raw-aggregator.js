#!/usr/bin/env node

// Test raw JSON-RPC call to see what the aggregator actually returns

const endpoint = 'http://localhost:3000';
const requestId = '000099692ceaa0f8c1ff5b33214dc993b78fe1861481327ffdaabc67b1454bd4e02e';

async function testRawCall() {
  const requestBody = {
    jsonrpc: '2.0',
    method: 'get_inclusion_proof',
    params: {
      requestId: requestId
    },
    id: 1
  };

  console.log('Sending raw JSON-RPC request:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const text = await response.text();
    console.log('\nRaw response text:');
    console.log(text);

    // Try to parse it
    console.log('\nParsing response...');
    const parsed = JSON.parse(text);
    console.log('\nParsed response:', JSON.stringify(parsed, null, 2));

    // Check the first step's path value
    if (parsed.result?.inclusionProof?.merkleTreePath?.steps?.[0]) {
      const firstStep = parsed.result.inclusionProof.merkleTreePath.steps[0];
      console.log('\nFirst step analysis:');
      console.log('  path value:', firstStep.path);
      console.log('  path type:', typeof firstStep.path);
      console.log('  path length:', String(firstStep.path).length);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testRawCall().catch(console.error);