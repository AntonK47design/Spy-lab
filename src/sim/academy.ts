/**
 * Academy rules: training cycles, cash stacks, recruitment, graduation, upgrades,
 * unlock pads, academy XP. Pure functions over GameState (shared with npm run sim).
 */
import { ECONOMY, milestoneMult, slotCost, speedCost, upgradeCost, xpToNext } from '../config/economy.ts'
import { ROOMS, ROOM_ORDER, cadetPath, pathLength, type RoomId } from '../config/rooms.ts'
import { AGENTS, AGENT_CODE, AGENT_FIRST, SKILLS } from '../config/agents.ts'
import type { Agent, CadetState, GameState } from './state.ts'

let rand: () => number = Math.random
export function setRng(fn: () => number): void {
  rand = fn
}

export interface SimEvents {
  cycle?(room: RoomId, amount: number, auto: boolean): void
  arrive?(cadet: CadetState): void
  recruit?(cadet: CadetState): void
  graduate?(cadet: CadetState, agent: Agent | null, bonus: number): void
  levelUp?(level: number): void
  unlock?(room: RoomId): void
}

// ---------- derived values ----------
export function income(s: GameState, id: RoomId): number {
  const r = s.rooms[id]
  return ROOMS[id].baseIncome * r.level * milestoneMult(r.level)
}

export function cycleTime(s: GameState, id: RoomId): number {
  const r = s.rooms[id]
  return ROOMS[id].cycleSeconds * Math.pow(ECONOMY.speed.factorPerLevel, r.speed) * (r.instructor ? ECONOMY.instructorSpeedFactor : 1)
}

export function stackCap(s: GameState, id: RoomId): number {
  return income(s, id) * s.rooms[id].slots * ECONOMY.stackCapCycles
}

/** Cash per second of a room with its current cadets (for offline + UI). */
export function roomRate(s: GameState, id: RoomId): number {
  const training = s.cadets.filter((c) => c.room === id && c.phase === 'train').length
  return (income(s, id) * training) / cycleTime(s, id)
}

export function totalRate(s: GameState): number {
  let sum = 0
  for (const id of ROOM_ORDER) if (s.rooms[id].unlocked && ROOMS[id].kind === 'training') sum += roomRate(s, id)
  return sum
}

export function levelCost(s: GameState, id: RoomId): number {
  return upgradeCost(ROOMS[id].upgradeBaseCost, s.rooms[id].level)
}

export function trainingRooms(s: GameState): RoomId[] {
  return ROOM_ORDER.filter((id) => ROOMS[id].kind === 'training' && s.rooms[id].unlocked)
}

/** The next room whose unlock pad is purchasable (lowest cost locked room). */
export function nextUnlock(s: GameState): RoomId | null {
  for (const id of ROOM_ORDER) if (!s.rooms[id].unlocked) return id
  return null
}

// ---------- tick ----------
export function tick(s: GameState, dt: number, ev: SimEvents = {}): void {
  s.stats.playSeconds += dt

  // Recruitment at the bakery
  s.recruitTimer -= dt
  if (s.recruitTimer <= 0) {
    const free = findFreeSlot(s)
    if (free) {
      const path = cadetPath(free.room, free.slot)
      const c: CadetState = {
        id: s.nextId++,
        room: free.room,
        slot: free.slot,
        phase: 'walk',
        t: 0,
        walk: pathLength(path) / ECONOMY.recruit.walkSpeed,
        cycles: 0,
        need: ECONOMY.graduation.cycles,
      }
      s.cadets.push(c)
      ev.recruit?.(c)
      s.recruitTimer = ECONOMY.recruit.interval
    } else {
      s.recruitTimer = 0.5
    }
  }

  for (let i = s.cadets.length - 1; i >= 0; i--) {
    const c = s.cadets[i] as CadetState
    c.t += dt
    if (c.phase === 'walk') {
      if (c.t >= c.walk) {
        c.phase = 'train'
        c.t = 0
        ev.arrive?.(c)
      }
      continue
    }
    const ct = cycleTime(s, c.room)
    while (c.t >= ct) {
      c.t -= ct
      produce(s, c.room, ev)
      c.cycles++
      if (c.cycles >= c.need) {
        graduate(s, c, ev)
        s.cadets.splice(i, 1)
        break
      }
    }
  }
}

function produce(s: GameState, id: RoomId, ev: SimEvents): void {
  const r = s.rooms[id]
  const amount = income(s, id)
  if (r.instructor) {
    s.cash += amount
    s.stats.earned += amount
    ev.cycle?.(id, amount, true)
  } else {
    r.stack = Math.min(stackCap(s, id), r.stack + amount)
    ev.cycle?.(id, amount, false)
  }
}

function findFreeSlot(s: GameState): { room: RoomId; slot: number } | null {
  for (const id of trainingRooms(s)) {
    const r = s.rooms[id]
    for (let slot = 0; slot < r.slots; slot++) {
      if (!s.cadets.some((c) => c.room === id && c.slot === slot)) return { room: id, slot }
    }
  }
  return null
}

function graduate(s: GameState, c: CadetState, ev: SimEvents): void {
  s.graduatedTotal++
  addXp(s, ECONOMY.academyXp.graduate, ev)
  if (s.agents.length < s.rosterLimit) {
    const agent = createAgent(s, c.room)
    s.agents.push(agent)
    ev.graduate?.(c, agent, 0)
  } else {
    const bonus = income(s, c.room) * ECONOMY.graduation.overflowBonusCycles
    s.cash += bonus
    s.stats.earned += bonus
    ev.graduate?.(c, null, bonus)
  }
}

export function createAgent(s: GameState, room: RoomId): Agent {
  const skill = ROOMS[room].skill ?? 'finesse'
  const skills = {} as Agent['skills']
  for (const k of SKILLS) skills[k] = 1 + Math.floor(rand() * AGENTS.sideMax)
  skills[skill] = Math.round(AGENTS.mainSkillBase + s.rooms[room].level * AGENTS.perRoomLevel + rand() * AGENTS.spread)
  const total = SKILLS.reduce((a, k) => a + skills[k], 0)
  const rarity = AGENTS.rarityThresholds.find((t) => total >= t.total)?.rarity ?? 'common'
  const name = `${AGENT_FIRST[Math.floor(rand() * AGENT_FIRST.length)]} "${AGENT_CODE[Math.floor(rand() * AGENT_CODE.length)]}"`
  return { id: s.nextId++, name, skills, rarity, level: 1, room }
}

// ---------- player actions ----------
export function collect(s: GameState, id: RoomId): number {
  const r = s.rooms[id]
  const amount = Math.floor(r.stack)
  if (amount <= 0) return 0
  r.stack -= amount
  s.cash += amount
  s.stats.earned += amount
  s.stats.collects++
  return amount
}

export function addXp(s: GameState, n: number, ev: SimEvents = {}): void {
  if (s.level >= ECONOMY.academyXp.maxLevel) return
  s.xp += n
  while (s.level < ECONOMY.academyXp.maxLevel && s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level)
    s.level++
    ev.levelUp?.(s.level)
  }
}

function spend(s: GameState, cost: number): boolean {
  if (s.cash < cost) return false
  s.cash -= cost
  return true
}

export function upgradeLevel(s: GameState, id: RoomId, ev: SimEvents = {}): boolean {
  const r = s.rooms[id]
  if (r.level >= ECONOMY.maxRoomLevel || !spend(s, levelCost(s, id))) return false
  r.level++
  s.stats.upgrades++
  addXp(s, ECONOMY.academyXp.upgrade, ev)
  return true
}

export function buySlot(s: GameState, id: RoomId, ev: SimEvents = {}): boolean {
  const r = s.rooms[id]
  if (r.slots >= ECONOMY.slots.max || !spend(s, slotCost(r.slots))) return false
  r.slots++
  s.stats.upgrades++
  addXp(s, ECONOMY.academyXp.upgrade, ev)
  return true
}

export function buySpeed(s: GameState, id: RoomId, ev: SimEvents = {}): boolean {
  const r = s.rooms[id]
  if (r.speed >= ECONOMY.speed.max || !spend(s, speedCost(r.speed))) return false
  r.speed++
  s.stats.upgrades++
  addXp(s, ECONOMY.academyXp.upgrade, ev)
  return true
}

export function hireInstructor(s: GameState, id: RoomId, ev: SimEvents = {}): boolean {
  const r = s.rooms[id]
  if (r.instructor || !spend(s, ROOMS[id].instructorCost)) return false
  r.instructor = true
  // Whatever lies around gets banked right away.
  collect(s, id)
  s.stats.upgrades++
  addXp(s, ECONOMY.academyXp.upgrade, ev)
  return true
}

export function canUnlock(s: GameState, id: RoomId): boolean {
  return !s.rooms[id].unlocked && s.level >= ROOMS[id].unlockLevel && nextUnlock(s) === id
}

/** Pour up to `amount` cash into a room's unlock pad. Returns cash actually paid. */
export function payPad(s: GameState, id: RoomId, amount: number, ev: SimEvents = {}): number {
  const r = s.rooms[id]
  if (!canUnlock(s, id)) return 0
  const left = ROOMS[id].unlockCost - r.paid
  const pay = Math.min(left, amount, Math.floor(s.cash))
  if (pay <= 0) return 0
  s.cash -= pay
  r.paid += pay
  if (r.paid >= ROOMS[id].unlockCost) {
    r.unlocked = true
    addXp(s, ECONOMY.academyXp.unlockRoom, ev)
    ev.unlock?.(id)
  }
  return pay
}

/** Offline earnings for `seconds` away (already clamped by the caller). */
export function offlineEarnings(s: GameState, seconds: number): number {
  return Math.floor(totalRate(s) * seconds * ECONOMY.offline.efficiency)
}
