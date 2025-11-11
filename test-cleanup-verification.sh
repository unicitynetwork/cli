#!/usr/bin/env bash
# =============================================================================
# Test Cleanup Verification Script
# =============================================================================
# This script verifies that test cleanup and isolation is working correctly.
# It runs tests and checks for leftover files and proper temp directory usage.
#
# Usage:
#   ./test-cleanup-verification.sh
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}===================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"

    local missing=()

    command -v bats >/dev/null 2>&1 || missing+=("bats")
    command -v jq >/dev/null 2>&1 || missing+=("jq")

    if [[ ${#missing[@]} -gt 0 ]]; then
        print_error "Missing required tools: ${missing[*]}"
        exit 1
    fi

    if [[ ! -f "dist/index.js" ]]; then
        print_error "CLI binary not found. Run 'npm run build' first."
        exit 1
    fi

    print_success "All prerequisites met"
}

# Check for leftover test files in project root
check_project_root_cleanup() {
    print_header "Checking Project Root for Test Files"

    local test_files_count=0
    local test_files=()

    # Check for common test file patterns
    mapfile -t test_files < <(find . -maxdepth 1 -name "*.txf" -o -name "address.json" -o -name "bob-*.json" -o -name "alice-*.json" -o -name "token*.txf" -o -name "transfer*.txf" 2>/dev/null)

    test_files_count=${#test_files[@]}

    if [[ $test_files_count -eq 0 ]]; then
        print_success "No leftover test files in project root"
    else
        print_error "Found $test_files_count leftover test files in project root:"
        for file in "${test_files[@]}"; do
            echo "  - $file"
        done
    fi
}

# Check temp directory cleanup
check_temp_directory_cleanup() {
    print_header "Checking /tmp for Leftover Test Directories"

    local bats_dirs
    bats_dirs=$(find /tmp -maxdepth 1 -name "bats-test-*" -type d 2>/dev/null | wc -l)

    if [[ $bats_dirs -eq 0 ]]; then
        print_success "No leftover BATS test directories in /tmp"
    else
        print_error "Found $bats_dirs leftover BATS test directories in /tmp"
        find /tmp -maxdepth 1 -name "bats-test-*" -type d 2>/dev/null | while read -r dir; do
            echo "  - $dir"
            ls -la "$dir" | head -5
        done
    fi
}

# Run a single test and verify cleanup
run_single_test_cleanup_check() {
    print_header "Running Single Test and Verifying Cleanup"

    local test_file="tests/functional/test_gen_address.bats"
    local test_name="GEN_ADDR-003"

    if [[ ! -f "$test_file" ]]; then
        print_warning "Test file not found: $test_file (skipping)"
        return
    fi

    print_info "Running test: $test_name"

    # Count test directories before
    local before_count
    before_count=$(find /tmp -maxdepth 1 -name "bats-test-*" -type d 2>/dev/null | wc -l)

    # Run test
    local test_output
    local test_status=0
    test_output=$(bats "$test_file" -f "$test_name" 2>&1) || test_status=$?

    # Count test directories after
    local after_count
    after_count=$(find /tmp -maxdepth 1 -name "bats-test-*" -type d 2>/dev/null | wc -l)

    if [[ $after_count -eq $before_count ]]; then
        print_success "Temp directories cleaned up properly (before: $before_count, after: $after_count)"
    else
        print_error "Temp directories not cleaned up (before: $before_count, after: $after_count)"
    fi

    # Check for files in project root
    local txf_files
    txf_files=$(find . -maxdepth 1 -name "*.txf" -o -name "address.json" 2>/dev/null | wc -l)

    if [[ $txf_files -eq 0 ]]; then
        print_success "No test files left in project root"
    else
        print_error "Found $txf_files test files in project root after test"
    fi
}

# Check helper function patterns
check_helper_function_patterns() {
    print_header "Checking Helper Function File Creation Patterns"

    local helpers_file="tests/helpers/token-helpers.bash"

    if [[ ! -f "$helpers_file" ]]; then
        print_error "Helper file not found: $helpers_file"
        return
    fi

    # Check for hardcoded paths outside temp directory
    local hardcoded_paths
    hardcoded_paths=$(grep -n "^[[:space:]]*>" "$helpers_file" | grep -v "\$TEST_TEMP_DIR" | grep -v "\$(create_temp_file" | wc -l)

    if [[ $hardcoded_paths -eq 0 ]]; then
        print_success "No hardcoded paths found in helper functions"
    else
        print_warning "Found $hardcoded_paths potential hardcoded paths in helper functions"
    fi

    # Check that helper functions use temp directory or create_temp_file
    local temp_dir_usage
    temp_dir_usage=$(grep -c "TEST_TEMP_DIR\|create_temp_file" "$helpers_file" || echo "0")

    if [[ $temp_dir_usage -gt 5 ]]; then
        print_success "Helper functions properly use temp directory patterns ($temp_dir_usage usages)"
    else
        print_warning "Limited temp directory usage in helper functions ($temp_dir_usage usages)"
    fi
}

# Check test file patterns
check_test_file_patterns() {
    print_header "Checking Test File Patterns"

    local test_files=(
        "tests/functional/test_send_token.bats"
        "tests/functional/test_mint_token.bats"
        "tests/functional/test_gen_address.bats"
    )

    for test_file in "${test_files[@]}"; do
        if [[ ! -f "$test_file" ]]; then
            print_warning "Test file not found: $test_file (skipping)"
            continue
        fi

        local file_name
        file_name=$(basename "$test_file")

        # Check for setup/teardown functions
        local has_setup
        local has_teardown
        has_setup=$(grep -c "^setup()" "$test_file" || echo "0")
        has_teardown=$(grep -c "^teardown()" "$test_file" || echo "0")

        if [[ $has_setup -gt 0 ]] && [[ $has_teardown -gt 0 ]]; then
            print_success "$file_name: Has setup/teardown functions"
        else
            print_error "$file_name: Missing setup/teardown functions"
        fi

        # Check for setup_common/teardown_common calls
        local has_setup_common
        local has_teardown_common
        has_setup_common=$(grep -c "setup_common" "$test_file" || echo "0")
        has_teardown_common=$(grep -c "teardown_common" "$test_file" || echo "0")

        if [[ $has_setup_common -gt 0 ]] && [[ $has_teardown_common -gt 0 ]]; then
            print_success "$file_name: Calls setup_common/teardown_common"
        else
            print_error "$file_name: Missing setup_common/teardown_common calls"
        fi

        # Check for absolute paths (potential issue)
        local absolute_paths
        absolute_paths=$(grep -n "^[[:space:]]*[a-z_]*=\"/[^$]" "$test_file" | wc -l)

        if [[ $absolute_paths -eq 0 ]]; then
            print_success "$file_name: No absolute paths found"
        else
            print_warning "$file_name: Found $absolute_paths potential absolute paths"
        fi
    done
}

# Summary
print_summary() {
    print_header "Verification Summary"

    echo -e "${GREEN}Passed checks: $PASSED${NC}"
    echo -e "${RED}Failed checks: $FAILED${NC}"
    echo ""

    if [[ $FAILED -eq 0 ]]; then
        echo -e "${GREEN}✓ All cleanup and isolation checks passed!${NC}"
        return 0
    else
        echo -e "${RED}✗ Some checks failed. Review the output above.${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo -e "${BLUE}╔═══════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Test Cleanup and Isolation Verification Script  ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════╝${NC}"

    check_prerequisites
    check_project_root_cleanup
    check_temp_directory_cleanup
    check_helper_function_patterns
    check_test_file_patterns
    run_single_test_cleanup_check

    print_summary
}

# Run main
main
