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

## Quick Start for Local Development

### Prerequisites

Before using dynamic TrustBase loading, ensure your local Docker aggregator is running:

```bash
# Check if aggregator container is running
docker ps | grep aggregator

# Expected output shows container name (could be aggregator-service, unicity-aggregator, etc.)
# Note the CONTAINER ID or NAMES column - you'll need this for the docker cp command
```

**Find your container name:**
```bash
# List all running containers with 'aggregator' in the name
docker ps --filter "name=aggregator" --format "table {{.Names}}\t{{.Status}}"

# Or show full container list
docker ps
```

Common container names:
- `aggregator-service`
- `unicity-aggregator`
- `local-aggregator`
- Or with project prefix like `unicity_aggregator_1`

If you don't have the aggregator running, you'll need to start it first. Contact your team for the Docker Compose setup.

### Fastest Setup (Recommended)

For smooth local development, extract the TrustBase once and reuse it:

```bash
# 0. Create config directory (if it doesn't exist)
mkdir -p config

# 1. Extract TrustBase from Docker aggregator
# Replace 'aggregator-service' with your actual container name from above
docker cp aggregator-service:/app/bft-config/trust-base.json ./config/trust-base.json

# 2. IMPORTANT: Verify the file is valid JSON with correct structure
cat ./config/trust-base.json | jq '.networkId, .rootNodes[0].nodeId'

# Expected output:
# 3
# "16Uiu2HAm6YizNi4XUqUcCF3aoEVZaSzP3XSrGeKA1b893RLtCLfu"

# 3. The CLI will now automatically detect and use this file
SECRET="test" npm run mint-token -- --local -d '{"test":"data"}' --save
```

You should see:
```
Loading trust base...
Loaded TrustBase from: ./config/trust-base.json
  ✓ Trust base ready (Network ID: 3, Epoch: 1)
```

**Done!** Your development environment is now properly configured.

### Alternative: Let CLI Use Fallback (Zero Setup)

If you're using the standard Docker aggregator setup with no modifications:

```bash
# Just run commands normally - no setup needed
SECRET="test" npm run mint-token -- --local -d '{"test":"data"}'
```

The CLI will automatically use the hardcoded configuration that matches the default Docker setup. This works out-of-the-box but is only suitable for local development with the standard configuration.

## Implementation

### New Utility Module

Created `/home/vrogojin/cli/src/utils/trustbase-loader.ts` with:

- `loadTrustBase(config)` - Load from file with fallback to hardcoded
- `getCachedTrustBase(config)` - Cached loading to avoid repeated I/O
- `clearTrustBaseCache()` - Clear cache for testing
- `getTrustBaseMountInstructions()` - Helper for Docker instructions

### Loading Strategy

The loader tries these sources in order:

1. **Custom file path** via `TRUSTBASE_PATH` environment variable
   - Commands pass `process.env.TRUSTBASE_PATH` to the loader
   - Allows overriding the default search paths
2. **Default paths** (checked in order):
   - `/tmp/aggregator/bft-config/trust-base.json` (Docker volume mount)
   - `/app/bft-config/trust-base.json` (Running inside aggregator network)
   - `./config/trust-base.json` (Local development)
   - `<project-root>/trust-base.json` (Project root)
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
- **Network ID**
  - Local Docker: `3`
  - Testnet: Check your aggregator's trust-base.json
  - Production: `1`
- Root node information
- Epoch and signatures

**To check your network ID:**
```bash
cat trust-base.json | jq '.networkId'
```

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
ls -la ./config/trust-base.json
cat ./config/trust-base.json
```

### Issue: "Permission denied" when reading trust-base.json

**Solution:** Ensure the file has correct permissions after copying from Docker:
```bash
chmod 644 ./config/trust-base.json
```

### Issue: "Proof verification fails"

**Solution:** Ensure trust-base.json matches the aggregator you're connecting to:
```bash
# Compare with aggregator's current trust-base (replace container name)
docker exec aggregator-service cat /app/bft-config/trust-base.json

# Check if they match
diff <(docker exec aggregator-service cat /app/bft-config/trust-base.json) ./config/trust-base.json
```

### Issue: "Network ID mismatch"

**Solution:** Different aggregators use different network IDs. Verify:
```bash
# Check your local trust-base.json network ID
cat ./config/trust-base.json | jq '.networkId'

# Check aggregator's network ID
docker exec aggregator-service cat /app/bft-config/trust-base.json | jq '.networkId'
```

Expected values:
- Local Docker: Network ID 3
- Testnet: Check your aggregator's configuration
- Production: Network ID 1

### Issue: Container name 'aggregator-service' not found

**Solution:** Find your actual container name:
```bash
# List all containers with 'aggregator' in the name
docker ps --filter "name=aggregator" --format "table {{.Names}}\t{{.Status}}"

# Use the actual container name in commands
docker cp <your-container-name>:/app/bft-config/trust-base.json ./config/trust-base.json
```

## Related Files

- `/home/vrogojin/cli/src/utils/trustbase-loader.ts` - Main implementation
- `/home/vrogojin/cli/src/commands/mint-token.ts` - Uses getCachedTrustBase()
- `/home/vrogojin/cli/src/commands/receive-token.ts` - Uses getCachedTrustBase()
- `/home/vrogojin/cli/src/utils/proof-validation.ts` - Helper function updated

## References

- Unicity SDK README: Shows example of loading from file
- Docker aggregator path: `/app/bft-config/trust-base.json`
- SDK version: `@unicitylabs/state-transition-sdk@1.6.0-rc.fd1f327`
