#!/bin/bash

# Test script to demonstrate the register-request issue
# This shows that same secret+state always generates the same RequestId

echo "================================================"
echo "Testing Register Request Issue"
echo "================================================"
echo ""

ENDPOINT="http://localhost:8080"
SECRET="test123"
STATE="state1"

echo "Test 1: Registering with transition 'transition1'"
echo "------------------------------------------------"
npm run register-request-debug -- -e $ENDPOINT -v "$SECRET" "$STATE" "transition1"
echo ""
echo ""

echo "Test 2: Registering with SAME secret+state but DIFFERENT transition 'transition2'"
echo "---------------------------------------------------------------------------------"
npm run register-request-debug -- -e $ENDPOINT -v "$SECRET" "$STATE" "transition2"
echo ""
echo ""

echo "================================================"
echo "NOTICE THE SAME REQUEST ID!"
echo "This is because RequestId = hash(publicKey + stateHash)"
echo "The transition is NOT included in the RequestId calculation"
echo "================================================"