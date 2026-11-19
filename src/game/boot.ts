/**
 * Loaded only AFTER bridge.initialize() and the save read (dynamic import from main.ts).
 * Builds UI + renderer + scene, renders the first frame, removes the loader and
 * only then sends game_ready.
 */
import '../ui/theme.css'
import { render, h } from 'preact'
import { App, orderHint } from '../ui/App'
import { BUILD_VERSION, device, mark, platform } from '../platform/bridge'
import { loadSettings, languageChoice } from '../core/settings'
import { loadCore, addCurrency, cash } from '../core/store'
import { resolveLang, setLanguage } from '../i18n/i18n'
import { syncTime } from '../core/time'
import { AudioManager } from '../audio/AudioManager'
import { createRenderer } from '../render/renderer'
import { CameraRig } from '../render/cameraRig'
import { PlaceholderAcademy } from '../academy/PlaceholderAcademy'
import { addFrame, setFrameObserver, startLoop } from '../core/loop'
import { initPerf, recentFps, recordFrame } from '../analytics/perf'
import { sendPerformanceSample } from '../analytics/telemetry'
import { AUTO_QUALITY, type QualityTier } from '../config/quality'
import { DEBUG } from '../debug/flags'

export interface GameHandles {
  renderer: ReturnType<typeof createRenderer>
  rig: CameraRig
  academy: PlaceholderAcademy
}

export async function start(progress: (p: number) => void): Promise<void> {
  // 1. Restore state before any gameplay is visible.
  loadSettings()
  loadCore()

  // 2. Language: player's explicit choice, else bridge.platform.language, else English.
  await setLanguage(languageChoice.value ?? resolveLang(platform.language))
  progress(66)

  // 3. Safe area (Bridge) -> CSS variables (combined with env() in theme.css).
  applySafeArea()

  // 4. Server time in the background (never blocks the first frame).
  void syncTime()

  // 5. Core audio (real files only), with real progress.
  AudioManager.init()
  const core = AudioManager.coreIds()
  let done = 0
  await Promise.all(
    core.map((id) =>
      AudioManager.load(id).then(() => {
        done++
        progress(66 + (done / core.length) * 20)
      }),
    ),
  )

  // 6. Renderer + scene + UI.
  const host = document.getElementById('app') as HTMLElement
  const academy = new PlaceholderAcademy()
  let rig: CameraRig | null = null
  const renderer = createRenderer(host, (w, hh) => rig?.resize(w, hh))
  host.insertBefore(renderer.canvas, host.firstChild)
  rig = new CameraRig(renderer.canvas, academy.bounds)
  rig.resize(renderer.width, renderer.height)
  rig.tapTargets = [academy.cashStack]
  rig.onTap = (hits) => {
    if (hits.includes(academy.cashStack)) {
      addCurrency('cash', 1)
      academy.bump()
      AudioManager.play('coin', 0.95 + Math.random() * 0.1)
      if (cash.value >= 5) orderHint.value = 'common.soon'
    }
  }
  progress(92)

  render(h(App, {}), document.getElementById('ui') as HTMLElement)

  addFrame((dt) => {
    rig!.update(dt)
    academy.update(dt)
    renderer.renderer.render(academy.scene, rig!.camera)
  })

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
        lowSince = 0
      }
    } else lowSince = 0
  })

  // 7. First playable frame, then remove the loader, then game_ready.
  renderer.renderer.render(academy.scene, rig.camera)
  mark('first_frame')
  progress(100)
  const loader = document.getElementById('loader')
  loader?.remove()
  startLoop()
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      platform.sendMessage('game_ready')
      readyAt = performance.now()
      // Everything else streams in after game_ready.
      AudioManager.playMusic('music_academy')
      for (const id of AudioManager.lazyIds()) void AudioManager.load(id)
    }),
  )

  if (DEBUG) {
    const { installDebugHooks } = await import('../debug/hooks')
    installDebugHooks({ renderer, rig, academy })
  }
}

function applySafeArea(): void {
  const sa = device.safeArea
  const root = document.documentElement.style
  root.setProperty('--bridge-sa-top', `${sa.top}px`)
  root.setProperty('--bridge-sa-bottom', `${sa.bottom}px`)
  root.setProperty('--bridge-sa-left', `${sa.left}px`)
  root.setProperty('--bridge-sa-right', `${sa.right}px`)
}
