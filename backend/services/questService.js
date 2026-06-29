const { Op } = require('sequelize');
const DailyQuest = require('../models/DailyQuest');
const { City } = require('../models');

// Advance active daily quests matching (type, target). Call IN-PROCESS after a
// committed game action (build/train/sell/buy/research) — never from
// client-controlled input. Fire-and-forget safe (errors are swallowed & logged).
async function bumpQuests(userId, questType, target, amount = 1, io = null) {
  try {
    const now = new Date();
    const quests = await DailyQuest.findAll({
      where: { userId, completed: false, expiresAt: { [Op.gt]: now } }
    });
    const updated = [];
    for (const quest of quests) {
      const template = DailyQuest.QUEST_TEMPLATES.find(t => t.id === quest.questTemplateId);
      if (!template || template.type !== questType) continue;
      if (template.target !== target && template.target !== 'any') continue;
      const newProgress = Math.min(quest.progress + (amount || 1), quest.required);
      if (newProgress === quest.progress) continue;
      const completed = newProgress >= quest.required;
      await quest.update({ progress: newProgress, completed });
      updated.push({ id: quest.id, progress: newProgress, completed, required: quest.required });
    }
    if (io && updated.length) io.to(`user-${userId}`).emit('quest-progress', { updated });
    return updated;
  } catch (e) {
    console.error('bumpQuests error:', e);
    return [];
  }
}

// Threshold quests (gold hoarded / population reached) are state-based, not
// cumulative: grade them against the user's best city. Cheap, call on demand
// (e.g. when the quest panel is opened) rather than per production tick.
async function refreshAccumulateQuests(userId) {
  try {
    const now = new Date();
    const quests = await DailyQuest.findAll({
      where: { userId, completed: false, expiresAt: { [Op.gt]: now } }
    });
    const accum = quests.filter(q => {
      const t = DailyQuest.QUEST_TEMPLATES.find(x => x.id === q.questTemplateId);
      return t && t.type === 'accumulate';
    });
    if (!accum.length) return;

    const cities = await City.findAll({ where: { userId }, attributes: ['population', 'resources'] });
    let maxGold = 0, maxPop = 0;
    for (const c of cities) {
      maxGold = Math.max(maxGold, (c.resources && c.resources.gold) || 0);
      maxPop = Math.max(maxPop, c.population || 0);
    }

    for (const q of accum) {
      const t = DailyQuest.QUEST_TEMPLATES.find(x => x.id === q.questTemplateId);
      const val = t.target === 'gold' ? maxGold : t.target === 'population' ? maxPop : 0;
      const newProgress = Math.min(Math.floor(val), q.required);
      const completed = newProgress >= q.required;
      if (newProgress !== q.progress || completed !== q.completed) {
        await q.update({ progress: newProgress, completed });
      }
    }
  } catch (e) {
    console.error('refreshAccumulateQuests error:', e);
  }
}

module.exports = { bumpQuests, refreshAccumulateQuests };
