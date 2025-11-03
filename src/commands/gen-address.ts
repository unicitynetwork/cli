import { Command } from 'commander';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { DataHash } from '@unicitylabs/state-transition-sdk/lib/hash/DataHash.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import { MaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/MaskedPredicate.js';
import { UnmaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/UnmaskedPredicate.js';
import { TokenType } from '@unicitylabs/state-transition-sdk/lib/token/TokenType.js';
import { DirectAddress } from '@unicitylabs/state-transition-sdk/lib/address/DirectAddress.js';
import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';
import * as readline from 'readline';

// Official Unicity token types from https://github.com/unicitynetwork/unicity-ids
const UNICITY_TOKEN_TYPES: Record<string, { id: string; name: string; description: string }> = {
  'nft': {
    id: 'f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509',
    name: 'unicity',
    description: 'Unicity testnet NFT token type'
  },
  'alpha': {
    id: '455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89',
    name: 'unicity',
    description: 'Unicity testnet native coin (UCT)'
  },
  'uct': {
    id: '455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89',
    name: 'unicity',
    description: 'Unicity testnet native coin (UCT)'
  },
  'usdu': {
    id: '8f0f3d7a5e7297be0ee98c63b81bcebb2740f43f616566fc290f9823a54f52d7',
    name: 'unicity-usd',
    description: 'Unicity testnet USD stablecoin'
  },
  'euru': {
    id: '5e160d5e9fdbb03b553fb9c3f6e6c30efa41fa807be39fb4f18e43776e492925',
    name: 'unicity-eur',
    description: 'Unicity testnet EUR stablecoin'
  }
};

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

// Function to validate or generate a nonce
async function processNonce(input: string | undefined): Promise<Uint8Array | null> {
  // If not provided, return null (will be treated as unmasked)
  if (!input) {
    return null;
  }

  // If it's a valid 32-byte hex string, convert it to bytes
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(input)) {
    const hexStr = input.startsWith('0x') ? input.slice(2) : input;
    const nonce = HexConverter.decode(hexStr);
    console.error(`Using nonce: ${HexConverter.encode(nonce)}`);
    return nonce;
  }

  // Otherwise, hash the input to get 32 bytes
  const hasher = new DataHasher(HashAlgorithm.SHA256);
  const hash = await hasher.update(new TextEncoder().encode(input)).digest();
  const hashBytes = hash.data;
  console.error(`Hashed nonce input to: ${HexConverter.encode(hashBytes)}`);
  return hashBytes;
}

// Function to process token type (preset or custom)
async function processTokenType(
  tokenTypeOption: string | undefined,
  preset: string | undefined
): Promise<{ tokenType: TokenType; presetInfo?: any }> {
  // If preset is specified, use it
  if (preset) {
    const presetKey = preset.toLowerCase();
    const presetType = UNICITY_TOKEN_TYPES[presetKey];

    if (!presetType) {
      throw new Error(`Unknown preset: ${preset}. Available presets: ${Object.keys(UNICITY_TOKEN_TYPES).join(', ')}`);
    }

    const tokenTypeBytes = HexConverter.decode(presetType.id);
    console.error(`Using preset '${preset}': ${presetType.description}`);
    console.error(`TokenType ID: ${presetType.id}`);
    return { tokenType: new TokenType(tokenTypeBytes), presetInfo: presetType };
  }

  // If custom token type is specified
  if (tokenTypeOption) {
    // Check if it's a valid 64-char hex string (256-bit)
    if (/^(0x)?[0-9a-fA-F]{64}$/.test(tokenTypeOption)) {
      const hexStr = tokenTypeOption.startsWith('0x') ? tokenTypeOption.slice(2) : tokenTypeOption;
      const tokenTypeBytes = HexConverter.decode(hexStr);
      console.error(`Using custom TokenType: ${hexStr}`);
      return { tokenType: new TokenType(tokenTypeBytes) };
    }

    // Otherwise hash it to 256-bit
    const hasher = new DataHasher(HashAlgorithm.SHA256);
    const hash = await hasher.update(new TextEncoder().encode(tokenTypeOption)).digest();
    const hashBytes = hash.data;
    console.error(`Hashed custom token type "${tokenTypeOption}" to: ${HexConverter.encode(hashBytes)}`);
    return { tokenType: new TokenType(hashBytes) };
  }

  // Default to UCT/alpha preset (most common use case)
  const defaultPreset = UNICITY_TOKEN_TYPES['uct'];
  const tokenTypeBytes = HexConverter.decode(defaultPreset.id);
  console.error(`Using default preset 'uct': ${defaultPreset.description}`);
  console.error(`TokenType ID: ${defaultPreset.id}`);
  return { tokenType: new TokenType(tokenTypeBytes), presetInfo: defaultPreset };
}

export function genAddressCommand(program: Command): void {
  program
    .command('gen-address')
    .description('Generate a new direct address for the Unicity Network')
    .option('--preset <type>', 'Use preset token type: nft, alpha/uct (default), usdu, euru')
    .option('-y, --token-type <tokenType>', 'Custom token type (hex string or text to be hashed)')
    .option('-n, --nonce <nonce>', 'Nonce value for masked/single-use address (hex string or text to be hashed, omit for unmasked address)')
    .action(async (options) => {
      try {
        // Read the secret (from env var or user input)
        const secretStr = await readSecret();
        const secret = new TextEncoder().encode(secretStr);

        // Process token type (preset or custom)
        const { tokenType, presetInfo } = await processTokenType(options.tokenType, options.preset);

        // Process nonce (if provided, generates masked address; otherwise unmasked)
        const nonce = await processNonce(options.nonce);
        const isMasked = nonce !== null;

        // Create a dummy tokenId for address generation
        const dummyTokenId = new TokenId(new Uint8Array(32));

        let address: DirectAddress;
        let signingService: SigningService;

        if (isMasked) {
          // Generate masked/single-use address
          console.error('\nGenerating MASKED (single-use) address...\n');

          // Create a SigningService from the secret with nonce
          signingService = await SigningService.createFromSecret(secret, nonce);

          // Create masked predicate
          const predicate = MaskedPredicate.create(
            dummyTokenId,
            tokenType,
            signingService,
            HashAlgorithm.SHA256,
            nonce
          );

          // Get the predicate reference
          const predicateReference = await predicate.getReference();

          // Create a DirectAddress from the predicate reference
          address = await DirectAddress.create(predicateReference.hash);

          // Output the results
          console.log(JSON.stringify({
            type: 'masked',
            address: address.address,
            nonce: HexConverter.encode(nonce),
            tokenType: tokenType.toJSON(),
            tokenTypeInfo: presetInfo ? {
              preset: options.preset || 'uct',
              name: presetInfo.name,
              description: presetInfo.description
            } : undefined
          }, null, 2));

          console.error('\n⚠️  IMPORTANT: This is a MASKED (single-use) address.');
          console.error('Keep your secret AND nonce secure - both are required to spend from this address.');
          console.error('This address can only be used ONCE per token type.\n');
        } else {
          // Generate unmasked/reusable address
          console.error('\nGenerating UNMASKED (reusable) address...\n');

          // Create a SigningService from the secret without nonce
          signingService = await SigningService.createFromSecret(secret);

          // Create unmasked predicate
          const predicate = await UnmaskedPredicate.create(
            dummyTokenId,
            tokenType,
            signingService,
            HashAlgorithm.SHA256,
            new Uint8Array(32)  // salt
          );

          // Get the predicate reference
          const predicateReference = await predicate.getReference();

          // Create a DirectAddress from the predicate reference
          address = await DirectAddress.create(predicateReference.hash);

          // Output the results
          console.log(JSON.stringify({
            type: 'unmasked',
            address: address.address,
            tokenType: tokenType.toJSON(),
            tokenTypeInfo: presetInfo ? {
              preset: options.preset || 'uct',
              name: presetInfo.name,
              description: presetInfo.description
            } : undefined
          }, null, 2));

          console.error('\n✅ IMPORTANT: This is an UNMASKED (reusable) address.');
          console.error('Keep your secret secure - it is required to spend from this address.');
          console.error('This address can receive multiple tokens of this token type.\n');
        }
      } catch (error) {
        console.error(JSON.stringify(error));
        console.error(`Error generating address: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
}