import { Command } from 'commander';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { DataHash } from '@unicitylabs/commons/lib/hash/DataHash.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { MaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/MaskedPredicate.js';
import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';
import { TokenType } from '@unicitylabs/state-transition-sdk/lib/token/TokenType.js';
import { DirectAddress } from '@unicitylabs/state-transition-sdk/lib/address/DirectAddress.js';
import * as readline from 'readline';
import { promisify } from 'util';

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

// Function to validate or generate a nonce/tokenId
async function processHexOrGenerateHash(input: string | undefined, label: string): Promise<Uint8Array> {
  // If not provided, generate random 32 bytes
  if (!input) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    console.log(`Generated random ${label}: ${HexConverter.encode(randomBytes)}`);
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
  console.log(`Hashed ${label} input: ${HexConverter.encode(hashBytes)}`);
  return hashBytes;
}

export function genAddressCommand(program: Command): void {
  program
    .command('gen-address')
    .description('Generate a new address for the Unicity Network')
    .option('-n, --nonce <nonce>', 'Nonce value (optional, will be randomly generated if not provided)')
    .option('-t, --token-id <tokenId>', 'Token ID (optional, will be randomly generated if not provided)')
    .option('-y, --token-type <tokenType>', 'Token type (optional, defaults to hashed "unicity_standard_token_type")')
    .action(async (options) => {
      try {
        // Read the secret (from env var or user input)
        const secretStr = await readSecret();
        const secret = new TextEncoder().encode(secretStr);

        // Process nonce (validate or generate)
        const nonce = await processHexOrGenerateHash(options.nonce, 'nonce');

        // Process tokenId (validate or generate)
        const tokenIdBytes = await processHexOrGenerateHash(options.tokenId, 'tokenId');
        const tokenId = TokenId.create(tokenIdBytes);

        // Process tokenType (validate, generate, or use default)
        let tokenTypeBytes: Uint8Array;
        if (options.tokenType) {
          tokenTypeBytes = await processHexOrGenerateHash(options.tokenType, 'tokenType');
        } else {
          // Default to hash of "unicity_standard_token_type"
          const defaultTypeStr = "unicity_standard_token_type";
          const hasher = new DataHasher(HashAlgorithm.SHA256);
          const hash = await hasher.update(new TextEncoder().encode(defaultTypeStr)).digest();
          tokenTypeBytes = hash.data;
          console.log(`Using default token type (hash of "${defaultTypeStr}"): ${HexConverter.encode(tokenTypeBytes)}`);
        }
        const tokenType = TokenType.create(tokenTypeBytes);

        // Create a SigningService from the secret
        const signingService = await SigningService.createFromSecret(secret, nonce);

        // Create a MaskedPredicate (as shown in the reference implementation)
        const predicate = await MaskedPredicate.create(
          tokenId,
          tokenType,
          signingService,
          HashAlgorithm.SHA256,
          nonce
        );

        // Create a DirectAddress from the predicate's imprint
        const address = await DirectAddress.create(predicate.reference.imprint);

        // Output the results
        console.log('\nGenerated Address:');
        console.log('----------------------------------------');
        console.log(`Address: ${address.toDto()}`);
        console.log(`Nonce: ${HexConverter.encode(nonce)}`);
        console.log(`TokenId: ${tokenId.toDto()}`);
        console.log(`TokenType: ${tokenType.toDto()}`);
        console.log('----------------------------------------');
        console.log('IMPORTANT: Keep your secret and nonce secure - they are required to spend from this address.');
      } catch (error) {
        console.error(JSON.stringify(error));
        console.error(`Error generating address: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
}