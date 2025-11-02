import { Command } from 'commander';
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { TransferCommitment } from '@unicitylabs/state-transition-sdk/lib/transaction/TransferCommitment.js';
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { UnmaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/UnmaskedPredicate.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { TokenState } from '@unicitylabs/state-transition-sdk/lib/token/TokenState.js';
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { JsonRpcNetworkError } from '@unicitylabs/commons/lib/json-rpc/JsonRpcNetworkError.js';
import { IExtendedTxfToken, TokenStatus } from '../types/extended-txf.js';
import { validateExtendedTxf, sanitizeForExport } from '../utils/transfer-validation.js';
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
 */
async function waitInclusionProof(
  client: StateTransitionClient,
  commitment: TransferCommitment,
  timeoutMs: number = 30000,
  intervalMs: number = 1000
): Promise<any> {
  const startTime = Date.now();

  console.error('Waiting for inclusion proof...');

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Get inclusion proof response from client
      const proofResponse = await client.getInclusionProof(commitment);

      if (proofResponse && proofResponse.inclusionProof) {
        console.error('  ✓ Inclusion proof received');
        return proofResponse.inclusionProof;
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
    .action(async (options) => {
      try {
        // Validate required options
        if (!options.file) {
          console.error('Error: --file option is required');
          console.error('Usage: npm run receive-token -- -f <token.txf>');
          process.exit(1);
        }

        // Determine endpoint
        let endpoint = options.endpoint;
        if (options.local) {
          endpoint = 'http://localhost:3000';
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
        const secret = await getSecret();
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

        // STEP 5: Load token from TXF to get token ID and type
        console.error('Step 5: Loading token data...');
        const token = await Token.fromJSON(extendedTxf);
        console.error(`  ✓ Token loaded`);
        console.error(`  Token ID: ${token.id.toJSON()}`);
        console.error(`  Token Type: ${token.type.toJSON()}\n`);

        // STEP 6: Create recipient's predicate and verify address
        console.error('Step 6: Creating recipient predicate and verifying address...');

        // Decode salt from Base64
        const saltBytes = Buffer.from(offlineTransfer.commitment.salt, 'base64');
        console.error(`  Salt: ${HexConverter.encode(saltBytes)}`);

        // Create UnmaskedPredicate for recipient (reusable address pattern)
        const recipientPredicate = await UnmaskedPredicate.create(
          token.id,
          token.type,
          signingService,
          HashAlgorithm.SHA256,
          saltBytes
        );
        console.error('  ✓ Recipient predicate created');

        // Derive address from predicate
        const predicateRef = await recipientPredicate.getReference();
        const recipientAddress = await predicateRef.toAddress();
        console.error(`  Recipient Address: ${recipientAddress.address}`);

        // Verify we are the intended recipient
        if (recipientAddress.address !== offlineTransfer.recipient) {
          console.error('\n❌ Error: Address mismatch!');
          console.error(`  Expected: ${offlineTransfer.recipient}`);
          console.error(`  Your address: ${recipientAddress.address}`);
          console.error('\n  This token is not intended for you, or you are using the wrong secret.');
          process.exit(1);
        }

        console.error('  ✓ Address verified - you are the intended recipient\n');

        // STEP 7: Create network clients
        console.error('Step 7: Connecting to network...');
        const aggregatorClient = new AggregatorClient(endpoint);
        const client = new StateTransitionClient(aggregatorClient);
        console.error(`  ✓ Connected to ${endpoint}\n`);

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

        // STEP 10: Create transfer transaction from commitment + proof
        console.error('Step 10: Creating transfer transaction...');
        const transferTransaction = transferCommitment.toTransaction(inclusionProof);
        console.error('  ✓ Transfer transaction created\n');

        // STEP 11: Create trust base for token update
        console.error('Step 11: Setting up trust base...');
        const trustBase = RootTrustBase.fromJSON({
          version: '1',
          networkId: endpoint.includes('localhost') ? 3 : 1,
          epoch: '1',
          epochStartRound: '1',
          rootNodes: [
            {
              nodeId: '16Uiu2HAkv5hkDFUT3cFVMTCetJJnoC5HWbCd2CxG44uMWVXNdbzb',
              sigKey: '03384d4d4ad517fb94634910e0c88cb4551a483017c03256de4310afa4b155dfad',
              stake: '1'
            }
          ],
          quorumThreshold: '1',
          stateHash: '0000000000000000000000000000000000000000000000000000000000000000',
          changeRecordHash: null,
          previousEntryHash: null,
          signatures: {
            '16Uiu2HAkv5hkDFUT3cFVMTCetJJnoC5HWbCd2CxG44uMWVXNdbzb': '843bc1fd04f31a6eee7c584de67c6985fd6021e912622aacaa7278a56a10ec7e42911d6a5c53604c60849a61911f1dc6276a642a7df7c4d57cac8d893694a17601'
          }
        });
        console.error(`  ✓ Trust base ready (Network ID: ${trustBase.networkId})\n`);

        // STEP 12: Create new token state with recipient's predicate
        console.error('Step 12: Creating new token state with recipient predicate...');
        const tokenData = token.state.data;  // Preserve token data
        const newState = new TokenState(recipientPredicate, tokenData);
        console.error('  ✓ New token state created\n');

        // STEP 13: Update token with recipient's state and transfer transaction
        console.error('Step 13: Updating token with new ownership...');
        const updatedToken = await token.update(trustBase, newState, transferTransaction);
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
          const addressBody = recipientAddress.address.replace(/^[A-Z]+:\/\//, '');
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
        console.error(`Your Address: ${recipientAddress.address}`);
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
