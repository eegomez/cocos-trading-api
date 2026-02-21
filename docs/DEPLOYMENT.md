# 🚀 Deployment Guide

Complete deployment instructions for local development and AWS production.

---

## 📋 Table of Contents

1. [Local Development (Docker)](#local-development-docker)
2. [AWS Production (EC2 + CloudWatch)](#aws-production-ec2--cloudwatch)
3. [Environment Variables](#environment-variables)
4. [Monitoring](#monitoring)
5. [Troubleshooting](#troubleshooting)

---

# 🏠 Local Development (Docker)

## Prerequisites

- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop))
- **8GB RAM** minimum
- **Ports available:** 3000, 3001, 5432, 9090, 3100

## Setup

```bash
# 1. Clone and navigate
git clone <repo-url>
cd backend-cocos

# 2. Start all services
docker-compose up -d

# 3. Wait 30 seconds for initialization

# 4. Verify services are running
docker-compose ps
```

## Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **Trading API** | http://localhost:3000 | - |
| **API Health** | http://localhost:3000/api/health | - |
| **API Metrics** | http://localhost:3000/api/metrics | - |
| **Grafana** | http://localhost:3001 | admin / admin |
| **Grafana Dashboard** | http://localhost:3001/dashboards → "Cocos Trading API" | admin / admin |
| **Prometheus** | http://localhost:9090 | - |

## View Logs

```bash
# All services
docker-compose logs -f

# Only API
docker-compose logs -f app

# Last 100 lines
docker-compose logs --tail=100 app
```

## Stop Services

```bash
# Stop (keep data)
docker-compose down

# Stop and wipe database
docker-compose down -v
```

## Change Log Level

```bash
# Set to debug
LOG_LEVEL=debug docker-compose up -d

# Set to error only
LOG_LEVEL=error docker-compose up -d
```

**Log Levels:** `fatal` | `error` | `warn` | `info` | `debug` | `trace`

---

# ☁️ AWS Production (EC2 + CloudWatch)

## Architecture

```
Internet → EC2 (Node.js) → RDS PostgreSQL → CloudWatch
```

---

## Step 1: Create RDS Database

**Via AWS Console:**
1. **RDS** → Create Database
2. **Engine:** PostgreSQL 15
3. **Templates:** Free tier (dev) or Production
4. **Instance:** db.t3.micro (free tier) or db.t3.medium (prod)
5. **Storage:** 20 GB SSD
6. **Connectivity:**
   - VPC: Default
   - Public access: No
   - Security group: Create new (allow 5432 from EC2)
7. **Database name:** `cocos_trading`
8. **Credentials:** Save master username/password

**Initialize Database:**
```bash
# Connect from local machine (temporary public access)
psql -h <RDS_ENDPOINT> -U postgres -d cocos_trading

# Load schema
\i database/database.sql

# Verify
\dt
```

---

## Step 2: Launch EC2 Instance

**Via AWS Console:**
1. **EC2** → Launch Instance
2. **Name:** cocos-trading-api
3. **AMI:** Amazon Linux 2023
4. **Instance type:** t3.medium (2 vCPU, 4 GB RAM)
5. **Key pair:** Create new or use existing
6. **Network:**
   - VPC: Same as RDS
   - Subnet: Public subnet
   - Auto-assign public IP: Enable
7. **Security group:**
   - SSH (22) from your IP
   - HTTP (80) from anywhere
   - HTTPS (443) from anywhere
8. **Storage:** 20 GB gp3
9. **Launch**

---

## Step 3: Configure IAM Role

**Create IAM Role:**
1. **IAM** → Roles → Create Role
2. **Use case:** EC2
3. **Permissions:** Add policies:
   - `CloudWatchAgentServerPolicy`
4. **Name:** `CloudWatchAgentRole`
5. **Create**

**Attach to EC2:**
1. **EC2** → Select instance → Actions → Security → Modify IAM role
2. **IAM role:** CloudWatchAgentRole
3. **Update**

---

## Step 4: Install Dependencies on EC2

```bash
# Connect to EC2
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>

# Update system
sudo yum update -y

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install Git
sudo yum install -y git

# Install PM2 (process manager)
sudo npm install -g pm2

# Install PostgreSQL client (for database access)
sudo yum install -y postgresql15

# Verify installations
node --version  # Should be v20.x
npm --version
pm2 --version
psql --version
```

---

## Step 5: Deploy Application

```bash
# Clone repository
cd /home/ec2-user
git clone <YOUR_REPO_URL> cocos-trading
cd cocos-trading

# Install dependencies
npm install --omit=dev

# Build TypeScript
npm run build

# Create environment file
cp .env.aws .env

# Edit environment variables
nano .env
```

**Configure `.env`:**
```bash
# Server
NODE_ENV=production
PORT=3000

# Database (from RDS)
DB_HOST=<RDS_ENDPOINT>  # e.g., cocos-db.xxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=cocos_trading
DB_USER=postgres
DB_PASSWORD=<YOUR_DB_PASSWORD>

# Logging
LOG_LEVEL=info
LOG_PRETTY=false
LOGGER_TYPE=cloudwatch

# Metrics
METRICS_TYPE=cloudwatch

# AWS
AWS_REGION=us-east-1
CLOUDWATCH_LOG_GROUP=/aws/cocos-trading/api
CLOUDWATCH_LOG_STREAM=main
CLOUDWATCH_METRICS_NAMESPACE=CocosTrading
```

Save and exit (Ctrl+X, Y, Enter)

---

## Step 6: Start Application with PM2

```bash
# Start app
pm2 start npm --name cocos-api -- run start

# Save PM2 config
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Copy and run the command it outputs

# Verify it's running
pm2 status
pm2 logs cocos-api

# Test API
curl http://localhost:3000/api/health
```

---

## Step 7: Configure Security Group (Allow HTTP)

**Update EC2 Security Group:**
1. **EC2** → Security Groups → Select your instance's security group
2. **Inbound rules** → Edit
3. **Add rule:**
   - Type: Custom TCP
   - Port: 3000
   - Source: 0.0.0.0/0 (or your IP)
4. **Save**

**Test from your machine:**
```bash
curl http://<EC2_PUBLIC_IP>:3000/api/health
```

---

## Step 8: (Optional) Setup Nginx Reverse Proxy

```bash
# Install Nginx
sudo yum install -y nginx

# Configure Nginx
sudo nano /etc/nginx/nginx.conf
```

**Add this server block inside `http {}`:**
```nginx
server {
    listen 80;
    server_name <YOUR_DOMAIN_OR_IP>;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Test
curl http://<EC2_PUBLIC_IP>/api/health
```

---

# 🔧 Environment Variables

## Local Development (Docker)

**File:** `.env.local` (used by docker-compose.yml)

```bash
NODE_ENV=development
PORT=3000
DB_HOST=postgres  # Docker service name
DB_PORT=5432
DB_NAME=cocos_trading
DB_USER=postgres
DB_PASSWORD=postgres
LOG_LEVEL=info
LOG_PRETTY=false
LOGGER_TYPE=console
METRICS_TYPE=noop
```

## AWS Production

**File:** `.env` (on EC2 instance)

```bash
NODE_ENV=production
PORT=3000
DB_HOST=<RDS_ENDPOINT>
DB_PORT=5432
DB_NAME=cocos_trading
DB_USER=postgres
DB_PASSWORD=<DB_PASSWORD>
LOG_LEVEL=info
LOG_PRETTY=false
LOGGER_TYPE=cloudwatch
METRICS_TYPE=cloudwatch
AWS_REGION=us-east-1
CLOUDWATCH_LOG_GROUP=/aws/cocos-trading/api
CLOUDWATCH_LOG_STREAM=main
CLOUDWATCH_METRICS_NAMESPACE=CocosTrading
```

---

# 📊 Monitoring

## Local (Docker) - Grafana

**Access:** http://localhost:3001 (admin/admin)

**Dashboards:**
- Cocos Trading API (auto-provisioned)
- HTTP requests, latency, errors
- Logs via Loki

**Metrics Endpoint:** http://localhost:3000/api/metrics

## AWS Production - CloudWatch

**Logs:**
1. **AWS Console** → CloudWatch → Log groups
2. Find: `/aws/cocos-trading/api`
3. Click stream: `main`

**Metrics:**
1. **AWS Console** → CloudWatch → Metrics
2. **Namespace:** CocosTrading
3. View: HTTP requests, latency, errors

**Create Dashboard:**
1. CloudWatch → Dashboards → Create
2. Add widgets for key metrics

**Set Alarms:**
1. CloudWatch → Alarms → Create alarm
2. Example: Alert when error rate > 5%

---

# 🆘 Troubleshooting

## Local (Docker)

**Problem:** Containers won't start
```bash
docker-compose logs
docker-compose down -v  # Nuclear option: wipe everything
docker-compose up -d
```

**Problem:** Port already in use
```bash
# Find process using port 3000
lsof -i :3000
kill <PID>
```

**Problem:** Database connection fails
```bash
# Check if PostgreSQL container is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres
```

**Problem:** Grafana shows "No data"
- Wait 30 seconds after startup
- Check Prometheus is scraping: http://localhost:9090/targets
- Verify data sources in Grafana → Configuration → Data sources

## AWS Production

**Problem:** Can't SSH to EC2
- Check security group allows SSH (22) from your IP
- Verify key pair permissions: `chmod 400 your-key.pem`

**Problem:** App not starting
```bash
# Check logs
pm2 logs cocos-api

# Check environment variables
cat .env

# Check if database is reachable
psql -h <RDS_ENDPOINT> -U postgres -d cocos_trading
```

**Problem:** Logs not appearing in CloudWatch
- Verify IAM role is attached to EC2
- Check `LOGGER_TYPE=cloudwatch` in `.env`
- Check CloudWatch agent permissions
- Wait 1-2 minutes for first logs to appear

**Problem:** Can't connect to database
- Check RDS security group allows traffic from EC2
- Verify RDS endpoint is correct
- Test connection: `psql -h <RDS_ENDPOINT> -U postgres`

**Problem:** High memory usage
```bash
# Check PM2 memory
pm2 monit

# Restart app
pm2 restart cocos-api
```

---

# 🔒 Security Checklist

## Before Going to Production:

### AWS:
- [ ] Change RDS master password
- [ ] Restrict security groups (don't allow 0.0.0.0/0 for SSH)
- [ ] Enable RDS encryption at rest
- [ ] Enable CloudWatch Logs encryption
- [ ] Use HTTPS (setup SSL certificate with AWS Certificate Manager)
- [ ] Enable AWS CloudTrail for auditing
- [ ] Setup CloudWatch alarms for errors
- [ ] Use AWS Secrets Manager for database password
- [ ] Enable automated RDS backups
- [ ] Setup Multi-AZ for RDS (high availability)

### Application:
- [ ] Change Grafana admin password (if using local)
- [ ] Set `NODE_ENV=production`
- [ ] Set `LOG_LEVEL=warn` or `info`
- [ ] Review rate limits in code
- [ ] Enable CORS only for your domain
- [ ] Review all environment variables

---

# 📝 Quick Reference

## PM2 Commands (AWS)

```bash
pm2 start npm --name cocos-api -- run start  # Start
pm2 stop cocos-api                           # Stop
pm2 restart cocos-api                        # Restart
pm2 logs cocos-api                           # View logs
pm2 monit                                    # Monitor resources
pm2 delete cocos-api                         # Remove from PM2
pm2 save                                     # Save PM2 state
```

## Docker Commands (Local)

```bash
docker-compose up -d                         # Start all
docker-compose down                          # Stop all
docker-compose restart app                   # Restart API only
docker-compose logs -f app                   # Stream API logs
docker-compose exec app sh                   # Shell into container
docker-compose exec postgres psql -U postgres # Access database
```

## Useful Queries

```bash
# Check API health
curl http://localhost:3000/api/health

# View Prometheus metrics
curl http://localhost:3000/api/metrics

# Test order creation
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"instrumentId":34,"side":"BUY","type":"MARKET","size":1}'
```

---

**Need help?** Check [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) for architecture details or [README.md](./README.md) for quick start.
