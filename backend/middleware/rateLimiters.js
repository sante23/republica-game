const rateLimit = require('express-rate-limit');

// Strict limits for combat actions
const attackLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: { error: 'Too many attacks. Wait 5 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Market actions
const tradeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'Too many trade actions. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Voting actions
const voteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many vote actions.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Spy missions
const spyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3,
  message: { error: 'Too many spy missions. Wait before sending another.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Chat messages
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Sending messages too fast.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Auth attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  attackLimiter,
  tradeLimiter,
  voteLimiter,
  spyLimiter,
  chatLimiter,
  authLimiter
};
