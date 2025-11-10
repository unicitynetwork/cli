#!/usr/bin/env node
/**
 * Test Utilities for BATS Tests
 *
 * This script provides utility functions that can be called from bash tests.
 * It handles hex decoding, CBOR parsing, and TXF validation.
 *
 * Usage:
 *   node tests/helpers/test-utils.js <command> [args...]
 *
 * Commands:
 *   decode-hex <hex-string>              Decode hex to UTF-8 string
 *   decode-predicate <predicate-hex>     Decode CBOR predicate and extract info
 *   validate-proof <txf-file>            Check if TXF has valid inclusion proof
 *   extract-address <txf-file>           Extract address from TXF file
 *   extract-token-data <txf-file>        Extract and decode tokenData field
 */

const fs = require('fs');
const { CborDecoder } = require('@unicitylabs/commons/lib/cbor/CborDecoder.js');
const { HexConverter } = require('@unicitylabs/state-transition-sdk/lib/util/HexConverter.js');

/**
 * Decode hex string to UTF-8
 * @param {string} hexString - Hex-encoded string
 * @returns {string} Decoded UTF-8 string
 */
function decodeHex(hexString) {
  if (!hexString || hexString.length === 0) {
    return '';
  }

  try {
    const buffer = Buffer.from(hexString, 'hex');
    return buffer.toString('utf-8');
  } catch (error) {
    throw new Error(`Failed to decode hex: ${error.message}`);
  }
}

/**
 * Convert Uint8Array to number (for small byte arrays)
 * @param {Uint8Array|number} value
 * @returns {number}
 */
function toNumber(value) {
  if (typeof value === 'number') return value;
  if (value instanceof Uint8Array) {
    if (value.length === 1) return value[0];
    if (value.length === 2) return (value[0] << 8) | value[1];
    if (value.length === 4) return (value[0] << 24) | (value[1] << 16) | (value[2] << 8) | value[3];
  }
  return parseInt(value);
}

/**
 * Decode CBOR predicate and extract information
 * Predicate format: [engineId, template, params]
 * - engineId: number (0 = unmasked, 1 = masked)
 * - template: byte string (hash of predicate template)
 * - params: byte string containing CBOR array [tokenId, tokenType, publicKey, algorithm, signature, ...mask?]
 *
 * @param {string} predicateHex - Hex-encoded CBOR predicate
 * @returns {Object} Decoded predicate information
 */
function decodePredicate(predicateHex) {
  try {
    const predicateBytes = HexConverter.decode(predicateHex);
    const predicateArray = CborDecoder.readArray(predicateBytes);

    if (!Array.isArray(predicateArray) || predicateArray.length < 3) {
      throw new Error('Invalid predicate format: expected array with 3 elements');
    }

    // Element 0: Engine ID (number)
    const engineIdBytes = predicateArray[0];
    const engineId = engineIdBytes.length === 1 ? engineIdBytes[0] :
                     toNumber(CborDecoder.readUnsignedInteger(engineIdBytes));

    // Element 1: Template (byte string)
    const templateBytes = CborDecoder.readByteString(predicateArray[1]);
    const template = HexConverter.encode(templateBytes);

    // Element 2: Params (byte string containing CBOR array)
    const paramsBytes = CborDecoder.readByteString(predicateArray[2]);

    // Extract information from params
    let result = {
      engineId,
      template,
      engineName: getEngineName(engineId),
      templateLength: templateBytes.length,
      paramsLength: paramsBytes.length
    };

    // Try to decode params as a nested CBOR array
    try {
      const params = CborDecoder.readArray(paramsBytes);

      // Params format: [tokenId, tokenType, publicKey, algorithm, signature, ...mask?]
      if (params.length >= 3) {
        // Token ID (byte string)
        result.tokenId = HexConverter.encode(CborDecoder.readByteString(params[0]));

        // Token Type (byte string)
        result.tokenType = HexConverter.encode(CborDecoder.readByteString(params[1]));

        // Public Key (byte string)
        result.publicKey = HexConverter.encode(CborDecoder.readByteString(params[2]));

        // Algorithm (text string)
        if (params.length >= 4) {
          result.algorithm = CborDecoder.readTextString(params[3]);
        }

        // Element 4: Flags or scheme (usually a single byte)
        if (params.length >= 5) {
          if (params[4] instanceof Uint8Array) {
            result.flags = HexConverter.encode(params[4]);
          }
        }

        // Signature (byte string) - at index 5 for unmasked, might vary for masked
        if (params.length >= 6) {
          try {
            const signatureBytes = CborDecoder.readByteString(params[5]);
            result.signature = HexConverter.encode(signatureBytes);
          } catch (e) {
            // Signature might be encoded differently
            if (params[5] instanceof Uint8Array) {
              result.signature = HexConverter.encode(params[5]);
            }
          }
        }

        // For masked predicates (engine 1), check for mask parameter at index 6
        if (engineId === 1 && params.length >= 7) {
          try {
            const maskBytes = CborDecoder.readByteString(params[6]);
            result.mask = HexConverter.encode(maskBytes);
            result.isMasked = true;
          } catch (e) {
            // Mask might be encoded differently
            if (params[6] instanceof Uint8Array) {
              result.mask = HexConverter.encode(params[6]);
              result.isMasked = true;
            }
          }
        } else {
          result.isMasked = (engineId === 1);
        }
      }
    } catch (e) {
      // Params might not be decodable
      result.paramsDecodeError = e.message;
    }

    return result;
  } catch (error) {
    throw new Error(`Failed to decode predicate: ${error.message}`);
  }
}

/**
 * Get human-readable engine name
 * @param {number} engineId
 * @returns {string}
 */
function getEngineName(engineId) {
  const engines = {
    0: 'unmasked (reusable address)',
    1: 'masked (one-time address)'
  };
  return engines[engineId] || `unknown-${engineId}`;
}

/**
 * Validate inclusion proof in TXF file
 * Checks that all required proof fields are present and non-null
 *
 * @param {string} txfPath - Path to TXF file
 * @returns {Object} Validation result with details
 */
function validateInclusionProof(txfPath) {
  try {
    const txfContent = fs.readFileSync(txfPath, 'utf-8');
    const txf = JSON.parse(txfContent);

    const result = {
      valid: true,
      errors: [],
      proof: null
    };

    // Check genesis inclusion proof
    if (!txf.genesis) {
      result.valid = false;
      result.errors.push('Missing genesis object');
      return result;
    }

    if (!txf.genesis.inclusionProof) {
      result.valid = false;
      result.errors.push('Missing genesis.inclusionProof');
      return result;
    }

    const proof = txf.genesis.inclusionProof;
    result.proof = proof;

    // Check authenticator
    if (!proof.authenticator) {
      result.valid = false;
      result.errors.push('Missing authenticator');
    } else {
      if (!proof.authenticator.algorithm) {
        result.valid = false;
        result.errors.push('Missing authenticator.algorithm');
      }
      if (!proof.authenticator.publicKey) {
        result.valid = false;
        result.errors.push('Missing authenticator.publicKey');
      }
      if (!proof.authenticator.signature) {
        result.valid = false;
        result.errors.push('Missing authenticator.signature');
      }
      if (!proof.authenticator.stateHash) {
        result.valid = false;
        result.errors.push('Missing authenticator.stateHash');
      }
    }

    // Check merkleTreePath
    if (!proof.merkleTreePath) {
      result.valid = false;
      result.errors.push('Missing merkleTreePath');
    } else {
      if (!proof.merkleTreePath.root) {
        result.valid = false;
        result.errors.push('Missing merkleTreePath.root');
      }
      if (!Array.isArray(proof.merkleTreePath.steps)) {
        result.valid = false;
        result.errors.push('Missing or invalid merkleTreePath.steps');
      }
    }

    // Check transactionHash
    if (!proof.transactionHash) {
      result.valid = false;
      result.errors.push('Missing transactionHash');
    }

    // Check unicityCertificate
    if (!proof.unicityCertificate) {
      result.valid = false;
      result.errors.push('Missing unicityCertificate');
    }

    return result;
  } catch (error) {
    return {
      valid: false,
      errors: [`Failed to validate: ${error.message}`],
      proof: null
    };
  }
}

/**
 * Extract address from TXF file
 * @param {string} txfPath - Path to TXF file
 * @returns {string} Address from genesis.data.recipient
 */
function extractAddress(txfPath) {
  try {
    const txfContent = fs.readFileSync(txfPath, 'utf-8');
    const txf = JSON.parse(txfContent);

    if (!txf.genesis || !txf.genesis.data || !txf.genesis.data.recipient) {
      throw new Error('Missing recipient address in TXF file');
    }

    return txf.genesis.data.recipient;
  } catch (error) {
    throw new Error(`Failed to extract address: ${error.message}`);
  }
}

/**
 * Extract and decode tokenData from TXF file
 * @param {string} txfPath - Path to TXF file
 * @returns {string} Decoded token data (empty string if not present)
 */
function extractTokenData(txfPath) {
  try {
    const txfContent = fs.readFileSync(txfPath, 'utf-8');
    const txf = JSON.parse(txfContent);

    if (!txf.genesis || !txf.genesis.data) {
      throw new Error('Missing genesis.data in TXF file');
    }

    const tokenData = txf.genesis.data.tokenData || '';

    // If tokenData is hex-encoded, decode it
    if (tokenData.length > 0) {
      return decodeHex(tokenData);
    }

    return '';
  } catch (error) {
    throw new Error(`Failed to extract token data: ${error.message}`);
  }
}

/**
 * Main CLI handler
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: test-utils.js <command> [args...]');
    console.error('');
    console.error('Commands:');
    console.error('  decode-hex <hex-string>              Decode hex to UTF-8 string');
    console.error('  decode-predicate <predicate-hex>     Decode CBOR predicate and extract info');
    console.error('  validate-proof <txf-file>            Check if TXF has valid inclusion proof');
    console.error('  extract-address <txf-file>           Extract address from TXF file');
    console.error('  extract-token-data <txf-file>        Extract and decode tokenData field');
    process.exit(1);
  }

  const command = args[0];

  try {
    switch (command) {
      case 'decode-hex': {
        if (args.length < 2) {
          throw new Error('Missing hex string argument');
        }
        const decoded = decodeHex(args[1]);
        console.log(decoded);
        break;
      }

      case 'decode-predicate': {
        if (args.length < 2) {
          throw new Error('Missing predicate hex argument');
        }
        const info = decodePredicate(args[1]);
        console.log(JSON.stringify(info, null, 2));
        break;
      }

      case 'validate-proof': {
        if (args.length < 2) {
          throw new Error('Missing TXF file path argument');
        }
        const result = validateInclusionProof(args[1]);
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.valid ? 0 : 1);
        break;
      }

      case 'extract-address': {
        if (args.length < 2) {
          throw new Error('Missing TXF file path argument');
        }
        const address = extractAddress(args[1]);
        console.log(address);
        break;
      }

      case 'extract-token-data': {
        if (args.length < 2) {
          throw new Error('Missing TXF file path argument');
        }
        const tokenData = extractTokenData(args[1]);
        console.log(tokenData);
        break;
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run main if executed directly
if (require.main === module) {
  main();
}

// Export functions for use as module
module.exports = {
  decodeHex,
  decodePredicate,
  validateInclusionProof,
  extractAddress,
  extractTokenData
};
