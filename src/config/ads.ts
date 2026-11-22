// Ad placement ids. Must match public/playgama-bridge-config.json
// (scripts/check-build.mjs verifies both lists are identical).

export const INTERSTITIAL_PLACEMENTS = [
  'mission_end',
  'boss_end',
  'map_close',
  'level_up',
  'panel_close',
  'pause_resume',
  'prestige',
] as const

export const REWARDED_PLACEMENTS = [
  'mission_double',
  'mission_revive',
  'mission_skip',
  'minigame_hint',
  'gadget_trial',
  'offline_double',
  'income_boost',
  'supply_drop',
  'missing_cash',
  'vip_recruit',
  'fieldop_finish',
  'daily_double',
  'vault_retry',
  'free_badges',
] as const

export type InterstitialPlacement = (typeof INTERSTITIAL_PLACEMENTS)[number]
export type RewardedPlacement = (typeof REWARDED_PLACEMENTS)[number]

/**
 * Interstitial rules on top of the Bridge's own rate limit (product decision, not a timer):
 * no interstitial until this many missions have ended AND not at the end of the last of them,
 * so a new player's first mission (and everything before it) is ad-free.
 */
export const INTERSTITIAL_RULES = {
  adFreeMissions: 1,
}

/** Rewarded offers with real value (brief 7.2). */
export const OFFERS = {
  /** mission_skip: offered after this many fails of the same mission. */
  skipAfterFails: 2,
  /** income_boost: x2 income per ad, stackable up to the cap. */
  boostMinutes: 5,
  boostMaxMinutes: 30,
  boostMult: 2,
  /** missing_cash: offered when at most this share of an upgrade is missing, at most every N s. */
  missingShare: 0.25,
  missingEverySeconds: 120,
  /** supply_drop: a drone every N s of active academy play, stays this long; the first crate is free. */
  supplyEvery: 180,
  supplyStays: 20,
  /** Crate contents: income of this many seconds, or Gold Badges, or a gadget (weights). */
  supplyCashSeconds: 60,
  supplyBadges: 1,
  supplyWeights: { cash: 0.6, badges: 0.25, gadget: 0.15 },
  /** vip_recruit: a prodigy waits at the shop every N s of active play for this long. */
  vipEvery: 260,
  vipStays: 30,
  /** VIP rarity odds (rest: rare). */
  vipEpicChance: 0.35,
  vipLegendaryChance: 0.08,
  /** free_badges: Gold Badges per ad, cooldown (s). */
  freeBadges: 1,
  freeBadgesCooldown: 600,
} as const

export const ADS = {
  /** Placement Bridge preloads right after init. */
  interstitialPreload: 'mission_end' as InterstitialPlacement,
  rewardedPreload: 'mission_double' as RewardedPlacement,
  /** Dev ad simulator: how long a simulated ad stays open (ms). */
  simulatedAdDurationMs: 1200,
} as const
