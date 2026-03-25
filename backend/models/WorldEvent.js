const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WorldEvent = sequelize.define('WorldEvent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  worldId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('famine', 'gold_rush', 'plague', 'trade_boom', 'rebellion', 'harvest', 'earthquake', 'festival'),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  effects: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  affectedCityId: {
    type: DataTypes.UUID,
    allowNull: true // null = affects whole world
  },
  startsAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  endsAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  indexes: [
    { fields: ['worldId', 'active'] },
    { fields: ['endsAt'] }
  ]
});

// Event definitions for the random generator
WorldEvent.EVENT_TEMPLATES = {
  famine: {
    title: 'Famine Strikes!',
    description: 'Crops have failed across the region. Food production reduced.',
    effects: { foodProduction: 0.5 },
    duration: 4 * 60 * 60 * 1000 // 4 hours
  },
  gold_rush: {
    title: 'Gold Rush!',
    description: 'A new gold vein has been discovered! Gold production increased.',
    effects: { goldProduction: 2.0 },
    duration: 3 * 60 * 60 * 1000
  },
  plague: {
    title: 'Plague Outbreak',
    description: 'A disease spreads through the population. Happiness and population growth reduced.',
    effects: { happinessModifier: -15, populationGrowth: 0.5 },
    duration: 6 * 60 * 60 * 1000
  },
  trade_boom: {
    title: 'Trade Boom',
    description: 'Trade routes flourish! All resource production slightly increased.',
    effects: { allProduction: 1.2 },
    duration: 5 * 60 * 60 * 1000
  },
  rebellion: {
    title: 'Civil Unrest',
    description: 'Citizens demand better conditions. Happiness reduced but taxes increase.',
    effects: { happinessModifier: -20, taxIncome: 1.5 },
    duration: 3 * 60 * 60 * 1000
  },
  harvest: {
    title: 'Bountiful Harvest',
    description: 'Perfect weather conditions lead to an incredible harvest!',
    effects: { foodProduction: 2.0, happinessModifier: 10 },
    duration: 4 * 60 * 60 * 1000
  },
  earthquake: {
    title: 'Earthquake!',
    description: 'The ground shakes violently. Stone and iron production disrupted.',
    effects: { stoneProduction: 0.5, ironProduction: 0.5 },
    duration: 2 * 60 * 60 * 1000
  },
  festival: {
    title: 'Grand Festival',
    description: 'Citizens celebrate! Happiness soars and population grows.',
    effects: { happinessModifier: 25, populationGrowth: 1.5 },
    duration: 3 * 60 * 60 * 1000
  }
};

module.exports = WorldEvent;
