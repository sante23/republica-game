const sequelize = require('../config/database');
const User = require('./User');
const City = require('./City');
const Election = require('./Election');
const Market = require('./Market');

// Phase 3 Models
const { MilitaryUnit, UNIT_TYPES } = require('./MilitaryUnit');
const Battle = require('./Battle');
const Alliance = require('./Alliance');
const TradeRoute = require('./TradeRoute');
const AutoOrder = require('./AutoOrder');
const TaxSettings = require('./TaxSettings');
const Policy = require('./Policy');
const PolicyVote = require('./PolicyVote');
const { GovernmentPosition, GOVERNMENT_POSITIONS } = require('./GovernmentPosition');
const ImpeachmentVote = require('./ImpeachmentVote');

// Phase 4 Models
const Message = require('./Message');
const Research = require('./Research');
const WorldEvent = require('./WorldEvent');
const SpyMission = require('./SpyMission');

// Phase 5 Models
const MarketHistory = require('./MarketHistory');
const Contract = require('./Contract');
const Loan = require('./Loan');
const Achievement = require('./Achievement');
const ActivityLog = require('./ActivityLog');

// Original relationships
User.hasMany(City, { foreignKey: 'userId', as: 'cities' });
City.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

User.hasMany(Market, { foreignKey: 'sellerId', as: 'listings' });
Market.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });
Market.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });

City.hasMany(Market, { foreignKey: 'cityId', as: 'marketListings' });
Market.belongsTo(City, { foreignKey: 'cityId', as: 'city' });

// Military relationships
City.hasMany(MilitaryUnit, { foreignKey: 'cityId', as: 'militaryUnits' });
MilitaryUnit.belongsTo(City, { foreignKey: 'cityId', as: 'city' });

User.hasMany(Battle, { foreignKey: 'attackerId', as: 'attacksInitiated' });
User.hasMany(Battle, { foreignKey: 'defenderId', as: 'defenseBattles' });
Battle.belongsTo(User, { foreignKey: 'attackerId', as: 'attacker' });
Battle.belongsTo(User, { foreignKey: 'defenderId', as: 'defender' });
Battle.belongsTo(City, { foreignKey: 'attackerCityId', as: 'attackerCity' });
Battle.belongsTo(City, { foreignKey: 'defenderCityId', as: 'defenderCity' });

Alliance.belongsTo(User, { foreignKey: 'player1Id', as: 'player1' });
Alliance.belongsTo(User, { foreignKey: 'player2Id', as: 'player2' });
Alliance.belongsTo(User, { foreignKey: 'proposedBy', as: 'proposer' });

// Economy relationships
City.hasMany(TradeRoute, { foreignKey: 'fromCityId', as: 'outgoingRoutes' });
City.hasMany(TradeRoute, { foreignKey: 'toCityId', as: 'incomingRoutes' });
TradeRoute.belongsTo(City, { foreignKey: 'fromCityId', as: 'fromCity' });
TradeRoute.belongsTo(City, { foreignKey: 'toCityId', as: 'toCity' });

User.hasMany(AutoOrder, { foreignKey: 'userId', as: 'autoOrders' });
AutoOrder.belongsTo(User, { foreignKey: 'userId', as: 'user' });

TaxSettings.belongsTo(User, { foreignKey: 'updatedBy', as: 'updater' });

// Governance relationships
Policy.belongsTo(User, { foreignKey: 'proposedBy', as: 'proposer' });
User.hasMany(Policy, { foreignKey: 'proposedBy', as: 'proposedPolicies' });

PolicyVote.belongsTo(Policy, { foreignKey: 'policyId', as: 'policy' });
PolicyVote.belongsTo(User, { foreignKey: 'userId', as: 'voter' });
Policy.hasMany(PolicyVote, { foreignKey: 'policyId', as: 'votes' });

GovernmentPosition.belongsTo(User, { foreignKey: 'userId', as: 'holder' });
GovernmentPosition.belongsTo(User, { foreignKey: 'appointedBy', as: 'appointer' });

ImpeachmentVote.belongsTo(User, { foreignKey: 'targetUserId', as: 'target' });
ImpeachmentVote.belongsTo(User, { foreignKey: 'initiatedBy', as: 'initiator' });

// Chat relationships
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });

// Research relationships
Research.belongsTo(City, { foreignKey: 'cityId', as: 'city' });
City.hasMany(Research, { foreignKey: 'cityId', as: 'researches' });

// World Event relationships
WorldEvent.belongsTo(City, { foreignKey: 'affectedCityId', as: 'affectedCity' });

// Spy Mission relationships
SpyMission.belongsTo(User, { foreignKey: 'attackerId', as: 'spy' });
SpyMission.belongsTo(City, { foreignKey: 'targetCityId', as: 'targetCity' });
User.hasMany(SpyMission, { foreignKey: 'attackerId', as: 'spyMissions' });

// Contract relationships
Contract.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });
Contract.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });
User.hasMany(Contract, { foreignKey: 'sellerId', as: 'sellContracts' });
User.hasMany(Contract, { foreignKey: 'buyerId', as: 'buyContracts' });

// Loan relationships
Loan.belongsTo(User, { foreignKey: 'lenderId', as: 'lender' });
Loan.belongsTo(User, { foreignKey: 'borrowerId', as: 'borrower' });
User.hasMany(Loan, { foreignKey: 'borrowerId', as: 'loans' });

// Achievement relationships
Achievement.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Achievement, { foreignKey: 'userId', as: 'achievements' });

// Activity Log relationships
ActivityLog.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

module.exports = {
  sequelize,
  User,
  City,
  Election,
  Market,
  // Phase 3 exports
  MilitaryUnit,
  UNIT_TYPES,
  Battle,
  Alliance,
  TradeRoute,
  AutoOrder,
  TaxSettings,
  Policy,
  PolicyVote,
  GovernmentPosition,
  GOVERNMENT_POSITIONS,
  ImpeachmentVote,
  // Phase 4 exports
  Message,
  Research,
  WorldEvent,
  SpyMission,
  // Phase 5 exports
  MarketHistory,
  Contract,
  Loan,
  Achievement,
  ActivityLog
};