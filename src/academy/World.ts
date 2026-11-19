/**
 * The academy as ONE walkable area (isometric view): bakery at the street, secret corridor
 * behind it, rooms left/right that grow via unlock pads.
 * Art: Quaternius CC0 models baked into vertex-colored geometry + simple architectural boxes,
 * merged per room (one draw call each) with the shared material. Real shadows on mid/high tiers.
 */
import {
  Color, DirectionalLight, Fog, Group, HemisphereLight, Mesh, Scene, type BufferGeometry,
} from 'three'
import { StaticBatch } from '../render/geometry'
import { flatMat } from '../render/materials'
import { propGeometry } from '../render/assets'
import { MODELS, type ModelId } from '../config/models'
import {
  CORRIDOR, LAYOUT, ROOMS, ROOM_ORDER, TEASER_ROW_Z, slotOf, upgradeSpotOf, cashSpotOf, crateOf, type RoomId,
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
  tileA: 0xf6e7c8,
  tileB: 0xead6ad,
  grout: 0xc9b48c,
  wall: 0x2a6f8f,
  wallCap: 0x3f93b8,
  wallTrim: 0x1d4f66,
  bakeryWall: 0xf7c6d0,
  bakeryCap: 0xf2665c,
  bakeryTileA: 0xfff6e8,
  bakeryTileB: 0xf6cfd8,
  street: 0x575c68,
  sidewalk: 0xc9ccd4,
  curb: 0xe6e8ec,
  grass: 0x79c46a,
  locked: 0x9aa0ab,
  lockedB: 0x8b919c,
  tape: 0xf2b134,
  dark: 0x22283a,
  steel: 0x9aa3b5,
  wood: 0xc98b5a,
  earth: 0x1b2b4f,
}

/** Every model the world uses (resolved once in init). */
const USED: ModelId[] = Object.keys(MODELS) as ModelId[]

export class World {
  readonly scene = new Scene()
  readonly colliders: AABB[] = []
  readonly dynamic = new Group()
  readonly sun: DirectionalLight
  private roomMeshes = new Map<RoomId, Mesh>()
  private p = {} as Record<ModelId, BufferGeometry | null>

  constructor() {
    const s = this.scene
    s.background = new Color(0x1b2b4f)
    s.fog = new Fog(0x1b2b4f, 40, 75)
    s.add(new HemisphereLight(0xfff4e6, 0x6a5a7a, 1.55))
    const sun = new DirectionalLight(0xfff1dc, 1.9)
    sun.position.set(-7, 16, 10)
    sun.shadow.mapSize.set(2048, 2048)
    const sc = sun.shadow.camera
    sc.left = -16
    sc.right = 16
    sc.top = 16
    sc.bottom = -16
    sc.near = 1
    sc.far = 60
    sun.shadow.bias = -0.0008
    sun.shadow.normalBias = 0.03
    s.add(sun, sun.target)
    this.sun = sun
    s.add(this.dynamic)
  }

  /** Load/bake every prop, then build the static base. */
  async init(): Promise<void> {
    const geos = await Promise.all(USED.map((id) => propGeometry(id)))
    USED.forEach((id, i) => (this.p[id] = geos[i] ?? null))
    const base = new Mesh(this.buildBase(), flatMat)
    base.receiveShadow = true
    base.castShadow = true
    this.scene.add(base)
  }

  private counterMesh: Mesh | null = null

  /** Sign-up desk in the bakery: appears once the first pad is bought. */
  syncCounter(built: boolean): void {
    if (!built || this.counterMesh) return
    const P = this.p
    const b = new StaticBatch()
    const c = LAYOUT.counter
    for (let i = 0; i < 3; i++) b.prop(P.kitchenDrawers, c.x - 1.02 + i * 1.02, c.z, Math.PI)
    b.box(3.2, 0.08, 1.2, c.x, 0.84, c.z, 0xfff3e0)
    b.box(3.2, 0.12, 0.12, c.x, 0.9, c.z + 0.6, 0xf2665c)
    b.prop(P.croissant, c.x - 1.1, c.z + 0.2, 0.4, 1, 0.88)
    b.prop(P.cupcake, c.x + 1.1, c.z + 0.1, 0, 1, 0.88)
    b.prop(P.computer, c.x, c.z - 0.1, Math.PI, 0.55, 0.88)
    this.counterMesh = new Mesh(b.build(), flatMat)
    this.counterMesh.castShadow = true
    this.counterMesh.receiveShadow = true
    this.scene.add(this.counterMesh)
    this.colliders.push({ minX: c.x - 1.6, maxX: c.x + 1.6, minZ: c.z - 0.6, maxZ: c.z + 0.6, id: 'counter' })
  }

  /** Keep the shadow frustum centered on the player. */
  followShadow(x: number, z: number): void {
    this.sun.position.set(x - 7, 16, z + 10)
    this.sun.target.position.set(x, 0, z)
  }

  setShadows(on: boolean): void {
    this.sun.castShadow = on
  }

  // ---------------------------------------------------------------- base
  private buildBase(): BufferGeometry {
    const b = new StaticBatch()
    const P = this.p
    const { bakery: bk, street, wallH } = LAYOUT
    const front = bk.z + bk.d / 2
    const back = bk.z - bk.d / 2
    const x0 = bk.x - bk.w / 2

    // ---- outside: road, sidewalk, curbs, street lights, facades
    b.box(90, 0.1, 40, 0, -0.12, -14, C.earth)
    b.box(90, 0.12, 3.2, 0, -0.02, front + 1.6, C.sidewalk)
    b.box(90, 0.14, 0.25, 0, 0.0, front + 3.2, C.curb)
    for (let x = -40; x <= 40; x += 4) b.prop(P.streetStraight, x, street.z + 3.4)
    b.box(90, 0.05, 12, 0, -0.16, street.z + 8, C.street)
    for (const x of [-12, 12]) b.prop(P.streetlight, x, front + 2.6)
    b.prop(P.signNoParking, 8, front + 2.8, Math.PI)
    for (const x of [x0 - 3.2, -x0 + 3.2]) {
      const side = Math.sign(x)
      b.box(6, 4.2, 5, x + side * 1.5, 2.1, bk.z - 0.5, side > 0 ? 0xa7c4a0 : 0xd9a6a0)
      b.box(6.2, 0.3, 5.2, x + side * 1.5, 4.3, bk.z - 0.5, side > 0 ? 0x7fa77a : 0xc07f78)
      for (let i = 0; i < 2; i++) b.box(1.2, 1.2, 0.08, x + side * (0.5 + i * 2), 2.5, bk.z + 2.02, 0xbfe3f2)
    }

    // ---- bakery floor (checker with grout) + walls
    this.tiles(b, x0, back, bk.w, bk.d, C.bakeryTileA, C.bakeryTileB)
    this.wallX(b, x0, -LAYOUT.corridorWidth / 2, back, wallH, C.bakeryWall, C.bakeryCap)
    this.wallX(b, LAYOUT.corridorWidth / 2, x0 + bk.w, back, wallH, C.bakeryWall, C.bakeryCap)
    this.wallZ(b, x0, back, front, wallH, C.bakeryWall, C.bakeryCap)
    this.wallZ(b, x0 + bk.w, back, front, wallH, C.bakeryWall, C.bakeryCap)
    this.wallX(b, x0, -1.3, front, 0.5, C.bakeryWall, C.bakeryCap)
    this.wallX(b, 1.3, x0 + bk.w, front, 0.5, C.bakeryWall, C.bakeryCap)
    this.colliders.push({ minX: -1.3, maxX: 1.3, minZ: front - 0.2, maxZ: front + 1, id: 'street_door' })
    // windows on the back wall + striped awning over the street front
    for (let i = 0; i < 12; i++) b.box(bk.w / 12, 0.16, 1.3, x0 + (i + 0.5) * (bk.w / 12), 2.35, front + 0.7, i % 2 ? 0xfff3e0 : 0xf2665c)
    b.box(bk.w, 0.08, 0.1, 0, 2.27, front + 1.35, 0xc94f47)
    // shop sign
    b.box(5.4, 0.9, 0.2, 0, 2.95, front + 0.1, 0x7a3e2b)
    b.box(5.0, 0.6, 0.06, 0, 2.95, front + 0.22, 0xfff3e0)

    // pastry display shelves along the left back wall (the cover business)
    for (let i = 0; i < 3; i++) b.prop(P.kitchenDrawers, -8.9 + i * 1.02, back + 0.62)
    b.box(3.2, 0.08, 1.15, -7.88, 0.84, back + 0.62, 0xfff3e0)
    const pastries: ModelId[] = ['croissant', 'cupcake', 'donut1', 'bread', 'donut2', 'cupcake']
    pastries.forEach((id, i) => b.prop(P[id], -9.1 + i * 0.52, back + 0.62 + (i % 2 ? 0.15 : -0.15), i * 0.7, 1, 0.88))
    b.prop(P.fridge, -6.0, back + 0.7)
    this.colliders.push({ minX: -9.5, maxX: -5.3, minZ: back, maxZ: back + 1.3 })
    // the secret oven (cadets "disappear" behind it)
    b.prop(P.oven, 2.6, back + 0.65, 0, 1.15)
    this.colliders.push({ minX: 1.9, maxX: 3.3, minZ: back, maxZ: back + 1.3 })
    // cafe tables + stools on the left
    for (const [tx, tz] of [[-6.4, bk.z + 1.6], [-3.6, bk.z + 0.2], [-8.6, bk.z - 0.4]] as const) {
      b.prop(P.tableRound, tx, tz, 0, 0.75)
      b.prop(P.stool, tx + 0.95, tz, Math.PI / 2, 0.75)
      b.prop(P.stool, tx - 0.95, tz, -Math.PI / 2, 0.75)
      this.colliders.push({ minX: tx - 1.3, maxX: tx + 1.3, minZ: tz - 0.6, maxZ: tz + 0.6 })
    }
    b.prop(P.carpetRound, -6.0, bk.z + 0.6, 0, 1.1, 0.01)
    for (const [px, pz, id] of [[-9.4, front - 0.6, 'plant7'], [9.4, front - 0.6, 'plant7'], [9.4, back + 0.6, 'plant4'], [-4.8, back + 0.5, 'plant4']] as const) {
      b.prop(P[id as ModelId], px, pz)
    }
    b.prop(P.floorLamp, -2.6, back + 0.5)

    // ---- secret corridor: tiles + side trims + lights
    const cw = LAYOUT.corridorWidth
    this.tiles(b, -cw / 2, CORRIDOR.zBack, cw, back - CORRIDOR.zBack, C.tileA, C.tileB)
    for (let z = back - 3; z > CORRIDOR.zBack + 1; z -= 7) {
      b.prop(P.lightSquare, -cw / 2 + 0.25, z, 0, 0.8)
      b.prop(P.lightSquare, cw / 2 - 0.25, z, 0, 0.8)
    }

    // ---- "Coming soon" construction row at the end
    const tz = TEASER_ROW_Z
    for (const side of [-1, 1]) {
      const cx = side * (cw / 2 + LAYOUT.roomW / 2)
      b.box(LAYOUT.roomW, 0.1, LAYOUT.roomD, cx, 0, tz, C.lockedB)
      this.construction(b, cx, tz, side)
      this.colliders.push({ minX: cx - LAYOUT.roomW / 2, maxX: cx + LAYOUT.roomW / 2, minZ: tz - LAYOUT.roomD / 2, maxZ: tz + LAYOUT.roomD / 2 })
    }
    b.box(cw, 0.1, LAYOUT.roomD, 0, 0, tz, C.lockedB)
    for (let i = 0; i < 5; i++) b.prop(P.fence, -1.6 + i * 0.8, tz + LAYOUT.roomD / 2 - 0.6)
    b.prop(P.hazard, 0, tz + LAYOUT.roomD / 2 + 0.2, 0, 0.8)
    this.colliders.push({ minX: -cw / 2, maxX: cw / 2, minZ: tz - LAYOUT.roomD / 2, maxZ: tz + LAYOUT.roomD / 2 - 0.4, id: 'teaser' })
    return b.build()
  }

  private construction(b: StaticBatch, cx: number, cz: number, side: number): void {
    const P = this.p
    b.prop(P.lootbox, cx + side * 2.4, cz - 1.6, 0.3, 1.6)
    b.prop(P.lootbox, cx + side * 1.4, cz - 2.1, -0.2, 1.2)
    b.prop(P.hazard, cx - side * 0.8, cz + 0.4, 0.4)
    b.cone(0.22, 0.6, cx - 2, 0.3, cz + 1.4, 0xf2665c)
    b.cone(0.22, 0.6, cx + 1.8, 0.3, cz + 1.0, 0xf2665c)
    b.box(0.12, 1.8, 0.12, cx - side * 0.2, 0.9, cz - 2.4, C.steel)
    b.box(2.6, 0.12, 0.12, cx + side * 1.0, 1.8, cz - 2.4, C.steel)
  }

  /** Tile floor with grout lines (base slab + slightly smaller tiles). */
  private tiles(b: StaticBatch, x0: number, z0: number, w: number, d: number, a: number, c: number, grout = C.grout): void {
    b.box(w, 0.08, d, x0 + w / 2, -0.01, z0 + d / 2, grout)
    const nx = Math.round(w)
    const nz = Math.round(d)
    const tw = w / nx
    const td = d / nz
    for (let ix = 0; ix < nx; ix++)
      for (let iz = 0; iz < nz; iz++)
        b.box(tw - 0.06, 0.08, td - 0.06, x0 + (ix + 0.5) * tw, 0.01, z0 + (iz + 0.5) * td, (ix + iz) % 2 ? a : c)
  }

  private wallX(b: StaticBatch, xa: number, xb: number, z: number, h: number, col: number, cap: number) {
    const w = xb - xa
    if (w <= 0.01) return
    const t = LAYOUT.wall
    b.box(w, h, t, (xa + xb) / 2, h / 2, z, col)
    b.box(w + 0.04, 0.14, t + 0.14, (xa + xb) / 2, h + 0.07, z, cap)
    b.box(w, 0.16, t + 0.04, (xa + xb) / 2, 0.08, z, shade(col, 0.75))
    this.colliders.push({ minX: xa, maxX: xb, minZ: z - t / 2 - 0.05, maxZ: z + t / 2 + 0.05 })
  }

  private wallZ(b: StaticBatch, x: number, za: number, zb: number, h: number, col: number, cap: number) {
    const d = zb - za
    if (d <= 0.01) return
    const t = LAYOUT.wall
    b.box(t, h, d, x, h / 2, (za + zb) / 2, col)
    b.box(t + 0.14, 0.14, d + 0.04, x, h + 0.07, (za + zb) / 2, cap)
    b.box(t + 0.04, 0.16, d, x, 0.08, (za + zb) / 2, shade(col, 0.75))
    this.colliders.push({ minX: x - t / 2 - 0.05, maxX: x + t / 2 + 0.05, minZ: za, maxZ: zb })
  }

  // ---------------------------------------------------------------- rooms
  syncRooms(s: GameState): void {
    for (const id of ROOM_ORDER) {
      const r = s.rooms[id]
      const key = `${r.unlocked}|${r.stations}|${r.crate}`
      const mesh = this.roomMeshes.get(id)
      if (mesh && mesh.userData.key === key) continue
      if (mesh) {
        this.scene.remove(mesh)
        mesh.geometry.dispose()
      }
      for (let i = this.colliders.length - 1; i >= 0; i--) if (this.colliders[i]!.id?.startsWith(`room:${id}`)) this.colliders.splice(i, 1)
      const m = new Mesh(this.buildRoom(id, r.unlocked, r.stations, r.crate), flatMat)
      m.castShadow = true
      m.receiveShadow = true
      m.userData = { key }
      this.roomMeshes.set(id, m)
      this.scene.add(m)
    }
  }

  private buildRoom(id: RoomId, unlocked: boolean, slots: number, crate: boolean): BufferGeometry {
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
    const fa = unlocked ? def.floor : C.locked
    const fb = unlocked ? shade(def.floor, 0.88) : C.lockedB
    this.tiles(b, x - w / 2, top, w, d, fa, fb, unlocked ? shade(def.floor, 0.7) : 0x7a808b)
    const wall = unlocked ? C.wall : 0x6d7380
    const cap = unlocked ? C.wallCap : 0x8a909c
    this.wallX(b, x - w / 2, x + w / 2, top, LAYOUT.wallH + 0.6, wall, cap)
    this.wallZ(b, outer, top, bottom, LAYOUT.wallH, wall, cap)
    this.wallX(b, x - w / 2, x + w / 2, bottom, 0.45, wall, cap)
    this.wallZ(b, inner, top, z - doorHalf, LAYOUT.wallH * 0.75, wall, cap)
    this.wallZ(b, inner, z + doorHalf, bottom, LAYOUT.wallH * 0.75, wall, cap)

    if (!unlocked) {
      for (let i = 0; i < 3; i++) b.prop(this.p.fence, inner, z - doorHalf + 0.45 + i * 0.8, Math.PI / 2)
      this.colliders.push({ minX: inner - 0.25, maxX: inner + 0.25, minZ: z - doorHalf, maxZ: z + doorHalf, id: `${tag}:barrier` })
      this.construction(b, x, z, side)
    } else {
      this.furnish(b, id, slots, tag, crate)
    }
    for (let i = n; i < this.colliders.length; i++) this.colliders[i]!.id ??= tag
    return b.build()
  }

  private furnish(b: StaticBatch, id: RoomId, slots: number, tag: string, crate = false) {
    const P = this.p
    const def = ROOMS[id]
    const { x, z, w, d } = def.rect
    const side = def.side
    const top = z - d / 2
    const outer = x + side * (w / 2)
    // accent stripe + sign plate on the back wall
    b.box(w - 0.4, 0.18, 0.06, x, 1.2, top + 0.2, def.accent)
    b.box(2.4, 0.55, 0.08, x, 1.75, top + 0.22, 0xfff3e0)
    b.box(2.2, 0.4, 0.04, x, 1.75, top + 0.27, def.accent)
    const col = (minX: number, maxX: number, minZ: number, maxZ: number) => this.colliders.push({ minX, maxX, minZ, maxZ, id: tag })

    if (id === 'mission_control') {
      // big wall screen + desks with computers along the back wall
      b.box(4.6, 1.5, 0.12, x, 1.35, top + 0.24, 0x0f1a2e)
      b.box(4.3, 1.25, 0.04, x, 1.35, top + 0.32, 0x2b8fa8)
      b.box(1.6, 0.8, 0.03, x - 1.1, 1.4, top + 0.35, 0x46c2cb)
      b.box(1.2, 0.5, 0.03, x + 1.2, 1.55, top + 0.35, 0xf2665c)
      b.box(1.0, 0.3, 0.03, x + 1.2, 1.0, top + 0.35, 0x7be07a)
      for (const dx of [-2.3, 2.3]) {
        b.prop(P.desk, x + dx, top + 0.75, 0, 0.75)
        b.prop(P.computer, x + dx - 0.3, top + 0.6, 0, 0.75, 0.68)
        b.prop(P.computer, x + dx + 0.35, top + 0.6, 0, 0.75, 0.68)
        b.prop(P.officeChair, x + dx, top + 1.55, Math.PI, 0.85)
      }
      col(x - 3.2, x + 3.2, top, top + 1.3)
      // holo map table
      const mx = x + side * 0.6
      b.cyl(1.25, 1.35, 0.8, mx, 0.4, z + 0.5, C.dark, 16)
      b.cyl(1.2, 1.2, 0.05, mx, 0.82, z + 0.5, 0x46c2cb, 16)
      b.cyl(0.5, 0.6, 0.06, mx - 0.3, 0.86, z + 0.3, 0x7be07a, 8)
      b.cyl(0.35, 0.4, 0.06, mx + 0.5, 0.86, z + 0.8, 0xf2b134, 7)
      col(mx - 1.3, mx + 1.3, z - 0.8, z + 1.8)
      b.prop(P.desk, outer - side * 1.1, z + 1.2, side > 0 ? -Math.PI / 2 : Math.PI / 2)
      b.prop(P.computer, outer - side * 1.0, z + 1.2, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0.8, 0.78)
      b.prop(P.officeChair, outer - side * 1.9, z + 1.2, side > 0 ? Math.PI / 2 : -Math.PI / 2)
      col(Math.min(outer, outer - side * 1.6), Math.max(outer, outer - side * 1.6), z + 0.5, z + 1.9)
      b.prop(P.plant4, outer - side * 0.5, top + 0.5)
      return
    }
    // upgrade desk with lamp + clipboard
    const u = upgradeSpotOf(id)
    const dx = u.x + side * 1.0
    b.prop(P.desk, dx, u.z, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0.8)
    b.prop(P.deskLamp, dx, u.z - 0.4, 0, 1, 0.74)
    b.box(0.35, 0.03, 0.45, dx, 0.76, u.z + 0.15, 0xfff3e0)
    col(dx - 0.45, dx + 0.45, u.z - 0.8, u.z + 0.8)
    // cash table near the door
    const cs = cashSpotOf(id)
    b.box(1.3, 0.06, 1.1, cs.x, 0.04, cs.z, 0x2f6b3a)
    // kit crate (supply source) just inside the door
    if (crate) {
      const k = crateOf(id)
      b.prop(P.lootbox, k.x, k.z, 0.2, 1.5)
      b.box(0.9, 0.05, 0.9, k.x, 0.03, k.z, def.accent)
      col(k.x - 0.45, k.x + 0.45, k.z - 0.45, k.z + 0.45)
    }
    // decoration on the outer wall
    b.prop(P.bookcase, outer - side * 0.45, top + 1.0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0.75)
    b.prop(P.plant1, outer - side * 0.55, z + d / 2 - 0.5)
    col(Math.min(outer, outer - side * 0.8), Math.max(outer, outer - side * 0.8), top + 0.2, top + 1.8)
    // one training station per slot
    for (let i = 0; i < slots; i++) {
      const p = slotOf(id, i)
      this.station(b, id, p.x, p.z - 0.8, def.accent)
    }
  }

  private station(b: StaticBatch, id: RoomId, x: number, z: number, accent: number) {
    const P = this.p
    switch (id) {
      case 'vault':
        // a practice safe: body, door, dial, handle
        b.box(0.95, 1.05, 0.75, x, 0.53, z, 0x6d7a8c)
        b.box(0.8, 0.9, 0.05, x, 0.55, z + 0.4, 0x8a96a8)
        b.cyl(0.2, 0.2, 0.08, x - 0.08, 0.62, z + 0.44, accent, 14, Math.PI / 2)
        b.cyl(0.05, 0.05, 0.12, x - 0.08, 0.62, z + 0.48, 0x2b2b2b, 6, Math.PI / 2)
        b.box(0.06, 0.32, 0.08, x + 0.28, 0.6, z + 0.46, 0xd0d6e0)
        b.box(1.0, 0.06, 0.8, x, 1.06, z, 0x56627a)
        break
      case 'laser':
        b.prop(P.lightSquare, x - 0.65, z, 0, 1.8)
        b.prop(P.lightSquare, x + 0.65, z, 0, 1.8)
        b.box(1.2, 0.04, 0.04, x, 0.35, z, 0xff3b3b)
        b.box(1.2, 0.04, 0.04, x, 0.6, z, 0xff3b3b)
        b.box(1.2, 0.04, 0.04, x, 0.85, z, 0xff3b3b)
        b.box(1.5, 0.03, 0.9, x, 0.02, z + 0.5, 0x2b2b3b)
        break
      case 'cipher':
        b.prop(P.desk, x, z, 0, 0.62)
        b.prop(P.computer, x, z - 0.1, 0, 0.75, 0.6)
        break
      default:
        b.prop(P.table, x, z, Math.PI / 2, 0.5)
    }
  }
}

function shade(hex: number, f: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f))
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f))
  const b = Math.min(255, Math.round((hex & 255) * f))
  return (r << 16) | (g << 8) | b
}
