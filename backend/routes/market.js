const express = require('express');
const { cache } = require('../config/redis');
const { Market, City, User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');

const router = express.Router();

router.get('/listings', authenticate, async (req, res) => {
  try {
    const { resource, minPrice, maxPrice, cityId } = req.query;
    const worldId = req.user.worldId || 1;
    
    const where = {
      worldId,
      status: 'ACTIVE'
    };
    
    if (resource) where.resource = resource;
    if (cityId) where.cityId = cityId;
    if (minPrice || maxPrice) {
      where.pricePerUnit = {};
      if (minPrice) where.pricePerUnit[Op.gte] = parseFloat(minPrice);
      if (maxPrice) where.pricePerUnit[Op.lte] = parseFloat(maxPrice);
    }
    
    const listings = await Market.findAll({
      where,
      include: [
        {
          model: User,
          as: 'seller',
          attributes: ['username', 'reputation']
        },
        {
          model: City,
          as: 'city',
          attributes: ['name', 'x', 'y']
        }
      ],
      order: [['pricePerUnit', 'ASC'], ['createdAt', 'DESC']],
      limit: 50
    });
    
    res.json({ listings });
  } catch (error) {
    console.error('Error fetching market listings:', error);
    res.status(500).json({ error: 'Failed to fetch market listings' });
  }
});

router.post('/sell', [
  authenticate,
  body('cityId').isUUID(),
  body('resource').notEmpty(),
  body('quantity').isInt({ min: 1 }),
  body('pricePerUnit').isFloat({ min: 0.01 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { cityId, resource, quantity, pricePerUnit } = req.body;
    
    const city = await City.findOne({
      where: { id: cityId, userId: req.user.id }
    });
    
    if (!city) {
      return res.status(404).json({ error: 'City not found or unauthorized' });
    }
    
    if (!city.resources[resource] || city.resources[resource] < quantity) {
      return res.status(400).json({ error: 'Insufficient resources' });
    }
    
    city.resources[resource] -= quantity;
    city.changed('resources', true);
    await city.save();
    
    const listing = await Market.create({
      sellerId: req.user.id,
      cityId: city.id,
      resource,
      quantity,
      pricePerUnit,
      worldId: req.user.worldId || 1,
      type: 'INSTANT',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    
    const io = req.app.get('io');
    io.to(`world-${listing.worldId}`).emit('new-market-listing', {
      id: listing.id,
      resource,
      quantity,
      pricePerUnit,
      seller: req.user.username,
      city: city.name
    });
    
    await cache.delPattern('market-listings:*');
    res.status(201).json({
      message: 'Listing created successfully',
      listing
    });
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

router.post('/buy/:id', authenticate, async (req, res) => {
  const transaction = await require('../config/database').transaction();
  try {
    const listing = await Market.findOne({
      where: {
        id: req.params.id,
        status: 'ACTIVE'
      },
      include: [{
        model: City,
        as: 'city'
      }],
      lock: true,
      transaction
    });
    
    if (!listing) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Listing not found or no longer available' });
    }
    
    if (listing.sellerId === req.user.id) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot buy your own listing' });
    }
    
    const totalCost = listing.quantity * listing.pricePerUnit;
    
    // Re-fetch user with lock to prevent race condition
    const buyer = await User.findByPk(req.user.id, { lock: true, transaction });
    
    if (buyer.credits < totalCost) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: `Insufficient credits. Need ${totalCost}, have ${buyer.credits}` 
      });
    }
    
    const buyerCity = await City.findOne({
      where: { userId: req.user.id },
      order: [['isCapital', 'DESC']],
      lock: true,
      transaction
    });
    
    if (!buyerCity) {
      await transaction.rollback();
      return res.status(400).json({ error: 'You need a city to buy resources' });
    }
    
    buyer.credits -= totalCost;
    await buyer.save({ transaction });
    
    const seller = await User.findByPk(listing.sellerId, { lock: true, transaction });
    seller.credits += totalCost;
    await seller.save({ transaction });
    
    buyerCity.resources[listing.resource] = 
      (buyerCity.resources[listing.resource] || 0) + listing.quantity;
    buyerCity.changed('resources', true);
    await buyerCity.save({ transaction });
    
    listing.status = 'SOLD';
    listing.buyerId = req.user.id;
    listing.completedAt = new Date();
    await listing.save({ transaction });
    
    await transaction.commit();

    // Notify seller
    const notifier = req.app.get('notificationService');
    if (notifier) {
      await notifier.send(listing.sellerId, 'MARKET_SOLD',
        'Item sold!',
        `Your ${listing.quantity} ${listing.resource} was bought by ${buyer.username} for ${totalCost} credits.`,
        { listingId: listing.id, resource: listing.resource, quantity: listing.quantity, totalCost }
      );
    }
    
    const io = req.app.get('io');
    io.to(`world-${listing.worldId}`).emit('market-transaction', {
      listingId: listing.id,
      resource: listing.resource,
      quantity: listing.quantity,
      price: totalCost,
      seller: seller.username,
      buyer: buyer.username
    });
    
    res.json({
      message: 'Purchase successful',
      transaction: {
        resource: listing.resource,
        quantity: listing.quantity,
        totalCost,
        newCredits: buyer.credits,
        newResources: buyerCity.resources[listing.resource]
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error buying listing:', error);
    res.status(500).json({ error: 'Failed to complete purchase' });
  }
});

router.delete('/cancel/:id', authenticate, async (req, res) => {
  try {
    const listing = await Market.findOne({
      where: {
        id: req.params.id,
        sellerId: req.user.id,
        status: 'ACTIVE'
      },
      include: [{
        model: City,
        as: 'city'
      }]
    });
    
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found or unauthorized' });
    }
    
    const city = await City.findByPk(listing.cityId);
    city.resources[listing.resource] = 
      (city.resources[listing.resource] || 0) + listing.quantity;
    city.changed('resources', true);
    await city.save();
    
    listing.status = 'CANCELLED';
    await listing.save();
    
    res.json({
      message: 'Listing cancelled successfully',
      returnedResources: {
        resource: listing.resource,
        quantity: listing.quantity
      }
    });
  } catch (error) {
    console.error('Error cancelling listing:', error);
    res.status(500).json({ error: 'Failed to cancel listing' });
  }
});

// Get price history for a resource
router.get('/history/:resource', authenticate, async (req, res) => {
  try {
    const { MarketHistory } = require('../models');
    const history = await MarketHistory.findAll({
      where: {
        worldId: req.user.worldId || 1,
        resource: req.params.resource
      },
      order: [['snapshotAt', 'ASC']],
      limit: 168 // 7 days of hourly snapshots
    });
    res.json(history);
  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

module.exports = router;