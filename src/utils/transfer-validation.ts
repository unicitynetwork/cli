import { IExtendedTxfToken, IValidationResult, TokenStatus } from '../types/extended-txf.js';
import { hasReconstructableState } from './txf-serialization.js';

/**
 * Validate extended TXF before processing
 *
 * @param txfJson Token JSON to validate
 * @param options Validation options
 * @returns Validation result
 */
export async function validateExtendedTxf(
  txfJson: IExtendedTxfToken,
  options?: { allowUncommitted?: boolean }
): Promise<IValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allowUncommitted = options?.allowUncommitted || false;

  // 1. Basic TXF validation
  if (txfJson.version !== "2.0") {
    errors.push(`Unsupported TXF version: ${txfJson.version}`);
  }

  // Allow null state only if it can be reconstructed from sourceState (in-transit token)
  if (txfJson.state === null) {
    if (!hasReconstructableState(txfJson)) {
      errors.push('Invalid TXF structure: null state without reconstructable sourceState');
    }
    // If reconstructable, state is valid (will be reconstructed on load)
  } else if (!txfJson.state || !txfJson.genesis) {
    errors.push('Invalid TXF structure: missing required fields');
  }

  // 2. Transaction validation
  if (txfJson.transactions && txfJson.transactions.length > 0) {
    const lastTx = txfJson.transactions[txfJson.transactions.length - 1];

    // Check if last transaction has proof
    const hasProof = lastTx.inclusionProof &&
                     lastTx.inclusionProof.authenticator &&
                     lastTx.inclusionProof.transactionHash;

    if (!hasProof && !allowUncommitted) {
      errors.push('Last transaction missing inclusion proof (uncommitted)');
      warnings.push('Transaction is uncommitted - use --offline flag to process without proof');
    }

    // Validate transaction structure
    if (!lastTx.data || !lastTx.data.recipient) {
      errors.push('Transaction missing required data fields');
    }

    // Security checks - ensure no private keys leaked
    if (lastTx.data) {
      const dataStr = JSON.stringify(lastTx.data);
      if (dataStr.includes('privateKey') || dataStr.includes('"secret"')) {
        errors.push('SECURITY VIOLATION: Transaction contains private key data');
      }
    }
  }

  // 3. Status validation
  if (txfJson.transactions && txfJson.transactions.length > 0) {
    const hasCompleteProofs = txfJson.transactions.every(tx =>
      tx.inclusionProof?.transactionHash && tx.inclusionProof?.merkleTreePath
    );

    if (hasCompleteProofs && txfJson.status === TokenStatus.PENDING) {
      warnings.push('Status is PENDING but all transactions have proofs');
    }

    if (!hasCompleteProofs && txfJson.status === TokenStatus.CONFIRMED) {
      errors.push('Status is CONFIRMED but transactions missing proofs');
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * NEVER export private keys - sanitize before saving
 */
export function sanitizeForExport(txfJson: IExtendedTxfToken): IExtendedTxfToken {
  const sanitized = JSON.parse(JSON.stringify(txfJson));

  // Remove any accidental private key leakage from transactions
  if (sanitized.transactions && Array.isArray(sanitized.transactions)) {
    for (const tx of sanitized.transactions) {
      if (tx.data) {
        delete (tx.data as any).privateKey;
        delete (tx.data as any).secret;
        delete (tx.data as any).nonce;
      }

      // Also clean inclusion proof if present
      if (tx.inclusionProof) {
        delete (tx.inclusionProof as any).privateKey;
        delete (tx.inclusionProof as any).secret;
      }
    }
  }

  // Clean state
  if (sanitized.state) {
    delete (sanitized.state as any).privateKey;
    delete (sanitized.state as any).secret;
  }

  return sanitized;
}
