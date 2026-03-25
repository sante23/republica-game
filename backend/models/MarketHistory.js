const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MarketHistory = sequelize.define('MarketHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  worldId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  resource: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  avgPrice: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  minPrice: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  maxPrice: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  volume: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  snapshotAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  indexes: [
    { fields: ['worldId', 'resource', 'snapshotAt'] }
  ]
});

module.exports = MarketHistory;
