/** Difficulty parameters per minigame, tier 1..10. */

export interface SafeTier {
  bolts: number
  /** Pointer speed in revolutions per second. */
  speed: number
  /** Sweet spot width in degrees. */
  zoneDeg: number
  /** Pointer reverses direction after every successful bolt. */
  reverse: boolean
  /** Decoy zones (look similar, count as a mistake). */
  fakes: number
  timeLimit: number
  maxMistakes: number
}

export const SAFE_TIERS: SafeTier[] = [
  { bolts: 3, speed: 0.32, zoneDeg: 62, reverse: false, fakes: 0, timeLimit: 35, maxMistakes: 3 },
  { bolts: 3, speed: 0.38, zoneDeg: 54, reverse: false, fakes: 0, timeLimit: 33, maxMistakes: 3 },
  { bolts: 4, speed: 0.42, zoneDeg: 48, reverse: true, fakes: 0, timeLimit: 32, maxMistakes: 3 },
  { bolts: 4, speed: 0.46, zoneDeg: 44, reverse: true, fakes: 1, timeLimit: 32, maxMistakes: 3 },
  { bolts: 4, speed: 0.5, zoneDeg: 40, reverse: true, fakes: 1, timeLimit: 30, maxMistakes: 3 },
  { bolts: 5, speed: 0.54, zoneDeg: 36, reverse: true, fakes: 1, timeLimit: 30, maxMistakes: 3 },
  { bolts: 5, speed: 0.58, zoneDeg: 33, reverse: true, fakes: 2, timeLimit: 30, maxMistakes: 3 },
  { bolts: 5, speed: 0.62, zoneDeg: 30, reverse: true, fakes: 2, timeLimit: 28, maxMistakes: 3 },
  { bolts: 6, speed: 0.66, zoneDeg: 28, reverse: true, fakes: 2, timeLimit: 30, maxMistakes: 3 },
  { bolts: 6, speed: 0.72, zoneDeg: 25, reverse: true, fakes: 3, timeLimit: 30, maxMistakes: 3 },
]

export const SAFE = {
  /** Extra zone degrees per point of the agent's finesse skill. */
  zoneDegPerSkill: 0.35,
  maxSkillBonusDeg: 12,
  /** Revive (rewarded, max once per attempt): mistakes reset to this many left, + seconds. */
  reviveMistakesLeft: 2,
  reviveSeconds: 10,
  /** Stars: 3 = no mistakes and >= this share of time left; 2 = at most one mistake. */
  threeStarTimeShare: 0.35,
} as const

/**
 * Laser Hall (Stealth): hop field by field down a 5 x rows corridor to the briefcase.
 * Hazard rows: static beams with gaps, blinking beams, sweeping beams, cameras with a sweeping
 * cone. Safe rows sit between hazards; a hit sends the agent back to the last safe row.
 */
export interface LaserTier {
  /** Hazard mix, in corridor order (front to back). */
  hazards: ('static' | 'blink' | 'sweep' | 'camera')[]
  /** Blink period (s) and share of it the beam is on. */
  blinkPeriod: number
  blinkOn: number
  /** Sweeping beam / camera cone speed (columns per second). */
  sweepSpeed: number
  /** Intel chips placed on safe cells. */
  chips: number
  timeLimit: number
  maxMistakes: number
}

export const LASER_TIERS: LaserTier[] = [
  { hazards: ['static', 'blink', 'static', 'blink'], blinkPeriod: 2.4, blinkOn: 0.45, sweepSpeed: 1.2, chips: 2, timeLimit: 45, maxMistakes: 3 },
  { hazards: ['static', 'blink', 'sweep', 'static', 'blink'], blinkPeriod: 2.2, blinkOn: 0.5, sweepSpeed: 1.3, chips: 2, timeLimit: 45, maxMistakes: 3 },
  { hazards: ['blink', 'static', 'camera', 'sweep', 'blink'], blinkPeriod: 2.1, blinkOn: 0.5, sweepSpeed: 1.4, chips: 2, timeLimit: 45, maxMistakes: 3 },
  { hazards: ['static', 'sweep', 'blink', 'camera', 'static', 'blink'], blinkPeriod: 2.0, blinkOn: 0.52, sweepSpeed: 1.5, chips: 3, timeLimit: 45, maxMistakes: 3 },
  { hazards: ['blink', 'camera', 'sweep', 'static', 'blink', 'sweep'], blinkPeriod: 1.9, blinkOn: 0.55, sweepSpeed: 1.6, chips: 3, timeLimit: 44, maxMistakes: 3 },
  { hazards: ['sweep', 'blink', 'camera', 'static', 'sweep', 'blink', 'camera'], blinkPeriod: 1.8, blinkOn: 0.55, sweepSpeed: 1.7, chips: 3, timeLimit: 44, maxMistakes: 3 },
  { hazards: ['blink', 'sweep', 'camera', 'blink', 'static', 'sweep', 'camera'], blinkPeriod: 1.7, blinkOn: 0.57, sweepSpeed: 1.8, chips: 3, timeLimit: 42, maxMistakes: 2 },
  { hazards: ['camera', 'blink', 'sweep', 'static', 'blink', 'camera', 'sweep', 'blink'], blinkPeriod: 1.6, blinkOn: 0.58, sweepSpeed: 1.9, chips: 3, timeLimit: 42, maxMistakes: 2 },
  { hazards: ['sweep', 'camera', 'blink', 'sweep', 'camera', 'blink', 'static', 'sweep'], blinkPeriod: 1.5, blinkOn: 0.6, sweepSpeed: 2.0, chips: 3, timeLimit: 40, maxMistakes: 2 },
  { hazards: ['blink', 'sweep', 'camera', 'blink', 'sweep', 'camera', 'blink', 'sweep', 'camera'], blinkPeriod: 1.5, blinkOn: 0.58, sweepSpeed: 2.1, chips: 3, timeLimit: 42, maxMistakes: 2 },
]

export const LASER = {
  cols: 5,
  /** Minimum corridor length; high tiers get longer so a safe row precedes every hazard. */
  rows: 12,
  /** Seconds per hop. */
  hopSeconds: 0.17,
  /** Shorter on-phase per point of the agent's stealth skill (share of the period). */
  onSharePerSkill: 0.006,
  maxSkillBonus: 0.15,
  /** A camera needs this long on the same lit cell to spot the agent. */
  cameraGrace: 0.35,
  /** Warning flicker before a blinking beam switches on (s). */
  warnSeconds: 0.35,
  /** Revive: mistakes reset to this many left, + seconds. */
  reviveMistakesLeft: 1,
  reviveSeconds: 12,
  threeStarTimeShare: 0.4,
  /** Intel per collected chip (added to the mission reward). */
  intelPerChip: 2,
} as const

/**
 * Code Breaker (Brains): Mastermind on a keypad. Guess the code; each slot lights green (right
 * symbol, right place), yellow (in the code, elsewhere) or grey (not in the code).
 */
export interface CodeTier {
  /** Different symbols on the keypad (5-7). */
  symbols: number
  length: number
  attempts: number
  /** Seconds; 0 = no time limit (tiers 1-4). */
  timeLimit: number
  /** The code may repeat a symbol. */
  duplicates: boolean
}

export const CODE_TIERS: CodeTier[] = [
  { symbols: 5, length: 4, attempts: 8, timeLimit: 0, duplicates: false },
  { symbols: 5, length: 4, attempts: 8, timeLimit: 0, duplicates: false },
  { symbols: 6, length: 4, attempts: 7, timeLimit: 0, duplicates: false },
  { symbols: 6, length: 4, attempts: 7, timeLimit: 0, duplicates: true },
  { symbols: 6, length: 4, attempts: 7, timeLimit: 90, duplicates: true },
  { symbols: 7, length: 4, attempts: 7, timeLimit: 85, duplicates: true },
  { symbols: 7, length: 4, attempts: 6, timeLimit: 80, duplicates: true },
  { symbols: 7, length: 4, attempts: 6, timeLimit: 75, duplicates: true },
  { symbols: 7, length: 4, attempts: 6, timeLimit: 70, duplicates: true },
  { symbols: 7, length: 4, attempts: 6, timeLimit: 65, duplicates: true },
]

export const CODE = {
  /** +1 attempt per this many points of the agent's brains skill (max +2). */
  skillPerAttempt: 12,
  maxSkillAttempts: 2,
  /** Free hints per attempt; more cost a rewarded ad. */
  freeHints: 1,
  /** Revive: extra attempts (and seconds if timed). */
  reviveAttempts: 2,
  reviveSeconds: 20,
  /** Stars by share of attempts left after solving: >= 3-star share -> 3, >= 2-star share -> 2. */
  threeStarLeftShare: 0.5,
  twoStarLeftShare: 0.25,
  /** Symbol shapes and colours (index = key 1..7). */
  shapes: ['circle', 'triangle', 'square', 'star', 'diamond', 'hexagon', 'cross'] as const,
  colors: [0xf2665c, 0xf2b134, 0x46c2cb, 0x8f6bd8, 0x5fbf5a, 0xff8fb0, 0xfff3e0],
} as const
