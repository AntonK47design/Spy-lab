/**
 * Single telemetry adapter. Custom game events and performance_sample go through
 * bridge.analytics.send. Mission lifecycle uses platform messages (level_*) instead,
 * which the Bridge records itself — never send those here as well.
 */
import { analytics } from '../platform/bridge'

export type GameEvent =
  | 'tutorial_step'
  | 'tutorial_completed'
  | 'room_unlocked'
  | 'room_milestone'
  | 'academy_level_up'
  | 'agent_graduated'
  | 'boss_defeated'
  | 'prestige'
  | 'rewarded_offer_shown'
  | 'shop_opened'
  | 'gadget_crafted'
  | 'daily_claimed'
  | 'built'
  | 'first_frame'
  | 'minute_mark'
  | 'info_tap'
  | 'area_opened'
  | 'milestone_reached'

export function track(event: GameEvent, data?: Record<string, string | number | boolean>): void {
  analytics.send(event, data)
}

/** performance_sample transport (swap here when Bridge system events arrive). */
export function sendPerformanceSample(sample: Record<string, number | string | boolean>): void {
  analytics.send('performance_sample', sample)
}

/**
 * Free-play funnel after the short tutorial: ordered, bounded milestones, each sent once per
 * player (remembered in state.flags). Answers "how far do new players get, and where do they stop?".
 */
export interface MilestoneState {
  graduatedTotal: number
  agents: unknown[]
  stats: { missionsWon: number }
  rooms: Record<string, { unlocked: boolean; runner: boolean }>
  areas: Record<string, boolean>
  missions: Record<string, { wins: number }>
  flags: Record<string, boolean>
}

export const MILESTONES: { id: string; reached: (s: MilestoneState) => boolean }[] = [
  { id: 'first_graduate', reached: (s) => s.graduatedTotal > 0 },
  { id: 'first_agent_hired', reached: (s) => s.agents.length > 0 },
  { id: 'first_mission_won', reached: (s) => s.stats.missionsWon > 0 },
  { id: 'laser_gym_unlocked', reached: (s) => !!s.rooms.laser?.unlocked },
  { id: 'first_kit_runner', reached: (s) => Object.values(s.rooms).some((r) => r.runner) },
  { id: 'harbor_opened', reached: (s) => !!s.areas.harbor },
  { id: 'first_boss_defeated', reached: (s) => (s.missions.harbor_boss?.wins ?? 0) > 0 },
  { id: 'lighthouse_opened', reached: (s) => !!s.areas.lighthouse },
]

/** Send newly reached milestones; returns true when a flag changed (persist meta). */
export function checkMilestones(s: MilestoneState): boolean {
  let changed = false
  MILESTONES.forEach((m, i) => {
    const key = `ms_${m.id}`
    if (!s.flags[key] && m.reached(s)) {
      s.flags[key] = true
      changed = true
      track('milestone_reached', { milestone_id: m.id, step_index: i + 1 })
    }
  })
  return changed
}
