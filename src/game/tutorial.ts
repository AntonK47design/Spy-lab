/**
 * FTUE: learning by playing. One mechanic per step, Agent Marmalade says one line,
 * a 3D arrow + edge pointer shows the target. Never shown again once finished.
 */
import { ROOMS, cashSpotOf, padOf, upgradeSpotOf } from '../config/rooms'
import type { GameState } from '../sim/state'

export interface TutorialStep {
  id: string
  line: string
  /** World target for the guide arrow (null = no arrow). */
  target: (s: GameState) => { x: number; z: number } | null
  done: (s: GameState) => boolean
}

export const TUTORIAL: TutorialStep[] = [
  {
    id: 'collect',
    line: 'coach.collect',
    target: () => cashSpotOf('vault'),
    done: (s) => s.stats.collects > 0,
  },
  {
    id: 'upgrade',
    line: 'coach.upgrade',
    target: () => upgradeSpotOf('vault'),
    done: (s) => s.rooms.vault.level > 1 || s.stats.upgrades > 0,
  },
  {
    id: 'graduate',
    line: 'coach.graduate',
    target: () => null,
    done: (s) => s.agents.length > 0 || s.graduatedTotal > 0,
  },
  {
    id: 'mission',
    line: 'coach.mission',
    target: () => padOf('mission_control'),
    done: (s) => (s.missions.harbor_01?.wins ?? 0) > 0,
  },
  {
    id: 'unlock',
    line: 'coach.unlock',
    target: (s) => (s.rooms.laser.unlocked ? null : padOf('laser')),
    done: (s) => s.rooms.laser.unlocked,
  },
  {
    id: 'instructor',
    line: 'coach.instructor',
    target: (s) => (s.cash >= ROOMS.vault.instructorCost ? upgradeSpotOf('vault') : null),
    done: (s) => Object.values(s.rooms).some((r) => r.instructor),
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
