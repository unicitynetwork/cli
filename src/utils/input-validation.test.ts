/**
 * Unit tests for input validation utilities
 *
 * These tests verify that all validators correctly accept valid inputs
 * and reject invalid inputs with appropriate error messages.
 *
 * Run with: npm test src/utils/input-validation.test.ts
 */

import {
  validateRequestId,
  validateSecret,
  validateNonce,
  validateTokenType,
  validateAddress,
  validateFilePath,
  validateAmount,
  validateEndpoint
} from './input-validation.js';

// Mock test framework functions for now (will be replaced with proper test runner)
const describe = (name: string, fn: () => void) => fn();
const it = (name: string, fn: () => void) => fn();
const expect = (value: any) => ({
  toBe: (expected: any) => {
    if (value !== expected) throw new Error(`Expected ${expected}, got ${value}`);
  },
  toBeUndefined: () => {
    if (value !== undefined) throw new Error(`Expected undefined, got ${value}`);
  },
  toContain: (substring: string) => {
    if (!String(value).includes(substring)) {
      throw new Error(`Expected "${value}" to contain "${substring}"`);
    }
  }
});

describe('validateRequestId', () => {
  it('should accept valid 68-character hex RequestID with 0000 prefix', () => {
    const valid = '0000ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055';
    const result = validateRequestId(valid);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject empty RequestID', () => {
    const result = validateRequestId('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot be empty');
  });

  it('should reject RequestID with wrong length (64 chars)', () => {
    const invalid = 'ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055';
    const result = validateRequestId(invalid);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('expected 68 characters');
    expect(result.error).toContain('got 64');
  });

  it('should reject RequestID with wrong algorithm prefix', () => {
    const invalid = 'FFFFecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055';
    const result = validateRequestId(invalid);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('expected SHA256 (0000) prefix');
    expect(result.error).toContain('got FFFF');
  });

  it('should reject RequestID with non-hex characters', () => {
    const invalid = '0000ZZZZ70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055';
    const result = validateRequestId(invalid);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must contain only hexadecimal');
  });

  it('should accept uppercase hex characters', () => {
    const valid = '0000ECBF70BAAA355DC2D52A6A565FC3838B8DA34DF3EE062DBDEDB86ABF0E6C6055';
    const result = validateRequestId(valid);
    expect(result.valid).toBe(true);
  });
});

describe('validateSecret', () => {
  it('should accept valid secret (8+ characters)', () => {
    const result = validateSecret('strongSecret123', 'test-command');
    expect(result.valid).toBe(true);
  });

  it('should reject empty secret', () => {
    const result = validateSecret('', 'test-command');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot be empty');
  });

  it('should reject undefined secret', () => {
    const result = validateSecret(undefined, 'test-command');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot be empty');
  });

  it('should reject secret shorter than 8 characters', () => {
    const result = validateSecret('short', 'test-command');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too short');
    expect(result.details).toContain('at least 8 characters');
  });

  it('should reject secret longer than 1024 characters', () => {
    const longSecret = 'a'.repeat(1025);
    const result = validateSecret(longSecret, 'test-command');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too long');
  });

  it('should accept secret exactly 1024 characters', () => {
    const maxSecret = 'a'.repeat(1024);
    const result = validateSecret(maxSecret, 'test-command');
    expect(result.valid).toBe(true);
  });
});

describe('validateNonce', () => {
  it('should accept valid nonce', () => {
    const result = validateNonce('test-nonce-123', false);
    expect(result.valid).toBe(true);
  });

  it('should accept empty nonce when allowEmpty is true', () => {
    const result = validateNonce('', true);
    expect(result.valid).toBe(true);
  });

  it('should reject empty nonce when allowEmpty is false', () => {
    const result = validateNonce('', false);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot be empty');
  });

  it('should reject nonce longer than 256 characters', () => {
    const longNonce = 'a'.repeat(257);
    const result = validateNonce(longNonce, false);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too long');
  });
});

describe('validateTokenType', () => {
  it('should accept preset name: uct', () => {
    const result = validateTokenType('uct', false);
    expect(result.valid).toBe(true);
  });

  it('should accept preset name: nft', () => {
    const result = validateTokenType('nft', false);
    expect(result.valid).toBe(true);
  });

  it('should accept preset name: alpha', () => {
    const result = validateTokenType('alpha', false);
    expect(result.valid).toBe(true);
  });

  it('should accept valid 64-character hex token type', () => {
    const validHex = 'a'.repeat(64);
    const result = validateTokenType(validHex, false);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid preset name', () => {
    const result = validateTokenType('invalid', false);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid token type format');
  });

  it('should reject hex with wrong length', () => {
    const result = validateTokenType('abc123', false);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid token type format');
  });

  it('should accept empty when allowEmpty is true', () => {
    const result = validateTokenType('', true);
    expect(result.valid).toBe(true);
  });

  it('should reject empty when allowEmpty is false', () => {
    const result = validateTokenType('', false);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot be empty');
  });
});

describe('validateAddress', () => {
  it('should accept valid DIRECT:// address', () => {
    const valid = 'DIRECT://00006ac2d9f02908ea0b338ecd6730ad4145a4441e337a6dc4b13edca5bf27ea1af4a3d28754';
    const result = validateAddress(valid);
    expect(result.valid).toBe(true);
  });

  it('should reject address without DIRECT:// prefix', () => {
    const invalid = '00006ac2d9f02908ea0b338ecd6730ad4145a4441e337a6dc4b13edca5bf27ea1af4a3d28754';
    const result = validateAddress(invalid);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must start with "DIRECT://"');
  });

  it('should reject address with empty hex part', () => {
    const invalid = 'DIRECT://';
    const result = validateAddress(invalid);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('missing hex data');
  });

  it('should reject address with non-hex characters', () => {
    const invalid = 'DIRECT://ZZZZ6ac2d9f02908ea0b338ecd6730ad4145a4441e337a6dc4b13edca5bf27ea1af4a3d28754';
    const result = validateAddress(invalid);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('non-hexadecimal characters');
  });

  it('should reject address with hex part shorter than 66 chars', () => {
    const invalid = 'DIRECT://abc123';
    const result = validateAddress(invalid);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too short');
    expect(result.error).toContain('minimum 66');
  });

  it('should accept address with exactly 66 hex chars', () => {
    const valid = 'DIRECT://' + 'a'.repeat(66);
    const result = validateAddress(valid);
    expect(result.valid).toBe(true);
  });
});

describe('validateFilePath', () => {
  it('should accept normal file path', () => {
    const result = validateFilePath('/path/to/file.txf', 'Transaction file');
    expect(result.valid).toBe(true);
  });

  it('should reject path with .. (path traversal)', () => {
    const result = validateFilePath('../../../etc/passwd', 'File');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalid sequence (..)');
    expect(result.details).toContain('Path traversal');
  });

  it('should reject empty path', () => {
    const result = validateFilePath('', 'File');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot be empty');
  });
});

describe('validateAmount', () => {
  it('should accept valid positive number', () => {
    const result = validateAmount('100', 'Amount');
    expect(result.valid).toBe(true);
  });

  it('should accept decimal number', () => {
    const result = validateAmount('123.456', 'Amount');
    expect(result.valid).toBe(true);
  });

  it('should reject zero', () => {
    const result = validateAmount('0', 'Amount');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be greater than zero');
  });

  it('should reject negative number', () => {
    const result = validateAmount('-100', 'Amount');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be greater than zero');
  });

  it('should reject non-numeric value', () => {
    const result = validateAmount('abc', 'Amount');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be a valid number');
  });

  it('should reject empty value', () => {
    const result = validateAmount('', 'Amount');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot be empty');
  });

  it('should reject value exceeding MAX_SAFE_INTEGER', () => {
    const huge = (Number.MAX_SAFE_INTEGER + 1).toString();
    const result = validateAmount(huge, 'Amount');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum');
  });
});

describe('validateEndpoint', () => {
  it('should accept valid HTTP endpoint', () => {
    const result = validateEndpoint('http://localhost:3000');
    expect(result.valid).toBe(true);
  });

  it('should accept valid HTTPS endpoint', () => {
    const result = validateEndpoint('https://gateway.unicity.network');
    expect(result.valid).toBe(true);
  });

  it('should reject endpoint with invalid protocol', () => {
    const result = validateEndpoint('ftp://example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must use HTTP or HTTPS');
  });

  it('should reject malformed URL', () => {
    const result = validateEndpoint('not-a-url');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid endpoint URL format');
  });

  it('should reject empty endpoint', () => {
    const result = validateEndpoint('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot be empty');
  });
});

describe('Edge cases', () => {
  it('validateRequestId should handle whitespace-only input', () => {
    const result = validateRequestId('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot be empty');
  });

  it('validateSecret should trim whitespace before validation', () => {
    const result = validateSecret('  strongSecret  ', 'test');
    expect(result.valid).toBe(true);
  });

  it('validateAddress should trim whitespace', () => {
    const valid = '  DIRECT://00006ac2d9f02908ea0b338ecd6730ad4145a4441e337a6dc4b13edca5bf27ea1af4a3d28754  ';
    const result = validateAddress(valid);
    expect(result.valid).toBe(true);
  });

  it('validateTokenType should be case-insensitive for presets', () => {
    expect(validateTokenType('UCT', false).valid).toBe(true);
    expect(validateTokenType('Nft', false).valid).toBe(true);
    expect(validateTokenType('ALPHA', false).valid).toBe(true);
  });
});
