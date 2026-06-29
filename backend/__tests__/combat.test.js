/**
 * Verifies services/combat.js computeBattle matches the canonical battle formula
 * (the same math asserted in battle.test.js and used by routes/military.js).
 * Pure / DB-free.
 */
const { computeBattle } = require('../services/combat');

describe('combat.computeBattle', () => {
  test('infantry gets +25% vs archers (type advantage)', () => {
    const r = computeBattle(
      [{ unitType: 'infantry', quantity: 100, attackPower: 10 }],
      { infantry: 100 },
      [{ unitType: 'archer', quantity: 1, defensePower: 8 }],
      {}
    );
    expect(r.attackerPower).toBe(Math.round(100 * 10 * 1.25)); // 1250
    expect(r.outcome).toBe('attacker_win');
  });

  test('cavalry gets +25% vs infantry', () => {
    const r = computeBattle(
      [{ unitType: 'cavalry', quantity: 50, attackPower: 18 }],
      { cavalry: 50 },
      [{ unitType: 'infantry', quantity: 1, defensePower: 12 }],
      {}
    );
    expect(r.attackerPower).toBe(Math.round(50 * 18 * 1.25)); // 1125
  });

  test('walls + towers raise the defense bonus', () => {
    const r = computeBattle(
      [],
      {},
      [{ unitType: 'infantry', quantity: 100, defensePower: 12 }],
      { walls: 3, towers: 2 }
    );
    // 100*12 * (1.2 + 0.3 + 0.10) = 1200 * 1.6 = 1920
    expect(r.defenderPower).toBe(Math.round(100 * 12 * 1.6));
    expect(r.outcome).toBe('defender_win'); // attacker sent nothing
  });

  test('losses: winner loses 20%, loser more', () => {
    const r = computeBattle(
      [{ unitType: 'infantry', quantity: 100, attackPower: 10 }],
      { infantry: 100 },
      [{ unitType: 'archer', quantity: 50, defensePower: 8 }],
      {}
    );
    expect(r.outcome).toBe('attacker_win');
    expect(r.attackerLosses.infantry).toBe(20);   // 100 * 0.2
    expect(r.defenderLosses.archer).toBe(30);     // 50 * 0.6 (loser)
  });

  test('only committed units count (unitsToUse caps quantity)', () => {
    const r = computeBattle(
      [{ unitType: 'infantry', quantity: 100, attackPower: 10 }],
      { infantry: 10 }, // commit only 10 of 100
      [{ unitType: 'cavalry', quantity: 1, defensePower: 10 }],
      {}
    );
    // infantry weak vs cavalry -> *0.8 : 10*10*0.8 = 80
    expect(r.attackerPower).toBe(Math.round(10 * 10 * 0.8));
  });
});
