import { computed, signal } from '@preact/signals-core'

/**
 * The ONE place that decides whether the game runs and whether it is audible.
 * Bridge pause/audio events, ad state, tab visibility and the in-game pause menu
 * all write here; loop and AudioManager only read the derived signals.
 */
export const platformPaused = signal(false) // bridge PAUSE_STATE_CHANGED
export const platformAudioEnabled = signal(true) // bridge isAudioEnabled / AUDIO_STATE_CHANGED
export const adOpen = signal(false) // interstitial/rewarded open (bridge or dev simulator)
export const pageHidden = signal(typeof document !== 'undefined' ? document.hidden : false)
export const userPaused = signal(false) // pause menu / P key
export const userMuted = signal(false) // mute button (persisted in settings)
export const contextLost = signal(false) // WebGL context loss

/** Game simulation + render loop may run. */
export const isRunning = computed(
  () => !platformPaused.value && !adOpen.value && !pageHidden.value && !contextLost.value,
)

/** Gameplay timers advance (additionally stopped by the in-game pause menu). */
export const isGameplayActive = computed(() => isRunning.value && !userPaused.value)

/** Master gain is open. */
export const isAudible = computed(
  () =>
    !userMuted.value &&
    platformAudioEnabled.value &&
    !platformPaused.value &&
    !adOpen.value &&
    !pageHidden.value,
)

type Listener = () => void
const flushListeners: Listener[] = []
/** Called when the game should persist immediately (platform pause, tab hidden). */
export function onFlushRequest(fn: Listener): void {
  flushListeners.push(fn)
}
export function requestFlush(): void {
  for (const fn of flushListeners) fn()
}

let bound = false
export function bindPageVisibility(): void {
  if (bound) return
  bound = true
  document.addEventListener('visibilitychange', () => {
    pageHidden.value = document.hidden
    if (document.hidden) requestFlush()
  })
  window.addEventListener('pagehide', () => requestFlush())
}
