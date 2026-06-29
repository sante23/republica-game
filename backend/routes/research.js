const express = require('express');
const { Research, City } = require('../models');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');
const { bumpQuests } = require('../services/questService');

const router = express.Router();
const TECH_TREE = Research.TECH_TREE;

// Get tech tree and research status for a city
router.get('/city/:cityId', authenticate, async (req, res) => {
  try {
    const city = await City.findByPk(req.params.cityId);
    if (!city || city.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not your city' });
    }

    const researches = await Research.findAll({
      where: { cityId: req.params.cityId }
    });

    // Check and complete finished research
    const now = new Date();
    for (const r of researches) {
      if (r.status === 'researching' && new Date(r.completesAt) <= now) {
        r.status = 'completed';
        await r.save();
      }
    }

    const researchMap = {};
    for (const r of researches) {
      researchMap[r.techId] = {
        status: r.status,
        startedAt: r.startedAt,
        completesAt: r.completesAt
      };
    }

    res.json({ techTree: TECH_TREE, researches: researchMap });
  } catch (error) {
    console.error('Error fetching research:', error);
    res.status(500).json({ error: 'Failed to fetch research' });
  }
});

// Start researching a technology
router.post('/start', authenticate, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { cityId, techId } = req.body;

    if (!TECH_TREE[techId]) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid technology' });
    }

    const city = await City.findByPk(cityId, { transaction, lock: true });
    if (!city || city.userId !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Not your city' });
    }

    // Require at least one Research Center
    if (!city.buildings.researchCenter || city.buildings.researchCenter < 1) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Build a Research Center first' });
    }

    // Check if already researched
    const existing = await Research.findOne({
      where: { cityId, techId },
      transaction
    });
    if (existing) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Already researching or completed' });
    }

    // Check if already researching something
    const inProgress = await Research.findOne({
      where: { cityId, status: 'researching' },
      transaction
    });
    if (inProgress) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Already researching another technology' });
    }

    const tech = TECH_TREE[techId];

    // Check prerequisites
    for (const req of tech.requires) {
      const prereq = await Research.findOne({
        where: { cityId, techId: req, status: 'completed' },
        transaction
      });
      if (!prereq) {
        await transaction.rollback();
        return res.status(400).json({ error: `Requires ${TECH_TREE[req].name} first` });
      }
    }

    // Check resources
    const newResources = { ...city.resources };
    for (const [resource, cost] of Object.entries(tech.cost)) {
      if ((newResources[resource] || 0) < cost) {
        await transaction.rollback();
        return res.status(400).json({ error: `Not enough ${resource}` });
      }
      newResources[resource] -= cost;
    }

    await city.update({ resources: newResources }, { transaction });

    const research = await Research.create({
      cityId,
      techId,
      completesAt: new Date(Date.now() + tech.time * 1000)
    }, { transaction });

    await transaction.commit();

    bumpQuests(req.user.id, 'research', 'any', 1, req.app.get('io'));

    res.json({
      success: true,
      research: {
        techId,
        name: tech.name,
        completesAt: research.completesAt
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error starting research:', error);
    res.status(500).json({ error: 'Failed to start research' });
  }
});

module.exports = router;
