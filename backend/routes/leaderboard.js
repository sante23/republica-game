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
        { model: User, as: 'player1', attributes: ['id', 'username', 'level', 'credits', 'worldId', 'reputation'] },
        { model: User, as: 'player2', attributes: ['id', 'username', 'level', 'credits', 'worldId', 'reputation'] }
      ]
    });

    // Build alliance rankings
    const rankings = [];
    for (const alliance of alliances) {
      const p1 = alliance.player1;
      const p2 = alliance.player2;
      if (!p1 || !p2) continue;
      if (p1.worldId !== worldId && p2.worldId !== worldId) continue;

      const cities = await City.findAll({
        where: { userId: { [Op.in]: [p1.id, p2.id] } },
        attributes: ['population']
      });
      const totalPopulation = cities.reduce((s, c) => s + c.population, 0);

      rankings.push({
        players: [
          { username: p1.username, level: p1.level },
          { username: p2.username, level: p2.level }
        ],
        combinedLevel: p1.level + p2.level,
        combinedCredits: p1.credits + p2.credits,
        totalPopulation,
        cityCount: cities.length,
        since: alliance.acceptedAt
      });
    }

    rankings.sort((a, b) => (b.combinedLevel + b.totalPopulation / 1000) - (a.combinedLevel + a.totalPopulation / 1000));
    rankings.forEach((a, i) => a.rank = i + 1);

    res.json({ alliances: rankings });
  } catch (error) {
    console.error('Error fetching alliance leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch alliance rankings' });
  }
});

module.exports = router;
