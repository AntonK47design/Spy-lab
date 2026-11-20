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
  /** Boss missions: minigames played back to back (the first one is also minigame/room/tier). */
  stages?: { minigame: MinigameId; room: RoomId; tier: number }[]
  /** Boss missions: Gold Badges on top of cash + intel. */
  badges?: number
}

/** Region look for the minigame scenes (palette swap). Harbor keeps each minigame's own colours. */
export const REGION_LOOK: Record<RegionId, { bg: number | null; sky: number; walk: number; bank: number; night: boolean }> = {
  harbor: { bg: null, sky: 0x9fd3e8, walk: 0xe8d7b0, bank: 0xc9b48c, night: false },
  snowpeak: { bg: 0x1d2f4a, sky: 0xcfe6f2, walk: 0xeef4fa, bank: 0xffffff, night: false },
  dune: { bg: 0x3a2a1e, sky: 0xf5d9a8, walk: 0xe8cf98, bank: 0xe0b870, night: false },
  neon: { bg: 0x1a0f2e, sky: 0x1b1035, walk: 0x3a3550, bank: 0xff4fd8, night: true },
  sky: { bg: 0x2a3f66, sky: 0xbfe0ff, walk: 0xf3eee6, bank: 0xffffff, night: false },
}

/** Boss looks (Velvet Paw lieutenants). */
export const BOSSES: Partial<Record<RegionId, { suit: number; hat: 'captain' | 'bobble'; hatColor: number }>> = {
  harbor: { suit: 0x1f2a44, hat: 'captain', hatColor: 0xffffff },
  snowpeak: { suit: 0xe8eef5, hat: 'bobble', hatColor: 0x5ab4ff },
  dune: { suit: 0xd9b46a, hat: 'captain', hatColor: 0xf2d27a },
  neon: { suit: 0x2b1b3a, hat: 'bobble', hatColor: 0xff4fd8 },
  sky: { suit: 0x6b1f3a, hat: 'captain', hatColor: 0x1b1b24 },
}

const BOSS_STAGES: Partial<Record<RegionId, [MinigameId, RoomId, number][]>> = {
  harbor: [['safe', 'vault', 4], ['laser', 'laser', 3], ['code', 'cipher', 3]],
  snowpeak: [['scooter', 'driving', 4], ['circuit', 'hack', 3], ['mole', 'disguise', 3]],
  dune: [['mole', 'disguise', 6], ['scooter', 'driving', 7], ['safe', 'vault', 7]],
  neon: [['circuit', 'hack', 8], ['laser', 'laser', 8], ['code', 'cipher', 8]],
  sky: [['laser', 'laser', 10], ['circuit', 'hack', 10], ['scooter', 'driving', 10]],
}

export const BOSS_REWARD = { cashMult: 3, intelMult: 2, badges: 5 } as const

/** Minigames playable in the current build (others show "coming soon"). */
export const PLAYABLE_MINIGAMES: MinigameId[] = ['safe', 'laser', 'code', 'mole', 'scooter', 'circuit']

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

/** Dune Oasis (desert train station). */
const D: [MinigameId, RoomId, number][] = [
  ['mole', 'disguise', 4],
  ['scooter', 'driving', 5],
  ['safe', 'vault', 6],
  ['circuit', 'hack', 4],
  ['laser', 'laser', 5],
  ['code', 'cipher', 5],
  ['mole', 'disguise', 5],
  ['scooter', 'driving', 6],
  ['circuit', 'hack', 5],
  ['safe', 'vault', 7],
]

/** Neon City (megacity at night). */
const N: [MinigameId, RoomId, number][] = [
  ['laser', 'laser', 6],
  ['circuit', 'hack', 6],
  ['code', 'cipher', 6],
  ['scooter', 'driving', 7],
  ['mole', 'disguise', 6],
  ['safe', 'vault', 8],
  ['laser', 'laser', 7],
  ['circuit', 'hack', 7],
  ['code', 'cipher', 7],
  ['scooter', 'driving', 8],
]

/** Sky Station (airship port, finale). */
const K: [MinigameId, RoomId, number][] = [
  ['safe', 'vault', 9],
  ['laser', 'laser', 8],
  ['mole', 'disguise', 8],
  ['circuit', 'hack', 8],
  ['code', 'cipher', 8],
  ['scooter', 'driving', 9],
  ['laser', 'laser', 9],
  ['mole', 'disguise', 9],
  ['circuit', 'hack', 9],
  ['code', 'cipher', 9],
]

const REGION_LISTS: [RegionId, [MinigameId, RoomId, number][]][] = [
  ['harbor', H],
  ['snowpeak', S],
  ['dune', D],
  ['neon', N],
  ['sky', K],
]

/** Regions with missions in this build, in order. */
export const REGIONS: RegionId[] = REGION_LISTS.map(([r]) => r)

const cashAt = (n: number) => Math.round(50 * Math.pow(1.75, n))

export const MISSIONS: MissionDef[] = REGION_LISTS.flatMap(([region, list], ri) => {
  const out: MissionDef[] = list.map(([minigame, room, tier], i) => {
    const n = ri * 10 + i // global ordinal: rewards keep growing across regions
    return {
      id: `${region}_${String(i + 1).padStart(2, '0')}`,
      region,
      index: i,
      minigame,
      tier,
      room,
      cash: cashAt(n),
      intel: 3 + n * 2,
    }
  })
  const stages = BOSS_STAGES[region]
  if (stages) {
    const n = ri * 10 + list.length
    out.push({
      id: `${region}_boss`,
      region,
      index: list.length,
      minigame: stages[0]![0],
      room: stages[0]![1],
      tier: stages[0]![2],
      cash: cashAt(n) * BOSS_REWARD.cashMult,
      intel: (3 + n * 2) * BOSS_REWARD.intelMult,
      boss: true,
      stages: stages.map(([minigame, room, tier]) => ({ minigame, room, tier })),
      badges: BOSS_REWARD.badges,
    })
  }
  return out
})

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
