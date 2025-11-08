const express = require('express');
const { Election, User, City } = require('../models');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');

const router = express.Router();

router.get('/elections', authenticate, async (req, res) => {
  try {
    const worldId = req.user.worldId || 1;
    
    const elections = await Election.findAll({
      where: {
        worldId,
        status: { [Op.ne]: 'COMPLETED' }
      },
      order: [['startDate', 'ASC']]
    });
    
    res.json({ elections });
  } catch (error) {
    console.error('Error fetching elections:', error);
    res.status(500).json({ error: 'Failed to fetch elections' });
  }
});

router.post('/elections/create', [
  authenticate,
  body('position').isIn(['MAYOR', 'GOVERNOR', 'PRESIDENT']),
  body('cityId').optional().isUUID(),
  body('regionId').optional().isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { position, cityId, regionId } = req.body;
    
    const durations = {
      MAYOR: 30,
      GOVERNOR: 45,
      PRESIDENT: 60
    };
    
    const now = new Date();
    const startDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const registrationDeadline = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    
    const existingElection = await Election.findOne({
      where: {
        worldId: req.user.worldId || 1,
        position,
        cityId: cityId || null,
        regionId: regionId || null,
        status: { [Op.ne]: 'COMPLETED' }
      }
    });
    
    if (existingElection) {
      return res.status(400).json({ error: 'An election is already in progress for this position' });
    }
    
    const election = await Election.create({
      position,
      cityId: position === 'MAYOR' ? cityId : null,
      regionId: position === 'GOVERNOR' ? regionId : null,
      worldId: req.user.worldId || 1,
      startDate,
      endDate,
      registrationDeadline,
      status: 'UPCOMING'
    });
    
    const io = req.app.get('io');
    io.to(`world-${election.worldId}`).emit('new-election', {
      id: election.id,
      position: election.position,
      startDate: election.startDate,
      endDate: election.endDate
    });
    
    res.status(201).json({
      message: 'Election scheduled successfully',
      election
    });
  } catch (error) {
    console.error('Error creating election:', error);
    res.status(500).json({ error: 'Failed to create election' });
  }
});

router.post('/elections/:id/register', [
  authenticate,
  body('program').isLength({ min: 50, max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const election = await Election.findByPk(req.params.id);
    
    if (!election) {
      return res.status(404).json({ error: 'Election not found' });
    }
    
    if (election.status !== 'REGISTRATION' && election.status !== 'UPCOMING') {
      return res.status(400).json({ error: 'Registration period has ended' });
    }
    
    if (new Date() > election.registrationDeadline) {
      return res.status(400).json({ error: 'Registration deadline has passed' });
    }
    
    const levelRequirements = {
      MAYOR: 10,
      GOVERNOR: 25,
      PRESIDENT: 40
    };
    
    if (req.user.level < levelRequirements[election.position]) {
      return res.status(400).json({ 
        error: `Level ${levelRequirements[election.position]} required for ${election.position}` 
      });
    }
    
    const registrationCost = {
      MAYOR: 1000,
      GOVERNOR: 5000,
      PRESIDENT: 10000
    };
    
    if (req.user.credits < registrationCost[election.position]) {
      return res.status(400).json({ 
        error: `Insufficient credits. Need ${registrationCost[election.position]}` 
      });
    }
    
    req.user.credits -= registrationCost[election.position];
    await req.user.save();
    
    if (!election.results.candidates) {
      election.results = { candidates: {} };
    }
    
    election.results.candidates[req.user.id] = {
      username: req.user.username,
      program: req.body.program,
      votes: 0,
      registrationDate: new Date()
    };
    
    election.changed('results', true);
    await election.save();
    
    res.json({
      message: 'Successfully registered as candidate',
      election: {
        id: election.id,
        position: election.position,
        program: req.body.program
      }
    });
  } catch (error) {
    console.error('Error registering for election:', error);
    res.status(500).json({ error: 'Failed to register for election' });
  }
});

router.post('/elections/:id/vote', authenticate, async (req, res) => {
  try {
    const { candidateId } = req.body;
    
    const election = await Election.findByPk(req.params.id);
    
    if (!election) {
      return res.status(404).json({ error: 'Election not found' });
    }
    
    if (election.status !== 'VOTING') {
      return res.status(400).json({ error: 'Election is not in voting phase' });
    }
    
    if (!election.results.voters) {
      election.results.voters = {};
    }
    
    if (election.results.voters[req.user.id]) {
      return res.status(400).json({ error: 'You have already voted in this election' });
    }
    
    if (!election.results.candidates[candidateId]) {
      return res.status(400).json({ error: 'Invalid candidate' });
    }
    
    election.results.candidates[candidateId].votes += 1;
    election.results.voters[req.user.id] = {
      votedAt: new Date(),
      candidateId
    };
    election.totalVotes += 1;
    
    election.changed('results', true);
    await election.save();
    
    res.json({
      message: 'Vote cast successfully',
      totalVotes: election.totalVotes
    });
  } catch (error) {
    console.error('Error voting:', error);
    res.status(500).json({ error: 'Failed to cast vote' });
  }
});

router.get('/elections/:id/results', authenticate, async (req, res) => {
  try {
    const election = await Election.findByPk(req.params.id);
    
    if (!election) {
      return res.status(404).json({ error: 'Election not found' });
    }
    
    const candidates = Object.entries(election.results.candidates || {})
      .map(([id, data]) => ({
        id,
        username: data.username,
        votes: data.votes,
        percentage: election.totalVotes > 0 
          ? Math.round((data.votes / election.totalVotes) * 100) 
          : 0
      }))
      .sort((a, b) => b.votes - a.votes);
    
    res.json({
      election: {
        id: election.id,
        position: election.position,
        status: election.status,
        totalVotes: election.totalVotes,
        candidates,
        winnerId: election.winnerId
      }
    });
  } catch (error) {
    console.error('Error fetching election results:', error);
    res.status(500).json({ error: 'Failed to fetch election results' });
  }
});

module.exports = router;