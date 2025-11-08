const express = require('express');
const { City } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const RESOURCE_INFO = {
  food: { name: 'Food', icon: '🌾', basePrice: 1 },
  wood: { name: 'Wood', icon: '🪵', basePrice: 2 },
  stone: { name: 'Stone', icon: '🪨', basePrice: 3 },
  iron: { name: 'Iron', icon: '⚙️', basePrice: 5 },
  gold: { name: 'Gold', icon: '🪙', basePrice: 10 },
  energy: { name: 'Energy', icon: '⚡', basePrice: 4 }
};

router.get('/info', authenticate, (req, res) => {
  res.json({ resources: RESOURCE_INFO });
});

router.get('/prices', authenticate, async (req, res) => {
  try {
    const worldId = req.user.worldId || 1;
    
    const prices = {};
    for (const resource in RESOURCE_INFO) {
      const fluctuation = 0.8 + Math.random() * 0.4;
      prices[resource] = Math.round(RESOURCE_INFO[resource].basePrice * fluctuation * 100) / 100;
    }
    
    res.json({ prices, worldId });
  } catch (error) {
    console.error('Error fetching prices:', error);
    res.status(500).json({ error: 'Failed to fetch resource prices' });
  }
});

router.post('/transfer', authenticate, async (req, res) => {
  try {
    const { fromCityId, toCityId, resource, amount } = req.body;
    
    if (!fromCityId || !toCityId || !resource || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid transfer parameters' });
    }
    
    const [fromCity, toCity] = await Promise.all([
      City.findOne({ where: { id: fromCityId, userId: req.user.id } }),
      City.findOne({ where: { id: toCityId, userId: req.user.id } })
    ]);
    
    if (!fromCity || !toCity) {
      return res.status(404).json({ error: 'Cities not found or unauthorized' });
    }
    
    if (fromCity.resources[resource] < amount) {
      return res.status(400).json({ error: 'Insufficient resources' });
    }
    
    fromCity.resources[resource] -= amount;
    toCity.resources[resource] = (toCity.resources[resource] || 0) + amount;
    
    fromCity.changed('resources', true);
    toCity.changed('resources', true);
    
    await Promise.all([fromCity.save(), toCity.save()]);
    
    const io = req.app.get('io');
    io.to(`city-${fromCityId}`).emit('resources-updated', fromCity.resources);
    io.to(`city-${toCityId}`).emit('resources-updated', toCity.resources);
    
    res.json({
      message: 'Transfer successful',
      fromCity: { id: fromCity.id, resources: fromCity.resources },
      toCity: { id: toCity.id, resources: toCity.resources }
    });
  } catch (error) {
    console.error('Error transferring resources:', error);
    res.status(500).json({ error: 'Failed to transfer resources' });
  }
});

module.exports = router;