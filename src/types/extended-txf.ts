/**
 * Extended TXF v2.0 format that supports offline token transfers
 * Compatible with Android wallet offline transfer pattern
 */

export interface IExtendedTxfToken {
  // Standard TXF v2.0 fields
  version: string;
  state: any;  // ITokenStateJson
  genesis: any;  // IMintTransactionJson
  transactions: any[];  // ITransferTransactionJson[]
  nametags: any[];  // ITokenJson[]

  // Extensions for offline transfers (optional)
  offlineTransfer?: IOfflineTransferPackage;

  // Status tracking
  status?: TokenStatus;
}

export interface IOfflineTransferPackage {
  version: string;  // "1.1"
  type: "offline_transfer";
  sender: {
    address: string;
    publicKey: string;  // Base64 encoded
  };
  recipient: string;
  commitment: {
    salt: string;  // Base64 encoded
    timestamp: number;
    amount?: string;  // For fungible tokens (BigInt as string)
  };
  network: "test" | "production";

  // SDK commitment data for network submission
  commitmentData?: string;  // Serialized TransferCommitment JSON

  // Optional transfer message
  message?: string;
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
  hasOfflineTransfer: boolean;
}
