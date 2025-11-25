# UNCT Coin Minting & Verification - Implementation Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture Summary](#architecture-summary)
4. [Implementation Steps](#implementation-steps)
5. [File Structure](#file-structure)
6. [Complete Workflow Example](#complete-workflow-example)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides step-by-step instructions for implementing Unicity Coin Token (UNCT) minting and verification functionality in the CLI tools at `/home/vrogojin/cli`.

### What This Implements

- **UNCT Minting**: Create Unicity tokens with cryptographic proof of coin origin from the PoW blockchain
- **UNCT Verification**: Verify that a UNCT token's coin was legitimately mined in the PoW blockchain
- **Client-Side Token Management**: Tokens stored offline, not in a shared public ledger

### Key Concept

Unlike Bitcoin where coins are stored in a public ledger, Unicity coins are stored in **offline token data structures** managed client-side. The proof of coin origin is a cryptographic reference to a specific block in the PoW blockchain where the token's ID was registered via a merkle root.

---

## Prerequisites

### Environment Setup

1. **PoW Blockchain Running**
   ```bash
   cd /home/vrogojin/unicity-pow
   ./scripts/dev-chain.sh start
   ```

2. **Miner Simulator Active** (for regtest)
   ```bash
   ./scripts/miner-simulator.sh --passphrase "your-secret" --interval 35 &
   ```

3. **CLI Tools Build Environment**
   ```bash
   cd /home/vrogojin/cli
   npm install
   npm run build
   ```

### Required Knowledge

- TypeScript programming
- Unicity State Transition SDK basics
- Cryptographic hash functions (SHA-256)
- RPC/JSON-RPC protocols
- Bitcoin-like PoW blockchain concepts

---

## Architecture Summary

### Three-Phase Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: PRE-GENERATION (Secret)                             │
│  • Generate random tokenId (32 bytes)                        │
│  • Derive target = SHA256(tokenId)                           │
│  • Save to pre-mine.json (KEEP SECRET!)                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: MINING (External - Miner Simulator)                 │
│  • Read pre-mine.json                                        │
│  • Fetch BFT checkpoint, sign it                             │
│  • Create witness: (signed_checkpoint, target)               │
│  • Compute merkle_root = SHA256(checkpoint || target)        │
│  • Submit to PoW node → block gets mined                     │
│  • Record tokenId → block_height in registry                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: FINALIZATION (Token Creation)                       │
│  • Query registry for tokenId → block_height                 │
│  • Fetch block header (has merkle_root)                      │
│  • Fetch segregated witness (has target)                     │
│  • Create CoinOriginProof                                    │
│  • Mint token with SDK, embed proof in token.data           │
└─────────────────────────────────────────────────────────────┘
```

### Verification Flow

```
┌─────────────────────────────────────────────────────────────┐
│ VERIFICATION                                                  │
│  1. Load token, extract CoinOriginProof                      │
│  2. Standard SDK verification (signatures, state, etc.)      │
│  3. Coin origin verification:                                │
│     a. Get block header by height                            │
│     b. Get witness by height                                 │
│     c. Verify: SHA256(tokenId) == witness.target            │
│     d. Verify: block.merkleRoot == witness.merkleRoot       │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Data Structure Types

**File:** `/home/vrogojin/cli/src/types/CoinOriginProof.ts`

**What to implement:**
```typescript
export interface CoinOriginProof {
  version: string;           // Protocol version (e.g., "1.0")
  tokenId: string;           // 64 hex chars - the token container ID
  blockHeight: number;       // Block where tokenId was registered
  merkleRoot: string;        // 64 hex chars - from block header
  target: string;            // 64 hex chars - SHA256(tokenId)
  blockTimestamp?: number;   // Optional: block timestamp
  blockHash?: string;        // Optional: block header hash
  checkpoint?: {             // Optional: BFT checkpoint data
    leftControl: string;     // 64 hex chars
    signature: string;       // 128 hex chars (BIP340 Schnorr)
    publicKey?: string;      // 66 hex chars (compressed)
  };
}
```

**Functions to implement:**
- `serializeCoinOriginProof(proof: CoinOriginProof): string` - Convert to JSON
- `deserializeCoinOriginProof(json: string): CoinOriginProof` - Parse from JSON with validation
- `embedProofInTokenData(proof: CoinOriginProof): Uint8Array` - Embed in token.data field
- `extractProofFromTokenData(data: Uint8Array): CoinOriginProof | null` - Extract from token

**Validation rules:**
- `tokenId`, `target`, `merkleRoot`: Must be exactly 64 hex characters
- `signature`: Must be exactly 128 hex characters (if present)
- `publicKey`: Must be exactly 66 hex characters (if present)
- All hex fields must match `/^[0-9a-fA-F]+$/`

---

**File:** `/home/vrogojin/cli/src/types/PreMineData.ts`

**What to implement:**
```typescript
export interface PreMineData {
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

**Functions to implement:**
- `createPreMineData(): PreMineData` - Generate random tokenId, derive target
- `savePreMineData(data: PreMineData, path: string): void` - Save to JSON file
- `loadPreMineData(path: string): PreMineData` - Load from JSON file

**Algorithm for `createPreMineData()`:**
```typescript
import crypto from 'crypto';

function createPreMineData(): PreMineData {
  // Generate 32 random bytes for tokenId
  const tokenIdBytes = crypto.randomBytes(32);
  const tokenId = tokenIdBytes.toString('hex');

  // Derive target: SHA256(tokenId)
  const targetBytes = crypto.createHash('sha256')
    .update(Buffer.from(tokenId, 'hex'))
    .digest();
  const target = targetBytes.toString('hex');

  return {
    version: '1.0',
    tokenId,
    target,
    timestamp: Date.now(),
    status: 'pending'
  };
}
```

---

### Step 2: Create PoW Blockchain Client

**File:** `/home/vrogojin/cli/src/utils/pow-client.ts`

**What to implement:**

```typescript
export class PoWClient {
  constructor(
    devChainScript: string = '/home/vrogojin/unicity-pow/scripts/dev-chain.sh',
    rpcEndpoint?: string
  );

  // Execute RPC command via dev-chain.sh wrapper
  private async executeRPC(method: string, ...params: any[]): Promise<any>;

  // Get block header by height or hash
  async getBlockHeader(heightOrHash: number | string): Promise<BlockHeader>;

  // Get current blockchain height
  async getBlockCount(): Promise<number>;

  // Get witness data by merkle root
  async getWitnessByMerkleRoot(merkleRoot: string): Promise<WitnessData>;

  // Get witness data by block height
  async getWitnessByHeight(height: number): Promise<WitnessData>;

  // Query tokenid-registry.txt for tokenId → block height
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

**Key Implementation Details:**

1. **RPC Execution** (`executeRPC`):
   ```typescript
   private async executeRPC(method: string, ...params: any[]): Promise<any> {
     const args = params.map(p => `"${p}"`).join(' ');
     const command = `${this.devChainScript} rpc ${method} ${args}`;

     const { stdout } = await execAsync(command);
     return JSON.parse(stdout);
   }
   ```

2. **Block Header Query**:
   ```typescript
   async getBlockHeader(heightOrHash: number | string): Promise<BlockHeader> {
     const response = await this.executeRPC('getblockheader', heightOrHash);
     return {
       height: response.height,
       hash: response.hash,
       merkleRoot: response.merkleRoot || response.merkle_root,
       timestamp: response.time || response.timestamp,
       // ... other fields
     };
   }
   ```

3. **Registry Lookup** (`queryTokenIdRegistry`):
   ```typescript
   async queryTokenIdRegistry(tokenId: string, registryPath: string): Promise<number | null> {
     const content = fs.readFileSync(registryPath, 'utf8');
     const lines = content.split('\n');

     for (const line of lines) {
       // Format: tokenId<TAB>blockHeight
       const [id, height] = line.trim().split('\t');
       if (id === tokenId) {
         return parseInt(height, 10);
       }
     }
     return null;
   }
   ```

4. **Complete Verification** (`verifyTokenIdInBlock`):
   ```typescript
   async verifyTokenIdInBlock(tokenId: string, blockHeight: number) {
     // 1. Get block header
     const blockHeader = await this.getBlockHeader(blockHeight);

     // 2. Get witness
     const witness = await this.getWitnessByHeight(blockHeight);
     if (!witness.found) {
       return { valid: false, error: 'Witness not found' };
     }

     // 3. Compute expected target
     const expectedTarget = crypto.createHash('sha256')
       .update(Buffer.from(tokenId, 'hex'))
       .digest('hex');

     // 4. Compare
     if (expectedTarget !== witness.witness.rightControl) {
       return { valid: false, error: 'Target mismatch' };
     }

     if (blockHeader.merkleRoot !== witness.witness.merkleRoot) {
       return { valid: false, error: 'Merkle root mismatch' };
     }

     return { valid: true, blockHeader, witness };
   }
   ```

---

### Step 3: Implement Minting Command

**File:** `/home/vrogojin/cli/src/commands/mint-uct-coin.ts`

**Command Structure:**
```bash
# Phase 1: Pre-generate
unicity mint-uct-coin --pre-generate -o pre-mine.json

# Phase 2: Finalize (after mining)
unicity mint-uct-coin --finalize pre-mine.json -o token.txf
```

**Implementation Outline:**

```typescript
export function mintUctCoinCommand(program: Command): void {
  program
    .command('mint-uct-coin')
    .option('--pre-generate', 'Generate tokenId and target')
    .option('-o, --output <file>', 'Output file')
    .option('--finalize <file>', 'Finalize using pre-mine data')
    .option('--registry <file>', 'Registry path', '/home/vrogojin/unicity-pow/tokenid-registry.txt')
    .option('--pow-script <path>', 'dev-chain.sh path', '/home/vrogojin/unicity-pow/scripts/dev-chain.sh')
    .option('-c, --coins <amounts>', 'Coin amounts', '1000000000000000000')
    .action(async (options) => {
      if (options.preGenerate) {
        await handlePreGenerate(options);
      } else if (options.finalize) {
        await handleFinalize(options);
      } else {
        console.error('Must specify --pre-generate or --finalize');
        process.exit(1);
      }
    });
}
```

**Phase 1: Pre-Generation** (`handlePreGenerate`):
```typescript
async function handlePreGenerate(options) {
  // 1. Create pre-mine data
  const preMineData = createPreMineData();

  // 2. Determine output file
  const outputFile = options.output || `pre-mine-${Date.now()}.json`;

  // 3. Save to file
  savePreMineData(preMineData, outputFile);

  // 4. Display to user
  console.error(`Generated tokenId: ${preMineData.tokenId}`);
  console.error(`Target: ${preMineData.target}`);
  console.error(`Saved to: ${outputFile}`);

  // 5. Output JSON for scripting
  console.log(JSON.stringify(preMineData, null, 2));
}
```

**Phase 2: Finalization** (`handleFinalize`):
```typescript
async function handleFinalize(options) {
  // 1. Load pre-mine data
  const preMineData = loadPreMineData(options.finalize);

  // 2. Initialize PoW client
  const powClient = new PoWClient(options.powScript);

  // 3. Query registry for block height
  const blockHeight = await powClient.queryTokenIdRegistry(
    preMineData.tokenId,
    options.registry
  );

  if (blockHeight === null) {
    throw new Error('TokenId not found in registry - block not mined yet?');
  }

  // 4. Verify coin origin
  const verification = await powClient.verifyTokenIdInBlock(
    preMineData.tokenId,
    blockHeight
  );

  if (!verification.valid) {
    throw new Error(`Verification failed: ${verification.error}`);
  }

  // 5. Create CoinOriginProof
  const coinOriginProof: CoinOriginProof = {
    version: '1.0',
    tokenId: preMineData.tokenId,
    blockHeight,
    merkleRoot: verification.blockHeader.merkleRoot,
    target: preMineData.target,
    blockTimestamp: verification.blockHeader.timestamp,
    blockHash: verification.blockHeader.hash,
    checkpoint: verification.witness?.witness ? {
      leftControl: verification.witness.witness.leftControl,
      signature: verification.witness.witness.signature
    } : undefined
  };

  // 6. Embed proof in token data
  const tokenDataBytes = embedProofInTokenData(coinOriginProof);

  // 7. Mint token using SDK
  // TODO: Integrate with existing SDK minting logic
  // The token should have:
  //   - tokenId: preMineData.tokenId
  //   - tokenType: UCT type identifier
  //   - data: tokenDataBytes (with embedded proof)
  //   - coins: from options.coins

  console.error('Token minted successfully!');
  console.log(`Output: ${options.output}`);
}
```

---

### Step 4: Implement Verification Command

**File:** `/home/vrogojin/cli/src/commands/verify-uct-coin.ts`

**Command Structure:**
```bash
unicity verify-uct-coin -f token.txf
```

**Implementation:**

```typescript
export function verifyUctCoinCommand(program: Command): void {
  program
    .command('verify-uct-coin')
    .description('Verify UNCT token with coin origin proof')
    .requiredOption('-f, --file <file>', 'Token file (.txf)')
    .option('--pow-script <path>', 'dev-chain.sh path', '/home/vrogojin/unicity-pow/scripts/dev-chain.sh')
    .option('--skip-sdk', 'Skip SDK verification')
    .option('--skip-origin', 'Skip origin verification')
    .action(async (options) => {
      let exitCode = 0;

      try {
        // 1. Load token
        const tokenJson = JSON.parse(fs.readFileSync(options.file, 'utf8'));

        // 2. Standard SDK verification
        if (!options.skipSdk) {
          console.log('=== SDK Verification ===');
          const token = await Token.fromJSON(tokenJson);
          // Perform full SDK validation
          console.log('  SDK verification: PASS');
        }

        // 3. Extract coin origin proof
        console.log('=== Extract Coin Origin Proof ===');
        const tokenDataHex = tokenJson.state?.data || '';
        const tokenDataBytes = Buffer.from(tokenDataHex, 'hex');
        const coinOriginProof = extractProofFromTokenData(tokenDataBytes);

        if (!coinOriginProof) {
          console.error('  No coin origin proof found');
          process.exit(1);
        }

        console.log(`  TokenId: ${coinOriginProof.tokenId}`);
        console.log(`  Block Height: ${coinOriginProof.blockHeight}`);
        console.log(`  Merkle Root: ${coinOriginProof.merkleRoot}`);

        // 4. Verify coin origin
        if (!options.skipOrigin) {
          console.log('=== Verify Coin Origin ===');
          const powClient = new PoWClient(options.powScript);

          const verification = await powClient.verifyTokenIdInBlock(
            coinOriginProof.tokenId,
            coinOriginProof.blockHeight
          );

          if (!verification.valid) {
            console.error(`  FAIL: ${verification.error}`);
            exitCode = 1;
          } else {
            console.log('  PASS: Coin origin verified');
            console.log(`    Block: ${verification.blockHeader.hash}`);
            console.log(`    Target match: YES`);
          }
        }

        // 5. Final result
        console.log('=== Result ===');
        if (exitCode === 0) {
          console.log('STATUS: VALID');
        } else {
          console.log('STATUS: INVALID');
        }

        process.exit(exitCode);

      } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(2);
      }
    });
}
```

---

### Step 5: Register Commands

**File:** `/home/vrogojin/cli/src/index.ts`

**Add imports:**
```typescript
import { mintUctCoinCommand } from './commands/mint-uct-coin.js';
import { verifyUctCoinCommand } from './commands/verify-uct-coin.js';
```

**Register commands:**
```typescript
// After existing command registrations
mintUctCoinCommand(program);
verifyUctCoinCommand(program);
```

---

### Step 6: Update Package Configuration

**File:** `/home/vrogojin/cli/package.json`

**Add scripts:**
```json
{
  "scripts": {
    "mint-uct-coin": "node dist/index.js mint-uct-coin",
    "verify-uct-coin": "node dist/index.js verify-uct-coin"
  }
}
```

---

## File Structure

After implementation, your directory structure should look like:

```
/home/vrogojin/cli/
├── src/
│   ├── commands/
│   │   ├── mint-uct-coin.ts          # NEW: UNCT minting
│   │   ├── verify-uct-coin.ts        # NEW: UNCT verification
│   │   └── ... (existing commands)
│   ├── types/
│   │   ├── CoinOriginProof.ts        # NEW: Proof data structure
│   │   ├── PreMineData.ts            # NEW: Pre-mine data
│   │   └── ... (existing types)
│   ├── utils/
│   │   ├── pow-client.ts             # NEW: PoW RPC client
│   │   └── ... (existing utils)
│   └── index.ts                       # MODIFIED: Register new commands
├── package.json                       # MODIFIED: Add scripts
└── docs/
    ├── UNCT-IMPLEMENTATION-GUIDE.md  # This file
    ├── UNCT-ARCHITECTURE.md           # Architecture details
    ├── UNCT-API-REFERENCE.md          # API documentation
    └── UNCT-TESTING-GUIDE.md          # Testing guide
```

---

## Complete Workflow Example

### Setup

```bash
# Terminal 1: Start PoW chain
cd /home/vrogojin/unicity-pow
./scripts/dev-chain.sh start

# Start auto-miner
./scripts/miner-simulator.sh --passphrase "test-secret" --interval 35 &
```

### Mint UNCT Token

```bash
cd /home/vrogojin/cli

# Step 1: Pre-generate tokenId
SECRET="my-wallet-secret" npm run mint-uct-coin -- --pre-generate -o pre-mine.json

# Output:
# Generated tokenId: 5cb2392761131a944fdc60327702c6be3b3431c2877461887c9ef4ac17802c8d
# Target:  9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
# Saved to: pre-mine.json

# Step 2: Wait for miner to process (auto-miner does this automatically)
sleep 35

# Step 3: Finalize token
SECRET="my-wallet-secret" npm run mint-uct-coin -- \
  --finalize pre-mine.json \
  -o my-unct-token.txf \
  --local

# Output:
# Loaded tokenId: 5cb2...
# Querying registry...
#   Found at block: 105
# Verifying origin...
#   PASS
# Token minted: my-unct-token.txf
```

### Verify UNCT Token

```bash
npm run verify-uct-coin -- -f my-unct-token.txf

# Output:
# === SDK Verification ===
#   SDK verification: PASS
# === Extract Coin Origin Proof ===
#   TokenId: 5cb2392761131a944fdc60327702c6be3b3431c2877461887c9ef4ac17802c8d
#   Block Height: 105
#   Merkle Root: 8f7a9c2b3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a
# === Verify Coin Origin ===
#   PASS: Coin origin verified
#     Block: 0c8f2e...
#     Target match: YES
# === Result ===
# STATUS: VALID
```

---

## Troubleshooting

### "TokenId not found in registry"

**Problem**: The block hasn't been mined yet.

**Solution**:
```bash
# Check if miner is running
ps aux | grep miner-simulator

# Check registry
tail /home/vrogojin/unicity-pow/tokenid-registry.txt

# Wait longer (blocks are ~35 seconds apart)
sleep 40
```

### "Target mismatch"

**Problem**: TokenId doesn't match what was submitted to blockchain.

**Solution**:
- Ensure you're using the same `pre-mine.json` file
- Don't modify the tokenId after generation

### "Merkle root mismatch"

**Problem**: Block header and witness are out of sync.

**Solution**:
```bash
# Query both directly
./scripts/dev-chain.sh rpc getblockheader 105
./scripts/dev-chain.sh rpc getwitnessbyheight 105

# Compare merkleRoot values
```

### "dev-chain.sh: command not found"

**Problem**: Wrong path to dev-chain.sh.

**Solution**:
```bash
# Use --pow-script option
npm run mint-uct-coin -- \
  --finalize pre-mine.json \
  --pow-script /correct/path/to/dev-chain.sh
```

### Build Errors

**Problem**: TypeScript compilation errors.

**Solution**:
```bash
cd /home/vrogojin/cli
npm run build

# Check for missing imports or type errors
# Fix them according to TypeScript error messages
```

---

## Next Steps

1. Read [UNCT-ARCHITECTURE.md](./UNCT-ARCHITECTURE.md) for detailed architecture
2. Read [UNCT-API-REFERENCE.md](./UNCT-API-REFERENCE.md) for complete API docs
3. Read [UNCT-TESTING-GUIDE.md](./UNCT-TESTING-GUIDE.md) for testing strategies
4. Start implementing Phase 1 (Data Structures)
5. Test each component as you build it

---

**Document Version**: 1.0
**Last Updated**: 2025-01-18
**Maintained by**: Unicity Development Team
