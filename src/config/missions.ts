import type { MinigameId, RoomId } from './rooms.ts'

export type RegionId = 'harbor' | 'snowpeak' | 'dune' | 'neon' | 'sky'

export interface MissionDef {
  id: string
  region: RegionId
  index: number
  minigame: MinigameId
  tier: number
  /** Training room that must be unlocked (provides the agents' skill). */
  room: RoomId
  cash: number
  intel: number
  boss?: boolean
}

/** Minigames playable in the current build (others show "coming soon"). */
export const PLAYABLE_MINIGAMES: MinigameId[] = ['safe']

const H: [MinigameId, RoomId, number][] = [
  ['safe', 'vault', 1],
  ['laser', 'laser', 1],
  ['safe', 'vault', 2],
  ['code', 'cipher', 1],
  ['laser', 'laser', 2],
  ['safe', 'vault', 3],
  ['mole', 'disguise', 1],
  ['code', 'cipher', 2],
  ['safe', 'vault', 4],
  ['mole', 'disguise', 2],
]

export const MISSIONS: MissionDef[] = H.map(([minigame, room, tier], i) => ({
  id: `harbor_${String(i + 1).padStart(2, '0')}`,
  region: 'harbor' as RegionId,
  index: i,
  minigame,
  tier,
  room,
  cash: Math.round(50 * Math.pow(1.75, i)),
  intel: 3 + i * 2,
}))

export const MISSION_REWARDS = {
  /** Replaying an already won mission pays this share. */
  replayShare: 0.5,
  /** Star bonus multiplier per star above 1. */
  perStar: 0.25,
  doubleMult: 2,
} as const

export function missionById(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id)
}
