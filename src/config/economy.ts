/**
 * Global economy + pacing numbers. Start values; tuned with `npm run sim` against
 * the pacing table in docs/SPY_LAB_BRIEF.md §5.10. The game must be fair WITHOUT ads.
 */
export const ECONOMY = {
  startCash: 0,
  /** Cash pile lying next to the spawn (first cash within ~2 m). */
  welcomeCash: 30,
  /** Price of the cadet sign-up desk (first purchase, ~0:02). */
  counterCost: 10,
  clerkCost: 100,
  /**
   * Agency office clerk: sells common graduates after they waited sellDelay seconds (rare+ wait
   * for the player) and empties every room's cash pile every collectSeconds.
   */
  officeClerk: { cost: 450, sellDelay: 6, collectSeconds: 8 },
  stationGrowth: 1.8,
  /** Training kits: hero carry capacity, basket size per station, pick/drop speed (s per kit). */
  supply: { carryMax: 5, basketMax: 4, pickSeconds: 0.12, dropSeconds: 0.12, runnerSecondsPerKit: 2.2 },
  /** Seconds the hero (or clerk) needs to sign up one cadet. */
  serveSeconds: 1.0,
  clerkServeSeconds: 2.0,
  queueMax: 4,
  /** A new cadet arrives every N s while the queue has room. */
  arrivalSeconds: 4,
  /** Opening boost (first ~50 s of total play time, fades over 20 s): walk faster, serve faster. */
  opening: { fullUntil: 50, fadeSeconds: 20, walkMult: 2, serveMult: 0.5 },
  /** Kit crate pad price = stationBase * this (the very first one costs ~5). */
  crateShare: 0.34,
  /** Graduate "loan out" fee = room income per rep * this * rarity factor. */
  loanFeeReps: 10,
  loanRarity: { common: 1, rare: 1.5, epic: 2.2, legendary: 3.5 },
  upgradeGrowth: 1.15,
  /** Room level milestones that double income. */
  milestones: [10, 25, 50, 100, 150, 200],
  maxRoomLevel: 200,

  slots: { start: 0, max: 6, baseCost: 40, growth: 3.2 },
  speed: { max: 10, baseCost: 60, growth: 2.4, factorPerLevel: 0.92 },
  /** Instructor: auto-collects the stack and trains faster. */
  instructorSpeedFactor: 0.8,

  /** Uncollected cash stack cap, in "cycles of the full room". */
  stackCapCycles: 10,

  recruit: {
    /** Seconds between new cadets at the bakery (while a slot is free). */
    interval: 6,
    walkSpeed: 3.2,
  },
  graduation: {
    /** Cycles until the very first cadet graduates (tutorial pacing ~0:40). */
    firstCycles: 6,
    cycles: 10,
    rosterStart: 6,
    rosterMax: 12,
    /** Graduates beyond the roster pay this many room-cycles as a bonus instead. */
    overflowBonusCycles: 6,
  },

  academyXp: {
    upgrade: 1,
    unlockRoom: 6,
    graduate: 2,
    missionWin: 4,
    /** xpToNext(level) = base + perLevel * (level-1) */
    base: 20,
    perLevel: 9,
    maxLevel: 30,
  },

  offline: {
    efficiency: 0.5,
    capSeconds: 2 * 3600,
    /** Hidden/paused longer than this counts as offline time on return. */
    minAwaySeconds: 60,
  },

  player: {
    speed: 6.5,
    collectRadius: 1.4,
    padRadius: 1.1,
    /** Seconds to pour the full price into an unlock pad. */
    padFillSeconds: 1.1,
    /** Fill time scales with price between these bounds (Kickoff lesson: 0.6-1.5 s). */
    padFillMin: 0.6,
    padFillMax: 1.5,
    stationRadius: 1.05,
    crateRadius: 1.2,
  },
} as const

export function upgradeCost(baseCost: number, level: number): number {
  return Math.ceil(baseCost * Math.pow(ECONOMY.upgradeGrowth, level - 1))
}

export function milestoneMult(level: number): number {
  let m = 1
  for (const ms of ECONOMY.milestones) if (level >= ms) m *= 2
  return m
}

export function stationCost(stationBase: number, built: number): number {
  return Math.ceil(stationBase * Math.pow(ECONOMY.stationGrowth, built))
}

/** 1 during the opening, fading to 0 (keyed to total play time, so returning players never see it). */
export function openingFactor(playSeconds: number): number {
  const o = ECONOMY.opening
  if (playSeconds <= o.fullUntil) return 1
  return Math.max(0, 1 - (playSeconds - o.fullUntil) / o.fadeSeconds)
}

export function padFillSeconds(price: number): number {
  const p = ECONOMY.player
  return Math.min(p.padFillMax, Math.max(p.padFillMin, 0.6 + Math.log10(Math.max(1, price)) * 0.2))
}

export function speedCost(speedLv: number): number {
  return Math.ceil(ECONOMY.speed.baseCost * Math.pow(ECONOMY.speed.growth, speedLv))
}

export function xpToNext(level: number): number {
  return ECONOMY.academyXp.base + ECONOMY.academyXp.perLevel * (level - 1)
}
