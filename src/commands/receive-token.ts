import { Command } from 'commander';
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { TransferCommitment } from '@unicitylabs/state-transition-sdk/lib/transaction/TransferCommitment.js';
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { UnmaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/UnmaskedPredicate.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { TokenState } from '@unicitylabs/state-transition-sdk/lib/token/TokenState.js';
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import { JsonRpcNetworkError } from '@unicitylabs/state-transition-sdk/lib/api/json-rpc/JsonRpcNetworkError.js';
import { IExtendedTxfToken, TokenStatus } from '../types/extended-txf.js';
import { validateExtendedTxf, sanitizeForExport } from '../utils/transfer-validation.js';
import { validateInclusionProof, validateTokenProofsJson } from '../utils/proof-validation.js';
import { getCachedTrustBase } from '../utils/trustbase-loader.js';
import { validateSecret, validateFilePath, throwValidationError } from '../utils/input-validation.js';
import * as fs from 'fs';
import * as readline from 'readline';

/**
 * Get secret from environment variable or prompt user
 * Validates the secret before returning
 */
async function getSecret(skipValidation: boolean = false): Promise<Uint8Array> {
  let secret: string;

  // Check environment variable first
  if (process.env.SECRET) {
    secret = process.env.SECRET;
    // Clear it immediately for security
    delete process.env.SECRET;
  } else {
    // Prompt user interactively
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr
    });

    secret = await new Promise((resolve) => {
      rl.question('Enter your secret (will be hidden): ', (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  // Validate secret (CRITICAL: prevent weak/empty secrets)
  const validation = validateSecret(secret, 'receive-token', skipValidation);
  if (!validation.valid) {
    throwValidationError(validation);
  }

  return new TextEncoder().encode(secret);
}

/**
 * Wait for inclusion proof with timeout
 * Polls until proof exists AND authenticator is non-null
 */
async function waitInclusionProof(
  client: StateTransitionClient,
  commitment: TransferCommitment,
  timeoutMs: number = 60000,
  intervalMs: number = 1000
): Promise<any> {
  const startTime = Date.now();
  let proofReceived = false;

  console.error('Waiting for inclusion proof...');

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Get inclusion proof response from client
      const proofResponse = await client.getInclusionProof(commitment);

      if (proofResponse && proofResponse.inclusionProof) {
        const proof = proofResponse.inclusionProof;

        // Check if proof is complete (has authenticator AND transactionHash)
        // The aggregator populates these fields asynchronously, so we must wait
        const hasAuth = proof.authenticator !== null && proof.authenticator !== undefined;
        const hasTxHash = proof.transactionHash !== null && proof.transactionHash !== undefined;

        if (hasAuth && hasTxHash) {
          console.error('  ✓ Inclusion proof received from aggregator (complete with authenticator and transactionHash)');
          return proof;
        }
        // If proof exists but is incomplete, continue polling
        if (!proofReceived) {
          console.error(`  ⏳ Proof found but incomplete - authenticator: ${hasAuth}, transactionHash: ${hasTxHash}`);
          proofReceived = true;
        }
      }
    } catch (err) {
      if (err instanceof JsonRpcNetworkError && err.status === 404) {
        // Continue polling - proof not available yet
      } else {
        // Log other errors but continue polling
        console.error('Error getting inclusion proof (will retry):', err instanceof Error ? err.message : String(err));
      }
    }

    // Wait for the next interval
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timeout waiting for inclusion proof after ${timeoutMs}ms`);
}

export function receiveTokenCommand(program: Command): void {
  program
    .command('receive-token')
    .description('Receive a token sent via offline transfer package')
    .option('-f, --file <file>', 'Extended TXF file with offline transfer package (required)')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('--local', 'Use local aggregator (http://localhost:3000)')
    .option('--production', 'Use production aggregator (https://gateway.unicity.network)')
    .option('-o, --output <file>', 'Output TXF file path')
    .option('--save', 'Save output to auto-generated filename')
    .option('--stdout', 'Output to STDOUT only (no file)')
    .option('--state-data <json>', 'State data (JSON string) for the received token - REQUIRED if sender specified recipient data hash')
    .option('--unsafe-secret', 'Skip secret strength validation (for development/testing only)')
    .action(async (options) => {
      try {
        // Validate required options
        if (!options.file) {
          console.error('Error: --file option is required');
          console.error('Usage: npm run receive-token -- -f <token.txf>');
          process.exit(1);
        }

        // Validate file path (CRITICAL: prevent path traversal)
        const fileValidation = validateFilePath(options.file, 'Transaction file');
        if (!fileValidation.valid) {
          throwValidationError(fileValidation);
        }

        // Check file exists
        if (!fs.existsSync(options.file)) {
          console.error(`\n❌ Transaction file not found: ${options.file}`);
          console.error('\nMake sure the file path is correct and the file exists.');
          process.exit(1);
        }

        // Check file extension (must be .txf)
        if (!options.file.endsWith('.txf')) {
          console.error(`\n❌ Invalid file type: expected .txf file, got ${options.file}`);
          console.error('\nToken files must have the .txf extension.');
          process.exit(1);
        }

        // Determine endpoint
        let endpoint = options.endpoint;
        if (options.local) {
          endpoint = 'http://127.0.0.1:3000';
        } else if (options.production) {
          endpoint = 'https://gateway.unicity.network';
        }

        console.error('=== Receive Token (Offline Transfer) ===\n');

        // STEP 1: Load and validate extended TXF file
        console.error('Step 1: Loading extended TXF file...');
        const fileContent = fs.readFileSync(options.file, 'utf8');
        const extendedTxf: IExtendedTxfToken = JSON.parse(fileContent);
        console.error(`  ✓ File loaded: ${options.file}\n`);

        // STEP 2: Validate offline transfer package
        console.error('Step 2: Validating offline transfer package...');
        const validation = await validateExtendedTxf(extendedTxf);

        if (!validation.isValid) {
          console.error('\n❌ Validation failed:');
          validation.errors?.forEach(err => console.error(`  - ${err}`));
          process.exit(1);
        }

        if (!validation.hasOfflineTransfer) {
          console.error('\n❌ Error: No offline transfer package found in TXF file');
          console.error('This command is for receiving offline transfers.');
          console.error('Use "send-token" to create offline transfer packages.');
          process.exit(1);
        }

        if (validation.warnings && validation.warnings.length > 0) {
          console.error('  ⚠ Warnings:');
          validation.warnings.forEach(warn => console.error(`    - ${warn}`));
        }

        console.error('  ✓ Offline transfer package validated');

        // STEP 2.5: Validate token proofs before processing
        console.error('\nStep 2.5: Validating token proofs...');
        const proofValidation = validateTokenProofsJson(extendedTxf);

        if (!proofValidation.valid) {
          console.error('\n❌ Token proof validation failed:');
          proofValidation.errors.forEach(err => console.error(`  - ${err}`));
          console.error('\nCannot receive a token with invalid proofs.');
          process.exit(1);
        }

        if (proofValidation.warnings.length > 0) {
          console.error('  ⚠ Proof warnings:');
          proofValidation.warnings.forEach(warn => console.error(`    - ${warn}`));
        }

        console.error('  ✓ Token proofs validated');

        const offlineTransfer = extendedTxf.offlineTransfer!;
        console.error(`  Sender: ${offlineTransfer.sender.address}`);
        console.error(`  Recipient: ${offlineTransfer.recipient}`);
        console.error(`  Network: ${offlineTransfer.network}`);
        if (offlineTransfer.message) {
          console.error(`  Message: "${offlineTransfer.message}"`);
        }
        console.error();

        // STEP 3: Get recipient's secret
        console.error('Step 3: Getting recipient secret...');
        const secret = await getSecret(options.unsafeSecret);
        const signingService = await SigningService.createFromSecret(secret);
        console.error(`  ✓ Signing service created`);
        console.error(`  Public Key: ${HexConverter.encode(signingService.publicKey)}\n`);

        // STEP 4: Parse transfer commitment
        console.error('Step 4: Parsing transfer commitment...');
        if (!offlineTransfer.commitmentData) {
          console.error('\n❌ Error: Missing commitment data in offline transfer package');
          process.exit(1);
        }

        const commitmentJson = JSON.parse(offlineTransfer.commitmentData);
        const transferCommitment = await TransferCommitment.fromJSON(commitmentJson);
        console.error(`  ✓ Transfer commitment parsed`);
        console.error(`  Request ID: ${transferCommitment.requestId.toJSON()}\n`);

        // STEP 4.5: Validate state data against recipient data hash (CRITICAL SECURITY)
        console.error('Step 4.5: Validating state data commitment...');
        let stateData: Uint8Array | null = null;

        // Access recipientDataHash from commitmentJson (before SDK parsing)
        const recipientDataHash = commitmentJson.transactionData?.recipientDataHash;

        if (recipientDataHash) {
          // Recipient data hash is present - state data REQUIRED and MUST match
          console.error('  ℹ  Sender specified recipient data hash commitment');

          if (!options.stateData) {
            console.error('\n❌ Error: --state-data is REQUIRED');
            console.error('The sender committed to a specific state data hash.');
            console.error('You must provide the exact state data that matches this commitment.\n');
            console.error('Usage: npm run receive-token -- -f transfer.txf --state-data \'{"your":"data"}\'\n');
            process.exit(1);
          }

          // Compute hash of provided state data
          const providedData = new TextEncoder().encode(options.stateData);
          // Use SHA256 (same as used by send-token)
          const hasher = new DataHasher(HashAlgorithm.SHA256);
          const computedHash = await hasher.update(providedData).digest();

          // CRITICAL: Validate exact hash match
          // recipientDataHash is just the raw 64-char hex hash string from send-token
          const expectedHashHex = recipientDataHash;
          const computedHashHex = HexConverter.encode(computedHash.data);

          if (computedHashHex !== expectedHashHex) {
            console.error('\n❌ SECURITY ERROR: State data hash mismatch!');
            console.error('The state data you provided does not match the sender\'s commitment.\n');
            console.error(`Expected hash: ${expectedHashHex}`);
            console.error(`Computed hash: ${computedHashHex}\n`);
            console.error('You must provide the exact state data that matches the hash commitment.');
            process.exit(1);
          }

          console.error('  ✓ State data hash validated - matches sender commitment');
          stateData = providedData;
        } else {
          // No recipient data hash - state data MUST be null
          console.error('  ℹ  No recipient data hash commitment');

          if (options.stateData) {
            console.error('\n❌ Error: Cannot set --state-data');
            console.error('The sender did NOT commit to a recipient data hash.');
            console.error('State data must remain null to prevent creating alternative states.\n');
            console.error('Remove the --state-data option and try again.');
            process.exit(1);
          }

          console.error('  ✓ State data validation passed (null as required)');
          stateData = null;
        }
        console.error();

        // STEP 5: Load token from TXF to get token ID and type
        console.error('Step 5: Loading token data...');
        const token = await Token.fromJSON(extendedTxf);
        console.error(`  ✓ Token loaded`);
        console.error(`  Token ID: ${token.id.toJSON()}`);
        console.error(`  Token Type: ${token.type.toJSON()}\n`);

        // STEP 6: Create recipient's predicate with transfer salt
        console.error('Step 6: Creating recipient predicate for new ownership state...');

        // Decode salt from Base64 - this salt is for the new ownership state
        const saltBytes = Buffer.from(offlineTransfer.commitment.salt, 'base64');
        console.error(`  Transfer Salt: ${HexConverter.encode(saltBytes)}`);

        // Create UnmaskedPredicate for recipient using the transfer commitment salt
        // This predicate will be used to create the new token state after transfer
        // Note: We use the actual token ID and type from the transferred token
        const recipientPredicate = await UnmaskedPredicate.create(
          token.id,
          token.type,
          signingService,
          HashAlgorithm.SHA256,
          saltBytes
        );
        console.error('  ✓ Recipient predicate created for new state');

        // STEP 6.5: Validate that the secret generates the intended recipient address
        const predicateRef = await recipientPredicate.getReference();
        const addressObj = await predicateRef.toAddress();
        const actualAddress = addressObj.address;
        console.error(`  Generated Address: ${actualAddress}`);
        console.error(`  Intended Recipient: ${offlineTransfer.recipient}`);

        if (actualAddress !== offlineTransfer.recipient) {
          console.error('\n❌ Error: Secret does not match intended recipient!');
          console.error(`\nThe transfer was sent to: ${offlineTransfer.recipient}`);
          console.error(`Your secret generates:    ${actualAddress}`);
          console.error('\nYou are not the intended recipient of this transfer.');
          console.error('Please verify you are using the correct secret.\n');
          process.exit(1);
        }

        console.error('  ✓ Address validation passed - you are the intended recipient\n');

        // STEP 7: Create network clients
        console.error('Step 7: Connecting to network...');
        const aggregatorClient = new AggregatorClient(endpoint);
        const client = new StateTransitionClient(aggregatorClient);
        console.error(`  ✓ Connected to ${endpoint}\n`);

        // STEP 7.5: Load trust base dynamically from file or fallback to hardcoded
        console.error('Step 7.5: Loading trust base...');
        const trustBase = await getCachedTrustBase({
          filePath: process.env.TRUSTBASE_PATH,
          useFallback: false // Try file loading first, fallback if unavailable
        });
        console.error(`  ✓ Trust base ready (Network ID: ${trustBase.networkId}, Epoch: ${trustBase.epoch})\n`);

        // STEP 8: Submit transfer commitment to network
        console.error('Step 8: Submitting transfer to network...');
        try {
          await client.submitTransferCommitment(transferCommitment);
          console.error('  ✓ Transfer submitted to network\n');
        } catch (err) {
          // Check if already submitted (acceptable error)
          if (err instanceof Error && err.message.includes('already exists')) {
            console.error('  ℹ Transfer already submitted (continuing...)\n');
          } else {
            throw err;
          }
        }

        // STEP 9: Wait for inclusion proof
        console.error('Step 9: Waiting for inclusion proof...');
        const inclusionProof = await waitInclusionProof(client, transferCommitment);
        console.error();

        // STEP 9.5: Validate the transfer inclusion proof
        console.error('Step 9.5: Validating transfer inclusion proof...');
        const transferProofValidation = await validateInclusionProof(
          inclusionProof,
          transferCommitment.requestId,
          trustBase
        );

        if (!transferProofValidation.valid) {
          console.error('\n❌ Transfer proof validation failed:');
          transferProofValidation.errors.forEach(err => console.error(`  - ${err}`));
          console.error('\nCannot proceed with invalid proof.');
          process.exit(1);
        }

        if (transferProofValidation.warnings.length > 0) {
          console.error('  ⚠ Proof warnings:');
          transferProofValidation.warnings.forEach(warn => console.error(`    - ${warn}`));
        }

        console.error('  ✓ Transfer proof validated');
        console.error('  ✓ Authenticator verified\n');

        // STEP 10: Create transfer transaction from commitment + proof
        console.error('Step 10: Creating transfer transaction...');
        const transferTransaction = transferCommitment.toTransaction(inclusionProof);
        console.error('  ✓ Transfer transaction created\n');

        // STEP 12: Create new token state with recipient's predicate
        console.error('Step 12: Creating new token state with recipient predicate...');
        // Use validated state data (either from hash validation or null)
        const newState = new TokenState(recipientPredicate, stateData);
        console.error('  ✓ New token state created with validated data\n');

        // STEP 13: Create updated token with recipient's state and transfer transaction
        console.error('Step 13: Creating updated token with new ownership...');

        // Build updated token JSON with new state and transfer transaction
        const tokenJson = await token.toJSON();
        const newStateJson = await newState.toJSON();
        const transferTxJson = await transferTransaction.toJSON();

        // Create new token JSON with updated state and transaction history
        const modifiedTokenJson = {
          ...tokenJson,
          state: newStateJson,
          transactions: [...(tokenJson.transactions || []), transferTxJson]
        };

        // Recreate token from modified JSON
        const updatedToken = await Token.fromJSON(modifiedTokenJson);
        console.error('  ✓ Token updated with recipient ownership\n');

        // STEP 14: Create final extended TXF with CONFIRMED status
        console.error('Step 14: Building final extended TXF...');
        const updatedTokenJson = await updatedToken.toJSON();

        const finalTxf: IExtendedTxfToken = {
          version: updatedTokenJson.version || "2.0",
          state: updatedTokenJson.state,
          genesis: updatedTokenJson.genesis,
          transactions: updatedTokenJson.transactions || [],
          nametags: updatedTokenJson.nametags || [],
          status: TokenStatus.CONFIRMED
          // Note: offlineTransfer is removed - transfer is complete
        };

        console.error('  ✓ Final TXF created with CONFIRMED status\n');

        // STEP 15: Sanitize and output
        console.error('Step 15: Sanitizing and preparing output...');
        const sanitizedTxf = sanitizeForExport(finalTxf);
        const outputJson = JSON.stringify(sanitizedTxf, null, 2);
        console.error('  ✓ Output sanitized (private keys removed)\n');

        // Output handling
        let outputFile: string | null = null;

        if (options.output) {
          // Explicit output file specified
          outputFile = options.output;
        } else if (options.save) {
          // Auto-generate filename
          const now = new Date();
          const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
          const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
          const timestamp = Date.now();
          const addressBody = offlineTransfer.recipient.replace(/^[A-Z]+:\/\//, '');
          const addressPrefix = addressBody.substring(0, 10);
          outputFile = `${dateStr}_${timeStr}_${timestamp}_received_${addressPrefix}.txf`;
        }

        // Write to file if specified
        if (outputFile && !options.stdout) {
          fs.writeFileSync(outputFile, outputJson);
          console.error(`✅ Token saved to ${outputFile}`);
        }

        // Always output to stdout unless explicitly saving only
        if (!options.save || options.stdout) {
          console.log(outputJson);
        }

        console.error('\n=== Transfer Received Successfully ===');
        console.error(`Token ID: ${token.id.toJSON()}`);
        console.error(`Recipient Address: ${offlineTransfer.recipient}`);
        console.error(`Status: ${sanitizedTxf.status}`);
        console.error(`Transactions: ${finalTxf.transactions.length}`);
        console.error('\n✅ Token is now in your wallet and ready to use!');

      } catch (error) {
        console.error('\n❌ Error receiving token:');
        if (error instanceof Error) {
          console.error(`  Message: ${error.message}`);
          if (error.stack) {
            console.error(`  Stack trace:\n${error.stack}`);
          }
        } else {
          console.error(`  Error details: ${JSON.stringify(error, null, 2)}`);
        }
        process.exit(1);
      }
    });
}
