/**
 * Academy layout (one big walkable area, see docs/DESIGN_DECISIONS.md) and room economy.
 * Pure data: imported by the game AND by scripts/sim-economy.ts (no DOM, no three).
 *
 * World axes: x right, z toward the camera/street. The bakery faces the street at the front;
 * behind it a secret courtyard (HQ) with the Mission Control hub in the middle, the later
 * areas grow backwards (negative z).
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
  /** Width of the central walkway; in the HQ it is the open courtyard behind the bakery. */
  corridorWidth: 12,
  roomW: 10,
  roomD: 8,
  /** Walkway between two room rows (small plazas). */
  rowGap: 1.5,
  /** Void gap between two area plots, crossed by a bridge. */
  bridge: 4,
  wallH: 1.6,
  wall: 0.3,
  bakery: { x: 0, z: 9, w: 25, d: 6 },
  /** Bakery street door and back door into the secret corridor. */
  streetDoor: { x: 0, z: 12.6 },
  backDoor: { x: 0, z: 5.6 },
  /** The game starts on the sidewalk in front of the bakery (tutorial begins outside). */
  playerSpawn: { x: 2.6, z: 14.0 },
  /** Bakery counter = cadet sign-up desk. Hero serves standing behind it (serveSpot). */
  counter: { x: 6.9, z: 8.6 },
  serveSpot: { x: 6.9, z: 7.4 },
  /** Opening cash pile right next to the spawn (lesson: first cash <= 2 m away). */
  welcomeSpot: { x: 4.2, z: 13.4 },
  /** Waiting spots in front of the counter (first = being served). */
  queue: [
    { x: 6.9, z: 9.9 },
    { x: 5.6, z: 10.5 },
    { x: 4.3, z: 11.0 },
    { x: 3.0, z: 11.4 },
  ],
  clerkPad: { x: 9.0, z: 7.2 },
  /** Walkable street in front of the bakery: sidewalk, road, taxi stop where cadets get out. */
  street: { sidewalk0: 12.0, road0: 15.4, road1: 20.6, plotFront: 21.3, laneIn: 17.0, laneOut: 19.2, stopX: -9.5, stopZ: 15.9 },
  /** Max slots ever placed in a room (visual stations). */
  maxSlots: 6,
} as const

const W = LAYOUT.roomW
const D = LAYOUT.roomD
const cx = LAYOUT.corridorWidth / 2 + W / 2

export type AreaId = 'hq' | 'harbor' | 'lighthouse'

/**
 * Three areas (islands) behind each other, each opened by one big gate purchase at the end of the
 * previous area's corridor (close to the hub). Row centres are computed from these bounds.
 */
export interface AreaDef {
  id: AreaId
  /** Front (toward the street) and back edge of the plot. */
  zFront: number
  zBack: number
  gateCost: number
  gateLevel: number
  /** Area it is reached from (bridge / gate side). */
  from: AreaId
}

const ROW0 = LAYOUT.backDoor.z + 0.4 - LAYOUT.rowGap - D / 2 // first row behind the bakery
const STEP = D + LAYOUT.rowGap
const rowZ = (i: number, area: number) => ROW0 - i * STEP - area * (LAYOUT.bridge + 1)

const HQ_BACK = rowZ(1, 0) - D / 2 - 1
/**
 * Lighthouse island out in the water straight north of the courtyard, reached by ferry from a
 * jetty behind Mission Control. A path leads to the tower; Driving and Hack flank it.
 */
export const ISLAND = {
  x0: -16, x1: 16, z0: -58, z1: -31,
  path: { x0: -4, x1: 4 },
  tower: { x: 0, z: -52 },
} as const
/** Ferry from the courtyard's north edge (straight north of Mission Control) to the island jetty. */
export const FERRY = {
  x: 0,
  docksJetty: HQ_BACK as number, docksEnd: HQ_BACK - 2.6,
  islandJetty: -31 as number, islandEnd: -29,
  boatDocks: HQ_BACK - 4.2, boatIsland: -27.4,
  boardDocks: { x: 0, z: HQ_BACK - 1.9 },
  boardIsland: { x: 0, z: -29.7 },
  rideSeconds: 3,
  boardSeconds: 0.5,
} as const
const L_ROW0 = -42

/**
 * Harbor docks east of the courtyard: reached through the garage hall (old right lounge slot).
 * A dock street runs north-south; the three harbour buildings face it from the east, the quay
 * with the crane lies behind them on the water.
 */
export const DOCKS = {
  x0: 17, x1: 40.5, z0: -25, z1: 7.5,
  street: { x0: 17.8, x1: 26 },
  quayX: 38.3,
  crane: { x: 38.6, z: -14 },
} as const
/** Garage hall between the courtyard and the docks; its roll-up door is the harbor gate. */
export const GARAGE = { x0: cx - W / 2, x1: cx + W / 2, z: rowZ(1, 0), d: D, doorHalf: 1.5 } as const

export const AREAS: Record<AreaId, AreaDef> = {
  hq: { id: 'hq', zFront: LAYOUT.backDoor.z, zBack: HQ_BACK, gateCost: 0, gateLevel: 1, from: 'hq' },
  harbor: { id: 'harbor', zFront: DOCKS.z1, zBack: DOCKS.z0, gateCost: 3000, gateLevel: 2, from: 'hq' },
  lighthouse: { id: 'lighthouse', zFront: ISLAND.z1, zBack: ISLAND.z0, gateCost: 250000, gateLevel: 4, from: 'hq' },
}
export const AREA_ORDER: AreaId[] = ['hq', 'harbor', 'lighthouse']

/** Room -> area. */
export const ROOM_AREA: Record<RoomId, AreaId> = {
  mission_control: 'hq', vault: 'hq', laser: 'hq',
  cipher: 'harbor', disguise: 'harbor', gadget: 'harbor',
  driving: 'lighthouse', hack: 'lighthouse',
}

/** Gate pad of an area: at the end of the previous area's corridor. */
export function gateOf(id: AreaId): { x: number; z: number } {
  // harbor: in the courtyard, in front of the garage's roll-up door
  if (id === 'harbor') return { x: GARAGE.x0 - 1.7, z: GARAGE.z }
  // lighthouse: in the courtyard north of Mission Control, at the root of the ferry jetty
  if (id === 'lighthouse') return { x: FERRY.x, z: FERRY.docksJetty + 1.6 }
  return { x: 0, z: AREAS[AREAS[id].from].zBack + 1.4 }
}

/** Plazas (decorated open squares) on the free row slots. */
export const PLAZAS: { x: number; z: number; area: AreaId }[] = []

/**
 * Agency office (left lounge slot of the courtyard): graduates wait on a bench; at the laptop on
 * the desk the hero sells them (loan fee), hires them as agents, or swaps out the weakest agent.
 * Nothing pops up on its own: the menu opens only at the laptop.
 */
const OFF_Z = rowZ(1, 0)
const OFF_DOOR_X = -cx + W / 2
export const OFFICE = {
  rect: { x: -cx, z: OFF_Z, w: W, d: D },
  door: { x: OFF_DOOR_X, z: OFF_Z },
  desk: { x: OFF_DOOR_X - 4.0, z: OFF_Z },
  /** Stand here at the laptop on the desk: opens the office menu (sell / hire / swap, auto mode). */
  laptopPad: { x: OFF_DOOR_X - 2.1, z: OFF_Z },
  /** Build pad to hire the office clerk, and where the clerk then stands (behind the desk). */
  clerkPad: { x: OFF_DOOR_X - 2.1, z: OFF_Z - 2.6 },
  clerkSpot: { x: OFF_DOOR_X - 5.0, z: OFF_Z - 0.9 },
  /** Waiting bench seats behind the desk (graduates face the hero across the desk). */
  seats: [0, 1, 2, 3, 4, 5].map((i) => ({ x: -cx - W / 2 + 1.3, z: OFF_Z - 2.9 + i * 1.16 })),
} as const

/** Walk of a fresh graduate from their station to the office bench. */
export function officePath(id: RoomId, slot: number, seat: number): { x: number; z: number }[] {
  const back = cadetPath(id, slot).slice(3).reverse() // station -> door -> ... -> courtyard
  const s = OFFICE.seats[Math.min(seat, OFFICE.seats.length - 1)]!
  // in through the door, around the end of the desk, along the bench to the seat
  const zEnd = OFF_Z + (s.z > OFF_Z ? 3.3 : -3.3)
  return [...back, { x: OFF_DOOR_X + 0.8, z: 0.5 }, { x: OFF_DOOR_X + 0.8, z: OFF_Z }, { x: OFF_DOOR_X - 1, z: OFF_Z }, { x: OFF_DOOR_X - 1.2, z: zEnd }, { x: s.x + 1.0, z: zEnd }, s]
}

export const ROOMS: Record<RoomId, RoomDef> = {
  mission_control: {
    id: 'mission_control', kind: 'support', unlockCost: 0, unlockLevel: 1,
    baseIncome: 0, upgradeBaseCost: 0, cycleSeconds: 0, instructorCost: 0, stationBase: 0, runnerCost: 0,
    // open-air hub in the middle of the HQ courtyard (no walls): holo map table + satellite dish
    rect: { x: 0, z: (rowZ(0, 0) + rowZ(1, 0)) / 2, w: 6, d: 6 }, side: -1, floor: 0x2c4a6e, accent: 0x46c2cb,
  },
  vault: {
    id: 'vault', kind: 'training', skill: 'finesse', minigame: 'safe', unlockCost: 0, unlockLevel: 1,
    baseIncome: 6, upgradeBaseCost: 12, cycleSeconds: 4, instructorCost: 900, stationBase: 15, runnerCost: 200,
    rect: { x: cx, z: rowZ(0, 0), w: W, d: D }, side: 1, floor: 0x3d6b8f, accent: 0xf2b134,
  },
  laser: {
    id: 'laser', kind: 'training', skill: 'stealth', minigame: 'laser', unlockCost: 90, unlockLevel: 1,
    baseIncome: 14, upgradeBaseCost: 70, cycleSeconds: 6, instructorCost: 1600, stationBase: 70, runnerCost: 700,
    rect: { x: -cx, z: rowZ(0, 0), w: W, d: D }, side: -1, floor: 0x5a3d7a, accent: 0xf2665c,
  },
  cipher: {
    id: 'cipher', kind: 'training', skill: 'brains', minigame: 'code', unlockCost: 2500, unlockLevel: 2,
    baseIncome: 60, upgradeBaseCost: 500, cycleSeconds: 7, instructorCost: 9000, stationBase: 600, runnerCost: 5000,
    rect: { x: DOCKS.street.x1 + W / 2, z: -19, w: W, d: D }, side: 1, floor: 0x2f6b5a, accent: 0x7cc6d6,
  },
  disguise: {
    id: 'disguise', kind: 'training', skill: 'charm', minigame: 'mole', unlockCost: 25000, unlockLevel: 3,
    baseIncome: 260, upgradeBaseCost: 3800, cycleSeconds: 8, instructorCost: 60000, stationBase: 5000, runnerCost: 40000,
    rect: { x: DOCKS.street.x1 + W / 2, z: GARAGE.z, w: W, d: D }, side: 1, floor: 0x8a4a6b, accent: 0xf7c6d0,
  },
  gadget: {
    id: 'gadget', kind: 'support', unlockCost: 80000, unlockLevel: 3,
    baseIncome: 0, upgradeBaseCost: 0, cycleSeconds: 0, instructorCost: 0, stationBase: 0, runnerCost: 0,
    rect: { x: DOCKS.street.x1 + W / 2, z: 1, w: W, d: D }, side: 1, floor: 0x6b5a2f, accent: 0xf2b134,
  },
  driving: {
    id: 'driving', kind: 'training', skill: 'agility', minigame: 'scooter', unlockCost: 450000, unlockLevel: 5,
    baseIncome: 1100, upgradeBaseCost: 28000, cycleSeconds: 9, instructorCost: 420000, stationBase: 50000, runnerCost: 300000,
    rect: { x: ISLAND.path.x0 - W / 2, z: L_ROW0, w: W, d: D }, side: -1, floor: 0x3a5a3a, accent: 0xbfe8d6,
  },
  hack: {
    id: 'hack', kind: 'training', skill: 'tech', minigame: 'circuit', unlockCost: 4000000, unlockLevel: 6,
    baseIncome: 5000, upgradeBaseCost: 210000, cycleSeconds: 10, instructorCost: 3000000, stationBase: 400000, runnerCost: 2500000,
    rect: { x: ISLAND.path.x1 + W / 2, z: L_ROW0, w: W, d: D }, side: 1, floor: 0x1f3d5a, accent: 0x46c2cb,
  },
}

export const ROOM_ORDER: RoomId[] = ['mission_control', 'vault', 'laser', 'cipher', 'disguise', 'gadget', 'driving', 'hack']

export const CORRIDOR = { zFront: LAYOUT.backDoor.z, zBack: AREAS.lighthouse.zBack }

/** Door position of a room on the corridor side. */
export function doorOf(id: RoomId): { x: number; z: number } {
  const r = ROOMS[id].rect
  const side = ROOMS[id].side
  return { x: r.x - side * (r.w / 2), z: r.z }
}

/** Where the unlock / mission / upgrade pad sits (in the corridor, in front of the door). */
export function padOf(id: RoomId): { x: number; z: number } {
  // the courtyard hub: missions pad in front of the holo table, facing the bakery
  if (id === 'mission_control') return { x: ROOMS[id].rect.x, z: ROOMS[id].rect.z + 2.7 }
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
  return { x: r.x + side * (-1.6 + col * 2.1), z: r.z - 1.9 + rowI * 2.4 }
}

/** Street door -> waiting spot in front of the counter. */
export function arrivalPath(queueIndex: number): { x: number; z: number }[] {
  const q = LAYOUT.queue[Math.min(queueIndex, LAYOUT.queue.length - 1)]!
  const st = LAYOUT.street
  return [
    { x: st.stopX, z: st.stopZ },
    { x: st.stopX + 1.2, z: 13.8 },
    { x: -0.4, z: 13.8 },
    { x: LAYOUT.streetDoor.x, z: LAYOUT.streetDoor.z },
    { x: LAYOUT.streetDoor.x + 0.6, z: 11.4 },
    q,
  ]
}

/** Counter -> back door -> corridor -> room door -> station. */
export function cadetPath(id: RoomId, slot: number): { x: number; z: number }[] {
  const door = doorOf(id)
  const start = [LAYOUT.queue[0]!, { x: 2.6, z: 9.6 }, { x: LAYOUT.backDoor.x, z: LAYOUT.backDoor.z }]
  const area = ROOM_AREA[id]
  if (area === 'harbor') {
    // along the east edge of the courtyard, through the garage, up/down the dock street
    const sx = (DOCKS.street.x0 + DOCKS.street.x1) / 2
    return [...start, { x: GARAGE.x0 - 0.6, z: 0.5 }, { x: GARAGE.x0 - 0.6, z: GARAGE.z }, { x: GARAGE.x1 + 1, z: GARAGE.z }, { x: sx, z: GARAGE.z }, { x: sx, z: door.z }, door, slotOf(id, slot)]
  }
  if (area === 'lighthouse') {
    // around the hub on the west side, onto the jetty, across on the ferry (hidden on board), up the island path
    return [
      ...start, { x: -(GARAGE.x0 - 0.6), z: 0.5 }, { x: -(GARAGE.x0 - 0.6), z: HQ_BACK + 2.5 }, { x: FERRY.x, z: HQ_BACK + 1 },
      { x: FERRY.x, z: FERRY.boardDocks.z }, { x: FERRY.x, z: FERRY.boardIsland.z },
      { x: FERRY.x, z: door.z }, door, slotOf(id, slot),
    ]
  }
  return [...start, { x: 0, z: door.z }, door, slotOf(id, slot)]
}

export function pathLength(pts: { x: number; z: number }[]): number {
  let s = 0
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z)
  return s
}
