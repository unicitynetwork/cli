#!/usr/bin/env node
/**
 * Debug script to inspect POW blockchain RPC responses
 */

const blockHeight = 861;
const endpoint = 'http://localhost:8332';

async function debugRPC() {
  console.log('=== POW RPC Debug ===\n');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Block Height: ${blockHeight}\n`);

  try {
    // Test 1: Get block header
    console.log('1. Fetching block header...');
    const headerResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'getblockheader',
        params: [blockHeight],
        id: 1
      })
    });

    const headerData = await headerResponse.json();
    console.log('Block Header Response:');
    console.log(JSON.stringify(headerData, null, 2));
    console.log();

    // Test 2: Get witness by height
    console.log('2. Fetching witness by height...');
    const witnessResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'getwitnessbyheight',
        params: [blockHeight],
        id: 2
      })
    });

    const witnessData = await witnessResponse.json();
    console.log('Witness Response:');
    console.log(JSON.stringify(witnessData, null, 2));
    console.log();

    // Test 3: Try alternative RPC method names
    console.log('3. Trying alternative method names...');

    const altMethods = ['getwitness', 'getsegwitness', 'getwitnessdata'];
    for (const method of altMethods) {
      console.log(`\nTrying: ${method}`);
      const altResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params: [blockHeight],
          id: 3
        })
      });

      const altData = await altResponse.json();
      if (!altData.error) {
        console.log(`✓ ${method} succeeded:`);
        console.log(JSON.stringify(altData, null, 2));
      } else {
        console.log(`✗ ${method} failed: ${altData.error.message}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugRPC();
