import { signal, computed } from '@preact/signals-core'
import type { RoomId } from '../config/rooms'

export type Panel =
  | { kind: 'settings' }
  | { kind: 'pause' }
  | { kind: 'upgrade'; room: RoomId }
  | { kind: 'missions' }
  | { kind: 'briefing'; mission: string }
  | { kind: 'agents' }
  | { kind: 'welcome'; amount: number; seconds: number }
  | { kind: 'levelup'; level: number }
  | { kind: 'agent'; agentId: number }
  | { kind: 'graduate' }
  | { kind: 'office' }
  | { kind: 'vault' }
  | { kind: 'lab' }
  | { kind: 'fieldops' }
  | { kind: 'prestige' }
  | { kind: 'daily' }
  | { kind: 'leaderboard' }

export const panel = signal<Panel | null>(null)
/** Vault Bonus loot collected in the running round (HUD counter). */
export const vaultLoot = signal(0)
/** Ticks 4x per second: refreshes HUD buttons that depend on game state (boost timer, alerts, daily dot). */
export const hudTick = signal(0)
/** Live academy offers on screen: seconds left for the supply drone / VIP recruit (null = none). */
export const liveOffers = signal<{ supply: number | null; vip: number | null; supplyFree: boolean }>({ supply: null, vip: null, supplyFree: true })
/** Briefing: gadget chosen for the next mission (own stock or a free trial after an ad). */
export const briefingGadget = signal<{ mission: string; mode: 'use' | 'trial' } | null>(null)
/** Celebration popups wait here while another panel is open. */
export const popupQueue = signal<Panel[]>([])

export type MissionUi =
  | { phase: 'playing'; mission: string; stage?: number }
  | { phase: 'stage'; mission: string; stage: number }
  | { phase: 'captured'; mission: string }
  | { phase: 'vault'; mission: string; loot: number; cracked: boolean; canRetry: boolean }
  | { phase: 'result'; mission: string; stars: number; cash: number; intel: number; doubled: boolean; freeDouble: boolean; badges?: number; skipped?: boolean }
  | { phase: 'fail'; mission: string; reason: 'alarm' | 'time'; canRevive: boolean }

export const missionUi = signal<MissionUi | null>(null)
export const inMission = computed(() => missionUi.value !== null)

export const toast = signal<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
export function showToast(key: string): void {
  toast.value = key
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), 2200)
}

/** "Tap to explain" card (5 s, non-blocking). */
export const infoCard = signal<{ key: string; room: RoomId | null } | null>(null)
/** First-seconds movement hint: 'hint.drag' (touch), 'hint.keys', 'hint.click' (no keyboard focus). */
export const moveHint = signal<string | null>(null)

/** Tutorial bubble (Agent Marmalade) — i18n key or null. */
export const coachLine = signal<string | null>(null)
/** Rendered hero head (data URL) for the HUD portrait; null until rendered. */
export const portrait = signal<string | null>(null)

export function openPanel(p: Panel): void {
  panel.value = p
}

export function queuePopup(p: Panel): void {
  if (p.kind === 'graduate' && (panel.value?.kind === 'graduate' || popupQueue.value.some((q) => q.kind === 'graduate'))) return
  if (!panel.value && !missionUi.value) panel.value = p
  else popupQueue.value = [...popupQueue.value, p]
}

/** Show the next queued popup if nothing else is open. Returns true if one was shown. */
export function nextPopup(): boolean {
  if (panel.value || missionUi.value) return false
  const [first, ...rest] = popupQueue.value
  if (!first) return false
  popupQueue.value = rest
  panel.value = first
  return true
}
