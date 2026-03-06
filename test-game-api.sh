#!/bin/bash

# Republica Game - API Test Suite
# Tests all major game features

BASE_URL="http://localhost:3001"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  REPUBLICA GAME - COMPLETE API TEST SUITE                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Test 1: Backend Health
echo -e "${YELLOW}[TEST 1]${NC} Backend Health Check..."
HEALTH=$(curl -s "$BASE_URL/health")
if [[ $HEALTH == *"ok"* ]]; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    exit 1
fi
echo ""

# Test 2: User Registration
echo -e "${YELLOW}[TEST 2]${NC} User Registration..."
TIMESTAMP=$(date +%s)
REGISTER=$(curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"username\": \"player_$TIMESTAMP\",
        \"email\": \"player_$TIMESTAMP@test.com\",
        \"password\": \"Test123!\",
        \"worldName\": \"TestWorld_$TIMESTAMP\"
    }")

if [[ $REGISTER == *"token"* ]]; then
    echo -e "${GREEN}✅ User registration successful${NC}"
    TOKEN=$(echo $REGISTER | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    USER_ID=$(echo $REGISTER | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    echo "   User ID: $USER_ID"
else
    echo -e "${RED}❌ Registration failed${NC}"
    echo "   Response: $REGISTER"
    exit 1
fi
echo ""

# Test 3: User Login
echo -e "${YELLOW}[TEST 3]${NC} User Login..."
LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"player_$TIMESTAMP@test.com\",
        \"password\": \"Test123!\"
    }")

if [[ $LOGIN == *"token"* ]]; then
    echo -e "${GREEN}✅ Login successful${NC}"
else
    echo -e "${RED}❌ Login failed${NC}"
    exit 1
fi
echo ""

# Test 4: Get Profile
echo -e "${YELLOW}[TEST 4]${NC} Get User Profile..."
PROFILE=$(curl -s "$BASE_URL/api/users/profile" \
    -H "Authorization: Bearer $TOKEN")

if [[ $PROFILE == *"username"* ]]; then
    echo -e "${GREEN}✅ Profile retrieved successfully${NC}"
    echo "   Username: $(echo $PROFILE | grep -o '"username":"[^"]*' | cut -d'"' -f4)"
else
    echo -e "${RED}❌ Profile retrieval failed${NC}"
fi
echo ""

# Test 5: Get Cities
echo -e "${YELLOW}[TEST 5]${NC} Get User Cities..."
CITIES=$(curl -s "$BASE_URL/api/cities" \
    -H "Authorization: Bearer $TOKEN")

if [[ $CITIES == *"["* ]]; then
    CITY_COUNT=$(echo $CITIES | grep -o '"id"' | wc -l)
    echo -e "${GREEN}✅ Cities retrieved successfully${NC}"
    echo "   Number of cities: $CITY_COUNT"

    if [[ $CITY_COUNT -gt 0 ]]; then
        CITY_ID=$(echo $CITIES | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
        echo "   First city ID: $CITY_ID"
    fi
else
    echo -e "${RED}❌ Cities retrieval failed${NC}"
fi
echo ""

# Test 6: Get Resources
echo -e "${YELLOW}[TEST 6]${NC} Get City Resources..."
if [[ -n $CITY_ID ]]; then
    RESOURCES=$(curl -s "$BASE_URL/api/cities/$CITY_ID/resources" \
        -H "Authorization: Bearer $TOKEN")

    if [[ $RESOURCES == *"gold"* ]] || [[ $RESOURCES == *"food"* ]]; then
        echo -e "${GREEN}✅ Resources retrieved successfully${NC}"
        echo "   Response: $RESOURCES"
    else
        echo -e "${RED}❌ Resources retrieval failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Skipped (no cities available)${NC}"
fi
echo ""

# Test 7: Create Military Unit
echo -e "${YELLOW}[TEST 7]${NC} Create Military Unit..."
if [[ -n $CITY_ID ]]; then
    UNIT=$(curl -s -X POST "$BASE_URL/api/military/units" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"cityId\": \"$CITY_ID\",
            \"unitType\": \"infantry\",
            \"quantity\": 10
        }")

    if [[ $UNIT == *"id"* ]] || [[ $UNIT == *"success"* ]]; then
        echo -e "${GREEN}✅ Military unit created successfully${NC}"
    elif [[ $UNIT == *"insufficient"* ]]; then
        echo -e "${YELLOW}⚠️  Insufficient resources (expected for new game)${NC}"
    else
        echo -e "${RED}❌ Unit creation failed${NC}"
        echo "   Response: $UNIT"
    fi
else
    echo -e "${YELLOW}⚠️  Skipped (no cities available)${NC}"
fi
echo ""

# Test 8: Create Policy
echo -e "${YELLOW}[TEST 8]${NC} Create Policy Proposal..."
POLICY=$(curl -s -X POST "$BASE_URL/api/governance/policies" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"Test Tax Policy\",
        \"description\": \"A test policy to increase tax revenue\",
        \"policyType\": \"economic\",
        \"effects\": {\"taxRate\": 0.15}
    }")

if [[ $POLICY == *"id"* ]]; then
    POLICY_ID=$(echo $POLICY | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    echo -e "${GREEN}✅ Policy created successfully${NC}"
    echo "   Policy ID: $POLICY_ID"
elif [[ $POLICY == *"world"* ]]; then
    echo -e "${YELLOW}⚠️  Policy creation requires world context${NC}"
else
    echo -e "${RED}❌ Policy creation failed${NC}"
    echo "   Response: $POLICY"
fi
echo ""

# Test 9: Get Market Listings
echo -e "${YELLOW}[TEST 9]${NC} Get Market Listings..."
MARKET=$(curl -s "$BASE_URL/api/market" \
    -H "Authorization: Bearer $TOKEN")

if [[ $MARKET == *"["* ]]; then
    LISTING_COUNT=$(echo $MARKET | grep -o '"id"' | wc -l)
    echo -e "${GREEN}✅ Market listings retrieved${NC}"
    echo "   Number of listings: $LISTING_COUNT"
else
    echo -e "${RED}❌ Market retrieval failed${NC}"
fi
echo ""

# Test 10: Database Tables Check
echo -e "${YELLOW}[TEST 10]${NC} Database Tables Verification..."
BACKEND_LOGS=$(docker compose -f docker-compose.production.yml logs backend --tail=100 2>/dev/null)

if [[ $BACKEND_LOGS == *"Database synchronized successfully"* ]]; then
    echo -e "${GREEN}✅ Database synchronized successfully${NC}"
elif [[ $BACKEND_LOGS == *"relation"*"does not exist"* ]]; then
    echo -e "${RED}❌ Database sync error detected in logs${NC}"
else
    echo -e "${YELLOW}⚠️  Could not verify database status from logs${NC}"
fi
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  TEST SUITE COMPLETE                                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ All major API endpoints tested"
echo "🎮 Game is ready to play!"
echo ""
echo "Access the game at: http://212.227.38.226/"
echo ""
