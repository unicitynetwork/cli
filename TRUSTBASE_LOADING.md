# Dynamic TrustBase Loading

## Overview

The CLI now supports **dynamic TrustBase loading** from files or environment variables, eliminating the need for hardcoded TrustBase configurations in the codebase. This makes the CLI more flexible and production-ready.

## Investigation Results

### SDK Methods Available

After investigating the Unicity SDK (`@unicitylabs/state-transition-sdk` v1.6.0-rc.fd1f327), we found:

**No built-in TrustBase fetching methods exist:**
- `AggregatorClient` provides: `submitCommitment()`, `getInclusionProof()`, `getBlockHeight()`
- `StateTransitionClient` provides: Token operations but requires TrustBase as parameter
- `RootTrustBase` provides: Only `fromJSON()` factory method

**Aggregator HTTP endpoints tested:**
- `GET /trust-base.json` → 404
- `GET /api/v1/trust-base` → 404
- `GET /genesis/trust-base.json` → 404
- JSON-RPC methods (`getTrustBase`, `system.getTrustBase`) → Method not found

**Conclusion:** The SDK expects users to manage TrustBase configuration externally, typically by reading from a file as shown in the SDK README example.

### TrustBase Location in Docker

The local Docker aggregator stores TrustBase at:
```
/app/bft-config/trust-base.json
```

This file can be accessed via:
1. Docker volume mount
2. `docker cp` command
3. Sharing the config directory

## Implementation

### New Utility Module

Created `/home/vrogojin/cli/src/utils/trustbase-loader.ts` with:

- `loadTrustBase(config)` - Load from file with fallback to hardcoded
- `getCachedTrustBase(config)` - Cached loading to avoid repeated I/O
- `clearTrustBaseCache()` - Clear cache for testing
- `getTrustBaseMountInstructions()` - Helper for Docker instructions

### Loading Strategy

The loader tries these sources in order:

1. **Environment variable path** (`TRUSTBASE_PATH`)
2. **Default paths** (checked in order):
   - `/tmp/aggregator/bft-config/trust-base.json` (Docker volume mount)
   - `/app/bft-config/trust-base.json` (Running inside aggregator network)
   - `./config/trust-base.json` (Local development)
   - `./trust-base.json` (Project root)
3. **Hardcoded fallback** (local Docker aggregator config)

### Commands Updated

All commands now use dynamic loading:

- ✅ `mint-token.ts` - Uses `getCachedTrustBase()`
- ✅ `receive-token.ts` - Uses `getCachedTrustBase()`
- ✅ `verify-token.ts` - Uses `createDefaultTrustBase()` (updated to async)
- ✅ `proof-validation.ts` - Updated `createDefaultTrustBase()` helper

### Console Output

The CLI now displays helpful messages:

**When loading from file:**
```
Loading trust base...
Loaded TrustBase from: /tmp/trust-base.json
  ✓ Trust base ready (Network ID: 3, Epoch: 1)
```

**When falling back to hardcoded:**
```
Loading trust base...
Could not load TrustBase from file, using hardcoded configuration
This may only work with your local Docker aggregator setup
For production use, mount the aggregator trust-base.json as a volume
  ✓ Trust base ready (Network ID: 3, Epoch: 1)
```

## Usage Examples

### Method 1: Copy from Docker Container

```bash
# Copy trust-base.json from aggregator container
docker cp aggregator-service:/app/bft-config/trust-base.json /tmp/trust-base.json

# Use it with environment variable
TRUSTBASE_PATH=/tmp/trust-base.json npm run mint-token -- --local -d '{"test":"data"}'
```

### Method 2: Docker Volume Mount

When running CLI in Docker, mount the aggregator's config:

```bash
docker run -v aggregator_bft-config:/tmp/aggregator/bft-config \
  your-cli-image mint-token --local -d '{"test":"data"}'
```

The CLI will automatically detect the trust-base.json at `/tmp/aggregator/bft-config/trust-base.json`.

### Method 3: Project Config Directory

```bash
# Create config directory
mkdir -p config

# Copy trust-base.json
docker cp aggregator-service:/app/bft-config/trust-base.json ./config/trust-base.json

# CLI will automatically use ./config/trust-base.json
npm run mint-token -- --local -d '{"test":"data"}'
```

### Method 4: Use Hardcoded Fallback (Default)

If no file is found, the CLI uses the hardcoded configuration for the local Docker aggregator:

```bash
# Just run commands normally
SECRET="test" npm run mint-token -- --local -d '{"test":"data"}'
```

This works out-of-the-box with the standard Docker aggregator setup.

## Testing

### Test 1: Fallback to Hardcoded

```bash
SECRET="test" npm run mint-token -- --local -d '{"test":"dynamic_trust"}' --save
```

**Expected output:**
```
Could not load TrustBase from file, using hardcoded configuration
This may only work with your local Docker aggregator setup
```

**Result:** ✅ Works - falls back to hardcoded config

### Test 2: Load from File

```bash
# Copy from container
docker cp aggregator-service:/app/bft-config/trust-base.json /tmp/trust-base.json

# Use with environment variable
TRUSTBASE_PATH=/tmp/trust-base.json SECRET="test2" npm run mint-token -- --local -d '{"test":"loaded_from_file"}' --save
```

**Expected output:**
```
Loaded TrustBase from: /tmp/trust-base.json
```

**Result:** ✅ Works - loads from file successfully

## Caching Behavior

The TrustBase is cached after the first load to improve performance:

- Cache key: JSON.stringify of the config object
- Cache invalidation: When config changes (different path or options)
- Manual cache clear: Call `clearTrustBaseCache()` from code

This means multiple commands in the same process will reuse the loaded TrustBase without re-reading the file.

## Production Considerations

### For Production Use

1. **Always provide a trust-base.json file** - Don't rely on hardcoded fallback
2. **Mount as volume** in Docker deployments
3. **Verify network ID** matches your target network
4. **Keep trust-base.json updated** when network upgrades occur

### For Different Networks

The TrustBase contains network-specific information:
- Network ID (3 for local, 1 for production)
- Root node information
- Epoch and signatures

Ensure you're using the correct trust-base.json for your target network.

### Security Notes

- TrustBase files contain public information (node IDs, public keys)
- No secrets are stored in trust-base.json
- Files can be safely committed to version control
- Verify file integrity when downloading from external sources

## Future Enhancements

Potential improvements for future versions:

1. **HTTP endpoint support** - If Unicity adds `/trust-base.json` endpoint
2. **Automatic polling** - Detect when TrustBase changes (epoch updates)
3. **Network detection** - Auto-select TrustBase based on endpoint URL
4. **Multiple networks** - Store multiple trust-base configs in ~/.unicity/
5. **CLI flag** - Add `--trustbase-path` flag to commands

## Troubleshooting

### Issue: "Could not load TrustBase from file"

**Solution:** Verify the file exists and has correct permissions:
```bash
ls -la /tmp/trust-base.json
cat /tmp/trust-base.json
```

### Issue: "Proof verification fails"

**Solution:** Ensure trust-base.json matches the aggregator you're connecting to:
```bash
# Compare with aggregator's current trust-base
docker exec aggregator-service cat /app/bft-config/trust-base.json
```

### Issue: "Network ID mismatch"

**Solution:** Different aggregators use different network IDs. Verify:
- Local Docker: Network ID 3
- Testnet: Network ID varies
- Mainnet: Network ID 1

## Related Files

- `/home/vrogojin/cli/src/utils/trustbase-loader.ts` - Main implementation
- `/home/vrogojin/cli/src/commands/mint-token.ts` - Uses getCachedTrustBase()
- `/home/vrogojin/cli/src/commands/receive-token.ts` - Uses getCachedTrustBase()
- `/home/vrogojin/cli/src/utils/proof-validation.ts` - Helper function updated

## References

- Unicity SDK README: Shows example of loading from file
- Docker aggregator path: `/app/bft-config/trust-base.json`
- SDK version: `@unicitylabs/state-transition-sdk@1.6.0-rc.fd1f327`
