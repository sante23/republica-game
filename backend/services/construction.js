// Incremental building construction times.
//
// Every building now takes time to construct, and that time grows with the
// building's current level: a fresh mine is quick, a high-level one is slow.
//   time(seconds) = BUILD_BASE_SECONDS * (currentLevel + 1)
// e.g. level 0 -> 1 = 30s, level 3 -> 4 = 120s, level 9 -> 10 = 300s.
const BUILD_BASE_SECONDS = 30;

function buildSeconds(level) {
  return BUILD_BASE_SECONDS * ((level || 0) + 1);
}

// If the city has an in-progress construction whose timer has elapsed, apply it:
// increment the building, clear the construction slot, and flag the JSONB fields
// as changed. Returns the completed building name (so the caller can save, emit a
// socket event and credit quests), or null if nothing was due.
function completeConstruction(city) {
  const c = city.construction;
  if (!c || !c.completesAt) return null;
  if (new Date(c.completesAt) > new Date()) return null;
  city.buildings[c.building] = (city.buildings[c.building] || 0) + (c.quantity || 1);
  city.construction = null;
  city.changed('buildings', true);
  city.changed('construction', true);
  return c.building;
}

module.exports = { BUILD_BASE_SECONDS, buildSeconds, completeConstruction };
