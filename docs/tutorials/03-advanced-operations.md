# Tutorial 3: Advanced Token Operations (Advanced - 25 minutes)

## Welcome to Advanced Operations!

You've mastered the basics and token transfers. Now we'll explore advanced features that unlock powerful use cases: custom token types, batch operations, immediate transfers, and scripting.

## Learning Objectives

By the end of this tutorial, you'll understand:
- All preset token types (UCT, NFT, USDU, etc.)
- Custom token IDs and metadata
- Immediate transfers (Pattern B)
- Batch operations and scripting
- Working with specific network endpoints
- Error recovery strategies

## Prerequisites

- Completed **Tutorial 1**: Your First Token
- Completed **Tutorial 2**: Token Transfers
- Understand addresses, tokens, and transfer basics
- Comfortable with terminal commands

---

## Part 1: Token Type Presets (5 minutes)

The Unicity Network supports multiple token types. Each has different properties and use cases.

### Understanding Token Types

Every token has a **type** - a 256-bit identifier that categorizes it:

```
Token Type = 64-character hex string
  ↓
Categorizes: NFT, Stablecoin, Fungible token, etc.
Determines: Metadata structure, use cases, validation rules
```

### Available Presets

#### 1. UCT - Unicity Coin (Default)

The native token of Unicity Network.

```bash
SECRET="your-secret" npm run mint-token -- \
  --preset uct \
  -d '{"amount":"100","description":"Unicity Coin"}'
```

**Use case**: General purpose token, fungible currency

**Metadata example**:
```json
{
  "amount": "100.00",
  "denomination": "UCT",
  "purpose": "Trading"
}
```

#### 2. NFT - Non-Fungible Token

For unique, collectible items.

```bash
SECRET="your-secret" npm run mint-token -- \
  --preset nft \
  -d '{"name":"Rare Artwork #1","artist":"You","edition":"1 of 10"}'
```

**Use case**: Digital art, collectibles, unique assets, gaming items

**Metadata example**:
```json
{
  "name": "Rare Artwork #1",
  "artist": "You",
  "edition": "1 of 10",
  "ipfs_hash": "Qm...",
  "attributes": {
    "rarity": "legendary",
    "color": "blue"
  }
}
```

#### 3. USDU - Stable USD Equivalent

Represents US Dollar value on the network.

```bash
SECRET="your-secret" npm run mint-token -- \
  --preset usdu \
  -d '{"amount":"50.00","purpose":"Payment"}'
```

**Use case**: Payments, invoicing, stablecoin transfers

**Metadata example**:
```json
{
  "amount": "50.00",
  "currency": "USD",
  "purpose": "Invoice #12345"
}
```

### Hands-On: Try Different Presets

Let's mint tokens of different types:

#### Exercise 1: Mint an NFT

```bash
SECRET="your-secret" npm run mint-token -- \
  --preset nft \
  -d '{"name":"My Digital Artwork","created":"2025-11-02","medium":"AI-Generated","rights":"CC-BY"}'
```

Verify it:
```bash
npm run verify-token -- -f 20251102_*.txf
```

Check the output - notice the token type is different than UCT!

#### Exercise 2: Mint a USDU Token

```bash
SECRET="your-secret" npm run mint-token -- \
  --preset usdu \
  -d '{"amount":"25.50","invoice_id":"INV-001","payer":"Company Inc"}'
```

#### Exercise 3: Mint with Metadata

```bash
SECRET="your-secret" npm run mint-token -- \
  --preset nft \
  -d '{
    "title":"Limited Edition Digital Collectible",
    "author":"Creator Name",
    "series":"2025 Collection",
    "serial_number":"001",
    "mint_date":"2025-11-02",
    "rarity_score":95,
    "attributes":{
      "background":"cosmic",
      "style":"minimalist",
      "animation":true
    }
  }'
```

Notice how the metadata can be simple or complex!

---

## Part 2: Custom Token IDs and Types (5 minutes)

Beyond presets, you can create custom token types for specialized use cases.

### Understanding Token ID vs Token Type

| Field | Purpose | Format |
|-------|---------|--------|
| **Token ID** | Unique identifier for THIS token | 64-char hex or auto-generated |
| **Token Type** | Category of tokens (what kind) | 64-char hex or preset name |

### Custom Token ID

Create tokens with meaningful IDs:

#### Example 1: Meaningful ID for an NFT Collection

```bash
SECRET="your-secret" npm run mint-token -- \
  --preset nft \
  -i "my-art-collection-2025-001" \
  -d '{"name":"Piece 1","artist":"Me"}'
```

The `-i` flag sets a custom token ID. If less than 64 hex chars, it's automatically hashed to 256 bits.

#### Example 2: Sequential NFT Series

```bash
# Mint 3 pieces in a series
for i in 1 2 3; do
  SECRET="your-secret" npm run mint-token -- \
    --preset nft \
    -i "digital-series-2025-piece-$i" \
    -d "{\"series\":\"2025\",\"piece\":$i,\"total\":10}"
  echo "Created piece $i"
done
```

#### Example 3: Batch Minting with Custom IDs

Create a script file `mint-batch.sh`:

```bash
#!/bin/bash

SECRET="your-secret"
ITEMS=("artwork-1" "artwork-2" "artwork-3")
DESCRIPTIONS=(
  '{"title":"Sunrise","colors":["orange","pink","purple"]}'
  '{"title":"Sunset","colors":["red","orange","yellow"]}'
  '{"title":"Midnight","colors":["dark-blue","black"]}'
)

for i in "${!ITEMS[@]}"; do
  echo "Minting ${ITEMS[$i]}..."
  SECRET="$SECRET" npm run mint-token -- \
    --preset nft \
    -i "${ITEMS[$i]}" \
    -d "${DESCRIPTIONS[$i]}" \
    -s  # Auto-save
done

echo "Batch mint complete! Check *.txf files."
```

Run it:
```bash
chmod +x mint-batch.sh
./mint-batch.sh
```

---

## Part 3: Advanced Metadata (3 minutes)

Tokens can carry complex metadata with rich information.

### Metadata Structure Flexibility

You can use any JSON structure:

#### Example 1: Digital Certificate

```bash
SECRET="your-secret" npm run mint-token -- \
  --preset nft \
  -d '{
    "type": "certificate",
    "title": "Certificate of Completion",
    "recipient": "John Doe",
    "course": "Advanced Blockchain",
    "issuer": "Unicity Academy",
    "issued_date": "2025-11-02",
    "expires": null,
    "signature": "0x1234abcd...",
    "skills": ["Blockchain", "Cryptography", "Smart Contracts"]
  }'
```

#### Example 2: Deed of Ownership

```bash
SECRET="your-secret" npm run mint-token -- \
  --preset nft \
  -d '{
    "document_type": "deed_of_ownership",
    "property": "Digital Asset #1",
    "owner": "Your Name",
    "acquisition_date": "2025-11-02",
    "proof_of_ownership": "Purchase agreement #12345",
    "terms": {
      "transferable": true,
      "divisible": false,
      "assignable": true
    }
  }'
```

#### Example 3: Product Registry Entry

```bash
SECRET="your-secret" npm run mint-token -- \
  --preset nft \
  -d '{
    "product": {
      "sku": "PROD-12345",
      "name": "Limited Edition Widget",
      "manufacturer": "Widget Corp",
      "manufacture_date": "2025-10-01",
      "serial_number": "SN-987654321"
    },
    "authentication": {
      "method": "blockchain",
      "timestamp": "2025-11-02T15:30:00Z",
      "verified_by": "Unicity Labs"
    },
    "supply_chain": {
      "origin": "Factory A",
      "destination": "Retail Store B",
      "current_handler": "Logistics Partner C"
    }
  }'
```

### Metadata Best Practices

1. **Keep it structured**: Use nested JSON objects
2. **Use meaningful keys**: Not "a", "b", "c"
3. **Include timestamps**: ISO 8601 format
4. **Add identifiers**: SKU, UUID, or custom IDs
5. **Document your schema**: Helps others understand the data

---

## Part 4: Pattern B - Immediate Transfers (5 minutes)

We've learned Pattern A (offline transfers). Now let's use Pattern B for immediate, online transfers.

### When to Use Pattern B

| Aspect | Pattern A | Pattern B |
|--------|-----------|-----------|
| Network needed | For receiver only | For sender |
| Speed | Two-step, async | One-step, sync |
| Use case | Email, mobile | Real-time trading |
| Sender must be online | No | Yes |
| Receiver must be online | No | Yes |

### How Pattern B Works

```
SENDER                    NETWORK                   RECEIVER
│                           │                          │
├─ 1. Create transfer       │                          │
├─ 2. SUBMIT to network ───>│                          │
│                    3. Verify & confirm             │
│                    4. Send proof ───────────────────>│
│                           │     5. Token received    │
│                           │                          │
```

### Using --submit-now Flag

Instead of creating a transfer package, submit immediately:

```bash
SECRET="sender-secret" npm run send-token -- \
  -f token.txf \
  -r "RECIPIENT_ADDRESS" \
  -m "Immediate transfer!" \
  --submit-now \
  --save
```

### Complete Pattern B Example

#### Step 1: Both Parties Create Addresses

```bash
# Sender
SECRET="sender-secret" npm run gen-address

# Recipient (needs to be online)
SECRET="recipient-secret" npm run gen-address
```

#### Step 2: Sender Mints and Transfers

```bash
# Mint
SECRET="sender-secret" npm run mint-token -- \
  -d '{"type":"instant-payment","amount":"100"}'

# Transfer immediately (sender must be online)
SECRET="sender-secret" npm run send-token -- \
  -f token.txf \
  -r "RECIPIENT_ADDRESS" \
  --submit-now \
  --save
```

**Expected output**:
```
=== Send Token - Pattern B (Immediate Transfer) ===
...
✓ Transfer submitted to network
✓ Waiting for inclusion proof...
✓ Inclusion proof received
✓ Transfer finalized

✅ Token transferred immediately to recipient
Status: TRANSFERRED
```

#### Step 3: Recipient Automatically Receives

The transfer completes on the network. When the recipient checks:

```bash
SECRET="recipient-secret" npm run verify-token -- -f recipient_token.txf
```

They'll see they own the token!

### Hands-On: Try Pattern B

If you have two identities ready:

```bash
# Alice mints a token
SECRET="alice-secret" npm run mint-token -- \
  -d '{"immediate":"transfer"}'

# Alice sends to Bob immediately
SECRET="alice-secret" npm run send-token -- \
  -f alice_token.txf \
  -r "DIRECT://bob-address-here" \
  --submit-now \
  --save
```

---

## Part 5: Working with Custom Endpoints (3 minutes)

By default, commands use the production network (`https://gateway.unicity.network`), but you can specify custom endpoints.

### When to Use Custom Endpoints

| Scenario | Endpoint | Command |
|----------|----------|---------|
| Production | `https://gateway.unicity.network` | (default) |
| Local testing | `http://localhost:3000` | `--local` |
| Staging | `https://staging.unicity.network` | `-e https://...` |
| Custom network | Any URL | `-e https://custom.url` |

### Using --local (Local Development)

For testing without network:

```bash
# Works without waiting for network confirmation
SECRET="your-secret" npm run mint-token -- \
  --local \
  -d '{"test":"data"}'
```

This uses a local aggregator if running on `http://localhost:3000`.

### Using Custom Endpoint (-e flag)

```bash
# Use staging environment
SECRET="your-secret" npm run mint-token -- \
  -e "https://staging.unicity.network" \
  -d '{"staging":"token"}'

# Use custom aggregator
npm run send-token -- \
  -f token.txf \
  -r "RECIPIENT" \
  -e "https://custom-aggregator.example.com"
```

### Testing Strategy

Recommended workflow:

1. **Develop locally**:
   ```bash
   npm run mint-token -- --local -d '{"test":true}'
   ```

2. **Test on staging**:
   ```bash
   npm run mint-token -- -e "https://staging.unicity.network" -d '{"test":true}'
   ```

3. **Deploy to production**:
   ```bash
   npm run mint-token -- -d '{"production":true}'  # Uses default production
   ```

---

## Part 6: Batch Operations and Scripting (4 minutes)

For operations that repeat, scripting saves time and reduces errors.

### Scenario 1: Mass Distribution

Send multiple tokens to different recipients:

Create `distribute-tokens.sh`:

```bash
#!/bin/bash

SECRET="your-secret"
OUTPUT_DIR="distributions"
mkdir -p "$OUTPUT_DIR"

# List of recipients
declare -A RECIPIENTS=(
  ["alice"]="DIRECT://alice-address-here"
  ["bob"]="DIRECT://bob-address-here"
  ["carol"]="DIRECT://carol-address-here"
)

# Token to distribute
TOKEN_FILE="token-to-distribute.txf"

echo "Starting distribution..."

for name in "${!RECIPIENTS[@]}"; do
  recipient="${RECIPIENTS[$name]}"
  output_file="$OUTPUT_DIR/transfer-to-$name.txf"

  echo "Creating transfer for $name..."

  SECRET="$SECRET" npm run send-token -- \
    -f "$TOKEN_FILE" \
    -r "$recipient" \
    -m "Distribution to $name" \
    -o "$output_file"

  echo "✓ Created: $output_file"
done

echo "Distribution complete! Files in $OUTPUT_DIR/"
```

Run it:
```bash
chmod +x distribute-tokens.sh
./distribute-tokens.sh
```

### Scenario 2: Automated Test Suite

Verify multiple tokens with a script:

Create `verify-all-tokens.sh`:

```bash
#!/bin/bash

echo "=== Token Verification Report ==="
echo ""

for token_file in *.txf; do
  if [ -f "$token_file" ]; then
    echo "Checking: $token_file"
    npm run verify-token -- -f "$token_file" 2>&1 | grep -E "(Token ID:|Status:|SDK compatible)" | sed 's/^/  /'
    echo ""
  fi
done

echo "=== Verification Complete ==="
```

Run it:
```bash
chmod +x verify-all-tokens.sh
./verify-all-tokens.sh
```

### Scenario 3: Create Transfer Package Factory

Generate transfer packages for multiple recipients automatically:

Create `create-transfers.js`:

```javascript
const { execSync } = require('child_process');
const fs = require('fs');

const SECRET = "your-secret";
const TOKEN_FILE = "token.txf";
const RECIPIENTS = {
  "alice": "DIRECT://alice-address",
  "bob": "DIRECT://bob-address",
  "carol": "DIRECT://carol-address"
};

console.log("Creating transfer packages...");

for (const [name, address] of Object.entries(RECIPIENTS)) {
  try {
    const cmd = `SECRET="${SECRET}" npm run send-token -- -f ${TOKEN_FILE} -r "${address}" -m "For ${name}" --save`;
    execSync(cmd, { stdio: 'inherit' });
    console.log(`✓ Created package for ${name}`);
  } catch (error) {
    console.error(`✗ Failed for ${name}:`, error.message);
  }
}

console.log("All packages created!");
```

Run it:
```bash
node create-transfers.js
```

---

## Part 7: Error Recovery (3 minutes)

When things go wrong, here's how to recover:

### Common Advanced Errors

#### Error 1: "Invalid Token ID Format"

**Problem**: Token ID is wrong format

**Solution**:
```bash
# Wrong - too short
npm run mint-token -- -i "ABC" ...

# Right - will be auto-hashed
npm run mint-token -- -i "my-meaningful-id" ...

# Right - full 64-char hex
npm run mint-token -- -i "abc123def456...64chars..." ...
```

#### Error 2: "Network Unreachable" with Custom Endpoint

**Problem**: Custom endpoint doesn't exist or is offline

**Solution**:
```bash
# Test the endpoint first
curl -s https://your-endpoint.com/health

# If fails, use production endpoint
npm run mint-token -- -d '{"data":"test"}'  # Uses production
```

#### Error 3: "Immediate Transfer Failed"

**Problem**: Pattern B fails because recipient not online

**Solution**:
```bash
# Switch to Pattern A (offline)
npm run send-token -- \
  -f token.txf \
  -r "RECIPIENT" \
  --save  # No --submit-now
```

#### Error 4: Partial Batch Mint Failed

**Problem**: Script stops after error, some tokens minted

**Solution**:
```bash
# Check which files were created
ls -1 *.txf | wc -l

# Verify all minted tokens
for f in *.txf; do npm run verify-token -- -f "$f"; done

# Resume minting from where it failed (edit script)
```

### Prevention Strategies

1. **Validate inputs first**:
```bash
# Check address is valid
if [[ ! "$ADDRESS" =~ ^DIRECT://[a-f0-9]{128}$ ]]; then
  echo "Invalid address format!"
  exit 1
fi
```

2. **Test with small amounts**:
```bash
# Test transfer first with small token
npm run send-token -- -f small-test.txf -r "$ADDRESS" --save
```

3. **Backup before batch**:
```bash
# Backup all current tokens
cp *.txf backup/  # Ensure backup/ directory exists
```

4. **Log all operations**:
```bash
SECRET="your-secret" npm run mint-token -- -d '{}' >> mint.log 2>&1
```

---

## Part 8: Real-World Scenario (4 minutes)

Let's apply everything in a realistic scenario:

### Scenario: Issuing NFT Certificates

You're an online academy. You need to:
1. Create certificate tokens for graduates
2. Send to recipients' addresses
3. Verify they received them
4. Keep records

#### Step 1: Prepare Recipients List

Create `recipients.json`:
```json
{
  "graduates": [
    {
      "name": "Alice Smith",
      "address": "DIRECT://alice-address-64-chars",
      "course": "Advanced Blockchain",
      "grade": "A+",
      "date": "2025-11-02"
    },
    {
      "name": "Bob Johnson",
      "address": "DIRECT://bob-address-64-chars",
      "course": "Smart Contracts",
      "grade": "A",
      "date": "2025-11-02"
    }
  ]
}
```

#### Step 2: Create Certificate Minter Script

Create `issue-certificates.js`:

```javascript
const fs = require('fs');
const { execSync } = require('child_process');

const SECRET = "academy-secret";
const recipientsData = JSON.parse(fs.readFileSync('recipients.json', 'utf8'));
const issueLog = [];

console.log("Academy Certificate Issuance System");
console.log("====================================\n");

for (const grad of recipientsData.graduates) {
  console.log(`Issuing certificate to ${grad.name}...`);

  // Create certificate metadata
  const certData = {
    type: "certificate",
    title: "Certificate of Completion",
    recipient: grad.name,
    course: grad.course,
    grade: grad.grade,
    issued_date: grad.date,
    issuer: "Unicity Academy",
    verification_hash: `CERT-${grad.name.replace(/ /g, '-')}-${Date.now()}`
  };

  try {
    // Mint certificate
    const mintCmd = `SECRET="${SECRET}" npm run mint-token -- --preset nft -d '${JSON.stringify(certData)}' -s`;
    execSync(mintCmd, { stdio: 'inherit' });

    // Find the created file
    const files = execSync('ls -t *.txf | head -1').toString().trim();

    // Send to recipient
    const sendCmd = `SECRET="${SECRET}" npm run send-token -- -f ${files} -r "${grad.address}" -m "Your certificate from Unicity Academy" --save`;
    execSync(sendCmd, { stdio: 'inherit' });

    issueLog.push({
      timestamp: new Date().toISOString(),
      recipient: grad.name,
      status: "✓ Success"
    });

    console.log(`✓ Certificate issued to ${grad.name}\n`);
  } catch (error) {
    issueLog.push({
      timestamp: new Date().toISOString(),
      recipient: grad.name,
      status: "✗ Failed: " + error.message
    });
    console.error(`✗ Failed for ${grad.name}\n`);
  }
}

// Save log
fs.writeFileSync('issuance-log.json', JSON.stringify(issueLog, null, 2));
console.log("\nIssuance log saved to issuance-log.json");
```

Run it:
```bash
node issue-certificates.js
```

#### Step 3: Verify All Issuances

```bash
echo "=== Certificate Verification ===" > cert-report.txt
for f in *_transfer_*.txf; do
  echo "File: $f" >> cert-report.txt
  npm run verify-token -- -f "$f" | grep -E "(Token ID:|recipient|course)" >> cert-report.txt
  echo "" >> cert-report.txt
done

cat cert-report.txt
```

---

## Advanced Tips & Tricks

### Tip 1: Use Environment Variables for Batch Operations

```bash
export SECRET="your-secret"
export ENDPOINT="https://gateway.unicity.network"
export TOKEN_TYPE="nft"

npm run mint-token -- -d '{"auto":"batch"}' --preset "$TOKEN_TYPE" -e "$ENDPOINT"
```

### Tip 2: Parse Verification Output

```bash
# Get token ID only
npm run verify-token -- -f token.txf | grep "Token ID:" | cut -d' ' -f3

# Get status only
npm run verify-token -- -f token.txf | grep "SDK compatible" | awk '{print $NF}'
```

### Tip 3: Parallel Processing for Speed

```bash
# Process multiple tokens in parallel
for token in *.txf; do
  (
    npm run verify-token -- -f "$token" > "verify-$token.log"
  ) &
done
wait

echo "All verifications complete!"
```

---

## Practice Exercises

Try these to master advanced operations:

### Exercise 1: NFT Collection Series
Create 10 NFTs in a series with sequential IDs and metadata. Verify all of them.

### Exercise 2: Immediate Transfer Workflow
Mint a token and transfer it immediately using Pattern B. Verify the recipient owns it.

### Exercise 3: Batch Script
Write a script that mints 5 tokens with different metadata and auto-saves them.

### Exercise 4: Certificate System
Create and distribute certificates to at least 3 recipients.

---

## Summary

You've learned:

| Topic | What You Can Do |
|-------|-----------------|
| **Token Types** | Mint UCT, NFT, USDU with presets |
| **Custom IDs** | Create meaningful token identifiers |
| **Rich Metadata** | Store complex JSON in tokens |
| **Pattern B** | Immediate transfers with --submit-now |
| **Custom Endpoints** | Target different networks |
| **Batch Operations** | Automate multiple transactions |
| **Scripting** | Write bash/JavaScript automation |
| **Error Recovery** | Handle and recover from failures |

---

## What's Next?

- **Tutorial 4**: Deep dive into token internals (TXF structure, predicates, CBOR)
- **Tutorial 5**: Production best practices and security

You now have the advanced skills needed for sophisticated token operations!

---

*Master the advanced techniques!*
