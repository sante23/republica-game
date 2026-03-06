#!/bin/bash
set -e

echo "🚀 DEPLOYING PHASE 3 - Military, Economy & Governance"
echo "======================================================"

# Navigate to project directory
cd /root/republica-game

# Pull latest changes
echo "📥 Pulling latest changes..."
git fetch origin
git checkout claude/verify-repo-functionality-01H4j4p2xN6KiNXg5PQhu97Y
git pull origin claude/verify-repo-functionality-01H4j4p2xN6KiNXg5PQhu97Y

# Stop containers
echo "🛑 Stopping containers..."
docker compose -f docker-compose.production.yml down

# Apply database migrations
echo "📊 Applying database migrations..."
cd backend
node apply-migration.js
cd ..

# Rebuild and start containers
echo "🔨 Building containers..."
docker compose -f docker-compose.production.yml build

echo "▶️  Starting containers..."
docker compose -f docker-compose.production.yml up -d

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "📊 Check status:"
echo "  docker compose -f docker-compose.production.yml ps"
echo ""
echo "📜 View logs:"
echo "  docker compose -f docker-compose.production.yml logs -f"
echo ""
echo "🌐 Frontend: http://your-server-ip:3000"
echo "🔌 Backend: http://your-server-ip:5000"
