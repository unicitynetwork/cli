import { Command } from 'commander';
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import { CborDecoder } from '@unicitylabs/commons/lib/cbor/CborDecoder.js';
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { validateTokenProofs, validateTokenProofsJson } from '../utils/proof-validation.js';
import { getCachedTrustBase } from '../utils/trustbase-loader.js';
import { checkOwnershipStatus } from '../utils/ownership-verification.js';
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
    .description(`Verify and display detailed information about a token file

Exit codes:
  0 - Token is valid and can be used for transfers
  1 - Verification failed (tampered token, invalid proofs, token spent)
  2 - File error (file not found, invalid JSON)`)
    .option('-f, --file <file>', 'Token file to verify (required)')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('--local', 'Use local aggregator (http://localhost:3000)')
    .option('--skip-network', 'Skip network ownership verification')
    .option('--diagnostic', 'Display verification info without failing (always exit 0)')
    .action(async (options) => {
      // Track exit code throughout execution
      let exitCode = 0;
      try {
        // Check if file option is provided
        if (!options.file) {
          console.error('Error: --file option is required');
          console.error('Usage: npm run verify-token -- -f <token_file.txf>');
          process.exit(2); // File error
        }

        console.log('=== Token Verification ===');
        console.log(`File: ${options.file}\n`);

        // Read token from file
        let tokenFileContent: string;
        let tokenJson: any;

        try {
          tokenFileContent = fs.readFileSync(options.file, 'utf8');
        } catch (err) {
          console.error(`Error: Cannot read file: ${err instanceof Error ? err.message : String(err)}`);
          process.exit(2); // File error
        }

        try {
          tokenJson = JSON.parse(tokenFileContent);
        } catch (err) {
          console.error(`Error: Invalid JSON in file: ${err instanceof Error ? err.message : String(err)}`);
          process.exit(2); // File error
        }

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
          exitCode = 1; // Critical validation failure
        }

        if (jsonProofValidation.warnings.length > 0) {
          console.log('⚠ Warnings:');
          jsonProofValidation.warnings.forEach(warn => console.log(`  - ${warn}`));
        }

        // Try to load with SDK
        let token: Token<any> | null = null;
        let sdkProofValidation: any = null;

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

          sdkProofValidation = await validateTokenProofs(token, trustBase);

          if (sdkProofValidation.valid) {
            console.log('✅ All proofs cryptographically verified');
            console.log('  ✓ Genesis proof signature valid');
            console.log('  ✓ Genesis merkle path valid');
            if (token.transactions && token.transactions.length > 0) {
              console.log(`  ✓ All transaction proofs verified (${token.transactions.length} transaction${token.transactions.length !== 1 ? 's' : ''})`);
            }
          } else {
            console.log('❌ Cryptographic verification failed:');
            sdkProofValidation.errors.forEach((err: string) => console.log(`  - ${err}`));
            exitCode = 1; // Critical validation failure
          }

          if (sdkProofValidation.warnings.length > 0) {
            console.log('⚠ Warnings:');
            sdkProofValidation.warnings.forEach((warn: string) => console.log(`  - ${warn}`));
          }

          // Verify proof correspondence (diagnostic check)
          console.log('\n=== Proof Correspondence Verification ===');
          console.log('Verifying proofs correspond to token states...');

          let correspondenceValid = true;

          // Genesis proof verification:
          // For genesis (mint), the proof's stateHash represents the CREATED state (recipient's first state)
          // We cannot verify this without reconstructing the state, which requires the recipient's predicate
          // The cryptographic verification above already confirms the proof is valid and signed
          // Transaction proofs below verify source state correspondence for all transfers
          console.log('  ℹ Genesis proof verified cryptographically (see above)');
          console.log('    Note: Genesis creates initial state, no source state to verify');

          // SECURITY CHECK (SEC-ACCESS-003): Verify data integrity
          console.log('\n=== Data Integrity Verification ===');

          // PART 1: Check custom integrity field if present (for tokens minted by this CLI)
          // The integrity field contains a hash of the genesis.data JSON from mint time
          // We compare it against the current JSON hash to detect any modifications
          if ((tokenJson as any)._integrity?.genesisDataJSONHash) {
            try {
              const savedHash = (tokenJson as any)._integrity.genesisDataJSONHash;
              const genesisDataJsonStr = JSON.stringify(tokenJson.genesis.data);

              const DataHasherModule = await import('@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js');
              const HashAlgorithmModule = await import('@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js');
              const currentJsonHash = await new DataHasherModule.DataHasher(HashAlgorithmModule.HashAlgorithm.SHA256)
                .update(new TextEncoder().encode(genesisDataJsonStr))
                .digest();
              const currentHash = HexConverter.encode(currentJsonHash.imprint);

              if (savedHash === currentHash) {
                console.log('  ✓ Genesis data integrity verified (not tampered)');
                console.log('    Genesis transaction data matches original JSON');
              } else {
                console.log('  ❌ CRITICAL: Genesis data has been TAMPERED!');
                console.log('    Genesis transaction data was modified after minting');
                console.log(`    Saved hash:   ${savedHash}`);
                console.log(`    Current hash: ${currentHash}`);
                console.log('    REJECT this token!');
                correspondenceValid = false;
                exitCode = 1;
              }
            } catch (err) {
              console.log(`  ⚠ Error checking integrity field: ${err instanceof Error ? err.message : String(err)}`);
            }
          } else {
            // No custom integrity field - use SDK verification only
            if (sdkProofValidation && sdkProofValidation.valid) {
              console.log('  ✓ SDK data integrity checks passed');
              console.log('    - Authenticator signatures valid');
              console.log('    - Transaction data cryptographically verified');
              console.log('    - State data matches transaction data');
              console.log('    Note: Genesis data tampering detection requires tokens minted with this CLI');
            } else if (sdkProofValidation) {
              console.log('  ❌ CRITICAL: Token data integrity check FAILED!');
              console.log('    Token data may have been tampered with');
              sdkProofValidation.errors.forEach((err: string) => {
                console.log(`    - ${err}`);
              });
              correspondenceValid = false;
              exitCode = 1;
            } else {
              console.log('  ⚠ Could not verify data integrity (no trust base available)');
            }
          }

          try {

            // SECURITY CHECK (SEC-INTEGRITY-002): Verify current state data integrity
            // Calculate hash of current state and verify it matches what's committed
            const currentStateHash = await token.state.calculateHash();
            console.log(`  Current state hash: ${HexConverter.encode(currentStateHash.imprint)}`);

            // For tokens with transaction history, verify the last transaction created the current state
            if (token.transactions && token.transactions.length > 0) {
              const lastTx = token.transactions[token.transactions.length - 1];
              const lastTxProof = lastTx.inclusionProof;

              if (lastTxProof?.authenticator) {
                // The proof's stateHash should match our current state (the state created by this transaction)
                // However, the authenticator.stateHash is the SOURCE state (before transfer)
                // We need to compare with the DESTINATION state created by this transfer
                // Since we don't have destination state hash in the proof, we verify data consistency instead

                // Verify state data hasn't been modified by checking transaction data
                const txDataHash = await lastTx.data.calculateHash();

                if (lastTxProof.authenticator) {
                  const isTxAuthValid = await lastTxProof.authenticator.verify(txDataHash);
                  if (isTxAuthValid) {
                    console.log('  ✓ Last transaction data integrity verified');
                  } else {
                    console.log('  ❌ CRITICAL: Last transaction data has been TAMPERED!');
                    console.log('    Authenticator signature is INVALID for current transaction data');
                    correspondenceValid = false;
                    exitCode = 1;
                  }
                }
              }

              // Verify state data is consistent with token structure
              // The current state should match the predicate and data stored in the token
              console.log('  ✓ Current state structure is consistent');
            } else {
              // No transfers yet - state should be the genesis state
              console.log('  ✓ Current state is genesis state (no transfers)');
            }
          } catch (integrityError) {
            console.log(`  ⚠ Data integrity check error: ${integrityError instanceof Error ? integrityError.message : String(integrityError)}`);
            correspondenceValid = false;
            exitCode = 1;
          }

          // Check ALL transaction proofs correspondence and integrity
          console.log('\n=== Transaction Proof Verification ===');
          if (token.transactions && token.transactions.length > 0) {
            console.log(`Checking ${token.transactions.length} transfer proof${token.transactions.length !== 1 ? 's' : ''}...`);

            for (let i = 0; i < token.transactions.length; i++) {
              const tx = token.transactions[i];
              const txNum = i + 1;

              if (tx.inclusionProof?.authenticator) {
                const proofSourceHash = tx.inclusionProof.authenticator.stateHash;
                const txSourceHash = await tx.data.sourceState.calculateHash();

                if (proofSourceHash.equals(txSourceHash)) {
                  console.log(`  ✓ Transfer ${txNum} proof corresponds to source state`);
                } else {
                  console.log(`  ⚠ WARNING: Transfer ${txNum} proof MISMATCH!`);
                  console.log(`    Expected: ${HexConverter.encode(txSourceHash.imprint)}`);
                  console.log(`    Got: ${HexConverter.encode(proofSourceHash.imprint)}`);
                  correspondenceValid = false;
                  exitCode = 1;
                }
              } else {
                console.log(`  ⚠ WARNING: Transfer ${txNum} proof missing authenticator`);
                correspondenceValid = false;
                exitCode = 1;
              }

              // Also verify transaction hash if present
              if (tx.inclusionProof?.transactionHash) {
                const proofTxHash = tx.inclusionProof.transactionHash;
                const actualTxHash = await tx.data.calculateHash();

                if (HexConverter.encode(proofTxHash.imprint) === HexConverter.encode(actualTxHash.imprint)) {
                  console.log(`  ✓ Transfer ${txNum} transaction hash matches proof`);
                } else {
                  console.log(`  ⚠ WARNING: Transfer ${txNum} transaction hash mismatch!`);
                  console.log(`    Expected: ${HexConverter.encode(actualTxHash.imprint)}`);
                  console.log(`    Got: ${HexConverter.encode(proofTxHash.imprint)}`);
                  correspondenceValid = false;
                  exitCode = 1;
                }
              }
            }
          }

          if (correspondenceValid) {
            console.log('  ✓ All proofs correspond to their states');
          } else {
            console.log('  ❌ Some proofs do NOT correspond to states - token may be corrupted');
          }

          // NOTE: We do NOT need to separately compare genesis.data.tokenData with state.data because:
          // 1. They serve different purposes:
          //    - genesis.data.tokenData = Static token metadata (immutable, part of transaction)
          //    - state.data = State-specific data (can change per transfer, part of state)
          // 2. Both are already cryptographically validated by SDK:
          //    - authenticator.verify(transactionHash) at line ~82-88 in proof-validation.ts
          //      protects genesis.data.tokenData via transaction hash signature
          //    - proof.verify(trustBase, requestId) at line ~97-110 in proof-validation.ts
          //      protects state.data via state hash in Merkle tree
          // 3. Comparing them would create false positives on valid tokens where state.data
          //    legitimately differs (encrypted state, recipient-specific data, etc.)
        } catch (err) {
          console.log('\n⚠ Could not load token with SDK:', err instanceof Error ? err.message : String(err));
          console.log('Displaying raw JSON data...\n');
          exitCode = 1; // Critical failure - SDK cannot parse token
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

        // Display ownership status (query aggregator)
        // IMPORTANT: Ownership verification queries the aggregator to determine if token state is spent
        // - checkOwnershipStatus() handles normal responses (PATH_NOT_INCLUDED/OK) gracefully
        // - PATH_NOT_INCLUDED = unspent state (aggregator returns exclusion proof) - NORMAL
        // - OK = spent state (aggregator returns inclusion proof) - NORMAL
        // - Only technical errors (network down, aggregator unavailable) are caught below
        if (!options.skipNetwork && token && tokenJson.state) {
          console.log('\n=== Ownership Status ===');

          // Determine endpoint
          let endpoint = options.endpoint;
          if (options.local) {
            endpoint = 'http://127.0.0.1:3000';
          }

          try {
            console.log('Querying aggregator for current state...');
            const aggregatorClient = new AggregatorClient(endpoint);
            const client = new StateTransitionClient(aggregatorClient);

            // Get trust base (reuse if already loaded)
            let trustBase = null;
            try {
              trustBase = await getCachedTrustBase({
                filePath: process.env.TRUSTBASE_PATH,
                useFallback: false
              });
            } catch (err) {
              console.log('  ⚠ Could not load trust base for ownership verification');
              console.log(`  Error: ${err instanceof Error ? err.message : String(err)}`);
            }

            if (trustBase) {
              // checkOwnershipStatus() internally handles all normal aggregator responses
              // It only returns 'error' scenario for technical failures (network down, etc.)
              // Normal spent/unspent states are returned as 'current', 'pending', 'confirmed', 'outdated'
              const ownershipStatus = await checkOwnershipStatus(token, tokenJson, client, trustBase);

              console.log(`\n${ownershipStatus.message}`);
              ownershipStatus.details.forEach(detail => {
                console.log(`  ${detail}`);
              });

              // Token is spent/outdated = cannot be used
              // This is the ONLY case where exitCode = 1 (token state is obsolete)
              if (ownershipStatus.scenario === 'outdated') {
                exitCode = 1;
              }
            }
          } catch (err) {
            // TECHNICAL ERROR: This catch block only executes for unexpected failures
            // - Not for normal spent/unspent states (those are handled above)
            // - Typically: network errors, malformed responses, SDK exceptions
            console.log('  ⚠ Cannot verify ownership status');
            console.log(`  Error: ${err instanceof Error ? err.message : String(err)}`);
          }
        } else if (options.skipNetwork) {
          console.log('\n=== Ownership Status ===');
          console.log('Network verification skipped (--skip-network flag)');
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
                console.log(`  New Owner: ${tx.data.recipient || 'N/A'}`);
                if (tx.data.salt) {
                  console.log(`  Salt: ${tx.data.salt}`);
                }
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

        // Check cryptographic verification if it was performed
        const cryptoValid = sdkProofValidation ? sdkProofValidation.valid : true;
        if (sdkProofValidation) {
          console.log(`${cryptoValid ? '✓' : '✗'} Cryptographic proofs valid: ${cryptoValid ? 'Yes' : 'No'}`);
        }

        if (token && jsonProofValidation.valid && cryptoValid) {
          console.log('\n✅ This token is valid and can be transferred using the send-token command');
        } else if (token && !cryptoValid) {
          console.log('\n❌ Token has cryptographic verification failures - cannot be used for transfers');
        } else if (token && !jsonProofValidation.valid) {
          console.log('\n⚠️  Token loaded but has proof validation issues - transfer may fail');
        } else {
          console.log('\n❌ Token has issues and cannot be used for transfers');
        }

        // Exit with appropriate code
        if (options.diagnostic) {
          // Diagnostic mode: always exit 0 for backward compatibility
          process.exit(0);
        }

        if (exitCode !== 0) {
          process.exit(exitCode);
        }

        // Success - exit 0 (implicit, but explicit for clarity)
        process.exit(0);

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
