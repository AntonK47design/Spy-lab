/**
 * DEV ONLY ad simulator. Mimics the Bridge ad lifecycle (loading -> opened ->
 * rewarded -> closed, or failed) and drives the same central lifecycle signals the
 * Bridge PAUSE/AUDIO events drive, so pause + mute behaviour is testable locally.
 */
import { ADS } from '../config/ads'
import { adOpen } from '../core/lifecycle'
import type { AdState } from './bridge'

export type SimOutcome = 'rewarded' | 'closed' | 'failed'

let nextOutcome: SimOutcome = 'rewarded'
let durationMs: number = ADS.simulatedAdDurationMs
/** Log of every simulated ad, inspected by Playwright. */
export const simLog: { kind: 'interstitial' | 'rewarded'; placement: string; outcome: string }[] = []

export function setNextOutcome(o: SimOutcome): void {
  nextOutcome = o
}
export function setDuration(ms: number): void {
  durationMs = ms
}

export function simulateAd(
  kind: 'interstitial' | 'rewarded',
  placement: string,
  emit: (s: AdState) => void,
): void {
  const outcome: SimOutcome = kind === 'interstitial' && nextOutcome === 'rewarded' ? 'closed' : nextOutcome
  nextOutcome = 'rewarded'
  simLog.push({ kind, placement, outcome })
  emit('loading')
  if (outcome === 'failed') {
    queueMicrotask(() => emit('failed'))
    return
  }
  const overlay = document.createElement('div')
  overlay.className = 'sim-ad'
  overlay.setAttribute('data-testid', 'sim-ad')
  overlay.innerHTML = `<div><b>SIMULATED AD</b><span>${kind} · ${placement}</span></div>`
  document.body.appendChild(overlay)
  adOpen.value = true
  emit('opened')
  setTimeout(() => {
    if (kind === 'rewarded' && outcome === 'rewarded') emit('rewarded')
    overlay.remove()
    adOpen.value = false
    emit('closed')
  }, durationMs)
}
