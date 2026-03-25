const { City, User, Election, GovernmentPosition, WorldEvent, Market, MarketHistory, Contract, Loan, ActivityLog } = require('../models');
const NotificationService = require('./notificationService');
const { Op } = require('sequelize');

class GameScheduler {
  constructor(io) {
    this.io = io;
    this.notifier = new NotificationService(io);
    this.productionInterval = null;
    this.electionInterval = null;
    this.BATCH_SIZE = 100;
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
    }, 15 * 60 * 1000);

    // Initial runs
    this.updateAllCityProduction();
    this.processElections();
    this.scheduleNewElections();
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
    console.log('Game scheduler stopped');
  }

  // =============================================
  // PRODUCTION - Batched
  // =============================================

  async updateAllCityProduction() {
    try {
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
          await this.updateCityProduction(city);
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

  async updateCityProduction(city) {
    try {
      const production = city.calculateProduction();
      const consumption = city.consumption;

      for (const resource in production) {
        city.resources[resource] = (city.resources[resource] || 0) + production[resource];
      }

      for (const resource in consumption) {
        city.resources[resource] = Math.max(0, (city.resources[resource] || 0) - consumption[resource]);
      }

      // Population growth: max capacity based on houses, slow linear growth
      const maxPopulation = (city.buildings?.houses || 10) * 500;
      const happinessFactor = (city.happiness - 50) / 100; // -0.5 to +0.5
      const growthRate = Math.max(-5, Math.floor(happinessFactor * 3)); // -5 to +1 per tick
      city.population = Math.max(10, Math.min(maxPopulation, city.population + growthRate));

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

      // Move CAMPAIGN -> VOTING (after start date)
      await Election.update(
        { status: 'VOTING' },
        {
          where: {
            status: 'CAMPAIGN',
            startDate: { [Op.lte]: now },
            endDate: { [Op.gt]: now }
          }
        }
      );

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
      const candidates = election.results.candidates || {};
      let winnerId = null;
      let maxVotes = 0;

      for (const [candidateId, data] of Object.entries(candidates)) {
        if (data.votes > maxVotes) {
          maxVotes = data.votes;
          winnerId = candidateId;
        }
      }

      election.status = 'COMPLETED';
      election.winnerId = winnerId;
      election.changed('results', true);
      await election.save();

      // Assign government position to winner
      if (winnerId) {
        const termDays = { MAYOR: 30, GOVERNOR: 45, PRESIDENT: 60 };
        const positionMap = { MAYOR: 'mayor', GOVERNOR: 'governor', PRESIDENT: 'president' };

        await GovernmentPosition.create({
          worldId: election.worldId,
          position: positionMap[election.position],
          userId: winnerId,
          appointedBy: winnerId,
          startDate: new Date(),
          endDate: new Date(Date.now() + termDays[election.position] * 24 * 60 * 60 * 1000),
          cityId: election.cityId,
          regionId: election.regionId
        });

        console.log(`Election completed: ${election.position} - Winner: ${candidates[winnerId]?.username}`);
      } else {
        console.log(`Election completed: ${election.position} - No candidates`);
      }

      if (this.io) {
        this.io.to(`world-${election.worldId}`).emit('election-completed', {
          electionId: election.id,
          position: election.position,
          winnerId,
          winnerName: winnerId ? candidates[winnerId]?.username : null
        });
      }

      // Notify winner
      if (winnerId) {
        await this.notifier.send(winnerId, 'ELECTION_RESULT',
          `You won the ${election.position} election!`,
          `Congratulations! You have been elected as ${election.position}.`,
          { electionId: election.id }
        );
      }

      // Notify all candidates about results
      for (const [candidateId, data] of Object.entries(candidates)) {
        if (candidateId !== winnerId) {
          await this.notifier.send(candidateId, 'ELECTION_RESULT',
            `${election.position} election results`,
            `The ${election.position} election has concluded. ${winnerId ? candidates[winnerId]?.username + ' won.' : 'No winner.'}`,
            { electionId: election.id }
          );
        }
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
            attributes: ['id']
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
      const sequelize = require('../config/database');
      const resources = ['food', 'wood', 'stone', 'iron', 'gold', 'energy'];
      const worlds = await City.findAll({ attributes: ['worldId'], group: ['worldId'], raw: true });

      for (const { worldId } of worlds) {
        for (const resource of resources) {
          const result = await Market.findAll({
            where: { worldId, resource, status: 'ACTIVE' },
            attributes: [
              [sequelize.fn('AVG', sequelize.col('pricePerUnit')), 'avgPrice'],
              [sequelize.fn('MIN', sequelize.col('pricePerUnit')), 'minPrice'],
              [sequelize.fn('MAX', sequelize.col('pricePerUnit')), 'maxPrice'],
              [sequelize.fn('SUM', sequelize.col('quantity')), 'volume']
            ],
            raw: true
          });

          if (result[0] && result[0].avgPrice) {
            await MarketHistory.create({
              worldId,
              resource,
              avgPrice: parseFloat(result[0].avgPrice),
              minPrice: parseFloat(result[0].minPrice),
              maxPrice: parseFloat(result[0].maxPrice),
              volume: parseInt(result[0].volume) || 0,
              snapshotAt: new Date()
            });
          }
        }
      }
      console.log('Market price snapshot completed');
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
}

module.exports = GameScheduler;
