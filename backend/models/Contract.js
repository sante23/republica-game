const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Contract = sequelize.define('Contract', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sellerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  buyerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  resource: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  quantityPerDelivery: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  pricePerUnit: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  deliveriesTotal: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  deliveriesCompleted: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  intervalHours: {
    type: DataTypes.INTEGER,
    defaultValue: 24
  },
  nextDeliveryAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('proposed', 'active', 'completed', 'cancelled', 'breached'),
    defaultValue: 'proposed'
  }
}, {
  indexes: [
    { fields: ['sellerId', 'status'] },
    { fields: ['buyerId', 'status'] },
    { fields: ['nextDeliveryAt'] }
  ]
});

module.exports = Contract;
