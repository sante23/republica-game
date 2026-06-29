# Roundtable Republica — Verbale & Piano d'Azione
*Sintesi del moderatore · 6 designer al tavolo · sprint di questa settimana*

---

## 1. Verbale lampo

> **Blind Playtester:** "La mia prima quest si è bloccata a 0/2 e ho smesso di fidarmi del gioco in 3 minuti. `POST /quests/progress` non ha *un solo* chiamante in tutto il repo."
> **Live-ops:** "Quella quest morta è la feature più DANNOSA che avete — peggio di non averla. Una quest ferma insegna al giocatore che il gioco mente, e dopo non ti crede più nemmeno quando funzioni."

> **Blind Playtester:** "E comunque l'orologio mente: la barra promette `+X/h` ma ogni 60s salta su di un'ora intera."
> **Economy:** "Confermato a codice. Lo scheduler somma la produzione PIENA per tick, il client interpola a `/3600`. È un 60x. È UPSTREAM di tutta la mia tesi sulla scarsità: finché l'orologio mente, nessun sink raggiungerà mai il faucet. Si fixa **prima** di ogni altra cosa economica."
> **UX:** "È la bomba sotto la mia sedia. Il mio fiore all'occhiello — interpolazione + flash verde — sta renderizzando una bugia 60x e il flash scatta come spam ad ogni tick."

> **PvP:** "Ho allenato 200 cavalieri e... non c'è un bottone per attaccare. `/military/attack` è un endpoint orfano, chiamabile solo via curl. E quando l'ho colpito a mano, la guerra è finita in 40ms: niente marcia, deterministico al 100%. Ho 'vinto una guerra' e la WorldMap era identica. Mi sento un contabile con le bandierine."
> **PvP (boldIdea):** "Rendiamo la mappa mutabile: marce reali sulla griglia x/y, allarme incoming-attack, città conquistabili per lealtà."
> **Live-ops (sfida secca):** "In un mondo a 3 player, la conquista-per-lealtà significa che gli unici 3 umani perdono la città nel sonno. Per un F2P perdere il save è il peggior evento di churn che esista."
> **UX (rincara):** "L'allarme suona quando il bersaglio dorme. Travian regge perché ha mille fusi sovrapposti; qui è la macchina perfetta per far rage-quittare gli unici 3 umani veri."

> **Social/Narrative:** "Ho vinto le elezioni e la corona è di gommapiuma. Il `/mayor/boost` va in 500 — crea un `WorldEvent type:'mayor_boost'` che l'ENUM non contiene, con `name:` invece di `title:`. Il `/mayor/ban` è una bugia: scrive solo nell'activity feed. GOVERNOR e PRESIDENT promettono poteri che in codice non esistono."
> **Economy (avvertimento):** "Ma occhio: dare a un eletto il controllo dei prezzi NPC, che hanno liquidità infinita, è una stampante di credito *col mandato*. La leva politica dev'essere una banda ±X%, mai controllo assoluto, e SOLO dopo aver tappato i faucet."

> **Blind Playtester (hot take che ha spostato il tavolo):** "Republica non è un MMO: è un idle single-player travestito da MMO. L'unica prova che esistano altre persone sono le elezioni — e quelle persone sono bot. Smettete di aspettare una popolazione che non arriverà: fate dei bot IL gioco."
> **Convergenza finale (4 voci su 6, indipendenti):** Economy + PvP + Live-ops + Blind atterrano sullo **strato PvE di raid schedulati**. *"Quando quattro esperti ci arrivano senza parlarsi, è il segnale più forte del tavolo."* (Live-ops)

---

## 2. Cosa FUNZIONA (tenere e amplificare)

| Pezzo | Perché è il modello da copiare |
|---|---|
| **Resource bar viva** (`useTickingResources` + socket `production-update` su room `city-<id>`) | Tutti la citano come il miglior game-feel del progetto: interpolazione a 250ms + ri-ancoraggio sul tick + flash verde. È il battito del gioco. *Da amplificare ovunque, non solo Navbar/City* — ma sta renderizzando una bugia 60x (vedi §3.1). |
| **Mercato spot `/buy`** (`routes/market.js`) | L'unico pezzo di economia davvero solido e race-safe: lock di riga su listing+buyer+seller, trasferimento atomico, status SOLD, emit `market-transaction` + notifica + `logActivity`. **Usalo come template per ogni nuovo flusso economico.** |
| **Overhaul Elezioni** (NPC che riempiono le schede + ticker live + Election Fever) | Consenso unanime: è la cura già dimostrata per il "mondo vuoto". `ensureNpcCandidates`, `seedNpcCitizenVotes`, `emitTally → 'election-vote'`, buff `festival` reale agganciato alla finestra di voto. **È la tecnologia da trapiantare** su mercato, crisi co-op, raid. |
| **Strato sensoriale notifiche** (`NotificationBell.tsx`: `SOUND_BY_TYPE`, pulse badge, redFlash su `BATTLE_ATTACK`) | Game-feel da F2P serio. Il problema non è la qualità, è che lo nutrite poco: metà dei suoni mappati non viene mai spedita dal backend. |
| **Sasso-carta-forbice unità + saccheggio dinamico** (`military.js`) | infantry>archer>cavalry con ±25/-20% sulla composizione reale; plunder 5-35% scalato su mura/livello. Ottima base economica di guerra: fonte per l'attaccante, sink per il difensore. Manca solo renderlo visibile e raggiungibile. |
| **Campaign spending come credit-sink** (`0.9*sqrt(spesa)`, cap 50) | Diminishing returns onesti, tattica non portafoglio. È l'unica leva anti-pay-to-win e va protetta spegnendo la stampante di credito (che la rende inutile). |
| **Produzione offline reale** (scheduler tick per tutte le città, batch da 100) | La base perfetta per il momento di rientro "Mentre eri via": le risorse maturano mentre dormi. Già pagata, va solo sfruttata. |

---

## 3. Cosa MIGLIORARE (prioritizzato)

### P0 — Le fondamenta mentono (consenso totale: 6/6)

**3.1 — Il bug 60x della produzione** *(la radice di tutto)*
- **Cosa:** `scheduler.js` (`updateAllCityProduction`, ~riga 156-157) somma la produzione ORARIA piena ad ogni tick da 60000ms (`city.resources[r] += production[r]`), mentre `useTickingResources.ts:48` interpola a `production/3600` al secondo. **Scarto ~60x.** Ogni etichetta `+X/h`, ogni claim economico, ogni sessione di rientro mente.
- **Fix:** una sola verità. Nel tick usare `production[r] * elapsedSec/3600`, e nel socket `production-update` emettere **lo stesso rate** che il client interpola. (Alternativa: rietichettare tutto a `/tick`, ma il tavolo preferisce coerenza con `+X/h`.)
- **Chiamata:** non-negoziabile, settimana 1, prima di toccare qualsiasi numero economico.

**3.2 — Daily Quest scollegate** *(Live-ops: "la feature più dannosa del gioco")*
- **Cosa:** `POST /quests/progress` (`routes/quests.js:62`) non ha **un solo chiamante** in tutto il repo (verificato). Le quest restano a `0/required` per sempre.
- **Fix:** estrarre `services/questService.bump(userId, type, target, amount)` e invocarlo nei punti reali: build in `cities.js`, vendita/acquisto in `market.js` + `npcMerchant.js`, train in `military.js`, ricerca in `research.js`, tipi `accumulate` nello scheduler dopo `updateCityProduction`. Emettere socket `quest-progress` alla room `user-<id>` per l'update live.

**3.3 — `/mayor/boost` crasha in 500** *(trovato da TUTTI e 5 — il bug più citato)*
- **Cosa:** `governance.js:~422` crea `WorldEvent { type:'mayor_boost' }` (non nell'ENUM di `WorldEvent.js:15`) con `name:` invece di `title:` (notNull). Doppio validation error → rollback. Il cooldown legge `lastBoostAt` che non viene mai scritto.
- **Fix:** aggiungere `'mayor_boost'` all'ENUM (migration `ALTER TYPE`) *oppure* riusare `type:'festival'`; `name:`→`title:`; persistere `lastBoostAt`. Dopo il commit emettere `io.to('world-<id>').emit('world-event', ...)` → civic theater, non stringa locale.

### P1 — Scarsità: senza, fixare l'orologio crea solo un runaway più lento

**3.4 — Nessun sink, la scarsità non esiste**
- **Cosa:** consumo piatto `{food:5, energy:3}` indipendente da popolazione/edifici (`models/City.js`); costi di build piatti (`buildingCosts` mappa fissa × quantity); nessun tetto di stoccaggio.
- **Fix (pacchetto):** (a) consumo scalato — `food ~ pop/200`, `energy ~ n.edifici`; (b) curva di costo OGame `cost * 1.5^count` con costo del prossimo livello mostrato nel bottone Build (`City.tsx`); (c) tetti di stoccaggio gated da warehouse, overflow sprecato + barra rossa a saturazione in `useTickingResources` (mappa `cap` + classe `.res-full`).
- **Sinergia obbligata:** i tre sink sono co-dipendenti (Economy + UX + Blind). Un cap è insignificante a inflazione 60x; una produzione onesta è noiosa senza un soffitto.

**3.5 — Stampante di credito infinita (World Bank)**
- **Cosa:** `routes/banking.js /world-bank` conia dal nulla; il default punisce solo con `-10` reputazione, ma la rep ha pavimento 0 e lo status `defaulted` libera il cap dei 3 prestiti. A rep 0 il default è GRATIS → coniare, defaultare, ripetere.
- **Fix:** gatekeeping su reputazione (tasso/plafond scalano con la rep; sotto soglia niente prestiti), bloccare nuovi prestiti con loan `defaulted` attivi, sequestro asset reale al default.

**3.6 — Feedback in discesa invisibile**
- **Cosa:** `useTickingResources.ts:29` flash solo in salita. Famine/Earthquake/consumo prosciugano food in silenzio.
- **Fix:** mappa `dropped` + classe `.res-drop` (rosso, freccia giù). L'allarme economico più importante deve VEDERSI.

### P2 — Sistemi morti da resuscitare o spegnere

**3.7 — AutoOrder / TradeRoute / fisco: tre sistemi morti**
- **Cosa:** `AutoOrder` creabile ma senza matching engine (`filled` resta 0 in eterno); `TradeRoute` non è nemmeno importato in `scheduler.js`; `TaxSettings`/`taxRate` alimentano solo l'approval, nessun tick raccoglie tasse.
- **Fix:** matchAutoOrders() nell'intervallo contracts (incrocia buy≥sell al prezzo del maker, logica lock-safe di `market.js`); executor TradeRoute (`quantityPerHour` da→a con costo energy/gold per distanza); Treasury per worldId che trattiene `taxRate%` del gold output, da cui pagare stipendi `GovernmentPosition` + poteri sindaco, con bancarotta.

**3.8 — L'oracolo dei prezzi è rotto** *(challenge dell'Economy a tutti)*
- **Cosa:** `snapshotMarketPrices` aggrega prezzi ASK degli **invenduti** (`status=ACTIVE`) e `volume` = somma quantità **invendute** — l'opposto del volume scambiato. Il grafico `/history/:resource` mostra il magazzino fermo, non il trade.
- **Fix:** registrare i **trade reali** (in `market.js /buy`, npcMerchant, contratti) in una tabella di tick; aggregare prezzo medio **ponderato per volume scambiato**.
- ⚠️ **Disaccordo risolto:** tutti vogliono l'NPC market-maker che drifta sull'`avgPrice`. **Chiamata mia: VIETATO ancorare l'NPC a `MarketHistory` prima di 3.8.** Inseguire un oracolo spazzatura crea uno spirale di prezzo runaway. Prima l'oracolo onesto, poi il drift.

**3.9 — Combattimento deterministico + nessun cooldown**
- **Cosa:** `military.js:246` fa `outcome = attackerPower > defenderPower`. Zero varianza + recon che rivela la potenza esatta = farming a rischio zero. Nessun cooldown, truppe mai in viaggio → spam di `/attack` svuota un bersaglio in secondi.
- **Fix:** roll RNG ±15% sulle potenze; perdite proporzionali al rapporto di forze (Lanchester) con perdite minime garantite al vincitore; stato "army in transit" + cooldown per coppia attaccante→bersaglio. *Bonus:* clampare il decrement a ≥0 (oggi un input gonfiato può portare quantità negative, `military.js:252-269`).

**3.10 — Codice morto pericoloso + effetti fantasma**
- **Cosa:** `/execute-election` (`governance.js:~560`) ordina per colonna `votes` inesistente, legge `winner.userId` inesistente e fa `Election.destroy` su TUTTO il mondo — una bomba. Effetti `populationGrowth`/`taxIncome` definiti nei template ma mai applicati (lo scheduler legge solo `*Production`/`happinessModifier`). `/mayor/ban` è pura finzione da activity-log. Scorecard valuta solo 3 promesse su 6.
- **Fix:** rimuovere `/execute-election` (`completeElection` è l'unica fonte di verità); applicare `populationGrowth` come moltiplicatore di `growthRate`; persistere il ban (tabella/JSONB) e farlo rispettare in `market.js`+`npcMerchant.js`; cablare le 3 promesse mute (`free_market`/`boost_production`/`fund_defense`).

> ⚠️ **Il grande disaccordo del tavolo — sequenza del PvP.** PvP vuole marce reali + conquista-per-lealtà come prima leva. Live-ops, UX e Blind hanno alzato un veto netto: con 3 player a fusi diversi, perdere la città offline = churn garantito. **Chiamata finale del moderatore:** la conquista-per-lealtà è la destinazione, **non** il punto di partenza. Si spedisce prima il **PvE raid** (popola la mappa di bersagli, accende il combattimento stasera), poi le **marce reali con UI + RNG**, e la conquista arriva **solo dopo** un design offline-safe (auto-richiamo, difese pre-impostate, finestra protetta) e **un costo di possesso/upkeep di occupazione** (challenge dell'Economy: senza, conquistare = concentrare produzione gratis e accelerare la spirale di morte).

---

## 4. Cosa INTEGRARE di nuovo (con sinergie, effort, impatto)

| # | Idea (e sinergia) | Effort | Impatto |
|---|---|---|---|
| **A** | **Strato PvE — Raid di banditi/pirati schedulati.** *La convergenza più forte del tavolo (Economy+PvP+Live-ops+Blind).* Estendi `generateWorldEvents` per pescare città sotto-difese e risolvere con il modello `Battle` esistente. **Sinergia tripla:** dà scopo all'esercito (Blind) + accende il redFlash `BATTLE_ATTACK` già cablato (UX/Live-ops) + crea il trigger di rientro "la tua città è sotto raid" (Live-ops). Riusa Battle, NotificationBell, room `city-<id>`. **Zero infra nuova.** | **M** | **XL** |
| **B** | **NPC Merchant come market-maker dinamico** che drifta su `MarketHistory` ponderata. *Cinque persone hanno indicato lo stesso file `npcMerchant.js:10`.* **Sinergia:** + President che piega lo spread ±banda (Social) + riga "umore del mercante" e ticker `price-shock` (UX). Una sola superficie risolve "merchant statico" + "cariche vuote" + "eventi decorativi". **Prerequisito: 3.8 (oracolo onesto).** | **M** | **L** |
| **C** | **Spoils of Office — la piattaforma vincente applica un modificatore nazionale vivo** via motore `WorldEvent`: Merchant Guild→prezzi scontati, Militarist→buff difesa (prepara i raid PvE), Populist→felicità, Tax Hawk→tesoro pieno/felicità giù. **Sinergia:** + Opposizione NPC che lancia scandali in `processApprovalRatings` (rende il recall a 5% finalmente raggiungibile) + ribbon civico persistente (UX) "Gilda al potere: -10% prezzi · mandato 3g 4h". È il primo pezzo in cui **vincere cambia qualcosa che gli altri SUBISCONO.** | **L** | **XL** |
| **D** | **Sessione di rientro "Mentre eri via"** — modale al login col delta da `User.lastLogin` (risorse maturate, vendite SOLD, attacchi subiti, esiti elezioni). `server.js` rileva già `wasOffline` e persiste `lastLogin`. **Sinergia:** + login streak/forziere riusando la reward pipeline di `quests.js` + raid PvE che popola il "cosa è successo". Il ponte D1→D2 più economico. *(Streak DOPO la scarsità, o premia valuta senza valore.)* | **S** | **L** |
| **E** | **Crisi di Stato — World Event co-op a barra-obiettivo condivisa** (es. "consegnate food al fondo di soccorso") che riusa il live-ticker delle elezioni. **Sinergia quadrupla:** lega WorldEvent + Contract + Notifiche + Politica (incumbent guadagna/brucia approval sull'esito). **Caveat del tavolo:** target che scala col n. di umani online + contributo-base NPC, altrimenti la barra mai-piena diventa la prova visiva del vuoto. **Solo POST-fix 60x e con caps.** | **L** | **L** |
| **F** | **Onboarding "Primi 90 minuti" — fai dei bot IL gioco.** Quest-line agganciata agli endpoint reali (build→vendi→combatti→vota) + micro-elezione cittadina a timer compressi (minuti, non 5 giorni) **sandboxata** come elezione di onboarding usa-e-getta + Living Government (NPC che tassa/premia davvero). **Sinergia:** raggruppa A (raid demo) + B (mercato vivo) + C (governo con conseguenze) nei primi 10 minuti. | **L** | **XL** |
| **G** | **Marce reali con ETA + UI d'attacco dalla mappa.** Bottone "Attacca" in `WorldMap.tsx` (oggi solo "Manage City") → modale unit-picker → `POST /military/attack` che NON risolve subito ma crea record `march` con `arrivesAt` risolto dallo scheduler + emit `incoming-attack`. **Sinergia:** + ribbon countdown (UX) + RNG ±15% (3.9). **Dopo PvE, e con design offline-safe.** | **L** | **L** |

---

## 5. Ship-first 5 (la classifica condivisa del tavolo)

1. **Fix dell'orologio 60x** — `scheduler.js` usa `production * elapsedSec/3600` e il socket emette lo stesso rate del client. *Razionale: 6/6 al tavolo lo mettono P0. Finché la barra mente, ogni sink, ogni flash, ogni numero economico e ogni claim di guerra è falso.*
2. **Cablare le Daily Quest + riparare `mayor_boost`** — `questService.bump()` chiamato nei punti reali; ENUM/`title:`/`lastBoostAt` sul boost; rimuovere la bomba `/execute-election`. *Razionale: spegnere le bugie prima di costruire. Una promessa rotta nella prima sessione avvelena tutto il resto.*
3. **Sink di scarsità** — consumo scalato (pop/edifici) + curva costo `1.5^count` + tetti di stoccaggio con barra rossa + flash-in-discesa. *Razionale: senza un soffitto, fixare l'orologio crea solo un runaway più lento; è la posta che fa contare ogni effetto di game-feel.*
4. **Strato PvE — raid schedulati** — pesca città sotto-difese, risolvi col modello `Battle`, `notifier.send('BATTLE_ATTACK')`. *Razionale: la convergenza 4/6 del tavolo. Accende combattimento, allarme e uno scopo per l'esercito STASERA, senza dipendere da player umani, riusando infra già pagata.*
5. **Spegnere la stampante di credito + raddrizzare l'oracolo dei prezzi** — gatekeeping reputazione/sequestro asset sul World Bank; registrare trade reali e `MarketHistory` ponderata per volume. *Razionale: i due faucet/oracolo che DEVONO essere onesti prima di costruirci sopra qualsiasi prezzo NPC dinamico o leva politica sull'economia.*

> **Nota di sequenza:** completate questi 5 e avrete un *daily loop vero end-to-end* su fondamenta oneste. Solo allora si accendono i payoff: NPC market-maker (B), Spoils of Office (C), rientro "Mentre eri via" (D), e — per ultime, con design offline-safe — le marce reali e la conquista (G).

---

## 6. La scommessa

**"Fate dei bot IL gioco": il mondo vivente di NPC con conseguenze reali.**

Il tavolo è partito da sei scuole diverse e ha convergito su un'unica verità, formulata dal Blind Playtester e sposata da tutti: *Republica non ha un problema di "mondo vuoto", ha un problema di feedback morto su una popolazione che non arriverà.* La scommessa è smettere di aspettare i player umani e trasformare la debolezza nel cuore pulsante.

Un solo motore — il `WorldEvent` bus + il live-ticker delle elezioni, **la tecnologia migliore e già pagata** — alimenta tre strati di NPC che **fanno davvero cose che il giocatore subisce**:

- **NPC che governano** (Spoils of Office, C): il sindaco-bot populista ti taglia le tasse ma fa crollare la felicità; l'industriale ti dà un buff produzione ma alza la tassazione; e quando l'approval crolla, lo **detronizzi col recall**.
- **NPC che attaccano** (raid PvE, A): banditi che assediano le città trascurate, accendono il redFlash già cablato, danno scopo all'esercito e — più avanti, con upkeep di occupazione — possono persino far cambiare padrone alla mappa.
- **NPC che commerciano** (market-maker dinamico, B): un mercante il cui umore respira sull'`avgPrice` reale, piegato dal President eletto, scosso dagli shock di commodity durante una famine.

Il tutto compresso nei **Primi 90 Minuti** (F), così un nuovo giocatore tocca la feature migliore — l'elezione live con rivali e Election Fever — entro 10 minuti invece che dopo 5 giorni, e una **Crisi di Stato co-op** (E) crea il battito di server ricorrente che dà a *tutti, sempre*, ciò che oggi danno solo le elezioni.

**Un mondo finto ma vivo batte un mondo "vero" ma deserto.** È il punto di convergenza di tutti e sei i tavoli — ma poggia su un patto non-negoziabile, ripetuto da ogni voce: **prima si spengono le bugie** (l'orologio 60x, le quest morte, il boost che crasha, la stampante di credito), **poi si accendono le luci.** Un gioco con tre loop veri batte un gioco con venti vetrine.