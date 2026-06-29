const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// One row per EXECUTED trade (player market buy, NPC merchant buy/sell, contract
// delivery, AutoOrder match). The honest source of truth for price history — the
// snapshot aggregates these volume-weighted, instead of averaging unsold ASK listings.
const MarketTrade = sequelize.define('MarketTrade', {
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
  price: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'market_trades',
  timestamps: false,
  indexes: [
    { fields: ['worldId', 'resource', 'at'] }
  ]
});

module.exports = MarketTrade;
