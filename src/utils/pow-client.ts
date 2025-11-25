/**
 * POW Blockchain Client
 *
 * Provides RPC interface to interact with the Unicity POW blockchain
 * for fetching block headers, witness data, and coin origin proofs.
 */

import {
  CoinOriginProof,
  BlockHeader,
  WitnessData
} from '../types/CoinOriginProof.js';
import { createHash } from 'crypto';

/**
 * JSON-RPC request structure
 */
interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params: any[];
  id: number;
}

/**
 * JSON-RPC response structure
 */
interface JsonRpcResponse {
  jsonrpc: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

/**
 * POW blockchain RPC client
 */
export class PoWClient {
  private endpoint: string;
  private requestId: number;

  constructor(endpoint: string) {
    // Normalize endpoint URL
    this.endpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
    this.requestId = 0;
  }

  /**
   * Execute JSON-RPC call to POW blockchain
   */
  private async rpcCall(method: string, params: any[] = []): Promise<any> {
    this.requestId++;

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.requestId,
    };

    try {
      // Use dynamic import for fetch (Node.js 18+)
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }

      const jsonResponse: JsonRpcResponse = await response.json();

      if (jsonResponse.error) {
        throw new Error(
          `RPC error (${jsonResponse.error.code}): ${jsonResponse.error.message}`
        );
      }

      if (jsonResponse.result === undefined) {
        throw new Error('RPC response missing result field');
      }

      return jsonResponse.result;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('ECONNREFUSED')) {
          throw new Error(`Cannot connect to POW node at ${this.endpoint}`);
        }
        if (error.message.includes('ENOTFOUND')) {
          throw new Error(`POW node hostname not found: ${this.endpoint}`);
        }
      }
      throw error;
    }
  }

  /**
   * Fetch block header by height
   */
  async getBlockHeader(height: number): Promise<BlockHeader> {
    if (!Number.isInteger(height) || height < 0) {
      throw new Error(`Invalid block height: ${height}`);
    }

    try {
      const result = await this.rpcCall('getblockheader', [height]);

      // Validate response structure
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid block header response format');
      }

      // Parse and validate block header
      const header: BlockHeader = {
        height: result.height ?? height,
        hash: result.hash,
        merkleRoot: result.merkleroot || result.merkleRoot,
        timestamp: result.time || result.timestamp,
        version: result.version,
        previousBlockHash: result.previousblockhash || result.previousBlockHash,
      };

      // Validate required fields
      if (!header.hash) {
        throw new Error('Block header missing hash field');
      }
      if (!header.merkleRoot) {
        throw new Error('Block header missing merkle root field');
      }
      if (!header.timestamp) {
        throw new Error('Block header missing timestamp field');
      }

      return header;
    } catch (error) {
      throw new Error(
        `Failed to fetch block header at height ${height}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Fetch witness data by block height
   */
  async getWitnessByHeight(height: number): Promise<WitnessData> {
    if (!Number.isInteger(height) || height < 0) {
      throw new Error(`Invalid block height: ${height}`);
    }

    try {
      const result = await this.rpcCall('getwitnessbyheight', [height]);

      return this.parseWitnessData(result);
    } catch (error) {
      throw new Error(
        `Failed to fetch witness data at height ${height}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Fetch witness data by merkle root
   */
  async getWitnessByMerkleRoot(merkleRoot: string): Promise<WitnessData> {
    if (!merkleRoot || merkleRoot.length !== 64) {
      throw new Error('Invalid merkle root: must be 64 hex characters');
    }

    try {
      const result = await this.rpcCall('getwitness', [merkleRoot]);

      return this.parseWitnessData(result);
    } catch (error) {
      throw new Error(
        `Failed to fetch witness data for merkle root ${merkleRoot}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Parse witness data from RPC response
   */
  private parseWitnessData(result: any): WitnessData {
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid witness data response format');
    }

    // Handle nested witness structure: result.witness or result directly
    const witnessObj = result.witness || result;

    if (!witnessObj || typeof witnessObj !== 'object') {
      throw new Error('Invalid witness object format');
    }

    // Map field names (RPC may use different casing)
    const witness: WitnessData = {
      leftControl: witnessObj.leftControl || witnessObj.left_control || witnessObj.leftcontrol,
      rightControl: witnessObj.rightControl || witnessObj.right_control || witnessObj.rightcontrol,
      signature: witnessObj.signature || witnessObj.sig,
      merkleRoot: witnessObj.merkleRoot || witnessObj.merkle_root || witnessObj.merkleroot,
      publicKey: witnessObj.publicKey || witnessObj.public_key || witnessObj.pubkey,
    };

    // Validate required fields
    if (!witness.leftControl) {
      throw new Error('Witness data missing leftControl field');
    }
    if (!witness.rightControl) {
      throw new Error('Witness data missing rightControl (target) field');
    }
    if (!witness.signature) {
      throw new Error('Witness data missing signature field');
    }
    if (!witness.merkleRoot) {
      throw new Error('Witness data missing merkleRoot field');
    }

    return witness;
  }

  /**
   * Fetch complete coin origin proof for a given block height
   */
  async fetchCoinOriginProof(blockHeight: number, tokenId?: string): Promise<CoinOriginProof> {
    try {
      // Fetch block header and witness data in parallel
      const [blockHeader, witnessData] = await Promise.all([
        this.getBlockHeader(blockHeight),
        this.getWitnessByHeight(blockHeight),
      ]);

      // Verify merkle roots match
      if (blockHeader.merkleRoot !== witnessData.merkleRoot) {
        throw new Error(
          `Merkle root mismatch: block header has ${blockHeader.merkleRoot}, ` +
          `witness has ${witnessData.merkleRoot}`
        );
      }

      // Extract or derive token ID
      let derivedTokenId = tokenId;
      if (!derivedTokenId) {
        // If not provided, try to extract from witness data
        // The rightControl in witness is the target (SHA256 of tokenId)
        // We cannot reverse SHA256, so tokenId must be provided or looked up
        throw new Error(
          'Token ID must be provided (cannot be derived from proof data)'
        );
      }

      // Validate token ID format (must be 64 hex chars)
      if (!/^[0-9a-fA-F]{64}$/.test(derivedTokenId)) {
        throw new Error(
          `Invalid token ID format: must be 64 hex characters (got ${derivedTokenId})`
        );
      }

      // Verify target matches tokenId
      const computedTarget = createHash('sha256')
        .update(Buffer.from(derivedTokenId, 'hex'))
        .digest('hex');

      if (computedTarget.toLowerCase() !== witnessData.rightControl.toLowerCase()) {
        throw new Error(
          `Target mismatch: computed ${computedTarget}, witness has ${witnessData.rightControl}`
        );
      }

      // Construct minimal coin origin proof (only blockHeight)
      // All other data can be fetched from POW blockchain later
      const proof: CoinOriginProof = {
        version: '1.0',
        blockHeight: blockHeader.height,
      };

      return proof;
    } catch (error) {
      throw new Error(
        `Failed to fetch coin origin proof for block ${blockHeight}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Verify that a token ID was properly mined in a specific block
   *
   * Performs comprehensive cryptographic verification (4 checks):
   * 1. Target matches SHA256(tokenId)
   * 2. Witness contains target in rightControl
   * 3. MerkleRoot matches block header
   * 4. Witness composition correct: SHA256(leftControl || rightControl) = merkleRoot
   *
   * @param tokenId - Token ID (64 hex chars)
   * @param blockHeight - Block height to verify
   * @returns Verification result with proof data or error
   */
  async verifyTokenIdInBlock(
    tokenId: string,
    blockHeight: number
  ): Promise<{
    valid: boolean;
    error?: string;
    tokenId?: string;
    blockHeight?: number;
    blockHash?: string;
    merkleRoot?: string;
    target?: string;
    blockTimestamp?: number;
    leftControl?: string;
    signature?: string;
    publicKey?: string;
  }> {
    try {
      // Fetch block header and witness data
      const [blockHeader, witnessData] = await Promise.all([
        this.getBlockHeader(blockHeight),
        this.getWitnessByHeight(blockHeight),
      ]);

      // CHECK 1: Verify target matches SHA256(tokenId)
      // IMPORTANT: Hash tokenId as binary (32 bytes), not as string (64 chars)
      // TokenId is a 256-bit value - we hash the binary representation
      const computedTarget = createHash('sha256')
        .update(Buffer.from(tokenId, 'hex'))
        .digest('hex');

      if (computedTarget.toLowerCase() !== witnessData.rightControl.toLowerCase()) {
        return {
          valid: false,
          error: `Token ID mismatch: The provided token ID was not mined in block ${blockHeight}\n` +
                 `  Provided Token ID:  ${tokenId}\n` +
                 `  Computed Target:    ${computedTarget}\n` +
                 `  Block's Target:     ${witnessData.rightControl}\n` +
                 `  \n` +
                 `  This means either:\n` +
                 `  • Wrong token ID provided (check your pre-mine file)\n` +
                 `  • Wrong block height (check tokenid-registry.txt)\n` +
                 `  • Token ID was never mined in this block`,
        };
      }

      // CHECK 2: Verify witness contains target (already verified in CHECK 1)
      // rightControl in witness IS the target

      // CHECK 3: Verify merkleRoot matches between witness and block header
      if (witnessData.merkleRoot.toLowerCase() !== blockHeader.merkleRoot.toLowerCase()) {
        return {
          valid: false,
          error: `Merkle root mismatch: witness (${witnessData.merkleRoot}) != block header (${blockHeader.merkleRoot})`,
        };
      }

      // CHECK 4: Verify witness composition - SHA256(leftControl || rightControl) = merkleRoot
      const computedMerkleRoot = createHash('sha256')
        .update(
          Buffer.concat([
            Buffer.from(witnessData.leftControl, 'hex'),
            Buffer.from(witnessData.rightControl, 'hex'),
          ])
        )
        .digest('hex');

      if (computedMerkleRoot.toLowerCase() !== blockHeader.merkleRoot.toLowerCase()) {
        return {
          valid: false,
          error: `Witness composition invalid: SHA256(leftControl || rightControl) (${computedMerkleRoot}) != merkleRoot (${blockHeader.merkleRoot})`,
        };
      }

      // All checks passed - return verified proof data
      return {
        valid: true,
        tokenId,
        blockHeight: blockHeader.height,
        blockHash: blockHeader.hash,
        merkleRoot: blockHeader.merkleRoot,
        target: witnessData.rightControl,
        blockTimestamp: blockHeader.timestamp,
        leftControl: witnessData.leftControl,
        signature: witnessData.signature,
        publicKey: witnessData.publicKey,
      };
    } catch (error) {
      return {
        valid: false,
        error: `Verification failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Verify POW node connectivity
   */
  async checkConnection(): Promise<boolean> {
    try {
      // Try to fetch block 0 (genesis block)
      await this.getBlockHeader(0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get POW blockchain info (for diagnostics)
   */
  async getBlockchainInfo(): Promise<any> {
    try {
      return await this.rpcCall('getblockchaininfo', []);
    } catch (error) {
      // Method may not exist, return basic info
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Create POW client with endpoint resolution
 */
export function createPoWClient(options: {
  endpoint?: string;
  useLocal?: boolean;
}): PoWClient {
  let endpoint: string;

  if (options.useLocal) {
    // Default local endpoint for dev-chain (regtest mode)
    endpoint = 'http://localhost:8332';
  } else if (options.endpoint) {
    endpoint = options.endpoint;
  } else {
    throw new Error('POW endpoint required: specify --unct-url or --local-unct');
  }

  return new PoWClient(endpoint);
}
