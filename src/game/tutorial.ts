/**
 * FTUE: a fixed route (Kickoff lesson), one mechanic per step. Agent Marmalade says one line,
 * a 3D arrow + edge pointer shows the target. Steps are derived from state, so old saves
 * skip what they have already done; it never comes back after a reload.
 */
import { ECONOMY } from '../config/economy'
import { LAYOUT, OFFICE, cashSpotOf, crateOf, padOf, slotOf } from '../config/rooms'
import type { GameState } from '../sim/state'
import type { PadTarget } from '../sim/academy'

export interface TutorialStep {
  id: string
  line: string
  /** World target for the guide arrow (null = no arrow). */
  target: (s: GameState) => { x: number; z: number } | null
  done: (s: GameState) => boolean
  /** Purchase steps: the pad (while it is not affordable the arrow shows the next chore instead). */
  buy?: PadTarget
}

const v = (s: GameState) => s.rooms.vault

export const TUTORIAL: TutorialStep[] = [
  { id: 'cash', line: 'coach.cash', target: () => LAYOUT.welcomeSpot, done: (s) => s.welcome <= 0 },
  { id: 'counter', line: 'coach.counter', target: () => LAYOUT.serveSpot, done: (s) => s.counter, buy: { kind: 'counter' } },
  { id: 'station', line: 'coach.station', target: () => slotOf('vault', 0), done: (s) => v(s).stations > 0, buy: { kind: 'station', room: 'vault' } },
  { id: 'crate', line: 'coach.crate', target: () => crateOf('vault'), done: (s) => v(s).crate, buy: { kind: 'crate', room: 'vault' } },
  { id: 'serve', line: 'coach.serve', target: () => LAYOUT.serveSpot, done: (s) => s.stats.served > 0 },
  {
    id: 'kits',
    line: 'coach.kits',
    target: (s) => (s.carry.n > 0 ? slotOf('vault', 0) : crateOf('vault')),
    done: (s) => s.stats.delivered > 0,
  },
  { id: 'fees', line: 'coach.fees', target: () => cashSpotOf('vault'), done: (s) => s.stats.collects > 1 },
  { id: 'station2', line: 'coach.station2', target: () => slotOf('vault', 1), done: (s) => v(s).stations > 1, buy: { kind: 'station', room: 'vault' } },
  { id: 'graduate', line: 'coach.graduate', target: () => null, done: (s) => s.graduatedTotal > 0 },
  // graduates wait in the agency office (no pop-up): hire the first one for Mission 1
  { id: 'hire', line: 'coach.hire', target: () => OFFICE.laptopPad, done: (s) => s.agents.length > 0 },
  { id: 'mission', line: 'coach.mission', target: () => padOf('mission_control'), done: (s) => (s.missions.harbor_01?.wins ?? 0) > 0 },
  { id: 'unlock', line: 'coach.unlock', target: () => padOf('laser'), done: (s) => s.rooms.laser.unlocked, buy: { kind: 'unlock', room: 'laser' } },
  // stay in the new room: first trap, then its kit crate (same pattern as the Vault Workshop)
  { id: 'laserStation', line: 'coach.laserStation', target: () => slotOf('laser', 0), done: (s) => s.rooms.laser.stations > 0, buy: { kind: 'station', room: 'laser' } },
  { id: 'laserCrate', line: 'coach.laserCrate', target: () => crateOf('laser'), done: (s) => s.rooms.laser.crate, buy: { kind: 'crate', room: 'laser' } },
]

export function tutorialActive(s: GameState): boolean {
  return s.tutorial < TUTORIAL.length
}

/** Advance past finished steps. Returns the ids of steps completed now. */
export function advanceTutorial(s: GameState): string[] {
  const done: string[] = []
  while (s.tutorial < TUTORIAL.length && TUTORIAL[s.tutorial]!.done(s)) {
    done.push(TUTORIAL[s.tutorial]!.id)
    s.tutorial++
  }
  return done
}

export const _unused = ECONOMY
