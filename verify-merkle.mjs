#!/usr/bin/env node
/**
 * Verify merkle root computation
 */
import { createHash } from 'crypto';

const leftControl = '4854e3a509684b0f73b306153adeb2ceaa7f88ebaf55f91e6c98e77dfef4e944';
const rightControl = '9dd93ebad5ddb4bbc6af0fcc92216fef0860bb6e252881a42256cb15ce8c0459';

const blockHeaderMerkleRoot = '7ca740383c696db8cad30690dcc85c62d5c432f303edcf6ec2025b4f7a27caf7';
const witnessMerkleRoot = '095a45881ae7cb1c07da7ae75aa0000ef8d05647844891f172d8291e5357dea1';

console.log('=== Merkle Root Verification ===\n');
console.log('leftControl: ', leftControl);
console.log('rightControl:', rightControl);
console.log();

// Compute SHA256(leftControl || rightControl)
const computed = createHash('sha256')
  .update(Buffer.concat([
    Buffer.from(leftControl, 'hex'),
    Buffer.from(rightControl, 'hex')
  ]))
  .digest('hex');

console.log('Computed SHA256(leftControl || rightControl):');
console.log(computed);
console.log();

console.log('Block Header merkleRoot:');
console.log(blockHeaderMerkleRoot);
console.log('Match:', computed === blockHeaderMerkleRoot ? '✓' : '✗');
console.log();

console.log('Witness merkleRoot:');
console.log(witnessMerkleRoot);
console.log('Match:', computed === witnessMerkleRoot ? '✓' : '✗');
console.log();

// Verify tokenId → target
const tokenId = '4bbd49ff3b112cdd6ea10f17b5ba2ea6be2bc0fcdfcf52aa0ad225e457e2a981';
const computedTarget = createHash('sha256')
  .update(Buffer.from(tokenId, 'hex'))
  .digest('hex');

console.log('TokenID:', tokenId);
console.log('Computed target (SHA256):', computedTarget);
console.log('RightControl:', rightControl);
console.log('Match:', computedTarget === rightControl ? '✓' : '✗');
