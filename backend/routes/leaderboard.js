const express = require('express');
const { User, City } = require('../models');
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

module.exports = router;
