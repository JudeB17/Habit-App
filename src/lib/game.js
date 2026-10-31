// Game rules from the spec. Kept pure so they can be ported to a Postgres function later.

export const CATEGORIES = {
  study:   { label: 'Study',   resource: 'timber', tint: '#FFD23F', icon: 'clock' },
  reading: { label: 'Reading', resource: 'paper',  tint: '#A9C3FF', icon: 'book' },
  fitness: { label: 'Fitness', resource: 'stone',  tint: '#FFB3A7', icon: 'dumbbell' },
  screen:  { label: 'Screen',  resource: 'seeds',  tint: '#B7E4B9', icon: 'phone' },
  other:   { label: 'Other',   resource: 'coins',  tint: '#E9DFCB', icon: 'star' },
};

export const RESOURCES = {
  timber: { label: 'timber', tint: '#FFD23F' },
  paper:  { label: 'paper',  tint: '#A9C3FF' },
  stone:  { label: 'stone',  tint: '#FFB3A7' },
  seeds:  { label: 'seeds',  tint: '#B7E4B9' },
  coins:  { label: 'coins',  tint: '#E9DFCB' },
};
export const RESOURCE_KEYS = Object.keys(RESOURCES);

export const TRUST = {
  verified: { label: 'Verified', mult: 1.5 },
  proof:    { label: 'Proof',    mult: 1.2 },
  honour:   { label: 'Honour',   mult: 1.0 },
};

export const BASE_YIELD = 10;
export const MIN_VERIFIED_SESSION_S = 10 * 60;

/** Reward for completing a habit: base x trust x streak bonus (+2% per day, capped at +50%). */
export function yieldFor(trust, streakBefore) {
  const bonus = Math.min(0.5, 0.02 * streakBefore);
  return Math.round(BASE_YIELD * TRUST[trust].mult * (1 + bonus));
}

// Screen time buckets. A limit habit passes when the bucket's ceiling is within the limit.
export const BUCKETS = [
  { id: 'u15',  label: 'Under 15 min', max: 15 },
  { id: '15',   label: '15 to 30 min', max: 30 },
  { id: '30',   label: '30 to 60 min', max: 60 },
  { id: '60',   label: '1 to 2 h',     max: 120 },
  { id: '120',  label: '2 h +',        max: Infinity },
];
export const bucketById = (id) => BUCKETS.find((b) => b.id === id);
export const bucketPasses = (bucketId, limitMin) => (bucketById(bucketId)?.max ?? Infinity) <= limitMin;

// Buildings. Each maps to an illustrated piece in Island.jsx. Order = suggested build order.
export const BUILDINGS = [
  { id: 'house',      name: 'Cottage',       cost: {},                         starter: true },
  { id: 'trees',      name: 'Pine grove',    cost: { seeds: 15 } },
  { id: 'garden',     name: 'Veggie garden', cost: { seeds: 25, coins: 5 } },
  { id: 'library',    name: 'Library',       cost: { timber: 40, paper: 10 } },
  { id: 'dock',       name: 'Jetty',         cost: { timber: 25, stone: 15 } },
  { id: 'blossom',    name: 'Blossom tree',  cost: { seeds: 20, coins: 15 } },
  { id: 'lighthouse', name: 'Lighthouse',    cost: { stone: 40, paper: 30 } },
  { id: 'boat',       name: 'Sailboat',      cost: { timber: 30, coins: 25 } },
];
export const buildingById = (id) => BUILDINGS.find((b) => b.id === id);

/** What is still missing to afford a cost, e.g. { paper: 22 }. Empty object means affordable. */
export function shortfall(cost, resources) {
  const out = {};
  for (const [k, v] of Object.entries(cost)) {
    const have = resources[k] ?? 0;
    if (have < v) out[k] = v - have;
  }
  return out;
}

export const costLabel = (cost) =>
  Object.entries(cost).map(([k, v]) => `${v} ${k}`).join(' · ') || 'Free';
