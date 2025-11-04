#!/usr/bin/env bash
# =============================================================================
# Test Coverage Report Generator for Unicity CLI
# =============================================================================
# Analyzes BATS test output and generates coverage statistics and reports
#
# Usage: ./tests/generate-coverage.sh [OPTIONS]
#
# Options:
#   --format json      Generate JSON report (default)
#   --format html      Generate HTML report
#   --format text      Generate text report
#   --all              Generate all report formats
#   --output DIR       Output directory (default: tests/reports)
#   --help             Display this help message
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd -P)"
OUTPUT_DIR="${SCRIPT_DIR}/reports"
RESULTS_DIR="${SCRIPT_DIR}/results"
FORMATS=()

# Helper functions
log_info() {
    echo -e "${BLUE}INFO: $*${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $*${NC}"
}

log_error() {
    echo -e "${RED}✗ $*${NC}"
}

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --format)
                FORMATS+=("$2")
                shift 2
                ;;
            --all)
                FORMATS=("json" "html" "text")
                shift
                ;;
            --output)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            --help)
                display_help
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Default to JSON if no format specified
    if [[ ${#FORMATS[@]} -eq 0 ]]; then
        FORMATS=("json")
    fi
}

display_help() {
    cat << 'EOF'
Test Coverage Report Generator for Unicity CLI

USAGE:
    ./tests/generate-coverage.sh [OPTIONS]

OPTIONS:
    --format json      Generate JSON report (default)
    --format html      Generate HTML report
    --format text      Generate text report
    --all              Generate all report formats
    --output DIR       Output directory (default: tests/reports)
    --help             Display this help message

EXAMPLES:
    # Generate JSON report (default)
    ./tests/generate-coverage.sh

    # Generate HTML report
    ./tests/generate-coverage.sh --format html

    # Generate all formats
    ./tests/generate-coverage.sh --all

    # Custom output directory
    ./tests/generate-coverage.sh --output /tmp/reports --all

EOF
    exit 0
}

# =============================================================================
# Test Analysis Functions
# =============================================================================

discover_test_files() {
    find "${SCRIPT_DIR}" -name "*.bats" -type f | sort
}

count_test_cases() {
    local file="$1"
    # Count test() and @test declarations
    grep -E '^\s*@test|^\s*test' "$file" | wc -l
}

analyze_test_file() {
    local file="$1"
    local basename=$(basename "$file" .bats)
    local test_count=$(count_test_cases "$file")
    local lines=$(wc -l < "$file")

    echo "$basename|$test_count|$lines|$file"
}

# =============================================================================
# Report Generation Functions
# =============================================================================

generate_json_report() {
    log_info "Generating JSON coverage report..."

    local json_file="${OUTPUT_DIR}/coverage.json"
    mkdir -p "${OUTPUT_DIR}"

    # Analyze all tests
    local total_tests=0
    local total_files=0
    local test_suites=()

    # Generate JSON structure
    cat > "$json_file" << 'EOF'
{
  "timestamp": "TIMESTAMP_PLACEHOLDER",
  "summary": {
    "totalFiles": TOTAL_FILES_PLACEHOLDER,
    "totalTests": TOTAL_TESTS_PLACEHOLDER,
    "testSuites": TEST_SUITES_PLACEHOLDER
  },
  "details": [
EOF

    local first=true
    while IFS= read -r file; do
        if [[ -z "$file" ]]; then
            continue
        fi

        local basename=$(basename "$file" .bats)
        local suite_dir=$(dirname "$file" | xargs basename)
        local test_count=$(count_test_cases "$file")
        local lines=$(wc -l < "$file")

        ((total_tests += test_count))
        ((total_files++))

        if [[ "$first" == "false" ]]; then
            echo "," >> "$json_file"
        fi
        first=false

        cat >> "$json_file" << EOF
    {
      "file": "$basename",
      "suite": "$suite_dir",
      "path": "$file",
      "testCount": $test_count,
      "lines": $lines
    }
EOF
    done < <(discover_test_files)

    cat >> "$json_file" << EOF

  ]
}
EOF

    # Replace placeholders
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local test_suites_count=$(discover_test_files | awk -F'/' '{print $(NF-1)}' | sort -u | wc -l)

    sed -i "s|TIMESTAMP_PLACEHOLDER|$timestamp|g" "$json_file"
    sed -i "s|TOTAL_FILES_PLACEHOLDER|$total_files|g" "$json_file"
    sed -i "s|TOTAL_TESTS_PLACEHOLDER|$total_tests|g" "$json_file"
    sed -i "s|TEST_SUITES_PLACEHOLDER|$test_suites_count|g" "$json_file"

    log_success "JSON report generated: $json_file"
}

generate_html_report() {
    log_info "Generating HTML coverage report..."

    local html_file="${OUTPUT_DIR}/coverage.html"
    mkdir -p "${OUTPUT_DIR}"

    # Calculate statistics
    local total_tests=0
    local total_files=0
    local functional_tests=0
    local security_tests=0
    local edge_case_tests=0
    local unit_tests=0

    local test_details=""

    while IFS= read -r file; do
        if [[ -z "$file" ]]; then
            continue
        fi

        local basename=$(basename "$file" .bats)
        local suite_dir=$(dirname "$file" | xargs basename)
        local test_count=$(count_test_cases "$file")
        local lines=$(wc -l < "$file")

        ((total_tests += test_count))
        ((total_files++))

        case "$suite_dir" in
            functional) ((functional_tests += test_count)) ;;
            security) ((security_tests += test_count)) ;;
            edge-cases) ((edge_case_tests += test_count)) ;;
            unit) ((unit_tests += test_count)) ;;
        esac

        test_details+="<tr>
<td>$basename</td>
<td>$suite_dir</td>
<td>$test_count</td>
<td>$lines</td>
</tr>"
    done < <(discover_test_files)

    # Generate HTML
    cat > "$html_file" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unicity CLI Test Coverage Report</title>
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
            max-width: 1400px;
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
        }
        .header h1 {
            font-size: 2em;
            margin-bottom: 10px;
        }
        .header p {
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .stat-card {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .stat-value {
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
            margin-top: 5px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .suite-breakdown {
            margin-bottom: 40px;
        }
        .suite-breakdown h2 {
            font-size: 1.3em;
            margin-bottom: 15px;
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        .suite-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
        }
        .suite-item {
            background: #f9f9f9;
            padding: 15px;
            border-radius: 4px;
            border-left: 4px solid #667eea;
        }
        .suite-item h3 {
            font-size: 0.95em;
            color: #667eea;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .suite-item .count {
            font-size: 1.8em;
            font-weight: bold;
            color: #333;
        }
        .test-files {
            margin-top: 40px;
        }
        .test-files h2 {
            font-size: 1.3em;
            margin-bottom: 15px;
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th {
            background: #f5f5f5;
            padding: 12px;
            text-align: left;
            border-bottom: 2px solid #667eea;
            font-weight: bold;
            color: #333;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #e5e5e5;
        }
        tr:hover {
            background: #f9f9f9;
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
            <h1>Unicity CLI Test Coverage Report</h1>
            <p>Generated: $(date -u +%Y-%m-%d\ %H:%M:%S\ UTC)</p>
        </div>

        <div class="content">
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">$total_tests</div>
                    <div class="stat-label">Total Tests</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">$total_files</div>
                    <div class="stat-label">Test Files</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">$(discover_test_files | awk -F'/' '{print $(NF-1)}' | sort -u | wc -l)</div>
                    <div class="stat-label">Test Suites</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">$(echo "scale=1; $total_tests / $total_files" | bc)</div>
                    <div class="stat-label">Avg Tests/File</div>
                </div>
            </div>

            <div class="suite-breakdown">
                <h2>Test Coverage by Suite</h2>
                <div class="suite-list">
                    <div class="suite-item">
                        <h3>Functional</h3>
                        <div class="count">$functional_tests</div>
                    </div>
                    <div class="suite-item">
                        <h3>Security</h3>
                        <div class="count">$security_tests</div>
                    </div>
                    <div class="suite-item">
                        <h3>Edge Cases</h3>
                        <div class="count">$edge_case_tests</div>
                    </div>
                    <div class="suite-item">
                        <h3>Unit</h3>
                        <div class="count">$unit_tests</div>
                    </div>
                </div>
            </div>

            <div class="test-files">
                <h2>Test Files Detail</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Test File</th>
                            <th>Suite</th>
                            <th>Tests</th>
                            <th>Lines</th>
                        </tr>
                    </thead>
                    <tbody>
                        $test_details
                    </tbody>
                </table>
            </div>
        </div>

        <div class="footer">
            <p>Unicity CLI - Test Coverage Report Generator</p>
        </div>
    </div>
</body>
</html>
EOF

    log_success "HTML report generated: $html_file"
}

generate_text_report() {
    log_info "Generating text coverage report..."

    local text_file="${OUTPUT_DIR}/coverage.txt"
    mkdir -p "${OUTPUT_DIR}"

    # Calculate statistics
    local total_tests=0
    local total_files=0
    local -A suite_tests

    {
        echo "═══════════════════════════════════════════════════════════════════"
        echo "Unicity CLI - Test Coverage Report"
        echo "═══════════════════════════════════════════════════════════════════"
        echo ""
        echo "Generated: $(date -u +%Y-%m-%d\ %H:%M:%S\ UTC)"
        echo ""

        # Summary stats
        while IFS= read -r file; do
            if [[ -z "$file" ]]; then
                continue
            fi

            local test_count=$(count_test_cases "$file")
            local suite_dir=$(dirname "$file" | xargs basename)

            ((total_tests += test_count))
            ((total_files++))

            suite_tests[$suite_dir]=$((${suite_tests[$suite_dir]:-0} + test_count))
        done < <(discover_test_files)

        echo "SUMMARY STATISTICS"
        echo "───────────────────────────────────────────────────────────────────"
        echo "Total Test Files:        $total_files"
        echo "Total Test Cases:        $total_tests"
        echo "Average Tests/File:      $(echo "scale=1; $total_tests / $total_files" | bc)"
        echo ""

        echo "TEST COVERAGE BY SUITE"
        echo "───────────────────────────────────────────────────────────────────"
        for suite in "${!suite_tests[@]}"; do
            printf "%-25s %5d tests\n" "$suite" "${suite_tests[$suite]}"
        done | sort
        echo ""

        echo "TEST FILES"
        echo "───────────────────────────────────────────────────────────────────"
        printf "%-35s %-15s %6s %6s\n" "File" "Suite" "Tests" "Lines"
        echo "───────────────────────────────────────────────────────────────────"

        while IFS= read -r file; do
            if [[ -z "$file" ]]; then
                continue
            fi

            local basename=$(basename "$file" .bats)
            local suite_dir=$(dirname "$file" | xargs basename)
            local test_count=$(count_test_cases "$file")
            local lines=$(wc -l < "$file")

            printf "%-35s %-15s %6d %6d\n" "$basename" "$suite_dir" "$test_count" "$lines"
        done < <(discover_test_files | sort)

        echo ""
        echo "═══════════════════════════════════════════════════════════════════"

    } | tee "$text_file"

    log_success "Text report generated: $text_file"
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  Unicity CLI - Test Coverage Report Generator             ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    parse_args "$@"

    # Verify test directory exists
    if [[ ! -d "${SCRIPT_DIR}" ]]; then
        log_error "Tests directory not found: ${SCRIPT_DIR}"
        exit 1
    fi

    # Generate requested reports
    for format in "${FORMATS[@]}"; do
        case "$format" in
            json)
                generate_json_report
                ;;
            html)
                generate_html_report
                ;;
            text)
                generate_text_report
                ;;
            *)
                log_error "Unknown format: $format"
                exit 1
                ;;
        esac
    done

    echo ""
    log_success "All reports generated in: $OUTPUT_DIR"
    echo ""
}

main "$@"
