/**
 * Multi-Token TXF Format Utilities
 *
 * TXF files can contain multiple tokens, each identified by a key starting with '_'
 * followed by the full tokenId. Example:
 * {
 *   "_57950027a0d7fb36d683f2dcc47dde1f7a64db38522130463237f2ffb5bafe05": { ... token data ... },
 *   "_fe14106806d0d9ea92a0f6f1c010b0b02765cb4f...": { ... token data ... }
 * }
 */

import * as fs from 'fs';
import { IExtendedTxfToken } from '../types/extended-txf.js';

/**
 * Multi-token TXF file structure
 * Keys are `_${tokenId}` where tokenId is the full token ID
 */
export interface IMultiTokenTxf {
  [key: `_${string}`]: IExtendedTxfToken;
}

/**
 * Result of reading a token from TXF file
 */
export interface ReadTokenResult {
  token: IExtendedTxfToken;
  tokenId: string;
}

/**
 * Truncate token ID for display
 */
function truncateId(id: string, maxLen: number = 16): string {
  if (id.length <= maxLen) return id;
  return id.substring(0, maxLen) + '...';
}

/**
 * Extract token keys from parsed TXF JSON
 * Returns array of keys that start with '_'
 */
function getTokenKeys(txfJson: Record<string, unknown>): string[] {
  return Object.keys(txfJson).filter(key => key.startsWith('_'));
}

/**
 * Extract token ID from key (removes leading '_')
 */
function keyToTokenId(key: string): string {
  return key.substring(1);
}

/**
 * Convert token ID to key (adds leading '_')
 */
function tokenIdToKey(tokenId: string): `_${string}` {
  return `_${tokenId}` as `_${string}`;
}

/**
 * Parse TXF file content and return the parsed JSON
 */
function parseTxfFile(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`TXF file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`Invalid JSON in TXF file: ${filePath}`);
  }
}

/**
 * Read a token from a TXF file
 *
 * @param filePath Path to the TXF file
 * @param selectId Optional token ID to select (required if multiple tokens exist)
 * @returns The token data and its ID
 * @throws Error if file not found, invalid JSON, no tokens, or token not found
 */
export function readTokenFromTxf(filePath: string, selectId?: string): ReadTokenResult {
  const txfJson = parseTxfFile(filePath);
  const tokenKeys = getTokenKeys(txfJson);

  if (tokenKeys.length === 0) {
    throw new Error('TXF file contains no tokens');
  }

  if (tokenKeys.length === 1) {
    // Single token - return it regardless of selectId
    const key = tokenKeys[0];
    return {
      token: txfJson[key] as IExtendedTxfToken,
      tokenId: keyToTokenId(key)
    };
  }

  // Multiple tokens - require selection
  if (!selectId) {
    const availableIds = tokenKeys.map(k => truncateId(keyToTokenId(k))).join(', ');
    throw new Error(
      `Multiple tokens found. Use --select <tokenId> to specify which token.\n` +
      `Available tokens: ${availableIds}`
    );
  }

  // Find token by ID
  const key = tokenIdToKey(selectId);
  if (!(key in txfJson)) {
    const availableIds = tokenKeys.map(k => truncateId(keyToTokenId(k))).join(', ');
    throw new Error(
      `Token '${truncateId(selectId)}' not found in TXF file.\n` +
      `Available tokens: ${availableIds}`
    );
  }

  return {
    token: txfJson[key] as IExtendedTxfToken,
    tokenId: selectId
  };
}

/**
 * Write a token to a TXF file
 *
 * If the file doesn't exist, creates a new file with the single token.
 * If the file exists, adds the token (or replaces if token ID already exists).
 *
 * @param filePath Path to the TXF file
 * @param token The token data to write
 * @param tokenId The token ID (used as key: _tokenId)
 */
export function writeTokenToTxf(filePath: string, token: IExtendedTxfToken, tokenId: string): void {
  let txfJson: IMultiTokenTxf;

  if (fs.existsSync(filePath)) {
    // File exists - read and merge
    const existing = parseTxfFile(filePath);
    txfJson = existing as IMultiTokenTxf;
  } else {
    // New file
    txfJson = {} as IMultiTokenTxf;
  }

  // Add or replace token
  const key = tokenIdToKey(tokenId);
  txfJson[key] = token;

  // Write back
  fs.writeFileSync(filePath, JSON.stringify(txfJson, null, 2), 'utf-8');
}

/**
 * List all token IDs in a TXF file
 *
 * @param filePath Path to the TXF file
 * @returns Array of token IDs
 */
export function listTokenIds(filePath: string): string[] {
  const txfJson = parseTxfFile(filePath);
  const tokenKeys = getTokenKeys(txfJson);
  return tokenKeys.map(keyToTokenId);
}

/**
 * Read all tokens from a TXF file
 *
 * @param filePath Path to the TXF file
 * @returns Map of tokenId -> token data
 */
export function readAllTokens(filePath: string): Map<string, IExtendedTxfToken> {
  const txfJson = parseTxfFile(filePath);
  const tokenKeys = getTokenKeys(txfJson);
  const result = new Map<string, IExtendedTxfToken>();

  for (const key of tokenKeys) {
    result.set(keyToTokenId(key), txfJson[key] as IExtendedTxfToken);
  }

  return result;
}

/**
 * Check if a TXF file has multiple tokens (requires --select)
 *
 * @param filePath Path to the TXF file
 * @returns true if file has more than one token
 */
export function requiresSelection(filePath: string): boolean {
  const txfJson = parseTxfFile(filePath);
  const tokenKeys = getTokenKeys(txfJson);
  return tokenKeys.length > 1;
}

/**
 * Get token count in a TXF file
 *
 * @param filePath Path to the TXF file
 * @returns Number of tokens in the file
 */
export function getTokenCount(filePath: string): number {
  const txfJson = parseTxfFile(filePath);
  return getTokenKeys(txfJson).length;
}
