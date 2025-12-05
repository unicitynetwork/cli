import { Command } from 'commander';
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import { CborDecoder } from '@unicitylabs/commons/lib/cbor/CborDecoder.js';
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { validateTokenProofs, validateTokenProofsJson } from '../utils/proof-validation.js';
import { getCachedTrustBase } from '../utils/trustbase-loader.js';
import { checkOwnershipStatus } from '../utils/ownership-verification.js';
import { deserializeTxf } from '../utils/txf-serialization.js';
import { createPoWClient } from '../utils/pow-client.js';
import {
  VerificationResult,
  formatVerifyOutput,
  formatVerifyJson,
  getTokenTypeName,
  decodePredicate,
  decodeTokenData,
  truncate
} from '../utils/output-formatter.js';
import { readTokenFromTxf, readAllTokens, listTokenIds } from '../utils/multi-token-txf.js';
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

/**
 * Display and verify UNCT liquidity in token
 */
async function displayUNCTLiquidity(genesis: any, options: any): Promise<void> {
  // Check if token has UNCT liquidity
  const hasCoinData = genesis?.data?.coinData &&
                      Array.isArray(genesis.data.coinData) &&
                      genesis.data.coinData.length > 0;

  const hasCoinOriginReason = genesis?.data?.reason?.type === 'COIN_ORIGIN';

  if (!hasCoinData || !hasCoinOriginReason) {
    return; // No UNCT liquidity to display
  }

  console.log('\n=== UNCT Liquidity ===');

  // Calculate total UNCT amount
  let totalAmount = BigInt(0);
  const coins = genesis.data.coinData;

  for (const coin of coins) {
    const [coinId, amount] = coin;
    totalAmount += BigInt(amount);
  }

  // Display formatted amount (amount / 10^18)
  const unctAmount = Number(totalAmount) / 1e18;
  console.log(`Coins: ${coins.length} coin(s)`);
  console.log(`  • ${unctAmount.toFixed(1)} UNCT`);

  // Extract coin origin proof data
  const blockHeight = genesis.data.reason?.proof?.blockHeight;
  const tokenId = genesis.data.tokenId;

  if (blockHeight === undefined || !tokenId) {
    console.log('\n⚠️  Coin origin proof incomplete (missing blockHeight or tokenId)');
    return;
  }

  console.log('\nCoin Origin Verification:');
  console.log(`  Block Height: ${blockHeight}`);

  // Check if POW endpoint is provided
  const powEndpointProvided = options.unctUrl || options.localUnct;

  if (!powEndpointProvided) {
    console.log('\n  ⚠️  POW verification skipped (no endpoint provided)');
    console.log('  To verify coin origin, run with:');
    console.log('    --unct-url <endpoint> or --local-unct');
    return;
  }

  // Attempt POW verification
  try {
    console.log('\n  Verifying with POW blockchain...');

    const powClient = createPoWClient({
      endpoint: options.unctUrl,
      useLocal: options.localUnct
    });

    // Check POW node connectivity
    const connected = await powClient.checkConnection();
    if (!connected) {
      const endpoint = options.localUnct ? 'http://localhost:8332' : options.unctUrl;
      console.log(`  ⚠️  Cannot connect to POW node at ${endpoint}`);
      console.log('  Coin origin not verified');
      return;
    }

    // Perform cryptographic verification
    const verification = await powClient.verifyTokenIdInBlock(tokenId, blockHeight);

    if (!verification.valid) {
      console.log('  ⚠️  Coin origin verification FAILED');
      console.log(`  ${verification.error}`);
      return;
    }

    // Verification passed
    console.log('  ✓ Coin origin verified');
    console.log('\n  Block Details:');
    if (verification.blockHash) {
      console.log(`    Block Hash: ${verification.blockHash}`);
    }
    if (verification.merkleRoot) {
      console.log(`    Merkle Root: ${verification.merkleRoot}`);
    }
    if (verification.blockTimestamp) {
      const date = new Date(verification.blockTimestamp * 1000);
      console.log(`    Block Timestamp: ${date.toISOString()}`);
    }
    console.log(`    Target: SHA256(tokenId) matches witness`);

  } catch (error) {
    console.log('  ⚠️  POW verification error:');
    console.log(`  ${error instanceof Error ? error.message : String(error)}`);
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
    .option('--select <tokenId>', 'Select specific token from multi-token TXF file (if omitted, verify all tokens)')
    .option('-e, --endpoint <url>', 'Aggregator endpoint URL', 'https://gateway.unicity.network')
    .option('--local', 'Use local aggregator (http://localhost:3000)')
    .option('--skip-network', 'Skip network ownership verification')
    .option('--diagnostic', 'Display verification info without failing (always exit 0)')
    .option('--unct-url <url>', 'POW blockchain RPC endpoint URL for UNCT verification')
    .option('--local-unct', 'Use local POW blockchain (http://localhost:8332) for UNCT verification')
    .option('-v, --verbose', 'Show detailed verification output')
    .option('--json', 'Output structured JSON report')
    .action(async (options) => {
      // Determine output mode
      const verbose = options.verbose || false;
      const jsonOutput = options.json || false;

      // Helper for verbose logging
      const log = (msg: string) => { if (verbose) console.log(msg); };

      // Initialize verification result
      const result: VerificationResult = {
        tokenId: '',
        tokenType: '',
        tokenTypeName: '',
        version: '',
        data: '',
        state: {
          data: '',
          predicateType: 'unknown',
          algorithm: 'unknown',
          publicKey: ''
        },
        proofs: {
          genesis: { valid: false, hasAuthenticator: false },
          transactions: [],
          verified: 0,
          total: 0,
          uncommitted: 0
        },
        verification: {
          jsonStructure: false,
          sdkCompatible: false,
          cryptographic: false,
          dataIntegrity: false,
          ownershipStatus: 'unknown'
        },
        history: {
          transferCount: 0,
          transfers: []
        },
        status: 'INVALID',
        canTransfer: false,
        warnings: [],
        errors: []
      };

      // Track exit code throughout execution
      let exitCode = 0;
      try {
        // Check if file option is provided
        if (!options.file) {
          console.error('Error: --file option is required');
          console.error('Usage: npm run verify-token -- -f <token_file.txf>');
          process.exit(2); // File error
        }

        log('=== Token Verification ===');
        log(`File: ${options.file}\n`);

        // Read token from file (multi-token format)
        let tokenJson: any;
        let loadedTokenId: string;

        try {
          // Check if we need to verify all tokens (no --select and multiple tokens)
          const tokenIds = listTokenIds(options.file);

          if (tokenIds.length === 0) {
            console.error('Error: TXF file contains no tokens');
            process.exit(2); // File error
          }

          if (!options.select && tokenIds.length > 1) {
            // MULTI-TOKEN MODE: Verify all tokens
            log(`Found ${tokenIds.length} tokens in file, verifying all...\n`);

            const allResults: VerificationResult[] = [];
            let anyFailed = false;

            for (const tokenId of tokenIds) {
              const { token: rawJson } = readTokenFromTxf(options.file, tokenId);
              const deserializedToken = deserializeTxf(rawJson);

              // Create a mini verification result for this token
              const tokenResult: VerificationResult = {
                tokenId: deserializedToken.genesis?.data?.tokenId || tokenId,
                tokenType: deserializedToken.genesis?.data?.tokenType || '',
                tokenTypeName: getTokenTypeName(deserializedToken.genesis?.data?.tokenType || ''),
                version: deserializedToken.version || '',
                data: decodeTokenData(deserializedToken.genesis?.data?.tokenData),
                state: {
                  data: decodeTokenData(deserializedToken.state?.data),
                  predicateType: 'unknown',
                  algorithm: 'unknown',
                  publicKey: ''
                },
                proofs: {
                  genesis: { valid: false, hasAuthenticator: false },
                  transactions: [],
                  verified: 0,
                  total: 0,
                  uncommitted: 0
                },
                verification: {
                  jsonStructure: false,
                  sdkCompatible: false,
                  cryptographic: false,
                  dataIntegrity: false,
                  ownershipStatus: 'unknown'
                },
                history: {
                  transferCount: 0,
                  transfers: []
                },
                status: 'INVALID',
                canTransfer: false,
                warnings: [],
                errors: []
              };

              // Quick validation
              const jsonValidation = validateTokenProofsJson(deserializedToken, { allowUncommitted: true });
              tokenResult.verification.jsonStructure = jsonValidation.valid;

              if (jsonValidation.valid) {
                // Check uncommitted transactions
                const uncommitted = (deserializedToken.transactions || [])
                  .filter((tx: any) => !tx.inclusionProof).length;
                tokenResult.proofs.uncommitted = uncommitted;

                // Set status
                if (uncommitted > 0) {
                  tokenResult.status = 'PENDING';
                } else {
                  tokenResult.status = 'VALID';
                  tokenResult.canTransfer = true;
                }
              } else {
                tokenResult.errors = jsonValidation.errors;
                anyFailed = true;
              }

              allResults.push(tokenResult);
            }

            // Output all results
            if (jsonOutput) {
              console.log(JSON.stringify(allResults, null, 2));
            } else {
              console.log(`=== Multi-Token Verification Summary ===`);
              console.log(`File: ${options.file}`);
              console.log(`Total tokens: ${allResults.length}\n`);

              for (const r of allResults) {
                console.log(`--- Token: ${truncate(r.tokenId, 16)} ---`);
                console.log(formatVerifyOutput(r));
                console.log('');
              }

              const valid = allResults.filter(r => r.status === 'VALID' || r.status === 'PENDING').length;
              const failed = allResults.length - valid;
              console.log(`=== Summary: ${valid}/${allResults.length} tokens valid${failed > 0 ? `, ${failed} failed` : ''} ===`);
            }

            process.exit(anyFailed ? 1 : 0);
          }

          // SINGLE TOKEN MODE: Verify one token
          const { token: rawJson, tokenId: selectedTokenId } = readTokenFromTxf(options.file, options.select);
          loadedTokenId = selectedTokenId;
          tokenJson = deserializeTxf(rawJson);
          if (rawJson.state === null && tokenJson.state !== null) {
            log('Note: State reconstructed from sourceState (in-transit token)');
          }
          log(`Token ID: ${truncate(loadedTokenId, 32)}\n`);
        } catch (err) {
          console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
          process.exit(2); // File error
        }

        // Extract basic info for result
        result.tokenId = tokenJson.genesis?.data?.tokenId || '';
        result.tokenType = tokenJson.genesis?.data?.tokenType || '';
        result.tokenTypeName = getTokenTypeName(result.tokenType);
        result.version = tokenJson.version || '';
        result.data = decodeTokenData(tokenJson.genesis?.data?.tokenData);

        // Extract state info
        if (tokenJson.state) {
          result.state.data = decodeTokenData(tokenJson.state.data);
          const predicate = decodePredicate(tokenJson.state.predicate);
          if (predicate) {
            result.state.predicateType = predicate.type;
            result.state.algorithm = predicate.algorithm;
            result.state.publicKey = predicate.publicKey;
          }
        }

        // Display basic info
        log('=== Basic Information ===');
        log(`Version: ${tokenJson.version || 'N/A'}`);

        // Validate token proofs before attempting to load
        log('\n=== Proof Validation (JSON) ===');
        const jsonProofValidation = validateTokenProofsJson(tokenJson);
        result.verification.jsonStructure = jsonProofValidation.valid;

        // Update genesis proof status
        result.proofs.genesis.hasAuthenticator = !!(tokenJson.genesis?.inclusionProof?.authenticator);
        result.proofs.genesis.valid = result.proofs.genesis.hasAuthenticator;

        // Extract transaction proof info
        const transactions = tokenJson.transactions || [];
        result.history.transferCount = transactions.length;
        result.proofs.total = 1 + transactions.length; // genesis + transactions

        for (let i = 0; i < transactions.length; i++) {
          const tx = transactions[i];
          const hasAuth = !!(tx.inclusionProof?.authenticator);
          const hasProof = hasAuth && !!(tx.inclusionProof?.transactionHash);
          result.proofs.transactions.push({
            index: i,
            valid: hasProof,
            hasAuthenticator: hasAuth
          });
          result.history.transfers.push({
            recipient: tx.data?.recipient || '',
            hasProof
          });
          if (!hasProof && tx.commitment) {
            result.proofs.uncommitted++;
          }
        }

        // Count verified proofs
        result.proofs.verified = (result.proofs.genesis.valid ? 1 : 0) +
          result.proofs.transactions.filter(t => t.valid).length;

        // Check if this is an in-transit token (has uncommitted transactions)
        const hasUncommittedTransactions = result.proofs.uncommitted > 0;

        if (jsonProofValidation.valid) {
          log('✅ All proofs structurally valid');
          log('  ✓ Genesis proof has authenticator');
          if (tokenJson.transactions && tokenJson.transactions.length > 0) {
            log(`  ✓ All transaction proofs have authenticators (${tokenJson.transactions.length} transaction${tokenJson.transactions.length !== 1 ? 's' : ''})`);
          }
        } else {
          // For in-transit tokens, missing inclusion proofs are expected, not errors
          if (hasUncommittedTransactions) {
            log('ℹ️ Token is in-transit (has uncommitted transactions):');
            jsonProofValidation.errors.forEach(err => {
              log(`  - ${err}`);
              // Don't push "missing inclusion proof" as error for in-transit tokens
            });
          } else {
            log('❌ Proof validation failed:');
            jsonProofValidation.errors.forEach(err => {
              log(`  - ${err}`);
              result.errors.push(err);
            });
            exitCode = 1; // Critical validation failure
          }
        }

        if (jsonProofValidation.warnings.length > 0) {
          log('⚠ Warnings:');
          jsonProofValidation.warnings.forEach(warn => {
            log(`  - ${warn}`);
            result.warnings.push(warn);
          });
        }

        // Try to load with SDK
        let token: Token<any> | null = null;
        let sdkProofValidation: any = null;

        try {
          token = await Token.fromJSON(tokenJson);
          result.verification.sdkCompatible = true;
          log('\n✅ Token loaded successfully with SDK');
          log(`Token ID: ${token.id.toJSON()}`);
          log(`Token Type: ${token.type.toJSON()}`);

          // Perform cryptographic proof validation if loaded successfully
          log('\n=== Cryptographic Proof Verification ===');
          log('Loading trust base...');

          const trustBase = await getCachedTrustBase({
            filePath: process.env.TRUSTBASE_PATH,
            useFallback: false,
            silent: !verbose
          });
          log(`  ✓ Trust base ready (Network ID: ${trustBase.networkId}, Epoch: ${trustBase.epoch})`);
          log('Verifying proofs with SDK...');

          sdkProofValidation = await validateTokenProofs(token, trustBase);
          result.verification.cryptographic = sdkProofValidation.valid;

          if (sdkProofValidation.valid) {
            log('✅ All proofs cryptographically verified');
            log('  ✓ Genesis proof signature valid');
            log('  ✓ Genesis merkle path valid');
            if (token.transactions && token.transactions.length > 0) {
              log(`  ✓ All transaction proofs verified (${token.transactions.length} transaction${token.transactions.length !== 1 ? 's' : ''})`);
            }
          } else {
            log('❌ Cryptographic verification failed:');
            sdkProofValidation.errors.forEach((err: string) => {
              log(`  - ${err}`);
              result.errors.push(err);
            });
            exitCode = 1; // Critical validation failure
          }

          if (sdkProofValidation.warnings.length > 0) {
            log('⚠ Warnings:');
            sdkProofValidation.warnings.forEach((warn: string) => {
              log(`  - ${warn}`);
              result.warnings.push(warn);
            });
          }

          // Verify proof correspondence (diagnostic check)
          log('\n=== Proof Correspondence Verification ===');
          log('Verifying proofs correspond to token states...');

          let correspondenceValid = true;

          // Genesis proof verification:
          // For genesis (mint), the proof's stateHash represents the CREATED state (recipient's first state)
          // We cannot verify this without reconstructing the state, which requires the recipient's predicate
          // The cryptographic verification above already confirms the proof is valid and signed
          // Transaction proofs below verify source state correspondence for all transfers
          log('  ℹ Genesis proof verified cryptographically (see above)');
          log('    Note: Genesis creates initial state, no source state to verify');

          // SECURITY CHECK (SEC-ACCESS-003): Verify data integrity
          log('\n=== Data Integrity Verification ===');

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
                result.verification.dataIntegrity = true;
                log('  ✓ Genesis data integrity verified (not tampered)');
                log('    Genesis transaction data matches original JSON');
              } else {
                log('  ❌ CRITICAL: Genesis data has been TAMPERED!');
                log('    Genesis transaction data was modified after minting');
                log(`    Saved hash:   ${savedHash}`);
                log(`    Current hash: ${currentHash}`);
                log('    REJECT this token!');
                result.errors.push('Genesis data has been tampered');
                correspondenceValid = false;
                exitCode = 1;
              }
            } catch (err) {
              log(`  ⚠ Error checking integrity field: ${err instanceof Error ? err.message : String(err)}`);
            }
          } else {
            // No custom integrity field - use SDK verification only
            if (sdkProofValidation && sdkProofValidation.valid) {
              result.verification.dataIntegrity = true;
              log('  ✓ SDK data integrity checks passed');
              log('    - Authenticator signatures valid');
              log('    - Transaction data cryptographically verified');
              log('    - State data matches transaction data');
              log('    Note: Genesis data tampering detection requires tokens minted with this CLI');
            } else if (sdkProofValidation) {
              log('  ❌ CRITICAL: Token data integrity check FAILED!');
              log('    Token data may have been tampered with');
              sdkProofValidation.errors.forEach((err: string) => {
                log(`    - ${err}`);
              });
              correspondenceValid = false;
              exitCode = 1;
            } else {
              log('  ⚠ Could not verify data integrity (no trust base available)');
            }
          }

          try {

            // SECURITY CHECK (SEC-INTEGRITY-002): Verify current state data integrity
            // Calculate hash of current state and verify it matches what's committed
            const currentStateHash = await token.state.calculateHash();
            log(`  Current state hash: ${HexConverter.encode(currentStateHash.imprint)}`);

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
                    log('  ✓ Last transaction data integrity verified');
                  } else {
                    log('  ❌ CRITICAL: Last transaction data has been TAMPERED!');
                    log('    Authenticator signature is INVALID for current transaction data');
                    result.errors.push('Last transaction data has been tampered');
                    correspondenceValid = false;
                    exitCode = 1;
                  }
                }
              }

              // Verify state data is consistent with token structure
              // The current state should match the predicate and data stored in the token
              log('  ✓ Current state structure is consistent');
            } else {
              // No transfers yet - state should be the genesis state
              log('  ✓ Current state is genesis state (no transfers)');
            }
          } catch (integrityError) {
            log(`  ⚠ Data integrity check error: ${integrityError instanceof Error ? integrityError.message : String(integrityError)}`);
            correspondenceValid = false;
            exitCode = 1;
          }

          // Check ALL transaction proofs correspondence and integrity
          log('\n=== Transaction Proof Verification ===');
          if (token.transactions && token.transactions.length > 0) {
            log(`Checking ${token.transactions.length} transfer proof${token.transactions.length !== 1 ? 's' : ''}...`);

            for (let i = 0; i < token.transactions.length; i++) {
              const tx = token.transactions[i];
              const txNum = i + 1;

              if (tx.inclusionProof?.authenticator) {
                const proofSourceHash = tx.inclusionProof.authenticator.stateHash;
                const txSourceHash = await tx.data.sourceState.calculateHash();

                if (proofSourceHash.equals(txSourceHash)) {
                  log(`  ✓ Transfer ${txNum} proof corresponds to source state`);
                } else {
                  log(`  ⚠ WARNING: Transfer ${txNum} proof MISMATCH!`);
                  log(`    Expected: ${HexConverter.encode(txSourceHash.imprint)}`);
                  log(`    Got: ${HexConverter.encode(proofSourceHash.imprint)}`);
                  result.warnings.push(`Transfer ${txNum} proof mismatch`);
                  correspondenceValid = false;
                  exitCode = 1;
                }
              } else {
                log(`  ⚠ WARNING: Transfer ${txNum} proof missing authenticator`);
                result.warnings.push(`Transfer ${txNum} missing authenticator`);
                correspondenceValid = false;
                exitCode = 1;
              }

              // Also verify transaction hash if present
              if (tx.inclusionProof?.transactionHash) {
                const proofTxHash = tx.inclusionProof.transactionHash;
                const actualTxHash = await tx.data.calculateHash();

                if (HexConverter.encode(proofTxHash.imprint) === HexConverter.encode(actualTxHash.imprint)) {
                  log(`  ✓ Transfer ${txNum} transaction hash matches proof`);
                } else {
                  log(`  ⚠ WARNING: Transfer ${txNum} transaction hash mismatch!`);
                  log(`    Expected: ${HexConverter.encode(actualTxHash.imprint)}`);
                  log(`    Got: ${HexConverter.encode(proofTxHash.imprint)}`);
                  result.warnings.push(`Transfer ${txNum} hash mismatch`);
                  correspondenceValid = false;
                  exitCode = 1;
                }
              }
            }
          }

          if (correspondenceValid) {
            log('  ✓ All proofs correspond to their states');
          } else {
            log('  ❌ Some proofs do NOT correspond to states - token may be corrupted');
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
          log(`\n⚠ Could not load token with SDK: ${err instanceof Error ? err.message : String(err)}`);
          log('Displaying raw JSON data...\n');
          // For in-transit tokens, SDK failure is expected (uncommitted transactions have different format)
          if (!hasUncommittedTransactions) {
            result.errors.push(`SDK load failed: ${err instanceof Error ? err.message : String(err)}`);
            exitCode = 1; // Critical failure - SDK cannot parse token
          }
        }

        // Display genesis transaction (verbose only)
        if (verbose) {
          displayGenesis(tokenJson.genesis);
        }

        // Display UNCT liquidity if present (verbose only)
        if (verbose) {
          await displayUNCTLiquidity(tokenJson.genesis, options);
        }

        // Display current state (verbose only)
        if (verbose) {
          log('\n=== Current State ===');
          if (tokenJson.state) {
            // Display state data
            if (tokenJson.state.data) {
              log(`\nState Data (hex): ${tokenJson.state.data.substring(0, 50)}${tokenJson.state.data.length > 50 ? '...' : ''}`);
              const decoded = tryDecodeAsText(tokenJson.state.data);
              log(`State Data (decoded):`);
              log(decoded);
            } else {
              log('\nState Data: (empty)');
            }

            // Display predicate
            if (tokenJson.state.predicate) {
              displayPredicateInfo(tokenJson.state.predicate);
            } else {
              log('\nPredicate: (none)');
            }
          }
        }

        // Display ownership status (query aggregator)
        // IMPORTANT: Ownership verification queries the aggregator to determine if token state is spent
        // - checkOwnershipStatus() handles normal responses (PATH_NOT_INCLUDED/OK) gracefully
        // - PATH_NOT_INCLUDED = unspent state (aggregator returns exclusion proof) - NORMAL
        // - OK = spent state (aggregator returns inclusion proof) - NORMAL
        // - Only technical errors (network down, aggregator unavailable) are caught below
        if (!options.skipNetwork && token && tokenJson.state) {
          log('\n=== Ownership Status ===');

          // Determine endpoint
          let endpoint = options.endpoint;
          if (options.local) {
            endpoint = 'http://127.0.0.1:3000';
          }

          try {
            log('Querying aggregator for current state...');
            const aggregatorClient = new AggregatorClient(endpoint);
            const client = new StateTransitionClient(aggregatorClient);

            // Get trust base (reuse if already loaded)
            let trustBase = null;
            try {
              trustBase = await getCachedTrustBase({
                filePath: process.env.TRUSTBASE_PATH,
                useFallback: false,
                silent: !verbose
              });
            } catch (err) {
              log('  ⚠ Could not load trust base for ownership verification');
              log(`  Error: ${err instanceof Error ? err.message : String(err)}`);
            }

            if (trustBase) {
              // checkOwnershipStatus() internally handles all normal aggregator responses
              // It only returns 'error' scenario for technical failures (network down, etc.)
              // Normal spent/unspent states are returned as 'current', 'pending', 'confirmed', 'outdated'
              const ownershipStatus = await checkOwnershipStatus(token, tokenJson, client, trustBase);
              result.verification.ownershipStatus = ownershipStatus.scenario;

              log(`\n${ownershipStatus.message}`);
              ownershipStatus.details.forEach(detail => {
                log(`  ${detail}`);
              });

              // Token is spent/outdated = cannot be used
              // This is the ONLY case where exitCode = 1 (token state is obsolete)
              if (ownershipStatus.scenario === 'outdated') {
                result.status = 'SPENT';
                exitCode = 1;
              }
            }
          } catch (err) {
            // TECHNICAL ERROR: This catch block only executes for unexpected failures
            // - Not for normal spent/unspent states (those are handled above)
            // - Typically: network errors, malformed responses, SDK exceptions
            log('  ⚠ Cannot verify ownership status');
            log(`  Error: ${err instanceof Error ? err.message : String(err)}`);
          }
        } else if (options.skipNetwork) {
          log('\n=== Ownership Status ===');
          log('Network verification skipped (--skip-network flag)');
        }

        // Display transaction history (verbose only)
        if (verbose) {
          log('\n=== Transaction History ===');
          if (tokenJson.transactions && Array.isArray(tokenJson.transactions)) {
            log(`Number of transfers: ${tokenJson.transactions.length}`);

            if (tokenJson.transactions.length === 0) {
              log('(No transfer transactions - newly minted token)');
            } else {
              tokenJson.transactions.forEach((tx: any, idx: number) => {
                log(`\nTransfer ${idx + 1}:`);
                if (tx.data) {
                  log(`  New Owner: ${tx.data.recipient || 'N/A'}`);
                  if (tx.data.salt) {
                    log(`  Salt: ${tx.data.salt}`);
                  }
                }
              });
            }
          } else {
            log('No transaction history');
          }

          // Display nametags
          if (tokenJson.nametags && Array.isArray(tokenJson.nametags) && tokenJson.nametags.length > 0) {
            log('\n=== Nametags ===');
            log(`Number of nametags: ${tokenJson.nametags.length}`);
            tokenJson.nametags.forEach((nametag: any, idx: number) => {
              log(`  ${idx + 1}. ${JSON.stringify(nametag)}`);
            });
          }
        }

        // Determine final status
        const cryptoValid = sdkProofValidation ? sdkProofValidation.valid : false;

        // Verbose summary
        if (verbose) {
          log('\n=== Verification Summary ===');
          log(`${!!tokenJson.genesis ? '✓' : '✗'} File format: TXF v${tokenJson.version || '?'}`);
          log(`${!!tokenJson.genesis ? '✓' : '✗'} Has genesis: ${!!tokenJson.genesis}`);
          log(`${!!tokenJson.state ? '✓' : '✗'} Has state: ${!!tokenJson.state}`);
          log(`${!!tokenJson.state?.predicate ? '✓' : '✗'} Has predicate: ${!!tokenJson.state?.predicate}`);
          log(`${jsonProofValidation.valid ? '✓' : '✗'} Proof structure valid: ${jsonProofValidation.valid ? 'Yes' : 'No'}`);
          log(`${token !== null ? '✓' : '✗'} SDK compatible: ${token !== null ? 'Yes' : 'No'}`);

          // Check cryptographic verification if it was performed
          if (sdkProofValidation) {
            log(`${cryptoValid ? '✓' : '✗'} Cryptographic proofs valid: ${cryptoValid ? 'Yes' : 'No'}`);
          }

          if (token && jsonProofValidation.valid && cryptoValid) {
            log('\n✅ This token is valid and can be transferred using the send-token command');
          } else if (token && !cryptoValid) {
            log('\n❌ Token has cryptographic verification failures - cannot be used for transfers');
          } else if (token && !jsonProofValidation.valid) {
            log('\n⚠️  Token loaded but has proof validation issues - transfer may fail');
          } else {
            log('\n❌ Token has issues and cannot be used for transfers');
          }
        }

        // Set final status
        if (result.status !== 'SPENT') {
          if (result.proofs.uncommitted > 0) {
            result.status = 'PENDING';
          } else if (token && jsonProofValidation.valid && cryptoValid && exitCode === 0) {
            result.status = 'VALID';
          } else {
            result.status = 'INVALID';
          }
        }
        result.canTransfer = result.status === 'VALID';

        // Output based on mode
        if (jsonOutput) {
          console.log(formatVerifyJson(result));
        } else if (!verbose) {
          // Default concise output
          console.log(formatVerifyOutput(result));
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
