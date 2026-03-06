const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TradeRoute = sequelize.define('TradeRoute', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  fromCityId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Cities',
      key: 'id'
    }
  },
  toCityId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Cities',
      key: 'id'
    }
  },
  resourceType: {
    type: DataTypes.ENUM('food', 'wood', 'stone', 'gold'),
    allowNull: false
  },
  quantityPerHour: {
    type: DataTypes.FLOAT,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'trade_routes',
  timestamps: true,
  underscored: true,
  updatedAt: false
});

module.exports = TradeRoute;
