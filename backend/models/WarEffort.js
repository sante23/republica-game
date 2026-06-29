const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Cooperative resource drive: the world pools a resource toward a goal; hitting it
// fires a server-wide buff (festival WorldEvent). Gives pacifists a role and links
// economy to a shared, recurring server heartbeat.
const WarEffort = sequelize.define('WarEffort', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  worldId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(120),
    allowNull: false,
    defaultValue: 'Relief Fund'
  },
  resource: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  goal: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  contributed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // { userId: { username, amount } }
  contributors: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'expired'),
    defaultValue: 'active'
  },
  startsAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  endsAt: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'war_efforts',
  indexes: [{ fields: ['worldId', 'status'] }]
});

module.exports = WarEffort;
