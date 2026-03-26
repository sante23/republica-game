const express = require('express');
const { City, User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { logActivity } = require('./activity');
const sequelize = require('../config/database');

const router = express.Router();

// NPC base prices (credits per unit)
const NPC_PRICES = {
  food:   { buy: 3, sell: 1 },     // NPC sells at 3, buys at 1
  wood:   { buy: 5, sell: 2 },
  stone:  { buy: 8, sell: 3 },
  iron:   { buy: 15, sell: 6 },
  gold:   { buy: 25, sell: 10 },
  energy: { buy: 4, sell: 1 }
};

// Get NPC prices
router.get('/prices', authenticate, (req, res) => {
  res.json(NPC_PRICES);
});

// Buy from NPC (player buys resource, pays credits)
router.post('/buy', authenticate, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { cityId, resource, quantity } = req.body;

    if (!NPC_PRICES[resource]) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid resource' });
    }

    const qty = parseInt(quantity);
    if (!qty || qty < 1 || qty > 10000) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Quantity must be 1-10000' });
    }

    const totalCost = qty * NPC_PRICES[resource].buy;

    const user = await User.findByPk(req.user.id, { transaction, lock: true });
    if (user.credits < totalCost) {
      await transaction.rollback();
      return res.status(400).json({ error: `Not enough credits. Need ${totalCost}, have ${user.credits}` });
    }

    const city = await City.findOne({
      where: { id: cityId, userId: req.user.id },
      transaction,
      lock: true
    });
    if (!city) {
      await transaction.rollback();
      return res.status(404).json({ error: 'City not found' });
    }

    // Deduct credits, add resources
    user.credits -= totalCost;
    await user.save({ transaction });

    const newResources = { ...city.resources };
    newResources[resource] = (newResources[resource] || 0) + qty;
    await city.update({ resources: newResources }, { transaction });

    await transaction.commit();

    logActivity(req.user.worldId || 1, 'trade',
      `${req.user.username} bought ${qty} ${resource} from NPC Merchant`,
      req.user.id, null, { resource, quantity: qty, cost: totalCost, type: 'npc_buy' });

    res.json({
      success: true,
      message: `Bought ${qty} ${resource} for ${totalCost} credits`,
      newCredits: user.credits,
      newResources
    });
  } catch (error) {
    await transaction.rollback();
    console.error('NPC buy error:', error);
    res.status(500).json({ error: 'Failed to buy from merchant' });
  }
});

// Sell to NPC (player sells resource, receives credits)
router.post('/sell', authenticate, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { cityId, resource, quantity } = req.body;

    if (!NPC_PRICES[resource]) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid resource' });
    }

    const qty = parseInt(quantity);
    if (!qty || qty < 1 || qty > 10000) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Quantity must be 1-10000' });
    }

    const city = await City.findOne({
      where: { id: cityId, userId: req.user.id },
      transaction,
      lock: true
    });
    if (!city) {
      await transaction.rollback();
      return res.status(404).json({ error: 'City not found' });
    }

    if ((city.resources[resource] || 0) < qty) {
      await transaction.rollback();
      return res.status(400).json({ error: `Not enough ${resource}. Have ${Math.floor(city.resources[resource] || 0)}` });
    }

    const totalEarnings = qty * NPC_PRICES[resource].sell;

    // Deduct resources, add credits
    const newResources = { ...city.resources };
    newResources[resource] -= qty;
    await city.update({ resources: newResources }, { transaction });

    const user = await User.findByPk(req.user.id, { transaction, lock: true });
    user.credits += totalEarnings;
    await user.save({ transaction });

    await transaction.commit();

    logActivity(req.user.worldId || 1, 'trade',
      `${req.user.username} sold ${qty} ${resource} to NPC Merchant`,
      req.user.id, null, { resource, quantity: qty, earnings: totalEarnings, type: 'npc_sell' });

    res.json({
      success: true,
      message: `Sold ${qty} ${resource} for ${totalEarnings} credits`,
      newCredits: user.credits,
      newResources
    });
  } catch (error) {
    await transaction.rollback();
    console.error('NPC sell error:', error);
    res.status(500).json({ error: 'Failed to sell to merchant' });
  }
});

module.exports = router;
