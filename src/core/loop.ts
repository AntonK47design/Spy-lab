/**
 * requestAnimationFrame loop with delta time. Runs only while lifecycle.isRunning;
 * when the platform pauses or the tab hides, no frames are requested at all.
 */
import { effect } from '@preact/signals-core'
import { isRunning } from './lifecycle'

export type FrameFn = (dt: number, now: number) => void

const MIN_FRAME_MS = 1000 / 60 - 2
const MAX_DT = 1 / 15 // clamp long frames so the simulation never jumps
const fns: FrameFn[] = []
let raf = 0
let last = 0
let frameObserver: ((frameMs: number) => void) | null = null

export function addFrame(fn: FrameFn): void {
  fns.push(fn)
}

export function setFrameObserver(fn: (frameMs: number) => void): void {
  frameObserver = fn
}

function tick(t: number): void {
  raf = requestAnimationFrame(tick)
  // Cap at 60 fps on high-refresh displays.
  if (last && t - last < MIN_FRAME_MS) return
  const frameMs = last ? t - last : 16.7
  last = t
  const dt = Math.min(frameMs / 1000, MAX_DT)
  frameObserver?.(frameMs)
  for (let i = 0; i < fns.length; i++) (fns[i] as FrameFn)(dt, t)
}

export function startLoop(): void {
  effect(() => {
    if (isRunning.value) {
      if (!raf) {
        last = 0
        raf = requestAnimationFrame(tick)
      }
    } else if (raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  })
}
