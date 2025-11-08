const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Election = sequelize.define('Election', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  position: {
    type: DataTypes.ENUM('MAYOR', 'GOVERNOR', 'PRESIDENT'),
    allowNull: false
  },
  regionId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  cityId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  worldId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  registrationDeadline: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('UPCOMING', 'REGISTRATION', 'CAMPAIGN', 'VOTING', 'COMPLETED'),
    defaultValue: 'UPCOMING'
  },
  winnerId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  totalVotes: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  results: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  indexes: [
    {
      fields: ['worldId', 'position', 'status']
    },
    {
      fields: ['startDate', 'endDate']
    }
  ]
});

module.exports = Election;