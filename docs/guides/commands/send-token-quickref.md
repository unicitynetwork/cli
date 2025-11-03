# Send Token - Quick Reference

## Basic Usage

```bash
# Pattern A: Offline Transfer (default)
npm run send-token -- -f <token.txf> -r <address> --save

# Pattern B: Submit to Network
npm run send-token -- -f <token.txf> -r <address> --submit-now --save
```

## Common Commands

### Offline Transfer with Message
```bash
npm run send-token -- \
  -f my-token.txf \
  -r "PK://03a1b2c3d4e5f6..." \
  -m "Payment for invoice" \
  --save
```

### Immediate Transfer
```bash
npm run send-token -- \
  -f my-token.txf \
  -r "PK://03a1b2c3d4e5f6..." \
  --submit-now \
  -o sent-token.txf
```

### With Secret Environment Variable
```bash
SECRET="my-secret" npm run send-token -- \
  -f token.txf \
  -r "PK://..."
```

### Local Testing
```bash
npm run send-token -- \
  -f token.txf \
  -r "PK://..." \
  --local \
  --submit-now
```

## Options Quick Reference

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--file` | `-f` | Token file to send | **Required** |
| `--recipient` | `-r` | Recipient address | **Required** |
| `--message` | `-m` | Transfer message | None |
| `--endpoint` | `-e` | Aggregator URL | gateway.unicity.network |
| `--local` | | Use localhost:3000 | false |
| `--production` | | Use production gateway | false |
| `--submit-now` | | Submit immediately (Pattern B) | false |
| `--output` | `-o` | Output file path | None |
| `--save` | | Auto-generate filename | false |
| `--stdout` | | Print to console only | false |

## Transfer Patterns

### Pattern A (Default): Offline Transfer
- Creates extended TXF with offline package
- Status: **PENDING**
- Recipient completes transfer later
- Use when: Offline, async transfers, QR codes

### Pattern B (`--submit-now`): Immediate
- Submits to network immediately
- Status: **TRANSFERRED**
- Waits for inclusion proof (30s timeout)
- Use when: Online, immediate confirmation needed

## Secret Input

**Environment Variable**:
```bash
SECRET="my-secret" npm run send-token -- ...
```

**Interactive Prompt** (if no env var):
```
Enter your secret (will be hidden): ____
```

## Output Files

### Auto-Generated Names (`--save`)
- Pattern A: `YYYYMMDD_HHMMSS_timestamp_transfer_recipientprefix.txf`
- Pattern B: `YYYYMMDD_HHMMSS_timestamp_sent_recipientprefix.txf`

### Example
```
20251102_143022_1730558622_transfer_03a1b2c3d4.txf
```

## Common Errors

| Error | Solution |
|-------|----------|
| `--file option is required` | Add `-f <token.txf>` |
| `--recipient option is required` | Add `-r <address>` |
| `Token file not found` | Check file path is correct |
| `Timeout waiting for inclusion proof` | Check network, try Pattern A |
| `Failed to unlock token` | Verify secret matches token |

## Extended TXF Status

| Status | Meaning |
|--------|---------|
| `PENDING` | Offline transfer created, not submitted |
| `SUBMITTED` | Sent to network, awaiting confirmation |
| `CONFIRMED` | Confirmed on network |
| `TRANSFERRED` | Successfully transferred (Pattern B) |
| `FAILED` | Network submission failed |

## Security Notes

- ✅ Private keys NEVER exported
- ✅ Secret cleared from memory after use
- ✅ Output automatically sanitized
- ✅ Cryptographically secure salt generation

## See Also

- Full Guide: `SEND_TOKEN_GUIDE.md`
- Implementation: `IMPLEMENTATION_SUMMARY.md`
- Help: `npm run send-token -- --help`
