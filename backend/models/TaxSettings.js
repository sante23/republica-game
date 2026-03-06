const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TaxSettings = sequelize.define('TaxSettings', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  worldId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  taxRate: {
    type: DataTypes.FLOAT,
    defaultValue: 10.0,
    validate: {
      min: 0,
      max: 50
    }
  },
  socialSpending: {
    type: DataTypes.FLOAT,
    defaultValue: 30.0,
    validate: {
      min: 0,
      max: 100
    }
  },
  militarySpending: {
    type: DataTypes.FLOAT,
    defaultValue: 30.0,
    validate: {
      min: 0,
      max: 100
    }
  },
  infrastructureSpending: {
    type: DataTypes.FLOAT,
    defaultValue: 40.0,
    validate: {
      min: 0,
      max: 100
    }
  },
  updatedBy: {
    type: DataTypes.UUID,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
}, {
  tableName: 'tax_settings',
  timestamps: true,
  underscored: true,
  createdAt: false
});

module.exports = TaxSettings;
