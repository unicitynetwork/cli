# Tutorial 5: Production Best Practices (20 minutes)

## Welcome to Production-Grade Security!

You've mastered the CLI. Now let's ensure your tokens are secure, backed up, and managed professionally in production environments.

## Learning Objectives

By the end of this tutorial, you'll know:
- How to securely manage secrets in production
- Backup and recovery strategies
- Address verification workflows
- Testing before production
- Monitoring and auditing transfers
- Troubleshooting production issues
- Compliance and documentation

## Prerequisites

- Completed Tutorials 1-4
- Understanding of token lifecycle
- Access to production network
- Basic understanding of security concepts

---

## Part 1: Secret Management (5 minutes)

Your secret is the most critical asset. Protecting it is paramount.

### Secret Storage Strategies

#### Strategy 1: Environment Variables (Development Only)

```bash
# For development/testing ONLY
export SECRET="my-secret"
npm run mint-token -- -d '{"test":true}'
```

**Pros**: Simple, works with scripts
**Cons**: Visible in shell history, process list
**Use case**: Local development only

#### Strategy 2: .env Files (Development Only)

Create `.env` file:
```
SECRET=my-secret-here
```

Use with:
```bash
# Install dotenv
npm install dotenv

# In script
require('dotenv').config();
const secret = process.env.SECRET;
```

**Pros**: Centralized, easy to change
**Cons**: File could be accidentally committed
**Use case**: Local development

**ALWAYS add to .gitignore**:
```bash
echo ".env" >> .gitignore
echo "*.env.local" >> .gitignore
echo ".env.*.backup" >> .gitignore
```

#### Strategy 3: Encrypted Vault (Production Recommended)

For production, use a dedicated secrets management system:

**Option A: HashiCorp Vault**

```bash
# Install vault CLI
# https://www.vaultproject.io

# Store secret
vault kv put secret/unicity/main SECRET="production-secret"

# Retrieve in script
vault kv get -field=SECRET secret/unicity/main
```

**Option B: AWS Secrets Manager**

```bash
# Store
aws secretsmanager create-secret \
  --name unicity/production \
  --secret-string '{"secret":"my-production-secret"}'

# Retrieve
aws secretsmanager get-secret-value \
  --secret-id unicity/production \
  --query SecretString
```

**Option C: 1Password / LastPass / Bitwarden**

For smaller deployments:
```bash
# Use CLI to retrieve secret
OP_ACCOUNT="my.account" op read op://vault/unicity/secret
```

**Option D: Hardware Security Module (HSM)**

For maximum security:
```bash
# Secrets stored on hardware device
# Never exposed to software
# Used for signing operations
```

### Secret Rotation Strategy

```
OLD SECRET (Jan 2024)
  ↓
Generate new addresses with OLD secret
  ↓
Transfer tokens to new addresses (NEW secret)
  ↓
Mark old secret as deprecated
  ↓
Delete old secret after verification
  ↓
NEW SECRET (Feb 2024)
```

Implementation:

```bash
#!/bin/bash

# Store old secret
OLD_SECRET="january-2024-secret"

# Generate new secret
NEW_SECRET=$(openssl rand -hex 32)  # Random 64-char secret

# Create new address
SECRET="$NEW_SECRET" npm run gen-address > new-address.json

# For each token with OLD_SECRET
for token in *.txf; do
  # Transfer to new address
  SECRET="$OLD_SECRET" npm run send-token -- \
    -f "$token" \
    -r "NEW_ADDRESS_HERE" \
    --save
done

# Store new secret securely
echo "Update your secrets vault with:"
echo "SECRET=$NEW_SECRET"

# Delete old secret from environment
unset OLD_SECRET
```

### Monitoring Secret Exposure

```bash
# Check if secret appears in files
grep -r "SECRET=" . --include="*.json" --include="*.log"

# Check git history
git log -p -S "your-secret" --

# If found, use git-filter-branch to remove
# (Advanced - backup first!)
```

---

## Part 2: Backup and Recovery (5 minutes)

Losing a token file means losing that token forever. Backup strategy is critical.

### Backup Strategy: The 3-2-1 Rule

```
3 Copies:     Keep 3 backup copies
  ├─ Original token file (local)
  ├─ Backup copy #1 (encrypted USB)
  └─ Backup copy #2 (cloud storage)

2 Media:      Use 2 different storage types
  ├─ Local SSD
  └─ Cloud (S3, Azure, etc.)

1 Offsite:    Keep 1 copy offsite
  └─ Different geographic location
```

### Implementation

#### Step 1: Organize Token Files

```bash
# Create backup directory structure
mkdir -p tokens/active
mkdir -p tokens/archived
mkdir -p tokens/backup
mkdir -p tokens/.secure  # For encrypted backups

# Move tokens
mv *.txf tokens/active/
```

#### Step 2: Create Backup Script

Create `backup-tokens.sh`:

```bash
#!/bin/bash

SOURCE_DIR="tokens/active"
BACKUP_DIR="tokens/backup"
ENCRYPTED_DIR="tokens/.secure"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_$TIMESTAMP.tar.gz"

echo "Starting token backup..."

# Create backup archive
tar -czf "$BACKUP_DIR/$BACKUP_FILE" "$SOURCE_DIR"

# Encrypt it
gpg --symmetric --cipher-algo AES256 "$BACKUP_DIR/$BACKUP_FILE"

# Move encrypted backup to secure location
mv "$BACKUP_DIR/$BACKUP_FILE.gpg" "$ENCRYPTED_DIR/"

# Clean up unencrypted version
rm "$BACKUP_DIR/$BACKUP_FILE"

echo "✓ Backup created: $ENCRYPTED_DIR/$BACKUP_FILE.gpg"

# Sync to cloud (example: AWS S3)
aws s3 cp "$ENCRYPTED_DIR/$BACKUP_FILE.gpg" \
  s3://my-unicity-backups/

echo "✓ Backup uploaded to S3"

# Keep local copies
ls -lah "$ENCRYPTED_DIR/"
```

Run it regularly:

```bash
chmod +x backup-tokens.sh
./backup-tokens.sh

# Schedule daily backup with cron
# Add to crontab: 0 2 * * * /path/to/backup-tokens.sh
```

#### Step 3: Recovery Procedure

```bash
#!/bin/bash

ENCRYPTED_BACKUP="tokens/.secure/backup_20251102_120000.tar.gz.gpg"

echo "Recovering from backup..."

# Decrypt
gpg --output decrypted.tar.gz --decrypt "$ENCRYPTED_BACKUP"

# Extract
tar -xzf decrypted.tar.gz

# Clean up decrypted file
shred -ufv decrypted.tar.gz

# Verify recovered tokens
npm run verify-token -- -f tokens/active/*.txf

echo "✓ Recovery complete!"
```

### Backup Testing

Always test backups!

```bash
#!/bin/bash

# Create test directory
mkdir test-recovery
cd test-recovery

# Try to restore
../recover-from-backup.sh

# Verify all tokens
for f in tokens/active/*.txf; do
  echo "Testing: $f"
  npm run verify-token -- -f "$f" || echo "FAILED: $f"
done

cd ..
rm -rf test-recovery
```

---

## Part 3: Address Verification Workflows (4 minutes)

Before sending tokens, verify the recipient address is correct.

### Address Verification Checklist

```
[ ] Address format is valid (DIRECT://... 130+ hex chars)
[ ] Address matches recipient's verification document
[ ] Address hasn't been modified in transit
[ ] Recipient confirmed address independently
[ ] Small test transfer successful
```

### Verification Steps

#### Step 1: Get Recipient Address

```bash
# Recipient generates their address
SECRET="recipient-secret" npm run gen-address > recipient-info.json

# Extract address
RECIPIENT_ADDRESS=$(grep -o 'DIRECT://[a-f0-9]\{130\}' recipient-info.json)

echo "Recipient Address: $RECIPIENT_ADDRESS"
```

#### Step 2: Verify Using Multiple Channels

```bash
# Channel 1: Email
# "Send me your address"
# Response: recipient@email.com: "DIRECT://abc123..."

# Channel 2: Phone call
# "Can you read back your address character by character?"
# Verify each character

# Channel 3: QR code
# Display QR code of address
# Recipient scans and confirms
```

#### Step 3: Create Address Registry

```bash
# File: recipient-registry.json
{
  "recipients": [
    {
      "name": "Alice Smith",
      "address": "DIRECT://00004059268bb18c04e6544493195cee9a2e7043f73cf542d15ecbef31647e65c6e98acebf8f",
      "verified_date": "2025-11-02",
      "verified_method": "email + phone",
      "notes": "Alice's production wallet"
    },
    {
      "name": "Bob Johnson",
      "address": "DIRECT://0000280c3d90eee10f445c23c457c8968020b647ae9f7a4532e9a1f2c3d4e5f",
      "verified_date": "2025-11-01",
      "verified_method": "QR code",
      "notes": "Bob's staging test"
    }
  ]
}
```

#### Step 4: Prevent Typos

```bash
#!/bin/bash

RECIPIENT_NAME="$1"
RECIPIENT_ADDRESS="$2"

# Verify format
if [[ ! "$RECIPIENT_ADDRESS" =~ ^DIRECT://[a-f0-9]{130,}$ ]]; then
  echo "ERROR: Invalid address format!"
  echo "Expected: DIRECT://[130+ hex chars]"
  exit 1
fi

# Check against registry
if grep -q "$RECIPIENT_ADDRESS" recipient-registry.json; then
  echo "✓ Address found in verified registry"
else
  echo "⚠ WARNING: Address not in registry!"
  echo "Recipient: $RECIPIENT_NAME"
  echo "Address: $RECIPIENT_ADDRESS"
  read -p "Continue? (yes/no) " answer
  if [ "$answer" != "yes" ]; then
    exit 1
  fi
fi

echo "✓ Address verified"
```

---

## Part 4: Testing Before Production (4 minutes)

Always test on staging before going live.

### Three-Environment Strategy

```
┌─────────────────────────────────────────────────┐
│ DEVELOPMENT (Local)                             │
│ ├─ --local flag for testing                     │
│ ├─ Mock/fake tokens                             │
│ └─ No network costs                             │
└─────────────────────────────────────────────────┘
              ↓ (When stable)
┌─────────────────────────────────────────────────┐
│ STAGING (Test Network)                          │
│ ├─ -e staging.unicity.network                   │
│ ├─ Real network, isolated from production       │
│ └─ Test all workflows                           │
└─────────────────────────────────────────────────┘
              ↓ (When verified)
┌─────────────────────────────────────────────────┐
│ PRODUCTION (Main Network)                       │
│ ├─ Default endpoint                             │
│ ├─ Real tokens, real value                      │
│ └─ Full security measures                       │
└─────────────────────────────────────────────────┘
```

### Testing Workflow

#### Test 1: Local Development

```bash
# Use local aggregator
SECRET="dev-secret" npm run mint-token -- \
  --local \
  -d '{"env":"development"}'
```

#### Test 2: Staging Verification

```bash
# Test full workflow on staging
SECRET="staging-secret-alice" npm run gen-address \
  -e https://staging.unicity.network

SECRET="staging-secret-bob" npm run gen-address \
  -e https://staging.unicity.network

# Mint on staging
SECRET="staging-secret-alice" npm run mint-token -- \
  -e https://staging.unicity.network \
  -d '{"test":"staging"}'

# Transfer on staging
SECRET="staging-secret-alice" npm run send-token -- \
  -f staging-token.txf \
  -r "BOB_STAGING_ADDRESS" \
  -e https://staging.unicity.network \
  --save
```

#### Test 3: Recipient Verification

```bash
# Bob receives on staging
SECRET="staging-secret-bob" npm run receive-token -- \
  -f staging-transfer.txf \
  -e https://staging.unicity.network \
  --save

# Verify on staging
npm run verify-token -- -f staging-received.txf \
  -e https://staging.unicity.network
```

#### Test 4: Regression Suite

Create `test-suite.sh`:

```bash
#!/bin/bash

STAGING_ENDPOINT="https://staging.unicity.network"

echo "=== Regression Test Suite ==="

# Test 1: Basic mint
echo "Test 1: Minting..."
SECRET="test-secret" npm run mint-token -- \
  -e "$STAGING_ENDPOINT" \
  -d '{"test":"mint"}' -s || exit 1
echo "✓ Mint successful"

# Test 2: Verification
echo "Test 2: Verification..."
npm run verify-token -- -f *.txf || exit 1
echo "✓ Verification successful"

# Test 3: Transfer
echo "Test 3: Transfer..."
SECRET="test-secret" npm run send-token -- \
  -f *.txf \
  -r "STAGING_RECIPIENT_ADDRESS" \
  -e "$STAGING_ENDPOINT" \
  --save || exit 1
echo "✓ Transfer successful"

echo ""
echo "✓ All tests passed!"
echo "Ready for production deployment"
```

---

## Part 5: Monitoring and Auditing (2 minutes)

Track all token operations for compliance and debugging.

### Audit Log Implementation

Create `audit-logger.sh`:

```bash
#!/bin/bash

AUDIT_LOG="audit.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
OPERATION="$1"
DETAILS="$2"

# Log entry
echo "[$TIMESTAMP] $OPERATION | $DETAILS" >> "$AUDIT_LOG"

# Keep recent operations in memory
tail -100 "$AUDIT_LOG" > "$AUDIT_LOG.tmp"
mv "$AUDIT_LOG.tmp" "$AUDIT_LOG"
```

Use it:

```bash
# Log mint operation
./audit-logger.sh "MINT" "Token: nft-001, Owner: alice, Metadata: artwork"

# Log transfer operation
./audit-logger.sh "TRANSFER" "From: alice, To: bob, Token: nft-001, Status: PENDING"

# Log receive operation
./audit-logger.sh "RECEIVE" "From: alice, Recipient: bob, Token: nft-001, Status: CONFIRMED"
```

### Monitoring Checklist

Create `monitor.sh`:

```bash
#!/bin/bash

echo "=== Token Operations Monitor ==="
echo ""

# Count tokens
TOTAL=$(find . -name "*.txf" | wc -l)
echo "Total token files: $TOTAL"

# Check statuses
echo ""
echo "Status distribution:"
grep -h '"status"' *.txf | sort | uniq -c

# Find transfers in progress
echo ""
echo "Pending transfers:"
grep -l '"status":"PENDING"' *.txf || echo "None"

# Check for old files
echo ""
echo "Oldest token (could need archival):"
ls -lt *.txf | tail -1

# Health check
echo ""
echo "=== Health Check ==="
FAILED_VERIFICATIONS=0
for f in *.txf; do
  if ! npm run verify-token -- -f "$f" > /dev/null 2>&1; then
    echo "✗ $f failed verification"
    ((FAILED_VERIFICATIONS++))
  fi
done

if [ $FAILED_VERIFICATIONS -eq 0 ]; then
  echo "✓ All tokens verified successfully"
else
  echo "✗ $FAILED_VERIFICATIONS tokens failed verification"
fi
```

Run it regularly:

```bash
chmod +x monitor.sh
./monitor.sh

# Schedule daily: 0 8 * * * /path/to/monitor.sh
```

---

## Part 6: Troubleshooting Production Issues (3 minutes)

Common problems and solutions:

### Issue: "Network Timeout" During Critical Transfer

**Prevention**:
```bash
# Use shorter timeout for faster feedback
TIMEOUT=10000 npm run send-token -- \
  -f token.txf \
  -r "RECIPIENT" \
  --submit-now
```

**Recovery**:
```bash
# Transfer already submitted? Check status
npm run verify-token -- -f transfer.txf

# If PENDING, recipient can still claim
# If CONFIRMED, transfer complete
# If FAILED, try again
```

### Issue: "Address Mismatch" in Recipient Workflow

**Diagnosis**:
```bash
# Verify recipient generated correct address
SECRET="recipient-secret" npm run gen-address > check-address.json

# Compare with sent-to address
echo "Address in file:"
grep "address" check-address.json

echo "Address recipient expects:"
cat recipient-registry.json | grep "recipient-name" -A 1
```

**Solution**:
- If mismatch, recipient uses wrong secret
- Generate new transfer to correct address
- Recipient should retry with correct secret

### Issue: "Too Many Failed Transactions"

**Investigation**:
```bash
# Check recent errors
tail -100 audit.log | grep "FAILED\|ERROR"

# Verify network connectivity
curl -s https://gateway.unicity.network/health

# Check token validity
npm run verify-token -- -f *.txf
```

**Fix**:
1. Resolve network issues
2. Verify tokens are valid
3. Retry transfers one by one (don't batch)
4. Contact support if persistent

### Issue: "Suspicious Token File"

**Validation**:
```bash
# Check file integrity
sha256sum original-token.txf > token.sha256

# Later, verify it hasn't changed
sha256sum -c token.sha256

# Check for private key leakage
grep -i "private\|secret" token.txf  # Should be empty!

# Verify structure
npm run verify-token -- -f token.txf --secret  # Validates cryptography
```

---

## Part 7: Compliance and Documentation (2 minutes)

Keep records for auditing and compliance.

### Documentation Template

Create `token-operation-log.md`:

```markdown
# Token Operation Log - 2025-11

## Operation 1: Issue NFT Certificate
- **Date**: 2025-11-02 14:30 UTC
- **Type**: MINT
- **Token Type**: NFT
- **Recipient**: alice@example.com
- **Metadata**: Certificate of Completion - Blockchain Course
- **Token ID**: abc123def456...
- **Status**: CONFIRMED
- **Network**: Production
- **Verified By**: qa-team-sig-xyz

## Operation 2: Transfer Certificate to Recipient
- **Date**: 2025-11-02 14:35 UTC
- **Type**: TRANSFER
- **From**: issuer-address
- **To**: alice-address
- **Token ID**: abc123def456...
- **Method**: Pattern A (Offline)
- **Status**: CONFIRMED
- **Inclusion Proof**: Available in token file
- **Audit Trail**: Complete

## Operation 3: Recipient Verification
- **Date**: 2025-11-02 14:40 UTC
- **Type**: VERIFY
- **Recipient**: alice@example.com
- **Verified Token**: abc123def456...
- **Status**: CONFIRMED - Recipient owns token
- **Verification Method**: Secret + address match
```

### Compliance Checklist

```
Token Operations Compliance
[ ] All operations logged with timestamp
[ ] Sender identity verified for all transfers
[ ] Recipient identity verified for all transfers
[ ] All tokens verified before transfer
[ ] Network endpoint documented
[ ] Inclusion proofs preserved
[ ] Backup copies maintained
[ ] Secrets rotation schedule active
[ ] Address verification workflow followed
[ ] Test environment used before production
[ ] Monitoring active and alerts configured
[ ] Incident response plan documented
[ ] Recovery procedures tested quarterly
```

---

## Production Deployment Checklist

Before going live:

```
PRE-DEPLOYMENT
[ ] All tutorials completed
[ ] Staging environment tested thoroughly
[ ] Secrets management system in place
[ ] Backup strategy implemented and tested
[ ] Monitoring and alerting configured
[ ] Team trained on procedures
[ ] Documentation written
[ ] Incident response plan created
[ ] Security audit completed
[ ] Legal/compliance review done

DEPLOYMENT DAY
[ ] Low-volume testing first
[ ] Monitoring active
[ ] Support team available
[ ] Communication channels ready
[ ] Rollback plan ready
[ ] Database backups current

POST-DEPLOYMENT
[ ] Verify all operations working
[ ] Check monitoring alerts
[ ] Review transaction logs
[ ] Team debriefing
[ ] Document any issues
[ ] Schedule post-deployment review
[ ] Plan improvements for next release
```

---

## Security Best Practices Summary

| Practice | Why | How |
|----------|-----|-----|
| **Secret Isolation** | Prevent exposure | Use vault/HSM |
| **Regular Rotation** | Reduce breach window | Monthly new secrets |
| **Backup Redundancy** | Prevent data loss | 3-2-1 rule |
| **Address Verification** | Prevent misdirection | Multi-channel confirm |
| **Staged Deployment** | Catch issues early | Dev → Staging → Prod |
| **Comprehensive Logging** | Enable auditing | Log all operations |
| **Incident Response** | Handle emergencies | Document procedures |
| **Recovery Testing** | Ensure backups work | Test quarterly |

---

## Recommended Reading

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Cryptography Best Practices: https://crypto.stackexchange.com/
- Zero Trust Security: https://www.nist.gov/publications/zero-trust-architecture

---

## Key Takeaways

You now understand:
1. ✅ Secure secret management strategies
2. ✅ Comprehensive backup and recovery
3. ✅ Address verification workflows
4. ✅ Testing before production
5. ✅ Monitoring and compliance
6. ✅ Troubleshooting issues
7. ✅ Production deployment procedures

---

## Final Checklist: You're Ready for Production!

- [ ] Completed all 5 tutorials
- [ ] Implemented secret management
- [ ] Created backup procedures
- [ ] Tested address verification
- [ ] Ran staging environment tests
- [ ] Set up monitoring
- [ ] Documented procedures
- [ ] Trained your team
- [ ] Plan incident response
- [ ] Ready to deploy!

---

## What's Next?

You've mastered:
- Beginner tutorial: Basic operations
- Intermediate: Token transfers
- Advanced: Complex operations
- Technical deep-dive: Internals
- Production: Security and compliance

**Next steps**:
1. Deploy to production with confidence
2. Integrate Unicity into your applications
3. Build custom wallets
4. Contribute to the ecosystem

---

*You're now a certified Unicity CLI expert!*

Questions or issues? Check the [TROUBLESHOOTING.md](../troubleshooting.md) guide or review earlier tutorials.

Remember: **Security is not optional - it's essential.**
