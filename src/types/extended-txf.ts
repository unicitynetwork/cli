/**
 * Extended TXF v2.0 format with transaction-based transfer tracking
 * All transfers stored in transactions[] array (committed or uncommitted)
 */

export interface IExtendedTxfToken {
  // Standard TXF v2.0 fields
  version: string;
  state: any | null;  // ITokenStateJson - null when in-transit (reconstructed from sourceState on load)
  genesis: any;  // IMintTransactionJson
  transactions: any[];  // ITransferTransactionJson[] - May include uncommitted transactions (no inclusionProof)
  nametags: any[];  // ITokenJson[]

  // Status tracking
  status?: TokenStatus;

  // Genesis data integrity hash (optional)
  _integrity?: {
    genesisDataJSONHash?: string;
  };
}

export enum TokenStatus {
  PENDING = "PENDING",        // Offline transfer received but not submitted
  SUBMITTED = "SUBMITTED",    // Submitted to network, waiting confirmation
  CONFIRMED = "CONFIRMED",    // Confirmed on network
  TRANSFERRED = "TRANSFERRED", // Token sent to another wallet (archived)
  BURNED = "BURNED",          // Token burned (split/swap) - cannot be used
  FAILED = "FAILED"           // Network submission failed
}

export interface IValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Multi-token TXF file structure
 * Keys are `_${tokenId}` where tokenId is the full token ID
 */
export interface IMultiTokenTxf {
  [key: `_${string}`]: IExtendedTxfToken;
}
