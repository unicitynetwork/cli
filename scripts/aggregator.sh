#!/usr/bin/env bash
# =============================================================================
# Unicity CLI - Aggregator Management Script
# =============================================================================
# Manages local aggregator for development and testing
#
# Usage:
#   ./scripts/aggregator.sh start      # Start aggregator
#   ./scripts/aggregator.sh stop       # Stop aggregator
#   ./scripts/aggregator.sh restart    # Restart aggregator
#   ./scripts/aggregator.sh status     # Check status
#   ./scripts/aggregator.sh logs       # Show logs
#   ./scripts/aggregator.sh clean      # Clean up volumes
#
# Environment Variables:
#   AGGREGATOR_IMAGE      - Docker image (default: unicity/aggregator:latest)
#   AGGREGATOR_PORT       - Port to expose (default: 3000)
#   AGGREGATOR_CONTAINER  - Container name (default: unicity-aggregator-local)
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

AGGREGATOR_IMAGE="${AGGREGATOR_IMAGE:-unicity/aggregator:latest}"
AGGREGATOR_PORT="${AGGREGATOR_PORT:-3000}"
AGGREGATOR_CONTAINER="${AGGREGATOR_CONTAINER:-unicity-aggregator-local}"
AGGREGATOR_NETWORK="${AGGREGATOR_NETWORK:-unicity-test-network}"
AGGREGATOR_VOLUME="${AGGREGATOR_VOLUME:-unicity-aggregator-data}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

log_info() {
    printf "${BLUE}ℹ${NC} %s\n" "$*"
}

log_success() {
    printf "${GREEN}✓${NC} %s\n" "$*"
}

log_warning() {
    printf "${YELLOW}⚠${NC} %s\n" "$*"
}

log_error() {
    printf "${RED}✗${NC} %s\n" "$*" >&2
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        log_info "Please install Docker: https://docs.docker.com/get-docker/"
        return 1
    fi

    if ! docker ps &> /dev/null; then
        log_error "Cannot connect to Docker daemon"
        log_info "Please ensure Docker is running"
        return 1
    fi

    return 0
}

# Check if container exists
container_exists() {
    docker ps -a --filter "name=^${AGGREGATOR_CONTAINER}$" --format '{{.Names}}' | grep -q "^${AGGREGATOR_CONTAINER}$"
}

# Check if container is running
container_running() {
    docker ps --filter "name=^${AGGREGATOR_CONTAINER}$" --format '{{.Names}}' | grep -q "^${AGGREGATOR_CONTAINER}$"
}

# Wait for aggregator to be healthy
wait_for_health() {
    local max_wait="${1:-60}"
    local start_time
    start_time=$(date +%s)

    log_info "Waiting for aggregator to be healthy (timeout: ${max_wait}s)..."

    while true; do
        if curl --silent --fail --max-time 2 "http://localhost:${AGGREGATOR_PORT}/health" >/dev/null 2>&1; then
            log_success "Aggregator is healthy!"
            return 0
        fi

        local current_time elapsed
        current_time=$(date +%s)
        elapsed=$((current_time - start_time))

        if [[ "$elapsed" -ge "$max_wait" ]]; then
            log_error "Aggregator did not become healthy within ${max_wait}s"
            return 1
        fi

        printf "."
        sleep 2
    done
}

# Create Docker network if it doesn't exist
ensure_network() {
    if ! docker network inspect "$AGGREGATOR_NETWORK" >/dev/null 2>&1; then
        log_info "Creating Docker network: $AGGREGATOR_NETWORK"
        docker network create "$AGGREGATOR_NETWORK" >/dev/null
        log_success "Network created"
    fi
}

# -----------------------------------------------------------------------------
# Command Handlers
# -----------------------------------------------------------------------------

cmd_start() {
    check_docker || return 1

    if container_running; then
        log_warning "Aggregator is already running"
        log_info "Container: $AGGREGATOR_CONTAINER"
        log_info "Port: $AGGREGATOR_PORT"
        return 0
    fi

    if container_exists; then
        log_info "Starting existing aggregator container..."
        docker start "$AGGREGATOR_CONTAINER" >/dev/null
    else
        log_info "Creating new aggregator container..."
        ensure_network

        docker run -d \
            --name "$AGGREGATOR_CONTAINER" \
            --network "$AGGREGATOR_NETWORK" \
            -p "${AGGREGATOR_PORT}:3000" \
            -e NODE_ENV=test \
            -e LOG_LEVEL=info \
            -v "${AGGREGATOR_VOLUME}:/app/data" \
            --health-cmd="curl -f http://localhost:3000/health || exit 1" \
            --health-interval=5s \
            --health-timeout=3s \
            --health-retries=10 \
            --health-start-period=10s \
            --restart=unless-stopped \
            "$AGGREGATOR_IMAGE" >/dev/null
    fi

    log_success "Aggregator container started"
    log_info "Container: $AGGREGATOR_CONTAINER"
    log_info "Port: $AGGREGATOR_PORT"
    log_info "Endpoint: http://localhost:${AGGREGATOR_PORT}"

    # Wait for health check
    if wait_for_health; then
        log_success "Aggregator is ready for testing!"

        # Extract and save TrustBase
        log_info "Extracting TrustBase configuration..."
        if cmd_extract_trustbase; then
            log_success "TrustBase saved to ./config/trust-base.json"
        fi
    else
        log_error "Aggregator failed to start properly"
        log_info "Check logs with: $0 logs"
        return 1
    fi
}

cmd_stop() {
    check_docker || return 1

    if ! container_running; then
        log_warning "Aggregator is not running"
        return 0
    fi

    log_info "Stopping aggregator..."
    docker stop "$AGGREGATOR_CONTAINER" >/dev/null
    log_success "Aggregator stopped"
}

cmd_restart() {
    log_info "Restarting aggregator..."
    cmd_stop
    sleep 2
    cmd_start
}

cmd_status() {
    check_docker || return 1

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Aggregator Status"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if ! container_exists; then
        log_warning "Container does not exist"
        log_info "Run '$0 start' to create and start the aggregator"
        return 0
    fi

    if container_running; then
        log_success "Status: Running"
    else
        log_warning "Status: Stopped"
    fi

    echo ""
    echo "Configuration:"
    printf "  Container:  %s\n" "$AGGREGATOR_CONTAINER"
    printf "  Image:      %s\n" "$AGGREGATOR_IMAGE"
    printf "  Port:       %s\n" "$AGGREGATOR_PORT"
    printf "  Network:    %s\n" "$AGGREGATOR_NETWORK"
    printf "  Endpoint:   http://localhost:%s\n" "$AGGREGATOR_PORT"

    if container_running; then
        echo ""
        echo "Health Check:"

        # Check HTTP endpoint
        if curl --silent --fail --max-time 2 "http://localhost:${AGGREGATOR_PORT}/health" >/dev/null 2>&1; then
            log_success "HTTP endpoint responsive"
        else
            log_error "HTTP endpoint not responding"
        fi

        # Get Docker health status
        local health_status
        health_status=$(docker inspect --format='{{.State.Health.Status}}' "$AGGREGATOR_CONTAINER" 2>/dev/null || echo "unknown")
        printf "  Docker Health: %s\n" "$health_status"

        # Container stats
        echo ""
        echo "Container Stats:"
        docker stats "$AGGREGATOR_CONTAINER" --no-stream --format "  CPU: {{.CPUPerc}}\t Memory: {{.MemUsage}}"
    fi

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

cmd_logs() {
    check_docker || return 1

    if ! container_exists; then
        log_error "Container does not exist"
        return 1
    fi

    local follow="${1:-}"

    if [[ "$follow" == "-f" ]] || [[ "$follow" == "--follow" ]]; then
        log_info "Following logs (Ctrl+C to stop)..."
        docker logs -f "$AGGREGATOR_CONTAINER"
    else
        log_info "Showing recent logs (use -f to follow)..."
        docker logs --tail 100 "$AGGREGATOR_CONTAINER"
    fi
}

cmd_clean() {
    check_docker || return 1

    log_warning "This will remove the aggregator container and ALL data!"
    read -p "Are you sure? (yes/no): " -r confirm

    if [[ "$confirm" != "yes" ]]; then
        log_info "Aborted"
        return 0
    fi

    if container_running; then
        log_info "Stopping container..."
        docker stop "$AGGREGATOR_CONTAINER" >/dev/null
    fi

    if container_exists; then
        log_info "Removing container..."
        docker rm "$AGGREGATOR_CONTAINER" >/dev/null
        log_success "Container removed"
    fi

    if docker volume inspect "$AGGREGATOR_VOLUME" >/dev/null 2>&1; then
        log_info "Removing volume..."
        docker volume rm "$AGGREGATOR_VOLUME" >/dev/null
        log_success "Volume removed"
    fi

    log_success "Cleanup complete"
}

cmd_extract_trustbase() {
    check_docker || return 1

    if ! container_running; then
        log_error "Aggregator is not running"
        return 1
    fi

    # Create config directory
    mkdir -p config

    # Extract TrustBase from container
    if docker cp "${AGGREGATOR_CONTAINER}:/app/bft-config/trust-base.json" ./config/trust-base.json 2>/dev/null; then
        # Verify it's valid JSON
        if jq empty ./config/trust-base.json 2>/dev/null; then
            local network_id
            network_id=$(jq -r '.networkId' ./config/trust-base.json)
            log_success "TrustBase extracted successfully"
            log_info "Network ID: $network_id"
            log_info "File: ./config/trust-base.json"
            return 0
        else
            log_error "Extracted file is not valid JSON"
            rm -f ./config/trust-base.json
            return 1
        fi
    else
        log_error "Failed to extract TrustBase from container"
        log_info "File may not exist at /app/bft-config/trust-base.json"
        return 1
    fi
}

cmd_shell() {
    check_docker || return 1

    if ! container_running; then
        log_error "Aggregator is not running"
        return 1
    fi

    log_info "Opening shell in aggregator container..."
    docker exec -it "$AGGREGATOR_CONTAINER" /bin/bash
}

cmd_help() {
    cat <<EOF
Unicity CLI - Aggregator Management Script

USAGE:
    $0 <command> [options]

COMMANDS:
    start               Start the aggregator (creates if doesn't exist)
    stop                Stop the aggregator
    restart             Restart the aggregator
    status              Show aggregator status and health
    logs [-f]           Show logs (-f to follow)
    clean               Remove aggregator container and volumes
    extract-trustbase   Extract TrustBase configuration to ./config/
    shell               Open bash shell in aggregator container
    help                Show this help message

ENVIRONMENT VARIABLES:
    AGGREGATOR_IMAGE      Docker image (default: unicity/aggregator:latest)
    AGGREGATOR_PORT       Port to expose (default: 3000)
    AGGREGATOR_CONTAINER  Container name (default: unicity-aggregator-local)

EXAMPLES:
    # Start aggregator for testing
    $0 start

    # Check if aggregator is running
    $0 status

    # View aggregator logs
    $0 logs

    # Follow logs in real-time
    $0 logs -f

    # Extract TrustBase for CLI usage
    $0 extract-trustbase

    # Completely remove aggregator
    $0 clean

    # Use custom port
    AGGREGATOR_PORT=3001 $0 start

For more information, see the documentation at:
    docs/getting-started.md
    .dev/architecture/trustbase-loading.md

EOF
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    local command="${1:-help}"

    case "$command" in
        start)
            cmd_start
            ;;
        stop)
            cmd_stop
            ;;
        restart)
            cmd_restart
            ;;
        status)
            cmd_status
            ;;
        logs)
            shift
            cmd_logs "$@"
            ;;
        clean)
            cmd_clean
            ;;
        extract-trustbase)
            cmd_extract_trustbase
            ;;
        shell)
            cmd_shell
            ;;
        help|--help|-h)
            cmd_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            cmd_help
            return 1
            ;;
    esac
}

main "$@"
