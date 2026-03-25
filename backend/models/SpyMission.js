const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SpyMission = sequelize.define('SpyMission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  attackerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  targetCityId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  missionType: {
    type: DataTypes.ENUM('reconnaissance', 'sabotage', 'steal'),
    defaultValue: 'reconnaissance'
  },
  status: {
    type: DataTypes.ENUM('in_progress', 'success', 'failed', 'caught'),
    defaultValue: 'in_progress'
  },
  result: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  completesAt: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  indexes: [
    { fields: ['attackerId'] },
    { fields: ['targetCityId'] },
    { fields: ['status'] }
  ]
});

module.exports = SpyMission;
