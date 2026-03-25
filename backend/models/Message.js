const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  senderId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  channel: {
    type: DataTypes.ENUM('global', 'private', 'alliance'),
    defaultValue: 'global'
  },
  recipientId: {
    type: DataTypes.UUID,
    allowNull: true // null for global/alliance
  },
  allianceId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  worldId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [1, 500]
    }
  }
}, {
  indexes: [
    { fields: ['channel', 'worldId'] },
    { fields: ['senderId'] },
    { fields: ['recipientId'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = Message;
