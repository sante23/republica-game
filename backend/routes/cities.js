const express = require('express');
const { cache } = require('../config/redis');
const { City, User, Research } = require('../models');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const { logActivity } = require('./activity');
const { bumpQuests } = require('../services/questService');
const { buildSeconds, completeConstruction } = require('../services/construction');

const router = express.Router();

// Helper to round resource floats
function roundResources(city) {
  if (city.resources) {
    const rounded = {};
    for (const [key, val] of Object.entries(city.resources)) {
      rounded[key] = Math.round(val * 100) / 100;
    }
    city.resources = rounded;
  }
  return city;
}

router.get('/my', authenticate, async (req, res) => {
  try {
    const cities = await City.findAll({
      where: { userId: req.user.id },
      include: [{
        model: User,
        as: 'owner',
        attributes: ['username', 'level']
      }]
    });

    // Finish any constructions whose timers elapsed.
    for (const c of cities) {
      const done = completeConstruction(c);
      if (done) { await c.save(); bumpQuests(req.user.id, 'build', done, 1, req.app.get('io')); }
    }

    const cleaned = cities.map(c => { const j = c.toJSON(); roundResources(j); return j; });
    res.json({ cities: cleaned });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

router.post('/create', [
  authenticate,
  body('name').isLength({ min: 3, max: 100 }).trim(),
  body('x').isInt(),
  body('y').isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { name, x, y } = req.body;
    
    const existingCity = await City.findOne({
      where: {
        worldId: req.user.worldId,
        x,
        y
      }
    });
    
    if (existingCity) {
      return res.status(400).json({ error: 'Location already occupied' });
    }
    
    const userCities = await City.findAll({
      where: { userId: req.user.id },
      attributes: ['id']
    });
    const userCitiesCount = userCities.length;

    // Max cities based on colonization research (1 free + 1 per colonization tech)
    let maxCities = 1; // first city is always free
    if (userCitiesCount > 0) {
      const cityIds = userCities.map(c => c.id);
      const colonizationTechs = ['colonization1', 'colonization2', 'colonization3'];
      const completedColonizations = await Research.count({
        where: {
          cityId: cityIds,
          techId: colonizationTechs,
          status: 'completed'
        }
      });
      maxCities = 1 + completedColonizations;
    }

    if (userCitiesCount >= maxCities) {
      const nextTech = ['colonization1', 'colonization2', 'colonization3'][userCitiesCount - 1];
      const techName = nextTech ? Research.TECH_TREE[nextTech]?.name : 'max reached';
      return res.status(400).json({
        error: `Maximum ${maxCities} cities. Research "${techName}" to unlock more.`
      });
    }
    
    const city = await City.create({
      userId: req.user.id,
      name,
      x,
      y,
      worldId: req.user.worldId || 1,
      isCapital: userCitiesCount === 0
    });
    
    const io = req.app.get('io');
    io.to(`world-${city.worldId}`).emit('new-city', {
      id: city.id,
      name: city.name,
      x: city.x,
      y: city.y,
      owner: req.user.username
    });
    
    logActivity(city.worldId, 'city_founded',
      `${req.user.username} founded the city of ${city.name}`,
      req.user.id, null, { cityId: city.id, x: city.x, y: city.y });

    res.status(201).json({
      message: 'City created successfully',
      city
    });
  } catch (error) {
    console.error('Error creating city:', error);
    res.status(500).json({ error: 'Failed to create city' });
  }
});


// Get all cities in the world (for world map)
router.get("/world", authenticate, async (req, res) => {
  try {
    const worldId = req.user.worldId || 1;
    const cacheKey = `world-cities:${worldId}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ cities: cached });
    }

    const cities = await City.findAll({
      where: { worldId },
      include: [{
        model: User,
        as: "owner",
        attributes: ["username", "level"]
      }],
      order: [["population", "DESC"]],
      limit: 500
    });
    
    await cache.set(cacheKey, cities, 30);
    res.json({ cities });
  } catch (error) {
    console.error("Error fetching world cities:", error);
    res.status(500).json({ error: "Failed to fetch world cities" });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const city = await City.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'owner',
        attributes: ['username', 'level', 'reputation']
      }]
    });
    
    if (!city) {
      return res.status(404).json({ error: 'City not found' });
    }

    // Owner-only: finish any construction whose timer elapsed before returning.
    if (city.userId === req.user.id) {
      const done = completeConstruction(city);
      if (done) {
        await city.save();
        const io = req.app.get('io');
        if (io) io.to(`city-${city.id}`).emit('city-updated', { resources: city.resources, buildings: city.buildings, construction: null });
        bumpQuests(req.user.id, 'build', done, 1, io);
      }
    }

    // Hide sensitive data for non-owners
    if (city.userId !== req.user.id) {
      const publicCity = {
        id: city.id,
        name: city.name,
        x: city.x,
        y: city.y,
        population: city.population,
        isCapital: city.isCapital,
        owner: city.owner
      };
      return res.json({ city: publicCity });
    }

    const cityJson = city.toJSON();
    cityJson.storageCap = 10000 + (city.buildings?.houses || 0) * 2000 + (city.buildings?.townHall || 0) * 10000;
    res.json({ city: cityJson });
  } catch (error) {
    console.error('Error fetching city:', error);
    res.status(500).json({ error: 'Failed to fetch city' });
  }
});

router.put('/:id/build', [
  authenticate,
  body('building').notEmpty(),
  body('quantity').isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { building, quantity } = req.body;
    
    const city = await City.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!city) {
      return res.status(404).json({ error: 'City not found or unauthorized' });
    }

    // If a previous construction has finished, apply it now (frees the build slot).
    const justFinished = completeConstruction(city);
    if (justFinished) {
      await city.save();
      bumpQuests(req.user.id, 'build', justFinished, 1, req.app.get('io'));
    }
    // Only one construction at a time per city.
    if (city.construction) {
      return res.status(400).json({
        error: `Already building ${city.construction.building}. Wait for it to finish.`,
        construction: city.construction
      });
    }

    const buildingCosts = {
      houses: { wood: 50, stone: 25, gold: 10 },
      farms: { wood: 100, gold: 20 },
      sawmills: { stone: 50, gold: 30 },
      mines: { wood: 75, stone: 100, gold: 50 },
      markets: { wood: 100, stone: 100, gold: 100 },
      walls: { stone: 200, iron: 100, gold: 75 },
      towers: { stone: 150, iron: 150, gold: 100 },
      researchCenter: { wood: 150, stone: 200, iron: 100, gold: 200 }
    };
    
    const cost = buildingCosts[building];
    if (!cost) {
      return res.status(400).json({ error: 'Invalid building type' });
    }
    
    for (const [resource, amount] of Object.entries(cost)) {
      const required = amount * quantity;
      if (city.resources[resource] < required) {
        return res.status(400).json({ 
          error: `Insufficient ${resource}. Need ${required}, have ${city.resources[resource]}` 
        });
      }
    }
    
    for (const [resource, amount] of Object.entries(cost)) {
      city.resources[resource] -= amount * quantity;
    }

    // Start a timed, incremental construction instead of building instantly.
    // Resources are spent now; the building is added when the timer elapses.
    const level = city.buildings[building] || 0;
    const seconds = buildSeconds(level);
    const now = new Date();
    city.construction = {
      building,
      quantity,
      startedAt: now.toISOString(),
      completesAt: new Date(now.getTime() + seconds * 1000).toISOString()
    };

    city.changed('resources', true);
    city.changed('construction', true);
    await city.save();

    const io = req.app.get('io');
    io.to(`city-${city.id}`).emit('city-updated', {
      resources: city.resources,
      buildings: city.buildings,
      construction: city.construction
    });

    res.json({
      message: 'Construction started',
      city: {
        resources: city.resources,
        buildings: city.buildings,
        construction: city.construction
      }
    });
  } catch (error) {
    console.error('Error building:', error);
    res.status(500).json({ error: 'Failed to construct building' });
  }
});

router.post('/:id/update-production', authenticate, async (req, res) => {
  try {
    const city = await City.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!city) {
      return res.status(404).json({ error: 'City not found or unauthorized' });
    }
    
    // Accrual is owned by the game scheduler (per-hour rates applied each tick).
    // This endpoint NO LONGER mints resources — doing so double-counted with the
    // scheduler and let a client mint by spamming it. It now returns a snapshot.
    const roundedResources = {};
    for (const [key, val] of Object.entries(city.resources)) {
      roundedResources[key] = Math.round(val * 100) / 100;
    }
    res.json({
      message: 'Snapshot',
      resources: roundedResources,
      production: city.production,
      population: city.population
    });
  } catch (error) {
    console.error('Error updating production:', error);
    res.status(500).json({ error: 'Failed to update production' });
  }
});

module.exports = router;
