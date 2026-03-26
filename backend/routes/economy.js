const express = require('express');
const { TradeRoute, AutoOrder, TaxSettings, City, User, GovernmentPosition } = require('../models');
const { authenticate } = require('../middleware/auth');
const sequelize = require('../config/database');
const { Op } = require('sequelize');

const router = express.Router();

// ============================================
// TRADE ROUTES
// ============================================

// Get trade routes for a city
router.get('/trade-routes/city/:cityId', authenticate, async (req, res) => {
  try {
    const { cityId } = req.params;

    // Verify ownership
    const city = await City.findByPk(cityId);
    if (!city) {
      return res.status(404).json({ error: 'City not found' });
    }

    if (city.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not your city' });
    }

    const routes = await TradeRoute.findAll({
      where: {
        [Op.or]: [
          { fromCityId: cityId },
          { toCityId: cityId }
        ]
      },
      include: [
        { model: City, as: 'fromCity', attributes: ['name'] },
        { model: City, as: 'toCity', attributes: ['name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(routes);
  } catch (error) {
    console.error('Error fetching trade routes:', error);
    res.status(500).json({ error: 'Failed to fetch trade routes' });
  }
});

// Create trade route
router.post('/trade-routes', authenticate, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { fromCityId, toCityId, resourceType, quantityPerHour } = req.body;

    if (fromCityId === toCityId) {
      return res.status(400).json({ error: 'Cannot create trade route to same city' });
    }

    if (!['food', 'wood', 'stone', 'gold'].includes(resourceType)) {
      return res.status(400).json({ error: 'Invalid resource type' });
    }

    if (quantityPerHour <= 0) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    // Verify ownership of source city
    const fromCity = await City.findByPk(fromCityId, { transaction });
    if (!fromCity || fromCity.userId !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Not your city' });
    }

    // Verify destination city exists
    const toCity = await City.findByPk(toCityId, { transaction });
    if (!toCity) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Destination city not found' });
    }

    // Create trade route
    const route = await TradeRoute.create({
      fromCityId,
      toCityId,
      resourceType,
      quantityPerHour
    }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      tradeRoute: route
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating trade route:', error);
    res.status(500).json({ error: 'Failed to create trade route' });
  }
});

// Toggle trade route
router.put('/trade-routes/:id/toggle', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const route = await TradeRoute.findByPk(id, {
      include: [{ model: City, as: 'fromCity', attributes: ['userId'] }]
    });

    if (!route) {
      return res.status(404).json({ error: 'Trade route not found' });
    }

    if (route.fromCity.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not your trade route' });
    }

    await route.update({ active: !route.active });

    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling trade route:', error);
    res.status(500).json({ error: 'Failed to toggle trade route' });
  }
});

// Delete trade route
router.delete('/trade-routes/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const route = await TradeRoute.findByPk(id, {
      include: [{ model: City, as: 'fromCity', attributes: ['userId'] }]
    });

    if (!route) {
      return res.status(404).json({ error: 'Trade route not found' });
    }

    if (route.fromCity.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not your trade route' });
    }

    await route.destroy();

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting trade route:', error);
    res.status(500).json({ error: 'Failed to delete trade route' });
  }
});

// ============================================
// AUTO ORDERS
// ============================================

// Get auto orders for user
router.get('/auto-orders', authenticate, async (req, res) => {
  try {
    const orders = await AutoOrder.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    res.json(orders);
  } catch (error) {
    console.error('Error fetching auto orders:', error);
    res.status(500).json({ error: 'Failed to fetch auto orders' });
  }
});

// Create auto order
router.post('/auto-orders', authenticate, async (req, res) => {
  try {
    const { resourceType, orderType, price, quantity } = req.body;

    if (!['buy', 'sell'].includes(orderType)) {
      return res.status(400).json({ error: 'Invalid order type' });
    }

    if (price <= 0 || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid price or quantity' });
    }

    const order = await AutoOrder.create({
      userId: req.user.id,
      resourceType,
      orderType,
      price,
      quantity
    });

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error creating auto order:', error);
    res.status(500).json({ error: 'Failed to create auto order' });
  }
});

// Cancel auto order
router.delete('/auto-orders/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await AutoOrder.findOne({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await order.destroy();

    res.json({ success: true });
  } catch (error) {
    console.error('Error canceling auto order:', error);
    res.status(500).json({ error: 'Failed to cancel auto order' });
  }
});

// ============================================
// TAX SETTINGS
// ============================================

// Get tax settings for world
router.get('/tax-settings', authenticate, async (req, res) => {
  try {
    const worldId = req.user.worldId || 1;

    let settings = await TaxSettings.findOne({
      where: { worldId }
    });

    if (!settings) {
      // Create default settings
      settings = await TaxSettings.create({
        worldId,
        taxRate: 10.0,
        socialSpending: 30.0,
        militarySpending: 30.0,
        infrastructureSpending: 40.0
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching tax settings:', error);
    res.status(500).json({ error: 'Failed to fetch tax settings' });
  }
});

// Update tax settings (requires government position)
router.put('/tax-settings', authenticate, async (req, res) => {
  try {
    const { taxRate, socialSpending, militarySpending, infrastructureSpending } = req.body;
    const worldId = req.user.worldId || 1;

    // Check if user is Minister of Economy or President
    const position = await GovernmentPosition.findOne({
      where: {
        worldId,
        userId: req.user.id,
        position: {
          [sequelize.Op.in]: ['president', 'minister_economy']
        },
        [Op.or]: [
          { endDate: null },
          { endDate: { [sequelize.Op.gt]: new Date() } }
        ]
      }
    });

    if (!position) {
      return res.status(403).json({ error: 'You must be President or Minister of Economy' });
    }

    // Validate percentages
    const totalSpending = socialSpending + militarySpending + infrastructureSpending;
    if (Math.abs(totalSpending - 100) > 0.1) {
      return res.status(400).json({ error: 'Spending must total 100%' });
    }

    const [settings] = await TaxSettings.findOrCreate({
      where: { worldId },
      defaults: {
        taxRate,
        socialSpending,
        militarySpending,
        infrastructureSpending,
        updatedBy: req.user.id
      }
    });

    await settings.update({
      taxRate,
      socialSpending,
      militarySpending,
      infrastructureSpending,
      updatedBy: req.user.id
    });

    res.json({ success: true, message: 'Tax settings updated' });
  } catch (error) {
    console.error('Error updating tax settings:', error);
    res.status(500).json({ error: 'Failed to update tax settings' });
  }
});

module.exports = router;
