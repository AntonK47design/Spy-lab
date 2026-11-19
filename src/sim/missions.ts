import { ECONOMY } from '../config/economy.ts'
import { MISSIONS, MISSION_REWARDS, PLAYABLE_MINIGAMES, type MissionDef } from '../config/missions.ts'
import { ROOMS } from '../config/rooms.ts'
import { addXp, type SimEvents } from './academy.ts'
import type { Agent, GameState } from './state.ts'

export type MissionLock = 'ok' | 'agent' | 'room' | 'previous' | 'region' | 'soon'

export function missionLock(s: GameState, m: MissionDef): MissionLock {
  // the mission before (in a new region: the last mission of the previous region)
  const prev = MISSIONS[MISSIONS.indexOf(m) - 1]
  if (prev && !((s.missions[prev.id]?.wins ?? 0) > 0)) return prev.region === m.region ? 'previous' : 'region'
  if (!s.rooms[m.room].unlocked) return 'room'
  if (!PLAYABLE_MINIGAMES.includes(m.minigame)) return 'soon'
  if (s.agents.length === 0) return 'agent'
  return 'ok'
}

/** The best agent for this mission's skill (auto-suggested in the briefing). */
export function bestAgent(s: GameState, m: MissionDef): Agent | null {
  const skill = ROOMS[m.room].skill ?? 'finesse'
  let best: Agent | null = null
  for (const a of s.agents) if (!best || a.skills[skill] > best.skills[skill]) best = a
  return best
}

export function missionReward(s: GameState, m: MissionDef, stars: number): { cash: number; intel: number } {
  const replay = (s.missions[m.id]?.wins ?? 0) > 0
  const mult = (replay ? MISSION_REWARDS.replayShare : 1) * (1 + MISSION_REWARDS.perStar * Math.max(0, stars - 1))
  return { cash: Math.round(m.cash * mult), intel: Math.round(m.intel * mult) }
}

export function recordWin(
  s: GameState,
  m: MissionDef,
  stars: number,
  reward: { cash: number; intel: number },
  agent: Agent | null,
  ev: SimEvents = {},
): void {
  const p = (s.missions[m.id] ??= { stars: 0, wins: 0, fails: 0 })
  p.wins++
  p.stars = Math.max(p.stars, stars)
  s.cash += reward.cash
  s.intel += reward.intel
  s.stats.earned += reward.cash
  s.stats.missionsWon++
  if (agent) agent.level++
  addXp(s, ECONOMY.academyXp.missionWin, ev)
}

export function recordFail(s: GameState, m: MissionDef): void {
  const p = (s.missions[m.id] ??= { stars: 0, wins: 0, fails: 0 })
  p.fails++
}

export function totalStars(s: GameState): number {
  return Object.values(s.missions).reduce((a, p) => a + p.stars, 0)
}
