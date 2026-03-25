const express = require('express');
const { Achievement, User } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get all achievements for user
router.get('/my', authenticate, async (req, res) => {
  try {
    const unlocked = await Achievement.findAll({
      where: { userId: req.user.id },
      order: [['unlockedAt', 'DESC']]
    });

    const unlockedMap = {};
    for (const a of unlocked) {
      unlockedMap[a.achievementId] = a.unlockedAt;
    }

    const allAchievements = Object.entries(Achievement.DEFS).map(([id, def]) => ({
      id,
      ...def,
      unlocked: !!unlockedMap[id],
      unlockedAt: unlockedMap[id] || null
    }));

    res.json(allAchievements);
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Check and grant achievements (called internally or by client after actions)
router.post('/check', authenticate, async (req, res) => {
  try {
    const granted = await checkAndGrantAchievements(req.user);
    res.json({ granted });
  } catch (error) {
    console.error('Error checking achievements:', error);
    res.status(500).json({ error: 'Failed to check achievements' });
  }
});

async function checkAndGrantAchievements(user) {
  const { City, Battle, Alliance, Research, SpyMission, Market } = require('../models');
  const { Op } = require('sequelize');

  const granted = [];

  const checks = {
    first_city: async () => (await City.count({ where: { userId: user.id } })) >= 1,
    five_cities: async () => (await City.count({ where: { userId: user.id } })) >= 5,
    first_battle_win: async () => (await Battle.count({ where: { attackerId: user.id, outcome: 'attacker_win' } })) >= 1,
    ten_battles: async () => {
      const attacks = await Battle.count({ where: { attackerId: user.id } });
      const defenses = await Battle.count({ where: { defenderId: user.id } });
      return (attacks + defenses) >= 10;
    },
    first_alliance: async () => (await Alliance.count({
      where: { [Op.or]: [{ player1Id: user.id }, { player2Id: user.id }], status: 'active' }
    })) >= 1,
    first_trade: async () => (await Market.count({
      where: { [Op.or]: [{ sellerId: user.id }, { buyerId: user.id }], status: 'SOLD' }
    })) >= 1,
    population_1k: async () => {
      const cities = await City.findAll({ where: { userId: user.id }, attributes: ['population'] });
      return cities.reduce((s, c) => s + c.population, 0) >= 1000;
    },
    population_10k: async () => {
      const cities = await City.findAll({ where: { userId: user.id }, attributes: ['population'] });
      return cities.reduce((s, c) => s + c.population, 0) >= 10000;
    },
    population_100k: async () => {
      const cities = await City.findAll({ where: { userId: user.id }, attributes: ['population'] });
      return cities.reduce((s, c) => s + c.population, 0) >= 100000;
    },
    credits_10k: async () => user.credits >= 10000,
    credits_100k: async () => user.credits >= 100000,
    level_5: async () => user.level >= 5,
    level_10: async () => user.level >= 10,
    level_25: async () => user.level >= 25,
    first_research: async () => (await Research.count({ where: { cityId: { [Op.ne]: null }, status: 'completed' } })) >= 1,
    first_spy: async () => (await SpyMission.count({ where: { attackerId: user.id, status: 'success' } })) >= 1,
  };

  for (const [achievementId, checkFn] of Object.entries(checks)) {
    const exists = await Achievement.findOne({ where: { userId: user.id, achievementId } });
    if (exists) continue;

    try {
      const earned = await checkFn();
      if (earned) {
        await Achievement.create({ userId: user.id, achievementId });
        const def = Achievement.DEFS[achievementId];
        if (def?.xp > 0) {
          user.experience += def.xp;
          const requiredExp = user.level * 100 * 1.5;
          if (user.experience >= requiredExp) {
            user.level += 1;
            user.experience -= requiredExp;
          }
          await user.save();
        }
        granted.push({ id: achievementId, ...def });
      }
    } catch (e) {
      // Skip failed checks
    }
  }

  return granted;
}

module.exports = router;
module.exports.checkAndGrantAchievements = checkAndGrantAchievements;
