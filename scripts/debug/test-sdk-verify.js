import { Token } from '@unicitylabs/state-transition-sdk';
import { readFile } from 'fs/promises';

const tokenFile = process.argv[2] || '20251103_165319_1762185199191_000050490f.txf';
const tokenJson = JSON.parse(await readFile(tokenFile, 'utf8'));

try {
  const token = Token.fromJSON(tokenJson);
  
  console.log('Testing SDK validation...');
  console.log('\nGenesis proof:');
  console.log('  - authenticator:', token.genesis.inclusionProof.authenticator ? 'present' : 'null');
  console.log('  - transactionHash:', token.genesis.inclusionProof.transactionHash ? 'present' : 'null');
  
  if (token.genesis.inclusionProof.authenticator && token.genesis.inclusionProof.transactionHash) {
    console.log('\nCalling proof.verify(requestId)...');
    const status = await token.genesis.inclusionProof.verify(token.genesis.requestId);
    console.log('  Result:', status);
    
    // Also test authenticator.verify directly
    console.log('\nCalling authenticator.verify(transactionHash) directly...');
    const authResult = await token.genesis.inclusionProof.authenticator.verify(token.genesis.inclusionProof.transactionHash);
    console.log('  Result:', authResult);
  } else {
    console.log('\nCannot verify - missing authenticator or transactionHash');
  }
} catch (err) {
  console.error('Error:', err.message);
}
