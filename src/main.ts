/**
 * Bootstrap. Order is mandatory (Bridge required step 2):
 *   Bridge script (first <head> script, sync) -> await bridge.initialize()
 *   -> ONE storage.get with every key -> engine/assets/game logic -> first frame -> game_ready.
 * Nothing here imports Three.js, Preact or game code statically.
 */
import { initBridge, platform, mark } from './platform/bridge'
import { bindPageVisibility } from './core/lifecycle'
import { loadAll } from './core/save'

const fill = document.getElementById('loader-fill')
let shown = 0
export function progress(p: number): void {
  shown = Math.max(shown, Math.min(100, p))
  if (fill) fill.style.width = `${shown}%`
  if (bridgeReady) platform.setLoadingProgress(shown)
}
let bridgeReady = false

// No context menu, text selection or iOS callout on long press (rule 1.4.5).
document.addEventListener('contextmenu', (e) => e.preventDefault())
document.addEventListener('selectstart', (e) => {
  if (!(e.target instanceof HTMLInputElement)) e.preventDefault()
})
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false })

async function boot(): Promise<void> {
  mark('boot_start')
  progress(4)
  await initBridge()
  bridgeReady = true
  progress(12)
  bindPageVisibility()
  await loadAll()
  mark('save_loaded')
  progress(20)
  const game = await import('./game/boot')
  mark('game_chunk')
  progress(60)
  await game.start(progress)
}

boot().catch((err) => {
  console.error('[spy-lab] boot failed', err)
})
