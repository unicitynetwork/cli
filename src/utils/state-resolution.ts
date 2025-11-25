/**
 * State Resolution Utilities for Token Transfers
 *
 * Handles scenario detection and automatic proof resolution.
 * All transfers are stored in transactions[] array.
 */

import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import { Authenticator } from '@unicitylabs/state-transition-sdk/lib/api/Authenticator.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import { validateInclusionProof } from './proof-validation.js';
import { IExtendedTxfToken } from '../types/extended-txf.js';

/**
 * Transfer scenario types
 * - ONLINE_COMPLETE: All transactions have complete inclusion proofs
 * - NEEDS_RESOLUTION: Transactions exist but proofs are missing/incomplete
 */
export type TransferScenario = 'ONLINE_COMPLETE' | 'NEEDS_RESOLUTION';

/**
 * Transfer details extracted from transaction
 */
export interface TransferDetails {
  recipient: string;
  salt: Uint8Array;
  recipientDataHash: string | null;
  message: string | null;
}

/**
 * Detect which transfer scenario we're dealing with
 *
 * Scenarios:
 * - ONLINE_COMPLETE: All transactions have complete proofs (transactionHash + merkleTreePath)
 * - NEEDS_RESOLUTION: Transactions exist but proofs are missing/incomplete
 *
 * @param txfJson Extended TXF token JSON
 * @returns Scenario type
 */
export function detectScenario(txfJson: IExtendedTxfToken): TransferScenario {
  // Check if token has transactions
  if (!txfJson.transactions || txfJson.transactions.length === 0) {
    // No transactions - this is an error case
    // Return NEEDS_RESOLUTION to let error handling happen in receive-token
    return 'NEEDS_RESOLUTION';
  }

  // Check if all transactions have complete proofs
  const allProofsComplete = hasCompleteProofs(txfJson);

  if (allProofsComplete) {
    return 'ONLINE_COMPLETE';
  } else {
    return 'NEEDS_RESOLUTION';
  }
}

/**
 * Check if all transactions have complete inclusion proofs
 *
 * @param tokenJson Token JSON structure
 * @returns True if all proofs are complete
 */
export function hasCompleteProofs(tokenJson: any): boolean {
  // Check genesis proof
  if (!tokenJson.genesis || !tokenJson.genesis.inclusionProof) {
    return false;
  }

  const genesisProof = tokenJson.genesis.inclusionProof;
  if (!genesisProof.authenticator || !genesisProof.transactionHash) {
    return false;
  }

  // Check all transaction proofs
  if (tokenJson.transactions && Array.isArray(tokenJson.transactions)) {
    for (const tx of tokenJson.transactions) {
      if (!tx.inclusionProof) {
        return false;
      }

      if (!tx.inclusionProof.authenticator || !tx.inclusionProof.transactionHash) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Extract transfer details from a transaction
 *
 * @param tx Transaction object
 * @returns Transfer details (recipient, salt, etc.)
 */
export function extractTransferDetails(tx: any): TransferDetails {
  if (!tx || !tx.data) {
    throw new Error('Transaction missing data field');
  }

  const txData = tx.data;

  // Validate required fields
  if (!txData.recipient) {
    throw new Error('Transaction data missing recipient field');
  }

  if (!txData.salt) {
    throw new Error('Transaction data missing salt field');
  }

  return {
    recipient: txData.recipient,
    salt: HexConverter.decode(txData.salt),
    recipientDataHash: txData.recipientDataHash || null,
    message: txData.message || null
  };
}

/**
 * Resolve missing inclusion proofs for all transactions
 *
 * Queries the aggregator for any transaction missing complete proofs.
 * This function only works when authenticators are present (can calculate RequestId).
 *
 * @param tokenJson Token JSON (may have incomplete proofs)
 * @param aggregatorClient AggregatorClient for querying proofs
 * @param trustBase RootTrustBase for proof validation
 * @returns Updated token JSON with resolved proofs
 */
export async function resolveTokenProofs(
  tokenJson: any,
  aggregatorClient: AggregatorClient,
  trustBase: RootTrustBase
): Promise<any> {

  let modified = false;

  // 1. Check and resolve genesis proof if incomplete
  if (!tokenJson.genesis.inclusionProof?.transactionHash ||
      !tokenJson.genesis.inclusionProof?.merkleTreePath) {

    // Need authenticator to calculate RequestId
    if (!tokenJson.genesis.inclusionProof?.authenticator) {
      throw new Error('Cannot resolve genesis proof: missing authenticator');
    }

    console.error('  Resolving genesis proof...');

    try {
      // Recreate Authenticator from JSON to calculate RequestId
      const authenticator = await Authenticator.fromJSON(tokenJson.genesis.inclusionProof.authenticator);
      const requestId = await authenticator.calculateRequestId();

      // Fetch proof from aggregator
      const proofResponse = await aggregatorClient.getInclusionProof(requestId);

      if (!proofResponse || !proofResponse.inclusionProof) {
        throw new Error('Aggregator returned no proof for genesis');
      }

      const proof = proofResponse.inclusionProof;

      // Validate proof
      const validation = await validateInclusionProof(proof, requestId, trustBase);
      if (!validation.valid) {
        throw new Error(`Genesis proof validation failed: ${validation.errors.join(', ')}`);
      }

      // Update genesis with complete proof
      tokenJson.genesis.inclusionProof = proof.toJSON();
      modified = true;
      console.error('    ✓ Genesis proof resolved');

    } catch (error) {
      throw new Error(
        `Failed to resolve genesis proof: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // 2. Check and resolve all transaction proofs
  if (tokenJson.transactions && Array.isArray(tokenJson.transactions)) {
    for (let i = 0; i < tokenJson.transactions.length; i++) {
      const tx = tokenJson.transactions[i];

      if (!tx.inclusionProof?.transactionHash ||
          !tx.inclusionProof?.merkleTreePath) {

        // Need authenticator to calculate RequestId
        if (!tx.inclusionProof?.authenticator) {
          throw new Error(`Cannot resolve transaction ${i + 1} proof: missing authenticator`);
        }

        console.error(`  Resolving transaction ${i + 1} proof...`);

        try {
          // Recreate Authenticator from JSON to calculate RequestId
          const authenticator = await Authenticator.fromJSON(tx.inclusionProof.authenticator);
          const requestId = await authenticator.calculateRequestId();

          // Fetch proof from aggregator
          const proofResponse = await aggregatorClient.getInclusionProof(requestId);

          if (!proofResponse || !proofResponse.inclusionProof) {
            throw new Error(`Aggregator returned no proof for transaction ${i + 1}`);
          }

          const proof = proofResponse.inclusionProof;

          // Validate proof
          const validation = await validateInclusionProof(proof, requestId, trustBase);
          if (!validation.valid) {
            throw new Error(
              `Transaction ${i + 1} proof validation failed: ${validation.errors.join(', ')}`
            );
          }

          // Update transaction with complete proof
          tx.inclusionProof = proof.toJSON();
          modified = true;
          console.error(`    ✓ Transaction ${i + 1} proof resolved`);

        } catch (error) {
          throw new Error(
            `Failed to resolve transaction ${i + 1} proof: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }
  }

  return tokenJson;
}
