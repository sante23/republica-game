const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const City = sequelize.define('City', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [3, 100]
    }
  },
  x: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  y: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  population: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  happiness: {
    type: DataTypes.FLOAT,
    defaultValue: 50,
    validate: {
      min: 0,
      max: 100
    }
  },
  taxRate: {
    type: DataTypes.FLOAT,
    defaultValue: 10,
    validate: {
      min: 0,
      max: 50
    }
  },
  developmentLevel: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 10
    }
  },
  regionId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  worldId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  isCapital: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  resources: {
    type: DataTypes.JSONB,
    defaultValue: {
      food: 1000,
      wood: 500,
      stone: 400,
      iron: 200,
      gold: 500,
      energy: 200
    }
  },
  buildings: {
    type: DataTypes.JSONB,
    defaultValue: {
      townHall: 1,
      houses: 10,
      farms: 2,
      sawmills: 1,
      mines: 0,
      markets: 1,
      barracks: 0,
      researchCenter: 0
    }
  },
  production: {
    type: DataTypes.JSONB,
    defaultValue: {
      food: 10,
      wood: 5,
      stone: 2,
      iron: 1,
      gold: 0,
      energy: 5
    }
  },
  consumption: {
    type: DataTypes.JSONB,
    defaultValue: {
      food: 5,
      energy: 3
    }
  }
}, {
  indexes: [
    {
      fields: ['worldId', 'x', 'y'],
      unique: true
    },
    {
      fields: ['userId']
    },
    {
      fields: ['regionId']
    }
  ]
});

City.prototype.calculateProduction = function() {
  const devBonus = 1 + this.developmentLevel * 0.1;
  const production = {
    food: Math.round(this.buildings.farms * 5 * devBonus),
    wood: Math.round(this.buildings.sawmills * 3 * devBonus),
    stone: Math.round(this.buildings.mines * 2 * devBonus),
    iron: Math.round(this.buildings.mines * 1 * devBonus),
    gold: Math.round((this.buildings.markets || 0) * 3 * devBonus + (this.buildings.mines || 0) * 0.5 * devBonus),
    energy: Math.round((this.buildings.houses || 0) * 0.5 * devBonus)
  };
  return production;
};

City.prototype.updateResources = function() {
  const production = this.calculateProduction();
  const consumption = this.consumption;
  
  for (const resource in production) {
    this.resources[resource] = (this.resources[resource] || 0) + production[resource];
  }
  
  for (const resource in consumption) {
    this.resources[resource] = Math.max(0, (this.resources[resource] || 0) - consumption[resource]);
  }
  
  this.population = Math.floor(this.population * (1 + (this.happiness - 50) / 1000));
  
  this.changed('resources', true);
  this.changed('population', true);
};

module.exports = City;