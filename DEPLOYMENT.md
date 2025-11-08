# 🚀 Guida Deployment Republica Game

Guida completa per installare Republica su server di produzione.

## 📋 Requisiti Server

### Specifiche Minime
- **CPU**: 2 vCPU
- **RAM**: 4GB
- **Storage**: 50GB SSD
- **OS**: Ubuntu 20.04+ / CentOS 8+
- **Bandwidth**: 100 Mbps

### Software Richiesto
- Node.js 18+
- PostgreSQL 14+
- Nginx
- PM2 (process manager)
- Certbot (SSL)

---

## 🛠️ Metodo 1: Installazione Manuale (Ubuntu)

### 1. Preparazione Server

```bash
# Aggiorna sistema
sudo apt update && sudo apt upgrade -y

# Installa dipendenze base
sudo apt install -y curl wget git build-essential
```

### 2. Installa Node.js

```bash
# Installa Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verifica installazione
node --version
npm --version
```

### 3. Installa PostgreSQL

```bash
# Installa PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Avvia servizio
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Configura database
sudo -u postgres psql
```

```sql
-- In PostgreSQL prompt
CREATE DATABASE republica_db;
CREATE USER republica_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE republica_db TO republica_user;
\q
```

### 4. Installa Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 5. Deploy Applicazione

```bash
# Crea directory
sudo mkdir -p /var/www/republica
sudo chown $USER:$USER /var/www/republica

# Clona repository
cd /var/www/republica
git clone https://github.com/sante23@gmail.com/republica-game.git .

# Installa dipendenze
npm run install:all
```

### 6. Configurazione Environment

```bash
# Backend environment
cat > backend/.env << 'EOF'
NODE_ENV=production
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=republica_db
DB_USER=republica_user
DB_PASSWORD=your_secure_password

JWT_SECRET=your_super_secure_jwt_secret_here_min_32_chars
JWT_EXPIRE=7d

CLIENT_URL=https://yourdomain.com
EOF

# Frontend environment
cat > frontend/.env.production << 'EOF'
REACT_APP_API_URL=https://yourdomain.com/api
EOF
```

### 7. Build Frontend

```bash
cd frontend
npm run build
```

### 8. Installa PM2

```bash
# Installa PM2 globalmente
sudo npm install -g pm2

# Crea file configurazione PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'republica-backend',
    script: './backend/server.js',
    cwd: '/var/www/republica',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Crea directory logs
mkdir -p logs

# Avvia applicazione
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 9. Configura Nginx

```bash
sudo cat > /etc/nginx/sites-available/republica << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend (React build)
    location / {
        root /var/www/republica/frontend/build;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Abilita sito
sudo ln -s /etc/nginx/sites-available/republica /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 10. Setup SSL con Let's Encrypt

```bash
# Installa Certbot
sudo apt install -y certbot python3-certbot-nginx

# Ottieni certificato SSL
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## 🐳 Metodo 2: Deployment con Docker

### 1. Installa Docker

```bash
# Installa Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Installa Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Crea Docker Files

**Dockerfile (Backend)**:
```dockerfile
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
```

**Dockerfile (Frontend)**:
```dockerfile
# frontend/Dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: republica_db
      POSTGRES_USER: republica_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    depends_on:
      - postgres
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      DB_USER: republica_user
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: republica_db
      JWT_SECRET: ${JWT_SECRET}
      CLIENT_URL: https://yourdomain.com
    ports:
      - "5000:5000"
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    restart: unless-stopped
    volumes:
      - ./ssl:/etc/nginx/ssl

volumes:
  postgres_data:
```

### 3. Deploy con Docker

```bash
# Crea file environment
cat > .env << 'EOF'
DB_PASSWORD=your_secure_password
JWT_SECRET=your_super_secure_jwt_secret_here
EOF

# Build e avvia
docker-compose up -d

# Verifica status
docker-compose ps
```

---

## ☁️ Metodo 3: Cloud Deployment (AWS/DigitalOcean)

### AWS EC2

```bash
# 1. Lancia EC2 instance (t3.medium o superiore)
# 2. Configura Security Groups:
#    - Port 22 (SSH)
#    - Port 80 (HTTP) 
#    - Port 443 (HTTPS)
#    - Port 5432 (PostgreSQL) - solo interno

# 3. Connetti via SSH
ssh -i your-key.pem ubuntu@your-ec2-ip

# 4. Segui "Metodo 1: Installazione Manuale"
```

### DigitalOcean Droplet

```bash
# 1. Crea Droplet Ubuntu 20.04 (2GB RAM minimo)
# 2. Abilita monitoring e backup
# 3. Configura domain e DNS
# 4. Segui installazione manuale
```

---

## 🔧 Configurazioni Avanzate

### Database Optimization

```sql
-- PostgreSQL tuning
-- In /etc/postgresql/14/main/postgresql.conf

shared_buffers = 256MB
effective_cache_size = 1GB
random_page_cost = 1.1
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
```

### Nginx Optimization

```nginx
# In /etc/nginx/nginx.conf
worker_processes auto;
worker_connections 1024;

gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

server {
    # Rate limiting per API
    location /api {
        limit_req zone=api burst=20 nodelay;
        # ... resto configurazione
    }
    
    location /api/auth/login {
        limit_req zone=login burst=3 nodelay;
        # ... resto configurazione
    }
}
```

### PM2 Monitoring

```bash
# Setup monitoring
pm2 install pm2-server-monit

# Logs
pm2 logs republica-backend
pm2 flush  # Clear logs

# Monitoring dashboard
pm2 monit
```

---

## 📊 Monitoring e Backup

### Setup Monitoring

```bash
# Installa htop e iotop
sudo apt install -y htop iotop

# Monitor applicazione
pm2 status
pm2 monit

# Monitor sistema
htop
iotop
df -h
free -h
```

### Backup automatico

```bash
# Script backup database
cat > /home/ubuntu/backup-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +"%Y%m%d_%H%M%S")
pg_dump -h localhost -U republica_user -d republica_db > /home/ubuntu/backups/republica_backup_$DATE.sql
find /home/ubuntu/backups/ -name "republica_backup_*.sql" -mtime +7 -delete
EOF

chmod +x /home/ubuntu/backup-db.sh
mkdir -p /home/ubuntu/backups

# Crontab per backup automatico
crontab -e
# Aggiungi: 0 2 * * * /home/ubuntu/backup-db.sh
```

---

## 🔒 Sicurezza

### Firewall

```bash
# Configura UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Fail2Ban

```bash
# Installa Fail2Ban
sudo apt install -y fail2ban

# Configura
sudo cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
action = iptables-multiport[name=ReqLimit, port="http,https", protocol=tcp]
logpath = /var/log/nginx/error.log
findtime = 600
bantime = 7200
maxretry = 10
EOF

sudo systemctl restart fail2ban
```

---

## 🚨 Troubleshooting

### Problemi Comuni

**Backend non si avvia**:
```bash
# Check logs
pm2 logs republica-backend

# Check database connection
sudo -u postgres psql -c "\l"

# Test manuale
cd /var/www/republica/backend
npm start
```

**Frontend non carica**:
```bash
# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# Check files
ls -la /var/www/republica/frontend/build/

# Rebuild
cd /var/www/republica/frontend
npm run build
```

**Database issues**:
```bash
# Check PostgreSQL
sudo systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"

# Reset password
sudo -u postgres psql
ALTER USER republica_user PASSWORD 'new_password';
```

### Script di Health Check

```bash
cat > /home/ubuntu/health-check.sh << 'EOF'
#!/bin/bash

# Check backend
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "✅ Backend OK"
else
    echo "❌ Backend DOWN"
    pm2 restart republica-backend
fi

# Check database
if sudo -u postgres psql -d republica_db -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database OK"
else
    echo "❌ Database DOWN"
    sudo systemctl restart postgresql
fi

# Check Nginx
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx OK"
else
    echo "❌ Nginx DOWN"
    sudo systemctl restart nginx
fi
EOF

chmod +x /home/ubuntu/health-check.sh

# Run every 5 minutes
crontab -e
# Add: */5 * * * * /home/ubuntu/health-check.sh >> /home/ubuntu/health.log
```

---

## 📈 Scaling e Performance

### Load Balancing (Multiple Servers)

```nginx
# nginx.conf per load balancer
upstream backend {
    server 10.0.1.10:5000;
    server 10.0.1.11:5000;
    server 10.0.1.12:5000;
}

server {
    location /api {
        proxy_pass http://backend;
        # ... resto configurazione
    }
}
```

### Database Scaling

```sql
-- Read replicas
-- Master-slave setup
-- Connection pooling with pgbouncer
```

---

## ✅ Checklist Post-Deployment

- [ ] Applicazione raggiungibile via HTTPS
- [ ] Database funzionante e popolato
- [ ] SSL certificate attivo
- [ ] PM2 processi running
- [ ] Nginx configurato correttamente
- [ ] Firewall configurato
- [ ] Backup automatico attivo
- [ ] Monitoring setup
- [ ] Health checks funzionanti
- [ ] Logs rotazione configurata
- [ ] Domain DNS configurato

**🎉 Il tuo server Republica è pronto!**

Accedi a: https://yourdomain.com