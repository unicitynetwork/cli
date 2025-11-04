#!/bin/bash

# Debug script to test aggregator responses
# This will show exactly what the aggregator is returning

echo "================================================"
echo "Debug Aggregator Response Test"
echo "================================================"
echo ""

ENDPOINT="${1:-http://localhost:8080}"
echo "Using endpoint: $ENDPOINT"
echo ""

# First, let's test if the aggregator is running
echo "1. Testing aggregator connectivity..."
echo "--------------------------------------"
curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"get_block_height","params":{},"id":1}' \
  | python3 -m json.tool || echo "Failed to connect"
echo ""

# Register a request
echo "2. Registering a test request..."
echo "--------------------------------------"
SECRET="test123"
STATE="state_$(date +%s)" # Unique state to avoid conflicts
TRANSITION="transition1"

echo "Running: npm run register-request -- -e $ENDPOINT \"$SECRET\" \"$STATE\" \"$TRANSITION\""
OUTPUT=$(npm run register-request -- -e "$ENDPOINT" "$SECRET" "$STATE" "$TRANSITION" 2>&1)
echo "$OUTPUT"

# Extract Request ID from output
REQUEST_ID=$(echo "$OUTPUT" | grep -oP 'Request ID: \K[a-fA-F0-9]+' | tail -1)

if [ -z "$REQUEST_ID" ]; then
  echo "Failed to extract Request ID"
  exit 1
fi

echo ""
echo "Extracted Request ID: $REQUEST_ID"
echo ""

# Wait a bit
echo "3. Waiting 2 seconds for aggregator processing..."
sleep 2

# Query the inclusion proof using raw JSON-RPC
echo ""
echo "4. Querying inclusion proof via raw JSON-RPC..."
echo "--------------------------------------"
echo "Request:"
REQUEST_JSON='{"jsonrpc":"2.0","method":"get_inclusion_proof","params":{"requestId":"'$REQUEST_ID'"},"id":2}'
echo "$REQUEST_JSON" | python3 -m json.tool

echo ""
echo "Response:"
curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_JSON" \
  | python3 -m json.tool || echo "Failed to get response"

echo ""
echo ""

# Also try with the CLI command
echo "5. Querying via CLI get-request command..."
echo "--------------------------------------"
npm run get-request -- -e "$ENDPOINT" "$REQUEST_ID"

echo ""
echo "================================================"
echo "Debug Complete"
echo "================================================"