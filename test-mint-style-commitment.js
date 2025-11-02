/**
 * Test comparing two minting approaches:
 * 1. Current approach: Manual TXF construction (for airdrop to external address)
 * 2. SDK-compliant approach: Token.mint() (for self-mint)
 *
 * This demonstrates why we CANNOT use Token.mint() for airdrop scenarios
 * but SHOULD use it when minting to ourselves.
 */

import { TokenId } from '@unicitylabs/state-transition-sdk/lib/token/TokenId.js';
import { TokenType } from '@unicitylabs/state-transition-sdk/lib/token/TokenType.js';
import { UnmaskedPredicate } from '@unicitylabs/state-transition-sdk/lib/predicate/embedded/UnmaskedPredicate.js';
import { TokenState } from '@unicitylabs/state-transition-sdk/lib/token/TokenState.js';
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token.js';
import { MintTransactionData } from '@unicitylabs/state-transition-sdk/lib/transaction/MintTransactionData.js';
import { MintCommitment } from '@unicitylabs/state-transition-sdk/lib/transaction/MintCommitment.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/state-transition-sdk/lib/sign/SigningService.js';
import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import crypto from 'crypto';

async function main() {
  console.log('=== Comparing Minting Approaches ===\n');

  // Setup: Create signing service from a test secret
  const testSecret = 'test-secret-for-demo-purposes-only';
  const secretBytes = new TextEncoder().encode(testSecret);
  const signingService = await SigningService.createFromSecret(secretBytes);

  // Setup: Token parameters (NFT)
  const tokenIdBytes = crypto.randomBytes(32);
  const tokenId = new TokenId(tokenIdBytes);
  const tokenType = new TokenType(new Uint8Array(32)); // All zeros = NFT
  const salt = crypto.randomBytes(32);
  const nftData = new TextEncoder().encode(JSON.stringify({ name: 'Test NFT', test: true }));

  console.log('Token Parameters:');
  console.log(`  - Token ID: ${tokenId.toJSON()}`);
  console.log(`  - Token Type: NFT (all zeros)`);
  console.log(`  - NFT Data: ${new TextDecoder().decode(nftData)}`);
  console.log();

  // ==========================================================================
  // SCENARIO 1: Self-Mint (We control the private key) - PROPER SDK APPROACH
  // ==========================================================================
  console.log('─'.repeat(80));
  console.log('SCENARIO 1: Self-Mint (We have the private key)');
  console.log('─'.repeat(80));
  console.log();

  console.log('Step 1: Create predicate from OUR signing service');
  const predicate = await UnmaskedPredicate.create(
    tokenId,
    tokenType,
    signingService,
    HashAlgorithm.SHA256,
    salt
  );
  console.log('  ✓ Created UnmaskedPredicate with our private key');

  console.log('\nStep 2: Derive address FROM the predicate');
  const predicateRef = await predicate.getReference();
  const address = await predicateRef.toAddress();
  console.log(`  ✓ Address: ${address.address}`);

  console.log('\nStep 3: Create MintTransactionData using the address');
  const mintTxData = await MintTransactionData.create(
    tokenId,
    tokenType,
    nftData,
    [], // No coins for NFT
    address.address, // Use the address string
    salt,
    null, // No nametag tokens
    null  // No owner reference
  );
  console.log('  ✓ MintTransactionData created');

  console.log('\nStep 4: Create commitment');
  const commitment = await MintCommitment.create(mintTxData);
  console.log('  ✓ MintCommitment created');
  console.log(`    Request ID: ${commitment.requestId.toJSON()}`);

  // In real scenario, we would:
  // - Submit commitment to aggregator
  // - Wait for inclusion proof
  // - Use proof to create transaction
  console.log('\nStep 5: [SIMULATED] Would get inclusion proof from aggregator');
  console.log('  (Skipping actual network call for this demo)');

  console.log('\nStep 6: Create TokenState with SAME predicate instance');
  const tokenState = new TokenState(predicate, nftData);
  console.log('  ✓ TokenState created');
  console.log('    - Uses the SAME predicate instance we created');
  console.log('    - This ensures address matches predicate');

  console.log('\nStep 7: [WOULD] Use Token.mint() to create proper Token object');
  console.log('  Code would be:');
  console.log('    const mintTransaction = commitment.toTransaction(inclusionProof);');
  console.log('    const token = await Token.mint(');
  console.log('      trustBase,');
  console.log('      tokenState,');
  console.log('      mintTransaction,');
  console.log('      [] // nametag tokens');
  console.log('    );');
  console.log('    const txfJson = token.toJSON(); // ← PROPER TXF FORMAT');

  console.log('\n✅ This approach works because:');
  console.log('   1. We have the private key (SigningService)');
  console.log('   2. We can create the predicate');
  console.log('   3. Same predicate used in both address derivation AND TokenState');
  console.log('   4. Token.mint() can verify everything matches');
  console.log('   5. token.toJSON() produces correct SDK-standard TXF format');

  // ==========================================================================
  // SCENARIO 2: Airdrop to External Address (No private key) - LIMITATION
  // ==========================================================================
  console.log('\n\n' + '─'.repeat(80));
  console.log('SCENARIO 2: Airdrop to External Address (No private key)');
  console.log('─'.repeat(80));
  console.log();

  const externalAddress = 'DIRECT://00001416858a469ab52f5c96b7b31bdf04f7dfc787a4064098a040ba1fc5346a3ba1266650c8';
  console.log(`External address: ${externalAddress}`);
  console.log();

  console.log('Step 1: Try to create predicate for external address');
  console.log('  ❌ PROBLEM: We do NOT have the recipient\'s private key!');
  console.log('  ❌ Cannot call UnmaskedPredicate.create() without SigningService');
  console.log('  ❌ Address only contains HASH of predicate reference, not the key');

  console.log('\nStep 2: Could we still create MintTransactionData?');
  console.log('  ✓ YES - MintTransactionData only needs the address STRING');
  const airdropMintTxData = await MintTransactionData.create(
    tokenId,
    tokenType,
    nftData,
    [],
    externalAddress,
    salt,
    null,
    null
  );
  console.log('  ✓ MintTransactionData created successfully');

  console.log('\nStep 3: Could we get inclusion proof?');
  console.log('  ✓ YES - Network would accept the mint commitment');

  console.log('\nStep 4: Could we use Token.mint()?');
  console.log('  ❌ NO - Token.mint() requires TokenState');
  console.log('  ❌ TokenState requires a Predicate instance');
  console.log('  ❌ We cannot create the predicate without the private key');

  console.log('\n❌ This approach FAILS for airdrop because:');
  console.log('   1. We do NOT have recipient\'s private key');
  console.log('   2. Cannot create UnmaskedPredicate for their address');
  console.log('   3. Cannot create TokenState without predicate');
  console.log('   4. Cannot use Token.mint() without TokenState');
  console.log('   5. Must use custom TXF format OR different approach');

  // ==========================================================================
  // SOLUTIONS FOR AIRDROP SCENARIO
  // ==========================================================================
  console.log('\n\n' + '='.repeat(80));
  console.log('SOLUTIONS FOR AIRDROP SCENARIO');
  console.log('='.repeat(80));

  console.log('\n📋 Option A: Mint to Self-Controlled Masked Address, Then Transfer');
  console.log('   1. Generate one-time masked address with our key');
  console.log('   2. Mint token to that address (proper Token.mint())');
  console.log('   3. Save token with token.toJSON() (correct TXF format)');
  console.log('   4. Later: Transfer from masked address to final recipient');
  console.log('   5. Recipient gets properly formatted token');
  console.log('   ✓ Uses SDK methods throughout');
  console.log('   ✓ Proper TXF format maintained');
  console.log('   ✗ Requires two transactions instead of one');
  console.log('   ✗ Gas cost for both mint and transfer');

  console.log('\n📋 Option B: Save Mint Commitment as "Mint Receipt"');
  console.log('   1. Create MintTransactionData with recipient address');
  console.log('   2. Submit commitment, get inclusion proof');
  console.log('   3. Save as custom format "mint receipt"');
  console.log('   4. Recipient imports receipt into their wallet');
  console.log('   5. Wallet reconstructs Token using recipient\'s predicate');
  console.log('   ✓ Single transaction (just mint)');
  console.log('   ✓ Lower gas cost');
  console.log('   ✗ Custom format, not standard TXF');
  console.log('   ✗ Recipient wallet needs to support this flow');

  console.log('\n📋 Option C: Use MaskedPredicate for One-Time Airdrops');
  console.log('   1. Create MaskedPredicate (single-use address)');
  console.log('   2. Mint token to that address (proper Token.mint())');
  console.log('   3. Save token.toJSON() + share the nonce with recipient');
  console.log('   4. Recipient uses nonce to recreate same MaskedPredicate');
  console.log('   5. Recipient can then transfer to their permanent address');
  console.log('   ✓ Proper SDK usage');
  console.log('   ✓ Standard TXF format');
  console.log('   ✗ Requires securely sharing nonce');
  console.log('   ✗ Still needs transfer step');

  console.log('\n\n' + '='.repeat(80));
  console.log('RECOMMENDATION');
  console.log('='.repeat(80));
  console.log('\n💡 For CLI minting tool:');
  console.log('   - Default behavior: Mint to SELF (Option A, step 1-3)');
  console.log('     • Use Token.mint() for proper TXF format');
  console.log('     • Save with token.toJSON()');
  console.log('     • User can later transfer to recipient');
  console.log();
  console.log('   - Alternative: Add --receipt mode for direct airdrop');
  console.log('     • Current custom format');
  console.log('     • Document that it\'s a "mint receipt" not a "token"');
  console.log('     • Recipient needs compatible wallet');
  console.log();
  console.log('The key insight: PROPER SDK usage requires the private key!');
  console.log('Without recipient\'s key, we cannot use Token.mint() correctly.');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
