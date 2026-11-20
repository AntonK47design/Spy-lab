/** Gadget Lab: craft (Intel + real time), finish early with Gold Badges, use one per mission. */
import { GADGET, GADGETS, type GadgetId } from '../config/gadgets.ts'
import type { GameState } from './state.ts'

export type CraftBlock = 'ok' | 'busy' | 'intel' | 'full' | 'locked'

export function craftBlock(s: GameState, id: GadgetId): CraftBlock {
  const g = GADGETS.find((x) => x.id === id)
  if (!g || !s.rooms.gadget.unlocked) return 'locked'
  if (s.crafting) return 'busy'
  if ((s.gadgets[id] ?? 0) >= GADGET.maxStock) return 'full'
  if (s.intel < g.intel) return 'intel'
  return 'ok'
}

export function craftGadget(s: GameState, id: GadgetId, nowMs: number): boolean {
  if (craftBlock(s, id) !== 'ok') return false
  const g = GADGETS.find((x) => x.id === id)!
  s.intel -= g.intel
  s.crafting = { id, endsAt: nowMs + g.seconds * 1000 }
  return true
}

/** Finished craft goes into the stock; returns its id once. */
export function tickGadgets(s: GameState, nowMs: number): GadgetId | null {
  const c = s.crafting
  if (!c || nowMs < c.endsAt) return null
  s.gadgets[c.id] = Math.min(GADGET.maxStock, (s.gadgets[c.id] ?? 0) + 1)
  s.crafting = null
  return c.id
}

/** Finish the running craft now for Gold Badges. */
export function rushGadget(s: GameState, nowMs: number): GadgetId | null {
  if (!s.crafting || s.badges < GADGET.rushBadges) return null
  s.badges -= GADGET.rushBadges
  s.crafting.endsAt = nowMs
  return tickGadgets(s, nowMs)
}

/** Take one gadget from the stock for a mission. */
export function takeGadget(s: GameState, id: GadgetId): boolean {
  const n = s.gadgets[id] ?? 0
  if (n <= 0) return false
  s.gadgets[id] = n - 1
  return true
}
