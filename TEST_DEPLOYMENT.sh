#!/bin/bash
# ==============================================================================
# PHASE 3 DEPLOYMENT TESTING SCRIPT
# ==============================================================================
# This script tests all Phase 3 features after deployment
# Run after DEPLOY_NOW.sh completes successfully
# ==============================================================================

set +e  # Don't exit on error for testing

echo "🧪 TESTING PHASE 3 DEPLOYMENT"
echo "=============================="
echo ""

BACKEND_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Helper function to test endpoint
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

echo "1️⃣  CONTAINER HEALTH CHECKS"
echo "=============================="

# Check if containers are running
echo ""
echo "Checking containers..."
docker compose -f docker-compose.production.yml ps

BACKEND_RUNNING=$(docker compose -f docker-compose.production.yml ps | grep backend | grep Up | wc -l)
FRONTEND_RUNNING=$(docker compose -f docker-compose.production.yml ps | grep frontend | grep Up | wc -l)
POSTGRES_RUNNING=$(docker compose -f docker-compose.production.yml ps | grep postgres | grep Up | wc -l)

if [ "$BACKEND_RUNNING" -eq 1 ]; then
    echo -e "${GREEN}✅ Backend container running${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Backend container not running${NC}"
    ((FAILED++))
fi

if [ "$FRONTEND_RUNNING" -eq 1 ]; then
    echo -e "${GREEN}✅ Frontend container running${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Frontend container not running${NC}"
    ((FAILED++))
fi

if [ "$POSTGRES_RUNNING" -eq 1 ]; then
    echo -e "${GREEN}✅ PostgreSQL container running${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ PostgreSQL container not running${NC}"
    ((FAILED++))
fi

echo ""
echo "2️⃣  BACKEND API TESTS"
echo "=============================="

# Test health endpoint
test_endpoint "Health Check" "$BACKEND_URL/api/health" "200"

# Test existing endpoints (should work without auth)
test_endpoint "Auth endpoint" "$BACKEND_URL/api/auth/health" "404"  # 404 is ok, means route exists

# Test new Phase 3 endpoints (will return 401 without auth, which means they exist)
echo ""
echo "Testing Phase 3 API routes (401 = route exists, needs auth):"
test_endpoint "Military API" "$BACKEND_URL/api/military/alliances" "401"
test_endpoint "Economy API" "$BACKEND_URL/api/economy/tax-settings" "401"
test_endpoint "Governance API" "$BACKEND_URL/api/governance/policies" "401"

echo ""
echo "3️⃣  DATABASE SCHEMA TESTS"
echo "=============================="

# Check if new tables exist
echo ""
echo "Checking database tables..."

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
    result=$(docker compose -f docker-compose.production.yml exec -T postgres \
        psql -U gameuser -d republicadb -tAc \
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" 2>/dev/null)

    if [ "$result" = "t" ]; then
        echo -e "${GREEN}✅${NC} Table '$table' exists"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC} Table '$table' NOT found"
        ((FAILED++))
    fi
done

echo ""
echo "4️⃣  FRONTEND ACCESSIBILITY"
echo "=============================="

# Test frontend is accessible
test_endpoint "Frontend Homepage" "$FRONTEND_URL" "200"

echo ""
echo "5️⃣  BACKEND LOGS CHECK"
echo "=============================="

echo ""
echo "Recent backend logs (checking for errors):"
ERRORS=$(docker compose -f docker-compose.production.yml logs backend --tail=50 | grep -i "error" | wc -l)

if [ "$ERRORS" -eq 0 ]; then
    echo -e "${GREEN}✅ No errors in recent logs${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  Found $ERRORS error lines in logs${NC}"
    docker compose -f docker-compose.production.yml logs backend --tail=20 | grep -i "error"
fi

echo ""
echo "=============================="
echo "📊 TEST SUMMARY"
echo "=============================="
echo -e "Tests Passed: ${GREEN}$PASSED${NC}"
echo -e "Tests Failed: ${RED}$FAILED${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo ""
    echo "✅ Phase 3 deployment successful!"
    echo ""
    echo "🎮 You can now access:"
    echo "   Frontend: http://$(hostname -I | awk '{print $1}'):3000"
    echo "   Backend:  http://$(hostname -I | awk '{print $1}'):5000"
    echo ""
    echo "🆕 New features available:"
    echo "   ⚔️  Military: http://$(hostname -I | awk '{print $1}'):3000/military"
    echo "   📊 Economy:  http://$(hostname -I | awk '{print $1}'):3000/economy"
    echo "   🏛️  Government: http://$(hostname -I | awk '{print $1}'):3000/government"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo ""
    echo "🔍 Troubleshooting:"
    echo "1. Check container logs:"
    echo "   docker compose -f docker-compose.production.yml logs"
    echo ""
    echo "2. Restart containers:"
    echo "   docker compose -f docker-compose.production.yml restart"
    echo ""
    echo "3. Check database connection:"
    echo "   docker compose -f docker-compose.production.yml exec backend env | grep DB"
    exit 1
fi
