/**
 * Global economy + pacing numbers. Start values; tuned with `npm run sim` against
 * the pacing table in docs/SPY_LAB_BRIEF.md §5.10. The game must be fair WITHOUT ads.
 */
export const ECONOMY = {
  startCash: 0,
  upgradeGrowth: 1.15,
  /** Room level milestones that double income. */
  milestones: [10, 25, 50, 100, 150, 200],
  maxRoomLevel: 200,

  slots: { start: 2, max: 6, baseCost: 40, growth: 3.2 },
  speed: { max: 10, baseCost: 60, growth: 2.4, factorPerLevel: 0.92 },
  /** Instructor: auto-collects the stack and trains faster. */
  instructorSpeedFactor: 0.8,

  /** Uncollected cash stack cap, in "cycles of the full room". */
  stackCapCycles: 10,

  recruit: {
    /** Seconds between new cadets at the bakery (while a slot is free). */
    interval: 6,
    walkSpeed: 2.6,
  },
  graduation: {
    /** Cycles until the very first cadet graduates (tutorial pacing ~0:40). */
    firstCycles: 8,
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
    perLevel: 16,
    maxLevel: 30,
  },

  offline: {
    efficiency: 0.5,
    capSeconds: 2 * 3600,
    /** Hidden/paused longer than this counts as offline time on return. */
    minAwaySeconds: 60,
  },

  player: {
    speed: 5.2,
    collectRadius: 1.4,
    padRadius: 1.1,
    /** Seconds to pour the full price into an unlock pad. */
    padFillSeconds: 1.1,
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

export function slotCost(slots: number): number {
  return Math.ceil(ECONOMY.slots.baseCost * Math.pow(ECONOMY.slots.growth, slots - ECONOMY.slots.start))
}

export function speedCost(speedLv: number): number {
  return Math.ceil(ECONOMY.speed.baseCost * Math.pow(ECONOMY.speed.growth, speedLv))
}

export function xpToNext(level: number): number {
  return ECONOMY.academyXp.base + ECONOMY.academyXp.perLevel * (level - 1)
}
