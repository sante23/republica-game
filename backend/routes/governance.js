const express = require('express');
const { Policy, PolicyVote, GovernmentPosition, ImpeachmentVote, User, Election } = require('../models');
const { authenticate } = require('../middleware/auth');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

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

// Execute election results
router.post('/execute-election', authenticate, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const worldId = req.user.worldId || 1;

    // Get winner of current election
    const winner = await Election.findOne({
      where: { worldId },
      include: [{ model: User, as: 'candidate', attributes: ['id', 'username'] }],
      order: [['votes', 'DESC']],
      transaction
    });

    if (!winner) {
      await transaction.rollback();
      return res.status(400).json({ error: 'No candidates found' });
    }

    // Appoint as President
    const [position] = await GovernmentPosition.findOrCreate({
      where: { worldId, position: 'president' },
      defaults: {
        userId: winner.userId,
        startDate: new Date()
      },
      transaction
    });

    if (position) {
      await position.update({
        userId: winner.userId,
        startDate: new Date(),
        endDate: null
      }, { transaction });
    }

    // Clear old candidates and votes
    await Election.destroy({
      where: { worldId },
      transaction
    });

    await transaction.commit();

    res.json({
      success: true,
      message: `${winner.candidate?.username} has been appointed as President!`
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error executing election:', error);
    res.status(500).json({ error: 'Failed to execute election' });
  }
});

module.exports = router;
