/**
 * Academy layout (one big walkable area, see docs/DESIGN_DECISIONS.md) and room economy.
 * Pure data: imported by the game AND by scripts/sim-economy.ts (no DOM, no three).
 *
 * World axes: x right, z toward the camera/street. The bakery faces the street at the front,
 * the secret academy grows backwards (negative z) along a central corridor.
 */

export type RoomId =
  | 'mission_control'
  | 'vault'
  | 'laser'
  | 'cipher'
  | 'disguise'
  | 'gadget'
  | 'driving'
  | 'hack'

export type Skill = 'finesse' | 'stealth' | 'brains' | 'charm' | 'agility' | 'tech'
export type MinigameId = 'safe' | 'laser' | 'code' | 'mole' | 'scooter' | 'circuit'

export interface RoomDef {
  id: RoomId
  kind: 'training' | 'support'
  skill?: Skill
  minigame?: MinigameId
  /** Cash to unlock (0 = unlocked at start). */
  unlockCost: number
  /** Academy level required before the unlock pad accepts money. */
  unlockLevel: number
  /** Cash per training cycle per cadet at room level 1. */
  baseIncome: number
  /** Level-up cost at level 1; cost(L) = upgradeBaseCost * upgradeGrowth^(L-1). */
  upgradeBaseCost: number
  /** Seconds per training cycle at speed level 0. */
  cycleSeconds: number
  /** One-time cash cost of the instructor (auto-collects the cash pile + trains faster). */
  instructorCost: number
  /** Price of station #1; station n costs stationBase * ECONOMY.stationGrowth^(n-1). */
  stationBase: number
  /** One-time cost of the kit runner (keeps every station supplied). */
  runnerCost: number
  /** Price of the room's kit crate pad (the room's supply source). */
  crateCost?: number
  /** Room rectangle (world units), floor center + size. */
  rect: { x: number; z: number; w: number; d: number }
  /** Which side of the corridor the door opens to. */
  side: -1 | 1
  /** Floor color (placeholder art). */
  floor: number
  accent: number
}

export const LAYOUT = {
  corridorWidth: 4,
  roomW: 8,
  roomD: 6.4,
  rowGap: 0.6,
  wallH: 1.6,
  wall: 0.3,
  bakery: { x: 0, z: 9, w: 20, d: 6 },
  street: { z: 14 },
  /** Bakery street door and back door into the secret corridor. */
  streetDoor: { x: 0, z: 12.6 },
  backDoor: { x: 0, z: 5.6 },
  playerSpawn: { x: 4.6, z: 7.6 },
  /** Bakery counter = cadet sign-up desk. Hero serves standing behind it (serveSpot). */
  counter: { x: 6.9, z: 8.6 },
  serveSpot: { x: 6.9, z: 7.4 },
  /** Opening cash pile right next to the spawn (lesson: first cash <= 2 m away). */
  welcomeSpot: { x: 3.2, z: 7.8 },
  /** Waiting spots in front of the counter (first = being served). */
  queue: [
    { x: 6.9, z: 9.9 },
    { x: 5.6, z: 10.5 },
    { x: 4.3, z: 11.0 },
    { x: 3.0, z: 11.4 },
  ],
  clerkPad: { x: 9.0, z: 7.2 },
  /** Max slots ever placed in a room (visual stations). */
  maxSlots: 6,
} as const

const W = LAYOUT.roomW
const D = LAYOUT.roomD
const cx = LAYOUT.corridorWidth / 2 + W / 2
const row = (i: number) => 2.4 - i * (D + LAYOUT.rowGap)

export const ROOMS: Record<RoomId, RoomDef> = {
  mission_control: {
    id: 'mission_control', kind: 'support', unlockCost: 0, unlockLevel: 1,
    baseIncome: 0, upgradeBaseCost: 0, cycleSeconds: 0, instructorCost: 0, stationBase: 0, runnerCost: 0,
    rect: { x: -cx, z: row(0), w: W, d: D }, side: -1, floor: 0x2c4a6e, accent: 0x46c2cb,
  },
  vault: {
    id: 'vault', kind: 'training', skill: 'finesse', minigame: 'safe', unlockCost: 0, unlockLevel: 1,
    baseIncome: 6, upgradeBaseCost: 12, cycleSeconds: 4, instructorCost: 900, stationBase: 15, runnerCost: 260,
    rect: { x: cx, z: row(0), w: W, d: D }, side: 1, floor: 0x3d6b8f, accent: 0xf2b134,
  },
  laser: {
    id: 'laser', kind: 'training', skill: 'stealth', minigame: 'laser', unlockCost: 90, unlockLevel: 1,
    baseIncome: 14, upgradeBaseCost: 70, cycleSeconds: 6, instructorCost: 1600, stationBase: 70, runnerCost: 700,
    rect: { x: -cx, z: row(1), w: W, d: D }, side: -1, floor: 0x5a3d7a, accent: 0xf2665c,
  },
  cipher: {
    id: 'cipher', kind: 'training', skill: 'brains', minigame: 'code', unlockCost: 4500, unlockLevel: 2,
    baseIncome: 60, upgradeBaseCost: 500, cycleSeconds: 7, instructorCost: 9000, stationBase: 600, runnerCost: 5000,
    rect: { x: cx, z: row(1), w: W, d: D }, side: 1, floor: 0x2f6b5a, accent: 0x7cc6d6,
  },
  disguise: {
    id: 'disguise', kind: 'training', skill: 'charm', minigame: 'mole', unlockCost: 42000, unlockLevel: 3,
    baseIncome: 260, upgradeBaseCost: 3800, cycleSeconds: 8, instructorCost: 60000, stationBase: 5000, runnerCost: 40000,
    rect: { x: -cx, z: row(2), w: W, d: D }, side: -1, floor: 0x8a4a6b, accent: 0xf7c6d0,
  },
  gadget: {
    id: 'gadget', kind: 'support', unlockCost: 120000, unlockLevel: 4,
    baseIncome: 0, upgradeBaseCost: 0, cycleSeconds: 0, instructorCost: 0, stationBase: 0, runnerCost: 0,
    rect: { x: cx, z: row(2), w: W, d: D }, side: 1, floor: 0x6b5a2f, accent: 0xf2b134,
  },
  driving: {
    id: 'driving', kind: 'training', skill: 'agility', minigame: 'scooter', unlockCost: 450000, unlockLevel: 5,
    baseIncome: 1100, upgradeBaseCost: 28000, cycleSeconds: 9, instructorCost: 420000, stationBase: 50000, runnerCost: 300000,
    rect: { x: -cx, z: row(3), w: W, d: D }, side: -1, floor: 0x3a5a3a, accent: 0xbfe8d6,
  },
  hack: {
    id: 'hack', kind: 'training', skill: 'tech', minigame: 'circuit', unlockCost: 4000000, unlockLevel: 6,
    baseIncome: 5000, upgradeBaseCost: 210000, cycleSeconds: 10, instructorCost: 3000000, stationBase: 400000, runnerCost: 2500000,
    rect: { x: cx, z: row(3), w: W, d: D }, side: 1, floor: 0x1f3d5a, accent: 0x46c2cb,
  },
}

export const ROOM_ORDER: RoomId[] = ['mission_control', 'vault', 'laser', 'cipher', 'disguise', 'gadget', 'driving', 'hack']

/** Row behind the last rooms: "Coming soon" construction teaser. */
export const TEASER_ROW_Z = row(4)
export const CORRIDOR = { zFront: LAYOUT.backDoor.z, zBack: row(4) - D / 2 }

/** Door position of a room on the corridor side. */
export function doorOf(id: RoomId): { x: number; z: number } {
  const r = ROOMS[id].rect
  const side = ROOMS[id].side
  return { x: r.x - side * (r.w / 2), z: r.z }
}

/** Where the unlock / mission / upgrade pad sits (in the corridor, in front of the door). */
export function padOf(id: RoomId): { x: number; z: number } {
  const d = doorOf(id)
  return { x: d.x - ROOMS[id].side * 1.1, z: d.z }
}

/** Upgrade desk (office) in the outer front corner of the room. */
export function upgradeSpotOf(id: RoomId): { x: number; z: number } {
  const r = ROOMS[id].rect
  const side = ROOMS[id].side
  return { x: r.x + side * (r.w / 2 - 2.2), z: r.z + r.d / 2 - 0.9 }
}

/** Supply crate (training kits) just inside the door. */
export function crateOf(id: RoomId): { x: number; z: number } {
  const r = ROOMS[id].rect
  const side = ROOMS[id].side
  return { x: r.x - side * (r.w / 2 - 1.0), z: r.z + r.d / 2 - 1.0 }
}

/** Pad for the next staff hire (kit runner, then instructor), next to the desk. */
export function staffPadOf(id: RoomId): { x: number; z: number } {
  const u = upgradeSpotOf(id)
  return { x: u.x - ROOMS[id].side * 2.6, z: u.z }
}

/** Cash stack position inside the room (near the door so collecting is quick). */
export function cashSpotOf(id: RoomId): { x: number; z: number } {
  const r = ROOMS[id].rect
  const side = ROOMS[id].side
  return { x: r.x - side * (r.w / 2 - 1.3), z: r.z - r.d / 2 + 1.3 }
}

/** Training station positions (slot index -> world pos). */
export function slotOf(id: RoomId, slot: number): { x: number; z: number } {
  const r = ROOMS[id].rect
  const side = ROOMS[id].side
  const col = slot % 3
  const rowI = Math.floor(slot / 3)
  return { x: r.x + side * (-1.0 + col * 1.6), z: r.z - 1.5 + rowI * 2.0 }
}

/** Street door -> waiting spot in front of the counter. */
export function arrivalPath(queueIndex: number): { x: number; z: number }[] {
  const q = LAYOUT.queue[Math.min(queueIndex, LAYOUT.queue.length - 1)]!
  return [{ x: LAYOUT.streetDoor.x, z: LAYOUT.streetDoor.z }, { x: LAYOUT.streetDoor.x, z: 11.6 }, q]
}

/** Counter -> back door -> corridor -> room door -> station. */
export function cadetPath(id: RoomId, slot: number): { x: number; z: number }[] {
  const door = doorOf(id)
  return [
    LAYOUT.queue[0]!,
    { x: 2.6, z: 9.6 },
    { x: LAYOUT.backDoor.x, z: LAYOUT.backDoor.z },
    { x: 0, z: door.z },
    door,
    slotOf(id, slot),
  ]
}

export function pathLength(pts: { x: number; z: number }[]): number {
  let s = 0
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z)
  return s
}
