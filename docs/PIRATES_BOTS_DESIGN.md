# Republica — Documento di Design: Pirati, Bot e Mondo Vivo

**Versione:** finale per publisher · **Autore:** Lead Game Design · **Data:** 2026-06-23
**Scope:** rendere Republica avvincente colmando il vuoto PvE/PvP e il "server vuoto", riusando l'infrastruttura esistente. Tutte le proposte sono filtrate dal panel di design e dalla critica avversariale (exploit, bilanciamento, costo-server): qui resta solo ciò che sopravvive, già corretto.

---

## 1. Diagnosi — perché oggi il gioco rischia di sembrare vuoto e piatto

1. **Il ramo bellico è codice morto e irraggiungibile.** Il motore di combattimento `POST /api/military/attack` (RPS, plunder, `Battle`, notifica, activity) è completo ma **nessun file frontend lo invoca**, idem per tutto lo spionaggio (`/api/espionage/*`). Verificato: il `grep` su `frontend/src` non trova alcun chiamante. Mura, torri, eserciti e ricerca militare non servono a nulla.

2. **Non esiste PvE: senza umani online il mondo è inerte.** Nessun attore attacca, commercia o si candida da solo. In un mondo a bassa popolazione il mercato mostra "No listings available", la chat è muta, la leaderboard è rada, nessuno è attaccabile. Manca del tutto il loop *"qualcosa è successo mentre eri via"*.

3. **I fili di retention sono staccati per bug, non per assenza di feature.** Tre esempi confermati nel codice:
   - `routes/military.js:373` invia notifica `type: 'BATTLE'`, **non presente** nell'ENUM di `models/Notification.js` (che ha `BATTLE_ATTACK`/`BATTLE_DEFENSE`). `Notification.create` lancia, l'errore è ingoiato in silenzio da `services/notificationService.js:27` → l'allarme "sei sotto attacco" (suono + flash rosso, già cablati in `NotificationBell.tsx`) **non parte mai**.
   - Il funnel di progressione è spento: `POST /quests/progress` non è chiamato da nessuna parte → le daily quest restano 0/N, e `claim` (unico chiamante di `addExperience`) non si raggiunge mai.
   - Achievement valutati solo all'apertura della pagina; countdown congelati; nessun feedback realtime.

4. **Bug del doppio tick di produzione.** `City.tsx:118` chiama `POST /cities/:id/update-production` ogni 60s **in più** allo scheduler, con formula diversa: chi tiene la pagina aperta accumula ~2x. Va corretto **prima** di introdurre qualsiasi raid pesato sulla ricchezza, altrimenti i dati risorse sono iniqui.

> **Tesi di design:** non dobbiamo inventare contenuti, dobbiamo **riattaccare i fili morti** e **popolare il mondo con attori NPC** (pirati + bot) sulle rotaie già esistenti (scheduler, `military/attack`, `WorldEvent`, `notificationService`, market). Il valore è concentrato in pochi fix da una riga + un solo refactor abilitante + una versione canonica per ogni sistema.

---

## 2. La spina dorsale "Pirati" — il motore di tensione PvE

I pirati sono il **"meteo bellico"** del mondo: una minaccia ambientale che attacca anche quando non c'è nessun umano, dà uno sbocco difensivo all'esercito e crea il loop di ritorno quotidiano (difesa → bottino → rivalsa). È UNA sola feature canonica (le 5 lenti la proponevano 3 volte: si implementa una volta).

### 2.1 Come funziona end-to-end

**Bootstrap (idempotente, seed-once per world).**
- Aggiungere `User.isBot` (BOOLEAN) — oggi assente, confermato. Migrazione unica con tutti gli ALTER (vedi §5).
- `backend/services/botSeeder.js` (sul modello config-driven di `routes/npcMerchant.js`): per ogni world crea attori NPC come normali righe `User`+`City`+`MilitaryUnit`. Due archetipi pirata: **covo corsaro** (mura/torri alte, guarnigione robusta, bottino alto) ai bordi mappa. Guard `seed-once` perché il seeder gira al boot.
- Compaiono automaticamente in `GET /cities/world` (già consumato da `WorldMap.tsx`) e vanno **esclusi** da `leaderboard.js` e dallo scaling player-count (`where isBot:false`).

**Refactor abilitante (una volta sola).**
- Estrarre la math di battaglia da `routes/military.js` (~196-325) in `backend/services/combat.js` → `resolveBattle({attackerCity, defenderCity, units, attacker, defender}, {transaction})`. Funzione pura con **transaction opzionale**: la route passa la sua, lo scheduler crea la propria con `SELECT ... FOR UPDATE` sul difensore. Chiude l'anti-pattern "route in transazione, scheduler no" e la race plunder con attacchi umani concorrenti.

**Tick raid (DEDICATO, mai dentro il loop produzione 60s).**
- Nuovo `this.raidInterval = setInterval(() => this.processPirateRaids(), 10*60*1000)` in `GameScheduler.start()` (accanto agli altri 5 interval, `scheduler.js:24-45`), **con flag `isRunning`** anti-reentrancy (`setInterval` non aspetta la promise).
- Itera i world col pattern già usato (`City.findAll({attributes:['worldId'], group:['worldId']})`). Per ogni world: gate probabilità **scalato sugli online** (`chance = base * clamp(1.5 - online*0.1, 0.2, 1.5)`), cap raid attivi/world.
- **Fase MARCIA:** crea il raid con `arrivesAt = now + 10-20 min`, `targetCityId`, colonna `status` come guard anti-doppia-risoluzione. **Non risolve subito.** Notifica immediata al difensore `BATTLE_ATTACK` (allarme + flash) + emit `io.to('world-${id}').emit('pirate-raid', {...arrivesAt})` per banner/marker.
- **Fase IMPATTO** (passata successiva, `arrivesAt<=now`): `resolveBattle` in transazione dedicata → `Battle.create` (appare in `GET /military/battles` e nei W/L del Profile senza codice frontend), plunder verso il covo, `logActivity('battle')`, notifica esito.

**Agganci reali al codice:** `military.js` (attack/Battle/plunder), `combat.js` (nuovo), `scheduler.js` (tick + iterazione world già pronta), `notificationService` (allarme), `logActivity`→`ActivityFeed`, `WorldMap.tsx` (marker), `EventsBanner.tsx` (banner, basta aggiungere l'icona 🏴‍☠️).

### 2.2 Counterplay & anti-frustrazione (load-bearing — senza questi i pirati cacciano i giocatori)

La critica di bilanciamento ha identificato il **rischio #1 non tecnico**: punire gli offline. Recepito integralmente.

- **Preferire bersagli ONLINE, non offline.** La finestra di marcia (10-20 min) e l'addestramento istantaneo sono counterplay **solo per chi è connesso**. I raid pesanti vanno a chi può giocare la difesa. Agli offline solo eventi miti (blocco/embargo) **senza plunder pesante**.
- **Gate raid robusto:** `level>=5` **AND** `protectedUntil` scaduto **AND** soglia minima di popolazione/esercito. Disaccoppia lo scudo-72h dal gate-livello (con le nuove fonti XP un nuovo player supera il livello 5 in 1-2 giorni con città minuscola).
- **No spirale di fame:** **non** plunderare il cibo sotto una soglia di sicurezza (oggi `food<10` → `happiness -5/tick`, recupero `+1/tick` solo se `food>100`). Cap plunder **totale giornaliero per città** (es. 40%/giorno), non solo per-raid. Recupero happiness garantito post-raid.
- **Addestramento resta istantaneo** (è la difesa nei 10 min): **non** introdurre code build/train ora (vedi §4, tagliato).
- **Race-safe:** transazione propria con row-lock sul difensore; mai dentro `updateCityProduction`.

### 2.3 Il loop di rivalsa: Taglie & Caccia ai Pirati (sblocca il PvP reale)

Il covo che ti ha razziato diventa **il primo bersaglio attaccabile** del gioco. È il punto in cui `POST /military/attack` ottiene finalmente un chiamante frontend.

- **Pannello attacco su `WorldMap.tsx:187`** (oggi inerte per le città altrui, solo "Close"): per `city.userId !== user.id` aggiungere **Attacca / Spia / (poi) Rinforza**. Modal composizione: `GET /military/city/:myCityId` per le unità, poi `POST /military/attack {attackerCityId, defenderCityId, units}`. Battle report nel modal risultato. Validazione `units{}` **client e server**.
- **Ricompensa ZERO-SUM (correzione critica anti-faucet):** il bottino recuperabile dal covo è **solo le risorse effettivamente razziate** e depositate lì → recuperare non può **mai** superare quanto perso. **Niente bounty floor garantito, niente crediti/XP coniati per-partecipante.** Diminishing returns sui colpi ripetuti + cooldown per-covo e per-attaccante, così il covo allena ma non è un farm di XP/crediti (`addExperience` è di fatto l'unico path XP: un covo farmabile banalizzerebbe tutto il leveling).
- **PvE < PvP per-effort:** il loot PvE deve rendere meno del plunder PvP, così il PvE è la palestra e il PvP umano resta l'endgame (evita che il PvE safe/ripetibile eclissi il PvP rischioso — paura esplicita del brief, confermata dalla critica).

### 2.4 Perché è divertente

Genera le due emozioni oggi assenti: **anticipazione** ("sta arrivando, ho 15 minuti") e **minaccia** ("qualcosa è successo mentre ero via"). Trasforma la difesa passiva in offensiva gratificante (vendetta + recupero del *tuo* bottino), dà finalmente scopo a mura/torri/esercito, e fa funzionare l'allarme sensoriale già costruito. Tutto su rotaie esistenti.

---

## 3. I "Bot" che riempiono il mondo

### 3.1 Bot economico — Banco di Republica (mercato sempre vivo)

Cura la schermata "No listings available" che uccide i mondi a bassa pop. Un `User`+`City` NPC riservato per world quota **sempre** bid/ask.

- **Tick** ogni 5 min, **con `isRunning` guard**. Per ogni risorsa pubblica ASK (`Market.create`) a `fair*(1+spread)` e BID (`AutoOrder buy`) a `fair*(1-spread)`. I player comprano via l'esistente `POST /market/buy/:id` (zero codice nuovo).
- **Integrità prezzo (correzioni critiche anti-manipolazione):**
  - Il **fair** è ancorato a un **EMA di prezzi di TRADE ESEGUITI** (VWAP), **escludendo le listing del bot stesso**, con reiezione outlier e clamp. **Non** all'AVG degli ask attivi (oggi `snapshotMarketPrices` media gli ask → loop auto-referenziale che fa derivare i prezzi).
  - **Inventario e budget FINITI per tick** (obbligatori: senza, lo spread è una stampante di crediti).
  - **Update-in-place** delle quote, **non** cancel+ricrea ogni tick (altrimenti storm di INSERT/UPDATE su `Market` + `cache.delPattern('market-listings:*')` ad ogni create, ogni 5 min, per sempre). Un **solo emit aggregato**, non un `new-market-listing` per quota.
- **Una sola sorgente prezzo per tutti gli NPC:** lo stesso `fair` alimenta anche `GET /merchant/prices` (oggi `NPC_PRICES` costante hardcoded in `npcMerchant.js:10-17`). **Ritirare o unificare** il merchant a prezzo fisso, altrimenti arbitraggio risk-free tra due NPC desincronizzati.

### 3.2 Motore di matching AutoOrder (il book che finalmente si riempie)

Oggi `AutoOrder.filled` resta 0 per sempre (nessun tick lo tocca). È la dopamina dell'ordine eseguito mentre eri via, e rende **consumabili** le quote del Banco.

- Estrarre la logica di `POST /market/buy/:id` (`market.js:118-222`: transazione + lock + trasferimento) in `executeMarketBuy(...)` riusabile. Nuovo tick `processAutoOrders()` (riusa `contractInterval`), con `isRunning`.
- **Correzioni critiche:** **escrow** crediti (buy) / risorse (sell) alla creazione ordine; aggiungere colonna `worldId` e **scoping per world** al matching (oggi `AutoOrder` non ha worldId → matching cross-world); **preservare il guard self-deal** `sellerId !== buyer`; indici su `AutoOrder(resourceType, active, worldId)` e `Market(worldId, resource, status, pricePerUnit)`; cap N match/tick. Feedback `MARKET_BOUGHT`/`MARKET_SOLD` (enum già presenti).

### 3.3 Rivali NPC — città sulla mappa (server vivo)

- **Città NPC** (neutrali deboli = palestra; corsare forti = sfida) seedate dal `botSeeder` con `MilitaryUnit` reali (altrimenti l'attacco è banale). Compaiono in `WorldMap` e nella leaderboard (esclusi dal ranking reale via `isBot`). Distinguibili con classe marker/legenda in `WorldMap.tsx`.
- **Rivali alle urne — GIÀ IMPLEMENTATO, non reinventare.** Verificato in `scheduler.js`: `ensureNpcCandidates` (riga 671), `seedNpcCitizenVotes`, `createElectionFever`, `processApprovalRatings` (riga 48) iniettano candidati/voti NPC con peso battibile. **È tuning, non una nuova feature** (non assegnarle effort M). Prerequisito prima di dare agli NPC qualsiasi leva politica: **fixare il guard di voto per-utente sull'impeachment** (oggi un account lo fa passare da solo) e ricordare che la governance è in gran parte cosmetica (Policy.effects/tax/ban inerti) → non vale la pena potenziare gli NPC politici finché le policy non hanno effetti reali.

### 3.4 AI Director (densità scalata sugli online)

Una sola manopola condivisa: legge l'online-count per world dalla presence Map (`server.js`, `onlineUserIdsInWorld()` → esporre via `app.set`), e scala frequenza raid, liquidità mercato NPC e chatter ambientale. Mondo vuoto → bot alzano il volume; mondo pieno → si fanno da parte (più PvP, meno rumore). **I bot non contano nello scaling** (no inflazione via alt).

---

## 4. Altre aree di miglioramento (engagement / onboarding / endgame)

**Tenere (cheap, alto ROI):**
- **Fix sensory layer (P0, 1 riga):** `military.js:373` `'BATTLE'` → `'BATTLE_ATTACK'`/`'BATTLE_DEFENSE'`. Inoltre **rendere non silenzioso** `notificationService.send` (loggare/validare il type invece di ingoiare l'errore al `catch` riga 27). Attivare i type già mappati ma mai inviati: `LEVEL_UP`, `CITY_HAPPINESS` (gate su attraversamento soglia, non ogni tick), `ELECTION_NEW`, `MARKET_BOUGHT`.
- **Wiring Daily Quest (P0):** chiamare l'helper progress **in-process (mai via HTTP)** da build/train/sell/buy/research, una sola volta per transazione committata. **Bloccare/non esporre `POST /quests/progress` come rotta client** (oggi si fida di `{questType, target, amount}` dal client → faucet diretto una volta che il claim paga). Emit `quest-completed` per il refetch realtime.
- **Achievement realtime (P1):** `checkAndGrantAchievements` è già esportato; chiamarlo best-effort dopo build/battle/trade/research → toast + suono. Aggiungere i `checkFn` mancanti (`first_build`, `first_election`, `win_election`, `all_research`).
- **Countdown vivi + ticker mercato (P1, solo frontend):** `setInterval(1000)` su `EventsBanner.getTimeLeft` e `DailyQuests.expiresIn`; consumare `new-market-listing`/`market-transaction` (già emessi, oggi senza listener) per un ticker live + radar arbitraggio. Costo server zero.
- **Onboarding reward-chain (P1):** `PUT /api/auth/tutorial` accredita oro+XP per step (con flag anti-doppio-claim su `User.tutorialCompleted`), aggancia gli step alle quest ora funzionanti, mostra barra scudo novizio. Sostituire gli `alert()` con `ToastContext`.

**Endgame cooperativo (scommessa, solo dopo aver indurito il PvE):**
- **Armata Corsara — World Boss a HP condivisi (UNA versione, la coop):** spawn schedulato per-world, HP scalati sui **player reali distinti** (non bot, non alt/stesso-IP), barra live, contributo tracciato, loot **da pool finito pre-seedato** (non coniato per-capita), **cooldown per-UTENTE non per-città** (chiude il bypass multi-città dei whale), **decremento HP atomico**, **cadenza/payoff persistiti in DB e idempotenti** (un riavvio scheduler non deve raddoppiare i premi). Affiancabile a **Sforzo Bellico** (donazioni opt-in, milestone → buff `WorldEvent`, dà ruolo ai pacifici e collega economia↔guerra).

**Tagliato / rinviato (con motivo):**
- **CUT — Saga narrativa (XL, P3):** dipende da tutto il resto + authoring. Fuori scope.
- **DEFER — Carovane razziabili (Convoy):** nuovo modello + travel-time + race tra tick; la UI rotte oggi è "incolla un UUID nel prompt" (inutilizzabile). Il commercio teletrasporto funziona; non vale il rischio finché Banco/AutoOrder non sono stabili. **Intanto blindare `TradeRoute`** (toCity stesso owner/alleanza, stesso world, cap qty su produzione) per evitare che diventi una pipe gratis tra alt.
- **DEFER — Code build/train a tempo:** **rompono il counterplay anti-raid** (addestramento istantaneo è la difesa nei 10 min) e cambiano il pacing core; richiedono migrazione. Riprendere solo dopo il fix del doppio-tick, esentando unità difensive/lotti piccoli.
- **DEFER — Shock economici/embargo:** amplificano oscillazioni su un mercato fragile (pump&dump) finché il Banco non è ancorato a trade eseguiti e clampato.
- **DEFER/REDESIGN — Mentorship & Nemesis & Stagioni/Ladder:** macchine multi-account (controlli entrambi i lati) o dipendenti da fonti-punteggio farmabili. Solo con anti-alt hard (IP/device, età account, pool finito).

---

## 5. Roadmap prioritizzata (3 ondate)

### Onda 1 — Quick wins P0 (questa settimana): riattacca i fili + baseline anti-abuso
*Quasi zero costo server, sbloccano interi loop morti. Prerequisiti di tutto il resto.*

| # | Intervento | Effort | File / Endpoint |
|---|---|---|---|
| 1 | Fix ENUM notifica `BATTLE`→`BATTLE_ATTACK/DEFENSE` + non-silenziare il catch | **S** | `routes/military.js:373`, `services/notificationService.js:27` |
| 2 | Attivare type notifica inerti (LEVEL_UP, CITY_HAPPINESS gated, ELECTION_NEW, MARKET_BOUGHT) | **S** | `routes/achievements.js`, `scheduler.js`, `routes/politics.js`, `routes/market.js` |
| 3 | Wiring Daily Quest in-process + **lock rotta `/quests/progress`** | **M** | `routes/quests.js`, `cities.js`(build), `military.js`(train), `market.js`(sell/buy), `research.js` |
| 4 | **Fix doppio-tick produzione** (rimuovere/no-op client `update-production`) | **S** | `frontend/.../City.tsx:118`, `routes/cities.js:272` |
| 5 | Countdown vivi + ticker mercato live (consumano emit già esistenti) | **S** | `EventsBanner.tsx`, `DailyQuests.tsx`, `Market.tsx` |
| 6 | Baseline anti-multi-account: price-band/`maxPricePerUnit` su market sell, throttle registrazione per-IP, clawback world-bank | **M** | `routes/market.js`(sell validator), `routes/auth.js:15`, `routes/banking.js:34` |
| 7 | Igiene tick produzione: togliere JOIN User inutilizzata + valutare `bulkUpdate` vs `city.save()` seriale | **S** | `services/scheduler.js:97-111` |

### Onda 2 — Sistemi core P1: i Pirati e il Mercato Vivo
*Il contenuto vero. Dipende dall'Onda 1.*

| # | Intervento | Effort | File / Endpoint |
|---|---|---|---|
| 8 | `User.isBot` + migrazione ENUM **consolidata** (tutti gli ALTER in una) + `botSeeder.js` idempotente (seed-once) | **M** | `models/User.js`, `apply-migration.js`, `services/botSeeder.js`, `leaderboard.js`(escludi bot) |
| 9 | Estrarre `resolveBattle` in `services/combat.js` (transaction opzionale, row-lock difensore) | **M** | `routes/military.js:196-325` → `services/combat.js` |
| 10 | Città NPC su mappa (neutrali + corsare) con unità reali | **M** | `botSeeder.js`, `routes/cities.js:145`(attr isBot), `WorldMap.tsx` |
| 11 | **Tick Pirate Raid canonico** (dedicato ≥10 min, `isRunning`, marcia/impatto, anti-frustrazione §2.2, scaling online) | **L** | `services/scheduler.js`(start + processPirateRaids), `combat.js`, `notificationService`, `logActivity` |
| 12 | **Pannello Attacca/Spia/Rinforza** su WorldMap (primo chiamante di `/military/attack`) | **M** | `WorldMap.tsx:187`, `GET /military/city/:id`, `POST /military/attack`, `POST /espionage/send` |
| 13 | Taglie/Caccia covo con loot **zero-sum** + diminishing returns + cooldown | **M** | `combat.js`, `military.js`, `GET /military/bounties`(nuovo) |
| 14 | **Banco market-maker** (fair=VWAP trade eseguiti escl. self, inventario/budget finiti, update-in-place, emit aggregato) | **M** | `services/scheduler.js`, `routes/market.js`, `routes/npcMerchant.js`(unifica/ritira fisso) |
| 15 | **Matching AutoOrder** (escrow, worldId scope, self-deal guard, indici) | **M** | `services/scheduler.js`, `routes/economy.js`, `routes/market.js`(`executeMarketBuy`) |
| 16 | Achievement realtime + reward-chain onboarding | **M** | `routes/achievements.js`, `routes/auth.js:138`, `GameEventListener.tsx`, `TutorialOverlay.tsx` |
| 17 | AI Director (densità scalata su online reali) | **M** | `server.js`(esporre presence count), `scheduler.js` |
| 18 | Batch `sendToWorld` (`bulkCreate` + singolo emit) | **S** | `services/notificationService.js:32` |

### Onda 3 — Scommesse P2/P3 (solo dopo indurimento PvE/anti-alt)

| # | Intervento | Effort | File |
|---|---|---|---|
| 19 | Armata Corsara World Boss coop (HP condivisi, cooldown per-utente, loot da pool finito, cadenza/payoff DB-persistiti idempotenti) | **L** | nuovo `models/PirateArmada.js`, `scheduler.js`, `combat.js`, `routes/military.js`, `WorldMap.tsx` |
| 20 | Sforzo Bellico (donazioni opt-in, milestone→buff WorldEvent) | **M** | `routes/crisis.js`(nuovo), `scheduler.js`, `WorldEvent` |
| 21 | Tuning Rivali NPC alle urne (già implementato) + fix guard impeachment per-utente | **S** | `scheduler.js:671+`, `routes/governance.js` |
| — | **CUT:** Saga (XL/P3) · **DEFER:** Carovane, Code build/train, Shock/embargo, Mentorship, Nemesis, Stagioni/Ladder | — | vedi §4 per motivazioni |

---

## 6. Rischi & metriche

### Metriche (strumentare prima dell'Onda 2)
- **Retention D1 / D7** — KPI nord. Target: D1 +X% dopo Onda 1 (loop quest + onboarding riattivati), D7 dopo Onda 2 (raid danno motivo di ritorno).
- **Azioni/giorno per utente** (build, train, attack, trade, quest-claim) e **% utenti che attaccano almeno 1 volta** (oggi ~0, sblocca col pannello attacco).
- **Sessioni/giorno e durata media**; **time-to-first-combat** del nuovo player.
- **Salute mercato:** % tempo con ≥1 listing attiva per risorsa (target ~100% col Banco), volume di trade *eseguiti* (non ask).
- **Segnali di frustrazione:** churn dopo primo raid subito, % città in spirale di fame, rapporto plunder-subìto/produzione.
- **Sanità economica:** crediti totali coniati/giorno (deve restare piatto: i reward sono zero-sum), distribuzione crediti per-account (spike = laundering).

### I 3 rischi principali

1. **Faucet via multi-account (il rischio più grave).** Registrazione aperta + 1000 crediti iniziali + mercato senza tax/price-cap = ogni reward per-capita è un rubinetto moltiplicabile con gli alt.
   **Mitigazione:** **baseline anti-alt in Onda 1** (price-band su sell, throttle/email-verify, clawback world-bank); **tutti** i reward pirata/boss/taglia **zero-sum o da pool finito** (mai coniati per-partecipante); bounty = solo risorse realmente razziate, niente floor; `isBot` e cluster stesso-IP esclusi da scaling e loot-share.

2. **I pirati cacciano i giocatori invece di intrattenerli.** Punire gli offline + spirale di fame + recupero post-raid lento = abbandono.
   **Mitigazione (§2.2, non negoziabile):** preferire bersagli **online**; cap plunder giornaliero per città; **non** plunderare cibo sotto soglia; recupero happiness garantito; gate raid per livello **e** dimensione; PvE per-effort < PvP perché il PvE non eclissi il PvP.

3. **Costo-server e race da proliferazione di tick.** `setInterval` non aspetta la promise; lo scheduler è già a 847 righe e 5 tick; il Banco e l'AutoOrder sono i più costosi.
   **Mitigazione:** ogni nuovo tick con **flag `isRunning`**; raid/strike in **transazione propria con row-lock** (mai dentro il loop 60s); Banco **update-in-place + emit aggregato**; `sendToWorld` **batchato**; **una sola** migrazione ENUM; consolidare i tick world-iterating riusando il pattern `group by worldId` esistente.

---

*Principio guida per il team: una sola versione canonica per ogni sistema (un raid, un boss, un refactor `resolveBattle`, un `isBot`+seeder, un fix ENUM), reward sempre zero-sum, e ogni nuova scrittura DB dietro guard di concorrenza. Spedire l'Onda 1 questa settimana sblocca il 70% del valore percepito a costo quasi nullo.*