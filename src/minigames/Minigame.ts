import { signal } from '@preact/signals-core'
import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import type { MinigameId } from '../config/rooms'

export interface MinigameResult {
  success: boolean
  stars: number
  timeLeft: number
  mistakes: number
  intel: number
  reason?: 'alarm' | 'time'
}

export interface GameContext {
  renderer: WebGLRenderer
  width: number
  height: number
  /** First time this minigame is played: show the ghost-hand tutorial. */
  firstTime: boolean
}

export interface MissionModifiers {
  /** The chosen agent's value in the minigame's skill. */
  agentSkill: number
  gadget?: string
}

/** Shared HUD read by the Preact minigame overlay. */
export interface MinigameHud {
  done: number
  total: number
  mistakes: number
  maxMistakes: number
  timeLeft: number
  timeLimit: number
  /** Ghost hand (tutorial): screen position in CSS px, or null. */
  ghost: { x: number; y: number; pulse: boolean } | null
  /** Short feedback flash: 'hit' | 'miss' | null */
  flash: 'hit' | 'miss' | null
  /** What the progress icons stand for (safe: bolts, laser: intel chips). */
  icon?: 'bolt' | 'chip'
  /** Code Breaker keypad state (shown as on-screen keypad when present). */
  keypad?: {
    symbols: number
    /** Current input row: symbol index or -1 per slot; locked = revealed by a hint. */
    input: number[]
    locked: boolean[]
    canSubmit: boolean
    /** Hints left for free in this attempt (else via rewarded ad). */
    freeHints: number
    attemptsLeft: number
    /** Tutorial: key to press next (symbol index, -1 = delete, -2 = confirm). */
    suggest?: number
  }
  /** Spot the Mole clue chips. */
  clues?: MoleClue[]
  /** Generic hint button (free hints left, else via rewarded ad). */
  hint?: { free: number }
  /** No big tap button: the player taps the play field. */
  noTap?: boolean
  /** Scooter Pursuit: catch-up bar 0..1, left/right lane buttons, intel chips picked up. */
  chase?: number
  lanes?: boolean
  chips?: number
}

/** Spot the Mole: one clue chip (hidden until revealed). */
export interface MoleClue {
  /** i18n key, e.g. mole.hat.red */
  key: string
  /** Colour swatch (hat / coat colour) or null. */
  color: number | null
  icon: 'hat' | 'glasses' | 'bag' | 'shirt'
  shown: boolean
  /** 0..1 fill of the clue that comes next. */
  progress: number
}

export const mgHud = signal<MinigameHud | null>(null)

export interface Minigame {
  id: MinigameId
  scene: Scene
  camera: PerspectiveCamera
  init(ctx: GameContext, tier: number, mods: MissionModifiers): Promise<void>
  start(): void
  /** dt in seconds, frame-rate independent. */
  update(dt: number): void
  pause(): void
  resume(): void
  /** Called after a rewarded "Continue" (max once per attempt — enforced by MissionFlow). */
  revive(): void
  useHint(): void
  /** Primary action (tap / click / Space). */
  action(): void
  /** Directional input (keys / swipe), for minigames that move a figure. */
  move?(dir: 'fwd' | 'back' | 'left' | 'right'): void
  /** Tap / click on the play field at screen coordinates (CSS px). */
  pointer?(x: number, y: number): void
  /** Keypad input (Code Breaker): a symbol, delete, or submit. */
  input?(cmd: 'sym' | 'del' | 'ok', arg?: number): void
  /** Free hints left (Code Breaker); the game shows an ad for more. */
  freeHints?(): number
  resize(w: number, h: number): void
  dispose(): void
  onResult: (r: MinigameResult) => void
}
