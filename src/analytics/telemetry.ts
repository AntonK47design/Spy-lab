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

export function track(event: GameEvent, data?: Record<string, string | number | boolean>): void {
  analytics.send(event, data)
}

/** performance_sample transport (swap here when Bridge system events arrive). */
export function sendPerformanceSample(sample: Record<string, number | string>): void {
  analytics.send('performance_sample', sample)
}
