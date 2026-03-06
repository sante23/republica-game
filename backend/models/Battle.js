const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Battle = sequelize.define('Battle', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  attackerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  defenderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  attackerCityId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Cities',
      key: 'id'
    }
  },
  defenderCityId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Cities',
      key: 'id'
    }
  },
  attackerUnits: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  defenderUnits: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  outcome: {
    type: DataTypes.ENUM('attacker_win', 'defender_win'),
    allowNull: false
  },
  attackerLosses: {
    type: DataTypes.JSONB
  },
  defenderLosses: {
    type: DataTypes.JSONB
  },
  resourcesPlundered: {
    type: DataTypes.JSONB
  }
}, {
  tableName: 'battles',
  timestamps: true,
  underscored: true,
  createdAt: 'battle_date',
  updatedAt: false
});

module.exports = Battle;
