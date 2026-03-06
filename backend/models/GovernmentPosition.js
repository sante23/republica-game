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
    type: DataTypes.ENUM('president', 'minister_economy', 'minister_defense'),
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
  }
}, {
  tableName: 'government_positions',
  timestamps: false,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['world_id', 'position']
    }
  ]
});

const GOVERNMENT_POSITIONS = {
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
