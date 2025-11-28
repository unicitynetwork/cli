/**
 * Output formatting utilities for CLI commands
 * Provides concise, human-readable output for mint-token, send-token, and receive-token
 */

import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import { CborDecoder } from '@unicitylabs/commons/lib/cbor/CborDecoder.js';

// Engine IDs for predicate types
const ENGINE_UNMASKED = 1;
const ENGINE_MASKED = 5;

// Token type hash to name mapping
const TOKEN_TYPES: Record<string, string> = {
  'f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509': 'NFT',
  '455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89': 'UCT',
  '8f0f3d7a5e7297be0ee98c63b81bcebb2740f43f616566fc290f9823a54f52d7': 'USDU',
  '5e160d5e9fdbb03b553fb9c3f6e6c30efa41fa807be39fb4f18e43776e492925': 'EURU'
};

/**
 * Information about a decoded predicate
 */
export interface PredicateInfo {
  algorithm: string;
  type: 'unmasked' | 'masked';
  publicKey: string;
}

/**
 * Summary of token for display
 */
export interface TokenSummary {
  tokenId: string;
  tokenType: string;
  tokenTypeName: string;
  data?: string;
  owner?: string;
  predicate?: PredicateInfo;
  stateData?: string;
  status: string;
  proofStatus?: string;
  savedTo?: string;
  mode?: 'ONLINE' | 'OFFLINE';
  recipient?: string;
  recipientDataHash?: string | null;
}

/**
 * Truncate a string with ellipsis
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}

/**
 * Decode CBOR predicate to human-readable form
 */
export function decodePredicate(predicateHex: string): PredicateInfo | null {
  if (!predicateHex || predicateHex.length === 0) {
    return null;
  }

  try {
    const predicateBytes = HexConverter.decode(predicateHex);
    const predicateArray = CborDecoder.readArray(predicateBytes);

    if (predicateArray.length !== 3) {
      return null;
    }

    // Element 0: Engine ID
    const engineIdBytes = predicateArray[0];
    const engineId = engineIdBytes.length === 1 ? engineIdBytes[0] :
                     CborDecoder.readUnsignedInteger(engineIdBytes);
    const engineIdNum = typeof engineId === 'bigint' ? Number(engineId) : engineId;

    // Element 2: Parameters
    const paramsBytes = CborDecoder.readByteString(predicateArray[2]);
    const paramsArray = CborDecoder.readArray(paramsBytes);

    if (paramsArray.length < 3) {
      return null;
    }

    // Element [2] in params is the public key
    const publicKey = CborDecoder.readByteString(paramsArray[2]);
    const publicKeyHex = HexConverter.encode(publicKey);

    return {
      algorithm: 'secp256k1',
      type: engineIdNum === ENGINE_MASKED ? 'masked' : 'unmasked',
      publicKey: truncate(publicKeyHex, 16)
    };
  } catch (err) {
    return null;
  }
}

/**
 * Decode token data from bytes to string
 * Handles CBOR, JSON, and raw text
 */
export function decodeTokenData(dataBytes: Uint8Array | string | null | undefined): string {
  if (!dataBytes) return '(empty)';

  let bytes: Uint8Array;
  if (typeof dataBytes === 'string') {
    // Hex string
    try {
      bytes = HexConverter.decode(dataBytes);
    } catch {
      // Not hex, treat as plain text
      return truncate(dataBytes, 120);
    }
  } else {
    bytes = dataBytes;
  }

  if (bytes.length === 0) return '(empty)';

  // Try to decode as UTF-8 text
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // If it's valid JSON, format it
    try {
      JSON.parse(text);
      return truncate(text, 120);
    } catch {
      // Not JSON, return as text
      return truncate(text, 120);
    }
  } catch {
    // Not valid UTF-8, show as hex
    return truncate(HexConverter.encode(bytes), 40) + ' (hex)';
  }
}

/**
 * Get token type name from hash
 */
export function getTokenTypeName(typeHash: string): string {
  return TOKEN_TYPES[typeHash] || 'CUSTOM';
}

/**
 * Format predicate for display
 */
export function formatPredicate(predicate: PredicateInfo | null): string {
  if (!predicate) return '(unknown)';
  return `${predicate.algorithm} ${predicate.type} (pubkey: ${predicate.publicKey})`;
}

/**
 * Count transactions with complete proofs (including genesis)
 */
export function countProofs(tokenJson: any): { with: number; total: number } {
  const transactions = tokenJson.transactions || [];

  // Check if genesis has a complete proof
  const genesisHasProof = tokenJson.genesis?.inclusionProof?.authenticator &&
                          tokenJson.genesis?.inclusionProof?.transactionHash;

  // Count transactions with complete proofs
  const txWithProofs = transactions.filter((tx: any) =>
    tx.inclusionProof &&
    tx.inclusionProof.authenticator &&
    tx.inclusionProof.transactionHash
  ).length;

  // Total includes genesis (1) + all transactions
  const total = 1 + transactions.length;
  const withProofs = (genesisHasProof ? 1 : 0) + txWithProofs;

  return { with: withProofs, total };
}

/**
 * Format mint-token output
 */
export function formatMintOutput(tokenJson: any, outputFile?: string): string {
  const tokenId = tokenJson.genesis?.data?.tokenId || '(unknown)';
  const tokenTypeHash = tokenJson.genesis?.data?.tokenType || '';
  const tokenTypeName = getTokenTypeName(tokenTypeHash);
  const tokenData = tokenJson.genesis?.data?.tokenData;
  const recipient = tokenJson.genesis?.data?.recipient || '(unknown)';
  const predicate = decodePredicate(tokenJson.state?.predicate);

  const lines = [
    `Minted ${tokenTypeName} token`,
    `  Token ID:  ${truncate(tokenId, 48)}`,
    `  Type:      ${tokenTypeName} (${truncate(tokenTypeHash, 8)})`,
    `  Data:      ${decodeTokenData(tokenData)}`,
    `  Owner:     ${truncate(recipient, 48)}`,
    `  Predicate: ${formatPredicate(predicate)}`,
    `  Status:    CONFIRMED (proof received)`
  ];

  if (outputFile) {
    lines.push(`  Saved to:  ${outputFile}`);
  }

  return lines.join('\n');
}

/**
 * Format send-token output
 */
export function formatSendOutput(
  tokenJson: any,
  recipient: string,
  mode: 'online' | 'offline',
  recipientDataHash: string | null,
  outputFile?: string
): string {
  const tokenId = tokenJson.genesis?.data?.tokenId || '(unknown)';
  const tokenTypeHash = tokenJson.genesis?.data?.tokenType || '';
  const tokenTypeName = getTokenTypeName(tokenTypeHash);
  const predicate = decodePredicate(tokenJson.state?.predicate);
  const stateData = tokenJson.state?.data;

  const modeUpper = mode.toUpperCase();
  const statusLabel = mode === 'online' ? 'TRANSFERRED' : 'PENDING';
  const modeDescription = mode === 'online' ? '(confirmed)' : '(uncommitted)';

  const lines = [
    `Transferred token [${modeUpper}]`,
    `  Token ID:  ${truncate(tokenId, 48)}`,
    `  Type:      ${tokenTypeName} (${truncate(tokenTypeHash, 8)})`,
    `  From:      ${formatPredicate(predicate)}`,
    `  To:        ${truncate(recipient, 48)}`,
    `  Data Hash: ${recipientDataHash ? truncate(recipientDataHash, 48) : 'none'}`,
    `  Mode:      ${modeUpper} ${modeDescription}`,
    `  Status:    ${statusLabel}`
  ];

  if (outputFile) {
    lines.push(`  Saved to:  ${outputFile}`);
  }

  return lines.join('\n');
}

/**
 * Format receive-token output
 */
export function formatReceiveOutput(tokenJson: any, outputFile?: string): string {
  const tokenId = tokenJson.genesis?.data?.tokenId || '(unknown)';
  const tokenTypeHash = tokenJson.genesis?.data?.tokenType || '';
  const tokenTypeName = getTokenTypeName(tokenTypeHash);
  const tokenData = tokenJson.genesis?.data?.tokenData;
  const predicate = decodePredicate(tokenJson.state?.predicate);
  const stateData = tokenJson.state?.data;
  const proofCount = countProofs(tokenJson);
  const status = tokenJson.status || 'CONFIRMED';

  const lines = [
    `Received token`,
    `  Token ID:  ${truncate(tokenId, 48)}`,
    `  Type:      ${tokenTypeName} (${truncate(tokenTypeHash, 8)})`,
    `  Data:      ${decodeTokenData(tokenData)}`,
    `  Owner:     ${formatPredicate(predicate)}`,
    `  State:     ${decodeTokenData(stateData)}`,
    `  Proofs:    ${proofCount.with}/${proofCount.total} transactions have unicity proofs`,
    `  Status:    ${status}`
  ];

  if (outputFile) {
    lines.push(`  Saved to:  ${outputFile}`);
  }

  return lines.join('\n');
}
