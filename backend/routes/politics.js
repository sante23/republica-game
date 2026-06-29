const express = require('express');
const { Election, User, City } = require('../models');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { PROMISE_IDS, PROMISE_LABELS, PLATFORMS, prizeFor } = require('../config/electionConfig');

const router = express.Router();

// ============================================
// Helpers
// ============================================

// A candidate's displayed support = real (weighted) player votes + synthetic
// citizen baseline (NPC) + campaign-bought swing + endorsement weight.
function candidateSupport(c) {
  return (c.votes || 0) + (c.npcBase || 0) + (c.campaignVotes || 0) + (c.endorseVotes || 0);
}

function platformInfo(key) {
  const p = PLATFORMS[key];
  return p ? { key, label: p.label, emoji: p.emoji, color: p.color } : null;
}

// Make sure the JSON sub-structure exists without clobbering existing data.
function ensureResults(election) {
  if (!election.results) election.results = {};
  if (!election.results.candidates) election.results.candidates = {};
  if (!election.results.voters) election.results.voters = {};
  if (!election.results.endorsedBy) election.results.endorsedBy = {};
}

function buildCandidates(election, { withProgram = false } = {}) {
  const cands = (election.results && election.results.candidates) || {};
  const arr = Object.entries(cands).map(([id, c]) => ({
    id,
    username: c.username,
    isNpc: !!c.isNpc,
    platform: c.platform ? platformInfo(c.platform) : null,
    promises: (c.promises || []).map(pid => PROMISE_LABELS[pid] || pid),
    endorsements: c.endorsers ? Object.keys(c.endorsers).length : 0,
    campaignSpend: c.campaignSpend || 0,
    votes: Math.round(candidateSupport(c)),
    ...(withProgram ? { program: c.program || '' } : {}),
  }));
  const support = arr.reduce((s, c) => s + c.votes, 0);
  arr.forEach(c => { c.percentage = support > 0 ? Math.round((c.votes / support) * 100) : 0; });
  arr.sort((a, b) => b.votes - a.votes);
  return { candidates: arr, support };
}

// When does the current phase end (for the UI countdown).
function phaseEndsAt(e) {
  switch (e.status) {
    case 'UPCOMING':
    case 'REGISTRATION': return e.registrationDeadline;
    case 'CAMPAIGN': return e.startDate;
    case 'VOTING': return e.endDate;
    default: return e.endDate;
  }
}

// Weighted turnout: a settler's ballot weighs more when their realm is large and
// happy (governing well = political clout), clamped to a sane 0.5–2.0 range.
async function voterWeight(userId) {
  try {
    const cities = await City.findAll({ where: { userId }, attributes: ['population', 'happiness'] });
    if (!cities.length) return 1;
    const avgHappy = cities.reduce((s, c) => s + (c.happiness || 50), 0) / cities.length;
    const totalPop = cities.reduce((s, c) => s + (c.population || 0), 0);
    let w = 1 + (avgHappy - 50) / 100 + Math.min(0.5, totalPop / 20000);
    w = Math.max(0.5, Math.min(2, w));
    return Math.round(w * 100) / 100;
  } catch {
    return 1;
  }
}

function emitTally(req, election, extra = {}) {
  try {
    const io = req.app.get('io');
    if (!io) return;
    const { candidates, support } = buildCandidates(election);
    io.to(`world-${election.worldId}`).emit('election-vote', {
      electionId: election.id,
      position: election.position,
      cityId: election.cityId || null,
      totalVotes: election.totalVotes,
      support,
      candidates,
      leaderId: candidates[0] ? candidates[0].id : null,
      ...extra,
    });
  } catch (e) {
    console.error('emitTally error:', e);
  }
}

// ============================================
// Elections
// ============================================

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

    const enriched = elections.map(e => {
      const { candidates, support } = buildCandidates(e);
      return {
        id: e.id,
        position: e.position,
        status: e.status,
        cityId: e.cityId,
        regionId: e.regionId,
        startDate: e.startDate,
        endDate: e.endDate,
        registrationDeadline: e.registrationDeadline,
        totalVotes: e.totalVotes,
        candidates,
        support,
        leader: candidates[0] || null,
        prize: prizeFor(e.position),
        phaseEndsAt: phaseEndsAt(e),
      };
    });

    res.json({ elections: enriched });
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
      status: 'UPCOMING',
      results: { candidates: {}, voters: {}, endorsedBy: {} }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`world-${election.worldId}`).emit('new-election', {
        id: election.id,
        position: election.position,
        startDate: election.startDate,
        endDate: election.endDate
      });
    }

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
  body('program').isLength({ min: 10, max: 1000 })
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

    const levelRequirements = { MAYOR: 1, GOVERNOR: 3, PRESIDENT: 5 };
    if (req.user.level < levelRequirements[election.position]) {
      return res.status(400).json({
        error: `Level ${levelRequirements[election.position]} required for ${election.position}`
      });
    }

    const registrationCost = { MAYOR: 100, GOVERNOR: 500, PRESIDENT: 1000 };
    if (req.user.credits < registrationCost[election.position]) {
      return res.status(400).json({
        error: `Insufficient credits. Need ${registrationCost[election.position]}`
      });
    }

    ensureResults(election);

    if (election.results.candidates[req.user.id]) {
      return res.status(400).json({ error: 'You are already a candidate' });
    }

    // Validate pledged promises (max 3, from the known set).
    let promises = Array.isArray(req.body.promises) ? req.body.promises : [];
    promises = promises.filter(p => PROMISE_IDS.includes(p)).slice(0, 3);

    req.user.credits -= registrationCost[election.position];
    await req.user.save();

    election.results.candidates[req.user.id] = {
      username: req.user.username,
      program: req.body.program,
      promises,
      votes: 0,
      npcBase: 0,
      campaignVotes: 0,
      endorseVotes: 0,
      campaignSpend: 0,
      endorsers: {},
      isNpc: false,
      registrationDate: new Date()
    };

    election.changed('results', true);
    await election.save();

    emitTally(req, election, { reason: 'register' });

    res.json({
      message: 'Successfully registered as candidate',
      election: { id: election.id, position: election.position, program: req.body.program, promises }
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

    ensureResults(election);

    if (election.results.voters[req.user.id]) {
      return res.status(400).json({ error: 'You have already voted in this election' });
    }

    const candidate = election.results.candidates[candidateId];
    if (!candidate) {
      return res.status(400).json({ error: 'Invalid candidate' });
    }

    const weight = await voterWeight(req.user.id);
    candidate.votes = (candidate.votes || 0) + weight;
    election.results.voters[req.user.id] = { votedAt: new Date(), candidateId, weight };
    election.totalVotes += 1;

    election.changed('results', true);
    await election.save();

    emitTally(req, election, { reason: 'vote' });

    const { candidates } = buildCandidates(election);
    res.json({
      message: 'Vote cast successfully',
      totalVotes: election.totalVotes,
      weight,
      candidates
    });
  } catch (error) {
    console.error('Error voting:', error);
    res.status(500).json({ error: 'Failed to cast vote' });
  }
});

// Endorse a candidate (one per election). Weight scales with the endorser's
// reputation — a respected settler swings more citizens.
router.post('/elections/:id/endorse', authenticate, async (req, res) => {
  try {
    const { candidateId } = req.body;
    const election = await Election.findByPk(req.params.id);
    if (!election) return res.status(404).json({ error: 'Election not found' });

    if (!['CAMPAIGN', 'VOTING'].includes(election.status)) {
      return res.status(400).json({ error: 'Endorsements are only open during the campaign and vote' });
    }

    ensureResults(election);

    if (election.results.endorsedBy[req.user.id]) {
      return res.status(400).json({ error: 'You have already endorsed a candidate in this race' });
    }

    const candidate = election.results.candidates[candidateId];
    if (!candidate) return res.status(400).json({ error: 'Invalid candidate' });
    if (candidateId === req.user.id) return res.status(400).json({ error: 'You cannot endorse yourself' });

    const weight = Math.round((1 + (req.user.reputation || 50) / 100) * 100) / 100; // ~1.0–2.0
    if (!candidate.endorsers) candidate.endorsers = {};
    candidate.endorsers[req.user.id] = { username: req.user.username, weight };
    candidate.endorseVotes = (candidate.endorseVotes || 0) + weight;
    election.results.endorsedBy[req.user.id] = candidateId;

    election.changed('results', true);
    await election.save();

    emitTally(req, election, { reason: 'endorse' });

    res.json({ message: `You endorsed ${candidate.username}`, weight });
  } catch (error) {
    console.error('Error endorsing:', error);
    res.status(500).json({ error: 'Failed to endorse' });
  }
});

// Spend credits on campaigning. Diminishing returns (sqrt) and a hard cap keep
// it a credit sink and a tactic — not pay-to-win.
router.post('/elections/:id/campaign', authenticate, async (req, res) => {
  try {
    const amount = parseInt(req.body.amount);
    const PACKAGES = [100, 250, 500];
    if (!PACKAGES.includes(amount)) {
      return res.status(400).json({ error: 'Choose a campaign package: 100, 250 or 500 credits' });
    }

    const election = await Election.findByPk(req.params.id);
    if (!election) return res.status(404).json({ error: 'Election not found' });
    if (!['CAMPAIGN', 'VOTING'].includes(election.status)) {
      return res.status(400).json({ error: 'Campaigning is only possible during the campaign and vote' });
    }

    ensureResults(election);
    const candidate = election.results.candidates[req.user.id];
    if (!candidate) return res.status(400).json({ error: 'You are not a candidate in this race' });

    if (req.user.credits < amount) {
      return res.status(400).json({ error: `Insufficient credits. Need ${amount}` });
    }

    req.user.credits -= amount;
    await req.user.save();

    candidate.campaignSpend = (candidate.campaignSpend || 0) + amount;
    // Total swing from campaigning = 0.9 * sqrt(totalSpend), capped at 50.
    candidate.campaignVotes = Math.min(50, Math.round(0.9 * Math.sqrt(candidate.campaignSpend)));

    election.changed('results', true);
    await election.save();

    emitTally(req, election, { reason: 'campaign' });

    res.json({
      message: `Campaign push! Reached more citizens (+swing).`,
      newCredits: req.user.credits,
      campaignSpend: candidate.campaignSpend,
      campaignVotes: candidate.campaignVotes
    });
  } catch (error) {
    console.error('Error campaigning:', error);
    res.status(500).json({ error: 'Failed to run campaign' });
  }
});

router.get('/elections/:id/results', authenticate, async (req, res) => {
  try {
    const election = await Election.findByPk(req.params.id);

    if (!election) {
      return res.status(404).json({ error: 'Election not found' });
    }

    const { candidates, support } = buildCandidates(election, { withProgram: true });

    res.json({
      election: {
        id: election.id,
        position: election.position,
        status: election.status,
        totalVotes: election.totalVotes,
        support,
        candidates,
        winnerId: election.winnerId,
        prize: prizeFor(election.position),
        phaseEndsAt: phaseEndsAt(election),
      }
    });
  } catch (error) {
    console.error('Error fetching election results:', error);
    res.status(500).json({ error: 'Failed to fetch election results' });
  }
});

module.exports = router;
