/**
 * Game state (Phase 0: currencies only). Persisted to spylab_v1_core.
 */
import { signal } from '@preact/signals-core'
import { read, write } from './save'
import { SAVE } from '../config/save'
import { now } from './time'

export type Currency = 'cash' | 'intel' | 'badges'

export const cash = signal(0)
export const intel = signal(0)
export const badges = signal(0)

const CORE_DEFAULTS = { cash: 0, intel: 0, badges: 0, savedAt: 0 }

export function loadCore(): void {
  const c = read(SAVE.keys.core, CORE_DEFAULTS)
  cash.value = num(c.cash)
  intel.value = num(c.intel)
  badges.value = num(c.badges)
}

export function saveCore(immediate = false): void {
  write(
    SAVE.keys.core,
    { cash: cash.value, intel: intel.value, badges: badges.value, savedAt: now() },
    immediate,
  )
}

export function addCurrency(type: Currency, n: number): void {
  const s = type === 'cash' ? cash : type === 'intel' ? intel : badges
  s.value = Math.max(0, s.value + n)
  saveCore()
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
