const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Tech tree definition
const TECH_TREE = {
  agriculture: {
    name: 'Advanced Agriculture', cost: { gold: 200, food: 100 }, time: 1800,
    requires: [], effects: { foodProduction: 1.25 }, category: 'economy'
  },
  ironWorking: {
    name: 'Iron Working', cost: { gold: 300, iron: 150 }, time: 2400,
    requires: [], effects: { ironProduction: 1.25 }, category: 'economy'
  },
  masonry: {
    name: 'Masonry', cost: { gold: 250, stone: 200 }, time: 2000,
    requires: [], effects: { unlocks: ['walls'] }, category: 'military'
  },
  fortification: {
    name: 'Fortification', cost: { gold: 500, stone: 400, iron: 200 }, time: 3600,
    requires: ['masonry'], effects: { unlocks: ['towers'], defenseBonus: 1.1 }, category: 'military'
  },
  tactics: {
    name: 'Military Tactics', cost: { gold: 400 }, time: 3000,
    requires: [], effects: { attackBonus: 1.1 }, category: 'military'
  },
  siegecraft: {
    name: 'Siegecraft', cost: { gold: 600, iron: 300 }, time: 4000,
    requires: ['tactics'], effects: { siegeAttack: 1.3 }, category: 'military'
  },
  trade: {
    name: 'Trade Networks', cost: { gold: 350 }, time: 2200,
    requires: [], effects: { tradeRouteCapacity: 2 }, category: 'economy'
  },
  banking: {
    name: 'Banking', cost: { gold: 500 }, time: 3000,
    requires: ['trade'], effects: { goldProduction: 1.3 }, category: 'economy'
  },
  espionage: {
    name: 'Espionage', cost: { gold: 400 }, time: 2800,
    requires: [], effects: { unlocks: ['spies'] }, category: 'military'
  },
  advancedEspionage: {
    name: 'Advanced Espionage', cost: { gold: 700, iron: 100 }, time: 4000,
    requires: ['espionage'], effects: { spySuccess: 1.25 }, category: 'military'
  },
  colonization1: {
    name: 'Colonization', cost: { gold: 500, food: 300, wood: 200 }, time: 3600,
    requires: [], effects: { maxCities: 2 }, category: 'economy'
  },
  colonization2: {
    name: 'Advanced Colonization', cost: { gold: 2000, food: 1000, wood: 800, stone: 500 }, time: 7200,
    requires: ['colonization1'], effects: { maxCities: 3 }, category: 'economy'
  },
  colonization3: {
    name: 'Imperial Expansion', cost: { gold: 5000, food: 3000, iron: 1500, stone: 2000 }, time: 14400,
    requires: ['colonization2'], effects: { maxCities: 4 }, category: 'economy'
  }
};

const Research = sequelize.define('Research', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  cityId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  techId: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('researching', 'completed'),
    defaultValue: 'researching'
  },
  startedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  completesAt: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  indexes: [
    { fields: ['cityId', 'techId'], unique: true },
    { fields: ['status'] }
  ]
});

Research.TECH_TREE = TECH_TREE;

module.exports = Research;
