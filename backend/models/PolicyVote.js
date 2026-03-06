const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PolicyVote = sequelize.define('PolicyVote', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  policyId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'policies',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  vote: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  }
}, {
  tableName: 'policy_votes',
  timestamps: true,
  underscored: true,
  createdAt: 'voted_at',
  updatedAt: false,
  indexes: [
    {
      unique: true,
      fields: ['policy_id', 'user_id']
    }
  ]
});

module.exports = PolicyVote;
