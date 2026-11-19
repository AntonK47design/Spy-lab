/**
 * window.__spylab — QA hooks, only in DEV builds or with ?debug=1.
 */
import type { GameHandles } from '../game/boot'
import { addCurrency, cash, intel, badges, type Currency } from '../core/store'
import { timeWarp as warp, now } from '../core/time'
import { bootMarks } from '../platform/bridge'
import { flush, saveStats } from '../core/save'
import { recentFps } from '../analytics/perf'
import { setNextOutcome, setDuration, simLog, type SimOutcome } from '../platform/devAdSimulator'
import { showInterstitial, showRewarded } from '../platform/ads'
import type { InterstitialPlacement, RewardedPlacement } from '../config/ads'
import type { QualityTier } from '../config/quality'
import * as lifecycle from '../core/lifecycle'
import { AudioManager } from '../audio/AudioManager'
import { missingKeys, lang } from '../i18n/i18n'
import { openPanel } from '../ui/App'

const notYet = (name: string) => () => `${name}: available from Phase 1+`

export function installDebugHooks(g: GameHandles): void {
  const api = {
    goto: notYet('goto'),
    startMission: notYet('startMission'),
    setTier: notYet('setTier'),
    skipTutorial: notYet('skipTutorial'),
    addCurrency: (type: Currency, n: number) => addCurrency(type, n),
    timeWarp: (minutes: number) => {
      warp(minutes)
      return new Date(now()).toISOString()
    },
    setQuality: (tier: QualityTier) => g.renderer.setTier(tier),
    /** Outcome of the NEXT simulated ad. */
    simulateAd: (result: SimOutcome, durationMs?: number) => {
      setNextOutcome(result)
      if (durationMs != null) setDuration(durationMs)
    },
    showRewarded: (p: RewardedPlacement) => showRewarded(p),
    showInterstitial: (p: InterstitialPlacement) => showInterstitial(p),
    openPanel: (p: 'settings' | 'pause' | null) => (openPanel.value = p),
    flushSave: () => flush(),
    tapCash: () => {
      const p = g.rig.toScreen(g.academy.cashStack)
      return p
    },
    stats: () => {
      const info = g.renderer.renderer.info
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
      return {
        fps: recentFps(1000),
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        jsHeapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
        tier: g.renderer.tier,
        size: [g.renderer.width, g.renderer.height],
      }
    },
    state: () => ({
      cash: cash.value,
      intel: intel.value,
      badges: badges.value,
      lang: lang.value,
      running: lifecycle.isRunning.value,
      audible: lifecycle.isAudible.value,
      adOpen: lifecycle.adOpen.value,
      userMuted: lifecycle.userMuted.value,
      platformPaused: lifecycle.platformPaused.value,
      audio: AudioManager.state,
      audioFailed: AudioManager.failed,
      missingKeys: [...missingKeys],
      save: { ...saveStats },
    }),
    boot: bootMarks,
    adLog: simLog,
    lifecycle,
  }
  ;(window as unknown as { __spylab: typeof api }).__spylab = api
}
