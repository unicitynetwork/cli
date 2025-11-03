import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { StateTransitionClient } from '@unicitylabs/state-transition-sdk/lib/StateTransitionClient.js';
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import { InclusionProofVerificationStatus } from '@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.js';
import { CborDecoder } from '@unicitylabs/commons/lib/cbor/CborDecoder.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';

export interface OwnerInfo {
  publicKey: Uint8Array;
  publicKeyHex: string;
  address: string | null;
  engineId: number;
}

export interface OwnershipStatus {
  scenario: 'current' | 'outdated' | 'pending' | 'confirmed' | 'error';
  onChainSpent: boolean | null;
  currentOwner: string | null;
  latestKnownOwner: string | null;
  pendingRecipient: string | null;
  message: string;
  details: string[];
}

/**
 * Extract owner information from predicate
 */
export function extractOwnerInfo(predicateHex: string): OwnerInfo | null {
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

    // Note: Address derivation is done separately using token.state.predicate
    return {
      publicKey,
      publicKeyHex,
      address: null,  // Will be populated by caller
      engineId: engineIdNum
    };
  } catch (err) {
    return null;
  }
}

/**
 * Check ownership status by querying aggregator
 */
export async function checkOwnershipStatus(
  token: Token<any>,
  tokenJson: any,
  client: StateTransitionClient,
  trustBase: RootTrustBase
): Promise<OwnershipStatus> {
  try {
    // Extract owner information from current state predicate
    const ownerInfo = extractOwnerInfo(tokenJson.state?.predicate);

    if (!ownerInfo) {
      return {
        scenario: 'error',
        onChainSpent: null,
        currentOwner: null,
        latestKnownOwner: null,
        pendingRecipient: null,
        message: 'Cannot extract owner information from predicate',
        details: ['Predicate format invalid or missing']
      };
    }

    // Get the address that corresponds to the current state predicate
    // The state predicate's public key tells us who owns it according to this TXF file
    // We need to find which address this corresponds to

    // Strategy: Check if the public key in the state matches any known transaction
    if (tokenJson.transactions && tokenJson.transactions.length > 0) {
      // Check if state's public key matches the last transaction's recipient
      // This would be the case after receive-token updates the state
      const lastTx = tokenJson.transactions[tokenJson.transactions.length - 1];
      ownerInfo.address = lastTx?.data?.recipient || null;
    } else if (tokenJson.genesis?.data?.recipient) {
      // No transactions yet, so current owner is the genesis recipient
      ownerInfo.address = tokenJson.genesis.data.recipient;
    }

    // Fallback if no address found
    if (!ownerInfo.address) {
      ownerInfo.address = `Owner:${ownerInfo.publicKeyHex.substring(0, 16)}...`;
    }

    // Query aggregator for token status
    let onChainSpent: boolean;
    try {
      const status = await client.getTokenStatus(trustBase, token, ownerInfo.publicKey);

      // PATH_NOT_INCLUDED means the RequestId is not in the SMT = state is UNSPENT
      // OK means the RequestId is in the SMT = state is SPENT
      onChainSpent = status === InclusionProofVerificationStatus.OK;
    } catch (err) {
      // Network error or aggregator unavailable
      return {
        scenario: 'error',
        onChainSpent: null,
        currentOwner: ownerInfo.address,
        latestKnownOwner: ownerInfo.address,
        pendingRecipient: null,
        message: 'Cannot verify ownership status - network unavailable',
        details: [
          `Local TXF shows owner: ${ownerInfo.address || 'Unknown'}`,
          `Error: ${err instanceof Error ? err.message : String(err)}`
        ]
      };
    }

    // Analyze local TXF state
    const hasPendingTransfer = !!tokenJson.offlineTransfer;
    const hasTransactions = tokenJson.transactions && tokenJson.transactions.length > 0;
    const status = tokenJson.status;

    // Determine scenario
    return determineScenario({
      onChainSpent,
      hasPendingTransfer,
      hasTransactions,
      status,
      ownerInfo,
      tokenJson
    });

  } catch (err) {
    return {
      scenario: 'error',
      onChainSpent: null,
      currentOwner: null,
      latestKnownOwner: null,
      pendingRecipient: null,
      message: 'Error checking ownership status',
      details: [`Error: ${err instanceof Error ? err.message : String(err)}`]
    };
  }
}

/**
 * Determine ownership scenario based on on-chain and local state
 */
function determineScenario(context: {
  onChainSpent: boolean;
  hasPendingTransfer: boolean;
  hasTransactions: boolean;
  status: string;
  ownerInfo: OwnerInfo;
  tokenJson: any;
}): OwnershipStatus {
  const { onChainSpent, hasPendingTransfer, hasTransactions, status, ownerInfo, tokenJson } = context;
  const currentStateOwner = ownerInfo.address || 'Unknown';

  // Scenario A: Current (Up-to-Date)
  // State not spent + No pending transfers
  if (!onChainSpent && !hasPendingTransfer) {
    return {
      scenario: 'current',
      onChainSpent: false,
      currentOwner: currentStateOwner,
      latestKnownOwner: currentStateOwner,
      pendingRecipient: null,
      message: '✅ Token is current and ready to use',
      details: [
        `Current Owner: ${currentStateOwner}`,
        'On-chain status: UNSPENT',
        'No pending transfers'
      ]
    };
  }

  // Scenario B: Outdated (Spent Elsewhere)
  // State spent + No matching transaction in TXF
  if (onChainSpent && !hasTransactions && !hasPendingTransfer) {
    return {
      scenario: 'outdated',
      onChainSpent: true,
      currentOwner: 'Unknown (transferred elsewhere)',
      latestKnownOwner: currentStateOwner,
      pendingRecipient: null,
      message: '⚠️  Token state is outdated - transferred from another device',
      details: [
        `Latest Known Owner (from this file): ${currentStateOwner}`,
        'On-chain status: SPENT',
        'Current owner: Unknown (no transaction in this TXF)',
        'This TXF file is out of sync with the blockchain'
      ]
    };
  }

  // Scenario C: Pending Transfer
  // State not spent + Has offlineTransfer
  if (!onChainSpent && hasPendingTransfer) {
    const pendingRecipient = tokenJson.offlineTransfer?.recipient || 'Unknown';
    return {
      scenario: 'pending',
      onChainSpent: false,
      currentOwner: currentStateOwner,
      latestKnownOwner: currentStateOwner,
      pendingRecipient,
      message: '⏳ Pending transfer - not yet submitted to network',
      details: [
        `Current Owner (on-chain): ${currentStateOwner}`,
        'On-chain status: UNSPENT',
        `Pending Transfer To: ${pendingRecipient}`,
        'Transfer package created but recipient has not submitted it yet'
      ]
    };
  }

  // Scenario D: Confirmed Transfer
  // State spent + Has matching transaction
  if (onChainSpent && hasTransactions) {
    const lastTx = tokenJson.transactions[tokenJson.transactions.length - 1];
    const newOwner = lastTx?.data?.recipient || 'Unknown';

    // Determine previous owner
    let previousOwner: string;
    if (tokenJson.transactions.length === 1) {
      // First transfer - previous owner is genesis recipient
      previousOwner = tokenJson.genesis?.data?.recipient || 'Unknown';
    } else {
      // Multiple transfers - previous owner is second-to-last transaction's recipient
      const secondToLastTx = tokenJson.transactions[tokenJson.transactions.length - 2];
      previousOwner = secondToLastTx?.data?.recipient || 'Unknown';
    }

    return {
      scenario: 'confirmed',
      onChainSpent: true,
      currentOwner: newOwner,
      latestKnownOwner: newOwner,
      pendingRecipient: null,
      message: '✅ Transfer confirmed on-chain',
      details: [
        `Previous Owner: ${previousOwner}`,
        `Current Owner: ${newOwner}`,
        'On-chain status: SPENT',
        `Transfer recorded in TXF (${tokenJson.transactions.length} transaction${tokenJson.transactions.length !== 1 ? 's' : ''})`
      ]
    };
  }

  // Edge case: State spent + Has pending transfer (shouldn't happen normally)
  if (onChainSpent && hasPendingTransfer) {
    const pendingRecipient = tokenJson.offlineTransfer?.recipient || 'Unknown';
    return {
      scenario: 'confirmed',
      onChainSpent: true,
      currentOwner: pendingRecipient,
      latestKnownOwner: pendingRecipient,
      pendingRecipient: null,
      message: '✅ Transfer confirmed (pending transfer was submitted)',
      details: [
        `Previous Owner: ${currentStateOwner}`,
        `Current Owner: ${pendingRecipient}`,
        'On-chain status: SPENT',
        'The pending transfer was successfully submitted to the network'
      ]
    };
  }

  // Unknown scenario
  return {
    scenario: 'error',
    onChainSpent,
    currentOwner: currentStateOwner,
    latestKnownOwner: currentStateOwner,
    pendingRecipient: null,
    message: 'Unknown ownership status',
    details: [
      `On-chain spent: ${onChainSpent}`,
      `Has pending transfer: ${hasPendingTransfer}`,
      `Has transactions: ${hasTransactions}`,
      `Status: ${status}`
    ]
  };
}
