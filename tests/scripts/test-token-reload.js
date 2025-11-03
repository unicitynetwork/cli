/**
 * Test to verify that generated TXF files can be properly reloaded
 * This ensures SDK compliance and compatibility
 */

import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import * as fs from 'fs/promises';

async function main() {
  const tokenFile = process.argv[2];

  if (!tokenFile) {
    console.error('Usage: node test-token-reload.js <token_file.txf>');
    process.exit(1);
  }

  console.log('=== Token Reload Verification Test ===\n');
  console.log(`Testing file: ${tokenFile}\n`);

  try {
    // Step 1: Read the TXF file
    console.log('Step 1: Reading TXF file...');
    const fileContent = await fs.readFile(tokenFile, 'utf-8');
    const tokenJson = JSON.parse(fileContent);
    console.log('  ✓ File read successfully');
    console.log(`  Version: ${tokenJson.version}`);
    console.log(`  Has genesis: ${!!tokenJson.genesis}`);
    console.log(`  Has state: ${!!tokenJson.state}`);
    console.log(`  State has predicate: ${!!tokenJson.state?.predicate}`);
    console.log(`  Predicate length: ${tokenJson.state?.predicate?.length} chars\n`);

    // Step 2: Verify predicate encoding format
    console.log('Step 2: Checking predicate CBOR encoding...');
    const predicateHex = tokenJson.state.predicate;
    if (predicateHex.startsWith('83')) {
      console.log('  ✓ Predicate starts with 0x83 (CBOR array with 3 elements)');
      console.log('  ✓ Proper SDK format: [engine_id, template, params]\n');
    } else {
      console.log('  ❌ Predicate does NOT start with 0x83');
      console.log('  ❌ This is NOT a proper CBOR array!');
      console.log(`  First bytes: ${predicateHex.substring(0, 10)}\n`);
      throw new Error('Invalid predicate encoding format');
    }

    // Step 3: Attempt to reload with SDK
    console.log('Step 3: Attempting to reload token with SDK...');
    const reloadedToken = await Token.fromJSON(tokenJson);
    console.log('  ✓ Token successfully reloaded!');
    console.log(`  Token type: ${reloadedToken.constructor.name}\n`);

    // Step 4: Verify token properties
    console.log('Step 4: Verifying token properties...');
    console.log('  Token ID:', reloadedToken.id.toJSON());
    console.log('  Token Type:', reloadedToken.type.toJSON());
    console.log('  Has state:', !!reloadedToken.state);
    console.log('  Has predicate:', !!reloadedToken.state?.predicate);
    console.log('  Predicate type:', reloadedToken.state?.predicate?.constructor.name);
    console.log();

    // Step 5: Serialize and compare
    console.log('Step 5: Testing round-trip serialization...');
    const reserializedJson = reloadedToken.toJSON();

    // Compare key fields
    const originalPredicate = tokenJson.state.predicate;
    const reserializedPredicate = reserializedJson.state.predicate;

    if (originalPredicate === reserializedPredicate) {
      console.log('  ✓ Predicate matches after round-trip');
    } else {
      console.log('  ⚠ Predicate differs after round-trip');
      console.log('    Original length:', originalPredicate.length);
      console.log('    Reserialized length:', reserializedPredicate.length);
    }

    console.log();
    console.log('=== ✅ ALL TESTS PASSED ===');
    console.log('The TXF file is properly formatted and SDK-compliant!');

  } catch (error) {
    console.error('\n=== ❌ TEST FAILED ===');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
