/**
 * Coin Origin Proof
 *
 * Minimal proof that a UNCT coin was mined on the Unicity PoW blockchain.
 *
 * The proof only stores blockHeight - all other data can be fetched from
 * the POW blockchain:
 * - tokenId: Already in genesis.data.tokenId
 * - merkleRoot, blockHash, blockTimestamp: Fetch from block header at blockHeight
 * - target, leftControl, signature: Fetch from witness data at blockHeight
 * - Verify: target = SHA256(tokenId) matches witness.rightControl
 */

export interface CoinOriginProof {
  /** Proof format version */
  version: string;

  /** Block height where coin was mined */
  blockHeight: number;
}

/**
 * Block header data from PoW blockchain
 */
export interface BlockHeader {
  height: number;
  hash: string;
  merkleRoot: string;
  timestamp: number;
  version?: number;
  previousBlockHash?: string;
}

/**
 * Segregated witness data
 */
export interface WitnessData {
  leftControl: string;      // Signed checkpoint
  rightControl: string;      // Target
  signature: string;         // BIP340 Schnorr signature
  merkleRoot: string;        // Merkle root
  publicKey?: string;        // Compressed public key
}

/**
 * Serialize CoinOriginProof to JSON string
 */
export function serializeCoinOriginProof(proof: CoinOriginProof): string {
  return JSON.stringify(proof, null, 2);
}

/**
 * Deserialize CoinOriginProof from JSON string
 */
export function deserializeCoinOriginProof(json: string): CoinOriginProof {
  try {
    const proof = JSON.parse(json) as CoinOriginProof;

    // Validate required fields
    if (!proof.version || proof.blockHeight === undefined) {
      throw new Error('Missing required proof fields (version, blockHeight)');
    }

    if (typeof proof.blockHeight !== 'number' || proof.blockHeight < 0) {
      throw new Error(`Invalid blockHeight: ${proof.blockHeight}`);
    }

    return proof;
  } catch (error) {
    throw new Error(`Failed to deserialize CoinOriginProof: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate proof structure
 */
export function validateProofStructure(proof: CoinOriginProof): boolean {
  try {
    // Check version
    if (proof.version !== '1.0') {
      throw new Error(`Unsupported proof version: ${proof.version}`);
    }

    // Check block height is valid
    if (typeof proof.blockHeight !== 'number' || proof.blockHeight < 0) {
      throw new Error(`Invalid block height: ${proof.blockHeight}`);
    }

    return true;
  } catch (error) {
    console.error(`Proof validation failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}


/**
 * Embed CoinOriginProof in token data
 * Returns UTF-8 encoded JSON
 */
export function embedProofInTokenData(proof: CoinOriginProof): Uint8Array {
  const proofJson = serializeCoinOriginProof(proof);
  return new TextEncoder().encode(proofJson);
}

/**
 * Extract CoinOriginProof from token data
 * Returns null if data is not a valid proof
 */
export function extractProofFromTokenData(data: Uint8Array): CoinOriginProof | null {
  try {
    const jsonString = new TextDecoder().decode(data);
    return deserializeCoinOriginProof(jsonString);
  } catch (error) {
    // Not a valid proof or data format
    return null;
  }
}

/**
 * Create CoinOriginProof
 *
 * Creates a minimal proof containing only blockHeight.
 * All other data (tokenId, merkleRoot, target, witness) can be
 * fetched from POW blockchain by querying block at blockHeight.
 *
 * @param blockHeight - Block height where coin was mined
 * @returns Proof structure
 */
export function createProof(blockHeight: number): CoinOriginProof {
  return {
    version: '1.0',
    blockHeight,
  };
}
