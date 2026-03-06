const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ImpeachmentVote = sequelize.define('ImpeachmentVote', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  worldId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  targetUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  targetPosition: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  reason: {
    type: DataTypes.TEXT
  },
  initiatedBy: {
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
  status: {
    type: DataTypes.ENUM('voting', 'passed', 'failed'),
    defaultValue: 'voting'
  },
  resolvedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'impeachment_votes',
  timestamps: true,
  underscored: true,
  updatedAt: false
});

module.exports = ImpeachmentVote;
