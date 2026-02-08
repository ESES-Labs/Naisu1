# 🚀 Naisu Backend - CI/CD Setup Guide

Complete guide for setting up automated CI/CD pipeline for Naisu Backend deployment to VPS.

## 📋 Overview

The CI/CD pipeline consists of:
- **CI Workflow**: Build, test, lint on every PR and push
- **CD Workflow**: Auto-deploy to VPS when changes are merged to `main`
- **VPS Scripts**: Handle the actual deployment on the server

## 🏗️ Architecture

```
GitHub Repository
       │
       ▼ (push to main)
┌──────────────────┐
│  GitHub Actions  │
│  - Build image   │
│  - Push to DH    │
└────────┬─────────┘
         │
         ▼ (SSH or Webhook)
    ┌─────────┐
    │   VPS   │
    │ - Pull  │
    │ - Deploy│
    └─────────┘
```

## 🔧 Setup Steps

### Step 1: Configure GitHub Secrets

Go to **Settings > Secrets and variables > Actions** and add:

#### Required Secrets

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DOCKER_USERNAME` | Docker Hub username | `naisu` |
| `DOCKER_PASSWORD` | Docker Hub password/token | `dckr_pat_xxx` |
| `VPS_SSH_PRIVATE_KEY` | SSH private key for VPS access | `-----BEGIN...` |
| `VPS_HOST` | VPS IP or hostname | `192.168.1.100` |
| `VPS_USER` | SSH username | `root` or `deploy` |

#### Optional Secrets

| Secret Name | Description | Default |
|-------------|-------------|---------|
| `DEPLOY_PATH` | Path on VPS | `/opt/naisu-backend` |
| `WEBHOOK_SECRET` | Secret for webhook auth | - |

### Step 2: Create SSH Key Pair

On your local machine:

```bash
# Generate SSH key pair (no passphrase for CI/CD)
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/github_actions.pub root@your-vps-ip

# Or manually add to VPS
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
```

Then copy the **private key** to GitHub Secrets:

```bash
cat ~/.ssh/github_actions
# Copy output to VPS_SSH_PRIVATE_KEY secret
```

### Step 3: Prepare VPS

#### Option A: SSH-Based Deployment (Recommended)

```bash
# 1. Create deployment directory
mkdir -p /opt/naisu-backend
cd /opt/naisu-backend

# 2. Copy docker-compose.prod.yml and .env
curl -o docker-compose.prod.yml https://raw.githubusercontent.com/YOUR_REPO/main/naisu-backend/docker-compose.prod.yml

# 3. Create environment file
nano .env
```

`.env` file:
```env
DOCKER_USERNAME=your-docker-username
PORT=3000
NODE_ENV=production
HOST=0.0.0.0
DATABASE_URL=postgresql://naisu:password@postgres:5432/naisu_backend
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
BASE_MAINNET_RPC=https://mainnet.base.org
BASE_MAINNET_CHAIN_ID=8453
NAISU_SWAP_CONTRACT=0xfaBD3bdeecf7f858d6cef1c137694e19Ac7187f6
NAISU_REWARDS_CONTRACT=0xD24463BBde91Df1937F4CFC4F627fFc76728b8A6
POOL_MANAGER=0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408
ENABLE_UNISWAP_V4=true
```

#### Option B: Webhook-Based Deployment (Alternative)

```bash
# 1. Install Bun if not already installed
curl -fsSL https://bun.sh/install | bash

# 2. Setup deployment directory
mkdir -p /opt/naisu-backend
cd /opt/naisu-backend

# 3. Copy webhook files
curl -o scripts/webhook-server.js https://raw.githubusercontent.com/YOUR_REPO/main/naisu-backend/scripts/webhook-server.js
curl -o scripts/webhook.service https://raw.githubusercontent.com/YOUR_REPO/main/naisu-backend/scripts/webhook.service

# 4. Configure webhook service
nano scripts/webhook.service
# Edit: WEBHOOK_SECRET, DOCKER_USERNAME, etc.

# 5. Install systemd service
cp scripts/webhook.service /etc/systemd/system/naisu-webhook.service
systemctl daemon-reload
systemctl enable naisu-webhook
systemctl start naisu-webhook

# 6. Check status
systemctl status naisu-webhook
journalctl -u naisu-webhook -f
```

### Step 4: Configure GitHub Actions

The workflows are already created in `.github/workflows/`:

- `naisu-backend-ci.yml` - Runs on PRs and pushes
- `naisu-backend-cd.yml` - Runs on push to main

### Step 5: Test Deployment

```bash
# Make a small change to naisu-backend
# Push to main branch
# Watch the Actions tab in GitHub
```

## 📁 File Structure

```
.github/
└── workflows/
    ├── naisu-backend-ci.yml      # CI: Build, test, lint
    └── naisu-backend-cd.yml      # CD: Deploy to VPS

naisu-backend/
├── docker-compose.prod.yml       # Production compose file
├── scripts/
│   ├── vps-deploy.sh            # VPS deployment script
│   ├── webhook-server.js        # Webhook server (alternative)
│   └── webhook.service          # Systemd service for webhook
└── CICD_SETUP.md                # This file
```

## 🔄 Deployment Flow

### Automatic Deployment (Push to Main)

1. Developer pushes code to `main` branch
2. GitHub Actions triggers:
   - Build Docker image
   - Push to Docker Hub
   - SSH into VPS
   - Run deployment script
3. VPS pulls latest image and restarts

### Manual Deployment

```bash
# Via GitHub UI
# Actions > Naisu Backend CD > Run workflow

# Via VPS
/opt/naisu-backend/scripts/vps-deploy.sh --tag latest --username your-docker-username
```

## 🔐 Security Best Practices

### 1. SSH Key Security

```bash
# Use ed25519 keys (more secure)
ssh-keygen -t ed25519 -a 100

# Restrict key usage on VPS
# Edit ~/.ssh/authorized_keys:
no-port-forwarding,no-X11-forwarding,no-agent-forwarding ssh-ed25519 AAA... github-actions
```

### 2. Docker Hub Token

Use **Access Token** instead of password:
- Docker Hub > Account Settings > Security > New Access Token
- Scope: `repo:read`, `repo:write`

### 3. Webhook Security

```bash
# Generate strong secret
openssl rand -hex 32

# Restrict GitHub IPs in webhook.service
Environment="ALLOWED_IPS=140.82.112.0/20,192.30.252.0/22"
```

### 4. VPS Hardening

```bash
# Disable root login
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

# Use firewall
ufw default deny incoming
ufw allow 22
ufw allow 80
ufw allow 443
ufw allow 3000  # Only if needed externally
ufw enable
```

## 🛠️ Troubleshooting

### CI/CD Issues

#### Build Fails
```bash
# Check logs in GitHub Actions
# Common issues:
# - Missing env vars
# - Type errors
# - Lint failures
```

#### Docker Push Fails
```bash
# Verify Docker credentials
# Check if repository exists on Docker Hub
# Ensure token has write access
```

#### SSH Connection Fails
```bash
# Test locally:
ssh -i ~/.ssh/github_actions root@vps-ip

# Check VPS firewall
# Verify key is in authorized_keys
# Check /var/log/auth.log on VPS
```

### VPS Issues

#### Container Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Verify env vars
cat .env

# Check port availability
netstat -tlnp | grep 3000
```

#### Health Check Fails
```bash
# Manual health check
curl http://localhost:3000/api/v1/health

# Check container status
docker ps

# Restart manually
docker-compose -f docker-compose.prod.yml restart
```

#### Out of Disk Space
```bash
# Clean up Docker
docker system prune -af
docker volume prune -f

# Check disk usage
df -h
du -sh /var/lib/docker
```

## 📊 Monitoring

### View Deployment Logs

```bash
# GitHub Actions
# Go to Actions tab > Workflow run > View logs

# VPS logs
docker-compose -f docker-compose.prod.yml logs -f api

# Webhook logs (if using webhook)
journalctl -u naisu-webhook -f
```

### Health Monitoring

```bash
# Add to crontab for monitoring
*/5 * * * * curl -sf http://localhost:3000/api/v1/health || docker-compose -f /opt/naisu-backend/docker-compose.prod.yml restart
```

## 🚀 Advanced Configuration

### Blue-Green Deployment

For zero-downtime deployment:

```yaml
# docker-compose.blue.yml
version: '3.8'
services:
  api-blue:
    image: naisu/naisu-backend:latest
    ports:
      - "3001:3000"
      
  api-green:
    image: naisu/naisu-backend:latest
    ports:
      - "3002:3000"
```

Use nginx to switch between blue/green.

### Multi-Environment Deployment

```yaml
# .github/workflows/naisu-backend-cd.yml
strategy:
  matrix:
    environment: [staging, production]
    include:
      - environment: staging
        host: ${{ secrets.STAGING_HOST }}
      - environment: production
        host: ${{ secrets.PRODUCTION_HOST }}
```

### Rollback Strategy

```bash
# Tag previous image before deploy
docker tag naisu-backend:latest naisu-backend:backup-$(date +%Y%m%d)

# Rollback script
docker pull naisu-backend:backup-20240101
docker-compose up -d
```

## 📚 Additional Resources

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Docker Hub Webhooks](https://docs.docker.com/docker-hub/webhooks/)
- [Bun Runtime](https://bun.sh/docs)
- [Hono Framework](https://hono.dev/)

## 💡 Tips

1. **Use specific tags** instead of `latest` for reproducibility
2. **Enable branch protection** on `main` to require PR reviews
3. **Set up notifications** (Slack/Discord) for deployment status
4. **Monitor disk space** - Docker images can fill up disks quickly
5. **Test locally first** with `docker-compose.prod.yml`
