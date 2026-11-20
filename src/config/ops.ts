/** Field Ops, Villain Alerts and Endless Ops (brief 5.4/5.5). */

export const FIELD_OPS = {
  /** Unlock: academy level. */
  fromLevel: 4,
  slots: 3,
  /** Durations (minutes) with reward multipliers on the graduate's sale fee and flat intel. */
  ops: [
    { minutes: 5, feeMult: 3, intel: 2 },
    { minutes: 15, feeMult: 7, intel: 5 },
    { minutes: 60, feeMult: 20, intel: 14 },
  ],
} as const

export const VILLAIN_ALERT = {
  /** Active play seconds between alerts (random in range). */
  everyMin: 300,
  everyMax: 480,
  /** Seconds the alert stays on the map. */
  lasts: 180,
  /** Reward: this many times the next mission's cash, plus Gold Badges. */
  cashMult: 1.5,
  badges: 2,
  /** Difficulty: highest won tier of that minigame + this (max 10). */
  tierStep: 1,
  /** First alert only after this academy level. */
  fromLevel: 3,
} as const

export const ENDLESS = {
  /** Unlocked when this mission is won. */
  after: 'snowpeak_boss',
  /** Tier = min(10, base + floor(n / every)). */
  baseTier: 4,
  tierEvery: 2,
  /** Cash grows per op. */
  cashBase: 60000,
  cashGrowth: 1.18,
  intelBase: 25,
  intelStep: 3,
} as const
