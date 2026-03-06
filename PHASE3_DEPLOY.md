# 🚀 Phase 3 Deployment Guide

## Features Implemented

### ⚔️ Military System (B)
- Train military units (Infantry, Cavalry, Archers, Siege Engines)
- Attack other cities
- Battle history and outcomes
- Alliance system

### 📊 Advanced Economy (C)
- Trade routes between cities
- Automatic buy/sell orders
- Tax settings management
- Economic policies

### 🏛️ Governance System (D)
- Policy proposals and voting
- Government positions (President, Ministers)
- Impeachment system
- Execute election results

---

## 🛠️ Deployment Instructions

### Option 1: Automated Deployment (Recommended)

On your production server, run:

```bash
cd /root/republica-game
bash deploy-phase3.sh
```

This script will:
1. Pull latest changes
2. Stop containers
3. Apply database migrations
4. Rebuild and start containers

---

### Option 2: Manual Deployment

#### Step 1: Pull Changes
```bash
cd /root/republica-game
git fetch origin
git checkout claude/verify-repo-functionality-01H4j4p2xN6KiNXg5PQhu97Y
git pull origin claude/verify-repo-functionality-01H4j4p2xN6KiNXg5PQhu97Y
```

#### Step 2: Stop Containers
```bash
docker compose -f docker-compose.production.yml down
```

#### Step 3: Apply Database Migrations
```bash
cd backend
node apply-migration.js
cd ..
```

#### Step 4: Rebuild and Start
```bash
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
```

#### Step 5: Verify
```bash
docker compose -f docker-compose.production.yml logs -f
```

---

## 📋 Database Changes

The migration creates the following tables:

### Military Tables
- `military_units` - Unit types and quantities per city
- `battles` - Battle history and outcomes
- `alliances` - Player alliance relationships

### Economy Tables
- `trade_routes` - Automated resource transfers
- `auto_orders` - Automatic market orders
- `tax_settings` - World-wide tax configuration

### Governance Tables
- `policies` - Proposed and active policies
- `policy_votes` - Voting records
- `government_positions` - President and Ministers
- `impeachment_votes` - Impeachment proceedings

---

## 🎮 Testing the Features

### Test Military System
1. Navigate to **⚔️ Military** from Dashboard
2. Train some units (need resources)
3. View units and battle history

### Test Economy System
1. Navigate to **📊 Economy** from Dashboard
2. Create a trade route between your cities
3. Set up automatic orders

### Test Governance System
1. Navigate to **🏛️ Government** from Dashboard
2. Propose a policy (requires level 5+)
3. Vote on policies
4. View government positions

---

## 🔧 Troubleshooting

### Migration Fails
If the migration fails, check:
```bash
# Check database connection
docker compose -f docker-compose.production.yml exec backend env | grep DB

# Check if tables already exist
docker compose -f docker-compose.production.yml exec postgres psql -U $DB_USER -d $DB_NAME -c "\dt"
```

### Frontend Not Loading
```bash
# Check frontend container
docker compose -f docker-compose.production.yml logs frontend

# Rebuild frontend
docker compose -f docker-compose.production.yml build frontend
docker compose -f docker-compose.production.yml up -d frontend
```

### Backend Errors
```bash
# Check backend logs
docker compose -f docker-compose.production.yml logs backend

# Check if all routes are registered
docker compose -f docker-compose.production.yml exec backend cat server.js | grep "app.use"
```

---

## 📊 API Endpoints

### Military
- `GET /api/military/city/:cityId` - Get units
- `POST /api/military/train` - Train units
- `POST /api/military/attack` - Attack city
- `GET /api/military/battles` - Battle history
- `POST /api/military/alliance/propose` - Propose alliance
- `GET /api/military/alliances` - Get alliances

### Economy
- `GET /api/economy/trade-routes/city/:cityId` - Get routes
- `POST /api/economy/trade-routes` - Create route
- `GET /api/economy/auto-orders` - Get auto orders
- `POST /api/economy/auto-orders` - Create order
- `GET /api/economy/tax-settings` - Get tax settings
- `PUT /api/economy/tax-settings` - Update taxes (requires position)

### Governance
- `GET /api/governance/policies` - Get policies
- `POST /api/governance/policies` - Propose policy
- `POST /api/governance/policies/:id/vote` - Vote on policy
- `GET /api/governance/positions` - Get positions
- `POST /api/governance/positions/appoint` - Appoint minister
- `GET /api/governance/impeachment` - Get impeachment votes
- `POST /api/governance/impeachment` - Initiate impeachment
- `POST /api/governance/execute-election` - Execute election results

---

## ✅ Success Checklist

- [ ] All containers running
- [ ] Database migrations applied
- [ ] Frontend accessible at port 3000
- [ ] Backend accessible at port 5000
- [ ] Can navigate to Military page
- [ ] Can navigate to Economy page
- [ ] Can navigate to Government page
- [ ] No console errors in browser
- [ ] Backend logs show no errors

---

## 🎉 What's Next?

All Phase 3 features (B, C, D) are now implemented:
- ✅ Military & War system
- ✅ Advanced Economy
- ✅ Governance & Politics

The game now has:
- Full combat system with multiple unit types
- Economic management with trade and taxes
- Political system with real governance
- Complete multiplayer functionality

Enjoy building your empire! 🏛️⚔️📊
