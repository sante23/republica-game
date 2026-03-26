const express = require('express');
const { Op } = require('sequelize');
const { User, City } = require('../models');
const DailyQuest = require('../models/DailyQuest');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get today's quests (generate if needed)
router.get('/daily', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setUTCHours(23, 59, 59, 999);

    // Find active quests
    let quests = await DailyQuest.findAll({
      where: {
        userId: req.user.id,
        expiresAt: { [Op.gt]: now }
      },
      order: [['createdAt', 'ASC']]
    });

    // Generate 3 daily quests if none exist
    if (quests.length === 0) {
      const templates = DailyQuest.QUEST_TEMPLATES;
      const shuffled = [...templates].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, 3);

      const questRecords = selected.map(t => ({
        userId: req.user.id,
        questTemplateId: t.id,
        required: t.required,
        reward: t.reward,
        expiresAt: todayEnd
      }));

      quests = await DailyQuest.bulkCreate(questRecords);
    }

    // Enrich with template data
    const enriched = quests.map(q => {
      const template = DailyQuest.QUEST_TEMPLATES.find(t => t.id === q.questTemplateId);
      return {
        ...q.toJSON(),
        title: template?.title || 'Unknown Quest',
        description: template?.description || '',
        type: template?.type || 'unknown',
        target: template?.target || 'any'
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching daily quests:', error);
    res.status(500).json({ error: 'Failed to fetch quests' });
  }
});

// Update quest progress (called internally or via event)
router.post('/progress', authenticate, async (req, res) => {
  try {
    const { questType, target, amount } = req.body;
    const now = new Date();

    const quests = await DailyQuest.findAll({
      where: {
        userId: req.user.id,
        completed: false,
        expiresAt: { [Op.gt]: now }
      }
    });

    const updated = [];
    for (const quest of quests) {
      const template = DailyQuest.QUEST_TEMPLATES.find(t => t.id === quest.questTemplateId);
      if (!template) continue;

      if (template.type === questType && (template.target === target || template.target === 'any')) {
        const newProgress = Math.min(quest.progress + (amount || 1), quest.required);
        const completed = newProgress >= quest.required;
        await quest.update({ progress: newProgress, completed });
        updated.push({ id: quest.id, progress: newProgress, completed });
      }
    }

    res.json({ updated });
  } catch (error) {
    console.error('Error updating quest progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// Claim quest reward
router.post('/claim/:id', authenticate, async (req, res) => {
  try {
    const quest = await DailyQuest.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
        completed: true,
        rewardClaimed: false
      }
    });

    if (!quest) {
      return res.status(404).json({ error: 'Quest not found or not claimable' });
    }

    const user = await User.findByPk(req.user.id);

    // Apply rewards
    if (quest.reward.gold) {
      user.credits += quest.reward.gold;
    }
    if (quest.reward.xp) {
      user.addExperience(quest.reward.xp);
    }
    await user.save();
    await quest.update({ rewardClaimed: true });

    res.json({
      success: true,
      reward: quest.reward,
      newCredits: user.credits,
      newLevel: user.level,
      newExperience: user.experience
    });
  } catch (error) {
    console.error('Error claiming quest reward:', error);
    res.status(500).json({ error: 'Failed to claim reward' });
  }
});

module.exports = router;
