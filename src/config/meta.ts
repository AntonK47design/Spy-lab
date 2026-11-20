/** Daily rewards (7-day streak), daily contracts and achievements (brief 5.9). Saved via Bridge storage. */

export type DailyReward = { kind: 'cash'; seconds: number; min: number } | { kind: 'badges'; n: number } | { kind: 'intel'; n: number } | { kind: 'gadget' }

/** One per day; the streak restarts after day 7 or when a day is missed. */
export const DAILY: DailyReward[] = [
  { kind: 'cash', seconds: 120, min: 300 },
  { kind: 'intel', n: 10 },
  { kind: 'badges', n: 1 },
  { kind: 'cash', seconds: 300, min: 800 },
  { kind: 'gadget' },
  { kind: 'intel', n: 25 },
  { kind: 'badges', n: 5 },
]

export type StatKey = 'upgrades' | 'collects' | 'missionsWon' | 'served' | 'delivered' | 'purchases' | 'graduates' | 'stars'

/** Contract templates (3 picked per UTC day). */
export const CONTRACTS: { id: string; stat: StatKey; goal: number; badges: number }[] = [
  { id: 'win', stat: 'missionsWon', goal: 3, badges: 2 },
  { id: 'upgrade', stat: 'upgrades', goal: 15, badges: 1 },
  { id: 'stars', stat: 'stars', goal: 5, badges: 2 },
  { id: 'collect', stat: 'collects', goal: 25, badges: 1 },
  { id: 'serve', stat: 'served', goal: 12, badges: 1 },
  { id: 'deliver', stat: 'delivered', goal: 30, badges: 1 },
  { id: 'build', stat: 'purchases', goal: 8, badges: 1 },
  { id: 'graduate', stat: 'graduates', goal: 5, badges: 2 },
]
export const CONTRACTS_PER_DAY = 3
/** Contracts show up from this academy level (brief: ~20:00). */
export const CONTRACTS_FROM_LEVEL = 4

/** Achievements: lifetime goals with Gold Badges. */
export const ACHIEVEMENTS: { id: string; stat: StatKey | 'earned' | 'prestige' | 'bosses'; goal: number; badges: number }[] = [
  { id: 'first_mission', stat: 'missionsWon', goal: 1, badges: 1 },
  { id: 'missions_25', stat: 'missionsWon', goal: 25, badges: 3 },
  { id: 'missions_100', stat: 'missionsWon', goal: 100, badges: 8 },
  { id: 'stars_30', stat: 'stars', goal: 30, badges: 3 },
  { id: 'stars_120', stat: 'stars', goal: 120, badges: 8 },
  { id: 'graduates_25', stat: 'graduates', goal: 25, badges: 2 },
  { id: 'graduates_150', stat: 'graduates', goal: 150, badges: 6 },
  { id: 'upgrades_100', stat: 'upgrades', goal: 100, badges: 2 },
  { id: 'earned_1m', stat: 'earned', goal: 1_000_000, badges: 3 },
  { id: 'earned_1b', stat: 'earned', goal: 1_000_000_000, badges: 10 },
  { id: 'boss_1', stat: 'bosses', goal: 1, badges: 3 },
  { id: 'boss_5', stat: 'bosses', goal: 5, badges: 15 },
  { id: 'prestige_1', stat: 'prestige', goal: 1, badges: 5 },
]
