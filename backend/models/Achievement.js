const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ACHIEVEMENT_DEFS = {
  first_city: { name: 'City Founder', description: 'Found your first city', icon: 'building', xp: 50 },
  first_build: { name: 'Builder', description: 'Build your first structure', icon: 'hammer', xp: 25 },
  first_trade: { name: 'Merchant', description: 'Complete your first trade', icon: 'coins', xp: 50 },
  first_battle_win: { name: 'Warrior', description: 'Win your first battle', icon: 'sword', xp: 100 },
  first_election: { name: 'Politician', description: 'Register for an election', icon: 'vote', xp: 50 },
  first_research: { name: 'Scholar', description: 'Complete a research', icon: 'beaker', xp: 50 },
  first_alliance: { name: 'Diplomat', description: 'Form your first alliance', icon: 'handshake', xp: 50 },
  first_spy: { name: 'Spy Master', description: 'Complete a spy mission', icon: 'eye', xp: 75 },
  population_1k: { name: 'Growing Town', description: 'Reach 1,000 population', icon: 'users', xp: 100 },
  population_10k: { name: 'Thriving City', description: 'Reach 10,000 population', icon: 'users', xp: 250 },
  population_100k: { name: 'Metropolis', description: 'Reach 100,000 population', icon: 'users', xp: 500 },
  credits_10k: { name: 'Wealthy', description: 'Accumulate 10,000 credits', icon: 'coins', xp: 100 },
  credits_100k: { name: 'Tycoon', description: 'Accumulate 100,000 credits', icon: 'coins', xp: 300 },
  level_5: { name: 'Rising Star', description: 'Reach level 5', icon: 'star', xp: 0 },
  level_10: { name: 'Veteran', description: 'Reach level 10', icon: 'star', xp: 0 },
  level_25: { name: 'Legend', description: 'Reach level 25', icon: 'crown', xp: 0 },
  five_cities: { name: 'Empire Builder', description: 'Own 5 cities', icon: 'map', xp: 200 },
  win_election: { name: 'Elected Official', description: 'Win an election', icon: 'award', xp: 150 },
  ten_battles: { name: 'Battle Hardened', description: 'Fight 10 battles', icon: 'sword', xp: 200 },
  all_research: { name: 'Enlightened', description: 'Complete all research in a city', icon: 'beaker', xp: 500 },
};

const Achievement = sequelize.define('Achievement', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  achievementId: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  unlockedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  indexes: [
    { fields: ['userId', 'achievementId'], unique: true }
  ]
});

Achievement.DEFS = ACHIEVEMENT_DEFS;

module.exports = Achievement;
