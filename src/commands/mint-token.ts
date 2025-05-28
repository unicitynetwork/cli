import { Command } from 'commander';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { DataHash } from '@unicitylabs/commons/lib/hash/DataHash.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { DirectAddress } from '@unicitylabs/state-transition-sdk/lib/address/DirectAddress.js';
import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';
import { TokenType } from '@unicitylabs/state-transition-sdk/lib/token/TokenType.js';
import { TokenState } from '@unicitylabs/state-transition-sdk/lib/token/TokenState.js';
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { ISerializable } from '@unicitylabs/state-transition-sdk/lib/ISerializable.js';
import { TokenCoinData } from '@unicitylabs/state-transition-sdk/lib/token/fungible/TokenCoinData.js';
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { JsonRpcNetworkError } from '@unicitylabs/commons/lib/json-rpc/JsonRpcNetworkError.js';
import { MaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/MaskedPredicate.js';
import { UnmaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/UnmaskedPredicate.js';
import { Commitment } from '@unicitylabs/state-transition-sdk/lib/transaction/Commitment.js';
import { MintTransactionData } from '@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionData.js';
import { TransactionData } from '@unicitylabs/state-transition-sdk/lib/transaction/TransactionData.js';
import { InclusionProof, InclusionProofVerificationStatus } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import * as readline from 'readline';

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

// Function to read the secret as a password
async function readSecret(): Promise<string> {
  // Check if SECRET environment variable is set
  if (process.env.SECRET) {
    const secret = process.env.SECRET;
    // Clear the environment variable for security
    process.env.SECRET = '';
    return secret;
  }

  // If SECRET is not provided, prompt the user
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) => {
    rl.question('Enter secret (password): ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
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
  return TokenType.create(tokenTypeBytes);
}

// Function to wait for an inclusion proof with timeout
async function waitInclusionProof(
  client: StateTransitionClient,
  commitment: Commitment<TransactionData | MintTransactionData<ISerializable | null>>,
  timeoutMs: number = 30000,
  intervalMs: number = 1000
): Promise<InclusionProof> {
  const startTime = Date.now();
  
  // Log commitment info for debugging
  console.error('Waiting for inclusion proof for commitment...');
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      // Pass the entire commitment object to StateTransitionClient.getInclusionProof
      // StateTransitionClient expects a Commitment object, not just the requestId
      const proof = await client.getInclusionProof(commitment);
      
      if (proof !== null) {
        // Verify the inclusion proof status using requestId.toBigInt()
        const status = await proof.verify(commitment.requestId.toBigInt());
        
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
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('-n, --nonce <nonce>', 'Nonce value (required for masked addresses, will be randomly generated if not provided)')
    .option('-u, --unmasked', 'Generate an unmasked address (default is masked)')
    .option('-i, --token-id <tokenId>', 'Token ID (optional, will be randomly generated if not provided)')
    .option('-y, --token-type <tokenType>', 'Token type (optional, defaults to hashed "unicity_standard_token_type")')
    .option('-d, --token-data <tokenData>', 'Token data (optional, will be empty if not provided)')
    .option('-s, --salt <salt>', 'Salt value (optional, will be randomly generated if not provided)')
    .option('-h, --data-hash <dataHash>', 'Data hash (optional)')
    .option('-r, --reason <reason>', 'Reason for minting (optional)')
    .action(async (options) => {
      // Get the endpoint from options
      const endpoint = options.endpoint;
      try {
        // Create AggregatorClient and StateTransitionClient
        const aggregatorClient = new AggregatorClient(endpoint);
        const client = new StateTransitionClient(aggregatorClient);
        
        // Read the secret (from env var or user input)
        const secretStr = await readSecret();
        const secret = new TextEncoder().encode(secretStr);
        
        // Determine if generating masked or unmasked address
        const isUnmasked = options.unmasked === true;
        
        // Create predicate and recipient address
        let predicate;
        let recipientAddress;
        
        if (isUnmasked) {
          // For unmasked predicate, we don't need a nonce
          const signingService = await SigningService.createFromSecret(secret);
          
          // Process salt (validate or generate) for unmasked predicate
          const salt = await processHexOrGenerateHash(options.salt, 'salt');
          
          // Process tokenType
          const tokenType = await processTokenType(options.tokenType);
          
          // Create a temporary tokenId for predicate creation (will be replaced later)
          const tempTokenId = TokenId.create(crypto.getRandomValues(new Uint8Array(32)));
          
          // Create unmasked predicate
          predicate = await UnmaskedPredicate.create(
            tempTokenId,
            tokenType,
            signingService,
            HashAlgorithm.SHA256,
            salt
          );
        } else {
          // For masked predicate, we need a nonce
          const nonce = await processHexOrGenerateHash(options.nonce, 'nonce');
          
          // Process tokenType
          const tokenType = await processTokenType(options.tokenType);
          
          // Create a SigningService with nonce
          const signingService = await SigningService.createFromSecret(secret, nonce);
          
          // Create a temporary tokenId for predicate creation (will be replaced later)
          const tempTokenId = TokenId.create(crypto.getRandomValues(new Uint8Array(32)));
          
          // Create masked predicate
          predicate = await MaskedPredicate.create(
            tempTokenId,
            tokenType,
            signingService,
            HashAlgorithm.SHA256,
            nonce
          );
        }
        
        // Create recipient address from predicate
        recipientAddress = await DirectAddress.create(predicate.reference.imprint);
        console.error(`Minting token to address: ${recipientAddress.toDto()}`);
        
        
        // Process tokenId (validate or generate)
        const tokenIdBytes = await processHexOrGenerateHash(options.tokenId, 'tokenId');
        const tokenId = TokenId.create(tokenIdBytes);
        
        // Process tokenType again here for consistency with the token
        const tokenType = await processTokenType(options.tokenType);
        
        // Process token data
        let tokenData: SimpleTokenData;
        let dataBytes: Uint8Array;
        if (options.tokenData) {
          dataBytes = await processHexOrGenerateHash(options.tokenData, 'tokenData');
          tokenData = new SimpleTokenData(dataBytes);
        } else {
          // Use empty data if not provided
          dataBytes = new Uint8Array(0);
          tokenData = new SimpleTokenData(dataBytes);
          console.error('Using empty token data');
        }
        
        // Process salt (validate or generate)
        const salt = await processHexOrGenerateHash(options.salt, 'salt');
        
        // Process data hash (if provided)
        let dataHash: DataHash | null = null;
        if (options.dataHash) {
          const dataHashBytes = await processHexOrGenerateHash(options.dataHash, 'dataHash');
          const hasher = new DataHasher(HashAlgorithm.SHA256);
          dataHash = await hasher.update(dataHashBytes).digest();
        }
        
        // Process reason (if provided)
        const reason = options.reason ? options.reason : null;
        
        // Create empty coin data (non-fungible token)
        const coinData = new TokenCoinData([]);
        
        // Submit mint transaction
        console.log('Submitting mint transaction...');
        const mintCommitment = await client.submitMintTransaction(
          recipientAddress,
          tokenId,
          tokenType,
          tokenData,
          coinData,
          salt,
          dataHash,
          reason
        );
        
        console.log('Transaction submitted. Waiting for inclusion proof '+mintCommitment.requestId.toJSON()+'...');
        
        // Wait for inclusion proof
        const inclusionProof = await waitInclusionProof(client, mintCommitment);
        console.log('Inclusion proof received. Creating transaction...');
        
        // Create transaction
        const mintTransaction = await client.createTransaction(mintCommitment, inclusionProof);
        
        // Create a token state from the predicate and data
        // We can now use our predicate directly
        const tokenState = await TokenState.create(predicate, dataBytes);
        
        // Create token with the token state
        const token = new Token(
          tokenId,
          tokenType,
          tokenData,
          coinData,
          tokenState,
          [mintTransaction]
        );
        
        // Output the token as JSON
        console.log(JSON.stringify(token.toDto(), null, 2));
      } catch (error) {
        console.error(`Error minting token: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error && error.stack) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });
}