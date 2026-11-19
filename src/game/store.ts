/**
 * UI-facing signals + the GameState instance. The sim mutates `state` directly;
 * `publish()` copies the few HUD values into signals and bumps `rev` for panels.
 */
import { signal } from '@preact/signals-core'
import { hydrate, type GameState } from '../sim/state'
import { read, write } from '../core/save'
import { SAVE } from '../config/save'
import { now } from '../core/time'
import { xpToNext } from '../config/economy'

export let state: GameState = hydrate(null)

export const hud = {
  cash: signal(0),
  intel: signal(0),
  badges: signal(0),
  level: signal(1),
  xp: signal(0),
  xpNext: signal(xpToNext(1)),
}
/** Bumped whenever panel contents may have changed (throttled by the game loop). */
export const rev = signal(0)

export function publish(): void {
  const s = state
  const c = Math.floor(s.cash)
  if (hud.cash.value !== c) hud.cash.value = c
  if (hud.intel.value !== s.intel) hud.intel.value = s.intel
  if (hud.badges.value !== s.badges) hud.badges.value = s.badges
  if (hud.level.value !== s.level) {
    hud.level.value = s.level
    hud.xpNext.value = xpToNext(s.level)
  }
  if (hud.xp.value !== s.xp) hud.xp.value = s.xp
}

export function bump(): void {
  rev.value++
}

// ---------- persistence (Bridge storage via core/save) ----------
export function loadState(): void {
  const core = read(SAVE.keys.core, {} as Record<string, unknown>)
  const agents = read(SAVE.keys.agents, {} as Record<string, unknown>)
  const progress = read(SAVE.keys.progress, {} as Record<string, unknown>)
  const meta = read(SAVE.keys.meta, {} as Record<string, unknown>)
  const has = Object.keys(core).length > 0
  state = hydrate(has ? ({ ...core, ...agents, ...progress, ...meta } as Partial<GameState>) : null)
  publish()
}

export type SaveScope = 'core' | 'agents' | 'progress' | 'meta'

/** Mark parts of the state as changed; core/save batches + throttles the actual write. */
export function persist(scopes: SaveScope[] = ['core', 'meta'], immediate = false): void {
  const s = state
  s.lastSeen = now()
  for (const sc of scopes) {
    if (sc === 'core')
      write(SAVE.keys.core, {
        cash: s.cash, intel: s.intel, badges: s.badges, xp: s.xp, level: s.level, rooms: s.rooms,
        cadets: s.cadets, recruitTimer: s.recruitTimer, nextId: s.nextId, graduatedTotal: s.graduatedTotal,
        rosterLimit: s.rosterLimit,
      }, immediate)
    else if (sc === 'agents') write(SAVE.keys.agents, { agents: s.agents }, immediate)
    else if (sc === 'progress') write(SAVE.keys.progress, { missions: s.missions }, immediate)
    else write(SAVE.keys.meta, { flags: s.flags, tutorial: s.tutorial, stats: s.stats, lastSeen: s.lastSeen }, immediate)
  }
}
