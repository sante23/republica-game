const express = require('express');
const { City, User, MarketHistory, MarketTrade } = require('../models');
const { authenticate } = require('../middleware/auth');
const { logActivity } = require('./activity');
const { bumpQuests } = require('../services/questService');
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

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round2 = (v) => Math.round(v * 100) / 100;

// Dynamic NPC quotes: drift toward the latest executed-trade fair price
// (MarketHistory), with an NPC margin (buy > sell) and clamps around the base so a
// manipulated history can't turn the merchant into a credit printer. Falls back to base.
async function npcPrices(worldId) {
  const out = {};
  for (const [resource, base] of Object.entries(NPC_PRICES)) {
    let fair = null;
    try {
      const hist = await MarketHistory.findOne({ where: { worldId, resource }, order: [['snapshotAt', 'DESC']] });
      if (hist && hist.avgPrice > 0) fair = hist.avgPrice;
    } catch (e) { /* fall back to base */ }
    if (fair == null) { out[resource] = { ...base }; continue; }
    let buy = clamp(fair * 1.3, base.sell * 1.2, base.buy * 3);    // NPC sells to player
    let sell = clamp(fair * 0.7, base.sell * 0.3, base.buy * 0.9); // NPC buys from player
    if (sell >= buy) sell = buy * 0.6;
    out[resource] = { buy: round2(buy), sell: round2(sell) };
  }
  return out;
}

// Get NPC prices (dynamic, anchored to the executed-trade oracle)
router.get('/prices', authenticate, async (req, res) => {
  res.json(await npcPrices(req.user.worldId || 1));
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

    const prices = await npcPrices(req.user.worldId || 1);
    const totalCost = Math.round(qty * prices[resource].buy);

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

    bumpQuests(req.user.id, 'buy', resource, qty, req.app.get('io'));
    MarketTrade.create({ worldId: req.user.worldId || 1, resource, price: prices[resource].buy, quantity: qty }).catch(() => {});

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

    const prices = await npcPrices(req.user.worldId || 1);
    const totalEarnings = Math.round(qty * prices[resource].sell);

    // Deduct resources, add credits
    const newResources = { ...city.resources };
    newResources[resource] -= qty;
    await city.update({ resources: newResources }, { transaction });

    const user = await User.findByPk(req.user.id, { transaction, lock: true });
    user.credits += totalEarnings;
    await user.save({ transaction });

    await transaction.commit();

    bumpQuests(req.user.id, 'sell', resource, qty, req.app.get('io'));
    MarketTrade.create({ worldId: req.user.worldId || 1, resource, price: prices[resource].sell, quantity: qty }).catch(() => {});

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
