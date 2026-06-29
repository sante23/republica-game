const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A scheduled PvE pirate raid. Created in a "marching" state with arrivesAt in the
// future (so the player gets a warning window), resolved by the scheduler on a
// later tick. Plain UUID columns (no FK) to keep sync ordering simple.
const PirateRaid = sequelize.define('PirateRaid', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  worldId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  targetCityId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  covoCityId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  attackPower: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  arrivesAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('marching', 'resolved'),
    defaultValue: 'marching'
  },
  outcome: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  plunder: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'pirate_raids',
  indexes: [
    { fields: ['worldId', 'status'] },
    { fields: ['arrivesAt'] }
  ]
});

module.exports = PirateRaid;
