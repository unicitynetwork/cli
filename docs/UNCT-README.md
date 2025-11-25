# UNCT Coin Minting & Verification - Complete Reference

> **Unicity Coin Token (UNCT)**: Client-side managed tokens with cryptographic proof of origin from the PoW blockchain

## Quick Start

### 1. Setup Environment

```bash
# Start PoW blockchain
cd /home/vrogojin/unicity-pow
./scripts/dev-chain.sh start

# Start miner (regtest)
./scripts/miner-simulator.sh --passphrase "test-secret" &

# Build CLI tools
cd /home/vrogojin/cli
npm install
npm run build
```

### 2. Mint Your First UNCT

```bash
#  Generate pre-mine data
SECRET="my-secret" npm run mint-uct-coin -- --pre-generate -o pre-mine.json

# ⏳ Wait 35+ seconds for block to be mined

# ✅ Finalize token
SECRET="my-secret" npm run mint-uct-coin -- --finalize pre-mine.json -o my-token.txf --local
```

### 3. Verify Token

```bash
npm run verify-uct-coin -- -f my-token.txf
```

---

## Command Reference

### `mint-uct-coin`

Mint Unicity Coin Token with proof of origin from PoW blockchain.

#### Phase 1: Pre-Generate

```bash
unicity mint-uct-coin --pre-generate [OPTIONS]
```

**Options:**
- `-o, --output <file>` - Output file for pre-mine data (default: `pre-mine-<timestamp>.json`)

**Output:**
- Creates JSON file with `tokenId`, `target`, `timestamp`, `status`
- Displays tokenId and target to console
- **Security**: Keep this file secret! Contains tokenId.

**Example:**
```bash
SECRET="wallet-secret" unicity mint-uct-coin --pre-generate -o pre-mine.json

# Output:
# Generated tokenId: a1b2c3d4...
# Target: e5f6g7h8...
# Saved to: pre-mine.json
```

**Pre-Mine Data Structure:**
```json
{
  "version": "1.0",
  "tokenId": "5cb2392761131a944fdc60327702c6be3b3431c2877461887c9ef4ac17802c8d",
  "target": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "timestamp": 1705587123456,
  "status": "pending"
}
```

---

#### Phase 2: Finalize

```bash
unicity mint-uct-coin --finalize <pre-mine-file> [OPTIONS]
```

**Required:**
- `--finalize <file>` - Path to pre-mine JSON file

**Options:**
- `-o, --output <file>` - Output token file (default: `token.txf`)
- `--registry <file>` - TokenId registry path (default: `/home/vrogojin/unicity-pow/tokenid-registry.txt`)
- `--pow-script <path>` - Path to dev-chain.sh (default: `/home/vrogojin/unicity-pow/scripts/dev-chain.sh`)
- `-c, --coins <amounts>` - Coin amounts (default: `1000000000000000000` = 1 UCT)
- `--local` - Use local aggregator
- `-e, --endpoint <url>` - Aggregator endpoint URL

**Workflow:**
1. Loads pre-mine data
2. Queries registry for tokenId → block height
3. Fetches block header and witness
4. Verifies coin origin cryptographically
5. Creates `CoinOriginProof`
6. Mints token via SDK with embedded proof
7. Saves token to file

**Example:**
```bash
SECRET="wallet-secret" unicity mint-uct-coin \
  --finalize pre-mine.json \
  -o my-unct.txf \
  --local \
  -c "1000000000000000000"

# Output:
# Loaded tokenId: 5cb2...
# Querying registry...
#   Found at block: 105
# Verifying origin...
#   PASS
# Creating proof...
# Minting token...
# Token saved: my-unct.txf
```

**Errors:**
- `TokenId not found in registry` → Block not mined yet, wait longer
- `Verification failed: Target mismatch` → Data corruption, check pre-mine.json
- `PoW node not running` → Start dev-chain: `./scripts/dev-chain.sh start`

---

### `verify-uct-coin`

Verify UNCT token's coin origin proof against PoW blockchain.

```bash
unicity verify-uct-coin -f <token-file> [OPTIONS]
```

**Required:**
- `-f, --file <file>` - Token file (.txf) to verify

**Options:**
- `--pow-script <path>` - Path to dev-chain.sh (default: `/home/vrogojin/unicity-pow/scripts/dev-chain.sh`)
- `--skip-sdk` - Skip standard SDK verification (not recommended)
- `--skip-origin` - Skip coin origin verification (defeats purpose)

**Verification Steps:**
1. **SDK Verification** - Standard token integrity checks
2. **Extract Proof** - Parse CoinOriginProof from token.data
3. **Query Blockchain** - Get block header and witness
4. **Cryptographic Verification** - Validate proof mathematically

**Example:**
```bash
npm run verify-uct-coin -- -f my-unct.txf

# Output:
# === SDK Verification ===
#   SDK verification: PASS
# === Extract Coin Origin Proof ===
#   TokenId: 5cb2392761131a944fdc60327702c6be3b3431c2877461887c9ef4ac17802c8d
#   Block Height: 105
#   Merkle Root: 8f7a9c2b3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a
# === Verify Coin Origin ===
#   PASS: Coin origin verified
#     Block: 0c8f2e4a3b5c6d7e...
#     Target match: YES
# === Result ===
# STATUS: VALID
```

**Exit Codes:**
- `0` - Valid token
- `1` - Verification failed (invalid proof/signatures)
- `2` - Fatal error (file not found, RPC error, etc.)

---

## API Reference

### TypeScript Interfaces

#### `CoinOriginProof`

```typescript
interface CoinOriginProof {
  version: string;           // Protocol version ("1.0")
  tokenId: string;           // 64 hex chars - token container ID
  blockHeight: number;       // Block where tokenId was registered
  merkleRoot: string;        // 64 hex chars - from block header
  target: string;            // 64 hex chars - SHA256(tokenId)
  blockTimestamp?: number;   // Optional: block timestamp
  blockHash?: string;        // Optional: block header hash
  checkpoint?: {             // Optional: BFT checkpoint data
    leftControl: string;     // 64 hex chars - signed checkpoint
    signature: string;       // 128 hex chars - BIP340 Schnorr
    publicKey?: string;      // 66 hex chars - compressed pubkey
  };
}
```

**Usage:**
```typescript
import { CoinOriginProof, serializeCoinOriginProof, deserializeCoinOriginProof } from './types/CoinOriginProof.js';

// Create proof
const proof: CoinOriginProof = {
  version: '1.0',
  tokenId: 'abc123...',
  blockHeight: 100,
  merkleRoot: 'def456...',
  target: 'ghi789...'
};

// Serialize
const json = serializeCoinOriginProof(proof);

// Deserialize
const loaded = deserializeCoinOriginProof(json);
```

---

#### `PreMineData`

```typescript
interface PreMineData {
  version: string;
  tokenId: string;           // 64 hex chars (KEEP SECRET!)
  target: string;            // 64 hex chars = SHA256(tokenId)
  timestamp: number;         // When generated
  status: 'pending' | 'submitted' | 'mined' | 'finalized';
  blockHeight?: number;      // Filled after mining
  merkleRoot?: string;       // Filled after mining
  publicKey?: string;        // Optional: for signing
}
```

**Usage:**
```typescript
import { createPreMineData, savePreMineData, loadPreMineData } from './types/PreMineData.js';

// Generate new
const preMine = createPreMineData();

// Save
savePreMineData(preMine, 'pre-mine.json');

// Load
const loaded = loadPreMineData('pre-mine.json');
```

---

#### `PoWClient`

```typescript
class PoWClient {
  constructor(devChainScript?: string, rpcEndpoint?: string);

  // Get block header by height or hash
  async getBlockHeader(heightOrHash: number | string): Promise<BlockHeader>;

  // Get current blockchain height
  async getBlockCount(): Promise<number>;

  // Get witness data by block height
  async getWitnessByHeight(height: number): Promise<WitnessData>;

  // Get witness data by merkle root
  async getWitnessByMerkleRoot(merkleRoot: string): Promise<WitnessData>;

  // Query tokenid-registry.txt
  async queryTokenIdRegistry(
    tokenId: string,
    registryPath?: string
  ): Promise<number | null>;

  // Complete verification of tokenId in block
  async verifyTokenIdInBlock(
    tokenId: string,
    blockHeight: number
  ): Promise<VerificationResult>;
}
```

**Example:**
```typescript
import { PoWClient } from './utils/pow-client.js';

const client = new PoWClient('/home/vrogojin/unicity-pow/scripts/dev-chain.sh');

// Get block header
const header = await client.getBlockHeader(105);
console.log(header.merkleRoot);

// Get witness
const witness = await client.getWitnessByHeight(105);
console.log(witness.witness.rightControl); // target

// Verify
const result = await client.verifyTokenIdInBlock('abc123...', 105);
if (result.valid) {
  console.log('Valid!');
}
```

---

### Helper Functions

#### `embedProofInTokenData(proof: CoinOriginProof): Uint8Array`

Embeds `CoinOriginProof` in token.data field as JSON.

**Format:**
```json
{
  "type": "UNCT",
  "coinOriginProof": { ... }
}
```

**Usage:**
```typescript
const tokenData = embedProofInTokenData(proof);
// Pass to SDK: Token.mint({ data: tokenData, ... })
```

---

#### `extractProofFromTokenData(data: Uint8Array): CoinOriginProof | null`

Extracts `CoinOriginProof` from token.data field.

**Returns:** `CoinOriginProof` object or `null` if not found

**Usage:**
```typescript
const dataBytes = Buffer.from(token.state.data, 'hex');
const proof = extractProofFromTokenData(dataBytes);

if (!proof) {
  throw new Error('Not a UNCT token');
}
```

---

## Testing Guide

### Unit Tests

Create `/home/vrogojin/cli/tests/unit/coin-origin-proof.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import {
  CoinOriginProof,
  serializeCoinOriginProof,
  deserializeCoinOriginProof
} from '../../src/types/CoinOriginProof.js';

describe('CoinOriginProof', () => {
  it('should serialize and deserialize correctly', () => {
    const proof: CoinOriginProof = {
      version: '1.0',
      tokenId: 'a'.repeat(64),
      blockHeight: 100,
      merkleRoot: 'b'.repeat(64),
      target: 'c'.repeat(64)
    };

    const json = serializeCoinOriginProof(proof);
    const deserialized = deserializeCoinOriginProof(json);

    expect(deserialized).toEqual(proof);
  });

  it('should reject invalid tokenId format', () => {
    const json = JSON.stringify({
      version: '1.0',
      tokenId: 'invalid',  // Too short
      blockHeight: 100,
      merkleRoot: 'b'.repeat(64),
      target: 'c'.repeat(64)
    });

    expect(() => deserializeCoinOriginProof(json)).toThrow('Invalid tokenId format');
  });

  it('should compute target correctly', () => {
    const crypto = require('crypto');
    const tokenId = 'abc123...';
    const expectedTarget = crypto.createHash('sha256')
      .update(Buffer.from(tokenId, 'hex'))
      .digest('hex');

    // Test that your implementation matches
    expect(computeTarget(tokenId)).toBe(expectedTarget);
  });
});
```

**Run tests:**
```bash
npm test
```

---

### Integration Tests

Create `/home/vrogojin/cli/tests/integration/unct-minting.sh`:

```bash
#!/usr/bin/env bash
set -e

echo "=== UNCT Integration Test ==="

# Setup
TEST_DIR="/tmp/unct-test-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Test 1: Pre-generate
echo "Test 1: Pre-generate tokenId"
SECRET="test-secret" npm run mint-uct-coin -- --pre-generate -o pre-mine.json
[ -f "pre-mine.json" ] || (echo "FAIL: pre-mine.json not created" && exit 1)

TOKEN_ID=$(jq -r '.tokenId' pre-mine.json)
TARGET=$(jq -r '.target' pre-mine.json)

echo "  TokenId: $TOKEN_ID"
echo "  Target: $TARGET"
echo "  ✓ PASS"

# Test 2: Wait for mining
echo "Test 2: Wait for block to be mined (35 seconds)"
sleep 35

# Test 3: Finalize
echo "Test 3: Finalize token"
SECRET="test-secret" npm run mint-uct-coin -- \
  --finalize pre-mine.json \
  -o token.txf \
  --local

[ -f "token.txf" ] || (echo "FAIL: token.txf not created" && exit 1)
echo "  ✓ PASS"

# Test 4: Verify
echo "Test 4: Verify token"
npm run verify-uct-coin -- -f token.txf

if [ $? -ne 0 ]; then
  echo "FAIL: Verification failed"
  exit 1
fi
echo "  ✓ PASS"

# Cleanup
cd /
rm -rf "$TEST_DIR"

echo "=== All Tests Passed ==="
```

**Run integration tests:**
```bash
chmod +x tests/integration/unct-minting.sh
./tests/integration/unct-minting.sh
```

---

### Manual Testing Checklist

#### ✅ Basic Flow
- [ ] Start dev-chain
- [ ] Start miner-simulator
- [ ] Pre-generate tokenId
- [ ] Verify pre-mine.json created
- [ ] Wait 35+ seconds
- [ ] Finalize token
- [ ] Verify token created
- [ ] Verify token passes verification

#### ✅ Error Handling
- [ ] Finalize before mining → "TokenId not found in registry"
- [ ] Invalid pre-mine.json → Parse error
- [ ] Dev-chain not running → "PoW node not running"
- [ ] Corrupted tokenId → "Target mismatch"
- [ ] Fake proof → Verification fails

#### ✅ Edge Cases
- [ ] Multiple tokens in quick succession
- [ ] Very large coin amounts
- [ ] Empty checkpoint (null merkleRoot in block)
- [ ] Registry file doesn't exist
- [ ] Permission errors on pre-mine.json

---

## Troubleshooting

### Common Issues

#### Issue: "TokenId not found in registry"

**Cause:** Block hasn't been mined yet

**Solution:**
```bash
# Check miner is running
ps aux | grep miner-simulator

# Check registry file
tail /home/vrogojin/unicity-pow/tokenid-registry.txt

# Wait longer
sleep 40
```

---

#### Issue: "Target mismatch"

**Cause:** TokenId doesn't match what was submitted

**Solution:**
- Use the same `pre-mine.json` file
- Don't modify tokenId after generation
- Regenerate if corrupted

---

#### Issue: "Merkle root mismatch"

**Cause:** Block header and witness out of sync

**Solution:**
```bash
# Query both
./scripts/dev-chain.sh rpc getblockheader 105
./scripts/dev-chain.sh rpc getwitnessbyheight 105

# Compare merkleRoot values - should match
```

---

#### Issue: Build Errors

**Solution:**
```bash
cd /home/vrogojin/cli
rm -rf node_modules dist
npm install
npm run build
```

---

## Security Best Practices

### 1. Protect Pre-Mine Data

```bash
# Set restrictive permissions
chmod 600 pre-mine.json

# Never commit to git
echo "pre-mine*.json" >> .gitignore

# Delete after finalization
rm pre-mine.json
```

### 2. Verify Before Accepting

Always verify tokens you receive:
```bash
npm run verify-uct-coin -- -f received-token.txf
```

### 3. Use Secure RPC Endpoints

In production, use TLS and authentication:
```typescript
const client = new PoWClient(
  undefined,
  'https://pow-node.unicity.network' // Secure endpoint
);
```

### 4. Backup Registry

```bash
# Regular backups
cp tokenid-registry.txt tokenid-registry-backup-$(date +%Y%m%d).txt
```

---

## Performance Considerations

### Minting Time

```
Pre-generation: ~1 second
Mining wait: ~30-60 seconds (depends on block interval)
Finalization: ~2-5 seconds
Total: ~35-70 seconds
```

### Verification Time

```
Load token: <1 second
SDK verification: ~1-2 seconds
Query PoW chain: ~1-2 seconds
Crypto verification: <1 second
Total: ~3-5 seconds
```

### Optimization Tips

1. **Parallel Minting**: Generate multiple pre-mine files, submit batch to miner
2. **Cache Block Headers**: Reuse for multiple verifications at same height
3. **Registry Indexing**: Use database instead of flat file for >10k entries

---

## Production Deployment

### Environment Variables

```bash
# .env file
POW_RPC_ENDPOINT=https://pow-node.unicity.network
WITNESS_RPC_ENDPOINT=https://witness.unicity.network
REGISTRY_DB_URL=postgresql://user:pass@host/registry
AGGREGATOR_ENDPOINT=https://aggregator.unicity.network
```

### Configuration

```typescript
// config/production.ts
export default {
  pow: {
    endpoint: process.env.POW_RPC_ENDPOINT,
    timeout: 30000,
    retries: 3
  },
  witness: {
    endpoint: process.env.WITNESS_RPC_ENDPOINT,
    timeout: 15000
  },
  registry: {
    type: 'postgres',
    url: process.env.REGISTRY_DB_URL
  }
};
```

---

## FAQ

### Q: Can I reuse a pre-mine file?
**A:** No! Each pre-mine file is single-use. Once finalized, generate a new one.

### Q: What if I lose the pre-mine file before finalization?
**A:** The coin is lost. The tokenId is the only way to claim the mined coin. Back up securely!

### Q: Can someone steal my coin if they see the target?
**A:** No. The target is SHA256(tokenId) - a one-way function. They cannot recover tokenId.

### Q: How do I transfer a UNCT token?
**A:** Use the standard SDK transfer methods. The coin origin proof travels with the token.

### Q: What happens if the PoW chain reorganizes?
**A:** Proofs reference specific blocks. A reorg could invalidate proofs. Wait for confirmations (6+ blocks recommended).

---

## Resources

- **Implementation Guide**: [UNCT-IMPLEMENTATION-GUIDE.md](./UNCT-IMPLEMENTATION-GUIDE.md)
- **Architecture Details**: [UNCT-ARCHITECTURE.md](./UNCT-ARCHITECTURE.md)
- **Unicity SDK Docs**: https://github.com/unicitylabs/state-transition-sdk
- **PoW Chain Repo**: /home/vrogojin/unicity-pow

---

**Document Version**: 1.0
**Last Updated**: 2025-01-18
**Maintained by**: Unicity Development Team
