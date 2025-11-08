#!/bin/bash

# 🐳 Republica Game - Docker Deployment Script
# Quick deployment with Docker Compose

set -e

echo "🐳 REPUBLICA GAME - DOCKER DEPLOYMENT"
echo "===================================="

# Check Docker installation
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Get user input
read -p "Enter your domain name (e.g., yourdomain.com): " DOMAIN
read -s -p "Enter database password: " DB_PASSWORD
echo
read -s -p "Enter JWT secret (min 32 characters): " JWT_SECRET
echo
read -s -p "Enter Redis password: " REDIS_PASSWORD
echo

# Validate inputs
if [[ -z "$DOMAIN" || -z "$DB_PASSWORD" || -z "$JWT_SECRET" || -z "$REDIS_PASSWORD" ]]; then
    echo "❌ All fields are required"
    exit 1
fi

if [[ ${#JWT_SECRET} -lt 32 ]]; then
    echo "❌ JWT secret must be at least 32 characters"
    exit 1
fi

# Create .env file for production
echo "⚙️ Creating environment configuration..."
cat > .env.production << EOF
# Database
DB_PASSWORD=$DB_PASSWORD

# JWT
JWT_SECRET=$JWT_SECRET

# Redis
REDIS_PASSWORD=$REDIS_PASSWORD

# Application
CLIENT_URL=https://$DOMAIN
DOMAIN=$DOMAIN

# Compose
COMPOSE_PROJECT_NAME=republica
EOF

echo "🔄 Stopping any existing containers..."
docker-compose -f docker-compose.production.yml --env-file .env.production down 2>/dev/null || true

echo "🔨 Building Docker images..."
docker-compose -f docker-compose.production.yml --env-file .env.production build --no-cache

echo "🚀 Starting services..."
docker-compose -f docker-compose.production.yml --env-file .env.production up -d

echo "⏳ Waiting for services to be ready..."
sleep 30

# Health check
echo "🔍 Checking service health..."
for i in {1..30}; do
    if docker-compose -f docker-compose.production.yml --env-file .env.production exec backend curl -f http://localhost:5000/api/health >/dev/null 2>&1; then
        echo "✅ Backend is healthy"
        break
    fi
    echo "⏳ Waiting for backend... ($i/30)"
    sleep 10
done

# Check if frontend is responding
for i in {1..30}; do
    if curl -f http://localhost/ >/dev/null 2>&1; then
        echo "✅ Frontend is healthy"
        break
    fi
    echo "⏳ Waiting for frontend... ($i/30)"
    sleep 10
done

echo ""
echo "🎉 DOCKER DEPLOYMENT COMPLETED!"
echo "==============================="
echo ""
echo "✅ Your Republica Game is running!"
echo ""
echo "🌐 Local access: http://localhost"
echo "📊 API Health: http://localhost/api/health"
echo ""
echo "📋 Docker Commands:"
echo "  docker-compose -f docker-compose.production.yml --env-file .env.production ps    # Check status"
echo "  docker-compose -f docker-compose.production.yml --env-file .env.production logs  # View logs"
echo "  docker-compose -f docker-compose.production.yml --env-file .env.production down  # Stop services"
echo "  docker-compose -f docker-compose.production.yml --env-file .env.production up -d # Start services"
echo ""
echo "🔧 Next Steps:"
echo "1. Configure your domain DNS to point to this server"
echo "2. Setup SSL certificate (Let's Encrypt or CloudFlare)"
echo "3. Configure reverse proxy if needed"
echo "4. Monitor logs and performance"
echo ""
echo "📊 Service Status:"
docker-compose -f docker-compose.production.yml --env-file .env.production ps
echo ""