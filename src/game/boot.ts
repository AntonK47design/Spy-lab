/**
 * Loaded only AFTER bridge.initialize() and the save read (dynamic import from main.ts).
 * Restores state, builds UI + renderer + world, renders the first frame, removes the
 * loader and only then sends game_ready.
 */
import '../ui/theme.css'
import { render, h } from 'preact'
import { App } from '../ui/App'
import { BUILD_VERSION, device, mark, platform } from '../platform/bridge'
import { loadSettings, languageChoice } from '../core/settings'
import { loadState, persist } from './store'
import { resolveLang, setLanguage } from '../i18n/i18n'
import { syncTime } from '../core/time'
import { AudioManager } from '../audio/AudioManager'
import { createRenderer } from '../render/renderer'
import { addFrame, setFrameObserver, startLoop } from '../core/loop'
import { initPerf, recentFps, recordFrame } from '../analytics/perf'
import { sendPerformanceSample } from '../analytics/telemetry'
import { AUTO_QUALITY, type QualityTier } from '../config/quality'
import { DEBUG } from '../debug/flags'
import { Game } from './Game'
import { World } from '../academy/World'
import { preload, coreFiles, lazyFiles, characterProto } from '../render/assets'
import { setGame } from './actions'

export async function start(progress: (p: number) => void): Promise<void> {
  // 1. Restore state before any gameplay is visible.
  loadSettings()
  loadState()

  // 2. Language: player's explicit choice, else bridge.platform.language, else English.
  await setLanguage(languageChoice.value ?? resolveLang(platform.language))
  // UI fonts (bundled OFL WOFF2); never block the first frame for more than a moment
  await Promise.race([loadFonts(), new Promise((r) => setTimeout(r, 900))])
  progress(66)

  applySafeArea()
  // Server time in the background, then offline earnings use it.
  const timeSync = Promise.race([syncTime(), new Promise((r) => setTimeout(r, 1200))])

  // 3. Core audio (real files only) + core models, with real progress.
  AudioManager.init()
  const core = AudioManager.coreIds()
  let done = 0
  const audio = Promise.all(
    core.map((id) =>
      AudioManager.load(id).then(() => {
        done++
        progress(66 + (done / core.length) * 6)
      }),
    ),
  )
  await preload(coreFiles(), (p) => progress(72 + p * 18))
  await audio
  const world = new World()
  await world.init()
  await Promise.all([characterProto('director')])
  await timeSync

  // 4. Renderer + world + UI.
  const host = document.getElementById('app') as HTMLElement
  const uiLayer = document.getElementById('ui') as HTMLElement
  let game: Game | null = null
  const renderer = createRenderer(host, (w, hh) => game?.resize(w, hh))
  host.insertBefore(renderer.canvas, host.firstChild)
  game = new Game(world, renderer.renderer, renderer.canvas, uiLayer)
  setGame(game)
  // QA: ?debug=1&quality=low|mid|high forces a tier
  const forced = DEBUG ? new URLSearchParams(location.search).get('quality') : null
  if (forced === 'low' || forced === 'mid' || forced === 'high') renderer.setTier(forced)
  game.applyQuality(renderer.tier)
  game.resize(renderer.width, renderer.height)
  progress(92)

  const appRoot = document.createElement('div')
  appRoot.className = 'app-root'
  uiLayer.appendChild(appRoot)
  render(h(App, {}), appRoot)

  addFrame((dt) => game!.frame(dt))

  // Perf + automatic quality (never in the first AUTO_QUALITY.graceMs).
  initPerf(BUILD_VERSION, sendPerformanceSample)
  let readyAt = 0
  let lowSince = 0
  setFrameObserver((ms) => {
    recordFrame(ms)
    if (!readyAt) return
    const t = performance.now()
    if (t - readyAt < AUTO_QUALITY.graceMs) return
    if (recentFps(AUTO_QUALITY.windowMs) < AUTO_QUALITY.downgradeBelowFps) {
      if (!lowSince) lowSince = t
      if (t - lowSince > AUTO_QUALITY.windowMs) {
        const next: Record<QualityTier, QualityTier> = { high: 'mid', mid: 'low', low: 'low' }
        renderer.setTier(next[renderer.tier])
        game?.applyQuality(renderer.tier)
        lowSince = 0
      }
    } else lowSince = 0
  })

  // 5. First playable frame, then remove the loader, then game_ready.
  game.frame(0)
  mark('first_frame')
  progress(100)
  document.getElementById('loader')?.remove()
  startLoop()
  game.start()
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      platform.sendMessage('game_ready')
      readyAt = performance.now()
      AudioManager.playMusic('music_academy')
      for (const id of AudioManager.lazyIds()) void AudioManager.load(id)
      platform.sendMessage('in_game_loading_started')
      void preload(lazyFiles()).finally(() => platform.sendMessage('in_game_loading_stopped'))
      persist(['core', 'meta'])
    }),
  )

  if (DEBUG) {
    const { installDebugHooks } = await import('../debug/hooks')
    installDebugHooks({ renderer, game })
  }
}

async function loadFonts(): Promise<void> {
  if (typeof FontFace === 'undefined') return
  const faces = [
    new FontFace('Fredoka', 'url(assets/fonts/fredoka-600.woff2)', { weight: '600', display: 'swap' }),
    new FontFace('Nunito', 'url(assets/fonts/nunito-800.woff2)', { weight: '800', display: 'swap' }),
  ]
  await Promise.all(
    faces.map((f) =>
      f.load().then(
        (ok) => document.fonts.add(ok),
        () => undefined,
      ),
    ),
  )
}

function applySafeArea(): void {
  const sa = device.safeArea
  const root = document.documentElement.style
  root.setProperty('--bridge-sa-top', `${sa.top}px`)
  root.setProperty('--bridge-sa-bottom', `${sa.bottom}px`)
  root.setProperty('--bridge-sa-left', `${sa.left}px`)
  root.setProperty('--bridge-sa-right', `${sa.right}px`)
}
