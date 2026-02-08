# 🐳 Naisu Backend - Docker Deployment Guide

Complete guide for deploying Naisu Backend on a VPS using Docker.

## 📋 Prerequisites

- **VPS Requirements:**
  - Docker Engine 20.10+
  - Docker Compose 2.0+
  - Git (optional, for cloning)
  - 1 CPU core minimum (0.5 for lightweight mode)
  - 512MB RAM minimum (256MB for lightweight mode)

- **Domain (optional but recommended):**
  - Point your domain to VPS IP address
  - Configure SSL with reverse proxy (nginx/traefik)

## 🚀 Quick Start

### 1. Clone/Upload Project

```bash
# Option A: Clone from git
git clone <your-repo-url>
cd naisu1/naisu-backend

# Option B: Upload files via SCP/SFTP
# Upload entire naisu-backend folder to your VPS
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your settings
nano .env
```

**Minimum required configuration:**
```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# CORS - update with your frontend URL
CORS_ORIGIN=https://yourdomain.com

# RPC Configuration (update with your own RPC for production)
BASE_MAINNET_RPC=https://mainnet.base.org
BASE_MAINNET_CHAIN_ID=8453

# Optional: Admin private key for write operations
# EVM_ADMIN_PRIVATE_KEY=0x...
```

### 3. Deploy

#### Option A: With PostgreSQL (Full Stack)
```bash
# Using deployment script
chmod +x scripts/deploy.sh
./scripts/deploy.sh deploy

# Or manually
docker-compose up -d --build
```

#### Option B: Without Database (Lightweight)
```bash
# For read-only blockchain queries, no DB needed
./scripts/deploy.sh deploy-slim

# Or manually
docker-compose -f docker-compose.no-db.yml up -d --build
```

### 4. Verify Deployment

```bash
# Check health endpoint
curl http://localhost:3000/api/v1/health

# View logs
./scripts/deploy.sh logs

# Check status
./scripts/deploy.sh status
```

## 🔧 Deployment Scripts

### Linux/macOS (Bash)
```bash
chmod +x scripts/deploy.sh

# Deploy with database
./scripts/deploy.sh deploy

# Deploy without database
./scripts/deploy.sh deploy-slim

# View logs
./scripts/deploy.sh logs

# Stop services
./scripts/deploy.sh stop

# Update deployment
./scripts/deploy.sh update

# Backup database
./scripts/deploy.sh backup
```

### Windows (PowerShell)
```powershell
# Deploy with database
.\scripts\deploy.ps1 deploy

# Deploy without database
.\scripts\deploy.ps1 deploy-slim

# Other commands same as bash
.\scripts\deploy.ps1 logs
.\scripts\deploy.ps1 stop
.\scripts\deploy.ps1 update
```

## 🌐 Production Setup with Reverse Proxy

### Using Nginx

Create `/etc/nginx/sites-available/naisu-backend`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL certificates (from Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/naisu-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com
```

### Using Traefik (Docker Compose)

Update `docker-compose.yml`:

```yaml
services:
  api:
    # ... existing config
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.naisu-api.rule=Host(`api.yourdomain.com`)"
      - "traefik.http.routers.naisu-api.tls.certresolver=letsencrypt"
      - "traefik.http.services.naisu-api.loadbalancer.server.port=3000"
    networks:
      - naisu-network
      - traefik-network

  traefik:
    image: traefik:v3.0
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=your@email.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./letsencrypt:/letsencrypt
    networks:
      - traefik-network

networks:
  naisu-network:
  traefik-network:
    external: true
```

## 📊 Resource Limits

The Docker Compose files include resource limits:

| Service | CPU Limit | Memory Limit | Mode |
|---------|-----------|--------------|------|
| API | 1.0 | 512MB | With DB |
| API | 0.5 | 256MB | Without DB |
| PostgreSQL | 0.5 | 256MB | - |

Adjust in `docker-compose.yml` based on your VPS specs.

## 🔄 Updates

### Automated Update Script
```bash
# Using script
./scripts/deploy.sh update

# Or manually
docker-compose down
git pull  # If using git
docker-compose up -d --build
```

### Database Migrations
```bash
# Run migrations manually
docker-compose exec api bun run db:migrate

# Generate new migration (after schema changes)
docker-compose exec api bun run db:generate
```

## 💾 Backup & Restore

### Backup
```bash
# Automated backup
./scripts/deploy.sh backup

# Manual backup
docker-compose exec -T postgres pg_dump -U naisu naisu_backend > backup_$(date +%Y%m%d).sql
```

### Restore
```bash
# Restore from backup
docker-compose exec -T postgres psql -U naisu naisu_backend < backup_20240101.sql
```

## 🐛 Troubleshooting

### Check Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs api
docker-compose logs postgres

# Follow logs
docker-compose logs -f api
```

### Common Issues

#### Port Already in Use
```bash
# Find process using port 3000
sudo lsof -i :3000
# or
sudo netstat -tlnp | grep 3000

# Kill process or change port in .env
```

#### Database Connection Failed
```bash
# Check if postgres is healthy
docker-compose ps

# Check postgres logs
docker-compose logs postgres

# Restart postgres
docker-compose restart postgres
```

#### Permission Denied
```bash
# Fix permissions
sudo chown -R $USER:$USER .

# If using SELinux
sudo setenforce 0  # Temporary
# or
sudo chcon -Rt svirt_sandbox_file_t .  # Permanent
```

#### Out of Memory
```bash
# Check memory usage
free -h

# Reduce memory limits in docker-compose.yml
# Or add swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Health Check
```bash
# API health
curl http://localhost:3000/api/v1/health

# Container status
docker-compose ps

# Resource usage
docker stats
```

## 🔒 Security Checklist

- [ ] Change default database password in production
- [ ] Set strong `EVM_ADMIN_PRIVATE_KEY` (if used)
- [ ] Configure CORS with specific origins (not `*`)
- [ ] Enable firewall (UFW/iptables)
- [ ] Use SSL/HTTPS in production
- [ ] Set up rate limiting (via reverse proxy)
- [ ] Regular security updates: `docker-compose pull && docker-compose up -d`
- [ ] Disable PostgreSQL external port (5432) if not needed

## 📝 Environment Variables Reference

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `NODE_ENV` | production | Yes | Environment mode |
| `PORT` | 3000 | Yes | Server port |
| `HOST` | 0.0.0.0 | Yes | Server host |
| `DATABASE_URL` | - | No | PostgreSQL connection string |
| `CORS_ORIGIN` | * | Yes | Allowed CORS origins |
| `LOG_LEVEL` | info | No | Logging level |
| `BASE_SEPOLIA_RPC` | - | No* | Base Sepolia RPC URL |
| `BASE_MAINNET_RPC` | - | No* | Base Mainnet RPC URL |
| `EVM_ADMIN_PRIVATE_KEY` | - | No | Admin wallet private key |

*At least one RPC URL is required depending on `NODE_ENV`

## 📚 Additional Resources

- [Docker Docs](https://docs.docker.com/)
- [Docker Compose Docs](https://docs.docker.com/compose/)
- [Hono Framework](https://hono.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
