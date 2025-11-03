import { RootTrustBase } from '@unicitylabs/state-transition-sdk/lib/bft/RootTrustBase.js';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Configuration for TrustBase loading strategies
 */
export interface TrustBaseConfig {
  /**
   * Path to trust-base.json file (used when running with Docker volume mount)
   */
  filePath?: string;

  /**
   * Hardcoded TrustBase JSON (fallback for when file doesn't exist)
   */
  fallbackJson?: unknown;

  /**
   * Whether to use the fallback immediately without trying file access
   */
  useFallback?: boolean;
}

/**
 * Default hardcoded TrustBase configuration for local Docker aggregator
 * This matches the configuration at /app/bft-config/trust-base.json in the aggregator container
 */
const DEFAULT_LOCAL_TRUSTBASE = {
  version: '1',
  networkId: 3,
  epoch: '1',
  epochStartRound: '1',
  rootNodes: [
    {
      nodeId: '16Uiu2HAm6YizNi4XUqUcCF3aoEVZaSzP3XSrGeKA1b893RLtCLfu',
      sigKey: '02cf6a24725f81b38431f3ddb92ed89a01b06a07f4e15945096c2e11a13916ff6d',
      stake: '1'
    }
  ],
  quorumThreshold: '1',
  stateHash: '',
  changeRecordHash: null,
  previousEntryHash: null,
  signatures: {
    '16Uiu2HAm6YizNi4XUqUcCF3aoEVZaSzP3XSrGeKA1b893RLtCLfu':
      'c6a2603d88ed172ef492f3b55bc6f0651ca7fde037b8651c83c33e8fd4884e5d72ef863fac564a0863e2bdea4ef73a1b2de2abe36485a3fa95d3cda1c51dcc2300'
  }
};

/**
 * Default paths to check for trust-base.json file
 * These paths assume Docker volume mounting strategies
 */
const DEFAULT_TRUSTBASE_PATHS = [
  // Path when running CLI with aggregator config mounted as volume
  '/tmp/aggregator/bft-config/trust-base.json',
  // Path when running CLI inside aggregator network
  '/app/bft-config/trust-base.json',
  // Relative path for development
  './config/trust-base.json',
  // Project root config
  path.join(process.cwd(), 'trust-base.json')
];

/**
 * Load RootTrustBase from file or fallback to hardcoded configuration
 *
 * Strategy:
 * 1. If useFallback is true, skip file loading and use fallback immediately
 * 2. Try loading from specified filePath
 * 3. Try loading from default paths
 * 4. Fall back to hardcoded configuration
 *
 * @param config Configuration for TrustBase loading
 * @returns RootTrustBase instance
 * @throws Error if TrustBase cannot be loaded from any source
 */
export async function loadTrustBase(config: TrustBaseConfig = {}): Promise<RootTrustBase> {
  const { filePath, fallbackJson = DEFAULT_LOCAL_TRUSTBASE, useFallback = false } = config;

  // If useFallback is explicitly set, skip file loading
  if (useFallback) {
    console.log('Using hardcoded TrustBase configuration (fallback mode)');
    return RootTrustBase.fromJSON(fallbackJson);
  }

  // Try specified file path first
  if (filePath) {
    try {
      const trustBaseJson = await loadTrustBaseFromFile(filePath);
      console.log(`Loaded TrustBase from: ${filePath}`);
      return RootTrustBase.fromJSON(trustBaseJson);
    } catch (error) {
      console.warn(`Failed to load TrustBase from ${filePath}:`, (error as Error).message);
    }
  }

  // Try default paths
  for (const defaultPath of DEFAULT_TRUSTBASE_PATHS) {
    try {
      const trustBaseJson = await loadTrustBaseFromFile(defaultPath);
      console.log(`Loaded TrustBase from: ${defaultPath}`);
      return RootTrustBase.fromJSON(trustBaseJson);
    } catch (error) {
      // Silently continue to next path
    }
  }

  // Try to extract from running Docker aggregator
  console.log('Attempting to extract TrustBase from Docker aggregator...');
  const containerName = findAggregatorContainer();

  if (containerName) {
    console.log(`Found aggregator container: ${containerName}`);
    const dockerTrustBase = extractTrustBaseFromDocker(containerName);

    if (dockerTrustBase) {
      console.log(`✓ Loaded TrustBase from Docker container: ${containerName}`);
      return RootTrustBase.fromJSON(dockerTrustBase);
    } else {
      console.warn(`Failed to extract TrustBase from container: ${containerName}`);
    }
  } else {
    console.warn('No running aggregator container found');
  }

  // Fall back to hardcoded configuration (should not be used for --local)
  console.warn('Could not load TrustBase from file or Docker, using hardcoded configuration');
  console.warn('⚠️  WARNING: Hardcoded TrustBase may not match your aggregator!');
  console.warn('For local development, ensure Docker aggregator is running');

  return RootTrustBase.fromJSON(fallbackJson);
}

/**
 * Load and parse TrustBase JSON from a file
 *
 * @param filePath Path to trust-base.json file
 * @returns Parsed JSON object
 * @throws Error if file cannot be read or parsed
 */
async function loadTrustBaseFromFile(filePath: string): Promise<unknown> {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(fileContent);
}

/**
 * Attempt to extract TrustBase from running Docker aggregator
 *
 * @param containerName Docker container name (default: aggregator-service)
 * @returns Parsed TrustBase JSON or null if extraction fails
 */
function extractTrustBaseFromDocker(containerName: string = 'aggregator-service'): unknown | null {
  try {
    // Try to execute docker exec to read the trust-base.json
    const command = `docker exec ${containerName} cat /app/bft-config/trust-base.json`;
    const output = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(output);
  } catch (error) {
    // Docker command failed - container might not be running or doesn't exist
    return null;
  }
}

/**
 * Find running aggregator container name
 *
 * @returns Container name or null if not found
 */
function findAggregatorContainer(): string | null {
  try {
    const command = `docker ps --filter "name=aggregator" --format "{{.Names}}" | head -1`;
    const output = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const containerName = output.trim();
    return containerName || null;
  } catch (error) {
    return null;
  }
}

/**
 * Cached TrustBase instance to avoid repeated file I/O
 */
let cachedTrustBase: RootTrustBase | null = null;
let cachedConfig: string | null = null;

/**
 * Get TrustBase with caching support
 *
 * Caches the TrustBase instance to avoid repeated file loading.
 * Cache is invalidated if configuration changes.
 *
 * @param config Configuration for TrustBase loading
 * @returns Cached or newly loaded RootTrustBase instance
 */
export async function getCachedTrustBase(config: TrustBaseConfig = {}): Promise<RootTrustBase> {
  const configKey = JSON.stringify(config);

  if (cachedTrustBase && cachedConfig === configKey) {
    return cachedTrustBase;
  }

  cachedTrustBase = await loadTrustBase(config);
  cachedConfig = configKey;

  return cachedTrustBase;
}

/**
 * Clear the TrustBase cache
 * Useful for testing or when configuration changes
 */
export function clearTrustBaseCache(): void {
  cachedTrustBase = null;
  cachedConfig = null;
}

/**
 * Helper function to mount trust-base.json from Docker aggregator
 *
 * This provides instructions for users on how to mount the trust-base.json
 * from their Docker aggregator container.
 *
 * @returns Instructions string
 */
export function getTrustBaseMountInstructions(): string {
  return `
To load TrustBase dynamically from your Docker aggregator:

1. Mount the aggregator's trust-base.json as a volume when running CLI commands:

   docker run -v aggregator_bft-config:/tmp/aggregator/bft-config your-cli-image

2. Or copy it from the container to your local machine:

   docker cp aggregator-service:/app/bft-config/trust-base.json ./config/trust-base.json

3. Or specify a custom path using the TRUSTBASE_PATH environment variable:

   TRUSTBASE_PATH=/path/to/trust-base.json npm run mint-token
`;
}
