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

// ---------------------------------------------------------------- Spot the Mole (Charm)
export interface MoleTier {
  /** Travellers walking around the station hall (incl. the mole). */
  npcs: number
  /** Clues revealed one after another (attributes of the mole). */
  clues: number
  /** Seconds between two clues (the first one shows at once). */
  clueInterval: number
  /** Walking speed (m/s). */
  speed: number
  /** Chance that a decoy copies one of the mole's attributes (look-alikes). */
  similarity: number
  timeLimit: number
}

export const MOLE_TIERS: MoleTier[] = [
  { npcs: 10, clues: 2, clueInterval: 3.5, speed: 0.5, similarity: 0.1, timeLimit: 45 },
  { npcs: 12, clues: 2, clueInterval: 3.5, speed: 0.55, similarity: 0.15, timeLimit: 45 },
  { npcs: 14, clues: 3, clueInterval: 4, speed: 0.6, similarity: 0.15, timeLimit: 48 },
  { npcs: 16, clues: 3, clueInterval: 4, speed: 0.65, similarity: 0.2, timeLimit: 48 },
  { npcs: 18, clues: 3, clueInterval: 4.5, speed: 0.7, similarity: 0.25, timeLimit: 50 },
  { npcs: 20, clues: 3, clueInterval: 4.5, speed: 0.75, similarity: 0.3, timeLimit: 50 },
  { npcs: 22, clues: 4, clueInterval: 5, speed: 0.8, similarity: 0.3, timeLimit: 55 },
  { npcs: 24, clues: 4, clueInterval: 5, speed: 0.85, similarity: 0.35, timeLimit: 55 },
  { npcs: 26, clues: 4, clueInterval: 5.5, speed: 0.9, similarity: 0.4, timeLimit: 58 },
  { npcs: 28, clues: 4, clueInterval: 5.5, speed: 0.95, similarity: 0.45, timeLimit: 60 },
]

export const MOLE = {
  /** Wrong suspect: seconds lost. */
  wrongPenalty: 5,
  /** Charm skill shortens the clue interval by this share per point (max below). */
  skillFasterPerPoint: 0.01,
  maxSkillFaster: 0.35,
  freeHints: 1,
  /** Hint: share of the wrong suspects that leave the hall. */
  hintRemoveShare: 0.5,
  reviveSeconds: 15,
  /** Stars by share of time left: >= 3-star share -> 3, >= 2-star share -> 2. */
  threeStarLeftShare: 0.45,
  twoStarLeftShare: 0.2,
  /** Attribute values (index 0 = none). Colours shared with the HUD swatches. */
  hats: [null, 0xe0483e, 0x2f6bff, 0x3a9b4a, 0xf2b134, 0x2b2b36] as (number | null)[],
  hatNames: ['none', 'red', 'blue', 'green', 'yellow', 'black'] as const,
  shirts: [0xd9503a, 0x2f6fb0, 0x4c9b5a, 0xe8c23a, 0xf2f2f2] as number[],
  shirtNames: ['red', 'blue', 'green', 'yellow', 'white'] as const,
} as const

// ---------------------------------------------------------------- Scooter Pursuit (Agility)
export interface ScooterTier {
  /** Own cruising speed (m/s). */
  speed: number
  /** Head start of the thief (m) - the catch-up bar is full when it is closed. */
  gap: number
  /** Thief speed as a share of the own speed. */
  thiefShare: number
  /** Metres between obstacle rows. */
  rowSpacing: number
  /** Chance that a row blocks two lanes. */
  doubleChance: number
  /** Chance that a car in a row drifts into the next lane. */
  driftChance: number
  timeLimit: number
}

export const SCOOTER_TIERS: ScooterTier[] = [
  { speed: 10, gap: 45, thiefShare: 0.72, rowSpacing: 22, doubleChance: 0, driftChance: 0, timeLimit: 40 },
  { speed: 10.5, gap: 50, thiefShare: 0.72, rowSpacing: 20, doubleChance: 0.1, driftChance: 0, timeLimit: 40 },
  { speed: 11, gap: 55, thiefShare: 0.74, rowSpacing: 19, doubleChance: 0.2, driftChance: 0, timeLimit: 42 },
  { speed: 11.5, gap: 60, thiefShare: 0.75, rowSpacing: 18, doubleChance: 0.3, driftChance: 0.1, timeLimit: 44 },
  { speed: 12, gap: 64, thiefShare: 0.76, rowSpacing: 17, doubleChance: 0.35, driftChance: 0.15, timeLimit: 45 },
  { speed: 13, gap: 68, thiefShare: 0.77, rowSpacing: 17, doubleChance: 0.4, driftChance: 0.2, timeLimit: 46 },
  { speed: 14, gap: 72, thiefShare: 0.78, rowSpacing: 17, doubleChance: 0.45, driftChance: 0.25, timeLimit: 48 },
  { speed: 15, gap: 76, thiefShare: 0.79, rowSpacing: 17, doubleChance: 0.5, driftChance: 0.3, timeLimit: 50 },
  { speed: 16, gap: 80, thiefShare: 0.8, rowSpacing: 17.5, doubleChance: 0.55, driftChance: 0.3, timeLimit: 52 },
  { speed: 17, gap: 85, thiefShare: 0.8, rowSpacing: 18, doubleChance: 0.6, driftChance: 0.35, timeLimit: 55 },
]

export const SCOOTER = {
  lanes: 3,
  laneWidth: 2.2,
  /** Seconds for one lane change. */
  laneChangeSeconds: 0.16,
  /** Agility skill: +speed share per point (max below). */
  skillSpeedPerPoint: 0.004,
  maxSkillSpeed: 0.15,
  maxCrashes: 3,
  /** After a crash: standstill + slow restart, then invulnerable (blinking). */
  crashStopSeconds: 0.7,
  invulnerableSeconds: 1.6,
  /** Boost pad: speed multiplier for a while. */
  boostMult: 1.6,
  boostSeconds: 1.8,
  /** Chance per row of a boost pad in a free lane, and of an intel chip. */
  boostChance: 0.3,
  chipChance: 0.35,
  intelPerChip: 1,
  /** Revive: crashes back to max-1, + seconds. */
  reviveSeconds: 12,
  /** Stars: 0 crashes = 3, 1 crash = 2, else 1. */
} as const

// ---------------------------------------------------------------- Circuit Hack (Tech)
export interface CircuitTier {
  /** Grid size n x n. */
  size: number
  /** Terminals that must receive power. */
  targets: number
  timeLimit: number
}

export const CIRCUIT_TIERS: CircuitTier[] = [
  { size: 4, targets: 1, timeLimit: 45 },
  { size: 4, targets: 2, timeLimit: 50 },
  { size: 5, targets: 2, timeLimit: 55 },
  { size: 5, targets: 3, timeLimit: 60 },
  { size: 5, targets: 3, timeLimit: 55 },
  { size: 6, targets: 3, timeLimit: 70 },
  { size: 6, targets: 4, timeLimit: 72 },
  { size: 6, targets: 4, timeLimit: 66 },
  { size: 7, targets: 4, timeLimit: 85 },
  { size: 7, targets: 5, timeLimit: 85 },
]

export const CIRCUIT = {
  /** Tech skill: + seconds per point (max below). */
  skillSecondsPerPoint: 0.5,
  maxSkillSeconds: 15,
  freeHints: 1,
  /** Hint: tiles snapped into place. */
  hintTiles: 3,
  reviveSeconds: 20,
  threeStarLeftShare: 0.4,
  twoStarLeftShare: 0.15,
  /** Seconds for one quarter turn (animation only; input is never blocked). */
  turnSeconds: 0.12,
} as const

// ---------------------------------------------------------------- Vault Bonus (Safe Cracker bonus round)
export const VAULT_BONUS = {
  /** Loot per bolt = this share of the next mission's cash reward (min below). */
  lootShare: 0.35,
  minLoot: 60,
  /** Safe tier = 1 + floor(academy level / this), max 10. */
  levelsPerTier: 3,
  /** Offered after a boss win and after every academy level-up from this level on. */
  fromLevel: 3,
} as const
