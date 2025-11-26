/**
 * TXF Serialization Utilities
 *
 * Provides optimized serialization for TXF files by eliminating
 * data duplication when a token is "in transit" (sent but not yet received).
 *
 * When a token is in transit:
 * - The top-level `state` field duplicates `transactions[-1].data.sourceState`
 * - This module nulls `state` on save and reconstructs it on load
 *
 * "In-transit" is determined by comparing state with sourceState:
 * - If state === sourceState: token is in-transit (sent but not received)
 * - If state !== sourceState: token was received (new recipient state)
 *
 * This is INDEPENDENT of whether the Unicity proof exists - both committed
 * and uncommitted transactions can be in-transit.
 *
 * Key functions:
 * - serializeTxf(): Prepare TXF for disk storage (nulls state if in-transit)
 * - deserializeTxf(): Load TXF from disk (reconstructs state if null)
 */

import { IExtendedTxfToken } from '../types/extended-txf.js';

/**
 * Check if a token is "in transit" (sent but not yet received)
 *
 * A token is in-transit when:
 * - It has at least one transaction
 * - The current `state.predicate` matches `transactions[-1].data.sourceState.predicate`
 *
 * This works for both committed (with proof) and uncommitted transactions.
 *
 * Note: We compare predicates only because `data` field can be "" or null
 * interchangeably (they're semantically equivalent). The predicate is what
 * determines ownership.
 *
 * @param txfJson Token JSON to check
 * @returns True if token is in-transit
 */
export function isTokenInTransit(txfJson: any): boolean {
  if (!txfJson.transactions || txfJson.transactions.length === 0) {
    return false;
  }

  const lastTx = txfJson.transactions[txfJson.transactions.length - 1];
  if (!lastTx.data?.sourceState) {
    return false;
  }

  // Compare predicates - if equal, token is in-transit (sender still owns it)
  // Note: data field can be "" or null interchangeably, so we only compare predicates
  const statePredicate = txfJson.state?.predicate;
  const sourceStatePredicate = lastTx.data.sourceState?.predicate;

  if (!statePredicate || !sourceStatePredicate) {
    return false;
  }

  return statePredicate === sourceStatePredicate;
}

/**
 * Check if TXF has sourceState available for reconstruction
 *
 * @param txfJson Token JSON to check
 * @returns True if state can be reconstructed from transactions
 */
export function hasReconstructableState(txfJson: any): boolean {
  if (!txfJson.transactions || txfJson.transactions.length === 0) {
    return false;
  }

  const lastTx = txfJson.transactions[txfJson.transactions.length - 1];

  // Must have sourceState available for reconstruction
  return !!lastTx.data?.sourceState;
}

/**
 * Serialize TXF for disk storage with optimized format
 *
 * For in-transit tokens:
 * - Sets top-level state to null (reconstructed from sourceState on load)
 * - Nulls commitment.transactionData.sourceState (duplicate of transactions[].data.sourceState)
 *
 * @param txfJson Token JSON to serialize
 * @returns Serialized copy ready for disk storage
 */
export function serializeTxf(txfJson: IExtendedTxfToken): IExtendedTxfToken {
  // Create deep copy to avoid mutating original
  const serialized = JSON.parse(JSON.stringify(txfJson));

  // If token is in-transit, null out duplicated data to save space
  if (isTokenInTransit(serialized)) {
    // Null top-level state (reconstructed from sourceState on load)
    serialized.state = null;

    // Null duplicate sourceState in commitment.transactionData
    // The authoritative copy is in transactions[].data.sourceState
    const lastTx = serialized.transactions[serialized.transactions.length - 1];
    if (lastTx.commitment?.transactionData?.sourceState) {
      lastTx.commitment.transactionData.sourceState = null;
    }
  }

  return serialized;
}

/**
 * Deserialize TXF from disk storage
 *
 * Reconstructs:
 * - Top-level state from transactions[-1].data.sourceState if null
 * - commitment.transactionData.sourceState from transactions[-1].data.sourceState if null
 *
 * @param txfJson Raw token JSON from disk
 * @returns Deserialized token with state reconstructed if needed
 */
export function deserializeTxf(txfJson: any): IExtendedTxfToken {
  // Create deep copy to avoid mutating original
  const deserialized = JSON.parse(JSON.stringify(txfJson));

  // If state is null and we can reconstruct it, do so
  if (deserialized.state === null && hasReconstructableState(deserialized)) {
    const lastTx = deserialized.transactions[deserialized.transactions.length - 1];
    const sourceState = lastTx.data.sourceState;

    // Reconstruct top-level state
    deserialized.state = sourceState;

    // Reconstruct commitment.transactionData.sourceState if present and null
    if (lastTx.commitment?.transactionData && lastTx.commitment.transactionData.sourceState === null) {
      lastTx.commitment.transactionData.sourceState = sourceState;
    }
  }

  return deserialized;
}
