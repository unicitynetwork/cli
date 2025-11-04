import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { TextEncoder } from 'util';

async function test() {
    console.log("=== Reproducing the Bug ===\n");

    // Create signing service
    const secret = new TextEncoder().encode("test-secret");
    const signingService = await SigningService.createFromSecret(secret);

    // Create state hash
    const stateHasher = new DataHasher(HashAlgorithm.SHA256);
    const stateHash = await stateHasher.update(new TextEncoder().encode("test-state")).digest();

    // Create request ID correctly
    const requestId = await RequestId.create(signingService.publicKey, stateHash);

    console.log("1. Correctly Generated RequestId:");
    const correctJson = requestId.toJSON();
    console.log(`   JSON: ${correctJson}`);
    const hexLength = correctJson.length;
    const byteLength = hexLength / 2;
    const bitLength = hexLength * 4;
    console.log(`   Length: ${hexLength} hex chars (${byteLength} bytes = ${bitLength} bits)`);
    console.log();

    // Simulate the bug: what if user only sees the hash data (32 bytes)?
    console.log("2. Common User Error - Using Only Hash Data:");
    const hashDataOnly = Buffer.from(requestId.data).toString('hex');
    console.log(`   Hash Data Only: ${hashDataOnly}`);
    const hashHexLen = hashDataOnly.length;
    const hashByteLen = hashHexLen / 2;
    const hashBitLen = hashHexLen * 4;
    console.log(`   Length: ${hashHexLen} hex chars (${hashByteLen} bytes = ${hashBitLen} bits)`);
    console.log();

    // Try to parse both
    try {
        console.log("3. Parsing Correct RequestId (with algorithm prefix):");
        const parsed1 = RequestId.fromJSON(correctJson);
        const p1DataLen = parsed1.data.length;
        const p1ImpLen = parsed1.imprint.length;
        const p1ImpBits = p1ImpLen * 8;
        console.log(`   ✓ Success! Parsed RequestId with ${p1DataLen} byte hash`);
        console.log(`   Imprint length: ${p1ImpLen} bytes = ${p1ImpBits} bits`);
    } catch (err) {
        console.log(`   ✗ Error: ${err.message}`);
    }
    console.log();

    try {
        console.log("4. Parsing Hash Data Only (missing algorithm prefix):");
        const parsed2 = RequestId.fromJSON(hashDataOnly);
        const p2DataLen = parsed2.data.length;
        const p2ImpLen = parsed2.imprint.length;
        const p2ImpBits = p2ImpLen * 8;
        console.log(`   ✓ Parsed (but incorrectly!) Hash: ${p2DataLen} bytes`);
        console.log(`   Imprint length: ${p2ImpLen} bytes = ${p2ImpBits} bits`);
        console.log(`   ⚠ This is WRONG - missing 2-byte algorithm prefix!`);
        console.log(`   ⚠ Aggregator will reject this with "invalid key length 256, should be 272"`);
    } catch (err) {
        console.log(`   ✗ Error: ${err.message}`);
    }
}

test().catch(console.error);
