# Security Documentation

This directory contains security-related documentation for the Unicity CLI project, including vulnerability reports, security advisories, and analysis documents.

## Contents

### Critical Security Reports

- **[CRITICAL_BUG_REPORT_AGGREGATOR_DOS.md](./CRITICAL_BUG_REPORT_AGGREGATOR_DOS.md)**
  Critical bug report documenting a Denial of Service vulnerability in the aggregator component.

- **[SECURITY_ADVISORY_DOS_VULNERABILITY.md](./SECURITY_ADVISORY_DOS_VULNERABILITY.md)**
  Comprehensive security advisory detailing the DoS vulnerability, impact assessment, and mitigation strategies.

- **[SECURITY_BUG_REPORT.md](./SECURITY_BUG_REPORT.md)**
  Additional security bug documentation and analysis.

### Analysis Documents

- **[REQUESTID_FORMAT_ANALYSIS.md](./REQUESTID_FORMAT_ANALYSIS.md)**
  Analysis of request ID format implementation and security implications.

## Security Reporting

If you discover a security vulnerability in the Unicity CLI:

1. **Do not** open a public issue
2. Contact the maintainers privately
3. Provide detailed information about the vulnerability
4. Allow time for patching before public disclosure

## Security Best Practices

When working with the Unicity CLI:

- Always validate input data before processing
- Use proper error handling to avoid information leakage
- Keep dependencies up to date
- Follow principle of least privilege
- Review security advisories regularly

## Related Documentation

- [Testing Documentation](../testing/) - Security test cases
- [Implementation Documentation](../implementation/) - Validation and security implementations
