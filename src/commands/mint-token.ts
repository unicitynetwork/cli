import { Command } from 'commander';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { DataHash } from '@unicitylabs/state-transition-sdk/lib/hash/DataHash.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';
import { TokenType } from '@unicitylabs/state-transition-sdk/lib/token/TokenType.js';
import { TokenState } from '@unicitylabs/state-transition-sdk/lib/token/TokenState.js';
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { TokenCoinData } from '@unicitylabs/state-transition-sdk/lib/token/fungible/TokenCoinData.js';
import { CoinId } from '@unicitylabs/state-transition-sdk/lib/token/fungible/CoinId.js';
import { JsonRpcNetworkError } from '@unicitylabs/state-transition-sdk/lib/api/json-rpc/JsonRpcNetworkError.js';
import { MintCommitment } from '@unicitylabs/state-transition-sdk/lib/transaction/MintCommitment.js';
import { MintTransactionData } from '@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionData.js';
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import { IMintTransactionReason } from '@unicitylabs/state-transition-sdk/lib/transaction/IMintTransactionReason.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { UnmaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/UnmaskedPredicate.js';
import { MaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/MaskedPredicate.js';
import { validateInclusionProof } from '../utils/proof-validation.js';
import { getCachedTrustBase } from '../utils/trustbase-loader.js';
import { validateSecret, validateTokenType, validateNonce, validateFilePath, throwValidationError } from '../utils/input-validation.js';
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
  const validation = validateSecret(secret, 'mint-token', skipValidation);
  if (!validation.valid) {
    throwValidationError(validation);
  }

  return new TextEncoder().encode(secret);
}

/**
 * Smart detection and serialization of input data
 *
 * Detects whether input is:
 * 1. Already a valid hex string (even length, valid hex chars)
 * 2. JSON data (starts with { or [)
 * 3. Plain text that needs hashing
 *
 * For TokenId/TokenType: expects 256-bit (64 hex chars) or will hash
 * For other data: accepts any valid hex or serializes text/JSON
 */
async function processInput(
  input: string | undefined,
  label: string,
  options: {
    requireHash?: boolean;  // Force hash to 32 bytes (for TokenId/TokenType)
    allowEmpty?: boolean;   // Allow undefined/empty input
  } = {}
): Promise<Uint8Array> {
  // Handle undefined/empty input
  if (!input) {
    if (options.allowEmpty) {
      return new Uint8Array(0);
    }
    // Generate random 32 bytes
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    console.error(`Generated random ${label}: ${HexConverter.encode(randomBytes)}`);
    return randomBytes;
  }

  // Check if it's a valid hex string (even length, only hex chars)
  const hexPattern = /^(0x)?[0-9a-fA-F]+$/;
  if (hexPattern.test(input) && input.replace('0x', '').length % 2 === 0) {
    const hexStr = input.replace('0x', '');

    // For TokenId/TokenType, must be exactly 256 bits (64 hex chars)
    if (options.requireHash && hexStr.length !== 64) {
      console.error(`${label} hex string is ${hexStr.length} chars (expected 64), hashing...`);
      const hasher = new DataHasher(HashAlgorithm.SHA256);
      const hash = await hasher.update(HexConverter.decode(hexStr)).digest();
      console.error(`Hashed ${label}: ${HexConverter.encode(hash.data)}`);
      return hash.data;
    }

    // Valid hex string, decode directly
    const bytes = HexConverter.decode(hexStr);
    console.error(`Using hex ${label}: ${HexConverter.encode(bytes)}`);
    return bytes;
  }

  // Check if it's JSON data
  const trimmed = input.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      // Validate JSON
      JSON.parse(trimmed);
      // Serialize JSON as UTF-8 bytes
      const jsonBytes = new TextEncoder().encode(trimmed);

      if (options.requireHash) {
        // Hash JSON for TokenId/TokenType
        const hasher = new DataHasher(HashAlgorithm.SHA256);
        const hash = await hasher.update(jsonBytes).digest();
        console.error(`Hashed JSON ${label}: ${HexConverter.encode(hash.data)}`);
        return hash.data;
      }

      console.error(`Serialized JSON ${label} (${jsonBytes.length} bytes)`);
      return jsonBytes;
    } catch (e) {
      // Not valid JSON, treat as plain text
    }
  }

  // Plain text - serialize or hash
  const textBytes = new TextEncoder().encode(input);

  if (options.requireHash) {
    // Hash to 32 bytes for TokenId/TokenType
    const hasher = new DataHasher(HashAlgorithm.SHA256);
    const hash = await hasher.update(textBytes).digest();
    console.error(`Hashed text ${label} "${input}": ${HexConverter.encode(hash.data)}`);
    return hash.data;
  }

  console.error(`Serialized text ${label} "${input}" (${textBytes.length} bytes)`);
  return textBytes;
}

// Function to process token type with preset or custom input
async function processTokenType(
  tokenTypeOption: string | undefined,
  preset: string | undefined
): Promise<{ tokenType: TokenType; presetInfo?: any }> {
  // If preset is specified, use it
  if (preset) {
    const presetKey = preset.toLowerCase();
    const presetType = UNICITY_TOKEN_TYPES[presetKey as keyof typeof UNICITY_TOKEN_TYPES];

    if (!presetType) {
      throw new Error(`Unknown preset "${preset}". Available: nft, alpha, uct, usdu, euru`);
    }

    const tokenTypeBytes = HexConverter.decode(presetType.id);
    console.error(`Using preset token type "${preset}" (${presetType.name})`);
    console.error(`  TokenType ID: ${presetType.id}`);
    console.error(`  Asset kind: ${presetType.assetKind}`);
    if ('symbol' in presetType) {
      console.error(`  Symbol: ${presetType.symbol}`);
    }

    return {
      tokenType: new TokenType(tokenTypeBytes),
      presetInfo: presetType
    };
  }

  // If custom token type is provided
  if (tokenTypeOption) {
    // Validate token type format (must be valid hex or preset name)
    const validation = validateTokenType(tokenTypeOption, false);
    if (!validation.valid) {
      throwValidationError(validation);
    }

    const tokenTypeBytes = await processInput(tokenTypeOption, 'tokenType', { requireHash: true });
    return { tokenType: new TokenType(tokenTypeBytes) };
  }

  // Default to Unicity NFT type
  const defaultPreset = UNICITY_TOKEN_TYPES.nft;
  const tokenTypeBytes = HexConverter.decode(defaultPreset.id);
  console.error(`Using default NFT token type (${defaultPreset.name})`);
  console.error(`  TokenType ID: ${defaultPreset.id}`);

  return {
    tokenType: new TokenType(tokenTypeBytes),
    presetInfo: defaultPreset
  };
}

// Function to wait for an inclusion proof with timeout
// Polls until proof exists from the aggregator
async function waitInclusionProof(
  client: StateTransitionClient,
  commitment: MintCommitment<IMintTransactionReason>,
  timeoutMs: number = 60000,
  intervalMs: number = 1000
): Promise<any> {
  const startTime = Date.now();
  let proofReceived = false;

  console.error('Waiting for inclusion proof for commitment...');

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
          console.error('✓ Inclusion proof received from aggregator (complete with authenticator and transactionHash)');
          return proof;
        }
        // If proof exists but is incomplete, continue polling
        if (!proofReceived) {
          console.error(`⏳ Proof found but incomplete - authenticator: ${hasAuth}, transactionHash: ${hasTxHash}`);
          proofReceived = true;
        }
      }
    } catch (err) {
      if (err instanceof JsonRpcNetworkError && err.status === 404) {
        // Continue polling - proof not available yet
        // Don't log on every iteration to avoid spam
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

// Unicity standard token types from https://github.com/unicitynetwork/unicity-ids
const UNICITY_TOKEN_TYPES = {
  // Non-fungible (NFT)
  'nft': {
    id: 'f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509',
    name: 'unicity',
    description: 'Unicity testnet NFT token type',
    assetKind: 'non-fungible'
  },
  // Fungible coins
  'alpha': {
    id: '455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89',
    name: 'unicity',
    symbol: 'UCT',
    decimals: 18,
    description: 'Unicity testnet native coin',
    assetKind: 'fungible'
  },
  'uct': {
    id: '455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89',
    name: 'unicity',
    symbol: 'UCT',
    decimals: 18,
    description: 'Unicity testnet native coin',
    assetKind: 'fungible'
  },
  'usdu': {
    id: '8f0f3d7a5e7297be0ee98c63b81bcebb2740f43f616566fc290f9823a54f52d7',
    name: 'unicity-usd',
    symbol: 'USDU',
    decimals: 6,
    description: 'Unicity testnet USD stablecoin',
    assetKind: 'fungible'
  },
  'euru': {
    id: '5e160d5e9fdbb03b553fb9c3f6e6c30efa41fa807be39fb4f18e43776e492925',
    name: 'unicity-eur',
    symbol: 'EURU',
    decimals: 6,
    description: 'Unicity testnet EUR stablecoin',
    assetKind: 'fungible'
  }
};

export function mintTokenCommand(program: Command): void {
  program
    .command('mint-token')
    .description('Mint a new token to yourself on the Unicity Network (self-mint pattern)')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('--local', 'Use local aggregator (http://localhost:3000)')
    .option('--production', 'Use production aggregator (https://gateway.unicity.network)')
    .option('--preset <type>', 'Use preset token type: nft, alpha/uct, usdu, euru')
    .option('-n, --nonce <nonce>', 'Nonce for masked predicate (creates one-time address if provided)')
    .option('-u, --unmasked', 'Use unmasked predicate (reusable address, default for self-mint)')
    .option('-d, --token-data <data>', 'Token data (JSON or text, stored in token state)')
    .option('-c, --coins <coins>', 'Comma-separated list of coin amounts (e.g., "1000000000000000000" for 1 UCT)')
    .option('-i, --token-id <tokenId>', 'Token ID (hex string or text to be hashed, randomly generated if not provided)')
    .option('-y, --token-type <tokenType>', 'Token type (hex string or text to be hashed, defaults to unicity NFT type)')
    .option('--salt <salt>', 'Salt for predicate (hex string, randomly generated if not provided)')
    .option('-o, --output <file>', 'Output TXF file path')
    .option('--save', 'Save output to auto-generated filename')
    .option('--stdout', 'Output to STDOUT only (no file)')
    .option('--unsafe-secret', 'Skip secret strength validation (for development/testing only)')
    .action(async (options) => {
      // Determine endpoint
      let endpoint = options.endpoint;
      if (options.local) {
        endpoint = 'http://127.0.0.1:3000';
      } else if (options.production) {
        endpoint = 'https://gateway.unicity.network';
      }

      try {
        console.error('=== Self-Mint Pattern: Minting token to yourself ===\n');

        // Get secret from environment or prompt
        const secret = await getSecret(options.unsafeSecret);

        // Create signing service
        let signingService: SigningService;
        let nonce: Uint8Array | undefined;

        if (options.nonce) {
          // Validate nonce format
          const nonceValidation = validateNonce(options.nonce, false);
          if (!nonceValidation.valid) {
            throwValidationError(nonceValidation);
          }

          // Masked predicate (one-time use)
          nonce = await processInput(options.nonce, 'nonce', { requireHash: true });
          signingService = await SigningService.createFromSecret(secret, nonce);
          console.error('Using MASKED predicate (one-time use address)');
        } else {
          // Unmasked predicate (reusable)
          signingService = await SigningService.createFromSecret(secret);
          console.error('Using UNMASKED predicate (reusable address)');
        }

        console.error(`Public Key: ${HexConverter.encode(signingService.publicKey)}\n`);

        // Create AggregatorClient and StateTransitionClient
        const aggregatorClient = new AggregatorClient(endpoint);
        const client = new StateTransitionClient(aggregatorClient);

        // Load trust base dynamically from file or fallback to hardcoded
        console.error('Loading trust base...');
        const trustBase = await getCachedTrustBase({
          filePath: process.env.TRUSTBASE_PATH,
          useFallback: false // Try file loading first, fallback if unavailable
        });
        console.error(`  ✓ Trust base ready (Network ID: ${trustBase.networkId}, Epoch: ${trustBase.epoch})\n`);

        // Process tokenId - must be 256-bit (64 hex chars) or will be hashed
        const tokenIdBytes = await processInput(options.tokenId, 'tokenId', { requireHash: true });
        const tokenId = new TokenId(tokenIdBytes);

        // Process tokenType with preset support
        const { tokenType, presetInfo } = await processTokenType(options.tokenType, options.preset);

        // Process salt
        const salt = options.salt
          ? await processInput(options.salt, 'salt', { requireHash: true })
          : crypto.getRandomValues(new Uint8Array(32));
        console.error(`Salt: ${HexConverter.encode(salt)}\n`);

        // STEP 1: Create predicate FIRST (critical pattern!)
        console.error('Step 1: Creating predicate...');
        const predicate = nonce
          ? await MaskedPredicate.create(tokenId, tokenType, signingService, HashAlgorithm.SHA256, nonce)
          : await UnmaskedPredicate.create(tokenId, tokenType, signingService, HashAlgorithm.SHA256, salt);
        console.error('  ✓ Predicate created\n');

        // STEP 2: Derive address FROM the predicate
        console.error('Step 2: Deriving address from predicate...');
        const predicateRef = await predicate.getReference();
        const address = await predicateRef.toAddress();
        console.error(`  ✓ Address: ${address.address}\n`);

        // Process token data
        let tokenDataBytes: Uint8Array;
        let recipientDataHash: DataHash | null = null;

        if (options.tokenData) {
          tokenDataBytes = await processInput(options.tokenData, 'token data', { allowEmpty: false });

          // CRITICAL: Compute recipientDataHash to commit to state.data
          // This is required for SDK verification of tokens with data
          const hasher = new DataHasher(HashAlgorithm.SHA256);
          recipientDataHash = await hasher.update(tokenDataBytes).digest();

          console.error(`Serialized JSON token data (${tokenDataBytes.length} bytes)`);
          console.error(`Computed recipientDataHash: ${HexConverter.encode(recipientDataHash.data)}`);
        } else {
          // Empty token data (no recipientDataHash needed)
          tokenDataBytes = new Uint8Array(0);
          console.error('Using empty token data');
        }

        // Process coins - handle preset fungible tokens
        let coinData: TokenCoinData;
        if (options.coins) {
          // Manual coin specification with validation
          const coinAmounts = options.coins.split(',').map((s: string) => {
            const trimmed = s.trim();

            // Validate format - must be numeric (negative values allowed for liabilities)
            if (!/^-?\d+$/.test(trimmed)) {
              throw new Error(`Invalid coin amount: "${trimmed}" - must be numeric`);
            }

            return BigInt(trimmed);
          });
          const coinsWithIds: [CoinId, bigint][] = coinAmounts.map((amount: bigint) => {
            const coinIdBytes = crypto.getRandomValues(new Uint8Array(32));
            return [new CoinId(coinIdBytes), amount];
          });
          coinData = TokenCoinData.create(coinsWithIds);
          console.error(`Creating token with ${coinAmounts.length} coin(s)`);
        } else if (presetInfo && presetInfo.assetKind === 'fungible') {
          // Preset fungible token - create single coin with amount 0
          const defaultCoinId = new CoinId(crypto.getRandomValues(new Uint8Array(32)));
          coinData = TokenCoinData.create([[defaultCoinId, BigInt(0)]]);
          const symbol = 'symbol' in presetInfo ? presetInfo.symbol : presetInfo.name;
          console.error(`Creating fungible ${symbol} token with default coin (amount: 0)`);
          console.error(`  Note: Use -c to specify amounts (e.g., -c "1000000000000000000" for 1 ${symbol})`);
        } else {
          // Non-fungible token (NFT)
          coinData = TokenCoinData.create([]);
          console.error('Creating non-fungible token (NFT)');
        }
        console.error();

        // STEP 3: Create MintTransactionData using the address
        console.error('Step 3: Creating MintTransactionData...');
        const mintTransactionData = await MintTransactionData.create(
          tokenId,           // Token identifier
          tokenType,         // Token type identifier
          tokenDataBytes,    // Immutable token metadata (genesis.data.tokenData)
          coinData,          // Fungible coin data, or null
          address,           // Address of the first owner
          salt,              // Random salt used to derive predicates
          recipientDataHash, // Commit to state.data via hash (CRITICAL FIX)
          null               // Reason (optional)
        );
        console.error('  ✓ MintTransactionData created\n');

        // STEP 4: Create and submit commitment
        console.error('Step 4: Creating mint commitment...');
        const mintCommitment = await MintCommitment.create(mintTransactionData);
        console.error('  ✓ Commitment created\n');

        console.error('Step 5: Submitting to network...');
        const submitResponse = await client.submitMintCommitment(mintCommitment);
        console.error(`  ✓ Transaction submitted`);
        console.error(`  Request ID: ${mintCommitment.requestId.toJSON()}\n`);

        // STEP 6: Wait for inclusion proof
        console.error('Step 6: Waiting for inclusion proof...');
        const inclusionProof = await waitInclusionProof(client, mintCommitment);
        console.error('  ✓ Inclusion proof received\n');

        // Validate the inclusion proof
        console.error('Step 6.5: Validating inclusion proof...');
        const proofValidation = await validateInclusionProof(
          inclusionProof,
          mintCommitment.requestId,
          trustBase
        );

        if (!proofValidation.valid) {
          console.error('\n❌ Inclusion proof validation failed:');
          proofValidation.errors.forEach(err => console.error(`  - ${err}`));
          console.error('\nCannot proceed with invalid proof.');
          process.exit(1);
        }

        console.error('  ✓ Proof structure validated (authenticator, transaction hash, merkle path)');
        console.error('  ✓ Authenticator signature verified');

        if (proofValidation.warnings.length > 0) {
          console.error('  ⚠ Warnings:');
          proofValidation.warnings.forEach(warn => console.error(`    - ${warn}`));
        }
        console.error();

        // STEP 7: Create TokenState with SAME predicate instance (critical!)
        console.error('Step 7: Creating TokenState with predicate...');
        const tokenState = new TokenState(predicate, tokenDataBytes);
        console.error('  ✓ TokenState created (uses SAME predicate)\n');

        // STEP 8: Create mint transaction
        console.error('Step 8: Creating mint transaction...');
        const mintTransaction = mintCommitment.toTransaction(inclusionProof);
        console.error('  ✓ Mint transaction created\n');

        // STEP 9: Create SDK-compliant TXF structure using SDK methods
        // Use tokenState.toJSON() to ensure proper predicate encoding
        // The predicate must be a CBOR array: [engine_id, template, params]
        console.error('Step 9: Creating SDK-compliant TXF structure...');

        const txfToken = {
          version: "2.0",
          genesis: {
            data: mintTransaction.data.toJSON(),
            inclusionProof: inclusionProof.toJSON()
          },
          state: tokenState.toJSON(),  // ✅ Use SDK method for proper encoding!
          transactions: [],  // Empty for newly minted token
          nametags: []
        };

        const tokenJson = JSON.stringify(txfToken, null, 2);
        console.error('  ✓ TXF structure created with SDK method\n');

        // Output handling
        let outputFile: string | null = null;

        if (options.output) {
          // Explicit output file specified - validate path
          const validation = validateFilePath(options.output, 'Output file');
          if (!validation.valid) {
            throwValidationError(validation);
          }
          outputFile = options.output;
        } else if (options.save) {
          // Auto-generate filename
          const now = new Date();
          const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
          const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
          const timestamp = Date.now();
          const addressBody = address.address.replace(/^[A-Z]+:\/\//, '');
          // Sanitize address prefix to remove shell metacharacters and special chars
          const addressPrefix = addressBody.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '');
          outputFile = `${dateStr}_${timeStr}_${timestamp}_${addressPrefix}.txf`;
        }

        // Write to file if specified
        if (outputFile && !options.stdout) {
          fs.writeFileSync(outputFile, tokenJson);
          console.error(`✅ Token saved to ${outputFile}`);
        }

        // Always output to stdout unless explicitly saving only
        if (!options.save || options.stdout) {
          console.log(tokenJson);
        }

        console.error('\n=== Minting Complete ===');
        console.error(`Token ID: ${tokenId.toJSON()}`);
        console.error(`Address: ${address.address}`);
      } catch (error) {
        console.error('Error minting token:');
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