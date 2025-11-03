import { Command } from 'commander';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { DataHash } from '@unicitylabs/state-transition-sdk/lib/hash/DataHash.js';
import { InclusionProof } from '@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.js';

export function getRequestCommand(program: Command): void {
  program
    .command('get-request')
    .description('Get inclusion proof for a specific request ID')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('--local', 'Use local aggregator (http://localhost:3001)')
    .option('--production', 'Use production aggregator (https://gateway.unicity.network)')
    .option('--json', 'Output raw JSON response for pipeline processing')
    .argument('<requestId>', 'Request ID to query')
    .action(async (requestIdStr: string, options) => {
      // Determine endpoint
      let endpoint = options.endpoint;
      if (options.local) {
        endpoint = 'http://127.0.0.1:3000';
      } else if (options.production) {
        endpoint = 'https://gateway.unicity.network';
      }

      try {
        console.log(`\n=== Fetching Inclusion Proof ===`);
        console.log(`Endpoint: ${endpoint}`);
        console.log(`Request ID: ${requestIdStr}\n`);

        // Use SDK to fetch inclusion proof
        const aggregatorClient = new AggregatorClient(endpoint);
        const requestId = RequestId.fromJSON(requestIdStr);

        // Fetch the inclusion proof using SDK
        const proofResponse = await aggregatorClient.getInclusionProof(requestId);

        if (!proofResponse || !proofResponse.inclusionProof) {
          console.log('STATUS: NOT_FOUND');
          console.log('No proof available for this request ID');
          return;
        }

        const inclusionProof = proofResponse.inclusionProof;

        // If --json flag is set, output raw JSON and exit
        if (options.json) {
          console.log(JSON.stringify(inclusionProof.toJSON(), null, 2));
          return;
        }

        // Check if this is an exclusion proof
        const isExclusionProof = inclusionProof.authenticator === null && inclusionProof.transactionHash === null;

        if (isExclusionProof) {
          console.log('STATUS: PATH_NOT_INCLUDED');
          console.log('This is an EXCLUSION PROOF (non-inclusion proof).');
          console.log('  - The RequestId does NOT exist in the Sparse Merkle Tree');
          return;
        }

        // This is an INCLUSION PROOF
        console.log('STATUS: INCLUSION PROOF RECEIVED');
        console.log('This is an INCLUSION PROOF.\n');

        console.log('=== PROOF DATA ANALYSIS ===');
        console.log(`Transaction Hash: ${inclusionProof.transactionHash ? inclusionProof.transactionHash.toJSON() : 'NULL'}`);
        console.log(`Authenticator: ${inclusionProof.authenticator ? 'PRESENT' : 'NULL'}`);

        if (inclusionProof.authenticator) {
          const auth = inclusionProof.authenticator;
          console.log('\nAuthenticator Details:');
          console.log(`  Public Key: ${Buffer.from(auth.publicKey).toString('hex')}`);
          console.log(`  Signature: ${auth.signature ? Buffer.from(auth.signature.bytes).toString('hex') : 'NULL'}`);
          console.log(`  State Hash: ${auth.stateHash ? auth.stateHash.toJSON() : 'NULL'}`);
        }

        console.log('\n=== AUTHENTICATOR VERIFICATION TESTS ===');

        // TEST 1: Verify with transactionHash
        if (inclusionProof.transactionHash && inclusionProof.authenticator) {
          console.log('\nTest 1: Verify authenticator with transactionHash from proof');
          const verifyResult = await inclusionProof.authenticator.verify(inclusionProof.transactionHash);
          console.log(`  Result: ${verifyResult}`);

          if (!verifyResult) {
            console.log('  ❌ VERIFICATION FAILED');
            console.log('  This is the ROOT CAUSE - authenticator from aggregator fails verification!');
          } else {
            console.log('  ✅ VERIFICATION PASSED');
          }
        }

        // TEST 2: Serialize and deserialize authenticator
        console.log('\nTest 2: Serialize/deserialize round-trip test');
        if (inclusionProof.authenticator) {
          try {
            const authJson = inclusionProof.authenticator.toJSON();
            console.log('  Authenticator JSON:', JSON.stringify(authJson, null, 2));

            // Try to create a new Authenticator from JSON
            const { Authenticator } = await import('@unicitylabs/state-transition-sdk/lib/api/Authenticator.js');
            const deserializedAuth = Authenticator.fromJSON(authJson);

            console.log('  ✓ Deserialization successful');

            // Check if fields match
            const pubKeyMatch = Buffer.from(deserializedAuth.publicKey).equals(Buffer.from(inclusionProof.authenticator.publicKey));
            const sigMatch = deserializedAuth.signature && inclusionProof.authenticator.signature ?
              Buffer.from(deserializedAuth.signature.bytes).equals(Buffer.from(inclusionProof.authenticator.signature.bytes)) : false;
            const hashMatch = deserializedAuth.stateHash && inclusionProof.authenticator.stateHash ?
              deserializedAuth.stateHash.equals(inclusionProof.authenticator.stateHash) : false;

            console.log(`  Public keys match: ${pubKeyMatch}`);
            console.log(`  Signatures match: ${sigMatch}`);
            console.log(`  State hashes match: ${hashMatch}`);

            // Test verification with deserialized authenticator
            if (inclusionProof.transactionHash) {
              const deserializedVerifies = await deserializedAuth.verify(inclusionProof.transactionHash);
              console.log(`  Deserialized auth verifies: ${deserializedVerifies}`);
            }
          } catch (err) {
            console.log(`  ❌ Error during round-trip: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        // TEST 3: Manual signature verification
        console.log('\nTest 3: Manual cryptographic verification');
        if (inclusionProof.authenticator && inclusionProof.transactionHash) {
          try {
            const { createVerify } = await import('crypto');
            const auth = inclusionProof.authenticator;

            // The authenticator signs the transactionHash, not the stateHash
            // But Authenticator.verify() may have different behavior
            console.log('  Attempting to verify signature manually...');
            console.log(`  Data being verified (txHash): ${inclusionProof.transactionHash.toJSON()}`);

            // Try verifying with transaction hash
            const verify1 = createVerify('SHA256');
            verify1.update(inclusionProof.transactionHash.data);
            verify1.end();

            const isValid1 = verify1.verify(
              {
                key: Buffer.from(auth.publicKey),
                format: 'der',
                type: 'spki'
              },
              Buffer.from(auth.signature!.bytes)
            );
            console.log(`  Manual verify (txHash): ${isValid1}`);

            // Try verifying with state hash
            if (auth.stateHash) {
              const verify2 = createVerify('SHA256');
              verify2.update(auth.stateHash.data);
              verify2.end();

              const isValid2 = verify2.verify(
                {
                  key: Buffer.from(auth.publicKey),
                  format: 'der',
                  type: 'spki'
                },
                Buffer.from(auth.signature!.bytes)
              );
              console.log(`  Manual verify (stateHash): ${isValid2}`);
            }
          } catch (err) {
            console.log(`  ❌ Manual verification error: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        // TEST 4: Check signature format
        console.log('\nTest 4: Signature format analysis');
        if (inclusionProof.authenticator && inclusionProof.authenticator.signature) {
          const sigBytes = inclusionProof.authenticator.signature.bytes;
          console.log(`  Signature length: ${sigBytes.length} bytes`);
          console.log(`  Signature hex: ${Buffer.from(sigBytes).toString('hex')}`);
          console.log(`  First byte: 0x${sigBytes[0].toString(16).padStart(2, '0')}`);

          // Check if it's DER format (should start with 0x30)
          if (sigBytes[0] === 0x30) {
            console.log('  ✓ Signature appears to be DER format');
          } else {
            console.log('  ⚠ Signature may not be in DER format');
          }
        }

        console.log('\n=== SUMMARY ===');
        console.log('Merkle Tree Path:');
        console.log(`  Root Hash: ${inclusionProof.merkleTreePath.root.toJSON()}`);
        console.log(`  Path Length: ${inclusionProof.merkleTreePath.steps.length} steps`);

        if (inclusionProof.unicityCertificate) {
          console.log('\nUnicity Certificate: PRESENT');
        }

      } catch (err) {
        console.error(`\nError getting request: ${err instanceof Error ? err.message : String(err)}`);
        if (err instanceof Error && err.stack) {
          console.error('\nStack trace:', err.stack);
        }
      }
    });
}