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
