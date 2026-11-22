/**
 * Frame statistics during active, visible gameplay (boot only records frames while
 * lifecycle.isGameplayActive: no loading, platform/ad pause, pause menu or hidden tab).
 * Feeds: debug stats(), automatic quality downgrade and the performance_sample adapter
 * (Playgama telemetry contract: one aggregated sample per ~30 s of active play; counts are
 * per window; no messages, URLs or stack traces).
 */
import { effect } from '@preact/signals-core'
import { contextLost } from '../core/lifecycle'

const RING = 600
const frames = new Float32Array(RING)
let head = 0
let filled = 0

/** Bounded context of the running game, read once per frame / per sample. */
export interface PerfContext {
  /** 'academy' | minigame id | 'boss' (bounded vocabulary). */
  scene(): string
  quality(): string
  /** Draw calls of the last rendered frame. */
  drawCalls(): number
  /** Lifetime counters; the sample sends the delta of the window. */
  assetErrors(): number
  deviceType(): string
}

const WINDOW_TARGET_MS = 30_000
/** A shorter final sample (tab hidden / page left) only with at least this much active play. */
const PARTIAL_MIN_MS = 5_000

let win: number[] = []
let winStart = 0
let winActive = 0
let sceneMs: Record<string, number> = {}
let drawSum = 0
let onSample: ((s: Record<string, number | string | boolean>) => void) | null = null
let ctx: PerfContext | null = null
let buildVersion = ''
let longTasks = { count: 0, total: 0, max: 0 }
let errors = { js: 0, rejections: 0, contextLoss: 0 }
let assetErrorsAtStart = 0

export function initPerf(version: string, sink: (s: Record<string, number | string | boolean>) => void, context: PerfContext): void {
  buildVersion = version
  onSample = sink
  ctx = context
  assetErrorsAtStart = context.assetErrors()
  try {
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        longTasks.count++
        longTasks.total += e.duration
        longTasks.max = Math.max(longTasks.max, e.duration)
      }
    })
    po.observe({ type: 'longtask', buffered: false })
  } catch {
    /* unsupported */
  }
  window.addEventListener('error', () => errors.js++)
  window.addEventListener('unhandledrejection', () => errors.rejections++)
  let wasLost = contextLost.peek()
  effect(() => {
    const lost = contextLost.value
    if (lost && !wasLost) errors.contextLoss++
    wasLost = lost
  })
}

export function recordFrame(ms: number): void {
  frames[head] = ms
  head = (head + 1) % RING
  if (filled < RING) filled++
  const now = performance.now()
  if (!winStart) winStart = now
  win.push(ms)
  winActive += ms
  if (ctx) {
    const sc = ctx.scene()
    sceneMs[sc] = (sceneMs[sc] ?? 0) + ms
    drawSum += ctx.drawCalls()
  }
  if (winActive >= WINDOW_TARGET_MS) flushSample(now)
}

/** Tab hidden / page left / platform pause: send what was measured, if it is enough. */
export function flushPerf(): void {
  if (winActive >= PARTIAL_MIN_MS) flushSample(performance.now())
}

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))))
  return sorted[i] as number
}

function memory(): { mb: number } | null {
  const m = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory
  return m && typeof m.usedJSHeapSize === 'number' ? { mb: Math.round(m.usedJSHeapSize / 1048576) } : null
}

function flushSample(now: number): void {
  const ft = win.slice().sort((a, b) => a - b)
  const fps = win.map((m) => 1000 / Math.max(1, m)).sort((a, b) => a - b)
  const over = (t: number) => win.filter((m) => m > t).length
  let scene = 'academy'
  let best = -1
  for (const [k, v] of Object.entries(sceneMs)) if (v > best) [scene, best] = [k, v]
  const mem = memory()
  const assetNow = ctx?.assetErrors() ?? 0
  const sample: Record<string, number | string | boolean> = {
    target_fps: 60,
    window_ms: Math.round(now - winStart),
    active_ms: Math.round(winActive),
    frame_count: win.length,
    fps_avg: round1((win.length * 1000) / Math.max(1, winActive)),
    fps_p10: round1(pct(fps, 10)),
    frame_time_p50_ms: round1(pct(ft, 50)),
    frame_time_p95_ms: round1(pct(ft, 95)),
    frame_time_p99_ms: round1(pct(ft, 99)),
    frame_time_max_ms: round1(ft[ft.length - 1] ?? 0),
    frames_over_50ms: over(50),
    frames_over_100ms: over(100),
    frames_over_250ms: over(250),
    frames_over_500ms: over(500),
    frames_over_1000ms: over(1000),
    build_version: buildVersion,
    long_task_count: longTasks.count,
    long_task_total_ms: Math.round(longTasks.total),
    long_task_max_ms: Math.round(longTasks.max),
    js_error_count: errors.js,
    unhandled_rejection_count: errors.rejections,
    webgl_context_loss_count: errors.contextLoss,
    asset_load_error_count: Math.max(0, assetNow - assetErrorsAtStart),
    memory_measurement_supported: !!mem,
    // game-specific, bounded dimensions
    scene,
    quality_tier: ctx?.quality() ?? 'unknown',
    device_type: ctx?.deviceType() ?? 'unknown',
    draw_calls_avg: win.length ? Math.round(drawSum / win.length) : 0,
  }
  if (mem) {
    sample.memory_used_mb = mem.mb
    sample.memory_measurement_type = 'js_heap_used'
  }
  win = []
  winStart = now
  winActive = 0
  sceneMs = {}
  drawSum = 0
  longTasks = { count: 0, total: 0, max: 0 }
  errors = { js: 0, rejections: 0, contextLoss: 0 }
  assetErrorsAtStart = assetNow
  onSample?.(sample)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Average fps over the last `ms` of recorded frames. */
export function recentFps(ms = 1000): number {
  let sum = 0
  let n = 0
  for (let i = 1; i <= filled && sum < ms; i++) {
    sum += frames[(head - i + RING) % RING] as number
    n++
  }
  return n ? Math.round((n * 1000) / Math.max(1, sum)) : 0
}
