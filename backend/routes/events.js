const express = require('express');
const { WorldEvent } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get active world events
router.get('/active', authenticate, async (req, res) => {
  try {
    const now = new Date();
    // Deactivate expired events
    await WorldEvent.update(
      { active: false },
      { where: { active: true, endsAt: { [require('sequelize').Op.lt]: now } } }
    );

    const events = await WorldEvent.findAll({
      where: { worldId: req.user.worldId, active: true },
      order: [['startsAt', 'DESC']]
    });

    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get event history
router.get('/history', authenticate, async (req, res) => {
  try {
    const events = await WorldEvent.findAll({
      where: { worldId: req.user.worldId },
      order: [['startsAt', 'DESC']],
      limit: 20
    });
    res.json(events);
  } catch (error) {
    console.error('Error fetching event history:', error);
    res.status(500).json({ error: 'Failed to fetch event history' });
  }
});

module.exports = router;
