const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Market = sequelize.define('Market', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sellerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  cityId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Cities',
      key: 'id'
    }
  },
  resource: {
    type: DataTypes.STRING,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  pricePerUnit: {
    type: DataTypes.FLOAT,
    allowNull: false,
    validate: {
      min: 0.01
    }
  },
  type: {
    type: DataTypes.ENUM('INSTANT', 'AUCTION', 'CONTRACT'),
    defaultValue: 'INSTANT'
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED'),
    defaultValue: 'ACTIVE'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  buyerId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  worldId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  indexes: [
    {
      fields: ['worldId', 'resource', 'status']
    },
    {
      fields: ['sellerId']
    },
    {
      fields: ['cityId']
    },
    {
      fields: ['status', 'expiresAt']
    }
  ]
});

module.exports = Market;