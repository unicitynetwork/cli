# Security Hardening Implementation Examples

**Purpose**: Practical code examples for implementing the 7 critical security gaps identified in the audit

---

## GAP-001: File Permission Enforcement

### Implementation

Create a utility function for secure file writing:

```typescript
// src/utils/secure-file-writer.ts
import * as fs from 'fs';
import * as path from 'path';

export interface SecureWriteOptions {
  mode?: number;
  warnOnInsecure?: boolean;
}

/**
 * Write file with secure permissions (owner-only by default)
 */
export function writeSecureFile(
  filePath: string,
  content: string,
  options: SecureWriteOptions = {}
): void {
  const mode = options.mode ?? 0o600; // Default: owner read/write only
  const warnOnInsecure = options.warnOnInsecure ?? true;

  // Write file
  fs.writeFileSync(filePath, content, { mode });

  // Verify permissions were set correctly
  const stats = fs.statSync(filePath);
  const actualMode = stats.mode & 0o777;

  if (actualMode !== mode && warnOnInsecure) {
    console.error('⚠️  WARNING: File permissions may not be as restrictive as intended.');
    console.error(`    Expected: ${mode.toString(8)}, Actual: ${actualMode.toString(8)}`);
    console.error('    On some systems (like Windows), permissions may differ.');
  }

  console.error(`✓ Token file created with restricted permissions (${mode.toString(8)})`);
  console.error('  Only the file owner can read/write this file.');
}
```

### Integration into Commands

**mint-token.ts**:
```typescript
import { writeSecureFile } from '../utils/secure-file-writer.js';

// Replace this:
// fs.writeFileSync(outputFile, tokenJson);

// With this:
writeSecureFile(outputFile, tokenJson, { mode: 0o600 });
```

**send-token.ts** and **receive-token.ts**: Same change

---

## GAP-002: Path Traversal Validation

### Implementation

Create a path validation utility:

```typescript
// src/utils/path-validator.ts
import * as path from 'path';
import * as fs from 'fs';

export interface PathValidationOptions {
  allowAbsolute?: boolean;
  allowTraversal?: boolean;
  baseDir?: string;
}

export class PathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathValidationError';
  }
}

/**
 * Validate output path for security
 * Prevents directory traversal and restricts to safe locations
 */
export function validateOutputPath(
  inputPath: string,
  options: PathValidationOptions = {}
): string {
  const allowAbsolute = options.allowAbsolute ?? false;
  const allowTraversal = options.allowTraversal ?? false;
  const baseDir = options.baseDir ?? process.cwd();

  // Check for null bytes (old attack vector)
  if (inputPath.includes('\0')) {
    throw new PathValidationError('Path contains null byte');
  }

  // Check for absolute paths
  if (path.isAbsolute(inputPath) && !allowAbsolute) {
    console.error('⚠️  WARNING: Absolute path provided.');
    console.error('    For security, consider using relative paths in current directory.');
    // Don't throw - just warn (user may have legitimate reason)
  }

  // Check for directory traversal
  if (inputPath.includes('..') && !allowTraversal) {
    throw new PathValidationError(
      'Directory traversal (..) not allowed. Use paths within current directory.'
    );
  }

  // Resolve path and check it's within base directory
  const resolvedPath = path.resolve(baseDir, inputPath);
  const normalizedBase = path.normalize(baseDir);

  if (!resolvedPath.startsWith(normalizedBase)) {
    throw new PathValidationError(
      `Path resolves outside base directory.\n` +
      `  Base: ${normalizedBase}\n` +
      `  Resolved: ${resolvedPath}`
    );
  }

  // Check for special files (optional, platform-specific)
  const basename = path.basename(resolvedPath);
  if (basename.startsWith('.') && basename.length > 1) {
    console.error(`⚠️  WARNING: Writing to hidden file: ${basename}`);
  }

  // Check parent directory exists
  const parentDir = path.dirname(resolvedPath);
  if (!fs.existsSync(parentDir)) {
    throw new PathValidationError(
      `Parent directory does not exist: ${parentDir}`
    );
  }

  return resolvedPath;
}

/**
 * Validate and prepare output file path
 */
export function validateTokenOutputPath(filePath: string): string {
  try {
    const validatedPath = validateOutputPath(filePath, {
      allowAbsolute: false,
      allowTraversal: false
    });

    // Check for .txf extension
    if (!validatedPath.endsWith('.txf')) {
      console.error('⚠️  WARNING: Output file does not have .txf extension');
      console.error('    Token files should use .txf extension for consistency');
    }

    return validatedPath;
  } catch (error) {
    if (error instanceof PathValidationError) {
      console.error('❌ Invalid output path:');
      console.error(`   ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}
```

### Integration into Commands

**All commands with `-o` option**:
```typescript
import { validateTokenOutputPath } from '../utils/path-validator.js';

// Before writing file:
if (options.output) {
  outputFile = validateTokenOutputPath(options.output);
}
```

---

## GAP-003: Secret Strength Validation

### Implementation

```typescript
// src/utils/secret-validator.ts
import { createHash } from 'crypto';

export interface SecretValidationResult {
  isStrong: boolean;
  warnings: string[];
  score: number; // 0-100
}

/**
 * Known weak/common passwords (small sample - in production use larger list)
 */
const COMMON_PASSWORDS = [
  'password', '123456', '12345678', 'qwerty', 'abc123',
  'monkey', '1234567', 'letmein', 'trustno1', 'dragon',
  'baseball', 'iloveyou', 'master', 'sunshine', 'ashley',
  'bailey', 'passw0rd', 'shadow', '123123', '654321',
  'superman', 'qazwsx', 'michael', 'football', 'test',
  'secret', 'admin', 'root', 'user', 'default'
];

/**
 * Check if secret appears in common password lists
 * In production, use: https://haveibeenpwned.com/Passwords
 */
function isCommonPassword(secret: string): boolean {
  const lower = secret.toLowerCase();
  return COMMON_PASSWORDS.some(pwd => lower.includes(pwd));
}

/**
 * Calculate entropy score (0-100)
 */
function calculateEntropy(secret: string): number {
  const length = secret.length;
  const uniqueChars = new Set(secret).size;

  // Character set diversity
  const hasLower = /[a-z]/.test(secret);
  const hasUpper = /[A-Z]/.test(secret);
  const hasDigit = /[0-9]/.test(secret);
  const hasSpecial = /[^a-zA-Z0-9]/.test(secret);
  const charSetBonus = (hasLower ? 1 : 0) + (hasUpper ? 1 : 0) +
                       (hasDigit ? 1 : 0) + (hasSpecial ? 1 : 0);

  // Simple scoring
  let score = 0;
  score += Math.min(length * 3, 40);        // Length (max 40)
  score += Math.min(uniqueChars * 2, 30);   // Diversity (max 30)
  score += charSetBonus * 7.5;              // Char types (max 30)

  return Math.min(Math.round(score), 100);
}

/**
 * Validate secret strength and provide feedback
 */
export function validateSecretStrength(secret: string): SecretValidationResult {
  const warnings: string[] = [];
  let isStrong = true;

  // Check length
  if (secret.length < 8) {
    warnings.push('Secret is too short (minimum 8 characters recommended)');
    isStrong = false;
  } else if (secret.length < 12) {
    warnings.push('Secret is short. Recommended: 12+ characters for better security');
  }

  // Check for common passwords
  if (isCommonPassword(secret)) {
    warnings.push('Secret appears to be a common password. Use a unique secret!');
    isStrong = false;
  }

  // Check character diversity
  const uniqueChars = new Set(secret).size;
  if (uniqueChars < 6) {
    warnings.push(`Low character diversity (${uniqueChars} unique chars). Mix letters, numbers, symbols.`);
  }

  // Check for repeated patterns
  if (/(.)\1{3,}/.test(secret)) {
    warnings.push('Secret contains repeated characters (e.g., "aaaa")');
  }

  // Check for sequential patterns
  if (/(?:abc|bcd|cde|123|234|345|678|789)/i.test(secret)) {
    warnings.push('Secret contains sequential characters (e.g., "abc", "123")');
  }

  // Calculate overall score
  const score = calculateEntropy(secret);

  if (score < 40) {
    warnings.push(`Secret strength: WEAK (score: ${score}/100)`);
    isStrong = false;
  } else if (score < 60) {
    warnings.push(`Secret strength: MODERATE (score: ${score}/100)`);
  }

  return { isStrong, warnings, score };
}

/**
 * Display secret strength warnings
 */
export function displaySecretWarnings(validation: SecretValidationResult): void {
  if (validation.warnings.length === 0) {
    console.error('✓ Secret strength: STRONG');
    return;
  }

  if (!validation.isStrong) {
    console.error('\n⚠️  SECURITY WARNING: Weak secret detected!');
  } else {
    console.error('\n⚠️  Secret strength warnings:');
  }

  validation.warnings.forEach(warning => {
    console.error(`   • ${warning}`);
  });

  if (!validation.isStrong) {
    console.error('\n   Recommendation: Use a strong, unique secret for security.');
    console.error('   Consider using a password manager to generate strong secrets.\n');
  } else {
    console.error();
  }
}
```

### Integration into Commands

**Modify getSecret() function**:
```typescript
import { validateSecretStrength, displaySecretWarnings } from '../utils/secret-validator.js';

async function getSecret(): Promise<Uint8Array> {
  // Existing code...
  const secretStr = /* get from env or prompt */;

  // NEW: Validate strength
  const validation = validateSecretStrength(secretStr);
  displaySecretWarnings(validation);

  // Optionally require confirmation for weak secrets
  if (!validation.isStrong) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr
    });

    const answer = await new Promise<string>(resolve => {
      rl.question('Continue with weak secret? (yes/no): ', resolve);
      rl.close();
    });

    if (answer.toLowerCase() !== 'yes') {
      console.error('Aborted. Please use a stronger secret.');
      process.exit(0);
    }
  }

  return new TextEncoder().encode(secretStr);
}
```

---

## GAP-005: Input Size Limits

### Implementation

```typescript
// src/utils/input-validator.ts
export const INPUT_LIMITS = {
  MAX_TOKEN_DATA_SIZE: 10 * 1024 * 1024,    // 10MB
  MAX_MESSAGE_SIZE: 10 * 1024,              // 10KB
  MAX_NONCE_SIZE: 64,                       // 64 hex chars = 32 bytes
  MAX_COIN_AMOUNT: BigInt('1000000000000000000000000'), // 1 billion tokens
  MAX_FILE_SIZE: 50 * 1024 * 1024,          // 50MB for reading TXF files
};

export class InputSizeError extends Error {
  constructor(message: string, public readonly size: number, public readonly limit: number) {
    super(message);
    this.name = 'InputSizeError';
  }
}

/**
 * Validate token data size
 */
export function validateTokenDataSize(data: Uint8Array): void {
  if (data.length > INPUT_LIMITS.MAX_TOKEN_DATA_SIZE) {
    throw new InputSizeError(
      `Token data too large: ${formatBytes(data.length)} (limit: ${formatBytes(INPUT_LIMITS.MAX_TOKEN_DATA_SIZE)})`,
      data.length,
      INPUT_LIMITS.MAX_TOKEN_DATA_SIZE
    );
  }

  // Warn if approaching limit
  if (data.length > INPUT_LIMITS.MAX_TOKEN_DATA_SIZE * 0.8) {
    console.error('⚠️  WARNING: Token data size is approaching limit');
    console.error(`   Size: ${formatBytes(data.length)} / ${formatBytes(INPUT_LIMITS.MAX_TOKEN_DATA_SIZE)}`);
  }
}

/**
 * Validate message size
 */
export function validateMessageSize(message: string): void {
  const size = new TextEncoder().encode(message).length;

  if (size > INPUT_LIMITS.MAX_MESSAGE_SIZE) {
    throw new InputSizeError(
      `Message too large: ${formatBytes(size)} (limit: ${formatBytes(INPUT_LIMITS.MAX_MESSAGE_SIZE)})`,
      size,
      INPUT_LIMITS.MAX_MESSAGE_SIZE
    );
  }
}

/**
 * Validate coin amount
 */
export function validateCoinAmount(amount: bigint): void {
  if (amount < 0n) {
    throw new Error('Coin amount cannot be negative');
  }

  if (amount > INPUT_LIMITS.MAX_COIN_AMOUNT) {
    throw new InputSizeError(
      `Coin amount too large: ${amount} (limit: ${INPUT_LIMITS.MAX_COIN_AMOUNT})`,
      Number(amount),
      Number(INPUT_LIMITS.MAX_COIN_AMOUNT)
    );
  }
}

/**
 * Validate file size before reading
 */
export function validateFileSize(filePath: string): void {
  const stats = fs.statSync(filePath);

  if (stats.size > INPUT_LIMITS.MAX_FILE_SIZE) {
    throw new InputSizeError(
      `File too large: ${formatBytes(stats.size)} (limit: ${formatBytes(INPUT_LIMITS.MAX_FILE_SIZE)})`,
      stats.size,
      INPUT_LIMITS.MAX_FILE_SIZE
    );
  }
}

/**
 * Format bytes for human-readable display
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
```

### Integration into Commands

**mint-token.ts**:
```typescript
import { validateTokenDataSize, validateCoinAmount } from '../utils/input-validator.js';

// After processing token data
if (options.tokenData) {
  tokenDataBytes = await processInput(options.tokenData, 'token data', { allowEmpty: false });
  validateTokenDataSize(tokenDataBytes); // NEW
}

// When processing coins
if (options.coins) {
  const coinAmounts = options.coins.split(',').map((s: string) => BigInt(s.trim()));
  coinAmounts.forEach(amount => validateCoinAmount(amount)); // NEW
}
```

**send-token.ts**:
```typescript
import { validateMessageSize, validateFileSize } from '../utils/input-validator.js';

// Before loading file
validateFileSize(options.file); // NEW

// When processing message
if (options.message) {
  validateMessageSize(options.message); // NEW
  messageBytes = new TextEncoder().encode(options.message);
}
```

---

## GAP-006: HTTPS Enforcement Warning

### Implementation

```typescript
// src/utils/endpoint-validator.ts
export interface EndpointValidation {
  isSecure: boolean;
  warnings: string[];
  shouldContinue: boolean;
}

/**
 * Validate endpoint URL security
 */
export function validateEndpoint(endpoint: string): EndpointValidation {
  const warnings: string[] = [];
  let isSecure = true;
  let shouldContinue = true;

  try {
    const url = new URL(endpoint);

    // Check protocol
    if (url.protocol === 'http:') {
      isSecure = false;

      // Allow localhost/127.0.0.1 without warning
      const isLocalhost = url.hostname === 'localhost' ||
                         url.hostname === '127.0.0.1' ||
                         url.hostname === '::1';

      if (!isLocalhost) {
        warnings.push('⚠️  SECURITY WARNING: Using unencrypted HTTP connection!');
        warnings.push('   • Network traffic can be intercepted and modified');
        warnings.push('   • Suitable for development only, NOT production');
        warnings.push('   • Use HTTPS endpoints for production environments');
      }
    }

    // Check for default/well-known ports
    if (url.protocol === 'http:' && url.port === '80') {
      warnings.push('ℹ️  Using default HTTP port 80');
    }
    if (url.protocol === 'https:' && url.port === '443') {
      // Normal, no warning
    }

    // Validate hostname
    if (!url.hostname) {
      warnings.push('⚠️  WARNING: Endpoint has no hostname');
      shouldContinue = false;
    }

  } catch (error) {
    warnings.push('❌ ERROR: Invalid endpoint URL format');
    warnings.push(`   ${error instanceof Error ? error.message : String(error)}`);
    shouldContinue = false;
    isSecure = false;
  }

  return { isSecure, warnings, shouldContinue };
}

/**
 * Display endpoint warnings and optionally require confirmation
 */
export async function displayEndpointWarnings(
  endpoint: string,
  requireConfirmation: boolean = false
): Promise<void> {
  const validation = validateEndpoint(endpoint);

  if (validation.warnings.length === 0) {
    return; // All good
  }

  console.error('');
  validation.warnings.forEach(warning => console.error(warning));
  console.error('');

  if (!validation.shouldContinue) {
    console.error('Cannot proceed with invalid endpoint.');
    process.exit(1);
  }

  if (requireConfirmation && !validation.isSecure) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr
    });

    const answer = await new Promise<string>(resolve => {
      rl.question('Continue with insecure connection? (yes/no): ', resolve);
      rl.close();
    });

    if (answer.toLowerCase() !== 'yes') {
      console.error('Aborted for security. Use HTTPS endpoint instead.');
      process.exit(0);
    }
  }
}
```

### Integration into Commands

**All commands with endpoint**:
```typescript
import { displayEndpointWarnings } from '../utils/endpoint-validator.js';

// After determining endpoint
await displayEndpointWarnings(endpoint, false); // Show warnings but don't require confirmation

// OR for stricter security:
await displayEndpointWarnings(endpoint, true);  // Require confirmation for HTTP
```

---

## Testing Examples

### Unit Tests

```typescript
// test/security/file-permissions.test.ts
import { writeSecureFile } from '../src/utils/secure-file-writer';
import * as fs from 'fs';

describe('GAP-001: File Permission Enforcement', () => {
  const testFile = '/tmp/test-token.txf';

  afterEach(() => {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  it('should create file with 0600 permissions', () => {
    writeSecureFile(testFile, '{"test": true}');

    const stats = fs.statSync(testFile);
    const mode = stats.mode & 0o777;

    expect(mode).toBe(0o600);
  });

  it('should be readable only by owner', () => {
    writeSecureFile(testFile, '{"test": true}');

    // On Unix systems, verify permissions
    if (process.platform !== 'win32') {
      const stats = fs.statSync(testFile);
      expect((stats.mode & 0o077)).toBe(0); // No group/other permissions
    }
  });
});

// test/security/path-validation.test.ts
describe('GAP-002: Path Traversal Prevention', () => {
  it('should reject directory traversal', () => {
    expect(() => {
      validateTokenOutputPath('../../../etc/passwd.txf');
    }).toThrow(PathValidationError);
  });

  it('should reject absolute paths outside CWD', () => {
    expect(() => {
      validateTokenOutputPath('/tmp/evil.txf');
    }).toThrow(PathValidationError);
  });

  it('should accept relative paths in CWD', () => {
    const result = validateTokenOutputPath('./token.txf');
    expect(result).toContain('token.txf');
    expect(result).toContain(process.cwd());
  });
});

// test/security/secret-validation.test.ts
describe('GAP-003: Secret Strength Validation', () => {
  it('should detect common passwords', () => {
    const result = validateSecretStrength('password123');
    expect(result.isStrong).toBe(false);
    expect(result.warnings.some(w => w.includes('common'))).toBe(true);
  });

  it('should detect short secrets', () => {
    const result = validateSecretStrength('abc');
    expect(result.isStrong).toBe(false);
    expect(result.warnings.some(w => w.includes('short'))).toBe(true);
  });

  it('should accept strong secrets', () => {
    const result = validateSecretStrength('MyStr0ng!P@ssw0rd#2024');
    expect(result.isStrong).toBe(true);
    expect(result.score).toBeGreaterThan(60);
  });
});
```

### Integration Test

```bash
#!/bin/bash
# test/security/integration-test.sh

echo "=== Security Integration Tests ==="

# Test 1: File permissions
echo "Test 1: File permission enforcement"
SECRET="test-secret" npm run mint-token -- --preset nft -o test-perm.txf --save
PERMS=$(stat -c "%a" test-perm.txf 2>/dev/null || stat -f "%A" test-perm.txf)
if [ "$PERMS" = "600" ]; then
  echo "✓ PASS: File permissions are 600"
else
  echo "✗ FAIL: File permissions are $PERMS (expected 600)"
fi
rm test-perm.txf

# Test 2: Path traversal rejection
echo ""
echo "Test 2: Path traversal rejection"
if SECRET="test-secret" npm run mint-token -- --preset nft -o "../evil.txf" 2>&1 | grep -q "traversal"; then
  echo "✓ PASS: Path traversal blocked"
else
  echo "✗ FAIL: Path traversal not blocked"
fi

# Test 3: Weak secret warning
echo ""
echo "Test 3: Weak secret warning"
if echo "test" | SECRET="test" npm run gen-address 2>&1 | grep -q "WARNING.*weak"; then
  echo "✓ PASS: Weak secret detected"
else
  echo "⚠️  WARN: Weak secret not detected"
fi

echo ""
echo "=== Integration Tests Complete ==="
```

---

## Deployment Checklist

Before deploying to production, ensure:

- [ ] All 7 security gaps implemented
- [ ] Unit tests passing for security validations
- [ ] Integration tests executed successfully
- [ ] File permissions set correctly (600) on all token files
- [ ] HTTPS endpoints used (or warnings displayed)
- [ ] Secret strength validation active
- [ ] Path traversal prevention in place
- [ ] Input size limits enforced
- [ ] Documentation updated with security guidelines
- [ ] Security audit log reviewed

---

## User Security Guidelines

Add to documentation:

### For Users

1. **Strong Secrets**: Use 12+ character secrets with mix of letters, numbers, symbols
2. **File Security**: Store token files in secure location with proper permissions
3. **Network Security**: Always use HTTPS endpoints for production
4. **Backup Strategy**: Keep encrypted backups of token files
5. **Verification**: Always verify tokens before sending large amounts

### For Developers

1. **Review PRs**: Check for security implications in code changes
2. **Dependency Audits**: Run `npm audit` regularly
3. **Security Testing**: Execute security test suite before releases
4. **Incident Response**: Have plan for security issue disclosure
5. **Updates**: Keep SDK and dependencies up to date

---

**END OF HARDENING EXAMPLES**
