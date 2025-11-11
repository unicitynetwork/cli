import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { getCachedTrustBase } from './dist/utils/trustbase-loader.js';
import * as fs from 'fs';

async function testVerify(filePath) {
    console.log(`\nTesting: ${filePath}`);
    const tokenJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const token = await Token.fromJSON(tokenJson);
    
    const trustBase = await getCachedTrustBase({ filePath: process.env.TRUSTBASE_PATH, useFallback: false });
    
    const result = await token.verify(trustBase);
    console.log(`\nResult Code: ${result.code}`);
    console.log(`Result Message: ${result.message}`);
    if (result.code !== 'OK') {
        console.log('FAILED - Details:', JSON.stringify(result, null, 2));
    } else {
        console.log('PASSED');
    }
}

console.log('=== Testing Original Token ===');
await testVerify('/tmp/test-token.txf');

console.log('\n=== Testing Tampered Token (state.data modified) ===');
await testVerify('/tmp/tampered.txf');
