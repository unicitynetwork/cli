import { IExtendedTxfToken, IValidationResult, TokenStatus } from '../types/extended-txf.js';

/**
 * Validate extended TXF before processing
 */
export async function validateExtendedTxf(
  txfJson: IExtendedTxfToken
): Promise<IValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Basic TXF validation
  if (txfJson.version !== "2.0") {
    errors.push(`Unsupported TXF version: ${txfJson.version}`);
  }

  if (!txfJson.state || !txfJson.genesis) {
    errors.push('Invalid TXF structure: missing required fields');
  }

  // 2. Offline transfer validation
  if (txfJson.offlineTransfer) {
    const ot = txfJson.offlineTransfer;

    // Version check
    if (ot.version !== "1.1") {
      warnings.push(`Offline transfer version ${ot.version} may not be compatible`);
    }

    // Type check
    if (ot.type !== "offline_transfer") {
      errors.push(`Invalid offline transfer type: ${ot.type}`);
    }

    // Required fields
    if (!ot.sender?.address || !ot.sender?.publicKey) {
      errors.push('Missing sender information');
    }

    if (!ot.recipient) {
      errors.push('Missing recipient address');
    }

    if (!ot.commitment?.salt) {
      errors.push('Missing commitment salt');
    }

    if (!ot.commitmentData) {
      errors.push('Missing SDK commitment data');
    }

    // Network validation
    if (ot.network !== "test" && ot.network !== "production") {
      warnings.push(`Unknown network type: ${ot.network}`);
    }

    // Validate commitment is parseable
    if (ot.commitmentData) {
      try {
        const commitment = JSON.parse(ot.commitmentData);
        if (!commitment.requestId || !commitment.transactionData) {
          errors.push('Invalid commitment structure');
        }
      } catch (e) {
        errors.push('Commitment data is not valid JSON');
      }
    }

    // Security checks
    if (ot.commitmentData && (
        ot.commitmentData.includes('privateKey') ||
        ot.commitmentData.includes('secret') ||
        ot.commitmentData.toLowerCase().includes('private')
    )) {
      errors.push('SECURITY VIOLATION: Commitment contains private key data');
    }
  }

  // 3. Status validation
  if (txfJson.offlineTransfer && txfJson.status !== TokenStatus.PENDING) {
    warnings.push(
      `Unexpected status "${txfJson.status}" for offline transfer (expected PENDING)`
    );
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    hasOfflineTransfer: !!txfJson.offlineTransfer
  };
}

/**
 * NEVER export private keys - sanitize before saving
 */
export function sanitizeForExport(txfJson: IExtendedTxfToken): IExtendedTxfToken {
  const sanitized = JSON.parse(JSON.stringify(txfJson));

  // Remove any accidental private key leakage
  if (sanitized.offlineTransfer?.sender) {
    delete (sanitized.offlineTransfer.sender as any).privateKey;
    delete (sanitized.offlineTransfer.sender as any).secret;
    delete (sanitized.offlineTransfer.sender as any).nonce;
  }

  // Clean commitment data too
  if (sanitized.offlineTransfer?.commitmentData) {
    try {
      const commitment = JSON.parse(sanitized.offlineTransfer.commitmentData);
      delete (commitment as any).privateKey;
      delete (commitment as any).secret;
      sanitized.offlineTransfer.commitmentData = JSON.stringify(commitment);
    } catch (e) {
      // Leave as is if not parseable
    }
  }

  return sanitized;
}

/**
 * Upgrade old TXF to extended format
 */
export function upgradeTxfToExtended(oldTxf: any): IExtendedTxfToken {
  // Already extended?
  if (oldTxf.offlineTransfer || oldTxf.status) {
    return oldTxf as IExtendedTxfToken;
  }

  // Upgrade to extended format
  const extended: IExtendedTxfToken = {
    ...oldTxf,
    status: TokenStatus.CONFIRMED  // Existing tokens are confirmed
  };

  return extended;
}
