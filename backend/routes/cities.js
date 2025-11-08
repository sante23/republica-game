const express = require('express');
const { City, User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

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
    
    res.json({ cities });
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
    
    const userCitiesCount = await City.count({
      where: { userId: req.user.id }
    });
    
    const maxCities = Math.floor(req.user.level / 5) + 1;
    if (userCitiesCount >= maxCities) {
      return res.status(400).json({ 
        error: `Maximum ${maxCities} cities allowed at level ${req.user.level}` 
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
    
    res.status(201).json({ 
      message: 'City created successfully',
      city 
    });
  } catch (error) {
    console.error('Error creating city:', error);
    res.status(500).json({ error: 'Failed to create city' });
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
    
    res.json({ city });
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
    
    const buildingCosts = {
      houses: { wood: 50, stone: 25, gold: 10 },
      farms: { wood: 100, gold: 20 },
      sawmills: { stone: 50, gold: 30 },
      mines: { wood: 75, stone: 100, gold: 50 },
      markets: { wood: 100, stone: 100, gold: 100 }
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
    
    city.buildings[building] = (city.buildings[building] || 0) + quantity;
    
    city.changed('resources', true);
    city.changed('buildings', true);
    await city.save();
    
    const io = req.app.get('io');
    io.to(`city-${city.id}`).emit('city-updated', {
      resources: city.resources,
      buildings: city.buildings
    });
    
    res.json({ 
      message: 'Building constructed successfully',
      city: {
        resources: city.resources,
        buildings: city.buildings
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
    
    city.updateResources();
    await city.save();
    
    res.json({
      message: 'Production updated',
      resources: city.resources,
      population: city.population
    });
  } catch (error) {
    console.error('Error updating production:', error);
    res.status(500).json({ error: 'Failed to update production' });
  }
});

module.exports = router;