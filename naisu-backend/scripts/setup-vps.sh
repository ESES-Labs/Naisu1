#!/bin/bash
# =============================================================================
# Naisu Backend - VPS Setup Script
# Run this on your VPS to prepare for CI/CD deployment
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DEPLOY_PATH="${DEPLOY_PATH:-/opt/naisu-backend}"
GITHUB_REPO="${GITHUB_REPO:-}"
DOCKER_USERNAME="${DOCKER_USERNAME:-}"

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# =============================================================================
# Functions
# =============================================================================

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run as root or with sudo"
        exit 1
    fi
}

install_docker() {
    log_info "Installing Docker..."
    
    if command -v docker &> /dev/null; then
        log_warn "Docker already installed, skipping..."
        docker --version
        return
    fi
    
    # Install Docker
    curl -fsSL https://get.docker.com | sh
    
    # Add user to docker group
    usermod -aG docker $SUDO_USER 2>/dev/null || true
    
    # Start Docker
    systemctl enable docker
    systemctl start docker
    
    log_success "Docker installed successfully"
}

install_bun() {
    log_info "Installing Bun..."
    
    if command -v bun &> /dev/null; then
        log_warn "Bun already installed, skipping..."
        bun --version
        return
    fi
    
    # Install Bun
    curl -fsSL https://bun.sh/install | bash
    
    # Link bun to /usr/local/bin
    ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun 2>/dev/null || \
    ln -sf "/root/.bun/bin/bun" /usr/local/bin/bun
    
    log_success "Bun installed successfully"
}

setup_deployment_dir() {
    log_info "Setting up deployment directory: $DEPLOY_PATH"
    
    mkdir -p "$DEPLOY_PATH"
    mkdir -p "$DEPLOY_PATH/scripts"
    mkdir -p "$DEPLOY_PATH/backups"
    
    # Create .env template
    if [ ! -f "$DEPLOY_PATH/.env" ]; then
        log_info "Creating .env template..."
        cat > "$DEPLOY_PATH/.env" << 'EOF'
# =============================================================================
# Naisu Backend - Production Environment
# =============================================================================

# Docker
DOCKER_USERNAME=your-docker-username

# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database (optional - leave empty for DB-less mode)
DATABASE_URL=

# CORS - Update with your frontend URL
CORS_ORIGIN=*

# Logging
LOG_LEVEL=info

# EVM - Base Sepolia (Testnet)
BASE_SEPOLIA_RPC=https://sepolia.base.org
BASE_SEPOLIA_CHAIN_ID=84532

# EVM - Base Mainnet (Production)
BASE_MAINNET_RPC=https://mainnet.base.org
BASE_MAINNET_CHAIN_ID=8453

# EVM Admin (optional - for write operations)
# EVM_ADMIN_PRIVATE_KEY=0x...

# Uniswap V4 Contracts
NAISU_SWAP_CONTRACT=0xfaBD3bdeecf7f858d6cef1c137694e19Ac7187f6
NAISU_REWARDS_CONTRACT=0xD24463BBde91Df1937F4CFC4F627fFc76728b8A6
POOL_MANAGER=0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408

# Features
ENABLE_UNISWAP_V4=true

# Security
API_KEY_HEADER=x-api-key
EOF
        log_warn "Please edit $DEPLOY_PATH/.env with your actual values"
    fi
    
    # Download docker-compose.prod.yml
    if [ -n "$GITHUB_REPO" ]; then
        log_info "Downloading docker-compose.prod.yml from GitHub..."
        curl -fsSL "https://raw.githubusercontent.com/$GITHUB_REPO/main/naisu-backend/docker-compose.prod.yml" \
            -o "$DEPLOY_PATH/docker-compose.prod.yml" || \
            log_warn "Could not download from GitHub. Please copy manually."
    fi
    
    chown -R "$SUDO_USER:$SUDO_USER" "$DEPLOY_PATH" 2>/dev/null || true
    
    log_success "Deployment directory ready"
}

setup_ssh_key() {
    log_info "Setting up SSH key for GitHub Actions..."
    
    local ssh_dir="/root/.ssh"
    [ -n "$SUDO_USER" ] && ssh_dir="/home/$SUDO_USER/.ssh"
    
    mkdir -p "$ssh_dir"
    
    if [ ! -f "$ssh_dir/authorized_keys" ]; then
        touch "$ssh_dir/authorized_keys"
        chmod 600 "$ssh_dir/authorized_keys"
    fi
    
    log_info ""
    log_info "SSH Key Setup Instructions:"
    log_info "1. On your local machine, generate a key:"
    log_info "   ssh-keygen -t ed25519 -C 'github-actions' -f ~/.ssh/github_actions -N ''"
    log_info ""
    log_info "2. Add this public key to $ssh_dir/authorized_keys:"
    log_info "   cat ~/.ssh/github_actions.pub"
    log_info ""
    log_info "3. Add the private key to GitHub Secrets as VPS_SSH_PRIVATE_KEY"
    log_info "   cat ~/.ssh/github_actions"
    log_info ""
}

setup_firewall() {
    log_info "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw default deny incoming
        ufw default allow outgoing
        ufw allow ssh
        ufw allow http
        ufw allow https
        ufw allow 3000/tcp  # Backend API
        
        echo "y" | ufw enable || true
        
        log_success "UFW firewall configured"
    else
        log_warn "UFW not found, skipping firewall setup"
    fi
}

setup_swap() {
    log_info "Setting up swap space..."
    
    if [ -f /swapfile ]; then
        log_warn "Swap already exists, skipping..."
        return
    fi
    
    # Create 2GB swap
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    
    # Persist in fstab
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    
    # Optimize swap usage
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    sysctl -p
    
    log_success "Swap space created (2GB)"
}

install_fail2ban() {
    log_info "Installing fail2ban..."
    
    if command -v fail2ban-client &> /dev/null; then
        log_warn "fail2ban already installed, skipping..."
        return
    fi
    
    apt-get update
    apt-get install -y fail2ban
    
    # Basic configuration
    cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF
    
    systemctl enable fail2ban
    systemctl start fail2ban
    
    log_success "fail2ban installed and configured"
}

print_summary() {
    echo ""
    echo "================================================"
    echo -e "${GREEN}✓ VPS Setup Complete!${NC}"
    echo "================================================"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Edit environment file:"
    echo "   nano $DEPLOY_PATH/.env"
    echo ""
    echo "2. Add GitHub Actions SSH key to authorized_keys:"
    echo "   nano $([ -n "$SUDO_USER" ] && echo "/home/$SUDO_USER/.ssh" || echo "/root/.ssh")/authorized_keys"
    echo ""
    echo "3. Configure GitHub Secrets:"
    echo "   - VPS_HOST: $(curl -s ifconfig.me)"
    echo "   - VPS_USER: root (or your user)"
    echo "   - VPS_SSH_PRIVATE_KEY: (your SSH private key)"
    echo "   - DOCKER_USERNAME: (your Docker Hub username)"
    echo "   - DOCKER_PASSWORD: (your Docker Hub token)"
    echo ""
    echo "4. Push to main branch to trigger deployment"
    echo ""
    echo "5. Check status:"
    echo "   cd $DEPLOY_PATH && docker-compose -f docker-compose.prod.yml ps"
    echo ""
    echo "================================================"
}

# =============================================================================
# Main
# =============================================================================

main() {
    echo "================================================"
    echo "🚀 Naisu Backend - VPS Setup"
    echo "================================================"
    echo ""
    
    check_root
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --deploy-path)
                DEPLOY_PATH="$2"
                shift 2
                ;;
            --github-repo)
                GITHUB_REPO="$2"
                shift 2
                ;;
            --docker-username)
                DOCKER_USERNAME="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --deploy-path PATH       Deployment path (default: /opt/naisu-backend)"
                echo "  --github-repo USER/REPO  GitHub repository (e.g., naisu/naisu1)"
                echo "  --docker-username USER   Docker Hub username"
                echo "  --help                   Show this help"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run setup steps
    setup_swap
    install_docker
    install_bun
    setup_deployment_dir
    setup_ssh_key
    setup_firewall
    install_fail2ban
    
    print_summary
}

main "$@"
