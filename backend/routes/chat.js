const express = require('express');
const { Message, User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');

const router = express.Router();

// Get global chat messages
router.get('/global', authenticate, async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: { channel: 'global', worldId: req.user.worldId },
      include: [{ model: User, as: 'sender', attributes: ['username', 'level'] }],
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json(messages.reverse());
  } catch (error) {
    console.error('Error fetching global chat:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get private messages with a user
router.get('/private/:userId', authenticate, async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: {
        channel: 'private',
        [Op.or]: [
          { senderId: req.user.id, recipientId: req.params.userId },
          { senderId: req.params.userId, recipientId: req.user.id }
        ]
      },
      include: [{ model: User, as: 'sender', attributes: ['username', 'level'] }],
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json(messages.reverse());
  } catch (error) {
    console.error('Error fetching private messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message (REST fallback, primary is Socket.IO)
router.post('/send', authenticate, [
  body('content').isLength({ min: 1, max: 500 }).trim(),
  body('channel').isIn(['global', 'private', 'alliance']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, channel, recipientId } = req.body;

    const message = await Message.create({
      senderId: req.user.id,
      channel,
      recipientId: channel === 'private' ? recipientId : null,
      worldId: req.user.worldId,
      content
    });

    const fullMessage = await Message.findByPk(message.id, {
      include: [{ model: User, as: 'sender', attributes: ['username', 'level'] }]
    });

    res.json(fullMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
