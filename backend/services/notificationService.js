const Notification = require('../models/Notification');

class NotificationService {
  constructor(io) {
    this.io = io;
  }

  async send(userId, type, title, message, data = {}) {
    try {
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
      console.error('Error sending notification:', error);
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
