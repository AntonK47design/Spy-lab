/**
 * Plain-data game state. JSON-serializable, no DOM / three imports, so the same
 * code runs in the browser and in `npm run sim` (node with type stripping).
 */
import { ECONOMY } from '../config/economy.ts'
import { ROOMS, ROOM_ORDER, type RoomId, type Skill } from '../config/rooms.ts'
import type { Rarity } from '../config/agents.ts'

export interface RoomState {
  unlocked: boolean
  level: number
  slots: number
  speed: number
  instructor: boolean
  /** Uncollected cash lying in the room. */
  stack: number
  /** Cash already poured into the unlock pad. */
  paid: number
}

export interface CadetState {
  id: number
  room: RoomId
  slot: number
  /** 'walk' -> walking from the street door; 'train' -> at the station. */
  phase: 'walk' | 'train'
  /** Seconds in the current phase (walk) / current cycle (train). */
  t: number
  /** Total walk duration (s). */
  walk: number
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
  cadets: CadetState[]
  recruitTimer: number
  agents: Agent[]
  rosterLimit: number
  missions: Record<string, MissionProgress>
  nextId: number
  graduatedTotal: number
  stats: { upgrades: number; collects: number; playSeconds: number; earned: number; missionsWon: number }
  flags: Record<string, boolean>
  tutorial: number
  lastSeen: number
}

export function newRoom(id: RoomId): RoomState {
  return {
    unlocked: ROOMS[id].unlockCost === 0,
    level: 1,
    slots: ECONOMY.slots.start,
    speed: 0,
    instructor: false,
    stack: 0,
    paid: 0,
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
    // The first cadet already trains in the Vault Workshop when the game becomes interactive.
    cadets: [{ id: 1, room: 'vault', slot: 0, phase: 'train', t: 2.5, walk: 0, cycles: 0, need: ECONOMY.graduation.firstCycles }],
    recruitTimer: 1.5,
    agents: [],
    rosterLimit: ECONOMY.graduation.rosterStart,
    missions: {},
    nextId: 2,
    graduatedTotal: 0,
    stats: { upgrades: 0, collects: 0, playSeconds: 0, earned: 0, missionsWon: 0 },
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
  for (const id of ROOM_ORDER) s.rooms[id] = { ...base.rooms[id], ...(raw.rooms?.[id] ?? {}) }
  s.stats = { ...base.stats, ...(raw.stats ?? {}) }
  s.flags = { ...(raw.flags ?? {}) }
  s.missions = { ...(raw.missions ?? {}) }
  s.agents = Array.isArray(raw.agents) ? raw.agents : []
  s.cadets = Array.isArray(raw.cadets) ? raw.cadets.filter((c) => s.rooms[c.room]?.unlocked) : base.cadets
  for (const k of ['cash', 'intel', 'badges', 'xp'] as const) if (!(Number(s[k]) >= 0)) s[k] = base[k]
  return s
}
