import { Command } from 'commander';
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { getNetworkErrorMessage } from '../utils/error-handling.js';
import { TransferCommitment } from '@unicitylabs/state-transition-sdk/lib/transaction/TransferCommitment.js';
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { AddressFactory } from '@unicitylabs/state-transition-sdk/lib/address/AddressFactory.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import { DataHash } from '@unicitylabs/state-transition-sdk/lib/hash/DataHash.js';
import { JsonRpcNetworkError } from '@unicitylabs/state-transition-sdk/lib/api/json-rpc/JsonRpcNetworkError.js';
import { IExtendedTxfToken, TokenStatus } from '../types/extended-txf.js';
import { sanitizeForExport } from '../utils/transfer-validation.js';
import { serializeTxf } from '../utils/txf-serialization.js';
import { validateTokenProofs, validateTokenProofsJson } from '../utils/proof-validation.js';
import { getCachedTrustBase } from '../utils/trustbase-loader.js';
import { extractOwnerInfo } from '../utils/ownership-verification.js';
import { validateAddress, validateSecret, validateFilePath, validateDataHash, throwValidationError } from '../utils/input-validation.js';
import { formatSendOutput } from '../utils/output-formatter.js';
import { readTokenFromTxf, writeTokenToTxf } from '../utils/multi-token-txf.js';
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
  const validation = validateSecret(secret, 'send-token', skipValidation);
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

/**
 * Verify that the provided secret matches the token owner
 * Extracts owner public key from predicate and compares with derived key
 */
async function verifyOwnership(
  token: Token<any>,
  tokenJson: any,
  signingService: SigningService,
  skipValidation: boolean,
  verbose: boolean = false
): Promise<void> {
  if (skipValidation) {
    if (verbose) console.error('  ⚠️  Ownership verification SKIPPED (--skip-validation flag)\n');
    return;
  }

  if (verbose) console.error('Step 3.5: Verifying token ownership...');

  // Extract owner info from token's current state predicate
  const predicateHex = tokenJson.state?.predicate;

  if (!predicateHex) {
    throw new Error('Cannot verify ownership: token has no predicate');
  }

  const ownerInfo = extractOwnerInfo(predicateHex);

  if (!ownerInfo) {
    throw new Error('Cannot verify ownership: failed to extract owner information from predicate');
  }

  // Warn if masked predicate (may require nonce)
  if (ownerInfo.engineId === 5 && verbose) {
    console.error('  ⚠️  Masked predicate detected - validation may require nonce');
    console.error('  ℹ️  If validation fails unexpectedly, provide --nonce flag or use --skip-validation\n');
  }

  // Get the public key from the provided secret
  const providedPublicKey = signingService.publicKey;

  // Compare public keys byte-by-byte
  const ownerPublicKeyHex = ownerInfo.publicKeyHex;
  const providedPublicKeyHex = HexConverter.encode(providedPublicKey);

  if (ownerPublicKeyHex !== providedPublicKeyHex) {
    console.error('\n❌ Ownership Verification Failed');
    console.error(`  Token owner public key: ${ownerPublicKeyHex.substring(0, 16)}...`);
    console.error(`  Your public key:        ${providedPublicKeyHex.substring(0, 16)}...`);
    console.error('\nThe secret you provided does not match the token owner\'s secret.');
    console.error('You cannot send tokens that you do not own.\n');
    console.error('To bypass this check (for testing/delegation), use --skip-validation flag.\n');

    throw new Error('Ownership verification failed: secret does not match token owner');
  }

  if (verbose) {
    console.error('  ✓ Ownership verified: secret matches token owner');
    console.error(`    Public Key: ${providedPublicKeyHex.substring(0, 32)}...\n`);
  }
}

export function sendTokenCommand(program: Command): void {
  program
    .command('send-token')
    .description('Send a token to a recipient address (submit to network or create offline transaction)')
    .option('-f, --file <file>', 'Token file (TXF) to send (required)')
    .option('--select <tokenId>', 'Select specific token from multi-token TXF file')
    .option('-r, --recipient <address>', 'Recipient address (required)')
    .option('-m, --message <message>', 'Optional transfer message')
    .option('--recipient-data-hash <hash>', 'SHA256 hash (64-char hex) of recipient state data (optional)')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('--local', 'Use local aggregator (http://localhost:3000)')
    .option('--production', 'Use production aggregator (https://gateway.unicity.network)')
    .option('--offline', 'Create uncommitted transaction WITHOUT submitting to aggregator (for ultra-fast chains)')
    .option('-o, --output <file>', 'Output TXF file path')
    .option('--save', 'Save output to auto-generated filename')
    .option('--stdout', 'Output to STDOUT only (no file)')
    .option('-v, --verbose', 'Show detailed step-by-step output')
    .option('--json', 'Output TXF JSON to stdout (no status messages)')
    .option('--unsafe-secret', 'Skip secret strength validation (for development/testing only)')
    .option('--skip-validation', 'Skip ownership verification (for testing/delegation scenarios)')
    .action(async (options) => {
      // Determine output mode
      const verbose = options.verbose || false;
      const jsonOutput = options.json || false;

      // Helper for verbose logging
      const log = (msg: string) => { if (verbose) console.error(msg); };

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

        // Validate recipient address (CRITICAL: prevent malformed addresses)
        const addressValidation = validateAddress(options.recipient);
        if (!addressValidation.valid) {
          throwValidationError(addressValidation);
        }

        // Determine endpoint
        let endpoint = options.endpoint;
        if (options.local) {
          endpoint = 'http://127.0.0.1:3000';
        } else if (options.production) {
          endpoint = 'https://gateway.unicity.network';
        }

        const isOffline = options.offline || false;
        const patternName = isOffline ? 'Offline Mode (Uncommitted)' : 'Online Mode (Submit to Network)';

        log(`=== Send Token - ${patternName} ===\n`);

        // STEP 1: Load token from file (multi-token format)
        log('Step 1: Loading token from file...');
        const { token: tokenJson, tokenId: loadedTokenId } = readTokenFromTxf(options.file, options.select);
        log(`  ✓ Token loaded: ${loadedTokenId.substring(0, 16)}...\n`);

        // STEP 1.5: Validate token structure BEFORE parsing with SDK
        log('Step 1.5: Validating token structure...');
        const jsonValidation = validateTokenProofsJson(tokenJson, {
          allowUncommitted: true  // Allow tokens with uncommitted transactions (for transaction chains)
        });

        if (!jsonValidation.valid) {
          console.error('\n❌ Token structure validation failed:');
          jsonValidation.errors.forEach(err => console.error(`  - ${err}`));
          console.error('\nCannot send a token with invalid structure.');
          process.exit(1);
        }

        if (jsonValidation.warnings.length > 0) {
          log('  Warnings:');
          jsonValidation.warnings.forEach(warn => log(`    - ${warn}`));
        }

        log('  ✓ Token structure valid');
        log('');

        // STEP 1.6: Load token with SDK
        log('Step 1.6: Parsing token with SDK...');
        const token = await Token.fromJSON(tokenJson);
        log(`  ✓ Token loaded: ${token.id.toJSON()}`);
        log(`  Token Type: ${token.type.toJSON()}\n`);

        // STEP 1.7: Load TrustBase and perform cryptographic proof validation
        log('Step 1.7: Loading trust base for proof validation...');
        const trustBase = await getCachedTrustBase({
          filePath: process.env.TRUSTBASE_PATH,
          useFallback: false,
          silent: !verbose
        });
        log(`  ✓ Trust base ready (Network ID: ${trustBase.networkId}, Epoch: ${trustBase.epoch})\n`);

        log('Step 1.8: Validating token proofs cryptographically...');
        const proofValidation = await validateTokenProofs(token, trustBase);

        if (!proofValidation.valid) {
          console.error('\n❌ Token proof validation failed:');
          proofValidation.errors.forEach(err => console.error(`  - ${err}`));
          console.error('\nCannot send a token with invalid proofs.');
          process.exit(1);
        }

        log('  ✓ Genesis proof signature verified');
        if (token.transactions && token.transactions.length > 0) {
          log(`  ✓ All transaction proofs verified (${token.transactions.length} transaction${token.transactions.length !== 1 ? 's' : ''})`);
        }

        if (proofValidation.warnings.length > 0) {
          log('  Proof warnings:');
          proofValidation.warnings.forEach(warn => log(`    - ${warn}`));
        }
        log('');

        // STEP 2: Parse recipient address
        log('Step 2: Parsing recipient address...');
        const recipientAddress = await AddressFactory.createAddress(options.recipient);
        log(`  ✓ Recipient: ${recipientAddress.address}\n`);

        // STEP 3: Get sender's secret
        log('Step 3: Getting sender secret...');
        const secret = await getSecret(options.unsafeSecret);
        const signingService = await SigningService.createFromSecret(secret);
        log(`  ✓ Signing service created`);
        log(`  Public Key: ${HexConverter.encode(signingService.publicKey)}\n`);

        // STEP 3.5: Verify ownership (unless skipped)
        await verifyOwnership(token, tokenJson, signingService, options.skipValidation || false, verbose);

        // STEP 4: Generate salt for transfer
        log('Step 4: Generating transfer salt...');
        const salt = crypto.getRandomValues(new Uint8Array(32));
        log(`  ✓ Salt: ${HexConverter.encode(salt)}\n`);

        // STEP 5: Process optional message
        let messageBytes: Uint8Array | null = null;
        if (options.message) {
          messageBytes = new TextEncoder().encode(options.message);
          log('Step 5: Processing transfer message...');
          log(`  ✓ Message: "${options.message}"\n`);
        } else {
          log('Step 5: No transfer message provided\n');
        }

        // STEP 5.5: Process recipient data hash (if provided)
        let recipientDataHash: DataHash | null = null;
        if (options.recipientDataHash) {
          log('Step 5.5: Processing recipient data hash...');

          // Validate format
          const hashValidation = validateDataHash(options.recipientDataHash);
          if (!hashValidation.valid) {
            throwValidationError(hashValidation);
          }

          // Convert hex string to DataHash object
          try {
            recipientDataHash = DataHash.fromJSON(options.recipientDataHash);
            log(`  ✓ Recipient data hash: ${options.recipientDataHash}`);
            log(`  Recipient must provide state data matching this hash\n`);
          } catch (error) {
            console.error('Invalid recipient data hash format');
            throw error;
          }
        } else {
          log('Step 5.5: No recipient data hash (recipient has full control over state data)\n');
        }

        // STEP 6: Create transfer commitment
        log('Step 6: Creating transfer commitment...');
        const transferCommitment = await TransferCommitment.create(
          token,
          recipientAddress,
          salt,
          recipientDataHash,  // Use validated hash instead of null
          messageBytes,
          signingService
        );
        log(`  ✓ Transfer commitment created`);
        log(`  Request ID: ${transferCommitment.requestId.toJSON()}\n`);

        // Determine network type based on endpoint
        const network = endpoint.includes('localhost') ? 'test' :
                       endpoint.includes('gateway.unicity.network') ? 'production' : 'test';

        let extendedTxf: IExtendedTxfToken;

        if (!isOffline) {
          // ONLINE MODE: Submit to network immediately
          log('=== Online Mode: Submitting to Network ===\n');

          // Create clients
          const aggregatorClient = new AggregatorClient(endpoint);
          const client = new StateTransitionClient(aggregatorClient);

          // Submit commitment
          log('Step 7: Submitting transfer to network...');
          await client.submitTransferCommitment(transferCommitment);
          log(`  ✓ Transfer submitted\n`);

          // Wait for inclusion proof
          log('Step 8: Waiting for inclusion proof...');
          const inclusionProof = await waitInclusionProof(client, transferCommitment, 60000, 1000, verbose);
          log('');

          // STEP 8.5: CRITICAL SECURITY - Verify proof corresponds to our transfer
          // This is the KEY security check in Unicity Network:
          // The proof MUST correspond to the SOURCE STATE being spent and our TRANSACTION
          // We verify BOTH:
          //   1. Source state correspondence (proof is for the right source state)
          //   2. Transaction hash match (proof is for our specific transaction)
          log('Step 8.5: Verifying proof corresponds to our transfer...');

          // VERIFICATION 1: Source State Correspondence (CRITICAL)
          // The proof's authenticator.stateHash must match our source state hash
          // This ensures the proof is for the correct SOURCE STATE being spent
          const proofAuthenticator = inclusionProof.authenticator;

          if (!proofAuthenticator) {
            console.error('\n❌ SECURITY ERROR: Proof is missing authenticator!');
            console.error('\nThe inclusion proof does not contain an authenticator.');
            console.error('This indicates an incomplete or invalid proof from the aggregator.');
            console.error();
            process.exit(1);
          }

          const proofSourceStateHash = proofAuthenticator.stateHash;
          const ourSourceState = transferCommitment.transactionData.sourceState;
          const ourSourceStateHash = await ourSourceState.calculateHash();

          // Compare source state hashes
          if (!proofSourceStateHash.equals(ourSourceStateHash)) {
            console.error('\n❌ SECURITY ERROR: Proof is for WRONG source state!');
            console.error('\nThe inclusion proof does NOT correspond to our source state.');
            console.error('This indicates a serious security issue (Byzantine aggregator or corrupted proof).');
            console.error('\nDetails:');
            console.error(`  - Expected Source State Hash: ${HexConverter.encode(ourSourceStateHash.imprint)}`);
            console.error(`  - Proof Source State Hash:    ${HexConverter.encode(proofSourceStateHash.imprint)}`);
            console.error('\nThis should NEVER happen with a correct aggregator.');
            console.error('DO NOT proceed. Contact support immediately.');
            console.error();
            process.exit(1);
          }

          log('  ✓ Source state correspondence verified');

          // VERIFICATION 2: Transaction Hash Match
          // The proof's transactionHash must match our transaction hash
          // This ensures the proof is for OUR specific transaction
          const proofTxHash = inclusionProof.transactionHash;

          if (!proofTxHash) {
            console.error('\n❌ SECURITY ERROR: Proof is missing transaction hash!');
            console.error('\nThe inclusion proof does not contain a transaction hash.');
            console.error('This indicates an incomplete or invalid proof from the aggregator.');
            console.error();
            process.exit(1);
          }

          const ourTxHash = await transferCommitment.transactionData.calculateHash();
          const proofTxHashHex = HexConverter.encode(proofTxHash.imprint);
          const ourTxHashHex = HexConverter.encode(ourTxHash.imprint);

          log(`  Proof Transaction Hash: ${proofTxHashHex}`);
          log(`  Our Transaction Hash:   ${ourTxHashHex}`);

          if (proofTxHashHex !== ourTxHashHex) {
            console.error('\n❌ SECURITY ERROR: Proof is for DIFFERENT transaction!');
            console.error('\nThe inclusion proof is for the correct source state,');
            console.error('but corresponds to a DIFFERENT transaction.');
            console.error('\nThis should NEVER happen in send-token with --submit-now.');
            console.error('\nDetails:');
            console.error(`  - Request ID: ${transferCommitment.requestId.toJSON()}`);
            console.error(`  - Expected Transaction Hash: ${ourTxHashHex}`);
            console.error(`  - Proof Transaction Hash:    ${proofTxHashHex}`);
            console.error('\nPossible causes:');
            console.error('  1. Byzantine aggregator returning wrong proof');
            console.error('  2. Race condition with concurrent submission');
            console.error('  3. Network corruption or man-in-the-middle attack');
            console.error('\nAction Required:');
            console.error('  DO NOT proceed. Contact support immediately.');
            console.error();
            process.exit(1);
          }

          log('  ✓ Transaction hash match verified - this proof is for our transaction');
          log('  ✓ Proof correspondence verified\n');

          // Create transfer transaction
          log('Step 9: Creating transfer transaction...');
          const transferTransaction = transferCommitment.toTransaction(inclusionProof);
          log(`  ✓ Transfer transaction created\n`);

          // Update token with new transaction
          log('Step 10: Building extended TXF (TRANSFERRED status)...');
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
          log(`  ✓ Extended TXF created with TRANSFERRED status\n`);

        } else {
          // OFFLINE MODE: Create uncommitted transaction (no network submission)
          log('=== Offline Mode: Creating Uncommitted Transaction ===\n');

          log('Step 7: Creating uncommitted transfer transaction...');

          // CRITICAL: Store the sender's signed commitment
          // The commitment signature proves the sender authorized this transfer
          // The recipient cannot recreate this signature (doesn't have sender's private key)
          const commitmentJson = await transferCommitment.toJSON();

          // Create transaction data structure WITHOUT inclusion proof
          // BUT including the pre-signed commitment for later submission
          const uncommittedTx = {
            type: 'transfer',
            data: {
              sourceState: tokenJson.state,
              recipient: recipientAddress.address,
              salt: HexConverter.encode(salt),
              recipientDataHash: recipientDataHash?.toJSON() || null,
              message: options.message || null
            },
            // Store the sender's signed commitment so recipient can submit it
            commitment: commitmentJson
            // NO inclusionProof - this marks it as uncommitted
          };

          log(`  ✓ Uncommitted transaction created (no proof)\n`);
          log(`  ✓ Sender's commitment signature stored\n`);

          // Create extended TXF with uncommitted transaction
          log('Step 8: Building extended TXF with uncommitted transaction...');
          extendedTxf = {
            version: tokenJson.version || "2.0",
            state: tokenJson.state,  // State UNCHANGED (still belongs to sender)
            genesis: tokenJson.genesis,
            transactions: [
              ...(tokenJson.transactions || []),
              uncommittedTx  // Uncommitted transaction added to array
            ],
            nametags: tokenJson.nametags || [],
            status: TokenStatus.PENDING
          };
          log(`  ✓ Extended TXF created with PENDING status (uncommitted transaction)\n`);
          log(`  Transaction can be submitted later by recipient using receive-token\n`);
        }

        // STEP FINAL: Sanitize and serialize for output
        log('Final Step: Sanitizing and preparing output...');
        const sanitizedTxf = sanitizeForExport(extendedTxf);
        const serializedTxf = serializeTxf(sanitizedTxf);
        log(`  ✓ Output sanitized (private keys removed)`);
        if (serializedTxf.state === null) {
          log(`  ✓ State field optimized (reconstructable from sourceState)\n`);
        } else {
          log('\n');
        }

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
          const pattern = isOffline ? 'offline' : 'sent';
          const recipientPrefix = options.recipient.replace(/^[A-Z]+:\/\//, '').substring(0, 10);
          outputFile = `${dateStr}_${timeStr}_${timestamp}_${pattern}_${recipientPrefix}.txf`;
        }

        // Write to file if specified (multi-token format)
        if (outputFile && !options.stdout) {
          try {
            writeTokenToTxf(outputFile, serializedTxf, loadedTokenId);
            log(`Token saved to ${outputFile} (multi-token format)`);
          } catch (err) {
            console.error(`Error writing output file: ${err instanceof Error ? err.message : String(err)}`);
            throw err;
          }
        }

        // Final output (multi-token format for stdout)
        const multiTokenJson = JSON.stringify({ [`_${loadedTokenId}`]: serializedTxf }, null, 2);
        if (jsonOutput) {
          // JSON mode: output TXF to stdout, no status messages
          console.log(multiTokenJson);
        } else if ((!options.save && !options.output) || options.stdout) {
          // Output JSON to stdout if no file output OR if --stdout explicitly requested
          console.log(multiTokenJson);
        }

        // Print summary unless in JSON mode
        if (!jsonOutput) {
          const mode = isOffline ? 'offline' : 'online';
          console.log(formatSendOutput(
            tokenJson,
            recipientAddress.address,
            mode,
            options.recipientDataHash || null,
            outputFile || undefined
          ));
        }

      } catch (error) {
        console.error('\n❌ Error sending token:');
        const errorMessage = getNetworkErrorMessage(error);
        console.error(`  ${errorMessage}\n`);

        // Only show stack trace in debug mode
        if (process.env.DEBUG && error instanceof Error && error.stack) {
          console.error('\nDebug Stack Trace:');
          console.error(error.stack);
        }

        process.exit(1);
      }
    });
}
