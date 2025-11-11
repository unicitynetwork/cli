import { Command } from 'commander';
import { DataHasher } from '@unicitylabs/state-transition-sdk/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/state-transition-sdk/lib/hash/HashAlgorithm.js';
import { HexConverter } from '@unicitylabs/state-transition-sdk/lib/util/HexConverter.js';
import * as fs from 'fs';

/**
 * Normalize JSON to canonical form for deterministic hashing
 *
 * This function ensures that different string representations of the same JSON
 * produce identical hashes by:
 * - Recursively sorting object keys alphabetically
 * - Preserving array ordering (arrays are NOT sorted)
 * - Using compact serialization (no whitespace)
 *
 * @param jsonString - JSON string to normalize
 * @returns Canonical JSON string
 * @throws Error if input is not valid JSON
 *
 * @example
 * // Different key order produces same output
 * normalizeJSON('{"b":2,"a":1}') === normalizeJSON('{"a":1,"b":2}')
 * // Returns: '{"a":1,"b":2}'
 *
 * @example
 * // Nested objects are sorted, arrays preserve order
 * normalizeJSON('{"users":[{"name":"Bob","id":2}]}')
 * // Returns: '{"users":[{"id":2,"name":"Bob"}]}'
 */
function normalizeJSON(jsonString: string): string {
  // Parse JSON (throws if invalid)
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  /**
   * Recursively sort object keys
   */
  function sortKeys(obj: unknown): unknown {
    // Primitives: null, boolean, number, string
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    // Arrays: preserve order but recursively sort nested objects
    if (Array.isArray(obj)) {
      return obj.map(sortKeys);
    }

    // Objects: sort keys alphabetically
    const sortedObj: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sortedObj[key] = sortKeys((obj as Record<string, unknown>)[key]);
    }

    return sortedObj;
  }

  // Sort keys recursively and serialize with no whitespace
  const normalized = sortKeys(parsed);
  return JSON.stringify(normalized);
}

/**
 * Read input from --data flag, --file flag, or stdin
 * Priority: --data > --file > stdin
 */
async function getInput(options: { data?: string; file?: string }): Promise<string> {
  // 1. Check --data flag
  if (options.data) {
    return options.data;
  }

  // 2. Check --file flag
  if (options.file) {
    if (!fs.existsSync(options.file)) {
      throw new Error(`File not found: ${options.file}`);
    }
    return fs.readFileSync(options.file, 'utf-8');
  }

  // 3. Check stdin (if piped)
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const input = Buffer.concat(chunks).toString('utf-8').trim();

    if (!input) {
      throw new Error('stdin is empty');
    }

    return input;
  }

  // No input provided
  throw new Error('No input provided. Use --data <json>, --file <path>, or pipe JSON via stdin');
}

/**
 * Format bytes as hex string with spaces for readability
 * Example: "7b 22 61 22 3a 31 7d"
 */
function formatBytesHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
}

export function hashDataCommand(program: Command): void {
  program
    .command('hash-data')
    .description('Compute deterministic hash of JSON data for use with send-token --recipient-data-hash')
    .option('-d, --data <json>', 'JSON string to hash')
    .option('-f, --file <path>', 'Read JSON from file')
    .option('--raw-hash', 'Output only 64-char hash (without algorithm prefix)')
    .option('--verbose', 'Show normalization steps and details')
    .action(async (options) => {
      try {
        // STEP 1: Get input from --data, --file, or stdin
        let jsonInput: string;
        try {
          jsonInput = await getInput(options);
        } catch (error) {
          console.error('\n❌ Error reading input:');
          console.error(`  ${error instanceof Error ? error.message : String(error)}`);
          console.error('\nUsage:');
          console.error('  npm run hash-data -- --data \'{"key":"value"}\'');
          console.error('  npm run hash-data -- --file state.json');
          console.error('  echo \'{"key":"value"}\' | npm run hash-data');
          process.exit(1);
        }

        if (options.verbose) {
          console.error(`Input JSON:      ${jsonInput.trim()}`);
        }

        // STEP 2: Normalize JSON (canonical form)
        let normalizedJson: string;
        try {
          normalizedJson = normalizeJSON(jsonInput);
        } catch (error) {
          console.error('\n❌ Error normalizing JSON:');
          console.error(`  ${error instanceof Error ? error.message : String(error)}`);
          console.error('\nMake sure your input is valid JSON.');
          process.exit(1);
        }

        if (options.verbose) {
          console.error(`Normalized JSON: ${normalizedJson}`);
        }

        // STEP 3: Convert to UTF-8 bytes
        const normalizedBytes = new TextEncoder().encode(normalizedJson);

        if (options.verbose) {
          console.error(`Bytes (UTF-8):   ${formatBytesHex(normalizedBytes)}  (${normalizedBytes.length} bytes)`);
          console.error(`Algorithm:       SHA256`);
        }

        // STEP 4: Hash using SDK DataHasher
        const hasher = new DataHasher(HashAlgorithm.SHA256);
        const hash = await hasher.update(normalizedBytes).digest();

        // Extract raw hash (64 hex chars)
        const rawHash = HexConverter.encode(hash.data);

        // Get full imprint (algorithm prefix + hash = 68 chars)
        const imprint = hash.toJSON();

        if (options.verbose) {
          console.error(`Raw Hash:        ${rawHash}`);
          console.error(`Imprint:         ${imprint}`);
        }

        // STEP 5: Output result
        if (options.rawHash) {
          // Output raw 64-char hash only
          console.log(rawHash);
        } else {
          // Output full 68-char imprint (default - compatible with send-token)
          console.log(imprint);
        }

        // Success message (stderr, won't interfere with stdout piping)
        if (options.verbose) {
          console.error('\n✅ Hash computed successfully');
          console.error('\nUsage with send-token:');
          console.error(`  npm run send-token -- -f token.txf -r <address> --recipient-data-hash ${imprint}`);
        }

      } catch (error) {
        console.error('\n❌ Error computing hash:');
        if (error instanceof Error) {
          console.error(`  Message: ${error.message}`);
          if (error.stack && options.verbose) {
            console.error(`  Stack trace:\n${error.stack}`);
          }
        } else {
          console.error(`  Error details: ${JSON.stringify(error, null, 2)}`);
        }
        process.exit(1);
      }
    });
}
