#!/bin/bash

# 🚀 Republica Game - Auto Installation Script
# Tested on Ubuntu 20.04+

set -e

echo "🏛️ REPUBLICA GAME - SERVER INSTALLATION"
echo "======================================"

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should not be run as root"
   exit 1
fi

# Get user input
read -p "Enter your domain name (e.g., yourdomain.com): " DOMAIN
read -p "Enter your email for SSL certificate: " EMAIL
read -s -p "Enter database password: " DB_PASSWORD
echo
read -s -p "Enter JWT secret (min 32 characters): " JWT_SECRET
echo

# Validate inputs
if [[ -z "$DOMAIN" || -z "$EMAIL" || -z "$DB_PASSWORD" || -z "$JWT_SECRET" ]]; then
    echo "❌ All fields are required"
    exit 1
fi

if [[ ${#JWT_SECRET} -lt 32 ]]; then
    echo "❌ JWT secret must be at least 32 characters"
    exit 1
fi

echo "🔄 Starting installation..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install dependencies
echo "📦 Installing dependencies..."
sudo apt install -y curl wget git build-essential nginx postgresql postgresql-contrib

# Install Node.js 18
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Setup PostgreSQL
echo "🗄️ Setting up PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE republica_db;
CREATE USER republica_user WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE republica_db TO republica_user;
\q
EOF

# Create application directory
echo "📁 Setting up application directory..."
sudo mkdir -p /var/www/republica
sudo chown $USER:$USER /var/www/republica

# Clone repository (assuming it's in current directory)
echo "📥 Copying application files..."
cp -r ./* /var/www/republica/
cd /var/www/republica

# Install dependencies
echo "📦 Installing application dependencies..."
npm run install:all

# Create environment files
echo "⚙️ Creating environment configuration..."

# Backend environment
cat > backend/.env << EOF
NODE_ENV=production
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=republica_db
DB_USER=republica_user
DB_PASSWORD=$DB_PASSWORD

JWT_SECRET=$JWT_SECRET
JWT_EXPIRE=7d

CLIENT_URL=https://$DOMAIN
EOF

# Frontend environment
cat > frontend/.env.production << EOF
REACT_APP_API_URL=https://$DOMAIN/api
EOF

# Build frontend
echo "🔨 Building frontend..."
cd frontend
npm run build
cd ..

# Create PM2 configuration
echo "⚙️ Setting up PM2..."
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
    time: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Start application with PM2
echo "🚀 Starting application..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Configure Nginx
echo "🌐 Configuring Nginx..."
sudo cat > /etc/nginx/sites-available/republica << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Frontend (React build)
    location / {
        root /var/www/republica/frontend/build;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
        
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
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/republica /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Setup SSL with Let's Encrypt
echo "🔒 Setting up SSL certificate..."
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive

# Setup firewall
echo "🔥 Configuring firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Setup automatic backup
echo "💾 Setting up automatic backup..."
mkdir -p /home/$USER/backups

cat > /home/$USER/backup-db.sh << 'BACKUP_EOF'
#!/bin/bash
DATE=$(date +"%Y%m%d_%H%M%S")
PGPASSWORD="$DB_PASSWORD" pg_dump -h localhost -U republica_user -d republica_db > /home/$USER/backups/republica_backup_$DATE.sql
find /home/$USER/backups/ -name "republica_backup_*.sql" -mtime +7 -delete
BACKUP_EOF

chmod +x /home/$USER/backup-db.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /home/$USER/backup-db.sh") | crontab -

# Create health check script
cat > /home/$USER/health-check.sh << 'HEALTH_EOF'
#!/bin/bash

# Check backend
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "$(date): ✅ Backend OK" >> /home/$USER/health.log
else
    echo "$(date): ❌ Backend DOWN - Restarting" >> /home/$USER/health.log
    pm2 restart republica-backend
fi

# Check database
if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U republica_user -d republica_db -c "SELECT 1;" > /dev/null 2>&1; then
    echo "$(date): ✅ Database OK" >> /home/$USER/health.log
else
    echo "$(date): ❌ Database DOWN - Restarting" >> /home/$USER/health.log
    sudo systemctl restart postgresql
fi

# Check Nginx
if systemctl is-active --quiet nginx; then
    echo "$(date): ✅ Nginx OK" >> /home/$USER/health.log
else
    echo "$(date): ❌ Nginx DOWN - Restarting" >> /home/$USER/health.log
    sudo systemctl restart nginx
fi
HEALTH_EOF

chmod +x /home/$USER/health-check.sh

# Add health check to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/$USER/health-check.sh") | crontab -

# Setup log rotation
sudo cat > /etc/logrotate.d/republica << 'LOGROTATE_EOF'
/var/www/republica/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}
LOGROTATE_EOF

echo ""
echo "🎉 INSTALLATION COMPLETED!"
echo "========================"
echo ""
echo "✅ Your Republica Game server is ready!"
echo ""
echo "🌐 Website: https://$DOMAIN"
echo "📊 API Health: https://$DOMAIN/api/health"
echo "📁 Application: /var/www/republica"
echo "📋 Logs: /var/www/republica/logs/"
echo "💾 Backups: /home/$USER/backups/"
echo ""
echo "📈 Management Commands:"
echo "  pm2 status              # Check application status"
echo "  pm2 logs republica-backend  # View logs"
echo "  pm2 restart republica-backend  # Restart application"
echo "  sudo systemctl status nginx    # Check web server"
echo "  sudo systemctl status postgresql  # Check database"
echo ""
echo "🔧 Next Steps:"
echo "1. Point your domain DNS to this server IP"
echo "2. Wait for DNS propagation (up to 24h)"
echo "3. Test the application at https://$DOMAIN"
echo "4. Monitor logs and performance"
echo ""
echo "🆘 Support: Check /var/www/republica/DEPLOYMENT.md for troubleshooting"
echo ""