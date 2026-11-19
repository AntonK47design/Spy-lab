/**
 * Academy rules (Kickoff-style loop):
 *   cadets arrive -> wait at the bakery counter -> the hero (or the clerk) signs them up ->
 *   they walk to a free station -> each rep consumes one training kit from the station basket
 *   and pays into the room's cash pile -> after N reps they graduate (keep or loan out).
 * The hero carries kits from the room crate to the baskets; the kit runner automates that,
 * the instructor auto-collects the pile. Pure functions over GameState (shared with npm run sim).
 */
import {
  ECONOMY, milestoneMult, openingFactor, speedCost, stationCost, upgradeCost, xpToNext,
} from '../config/economy.ts'
import { AREAS, AREA_ORDER, LAYOUT, ROOMS, ROOM_AREA, ROOM_ORDER, arrivalPath, cadetPath, pathLength, type AreaId, type RoomId } from '../config/rooms.ts'
import { AGENTS, AGENT_CODE, AGENT_FIRST, SKILLS } from '../config/agents.ts'
import type { Agent, CadetState, GameState } from './state.ts'

let rand: () => number = Math.random
export function setRng(fn: () => number): void {
  rand = fn
}

export interface SimEvents {
  cycle?(room: RoomId, amount: number, auto: boolean): void
  served?(cadet: CadetState): void
  arrive?(cadet: CadetState): void
  graduate?(cadet: CadetState, agent: Agent, fee: number): void
  /** Auto mode / office clerk loaned out graduates for this much cash. */
  autoSold?(cash: number): void
  /** The office clerk collected a room's cash pile. */
  clerkCollect?(room: RoomId, cash: number): void
  levelUp?(level: number): void
  unlock?(room: RoomId): void
  built?(what: string, room: RoomId | null): void
  area?(area: AreaId): void
}

/** Inputs the hero provides this tick (set by the view or the bot). */
export interface HeroInput {
  atCounter: boolean
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
  return income(s, id) * Math.max(1, s.rooms[id].stations) * ECONOMY.stackCapCycles
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

export function nextStationCost(s: GameState, id: RoomId): number | null {
  const r = s.rooms[id]
  if (!r.unlocked || ROOMS[id].kind !== 'training' || r.stations >= ECONOMY.slots.max) return null
  return stationCost(ROOMS[id].stationBase, r.stations)
}

/** Next staff hire for a room: kit runner first, then the instructor. */
export function nextStaff(s: GameState, id: RoomId): { kind: 'runner' | 'instructor'; cost: number } | null {
  const r = s.rooms[id]
  if (!r.unlocked || ROOMS[id].kind !== 'training' || r.stations === 0) return null
  if (!r.runner) return { kind: 'runner', cost: ROOMS[id].runnerCost }
  if (!r.instructor) return { kind: 'instructor', cost: ROOMS[id].instructorCost }
  return null
}

export function crateCost(id: RoomId): number {
  return ROOMS[id].crateCost ?? Math.max(5, Math.round(ROOMS[id].stationBase * ECONOMY.crateShare))
}

export function trainingRooms(s: GameState): RoomId[] {
  return ROOM_ORDER.filter((id) => ROOMS[id].kind === 'training' && s.rooms[id].unlocked)
}

/** The next room whose unlock pad is purchasable (lowest locked room). */
export function nextUnlock(s: GameState): RoomId | null {
  for (const id of ROOM_ORDER) if (!s.rooms[id].unlocked) return id
  return null
}

function walkSpeed(s: GameState): number {
  return ECONOMY.recruit.walkSpeed * (1 + (ECONOMY.opening.walkMult - 1) * openingFactor(s.stats.playSeconds))
}

function serveSeconds(s: GameState, clerk: boolean): number {
  const base = clerk ? ECONOMY.clerkServeSeconds : ECONOMY.serveSeconds
  return base * (1 - (1 - ECONOMY.opening.serveMult) * openingFactor(s.stats.playSeconds))
}

function findFreeStation(s: GameState): { room: RoomId; slot: number } | null {
  for (const id of trainingRooms(s)) {
    const r = s.rooms[id]
    for (let slot = 0; slot < r.stations; slot++) {
      if (!s.cadets.some((c) => c.room === id && c.slot === slot)) return { room: id, slot }
    }
  }
  return null
}

export function waitingCount(s: GameState): number {
  return s.cadets.filter((c) => c.phase === 'queue' || c.phase === 'arrive').length
}

/** Why the first waiting cadet cannot be signed up right now (for hints), or null. */
export function serveBlocker(s: GameState): 'counter' | 'station' | 'nobody' | null {
  if (!s.cadets.some((c) => c.phase === 'queue' && c.queueIndex === 0)) return 'nobody'
  if (!s.counter) return 'counter'
  if (!findFreeStation(s)) return 'station'
  return null
}

// ---------- tick ----------
export function tick(s: GameState, dt: number, hero: HeroInput, ev: SimEvents = {}): void {
  s.stats.playSeconds += dt

  // arrivals: keep the queue filled
  s.arrivalTimer -= dt
  if (s.arrivalTimer <= 0) {
    s.arrivalTimer = ECONOMY.arrivalSeconds
    if (waitingCount(s) < ECONOMY.queueMax) {
      const qi = waitingCount(s)
      const c: CadetState = {
        id: s.nextId++, phase: 'arrive', room: null, slot: -1, t: 0, queueIndex: qi,
        walk: pathLength(arrivalPath(qi)) / walkSpeed(s), repping: false, cycles: 0, need: ECONOMY.graduation.cycles,
      }
      s.cadets.push(c)
      ev.arrive?.(c)
    }
  }

  // sign-up at the counter (hero standing behind it, or the clerk)
  const serving = s.counter && (hero.atCounter || s.clerk) && serveBlocker(s) === null
  if (serving) {
    s.serveT += dt
    if (s.serveT >= serveSeconds(s, !hero.atCounter)) {
      s.serveT = 0
      serveFirst(s, ev)
    }
  } else s.serveT = Math.max(0, s.serveT - dt * 2)

  // agency office: waiting time, the office clerk, the auto mode (laptop switch)
  if (s.pending.length) {
    let auto = autoSellWeak(s)
    for (const p of s.pending) p.age = (p.age ?? 0) + dt
    if (s.officeClerk) {
      for (let i = s.pending.length - 1; i >= 0; i--) {
        const p = s.pending[i]!
        if (p.agent.rarity !== 'common' || (p.age ?? 0) < ECONOMY.officeClerk.sellDelay) continue
        s.pending.splice(i, 1)
        s.cash += p.fee
        s.stats.earned += p.fee
        auto += p.fee
      }
    }
    if (auto > 0) ev.autoSold?.(auto)
  }
  // the office clerk empties every room's cash pile on a fixed round
  if (s.officeClerk) {
    s.officeTimer += dt
    if (s.officeTimer >= ECONOMY.officeClerk.collectSeconds) {
      s.officeTimer = 0
      for (const id of trainingRooms(s)) {
        const amount = collect(s, id)
        if (amount > 0) ev.clerkCollect?.(id, amount)
      }
    }
  }

  // kit runners
  for (const id of trainingRooms(s)) {
    const r = s.rooms[id]
    if (!r.runner) continue
    r.runnerTimer += dt
    while (r.runnerTimer >= ECONOMY.supply.runnerSecondsPerKit) {
      r.runnerTimer -= ECONOMY.supply.runnerSecondsPerKit
      let best = -1
      for (let i = 0; i < r.stations; i++) if ((r.supply[i] ?? 0) < ECONOMY.supply.basketMax && (best < 0 || r.supply[i]! < r.supply[best]!)) best = i
      if (best < 0) {
        r.runnerTimer = 0
        break
      }
      r.supply[best] = (r.supply[best] ?? 0) + 1
    }
  }

  for (let i = s.cadets.length - 1; i >= 0; i--) {
    const c = s.cadets[i] as CadetState
    if (c.phase === 'queue') continue
    c.t += dt
    if (c.phase === 'arrive') {
      if (c.t >= c.walk) {
        c.phase = 'queue'
        c.t = 0
      }
      continue
    }
    if (c.phase === 'walk') {
      if (c.t >= c.walk) {
        c.phase = 'train'
        c.t = 0
        c.repping = false
      }
      continue
    }
    // training: a rep starts only with a kit in the basket
    const id = c.room as RoomId
    const r = s.rooms[id]
    if (!c.repping) {
      if ((r.supply[c.slot] ?? 0) <= 0) {
        c.t = 0
        continue
      }
      r.supply[c.slot]!--
      c.repping = true
      c.t = 0
    }
    const ct = cycleTime(s, id)
    if (c.t >= ct) {
      c.repping = false
      c.t = 0
      produce(s, id, ev)
      c.cycles++
      if (c.cycles >= c.need) {
        graduate(s, c, ev)
        s.cadets.splice(i, 1)
      }
    }
  }
}

function serveFirst(s: GameState, ev: SimEvents): void {
  const free = findFreeStation(s)
  const c = s.cadets.find((x) => x.phase === 'queue' && x.queueIndex === 0)
  if (!free || !c) return
  c.phase = 'walk'
  c.room = free.room
  c.slot = free.slot
  c.t = 0
  c.walk = pathLength(cadetPath(free.room, free.slot)) / walkSpeed(s)
  s.stats.served++
  // everybody behind moves up one spot
  for (const o of s.cadets) {
    if ((o.phase === 'queue' || o.phase === 'arrive') && o.queueIndex > 0) o.queueIndex--
  }
  ev.served?.(c)
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

function graduate(s: GameState, c: CadetState, ev: SimEvents): void {
  s.graduatedTotal++
  addXp(s, ECONOMY.academyXp.graduate, ev)
  const agent = createAgent(s, c.room as RoomId)
  const fee = Math.round(income(s, c.room as RoomId) * ECONOMY.loanFeeReps * ECONOMY.loanRarity[agent.rarity])
  s.pending.push({ agent, fee })
  ev.graduate?.(c, agent, fee)
}

/** Resolve the oldest graduation card: keep the agent (roster) or loan them out for the fee. */
export function resolveGraduate(s: GameState, keep: boolean): 'kept' | 'loaned' | null {
  const p = s.pending.shift()
  if (!p) return null
  if (keep && s.agents.length < s.rosterLimit) {
    s.agents.push(p.agent)
    return 'kept'
  }
  s.cash += p.fee
  s.stats.earned += p.fee
  return 'loaned'
}

/** Overall strength of an agent (sum of all skills; rarity shows in higher skills). */
export function agentPower(a: Agent): number {
  let p = 0
  for (const v of Object.values(a.skills)) p += v
  return p
}

/** What loaning an agent out pays (same formula as a graduate's fee). */
export function agentFee(s: GameState, a: Agent): number {
  return Math.round(income(s, a.room) * ECONOMY.loanFeeReps * ECONOMY.loanRarity[a.rarity])
}

export function weakestAgent(s: GameState): Agent | null {
  let w: Agent | null = null
  for (const a of s.agents) if (!w || agentPower(a) < agentPower(w)) w = a
  return w
}

/**
 * Agency office (laptop menu): act on one waiting graduate.
 * sell = loan out for the fee; hire = join the roster (needs room); swap = roster full: the
 * weakest agent is loaned out for their fee and the graduate takes the place.
 */
export function officeAct(s: GameState, agentId: number, action: 'sell' | 'hire' | 'swap'): 'sold' | 'hired' | 'swapped' | null {
  const i = s.pending.findIndex((p) => p.agent.id === agentId)
  if (i < 0) return null
  const p = s.pending[i]!
  if (action === 'sell') {
    s.pending.splice(i, 1)
    s.cash += p.fee
    s.stats.earned += p.fee
    return 'sold'
  }
  if (action === 'hire') {
    if (s.agents.length >= s.rosterLimit) return null
    s.pending.splice(i, 1)
    s.agents.push(p.agent)
    return 'hired'
  }
  const w = weakestAgent(s)
  if (!w || s.agents.length < s.rosterLimit || agentPower(w) >= agentPower(p.agent)) return null
  const fee = agentFee(s, w)
  s.agents.splice(s.agents.indexOf(w), 1)
  s.cash += fee
  s.stats.earned += fee
  s.pending.splice(i, 1)
  s.agents.push(p.agent)
  return 'swapped'
}

/** Auto mode: with a full roster, graduates not stronger than the weakest agent are loaned out at once. */
export function autoSellWeak(s: GameState): number {
  if (!s.flags.autoSellWeak || s.agents.length < s.rosterLimit) return 0
  const w = weakestAgent(s)
  if (!w) return 0
  const floor = agentPower(w)
  let earned = 0
  for (let i = s.pending.length - 1; i >= 0; i--) {
    const p = s.pending[i]!
    if (agentPower(p.agent) > floor) continue
    s.pending.splice(i, 1)
    s.cash += p.fee
    s.stats.earned += p.fee
    earned += p.fee
  }
  return earned
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

// ---------- hero actions ----------
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

export function collectWelcome(s: GameState): number {
  const a = s.welcome
  if (a <= 0) return 0
  s.welcome = 0
  s.cash += a
  s.stats.collects++
  return a
}

/** Take up to `n` kits from a room's crate. Carrying another room's kits swaps them. */
export function pickKits(s: GameState, id: RoomId, n: number): number {
  if (!s.rooms[id].unlocked || !s.rooms[id].crate) return 0
  if (s.carry.room !== id) s.carry = { room: id, n: 0 }
  const take = Math.min(n, ECONOMY.supply.carryMax - s.carry.n)
  if (take <= 0) return 0
  s.carry.n += take
  return take
}

/** Drop up to `n` carried kits into a station basket. */
export function dropKits(s: GameState, id: RoomId, slot: number, n: number): number {
  const r = s.rooms[id]
  if (s.carry.room !== id || s.carry.n <= 0 || slot >= r.stations) return 0
  const space = ECONOMY.supply.basketMax - (r.supply[slot] ?? 0)
  const put = Math.min(n, space, s.carry.n)
  if (put <= 0) return 0
  r.supply[slot] = (r.supply[slot] ?? 0) + put
  s.carry.n -= put
  if (s.carry.n === 0) s.carry.room = null
  s.stats.delivered += put
  return put
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
  s.stats.purchases++
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

export function buySpeed(s: GameState, id: RoomId, ev: SimEvents = {}): boolean {
  const r = s.rooms[id]
  if (r.speed >= ECONOMY.speed.max || !spend(s, speedCost(r.speed))) return false
  r.speed++
  s.stats.upgrades++
  addXp(s, ECONOMY.academyXp.upgrade, ev)
  return true
}

// ---------- pads (pour cash in while standing on them) ----------
export type PadTarget =
  | { kind: 'unlock'; room: RoomId }
  | { kind: 'station'; room: RoomId }
  | { kind: 'staff'; room: RoomId }
  | { kind: 'crate'; room: RoomId }
  | { kind: 'gate'; area: AreaId }
  | { kind: 'counter' }
  | { kind: 'clerk' }
  | { kind: 'officeClerk' }

export function canUnlock(s: GameState, id: RoomId): boolean {
  return !s.rooms[id].unlocked && s.areas[ROOM_AREA[id]] && s.level >= ROOMS[id].unlockLevel && nextUnlock(s) === id
}

/** The next closed area, if every room of the area before it is built. */
export function nextArea(s: GameState): AreaId | null {
  for (let i = 1; i < AREA_ORDER.length; i++) {
    const a = AREA_ORDER[i]!
    if (s.areas[a]) continue
    const prev = AREA_ORDER[i - 1]!
    const done = ROOM_ORDER.filter((r) => ROOM_AREA[r] === prev).every((r) => s.rooms[r].unlocked)
    return done ? a : null
  }
  return null
}

export function canOpenArea(s: GameState, a: AreaId): boolean {
  return nextArea(s) === a && s.level >= AREAS[a].gateLevel
}

/** Price and amount already paid for a pad, or null if the pad is not active. */
export function padPrice(s: GameState, t: PadTarget): { cost: number; paid: number } | null {
  switch (t.kind) {
    case 'counter':
      return s.counter ? null : { cost: ECONOMY.counterCost, paid: s.counterPaid }
    case 'clerk':
      return !s.counter || s.clerk || s.stats.served < 3 ? null : { cost: ECONOMY.clerkCost, paid: s.clerkPaid }
    case 'officeClerk':
      return s.officeClerk || s.graduatedTotal < 1 ? null : { cost: ECONOMY.officeClerk.cost, paid: s.officeClerkPaid }
    case 'unlock':
      return canUnlock(s, t.room) ? { cost: ROOMS[t.room].unlockCost, paid: s.rooms[t.room].paid } : null
    case 'gate':
      return canOpenArea(s, t.area) ? { cost: AREAS[t.area].gateCost, paid: s.areaPaid[t.area] } : null
    case 'crate': {
      const r = s.rooms[t.room]
      if (!r.unlocked || r.crate || ROOMS[t.room].kind !== 'training' || r.stations === 0) return null
      return { cost: crateCost(t.room), paid: r.cratePaid }
    }
    case 'station': {
      const c = nextStationCost(s, t.room)
      return c == null ? null : { cost: c, paid: s.rooms[t.room].stationPaid }
    }
    case 'staff': {
      // staff hires show up once the room has two stations (keeps the next 1-2 pads in focus)
      if (s.rooms[t.room].stations < 2) return null
      const n = nextStaff(s, t.room)
      return n ? { cost: n.cost, paid: s.rooms[t.room].staffPaid } : null
    }
  }
}

/** Pour up to `amount` cash into a pad. Completes the purchase when fully paid. Returns cash paid. */
export function payPad(s: GameState, t: PadTarget, amount: number, ev: SimEvents = {}): number {
  const price = padPrice(s, t)
  if (!price) return 0
  const pay = Math.min(price.cost - price.paid, amount, Math.floor(s.cash))
  if (pay <= 0) return 0
  s.cash -= pay
  const done = price.paid + pay >= price.cost
  switch (t.kind) {
    case 'counter':
      s.counterPaid += pay
      if (done) {
        s.counter = true
        ev.built?.('counter', null)
      }
      break
    case 'officeClerk':
      s.officeClerkPaid += pay
      if (done) {
        s.officeClerk = true
        s.stats.purchases++
        ev.built?.('officeClerk', null)
      }
      break
    case 'clerk':
      s.clerkPaid += pay
      if (done) {
        s.clerk = true
        ev.built?.('clerk', null)
      }
      break
    case 'gate':
      s.areaPaid[t.area] += pay
      if (done) {
        s.areas[t.area] = true
        addXp(s, ECONOMY.academyXp.unlockRoom * 2, ev)
        ev.built?.('gate', null)
        ev.area?.(t.area)
      }
      break
    case 'unlock': {
      const r = s.rooms[t.room]
      r.paid += pay
      if (done) {
        r.unlocked = true
        addXp(s, ECONOMY.academyXp.unlockRoom, ev)
        ev.unlock?.(t.room)
      }
      break
    }
    case 'crate': {
      const r = s.rooms[t.room]
      r.cratePaid += pay
      if (done) {
        r.crate = true
        ev.built?.('crate', t.room)
      }
      break
    }
    case 'station': {
      const r = s.rooms[t.room]
      r.stationPaid += pay
      if (done) {
        r.stationPaid = 0
        r.stations++
        // the very first station comes with two kits so the first rep starts right away
        r.supply.push(s.graduatedTotal === 0 && r.stations === 1 ? 2 : 0)
        addXp(s, ECONOMY.academyXp.upgrade, ev)
        ev.built?.('station', t.room)
      }
      break
    }
    case 'staff': {
      const r = s.rooms[t.room]
      const kind = nextStaff(s, t.room)?.kind
      r.staffPaid += pay
      if (done && kind) {
        r.staffPaid = 0
        if (kind === 'runner') r.runner = true
        else {
          r.instructor = true
          collect(s, t.room)
        }
        addXp(s, ECONOMY.academyXp.upgrade, ev)
        ev.built?.(kind, t.room)
      }
      break
    }
  }
  if (done) s.stats.purchases++
  return pay
}

/** Offline earnings for `seconds` away (already clamped by the caller). Needs automation. */
export function offlineEarnings(s: GameState, seconds: number): number {
  let rate = 0
  for (const id of trainingRooms(s)) if (s.rooms[id].runner) rate += roomRate(s, id)
  return Math.floor(rate * seconds * ECONOMY.offline.efficiency)
}

export const COUNTER_SPOT = LAYOUT.serveSpot
