const express = require('express');
const { Policy, PolicyVote, GovernmentPosition, ImpeachmentVote, User, Election, City, ActivityLog } = require('../models');
const { authenticate } = require('../middleware/auth');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { logActivity } = require('./activity');

const router = express.Router();

// ============================================
// POLICIES
// ============================================

// Get all policies for world
router.get('/policies', authenticate, async (req, res) => {
  try {
    const worldId = req.user.worldId || 1;

    const policies = await Policy.findAll({
      where: { worldId },
      include: [
        { model: User, as: 'proposer', attributes: ['username'] }
      ],
      order: [
        [sequelize.literal(`CASE
          WHEN status = 'proposed' THEN 1
          WHEN status = 'active' THEN 2
          ELSE 3
        END`), 'ASC'],
        ['createdAt', 'DESC']
      ]
    });

    res.json(policies);
  } catch (error) {
    console.error('Error fetching policies:', error);
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
});

// Propose new policy
router.post('/policies', authenticate, async (req, res) => {
  try {
    const { name, description, policyType, effects } = req.body;
    const worldId = req.user.worldId || 1;

    // Check if user has level 5+
    if (req.user.level < 5) {
      return res.status(403).json({ error: 'You must be level 5+ to propose policies' });
    }

    const policy = await Policy.create({
      worldId,
      name,
      description,
      policyType,
      effects,
      proposedBy: req.user.id,
      status: 'proposed'
    });

    res.json({
      success: true,
      policy
    });
  } catch (error) {
    console.error('Error proposing policy:', error);
    res.status(500).json({ error: 'Failed to propose policy' });
  }
});

// Vote on policy
router.post('/policies/:id/vote', authenticate, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { vote } = req.body;

    // Check if policy exists and is in proposed status
    const policy = await Policy.findOne({
      where: { id, status: 'proposed' },
      transaction,
      lock: true
    });

    if (!policy) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Policy not found or not available for voting' });
    }

    // Check if user already voted
    const existingVote = await PolicyVote.findOne({
      where: { policyId: id, userId: req.user.id },
      transaction
    });

    if (existingVote) {
      await transaction.rollback();
      return res.status(400).json({ error: 'You already voted on this policy' });
    }

    // Record vote
    await PolicyVote.create({
      policyId: id,
      userId: req.user.id,
      vote
    }, { transaction });

    // Update vote count
    if (vote) {
      await policy.increment('votesFor', { transaction });
    } else {
      await policy.increment('votesAgainst', { transaction });
    }

    // Check if voting is complete (10 votes minimum)
    const updatedPolicy = await Policy.findByPk(id, { transaction });
    const totalVotes = updatedPolicy.votesFor + updatedPolicy.votesAgainst;

    if (totalVotes >= 10) {
      const passed = updatedPolicy.votesFor > updatedPolicy.votesAgainst;
      const newStatus = passed ? 'active' : 'rejected';

      await updatedPolicy.update({
        status: newStatus,
        activatedAt: new Date()
      }, { transaction });
    }

    await transaction.commit();

    res.json({ success: true, message: 'Vote recorded' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error voting on policy:', error);
    res.status(500).json({ error: 'Failed to vote on policy' });
  }
});

// ============================================
// GOVERNMENT POSITIONS
// ============================================

// Get government positions
router.get('/positions', authenticate, async (req, res) => {
  try {
    const worldId = req.user.worldId || 1;

    const positions = await GovernmentPosition.findAll({
      where: { worldId },
      include: [
        { model: User, as: 'holder', attributes: ['username'] }
      ],
      order: [['position', 'ASC']]
    });

    res.json(positions);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Appoint to position (President only)
router.post('/positions/appoint', authenticate, async (req, res) => {
  try {
    const { position, targetUserId } = req.body;
    const worldId = req.user.worldId || 1;

    // Check if current user is President
    const president = await GovernmentPosition.findOne({
      where: {
        worldId,
        position: 'president',
        userId: req.user.id,
        [Op.or]: [
          { endDate: null },
          { endDate: { [Op.gt]: new Date() } }
        ]
      }
    });

    if (!president) {
      return res.status(403).json({ error: 'Only the President can appoint ministers' });
    }

    if (!['minister_economy', 'minister_defense'].includes(position)) {
      return res.status(400).json({ error: 'Invalid position' });
    }

    // Check if target user exists
    const targetUser = await User.findOne({
      where: {
        id: targetUserId,
        worldId
      }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found in this world' });
    }

    // Appoint (upsert)
    const [positionRecord] = await GovernmentPosition.findOrCreate({
      where: { worldId, position },
      defaults: {
        userId: targetUserId,
        appointedBy: req.user.id
      }
    });

    if (positionRecord) {
      await positionRecord.update({
        userId: targetUserId,
        startDate: new Date(),
        appointedBy: req.user.id,
        endDate: null
      });
    }

    res.json({ success: true, message: 'Minister appointed' });
  } catch (error) {
    console.error('Error appointing minister:', error);
    res.status(500).json({ error: 'Failed to appoint minister' });
  }
});

// ============================================
// IMPEACHMENT
// ============================================

// Get impeachment votes
router.get('/impeachment', authenticate, async (req, res) => {
  try {
    const worldId = req.user.worldId || 1;

    const votes = await ImpeachmentVote.findAll({
      where: { worldId, status: 'voting' },
      include: [
        { model: User, as: 'target', attributes: ['username'] },
        { model: User, as: 'initiator', attributes: ['username'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(votes);
  } catch (error) {
    console.error('Error fetching impeachment votes:', error);
    res.status(500).json({ error: 'Failed to fetch impeachment votes' });
  }
});

// Initiate impeachment
router.post('/impeachment', authenticate, async (req, res) => {
  try {
    const { targetUserId, targetPosition, reason } = req.body;
    const worldId = req.user.worldId || 1;

    // Require level 10+
    if (req.user.level < 10) {
      return res.status(403).json({ error: 'You must be level 10+ to initiate impeachment' });
    }

    // Verify target holds the position
    const position = await GovernmentPosition.findOne({
      where: {
        worldId,
        position: targetPosition,
        userId: targetUserId,
        [Op.or]: [
          { endDate: null },
          { endDate: { [Op.gt]: new Date() } }
        ]
      }
    });

    if (!position) {
      return res.status(400).json({ error: 'Target does not hold this position' });
    }

    // Check if impeachment already in progress
    const existing = await ImpeachmentVote.findOne({
      where: {
        worldId,
        targetUserId,
        status: 'voting'
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Impeachment already in progress' });
    }

    // Create impeachment vote
    await ImpeachmentVote.create({
      worldId,
      targetUserId,
      targetPosition,
      reason,
      initiatedBy: req.user.id
    });

    res.json({ success: true, message: 'Impeachment initiated' });
  } catch (error) {
    console.error('Error initiating impeachment:', error);
    res.status(500).json({ error: 'Failed to initiate impeachment' });
  }
});

// Vote on impeachment
router.post('/impeachment/:id/vote', authenticate, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { support } = req.body;

    const impeachment = await ImpeachmentVote.findOne({
      where: { id, status: 'voting' },
      transaction,
      lock: true
    });

    if (!impeachment) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Impeachment vote not found' });
    }

    // One vote per user (was unguarded -> a single account could pass an impeachment)
    const voters = impeachment.voters || {};
    if (Object.prototype.hasOwnProperty.call(voters, req.user.id)) {
      await transaction.rollback();
      return res.status(400).json({ error: 'You have already voted on this impeachment' });
    }
    voters[req.user.id] = !!support;
    impeachment.voters = voters;
    impeachment.changed('voters', true);
    await impeachment.save({ transaction });

    // Update vote count
    if (support) {
      await impeachment.increment('votesFor', { transaction });
    } else {
      await impeachment.increment('votesAgainst', { transaction });
    }

    // Check if voting complete (20 votes minimum, 2/3 majority)
    const updated = await ImpeachmentVote.findByPk(id, { transaction });
    const totalVotes = updated.votesFor + updated.votesAgainst;

    if (totalVotes >= 20) {
      const passed = updated.votesFor >= (totalVotes * 2 / 3);
      const newStatus = passed ? 'passed' : 'failed';

      await updated.update({
        status: newStatus,
        resolvedAt: new Date()
      }, { transaction });

      // If passed, remove from position
      if (passed) {
        await GovernmentPosition.update(
          { endDate: new Date() },
          {
            where: {
              worldId: updated.worldId,
              position: updated.targetPosition
            },
            transaction
          }
        );
      }
    }

    await transaction.commit();

    res.json({ success: true, message: 'Vote recorded' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error voting on impeachment:', error);
    res.status(500).json({ error: 'Failed to vote on impeachment' });
  }
});

// ============================================
// MAYOR POWERS
// ============================================

// Use mayor power: production boost (+10% for 4h, 24h cooldown)
router.post('/mayor/boost', authenticate, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { cityId } = req.body;
    const worldId = req.user.worldId || 1;

    // Check user is mayor of this city
    const mayorPosition = await GovernmentPosition.findOne({
      where: {
        worldId,
        position: 'mayor',
        userId: req.user.id,
        cityId,
        [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }]
      },
      transaction
    });

    if (!mayorPosition) {
      await transaction.rollback();
      return res.status(403).json({ error: 'You are not the mayor of this city' });
    }

    // Check cooldown (stored in data field)
    const lastUsed = mayorPosition.dataValues.lastBoostAt;
    if (lastUsed && (Date.now() - new Date(lastUsed).getTime()) < 24 * 60 * 60 * 1000) {
      const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - (Date.now() - new Date(lastUsed).getTime())) / (1000 * 60 * 60));
      await transaction.rollback();
      return res.status(400).json({ error: `Production boost on cooldown. ${hoursLeft}h remaining` });
    }

    // Apply boost: increase city development temporarily via WorldEvent-like mechanism
    const city = await City.findByPk(cityId, { transaction });
    if (!city) {
      await transaction.rollback();
      return res.status(404).json({ error: 'City not found' });
    }

    // Create a world event for the boost. The type MUST be a valid WorldEvent
    // ENUM value — 'festival' fits a positive buff. 'mayor_boost' was never in the
    // ENUM and the field was `name` instead of `title`, so this threw 500 every time.
    const { WorldEvent } = require('../models');
    const boostEvent = await WorldEvent.create({
      worldId,
      type: 'festival',
      title: `Mayor's Production Decree`,
      description: `Mayor ${req.user.username} has decreed a production boost for ${city.name}!`,
      effects: { allProduction: 1.1 },
      affectedCityId: cityId,
      active: true,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 4 * 60 * 60 * 1000)
    }, { transaction });

    // Persist the cooldown anchor (was read at the top but never written -> 24h cooldown never enforced)
    mayorPosition.lastBoostAt = new Date();
    await mayorPosition.save({ transaction });

    await transaction.commit();

    const io = req.app.get('io');
    if (io) {
      io.to(`world-${worldId}`).emit('world-event', {
        id: boostEvent.id, type: 'festival', title: boostEvent.title,
        description: boostEvent.description, effects: boostEvent.effects, endsAt: boostEvent.endsAt
      });
    }

    logActivity(worldId, 'policy',
      `Mayor ${req.user.username} activated a production boost for ${city.name}`,
      req.user.id, null, { cityId, power: 'boost' });

    res.json({ success: true, message: `Production boost activated for ${city.name}! +10% for 4 hours.` });
  } catch (error) {
    await transaction.rollback();
    console.error('Mayor boost error:', error);
    res.status(500).json({ error: 'Failed to activate boost' });
  }
});

// Use mayor power: set city tax rate
router.post('/mayor/tax', authenticate, async (req, res) => {
  try {
    const { cityId, taxRate } = req.body;
    const worldId = req.user.worldId || 1;

    const rate = parseInt(taxRate);
    if (isNaN(rate) || rate < 0 || rate > 50) {
      return res.status(400).json({ error: 'Tax rate must be 0-50' });
    }

    const mayorPosition = await GovernmentPosition.findOne({
      where: {
        worldId,
        position: 'mayor',
        userId: req.user.id,
        cityId,
        [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }]
      }
    });

    if (!mayorPosition) {
      return res.status(403).json({ error: 'You are not the mayor of this city' });
    }

    const city = await City.findByPk(cityId);
    if (!city) return res.status(404).json({ error: 'City not found' });

    await city.update({ taxRate: rate });

    logActivity(worldId, 'policy',
      `Mayor ${req.user.username} set tax rate to ${rate}% in ${city.name}`,
      req.user.id, null, { cityId, taxRate: rate });

    res.json({ success: true, message: `Tax rate set to ${rate}%` });
  } catch (error) {
    console.error('Mayor tax error:', error);
    res.status(500).json({ error: 'Failed to set tax rate' });
  }
});

// Use mayor power: market ban (ban player from trading in city for 12h)
router.post('/mayor/ban', authenticate, async (req, res) => {
  try {
    const { cityId, targetUsername } = req.body;
    const worldId = req.user.worldId || 1;

    const mayorPosition = await GovernmentPosition.findOne({
      where: {
        worldId,
        position: 'mayor',
        userId: req.user.id,
        cityId,
        [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }]
      }
    });

    if (!mayorPosition) {
      return res.status(403).json({ error: 'You are not the mayor of this city' });
    }

    const target = await User.findOne({ where: { username: targetUsername, worldId } });
    if (!target) return res.status(404).json({ error: 'Player not found' });

    logActivity(worldId, 'policy',
      `Mayor ${req.user.username} banned ${targetUsername} from local market for 12h`,
      req.user.id, `Market ban in effect until ${new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()}`,
      { cityId, targetUserId: target.id, banUntil: new Date(Date.now() + 12 * 60 * 60 * 1000) });

    res.json({ success: true, message: `${targetUsername} banned from local market for 12 hours` });
  } catch (error) {
    console.error('Mayor ban error:', error);
    res.status(500).json({ error: 'Failed to issue ban' });
  }
});

// Get mayor powers status for a city
router.get('/mayor/:cityId', authenticate, async (req, res) => {
  try {
    const worldId = req.user.worldId || 1;
    const { cityId } = req.params;

    const mayorPosition = await GovernmentPosition.findOne({
      where: {
        worldId,
        position: 'mayor',
        cityId,
        [Op.or]: [{ endDate: null }, { endDate: { [Op.gt]: new Date() } }]
      },
      include: [{ model: User, as: 'holder', attributes: ['username'] }]
    });

    if (!mayorPosition) {
      return res.json({ hasMayor: false });
    }

    const isMayor = mayorPosition.userId === req.user.id;
    const city = await City.findByPk(cityId, { attributes: ['taxRate', 'name'] });

    res.json({
      hasMayor: true,
      mayorName: mayorPosition.holder?.username,
      isMayor,
      cityName: city?.name,
      taxRate: city?.taxRate,
      powers: isMayor ? ['boost', 'tax', 'ban'] : []
    });
  } catch (error) {
    console.error('Error fetching mayor status:', error);
    res.status(500).json({ error: 'Failed to fetch mayor status' });
  }
});

// NOTE: the old POST /execute-election route was removed. It was dead and
// dangerous: it ordered by a non-existent `votes` column, read a non-existent
// `candidate` association, and ran Election.destroy() on the ENTIRE world.
// Election completion is owned solely by scheduler.completeElection().

module.exports = router;
