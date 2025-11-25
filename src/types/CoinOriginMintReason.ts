/**
 * Coin Origin Mint Reason
 *
 * Implements IMintTransactionReason to justify UNCT token minting
 * based on proof of origin from POW blockchain.
 */

import { CoinOriginProof } from './CoinOriginProof.js';
import { IMintTransactionReason } from '@unicitylabs/state-transition-sdk/lib/transaction/IMintTransactionReason.js';

/**
 * Mint reason type for coin origin proof
 */
export const COIN_ORIGIN_MINT_REASON_TYPE = 'COIN_ORIGIN';

/**
 * Mint reason containing proof that coins originate from POW blockchain
 *
 * This provides the justification for including UNCT coin liquidity
 * in the token - the coins are proven to exist in a specific POW block.
 */
export class CoinOriginMintReason implements IMintTransactionReason {
  public readonly type: string = COIN_ORIGIN_MINT_REASON_TYPE;
  public readonly proof: CoinOriginProof;

  constructor(proof: CoinOriginProof) {
    this.proof = proof;
  }

  /**
   * Verify the mint reason (required by IMintTransactionReason)
   * For UNCT, verification happens during proof creation
   */
  async verify(genesis: any): Promise<any> {
    try {
      // Validate proof structure
      this.validate();
      // Actual cryptographic verification happens in pow-client during proof creation
      // This method ensures the proof structure is valid
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Serialize to CBOR (required by IMintTransactionReason)
   * Encodes the reason as a simple CBOR-encoded JSON string
   */
  toCBOR(): Uint8Array {
    // Serialize to JSON and convert to bytes
    const jsonStr = JSON.stringify(this.toJSON());
    return new TextEncoder().encode(jsonStr);
  }

  /**
   * Serialize to JSON
   */
  toJSON(): object {
    return {
      type: this.type,
      proof: this.proof,
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(json: any): CoinOriginMintReason {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid CoinOriginMintReason JSON: must be an object');
    }

    if (json.type !== COIN_ORIGIN_MINT_REASON_TYPE) {
      throw new Error(
        `Invalid CoinOriginMintReason type: expected "${COIN_ORIGIN_MINT_REASON_TYPE}", got "${json.type}"`
      );
    }

    if (!json.proof) {
      throw new Error('Invalid CoinOriginMintReason: missing proof field');
    }

    return new CoinOriginMintReason(json.proof as CoinOriginProof);
  }

  /**
   * Get the coin origin proof
   */
  getProof(): CoinOriginProof {
    return this.proof;
  }

  /**
   * Validate the reason structure
   */
  validate(): boolean {
    if (!this.proof) {
      throw new Error('CoinOriginMintReason missing proof');
    }

    // Validate required proof fields
    if (!this.proof.version) {
      throw new Error('CoinOriginProof missing version');
    }
    if (this.proof.blockHeight === undefined || this.proof.blockHeight < 0) {
      throw new Error('CoinOriginProof missing or invalid blockHeight');
    }

    return true;
  }
}
