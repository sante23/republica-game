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
