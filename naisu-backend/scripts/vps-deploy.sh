#!/bin/bash
# =============================================================================
# Naisu Backend - VPS Auto-Deployment Script
# Called by CI/CD pipeline or webhook to deploy new version
# =============================================================================

set -e

# Configuration
DEPLOY_PATH="${DEPLOY_PATH:-/opt/naisu-backend}"
DOCKER_USERNAME="${DOCKER_USERNAME:-}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://localhost:3000/api/v1/health}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# =============================================================================
# Functions
# =============================================================================

pull_image() {
    log_info "Pulling Docker image: $DOCKER_USERNAME/naisu-backend:$IMAGE_TAG"
    
    if [ -z "$DOCKER_USERNAME" ]; then
        log_error "DOCKER_USERNAME not set!"
        exit 1
    fi
    
    docker pull "$DOCKER_USERNAME/naisu-backend:$IMAGE_TAG"
    log_success "Image pulled successfully"
}

deploy_container() {
    log_info "Deploying container..."
    
    cd "$DEPLOY_PATH"
    
    # Update image tag in compose file if needed
    if [ -f "$COMPOSE_FILE" ]; then
        log_info "Using docker-compose: $COMPOSE_FILE"
        
        # Pull latest image
        docker-compose -f "$COMPOSE_FILE" pull
        
        # Restart services
        docker-compose -f "$COMPOSE_FILE" down
        docker-compose -f "$COMPOSE_FILE" up -d
        
        # Wait for startup
        log_info "Waiting for services to start..."
        sleep 10
    else
        log_warn "Compose file not found. Running container directly..."
        
        # Stop and remove existing container
        docker stop naisu-backend 2>/dev/null || true
        docker rm naisu-backend 2>/dev/null || true
        
        # Run new container
        docker run -d \
            --name naisu-backend \
            --restart unless-stopped \
            -p 3000:3000 \
            --env-file "$DEPLOY_PATH/.env" \
            "$DOCKER_USERNAME/naisu-backend:$IMAGE_TAG"
        
        sleep 5
    fi
}

health_check() {
    log_info "Running health check..."
    
    local retries=10
    local wait_time=5
    
    for i in $(seq 1 $retries); do
        if curl -sf "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            log_success "Health check passed!"
            return 0
        fi
        
        log_warn "Health check attempt $i/$retries failed. Retrying in ${wait_time}s..."
        sleep $wait_time
    done
    
    log_error "Health check failed after $retries attempts!"
    return 1
}

cleanup() {
    log_info "Cleaning up old images..."
    docker image prune -af --filter "until=168h" || true
    docker system prune -f || true
    log_success "Cleanup complete"
}

rollback() {
    log_error "Deployment failed! Rolling back..."
    
    cd "$DEPLOY_PATH"
    
    if [ -f "$COMPOSE_FILE" ]; then
        docker-compose -f "$COMPOSE_FILE" logs --tail=50
        docker-compose -f "$COMPOSE_FILE" down
        # TODO: Implement rollback to previous version
    else
        docker logs naisu-backend --tail=50 || true
        docker stop naisu-backend 2>/dev/null || true
    fi
    
    exit 1
}

notify() {
    local status=$1
    local message=$2
    
    log_info "Notification: [$status] $message"
    
    # Optional: Send to Slack, Discord, Telegram, etc.
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Naisu Backend Deployment: $status - $message\"}" \
            "$SLACK_WEBHOOK_URL" > /dev/null || true
    fi
    
    if [ -n "$DISCORD_WEBHOOK_URL" ]; then
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"content\":\"Naisu Backend Deployment: $status - $message\"}" \
            "$DISCORD_WEBHOOK_URL" > /dev/null || true
    fi
}

# =============================================================================
# Main
# =============================================================================

main() {
    log_info "Starting deployment..."
    log_info "Deploy path: $DEPLOY_PATH"
    log_info "Image: $DOCKER_USERNAME/naisu-backend:$IMAGE_TAG"
    
    # Trap errors for rollback
    trap 'rollback' ERR
    
    # Ensure deployment directory exists
    mkdir -p "$DEPLOY_PATH"
    
    # Pull latest image
    pull_image
    
    # Deploy container
    deploy_container
    
    # Health check
    health_check
    
    # Cleanup old images
    cleanup
    
    # Success notification
    notify "SUCCESS" "Deployed $DOCKER_USERNAME/naisu-backend:$IMAGE_TAG"
    log_success "Deployment complete!"
    
    # Print status
    echo ""
    echo "================================================"
    echo "🚀 Deployment Status:"
    echo "================================================"
    docker ps --filter "name=naisu-backend" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "📊 Health Check: $HEALTH_CHECK_URL"
    echo "================================================"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --tag|-t)
            IMAGE_TAG="$2"
            shift 2
            ;;
        --username|-u)
            DOCKER_USERNAME="$2"
            shift 2
            ;;
        --path|-p)
            DEPLOY_PATH="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -t, --tag TAG           Docker image tag (default: latest)"
            echo "  -u, --username USER     Docker Hub username"
            echo "  -p, --path PATH         Deployment path (default: /opt/naisu-backend)"
            echo "  -h, --help              Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main
