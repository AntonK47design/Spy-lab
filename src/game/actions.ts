import type { Game } from './Game'

let current: Game | null = null
export function setGame(g: Game): void {
  current = g
}
/** The running game (UI calls actions on it). */
export function game(): Game {
  if (!current) throw new Error('game not started')
  return current
}
