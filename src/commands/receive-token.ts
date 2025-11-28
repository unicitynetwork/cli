import { Command } from 'commander';
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { TransferCommitment } from '@unicitylabs/state-transition-sdk/lib/transaction/TransferCommitment.js';
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { UnmaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/UnmaskedPredicate.js';
import { MaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/MaskedPredicate.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { TokenState } from '@unicitylabs/state-transition-sdk/lib/token/TokenState.js';
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import { JsonRpcNetworkError } from '@unicitylabs/state-transition-sdk/lib/api/json-rpc/JsonRpcNetworkError.js';
import { IExtendedTxfToken, TokenStatus } from '../types/extended-txf.js';
import { validateExtendedTxf, sanitizeForExport } from '../utils/transfer-validation.js';
import { deserializeTxf } from '../utils/txf-serialization.js';
import { checkOwnershipStatus, extractOwnerInfo } from '../utils/ownership-verification.js';
import { validateInclusionProof, validateTokenProofsJson, validateTokenProofs } from '../utils/proof-validation.js';
import { getCachedTrustBase } from '../utils/trustbase-loader.js';
import { validateSecret, validateFilePath, throwValidationError } from '../utils/input-validation.js';
import { detectScenario, extractTransferDetails, resolveTokenProofs } from '../utils/state-resolution.js';
import { formatReceiveOutput } from '../utils/output-formatter.js';
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
  intervalMs: number = 1000,
  verbose: boolean = false
): Promise<any> {
  const startTime = Date.now();
  let proofReceived = false;

  if (verbose) console.error('Waiting for inclusion proof...');

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
          if (verbose) console.error('  ✓ Inclusion proof received from aggregator (complete with authenticator and transactionHash)');
          return proof;
        }
        // If proof exists but is incomplete, continue polling
        if (!proofReceived) {
          if (verbose) console.error(`  ⏳ Proof found but incomplete - authenticator: ${hasAuth}, transactionHash: ${hasTxHash}`);
          proofReceived = true;
        }
      }
    } catch (err) {
      if (err instanceof JsonRpcNetworkError && err.status === 404) {
        // Continue polling - proof not available yet
      } else {
        // Log other errors but continue polling
        if (verbose) console.error('Error getting inclusion proof (will retry):', err instanceof Error ? err.message : String(err));
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
    .description('Receive a token transfer (verify cryptographically and update state)')
    .option('-f, --file <file>', 'Extended TXF file with transfer transaction (required)')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('-n, --nonce <nonce>', 'Nonce for masked address (required if receiving at masked address)')
    .option('--local', 'Use local aggregator (http://localhost:3000)')
    .option('--production', 'Use production aggregator (https://gateway.unicity.network)')
    .option('--offline', 'Offline mode: verify locally without aggregator (no proof resolution or submission)')
    .option('-o, --output <file>', 'Output TXF file path')
    .option('--save', 'Save output to auto-generated filename')
    .option('--stdout', 'Output to STDOUT only (no file)')
    .option('--state-data <json>', 'State data (JSON string) for the received token - REQUIRED if sender specified recipient data hash')
    .option('--unsafe-secret', 'Skip secret strength validation (for development/testing only)')
    .option('-v, --verbose', 'Show detailed step-by-step output')
    .option('--json', 'Output TXF JSON to stdout (no status messages)')
    .action(async (options) => {
      const verbose = options.verbose || false;
      const jsonOutput = options.json || false;
      const log = (msg: string) => { if (verbose) console.error(msg); };

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

        const isOfflineMode = options.offline || false;

        log(`=== Receive Token${isOfflineMode ? ' (Offline Mode)' : ''} ===\n`);

        // STEP 1: Load and validate extended TXF file
        log('Step 1: Loading extended TXF file...');
        const fileContent = fs.readFileSync(options.file, 'utf8');
        const rawJson = JSON.parse(fileContent);
        const hadNullState = rawJson.state === null;
        const extendedTxf: IExtendedTxfToken = deserializeTxf(rawJson);
        log(`  ✓ File loaded: ${options.file}`);
        if (hadNullState && extendedTxf.state !== null) {
          log(`  ✓ State reconstructed from sourceState (in-transit token)\n`);
        } else {
          log('');
        }

        // STEP 2: Validate transfer package
        log('Step 2: Validating transfer package...');
        // Allow uncommitted transactions in both online and offline modes
        // Online mode: Will submit to aggregator to get proof
        // Offline mode: Will verify locally without submission
        const validation = await validateExtendedTxf(extendedTxf, { allowUncommitted: true });

        if (!validation.isValid) {
          console.error('\n❌ Validation failed:');
          validation.errors?.forEach(err => console.error(`  - ${err}`));
          process.exit(1);
        }

        // Detect transfer scenario (only for online mode)
        const scenario = !isOfflineMode ? detectScenario(extendedTxf) : null;
        if (scenario) {
          log(`  Transfer scenario detected: ${scenario}`);
        }

        if (validation.warnings && validation.warnings.length > 0) {
          log('  ⚠ Warnings:');
          validation.warnings.forEach(warn => log(`    - ${warn}`));
        }

        log('  ✓ Transfer package validated');

        // STEP 2.5: Validate token proofs before processing
        log('\nStep 2.5: Validating token proofs...');
        // Allow uncommitted proofs - they will be resolved in NEEDS_RESOLUTION scenario
        const proofValidation = validateTokenProofsJson(extendedTxf, { allowUncommitted: true });

        if (!proofValidation.valid) {
          console.error('\n❌ Token proof validation failed:');
          proofValidation.errors.forEach(err => console.error(`  - ${err}`));
          console.error('\nCannot receive a token with invalid proofs.');
          process.exit(1);
        }

        if (proofValidation.warnings.length > 0) {
          log('  ⚠ Proof warnings:');
          proofValidation.warnings.forEach(warn => log(`    - ${warn}`));
        }

        log('  ✓ Token proofs validated');

        // STEP 2.6: CRITICAL SECURITY - Perform cryptographic proof validation
        // Skip for tokens with uncommitted transactions (will validate after submission)
        const hasUncommittedTx = extendedTxf.transactions && extendedTxf.transactions.length > 0 &&
          extendedTxf.transactions.some(tx => !tx.inclusionProof || !tx.inclusionProof.authenticator);

        if (!hasUncommittedTx) {
          log('\nStep 2.6: Cryptographic proof verification...');

          try {
            // Parse token with SDK for cryptographic validation
            const token = await Token.fromJSON(extendedTxf);

            // Load trust base for verification
            const trustBase = await getCachedTrustBase({
              filePath: process.env.TRUSTBASE_PATH,
              useFallback: false,
              silent: !verbose
            });

            // Perform comprehensive cryptographic validation
            const cryptoValidation = await validateTokenProofs(token, trustBase);

            if (!cryptoValidation.valid) {
              console.error('\n❌ Cryptographic proof verification failed:');
              cryptoValidation.errors.forEach(err => console.error(`  - ${err}`));
              console.error('\nToken has invalid cryptographic proofs - cannot accept this transfer.');
              console.error('This could indicate:');
              console.error('  - Tampered genesis or transaction proofs');
              console.error('  - Invalid signatures');
              console.error('  - Corrupted merkle paths');
              console.error('  - Modified state data');
              process.exit(1);
            }

            log('  ✓ All cryptographic proofs verified');
            log('  ✓ Genesis proof signature valid');
            log('  ✓ Merkle path verification passed');
            log('  ✓ State integrity confirmed');

            if (cryptoValidation.warnings.length > 0) {
              log('  ⚠ Warnings:');
              cryptoValidation.warnings.forEach(warn => log(`    - ${warn}`));
            }
          } catch (err) {
            console.error('\n❌ Failed to verify token cryptographically:');
            console.error(`  ${err instanceof Error ? err.message : String(err)}`);
            console.error('\nCannot accept transfer with unverifiable token.');
            process.exit(1);
          }
        } else {
          log('\nStep 2.6: Cryptographic proof verification...');
          log('  ⚠ Skipping verification for uncommitted transaction');
          log('  ℹ️  Will verify after transaction submission\n');
        }

        // ========================================
        // HANDLE OFFLINE MODE
        // ========================================

        if (isOfflineMode) {
          log('\n=== Offline Mode: Local Verification Only ===');
          log('  ℹ️  No network calls will be made');
          log('  ℹ️  Proofs will not be resolved or submitted');
          log('  ℹ️  Final state will remain PENDING\n');

          try {
            // Parse token with SDK
            const token = await Token.fromJSON(extendedTxf);

            // STEP 3: Extract transfer details from last transaction
            if (!extendedTxf.transactions || extendedTxf.transactions.length === 0) {
              console.error('\n❌ Error: No transactions found in TXF file');
              console.error('Cannot receive token without transfer transaction.');
              process.exit(1);
            }

            const lastTx = extendedTxf.transactions[extendedTxf.transactions.length - 1];
            const transferDetails = extractTransferDetails(lastTx);

            log(`  Recipient: ${transferDetails.recipient}`);
            if (transferDetails.message) {
              log(`  Message: "${transferDetails.message}"`);
            }
            log('');

            // STEP 4: Get recipient's secret
            log('Step 3: Getting recipient secret...');
            const secret = await getSecret(options.unsafeSecret);
            const signingService = await SigningService.createFromSecret(secret);
            log(`  ✓ Signing service created`);
            log(`  Public Key: ${HexConverter.encode(signingService.publicKey)}\n`);

            // STEP 5: Create recipient predicate using transfer salt
            log('Step 4: Creating recipient predicate...');

            let recipientPredicate;
            if (options.nonce) {
              // Masked predicate (one-time address)
              const nonceBytes = HexConverter.decode(options.nonce);
              recipientPredicate = await MaskedPredicate.create(
                token.id,
                token.type,
                signingService,
                HashAlgorithm.SHA256,
                nonceBytes
              );
              log('  Using MASKED predicate (one-time address)');
            } else {
              // Unmasked predicate (reusable address)
              recipientPredicate = await UnmaskedPredicate.create(
                token.id,
                token.type,
                signingService,
                HashAlgorithm.SHA256,
                transferDetails.salt
              );
              log('  Using UNMASKED predicate (reusable address)');
            }

            log('  ✓ Predicate created\n');

            // STEP 6: Verify recipient address matches
            log('Step 5: Verifying recipient address...');
            const predicateRef = await recipientPredicate.getReference();
            const actualAddress = await predicateRef.toAddress();

            log(`  Expected: ${transferDetails.recipient}`);
            log(`  Actual:   ${actualAddress.address}`);

            if (actualAddress.address !== transferDetails.recipient) {
              console.error('\n❌ Error: Address mismatch!');
              console.error('Your secret does not match the intended recipient.');
              console.error('');
              console.error('Possible causes:');
              console.error('  - Wrong secret provided');
              console.error('  - Wrong nonce (if using masked predicate)');
              console.error('  - Transfer intended for different recipient');
              process.exit(1);
            }

            log('  ✓ Address matches\n');

            // STEP 7: Validate state data (if any)
            log('Step 6: Validating state data...');

            let stateDataBytes: Uint8Array;

            if (transferDetails.recipientDataHash !== null) {
              // Transaction has data commitment - require matching data
              if (!options.stateData) {
                console.error('\n❌ Error: Transaction requires state data');
                console.error('This transfer includes committed state data.');
                console.error('Provide it with: --state-data "<data>"');
                process.exit(1);
              }

              // Process and hash the provided data
              stateDataBytes = new TextEncoder().encode(options.stateData);
              const hasher = new DataHasher(HashAlgorithm.SHA256);
              const dataHash = await hasher.update(stateDataBytes).digest();
              const actualHash = HexConverter.encode(dataHash.imprint);

              // Compare with committed hash
              if (actualHash !== transferDetails.recipientDataHash.replace('0000', '')) {
                console.error('\n❌ Error: State data hash mismatch');
                console.error(`  Expected: ${transferDetails.recipientDataHash}`);
                console.error(`  Actual:   0000${actualHash}`);
                console.error('\nThe provided state data does not match the commitment.');
                process.exit(1);
              }

              log('  ✓ State data validated');
            } else {
              // No data commitment - recipient has full control over state data
              if (options.stateData) {
                // Recipient provided explicit data
                stateDataBytes = new TextEncoder().encode(options.stateData);
                log('  ✓ Using recipient-provided state data');
              } else {
                // No data commitment and no data provided - use empty state data
                stateDataBytes = new Uint8Array(0);
                log('  No state data (empty)');
              }
            }

            log('');

            // STEP 8: Create new token state
            log('Step 7: Creating new token state...');
            const newState = new TokenState(recipientPredicate, stateDataBytes);
            log('  ✓ New state created\n');

            // STEP 9: Build final TXF (PENDING status - not submitted)
            log('Step 8: Building final TXF...');

            const finalTxf: IExtendedTxfToken = {
              version: extendedTxf.version || "2.0",
              state: newState.toJSON(),
              genesis: extendedTxf.genesis,
              transactions: extendedTxf.transactions, // Keep uncommitted transaction
              nametags: extendedTxf.nametags || [],
              status: TokenStatus.PENDING // PENDING because not submitted to aggregator
            };

            const tokenJson = JSON.stringify(finalTxf, null, 2);
            log('  ✓ Final TXF structure created (status: PENDING)\n');
            log('  ℹ️  Transaction not submitted - proof resolution needed later\n');

            // STEP 10: Save and output
            let outputFile: string | undefined;
            if (options.output) {
              try {
                fs.writeFileSync(options.output, tokenJson, 'utf-8');
                outputFile = options.output;
                log(`✅ Token saved to ${options.output}`);
                log(`   File size: ${tokenJson.length} bytes\n`);
              } catch (err) {
                console.error(`❌ Error writing output file: ${err instanceof Error ? err.message : String(err)}`);
                throw err;
              }
            }

            // Output based on flags
            if (jsonOutput) {
              console.log(tokenJson);
            } else if (!options.output || options.stdout) {
              console.log(tokenJson);
            }

            if (!jsonOutput) {
              console.log(formatReceiveOutput(finalTxf, outputFile));
            }

            process.exit(0);

          } catch (error) {
            console.error('\n❌ Failed to process offline transfer:');
            console.error(`  ${error instanceof Error ? error.message : String(error)}`);
            process.exit(1);
          }
        }

        // ========================================
        // HANDLE ONLINE SCENARIOS
        // ========================================

        // Declare variables to be shared between NEEDS_RESOLUTION and ONLINE_COMPLETE
        let signingService: SigningService | undefined;
        let recipientPredicate: UnmaskedPredicate | MaskedPredicate | undefined;

        if (scenario === 'NEEDS_RESOLUTION') {
          log('\n=== Processing Uncommitted Transaction ===');

          try {
            // Check if the last transaction is truly uncommitted (no authenticator at all)
            // vs just missing transactionHash/merkleTreePath (can be resolved)
            if (!extendedTxf.transactions || extendedTxf.transactions.length === 0) {
              console.error('\n❌ Error: No transactions found in TXF file');
              console.error('Cannot receive token without transfer transaction.');
              process.exit(1);
            }

            const lastTx = extendedTxf.transactions[extendedTxf.transactions.length - 1];
            const hasAuthenticator = lastTx.inclusionProof && lastTx.inclusionProof.authenticator;

            if (hasAuthenticator) {
              // Transaction was submitted but proofs are incomplete - RESOLVE from aggregator
              log('Transaction was submitted - resolving proofs from aggregator...');

              const aggregatorClient = new AggregatorClient(endpoint);
              const trustBase = await getCachedTrustBase({
                filePath: process.env.TRUSTBASE_PATH,
                useFallback: false,
                silent: !verbose
              });

              const resolvedTxfJson = await resolveTokenProofs(extendedTxf, aggregatorClient, trustBase);
              extendedTxf.genesis = resolvedTxfJson.genesis;
              extendedTxf.transactions = resolvedTxfJson.transactions || [];

              log('  ✓ Proofs resolved\n');

              // Now continue to ONLINE_COMPLETE handling
            } else {
              // Transaction is truly uncommitted (no authenticator) - SUBMIT to aggregator
              log('Uncommitted transaction detected - submitting to aggregator...\n');

              // Extract transfer details from uncommitted transaction
              const transferDetails = extractTransferDetails(lastTx);
              log(`  Recipient: ${transferDetails.recipient}`);
              if (transferDetails.message) {
                log(`  Message: "${transferDetails.message}"`);
              }
              log('');

              // CRITICAL: Check if the transaction has the sender's pre-signed commitment
              if (!lastTx.commitment) {
                console.error('\n❌ Error: Uncommitted transaction missing sender\'s commitment');
                console.error('The transaction was created without storing the sender\'s signature.');
                console.error('This is required for offline transfers.');
                console.error('\nThe sender needs to recreate the transfer using the latest version of send-token.');
                process.exit(1);
              }

              log('Loading sender\'s pre-signed commitment...');

              // Reconstruct the TransferCommitment from the stored JSON
              // This commitment was signed by the sender and cannot be recreated by the recipient
              const transferCommitment = await TransferCommitment.fromJSON(lastTx.commitment);
              log('  ✓ Sender\'s commitment loaded');
              log(`  Request ID: ${transferCommitment.requestId.toJSON()}\n`);

              // Get recipient secret ONLY for address verification
              log('Getting recipient secret for address verification...');
              const secret = await getSecret(options.unsafeSecret);
              signingService = await SigningService.createFromSecret(secret);
              log(`  ✓ Public Key: ${HexConverter.encode(signingService.publicKey)}\n`);

              // Parse token to get ID and type for predicate creation
              const genesis = await Token.fromJSON({
                version: extendedTxf.version,
                state: extendedTxf.state,
                genesis: extendedTxf.genesis,
                transactions: extendedTxf.transactions.slice(0, -1),
                nametags: extendedTxf.nametags || []
              });

              // Create recipient predicate to verify address
              log('Verifying recipient address...');
              if (options.nonce) {
                const nonceBytes = HexConverter.decode(options.nonce);
                recipientPredicate = await MaskedPredicate.create(
                  genesis.id,
                  genesis.type,
                  signingService,
                  HashAlgorithm.SHA256,
                  nonceBytes
                );
              } else {
                recipientPredicate = await UnmaskedPredicate.create(
                  genesis.id,
                  genesis.type,
                  signingService,
                  HashAlgorithm.SHA256,
                  transferDetails.salt
                );
              }

              const predicateRef = await recipientPredicate.getReference();
              const recipientAddress = await predicateRef.toAddress();
              if (recipientAddress.address !== transferDetails.recipient) {
                console.error('\n❌ Error: Address mismatch!');
                console.error(`Expected: ${transferDetails.recipient}`);
                console.error(`Actual:   ${recipientAddress.address}`);
                process.exit(1);
              }
              log('  ✓ Address verified - you are the intended recipient\n');

              // Connect to aggregator
              const aggregatorClient = new AggregatorClient(endpoint);
              const client = new StateTransitionClient(aggregatorClient);
              const trustBase = await getCachedTrustBase({
                filePath: process.env.TRUSTBASE_PATH,
                useFallback: false,
                silent: !verbose
              });

              // Submit commitment
              log('Submitting to aggregator...');
              const submitResponse = await client.submitTransferCommitment(transferCommitment);

              if (submitResponse.status !== 'SUCCESS') {
                console.error(`\n❌ Submission failed: ${submitResponse.status}`);
                process.exit(1);
              }
              log('  ✓ Submitted\n');

              // Wait for proof
              log('Waiting for inclusion proof...');
              const inclusionProof = await waitInclusionProof(client, transferCommitment, 60000, 1000, verbose);
              log('  ✓ Proof received\n');

              // Validate proof
              const proofValidation2 = await validateInclusionProof(
                inclusionProof,
                transferCommitment.requestId,
                trustBase
              );
              if (!proofValidation2.valid) {
                console.error('\n❌ Proof validation failed');
                process.exit(1);
              }
              log('  ✓ Proof validated\n');

              // Create transfer transaction
              log('Creating transfer transaction...');
              const transferTransaction = transferCommitment.toTransaction(inclusionProof);
              log('  ✓ Transaction created\n');

              // Update token with new transaction
              const transferTxJson = await transferTransaction.toJSON();
              extendedTxf.transactions[extendedTxf.transactions.length - 1] = transferTxJson;

              log('  ✓ Transaction updated with proof\n');
              // Continue to ONLINE_COMPLETE handling
            }

            // Now that all proofs are resolved, perform full cryptographic validation
            log('Performing cryptographic validation on resolved token...');
            try {
              const validatedToken = await Token.fromJSON(extendedTxf);
              const trustBase = await getCachedTrustBase({
                filePath: process.env.TRUSTBASE_PATH,
                useFallback: false,
                silent: !verbose
              });

              const cryptoValidation = await validateTokenProofs(validatedToken, trustBase);

              if (!cryptoValidation.valid) {
                console.error('\n❌ Cryptographic proof verification failed after resolution:');
                cryptoValidation.errors.forEach(err => console.error(`  - ${err}`));
                console.error('\nToken has invalid cryptographic proofs - cannot accept this transfer.');
                process.exit(1);
              }

              log('  ✓ All cryptographic proofs verified');
              log('  ✓ Genesis proof signature valid');
              log('  ✓ All transaction proofs verified');
              log('  ✓ State integrity confirmed\n');

              if (cryptoValidation.warnings.length > 0) {
                log('  ⚠ Warnings:');
                cryptoValidation.warnings.forEach(warn => log(`    - ${warn}`));
              }
            } catch (err) {
              console.error('\n❌ Failed to verify resolved token cryptographically:');
              console.error(`  ${err instanceof Error ? err.message : String(err)}`);
              console.error('\nCannot accept transfer with unverifiable token.');
              process.exit(1);
            }

          } catch (error) {
            console.error('\n❌ Failed to process uncommitted transaction:');
            console.error(`  ${error instanceof Error ? error.message : String(error)}`);
            process.exit(1);
          }
        }

        if (scenario === 'ONLINE_COMPLETE' || scenario === 'NEEDS_RESOLUTION') {
          log('\n=== Receiving Online Transfer ===');

          try {
            // Parse token with SDK
            const token = await Token.fromJSON(extendedTxf);

            // STEP 3: Extract transfer details from last transaction
            if (!extendedTxf.transactions || extendedTxf.transactions.length === 0) {
              console.error('\n❌ Error: No transactions found in online transfer');
              console.error('File appears to be incomplete or corrupted.');
              process.exit(1);
            }

            const lastTx = extendedTxf.transactions[extendedTxf.transactions.length - 1];
            const transferDetails = extractTransferDetails(lastTx);

            log(`  Recipient: ${transferDetails.recipient}`);
            if (transferDetails.message) {
              log(`  Message: "${transferDetails.message}"`);
            }
            log('');

            // STEP 4: Get recipient's secret (skip if already obtained in NEEDS_RESOLUTION)
            if (!signingService) {
              log('Step 3: Getting recipient secret...');
              const secret = await getSecret(options.unsafeSecret);
              signingService = await SigningService.createFromSecret(secret);
              log(`  ✓ Signing service created`);
              log(`  Public Key: ${HexConverter.encode(signingService.publicKey)}\n`);
            } else {
              log('Step 3: Using recipient secret from previous step...');
              log(`  ✓ Signing service already created\n`);
            }

            // STEP 5: Create recipient predicate using transfer salt (skip if already created)
            if (!recipientPredicate) {
              log('Step 4: Creating recipient predicate...');

              if (options.nonce) {
                // Masked predicate (one-time address)
                const nonceBytes = HexConverter.decode(options.nonce);
                recipientPredicate = await MaskedPredicate.create(
                  token.id,
                  token.type,
                  signingService,
                  HashAlgorithm.SHA256,
                  nonceBytes
                );
                log('  Using MASKED predicate (one-time address)');
              } else {
                // Unmasked predicate (reusable address)
                recipientPredicate = await UnmaskedPredicate.create(
                  token.id,
                  token.type,
                  signingService,
                  HashAlgorithm.SHA256,
                  transferDetails.salt
                );
                log('  Using UNMASKED predicate (reusable address)');
              }

              log('  ✓ Predicate created\n');
            } else {
              log('Step 4: Using recipient predicate from previous step...');
              log('  ✓ Predicate already created\n');
            }

            // STEP 6: Verify recipient address matches
            log('Step 5: Verifying recipient address...');
            const predicateRef = await recipientPredicate.getReference();
            const actualAddress = await predicateRef.toAddress();

            log(`  Expected: ${transferDetails.recipient}`);
            log(`  Actual:   ${actualAddress.address}`);

            if (actualAddress.address !== transferDetails.recipient) {
              console.error('\n❌ Error: Address mismatch!');
              console.error('Your secret does not match the intended recipient.');
              console.error('');
              console.error('Possible causes:');
              console.error('  - Wrong secret provided');
              console.error('  - Wrong nonce (if using masked predicate)');
              console.error('  - Transfer intended for different recipient');
              process.exit(1);
            }

            log('  ✓ Address matches\n');

            // STEP 7: Validate state data (if any)
            log('Step 6: Validating state data...');

            let stateDataBytes: Uint8Array;

            if (transferDetails.recipientDataHash !== null) {
              // Transaction has data commitment - require matching data
              if (!options.stateData) {
                console.error('\n❌ Error: Transaction requires state data');
                console.error('This transfer includes committed state data.');
                console.error('Provide it with: --state-data "<data>"');
                process.exit(1);
              }

              // Process and hash the provided data
              stateDataBytes = new TextEncoder().encode(options.stateData);
              const hasher = new DataHasher(HashAlgorithm.SHA256);
              const dataHash = await hasher.update(stateDataBytes).digest();
              const actualHash = HexConverter.encode(dataHash.imprint);

              // Compare with committed hash
              if (actualHash !== transferDetails.recipientDataHash.replace('0000', '')) {
                console.error('\n❌ Error: State data hash mismatch');
                console.error(`  Expected: ${transferDetails.recipientDataHash}`);
                console.error(`  Actual:   0000${actualHash}`);
                console.error('\nThe provided state data does not match the commitment.');
                process.exit(1);
              }

              log('  ✓ State data validated');
            } else {
              // No data commitment - recipient has full control over state data
              if (options.stateData) {
                // Recipient provided explicit data
                stateDataBytes = new TextEncoder().encode(options.stateData);
                log('  ✓ Using recipient-provided state data');
              } else {
                // No data commitment and no data provided - use empty state data
                stateDataBytes = new Uint8Array(0);
                log('  No state data (empty)');
              }
            }

            log('');

            // STEP 8: Create new token state
            log('Step 7: Creating new token state...');
            const newState = new TokenState(recipientPredicate, stateDataBytes);
            log('  ✓ New state created\n');

            // STEP 9: Build final TXF
            log('Step 8: Building final TXF...');

            const finalTxf: IExtendedTxfToken = {
              version: extendedTxf.version || "2.0",
              state: newState.toJSON(),
              genesis: extendedTxf.genesis,
              transactions: extendedTxf.transactions,
              nametags: extendedTxf.nametags || [],
              status: TokenStatus.CONFIRMED
            };

            const tokenJson = JSON.stringify(finalTxf, null, 2);
            log('  ✓ Final TXF structure created\n');

            // STEP 10: Save and output
            let outputFile: string | undefined;
            if (options.output) {
              try {
                fs.writeFileSync(options.output, tokenJson, 'utf-8');
                outputFile = options.output;
                log(`✅ Token saved to ${options.output}`);
                log(`   File size: ${tokenJson.length} bytes\n`);
              } catch (err) {
                console.error(`❌ Error writing output file: ${err instanceof Error ? err.message : String(err)}`);
                throw err;
              }
            }

            // Output based on flags
            if (jsonOutput) {
              console.log(tokenJson);
            } else if (!options.output || options.stdout) {
              console.log(tokenJson);
            }

            if (!jsonOutput) {
              console.log(formatReceiveOutput(finalTxf, outputFile));
            }

            process.exit(0);

          } catch (error) {
            console.error('\n❌ Failed to receive online transfer:');
            console.error(`  ${error instanceof Error ? error.message : String(error)}`);
            process.exit(1);
          }
        }


      } catch (error) {
        console.error('\n❌ Error receiving token:');
        if (error instanceof Error) {
          console.error(`  ${error.message}\n`);

          // Only show stack trace in debug mode
          if (process.env.DEBUG && error.stack) {
            console.error('\nDebug Stack Trace:');
            console.error(error.stack);
          }
        } else {
          console.error(`  ${JSON.stringify(error, null, 2)}\n`);
        }
        process.exit(1);
      }
    });
}
