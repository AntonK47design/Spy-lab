/**
 * Game clock. Uses Bridge server time where external calls are allowed, else Date.now().
 * Elapsed real time between sessions is clamped: never negative, never above a limit,
 * so turning the device clock back yields nothing.
 */
import { platform } from '../platform/bridge'

let serverOffset = 0 // serverTime - Date.now()
let debugOffset = 0 // timeWarp

export async function syncTime(): Promise<void> {
  const t = await platform.getServerTime()
  if (t != null) serverOffset = t - Date.now()
}

export function now(): number {
  return Date.now() + serverOffset + debugOffset
}

export function timeWarp(minutes: number): void {
  debugOffset += minutes * 60_000
}

/** Seconds elapsed since `since` (ms), clamped to [0, maxSeconds]. */
export function elapsedSince(since: number, maxSeconds: number): number {
  if (!since || !Number.isFinite(since)) return 0
  const s = (now() - since) / 1000
  if (!(s > 0)) return 0
  return Math.min(s, maxSeconds)
}
