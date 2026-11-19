/**
 * window.__spylab — QA hooks, only in DEV builds or with ?debug=1.
 */
import type { Game } from '../game/Game'
import type { createRenderer } from '../render/renderer'
import { state, persist } from '../game/store'
import { createAgent } from '../sim/academy'
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
import { panel, missionUi, type Panel } from '../ui/uiState'
import { TUTORIAL } from '../game/tutorial'
import { blockInterstitials } from '../platform/ads'
import { cashSpotOf, padOf, upgradeSpotOf, type RoomId } from '../config/rooms'
import type { SafeCracker } from '../minigames/safe/SafeCracker'

export function installDebugHooks(g: { renderer: ReturnType<typeof createRenderer>; game: Game }): void {
  const game = g.game
  const api = {
    goto: (screen: 'academy' | 'missions' | 'agents' | 'settings') => {
      panel.value = screen === 'academy' ? null : ({ kind: screen } as Panel)
    },
    openPanel: (p: Panel | null) => (panel.value = p),
    startMission: (id: string) => game.startMission(id),
    setTier: (_minigame: string, tier: number | null) => (game.tierOverride = tier),
    addCurrency: (type: 'cash' | 'intel' | 'badges', n: number) => {
      state[type] = Math.max(0, state[type] + n)
      persist(['core'])
    },
    skipTutorial: () => {
      state.tutorial = TUTORIAL.length
      blockInterstitials('tutorial', false)
      persist(['meta'])
    },
    timeWarp: (minutes: number) => {
      warp(minutes)
      return new Date(now()).toISOString()
    },
    setQuality: (tier: QualityTier) => g.renderer.setTier(tier),
    simulateAd: (result: SimOutcome, durationMs?: number) => {
      setNextOutcome(result)
      if (durationMs != null) setDuration(durationMs)
    },
    showRewarded: (p: RewardedPlacement) => showRewarded(p),
    showInterstitial: (p: InterstitialPlacement) => showInterstitial(p),
    flushSave: () => {
      persist(['core', 'agents', 'progress', 'meta'])
      return flush()
    },
    teleport: (x: number, z: number) => game.teleport(x, z),
    spot: (kind: 'cash' | 'pad' | 'upgrade', room: RoomId) =>
      kind === 'cash' ? cashSpotOf(room) : kind === 'pad' ? padOf(room) : upgradeSpotOf(room),
    player: () => ({ x: game.player.x, z: game.player.z }),
    mgAction: () => game.minigameAction(),
    mgZoneOffset: () => (game.minigame as SafeCracker | null)?.debugZoneOffset() ?? null,
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
      cash: Math.floor(state.cash),
      intel: state.intel,
      badges: state.badges,
      level: state.level,
      tutorial: state.tutorial,
      agents: state.agents.length,
      cadets: state.cadets.length,
      rooms: Object.fromEntries(Object.entries(state.rooms).map(([k, r]) => [k, { ...r }])),
      missions: state.missions,
      flags: state.flags,
      mode: game.mode,
      panel: panel.value?.kind ?? null,
      mission: missionUi.value,
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
    raw: () => state,
    grantAgent: () => {
      state.agents.push(createAgent(state, 'vault'))
      persist(['agents'])
      return state.agents.length
    },
    boot: bootMarks,
    adLog: simLog,
    lifecycle,
  }
  ;(window as unknown as { __spylab: typeof api }).__spylab = api
}
