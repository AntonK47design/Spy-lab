import { BoxGeometry, Group, Mesh, MeshLambertMaterial } from 'three'
import { Character } from './Character'
import { ECONOMY } from '../config/economy'
import { LAYOUT } from '../config/rooms'
import type { AABB } from './World'

const R = 0.36

/** The director: walks with the joystick / keys, collides with walls and furniture. */
export class Player {
  readonly char = new Character({ model: 'director', scale: 1.05 })
  x: number = LAYOUT.playerSpawn.x
  z: number = LAYOUT.playerSpawn.z
  speed: number = ECONOMY.player.speed
  /** Seconds the player has been standing still. */
  still = 0
  /** Visible stack of carried training kits. */
  private stack = new Group()
  private kitMat = new MeshLambertMaterial({ color: 0xf2b134 })
  private kitGeo = new BoxGeometry(0.34, 0.16, 0.26)

  constructor() {
    this.char.root.position.set(this.x, 0, this.z)
    this.char.root.rotation.y = Math.PI * 0.85
    this.char.runner = true
    for (let i = 0; i < 5; i++) {
      const m = new Mesh(this.kitGeo, this.kitMat)
      m.position.set(0, i * 0.17, 0)
      m.rotation.y = (i % 2) * 0.25
      m.castShadow = true
      m.visible = false
      this.stack.add(m)
    }
    this.stack.position.set(0, 0.62, 0.42)
    this.char.root.add(this.stack)
  }

  update(dt: number, mx: number, mz: number, colliders: AABB[]): void {
    this.depenetrate(colliders)
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

  /** Something was built on top of the player: step out along the shortest axis. */
  depenetrate(colliders: AABB[]): void {
    for (let pass = 0; pass < 3 && hits(this.x, this.z, colliders); pass++) {
      for (const c of colliders) {
        if (this.x <= c.minX - R || this.x >= c.maxX + R || this.z <= c.minZ - R || this.z >= c.maxZ + R) continue
        const opts = [
          { d: this.x - (c.minX - R), x: c.minX - R - 0.01, z: this.z },
          { d: c.maxX + R - this.x, x: c.maxX + R + 0.01, z: this.z },
          { d: this.z - (c.minZ - R), x: this.x, z: c.minZ - R - 0.01 },
          { d: c.maxZ + R - this.z, x: this.x, z: c.maxZ + R + 0.01 },
        ].sort((a, b) => a.d - b.d)
        const free = opts.find((o) => !hits(o.x, o.z, colliders)) ?? opts[0]!
        this.x = free.x
        this.z = free.z
      }
    }
  }

  setCarry(n: number, color: number): void {
    this.char.carrying = n > 0
    this.stack.children.forEach((m, i) => (m.visible = i < n))
    this.kitMat.color.setHex(color)
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
