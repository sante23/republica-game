const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Cooperative PvE world boss ("Pirate Armada"): shared HP per world, players chip
// it down together, loot comes from a FINITE pre-seeded pool distributed by damage
// share (no per-capita minting). Per-user cooldown lives in `contributions`.
const WorldBoss = sequelize.define('WorldBoss', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  worldId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(80),
    allowNull: false,
    defaultValue: 'Pirate Armada'
  },
  maxHp: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  hp: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'defeated', 'expired'),
    defaultValue: 'active'
  },
  // { userId: { username, damage, lastHitAt } }
  contributions: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  // finite reward pool, distributed proportionally on defeat
  rewardPool: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  startsAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  endsAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  defeatedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'world_bosses',
  indexes: [{ fields: ['worldId', 'status'] }]
});

module.exports = WorldBoss;
