const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AutoOrder = sequelize.define('AutoOrder', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  worldId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  resourceType: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  orderType: {
    type: DataTypes.ENUM('buy', 'sell'),
    allowNull: false
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  filled: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'auto_orders',
  timestamps: true,
  underscored: true,
  updatedAt: false
});

module.exports = AutoOrder;
