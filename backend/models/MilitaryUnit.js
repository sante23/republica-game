const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MilitaryUnit = sequelize.define('MilitaryUnit', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  cityId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Cities',
      key: 'id'
    }
  },
  unitType: {
    type: DataTypes.ENUM('infantry', 'cavalry', 'archer', 'siege'),
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  attackPower: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  defensePower: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  maintenanceCost: {
    type: DataTypes.FLOAT,
    defaultValue: 1.0
  }
}, {
  tableName: 'military_units',
  timestamps: true,
  underscored: true
});

const UNIT_TYPES = {
  infantry: {
    name: 'Infantry',
    cost: { food: 50, gold: 20 },
    attackPower: 10,
    defensePower: 12,
    maintenanceCost: 0.5,
    trainingTime: 300
  },
  cavalry: {
    name: 'Cavalry',
    cost: { food: 80, gold: 50 },
    attackPower: 18,
    defensePower: 10,
    maintenanceCost: 1.5,
    trainingTime: 600
  },
  archer: {
    name: 'Archer',
    cost: { food: 40, wood: 30, gold: 25 },
    attackPower: 15,
    defensePower: 8,
    maintenanceCost: 0.8,
    trainingTime: 400
  },
  siege: {
    name: 'Siege Engine',
    cost: { wood: 100, stone: 80, gold: 100 },
    attackPower: 30,
    defensePower: 5,
    maintenanceCost: 3.0,
    trainingTime: 1200
  }
};

module.exports = { MilitaryUnit, UNIT_TYPES };
