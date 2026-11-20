/**
 * window.__spylab — QA hooks, only in DEV builds or with ?debug=1.
 */
import type { Game } from '../game/Game'
import type { createRenderer } from '../render/renderer'
import { state, persist } from '../game/store'
import { createAgent, levelCost } from '../sim/academy'
import { mgHud } from '../minigames/Minigame'
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
import { LAYOUT, OFFICE, ROOMS, cashSpotOf, crateOf, padOf, slotOf, staffPadOf, upgradeSpotOf, type RoomId } from '../config/rooms'
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
    setQuality: (tier: QualityTier) => {
      g.renderer.setTier(tier)
      game.applyQuality(tier)
    },
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
    spot: (kind: 'cash' | 'pad' | 'upgrade' | 'crate' | 'station' | 'staff' | 'serve' | 'welcome' | 'clerk' | 'hire' | 'sell' | 'laptop', room: RoomId, slot = 0) => {
      switch (kind) {
        case 'cash': return cashSpotOf(room)
        case 'pad': return padOf(room)
        case 'upgrade': return upgradeSpotOf(room)
        case 'crate': return crateOf(room)
        case 'station': return slotOf(room, slot)
        case 'staff': return staffPadOf(room)
        case 'serve': return LAYOUT.serveSpot
        case 'welcome': return LAYOUT.welcomeSpot
        case 'clerk': return LAYOUT.clerkPad
        case 'hire': return OFFICE.laptopPad
        case 'sell': return OFFICE.laptopPad
        case 'laptop': return OFFICE.laptopPad
      }
    },
    /** Set up a playable academy instantly (for tests): desk, crate, one station, cash. */
    quickStart: () => {
      state.welcome = 0
      state.counter = true
      state.rooms.vault.stations = Math.max(1, state.rooms.vault.stations)
      while (state.rooms.vault.supply.length < state.rooms.vault.stations) state.rooms.vault.supply.push(4)
      state.rooms.vault.crate = true
      game.world.syncCounter(true)
      game.world.syncSecretDoor(true, false)
      game.world.syncRooms(state)
      persist(['core'])
    },
    player: () => ({ x: game.player.x, z: game.player.z }),
    /** QA: n graduates waiting in the agency office. */
    addGraduates: (n: number, room: RoomId = 'vault') => {
      for (let i = 0; i < n; i++) state.pending.push({ agent: createAgent(state, room), fee: 40 + i * 5 })
      game.syncPads()
    },
    /** QA: add one station to a room and play its build animation. */
    fxSlow: (k: number) => (game.world.fxScale = Math.max(1, k)),
    /** QA: open an area (harbor / lighthouse) as if its gate had been paid. */
    openArea: (a: 'harbor' | 'lighthouse') => {
      state.areas[a] = true
      game.world.syncAreas(state)
      game.world.syncRooms(state)
      game.syncPads()
    },
    buildStation: (room: RoomId) => {
      const r = state.rooms[room]
      r.stations++
      r.supply.push(0)
      game.world.playBuild(state, 'station', room)
    },
    /** QA: centre of a room (for screenshots via teleport). */
    roomCenter: (room: RoomId) => ({ x: ROOMS[room].rect.x, z: ROOMS[room].rect.z }),
    /** Screen position (CSS px) of a world spot, e.g. to tap it. */
    screenOf: (kind: 'crate' | 'cash' | 'upgrade', room: RoomId) => {
      const p = kind === 'crate' ? crateOf(room) : kind === 'cash' ? cashSpotOf(room) : upgradeSpotOf(room)
      return game.cam.project(p.x, 0.3, p.z, g.renderer.width, g.renderer.height)
    },
    mgAction: () => game.minigameAction(),
    mgZoneOffset: () => (game.minigame as SafeCracker | null)?.debugZoneOffset() ?? null,
    /** Laser Hall: the planner's suggested next move ('fwd' | 'left' | 'right' | 'back' | 'wait'). */
    mgNext: () => (game.minigame as unknown as { debugNextMove?: () => string } | null)?.debugNextMove?.() ?? null,
    mgMove: (d: 'fwd' | 'back' | 'left' | 'right') => game.minigame?.move?.(d),
    /** Code Breaker: next press of a consistent-guess player (symbol, -1 delete, 'ok') and keypad input. */
    mgSuggest: () => (game.minigame as unknown as { debugSuggest?: () => number | 'ok' | null } | null)?.debugSuggest?.() ?? null,
    /** Spot the Mole: screen position of the mole (or a wrong suspect) and whether all clues are out. */
    mgTarget: (wrong = false) => (game.minigame as unknown as { debugTarget?: (w: boolean) => { x: number; y: number } | null } | null)?.debugTarget?.(wrong) ?? null,
    mgAllClues: () => (game.minigame as unknown as { debugAllClues?: () => boolean } | null)?.debugAllClues?.() ?? null,
    mgHud: () => mgHud.peek(),
    /** QA: next academy frame spawns a Villain Alert. */
    /** QA: drone + VIP recruit on the next academy frame. */
    spawnOffers: () => game.debugOffers(),
    levelCost: (room: RoomId) => levelCost(state, room),
    spawnAlert: () => {
      state.alertIn = 0
    },
    /** End the running minigame with a win / fail (boss flow tests). */
    mgFinish: (success = true) => game.debugFinish(success),
    /** Circuit Hack: screen position of a tile to turn next (planner). */
    mgNextTap: () => (game.minigame as unknown as { debugNextTap?: () => { x: number; y: number } | null } | null)?.debugNextTap?.() ?? null,
    mgInput: (cmd: 'sym' | 'del' | 'ok', arg?: number) => game.minigameInput(cmd, arg),
    /** Laser Hall internals for QA (row/col/mistakes/time and the hazard kind of each row). */
    mgInfo: () => {
      const m = game.minigame as unknown as { row: number; col: number; mistakes: number; time: number; rows: number; hazards: { kind: string; row: number }[] } | null
      return m ? { row: m.row, col: m.col, mistakes: m.mistakes, time: Math.round(m.time), rows: m.rows, hz: m.hazards?.map((h) => `${h.row}:${h.kind}`).join(' ') } : null
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
      cash: Math.floor(state.cash),
      intel: state.intel,
      badges: state.badges,
      level: state.level,
      tutorial: state.tutorial,
      agents: state.agents.length,
      cadets: state.cadets.length,
      carry: { ...state.carry },
      pending: state.pending.length,
      served: state.stats.served,
      purchases: state.stats.purchases,
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
    sceneReport: () => {
      const rows: [string, number][] = []
      game.world.scene.traverse((o) => {
        const m = o as unknown as { isMesh?: boolean; geometry?: { index: { count: number } | null; getAttribute(n: string): { count: number } }; name: string; count?: number; isInstancedMesh?: boolean }
        if (!m.isMesh || !m.geometry) return
        const t = (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3
        rows.push([`${o.type}:${o.name || o.parent?.name || ''}`, Math.round(t * (m.isInstancedMesh ? (m.count ?? 1) : 1))])
      })
      return rows.sort((a, b) => b[1] - a[1]).slice(0, 12)
    },
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
