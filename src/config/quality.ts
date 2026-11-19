export type QualityTier = 'low' | 'mid' | 'high'

export const QUALITY: Record<QualityTier, { pixelRatio: number; antialias: boolean; particles: number }> = {
  low: { pixelRatio: 1, antialias: false, particles: 0.4 },
  mid: { pixelRatio: 1.5, antialias: false, particles: 0.7 },
  high: { pixelRatio: 2, antialias: true, particles: 1 },
}

export const AUTO_QUALITY = {
  /** No automatic downgrade during the first seconds after game_ready. */
  graceMs: 10_000,
  /** Window for averaging fps before deciding. */
  windowMs: 5_000,
  /** Downgrade one tier if the window average is below this. */
  downgradeBelowFps: 45,
  /** Hard cap for devicePixelRatio. */
  maxDpr: 2,
} as const
