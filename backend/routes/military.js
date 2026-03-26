const express = require('express');
const { MilitaryUnit, UNIT_TYPES, Battle, Alliance, City, User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

const { body, validationResult } = require('express-validator');
const { logActivity } = require('./activity');

const router = express.Router();

// Get military units for a city
router.get('/city/:cityId', authenticate, async (req, res) => {
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

    const units = await MilitaryUnit.findAll({
      where: { cityId },
      order: [['unitType', 'ASC']]
    });

    res.json(units);
  } catch (error) {
    console.error('Error fetching military units:', error);
    res.status(500).json({ error: 'Failed to fetch military units' });
  }
});

// Train military units
router.post('/train', authenticate, [
  body('cityId').isUUID(),
  body('unitType').isIn(['infantry', 'cavalry', 'archer', 'siege']),
  body('quantity').isInt({ min: 1, max: 10000 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const transaction = await sequelize.transaction();

  try {
    const { cityId, unitType, quantity } = req.body;

    // Verify ownership
    const city = await City.findByPk(cityId, { transaction, lock: true });
    if (!city) {
      await transaction.rollback();
      return res.status(404).json({ error: 'City not found' });
    }

    if (city.userId !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Not your city' });
    }

    const unitStats = UNIT_TYPES[unitType];

    // Check resources
    const totalCost = {};
    for (const [resource, cost] of Object.entries(unitStats.cost)) {
      totalCost[resource] = cost * quantity;
      if (city.resources[resource] < totalCost[resource]) {
        await transaction.rollback();
        return res.status(400).json({
          error: `Not enough ${resource}. Need ${totalCost[resource]}, have ${city.resources[resource]}`
        });
      }
    }

    // Deduct resources
    const newResources = { ...city.resources };
    for (const [resource, cost] of Object.entries(totalCost)) {
      newResources[resource] -= cost;
    }

    await city.update({ resources: newResources }, { transaction });

    // Add or update military units
    const [unit, created] = await MilitaryUnit.findOrCreate({
      where: { cityId, unitType },
      defaults: {
        quantity,
        attackPower: unitStats.attackPower,
        defensePower: unitStats.defensePower,
        maintenanceCost: unitStats.maintenanceCost
      },
      transaction
    });

    if (!created) {
      await unit.increment('quantity', { by: quantity, transaction });
    }

    await transaction.commit();

    res.json({
      success: true,
      message: `Successfully trained ${quantity} ${unitStats.name}`
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error training units:', error);
    res.status(500).json({ error: 'Failed to train units' });
  }
});

// Attack another city
router.post('/attack', authenticate, [
  body('attackerCityId').isUUID(),
  body('defenderCityId').isUUID(),
  body('units').isObject()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const transaction = await sequelize.transaction();

  try {
    const { attackerCityId, defenderCityId, units } = req.body;

    if (attackerCityId === defenderCityId) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot attack your own city' });
    }

    // Get attacker city
    const attackerCity = await City.findByPk(attackerCityId, { transaction, lock: true });
    if (!attackerCity || attackerCity.userId !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({ error: 'Not your city' });
    }

    // Get defender city (separate queries to avoid lock + join issue)
    const defenderCity = await City.findByPk(defenderCityId, {
      transaction,
      lock: true
    });
    if (defenderCity) {
      defenderCity.owner = await User.findByPk(defenderCity.userId, { transaction });
    }
    if (!defenderCity) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Defender city not found' });
    }

    // Check newbie protection
    const defender = defenderCity.owner;
    if (defender.protectedUntil && new Date(defender.protectedUntil) > new Date()) {
      await transaction.rollback();
      const hoursLeft = Math.ceil((new Date(defender.protectedUntil) - new Date()) / (1000 * 60 * 60));
      return res.status(400).json({ error: `This player is under newbie protection for ${hoursLeft} more hours` });
    }
    if (defender.level < 5) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot attack players below level 5' });
    }

    // Check alliance
    const alliance = await Alliance.findOne({
      where: {
        [Op.or]: [
          { player1Id: req.user.id, player2Id: defenderCity.userId },
          { player1Id: defenderCity.userId, player2Id: req.user.id }
        ],
        status: 'active'
      },
      transaction
    });

    if (alliance) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot attack an ally' });
    }

    // Get attacker units
    const attackerUnits = await MilitaryUnit.findAll({
      where: { cityId: attackerCityId },
      transaction
    });

    // Get defender units
    const defenderUnits = await MilitaryUnit.findAll({
      where: { cityId: defenderCityId },
      transaction
    });

    // Rock-paper-scissors unit advantages
    // infantry > archer > cavalry > infantry, siege weak vs all defense
    const TYPE_ADVANTAGES = {
      infantry: { strong: 'archer', weak: 'cavalry' },
      cavalry: { strong: 'infantry', weak: 'archer' },
      archer: { strong: 'cavalry', weak: 'infantry' },
      siege: { strong: null, weak: null } // siege is pure offense, no type bonus
    };

    // Calculate battle outcome with type advantages
    let attackerPower = 0;
    let defenderPower = 0;

    const attackerUnitsMap = {};
    for (const unit of attackerUnits) {
      attackerUnitsMap[unit.unitType] = unit;
      const unitsToUse = Math.min(units[unit.unitType] || 0, unit.quantity);
      let power = unitsToUse * unit.attackPower;
      // Apply type advantage bonuses against defender composition
      const adv = TYPE_ADVANTAGES[unit.unitType];
      if (adv) {
        for (const dUnit of defenderUnits) {
          if (dUnit.unitType === adv.strong) power *= 1.25; // 25% bonus vs weak type
          if (dUnit.unitType === adv.weak) power *= 0.8;    // 20% penalty vs strong type
        }
      }
      attackerPower += power;
    }

    const defenderUnitsMap = {};
    for (const unit of defenderUnits) {
      defenderUnitsMap[unit.unitType] = unit;
      let power = unit.quantity * unit.defensePower;
      const adv = TYPE_ADVANTAGES[unit.unitType];
      if (adv) {
        for (const aUnit of attackerUnits) {
          const usedQty = units[aUnit.unitType] || 0;
          if (usedQty > 0 && aUnit.unitType === adv.strong) power *= 1.25;
          if (usedQty > 0 && aUnit.unitType === adv.weak) power *= 0.8;
        }
      }
      defenderPower += power;
    }

    // City defense bonus: base 1.2 + 0.1 per wall level
    const wallLevel = defenderCity.buildings?.walls || 0;
    const towerLevel = defenderCity.buildings?.towers || 0;
    const cityDefenseBonus = 1.2 + (wallLevel * 0.1) + (towerLevel * 0.05);
    defenderPower *= cityDefenseBonus;

    const outcome = attackerPower > defenderPower ? 'attacker_win' : 'defender_win';

    // Calculate losses
    const attackerLosses = {};
    const defenderLosses = {};

    for (const [unitType, quantity] of Object.entries(units)) {
      const lossPercentage = outcome === 'attacker_win' ? 0.2 : 0.5;
      attackerLosses[unitType] = Math.floor(quantity * lossPercentage);
    }

    for (const unit of defenderUnits) {
      const lossPercentage = outcome === 'defender_win' ? 0.2 : 0.6;
      defenderLosses[unit.unitType] = Math.floor(unit.quantity * lossPercentage);
    }

    // Update units
    for (const [unitType, losses] of Object.entries(attackerLosses)) {
      await MilitaryUnit.decrement('quantity', {
        by: losses,
        where: { cityId: attackerCityId, unitType },
        transaction
      });
    }

    for (const [unitType, losses] of Object.entries(defenderLosses)) {
      await MilitaryUnit.decrement('quantity', {
        by: losses,
        where: { cityId: defenderCityId, unitType },
        transaction
      });
    }

    // Plunder resources if attacker wins — dynamic scaling
    let resourcesPlundered = {};
    if (outcome === 'attacker_win') {
      // Base 20%, reduced by walls (-2% per level), scaled by level difference
      const levelDiff = (req.user.level || 1) - (defender.level || 1);
      const wallReduction = wallLevel * 0.02;
      const plunderRate = Math.max(0.05, Math.min(0.35, 0.2 + (levelDiff * 0.01) - wallReduction));
      resourcesPlundered = {
        food: Math.floor(defenderCity.resources.food * plunderRate),
        wood: Math.floor(defenderCity.resources.wood * plunderRate),
        stone: Math.floor(defenderCity.resources.stone * plunderRate),
        gold: Math.floor(defenderCity.resources.gold * plunderRate)
      };

      // Update defender resources
      const newDefenderResources = { ...defenderCity.resources };
      for (const [resource, amount] of Object.entries(resourcesPlundered)) {
        newDefenderResources[resource] -= amount;
      }

      await defenderCity.update({
        resources: newDefenderResources,
        happiness: Math.max(defenderCity.happiness - 10, 0)
      }, { transaction });

      // Update attacker resources
      const newAttackerResources = { ...attackerCity.resources };
      for (const [resource, amount] of Object.entries(resourcesPlundered)) {
        newAttackerResources[resource] += amount;
      }

      await attackerCity.update({ resources: newAttackerResources }, { transaction });
    }

    // Record battle
    await Battle.create({
      attackerId: req.user.id,
      defenderId: defenderCity.userId,
      attackerCityId,
      defenderCityId,
      attackerUnits: units,
      defenderUnits: defenderUnitsMap,
      outcome,
      attackerLosses,
      defenderLosses,
      resourcesPlundered
    }, { transaction });

    await transaction.commit();

    // Log battle to activity feed
    const winnerName = outcome === 'attacker_win' ? req.user.username : defender.username;
    logActivity(attackerCity.worldId, 'battle',
      `${req.user.username} attacked ${defender.username}'s ${defenderCity.name} - ${winnerName} wins!`,
      req.user.id, null, { outcome, attackerLosses, defenderLosses });

    // Send detailed battle report
    const totalAttackerSent = Object.values(units).reduce((s, v) => s + v, 0);
    const totalAttackerLost = Object.values(attackerLosses).reduce((s, v) => s + v, 0);
    const totalDefenderLost = Object.values(defenderLosses).reduce((s, v) => s + v, 0);

    const report = {
      success: true,
      outcome,
      summary: outcome === 'attacker_win'
        ? `Victory! ${attackerCity.name} conquered ${defenderCity.name}'s defenses.`
        : `Defeat! ${defenderCity.name} repelled the attack from ${attackerCity.name}.`,
      attacker: {
        player: req.user.username,
        city: attackerCity.name,
        unitsSent: units,
        totalSent: totalAttackerSent,
        losses: attackerLosses,
        totalLost: totalAttackerLost,
        power: Math.round(attackerPower)
      },
      defender: {
        player: defender.username,
        city: defenderCity.name,
        unitsPresent: Object.fromEntries(defenderUnits.map(u => [u.unitType, u.quantity])),
        losses: defenderLosses,
        totalLost: totalDefenderLost,
        power: Math.round(defenderPower),
        defenseBonus: `${Math.round(cityDefenseBonus * 100)}%`,
        wallLevel,
        towerLevel
      },
      plunder: outcome === 'attacker_win' ? resourcesPlundered : null,
      plunderRate: outcome === 'attacker_win' ? `${Math.round(Math.max(0.05, Math.min(0.35, 0.2 + ((req.user.level || 1) - (defender.level || 1)) * 0.01 - wallLevel * 0.02)) * 100)}%` : null
    };

    // Notify defender
    const notifier = req.app.get('notificationService');
    if (notifier) {
      await notifier.send(defender.id, 'BATTLE',
        outcome === 'attacker_win' ? 'Your city was attacked!' : 'Attack repelled!',
        report.summary,
        { battleReport: report }
      );
    }

    res.json(report);
  } catch (error) {
    try { await transaction.rollback(); } catch (e) { /* already rolled back */ }
    console.error('Error during attack:', error);
    res.status(500).json({ error: error.message || 'Failed to execute attack' });
  }
});

// Get battle history
router.get('/battles', authenticate, async (req, res) => {
  try {
    const battles = await Battle.findAll({
      where: {
        [Op.or]: [
          { attackerId: req.user.id },
          { defenderId: req.user.id }
        ]
      },
      include: [
        { model: User, as: 'attacker', attributes: ['username'] },
        { model: User, as: 'defender', attributes: ['username'] },
        { model: City, as: 'attackerCity', attributes: ['name'] },
        { model: City, as: 'defenderCity', attributes: ['name'] }
      ],
      order: [['battle_date', 'DESC']],
      limit: 50
    });

    res.json(battles);
  } catch (error) {
    console.error('Error fetching battles:', error);
    res.status(500).json({ error: 'Failed to fetch battles' });
  }
});

// Alliance management
router.post('/alliance/propose', authenticate, async (req, res) => {
  try {
    const { targetUserId } = req.body;

    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot ally with yourself' });
    }

    const [alliance, created] = await Alliance.findOrCreate({
      where: {
        [Op.or]: [
          { player1Id: req.user.id, player2Id: targetUserId },
          { player1Id: targetUserId, player2Id: req.user.id }
        ]
      },
      defaults: {
        player1Id: req.user.id,
        player2Id: targetUserId,
        proposedBy: req.user.id,
        status: 'pending'
      }
    });

    if (!created) {
      return res.status(400).json({ error: 'Alliance proposal already exists' });
    }

    logActivity(req.user.worldId || 1, 'alliance',
      `${req.user.username} proposed an alliance`, req.user.id);
    res.json({ success: true, message: 'Alliance proposal sent' });
  } catch (error) {
    console.error('Error proposing alliance:', error);
    res.status(500).json({ error: 'Failed to propose alliance' });
  }
});

router.post('/alliance/respond', authenticate, async (req, res) => {
  try {
    const { allianceId, accept } = req.body;

    const alliance = await Alliance.findOne({
      where: {
        id: allianceId,
        player2Id: req.user.id
      }
    });

    if (!alliance) {
      return res.status(404).json({ error: 'Alliance proposal not found' });
    }

    const status = accept ? 'active' : 'rejected';
    await alliance.update({
      status,
      acceptedAt: new Date()
    });

    res.json({ success: true, message: accept ? 'Alliance accepted' : 'Alliance rejected' });
  } catch (error) {
    console.error('Error responding to alliance:', error);
    res.status(500).json({ error: 'Failed to respond to alliance' });
  }
});

router.get('/alliances', authenticate, async (req, res) => {
  try {
    const alliances = await Alliance.findAll({
      where: {
        [Op.or]: [
          { player1Id: req.user.id },
          { player2Id: req.user.id }
        ]
      },
      include: [
        { model: User, as: 'player1', attributes: ['username'] },
        { model: User, as: 'player2', attributes: ['username'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(alliances);
  } catch (error) {
    console.error('Error fetching alliances:', error);
    res.status(500).json({ error: 'Failed to fetch alliances' });
  }
});

module.exports = router;
