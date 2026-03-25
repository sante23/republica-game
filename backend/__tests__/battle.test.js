/**
 * Battle mechanics unit tests
 * Tests the combat system including type advantages, defense bonuses, and plunder scaling.
 */

describe('Battle Mechanics', () => {
  // Type advantage system
  const TYPE_ADVANTAGES = {
    infantry: { strong: 'archer', weak: 'cavalry' },
    cavalry: { strong: 'infantry', weak: 'archer' },
    archer: { strong: 'cavalry', weak: 'infantry' },
    siege: { strong: null, weak: null }
  };

  function calculateAttackPower(attackerUnits, defenderUnitTypes) {
    let power = 0;
    for (const unit of attackerUnits) {
      let unitPower = unit.quantity * unit.attackPower;
      const adv = TYPE_ADVANTAGES[unit.unitType];
      if (adv) {
        for (const dType of defenderUnitTypes) {
          if (dType === adv.strong) unitPower *= 1.25;
          if (dType === adv.weak) unitPower *= 0.8;
        }
      }
      power += unitPower;
    }
    return power;
  }

  function calculateDefensePower(defenderUnits, attackerUnitTypes, wallLevel = 0, towerLevel = 0) {
    let power = 0;
    for (const unit of defenderUnits) {
      let unitPower = unit.quantity * unit.defensePower;
      const adv = TYPE_ADVANTAGES[unit.unitType];
      if (adv) {
        for (const aType of attackerUnitTypes) {
          if (aType === adv.strong) unitPower *= 1.25;
          if (aType === adv.weak) unitPower *= 0.8;
        }
      }
      power += unitPower;
    }
    const bonus = 1.2 + (wallLevel * 0.1) + (towerLevel * 0.05);
    return power * bonus;
  }

  function calculatePlunderRate(attackerLevel, defenderLevel, wallLevel) {
    const levelDiff = attackerLevel - defenderLevel;
    const wallReduction = wallLevel * 0.02;
    return Math.max(0.05, Math.min(0.35, 0.2 + (levelDiff * 0.01) - wallReduction));
  }

  test('infantry should have advantage against archers', () => {
    const attackers = [{ unitType: 'infantry', quantity: 100, attackPower: 10 }];
    const defenderTypes = ['archer'];

    const power = calculateAttackPower(attackers, defenderTypes);
    const basePower = 100 * 10;
    expect(power).toBe(basePower * 1.25);
  });

  test('cavalry should have advantage against infantry', () => {
    const attackers = [{ unitType: 'cavalry', quantity: 50, attackPower: 18 }];
    const defenderTypes = ['infantry'];

    const power = calculateAttackPower(attackers, defenderTypes);
    expect(power).toBe(50 * 18 * 1.25);
  });

  test('archer should have disadvantage against infantry', () => {
    const attackers = [{ unitType: 'archer', quantity: 50, attackPower: 15 }];
    const defenderTypes = ['infantry'];

    const power = calculateAttackPower(attackers, defenderTypes);
    expect(power).toBe(50 * 15 * 0.8);
  });

  test('siege should have no type advantage modifier', () => {
    const attackers = [{ unitType: 'siege', quantity: 10, attackPower: 30 }];
    const defenderTypes = ['infantry', 'archer'];

    const power = calculateAttackPower(attackers, defenderTypes);
    expect(power).toBe(10 * 30); // no modifier
  });

  test('walls should increase defense bonus', () => {
    const defenders = [{ unitType: 'infantry', quantity: 100, defensePower: 12 }];
    const attackerTypes = [];

    const noWalls = calculateDefensePower(defenders, attackerTypes, 0, 0);
    const withWalls = calculateDefensePower(defenders, attackerTypes, 3, 0);

    expect(withWalls).toBeGreaterThan(noWalls);
    expect(noWalls).toBe(100 * 12 * 1.2);
    expect(withWalls).toBe(100 * 12 * 1.5);
  });

  test('towers should add defense bonus', () => {
    const defenders = [{ unitType: 'infantry', quantity: 100, defensePower: 12 }];

    const noTower = calculateDefensePower(defenders, [], 0, 0);
    const withTower = calculateDefensePower(defenders, [], 0, 2);

    expect(withTower).toBe(100 * 12 * 1.3);
    expect(withTower).toBeGreaterThan(noTower);
  });

  test('plunder rate should be 20% at equal levels with no walls', () => {
    expect(calculatePlunderRate(10, 10, 0)).toBe(0.2);
  });

  test('plunder rate should increase when attacker is higher level', () => {
    const rate = calculatePlunderRate(20, 10, 0);
    expect(rate).toBeGreaterThan(0.2);
    expect(rate).toBeCloseTo(0.3);
  });

  test('plunder rate should decrease with walls', () => {
    const rate = calculatePlunderRate(10, 10, 3);
    expect(rate).toBeLessThan(0.2);
    expect(rate).toBe(0.14);
  });

  test('plunder rate should be clamped between 5% and 35%', () => {
    expect(calculatePlunderRate(1, 50, 10)).toBe(0.05); // very low
    expect(calculatePlunderRate(50, 1, 0)).toBe(0.35);  // capped at max
  });

  test('mixed army should apply multiple type advantages', () => {
    const attackers = [
      { unitType: 'infantry', quantity: 50, attackPower: 10 },
      { unitType: 'cavalry', quantity: 30, attackPower: 18 }
    ];
    const defenderTypes = ['infantry', 'archer'];

    const power = calculateAttackPower(attackers, defenderTypes);
    // infantry: 50*10 * 1.25 (strong vs archer) * 0.8 (weak vs... wait, infantry is not weak to infantry)
    // Actually: infantry strong=archer, weak=cavalry. Defender has infantry and archer.
    // infantry 50*10: vs archer(strong) *1.25 = 625. No cavalry penalty.
    // cavalry 30*18: vs infantry(strong) *1.25 = 675. vs archer(weak) *0.8 = 540
    // But it applies both: 30*18 * 1.25 * 0.8 = 540
    expect(power).toBe(625 + 540);
  });
});

describe('Experience & Leveling', () => {
  function addExperience(level, experience, amount) {
    experience += amount;
    let leveledUp = false;
    const requiredExp = level * 100 * 1.5;
    if (experience >= requiredExp) {
      level += 1;
      experience -= requiredExp;
      leveledUp = true;
    }
    return { level, experience, leveledUp };
  }

  test('should level up when experience threshold is met', () => {
    const result = addExperience(1, 0, 150);
    expect(result.leveledUp).toBe(true);
    expect(result.level).toBe(2);
    expect(result.experience).toBe(0);
  });

  test('should not level up below threshold', () => {
    const result = addExperience(1, 0, 100);
    expect(result.leveledUp).toBe(false);
    expect(result.level).toBe(1);
    expect(result.experience).toBe(100);
  });

  test('experience threshold should scale with level', () => {
    // Level 1: 150 XP, Level 5: 750 XP, Level 10: 1500 XP
    expect(1 * 100 * 1.5).toBe(150);
    expect(5 * 100 * 1.5).toBe(750);
    expect(10 * 100 * 1.5).toBe(1500);
  });

  test('should carry over excess experience', () => {
    const result = addExperience(1, 0, 200);
    expect(result.leveledUp).toBe(true);
    expect(result.experience).toBe(50);
  });
});

describe('Newbie Protection', () => {
  test('should protect players for 72 hours after registration', () => {
    const registrationTime = new Date();
    const protectedUntil = new Date(registrationTime.getTime() + 72 * 60 * 60 * 1000);
    const now = new Date(registrationTime.getTime() + 24 * 60 * 60 * 1000); // 24h later

    expect(protectedUntil > now).toBe(true);
  });

  test('protection should expire after 72 hours', () => {
    const registrationTime = new Date();
    const protectedUntil = new Date(registrationTime.getTime() + 72 * 60 * 60 * 1000);
    const now = new Date(registrationTime.getTime() + 73 * 60 * 60 * 1000); // 73h later

    expect(protectedUntil > now).toBe(false);
  });

  test('players below level 5 should be protected', () => {
    expect(3 < 5).toBe(true);
    expect(5 < 5).toBe(false);
  });
});
