import { Command } from 'commander';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { getNetworkErrorMessage } from '../utils/error-handling.js';
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
import { formatMintOutput } from '../utils/output-formatter.js';
import { createPoWClient } from '../utils/pow-client.js';
import { writeTokenToTxf } from '../utils/multi-token-txf.js';
import {
  CoinOriginProof,
  createProof
} from '../types/CoinOriginProof.js';
import { CoinOriginMintReason } from '../types/CoinOriginMintReason.js';
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
  } = {},
  verbose: boolean = false
): Promise<Uint8Array> {
  // Handle undefined/empty input
  if (!input) {
    if (options.allowEmpty) {
      return new Uint8Array(0);
    }
    // Generate random 32 bytes
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    if (verbose) console.error(`Generated random ${label}: ${HexConverter.encode(randomBytes)}`);
    return randomBytes;
  }

  // Check if it's a valid hex string (even length, only hex chars)
  const hexPattern = /^(0x)?[0-9a-fA-F]+$/;
  if (hexPattern.test(input) && input.replace('0x', '').length % 2 === 0) {
    const hexStr = input.replace('0x', '');

    // For TokenId/TokenType, must be exactly 256 bits (64 hex chars)
    if (options.requireHash && hexStr.length !== 64) {
      if (verbose) console.error(`${label} hex string is ${hexStr.length} chars (expected 64), hashing...`);
      const hasher = new DataHasher(HashAlgorithm.SHA256);
      const hash = await hasher.update(HexConverter.decode(hexStr)).digest();
      if (verbose) console.error(`Hashed ${label}: ${HexConverter.encode(hash.data)}`);
      return hash.data;
    }

    // Valid hex string, decode directly
    const bytes = HexConverter.decode(hexStr);
    if (verbose) console.error(`Using hex ${label}: ${HexConverter.encode(bytes)}`);
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
        if (verbose) console.error(`Hashed JSON ${label}: ${HexConverter.encode(hash.data)}`);
        return hash.data;
      }

      if (verbose) console.error(`Serialized JSON ${label} (${jsonBytes.length} bytes)`);
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
    if (verbose) console.error(`Hashed text ${label} "${input}": ${HexConverter.encode(hash.data)}`);
    return hash.data;
  }

  if (verbose) console.error(`Serialized text ${label} "${input}" (${textBytes.length} bytes)`);
  return textBytes;
}

// Function to process token type with preset or custom input
async function processTokenType(
  tokenTypeOption: string | undefined,
  preset: string | undefined,
  verbose: boolean = false
): Promise<{ tokenType: TokenType; presetInfo?: any }> {
  // If preset is specified, use it
  if (preset) {
    const presetKey = preset.toLowerCase();
    const presetType = UNICITY_TOKEN_TYPES[presetKey as keyof typeof UNICITY_TOKEN_TYPES];

    if (!presetType) {
      throw new Error(`Unknown preset "${preset}". Available: nft, alpha, uct, usdu, euru`);
    }

    const tokenTypeBytes = HexConverter.decode(presetType.id);
    if (verbose) {
      console.error(`Using preset token type "${preset}" (${presetType.name})`);
      console.error(`  TokenType ID: ${presetType.id}`);
      console.error(`  Asset kind: ${presetType.assetKind}`);
      if ('symbol' in presetType) {
        console.error(`  Symbol: ${presetType.symbol}`);
      }
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

    const tokenTypeBytes = await processInput(tokenTypeOption, 'tokenType', { requireHash: true }, verbose);
    return { tokenType: new TokenType(tokenTypeBytes) };
  }

  // Default to Unicity UCT type (fungible)
  const defaultPreset = UNICITY_TOKEN_TYPES.uct;
  const tokenTypeBytes = HexConverter.decode(defaultPreset.id);
  if (verbose) {
    console.error(`Using default UCT token type (${defaultPreset.name})`);
    console.error(`  TokenType ID: ${defaultPreset.id}`);
  }

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
  intervalMs: number = 1000,
  verbose: boolean = false
): Promise<any> {
  const startTime = Date.now();
  let proofReceived = false;

  if (verbose) console.error('Waiting for inclusion proof for commitment...');

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
          if (verbose) console.error('✓ Inclusion proof received from aggregator (complete with authenticator and transactionHash)');
          return proof;
        }
        // If proof exists but is incomplete, continue polling
        if (!proofReceived) {
          if (verbose) console.error(`⏳ Proof found but incomplete - authenticator: ${hasAuth}, transactionHash: ${hasTxHash}`);
          proofReceived = true;
        }
      }
    } catch (err) {
      if (err instanceof JsonRpcNetworkError && err.status === 404) {
        // Continue polling - proof not available yet
        // Don't log on every iteration to avoid spam
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
    .option('--preset <type>', 'Use preset token type: nft, alpha/uct (default), usdu, euru')
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
    .option('-v, --verbose', 'Show detailed step-by-step output')
    .option('--json', 'Output TXF JSON to stdout (no status messages)')
    .option('--unsafe-secret', 'Skip secret strength validation (for development/testing only)')
    .option('--unct-mine <blockHeight>', 'Mint UNCT coin using proof from specified POW blockchain block height')
    .option('--unct-url <url>', 'POW blockchain RPC endpoint URL (for verification)')
    .option('--local-unct', 'Use local POW node at http://localhost:8332 (for verification)')
    .option('--force-unverified', 'Force minting even if POW verification fails (dangerous - may waste token ID)')
    .action(async (options) => {
      // Determine output mode
      const verbose = options.verbose || false;
      const jsonOutput = options.json || false;

      // Helper for verbose logging
      const log = (msg: string) => { if (verbose) console.error(msg); };

      // Determine endpoint
      let endpoint = options.endpoint;
      if (options.local) {
        endpoint = 'http://127.0.0.1:3000';
      } else if (options.production) {
        endpoint = 'https://gateway.unicity.network';
      }

      // UNCT Mining Validation
      let unctBlockHeight: number | null = null;
      let unctVerificationEnabled = false;
      if (options.unctMine) {
        // Parse block height
        const parsedHeight = parseInt(options.unctMine, 10);
        if (isNaN(parsedHeight) || parsedHeight < 0) {
          console.error('❌ Error: --unct-mine requires a valid non-negative block height');
          console.error(`  Provided: "${options.unctMine}"`);
          process.exit(1);
        }
        unctBlockHeight = parsedHeight;

        // Validate token ID is provided (required for UNCT)
        if (!options.tokenId) {
          console.error('❌ Error: --unct-mine requires --token-id to be specified');
          console.error('  Token ID must match the one used during POW mining');
          process.exit(1);
        }

        // Determine if verification is enabled
        unctVerificationEnabled = !!(options.unctUrl || options.localUnct);

        // Validate --force-unverified only makes sense with verification
        if (options.forceUnverified && !unctVerificationEnabled) {
          console.error('❌ Error: --force-unverified requires POW endpoint (--unct-url or --local-unct)');
          console.error('  Without verification, use --unct-mine alone (unverified mode)');
          process.exit(1);
        }

        // Auto-configure for UNCT minting
        log('=== UNCT Coin Minting Mode ===');
        log(`  Block Height: ${unctBlockHeight}`);
        if (unctVerificationEnabled) {
          const powEndpoint = options.localUnct ? 'http://localhost:8332 (local)' : options.unctUrl;
          log(`  POW Verification: ENABLED (${powEndpoint})`);
        } else {
          log(`  POW Verification: DISABLED (unverified mode)`);
          log(`  WARNING: Token will not be cryptographically verified`);
        }
        log('');

        // Override preset and coins
        options.preset = 'uct';
        options.coins = '10000000000000000000'; // Exactly 10 UNCT with 18 decimals
      }

      try {
        log('=== Self-Mint Pattern: Minting token to yourself ===\n');

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
          nonce = await processInput(options.nonce, 'nonce', { requireHash: true }, verbose);
          signingService = await SigningService.createFromSecret(secret, nonce);
          log('Using MASKED predicate (one-time use address)');
        } else {
          // Unmasked predicate (reusable)
          signingService = await SigningService.createFromSecret(secret);
          log('Using UNMASKED predicate (reusable address)');
        }

        log(`Public Key: ${HexConverter.encode(signingService.publicKey)}\n`);

        // Create AggregatorClient and StateTransitionClient
        const aggregatorClient = new AggregatorClient(endpoint);
        const client = new StateTransitionClient(aggregatorClient);

        // Load trust base dynamically from file or fallback to hardcoded
        log('Loading trust base...');
        const trustBase = await getCachedTrustBase({
          filePath: process.env.TRUSTBASE_PATH,
          useFallback: false, // Try file loading first, fallback if unavailable
          silent: !verbose
        });
        log(`  ✓ Trust base ready (Network ID: ${trustBase.networkId}, Epoch: ${trustBase.epoch})\n`);

        // Process tokenId - must be 256-bit (64 hex chars) or will be hashed
        const tokenIdBytes = await processInput(options.tokenId, 'tokenId', { requireHash: true }, verbose);
        const tokenId = new TokenId(tokenIdBytes);

        // Process tokenType with preset support
        const { tokenType, presetInfo } = await processTokenType(options.tokenType, options.preset, verbose);

        // Process salt
        const salt = options.salt
          ? await processInput(options.salt, 'salt', { requireHash: true }, verbose)
          : crypto.getRandomValues(new Uint8Array(32));
        log(`Salt: ${HexConverter.encode(salt)}\n`);

        // STEP 1: Create predicate FIRST (critical pattern!)
        log('Step 1: Creating predicate...');
        const predicate = nonce
          ? await MaskedPredicate.create(tokenId, tokenType, signingService, HashAlgorithm.SHA256, nonce)
          : await UnmaskedPredicate.create(tokenId, tokenType, signingService, HashAlgorithm.SHA256, salt);
        log('  ✓ Predicate created\n');

        // STEP 2: Derive address FROM the predicate
        log('Step 2: Deriving address from predicate...');
        const predicateRef = await predicate.getReference();
        const address = await predicateRef.toAddress();
        log(`  ✓ Address: ${address.address}\n`);

        // Process token data and UNCT proof
        let tokenDataBytes: Uint8Array;
        let recipientDataHash: DataHash | null = null;
        let coinOriginProof: CoinOriginProof | null = null;
        let mintReason: IMintTransactionReason | null = null;

        // UNCT Mining: Two-path logic (verified vs unverified)
        if (unctBlockHeight !== null) {
          const tokenIdHex = HexConverter.encode(tokenIdBytes);

          if (unctVerificationEnabled) {
            // PATH A: VERIFIED MODE - Full cryptographic verification
            log('Fetching and verifying UNCT coin origin proof from POW blockchain...');

            try {
              const powClient = createPoWClient({
                endpoint: options.unctUrl,
                useLocal: options.localUnct
              });

              // Check POW node connectivity
              const connected = await powClient.checkConnection();
              if (!connected) {
                const powEndpoint = options.localUnct ? 'http://localhost:8332' : options.unctUrl;
                console.error(`❌ Error: Cannot connect to POW node at ${powEndpoint}`);
                console.error('  Please ensure the POW blockchain is running');
                process.exit(1);
              }

              // Perform full cryptographic verification (4 checks)
              const verification = await powClient.verifyTokenIdInBlock(tokenIdHex, unctBlockHeight);

              if (!verification.valid) {
                // Verification failed
                console.error('\n❌ POW Verification Failed:');
                console.error(`  ${verification.error}`);
                console.error();

                if (!options.forceUnverified) {
                  console.error('⚠️  Token ID NOT consumed - you can retry with correct data');
                  console.error();
                  console.error('To mint anyway (DANGEROUS - may waste token ID):');
                  console.error('  Add --force-unverified flag');
                  console.error();
                  console.error('Or mint in unverified mode (omit --unct-url/--local-unct)');
                  process.exit(1);
                }

                // Force override - create proof and continue
                console.error('⚠️  WARNING: Proceeding with --force-unverified');
                console.error('   Token may be invalid and token ID may be wasted!');
                console.error();

                coinOriginProof = createProof(unctBlockHeight);
              } else {
                // Verification passed - create proof
                log('  ✓ All verification checks passed:');
                log('    ✓ Target matches SHA256(tokenId)');
                log('    ✓ Witness contains target');
                log('    ✓ Merkle root matches block header');
                log('    ✓ Witness composition correct');
                log('');

                coinOriginProof = createProof(verification.blockHeight!);

                log(`  Block Height: ${verification.blockHeight}`);
                log(`  Proof will be stored in genesis.reason field`);
                log('');
              }
            } catch (error) {
              console.error('\n❌ Error during POW verification:');
              console.error(`  ${error instanceof Error ? error.message : String(error)}`);
              console.error();
              console.error('⚠️  Token ID NOT consumed - you can retry');
              process.exit(1);
            }
          } else {
            // PATH B: UNVERIFIED MODE - Create proof without verification
            log('Creating UNCT coin origin proof (unverified mode)...');
            log('  WARNING: No cryptographic verification performed');
            log('  Token may be invalid if block/tokenId are incorrect');
            log('');

            // Create proof with just blockHeight
            // All other data (merkleRoot, target, witness) can be fetched from POW chain
            coinOriginProof = createProof(unctBlockHeight);

            log(`  Block Height: ${unctBlockHeight}`);
            log(`  Proof will be stored in genesis.reason field`);
            log('  Verification data can be fetched from POW blockchain later');
            log('');
          }

          // Create mint reason with coin origin proof (both paths)
          // This provides the justification for including UNCT coin liquidity
          mintReason = new CoinOriginMintReason(coinOriginProof);

          // Empty token data for UNCT (proof goes in reason field)
          tokenDataBytes = new Uint8Array(0);
          recipientDataHash = null; // No token data to hash

          log(`Created coin origin mint reason with proof`);
          log(`  Block Height: ${coinOriginProof.blockHeight}`);
          log(`  Proof stored in genesis.reason field (justifies coin origin)`);
          log('');
        } else if (options.tokenData) {
          // Regular token data (non-UNCT)
          tokenDataBytes = await processInput(options.tokenData, 'token data', { allowEmpty: false }, verbose);

          // CRITICAL: Compute recipientDataHash to commit to state.data
          // This is required for SDK verification of tokens with data
          const hasher = new DataHasher(HashAlgorithm.SHA256);
          recipientDataHash = await hasher.update(tokenDataBytes).digest();

          log(`Serialized JSON token data (${tokenDataBytes.length} bytes)`);
          log(`Computed recipientDataHash: ${HexConverter.encode(recipientDataHash.data)}`);
        } else {
          // Empty token data (no recipientDataHash needed)
          tokenDataBytes = new Uint8Array(0);
          log('Using empty token data');
        }

        // Process coins - handle preset fungible tokens
        let coinData: TokenCoinData;
        if (options.coins) {
          // Manual coin specification with validation
          const coinAmounts = options.coins.split(',').map((s: string) => {
            const trimmed = s.trim();

            // Validate format - must be numeric
            if (!/^-?\d+$/.test(trimmed)) {
              throw new Error(`Invalid coin amount: "${trimmed}" - must be numeric`);
            }

            const amount = BigInt(trimmed);

            // SECURITY: Reject negative coin amounts (SEC-INPUT-005)
            if (amount < 0n) {
              console.error('❌ Error: Coin amount cannot be negative');
              console.error(`  Provided: ${amount}`);
              process.exit(1);
            }

            return amount;
          });
          const coinsWithIds: [CoinId, bigint][] = coinAmounts.map((amount: bigint) => {
            const coinIdBytes = crypto.getRandomValues(new Uint8Array(32));
            return [new CoinId(coinIdBytes), amount];
          });
          coinData = TokenCoinData.create(coinsWithIds);
          log(`Creating token with ${coinAmounts.length} coin(s)`);
        } else if (presetInfo && presetInfo.assetKind === 'fungible') {
          // Preset fungible token - create single coin with amount 0
          const defaultCoinId = new CoinId(crypto.getRandomValues(new Uint8Array(32)));
          coinData = TokenCoinData.create([[defaultCoinId, BigInt(0)]]);
          const symbol = 'symbol' in presetInfo ? presetInfo.symbol : presetInfo.name;
          log(`Creating fungible ${symbol} token with default coin (amount: 0)`);
          log(`  Note: Use -c to specify amounts (e.g., -c "1000000000000000000" for 1 ${symbol})`);
        } else {
          // Non-fungible token (NFT)
          coinData = TokenCoinData.create([]);
          log('Creating non-fungible token (NFT)');
        }
        log('');

        // STEP 3: Create MintTransactionData using the address
        log('Step 3: Creating MintTransactionData...');
        const mintTransactionData = await MintTransactionData.create(
          tokenId,           // Token identifier
          tokenType,         // Token type identifier
          tokenDataBytes,    // Immutable token metadata (genesis.data.tokenData)
          coinData,          // Fungible coin data, or null
          address,           // Address of the first owner
          salt,              // Random salt used to derive predicates
          recipientDataHash, // Commit to state.data via hash (CRITICAL FIX)
          mintReason         // Reason (CoinOriginMintReason for UNCT, null otherwise)
        );
        log('  ✓ MintTransactionData created\n');

        // STEP 4: Create and submit commitment
        log('Step 4: Creating mint commitment...');
        const mintCommitment = await MintCommitment.create(mintTransactionData);
        log('  ✓ Commitment created\n');

        log('Step 5: Submitting to network...');
        const submitResponse = await client.submitMintCommitment(mintCommitment);
        log(`  ✓ Transaction submitted`);
        log(`  Request ID: ${mintCommitment.requestId.toJSON()}\n`);

        // STEP 6: Wait for inclusion proof
        log('Step 6: Waiting for inclusion proof...');
        const inclusionProof = await waitInclusionProof(client, mintCommitment, 60000, 1000, verbose);
        log('  ✓ Inclusion proof received\n');

        // Validate the inclusion proof
        log('Step 6.5: Validating inclusion proof...');
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

        log('  ✓ Proof structure validated (authenticator, transaction hash, merkle path)');
        log('  ✓ Authenticator signature verified');

        if (proofValidation.warnings.length > 0) {
          log('  Warnings:');
          proofValidation.warnings.forEach(warn => log(`    - ${warn}`));
        }
        log('');

        // STEP 7: Create TokenState with predicate
        log('Step 7: Creating TokenState with predicate...');
        const tokenState = new TokenState(predicate, tokenDataBytes);
        log('  ✓ TokenState created (uses SAME predicate)\n');

        // STEP 8: Create mint transaction
        log('Step 8: Creating mint transaction...');
        const mintTransaction = mintCommitment.toTransaction(inclusionProof);
        log('  ✓ Mint transaction created\n');

        // STEP 9: Create SDK-compliant TXF structure using SDK methods
        // Use tokenState.toJSON() to ensure proper predicate encoding
        // The predicate must be a CBOR array: [engine_id, template, params]
        log('Step 9: Creating SDK-compliant TXF structure...');

        const genesisDataJson = mintTransaction.data.toJSON();
        const genesisDataJsonStr = JSON.stringify(genesisDataJson);

        //  Custom integrity check: Hash the JSON representation to detect tampering
        const DataHasherModule = await import('@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js');
        const HashAlgorithmModule = await import('@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js');
        const jsonHash = await new DataHasherModule.DataHasher(HashAlgorithmModule.HashAlgorithm.SHA256)
          .update(new TextEncoder().encode(genesisDataJsonStr))
          .digest();

        const txfToken = {
          version: "2.0",
          genesis: {
            data: genesisDataJson,
            inclusionProof: inclusionProof.toJSON()
          },
          state: tokenState.toJSON(),  // ✅ Use SDK method for proper encoding!
          transactions: [],  // Empty for newly minted token
          nametags: [],
          // Custom integrity field for tampering detection
          // Hash of genesis.data JSON - if this doesn't match, the data was tampered with
          _integrity: {
            genesisDataJSONHash: HexConverter.encode(jsonHash.imprint)
          }
        };

        log('  ✓ TXF structure created with SDK method\n');

        // Get tokenId as hex string for multi-token format key
        const tokenIdHex = tokenId.toJSON();

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

        // Write to file if specified (multi-token format)
        if (outputFile && !options.stdout) {
          try {
            writeTokenToTxf(outputFile, txfToken, tokenIdHex);
            log(`Token saved to ${outputFile} (multi-token format)`);
          } catch (err) {
            console.error(`Error writing output file: ${err instanceof Error ? err.message : String(err)}`);
            throw err;
          }
        }

        // Final output (multi-token format for stdout)
        const multiTokenJson = JSON.stringify({ [`_${tokenIdHex}`]: txfToken }, null, 2);
        if (jsonOutput) {
          // JSON mode: output TXF to stdout, no status messages
          console.log(multiTokenJson);
        } else if ((!options.save && !options.output) || options.stdout) {
          // Output JSON to stdout if no file output OR if --stdout explicitly requested
          console.log(multiTokenJson);
        }

        // Print summary unless in JSON mode
        if (!jsonOutput) {
          console.log(formatMintOutput(txfToken, outputFile || undefined));
        }
      } catch (error) {
        console.error('\n❌ Error minting token:');
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