const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GovernmentPosition = sequelize.define('GovernmentPosition', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  worldId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  position: {
    type: DataTypes.ENUM('president', 'governor', 'mayor', 'minister_economy', 'minister_defense'),
    allowNull: false
  },
  userId: {
    type: DataTypes.UUID,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  startDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  endDate: {
    type: DataTypes.DATE
  },
  appointedBy: {
    type: DataTypes.UUID,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  cityId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Cities',
      key: 'id'
    }
  },
  regionId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // Approval rating (0-100) that drifts with the city's happiness & tax burden.
  // Low approval surfaces a recall (impeachment) — governing is a loop, not a prize.
  approval: {
    type: DataTypes.INTEGER,
    defaultValue: 50
  },
  // Cooldown anchor for the mayor production-boost power (was read but never persisted).
  lastBoostAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Campaign promises carried over from the winning candidacy, each { id, label, kept }.
  promises: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  // An NPC may hold a seat (caretaker) when no human runs/wins — userId stays null.
  isNpc: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  npcName: {
    type: DataTypes.STRING(60),
    allowNull: true
  }
}, {
  tableName: 'government_positions',
  timestamps: false,
  underscored: true,
  indexes: [
    {
      fields: ['world_id', 'position']
    }
  ]
});

const GOVERNMENT_POSITIONS = {
  mayor: {
    name: 'Mayor',
    powers: ['setLocalTax', 'cityDevelopment', 'localPolicies'],
    term: 30 * 24 * 60 * 60 * 1000
  },
  governor: {
    name: 'Governor',
    powers: ['regionalTrade', 'infrastructure', 'regionalPolicies'],
    term: 45 * 24 * 60 * 60 * 1000
  },
  president: {
    name: 'President',
    powers: ['appointMinisters', 'vetoLaws', 'declareMartialLaw'],
    term: 30 * 24 * 60 * 60 * 1000
  },
  minister_economy: {
    name: 'Minister of Economy',
    powers: ['setTaxRate', 'adjustSpending', 'createTradePolicies'],
    term: 30 * 24 * 60 * 60 * 1000
  },
  minister_defense: {
    name: 'Minister of Defense',
    powers: ['declareWar', 'createAlliances', 'militaryBonus'],
    term: 30 * 24 * 60 * 60 * 1000
  }
};

module.exports = { GovernmentPosition, GOVERNMENT_POSITIONS };
