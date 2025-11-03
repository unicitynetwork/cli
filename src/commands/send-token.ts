import { Command } from 'commander';
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { TransferCommitment } from '@unicitylabs/state-transition-sdk/lib/transaction/TransferCommitment.js';
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { AddressFactory } from '@unicitylabs/state-transition-sdk/lib/address/AddressFactory.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import { JsonRpcNetworkError } from '@unicitylabs/state-transition-sdk/lib/api/json-rpc/JsonRpcNetworkError.js';
import { IExtendedTxfToken, IOfflineTransferPackage, TokenStatus } from '../types/extended-txf.js';
import { sanitizeForExport } from '../utils/transfer-validation.js';
import { validateTokenProofs, validateTokenProofsJson } from '../utils/proof-validation.js';
import { getCachedTrustBase } from '../utils/trustbase-loader.js';
import * as fs from 'fs';
import * as readline from 'readline';

/**
 * Get secret from environment variable or prompt user
 */
async function getSecret(): Promise<Uint8Array> {
  // Check environment variable first
  if (process.env.SECRET) {
    const secret = process.env.SECRET;
    // Clear it immediately for security
    delete process.env.SECRET;
    return new TextEncoder().encode(secret);
  }

  // Prompt user interactively
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr
  });

  return new Promise((resolve) => {
    rl.question('Enter your secret (will be hidden): ', (answer) => {
      rl.close();
      resolve(new TextEncoder().encode(answer));
    });
  });
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

        // First time we see the proof
        if (!proofReceived) {
          console.error('  ✓ Inclusion proof received');
          proofReceived = true;
        }

        // Check if authenticator is populated
        const proofJson = proof.toJSON ? proof.toJSON() : proof;

        if (proofJson.authenticator !== null && proofJson.authenticator !== undefined) {
          console.error('  ✓ Authenticator populated - proof complete');
          return proof;
        } else {
          // Proof exists but authenticator not yet populated
          console.error('  ⏳ Waiting for authenticator to be populated...');
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

  if (proofReceived) {
    throw new Error(`Timeout waiting for authenticator to be populated after ${timeoutMs}ms`);
  } else {
    throw new Error(`Timeout waiting for inclusion proof after ${timeoutMs}ms`);
  }
}

export function sendTokenCommand(program: Command): void {
  program
    .command('send-token')
    .description('Send a token to a recipient address (create offline transfer package or submit immediately)')
    .option('-f, --file <file>', 'Token file (TXF) to send (required)')
    .option('-r, --recipient <address>', 'Recipient address (required)')
    .option('-m, --message <message>', 'Optional transfer message')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('--local', 'Use local aggregator (http://localhost:3001)')
    .option('--production', 'Use production aggregator (https://gateway.unicity.network)')
    .option('--submit-now', 'Submit to network immediately (Pattern B) instead of creating offline package (Pattern A)')
    .option('-o, --output <file>', 'Output TXF file path')
    .option('--save', 'Save output to auto-generated filename')
    .option('--stdout', 'Output to STDOUT only (no file)')
    .action(async (options) => {
      try {
        // Validate required options
        if (!options.file) {
          console.error('Error: --file option is required');
          console.error('Usage: npm run send-token -- -f <token.txf> -r <recipient_address>');
          process.exit(1);
        }

        if (!options.recipient) {
          console.error('Error: --recipient option is required');
          console.error('Usage: npm run send-token -- -f <token.txf> -r <recipient_address>');
          process.exit(1);
        }

        // Determine endpoint
        let endpoint = options.endpoint;
        if (options.local) {
          endpoint = 'http://127.0.0.1:3000';
        } else if (options.production) {
          endpoint = 'https://gateway.unicity.network';
        }

        const isSubmitNow = options.submitNow || false;
        const patternName = isSubmitNow ? 'Pattern B (Submit Now)' : 'Pattern A (Offline Package)';

        console.error(`=== Send Token - ${patternName} ===\n`);

        // STEP 1: Load token from file
        console.error('Step 1: Loading token from file...');
        const tokenFileContent = fs.readFileSync(options.file, 'utf8');
        const tokenJson = JSON.parse(tokenFileContent);
        console.error(`  ✓ Token file loaded\n`);

        // STEP 1.5: Validate token structure BEFORE parsing with SDK
        console.error('Step 1.5: Validating token structure...');
        const jsonValidation = validateTokenProofsJson(tokenJson);

        if (!jsonValidation.valid) {
          console.error('\n❌ Token structure validation failed:');
          jsonValidation.errors.forEach(err => console.error(`  - ${err}`));
          console.error('\nCannot send a token with invalid structure.');
          process.exit(1);
        }

        if (jsonValidation.warnings.length > 0) {
          console.error('  ⚠ Warnings:');
          jsonValidation.warnings.forEach(warn => console.error(`    - ${warn}`));
        }

        console.error('  ✓ Token structure valid');
        console.error();

        // STEP 1.6: Load token with SDK
        console.error('Step 1.6: Parsing token with SDK...');
        const token = await Token.fromJSON(tokenJson);
        console.error(`  ✓ Token loaded: ${token.id.toJSON()}`);
        console.error(`  Token Type: ${token.type.toJSON()}\n`);

        // STEP 1.7: Load TrustBase and perform cryptographic proof validation
        console.error('Step 1.7: Loading trust base for proof validation...');
        const trustBase = await getCachedTrustBase({
          filePath: process.env.TRUSTBASE_PATH,
          useFallback: false
        });
        console.error(`  ✓ Trust base ready (Network ID: ${trustBase.networkId}, Epoch: ${trustBase.epoch})\n`);

        console.error('Step 1.8: Validating token proofs cryptographically...');
        const proofValidation = await validateTokenProofs(token, trustBase);

        if (!proofValidation.valid) {
          console.error('\n❌ Token proof validation failed:');
          proofValidation.errors.forEach(err => console.error(`  - ${err}`));
          console.error('\nCannot send a token with invalid proofs.');
          process.exit(1);
        }

        console.error('  ✓ Genesis proof signature verified');
        if (token.transactions && token.transactions.length > 0) {
          console.error(`  ✓ All transaction proofs verified (${token.transactions.length} transaction${token.transactions.length !== 1 ? 's' : ''})`);
        }

        if (proofValidation.warnings.length > 0) {
          console.error('  ⚠ Proof warnings:');
          proofValidation.warnings.forEach(warn => console.error(`    - ${warn}`));
        }
        console.error();

        // STEP 2: Parse recipient address
        console.error('Step 2: Parsing recipient address...');
        const recipientAddress = await AddressFactory.createAddress(options.recipient);
        console.error(`  ✓ Recipient: ${recipientAddress.address}\n`);

        // STEP 3: Get sender's secret
        console.error('Step 3: Getting sender secret...');
        const secret = await getSecret();
        const signingService = await SigningService.createFromSecret(secret);
        console.error(`  ✓ Signing service created`);
        console.error(`  Public Key: ${HexConverter.encode(signingService.publicKey)}\n`);

        // STEP 4: Generate salt for transfer
        console.error('Step 4: Generating transfer salt...');
        const salt = crypto.getRandomValues(new Uint8Array(32));
        console.error(`  ✓ Salt: ${HexConverter.encode(salt)}\n`);

        // STEP 5: Process optional message
        let messageBytes: Uint8Array | null = null;
        if (options.message) {
          messageBytes = new TextEncoder().encode(options.message);
          console.error('Step 5: Processing transfer message...');
          console.error(`  ✓ Message: "${options.message}"\n`);
        } else {
          console.error('Step 5: No transfer message provided\n');
        }

        // STEP 6: Create transfer commitment
        console.error('Step 6: Creating transfer commitment...');
        const transferCommitment = await TransferCommitment.create(
          token,
          recipientAddress,
          salt,
          null,  // recipientDataHash
          messageBytes,
          signingService
        );
        console.error(`  ✓ Transfer commitment created`);
        console.error(`  Request ID: ${transferCommitment.requestId.toJSON()}\n`);

        // Determine network type based on endpoint
        const network = endpoint.includes('localhost') ? 'test' :
                       endpoint.includes('gateway.unicity.network') ? 'production' : 'test';

        let extendedTxf: IExtendedTxfToken;

        if (isSubmitNow) {
          // PATTERN B: Submit to network immediately
          console.error('=== Pattern B: Submitting to Network ===\n');

          // Create clients
          const aggregatorClient = new AggregatorClient(endpoint);
          const client = new StateTransitionClient(aggregatorClient);

          // Submit commitment
          console.error('Step 7: Submitting transfer to network...');
          await client.submitTransferCommitment(transferCommitment);
          console.error(`  ✓ Transfer submitted\n`);

          // Wait for inclusion proof
          console.error('Step 8: Waiting for inclusion proof...');
          const inclusionProof = await waitInclusionProof(client, transferCommitment);
          console.error();

          // Create transfer transaction
          console.error('Step 9: Creating transfer transaction...');
          const transferTransaction = transferCommitment.toTransaction(inclusionProof);
          console.error(`  ✓ Transfer transaction created\n`);

          // Update token with new transaction
          console.error('Step 10: Building extended TXF (TRANSFERRED status)...');
          extendedTxf = {
            version: tokenJson.version || "2.0",
            state: tokenJson.state,
            genesis: tokenJson.genesis,
            transactions: [
              ...(tokenJson.transactions || []),
              transferTransaction.toJSON()
            ],
            nametags: tokenJson.nametags || [],
            status: TokenStatus.TRANSFERRED
          };
          console.error(`  ✓ Extended TXF created with TRANSFERRED status\n`);

        } else {
          // PATTERN A: Create offline transfer package
          console.error('=== Pattern A: Creating Offline Transfer Package ===\n');

          console.error('Step 7: Building offline transfer package...');

          // Get sender address from token genesis data (current owner)
          const senderAddress = token.genesis.data.recipient.address;

          // Create offline transfer package
          const offlinePackage: IOfflineTransferPackage = {
            version: "1.1",
            type: "offline_transfer",
            sender: {
              address: senderAddress,
              publicKey: Buffer.from(signingService.publicKey).toString('base64')
            },
            recipient: recipientAddress.address,
            commitment: {
              salt: Buffer.from(salt).toString('base64'),
              timestamp: Date.now()
            },
            network: network,
            commitmentData: JSON.stringify(transferCommitment.toJSON()),
            message: options.message || undefined
          };

          console.error(`  ✓ Offline package created\n`);

          // Create extended TXF with offline package
          console.error('Step 8: Building extended TXF with offline package...');
          extendedTxf = {
            version: tokenJson.version || "2.0",
            state: tokenJson.state,
            genesis: tokenJson.genesis,
            transactions: tokenJson.transactions || [],
            nametags: tokenJson.nametags || [],
            offlineTransfer: offlinePackage,
            status: TokenStatus.PENDING
          };
          console.error(`  ✓ Extended TXF created with PENDING status\n`);
        }

        // STEP FINAL: Sanitize and output
        console.error('Final Step: Sanitizing and preparing output...');
        const sanitizedTxf = sanitizeForExport(extendedTxf);
        const outputJson = JSON.stringify(sanitizedTxf, null, 2);
        console.error(`  ✓ Output sanitized (private keys removed)\n`);

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
          const pattern = isSubmitNow ? 'sent' : 'transfer';
          const recipientPrefix = options.recipient.replace(/^[A-Z]+:\/\//, '').substring(0, 10);
          outputFile = `${dateStr}_${timeStr}_${timestamp}_${pattern}_${recipientPrefix}.txf`;
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

        console.error('\n=== Transfer Complete ===');
        console.error(`Token ID: ${token.id.toJSON()}`);
        console.error(`Recipient: ${recipientAddress.address}`);
        console.error(`Status: ${sanitizedTxf.status}`);

        if (!isSubmitNow) {
          console.error('\n💡 Offline transfer package created!');
          console.error('   Send this file to the recipient to complete the transfer.');
          console.error('   Recipient can submit using: npm run complete-transfer -- -f <file>');
        } else {
          console.error('\n✅ Transfer submitted and confirmed on network!');
          console.error('   Token has been transferred to recipient.');
        }

      } catch (error) {
        console.error('\n❌ Error sending token:');
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
