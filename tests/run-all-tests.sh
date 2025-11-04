#!/usr/bin/env bash
# =============================================================================
# Unicity CLI - Master Test Runner
# =============================================================================
# Comprehensive test orchestration script for running all test suites with:
# - Support for selective test execution
# - Parallel execution with safety checks
# - Consolidated reporting
# - Progress tracking
# - Debug mode support
# - Performance metrics
#
# Usage: ./tests/run-all-tests.sh [OPTIONS]
#
# Options:
#   --functional       Run functional tests only
#   --security        Run security tests only
#   --edge-cases      Run edge case tests only
#   --unit            Run unit tests only
#   --all             Run all test suites (default)
#   --parallel        Run test suites in parallel
#   --debug           Enable debug mode
#   --verbose         Enable verbose output
#   --no-color        Disable colored output
#   --timeout N       Set timeout for tests (in seconds)
#   --reporter json   Generate JSON report
#   --reporter html   Generate HTML report
#   --help            Display this help message
#
# Examples:
#   ./tests/run-all-tests.sh
#   ./tests/run-all-tests.sh --functional --parallel
#   ./tests/run-all-tests.sh --security --debug
#   ./tests/run-all-tests.sh --all --reporter json
# =============================================================================

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd -P)"
RESULTS_DIR="${SCRIPT_DIR}/results"
REPORTS_DIR="${SCRIPT_DIR}/reports"

# Test configuration
declare -A TEST_SUITES=(
    ["functional"]="tests/functional"
    ["security"]="tests/security"
    ["edge-cases"]="tests/edge-cases"
    ["unit"]="tests/unit"
)

# Execution settings
PARALLEL=false
DEBUG=false
VERBOSE=false
NO_COLOR=false
TIMEOUT=300
REPORTER=""
DRY_RUN=false
SELECTED_SUITES=()

# Results tracking
declare -A RESULTS
declare -a EXECUTED_SUITES
START_TIME=""
END_TIME=""
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# =============================================================================
# Functions - Output Formatting
# =============================================================================

# Apply color based on NO_COLOR flag
colorize() {
    if [[ "${NO_COLOR}" == "true" ]]; then
        echo "$2"
    else
        echo -e "$1$2${NC}"
    fi
}

log_info() {
    colorize "${BLUE}" "INFO: $*"
}

log_success() {
    colorize "${GREEN}" "✓ $*"
}

log_error() {
    colorize "${RED}" "✗ $*" >&2
}

log_warning() {
    colorize "${YELLOW}" "⚠ $*"
}

log_section() {
    echo ""
    colorize "${CYAN}" "═══════════════════════════════════════════════════════════════════"
    colorize "${CYAN}" "  $*"
    colorize "${CYAN}" "═══════════════════════════════════════════════════════════════════"
}

log_subsection() {
    echo ""
    colorize "${BLUE}" "───────────────────────────────────────────────────────────────────"
    colorize "${BLUE}" "  $*"
    colorize "${BLUE}" "───────────────────────────────────────────────────────────────────"
}

# Print progress indicator
print_progress() {
    local current=$1
    local total=$2
    local status=$3

    local percent=$((current * 100 / total))
    local filled=$((percent / 5))
    local empty=$((20 - filled))

    printf "\r[%-20s] %3d%% - %s" \
        "$(printf '=%.0s' $(seq 1 $filled))$(printf ' %.0s' $(seq 1 $empty))" \
        "$percent" \
        "$status"
}

# =============================================================================
# Functions - Prerequisites Check
# =============================================================================

check_prerequisites() {
    log_section "Checking Prerequisites"

    local missing=()

    # Check required tools
    if ! command -v bats &> /dev/null; then
        missing+=("bats")
    else
        log_success "BATS found: $(bats --version 2>/dev/null | cut -d' ' -f2)"
    fi

    if ! command -v jq &> /dev/null; then
        missing+=("jq")
    else
        log_success "jq found"
    fi

    if ! command -v bash &> /dev/null; then
        missing+=("bash")
    else
        log_success "bash found"
    fi

    # Check CLI is built
    if [[ ! -f "${PROJECT_ROOT}/dist/index.js" ]]; then
        log_warning "CLI not built, building now..."
        if ! (cd "${PROJECT_ROOT}" && npm run build > /dev/null 2>&1); then
            missing+=("CLI build")
            log_error "Failed to build CLI"
        else
            log_success "CLI built successfully"
        fi
    else
        log_success "CLI already built"
    fi

    # Check aggregator (optional)
    if curl -s -f "http://localhost:3000/health" > /dev/null 2>&1; then
        log_success "Aggregator running at http://localhost:3000"
    else
        log_warning "Aggregator not available at http://localhost:3000"
        log_info "Some tests may be skipped. Start aggregator or set AGGREGATOR_ENDPOINT"
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing prerequisites: ${missing[*]}"
        echo ""
        log_info "Please install missing tools:"
        for tool in "${missing[@]}"; do
            case "$tool" in
                bats)
                    echo "  Ubuntu/Debian: sudo apt-get install bats"
                    echo "  macOS: brew install bats-core"
                    ;;
                jq)
                    echo "  Ubuntu/Debian: sudo apt-get install jq"
                    echo "  macOS: brew install jq"
                    ;;
            esac
        done
        return 1
    fi

    echo ""
    log_success "All prerequisites satisfied"
}

# =============================================================================
# Functions - Test Discovery
# =============================================================================

discover_tests() {
    local suite="$1"
    local test_dir="${SCRIPT_DIR}/${TEST_SUITES[$suite]}"

    if [[ ! -d "$test_dir" ]]; then
        log_error "Test directory not found: $test_dir"
        return 1
    fi

    # Count test files
    find "$test_dir" -name "*.bats" -type f | wc -l
}

list_test_files() {
    local suite="$1"
    local test_dir="${SCRIPT_DIR}/${TEST_SUITES[$suite]}"

    find "$test_dir" -name "*.bats" -type f | sort
}

# Parse BATS output to extract statistics
parse_bats_output() {
    local output="$1"

    # Extract counts from TAP format output
    # Format: "ok N test name" or "not ok N test name"
    local total=$(echo "$output" | grep -c "^ok\|^not ok" || true)
    local passed=$(echo "$output" | grep -c "^ok " || true)
    local failed=$(echo "$output" | grep -c "^not ok " || true)

    echo "$total:$passed:$failed"
}

# =============================================================================
# Functions - Test Execution
# =============================================================================

run_test_suite() {
    local suite="$1"
    local test_dir="${SCRIPT_DIR}/${TEST_SUITES[$suite]}"

    log_subsection "Running $suite tests"

    if [[ ! -d "$test_dir" ]]; then
        log_error "Test directory not found: $test_dir"
        RESULTS["$suite"]="ERROR"
        return 1
    fi

    # Find test files
    local test_files=()
    while IFS= read -r -d '' file; do
        test_files+=("$file")
    done < <(find "$test_dir" -name "*.bats" -type f -print0 | sort -z)

    if [[ ${#test_files[@]} -eq 0 ]]; then
        log_warning "No test files found in $test_dir"
        RESULTS["$suite"]="SKIP"
        return 0
    fi

    # Prepare environment
    export UNICITY_TEST_DEBUG="${DEBUG}"
    if [[ "${VERBOSE}" == "true" ]]; then
        export UNICITY_TEST_VERBOSE=1
    fi

    # Run tests
    local test_count=${#test_files[@]}
    local passed=0
    local failed=0
    local output=""

    for test_file in "${test_files[@]}"; do
        local test_name=$(basename "$test_file" .bats)
        local test_output
        local test_status=0

        if [[ "${DRY_RUN}" == "true" ]]; then
            log_info "Would run: $test_file"
            continue
        fi

        # Run with timeout
        if test_output=$(timeout "$TIMEOUT" bats "$test_file" 2>&1); then
            test_status=0
        else
            test_status=$?
        fi

        output="${output}${test_output}"

        if [[ $test_status -eq 0 ]]; then
            ((passed++))
            log_success "$test_name"
        else
            ((failed++))
            log_error "$test_name (exit code: $test_status)"
        fi
    done

    # Record results
    if [[ $failed -eq 0 ]]; then
        RESULTS["$suite"]="PASS"
        echo ""
        log_success "$suite: $passed/$test_count tests passed"
        return 0
    else
        RESULTS["$suite"]="FAIL"
        echo ""
        log_error "$suite: $failed/$test_count tests failed ($passed passed)"
        return 1
    fi
}

run_all_sequential() {
    log_section "Running All Test Suites (Sequential)"

    START_TIME=$(date +%s)

    local failed_suites=0

    for suite in "${SELECTED_SUITES[@]}"; do
        if run_test_suite "$suite"; then
            :
        else
            ((failed_suites++))
        fi
    done

    END_TIME=$(date +%s)

    if [[ $failed_suites -eq 0 ]]; then
        log_success "All test suites passed"
        return 0
    else
        log_error "$failed_suites test suite(s) failed"
        return 1
    fi
}

run_all_parallel() {
    log_section "Running All Test Suites (Parallel)"

    START_TIME=$(date +%s)

    if ! command -v parallel &> /dev/null; then
        log_warning "GNU parallel not installed, falling back to sequential execution"
        return run_all_sequential
    fi

    # Create temporary directory for parallel output
    local tmp_dir=$(mktemp -d)
    trap "rm -rf '$tmp_dir'" RETURN

    # Run suites in parallel
    local results=()
    for suite in "${SELECTED_SUITES[@]}"; do
        (
            run_test_suite "$suite" > "$tmp_dir/$suite.log" 2>&1
        ) &
        results+=($!)
    done

    # Wait for all background jobs and collect results
    local failed=0
    for i in "${!results[@]}"; do
        local suite="${SELECTED_SUITES[$i]}"
        if wait "${results[$i]}"; then
            log_success "$suite passed"
        else
            ((failed++))
            log_error "$suite failed"
        fi
    done

    END_TIME=$(date +%s)

    # Display logs for failed suites
    if [[ $failed -gt 0 ]]; then
        log_section "Failed Test Output"
        for suite in "${SELECTED_SUITES[@]}"; do
            if [[ ! -f "$tmp_dir/$suite.log" ]] || ! grep -q "PASS" "$tmp_dir/$suite.log"; then
                log_subsection "$suite output"
                cat "$tmp_dir/$suite.log"
            fi
        done
        return 1
    fi

    return 0
}

# =============================================================================
# Functions - Reporting
# =============================================================================

generate_summary() {
    local duration=$((END_TIME - START_TIME))

    log_section "Test Execution Summary"

    echo ""
    colorize "${CYAN}" "Test Suites Executed:"
    for suite in "${EXECUTED_SUITES[@]}"; do
        local status=${RESULTS[$suite]}
        case "$status" in
            PASS)
                log_success "$suite"
                ;;
            FAIL)
                log_error "$suite"
                ;;
            SKIP)
                log_warning "$suite (skipped)"
                ;;
            ERROR)
                log_error "$suite (error)"
                ;;
        esac
    done

    echo ""
    colorize "${CYAN}" "Execution Statistics:"
    echo "  Total test suites: ${#EXECUTED_SUITES[@]}"

    local passed=0
    local failed=0
    for suite in "${EXECUTED_SUITES[@]}"; do
        if [[ "${RESULTS[$suite]}" == "PASS" ]]; then
            ((passed++))
        elif [[ "${RESULTS[$suite]}" == "FAIL" ]]; then
            ((failed++))
        fi
    done

    echo "  Passed: $passed"
    echo "  Failed: $failed"
    echo "  Duration: ${duration}s"

    echo ""
}

generate_json_report() {
    if [[ -z "${REPORTER}" ]] || [[ "${REPORTER}" != "json" ]]; then
        return 0
    fi

    local report_file="${REPORTS_DIR}/test-results.json"
    mkdir -p "${REPORTS_DIR}"

    local duration=$((END_TIME - START_TIME))

    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "duration": $duration,
  "suites": [
EOF

    local first=true
    for suite in "${EXECUTED_SUITES[@]}"; do
        if [[ "$first" == "false" ]]; then
            echo "," >> "$report_file"
        fi
        first=false

        local status=${RESULTS[$suite]}
        cat >> "$report_file" << EOF
    {
      "name": "$suite",
      "status": "$status"
    }
EOF
    done

    cat >> "$report_file" << EOF

  ]
}
EOF

    log_success "JSON report generated: $report_file"
}

generate_html_report() {
    if [[ -z "${REPORTER}" ]] || [[ "${REPORTER}" != "html" ]]; then
        return 0
    fi

    local report_file="${REPORTS_DIR}/test-results.html"
    mkdir -p "${REPORTS_DIR}"

    local duration=$((END_TIME - START_TIME))
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    cat > "$report_file" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unicity CLI Test Results</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        .header p {
            opacity: 0.9;
            font-size: 0.95em;
        }
        .content {
            padding: 30px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-box {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .stat-box.success { border-left-color: #10b981; }
        .stat-box.error { border-left-color: #ef4444; }
        .stat-box.warning { border-left-color: #f59e0b; }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .results {
            margin-top: 30px;
        }
        .results h2 {
            margin-bottom: 15px;
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        .result-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 10px;
            background: #f9f9f9;
            border-left: 4px solid #ccc;
        }
        .result-item.pass {
            background: #f0fdf4;
            border-left-color: #10b981;
        }
        .result-item.fail {
            background: #fef2f2;
            border-left-color: #ef4444;
        }
        .result-item.skip {
            background: #fffbeb;
            border-left-color: #f59e0b;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-badge.pass {
            background: #dcfce7;
            color: #166534;
        }
        .status-badge.fail {
            background: #fee2e2;
            color: #991b1b;
        }
        .status-badge.skip {
            background: #fef3c7;
            color: #92400e;
        }
        .footer {
            background: #f5f5f5;
            padding: 20px 30px;
            text-align: center;
            color: #666;
            font-size: 0.9em;
            border-top: 1px solid #e5e5e5;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Unicity CLI Test Results</h1>
            <p id="timestamp"></p>
        </div>

        <div class="content">
            <div class="summary" id="summary"></div>
            <div class="results">
                <h2>Test Suite Results</h2>
                <div id="results"></div>
            </div>
        </div>

        <div class="footer">
            <p>Generated by Unicity CLI Test Runner</p>
        </div>
    </div>

    <script>
        const data = {
            timestamp: 'TIMESTAMP_PLACEHOLDER',
            duration: DURATION_PLACEHOLDER,
            suites: SUITES_PLACEHOLDER
        };

        document.getElementById('timestamp').textContent = new Date(data.timestamp).toLocaleString();

        const summary = document.getElementById('summary');
        const passed = data.suites.filter(s => s.status === 'PASS').length;
        const failed = data.suites.filter(s => s.status === 'FAIL').length;
        const skipped = data.suites.filter(s => s.status === 'SKIP').length;

        summary.innerHTML = `
            <div class="stat-box success">
                <div class="stat-value">${passed}</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat-box error">
                <div class="stat-value">${failed}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-box warning">
                <div class="stat-value">${skipped}</div>
                <div class="stat-label">Skipped</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${data.duration}s</div>
                <div class="stat-label">Duration</div>
            </div>
        `;

        const results = document.getElementById('results');
        results.innerHTML = data.suites.map(suite => `
            <div class="result-item ${suite.status.toLowerCase()}">
                <span>${suite.name}</span>
                <span class="status-badge ${suite.status.toLowerCase()}">${suite.status}</span>
            </div>
        `).join('');
    </script>
</body>
</html>
EOF

    # Replace placeholders
    local suites_json="["
    local first=true
    for suite in "${EXECUTED_SUITES[@]}"; do
        if [[ "$first" == "false" ]]; then
            suites_json="${suites_json},"
        fi
        first=false
        suites_json="${suites_json}{\"name\":\"$suite\",\"status\":\"${RESULTS[$suite]}\"}"
    done
    suites_json="${suites_json}]"

    sed -i "s|TIMESTAMP_PLACEHOLDER|$timestamp|g" "$report_file"
    sed -i "s|DURATION_PLACEHOLDER|$duration|g" "$report_file"
    sed -i "s|SUITES_PLACEHOLDER|$suites_json|g" "$report_file"

    log_success "HTML report generated: $report_file"
}

# =============================================================================
# Functions - Help and Usage
# =============================================================================

display_help() {
    cat << 'EOF'
Unicity CLI - Master Test Runner

USAGE:
    ./tests/run-all-tests.sh [OPTIONS]

OPTIONS:
    --functional      Run functional tests only
    --security        Run security tests only
    --edge-cases      Run edge case tests only
    --unit            Run unit tests only
    --all             Run all test suites (default)

    --parallel        Run test suites in parallel
    --sequential      Run test suites sequentially (default)

    --debug           Enable debug mode
    --verbose         Enable verbose output
    --no-color        Disable colored output

    --timeout N       Set timeout for each test suite (seconds, default: 300)
    --dry-run         Show what would be executed without running tests

    --reporter json   Generate JSON report
    --reporter html   Generate HTML report

    --help            Display this help message

EXAMPLES:
    # Run all tests
    ./tests/run-all-tests.sh

    # Run functional tests only
    ./tests/run-all-tests.sh --functional

    # Run multiple suites in parallel
    ./tests/run-all-tests.sh --functional --security --parallel

    # Debug mode with verbose output
    ./tests/run-all-tests.sh --debug --verbose

    # Generate reports
    ./tests/run-all-tests.sh --reporter json --reporter html

    # Run with custom timeout
    ./tests/run-all-tests.sh --timeout 600

ENVIRONMENT VARIABLES:
    UNICITY_TEST_DEBUG=1          Enable debug output in tests
    UNICITY_TEST_VERBOSE=1        Enable verbose assertions
    AGGREGATOR_ENDPOINT=<url>     Custom aggregator URL
    PARALLEL=true                 Run tests in parallel
    VERBOSE=true                  Enable verbose output
    NO_COLOR=true                 Disable colored output

EOF
    exit 0
}

# =============================================================================
# Main Execution
# =============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --functional)
                SELECTED_SUITES+=("functional")
                shift
                ;;
            --security)
                SELECTED_SUITES+=("security")
                shift
                ;;
            --edge-cases)
                SELECTED_SUITES+=("edge-cases")
                shift
                ;;
            --unit)
                SELECTED_SUITES+=("unit")
                shift
                ;;
            --all)
                SELECTED_SUITES=("functional" "security" "edge-cases" "unit")
                shift
                ;;
            --parallel)
                PARALLEL=true
                shift
                ;;
            --sequential)
                PARALLEL=false
                shift
                ;;
            --debug)
                DEBUG=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --no-color)
                NO_COLOR=true
                shift
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --reporter)
                REPORTER="$2"
                shift 2
                ;;
            --help)
                display_help
                ;;
            *)
                log_error "Unknown option: $1"
                display_help
                ;;
        esac
    done

    # Default to all suites if none selected
    if [[ ${#SELECTED_SUITES[@]} -eq 0 ]]; then
        SELECTED_SUITES=("functional" "security" "edge-cases" "unit")
    fi

    # Store executed suites
    EXECUTED_SUITES=("${SELECTED_SUITES[@]}")
}

main() {
    # Parse arguments
    parse_arguments "$@"

    # Display banner
    colorize "${CYAN}" "
╔════════════════════════════════════════════════════════════════════════════╗
║                   Unicity CLI - Master Test Runner                         ║
║                                                                            ║
║  Running test suites: ${SELECTED_SUITES[*]^}
║  Execution mode: $(if [[ "${PARALLEL}" == "true" ]]; then echo "Parallel"; else echo "Sequential"; fi)
║  Timeout: ${TIMEOUT}s
╚════════════════════════════════════════════════════════════════════════════╝
    "

    # Check prerequisites
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        exit 1
    fi

    # Run tests
    local exit_code=0

    if [[ "${DRY_RUN}" == "true" ]]; then
        log_section "Dry Run Mode"
        for suite in "${SELECTED_SUITES[@]}"; do
            log_info "Would run tests in: ${TEST_SUITES[$suite]}"
            list_test_files "$suite" | while read -r file; do
                log_info "  $(basename "$file")"
            done
        done
        exit 0
    fi

    if [[ "${PARALLEL}" == "true" ]]; then
        run_all_parallel || exit_code=$?
    else
        run_all_sequential || exit_code=$?
    fi

    # Generate reports
    generate_summary
    generate_json_report
    generate_html_report

    # Final status
    echo ""
    if [[ $exit_code -eq 0 ]]; then
        colorize "${GREEN}" "
╔════════════════════════════════════════════════════════════════════════════╗
║                     All Tests Completed Successfully!                      ║
╚════════════════════════════════════════════════════════════════════════════╝
        "
    else
        colorize "${RED}" "
╔════════════════════════════════════════════════════════════════════════════╗
║                        Some Tests Failed!                                  ║
║              Please review the output above for details.                   ║
╚════════════════════════════════════════════════════════════════════════════╝
        "
    fi

    exit $exit_code
}

# Run main function
main "$@"
