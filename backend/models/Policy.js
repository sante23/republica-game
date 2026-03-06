const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Policy = sequelize.define('Policy', {
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
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  policyType: {
    type: DataTypes.ENUM('economic', 'military', 'social'),
    allowNull: false
  },
  effects: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('proposed', 'active', 'rejected', 'expired'),
    defaultValue: 'proposed'
  },
  proposedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  votesFor: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  votesAgainst: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  activatedAt: {
    type: DataTypes.DATE
  },
  expiresAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'policies',
  timestamps: true,
  underscored: true,
  updatedAt: false
});

module.exports = Policy;
