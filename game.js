// Game rules. Kept pure so they can be ported to a Postgres function later.

export const CATEGORIES = {
  study:   { label: 'Study',   tint: '#FFD23F', icon: 'clock' },
  reading: { label: 'Reading', tint: '#A9C3FF', icon: 'book' },
  fitness: { label: 'Fitness', tint: '#FFB3A7', icon: 'dumbbell' },
  screen:  { label: 'Screen',  tint: '#B7E4B9', icon: 'phone' },
  other:   { label: 'Other',   tint: '#E9DFCB', icon: 'star' },
};

export const money = (n) => `$${Math.round(n).toLocaleString('en-AU')}`;

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

// ---------- Pomodoro ----------

/** Leaving the app for longer than this during a focus block fails the block. */
export const LEAVE_GRACE_MS = 10_000;

export const POMO_PRESETS = [
  { id: 'classic', label: '25 / 5', focus: 25, brk: 5, long: 15, every: 4, blocks: 4 },
  { id: 'deep',    label: '50 / 10', focus: 50, brk: 10, long: 20, every: 3, blocks: 3 },
];

/** Pay per completed focus block: $0.40 a minute, so a 25 min block is $10. */
export const blockPay = (focusMin) => Math.round(focusMin * 0.4);
/** Finishing every planned block (2 or more) adds this share of the run's block pay. */
export const STACK_BONUS = 0.2;
/** Chance a finished stack of 4+ blocks drops a crate. */
export const STACK_DROP_CHANCE = 0.3;

// ---------- Course ----------

export const HOLE_COUNT = 18;
export const PARTS = [
  { id: 'tee',     label: 'Tee box' },
  { id: 'fairway', label: 'Fairway' },
  { id: 'bunkers', label: 'Bunkers' },
  { id: 'green',   label: 'Green' },
];
export const PART_COST = [60, 140, 260];         // to reach level 1, 2, 3
export const PART_MAX = PART_COST.length;
export const CLUBHOUSE = [
  { name: 'Starter shed', cost: 0 },
  { name: 'Club hut', cost: 150 },
  { name: 'Clubhouse', cost: 400 },
  { name: 'Clubhouse with terrace', cost: 800 },
  { name: 'Grand clubhouse', cost: 1500 },
];

export const START_CONDITION = 55;
export const DECAY_PER_DAY = 6;
/** Daily wear stops here so a missed week is fixable in a day or two. Damage can go lower. */
export const DECAY_FLOOR = 30;
export const DAMAGE_HIT = 15;
export const DAMAGE_FLOOR = 10;
export const REPAIR_COST = 25;
export const DAMAGE_KINDS = {
  divot:  'Divot',
  water:  'Ball in the water',
  scorch: 'Brown patch',
};

// ---------- Materials and the barn ----------
// Materials only come from chests, and chests mostly come from goals. Upkeep needs money
// AND materials, so habits alone can't keep the course alive.

export const MATERIALS = {
  fuel:  { label: 'Fuel',       job: 'Mowing',            tint: '#FFB3A7' },
  water: { label: 'Water',      job: 'Watering',          tint: '#A9DFF5' },
  fert:  { label: 'Fertiliser', job: 'Feeding greens',    tint: '#C9E6A0' },
  sand:  { label: 'Sand',       job: 'Raking bunkers',    tint: '#F5DDA8' },
  seed:  { label: 'Seed',       job: 'Patching turf',     tint: '#E9DFCB' },
};
export const MATERIAL_KEYS = Object.keys(MATERIALS);
export const START_MATERIALS = { fuel: 12, water: 12, fert: 6, sand: 6, seed: 6 };

/** Condition points one unit restores. Costs are counted on the whole job and rounded up
 *  once, so maintaining everything together wastes less than hole by hole. */
const PTS_PER = { fuel: 40, water: 40, fert: 80, sand: 80 };
/** $1 per 4 condition points restored, plus materials. */
export function upkeepCost(points) {
  const p = Math.max(0, points);
  const mats = {};
  if (p > 0) for (const [k, per] of Object.entries(PTS_PER)) mats[k] = Math.ceil(p / per);
  return { money: Math.ceil(p / 4), mats };
}
export const maintainCost = (cond) => upkeepCost(100 - cond);

export const REPAIR_MATS = {
  divot:  { seed: 2, sand: 1 },
  water:  { fuel: 2 },
  scorch: { seed: 2, water: 2 },
};

export const BARN = [
  { name: 'Shed',        cap: 30,  cost: 0 },
  { name: 'Barn',        cap: 60,  cost: 150 },
  { name: 'Big barn',    cap: 120, cost: 400 },
  { name: 'Maintenance depot', cap: 250, cost: 900 },
];
/** Overflow when the barn is full sells for this much a unit. */
export const OVERFLOW_PRICE = 1;

/** What's missing to afford a cost, e.g. { money: 4, sand: 2 }. Empty = affordable. */
export function shortfall(cost, bal, mats) {
  const out = {};
  if (cost.money && bal < cost.money) out.money = cost.money - bal;
  for (const [k, v] of Object.entries(cost.mats ?? {})) if ((mats[k] ?? 0) < v) out[k] = v - (mats[k] ?? 0);
  return out;
}

// ---------- Chests ----------

export const CHESTS = {
  crate: { label: 'Crate',     units: [6, 9],   kinds: 2, item: 0.1 },
  chest: { label: 'Chest',     units: [18, 24], kinds: 3, item: 0.35 },
  big:   { label: 'Big chest', units: [40, 50], kinds: 5, item: 1, boost: true },
};

export const GOAL_SIZES = {
  small:  { label: 'Small',  minDays: 1, chest: 'crate', hint: 'due 1+ days out' },
  medium: { label: 'Medium', minDays: 3, chest: 'chest', hint: 'due 3+ days out' },
  big:    { label: 'Big',    minDays: 7, chest: 'big',   hint: 'due 7+ days out' },
};
const SMALLER = { big: 'chest', chest: 'crate', crate: 'crate' };
/** Late goals pay one chest size down. */
export const goalChest = (size, late) => (late ? SMALLER[GOAL_SIZES[size].chest] : GOAL_SIZES[size].chest);

/**
 * Roll a chest's materials. Picks `kinds` materials, leaning towards whatever you're
 * lowest on (relative to capacity), and splits the units between them.
 */
export function rollChest(kind, stock, cap, rand = Math.random) {
  const c = CHESTS[kind];
  const total = c.units[0] + Math.floor(rand() * (c.units[1] - c.units[0] + 1));
  const need = MATERIAL_KEYS.map((k) => ({ k, w: 1 + 2 * (1 - Math.min(1, (stock[k] ?? 0) / cap)) + rand() * 0.8 }));
  need.sort((a, b) => b.w - a.w);
  const picked = need.slice(0, c.kinds);
  const wsum = picked.reduce((a, x) => a + x.w, 0);
  const out = {};
  let left = total;
  picked.forEach((x, i) => {
    const n = i === picked.length - 1 ? left : Math.max(1, Math.round((total * x.w) / wsum));
    out[x.k] = Math.min(left, n);
    left -= out[x.k];
  });
  return { mats: out, item: rand() < c.item };
}

export function newCourse(today) {
  return {
    holes: Array.from({ length: HOLE_COUNT }, () => ({
      cond: START_CONDITION,
      lv: { tee: 0, fairway: 0, bunkers: 0, green: 0 },
      damage: [],
    })),
    clubhouse: 0,
    lastDecay: today,
    nextHole: 0,
  };
}

export const holeLevel = (h) => PARTS.reduce((n, p) => n + h.lv[p.id], 0);

/** 0 to 100. Condition matters most; upgrades lift the ceiling. */
export function courseRating(course) {
  const maxLv = PARTS.length * PART_MAX;
  const per = course.holes.map((h) => {
    const dmg = h.damage.length ? 0.85 : 1;
    return (h.cond / 100) * (0.6 + 0.4 * (holeLevel(h) / maxLv)) * dmg;
  });
  return Math.round((100 * per.reduce((a, b) => a + b, 0)) / per.length);
}

// ---------- Drops ----------

export const RARITY = {
  common: { label: 'Common', weight: 60, dupe: 40,  tint: '#E9DFCB' },
  rare:   { label: 'Rare',   weight: 30, dupe: 80,  tint: '#A9C3FF' },
  epic:   { label: 'Epic',   weight: 10, dupe: 150, tint: '#F58FB0' },
};

export const DROPS = [
  { id: 'cart',       name: 'Golf cart',      rarity: 'common' },
  { id: 'bench',      name: 'Park bench',     rarity: 'common' },
  { id: 'washer',     name: 'Ball washer',    rarity: 'common' },
  { id: 'ducks',      name: 'Ducks',          rarity: 'common' },
  { id: 'sprinkler',  name: 'Sprinkler',      rarity: 'common' },
  { id: 'kangaroos',  name: 'Kangaroos',      rarity: 'rare' },
  { id: 'windmill',   name: 'Windmill',       rarity: 'rare' },
  { id: 'fountain',   name: 'Lake fountain',  rarity: 'rare' },
  { id: 'gazebo',     name: 'Gazebo',         rarity: 'rare' },
  { id: 'goldflags',  name: 'Gold flags',     rarity: 'rare' },
  { id: 'balloon',    name: 'Hot air balloon', rarity: 'epic' },
  { id: 'trophy',     name: 'Club trophy',    rarity: 'epic' },
];
export const dropById = (id) => DROPS.find((d) => d.id === id);

/** Pick a drop. `boost` doubles rare and epic weights (used for goals). */
export function rollDrop(rand = Math.random, boost = false) {
  const w = (d) => RARITY[d.rarity].weight * (boost && d.rarity !== 'common' ? 2 : 1);
  const total = DROPS.reduce((a, d) => a + w(d), 0);
  let r = rand() * total;
  for (const d of DROPS) { r -= w(d); if (r <= 0) return d; }
  return DROPS[0];
}

/** Habit streak lengths that pay a drop. Weekly habits count weeks. */
export const STREAK_MILESTONES = { days: [7, 21, 50, 100], weeks: [4, 12, 26] };

// ---------- Amenities ----------
// Built with money, like the clubhouse. They raise popularity and draw on the map's
// entrance strip. Sustained neglect knocks them back down a level (see NEGLECT).

export const AMENITIES = {
  carts: { label: 'Cart fleet',    levels: ['None', '4 carts', '8 carts', '12 carts'],                 cost: [120, 300, 600], icon: 'cart' },
  shop:  { label: 'Pro shop',      levels: ['Empty lot', 'Shop hut', 'Pro shop', 'Flagship pro shop'],  cost: [150, 350, 700], icon: 'tag' },
  range: { label: 'Driving range', levels: ['Scrub', 'Practice net', 'Driving range', 'Target range'],   cost: [200, 450, 900], icon: 'target' },
};
export const AMENITY_KEYS = Object.keys(AMENITIES);
export const AMENITY_MAX = 3;
export const cartsOwned = (lv) => [0, 4, 8, 12][lv] ?? 0;

// ---------- Popularity and tiers ----------
// popularity = quality x consistency - recent penalties, 0 to 100.
// quality: 70% course rating (condition and hole upgrades), 30% facilities.
// consistency: habit hit rate over the last 14 days (75%) and Pomodoro completion (25%),
// mapped to a 0.5x to 1.2x multiplier. A great course you've stopped working for empties out.

export const TIERS = [
  { name: 'Municipal',    min: 0,  sign: '#E9DFCB', ink: '#161616' },
  { name: 'Public',       min: 25, sign: '#FFFFFF', ink: '#161616' },
  { name: 'Resort',       min: 45, sign: '#FFD23F', ink: '#161616' },
  { name: 'Private club', min: 65, sign: '#3B5FD0', ink: '#FFFFFF' },
  { name: 'Championship', min: 85, sign: '#2F9E44', ink: '#FFFFFF' },
];
/** Days at or above the next tier's line before promotion. */
export const PROMOTE_DAYS = 3;
/** Days below your tier's line before demotion. One bad day never costs a tier. */
export const DEMOTE_DAYS = 5;
export const CONSISTENCY_DAYS = 14;
/** Popularity hits fade to nothing over this many days. */
export const HIT_FADE_DAYS = 7;

export function facilitiesScore(clubhouse, amen = {}) {
  const a = (k) => (amen[k] ?? 0) / AMENITY_MAX;
  return 100 * (0.4 * (clubhouse / (CLUBHOUSE.length - 1)) + 0.2 * a('shop') + 0.2 * a('range') + 0.2 * a('carts'));
}
export const qualityScore = (course, amen) => 0.7 * courseRating(course) + 0.3 * facilitiesScore(course.clubhouse, amen);
export const consistencyMult = (c) => 0.5 + 0.7 * c;

/** How many golfers and carts are out, from popularity. Pure, so friends' maps match. */
export function crowd(pop, amen = {}) {
  const p = Math.max(0, Math.min(100, pop)) / 100;
  const groups = Math.max(1, Math.round(1 + p * 21));
  const owned = cartsOwned(amen.carts ?? 0);
  const cartsOut = Math.min(owned, Math.round(owned * (0.25 + 0.75 * p)));
  const cars = 1 + Math.round(p * 15);
  const rangeBays = [0, 3, 6, 9][amen.range ?? 0] ?? 0;
  const atRange = Math.min(rangeBays, Math.round(rangeBays * (0.2 + 0.8 * p)));
  return { groups, owned, cartsOut, cars, atRange, rangeBays };
}

// ---------- Penalties ----------

export const FINES = {
  missed: 10,       // a scheduled habit not done (or a weekly quota short, per missing day)
  limit: 15,        // a limit habit logged over the limit
  goal: { small: 20, medium: 50, big: 100 },
};
/** Habit fines stop at this much per day. Goal fines are separate. */
export const DAILY_FINE_CAP = 60;
export const POP_HITS = {
  missed: 1,
  limit: 1,
  block: 2,
  goal: { small: 3, medium: 5, big: 10 },
};
/** Away longer than this and only the most recent days get fined. */
export const MAX_FINE_DAYS = 7;

export const NEGLECT = {
  /** A hole sitting at the decay floor this many days in a row loses an upgrade level. */
  holeDays: 5,
  /** Course average at or below this ... */
  amenityCond: 40,
  /** ... for this many days in a row and the best amenity loses a level. */
  amenityDays: 5,
};
