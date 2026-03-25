const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

router.post('/register', [
  body('username').isLength({ min: 3, max: 50 }).trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { username, email, password } = req.body;
    
    const existingUser = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [{ username }, { email }]
      }
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Username or email already exists' 
      });
    }
    
    const user = await User.create({
      username,
      email,
      password,
      worldId: 1
    });
    
    const token = generateToken(user.id);
    
    // Set 72h newbie protection
    user.protectedUntil = new Date(Date.now() + 72 * 60 * 60 * 1000);
    await user.save();

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        level: user.level,
        credits: user.credits,
        tutorialCompleted: user.tutorialCompleted,
        protectedUntil: user.protectedUntil
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { email, password } = req.body;
    
    const user = await User.findOne({ where: { email } });
    
    if (!user || !(await user.validatePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    user.lastLogin = new Date();
    await user.save();
    
    const token = generateToken(user.id);
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        level: user.level,
        credits: user.credits,
        premiumCredits: user.premiumCredits,
        reputation: user.reputation,
        tutorialCompleted: user.tutorialCompleted,
        protectedUntil: user.protectedUntil
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      level: req.user.level,
      experience: req.user.experience,
      credits: req.user.credits,
      premiumCredits: req.user.premiumCredits,
      reputation: req.user.reputation,
      worldId: req.user.worldId,
      partyId: req.user.partyId,
      corporationId: req.user.corporationId,
      isPremium: req.user.isPremium,
      tutorialCompleted: req.user.tutorialCompleted,
      protectedUntil: req.user.protectedUntil
    }
  });
});

// Update tutorial progress
router.put('/tutorial', authenticate, async (req, res) => {
  try {
    const { step } = req.body;
    const validSteps = ['welcome', 'foundCity', 'buildings', 'market', 'military', 'politics', 'completed'];
    if (!validSteps.includes(step)) {
      return res.status(400).json({ error: 'Invalid tutorial step' });
    }
    const tutorial = { ...req.user.tutorialCompleted, [step]: true };
    req.user.tutorialCompleted = tutorial;
    await req.user.save();
    res.json({ tutorialCompleted: tutorial });
  } catch (error) {
    console.error('Tutorial update error:', error);
    res.status(500).json({ error: 'Failed to update tutorial' });
  }
});

router.post('/logout', authenticate, (req, res) => {
  res.json({ message: 'Logout successful' });
});

module.exports = router;