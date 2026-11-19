/**
 * Frame statistics during active, visible gameplay (the loop only runs then).
 * Feeds: debug stats(), automatic quality downgrade and the performance_sample adapter.
 */
const RING = 600
const frames = new Float32Array(RING)
let head = 0
let filled = 0

// performance_sample window
const WINDOW_TARGET_MS = 30_000
let win: number[] = []
let winStart = 0
let winActive = 0
let onSample: ((s: Record<string, number | string>) => void) | null = null
let buildVersion = ''
let longTasks = { count: 0, total: 0, max: 0 }

export function initPerf(version: string, sink: (s: Record<string, number | string>) => void): void {
  buildVersion = version
  onSample = sink
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
}

export function recordFrame(ms: number): void {
  frames[head] = ms
  head = (head + 1) % RING
  if (filled < RING) filled++
  const now = performance.now()
  if (!winStart) winStart = now
  win.push(ms)
  winActive += ms
  if (winActive >= WINDOW_TARGET_MS) flushSample(now)
}

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))))
  return sorted[i] as number
}

function flushSample(now: number): void {
  const ft = win.slice().sort((a, b) => a - b)
  const fps = win.map((m) => 1000 / Math.max(1, m)).sort((a, b) => a - b)
  const over = (t: number) => win.filter((m) => m > t).length
  const sample: Record<string, number | string> = {
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
  }
  win = []
  winStart = now
  winActive = 0
  longTasks = { count: 0, total: 0, max: 0 }
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
