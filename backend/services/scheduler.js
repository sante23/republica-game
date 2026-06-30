const { City, User, Election, GovernmentPosition, WorldEvent, Market, MarketHistory, Contract, Loan, ActivityLog, MilitaryUnit, UNIT_TYPES, Battle, PirateRaid, AutoOrder, MarketTrade, WorldBoss, WarEffort } = require('../models');
const NotificationService = require('./notificationService');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { PLATFORMS, PLATFORM_KEYS, NPC_NAMES, PROMISE_LABELS } = require('../config/electionConfig');
const { computeBattle } = require('./combat');
const { logActivity } = require('../routes/activity');
const { completeConstruction } = require('./construction');
const { bumpQuests } = require('./questService');

// A candidate's total support = player (weighted) votes + synthetic citizen baseline + campaign swing + endorsements.
function candidateSupport(c) {
  return (c.votes || 0) + (c.npcBase || 0) + (c.campaignVotes || 0) + (c.endorseVotes || 0);
}

class GameScheduler {
  constructor(io) {
    this.io = io;
    this.notifier = new NotificationService(io);
    this.productionInterval = null;
    this.electionInterval = null;
    this.BATCH_SIZE = 100;
    this.lastProductionAt = null; // timestamp of last production tick (per-hour accrual)
    this.raidInterval = null;
    this.raidRunning = false; // anti-reentrancy guard for the raid tick
  }

  start() {
    console.log('Game scheduler started');

    // Update resources every 60 seconds (batched)
    this.productionInterval = setInterval(() => {
      this.updateAllCityProduction();
    }, 60000);

    // Check election phases every 5 minutes
    this.electionInterval = setInterval(() => {
      this.processElections();
      this.scheduleNewElections();
    }, 5 * 60 * 1000);

    // World events every 30 minutes
    this.worldEventInterval = setInterval(() => {
      this.generateWorldEvents();
    }, 30 * 60 * 1000);

    // Market price snapshots every hour
    this.marketSnapshotInterval = setInterval(() => {
      this.snapshotMarketPrices();
    }, 60 * 60 * 1000);

    // Process contracts and loans every 15 minutes
    this.contractInterval = setInterval(() => {
      this.processContracts();
      this.processLoans();
      this.processApprovalRatings();
      this.matchAutoOrders();
    }, 15 * 60 * 1000);

    // Pirate raids every 10 minutes (PvE threat layer)
    this.raidInterval = setInterval(() => {
      this.processPirateRaids();
    }, 10 * 60 * 1000);

    // Initial runs
    this.updateAllCityProduction();
    this.processElections();
    this.scheduleNewElections();
    this.processPirateRaids();
  }

  stop() {
    if (this.productionInterval) {
      clearInterval(this.productionInterval);
      this.productionInterval = null;
    }
    if (this.electionInterval) {
      clearInterval(this.electionInterval);
      this.electionInterval = null;
    }
    if (this.worldEventInterval) {
      clearInterval(this.worldEventInterval);
      this.worldEventInterval = null;
    }
    if (this.marketSnapshotInterval) {
      clearInterval(this.marketSnapshotInterval);
      this.marketSnapshotInterval = null;
    }
    if (this.contractInterval) {
      clearInterval(this.contractInterval);
      this.contractInterval = null;
    }
    if (this.raidInterval) {
      clearInterval(this.raidInterval);
      this.raidInterval = null;
    }
    console.log('Game scheduler stopped');
  }

  // =============================================
  // PRODUCTION - Batched
  // =============================================

  async updateAllCityProduction() {
    try {
      // Production values are PER-HOUR rates; accrue only the fraction of an hour
      // that actually elapsed since the last tick. (Was adding the FULL hourly
      // amount every 60s -> ~60x too fast and inconsistent with the client UI,
      // which interpolates at production/3600 per second.)
      const nowMs = Date.now();
      const last = this.lastProductionAt || (nowMs - 60000);
      const elapsedSec = Math.max(1, Math.min(3600, (nowMs - last) / 1000));
      this.lastProductionAt = nowMs;

      // Fetch active world events to apply their effects
      const activeEvents = await WorldEvent.findAll({
        where: { active: true, endsAt: { [require('sequelize').Op.gt]: new Date() } }
      });

      let offset = 0;
      let totalUpdated = 0;

      while (true) {
        const cities = await City.findAll({
          include: [{
            model: User,
            as: 'owner',
            attributes: ['id', 'username']
          }],
          limit: this.BATCH_SIZE,
          offset,
          order: [['id', 'ASC']]
        });

        if (cities.length === 0) break;

        for (const city of cities) {
          await this.updateCityProduction(city, activeEvents, elapsedSec);
        }

        totalUpdated += cities.length;
        offset += this.BATCH_SIZE;

        // If fewer than batch size returned, we're done
        if (cities.length < this.BATCH_SIZE) break;
      }

      if (totalUpdated > 0) {
        console.log(`Production updated for ${totalUpdated} cities`);
      }
    } catch (error) {
      console.error('Error updating city production:', error);
    }
  }

  async updateCityProduction(city, activeEvents = [], elapsedSec = 60) {
    try {
      // Finish any construction whose timer elapsed, so its output counts this tick.
      const builtNow = completeConstruction(city);
      if (builtNow) {
        try { bumpQuests(city.userId, 'build', builtNow, 1, this.io); } catch (_) {}
        if (this.io) {
          this.io.to(`city-${city.id}`).emit('city-updated', {
            resources: city.resources,
            buildings: city.buildings,
            construction: null
          });
        }
      }

      const production = city.calculateProduction();

      // Apply world event effects to production (effects use multipliers: 0.5 = halved, 2.0 = doubled)
      for (const event of activeEvents) {
        if (event.affectedCityId && event.affectedCityId !== city.id) continue;
        if (event.worldId !== city.worldId) continue;
        const effects = event.effects || {};
        if (effects.foodProduction) production.food = Math.max(0, Math.round(production.food * effects.foodProduction));
        if (effects.goldProduction) production.gold = Math.max(0, Math.round(production.gold * effects.goldProduction));
        if (effects.ironProduction) production.iron = Math.max(0, Math.round(production.iron * effects.ironProduction));
        if (effects.woodProduction) production.wood = Math.max(0, Math.round(production.wood * effects.woodProduction));
        if (effects.stoneProduction) production.stone = Math.max(0, Math.round(production.stone * effects.stoneProduction));
        if (effects.allProduction) {
          for (const r in production) {
            production[r] = Math.max(0, Math.round(production[r] * effects.allProduction));
          }
        }
        if (effects.happinessModifier) {
          city.happiness = Math.max(0, Math.min(100, city.happiness + effects.happinessModifier));
        }
      }

      city.production = production; // persist calculated PER-HOUR production (for UI display)
      city.changed('production', true);
      const factor = elapsedSec / 3600; // fraction of an hour actually elapsed

      // Effective consumption scales gently with size (floored so a starter city never starves)
      const baseConsumption = city.consumption || {};
      const buildingCount = Object.values(city.buildings || {}).reduce((s, n) => s + (n || 0), 0);
      const consumption = {
        ...baseConsumption,
        food: (baseConsumption.food || 0) + Math.floor((city.population || 0) / 500),
        energy: (baseConsumption.energy || 0) + Math.floor(buildingCount / 5)
      };

      for (const resource in production) {
        city.resources[resource] = Math.round(((city.resources[resource] || 0) + production[resource] * factor) * 100) / 100;
      }

      for (const resource in consumption) {
        city.resources[resource] = Math.max(0, Math.round(((city.resources[resource] || 0) - consumption[resource] * factor) * 100) / 100);
      }

      // Storage caps — a generous sink against infinite hoarding (scales with houses/townHall)
      const storageCap = 10000 + (city.buildings?.houses || 0) * 2000 + (city.buildings?.townHall || 0) * 10000;
      for (const resource in city.resources) {
        if (city.resources[resource] > storageCap) city.resources[resource] = storageCap;
      }

      // Population growth: max capacity based on houses, slow linear growth (scaled to elapsed time)
      const maxPopulation = (city.buildings?.houses || 10) * 500;
      const happinessFactor = (city.happiness - 50) / 100; // -0.5 to +0.5
      const growthRate = Math.max(-5, Math.floor(happinessFactor * 3)); // -5 to +1 per standard 60s tick
      const popDelta = Math.round(growthRate * (elapsedSec / 60));
      city.population = Math.max(10, Math.min(maxPopulation, city.population + popDelta));

      if (city.resources.food < 10) {
        city.happiness = Math.max(0, city.happiness - 5);
      } else if (city.resources.food > 100) {
        city.happiness = Math.min(100, city.happiness + 1);
      }

      city.changed('resources', true);
      city.changed('population', true);
      city.changed('happiness', true);
      await city.save();

      if (this.io) {
        this.io.to(`city-${city.id}`).emit('production-update', {
          cityId: city.id,
          resources: city.resources,
          production,
          population: city.population,
          happiness: city.happiness
        });
      }
    } catch (error) {
      console.error(`Error updating production for city ${city.id}:`, error);
    }
  }

  // =============================================
  // ELECTIONS - Automatic cycle
  // =============================================

  async processElections() {
    try {
      const now = new Date();

      // Move UPCOMING -> REGISTRATION (3 days before start)
      await Election.update(
        { status: 'REGISTRATION' },
        {
          where: {
            status: 'UPCOMING',
            registrationDeadline: { [Op.gt]: now },
            startDate: { [Op.gt]: now }
          }
        }
      );

      // Move REGISTRATION -> CAMPAIGN (after registration deadline)
      await Election.update(
        { status: 'CAMPAIGN' },
        {
          where: {
            status: 'REGISTRATION',
            registrationDeadline: { [Op.lte]: now },
            startDate: { [Op.gt]: now }
          }
        }
      );

      // Make sure every open race has at least 2 candidates (NPC rivals fill empty ballots)
      const liveElections = await Election.findAll({
        where: { status: { [Op.in]: ['REGISTRATION', 'CAMPAIGN'] } }
      });
      for (const el of liveElections) {
        await this.ensureNpcCandidates(el);
      }

      // Move CAMPAIGN -> VOTING per-row, seeding citizen votes + Election Fever
      const startingElections = await Election.findAll({
        where: { status: 'CAMPAIGN', startDate: { [Op.lte]: now }, endDate: { [Op.gt]: now } }
      });
      for (const el of startingElections) {
        await this.ensureNpcCandidates(el);
        await this.seedNpcCitizenVotes(el);
        el.status = 'VOTING';
        await el.save();
        await this.createElectionFever(el);
        if (this.io) {
          this.io.to(`world-${el.worldId}`).emit('election-phase', {
            electionId: el.id, position: el.position, status: 'VOTING', endsAt: el.endDate
          });
        }
      }

      // Complete elections past end date
      const completedElections = await Election.findAll({
        where: {
          status: 'VOTING',
          endDate: { [Op.lte]: now }
        }
      });

      for (const election of completedElections) {
        await this.completeElection(election);
      }

    } catch (error) {
      console.error('Error processing elections:', error);
    }
  }

  async completeElection(election) {
    try {
      const candidates = (election.results && election.results.candidates) || {};
      let winnerId = null;
      let winner = null;
      let maxSupport = -1;

      for (const [candidateId, data] of Object.entries(candidates)) {
        const s = candidateSupport(data);
        if (s > maxSupport) {
          maxSupport = s;
          winnerId = candidateId;
          winner = data;
        }
      }

      const isNpcWinner = !!(winner && winner.isNpc);

      election.status = 'COMPLETED';
      election.winnerId = isNpcWinner ? null : winnerId; // winnerId column is UUID; NPC ids are not
      if (winner) {
        election.results.winnerName = winner.username;
        election.results.winnerIsNpc = isNpcWinner;
      }
      election.changed('results', true);
      await election.save();

      // Assign government position to winner (human or NPC caretaker)
      if (winnerId && winner) {
        const termDays = { MAYOR: 30, GOVERNOR: 45, PRESIDENT: 60 };
        const positionMap = { MAYOR: 'mayor', GOVERNOR: 'governor', PRESIDENT: 'president' };
        const promises = (winner.promises || []).map(pid => ({
          id: pid, label: PROMISE_LABELS[pid] || pid, kept: null
        }));

        await GovernmentPosition.create({
          worldId: election.worldId,
          position: positionMap[election.position],
          userId: isNpcWinner ? null : winnerId,
          appointedBy: isNpcWinner ? null : winnerId,
          isNpc: isNpcWinner,
          npcName: isNpcWinner ? winner.username : null,
          approval: 55,
          promises,
          startDate: new Date(),
          endDate: new Date(Date.now() + termDays[election.position] * 24 * 60 * 60 * 1000),
          cityId: election.cityId,
          regionId: election.regionId
        });

        console.log(`Election completed: ${election.position} - Winner: ${winner.username}${isNpcWinner ? ' (NPC)' : ''}`);
      } else {
        console.log(`Election completed: ${election.position} - No candidates`);
      }

      // Clear the Election Fever event tied to this race
      try {
        await WorldEvent.update(
          { active: false },
          { where: { worldId: election.worldId, title: 'Election Fever 🗳️', active: true } }
        );
      } catch (e) { /* non-fatal */ }

      if (this.io) {
        this.io.to(`world-${election.worldId}`).emit('election-completed', {
          electionId: election.id,
          position: election.position,
          winnerId: election.winnerId,
          winnerName: winner ? winner.username : null,
          isNpc: isNpcWinner
        });
      }

      // Notify the human winner
      if (winnerId && !isNpcWinner) {
        await this.notifier.send(winnerId, 'ELECTION_RESULT',
          `You won the ${election.position} election!`,
          `Congratulations! You have been elected as ${election.position}.`,
          { electionId: election.id }
        );
      }

      // Notify losing HUMAN candidates only (NPC ids are not real users)
      for (const [candidateId, data] of Object.entries(candidates)) {
        if (data.isNpc || candidateId === winnerId) continue;
        await this.notifier.send(candidateId, 'ELECTION_RESULT',
          `${election.position} election results`,
          `The ${election.position} election has concluded. ${winner ? winner.username + ' won.' : 'No winner.'}`,
          { electionId: election.id }
        );
      }
    } catch (error) {
      console.error(`Error completing election ${election.id}:`, error);
    }
  }

  async scheduleNewElections() {
    try {
      // Get all active worlds (distinct worldIds from cities)
      const worlds = await City.findAll({
        attributes: ['worldId'],
        group: ['worldId'],
        raw: true
      });

      for (const { worldId } of worlds) {
        await this.scheduleWorldElections(worldId);
      }
    } catch (error) {
      console.error('Error scheduling elections:', error);
    }
  }

  async scheduleWorldElections(worldId) {
    const positions = ['MAYOR', 'GOVERNOR', 'PRESIDENT'];

    for (const position of positions) {
      // Check if there's already an active/upcoming election
      const existing = await Election.findOne({
        where: {
          worldId,
          position,
          status: { [Op.ne]: 'COMPLETED' }
        }
      });

      if (existing) continue;

      // Check if current term holder's term is expiring within 7 days
      const positionMap = { MAYOR: 'mayor', GOVERNOR: 'governor', PRESIDENT: 'president' };
      const currentHolder = await GovernmentPosition.findOne({
        where: {
          worldId,
          position: positionMap[position],
          endDate: { [Op.gt]: new Date() }
        },
        order: [['startDate', 'DESC']]
      });

      const shouldSchedule = !currentHolder || 
        (currentHolder.endDate && new Date(currentHolder.endDate) - new Date() < 7 * 24 * 60 * 60 * 1000);

      if (shouldSchedule) {
        const now = new Date();
        const registrationDeadline = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const startDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
        const endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);

        // For mayors, schedule for cities that have enough population
        if (position === 'MAYOR') {
          const cities = await City.findAll({
            where: { worldId, population: { [Op.gte]: 100 } },
            attributes: ['id'],
            include: [{ model: User, as: 'owner', attributes: [], required: true, where: { isBot: false } }]
          });

          for (const city of cities) {
            const existingCityElection = await Election.findOne({
              where: { worldId, position: 'MAYOR', cityId: city.id, status: { [Op.ne]: 'COMPLETED' } }
            });
            if (!existingCityElection) {
              const cityHolder = await GovernmentPosition.findOne({
                where: { worldId, position: 'mayor', cityId: city.id, endDate: { [Op.gt]: new Date() } }
              });
              if (!cityHolder) {
                await Election.create({
                  position: 'MAYOR',
                  cityId: city.id,
                  worldId,
                  startDate,
                  endDate,
                  registrationDeadline,
                  status: 'UPCOMING',
                  results: { candidates: {}, voters: {} }
                });
                console.log(`Scheduled MAYOR election for city ${city.id} in world ${worldId}`);
              }
            }
          }
        } else {
          await Election.create({
            position,
            worldId,
            startDate,
            endDate,
            registrationDeadline,
            status: 'UPCOMING',
            results: { candidates: {}, voters: {} }
          });
          console.log(`Scheduled ${position} election in world ${worldId}`);
        }
      }
    }
  }
  // =============================================
  // MARKET PRICE SNAPSHOTS
  // =============================================

  async snapshotMarketPrices() {
    try {
      const resources = ['food', 'wood', 'stone', 'iron', 'gold', 'energy'];
      const since = new Date(Date.now() - 60 * 60 * 1000); // last hour of EXECUTED trades
      const worlds = await City.findAll({ attributes: ['worldId'], group: ['worldId'], raw: true });

      for (const { worldId } of worlds) {
        for (const resource of resources) {
          // Volume-weighted from real trades, NOT the average of unsold ASK listings
          const agg = await MarketTrade.findAll({
            where: { worldId, resource, at: { [Op.gte]: since } },
            attributes: [
              [sequelize.fn('SUM', sequelize.literal('price * quantity')), 'pv'],
              [sequelize.fn('SUM', sequelize.col('quantity')), 'vol'],
              [sequelize.fn('MIN', sequelize.col('price')), 'minPrice'],
              [sequelize.fn('MAX', sequelize.col('price')), 'maxPrice']
            ],
            raw: true
          });
          const row = agg[0];
          const vol = parseInt(row && row.vol) || 0;
          if (vol > 0) {
            const avg = parseFloat(row.pv) / vol;
            await MarketHistory.create({
              worldId,
              resource,
              avgPrice: Math.round(avg * 100) / 100,
              minPrice: parseFloat(row.minPrice),
              maxPrice: parseFloat(row.maxPrice),
              volume: vol,
              snapshotAt: new Date()
            });
          }
        }
      }
      console.log('Market price snapshot (executed trades) completed');
    } catch (error) {
      console.error('Error snapshotting market prices:', error);
    }
  }

  // =============================================
  // CONTRACT PROCESSING
  // =============================================

  async processContracts() {
    try {
      const { Op } = require('sequelize');
      const sequelize = require('../config/database');
      const now = new Date();

      const dueContracts = await Contract.findAll({
        where: { status: 'active', nextDeliveryAt: { [Op.lte]: now } }
      });

      for (const contract of dueContracts) {
        const transaction = await sequelize.transaction();
        try {
          const seller = await User.findByPk(contract.sellerId, { transaction });
          const buyer = await User.findByPk(contract.buyerId, { transaction });
          const sellerCity = await City.findOne({ where: { userId: contract.sellerId }, order: [['isCapital', 'DESC']], transaction });
          const buyerCity = await City.findOne({ where: { userId: contract.buyerId }, order: [['isCapital', 'DESC']], transaction });

          if (!sellerCity || !buyerCity) {
            contract.status = 'breached';
            await contract.save({ transaction });
            await transaction.commit();
            continue;
          }

          const hasResources = (sellerCity.resources[contract.resource] || 0) >= contract.quantityPerDelivery;
          const totalCost = contract.quantityPerDelivery * contract.pricePerUnit;
          const hasCredits = buyer.credits >= totalCost;

          if (!hasResources || !hasCredits) {
            contract.status = 'breached';
            await contract.save({ transaction });
            await transaction.commit();
            continue;
          }

          // Transfer resources
          sellerCity.resources[contract.resource] -= contract.quantityPerDelivery;
          buyerCity.resources[contract.resource] = (buyerCity.resources[contract.resource] || 0) + contract.quantityPerDelivery;
          sellerCity.changed('resources', true);
          buyerCity.changed('resources', true);
          await sellerCity.save({ transaction });
          await buyerCity.save({ transaction });

          // Transfer credits
          buyer.credits -= totalCost;
          seller.credits += totalCost;
          await buyer.save({ transaction });
          await seller.save({ transaction });

          // Record executed trade for the price oracle
          try {
            await MarketTrade.create({
              worldId: sellerCity.worldId,
              resource: contract.resource,
              price: contract.pricePerUnit,
              quantity: contract.quantityPerDelivery,
              at: now
            }, { transaction });
          } catch (e) { /* non-fatal */ }

          contract.deliveriesCompleted += 1;
          if (contract.deliveriesCompleted >= contract.deliveriesTotal) {
            contract.status = 'completed';
          } else {
            contract.nextDeliveryAt = new Date(now.getTime() + contract.intervalHours * 60 * 60 * 1000);
          }
          await contract.save({ transaction });
          await transaction.commit();
        } catch (e) {
          await transaction.rollback();
          console.error(`Contract ${contract.id} delivery failed:`, e);
        }
      }
    } catch (error) {
      console.error('Error processing contracts:', error);
    }
  }

  // =============================================
  // LOAN PROCESSING
  // =============================================

  async processLoans() {
    try {
      const { Op } = require('sequelize');
      const now = new Date();

      // Default overdue loans
      const overdueLoans = await Loan.findAll({
        where: { status: 'active', dueDate: { [Op.lt]: now } }
      });

      for (const loan of overdueLoans) {
        if (loan.amountPaid < loan.amountOwed) {
          loan.status = 'defaulted';
          await loan.save();

          // Reputation penalty for defaulting
          const borrower = await User.findByPk(loan.borrowerId);
          if (borrower) {
            borrower.reputation = Math.max(0, borrower.reputation - 10);
            await borrower.save();
          }

          console.log(`Loan ${loan.id} defaulted by user ${loan.borrowerId}`);
        }
      }
    } catch (error) {
      console.error('Error processing loans:', error);
    }
  }

  // =============================================
  // WORLD EVENTS - Random generation
  // =============================================

  async generateWorldEvents() {
    try {
      const worlds = await City.findAll({
        attributes: ['worldId'],
        group: ['worldId'],
        raw: true
      });

      for (const { worldId } of worlds) {
        // 30% chance per check (every 30 min) = ~1 event per 1.5 hours
        if (Math.random() > 0.3) continue;

        // Don't stack too many active events
        const activeCount = await WorldEvent.count({
          where: { worldId, active: true }
        });
        if (activeCount >= 3) continue;

        const types = Object.keys(WorldEvent.EVENT_TEMPLATES);
        const type = types[Math.floor(Math.random() * types.length)];
        const template = WorldEvent.EVENT_TEMPLATES[type];
        const now = new Date();

        const event = await WorldEvent.create({
          worldId,
          type,
          title: template.title,
          description: template.description,
          effects: template.effects,
          startsAt: now,
          endsAt: new Date(now.getTime() + template.duration),
          active: true
        });

        console.log(`World event generated: ${template.title} in world ${worldId}`);

        if (this.io) {
          this.io.to(`world-${worldId}`).emit('world-event', {
            id: event.id,
            type,
            title: template.title,
            description: template.description,
            effects: template.effects,
            endsAt: event.endsAt
          });
        }
      }
    } catch (error) {
      console.error('Error generating world events:', error);
    }
  }

  // =============================================
  // NPC CANDIDATES & ELECTION LIVENESS
  // =============================================

  // Fill empty ballots: guarantee >=2 candidates and at least one NPC rival when a human runs.
  async ensureNpcCandidates(election) {
    try {
      if (!election.results) election.results = {};
      if (!election.results.candidates) election.results.candidates = {};
      const cands = election.results.candidates;
      const ids = Object.keys(cands);
      const humanCount = ids.filter(id => !cands[id].isNpc).length;
      const npcCount = ids.filter(id => cands[id].isNpc).length;

      let desiredNpc = Math.max(0, 2 - humanCount);
      if (humanCount >= 1 && npcCount === 0) desiredNpc = Math.max(desiredNpc, 1);
      const toAdd = desiredNpc - npcCount;
      if (toAdd <= 0) return;

      const usedNames = new Set(ids.map(id => cands[id].username));
      for (let i = 0; i < toAdd; i++) {
        const name = NPC_NAMES.find(n => !usedNames.has(n)) || `Independent ${ids.length + i + 1}`;
        usedNames.add(name);
        const platformKey = PLATFORM_KEYS[Math.floor(Math.random() * PLATFORM_KEYS.length)];
        const platform = PLATFORMS[platformKey];
        const npcId = `npc:${platformKey}:${name.replace(/\s+/g, '-').toLowerCase()}`;
        cands[npcId] = {
          username: name,
          isNpc: true,
          platform: platformKey,
          program: `As a ${platform.label}, I will fight for what our people truly deserve.`,
          promises: platform.promises.slice(),
          votes: 0, npcBase: 0, campaignVotes: 0, endorseVotes: 0, campaignSpend: 0,
          endorsers: {},
          registrationDate: new Date()
        };
      }
      election.changed('results', true);
      await election.save();
      if (this.io) {
        this.io.to(`world-${election.worldId}`).emit('election-phase', {
          electionId: election.id, position: election.position, status: election.status, npcJoined: true
        });
      }
    } catch (e) {
      console.error('ensureNpcCandidates error:', e);
    }
  }

  // Seed a synthetic "citizen" baseline when voting opens so bars are never empty.
  // NPCs get a real (but beatable) lead; humans get a small lean from their promises.
  async seedNpcCitizenVotes(election) {
    try {
      if (!election.results || !election.results.candidates) return;
      const cands = election.results.candidates;
      for (const id of Object.keys(cands)) {
        const c = cands[id];
        if (c.npcBase && c.npcBase > 0) continue; // already seeded
        if (c.isNpc) {
          const appeal = (PLATFORMS[c.platform] && PLATFORMS[c.platform].appeal) || 1;
          c.npcBase = Math.round(appeal * (8 + Math.floor(Math.random() * 7))); // ~8-22
        } else {
          c.npcBase = 3 + (Array.isArray(c.promises) ? c.promises.length : 0); // small lean
        }
      }
      election.changed('results', true);
      await election.save();
    } catch (e) {
      console.error('seedNpcCitizenVotes error:', e);
    }
  }

  // "Election Fever": a festival-type buff active for the duration of the vote.
  async createElectionFever(election) {
    try {
      const title = 'Election Fever 🗳️';
      const existing = await WorldEvent.findOne({
        where: { worldId: election.worldId, title, active: true }
      });
      if (existing) return;
      const event = await WorldEvent.create({
        worldId: election.worldId,
        type: 'festival',
        title,
        description: `Election day energy grips the ${election.position.toLowerCase()} race! Citizens are happier and more productive while the vote is open.`,
        effects: { happinessModifier: 8, allProduction: 1.05 },
        affectedCityId: election.cityId || null,
        startsAt: new Date(),
        endsAt: election.endDate,
        active: true
      });
      if (this.io) {
        this.io.to(`world-${election.worldId}`).emit('world-event', {
          id: event.id, type: 'festival', title, description: event.description,
          effects: event.effects, endsAt: event.endsAt
        });
      }
    } catch (e) {
      console.error('createElectionFever error:', e);
    }
  }

  // =============================================
  // APPROVAL RATINGS & RECALL
  // =============================================

  // Drift each sitting official's approval with the happiness & tax burden they
  // preside over. A collapsed mandate (<=5%) is recalled and a fresh race follows.
  async processApprovalRatings() {
    try {
      const now = new Date();
      const positions = await GovernmentPosition.findAll({
        where: { [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: now } }] }
      });

      for (const pos of positions) {
        let happiness = 50, taxRate = 10;
        if (pos.cityId) {
          const city = await City.findByPk(pos.cityId, { attributes: ['happiness', 'taxRate'] });
          if (city) { happiness = city.happiness != null ? city.happiness : 50; taxRate = city.taxRate != null ? city.taxRate : 10; }
        } else {
          const cities = await City.findAll({ where: { worldId: pos.worldId }, attributes: ['happiness', 'taxRate'] });
          if (cities.length) {
            happiness = Math.round(cities.reduce((s, c) => s + (c.happiness != null ? c.happiness : 50), 0) / cities.length);
            taxRate = Math.round(cities.reduce((s, c) => s + (c.taxRate != null ? c.taxRate : 10), 0) / cities.length);
          }
        }

        const prev = pos.approval != null ? pos.approval : 50;
        let delta = Math.round((happiness - 50) / 12 - (taxRate - 10) / 12);
        delta = Math.max(-4, Math.min(4, delta));
        const approval = Math.max(0, Math.min(100, prev + delta));
        pos.approval = approval;
        await pos.save();

        // Light scorecard grading for the measurable promises (tax & happiness based).
        // Others stay pending (⏳) until there's a signal to grade them on.
        if (Array.isArray(pos.promises) && pos.promises.length) {
          let promisesChanged = false;
          for (const pr of pos.promises) {
            let verdict = pr.kept;
            if (pr.id === 'lower_taxes') verdict = taxRate <= 12;
            else if (pr.id === 'public_order') verdict = happiness >= 60;
            else if (pr.id === 'welfare') verdict = happiness >= 55;
            if (verdict !== pr.kept) { pr.kept = verdict; promisesChanged = true; }
          }
          if (promisesChanged) { pos.changed('promises', true); await pos.save(); }
        }

        // First time approval becomes critical, warn the human holder
        if (pos.userId && prev > 20 && approval <= 20) {
          await this.notifier.send(pos.userId, 'SYSTEM',
            'Approval critical!',
            `Your approval as ${pos.position} has fallen to ${approval}%. Raise happiness or cut taxes, or face a recall.`,
            { position: pos.position, approval });
        }

        // Auto-recall on collapse: end the term early; scheduleNewElections re-opens the seat
        if (approval <= 5) {
          pos.endDate = now;
          await pos.save();
          if (pos.userId) {
            await this.notifier.send(pos.userId, 'ELECTION_RESULT',
              'You have been recalled',
              `Approval hit rock bottom (${approval}%). You have lost the office of ${pos.position}.`,
              { position: pos.position });
          }
          if (this.io) {
            this.io.to(`world-${pos.worldId}`).emit('election-completed', {
              position: String(pos.position).toUpperCase(), winnerId: null, winnerName: null, recalled: true
            });
          }
          console.log(`Recall: ${pos.npcName || pos.position} removed (approval ${approval}%) in world ${pos.worldId}`);
        }
      }
    } catch (e) {
      console.error('processApprovalRatings error:', e);
    }
  }

  // =============================================
  // PIRATE RAIDS (PvE threat layer)
  // =============================================

  // Idempotent: ensure a pirate User (isBot) + a "Pirate Cove" City + a garrison
  // exist for a world. The garrison regenerates toward a baseline so the cove stays
  // both a recurring threat and a worthwhile bounty target.
  async ensurePirateCovo(worldId) {
    try {
      let pirate = await User.findOne({ where: { worldId, isBot: true } });
      if (!pirate) {
        pirate = await User.create({
          username: `Corsairs-W${worldId}`,
          email: `corsairs-w${worldId}@npc.local`,
          password: `npc-pirate-${worldId}-${Date.now()}`,
          level: 10,
          worldId,
          isBot: true,
          protectedUntil: null,
          reputation: 0
        });
      }

      let covo = await City.findOne({ where: { userId: pirate.id } });
      if (!covo) {
        const candidates = [[999, 999], [999, 998], [998, 999], [995, 995], [990, 990]];
        for (const [x, y] of candidates) {
          const taken = await City.findOne({ where: { worldId, x, y } });
          if (taken) continue;
          covo = await City.create({
            userId: pirate.id,
            name: 'Pirate Cove',
            x, y,
            worldId,
            isCapital: false,
            population: 500,
            resources: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0, energy: 0 },
            buildings: { townHall: 1, houses: 10, walls: 2, towers: 1 }
          });
          break;
        }
      }
      if (!covo) return null;

      // Keep the garrison topped up toward a baseline (renewable threat + bounty).
      const BASE = { infantry: 60, archer: 40, cavalry: 20 };
      for (const [unitType, baseQty] of Object.entries(BASE)) {
        const stats = UNIT_TYPES[unitType];
        const [unit, created] = await MilitaryUnit.findOrCreate({
          where: { cityId: covo.id, unitType },
          defaults: { quantity: baseQty, attackPower: stats.attackPower, defensePower: stats.defensePower, maintenanceCost: stats.maintenanceCost }
        });
        if (!created && unit.quantity < baseQty) {
          unit.quantity = Math.min(baseQty, unit.quantity + 10); // slow regen
          await unit.save();
        }
      }

      return { pirate, covo };
    } catch (e) {
      console.error('ensurePirateCovo error:', e);
      return null;
    }
  }

  // Spawn a cooperative world boss when none is active (HP scaled to real players).
  async ensureWorldBoss(worldId) {
    try {
      const existing = await WorldBoss.findOne({ where: { worldId, status: 'active' } });
      if (existing) return;
      const players = await User.count({ where: { worldId, isBot: false } });
      if (players < 1) return;
      const maxHp = 5000 + players * 5000;
      const boss = await WorldBoss.create({
        worldId, name: 'Pirate Armada', maxHp, hp: maxHp,
        rewardPool: { credits: 2000 + players * 1000 },
        status: 'active', startsAt: new Date(),
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      if (this.io) this.io.to(`world-${worldId}`).emit('world-boss', { id: boss.id, hp: boss.hp, maxHp: boss.maxHp, status: 'active', spawned: true });
      console.log(`World boss spawned in world ${worldId} (hp ${maxHp})`);
    } catch (e) { console.error('ensureWorldBoss error:', e); }
  }

  // Spawn a cooperative resource drive when none is active (goal scaled to real players).
  async ensureWarEffort(worldId) {
    try {
      const existing = await WarEffort.findOne({ where: { worldId, status: 'active' } });
      if (existing) return;
      const players = await User.count({ where: { worldId, isBot: false } });
      if (players < 1) return;
      const resources = ['food', 'wood', 'stone', 'iron'];
      const resource = resources[Math.floor(Math.random() * resources.length)];
      const goal = 1000 + players * 1000;
      const effort = await WarEffort.create({
        worldId, title: 'Relief Fund', resource, goal,
        status: 'active', startsAt: new Date(), endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      if (this.io) this.io.to(`world-${worldId}`).emit('war-effort', { id: effort.id, resource, goal, contributed: 0, spawned: true });
      console.log(`War effort spawned in world ${worldId} (${goal} ${resource})`);
    } catch (e) { console.error('ensureWarEffort error:', e); }
  }

  async processPirateRaids() {
    if (this.raidRunning) return;
    this.raidRunning = true;
    try {
      const now = new Date();
      const worlds = await City.findAll({ attributes: ['worldId'], group: ['worldId'], raw: true });

      for (const { worldId } of worlds) {
        const setup = await this.ensurePirateCovo(worldId);
        await this.ensureWorldBoss(worldId);
        await this.ensureWarEffort(worldId);
        if (!setup) continue;

        // IMPACT: resolve marching raids that have arrived
        const due = await PirateRaid.findAll({
          where: { worldId, status: 'marching', arrivesAt: { [Op.lte]: now } }
        });
        for (const raid of due) {
          await this.resolvePirateRaid(raid, setup);
        }

        // MARCH: maybe launch a new raid (cap 2 active/world, ~50% per tick)
        const activeCount = await PirateRaid.count({ where: { worldId, status: 'marching' } });
        if (activeCount >= 2) continue;
        if (Math.random() > 0.5) continue;

        const marching = await PirateRaid.findAll({ where: { worldId, status: 'marching' }, attributes: ['targetCityId'], raw: true });
        const targetedIds = marching.map(r => r.targetCityId);

        // Eligible: real player cities, owner lvl>=5, protection expired, not already targeted
        const candidates = await City.findAll({
          where: {
            worldId,
            ...(targetedIds.length ? { id: { [Op.notIn]: targetedIds } } : {})
          },
          include: [{
            model: User, as: 'owner',
            attributes: ['id', 'username', 'level', 'protectedUntil', 'isBot'],
            required: true,
            where: { isBot: false, level: { [Op.gte]: 5 } }
          }]
        });
        const eligible = candidates.filter(c => !c.owner.protectedUntil || new Date(c.owner.protectedUntil) <= now);
        if (!eligible.length) continue;

        const target = eligible[Math.floor(Math.random() * eligible.length)];
        const covoUnits = await MilitaryUnit.findAll({ where: { cityId: setup.covo.id } });
        const attackPower = covoUnits.reduce((s, u) => s + u.quantity * u.attackPower, 0);
        const arrivesAt = new Date(now.getTime() + 10 * 60 * 1000);

        const raid = await PirateRaid.create({
          worldId, targetCityId: target.id, covoCityId: setup.covo.id,
          attackPower: Math.round(attackPower), arrivesAt, status: 'marching', plunder: {}
        });

        await this.notifier.send(target.owner.id, 'BATTLE_ATTACK',
          'Pirate fleet incoming!',
          `A pirate fleet is marching on ${target.name}. It arrives in ~10 minutes — train units or raise your walls!`,
          { raidId: raid.id, cityId: target.id, arrivesAt });

        if (this.io) {
          const payload = { phase: 'marching', cityId: target.id, cityName: target.name, arrivesAt };
          this.io.to(`world-${worldId}`).emit('pirate-raid', payload);
          this.io.to(`city-${target.id}`).emit('pirate-raid', payload);
        }

        logActivity(worldId, 'battle', `A pirate fleet is marching on ${target.name}!`, setup.pirate.id, null, { raidId: raid.id });
      }
    } catch (e) {
      console.error('processPirateRaids error:', e);
    } finally {
      this.raidRunning = false;
    }
  }

  async resolvePirateRaid(raid, setup) {
    const t = await sequelize.transaction();
    try {
      const target = await City.findByPk(raid.targetCityId, { transaction: t, lock: true });
      if (!target) {
        raid.status = 'resolved';
        await raid.save({ transaction: t });
        await t.commit();
        return;
      }
      const covo = await City.findByPk(raid.covoCityId, { transaction: t, lock: true });
      const covoUnits = await MilitaryUnit.findAll({ where: { cityId: raid.covoCityId }, transaction: t });
      const targetUnits = await MilitaryUnit.findAll({ where: { cityId: raid.targetCityId }, transaction: t });

      const unitsToUse = {};
      for (const u of covoUnits) unitsToUse[u.unitType] = u.quantity;

      const result = computeBattle(
        covoUnits.map(u => ({ unitType: u.unitType, quantity: u.quantity, attackPower: u.attackPower })),
        unitsToUse,
        targetUnits.map(u => ({ unitType: u.unitType, quantity: u.quantity, defensePower: u.defensePower })),
        target.buildings || {}
      );

      for (const [unitType, loss] of Object.entries(result.attackerLosses)) {
        if (loss > 0) await MilitaryUnit.decrement('quantity', { by: loss, where: { cityId: raid.covoCityId, unitType }, transaction: t });
      }
      for (const [unitType, loss] of Object.entries(result.defenderLosses)) {
        if (loss > 0) await MilitaryUnit.decrement('quantity', { by: loss, where: { cityId: raid.targetCityId, unitType }, transaction: t });
      }

      let plunder = {};
      if (result.outcome === 'attacker_win') {
        const wall = (target.buildings && target.buildings.walls) || 0;
        const rate = Math.max(0.05, Math.min(0.25, 0.15 - wall * 0.02));
        const SAFE_FOOD = 50;
        const tr = { ...target.resources };
        const cr = { ...(covo ? covo.resources : {}) };
        for (const r of ['food', 'wood', 'stone', 'gold']) {
          let avail = tr[r] || 0;
          if (r === 'food') avail = Math.max(0, avail - SAFE_FOOD);
          const amt = Math.floor(avail * rate);
          if (amt > 0) { tr[r] = (tr[r] || 0) - amt; cr[r] = (cr[r] || 0) + amt; plunder[r] = amt; }
        }
        target.resources = tr; target.changed('resources', true);
        target.happiness = Math.max(0, (target.happiness || 50) - 10); target.changed('happiness', true);
        await target.save({ transaction: t });
        if (covo) { covo.resources = cr; covo.changed('resources', true); await covo.save({ transaction: t }); }
      }

      await Battle.create({
        attackerId: setup.pirate.id,
        defenderId: target.userId,
        attackerCityId: raid.covoCityId,
        defenderCityId: raid.targetCityId,
        attackerUnits: unitsToUse,
        defenderUnits: Object.fromEntries(targetUnits.map(u => [u.unitType, u.quantity])),
        outcome: result.outcome,
        attackerLosses: result.attackerLosses,
        defenderLosses: result.defenderLosses,
        resourcesPlundered: plunder
      }, { transaction: t });

      raid.status = 'resolved';
      raid.outcome = result.outcome;
      raid.plunder = plunder;
      await raid.save({ transaction: t });

      await t.commit();

      const won = result.outcome === 'attacker_win';
      const summary = won
        ? `Pirates raided ${target.name} and plundered your resources!`
        : `Your forces repelled the pirate raid on ${target.name}!`;
      await this.notifier.send(target.userId, won ? 'BATTLE_ATTACK' : 'BATTLE_DEFENSE',
        won ? 'Pirate raid hit your city!' : 'Pirate raid repelled!',
        summary, { raidId: raid.id, plunder });

      if (this.io) {
        const payload = { phase: 'resolved', cityId: raid.targetCityId, cityName: target.name, outcome: result.outcome };
        this.io.to(`world-${raid.worldId}`).emit('pirate-raid', payload);
        this.io.to(`city-${raid.targetCityId}`).emit('pirate-raid', payload);
      }

      logActivity(raid.worldId, 'battle', summary, setup.pirate.id, null, { raidId: raid.id, outcome: result.outcome });
    } catch (e) {
      try { await t.rollback(); } catch (_) { /* already rolled back */ }
      console.error('resolvePirateRaid error:', e);
      try { raid.status = 'resolved'; await raid.save(); } catch (_) { /* avoid infinite retry */ }
    }
  }

  // =============================================
  // AUTO-ORDER MATCHING (the order book that finally fills)
  // =============================================

  // Cross resting buy/sell AutoOrders per world+resource. Funds/resources are
  // validated at match time (like the spot market) — a deficient order is
  // deactivated rather than blocking the book. Self-deals are skipped.
  async matchAutoOrders() {
    try {
      const resources = ['food', 'wood', 'stone', 'iron', 'gold', 'energy'];
      const worlds = await City.findAll({ attributes: ['worldId'], group: ['worldId'], raw: true });
      let matches = 0;
      const MAX = 200;

      for (const { worldId } of worlds) {
        for (const resource of resources) {
          if (matches >= MAX) break;
          const buys = await AutoOrder.findAll({
            where: { worldId, resourceType: resource, orderType: 'buy', active: true },
            order: [['price', 'DESC'], ['createdAt', 'ASC']]
          });
          const sells = await AutoOrder.findAll({
            where: { worldId, resourceType: resource, orderType: 'sell', active: true },
            order: [['price', 'ASC'], ['createdAt', 'ASC']]
          });

          let bi = 0, si = 0;
          while (bi < buys.length && si < sells.length && matches < MAX) {
            const buy = buys[bi], sell = sells[si];
            if (buy.price < sell.price) break;        // book no longer crosses
            if (buy.userId === sell.userId) { si++; continue; } // no self-deal
            const buyRem = buy.quantity - (buy.filled || 0);
            const sellRem = sell.quantity - (sell.filled || 0);
            if (buyRem <= 0) { bi++; continue; }
            if (sellRem <= 0) { si++; continue; }

            const qty = Math.min(buyRem, sellRem);
            const price = sell.price; // execute at the resting ask
            const r = await this.executeAutoMatch(worldId, resource, buy, sell, qty, price);
            if (r === 'buyer_out') { bi++; continue; }
            if (r === 'seller_out') { si++; continue; }
            if (r === true) {
              matches++;
              if (buy.quantity - (buy.filled || 0) <= 0) bi++;
              if (sell.quantity - (sell.filled || 0) <= 0) si++;
            } else {
              si++; // unexpected error on this pair — skip the ask
            }
          }
        }
      }
      if (matches > 0) console.log(`AutoOrder matches executed: ${matches}`);
    } catch (e) {
      console.error('matchAutoOrders error:', e);
    }
  }

  async executeAutoMatch(worldId, resource, buy, sell, qty, price) {
    const t = await sequelize.transaction();
    try {
      const cost = Math.round(qty * price * 100) / 100;
      const buyer = await User.findByPk(buy.userId, { transaction: t, lock: true });
      const seller = await User.findByPk(sell.userId, { transaction: t, lock: true });
      if (!buyer || !seller) { await t.rollback(); return true; }

      const buyerCity = await City.findOne({ where: { userId: buy.userId }, order: [['isCapital', 'DESC']], transaction: t, lock: true });
      const sellerCity = await City.findOne({ where: { userId: sell.userId }, order: [['isCapital', 'DESC']], transaction: t, lock: true });
      if (!buyerCity || !sellerCity) { await t.rollback(); return true; }

      if (buyer.credits < cost) {
        buy.active = false; await buy.save({ transaction: t }); await t.commit(); return 'buyer_out';
      }
      if ((sellerCity.resources[resource] || 0) < qty) {
        sell.active = false; await sell.save({ transaction: t }); await t.commit(); return 'seller_out';
      }

      buyer.credits -= cost; await buyer.save({ transaction: t });
      seller.credits += cost; await seller.save({ transaction: t });

      sellerCity.resources[resource] = (sellerCity.resources[resource] || 0) - qty;
      sellerCity.changed('resources', true); await sellerCity.save({ transaction: t });
      buyerCity.resources[resource] = (buyerCity.resources[resource] || 0) + qty;
      buyerCity.changed('resources', true); await buyerCity.save({ transaction: t });

      buy.filled = (buy.filled || 0) + qty; if (buy.filled >= buy.quantity) buy.active = false; await buy.save({ transaction: t });
      sell.filled = (sell.filled || 0) + qty; if (sell.filled >= sell.quantity) sell.active = false; await sell.save({ transaction: t });

      await MarketTrade.create({ worldId, resource, price, quantity: qty, at: new Date() }, { transaction: t });

      await t.commit();

      if (this.notifier) {
        await this.notifier.send(sell.userId, 'MARKET_SOLD', 'Auto-order filled',
          `Sold ${qty} ${resource} at ${price}/unit (${cost} credits).`, { resource, quantity: qty, price });
        await this.notifier.send(buy.userId, 'MARKET_BOUGHT', 'Auto-order filled',
          `Bought ${qty} ${resource} at ${price}/unit (${cost} credits).`, { resource, quantity: qty, price });
      }
      return true;
    } catch (e) {
      try { await t.rollback(); } catch (_) { /* already rolled back */ }
      console.error('executeAutoMatch error:', e);
      return false;
    }
  }
}

module.exports = GameScheduler;
