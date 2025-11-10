# --unsafe-secret Flag Implementation

**Date:** 2025-11-10
**Status:** Completed
**Scope:** All secret-handling CLI commands

## Overview

Added `--unsafe-secret` flag to bypass secret strength validation across all CLI commands that handle user secrets. This flag is intended for development and testing purposes only.

## Changes

### 1. Core Validation Function

**File:** `src/utils/input-validation.ts`

Updated `validateSecret()` function signature:

```typescript
export function validateSecret(
  secret: string | undefined,
  commandName: string,
  skipValidation: boolean = false  // NEW PARAMETER
): ValidationResult
```

**Behavior:**
- When `skipValidation = true`:
  - Only checks for non-empty secret
  - Bypasses minimum length check (8 characters)
  - Bypasses maximum length check (1024 characters)
  - Shows warning messages about unsafe usage
- When `skipValidation = false` (default):
  - Maintains all existing validation rules

### 2. Command Updates

All commands updated to accept and pass through the flag:

#### Commands Modified:
1. **mint-token** (`src/commands/mint-token.ts`)
2. **send-token** (`src/commands/send-token.ts`)
3. **receive-token** (`src/commands/receive-token.ts`)
4. **gen-address** (`src/commands/gen-address.ts`)
5. **register-request** (`src/commands/register-request.ts`)

#### Pattern Applied:

```typescript
// 1. Add Commander option
.option('--unsafe-secret', 'Skip secret strength validation (for development/testing only)')

// 2. Update getSecret() or readSecret() function signature
async function getSecret(skipValidation: boolean = false): Promise<Uint8Array> {
  // ... secret retrieval logic ...

  // Pass skipValidation to validateSecret
  const validation = validateSecret(secret, 'command-name', skipValidation);
}

// 3. Pass options.unsafeSecret to getSecret()
const secret = await getSecret(options.unsafeSecret);
```

## Usage Examples

### Without Flag (Default Behavior)
```bash
# Fails with weak secret
SECRET="test" npm run gen-address
# Error: Secret is too short (minimum 8 characters)
```

### With --unsafe-secret Flag
```bash
# Succeeds with weak secret (shows warnings)
SECRET="test" npm run gen-address -- --unsafe-secret
# ⚠️  WARNING: Secret validation bypassed (--unsafe-secret flag used).
# ⚠️  This should ONLY be used for development/testing purposes!
# (proceeds with address generation)
```

### All Commands
```bash
# mint-token
SECRET="test" npm run mint-token -- --unsafe-secret --local -d '{"test":"data"}' --save

# send-token
SECRET="sender" npm run send-token -- --unsafe-secret -f token.txf -r "DIRECT://..." --save

# receive-token
SECRET="recv" npm run receive-token -- --unsafe-secret -f transfer.txf --save

# gen-address
SECRET="test" npm run gen-address -- --unsafe-secret

# register-request (positional argument)
npm run register-request -- --unsafe-secret test state-data tx-data
```

## Warning Messages

When `--unsafe-secret` is used, the CLI displays:

```
⚠️  WARNING: Secret validation bypassed (--unsafe-secret flag used).
⚠️  This should ONLY be used for development/testing purposes!
```

This ensures users are aware they're using an insecure configuration.

## Security Considerations

### Why This Flag Exists
- **Testing:** Allows automated test suites to use simple secrets
- **Development:** Faster iteration without needing to create strong secrets
- **CI/CD:** Simplifies pipeline configuration for test environments

### Important Warnings
1. **NEVER use in production** - This flag completely bypasses critical security validation
2. **Test environments only** - Should only be used with local/test aggregators
3. **No secret strength guarantee** - Secrets can be trivially weak (even 1 character)

### What Still Gets Validated
Even with `--unsafe-secret`, the following validations remain:
- Secret cannot be completely empty
- All other input validations (addresses, RequestIDs, etc.) remain active
- File path traversal protection still applies
- Network request validation unchanged

## Testing

All commands tested with:
1. ✅ Weak secret without flag (correctly fails)
2. ✅ Weak secret with flag (succeeds with warnings)
3. ✅ Strong secret with flag (succeeds with warnings)
4. ✅ Strong secret without flag (succeeds normally)

## Related Files

- `src/utils/input-validation.ts` - Core validation logic
- `src/commands/mint-token.ts` - Updated command
- `src/commands/send-token.ts` - Updated command
- `src/commands/receive-token.ts` - Updated command
- `src/commands/gen-address.ts` - Updated command
- `src/commands/register-request.ts` - Updated command

## Backward Compatibility

✅ **Fully backward compatible**
- Flag is optional with default value `false`
- Existing scripts/commands work unchanged
- No breaking changes to command-line interface
- All existing validation behavior preserved by default

## Future Considerations

Potential enhancements:
1. Add `--unsafe-secret` to environment variable detection (`UNSAFE_SECRET_ALLOWED`)
2. Create separate test-mode configuration file
3. Add colored output for warnings (red/yellow)
4. Log warning to a security audit file when used
