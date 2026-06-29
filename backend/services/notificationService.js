const Notification = require('../models/Notification');

class NotificationService {
  constructor(io) {
    this.io = io;
  }

  async send(userId, type, title, message, data = {}) {
    try {
      // Guard against invalid ENUM types: previously these threw inside create()
      // and the error was swallowed, silently dropping notifications (e.g. the
      // 'BATTLE' attack alarm). Fail loud instead of silent.
      const VALID_TYPES = [
        'ELECTION_NEW', 'ELECTION_RESULT', 'MARKET_SOLD', 'MARKET_BOUGHT',
        'BATTLE_ATTACK', 'BATTLE_DEFENSE', 'CITY_PRODUCTION', 'CITY_HAPPINESS',
        'LEVEL_UP', 'SYSTEM'
      ];
      if (!VALID_TYPES.includes(type)) {
        console.error(`notificationService: invalid notification type "${type}" (user ${userId}) — not sent`);
        return null;
      }

      const notification = await Notification.create({
        userId, type, title, message, data
      });

      // Send real-time via WebSocket
      if (this.io) {
        this.io.to(`user-${userId}`).emit('notification', {
          id: notification.id,
          type,
          title,
          message,
          data,
          createdAt: notification.createdAt
        });
      }

      return notification;
    } catch (error) {
      console.error(`Error sending notification (type=${type}, user=${userId}):`, error.message);
    }
  }

  async sendToWorld(worldId, type, title, message, data = {}) {
    try {
      const { User } = require('../models');
      const users = await User.findAll({
        where: { worldId },
        attributes: ['id']
      });

      for (const user of users) {
        await this.send(user.id, type, title, message, data);
      }
    } catch (error) {
      console.error('Error sending world notification:', error);
    }
  }
}

module.exports = NotificationService;
