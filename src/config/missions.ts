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
export const PLAYABLE_MINIGAMES: MinigameId[] = ['safe', 'laser', 'code', 'mole', 'scooter']

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

/** Snowpeak: introduces Scooter Pursuit (Driving Simulator) and Circuit Hack (Hack Lab). */
const S: [MinigameId, RoomId, number][] = [
  ['scooter', 'driving', 1],
  ['safe', 'vault', 5],
  ['scooter', 'driving', 2],
  ['laser', 'laser', 3],
  ['circuit', 'hack', 1],
  ['code', 'cipher', 3],
  ['scooter', 'driving', 3],
  ['mole', 'disguise', 3],
  ['circuit', 'hack', 2],
  ['scooter', 'driving', 4],
]

const REGION_LISTS: [RegionId, [MinigameId, RoomId, number][]][] = [
  ['harbor', H],
  ['snowpeak', S],
]

/** Regions with missions in this build, in order. */
export const REGIONS: RegionId[] = REGION_LISTS.map(([r]) => r)

export const MISSIONS: MissionDef[] = REGION_LISTS.flatMap(([region, list], ri) =>
  list.map(([minigame, room, tier], i) => {
    const n = ri * 10 + i // global ordinal: rewards keep growing across regions
    return {
      id: `${region}_${String(i + 1).padStart(2, '0')}`,
      region,
      index: i,
      minigame,
      tier,
      room,
      cash: Math.round(50 * Math.pow(1.75, n)),
      intel: 3 + n * 2,
    }
  }),
)

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
