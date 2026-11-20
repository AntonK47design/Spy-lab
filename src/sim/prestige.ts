/** Relocate HQ: start over in a new cover shop, keep agents/missions/gadgets/badges/intel, gain Legacy Medals. */
import { PRESTIGE, medalsFor } from '../config/prestige.ts'
import { newGame, type GameState } from './state.ts'

export function medalGain(s: GameState): number {
  return Math.max(0, medalsFor(s.stats.earned) - s.medals)
}

export function canRelocate(s: GameState): boolean {
  return s.level >= PRESTIGE.fromLevel && medalGain(s) >= 1
}

/** Reset the academy in place (the state object stays the same). */
export function relocate(s: GameState): number {
  if (!canRelocate(s)) return 0
  const gain = medalGain(s)
  const keep = {
    agents: s.agents,
    pending: s.pending,
    rosterLimit: s.rosterLimit,
    missions: s.missions,
    gadgets: s.gadgets,
    crafting: s.crafting,
    badges: s.badges,
    intel: s.intel,
    flags: s.flags,
    tutorial: s.tutorial,
    stats: s.stats,
    endless: s.endless,
    fieldOps: s.fieldOps,
    nextId: s.nextId,
    graduatedTotal: s.graduatedTotal,
    prestige: s.prestige + 1,
    medals: s.medals + gain,
  }
  const fresh = newGame()
  Object.assign(s, fresh, keep)
  // no opening cash pile (no lesson needed): it goes straight into the wallet
  s.cash = fresh.cash + fresh.welcome
  s.welcome = 0
  return gain
}
