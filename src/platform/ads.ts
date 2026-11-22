/**
 * All ad calls go through here. No own timers or counters for interstitials:
 * the Bridge decides if and when an interstitial is really shown.
 */
import { signal } from '@preact/signals-core'
import type { InterstitialPlacement, RewardedPlacement } from '../config/ads'
import { AD_SIM } from '../debug/flags'
import { adOpen } from '../core/lifecycle'
import { advertisement, type AdState } from './bridge'
import { simulateAd } from './devAdSimulator'

export type RewardedResult = 'rewarded' | 'closed' | 'failed'

/** Reasons interstitials are blocked right now (minigame, tutorial, cutscene, camera move). */
const blockers = new Set<string>()
/** A rewarded ad was watched in the current flow: skip the flow's closing interstitial. */
let rewardedSeenInFlow = false

export const rewardedBusy = signal(false)

export function rewardedSupported(): boolean {
  if (AD_SIM === 'on') return true
  if (AD_SIM === 'unsupported') return false
  return advertisement.isRewardedSupported
}

export function interstitialSupported(): boolean {
  if (AD_SIM === 'on') return true
  if (AD_SIM === 'unsupported') return false
  return advertisement.isInterstitialSupported
}

export function blockInterstitials(reason: string, blocked: boolean): void {
  if (blocked) blockers.add(reason)
  else blockers.delete(reason)
}

/** Call when a new flow starts (e.g. a mission begins). */
export function beginFlow(): void {
  rewardedSeenInFlow = false
}

/** Ask for an interstitial at a natural pause. Returns whether the call was forwarded. */
export function showInterstitial(placement: InterstitialPlacement): boolean {
  if (blockers.size > 0) return false
  if (rewardedSeenInFlow) {
    rewardedSeenInFlow = false
    return false
  }
  if (!interstitialSupported()) return false
  if (AD_SIM === 'on') simulateAd('interstitial', placement, () => {})
  else advertisement.showInterstitial(placement)
  return true
}

/**
 * Opt-in rewarded ad. Resolves 'rewarded' ONLY if the Bridge reported the
 * `rewarded` state for this placement; callers grant the reward on that value only.
 */
export function showRewarded(placement: RewardedPlacement): Promise<RewardedResult> {
  if (rewardedBusy.value || !rewardedSupported()) return Promise.resolve('failed')
  rewardedBusy.value = true
  return new Promise<RewardedResult>((resolve) => {
    let granted = false
    let off: () => void = () => {}
    const handle = (s: AdState) => {
      if (s === 'rewarded') {
        const p = AD_SIM === 'on' ? placement : (advertisement.rewardedPlacement ?? placement)
        if (p === placement) granted = true
      } else if (s === 'closed' || s === 'failed') {
        off()
        rewardedBusy.value = false
        if (AD_SIM !== 'on') adOpen.value = false
        if (granted) rewardedSeenInFlow = true
        resolve(granted ? 'rewarded' : s)
      }
    }
    if (AD_SIM === 'on') {
      simulateAd('rewarded', placement, handle)
    } else {
      // pause + mute from the request on (not only from 'opened'): some platforms report
      // 'opened' late or not at all, and the ad must never play over the game's sound.
      // A rewarded request always ends in 'closed' or 'failed', which releases it.
      adOpen.value = true
      off = advertisement.onRewardedState(handle)
      try {
        advertisement.showRewarded(placement)
      } catch {
        handle('failed')
      }
    }
  })
}
