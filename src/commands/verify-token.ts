import { Command } from 'commander';
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import { CborDecoder } from '@unicitylabs/commons/lib/cbor/CborDecoder.js';
import { validateTokenProofs, validateTokenProofsJson } from '../utils/proof-validation.js';
import { getCachedTrustBase } from '../utils/trustbase-loader.js';
import * as fs from 'fs';

/**
 * Try to decode data as UTF-8 text, return hex if it fails
 */
function tryDecodeAsText(hexData: string): string {
  if (!hexData || hexData.length === 0) {
    return '(empty)';
  }

  try {
    const bytes = HexConverter.decode(hexData);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);

    // Check if it's printable ASCII/UTF-8
    if (/^[\x20-\x7E\s]*$/.test(text)) {
      return text;
    }

    // Try to parse as JSON
    try {
      const json = JSON.parse(text);
      return JSON.stringify(json, null, 2);
    } catch {
      return text;
    }
  } catch {
    // Not valid UTF-8, return hex
    return `0x${hexData}`;
  }
}

/**
 * Decode and display predicate information
 */
function displayPredicateInfo(predicateHex: string): void {
  console.log('\n=== Predicate Details ===');

  if (!predicateHex || predicateHex.length === 0) {
    console.log('No predicate found');
    return;
  }

  try {
    const predicateBytes = HexConverter.decode(predicateHex);
    console.log(`Raw Length: ${predicateBytes.length} bytes`);
    console.log(`Raw Hex (first 50 chars): ${predicateHex.substring(0, 50)}...`);

    // Decode CBOR structure
    const predicateArray = CborDecoder.readArray(predicateBytes);

    if (predicateArray.length === 3) {
      console.log('\n✅ Valid CBOR structure: [engine_id, template, params]');

      // Element 1: Engine ID
      const engineIdBytes = predicateArray[0];
      const engineId = engineIdBytes.length === 1 ? engineIdBytes[0] :
                       CborDecoder.readUnsignedInteger(engineIdBytes);
      const engineIdNum = typeof engineId === 'bigint' ? Number(engineId) : engineId;
      const engineName = engineIdNum === 0 ? 'UnmaskedPredicate (reusable address)' :
                        engineIdNum === 1 ? 'MaskedPredicate (one-time address)' :
                        `Unknown (${engineIdNum})`;
      console.log(`\nEngine ID: ${engineIdNum} - ${engineName}`);

      // Element 2: Template
      const templateBytes = CborDecoder.readByteString(predicateArray[1]);
      console.log(`Template: ${HexConverter.encode(templateBytes)} (${templateBytes.length} byte${templateBytes.length !== 1 ? 's' : ''})`);

      // Element 3: Parameters
      const paramsBytes = CborDecoder.readByteString(predicateArray[2]);
      if (paramsBytes instanceof Uint8Array) {
        console.log(`\nParameters: ${paramsBytes.length} bytes`);

        // Try to decode parameters as CBOR array
        try {
          const paramsArray = CborDecoder.readArray(paramsBytes);

          console.log(`\nParameter Structure (${paramsArray.length} elements):`);

          // Structure: [tokenId, tokenType, publicKey, algorithm, signatureScheme(?), signature]
          if (paramsArray.length >= 3) {
            const tokenId = HexConverter.encode(CborDecoder.readByteString(paramsArray[0]));
            const tokenType = HexConverter.encode(CborDecoder.readByteString(paramsArray[1]));
            const publicKey = HexConverter.encode(CborDecoder.readByteString(paramsArray[2]));

            console.log(`  [0] Token ID: ${tokenId}`);
            console.log(`  [1] Token Type: ${tokenType}`);
            console.log(`  [2] Public Key: ${publicKey}`);

            if (paramsArray.length > 3) {
              const algorithmText = CborDecoder.readTextString(paramsArray[3]);
              console.log(`  [3] Algorithm: ${algorithmText}`);
            }

            if (paramsArray.length > 4) {
              // Element 4 - might be signature scheme or flags
              const elem4 = paramsArray[4];
              const elem4Hex = HexConverter.encode(elem4);
              let elem4Display = elem4Hex;

              // Try to decode as unsigned int
              try {
                const uintVal = CborDecoder.readUnsignedInteger(elem4);
                elem4Display = `${uintVal} (0x${elem4Hex})`;
              } catch {
                // Not a uint, just use hex
              }

              console.log(`  [4] Signature Scheme: ${elem4Display}`);
            }

            if (paramsArray.length > 5) {
              const signature = HexConverter.encode(CborDecoder.readByteString(paramsArray[5]));
              console.log(`  [5] Signature: ${signature}`);
            }
          }
        } catch (err) {
          console.log(`Failed to parse parameters structure: ${err instanceof Error ? err.message : String(err)}`);
          console.log(`Parameters (raw): ${HexConverter.encode(paramsBytes)}`);
        }
      }
    } else {
      console.log(`⚠ Unexpected CBOR structure: ${predicateArray.length} elements (expected 3)`);
    }
  } catch (err) {
    console.log(`❌ Failed to decode predicate: ${err instanceof Error ? err.message : String(err)}`);
    console.log(`Raw hex: ${predicateHex.substring(0, 100)}...`);
  }
}

/**
 * Display genesis transaction details
 */
function displayGenesis(genesis: any): void {
  console.log('\n=== Genesis Transaction (Mint) ===');

  if (!genesis) {
    console.log('No genesis data found');
    return;
  }

  // Display transaction data
  if (genesis.data) {
    console.log('\nMint Transaction Data:');
    console.log(`  Token ID: ${genesis.data.tokenId || 'N/A'}`);
    console.log(`  Token Type: ${genesis.data.tokenType || 'N/A'}`);
    console.log(`  Recipient: ${genesis.data.recipient || 'N/A'}`);

    if (genesis.data.tokenData) {
      console.log(`\n  Token Data (hex): ${genesis.data.tokenData.substring(0, 50)}${genesis.data.tokenData.length > 50 ? '...' : ''}`);
      const decoded = tryDecodeAsText(genesis.data.tokenData);
      console.log(`  Token Data (decoded): ${decoded}`);
    }

    if (genesis.data.salt) {
      console.log(`\n  Salt: ${genesis.data.salt}`);
    }

    if (genesis.data.coinData && Array.isArray(genesis.data.coinData) && genesis.data.coinData.length > 0) {
      console.log(`\n  Coins: ${genesis.data.coinData.length} coin(s)`);
      genesis.data.coinData.forEach((coin: any, idx: number) => {
        const [coinId, amount] = coin;
        console.log(`    Coin ${idx + 1}:`);
        console.log(`      ID: ${coinId}`);
        console.log(`      Amount: ${amount}`);
      });
    }
  }

  // Display inclusion proof
  if (genesis.inclusionProof) {
    console.log('\nInclusion Proof:');
    console.log(`  ✓ Token included in blockchain`);

    if (genesis.inclusionProof.merkleTreePath) {
      const path = genesis.inclusionProof.merkleTreePath;
      console.log(`  Merkle Root: ${path.root}`);
      console.log(`  Merkle Path Steps: ${path.steps?.length || 0}`);
    }

    if (genesis.inclusionProof.unicityCertificate) {
      const certHex = genesis.inclusionProof.unicityCertificate;
      console.log(`  Unicity Certificate: ${certHex.substring(0, 50)}... (${certHex.length} chars)`);
    }
  }
}

export function verifyTokenCommand(program: Command): void {
  program
    .command('verify-token')
    .description('Verify and display detailed information about a token file')
    .option('-f, --file <file>', 'Token file to verify (required)')
    .action(async (options) => {
      try {
        // Check if file option is provided
        if (!options.file) {
          console.error('Error: --file option is required');
          console.error('Usage: npm run verify-token -- -f <token_file.txf>');
          process.exit(1);
        }

        console.log('=== Token Verification ===');
        console.log(`File: ${options.file}\n`);

        // Read token from file
        const tokenFileContent = fs.readFileSync(options.file, 'utf8');
        const tokenJson = JSON.parse(tokenFileContent);

        // Display basic info
        console.log('=== Basic Information ===');
        console.log(`Version: ${tokenJson.version || 'N/A'}`);

        // Validate token proofs before attempting to load
        console.log('\n=== Proof Validation (JSON) ===');
        const jsonProofValidation = validateTokenProofsJson(tokenJson);

        if (jsonProofValidation.valid) {
          console.log('✅ All proofs structurally valid');
          console.log('  ✓ Genesis proof has authenticator');
          if (tokenJson.transactions && tokenJson.transactions.length > 0) {
            console.log(`  ✓ All transaction proofs have authenticators (${tokenJson.transactions.length} transaction${tokenJson.transactions.length !== 1 ? 's' : ''})`);
          }
        } else {
          console.log('❌ Proof validation failed:');
          jsonProofValidation.errors.forEach(err => console.log(`  - ${err}`));
        }

        if (jsonProofValidation.warnings.length > 0) {
          console.log('⚠ Warnings:');
          jsonProofValidation.warnings.forEach(warn => console.log(`  - ${warn}`));
        }

        // Try to load with SDK
        let token: Token<any> | null = null;
        try {
          token = await Token.fromJSON(tokenJson);
          console.log('\n✅ Token loaded successfully with SDK');
          console.log(`Token ID: ${token.id.toJSON()}`);
          console.log(`Token Type: ${token.type.toJSON()}`);

          // Perform cryptographic proof validation if loaded successfully
          console.log('\n=== Cryptographic Proof Verification ===');
          console.log('Loading trust base...');

          const trustBase = await getCachedTrustBase({
            filePath: process.env.TRUSTBASE_PATH,
            useFallback: false
          });
          console.log(`  ✓ Trust base ready (Network ID: ${trustBase.networkId}, Epoch: ${trustBase.epoch})`);
          console.log('Verifying proofs with SDK...');

          const sdkProofValidation = await validateTokenProofs(token, trustBase);

          if (sdkProofValidation.valid) {
            console.log('✅ All proofs cryptographically verified');
            console.log('  ✓ Genesis proof signature valid');
            console.log('  ✓ Genesis merkle path valid');
            if (token.transactions && token.transactions.length > 0) {
              console.log(`  ✓ All transaction proofs verified (${token.transactions.length} transaction${token.transactions.length !== 1 ? 's' : ''})`);
            }
          } else {
            console.log('❌ Cryptographic verification failed:');
            sdkProofValidation.errors.forEach(err => console.log(`  - ${err}`));
          }

          if (sdkProofValidation.warnings.length > 0) {
            console.log('⚠ Warnings:');
            sdkProofValidation.warnings.forEach(warn => console.log(`  - ${warn}`));
          }
        } catch (err) {
          console.log('\n⚠ Could not load token with SDK:', err instanceof Error ? err.message : String(err));
          console.log('Displaying raw JSON data...\n');
        }

        // Display genesis transaction
        displayGenesis(tokenJson.genesis);

        // Display current state
        console.log('\n=== Current State ===');
        if (tokenJson.state) {
          // Display state data
          if (tokenJson.state.data) {
            console.log(`\nState Data (hex): ${tokenJson.state.data.substring(0, 50)}${tokenJson.state.data.length > 50 ? '...' : ''}`);
            const decoded = tryDecodeAsText(tokenJson.state.data);
            console.log(`State Data (decoded):`);
            console.log(decoded);
          } else {
            console.log('\nState Data: (empty)');
          }

          // Display predicate
          if (tokenJson.state.predicate) {
            displayPredicateInfo(tokenJson.state.predicate);
          } else {
            console.log('\nPredicate: (none)');
          }
        }

        // Display transaction history
        console.log('\n=== Transaction History ===');
        if (tokenJson.transactions && Array.isArray(tokenJson.transactions)) {
          console.log(`Number of transfers: ${tokenJson.transactions.length}`);

          if (tokenJson.transactions.length === 0) {
            console.log('(No transfer transactions - newly minted token)');
          } else {
            tokenJson.transactions.forEach((tx: any, idx: number) => {
              console.log(`\nTransfer ${idx + 1}:`);
              if (tx.data) {
                console.log(`  New Owner: ${tx.data.newOwner || 'N/A'}`);
              }
            });
          }
        } else {
          console.log('No transaction history');
        }

        // Display nametags
        if (tokenJson.nametags && Array.isArray(tokenJson.nametags) && tokenJson.nametags.length > 0) {
          console.log('\n=== Nametags ===');
          console.log(`Number of nametags: ${tokenJson.nametags.length}`);
          tokenJson.nametags.forEach((nametag: any, idx: number) => {
            console.log(`  ${idx + 1}. ${JSON.stringify(nametag)}`);
          });
        }

        // Summary
        console.log('\n=== Verification Summary ===');
        console.log(`${!!tokenJson.genesis ? '✓' : '✗'} File format: TXF v${tokenJson.version || '?'}`);
        console.log(`${!!tokenJson.genesis ? '✓' : '✗'} Has genesis: ${!!tokenJson.genesis}`);
        console.log(`${!!tokenJson.state ? '✓' : '✗'} Has state: ${!!tokenJson.state}`);
        console.log(`${!!tokenJson.state?.predicate ? '✓' : '✗'} Has predicate: ${!!tokenJson.state?.predicate}`);
        console.log(`${jsonProofValidation.valid ? '✓' : '✗'} Proof structure valid: ${jsonProofValidation.valid ? 'Yes' : 'No'}`);
        console.log(`${token !== null ? '✓' : '✗'} SDK compatible: ${token !== null ? 'Yes' : 'No'}`);

        if (token && jsonProofValidation.valid) {
          console.log('\n✅ This token is valid and can be transferred using the send-token command');
        } else if (token && !jsonProofValidation.valid) {
          console.log('\n⚠️  Token loaded but has proof validation issues - transfer may fail');
        } else {
          console.log('\n❌ Token has issues and cannot be used for transfers');
        }

      } catch (error) {
        console.error(`\n❌ Error verifying token: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error && error.stack) {
          console.error('\nStack trace:');
          console.error(error.stack);
        }
        process.exit(1);
      }
    });
}
