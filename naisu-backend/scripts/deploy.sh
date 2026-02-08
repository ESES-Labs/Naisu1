#!/bin/bash
# =============================================================================
# Naisu Backend - VPS Deployment Script
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🚀 Naisu Backend Deployment Script${NC}"
echo "================================================"

# Function to print status
print_status() {
    echo -e "${BLUE}➜${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if .env file exists
check_env() {
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        print_warning ".env file not found!"
        echo "Creating from .env.example..."
        if [ -f "$PROJECT_DIR/.env.example" ]; then
            cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
            print_success ".env file created from example"
            print_warning "Please edit .env with your actual configuration before proceeding"
            exit 1
        else
            print_error ".env.example not found!"
            exit 1
        fi
    fi
    print_success ".env file found"
}

# Deploy with database
deploy_with_db() {
    print_status "Deploying with PostgreSQL database..."
    cd "$PROJECT_DIR"
    
    # Pull latest images
    print_status "Pulling latest images..."
    docker-compose pull
    
    # Build and start services
    print_status "Building and starting services..."
    docker-compose up -d --build
    
    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    sleep 5
    
    # Run migrations if DATABASE_URL is set
    if [ -n "$DATABASE_URL" ]; then
        print_status "Running database migrations..."
        docker-compose exec -T api bun run db:migrate || print_warning "Migration failed or not needed"
    fi
    
    print_success "Deployment complete!"
    echo ""
    echo -e "${GREEN}Services:${NC}"
    echo "  - API: http://localhost:3000"
    echo "  - Health: http://localhost:3000/api/v1/health"
    echo "  - PostgreSQL: localhost:5432"
    echo ""
}

# Deploy without database
deploy_without_db() {
    print_status "Deploying without database (lightweight mode)..."
    cd "$PROJECT_DIR"
    
    # Build and start services
    print_status "Building and starting services..."
    docker-compose -f docker-compose.no-db.yml up -d --build
    
    print_success "Deployment complete!"
    echo ""
    echo -e "${GREEN}Services:${NC}"
    echo "  - API: http://localhost:3000"
    echo "  - Health: http://localhost:3000/api/v1/health"
    echo ""
}

# Stop services
stop_services() {
    print_status "Stopping services..."
    cd "$PROJECT_DIR"
    docker-compose down
    docker-compose -f docker-compose.no-db.yml down 2>/dev/null || true
    print_success "Services stopped"
}

# View logs
view_logs() {
    print_status "Viewing logs (Ctrl+C to exit)..."
    cd "$PROJECT_DIR"
    docker-compose logs -f api
}

# Show status
show_status() {
    print_status "Service status:"
    cd "$PROJECT_DIR"
    docker-compose ps
}

# Update deployment
update() {
    print_status "Updating deployment..."
    cd "$PROJECT_DIR"
    
    # Pull latest code (if git repo)
    if [ -d ".git" ]; then
        git pull origin main || print_warning "Git pull failed, continuing..."
    fi
    
    # Rebuild and restart
    docker-compose up -d --build
    
    print_success "Update complete!"
}

# Backup database
backup_db() {
    print_status "Creating database backup..."
    cd "$PROJECT_DIR"
    
    BACKUP_DIR="$PROJECT_DIR/backups"
    mkdir -p "$BACKUP_DIR"
    
    BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
    
    docker-compose exec -T postgres pg_dump -U naisu naisu_backend > "$BACKUP_FILE"
    
    print_success "Backup created: $BACKUP_FILE"
}

# Main menu
show_help() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  deploy      Deploy with database (full stack)"
    echo "  deploy-slim Deploy without database (lightweight)"
    echo "  stop        Stop all services"
    echo "  logs        View API logs"
    echo "  status      Show service status"
    echo "  update      Update and rebuild services"
    echo "  backup      Backup PostgreSQL database"
    echo "  help        Show this help message"
    echo ""
}

# Main
main() {
    case "${1:-deploy}" in
        deploy)
            check_env
            deploy_with_db
            ;;
        deploy-slim|slim)
            check_env
            deploy_without_db
            ;;
        stop|down)
            stop_services
            ;;
        logs)
            view_logs
            ;;
        status)
            show_status
            ;;
        update|upgrade)
            check_env
            update
            ;;
        backup)
            backup_db
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
