#!/usr/bin/env bash
# Test runner for Unicity CLI functional tests
# Usage: ./run-tests.sh [suite] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SUITE="${1:-all}"
PARALLEL="${PARALLEL:-false}"
VERBOSE="${VERBOSE:-false}"
FILTER="${2:-}"

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEST_DIR="${SCRIPT_DIR}/functional"

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}=== Checking Prerequisites ===${NC}"

    # Check BATS
    if ! command -v bats &> /dev/null; then
        echo -e "${RED}✗ BATS not installed${NC}"
        echo "Install with: sudo apt-get install bats  # Ubuntu/Debian"
        echo "            or brew install bats-core      # macOS"
        exit 1
    fi
    echo -e "${GREEN}✓ BATS installed${NC}"

    # Check jq
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}✗ jq not installed${NC}"
        echo "Install with: sudo apt-get install jq  # Ubuntu/Debian"
        echo "            or brew install jq          # macOS"
        exit 1
    fi
    echo -e "${GREEN}✓ jq installed${NC}"

    # Check CLI build
    if [[ ! -f "${PROJECT_ROOT}/dist/index.js" ]]; then
        echo -e "${YELLOW}⚠ CLI not built${NC}"
        echo "Building CLI..."
        cd "${PROJECT_ROOT}"
        npm run build
        cd - > /dev/null
    fi
    echo -e "${GREEN}✓ CLI built${NC}"

    # Check aggregator
    local endpoint="${AGGREGATOR_ENDPOINT:-http://localhost:3000}"
    if curl -s -f "${endpoint}/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Aggregator running at ${endpoint}${NC}"
    else
        echo -e "${YELLOW}⚠ Aggregator not reachable at ${endpoint}${NC}"
        echo "Some tests may be skipped."
        echo "Start aggregator or set AGGREGATOR_ENDPOINT environment variable."
    fi

    echo ""
}

# Display usage
usage() {
    cat << EOF
Usage: $0 [suite] [filter] [options]

Test Suites:
  all               Run all test suites (default)
  gen-address       Run gen-address tests (16 tests)
  mint-token        Run mint-token tests (20 tests)
  send-token        Run send-token tests (13 tests)
  receive-token     Run receive-token tests (7 tests)
  verify-token      Run verify-token tests (10 tests)
  integration       Run integration tests (10 tests)

Filter:
  Pattern to filter specific tests (e.g., "001" or "GEN_ADDR-001")

Environment Variables:
  PARALLEL=true     Run tests in parallel (faster but harder to debug)
  VERBOSE=true      Enable verbose output
  DEBUG_TESTS=true  Enable debug output in tests
  AGGREGATOR_ENDPOINT=<url>  Custom aggregator endpoint

Examples:
  $0                           # Run all tests
  $0 gen-address               # Run gen-address tests only
  $0 mint-token "001"          # Run MINT_TOKEN-001 test
  PARALLEL=true $0             # Run all tests in parallel
  VERBOSE=true $0 integration  # Run integration tests with verbose output

EOF
    exit 0
}

# Run test suite
run_suite() {
    local suite="$1"
    local filter="$2"

    local test_file="${TEST_DIR}/test_${suite}.bats"

    if [[ ! -f "${test_file}" ]]; then
        echo -e "${RED}✗ Test file not found: ${test_file}${NC}"
        return 1
    fi

    echo -e "${BLUE}=== Running ${suite} tests ===${NC}"

    local bats_args=()
    if [[ -n "${filter}" ]]; then
        bats_args+=("-f" "${filter}")
        echo "Filter: ${filter}"
    fi

    if [[ "${VERBOSE}" == "true" ]]; then
        bats_args+=("--verbose-run")
    fi

    # Run BATS
    if bats "${bats_args[@]}" "${test_file}"; then
        echo -e "${GREEN}✓ ${suite} tests passed${NC}"
        return 0
    else
        echo -e "${RED}✗ ${suite} tests failed${NC}"
        return 1
    fi
}

# Run all suites
run_all_suites() {
    local filter="$1"
    local failed=0
    local total=0

    local suites=(
        "gen_address"
        "mint_token"
        "send_token"
        "receive_token"
        "verify_token"
        "integration"
    )

    echo -e "${BLUE}=== Running All Test Suites ===${NC}"
    echo ""

    for suite in "${suites[@]}"; do
        ((total++))
        if ! run_suite "${suite}" "${filter}"; then
            ((failed++))
        fi
        echo ""
    done

    # Summary
    echo -e "${BLUE}=== Test Summary ===${NC}"
    echo "Total suites: ${total}"
    echo "Passed: $((total - failed))"
    echo "Failed: ${failed}"

    if [[ ${failed} -eq 0 ]]; then
        echo -e "${GREEN}✓ All test suites passed!${NC}"
        return 0
    else
        echo -e "${RED}✗ ${failed} test suite(s) failed${NC}"
        return 1
    fi
}

# Run tests in parallel
run_parallel() {
    local filter="$1"

    echo -e "${BLUE}=== Running Tests in Parallel ===${NC}"
    echo ""

    if ! command -v parallel &> /dev/null; then
        echo -e "${YELLOW}⚠ GNU parallel not installed${NC}"
        echo "Install with: sudo apt-get install parallel  # Ubuntu/Debian"
        echo "            or brew install parallel          # macOS"
        echo "Falling back to sequential execution..."
        echo ""
        run_all_suites "${filter}"
        return $?
    fi

    local test_files=()
    for f in "${TEST_DIR}"/*.bats; do
        test_files+=("${f}")
    done

    local bats_args=()
    if [[ -n "${filter}" ]]; then
        bats_args+=("-f" "${filter}")
    fi

    # Run in parallel
    if printf '%s\n' "${test_files[@]}" | parallel -j 4 bats "${bats_args[@]}" {}; then
        echo -e "${GREEN}✓ All tests passed${NC}"
        return 0
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        return 1
    fi
}

# Main execution
main() {
    # Parse arguments
    if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
        usage
    fi

    # Check prerequisites
    check_prerequisites

    # Run tests
    local exit_code=0

    if [[ "${PARALLEL}" == "true" ]]; then
        run_parallel "${FILTER}" || exit_code=$?
    elif [[ "${SUITE}" == "all" ]]; then
        run_all_suites "${FILTER}" || exit_code=$?
    else
        # Map suite names to file names
        local suite_file="${SUITE//-/_}"
        run_suite "${suite_file}" "${FILTER}" || exit_code=$?
    fi

    echo ""
    if [[ ${exit_code} -eq 0 ]]; then
        echo -e "${GREEN}✓ Test run completed successfully${NC}"
    else
        echo -e "${RED}✗ Test run completed with failures${NC}"
    fi

    exit ${exit_code}
}

# Run main
main "$@"
