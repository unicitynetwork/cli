#!/usr/bin/env tsx
/**
 * Aggregator Proof Response Analysis Test
 *
 * This script tests the complete lifecycle of proof retrieval:
 * 1. Creates a proper commitment using SDK classes
 * 2. Submits commitment to the aggregator
 * 3. Tests immediate fetch (should fail - not in tree yet)
 * 4. Polls until proof is available
 * 5. Logs complete JSON response structure
 * 6. Validates all expected fields are present
 * 7. Verifies proof structure matches SDK expectations
 *
 * Usage:
 *   npm run test:aggregator-proof
 */

import { AggregatorClient } from '@unicitylabs/state-transition-sdk/lib/api/AggregatorClient.js';
import { RequestId } from '@unicitylabs/state-transition-sdk/lib/api/RequestId.js';
import { Authenticator } from '@unicitylabs/state-transition-sdk/lib/api/Authenticator.js';
import { DataHash } from '@unicitylabs/state-transition-sdk/lib/hash/DataHash.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { loadTrustBase } from '../../src/utils/trustbase-loader.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import { JsonRpcNetworkError } from '@unicitylabs/state-transition-sdk/lib/api/json-rpc/JsonRpcNetworkError.js';
import { InclusionProofVerificationStatus } from '@unicitylabs/state-transition-sdk/lib/transaction/InclusionProof.js';

interface TestResult {
  phase: string;
  success: boolean;
  timestamp: string;
  data?: any;
  error?: string;
}

const results: TestResult[] = [];

function logResult(phase: string, success: boolean, data?: any, error?: string): void {
  const result: TestResult = {
    phase,
    success,
    timestamp: new Date().toISOString(),
    data,
    error
  };
  results.push(result);

  const status = success ? '✓' : '✗';
  console.log(`\n${status} ${phase}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
  if (error) {
    console.error(`Error: ${error}`);
  }
}

async function testAggregatorProofResponse(): Promise<void> {
  console.log('='.repeat(80));
  console.log('AGGREGATOR PROOF RESPONSE ANALYSIS TEST');
  console.log('='.repeat(80));

  // Phase 1: Setup
  console.log('\n📋 Phase 1: Setup and Configuration');
  console.log('-'.repeat(80));

  let trustBase;
  let aggregatorUrl;

  try {
    trustBase = await loadTrustBase();
    aggregatorUrl = process.env.AGGREGATOR_URL || 'http://127.0.0.1:3000';

    logResult('Load TrustBase', true, {
      networkId: trustBase.networkId,
      rootNodeCount: trustBase.rootNodes.length,
      aggregatorUrl
    });
  } catch (error) {
    logResult('Load TrustBase', false, null, error instanceof Error ? error.message : String(error));
    return;
  }

  const client = new AggregatorClient(aggregatorUrl);

  // Phase 2: Generate Test Data
  console.log('\n📋 Phase 2: Generate Test Data (SDK-Compatible)');
  console.log('-'.repeat(80));

  let signingService: SigningService;
  let stateHash: DataHash;
  let transactionHash: DataHash;
  let requestId: RequestId;
  let authenticator: Authenticator;

  try {
    // Generate random test secret
    const testSecret = new Uint8Array(32);
    crypto.getRandomValues(testSecret);

    // Create signing service
    signingService = await SigningService.createFromSecret(testSecret);

    // Create fake state hash (hash some random data)
    const randomData = new Uint8Array(64);
    crypto.getRandomValues(randomData);
    stateHash = await new DataHasher(HashAlgorithm.SHA256).update(randomData).digest();

    // Create fake transaction hash
    const randomTxData = new Uint8Array(64);
    crypto.getRandomValues(randomTxData);
    transactionHash = await new DataHasher(HashAlgorithm.SHA256).update(randomTxData).digest();

    // Create RequestId = hash(publicKey + stateHash)
    requestId = await RequestId.create(signingService.publicKey, stateHash);

    // Create Authenticator = sign(transactionHash) with stateHash
    authenticator = await Authenticator.create(signingService, transactionHash, stateHash);

    logResult('Generate Test Data', true, {
      publicKey: HexConverter.encode(signingService.publicKey),
      stateHash: stateHash.toJSON(),
      transactionHash: transactionHash.toJSON(),
      requestId: requestId.toJSON(),
      requestIdLength: requestId.toJSON().length,
      authenticatorPresent: authenticator !== null
    });
  } catch (error) {
    logResult('Generate Test Data', false, null, error instanceof Error ? error.message : String(error));
    return;
  }

  // Phase 3: Submit Commitment
  console.log('\n📋 Phase 3: Submit Commitment to Aggregator');
  console.log('-'.repeat(80));

  try {
    const result = await client.submitCommitment(requestId, transactionHash, authenticator);

    logResult('Submit Commitment', result.status === 'SUCCESS', {
      status: result.status,
      requestId: requestId.toJSON(),
      transactionHash: transactionHash.toJSON()
    });

    if (result.status !== 'SUCCESS') {
      console.error('Failed to submit commitment, aborting test');
      return;
    }
  } catch (error) {
    logResult('Submit Commitment', false, null, error instanceof Error ? error.message : String(error));
    return;
  }

  // Phase 4: Immediate Fetch Test (Should Fail)
  console.log('\n📋 Phase 4: Immediate Proof Fetch (Expected to Fail)');
  console.log('-'.repeat(80));

  try {
    const immediateProof = await client.getInclusionProof(requestId);
    logResult('Immediate Fetch', false, immediateProof, 'Expected 404, but received proof immediately');
  } catch (error) {
    if (error instanceof JsonRpcNetworkError && error.status === 404) {
      logResult('Immediate Fetch (Expected 404)', true, {
        status: error.status,
        message: error.message,
        behavior: 'Correct - proof not in tree yet'
      });
    } else {
      logResult('Immediate Fetch', false, null, error instanceof Error ? error.message : String(error));
    }
  }

  // Phase 5: Poll for Proof
  console.log('\n📋 Phase 5: Poll for Inclusion Proof');
  console.log('-'.repeat(80));
  console.log('Polling every 2 seconds (max 60 seconds)...');

  let proof: any = null;
  let attempts = 0;
  const maxAttempts = 30; // 60 seconds total

  while (attempts < maxAttempts && !proof) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      proof = await client.getInclusionProof(requestId);
      logResult(`Polling Attempt ${attempts}`, true, {
        message: 'Proof retrieved successfully',
        elapsedSeconds: attempts * 2
      });
    } catch (error) {
      if (error instanceof JsonRpcNetworkError && error.status === 404) {
        process.stdout.write('.');
      } else {
        logResult(`Polling Attempt ${attempts}`, false, null, error instanceof Error ? error.message : String(error));
        return;
      }
    }
  }

  console.log(''); // New line after dots

  if (!proof) {
    logResult('Poll for Proof', false, null, `Timeout after ${maxAttempts * 2} seconds`);
    return;
  }

  // Phase 6: Analyze Proof Structure
  console.log('\n📋 Phase 6: Analyze Proof Structure');
  console.log('-'.repeat(80));

  const proofStructure = {
    proofType: typeof proof,
    proofConstructor: proof.constructor.name,
    hasAuthenticator: 'authenticator' in proof,
    hasMerkleTreePath: 'merkleTreePath' in proof,
    hasTransactionHash: 'transactionHash' in proof,
    hasUnicityCertificate: 'unicityCertificate' in proof,
    hasVerifyMethod: typeof proof.verify === 'function',
    authenticatorType: proof.authenticator ? typeof proof.authenticator : 'undefined',
    merkleTreePathType: proof.merkleTreePath ? typeof proof.merkleTreePath : 'undefined',
    transactionHashType: proof.transactionHash ? typeof proof.transactionHash : 'undefined',
    unicityCertificateType: proof.unicityCertificate ? typeof proof.unicityCertificate : 'undefined'
  };

  logResult('Proof Structure Analysis', true, proofStructure);

  // Phase 7: Detailed Field Inspection
  console.log('\n📋 Phase 7: Detailed Field Inspection');
  console.log('-'.repeat(80));

  const detailedInspection: any = {};

  if (proof.authenticator) {
    detailedInspection.authenticator = {
      type: proof.authenticator.constructor.name,
      hasPublicKey: 'publicKey' in proof.authenticator,
      hasSignature: 'signature' in proof.authenticator,
      hasStateHash: 'stateHash' in proof.authenticator,
      publicKeyLength: proof.authenticator.publicKey?.length || 'N/A',
      publicKeyHex: proof.authenticator.publicKey ? HexConverter.encode(proof.authenticator.publicKey).slice(0, 20) + '...' : 'N/A'
    };
  }

  if (proof.merkleTreePath) {
    detailedInspection.merkleTreePath = {
      isArray: Array.isArray(proof.merkleTreePath),
      length: proof.merkleTreePath.length || 'N/A',
      firstElement: proof.merkleTreePath[0] ? {
        hasDirection: 'direction' in proof.merkleTreePath[0],
        hasHash: 'hash' in proof.merkleTreePath[0],
        direction: proof.merkleTreePath[0].direction,
        hashLength: proof.merkleTreePath[0].hash?.length || 'N/A'
      } : 'Empty array'
    };
  }

  if (proof.transactionHash) {
    detailedInspection.transactionHash = {
      type: proof.transactionHash.constructor.name,
      hasToJSON: typeof proof.transactionHash.toJSON === 'function',
      json: proof.transactionHash.toJSON ? proof.transactionHash.toJSON() : 'N/A'
    };
  }

  if (proof.unicityCertificate) {
    detailedInspection.unicityCertificate = {
      type: proof.unicityCertificate.constructor.name,
      hasPartitionId: 'partitionId' in proof.unicityCertificate,
      hasRootChainRoundNumber: 'rootChainRoundNumber' in proof.unicityCertificate,
      hasRootHashProof: 'rootHashProof' in proof.unicityCertificate,
      partitionId: proof.unicityCertificate.partitionId || 'N/A',
      roundNumber: proof.unicityCertificate.rootChainRoundNumber?.toString() || 'N/A'
    };
  }

  logResult('Detailed Field Inspection', true, detailedInspection);

  // Phase 8: JSON Serialization Test
  console.log('\n📋 Phase 8: JSON Serialization Test');
  console.log('-'.repeat(80));

  try {
    const proofJSON = proof.toJSON ? proof.toJSON() : 'No toJSON method';
    logResult('JSON Serialization', typeof proofJSON !== 'string', {
      hasToJSON: typeof proof.toJSON === 'function',
      jsonType: typeof proofJSON,
      jsonSample: typeof proofJSON === 'object' ? Object.keys(proofJSON) : proofJSON
    });
  } catch (error) {
    logResult('JSON Serialization', false, null, error instanceof Error ? error.message : String(error));
  }

  // Phase 9: SDK Verification
  console.log('\n📋 Phase 9: SDK Proof Verification');
  console.log('-'.repeat(80));

  try {
    // Note: We need to verify against the actual leaf value that was committed
    // The leaf value should be hash(requestId || transactionHash)
    const hasher = new DataHasher(HashAlgorithm.SHA256);
    const requestIdBytes = requestId.data;
    const transactionHashBytes = transactionHash.data;

    // Concatenate requestId and transactionHash
    const combined = new Uint8Array(requestIdBytes.length + transactionHashBytes.length);
    combined.set(requestIdBytes, 0);
    combined.set(transactionHashBytes, requestIdBytes.length);

    const leafValue = await hasher.update(combined).digest();

    const verificationResult = await proof.verify(trustBase, leafValue.data);

    const verificationStatus = {
      isValid: verificationResult === InclusionProofVerificationStatus.OK,
      status: String(verificationResult),
      statusCode: verificationResult,
      expectedLeafValue: leafValue.toJSON()
    };

    logResult('SDK Verification', verificationStatus.isValid, verificationStatus);
  } catch (error) {
    logResult('SDK Verification', false, null, error instanceof Error ? error.message : String(error));
  }

  // Phase 10: Current CLI Validation Check
  console.log('\n📋 Phase 10: CLI Validation Logic Check');
  console.log('-'.repeat(80));

  const validationChecks = {
    hasProofObject: proof !== null && typeof proof === 'object',
    hasVerifyMethod: typeof proof.verify === 'function',
    hasRequiredFields: {
      authenticator: 'authenticator' in proof,
      merkleTreePath: 'merkleTreePath' in proof,
      transactionHash: 'transactionHash' in proof,
      unicityCertificate: 'unicityCertificate' in proof
    },
    allFieldsPresent:
      'authenticator' in proof &&
      'merkleTreePath' in proof &&
      'transactionHash' in proof &&
      'unicityCertificate' in proof,
    matchesCliExpectations: true // Will be set based on checks
  };

  validationChecks.matchesCliExpectations =
    validationChecks.hasProofObject &&
    validationChecks.hasVerifyMethod &&
    validationChecks.allFieldsPresent;

  logResult('CLI Validation Logic', validationChecks.matchesCliExpectations, validationChecks);

  // Final Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));

  const summary = {
    totalPhases: results.length,
    successfulPhases: results.filter(r => r.success).length,
    failedPhases: results.filter(r => !r.success).length,
    conclusions: {
      aggregatorRespondsCorrectly: proof !== null,
      proofStructureComplete: validationChecks.allFieldsPresent,
      sdkVerificationWorks: results.some(r => r.phase === 'SDK Verification' && r.success),
      cliValidationSufficient: validationChecks.matchesCliExpectations,
      authenticatorFieldPresent: proofStructure.hasAuthenticator,
      unicityCertificatePresent: proofStructure.hasUnicityCertificate,
      proofIsSDKObject: proof.constructor.name !== 'Object'
    },
    recommendations: [] as string[]
  };

  if (!proofStructure.hasAuthenticator) {
    summary.recommendations.push('WARNING: Authenticator field is missing from proof response');
  }

  if (!proofStructure.hasUnicityCertificate) {
    summary.recommendations.push('WARNING: UnicityCertificate field is missing from proof response');
  }

  if (summary.conclusions.proofStructureComplete && summary.conclusions.sdkVerificationWorks) {
    summary.recommendations.push('✓ Current CLI validation logic is sufficient');
  } else {
    summary.recommendations.push('⚠ CLI validation logic may need enhancement');
  }

  if (summary.conclusions.proofIsSDKObject) {
    summary.recommendations.push('✓ Proof is returned as proper SDK object, not raw JSON');
  }

  console.log(JSON.stringify(summary, null, 2));

  // Export results to file
  console.log('\n📁 Exporting Results');
  console.log('-'.repeat(80));

  const fs = await import('fs');
  const outputPath = '/home/vrogojin/cli/tests/manual/aggregator-proof-test-results.json';

  const exportData = {
    testRun: new Date().toISOString(),
    results,
    summary,
    proofDetails: {
      constructor: proof.constructor.name,
      hasVerifyMethod: typeof proof.verify === 'function',
      fields: Object.keys(proof)
    }
  };

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
  console.log(`✓ Results exported to: ${outputPath}`);
}

// Execute test
testAggregatorProofResponse().catch(error => {
  console.error('\n❌ FATAL ERROR:', error);
  process.exit(1);
});
