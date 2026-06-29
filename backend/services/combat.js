// Pure battle math, mirrored from routes/military.js POST /attack so the PvE
// pirate raids and the PvP route share one formula. NOTE: the route still keeps
// its own inline copy for now (it owns the DB transaction); this function is the
// canonical math used by the scheduler — keep the two in sync if you tune combat.

const TYPE_ADVANTAGES = {
  infantry: { strong: 'archer', weak: 'cavalry' },
  cavalry: { strong: 'infantry', weak: 'archer' },
  archer: { strong: 'cavalry', weak: 'infantry' },
  siege: { strong: null, weak: null }
};

// attackerUnits: [{ unitType, quantity, attackPower }]
// unitsToUse:    { unitType: qty }  (how many of each the attacker commits)
// defenderUnits: [{ unitType, quantity, defensePower }]
// defenderBuildings: { walls, towers }
function computeBattle(attackerUnits, unitsToUse, defenderUnits, defenderBuildings = {}) {
  let attackerPower = 0;
  for (const unit of attackerUnits) {
    const use = Math.min(unitsToUse[unit.unitType] || 0, unit.quantity);
    let power = use * unit.attackPower;
    const adv = TYPE_ADVANTAGES[unit.unitType];
    if (adv) {
      for (const d of defenderUnits) {
        if (d.unitType === adv.strong) power *= 1.25;
        if (d.unitType === adv.weak) power *= 0.8;
      }
    }
    attackerPower += power;
  }

  let defenderPower = 0;
  for (const unit of defenderUnits) {
    let power = unit.quantity * unit.defensePower;
    const adv = TYPE_ADVANTAGES[unit.unitType];
    if (adv) {
      for (const a of attackerUnits) {
        const used = unitsToUse[a.unitType] || 0;
        if (used > 0 && a.unitType === adv.strong) power *= 1.25;
        if (used > 0 && a.unitType === adv.weak) power *= 0.8;
      }
    }
    defenderPower += power;
  }

  const wallLevel = defenderBuildings.walls || 0;
  const towerLevel = defenderBuildings.towers || 0;
  const cityDefenseBonus = 1.2 + (wallLevel * 0.1) + (towerLevel * 0.05);
  defenderPower *= cityDefenseBonus;

  const outcome = attackerPower > defenderPower ? 'attacker_win' : 'defender_win';

  const attackerLosses = {};
  for (const [unitType, qty] of Object.entries(unitsToUse)) {
    const lossPct = outcome === 'attacker_win' ? 0.2 : 0.5;
    attackerLosses[unitType] = Math.floor((qty || 0) * lossPct);
  }

  const defenderLosses = {};
  for (const unit of defenderUnits) {
    const lossPct = outcome === 'defender_win' ? 0.2 : 0.6;
    defenderLosses[unit.unitType] = Math.floor(unit.quantity * lossPct);
  }

  return {
    outcome,
    attackerPower: Math.round(attackerPower),
    defenderPower: Math.round(defenderPower),
    cityDefenseBonus,
    wallLevel,
    towerLevel,
    attackerLosses,
    defenderLosses
  };
}

module.exports = { computeBattle, TYPE_ADVANTAGES };
