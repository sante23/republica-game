#!/bin/bash
# ==============================================================================
# PHASE 3 PRODUCTION DEPLOYMENT SCRIPT
# ==============================================================================
# This script deploys Phase 3 (Military, Economy, Governance) to production
# Run this on your production server: bash DEPLOY_NOW.sh
# ==============================================================================

set -e

echo "🚀 PHASE 3 DEPLOYMENT STARTING..."
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.production.yml" ]; then
    echo "❌ Error: docker-compose.production.yml not found!"
    echo "Please run this script from /root/republica-game directory"
    exit 1
fi

# Step 1: Pull latest changes
echo "📥 Step 1/6: Pulling latest changes from Git..."
git fetch origin
git checkout claude/verify-repo-functionality-01H4j4p2xN6KiNXg5PQhu97Y
git pull origin claude/verify-repo-functionality-01H4j4p2xN6KiNXg5PQhu97Y
echo "✅ Git pull complete"
echo ""

# Step 2: Stop containers
echo "🛑 Step 2/6: Stopping containers..."
docker compose -f docker-compose.production.yml down
echo "✅ Containers stopped"
echo ""

# Step 3: Database migrations
echo "📊 Step 3/6: Applying database migrations..."
echo "Note: Sequelize will auto-sync models on container start"
echo "✅ Migration preparation complete"
echo ""

# Step 4: Build containers
echo "🔨 Step 4/6: Building Docker containers..."
docker compose -f docker-compose.production.yml build
echo "✅ Build complete"
echo ""

# Step 5: Start containers
echo "▶️  Step 5/6: Starting containers..."
docker compose -f docker-compose.production.yml up -d
echo "✅ Containers started"
echo ""

# Step 6: Wait and verify
echo "⏳ Step 6/6: Waiting for services to initialize..."
sleep 15
echo ""

echo "📊 CONTAINER STATUS:"
echo "===================="
docker compose -f docker-compose.production.yml ps
echo ""

echo "📜 RECENT LOGS:"
echo "==============="
docker compose -f docker-compose.production.yml logs --tail=30
echo ""

echo "✅ DEPLOYMENT COMPLETE!"
echo "======================="
echo ""
echo "🧪 VERIFICATION COMMANDS:"
echo ""
echo "1. Check all containers are running:"
echo "   docker compose -f docker-compose.production.yml ps"
echo ""
echo "2. View real-time logs:"
echo "   docker compose -f docker-compose.production.yml logs -f"
echo ""
echo "3. Check backend logs only:"
echo "   docker compose -f docker-compose.production.yml logs -f backend"
echo ""
echo "4. Test health endpoint:"
echo "   curl http://localhost:5000/api/health"
echo ""
echo "5. Access the application:"
echo "   Frontend: http://$(hostname -I | awk '{print $1}'):3000"
echo "   Backend:  http://$(hostname -I | awk '{print $1}'):5000"
echo ""
echo "🎮 NEW FEATURES AVAILABLE:"
echo "  ⚔️  Military Page - /military"
echo "  📊 Economy Page - /economy"
echo "  🏛️  Government Page - /government"
echo ""
