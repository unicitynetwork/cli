import { Command } from 'commander';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { AddressFactory } from '@unicitylabs/state-transition-sdk/lib/address/AddressFactory.js';
import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';
import { TokenType } from '@unicitylabs/state-transition-sdk/lib/token/TokenType.js';
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { ISerializable } from '@unicitylabs/state-transition-sdk/lib/ISerializable.js';
import { TokenCoinData } from '@unicitylabs/state-transition-sdk/lib/token/fungible/TokenCoinData.js';
import { CoinId } from '@unicitylabs/state-transition-sdk/lib/token/fungible/CoinId.js';
import { JsonRpcNetworkError } from '@unicitylabs/commons/lib/json-rpc/JsonRpcNetworkError.js';
import { MintCommitment } from '@unicitylabs/state-transition-sdk/lib/transaction/MintCommitment.js';
import { MintTransactionData } from '@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionData.js';
import { InclusionProof, InclusionProofVerificationStatus } from '@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.js';
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import { IMintTransactionReason } from '@unicitylabs/state-transition-sdk/lib/transaction/IMintTransactionReason.js';
import * as fs from 'fs';

// Simple token data class that implements ISerializable
class SimpleTokenData implements ISerializable {
  private _data: Uint8Array;

  constructor(data: Uint8Array) {
    this._data = new Uint8Array(data);
  }

  get data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  static decode(data: Uint8Array): Promise<SimpleTokenData> {
    return Promise.resolve(new SimpleTokenData(data));
  }

  encode(): Uint8Array {
    return this.data;
  }

  toJSON(): string {
    return HexConverter.encode(this.data);
  }
  
  toCBOR(): Uint8Array {
    return this.data;
  }
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
async function waitInclusionProof(
  client: StateTransitionClient,
  commitment: MintCommitment<IMintTransactionReason>,
  timeoutMs: number = 30000,
  intervalMs: number = 1000
): Promise<InclusionProof> {
  const startTime = Date.now();
  
  // Log commitment info for debugging
  console.error('Waiting for inclusion proof for commitment...');
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      // Pass the entire commitment object to StateTransitionClient.getInclusionProof
      // StateTransitionClient expects a Commitment object
      const proofResponse = await client.getInclusionProof(commitment);

      if (proofResponse !== null && proofResponse.inclusionProof) {
        // Create InclusionProof from the response
        const proof = InclusionProof.fromJSON(proofResponse);

        // Create a trust base for verification (using minimal trust base for now)
        const trustBase = RootTrustBase.fromJSON({
          version: "1",
          networkId: 1,
          epoch: "0",
          epochStartRound: "0",
          rootNodes: [],
          quorumThreshold: "0",
          stateHash: HexConverter.encode(new Uint8Array(32)),
          changeRecordHash: null,
          previousEntryHash: null,
          signatures: {}
        });

        // Verify the inclusion proof status
        const status = await proof.verify(trustBase, commitment.requestId);

        if (status === InclusionProofVerificationStatus.OK) {
          return proof;
        } else if (status === InclusionProofVerificationStatus.PATH_NOT_INCLUDED) {
          // If PATH_NOT_INCLUDED (non-inclusion), continue polling
          console.error(`Inclusion proof status is ${status}, retrying...`);
        } else {
          // If status is anything other than OK or PATH_NOT_INCLUDED, throw an error
          throw new Error(`Inclusion proof verification failed with status: ${status}`);
        }
      }
    } catch (err) {
      if (err instanceof JsonRpcNetworkError && err.status === 404) {
        // Continue polling
        console.error('Inclusion proof not found yet (404), retrying...');
      } else {
        console.error('Error getting inclusion proof:', err);
        throw err;
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
    .description('Mint a new token on the Unicity Network')
    .argument('<address>', 'Destination address of the first token owner')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('--local', 'Use local aggregator (http://localhost:3000)')
    .option('--production', 'Use production aggregator (https://gateway.unicity.network)')
    .option('--preset <type>', 'Use preset token type: nft, alpha/uct, usdu, euru')
    .option('-r, --reason <reason>', 'Reason for minting (optional description)')
    .option('-c, --coins <coins>', 'Comma-separated list of coin amounts (e.g., "100,200,300")')
    .option('-m, --metadata <metadata>', 'Initial metadata (JSON string or plain text)')
    .option('-s, --state <state>', 'Initial state data (hex string or text to be hashed)')
    .option('-i, --token-id <tokenId>', 'Token ID (hex string or text to be hashed, randomly generated if not provided)')
    .option('-y, --token-type <tokenType>', 'Token type (hex string or text to be hashed, defaults to unicity NFT type)')
    .option('-o, --output <file>', 'Output TXF file path (use "-" for STDOUT)')
    .option('--stdout', 'Output to STDOUT instead of file')
    .action(async (address: string, options) => {
      // Determine endpoint
      let endpoint = options.endpoint;
      if (options.local) {
        endpoint = 'http://localhost:3000';
      } else if (options.production) {
        endpoint = 'https://gateway.unicity.network';
      }

      try {
        // Create AggregatorClient and StateTransitionClient
        const aggregatorClient = new AggregatorClient(endpoint);
        const client = new StateTransitionClient(aggregatorClient);

        // Parse the recipient address using AddressFactory
        const recipientAddress = await AddressFactory.createAddress(address);
        console.error(`Minting token to address: ${address}`);

        // Process tokenId - must be 256-bit (64 hex chars) or will be hashed
        const tokenIdBytes = await processInput(options.tokenId, 'tokenId', { requireHash: true });
        const tokenId = new TokenId(tokenIdBytes);

        // Process tokenType with preset support
        const { tokenType, presetInfo } = await processTokenType(options.tokenType, options.preset);

        // Process state data (metadata) - accepts any format
        let stateBytes: Uint8Array;
        if (options.state) {
          // State takes precedence if both state and metadata are provided
          stateBytes = await processInput(options.state, 'state data', { allowEmpty: false });
        } else if (options.metadata) {
          // Use metadata as state data
          stateBytes = await processInput(options.metadata, 'metadata', { allowEmpty: false });
          console.error('Using metadata as state data');
        } else {
          // Empty state
          stateBytes = new Uint8Array(0);
          console.error('Using empty state data');
        }

        // Process coins - handle preset fungible tokens
        let coinData: TokenCoinData;
        if (options.coins) {
          // Manual coin specification - each amount creates a coin with auto-generated ID
          const coinAmounts = options.coins.split(',').map((s: string) => BigInt(s.trim()));
          const coinsWithIds: [CoinId, bigint][] = coinAmounts.map((amount: bigint, index: number) => {
            // Generate a unique CoinId for each coin
            const coinIdBytes = crypto.getRandomValues(new Uint8Array(32));
            return [new CoinId(coinIdBytes), amount];
          });
          coinData = TokenCoinData.create(coinsWithIds);
          console.error(`Creating token with ${coinAmounts.length} coins: ${coinAmounts.join(', ')}`);
        } else if (presetInfo && presetInfo.assetKind === 'fungible') {
          // Preset fungible token without explicit coins - create single coin with amount 0
          // This follows the convention that fungible tokens need at least one coin
          const defaultCoinId = new CoinId(crypto.getRandomValues(new Uint8Array(32)));
          coinData = TokenCoinData.create([[defaultCoinId, BigInt(0)]]);
          const symbol = 'symbol' in presetInfo ? presetInfo.symbol : presetInfo.name;
          console.error(`Creating fungible ${symbol} token with default coin (amount: 0)`);
          console.error(`  Note: Use -c option to specify coin amounts (e.g., -c "1000000000000000000" for 1 ${symbol})`);
        } else {
          // Non-fungible token (NFT)
          coinData = TokenCoinData.create([]);
          console.error('Creating non-fungible token (NFT)');
        }

        // Process reason (if provided)
        // Note: reason is stored as metadata in TXF, SDK expects null for simple mints
        const reason = options.reason ? options.reason : null;
        if (reason) {
          console.error(`Mint reason: ${reason}`);
        }

        // Process salt (always generate random for mint)
        const salt = crypto.getRandomValues(new Uint8Array(32));
        console.error(`Generated salt: ${HexConverter.encode(salt)}`);

        // Create token data wrapper (use state data as custom token data)
        const tokenData = new SimpleTokenData(stateBytes);

        // Create mint transaction data
        const mintTransactionData = await MintTransactionData.create(
          tokenId,
          tokenType,
          tokenData.encode(),  // Custom token data
          coinData,
          recipientAddress,
          salt,
          null,  // Nametag tokens
          null   // Owner reference (reason is deprecated in favor of owner reference)
        );

        // Create mint commitment
        const mintCommitment = await MintCommitment.create(mintTransactionData);

        // Submit mint commitment
        console.error('Submitting mint transaction...');
        const submitResponse = await client.submitMintCommitment(mintCommitment);

        console.error(`Transaction submitted. Waiting for inclusion proof ${mintCommitment.requestId.toJSON()}...`);

        // Wait for inclusion proof
        const inclusionProof = await waitInclusionProof(client, mintCommitment);
        console.error('Inclusion proof received. Creating token...');

        // Create mint transaction from commitment
        const mintTransaction = mintCommitment.toTransaction(inclusionProof);

        // Create a trust base for token creation
        const trustBase = RootTrustBase.fromJSON({
          version: "1",
          networkId: 1,
          epoch: "0",
          epochStartRound: "0",
          rootNodes: [],
          quorumThreshold: "0",
          stateHash: HexConverter.encode(new Uint8Array(32)),
          changeRecordHash: null,
          previousEntryHash: null,
          signatures: {}
        });

        // For TXF file, we just need to save the transaction data
        // The token structure for TXF doesn't require a full Token object
        // We'll create a TXF-compatible JSON structure
        const txfToken = {
          version: "2.0",
          id: tokenId.toJSON(),
          type: coinData.coins.length > 0 ? "fungible" : "nft",
          state: {
            data: stateBytes.length > 0 ? HexConverter.encode(stateBytes) : null,
            unlockPredicate: null  // Will be set by recipient when they claim
          },
          genesis: {
            data: {
              tokenId: tokenId.toJSON(),
              tokenType: tokenType.toJSON(),
              tokenData: stateBytes.length > 0 ? HexConverter.encode(stateBytes) : null,
              recipient: address
            }
          },
          transactions: [
            {
              type: "mint",
              data: mintTransaction.toJSON(),
              inclusionProof: inclusionProof.toJSON()
            }
          ],
          status: "CONFIRMED",
          ...(coinData.coins.length > 0 && {
            amount: coinData.coins.reduce((sum, coin) => sum + coin[1], BigInt(0)).toString(),
            coins: coinData.coins.map(([coinId, amount]) => ({
              id: HexConverter.encode(coinId.bytes),
              amount: amount.toString()
            }))
          }),
          ...(presetInfo && {
            tokenInfo: {
              name: presetInfo.name,
              ...(presetInfo.symbol && { symbol: presetInfo.symbol }),
              ...(presetInfo.decimals !== undefined && { decimals: presetInfo.decimals }),
              description: presetInfo.description,
              assetKind: presetInfo.assetKind
            }
          }),
          ...(reason && { reason }),
          ...(options.metadata && { metadata: options.metadata })
        };

        const tokenJson = JSON.stringify(txfToken, null, 2);

        // Generate default filename if needed
        let outputFile: string | null = null;
        if (options.output) {
          outputFile = options.output;
        } else if (!options.stdout) {
          // Auto-generate filename based on date, time, and address
          const now = new Date();
          const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
          const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
          const timestamp = Date.now();

          // Extract first 10 chars of address (without SCHEME prefix)
          const addressParts = address.split(':');
          const addressBody = addressParts.length > 1 ? addressParts[1] : addressParts[0];
          const addressPrefix = addressBody.substring(0, 10);

          outputFile = `${dateStr}_${timeStr}_${timestamp}_${addressPrefix}.txf`;
        }

        // Output to file or stdout
        if (options.output === '-' || options.stdout) {
          // Output to STDOUT
          console.log(tokenJson);
        } else if (outputFile) {
          // Save to file
          fs.writeFileSync(outputFile, tokenJson);
          console.error(`Token saved to ${outputFile}`);
          // Also output to stdout for pipeline use
          console.log(tokenJson);
        } else {
          // Just output to stdout
          console.log(tokenJson);
        }
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