require('dotenv').config();
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
  ImpeachmentVote
} = require('./models');

const authRoutes = require('./routes/auth');
const cityRoutes = require('./routes/cities');
const resourceRoutes = require('./routes/resources');
const marketRoutes = require('./routes/market');
const politicsRoutes = require('./routes/politics');
const leaderboardRoutes = require('./routes/leaderboard');
const militaryRoutes = require('./routes/military');
const economyRoutes = require('./routes/economy');
const governanceRoutes = require('./routes/governance');

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
  max: 100
});

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/cities', cityRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/politics', politicsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/military', militaryRoutes);
app.use('/api/economy', economyRoutes);
app.use('/api/governance', governanceRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('join-city', (cityId) => {
    socket.join(`city-${cityId}`);
    console.log(`Socket ${socket.id} joined city-${cityId}`);
  });
  
  socket.on('join-world', (worldId) => {
    socket.join(`world-${worldId}`);
    console.log(`Socket ${socket.id} joined world-${worldId}`);
  });
  
  socket.on('market-update', (data) => {
    io.to(`world-${data.worldId}`).emit('market-price-update', data);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.set('io', io);

// Initialize game scheduler
const scheduler = new GameScheduler(io);

app.use((err, req, res, next) => {
  console.error(err.stack);
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

    // Third: Models that depend on other game models (like Policy)
    await PolicyVote.sync({ alter: true });
    await ImpeachmentVote.sync({ alter: true });

    console.log('Database connected and synchronized');

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      // Start the game scheduler
      scheduler.start();
    });
  } catch (err) {
    console.error('Unable to connect to database:', err);
    process.exit(1);
  }
}

syncDatabase();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  scheduler.stop();
  httpServer.close(() => {
    console.log('Process terminated');
  });
});