/**
 * Plain-data game state. JSON-serializable, no DOM / three imports, so the same
 * code runs in the browser and in `npm run sim` (node with type stripping).
 */
import { ECONOMY } from '../config/economy.ts'
import { AREA_ORDER, ROOMS, ROOM_AREA, ROOM_ORDER, type AreaId, type RoomId, type Skill } from '../config/rooms.ts'
import type { Rarity } from '../config/agents.ts'

export interface RoomState {
  unlocked: boolean
  level: number
  /** Number of built training stations (0..6). */
  stations: number
  /** Training kits in each station's basket. */
  supply: number[]
  speed: number
  instructor: boolean
  /** Kit runner hired: keeps the baskets filled. */
  runner: boolean
  /** Kit crate built (supply source). */
  crate: boolean
  cratePaid: number
  /** Uncollected cash lying in the room. */
  stack: number
  /** Cash already poured into the unlock pad. */
  paid: number
  /** Cash poured into the next station pad / staff pad. */
  stationPaid: number
  staffPaid: number
  runnerTimer: number
}

export interface CadetState {
  id: number
  /** 'arrive': street -> queue, 'queue': waiting at the counter, 'walk': counter -> station, 'train'. */
  phase: 'arrive' | 'queue' | 'walk' | 'train'
  room: RoomId | null
  slot: number
  /** Seconds in the current phase / current rep. */
  t: number
  /** Duration of the current walk (s). */
  walk: number
  /** Waiting spot for arrive/queue. */
  queueIndex: number
  /** A rep is in progress (a kit was consumed). */
  repping: boolean
  cycles: number
  need: number
}

export interface Agent {
  id: number
  name: string
  skills: Record<Skill, number>
  rarity: Rarity
  level: number
  room: RoomId
}

export interface PendingGraduate {
  agent: Agent
  fee: number
  /** Seconds spent waiting in the office (the office clerk sells common ones after a delay). */
  age?: number
}

export interface MissionProgress {
  stars: number
  wins: number
  fails: number
}

export interface GameState {
  cash: number
  intel: number
  badges: number
  xp: number
  level: number
  rooms: Record<RoomId, RoomState>
  /** Opened areas (islands); 'hq' is open from the start. */
  areas: Record<AreaId, boolean>
  areaPaid: Record<AreaId, number>
  cadets: CadetState[]
  arrivalTimer: number
  /** Sign-up desk built (first purchase). */
  counter: boolean
  counterPaid: number
  /** Counter clerk hired (automatic sign-up). */
  clerk: boolean
  clerkPaid: number
  /** Agency office clerk hired (auto-sells common graduates, collects all room cash). */
  officeClerk: boolean
  officeClerkPaid: number
  officeTimer: number
  /** Progress of the current sign-up (s). */
  serveT: number
  /** Kits the hero carries. */
  carry: { room: RoomId | null; n: number }
  /** Cash pile next to the spawn. */
  welcome: number
  agents: Agent[]
  pending: PendingGraduate[]
  rosterLimit: number
  missions: Record<string, MissionProgress>
  nextId: number
  graduatedTotal: number
  stats: { upgrades: number; collects: number; playSeconds: number; earned: number; missionsWon: number; served: number; delivered: number; purchases: number }
  flags: Record<string, boolean>
  tutorial: number
  lastSeen: number
}

export function newRoom(id: RoomId): RoomState {
  return {
    unlocked: ROOMS[id].unlockCost === 0,
    level: 1,
    stations: 0,
    supply: [],
    speed: 0,
    instructor: false,
    runner: false,
    crate: false,
    cratePaid: 0,
    stack: 0,
    paid: 0,
    stationPaid: 0,
    staffPaid: 0,
    runnerTimer: 0,
  }
}

export function newGame(): GameState {
  const rooms = {} as Record<RoomId, RoomState>
  for (const id of ROOM_ORDER) rooms[id] = newRoom(id)
  return {
    cash: ECONOMY.startCash,
    intel: 0,
    badges: 0,
    xp: 0,
    level: 1,
    rooms,
    areas: { hq: true, harbor: false, lighthouse: false },
    areaPaid: { hq: 0, harbor: 0, lighthouse: 0 },
    // The first customer is already waiting at the counter (lesson: no long first walk).
    cadets: [{ id: 1, phase: 'queue', room: null, slot: -1, t: 0, walk: 0, queueIndex: 0, repping: false, cycles: 0, need: ECONOMY.graduation.firstCycles }],
    arrivalTimer: 2,
    counter: false,
    counterPaid: 0,
    clerk: false,
    clerkPaid: 0,
    officeClerk: false,
    officeClerkPaid: 0,
    officeTimer: 0,
    serveT: 0,
    carry: { room: null, n: 0 },
    welcome: ECONOMY.welcomeCash,
    agents: [],
    pending: [],
    rosterLimit: ECONOMY.graduation.rosterStart,
    missions: {},
    nextId: 2,
    graduatedTotal: 0,
    stats: { upgrades: 0, collects: 0, playSeconds: 0, earned: 0, missionsWon: 0, served: 0, delivered: 0, purchases: 0 },
    flags: {},
    tutorial: 0,
    lastSeen: 0,
  }
}

/** Merge a loaded (possibly older/partial) state over fresh defaults. */
export function hydrate(raw: Partial<GameState> | null | undefined): GameState {
  const base = newGame()
  if (!raw || typeof raw !== 'object') return base
  const s: GameState = { ...base, ...raw } as GameState
  s.rooms = { ...base.rooms }
  for (const id of ROOM_ORDER) {
    const r = { ...base.rooms[id], ...((raw.rooms?.[id] as Partial<RoomState> | undefined) ?? {}) }
    // migration from the Phase-1 save layout (slots -> stations)
    const legacy = (raw.rooms?.[id] as { slots?: number } | undefined)?.slots
    if (r.unlocked && r.stations === 0 && typeof legacy === 'number' && ROOMS[id].kind === 'training') {
      r.stations = legacy
      r.crate = true
    }
    while (r.supply.length < r.stations) r.supply.push(0)
    s.rooms[id] = r
  }
  s.areas = { ...base.areas, ...(raw.areas ?? {}) }
  s.areaPaid = { ...base.areaPaid, ...(raw.areaPaid ?? {}) }
  // migration: rooms unlocked in an area imply the area is open
  for (const id of ROOM_ORDER) if (s.rooms[id].unlocked) s.areas[ROOM_AREA[id]] = true
  s.areas.hq = true
  void AREA_ORDER
  s.stats = { ...base.stats, ...(raw.stats ?? {}) }
  s.flags = { ...(raw.flags ?? {}) }
  s.missions = { ...(raw.missions ?? {}) }
  s.agents = Array.isArray(raw.agents) ? raw.agents : []
  s.pending = Array.isArray(raw.pending) ? raw.pending : []
  s.carry = raw.carry && typeof raw.carry === 'object' ? { room: raw.carry.room ?? null, n: Number(raw.carry.n) || 0 } : base.carry
  const cadets = Array.isArray(raw.cadets) ? raw.cadets : null
  s.cadets = cadets
    ? cadets.filter((c) => c && 'phase' in c && (c.room === null || (s.rooms[c.room]?.unlocked && c.slot < s.rooms[c.room].stations)))
    : base.cadets
  for (const k of ['cash', 'intel', 'badges', 'xp', 'welcome'] as const) if (!(Number(s[k]) >= 0)) s[k] = base[k]
  return s
}
