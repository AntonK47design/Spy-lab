/** Prestige "Relocate HQ" (brief 5.8): new cover shop, Legacy Medals for lifetime cash. */

export const PRESTIGE = {
  /** Academy level needed to relocate. */
  fromLevel: 15,
  /** Medals owned in total = floor(sqrt(lifetime cash / medalUnit)). */
  medalUnit: 250_000,
  /** Income bonus per medal (permanent). */
  incomePerMedal: 0.1,
} as const

/** Leaderboard id (Bridge config + Playgama console): Legacy Medals, highest first. */
export const LEADERBOARD_ID = 'legacy_medals'

export type ShopId = 'bakery' | 'icecream' | 'flowers' | 'toys' | 'lighthouse'

/** Cover shops in order; the look cycles after the last one. */
export const SHOPS: { id: ShopId; floorA: number; floorB: number; wall: number; trim: number; awning: number }[] = [
  { id: 'bakery', floorA: 0xfff4e8, floorB: 0xf7cfd8, wall: 0xffe3e8, trim: 0xff6b5e, awning: 0xff6b5e },
  { id: 'icecream', floorA: 0xf2fbff, floorB: 0xc9ecf7, wall: 0xe6f7ff, trim: 0x46c2cb, awning: 0x8fd8e8 },
  { id: 'flowers', floorA: 0xf6fff0, floorB: 0xd8f0c6, wall: 0xf0ffe6, trim: 0x5fbf5a, awning: 0xffb3d1 },
  { id: 'toys', floorA: 0xfffbe6, floorB: 0xffe9a8, wall: 0xfff3c4, trim: 0x8f6bd8, awning: 0xf2b134 },
  { id: 'lighthouse', floorA: 0xeef3ff, floorB: 0xcfdcff, wall: 0xf3f6ff, trim: 0x2f6bff, awning: 0xff6b5e },
]

export function shopOf(prestige: number) {
  return SHOPS[prestige % SHOPS.length]!
}

export function medalsFor(lifetimeCash: number): number {
  return Math.floor(Math.sqrt(Math.max(0, lifetimeCash) / PRESTIGE.medalUnit))
}
