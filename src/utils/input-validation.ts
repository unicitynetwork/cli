/**
 * Input Validation Utilities for Unicity CLI
 *
 * This module provides comprehensive validation for all CLI inputs to prevent:
 * - Service crashes (like the CVSS 7.5 aggregator DoS vulnerability)
 * - Data corruption
 * - Confusing error messages
 * - Security vulnerabilities
 *
 * All validators return detailed error messages for user feedback.
 */

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: string;
}

/**
 * Validate RequestID format (272 bits = 68 hex characters)
 *
 * Format: [Algorithm 4 hex][Hash 64 hex]
 * Example: 0000ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055
 *
 * CRITICAL: Missing validation here caused aggregator DoS (CVSS 7.5)
 */
export function validateRequestId(requestId: string): ValidationResult {
  // Check if empty
  if (!requestId || requestId.trim() === '') {
    return {
      valid: false,
      error: 'RequestID cannot be empty',
      details: 'Please provide a valid RequestID obtained from register-request'
    };
  }

  const trimmed = requestId.trim();

  // Check length (must be exactly 68 hex characters)
  if (trimmed.length !== 68) {
    return {
      valid: false,
      error: `Invalid RequestID length: expected 68 characters, got ${trimmed.length}`,
      details: [
        'RequestID must be 68 hexadecimal characters (272 bits)',
        'Format: [Algorithm 4 chars][Hash 64 chars]',
        'Example: 0000ecbf70baaa355dc2d52a6a565fc3838b8da34df3ee062dbdedb86abf0e6c6055',
        '         ^^^^---- Algorithm prefix (0000 = SHA256)'
      ].join('\n')
    };
  }

  // Check if valid hexadecimal
  if (!/^[0-9a-fA-F]{68}$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid RequestID format: must contain only hexadecimal characters (0-9, a-f, A-F)',
      details: `Received: ${trimmed}`
    };
  }

  // Check algorithm prefix (must be 0000 for SHA256)
  const algorithmPrefix = trimmed.substring(0, 4);
  if (algorithmPrefix !== '0000') {
    return {
      valid: false,
      error: `Invalid RequestID algorithm: expected SHA256 (0000) prefix, got ${algorithmPrefix}`,
      details: [
        'RequestID must start with "0000" (SHA256 algorithm identifier)',
        'If you copied only the hash portion (64 characters), you\'re missing the algorithm prefix',
        'Use the FULL 68-character RequestID from register-request output'
      ].join('\n')
    };
  }

  return { valid: true };
}

/**
 * Validate Secret for cryptographic operations
 */
export function validateSecret(secret: string | undefined, commandName: string, skipValidation: boolean = false): ValidationResult {
  if (!secret || secret.trim() === '') {
    return {
      valid: false,
      error: 'Secret cannot be empty',
      details: `Set the SECRET environment variable: SECRET="your-secret" npm start -- ${commandName} ...`
    };
  }

  const trimmed = secret.trim();

  // If skipValidation is true, only check for non-empty (bypass strength checks)
  if (skipValidation) {
    console.warn('⚠️  WARNING: Secret validation bypassed (--unsafe-secret flag used).');
    console.warn('⚠️  This should ONLY be used for development/testing purposes!');
    return { valid: true };
  }

  // Minimum length check (prevent weak secrets)
  if (trimmed.length < 8) {
    return {
      valid: false,
      error: 'Secret is too short',
      details: 'Secret must be at least 8 characters for security. Use a strong, unique secret for production.'
    };
  }

  // Maximum length check (prevent DOS via memory exhaustion)
  if (trimmed.length > 1024) {
    return {
      valid: false,
      error: 'Secret is too long',
      details: 'Secret must be 1024 characters or less'
    };
  }

  // Warn if secret looks weak (optional - doesn't fail validation)
  if (/^(test|secret|password|123|abc|demo)/i.test(trimmed)) {
    console.warn('⚠️  Warning: Secret appears to be a weak test value. Use a strong, unique secret for production.');
  }

  return { valid: true };
}

/**
 * Validate Nonce format
 */
export function validateNonce(nonce: string | undefined, allowEmpty: boolean = false): ValidationResult {
  if (!nonce || nonce.trim() === '') {
    if (allowEmpty) {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'Nonce cannot be empty',
      details: 'Provide a nonce value or use --nonce option'
    };
  }

  const trimmed = nonce.trim();

  // Check for reasonable length
  if (trimmed.length > 256) {
    return {
      valid: false,
      error: 'Nonce is too long',
      details: 'Nonce must be 256 characters or less'
    };
  }

  return { valid: true };
}

/**
 * Validate Token Type (hex or preset name)
 */
export function validateTokenType(tokenType: string | undefined, allowEmpty: boolean = false): ValidationResult {
  if (!tokenType || tokenType.trim() === '') {
    if (allowEmpty) {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'Token type cannot be empty',
      details: 'Specify --token-type with either a preset name (uct, nft, alpha, usdu, euru) or 64-character hex'
    };
  }

  const trimmed = tokenType.trim();

  // Check if it's a preset name
  const validPresets = ['uct', 'nft', 'alpha', 'usdu', 'euru'];
  if (validPresets.includes(trimmed.toLowerCase())) {
    return { valid: true };
  }

  // Check if it's a valid 64-character hex (256-bit token type ID)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: 'Invalid token type format',
    details: [
      'Token type must be either:',
      '  1. A preset name: uct, nft, alpha, usdu, euru',
      '  2. A 64-character hexadecimal string (256-bit token type ID)',
      `Received: ${trimmed} (${trimmed.length} characters)`
    ].join('\n')
  };
}

/**
 * Validate Unicity Address format
 */
export function validateAddress(address: string): ValidationResult {
  if (!address || address.trim() === '') {
    return {
      valid: false,
      error: 'Address cannot be empty',
      details: 'Provide a valid Unicity address (DIRECT://...)'
    };
  }

  const trimmed = address.trim();

  // Check DIRECT:// prefix
  if (!trimmed.startsWith('DIRECT://')) {
    return {
      valid: false,
      error: 'Invalid address format: must start with "DIRECT://"',
      details: [
        'Unicity addresses use the format: DIRECT://<hex>',
        'Example: DIRECT://00006ac2d9f02908ea0b338ecd6730ad4145a4441e337a6dc4b13edca5bf27ea1af4a3d28754',
        'Generate an address using: npm start -- gen-address'
      ].join('\n')
    };
  }

  // Extract hex part after DIRECT://
  const hexPart = trimmed.substring(9); // Remove "DIRECT://"

  // Check if hex part is empty
  if (hexPart.length === 0) {
    return {
      valid: false,
      error: 'Invalid address: missing hex data after "DIRECT://"',
      details: 'Address must include hexadecimal data after the DIRECT:// prefix'
    };
  }

  // Check if hex part is valid hexadecimal
  if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
    return {
      valid: false,
      error: 'Invalid address: hex part contains non-hexadecimal characters',
      details: `Hex part must contain only 0-9, a-f, A-F. Received: ${hexPart}`
    };
  }

  // Check minimum length (addresses should be at least 66 hex chars = 33 bytes)
  if (hexPart.length < 66) {
    return {
      valid: false,
      error: `Invalid address: hex part too short (${hexPart.length} chars, minimum 66)`,
      details: 'Unicity addresses must be at least 66 hexadecimal characters after DIRECT://'
    };
  }

  return { valid: true };
}

/**
 * Validate recipient data hash (SHA256 hex string)
 * Used in send-token to commit to future recipient state data
 */
export function validateDataHash(hash: string | undefined, allowEmpty: boolean = true): ValidationResult {
  // Empty is allowed (optional parameter)
  if (!hash || hash.trim() === '') {
    if (allowEmpty) {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'Data hash cannot be empty',
      details: 'Provide a 64-character hexadecimal SHA256 hash'
    };
  }

  const trimmed = hash.trim();

  // Check format: must be exactly 64 hex characters (SHA256 = 256 bits = 32 bytes = 64 hex chars)
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const errors: string[] = [
      'Recipient data hash must be a 64-character hexadecimal string (SHA256 hash)',
      `Received: ${trimmed.substring(0, 70)}${trimmed.length > 70 ? '...' : ''} (${trimmed.length} characters)`
    ];

    if (trimmed.length !== 64) {
      errors.push(`Expected: 64 characters, Got: ${trimmed.length}`);
    }

    if (!/^[0-9a-fA-F]+$/.test(trimmed)) {
      errors.push('Hash must contain only hexadecimal characters (0-9, a-f, A-F)');
    }

    return {
      valid: false,
      error: 'Invalid data hash format',
      details: errors.join('\n')
    };
  }

  return { valid: true };
}

/**
 * Validate file path exists and is readable
 */
export function validateFilePath(filePath: string, fileDescription: string = 'File'): ValidationResult {
  if (!filePath || filePath.trim() === '') {
    return {
      valid: false,
      error: `${fileDescription} path cannot be empty`,
      details: 'Specify a valid file path'
    };
  }

  // Note: Actual file existence check requires fs module
  // This should be done in the command handler with fs.existsSync()
  // Here we just validate the path format

  const trimmed = filePath.trim();

  // Check for path traversal attempts (security)
  if (trimmed.includes('..')) {
    return {
      valid: false,
      error: `${fileDescription} path contains invalid sequence (..)`,
      details: 'Path traversal is not allowed for security reasons'
    };
  }

  return { valid: true };
}

/**
 * Validate amount/value (must be positive number)
 */
export function validateAmount(amount: string | undefined, fieldName: string = 'Amount'): ValidationResult {
  if (!amount || amount.trim() === '') {
    return {
      valid: false,
      error: `${fieldName} cannot be empty`,
      details: 'Specify a valid numeric amount'
    };
  }

  const trimmed = amount.trim();

  // Check if it's a valid number
  const numValue = Number(trimmed);
  if (isNaN(numValue)) {
    return {
      valid: false,
      error: `${fieldName} must be a valid number`,
      details: `Received: ${trimmed}`
    };
  }

  // Check if positive
  if (numValue <= 0) {
    return {
      valid: false,
      error: `${fieldName} must be greater than zero`,
      details: `Received: ${numValue}`
    };
  }

  // Check for reasonable upper bound (prevent overflow)
  if (numValue > Number.MAX_SAFE_INTEGER) {
    return {
      valid: false,
      error: `${fieldName} exceeds maximum safe integer`,
      details: `Maximum: ${Number.MAX_SAFE_INTEGER}, Received: ${numValue}`
    };
  }

  return { valid: true };
}

/**
 * Validate endpoint URL
 */
export function validateEndpoint(endpoint: string): ValidationResult {
  if (!endpoint || endpoint.trim() === '') {
    return {
      valid: false,
      error: 'Endpoint URL cannot be empty'
    };
  }

  const trimmed = endpoint.trim();

  // Check if it's a valid URL format
  try {
    const url = new URL(trimmed);

    // Check protocol
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        valid: false,
        error: 'Endpoint must use HTTP or HTTPS protocol',
        details: `Received protocol: ${url.protocol}`
      };
    }

    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: 'Invalid endpoint URL format',
      details: `Received: ${trimmed}\nError: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/**
 * Utility function to throw validation error with formatted message
 */
export function throwValidationError(result: ValidationResult, exitCode: number = 1): never {
  console.error(`\n❌ Validation Error: ${result.error}`);
  if (result.details) {
    console.error(`\n${result.details}`);
  }
  console.error('');
  process.exit(exitCode);
}

/**
 * Validate and return value, or exit with error
 */
export function validateOrExit<T>(
  value: T,
  validator: (val: T) => ValidationResult,
  context?: string
): T {
  const result = validator(value);
  if (!result.valid) {
    if (context) {
      console.error(`\nContext: ${context}`);
    }
    throwValidationError(result);
  }
  return value;
}
