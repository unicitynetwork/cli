#!/usr/bin/env node
import { program } from 'commander';
import { registerRequestCommand } from './commands/register-request.js';
import { getRequestCommand } from './commands/get-request.js';
import { genAddressCommand } from './commands/gen-address.js';
import { mintTokenCommand } from './commands/mint-token.js';
import { verifyTokenCommand } from './commands/verify-token.js';

// CLI setup
program
  .name('unicity')
  .description('Command-line tools for interacting with the Unicity Network\'s offchain token system')
  .version('1.0.0');

// Register commands
registerRequestCommand(program);
getRequestCommand(program);
genAddressCommand(program);
mintTokenCommand(program);
verifyTokenCommand(program);

// Parse command line arguments
program.parse();

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}