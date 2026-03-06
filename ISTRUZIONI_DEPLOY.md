# 🚀 ISTRUZIONI DEPLOY FASE 3

## ✅ COMPLETATO
Tutti i task richiesti sono stati completati:
- ✅ API routes per governance
- ✅ Frontend Military page
- ✅ Frontend Trade Routes (Economy page)
- ✅ Frontend Government/Policies page
- ✅ Navigation links aggiunti
- ⏳ **Test sul server di produzione (PROSSIMO STEP)**

---

## 📋 COSA È STATO IMPLEMENTATO

### Backend (JavaScript + Sequelize)
```
backend/
├── models/
│   ├── MilitaryUnit.js         ⚔️
│   ├── Battle.js               ⚔️
│   ├── Alliance.js             ⚔️
│   ├── TradeRoute.js           📊
│   ├── AutoOrder.js            📊
│   ├── TaxSettings.js          📊
│   ├── Policy.js               🏛️
│   ├── PolicyVote.js           🏛️
│   ├── GovernmentPosition.js   🏛️
│   └── ImpeachmentVote.js      🏛️
└── routes/
    ├── military.js     (train, attack, alliances)
    ├── economy.js      (trade routes, auto orders, taxes)
    └── governance.js   (policies, positions, impeachment)
```

### Frontend (React + TypeScript)
```
frontend/src/pages/
├── Military.tsx + Military.css        ⚔️
├── Economy.tsx + Economy.css          📊
└── Government.tsx + Government.css    🏛️
```

### Dashboard Navigation
Aggiunti 3 nuovi link:
- 🗺️ World Map
- ⚔️ Military
- 📊 Economy
- 🏛️ Government

---

## 🖥️ DEPLOY SUL SERVER (STEP-BY-STEP)

### STEP 1: Connettiti al Server
```bash
ssh root@your-server-ip
```

### STEP 2: Vai nella Directory del Progetto
```bash
cd /root/republica-game
```

### STEP 3: Esegui Deploy Automatico
```bash
bash DEPLOY_NOW.sh
```

**Lo script farà automaticamente:**
1. ✅ Pull delle ultime modifiche da Git
2. ✅ Stop dei container
3. ✅ Build dei nuovi container
4. ✅ Start dei container
5. ✅ Verifica dello stato

---

## 🧪 TESTING (DOPO IL DEPLOY)

### STEP 4: Esegui Test Automatici
```bash
bash TEST_DEPLOYMENT.sh
```

**Lo script testerà:**
- ✅ Stato containers (backend, frontend, postgres)
- ✅ API endpoints (health, military, economy, governance)
- ✅ Tabelle database (10 nuove tabelle)
- ✅ Frontend accessibilità
- ✅ Backend logs per errori

**Output atteso:**
```
🎉 ALL TESTS PASSED!
Tests Passed: 20+
Tests Failed: 0
```

---

## 🎮 TESTING MANUALE FEATURES

### Test 1: Military System ⚔️
```bash
# Apri browser
http://your-server-ip:3000/military

# Test:
1. Seleziona una città
2. Train 10 Infantry (costa: 500 food, 200 gold)
3. Verifica che le unità appaiano
4. Controlla tab "Battles" e "Alliances"
```

### Test 2: Economy System 📊
```bash
# Apri browser
http://your-server-ip:3000/economy

# Test:
1. Crea una Trade Route tra due città
2. Imposta Resource: "food", Quantity: 10
3. Controlla tab "Auto Orders"
4. Visualizza Tax Settings
```

### Test 3: Government System 🏛️
```bash
# Apri browser
http://your-server-ip:3000/government

# Test (richiede level 5+):
1. Proponi una policy
2. Vota su policies esistenti
3. Controlla Government Positions
4. Visualizza Impeachment votes
```

---

## 📊 VERIFICA DATABASE

```bash
# Controlla che le nuove tabelle esistano
docker compose -f docker-compose.production.yml exec postgres \
  psql -U gameuser -d republicadb -c "\dt"

# Dovresti vedere:
military_units
battles
alliances
trade_routes
auto_orders
tax_settings
policies
policy_votes
government_positions
impeachment_votes
```

---

## 🔧 TROUBLESHOOTING

### Problema: Containers non partono
```bash
# Check logs
docker compose -f docker-compose.production.yml logs

# Rebuild
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml build --no-cache
docker compose -f docker-compose.production.yml up -d
```

### Problema: Errori nel backend
```bash
# Check backend logs
docker compose -f docker-compose.production.yml logs backend -f

# Restart backend
docker compose -f docker-compose.production.yml restart backend
```

### Problema: Frontend 404
```bash
# Check frontend logs
docker compose -f docker-compose.production.yml logs frontend

# Rebuild frontend
docker compose -f docker-compose.production.yml build frontend
docker compose -f docker-compose.production.yml up -d frontend
```

### Problema: Database non connette
```bash
# Check DB variables
docker compose -f docker-compose.production.yml exec backend env | grep DB

# Check postgres logs
docker compose -f docker-compose.production.yml logs postgres
```

---

## ✅ CHECKLIST FINALE

Prima di dichiarare il deploy completo, verifica:

- [ ] Tutti i container sono "Up" (3/3)
- [ ] Backend API risponde su porta 5000
- [ ] Frontend accessibile su porta 3000
- [ ] 10 nuove tabelle nel database
- [ ] Pagina /military carica senza errori
- [ ] Pagina /economy carica senza errori
- [ ] Pagina /government carica senza errori
- [ ] Link nel Dashboard funzionano
- [ ] Nessun errore nei logs backend
- [ ] Console browser senza errori

---

## 🎉 SUCCESSO!

Se tutti i test passano, **FASE 3 È COMPLETA**!

Il gioco ora include:
- ⚔️ Sistema militare completo
- 📊 Economia avanzata
- 🏛️ Governance e politica
- 🗺️ World map interattiva
- 📱 Real-time updates (WebSocket)
- 🔔 Sistema notifiche

**Pronto per giocare!** 🚀

---

## 📞 SUPPORT

Se hai problemi:
1. Controlla i logs: `docker compose -f docker-compose.production.yml logs -f`
2. Verifica le variabili d'ambiente nel `.env`
3. Assicurati che le porte 3000, 5000, 5432 siano aperte
4. Riavvia i container se necessario

---

**Data:** 2024
**Fase:** 3 (Military + Economy + Governance)
**Status:** ✅ READY TO DEPLOY
