const express = require('express');
const { cache } = require('../config/redis');
const { User, City, Alliance, Battle } = require('../models');
const { authenticate } = require('../middleware/auth');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

const router = express.Router();

// Get top players by various metrics
router.get('/top/:metric', authenticate, async (req, res) => {
  try {
    const { metric } = req.params;
    const worldId = req.user.worldId || 1;
    const limit = parseInt(req.query.limit) || 50;

    let orderBy;
    let attributes = ['id', 'username', 'level', 'credits', 'reputation', 'experience', 'createdAt'];

    switch (metric) {
      case 'level':
        orderBy = [['level', 'DESC'], ['experience', 'DESC']];
        break;
      case 'credits':
        orderBy = [['credits', 'DESC']];
        break;
      case 'reputation':
        orderBy = [['reputation', 'DESC']];
        break;
      case 'experience':
        orderBy = [['experience', 'DESC']];
        break;
      default:
        orderBy = [['level', 'DESC'], ['experience', 'DESC']];
    }

    // Check cache first
    const cacheKey = `leaderboard:${worldId}:${metric}:${limit}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ leaderboard: cached, metric });
    }

    const users = await User.findAll({
      where: { worldId },
      attributes,
      order: orderBy,
      limit,
      include: [{
        model: City,
        as: 'cities',
        attributes: ['id', 'name', 'population', 'isCapital']
      }]
    });

    // Calculate additional stats for each user
    const leaderboard = users.map((user, index) => {
      const cities = user.cities || [];
      const totalPopulation = cities.reduce((sum, city) => sum + city.population, 0);
      const cityCount = cities.length;

      return {
        rank: index + 1,
        id: user.id,
        username: user.username,
        level: user.level,
        credits: user.credits,
        reputation: user.reputation,
        experience: user.experience,
        cityCount,
        totalPopulation,
        joinedAt: user.createdAt
      };
    });

    // Cache for 30 seconds
    await cache.set(cacheKey, leaderboard, 30);
    res.json({ leaderboard, metric });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get overall statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const worldId = req.user.worldId || 1;

    const [totalUsers, totalCities, stats] = await Promise.all([
      User.count({ where: { worldId } }),
      City.count({ where: { worldId } }),
      User.findOne({
        where: { worldId },
        attributes: [
          [sequelize.fn('AVG', sequelize.col('level')), 'avgLevel'],
          [sequelize.fn('MAX', sequelize.col('level')), 'maxLevel'],
          [sequelize.fn('SUM', sequelize.col('credits')), 'totalCredits'],
        ],
        raw: true
      })
    ]);

    // Get top player
    const topPlayer = await User.findOne({
      where: { worldId },
      attributes: ['username', 'level'],
      order: [['level', 'DESC'], ['experience', 'DESC']],
      limit: 1
    });

    res.json({
      stats: {
        totalUsers,
        totalCities,
        avgLevel: parseFloat(stats.avgLevel || 0).toFixed(1),
        maxLevel: stats.maxLevel || 0,
        totalCredits: stats.totalCredits || 0,
        topPlayer: topPlayer ? {
          username: topPlayer.username,
          level: topPlayer.level
        } : null
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Alliance rankings
router.get('/alliances', authenticate, async (req, res) => {
  try {
    const worldId = req.user.worldId || 1;

    // Get all active alliances
    const alliances = await Alliance.findAll({
      where: { status: 'active' },
      include: [
        { model: User, as: 'player1', attributes: ['id', 'username', 'level', 'credits', 'worldId'] },
        { model: User, as: 'player2', attributes: ['id', 'username', 'level', 'credits', 'worldId'] }
      ]
    });

    // Group alliances by player pairs and compute combined stats
    const allianceGroups = {};
    for (const alliance of alliances) {
      if (alliance.player1?.worldId !== worldId && alliance.player2?.worldId !== worldId) continue;

      const key = [alliance.player1Id, alliance.player2Id].sort().join('-');
      if (!allianceGroups[key]) {
        allianceGroups[key] = {
          players: [
            { username: alliance.player1?.username, level: alliance.player1?.level },
            { username: alliance.player2?.username, level: alliance.player2?.level }
          ],
          combinedLevel: (alliance.player1?.level || 0) + (alliance.player2?.level || 0),
          combinedCredits: (alliance.player1?.credits || 0) + (alliance.player2?.credits || 0),
          since: alliance.acceptedAt
        };
      }
    }

    // Get city counts and population for alliance members
    for (const key of Object.keys(allianceGroups)) {
      const [p1, p2] = key.split('-');
      const cities = await City.findAll({
        where: { userId: { [Op.in]: [p1, p2] }, worldId },
        attributes: ['population']
      });
      allianceGroups[key].totalPopulation = cities.reduce((s, c) => s + c.population, 0);
      allianceGroups[key].cityCount = cities.length;
    }

    const rankings = Object.values(allianceGroups)
      .sort((a, b) => (b.combinedLevel + b.totalPopulation / 1000) - (a.combinedLevel + a.totalPopulation / 1000))
      .map((a, i) => ({ rank: i + 1, ...a }));

    res.json({ alliances: rankings });
  } catch (error) {
    console.error('Error fetching alliance leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch alliance rankings' });
  }
});

module.exports = router;
