const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Alliance = sequelize.define('Alliance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  player1Id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  player2Id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'rejected', 'broken'),
    defaultValue: 'pending'
  },
  proposedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  acceptedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'alliances',
  timestamps: true,
  underscored: true,
  updatedAt: false
});

module.exports = Alliance;
