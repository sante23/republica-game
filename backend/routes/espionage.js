const express = require('express');
const { SpyMission, City, User, Research, MilitaryUnit } = require('../models');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');

const router = express.Router();

const MISSION_COSTS = {
  reconnaissance: { gold: 100 },
  sabotage: { gold: 300, iron: 50 },
  steal: { gold: 200 }
};

const MISSION_DURATIONS = {
  reconnaissance: 30 * 60 * 1000,  // 30 min
  sabotage: 60 * 60 * 1000,        // 1 hour
  steal: 45 * 60 * 1000            // 45 min
};

// Send a spy mission
router.post('/send', authenticate, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { fromCityId, targetCityId, missionType } = req.body;

    if (!MISSION_COSTS[missionType]) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid mission type' });
    }

    // Check espionage tech
    const hasTech = await Research.findOne({
      where: {
        cityId: fromCityId,
        techId: 'espionage',
        status: 'completed'
      },
      transaction
    });
    if (!hasTech) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Research Espionage technology first' });
    }

    const city = await City.findByPk(fromCityId, { transaction, lock: true });
    if (!city || city.userId !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Not your city' });
    }

    const targetCity = await City.findByPk(targetCityId, { transaction });
    if (!targetCity) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Target city not found' });
    }
    if (targetCity.userId === req.user.id) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot spy on your own city' });
    }

    // Check resources
    const newResources = { ...city.resources };
    for (const [resource, cost] of Object.entries(MISSION_COSTS[missionType])) {
      if ((newResources[resource] || 0) < cost) {
        await transaction.rollback();
        return res.status(400).json({ error: `Not enough ${resource}` });
      }
      newResources[resource] -= cost;
    }

    await city.update({ resources: newResources }, { transaction });

    const mission = await SpyMission.create({
      attackerId: req.user.id,
      targetCityId,
      missionType,
      completesAt: new Date(Date.now() + MISSION_DURATIONS[missionType])
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      mission: {
        id: mission.id,
        missionType,
        completesAt: mission.completesAt
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error sending spy mission:', error);
    res.status(500).json({ error: 'Failed to send spy mission' });
  }
});

// Check and get mission results
router.get('/missions', authenticate, async (req, res) => {
  try {
    const missions = await SpyMission.findAll({
      where: { attackerId: req.user.id },
      include: [{ model: City, as: 'targetCity', attributes: ['name'] }],
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    const now = new Date();
    for (const mission of missions) {
      if (mission.status === 'in_progress' && new Date(mission.completesAt) <= now) {
        // Resolve mission
        const successChance = 0.7; // 70% base success
        const success = Math.random() < successChance;

        if (success) {
          const targetCity = await City.findByPk(mission.targetCityId, {
            include: [{ model: User, as: 'owner', attributes: ['username', 'level'] }]
          });
          const targetUnits = await MilitaryUnit.findAll({
            where: { cityId: mission.targetCityId }
          });

          let result = {};
          if (mission.missionType === 'reconnaissance') {
            result = {
              cityName: targetCity.name,
              owner: targetCity.owner.username,
              ownerLevel: targetCity.owner.level,
              population: targetCity.population,
              happiness: targetCity.happiness,
              resources: targetCity.resources,
              buildings: targetCity.buildings,
              military: targetUnits.map(u => ({ type: u.unitType, quantity: u.quantity }))
            };
          } else if (mission.missionType === 'sabotage') {
            const newHappiness = Math.max(0, targetCity.happiness - 15);
            await targetCity.update({ happiness: newHappiness });
            result = { sabotaged: true, happinessReduced: 15 };
          } else if (mission.missionType === 'steal') {
            const stolenGold = Math.floor(targetCity.resources.gold * 0.1);
            const newResources = { ...targetCity.resources, gold: targetCity.resources.gold - stolenGold };
            await targetCity.update({ resources: newResources });
            result = { stolenGold };
          }

          mission.status = 'success';
          mission.result = result;
        } else {
          mission.status = Math.random() < 0.5 ? 'failed' : 'caught';
          mission.result = { message: mission.status === 'caught' ? 'Your spy was captured!' : 'Mission failed.' };
        }
        await mission.save();
      }
    }

    res.json(missions);
  } catch (error) {
    console.error('Error fetching spy missions:', error);
    res.status(500).json({ error: 'Failed to fetch missions' });
  }
});

module.exports = router;
