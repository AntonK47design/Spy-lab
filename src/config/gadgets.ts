import type { MinigameId } from './rooms.ts'

export type GadgetId = 'stethoscope' | 'mirror' | 'decoder' | 'scanner' | 'turbo' | 'splicer'

export interface GadgetDef {
  id: GadgetId
  minigame: MinigameId
  /** Intel to craft one. */
  intel: number
  /** Real seconds of crafting. */
  seconds: number
}

/** Gadget Lab recipes (brief 5.7). Effects live in the minigames, sizes below. */
export const GADGETS: GadgetDef[] = [
  { id: 'stethoscope', minigame: 'safe', intel: 12, seconds: 60 },
  { id: 'mirror', minigame: 'laser', intel: 15, seconds: 75 },
  { id: 'decoder', minigame: 'code', intel: 15, seconds: 75 },
  { id: 'scanner', minigame: 'mole', intel: 18, seconds: 90 },
  { id: 'turbo', minigame: 'scooter', intel: 20, seconds: 90 },
  { id: 'splicer', minigame: 'circuit', intel: 22, seconds: 105 },
]

export const GADGET = {
  /** Safe Cracker: sweet spot +15 %. */
  stethoscopeZone: 0.15,
  /** Spot the Mole: wrong suspects that leave at the start. */
  scannerRemove: 3,
  /** Circuit Hack: tiles pre-solved. */
  splicerTiles: 2,
  /** Scooter Pursuit: boost at the start (s). */
  turboSeconds: 3,
  /** Gold Badges to finish a running craft instantly. */
  rushBadges: 1,
  /** Most of one gadget you can stock. */
  maxStock: 9,
} as const

export function gadgetFor(minigame: MinigameId): GadgetDef | undefined {
  return GADGETS.find((g) => g.minigame === minigame)
}
