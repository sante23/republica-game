const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const QUEST_TEMPLATES = [
  { id: 'build_farms', title: 'Expand Agriculture', description: 'Build 2 Farms', type: 'build', target: 'farms', required: 2, reward: { gold: 100, xp: 50 } },
  { id: 'build_mines', title: 'Mining Operation', description: 'Build 1 Mine', type: 'build', target: 'mines', required: 1, reward: { gold: 150, xp: 75 } },
  { id: 'build_houses', title: 'Housing Program', description: 'Build 3 Houses', type: 'build', target: 'houses', required: 3, reward: { gold: 80, xp: 40 } },
  { id: 'build_markets', title: 'Commerce Boost', description: 'Build 1 Market', type: 'build', target: 'markets', required: 1, reward: { gold: 200, xp: 80 } },
  { id: 'build_sawmills', title: 'Lumber Industry', description: 'Build 2 Sawmills', type: 'build', target: 'sawmills', required: 2, reward: { gold: 120, xp: 60 } },
  { id: 'sell_food', title: 'Food Trader', description: 'Sell 200 food on the market', type: 'sell', target: 'food', required: 200, reward: { gold: 150, xp: 60 } },
  { id: 'sell_wood', title: 'Timber Export', description: 'Sell 150 wood on the market', type: 'sell', target: 'wood', required: 150, reward: { gold: 120, xp: 50 } },
  { id: 'sell_stone', title: 'Stone Dealer', description: 'Sell 100 stone on the market', type: 'sell', target: 'stone', required: 100, reward: { gold: 130, xp: 55 } },
  { id: 'buy_resource', title: 'Market Buyer', description: 'Buy any resource from the market', type: 'buy', target: 'any', required: 1, reward: { gold: 100, xp: 40 } },
  { id: 'train_infantry', title: 'Military Draft', description: 'Train 20 infantry', type: 'train', target: 'infantry', required: 20, reward: { gold: 200, xp: 80 } },
  { id: 'train_archers', title: 'Archer Training', description: 'Train 10 archers', type: 'train', target: 'archer', required: 10, reward: { gold: 180, xp: 70 } },
  { id: 'train_cavalry', title: 'Cavalry Corps', description: 'Train 5 cavalry', type: 'train', target: 'cavalry', required: 5, reward: { gold: 250, xp: 90 } },
  { id: 'research_tech', title: 'Scientific Progress', description: 'Start a technology research', type: 'research', target: 'any', required: 1, reward: { gold: 300, xp: 100 } },
  { id: 'accumulate_gold', title: 'Gold Hoarder', description: 'Have 2000+ gold in any city', type: 'accumulate', target: 'gold', required: 2000, reward: { gold: 100, xp: 50 } },
  { id: 'accumulate_pop', title: 'Population Boom', description: 'Reach 500+ population in any city', type: 'accumulate', target: 'population', required: 500, reward: { gold: 150, xp: 60 } },
];

const DailyQuest = sequelize.define('DailyQuest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  questTemplateId: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  required: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  rewardClaimed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  reward: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  indexes: [
    { fields: ['userId', 'expiresAt'] },
    { fields: ['userId', 'questTemplateId', 'expiresAt'] }
  ]
});

DailyQuest.QUEST_TEMPLATES = QUEST_TEMPLATES;

module.exports = DailyQuest;
