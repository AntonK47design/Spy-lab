/**
 * Chunky low-poly character (big head, small body) built from primitives.
 * PLACEHOLDER until rigged models arrive in assets-src/models/characters.
 * 3 meshes (body+head, two legs) + blob shadow, all sharing flatMat.
 */
import { CircleGeometry, Group, Mesh, type BufferGeometry } from 'three'
import { StaticBatch } from '../render/geometry'
import { flatMat, shadowMat } from '../render/materials'

export interface Look {
  outfit: number
  skin: number
  hair: number
  /** 'glasses' = sunglasses, 'cap' = cadet cap, 'hat' = director fedora */
  head: 'glasses' | 'cap' | 'hat'
  scale?: number
}

const cache = new Map<string, { body: BufferGeometry; leg: BufferGeometry }>()
let shadowGeo: CircleGeometry | null = null

function geos(look: Look) {
  const key = `${look.outfit}-${look.skin}-${look.hair}-${look.head}`
  let g = cache.get(key)
  if (g) return g
  const b = new StaticBatch()
  // torso + arms
  b.cyl(0.24, 0.3, 0.5, 0, 0.62, 0, look.outfit, 8)
  b.box(0.12, 0.38, 0.14, -0.33, 0.62, 0, look.outfit)
  b.box(0.12, 0.38, 0.14, 0.33, 0.62, 0, look.outfit)
  b.sphere(0.07, -0.33, 0.4, 0, look.skin, 6, 4)
  b.sphere(0.07, 0.33, 0.4, 0, look.skin, 6, 4)
  // big head
  b.sphere(0.34, 0, 1.18, 0, look.skin, 10, 8)
  b.sphere(0.35, 0, 1.3, -0.04, look.hair, 10, 6, 0.75)
  b.sphere(0.05, -0.12, 1.2, 0.31, 0x2b2220, 5, 4)
  b.sphere(0.05, 0.12, 1.2, 0.31, 0x2b2220, 5, 4)
  if (look.head === 'glasses') {
    b.box(0.5, 0.11, 0.06, 0, 1.22, 0.32, 0x14141c)
  } else if (look.head === 'cap') {
    b.cyl(0.33, 0.35, 0.16, 0, 1.46, 0, look.outfit, 10)
    b.box(0.34, 0.04, 0.24, 0, 1.4, 0.32, look.outfit)
  } else {
    b.cyl(0.26, 0.3, 0.28, 0, 1.6, 0, 0x22283a, 10)
    b.cyl(0.5, 0.5, 0.04, 0, 1.47, 0, 0x22283a, 12)
    b.cyl(0.305, 0.305, 0.07, 0, 1.52, 0, 0xf2665c, 10)
    b.box(0.5, 0.1, 0.06, 0, 1.22, 0.32, 0x14141c)
  }
  const body = b.build()
  const l = new StaticBatch()
  l.box(0.16, 0.34, 0.18, 0, -0.17, 0, 0x22283a)
  l.box(0.18, 0.08, 0.26, 0, -0.34, 0.04, 0x1a1a22)
  const leg = l.build()
  g = { body, leg }
  cache.set(key, g)
  return g
}

export class Character {
  readonly root = new Group()
  private body: Mesh
  private legL: Mesh
  private legR: Mesh
  private phase = Math.random() * 6
  private moveBlend = 0
  /** 0..1 how much the character is walking this frame. */
  walking = 0
  /** Optional idle "training" motion. */
  activity: 'idle' | 'train' | 'cheer' = 'idle'

  constructor(look: Look) {
    const g = geos(look)
    this.body = new Mesh(g.body, flatMat)
    this.legL = new Mesh(g.leg, flatMat)
    this.legR = new Mesh(g.leg, flatMat)
    this.legL.position.set(-0.12, 0.38, 0)
    this.legR.position.set(0.12, 0.38, 0)
    shadowGeo ??= new CircleGeometry(0.42, 14).rotateX(-Math.PI / 2)
    const shadow = new Mesh(shadowGeo, shadowMat)
    shadow.position.y = 0.02
    shadow.renderOrder = -1
    this.root.add(shadow, this.body, this.legL, this.legR)
    this.root.scale.setScalar(look.scale ?? 1)
  }

  update(dt: number): void {
    this.moveBlend += (this.walking - this.moveBlend) * Math.min(1, dt * 12)
    const w = this.moveBlend
    this.phase += dt * (4 + 8 * w)
    const swing = Math.sin(this.phase) * 0.7 * w
    this.legL.rotation.x = swing
    this.legR.rotation.x = -swing
    let bob = Math.abs(Math.sin(this.phase)) * 0.06 * w
    let tilt = 0
    if (w < 0.2) {
      if (this.activity === 'train') {
        bob += Math.max(0, Math.sin(this.phase * 0.9)) * 0.14
        tilt = Math.sin(this.phase * 0.45) * 0.15
      } else if (this.activity === 'cheer') {
        bob += Math.abs(Math.sin(this.phase * 1.6)) * 0.3
      } else {
        bob += Math.sin(this.phase * 0.5) * 0.015
      }
    }
    this.body.position.y = bob
    this.body.rotation.z = tilt
  }

  /** Face the movement direction smoothly. */
  face(dx: number, dz: number, dt: number): void {
    if (Math.abs(dx) + Math.abs(dz) < 1e-4) return
    const target = Math.atan2(dx, dz)
    let d = target - this.root.rotation.y
    d = Math.atan2(Math.sin(d), Math.cos(d))
    this.root.rotation.y += d * Math.min(1, dt * 14)
  }
}
