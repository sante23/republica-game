const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
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
  type: {
    type: DataTypes.ENUM(
      'ELECTION_NEW', 'ELECTION_RESULT',
      'MARKET_SOLD', 'MARKET_BOUGHT',
      'BATTLE_ATTACK', 'BATTLE_DEFENSE',
      'CITY_PRODUCTION', 'CITY_HAPPINESS',
      'LEVEL_UP', 'SYSTEM'
    ),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  data: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'notifications',
  underscored: true,
  indexes: [
    { fields: ['user_id', 'read'] },
    { fields: ['created_at'] }
  ]
});

module.exports = Notification;
