/**
 * The ONLY module that touches window.bridge. Everything else imports from here.
 */
import type {} from '@playgama/bridge/global'
import {
  adOpen,
  platformAudioEnabled,
  platformPaused,
  requestFlush,
} from '../core/lifecycle'

export const BUILD_VERSION: string = __BUILD_VERSION__

export type PlatformMessage =
  | 'game_ready'
  | 'in_game_loading_started'
  | 'in_game_loading_stopped'
  | 'player_got_achievement'
  | 'level_started'
  | 'level_completed'
  | 'level_failed'
  | 'level_paused'
  | 'level_resumed'

export type AdState = 'loading' | 'opened' | 'closed' | 'rewarded' | 'failed'

/** Timestamps (performance.now) of the boot milestones, read by tests and debug hooks. */
export const bootMarks: Record<string, number> = {}
export function mark(name: string): void {
  bootMarks[name] = Math.round(performance.now())
}

let ready = false
function b() {
  if (!ready) throw new Error('Bridge used before initialize() finished')
  return window.bridge
}

export async function initBridge(): Promise<void> {
  const bridge = window.bridge
  if (!bridge) throw new Error('Playgama Bridge script missing')
  await bridge.initialize()
  ready = true
  mark('bridge_ready')
  try {
    bridge.gameVersion = BUILD_VERSION
    bridge.engine = 'three.js'
  } catch {
    /* optional */
  }

  // Initial states (events only fire on later changes).
  platformAudioEnabled.value = bridge.platform.isAudioEnabled !== false
  if (bridge.advertisement.interstitialState === 'opened') adOpen.value = true

  // Central pause/audio handling: ads, tab switches and system pauses all arrive here.
  bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused: boolean) => {
    platformPaused.value = !!isPaused
    if (isPaused) requestFlush()
  })
  bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (isEnabled: boolean) => {
    platformAudioEnabled.value = !!isEnabled
  })
  bridge.advertisement.on(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, (state: string) =>
    trackAdOpen(state),
  )
  bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, (state: string) =>
    trackAdOpen(state),
  )
}

function trackAdOpen(state: string): void {
  if (state === 'opened') adOpen.value = true
  else if (state === 'closed' || state === 'failed') adOpen.value = false
}

export const platform = {
  get id(): string {
    return String(b().platform.id)
  },
  /** Read once after init, use as localization source language. */
  get language(): string {
    return String(b().platform.language || 'en').toLowerCase()
  },
  get isExternalLinksAllowed(): boolean {
    return !!b().platform.isExternalLinksAllowed
  },
  get isExternalCallsSupported(): boolean {
    return !!b().platform.isExternalCallsSupported
  },
  sendMessage(message: PlatformMessage, data?: { world?: string; level?: string }): void {
    if (message === 'game_ready') mark('game_ready')
    if (data) b().platform.sendMessage(message as never, data as never)
    else b().platform.sendMessage(message as never)
  },
  setLoadingProgress(percent: number): void {
    try {
      window.bridge.setGameLoadingProgress(Math.max(0, Math.min(100, Math.round(percent))))
    } catch {
      /* not supported everywhere */
    }
  },
  async getServerTime(): Promise<number | null> {
    if (!platform.isExternalCallsSupported) return null
    try {
      const t = Number(await b().platform.getServerTime())
      return Number.isFinite(t) && t > 0 ? t : null
    } catch {
      return null
    }
  },
}

export const device = {
  get type(): string {
    return String(b().device.type)
  },
  get os(): string {
    return String((b().device as unknown as { os?: string }).os ?? 'other')
  },
  get safeArea(): { top: number; bottom: number; left: number; right: number } {
    const s = (b().device as unknown as { safeArea?: Record<string, number> }).safeArea
    return {
      top: s?.top ?? 0,
      bottom: s?.bottom ?? 0,
      left: s?.left ?? 0,
      right: s?.right ?? 0,
    }
  },
}

export const storage = {
  async get(keys: string[]): Promise<unknown[]> {
    const res = (await b().storage.get(keys as never)) as unknown
    if (Array.isArray(res)) return res
    if (keys.length === 1) return [res]
    return keys.map(() => null)
  },
  async set(keys: string[], values: string[]): Promise<void> {
    await b().storage.set(keys as never, values as never)
  },
}

export const advertisement = {
  get isInterstitialSupported(): boolean {
    return !!b().advertisement.isInterstitialSupported
  },
  get isRewardedSupported(): boolean {
    return !!b().advertisement.isRewardedSupported
  },
  get isBannerSupported(): boolean {
    return !!b().advertisement.isBannerSupported
  },
  get rewardedPlacement(): string | null {
    return (b().advertisement.rewardedPlacement as string | null) ?? null
  },
  showInterstitial(placement: string): void {
    b().advertisement.showInterstitial(placement)
  },
  showRewarded(placement: string): void {
    b().advertisement.showRewarded(placement)
  },
  onInterstitialState(fn: (s: AdState) => void): () => void {
    const bridge = b()
    const h = (s: AdState) => fn(s)
    bridge.advertisement.on(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, h)
    return () => bridge.advertisement.off(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, h)
  },
  onRewardedState(fn: (s: AdState) => void): () => void {
    const bridge = b()
    const h = (s: AdState) => fn(s)
    bridge.advertisement.on(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, h)
    return () => bridge.advertisement.off(bridge.EVENT_NAME.REWARDED_STATE_CHANGED, h)
  },
}

export const features = {
  get payments(): boolean {
    return !!b().payments.isSupported
  },
  get leaderboards(): boolean {
    return String(b().leaderboards.type) !== 'not_available'
  },
}

/** Leaderboards (Legacy Medals). in_game: own UI via getEntries; native: score only; native_popup: platform overlay. */
export type LbType = 'not_available' | 'in_game' | 'native' | 'native_popup'
export interface LbEntry {
  id: string
  name: string
  photo: string
  score: number
  rank: number
}

export const leaderboards = {
  get type(): LbType {
    try {
      return String(b().leaderboards.type) as LbType
    } catch {
      return 'not_available'
    }
  },
  async setScore(id: string, score: number): Promise<void> {
    if (leaderboards.type === 'not_available') return
    try {
      await b().leaderboards.setScore(id, score)
    } catch {
      /* a failed submit must never break the game */
    }
  },
  async getEntries(id: string): Promise<LbEntry[]> {
    if (leaderboards.type !== 'in_game') return []
    try {
      return ((await b().leaderboards.getEntries(id)) as LbEntry[]) ?? []
    } catch {
      return []
    }
  },
  async showNativePopup(id: string): Promise<void> {
    if (leaderboards.type !== 'native_popup') return
    try {
      await b().leaderboards.showNativePopup(id)
    } catch {
      /* ignore */
    }
  },
}

export const analytics = {
  send(eventName: string, data?: Record<string, unknown>): void {
    try {
      b().analytics.send(eventName, data)
    } catch {
      /* analytics must never break the game */
    }
  },
}
