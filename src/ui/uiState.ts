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

export const panel = signal<Panel | null>(null)
/** Celebration popups wait here while another panel is open. */
export const popupQueue = signal<Panel[]>([])

export type MissionUi =
  | { phase: 'playing'; mission: string }
  | { phase: 'result'; mission: string; stars: number; cash: number; intel: number; doubled: boolean; freeDouble: boolean }
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
