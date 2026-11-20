/**
 * "What next?" for the guide arrow after the tutorial (and for the sim bot, so the pacing numbers
 * describe a guided player): an affordable purchase, else the cash pile that pays for the next
 * purchase, else the biggest pile. Pure: positions come from config.
 */
import { LAYOUT, OFFICE, crateOf, gateOf, padOf, slotOf, staffPadOf, upgradeSpotOf, cashSpotOf, type RoomId } from '../config/rooms.ts'
import { levelCost, nextArea, nextUnlock, padPrice, serveBlocker, trainingRooms, type PadTarget } from './academy.ts'
import { missionLock } from './missions.ts'
import { MISSIONS } from '../config/missions.ts'
import { ECONOMY } from '../config/economy.ts'
import type { GameState } from './state.ts'

export interface Spot {
  x: number
  z: number
}

export function allPads(s: GameState): PadTarget[] {
  const out: PadTarget[] = [{ kind: 'counter' }, { kind: 'clerk' }, { kind: 'officeClerk' }]
  const nu = nextUnlock(s)
  if (nu) out.push({ kind: 'unlock', room: nu })
  const na = nextArea(s)
  if (na) out.push({ kind: 'gate', area: na })
  for (const id of trainingRooms(s)) out.push({ kind: 'station', room: id }, { kind: 'crate', room: id }, { kind: 'staff', room: id })
  return out.filter((t) => padPrice(s, t))
}

export function padPos(t: PadTarget, s: GameState): Spot {
  switch (t.kind) {
    case 'counter': return LAYOUT.serveSpot
    case 'clerk': return LAYOUT.clerkPad
    case 'officeClerk': return OFFICE.clerkPad
    case 'unlock': return padOf(t.room)
    case 'station': return slotOf(t.room, s.rooms[t.room].stations)
    case 'staff': return staffPadOf(t.room)
    case 'crate': return crateOf(t.room)
    case 'gate': return gateOf(t.area)
  }
}

/** Cheapest thing to buy right now (pads and room levels). */
export function cheapestPrice(s: GameState): number {
  let min = Infinity
  for (const t of allPads(s)) {
    const p = padPrice(s, t)!
    min = Math.min(min, p.cost - p.paid)
  }
  for (const id of trainingRooms(s)) if (s.rooms[id].stations > 0) min = Math.min(min, levelCost(s, id))
  return min
}

export type Goal =
  | { kind: 'pad'; target: PadTarget; at: Spot }
  | { kind: 'level'; room: RoomId; at: Spot }
  | { kind: 'cash'; room: RoomId; at: Spot }
  | { kind: 'kits'; room: RoomId; at: Spot }
  | { kind: 'serve'; at: Spot }
  | { kind: 'mission'; at: Spot }
  | { kind: 'hire'; at: Spot }

export function guideGoal(s: GameState, choresOnly = false): Goal | null {
  // 1. something affordable: the next room first, else the cheapest pad
  const pads = choresOnly ? [] : allPads(s)
    .map((p) => ({ p, left: padPrice(s, p)!.cost - padPrice(s, p)!.paid }))
    .filter((x) => x.left <= s.cash)
    .sort((a, b) => (a.p.kind === 'unlock' ? -1 : b.p.kind === 'unlock' ? 1 : a.left - b.left))
  if (pads[0]) return { kind: 'pad', target: pads[0].p, at: padPos(pads[0].p, s) }
  const lv = choresOnly ? undefined : trainingRooms(s).filter((id) => s.rooms[id].stations > 0 && levelCost(s, id) <= s.cash).sort((a, b) => levelCost(s, a) - levelCost(s, b))[0]
  if (lv) return { kind: 'level', room: lv, at: upgradeSpotOf(lv) }
  // the first graduate waits in the agency office: hire them (missions need an agent)
  if (!choresOnly && !s.agents.length && s.pending.length) return { kind: 'hire', at: OFFICE.laptopPad }
  // a new mission is waiting: the fun part (and the big rewards) comes before chores
  if (!choresOnly && s.agents.length && MISSIONS.some((m) => missionLock(s, m) === 'ok' && !((s.missions[m.id]?.wins ?? 0) > 0))) return { kind: 'mission', at: padOf('mission_control') }
  // 2. a cash pile that pays for the next purchase (or the biggest one, if it covers at least a third)
  const short = cheapestPrice(s) - s.cash
  const piles = trainingRooms(s).filter((id) => !s.rooms[id].instructor && s.rooms[id].stack >= 1).sort((a, b) => s.rooms[b].stack - s.rooms[a].stack)
  const enough = piles.find((id) => s.rooms[id].stack >= short)
  const pick = enough ?? (piles[0] && s.rooms[piles[0]].stack >= short / 3 ? piles[0] : undefined)
  if (pick) return { kind: 'cash', room: pick, at: cashSpotOf(pick) }
  // 3. chores, so there is always a next step: kits to a waiting cadet, sign-ups, a ready mission
  if (s.carry.n > 0 && s.carry.room) {
    const r = s.rooms[s.carry.room]
    const slot = r.supply.findIndex((n, i) => i < r.stations && n < ECONOMY.supply.basketMax)
    if (slot >= 0) {
      const p = slotOf(s.carry.room, slot)
      return { kind: 'kits', room: s.carry.room, at: { x: p.x, z: p.z - 0.4 } }
    }
  }
  const needy = trainingRooms(s).find((id) => {
    const r = s.rooms[id]
    return !r.runner && r.crate && s.cadets.some((c) => c.room === id && (c.phase === 'train' || c.phase === 'walk') && (r.supply[c.slot] ?? 0) === 0)
  })
  if (needy) return { kind: 'kits', room: needy, at: crateOf(needy) }
  if (s.counter && !s.clerk && s.cadets.some((c) => c.phase === 'queue') && serveBlocker(s) === null) return { kind: 'serve', at: LAYOUT.serveSpot }
  // a smaller pile still beats standing around
  if (piles[0] && s.rooms[piles[0]].stack >= 5) return { kind: 'cash', room: piles[0], at: cashSpotOf(piles[0]) }
  return null
}
