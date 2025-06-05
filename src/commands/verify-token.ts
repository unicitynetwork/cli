import { Command } from 'commander';
import { DirectAddress } from '@unicitylabs/state-transition-sdk/lib/address/DirectAddress.js';
import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';
import { TokenType } from '@unicitylabs/state-transition-sdk/lib/token/TokenType.js';
import { TokenFactory } from '@unicitylabs/state-transition-sdk/lib/token/TokenFactory.js';
import { PredicateFactory } from '@unicitylabs/state-transition-sdk/lib/predicate/PredicateFactory.js';
import { ISerializable } from '@unicitylabs/state-transition-sdk/lib/ISerializable.js';
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import * as readline from 'readline';
import * as fs from 'fs';

// Function to read the secret as a password if needed
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

// Simple class to implement ISerializable for token data
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

  static fromJSON(data: string): Promise<SimpleTokenData> {
    if (typeof data === 'string') {
      return Promise.resolve(new SimpleTokenData(HexConverter.decode(data)));
    }
    return Promise.resolve(new SimpleTokenData(new Uint8Array()));
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

export function verifyTokenCommand(program: Command): void {
  program
    .command('verify-token')
    .description('Verify and display information about a token')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('-f, --file <file>', 'Token file to verify (required)')
    .option('--secret', 'Prompt for secret to check if token is spendable')
    .action(async (options) => {
      try {
        // Check if file option is provided
        if (!options.file) {
          console.error('Error: --file option is required');
          process.exit(1);
        }
        
        // Read token from file
        const tokenFileContent = fs.readFileSync(options.file, 'utf8');
        const tokenData = JSON.parse(tokenFileContent);
        
        try {
          // Create a token object using TokenFactory and PredicateFactory
          const tokenFactory = new TokenFactory(new PredicateFactory());
          const token = await tokenFactory.create(tokenData, SimpleTokenData.fromJSON);
          
          // Display token information
          console.log('=== Token Information ===');
          console.log(`Token ID: ${token.id.toJSON()}`);
          console.log(`Token Type: ${token.type.toJSON()}`);
          console.log(`Version: ${token.version}`);
          
          // Display coin data
          if (token.coins) {
            console.log('\n=== Coin Data ===');
            // Assuming there's a way to access coin values
            console.log(JSON.stringify(token.coins, null, 2));
          } else {
            console.log('\n=== Coin Data ===');
            console.log('No coin data (Non-fungible token)');
          }
          
          // Display immutable data
          console.log('\n=== Immutable Data ===');
          if (token.data) {
            console.log(`Data: ${token.data.toJSON()}`);
          } else {
            console.log('No immutable data');
          }
          
          // Display current state
          console.log('\n=== Current State ===');
          console.log(`Predicate Type: ${token.state.unlockPredicate.type}`);
          console.log(`Address: ${(await DirectAddress.create(token.state.unlockPredicate.reference)).toJSON()}`);
          
          // Display state data
          if (token.state.data) {
            console.log(`State Data: ${HexConverter.encode(token.state.data)}`);
          } else {
            console.log('No state data');
          }
          
          // Display transaction history
          console.log('\n=== Transaction History ===');
          console.log(`Number of transactions: ${token.transactions.length}`);
          token.transactions.forEach((tx, index) => {
            console.log(`\nTransaction ${index + 1}:`);
            console.log(`  Type: ${tx.data.constructor.name}`);
            console.log(`  Request ID: ${tx.commitment.requestId.toJSON()}`);
          });
          
          // Handle secret verification if needed
          if (options.secret) {
            const secretStr = await readSecret();
            console.log('\n=== Secret Verification ===');
            console.log('Secret verification functionality will be implemented in a future update');
          }
        } catch (tokenError) {
          console.error('Error processing token object:', tokenError);
          
          // Fall back to displaying raw JSON data
          console.log('\n=== Token Information (Raw Data) ===');
          console.log(`Token ID: ${tokenData.id}`);
          console.log(`Token Type: ${tokenData.type}`);
          console.log(`Version: ${tokenData.version || 'Not specified'}`);
          
          if (tokenData.state && tokenData.state.unlockPredicate) {
            console.log('\n=== Current State ===');
            console.log(`Predicate Type: ${tokenData.state.unlockPredicate.type}`);
          }
          
          if (tokenData.transactions) {
            console.log('\n=== Transaction History ===');
            console.log(`Number of transactions: ${tokenData.transactions.length}`);
          }
        }
      } catch (error) {
        console.error(`Error verifying token: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error && error.stack) {
          console.error(error.stack);
        }
        process.exit(1);
      }
    });
}