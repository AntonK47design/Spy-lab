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
  resize(w: number, h: number): void
  dispose(): void
  onResult: (r: MinigameResult) => void
}
