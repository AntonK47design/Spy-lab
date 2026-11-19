import { Character } from './Character'
import { ECONOMY } from '../config/economy'
import { LAYOUT } from '../config/rooms'
import type { AABB } from './World'

const R = 0.36

/** The director: walks with the joystick / keys, collides with walls and furniture. */
export class Player {
  readonly char = new Character({ model: 'director', tint: { Suit: 0x1e2a48, Tie: 0xf2665c }, scale: 1.05 })
  x: number = LAYOUT.playerSpawn.x
  z: number = LAYOUT.playerSpawn.z
  speed: number = ECONOMY.player.speed
  /** Seconds the player has been standing still. */
  still = 0

  constructor() {
    this.char.root.position.set(this.x, 0, this.z)
    this.char.root.rotation.y = Math.PI * 0.85
    this.char.runner = true
  }

  update(dt: number, mx: number, mz: number, colliders: AABB[]): void {
    const moving = mx !== 0 || mz !== 0
    if (moving) {
      const nx = this.x + mx * this.speed * dt
      const nz = this.z + mz * this.speed * dt
      if (!hits(nx, this.z, colliders)) this.x = nx
      if (!hits(this.x, nz, colliders)) this.z = nz
      this.char.face(mx, mz, dt)
      this.still = 0
    } else this.still += dt
    this.char.walking = moving ? Math.min(1, Math.hypot(mx, mz) * 1.2) : 0
    this.char.root.position.set(this.x, 0, this.z)
    this.char.update(dt)
  }

  near(x: number, z: number, r: number): boolean {
    return (this.x - x) ** 2 + (this.z - z) ** 2 <= r * r
  }
}

function hits(x: number, z: number, cs: AABB[]): boolean {
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i] as AABB
    const px = Math.max(c.minX, Math.min(x, c.maxX))
    const pz = Math.max(c.minZ, Math.min(z, c.maxZ))
    if ((x - px) ** 2 + (z - pz) ** 2 < R * R) return true
  }
  return false
}
