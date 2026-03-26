require('dotenv').config();
const logger = require('./config/logger');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const sequelize = require('./config/database');
const GameScheduler = require('./services/scheduler');
const {
  User,
  City,
  Election,
  Market,
  MilitaryUnit,
  Battle,
  Alliance,
  TradeRoute,
  AutoOrder,
  TaxSettings,
  Policy,
  PolicyVote,
  GovernmentPosition,
  ImpeachmentVote,
  Message,
  Research,
  WorldEvent,
  SpyMission,
  MarketHistory,
  Contract,
  Loan,
  Achievement,
  ActivityLog
} = require('./models');
const Notification = require('./models/Notification');

const authRoutes = require('./routes/auth');
const cityRoutes = require('./routes/cities');
const resourceRoutes = require('./routes/resources');
const marketRoutes = require('./routes/market');
const politicsRoutes = require('./routes/politics');
const leaderboardRoutes = require('./routes/leaderboard');
const militaryRoutes = require('./routes/military');
const economyRoutes = require('./routes/economy');
const governanceRoutes = require('./routes/governance');
const notificationRoutes = require('./routes/notifications');
const chatRoutes = require('./routes/chat');
const researchRoutes = require('./routes/research');
const eventsRoutes = require('./routes/events');
const espionageRoutes = require('./routes/espionage');
const contractRoutes = require('./routes/contracts');
const bankingRoutes = require('./routes/banking');
const achievementRoutes = require('./routes/achievements');
const activityRoutes = require('./routes/activity');
const questRoutes = require('./routes/quests');
const npcMerchantRoutes = require('./routes/npcMerchant');
const DailyQuest = require('./models/DailyQuest');

const { attackLimiter, tradeLimiter, voteLimiter, spyLimiter, chatLimiter, authLimiter } = require('./middleware/rateLimiters');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true
  }
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', limiter);

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/military/attack', attackLimiter);
app.use('/api/market/sell', tradeLimiter);
app.use('/api/market/buy', tradeLimiter);
app.use('/api/espionage/send', spyLimiter);
app.use('/api/chat/send', chatLimiter);
// Vote limiters only on write endpoints, not reads
app.use('/api/governance/policies/:id/vote', voteLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/cities', cityRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/politics', politicsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/military', militaryRoutes);
app.use('/api/economy', economyRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/espionage', espionageRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/banking', bankingRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/merchant', npcMerchantRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

io.on('connection', (socket) => {
  logger.info('New client connected', { socketId: socket.id });
  
  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`);
  });

  socket.on('join-city', (cityId) => {
    socket.join(`city-${cityId}`);
    logger.debug(`Socket joined city`, { socketId: socket.id, cityId });
  });
  
  socket.on('join-world', (worldId) => {
    socket.join(`world-${worldId}`);
    logger.debug(`Socket joined world`, { socketId: socket.id, worldId });
  });
  
  socket.on('market-update', (data) => {
    io.to(`world-${data.worldId}`).emit('market-price-update', data);
  });

  // Chat via Socket.IO
  socket.on('chat-message', async (data) => {
    try {
      const { senderId, senderUsername, senderLevel, content, channel, recipientId, worldId } = data;
      if (!content || content.length > 500) return;

      const message = await Message.create({
        senderId,
        channel: channel || 'global',
        recipientId: channel === 'private' ? recipientId : null,
        worldId,
        content
      });

      const payload = {
        id: message.id,
        senderId,
        content,
        channel: message.channel,
        createdAt: message.createdAt,
        sender: { username: senderUsername, level: senderLevel }
      };

      if (channel === 'private' && recipientId) {
        socket.emit('chat-message', payload);
        io.to(`user-${recipientId}`).emit('chat-message', payload);
      } else {
        io.to(`world-${worldId}`).emit('chat-message', payload);
      }
    } catch (err) {
      logger.error('Chat message error', { error: err.message });
    }
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id });
  });
});

app.set('io', io);

// Initialize notification service
const NotificationService = require('./services/notificationService');
const notificationService = new NotificationService(io);
app.set('notificationService', notificationService);

// Initialize game scheduler
const scheduler = new GameScheduler(io);

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

// Sync models in correct order to handle foreign key dependencies
async function syncDatabase() {
  try {
    // First: Base models without foreign keys to other game models
    await User.sync({ alter: true });
    await City.sync({ alter: true });
    await Election.sync({ alter: true });

    // Second: Models that depend on User and/or City
    await Market.sync({ alter: true });
    await MilitaryUnit.sync({ alter: true });
    await Battle.sync({ alter: true });
    await Alliance.sync({ alter: true });
    await TradeRoute.sync({ alter: true });
    await AutoOrder.sync({ alter: true });
    await TaxSettings.sync({ alter: true });
    await Policy.sync({ alter: true });
    await GovernmentPosition.sync({ alter: true });

    await Notification.sync({ alter: true });

    // Third: Models that depend on other game models (like Policy)
    await PolicyVote.sync({ alter: true });
    await ImpeachmentVote.sync({ alter: true });

    // Phase 4: New feature models
    await Message.sync({ alter: true });
    await Research.sync({ alter: true });
    await WorldEvent.sync({ alter: true });
    await SpyMission.sync({ alter: true });

    // Phase 5: Economy, social, and analytics models
    await MarketHistory.sync({ alter: true });
    await Contract.sync({ alter: true });
    await Loan.sync({ alter: true });
    await Achievement.sync({ alter: true });
    await ActivityLog.sync({ alter: true });
    await DailyQuest.sync({ alter: true });

    logger.info('Database connected and synchronized');

    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      // Start the game scheduler
      scheduler.start();
    });
  } catch (err) {
    logger.error('Unable to connect to database', { error: err.message });
    process.exit(1);
  }
}

syncDatabase();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  scheduler.stop();
  httpServer.close(() => {
    logger.info('Process terminated');
  });
});