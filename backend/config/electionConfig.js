// Shared election configuration: campaign promises, NPC politician archetypes,
// and the "prize" (what the winner actually controls). Used by both
// routes/politics.js and services/scheduler.js so the rules stay in one place.

// Campaign promises a candidate may pledge (max 3). `check` describes how the
// scheduler later scores whether the promise was kept during the term.
const PROMISE_OPTIONS = [
  { id: 'lower_taxes',     label: 'Lower taxes for citizens' },
  { id: 'boost_production', label: 'Decree regular production boosts' },
  { id: 'public_order',    label: 'Raise happiness & public order' },
  { id: 'fund_defense',    label: 'Fund the military' },
  { id: 'free_market',     label: 'Keep the market free (no bans)' },
  { id: 'welfare',         label: 'Subsidies for new settlers' },
];
const PROMISE_IDS = PROMISE_OPTIONS.map(p => p.id);
const PROMISE_LABELS = Object.fromEntries(PROMISE_OPTIONS.map(p => [p.id, p.label]));

// NPC candidate archetypes. Each has a baseline appeal that translates into
// synthetic "citizen" votes so a race is never empty — but the appeal is modest
// enough that an engaged human almost always beats them.
const PLATFORMS = {
  tax_hawk:   { label: 'Tax Hawk',      emoji: '💰', color: '#f6ad55', promises: ['lower_taxes', 'free_market'], appeal: 0.9 },
  populist:   { label: 'Populist',      emoji: '📣', color: '#fc8181', promises: ['public_order', 'welfare'],    appeal: 1.1 },
  militarist: { label: 'Militarist',    emoji: '⚔️', color: '#a0aec0', promises: ['fund_defense', 'public_order'], appeal: 0.8 },
  merchant:   { label: 'Merchant Guild', emoji: '⚖️', color: '#68d391', promises: ['free_market', 'boost_production'], appeal: 1.0 },
  reformer:   { label: 'Reformer',      emoji: '🌱', color: '#63b3ed', promises: ['boost_production', 'welfare'], appeal: 0.95 },
};
const PLATFORM_KEYS = Object.keys(PLATFORMS);

// Pool of NPC politician names.
const NPC_NAMES = [
  'Aurelius Vex', 'Doña Beatriz', 'Magnus Crowe', 'Lady Severine', 'Otto Brandt',
  'Iskander Vale', 'Cassia Roan', 'Ferdinand Krill', 'Mira Solen', 'Baron Holt',
  'Vittoria Slast', 'Cornelius Pike', 'Helga Dunmar', 'Tobias Wren', 'Selma Ardent',
];

// What the winner actually controls — surfaced in the UI so the stakes are legible.
const PRIZE_COMMON = ['Manage the treasury', 'Set the tax rate', 'Enact 1 policy / term'];
const PRIZES = {
  MAYOR:     ['Set local tax (0–50%)', 'Production boost decree (+10% / 4h)', 'Local market bans', 'City treasury'],
  GOVERNOR:  ['Regional trade powers', 'Infrastructure projects', 'Regional policies', ...PRIZE_COMMON],
  PRESIDENT: ['Appoint ministers', 'Veto / enact national policies', 'Declare martial law', 'National treasury'],
};

function prizeFor(position) {
  return PRIZES[position] || PRIZE_COMMON;
}

module.exports = {
  PROMISE_OPTIONS, PROMISE_IDS, PROMISE_LABELS,
  PLATFORMS, PLATFORM_KEYS,
  NPC_NAMES,
  PRIZES, prizeFor,
};
