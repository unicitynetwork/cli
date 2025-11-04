#!/usr/bin/env bash
# =============================================================================
# Security Test Suite Runner
# =============================================================================
# Comprehensive script to run all security tests with proper reporting
#
# Usage:
#   ./run-security-tests.sh [options]
#
# Options:
#   --category <name>   Run specific category (auth, dblspend, crypto, input, access, integrity)
#   --critical-only     Run only critical priority tests
#   --debug             Enable debug output
#   --keep-tmp          Keep temporary files on failure
#   --help              Show this help message
#
# Examples:
#   ./run-security-tests.sh                    # Run all tests
#   ./run-security-tests.sh --category auth    # Run authentication tests only
#   ./run-security-tests.sh --critical-only    # Run critical tests only
#   ./run-security-tests.sh --debug            # Run with debug output
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
CATEGORY=""
CRITICAL_ONLY=false
DEBUG=false
KEEP_TMP=false

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

show_help() {
    cat << EOF
Security Test Suite Runner

Usage: $0 [options]

Options:
    --category <name>   Run specific category:
                          auth       - Authentication tests
                          dblspend   - Double-spend prevention tests
                          crypto     - Cryptographic security tests
                          input      - Input validation tests
                          access     - Access control tests
                          integrity  - Data integrity tests

    --critical-only     Run only CRITICAL priority tests
    --debug             Enable debug output (UNICITY_TEST_DEBUG=1)
    --keep-tmp          Keep temporary files on failure
    --help              Show this help message

Examples:
    $0                              # Run all security tests
    $0 --category auth              # Run authentication tests only
    $0 --critical-only              # Run critical tests only
    $0 --debug --keep-tmp           # Debug mode with temp file preservation

Test Categories:
    1. Authentication (6 tests)      - SEC-AUTH-001 to 006
    2. Double-Spend (6 tests)        - SEC-DBLSPEND-001 to 006
    3. Cryptographic (8 tests)       - SEC-CRYPTO-001 to 007 + EXTRA
    4. Input Validation (9 tests)    - SEC-INPUT-001 to 008 + EXTRA
    5. Access Control (5 tests)      - SEC-ACCESS-001 to 004 + EXTRA
    6. Data Integrity (7 tests)      - SEC-INTEGRITY-001 to 005 + 2 EXTRA

Total: 41 security test scenarios
EOF
}

# =============================================================================
# Parse Arguments
# =============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --category)
            CATEGORY="$2"
            shift 2
            ;;
        --critical-only)
            CRITICAL_ONLY=true
            shift
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        --keep-tmp)
            KEEP_TMP=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# =============================================================================
# Pre-flight Checks
# =============================================================================

print_header "Security Test Suite Pre-flight Checks"

# Check BATS is installed
if ! command -v bats &> /dev/null; then
    print_error "BATS not found. Please install BATS:"
    echo "  macOS: brew install bats-core"
    echo "  Ubuntu: sudo apt-get install bats"
    exit 1
fi
print_success "BATS installed ($(bats --version))"

# Check CLI is built
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
CLI_PATH="${PROJECT_ROOT}/dist/index.js"

if [[ ! -f "$CLI_PATH" ]]; then
    print_error "CLI not built. Run: npm run build"
    exit 1
fi
print_success "CLI built at ${CLI_PATH}"

# Check aggregator is running
AGGREGATOR_URL="${UNICITY_AGGREGATOR_URL:-http://localhost:3000}"
if ! curl --silent --fail --max-time 5 "${AGGREGATOR_URL}/health" &> /dev/null; then
    print_warning "Aggregator not available at ${AGGREGATOR_URL}"
    print_info "Some tests may be skipped. Start aggregator with: docker compose up -d"
else
    print_success "Aggregator available at ${AGGREGATOR_URL}"
fi

# Check Node.js version
NODE_VERSION=$(node --version)
print_success "Node.js ${NODE_VERSION}"

# =============================================================================
# Determine Test Files
# =============================================================================

declare -a TEST_FILES=()

if [[ -n "$CATEGORY" ]]; then
    case "$CATEGORY" in
        auth)
            TEST_FILES=("test_authentication.bats")
            ;;
        dblspend)
            TEST_FILES=("test_double_spend.bats")
            ;;
        crypto)
            TEST_FILES=("test_cryptographic.bats")
            ;;
        input)
            TEST_FILES=("test_input_validation.bats")
            ;;
        access)
            TEST_FILES=("test_access_control.bats")
            ;;
        integrity)
            TEST_FILES=("test_data_integrity.bats")
            ;;
        *)
            print_error "Unknown category: $CATEGORY"
            echo "Valid categories: auth, dblspend, crypto, input, access, integrity"
            exit 1
            ;;
    esac
else
    # Run all tests
    TEST_FILES=(
        "test_authentication.bats"
        "test_double_spend.bats"
        "test_cryptographic.bats"
        "test_input_validation.bats"
        "test_access_control.bats"
        "test_data_integrity.bats"
    )
fi

# =============================================================================
# Set Environment Variables
# =============================================================================

export UNICITY_AGGREGATOR_URL="${AGGREGATOR_URL}"

if [[ "$DEBUG" == "true" ]]; then
    export UNICITY_TEST_DEBUG=1
    print_info "Debug mode enabled"
fi

if [[ "$KEEP_TMP" == "true" ]]; then
    export UNICITY_TEST_KEEP_TMP=1
    print_info "Keeping temporary files on failure"
fi

# =============================================================================
# Run Tests
# =============================================================================

print_header "Running Security Tests"

if [[ "$CRITICAL_ONLY" == "true" ]]; then
    print_warning "CRITICAL-ONLY mode: Only critical tests will run"
    print_info "Note: BATS doesn't support test filtering, all tests will run"
    print_info "Review output and focus on tests marked CRITICAL"
fi

TOTAL_FILES=${#TEST_FILES[@]}
PASSED_FILES=0
FAILED_FILES=0

declare -a FAILED_FILE_NAMES=()

START_TIME=$(date +%s)

for test_file in "${TEST_FILES[@]}"; do
    if [[ ! -f "$test_file" ]]; then
        print_error "Test file not found: $test_file"
        continue
    fi

    echo ""
    print_info "Running: $test_file"
    echo ""

    if bats "$test_file"; then
        ((PASSED_FILES++))
        print_success "$test_file - PASSED"
    else
        ((FAILED_FILES++))
        FAILED_FILE_NAMES+=("$test_file")
        print_error "$test_file - FAILED"
    fi
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# =============================================================================
# Summary Report
# =============================================================================

echo ""
print_header "Security Test Suite Summary"

echo ""
echo "Test Execution Summary:"
echo "  Total Files: $TOTAL_FILES"
echo "  Passed:      ${PASSED_FILES}"
echo "  Failed:      ${FAILED_FILES}"
echo "  Duration:    ${DURATION}s"

if [[ ${#FAILED_FILE_NAMES[@]} -gt 0 ]]; then
    echo ""
    print_error "Failed Test Files:"
    for failed_file in "${FAILED_FILE_NAMES[@]}"; do
        echo "  - $failed_file"
    done
fi

echo ""

if [[ $FAILED_FILES -eq 0 ]]; then
    print_success "All security tests passed! ✅"
    echo ""
    print_success "Security Status: EXCELLENT"
    print_info "The Unicity CLI demonstrates strong security across all tested categories"
    echo ""
    exit 0
else
    print_error "Some security tests failed! ❌"
    echo ""
    print_warning "Security Status: REVIEW REQUIRED"
    print_info "Please review failed tests and fix security issues before production"
    echo ""
    exit 1
fi
