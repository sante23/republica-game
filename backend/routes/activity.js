const express = require('express');
const { ActivityLog, User } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get world activity feed
router.get('/feed', authenticate, async (req, res) => {
  try {
    const { type, limit = 30 } = req.query;
    const where = { worldId: req.user.worldId };
    if (type) where.type = type;

    const activities = await ActivityLog.findAll({
      where,
      include: [{ model: User, as: 'actor', attributes: ['username'] }],
      order: [['createdAt', 'DESC']],
      limit: Math.min(parseInt(limit) || 30, 100)
    });

    res.json(activities);
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

module.exports = router;

// Helper to log activity (used by other routes)
module.exports.logActivity = async function(worldId, type, title, actorId = null, description = null, data = {}) {
  try {
    await ActivityLog.create({ worldId, type, title, actorId, description, data });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
