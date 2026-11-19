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

export const ADS = {
  /** Placement Bridge preloads right after init. */
  interstitialPreload: 'mission_end' as InterstitialPlacement,
  rewardedPreload: 'mission_double' as RewardedPlacement,
  /** Dev ad simulator: how long a simulated ad stays open (ms). */
  simulatedAdDurationMs: 1200,
} as const
