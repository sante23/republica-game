const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50]
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  experience: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  credits: {
    type: DataTypes.INTEGER,
    defaultValue: 1000
  },
  premiumCredits: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  reputation: {
    type: DataTypes.INTEGER,
    defaultValue: 50
  },
  worldId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  partyId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  corporationId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isPremium: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  lastLogin: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  registrationDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  tutorialCompleted: {
    type: DataTypes.JSONB,
    defaultValue: { welcome: false, foundCity: false, buildings: false, market: false, military: false, politics: false, completed: false }
  },
  protectedUntil: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // NPC actor flag (pirate cove owner, etc.) — excluded from leaderboard & elections.
  isBot: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  hooks: {
    beforeCreate: async (user) => {
      user.password = await bcrypt.hash(user.password, 10);
    }
  }
});

User.prototype.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

User.prototype.addExperience = function(amount) {
  this.experience += amount;
  const requiredExp = this.level * 100 * 1.5;
  if (this.experience >= requiredExp) {
    this.level += 1;
    this.experience -= requiredExp;
    return true;
  }
  return false;
};

module.exports = User;