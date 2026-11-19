import type { Skill } from './rooms.ts'

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export const SKILLS: Skill[] = ['finesse', 'stealth', 'brains', 'charm', 'agility', 'tech']

export const AGENTS = {
  /** Main skill = base + roomLevel * perRoomLevel + random(0..spread). */
  mainSkillBase: 8,
  perRoomLevel: 0.6,
  spread: 8,
  /** Side skills random 1..sideMax. */
  sideMax: 5,
  /** Rarity by total skill (thresholds checked from the top). */
  rarityThresholds: [
    { rarity: 'legendary' as Rarity, total: 60 },
    { rarity: 'epic' as Rarity, total: 42 },
    { rarity: 'rare' as Rarity, total: 30 },
    { rarity: 'common' as Rarity, total: 0 },
  ],
  xpPerMission: 1,
} as const

/** Fictional first names + code names (no real persons or franchises). */
export const AGENT_FIRST = [
  'Mila', 'Otto', 'Juno', 'Felix', 'Nora', 'Kip', 'Ada', 'Bruno', 'Lumi', 'Theo', 'Ivy', 'Rex',
  'Zara', 'Hugo', 'Pia', 'Leo', 'Wren', 'Max', 'Tess', 'Emil', 'Rosa', 'Finn', 'Yuki', 'Omar',
]
export const AGENT_CODE = [
  'Croissant', 'Sprinkle', 'Pretzel', 'Muffin', 'Biscotti', 'Toffee', 'Waffle', 'Cupcake',
  'Macaron', 'Strudel', 'Bagel', 'Brioche', 'Eclair', 'Scone', 'Fudge', 'Praline',
]
