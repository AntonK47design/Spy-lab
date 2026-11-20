/** Field Ops (timed jobs for spare graduates), Villain Alerts and Endless Ops (dynamic missions). */
import { ENDLESS, FIELD_OPS, VILLAIN_ALERT } from '../config/ops.ts'
import { MISSIONS, PLAYABLE_MINIGAMES, REGIONS, missionById, type MissionDef } from '../config/missions.ts'
import { ROOMS, ROOM_ORDER, type MinigameId, type RoomId } from '../config/rooms.ts'
import { agentPower } from './academy.ts'
import type { GameState } from './state.ts'

// ---------------------------------------------------------------- Field Ops
export function fieldOpsOpen(s: GameState): boolean {
  return s.level >= FIELD_OPS.fromLevel
}

/** Send a waiting graduate (office bench) on a timed op. */
export function startFieldOp(s: GameState, pendingIndex: number, op: number, nowMs: number): boolean {
  const p = s.pending[pendingIndex]
  const def = FIELD_OPS.ops[op]
  if (!p || !def || !fieldOpsOpen(s) || s.fieldOps.length >= FIELD_OPS.slots) return false
  s.pending.splice(pendingIndex, 1)
  s.fieldOps.push({
    agent: p.agent,
    op,
    endsAt: nowMs + def.minutes * 60_000,
    cash: Math.round(p.fee * def.feeMult),
    intel: def.intel + Math.floor(agentPower(p.agent) / 25),
  })
  return true
}

/** Rewarded "Finish now". */
export function finishFieldOp(s: GameState, i: number, nowMs: number): boolean {
  const f = s.fieldOps[i]
  if (!f || f.endsAt <= nowMs) return false
  f.endsAt = nowMs
  return true
}

export function collectFieldOp(s: GameState, i: number, nowMs: number): { cash: number; intel: number } | null {
  const f = s.fieldOps[i]
  if (!f || f.endsAt > nowMs) return null
  s.fieldOps.splice(i, 1)
  s.cash += f.cash
  s.intel += f.intel
  s.stats.earned += f.cash
  return { cash: f.cash, intel: f.intel }
}

// ---------------------------------------------------------------- dynamic missions
/** The next mission to win (or the last one) - reference for alert rewards. */
function frontier(s: GameState): MissionDef {
  return MISSIONS.find((m) => !((s.missions[m.id]?.wins ?? 0) > 0)) ?? MISSIONS[MISSIONS.length - 1]!
}

function roomOf(minigame: MinigameId): RoomId {
  return ROOM_ORDER.find((id) => ROOMS[id].minigame === minigame) ?? 'vault'
}

/** Highest tier of a minigame the player has beaten in a regular mission. */
function bestTier(s: GameState, minigame: MinigameId): number {
  let t = 0
  for (const m of MISSIONS) if (m.minigame === minigame && !m.boss && (s.missions[m.id]?.wins ?? 0) > 0) t = Math.max(t, m.tier)
  return t
}

/** Count down active play time; spawn / expire the Villain Alert. Returns 'spawned' once. */
export function tickAlert(s: GameState, dt: number, nowMs: number, rnd: () => number = Math.random): 'spawned' | 'expired' | null {
  if (s.alert && nowMs >= s.alert.endsAt) {
    s.alert = null
    return 'expired'
  }
  if (s.alert || s.level < VILLAIN_ALERT.fromLevel || !s.agents.length) return null
  s.alertIn -= dt
  if (s.alertIn > 0) return null
  s.alertIn = VILLAIN_ALERT.everyMin + rnd() * (VILLAIN_ALERT.everyMax - VILLAIN_ALERT.everyMin)
  const games = PLAYABLE_MINIGAMES.filter((g) => s.rooms[roomOf(g)].unlocked)
  if (!games.length) return null
  const minigame = games[Math.floor(rnd() * games.length)]!
  const f = frontier(s)
  s.alert = {
    minigame,
    room: roomOf(minigame),
    region: f.region,
    tier: Math.min(10, Math.max(1, bestTier(s, minigame) + VILLAIN_ALERT.tierStep)),
    cash: Math.round(f.cash * VILLAIN_ALERT.cashMult),
    intel: f.intel,
    badges: VILLAIN_ALERT.badges,
    endsAt: nowMs + VILLAIN_ALERT.lasts * 1000,
  }
  return 'spawned'
}

export function endlessOpen(s: GameState): boolean {
  return (s.missions[ENDLESS.after]?.wins ?? 0) > 0
}

const ENDLESS_CYCLE: MinigameId[] = ['laser', 'code', 'mole', 'scooter', 'circuit', 'safe']

/** Mission definitions for the static list plus the dynamic ones ('alert', 'endless'). */
export function resolveMission(s: GameState, id: string): MissionDef | undefined {
  if (id === 'alert') {
    const a = s.alert
    if (!a) return undefined
    return { id, region: a.region, index: 0, minigame: a.minigame, room: a.room, tier: a.tier, cash: a.cash, intel: a.intel, badges: a.badges }
  }
  if (id === 'endless') {
    if (!endlessOpen(s)) return undefined
    const n = s.endless
    const minigame = ENDLESS_CYCLE[n % ENDLESS_CYCLE.length]!
    return {
      id,
      region: REGIONS[n % REGIONS.length]!,
      index: n,
      minigame,
      room: roomOf(minigame),
      tier: Math.min(10, ENDLESS.baseTier + Math.floor(n / ENDLESS.tierEvery)),
      cash: Math.round(ENDLESS.cashBase * Math.pow(ENDLESS.cashGrowth, n)),
      intel: ENDLESS.intelBase + n * ENDLESS.intelStep,
    }
  }
  return missionById(id)
}
