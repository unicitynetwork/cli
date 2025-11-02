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

// Function to validate or generate bytes
async function processHexOrGenerateHash(input: string | undefined, label: string): Promise<Uint8Array> {
  // If not provided, generate random 32 bytes
  if (!input) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    console.error(`Generated random ${label}: ${HexConverter.encode(randomBytes)}`);
    return randomBytes;
  }

  // If it's a valid 32-byte hex string, convert it to bytes
  if (/^[0-9a-fA-F]{64}$/.test(input)) {
    return HexConverter.decode(input);
  }

  // Otherwise, hash the input to get 32 bytes
  const hasher = new DataHasher(HashAlgorithm.SHA256);
  const hash = await hasher.update(new TextEncoder().encode(input)).digest();
  const hashBytes = hash.data;
  console.error(`Hashed ${label} input: ${HexConverter.encode(hashBytes)}`);
  return hashBytes;
}

// Function to process token type
async function processTokenType(tokenTypeOption: string | undefined): Promise<TokenType> {
  let tokenTypeBytes: Uint8Array;
  if (tokenTypeOption) {
    tokenTypeBytes = await processHexOrGenerateHash(tokenTypeOption, 'tokenType');
  } else {
    // Default to hash of "unicity_standard_token_type"
    const defaultTypeStr = "unicity_standard_token_type";
    const hasher = new DataHasher(HashAlgorithm.SHA256);
    const hash = await hasher.update(new TextEncoder().encode(defaultTypeStr)).digest();
    tokenTypeBytes = hash.data;
    console.error(`Using default token type (hash of "${defaultTypeStr}"): ${HexConverter.encode(tokenTypeBytes)}`);
  }
  return new TokenType(tokenTypeBytes);
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

export function mintTokenCommand(program: Command): void {
  program
    .command('mint-token')
    .description('Mint a new token on the Unicity Network')
    .argument('<address>', 'Destination address of the first token owner')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('--local', 'Use local aggregator (http://localhost:3000)')
    .option('--production', 'Use production aggregator (https://gateway.unicity.network)')
    .option('-r, --reason <reason>', 'Reason for minting (optional description)')
    .option('-c, --coins <coins>', 'Comma-separated list of coin amounts (e.g., "100,200,300")')
    .option('-m, --metadata <metadata>', 'Initial metadata (JSON string or plain text)')
    .option('-s, --state <state>', 'Initial state data (hex string or text to be hashed)')
    .option('-i, --token-id <tokenId>', 'Token ID (hex string or text to be hashed, randomly generated if not provided)')
    .option('-y, --token-type <tokenType>', 'Token type (hex string or text to be hashed, defaults to "unicity_standard_token_type")')
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

        // Process tokenId (validate or generate)
        const tokenIdBytes = await processHexOrGenerateHash(options.tokenId, 'tokenId');
        const tokenId = new TokenId(tokenIdBytes);

        // Process tokenType
        const tokenType = await processTokenType(options.tokenType);

        // Process state data (metadata)
        let stateBytes: Uint8Array;
        if (options.state) {
          stateBytes = await processHexOrGenerateHash(options.state, 'state data');
        } else if (options.metadata) {
          // If metadata is provided but not state, use metadata as state
          const metadataStr = options.metadata;
          const hasher = new DataHasher(HashAlgorithm.SHA256);
          const hash = await hasher.update(new TextEncoder().encode(metadataStr)).digest();
          stateBytes = hash.data;
          console.error(`Using metadata as state data: ${HexConverter.encode(stateBytes)}`);
        } else {
          // Use empty state if neither provided
          stateBytes = new Uint8Array(0);
          console.error('Using empty state data');
        }

        // Process coins
        let coinData: TokenCoinData;
        if (options.coins) {
          const coinAmounts = options.coins.split(',').map((s: string) => BigInt(s.trim()));
          coinData = TokenCoinData.create(coinAmounts);
          console.error(`Creating token with ${coinAmounts.length} coins: ${coinAmounts.join(', ')}`);
        } else {
          // Create empty coin data (non-fungible token)
          coinData = TokenCoinData.create([]);
          console.error('Creating non-fungible token (no coins)');
        }

        // Process reason (if provided)
        const reason = options.reason ? options.reason : null;
        if (reason) {
          console.error(`Mint reason: ${reason}`);
        }

        // Process salt (always generate for mint)
        const salt = await processHexOrGenerateHash(undefined, 'salt');

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
        console.error(`Error minting token: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error && error.stack) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });
}