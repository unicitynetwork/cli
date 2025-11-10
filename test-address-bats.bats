#!/usr/bin/env bats

load 'tests/helpers/common'
load 'tests/helpers/token-helpers'

setup() {
  setup_common
  require_aggregator
}

teardown() {
  teardown_common
}

@test "get address from token" {
  SECRET="test-secret-bats-address" 
  
  run_cli_with_secret "${SECRET}" "mint-token --preset nft --local -o mytoken.txf"
  
  # Debug: show what files exist
  ls -la *.txf >&2 || true
  pwd >&2
  
  # Check file exists
  [[ -f "mytoken.txf" ]]
  
  # Debug: Show file content
  jq -r '.genesis.data.recipient' mytoken.txf >&2
  
  # Try to get address
  local address
  address=$(get_txf_address "mytoken.txf")
  
  echo "Address from function: '$address'" >&2
  echo "Address length: ${#address}" >&2
  
  # This should not be empty
  [[ -n "$address" ]]
}
