/**
 * The academy as ONE walkable area (isometric view): bakery at the street, secret corridor
 * behind it, rooms left/right that grow via unlock pads. Placeholder primitives, vertex
 * colors, one shared material; static parts are merged per room (few draw calls).
 */
import { Color, Group, Mesh, Scene, HemisphereLight, DirectionalLight, Fog } from 'three'
import { StaticBatch } from '../render/geometry'
import { flatMat } from '../render/materials'
import {
  CORRIDOR, LAYOUT, ROOMS, ROOM_ORDER, TEASER_ROW_Z, slotOf, upgradeSpotOf, cashSpotOf,
  type RoomId,
} from '../config/rooms'
import type { GameState } from '../sim/state'

export interface AABB {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  id?: string
}

const C = {
  tileA: 0xf3e3c3,
  tileB: 0xe9d3a8,
  wall: 0x1f5f6b,
  wallCap: 0x2f8a99,
  wallLow: 0x2a7a87,
  bakeryWall: 0xf7c6d0,
  bakeryCap: 0xf2665c,
  bakeryTileA: 0xfff3e0,
  bakeryTileB: 0xf7d7de,
  street: 0x4a4e5a,
  sidewalk: 0xb8bcc6,
  grass: 0x6fbf5f,
  locked: 0x8a8f9c,
  lockedB: 0x7d828f,
  tape: 0xf2b134,
  dark: 0x22283a,
  steel: 0x9aa3b5,
  wood: 0xc98b5a,
}

export class World {
  readonly scene = new Scene()
  readonly colliders: AABB[] = []
  private roomMeshes = new Map<RoomId, Mesh>()
  readonly dynamic = new Group()

  constructor() {
    const s = this.scene
    s.background = new Color(0x14213d)
    s.fog = new Fog(0x14213d, 45, 80)
    s.add(new HemisphereLight(0xfff6e8, 0x5a4a6a, 1.9))
    const sun = new DirectionalLight(0xffffff, 1.5)
    sun.position.set(-6, 14, 9)
    s.add(sun)
    s.add(this.dynamic)
    s.add(new Mesh(this.buildBase(), flatMat))
  }

  // ---------- static base: street, bakery, corridor, teaser ----------
  private buildBase() {
    const b = new StaticBatch()
    const { bakery: bk, street, wall: wt, wallH } = LAYOUT
    // outside: road, sidewalk, grass verge, facades
    b.box(80, 0.1, 10, 0, -0.06, street.z + 5, C.street)
    for (let x = -36; x <= 36; x += 4) b.box(1.6, 0.02, 0.25, x, 0.0, street.z + 5, 0xf3e3c3)
    b.box(80, 0.12, 2.2, 0, 0.0, bk.z + bk.d / 2 + 1.1, C.sidewalk)
    // dark earth under the secret part
    b.box(80, 0.1, 60, 0, -0.08, -18, 0x1b2b4f)

    // bakery floor checker
    const x0 = bk.x - bk.w / 2
    const z0 = bk.z - bk.d / 2
    for (let ix = 0; ix < bk.w; ix++)
      for (let iz = 0; iz < bk.d; iz++)
        b.box(1, 0.1, 1, x0 + ix + 0.5, 0, z0 + iz + 0.5, (ix + iz) % 2 ? C.bakeryTileA : C.bakeryTileB)
    // bakery walls (front low with door gap, back tall with back-door gap)
    const back = bk.z - bk.d / 2
    const front = bk.z + bk.d / 2
    this.wallX(b, x0, -LAYOUT.corridorWidth / 2, back, wallH + 0.6, C.bakeryWall, C.bakeryCap)
    this.wallX(b, LAYOUT.corridorWidth / 2, x0 + bk.w, back, wallH + 0.6, C.bakeryWall, C.bakeryCap)
    this.wallZ(b, x0, back, front, wallH, C.bakeryWall, C.bakeryCap)
    this.wallZ(b, x0 + bk.w, back, front, wallH, C.bakeryWall, C.bakeryCap)
    this.wallX(b, x0, -1.3, front, 0.45, C.bakeryWall, C.bakeryCap)
    this.wallX(b, 1.3, x0 + bk.w, front, 0.45, C.bakeryWall, C.bakeryCap)
    // the street door is closed for the player (cadets walk in from the street)
    this.colliders.push({ minX: -1.3, maxX: 1.3, minZ: front - wt, maxZ: front + 1, id: 'street_door' })
    // awning over the front
    for (let i = 0; i < 10; i++) b.box(bk.w / 10, 0.14, 1.1, x0 + (i + 0.5) * (bk.w / 10), 2.2, front + 0.6, i % 2 ? 0xfff3e0 : 0xf2665c)
    // bakery props: counter, display, oven (the secret entrance), tables
    b.box(6, 0.95, 1, -4.5, 0.48, bk.z - 0.4, C.wood)
    b.box(6, 0.1, 1.1, -4.5, 0.98, bk.z - 0.4, 0xfff3e0)
    for (let i = 0; i < 5; i++) b.sphere(0.2, -6.8 + i * 1.1, 1.18, bk.z - 0.4, i % 2 ? 0xf2b134 : 0xc98b5a, 8, 6, 0.6)
    this.colliders.push({ minX: -7.5, maxX: -1.5, minZ: bk.z - 0.9, maxZ: bk.z + 0.1 })
    b.box(1.6, 1.8, 1.2, 3.2, 0.9, back + 0.7, C.steel)
    b.box(1.1, 0.7, 0.05, 3.2, 1.0, back + 1.31, 0x2b2b2b)
    b.box(0.9, 0.4, 0.02, 3.2, 1.0, back + 1.34, 0xf2665c)
    this.colliders.push({ minX: 2.4, maxX: 4, minZ: back, maxZ: back + 1.3 })
    for (const [tx, tz] of [[6.5, bk.z + 1.2], [-6.5, bk.z + 1.8]] as const) {
      b.cyl(0.65, 0.65, 0.08, tx, 0.75, tz, 0xfff3e0, 14)
      b.cyl(0.08, 0.12, 0.72, tx, 0.37, tz, C.dark, 6)
      b.cyl(0.25, 0.25, 0.45, tx + 0.9, 0.23, tz, 0xf2665c, 10)
      b.cyl(0.25, 0.25, 0.45, tx - 0.9, 0.23, tz, 0xf2665c, 10)
      this.colliders.push({ minX: tx - 0.7, maxX: tx + 0.7, minZ: tz - 0.7, maxZ: tz + 0.7 })
    }
    for (const px of [-9, 9]) {
      b.cyl(0.35, 0.28, 0.6, px, 0.3, bk.z + 2.2, 0xf2b134, 8)
      b.sphere(0.5, px, 1.0, bk.z + 2.2, 0x4fae5a, 8, 6)
    }

    // secret corridor floor (warm tiles like a club house)
    const cw = LAYOUT.corridorWidth
    for (let z = Math.floor(CORRIDOR.zBack); z < back; z++)
      for (let x = -cw / 2; x < cw / 2; x++) b.box(1, 0.1, 1, x + 0.5, 0, z + 0.5, (x + z) % 2 ? C.tileA : C.tileB)
    // corridor end + teaser construction row
    const tz = TEASER_ROW_Z
    for (const side of [-1, 1]) {
      const cx = side * (cw / 2 + LAYOUT.roomW / 2)
      b.box(LAYOUT.roomW, 0.1, LAYOUT.roomD, cx, 0, tz, C.lockedB)
      for (let i = 0; i < 6; i++) b.box(1.2, 0.5, 0.08, cx - 3 + i * 1.25, 0.55, tz + LAYOUT.roomD / 2, i % 2 ? C.tape : C.dark)
      b.cone(0.25, 0.6, cx - 2, 0.3, tz + 1, 0xf2665c)
      b.cone(0.25, 0.6, cx + 1.5, 0.3, tz - 0.5, 0xf2665c)
      b.box(1.2, 0.9, 1.2, cx + side * 2.2, 0.45, tz - 1.6, 0xa07a4f)
      this.colliders.push({ minX: cx - LAYOUT.roomW / 2, maxX: cx + LAYOUT.roomW / 2, minZ: tz - LAYOUT.roomD / 2, maxZ: tz + LAYOUT.roomD / 2 })
    }
    b.box(cw, 0.1, LAYOUT.roomD, 0, 0, tz, C.lockedB)
    this.colliders.push({ minX: -cw / 2, maxX: cw / 2, minZ: tz - LAYOUT.roomD / 2, maxZ: tz + LAYOUT.roomD / 2 - 0.6, id: 'teaser' })
    for (let i = 0; i < 4; i++) b.box(1, 0.6, 0.1, -1.5 + i, 0.6, tz + LAYOUT.roomD / 2 - 0.6, i % 2 ? C.tape : C.dark)
    return b.build()
  }

  private wallX(b: StaticBatch, xa: number, xb: number, z: number, h: number, col: number, cap: number) {
    const w = xb - xa
    if (w <= 0.01) return
    const t = LAYOUT.wall
    b.box(w, h, t, (xa + xb) / 2, h / 2, z, col)
    b.box(w + 0.02, 0.12, t + 0.1, (xa + xb) / 2, h + 0.06, z, cap)
    this.colliders.push({ minX: xa, maxX: xb, minZ: z - t / 2 - 0.05, maxZ: z + t / 2 + 0.05 })
  }

  private wallZ(b: StaticBatch, x: number, za: number, zb: number, h: number, col: number, cap: number) {
    const d = zb - za
    if (d <= 0.01) return
    const t = LAYOUT.wall
    b.box(t, h, d, x, h / 2, (za + zb) / 2, col)
    b.box(t + 0.1, 0.12, d + 0.02, x, h + 0.06, (za + zb) / 2, cap)
    this.colliders.push({ minX: x - t / 2 - 0.05, maxX: x + t / 2 + 0.05, minZ: za, maxZ: zb })
  }

  // ---------- rooms (rebuilt when their unlock state changes) ----------
  syncRooms(s: GameState): void {
    for (const id of ROOM_ORDER) {
      const unlocked = s.rooms[id].unlocked
      const mesh = this.roomMeshes.get(id)
      if (mesh && mesh.userData.unlocked === unlocked && mesh.userData.slots === s.rooms[id].slots) continue
      if (mesh) {
        this.scene.remove(mesh)
        mesh.geometry.dispose()
      }
      // colliders of this room are rebuilt too
      for (let i = this.colliders.length - 1; i >= 0; i--) if (this.colliders[i]!.id?.startsWith(`room:${id}`)) this.colliders.splice(i, 1)
      const m = new Mesh(this.buildRoom(id, unlocked, s.rooms[id].slots), flatMat)
      m.userData = { unlocked, slots: s.rooms[id].slots }
      this.roomMeshes.set(id, m)
      this.scene.add(m)
    }
  }

  private buildRoom(id: RoomId, unlocked: boolean, slots: number) {
    const def = ROOMS[id]
    const { x, z, w, d } = def.rect
    const side = def.side
    const b = new StaticBatch()
    const tag = `room:${id}`
    const n = this.colliders.length
    const top = z - d / 2
    const bottom = z + d / 2
    const outer = x + side * (w / 2)
    const inner = x - side * (w / 2)
    const doorHalf = 1.25
    // floor
    const fa = unlocked ? def.floor : C.locked
    const fb = unlocked ? shade(def.floor, 0.88) : C.lockedB
    for (let ix = 0; ix < w; ix++)
      for (let iz = 0; iz < Math.floor(d); iz++)
        b.box(1, 0.1, d / Math.floor(d), x - w / 2 + ix + 0.5, 0.005, top + (iz + 0.5) * (d / Math.floor(d)), (ix + iz) % 2 ? fa : fb)
    // walls: back (far from camera) + outer tall, front (toward camera) low, corridor side with door
    const wall = unlocked ? C.wall : 0x5d6270
    const cap = unlocked ? C.wallCap : 0x737a88
    this.wallX(b, x - w / 2, x + w / 2, top, LAYOUT.wallH, wall, cap)
    this.wallZ(b, outer, top, bottom, LAYOUT.wallH, wall, cap)
    this.wallX(b, x - w / 2, x + w / 2, bottom, 0.4, wall, cap)
    this.wallZ(b, inner, top, z - doorHalf, LAYOUT.wallH * 0.7, wall, cap)
    this.wallZ(b, inner, z + doorHalf, bottom, LAYOUT.wallH * 0.7, wall, cap)

    if (!unlocked) {
      // construction: tape across the door (blocks the player), cones, crates
      for (let i = 0; i < 3; i++) b.box(0.12, 0.42, 0.8, inner, 0.45, z - doorHalf + 0.4 + i * 0.85, i % 2 ? C.dark : C.tape)
      this.colliders.push({ minX: inner - 0.2, maxX: inner + 0.2, minZ: z - doorHalf, maxZ: z + doorHalf, id: `${tag}:barrier` })
      b.cone(0.25, 0.6, x - 1.5, 0.3, z + 1.2, 0xf2665c)
      b.cone(0.25, 0.6, x + 2, 0.3, z - 1.6, 0xf2665c)
      b.box(1, 0.8, 1, x + side * 2.2, 0.4, z - 1.4, 0xa07a4f)
      b.box(0.8, 0.6, 0.8, x + side * 1.2, 0.3, z - 1.9, 0xb58a5a)
      b.box(0.1, 1.6, 0.1, x - side * 0.5, 0.8, z - 2, C.steel)
      b.box(2.4, 0.1, 0.1, x + side * 0.6, 1.6, z - 2, C.steel)
    } else {
      this.furnish(b, id, slots, tag)
    }
    for (let i = n; i < this.colliders.length; i++) this.colliders[i]!.id ??= tag
    return b.build()
  }

  private furnish(b: StaticBatch, id: RoomId, slots: number, tag: string) {
    const def = ROOMS[id]
    const { x, z, d } = def.rect
    const side = def.side
    const top = z - d / 2
    // room sign plate on the back wall
    b.box(2.6, 0.5, 0.08, x, 1.3, top + 0.2, def.accent)
    if (id === 'mission_control') {
      b.box(5.6, 1.4, 0.12, x, 1.0, top + 0.25, 0x0f1a2e)
      b.box(5.2, 1.1, 0.04, x, 1.0, top + 0.33, 0x46c2cb)
      b.box(1.6, 0.8, 0.05, x - 1.2, 1.05, top + 0.36, 0x2a7a87)
      b.box(1.2, 0.5, 0.05, x + 1.4, 1.15, top + 0.36, 0xf2665c)
      // map table
      b.cyl(1.3, 1.4, 0.75, x + side * 0.6, 0.38, z + 0.4, C.dark, 12)
      b.cyl(1.25, 1.25, 0.04, x + side * 0.6, 0.77, z + 0.4, 0x46c2cb, 12)
      this.colliders.push({ minX: x + side * 0.6 - 1.3, maxX: x + side * 0.6 + 1.3, minZ: z - 0.9, maxZ: z + 1.7, id: tag })
      for (const dx of [-2.6, 2.6]) {
        b.box(1.4, 0.75, 0.8, x + dx, 0.38, top + 1.2, 0x2d3748)
        b.box(1, 0.6, 0.06, x + dx, 1.05, top + 0.95, 0x46c2cb)
      }
      return
    }
    // upgrade desk with clipboard
    const u = upgradeSpotOf(id)
    b.box(1.1, 0.7, 0.6, u.x + side * 0.9, 0.35, u.z, C.wood)
    b.box(0.5, 0.04, 0.4, u.x + side * 0.9, 0.72, u.z, 0xfff3e0)
    this.colliders.push({ minX: u.x + side * 0.9 - 0.55, maxX: u.x + side * 0.9 + 0.55, minZ: u.z - 0.3, maxZ: u.z + 0.3, id: tag })
    // cash table near the door
    const cs = cashSpotOf(id)
    b.box(1.2, 0.08, 1.0, cs.x, 0.05, cs.z, 0x2f6b3a)
    // one training station per slot
    for (let i = 0; i < slots; i++) {
      const p = slotOf(id, i)
      this.station(b, id, p.x, p.z - 0.75, def.accent)
    }
  }

  private station(b: StaticBatch, id: RoomId, x: number, z: number, accent: number) {
    switch (id) {
      case 'vault':
        b.box(0.9, 1.0, 0.7, x, 0.5, z, 0x6d7a8c)
        b.cyl(0.22, 0.22, 0.06, x, 0.6, z + 0.37, accent, 12, Math.PI / 2)
        b.box(0.06, 0.25, 0.06, x + 0.3, 0.6, z + 0.37, 0xd0d6e0)
        break
      case 'laser':
        b.box(0.08, 1.2, 0.08, x - 0.6, 0.6, z, C.steel)
        b.box(0.08, 1.2, 0.08, x + 0.6, 0.6, z, C.steel)
        b.box(1.2, 0.04, 0.04, x, 0.45, z, 0xff3b3b)
        b.box(1.2, 0.04, 0.04, x, 0.85, z, 0xff3b3b)
        break
      case 'cipher':
        b.box(0.9, 0.7, 0.5, x, 0.35, z, 0x2d3748)
        b.box(0.7, 0.45, 0.05, x, 0.95, z - 0.15, 0x7cc6d6)
        break
      default:
        b.box(0.8, 0.6, 0.6, x, 0.3, z, accent)
    }
  }

}

function shade(hex: number, f: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f))
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f))
  const b = Math.min(255, Math.round((hex & 255) * f))
  return (r << 16) | (g << 8) | b
}
