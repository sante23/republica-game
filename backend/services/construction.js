// Incremental, queued building construction.
//
// Every building takes time to construct; that time grows with the building's
// level and shrinks with the city's construction capacity (houses = workers).
//   base    = BUILD_BASE_SECONDS * (level + 1)
//   speed   = 1 + min(1, houses * 0.02)        // up to 2x faster with 50+ houses
//   seconds = max(5, round(base / speed))
// where `level` counts buildings already built PLUS same-type items already
// queued, so queueing three mines costs 30s, 60s, 90s in turn.
//
// Up to MAX_QUEUE constructions can be queued per city. Item 0 is active (has
// completesAt); the rest are pending and activate in turn as the head finishes.
const BUILD_BASE_SECONDS = 30;
const MAX_QUEUE = 3;
const CANCEL_REFUND = 0.5; // 50% of resources refunded on cancel

const BUILDING_COSTS = {
  houses: { wood: 50, stone: 25, gold: 10 },
  farms: { wood: 100, gold: 20 },
  sawmills: { stone: 50, gold: 30 },
  mines: { wood: 75, stone: 100, gold: 50 },
  markets: { wood: 100, stone: 100, gold: 100 },
  walls: { stone: 200, iron: 100, gold: 75 },
  towers: { stone: 150, iron: 150, gold: 100 },
  researchCenter: { wood: 150, stone: 200, iron: 100, gold: 200 }
};

function buildSpeedFactor(city) {
  const houses = (city.buildings && city.buildings.houses) || 0;
  return 1 + Math.min(1, houses * 0.02);
}

// Seconds for the NEXT construction of `building`, accounting for same-type items
// already queued and the city's build-speed boost.
function buildSecondsFor(city, building) {
  const current = (city.buildings && city.buildings[building]) || 0;
  const queued = (city.buildQueue || []).filter(q => q.building === building).length;
  const level = current + queued;
  const base = BUILD_BASE_SECONDS * (level + 1);
  return Math.max(5, Math.round(base / buildSpeedFactor(city)));
}

function activateHead(queue, fromDate) {
  const start = fromDate || new Date();
  queue[0].startedAt = start.toISOString();
  queue[0].completesAt = new Date(start.getTime() + queue[0].seconds * 1000).toISOString();
}

// Apply every construction whose timer has elapsed, chaining catch-up so a long
// away period completes the whole queue accurately, and activate the next head.
// Mutates the city (increments buildings, shrinks the queue, flags JSONB changes).
// Returns the list of completed building names; the caller saves/emits/credits.
function advanceQueue(city) {
  // Migrate the previous single-construction field into the queue.
  if (city.construction && (!Array.isArray(city.buildQueue) || city.buildQueue.length === 0)) {
    city.buildQueue = [city.construction];
    city.construction = null;
    city.changed('construction', true);
  }
  const q = Array.isArray(city.buildQueue) ? city.buildQueue : [];
  const built = [];
  let changed = false;

  if (q.length && !q[0].completesAt) { activateHead(q); changed = true; }

  while (q.length && q[0].completesAt && new Date(q[0].completesAt) <= new Date()) {
    const done = q.shift();
    city.buildings[done.building] = (city.buildings[done.building] || 0) + (done.quantity || 1);
    built.push(done.building);
    changed = true;
    if (q.length && !q[0].completesAt) activateHead(q, new Date(done.completesAt));
  }

  if (changed) {
    city.buildQueue = q;
    city.changed('buildQueue', true);
    if (built.length) city.changed('buildings', true);
  }
  return built;
}

module.exports = {
  BUILD_BASE_SECONDS, MAX_QUEUE, CANCEL_REFUND, BUILDING_COSTS,
  buildSpeedFactor, buildSecondsFor, activateHead, advanceQueue
};
