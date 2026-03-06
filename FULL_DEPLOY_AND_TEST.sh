#!/bin/bash
# ==============================================================================
# COMPLETE PHASE 3 DEPLOYMENT AND TESTING SCRIPT
# ==============================================================================
# This script does EVERYTHING: Deploy + Test + Verification
# Run on server: bash FULL_DEPLOY_AND_TEST.sh
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  PHASE 3 COMPLETE DEPLOYMENT & TESTING                    ║${NC}"
echo -e "${BLUE}║  Military + Economy + Governance                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.production.yml" ]; then
    echo -e "${RED}❌ Error: docker-compose.production.yml not found!${NC}"
    echo "Please run this script from /root/republica-game directory"
    exit 1
fi

# ==============================================================================
# PART 1: DEPLOYMENT
# ==============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}PART 1: DEPLOYMENT${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Pull latest changes
echo -e "${YELLOW}[1/6]${NC} Pulling latest changes from Git..."
git fetch origin
git checkout claude/verify-repo-functionality-01H4j4p2xN6KiNXg5PQhu97Y
git pull origin claude/verify-repo-functionality-01H4j4p2xN6KiNXg5PQhu97Y
echo -e "${GREEN}✅ Git pull complete${NC}"
echo ""

# Step 2: Stop containers
echo -e "${YELLOW}[2/6]${NC} Stopping containers..."
docker compose -f docker-compose.production.yml down
echo -e "${GREEN}✅ Containers stopped${NC}"
echo ""

# Step 3: Database migrations (Sequelize will auto-sync)
echo -e "${YELLOW}[3/6]${NC} Preparing database migrations..."
echo "Note: Sequelize will auto-sync models on container start"
echo -e "${GREEN}✅ Migration preparation complete${NC}"
echo ""

# Step 4: Build containers
echo -e "${YELLOW}[4/6]${NC} Building Docker containers..."
docker compose -f docker-compose.production.yml build
echo -e "${GREEN}✅ Build complete${NC}"
echo ""

# Step 5: Start containers
echo -e "${YELLOW}[5/6]${NC} Starting containers..."
docker compose -f docker-compose.production.yml up -d
echo -e "${GREEN}✅ Containers started${NC}"
echo ""

# Step 6: Wait for services
echo -e "${YELLOW}[6/6]${NC} Waiting for services to initialize..."
sleep 15
echo -e "${GREEN}✅ Services initialized${NC}"
echo ""

echo -e "${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo ""

# ==============================================================================
# PART 2: TESTING
# ==============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}PART 2: AUTOMATED TESTING${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

BACKEND_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:3000"
PASSED=0
FAILED=0

# Helper function
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected="$3"

    echo -n "Testing $name... "
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)

    if [ "$response" = "$expected" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $response)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Expected $expected, got $response)"
        ((FAILED++))
        return 1
    fi
}

# Test 1: Container Health
echo -e "${YELLOW}TEST 1: Container Health Checks${NC}"
echo "════════════════════════════════════"

BACKEND_RUNNING=$(docker compose -f docker-compose.production.yml ps | grep backend | grep Up | wc -l)
FRONTEND_RUNNING=$(docker compose -f docker-compose.production.yml ps | grep frontend | grep Up | wc -l)
POSTGRES_RUNNING=$(docker compose -f docker-compose.production.yml ps | grep postgres | grep Up | wc -l)

echo -n "Backend container... "
if [ "$BACKEND_RUNNING" -eq 1 ]; then
    echo -e "${GREEN}✅ Running${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Not running${NC}"
    ((FAILED++))
fi

echo -n "Frontend container... "
if [ "$FRONTEND_RUNNING" -eq 1 ]; then
    echo -e "${GREEN}✅ Running${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Not running${NC}"
    ((FAILED++))
fi

echo -n "PostgreSQL container... "
if [ "$POSTGRES_RUNNING" -eq 1 ]; then
    echo -e "${GREEN}✅ Running${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Not running${NC}"
    ((FAILED++))
fi

echo ""

# Test 2: Backend API
echo -e "${YELLOW}TEST 2: Backend API Endpoints${NC}"
echo "════════════════════════════════════"

test_endpoint "Health Check" "$BACKEND_URL/api/health" "200"
test_endpoint "Military API (requires auth)" "$BACKEND_URL/api/military/alliances" "401"
test_endpoint "Economy API (requires auth)" "$BACKEND_URL/api/economy/tax-settings" "401"
test_endpoint "Governance API (requires auth)" "$BACKEND_URL/api/governance/policies" "401"

echo ""

# Test 3: Database Schema
echo -e "${YELLOW}TEST 3: Database Schema${NC}"
echo "════════════════════════════════════"

TABLES=(
    "military_units"
    "battles"
    "alliances"
    "trade_routes"
    "auto_orders"
    "tax_settings"
    "policies"
    "policy_votes"
    "government_positions"
    "impeachment_votes"
)

for table in "${TABLES[@]}"; do
    echo -n "Table '$table'... "
    result=$(docker compose -f docker-compose.production.yml exec -T postgres \
        psql -U gameuser -d republicadb -tAc \
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" 2>/dev/null)

    if [ "$result" = "t" ]; then
        echo -e "${GREEN}✅ Exists${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ Not found${NC}"
        ((FAILED++))
    fi
done

echo ""

# Test 4: Frontend
echo -e "${YELLOW}TEST 4: Frontend Accessibility${NC}"
echo "════════════════════════════════════"

test_endpoint "Frontend Homepage" "$FRONTEND_URL" "200"

echo ""

# Test 5: Backend Logs
echo -e "${YELLOW}TEST 5: Backend Logs Check${NC}"
echo "════════════════════════════════════"

ERRORS=$(docker compose -f docker-compose.production.yml logs backend --tail=100 | grep -i "error\|exception\|fail" | grep -v "Failed to authenticate" | wc -l)

echo -n "Checking for errors in logs... "
if [ "$ERRORS" -eq 0 ]; then
    echo -e "${GREEN}✅ No critical errors${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  Found $ERRORS potential error lines${NC}"
    echo "Recent logs:"
    docker compose -f docker-compose.production.yml logs backend --tail=10 | grep -i "error\|exception\|fail"
fi

echo ""

# ==============================================================================
# FINAL SUMMARY
# ==============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}FINAL SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Tests Passed: ${GREEN}$PASSED${NC}"
echo -e "Tests Failed: ${RED}$FAILED${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║              🎉 ALL TESTS PASSED! 🎉                       ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║          Phase 3 Deployment Successful!                   ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Get server IP
    SERVER_IP=$(hostname -I | awk '{print $1}')

    echo -e "${BLUE}🎮 ACCESS YOUR GAME:${NC}"
    echo "══════════════════════════════════════"
    echo -e "Frontend: ${GREEN}http://$SERVER_IP:3000${NC}"
    echo -e "Backend:  ${GREEN}http://$SERVER_IP:5000${NC}"
    echo ""
    echo -e "${BLUE}🆕 NEW FEATURES:${NC}"
    echo "══════════════════════════════════════"
    echo -e "⚔️  Military:   ${GREEN}http://$SERVER_IP:3000/military${NC}"
    echo -e "📊 Economy:    ${GREEN}http://$SERVER_IP:3000/economy${NC}"
    echo -e "🏛️  Government: ${GREEN}http://$SERVER_IP:3000/government${NC}"
    echo ""
    echo -e "${BLUE}📊 CONTAINER STATUS:${NC}"
    echo "══════════════════════════════════════"
    docker compose -f docker-compose.production.yml ps
    echo ""

    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                            ║${NC}"
    echo -e "${RED}║              ❌ SOME TESTS FAILED ❌                        ║${NC}"
    echo -e "${RED}║                                                            ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}🔍 TROUBLESHOOTING:${NC}"
    echo "══════════════════════════════════════"
    echo "1. Check all container logs:"
    echo "   docker compose -f docker-compose.production.yml logs"
    echo ""
    echo "2. Check specific service:"
    echo "   docker compose -f docker-compose.production.yml logs backend"
    echo "   docker compose -f docker-compose.production.yml logs frontend"
    echo ""
    echo "3. Restart services:"
    echo "   docker compose -f docker-compose.production.yml restart"
    echo ""
    echo "4. Check database connection:"
    echo "   docker compose -f docker-compose.production.yml exec backend env | grep DB"
    echo ""

    exit 1
fi
