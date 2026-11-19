/**
 * FTUE: a fixed route (Kickoff lesson), one mechanic per step. Agent Marmalade says one line,
 * a 3D arrow + edge pointer shows the target. Steps are derived from state, so old saves
 * skip what they have already done; it never comes back after a reload.
 */
import { ECONOMY } from '../config/economy'
import { LAYOUT, ROOMS, cashSpotOf, crateOf, padOf, slotOf, staffPadOf } from '../config/rooms'
import type { GameState } from '../sim/state'

export interface TutorialStep {
  id: string
  line: string
  /** World target for the guide arrow (null = no arrow). */
  target: (s: GameState) => { x: number; z: number } | null
  done: (s: GameState) => boolean
}

const v = (s: GameState) => s.rooms.vault

export const TUTORIAL: TutorialStep[] = [
  { id: 'cash', line: 'coach.cash', target: () => LAYOUT.welcomeSpot, done: (s) => s.welcome <= 0 },
  { id: 'counter', line: 'coach.counter', target: () => LAYOUT.serveSpot, done: (s) => s.counter },
  { id: 'station', line: 'coach.station', target: () => slotOf('vault', 0), done: (s) => v(s).stations > 0 },
  { id: 'crate', line: 'coach.crate', target: () => crateOf('vault'), done: (s) => v(s).crate },
  { id: 'serve', line: 'coach.serve', target: () => LAYOUT.serveSpot, done: (s) => s.stats.served > 0 },
  {
    id: 'kits',
    line: 'coach.kits',
    target: (s) => (s.carry.n > 0 ? slotOf('vault', 0) : crateOf('vault')),
    done: (s) => s.stats.delivered > 0,
  },
  { id: 'fees', line: 'coach.fees', target: () => cashSpotOf('vault'), done: (s) => s.stats.collects > 1 },
  { id: 'station2', line: 'coach.station2', target: () => slotOf('vault', 1), done: (s) => v(s).stations > 1 },
  { id: 'graduate', line: 'coach.graduate', target: () => null, done: (s) => s.graduatedTotal > 0 },
  { id: 'mission', line: 'coach.mission', target: () => padOf('mission_control'), done: (s) => (s.missions.harbor_01?.wins ?? 0) > 0 },
  { id: 'unlock', line: 'coach.unlock', target: (s) => (s.rooms.laser.unlocked ? null : padOf('laser')), done: (s) => s.rooms.laser.unlocked },
  {
    id: 'runner',
    line: 'coach.runner',
    target: (s) => (s.cash >= ROOMS.vault.runnerCost * 0.6 ? staffPadOf('vault') : null),
    done: (s) => v(s).runner || s.clerk,
  },
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
