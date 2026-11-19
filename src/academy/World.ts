/**
 * The academy as ONE walkable diorama (docs/ART_BIBLE.md): a raised plot with a light curb floating
 * in a dark void; bakery at the street, secret corridor behind it, cutaway rooms left/right.
 * Props: KayKit CC0 (baked to vertex colours). Architecture: bevelled boxes with skirting + trim.
 * Static parts are merged per room (one draw call each). Locked rooms are translucent blueprints.
 */
import {
  Color, DirectionalLight, Fog, Group, HemisphereLight, Mesh, MeshLambertMaterial, Scene, type BufferGeometry,
} from 'three'
import { StaticBatch } from '../render/geometry'
import { flatMat } from '../render/materials'
import { propGeometry } from '../render/assets'
import { PAL, ROOM_FLOOR } from '../render/palette'
import { MODELS, type ModelId } from '../config/models'
import {
  AREAS, AREA_ORDER, LAYOUT, PLAZAS, ROOMS, ROOM_ORDER, TEASER_ROW_Z, slotOf, upgradeSpotOf, cashSpotOf, crateOf, gateOf,
  type AreaId, type RoomId,
} from '../config/rooms'
import type { GameState } from '../sim/state'

export interface AABB {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  id?: string
}

const USED: ModelId[] = Object.keys(MODELS) as ModelId[]
const blueprintMat = new MeshLambertMaterial({ color: PAL.blueprint, transparent: true, opacity: 0.35, depthWrite: false, emissive: 0x1a3d66 })
const BACK_WALL = 2.4
const STUB = 0.3

export class World {
  readonly scene = new Scene()
  readonly colliders: AABB[] = []
  readonly dynamic = new Group()
  readonly sun: DirectionalLight
  private roomMeshes = new Map<RoomId, Mesh[]>()
  private p = {} as Record<ModelId, BufferGeometry | null>
  private counterMesh: Mesh | null = null

  constructor() {
    const s = this.scene
    s.background = new Color(PAL.void)
    s.fog = new Fog(PAL.void, 60, 140)
    s.add(new HemisphereLight(0xeef4ff, 0x4a3d66, 1.45))
    const sun = new DirectionalLight(0xfff0d6, 2.4)
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

  async init(): Promise<void> {
    const geos = await Promise.all(USED.map((id) => propGeometry(id)))
    USED.forEach((id, i) => (this.p[id] = geos[i] ?? null))
    const base = new Mesh(this.buildBase(), flatMat)
    base.receiveShadow = true
    base.castShadow = true
    this.scene.add(base)
    const street = new Mesh(this.buildStreet(), flatMat)
    street.receiveShadow = true
    this.scene.add(street)
  }

  followShadow(x: number, z: number): void {
    this.sun.position.set(x - 7, 16, z + 10)
    this.sun.target.position.set(x, 0, z)
  }

  setShadows(on: boolean): void {
    this.sun.castShadow = on
  }

  // ---------------------------------------------------------------- plot, bakery, corridor
  private buildBase(): BufferGeometry {
    const b = new StaticBatch()
    const P = this.p
    const { bakery: bk } = LAYOUT
    const front = bk.z + bk.d / 2
    const back = bk.z - bk.d / 2
    const x0 = bk.x - bk.w / 2
    const plotMinX = -(LAYOUT.corridorWidth / 2 + LAYOUT.roomW) - 0.8
    const plotMaxX = -plotMinX
    const plotMinZ = 0
    const plotMaxZ = front + 3.4

    // bakery plot (raised, light curb) — the area islands are built in syncAreas()
    const pw = plotMaxX - plotMinX
    const pcx = (plotMinX + plotMaxX) / 2
    const bz0 = back - 0.4
    const bd = plotMaxZ - bz0
    this.plot(b, pcx, bz0 + bd / 2, pw, bd, true)
    void plotMinZ
    // sidewalk paving in front of the bakery
    this.tiles(b, plotMinX, front, pw, plotMaxZ - front - 0.1, PAL.pavingA, PAL.pavingB, PAL.curbSide)

    // ---- bakery
    this.tiles(b, x0, back, bk.w, bk.d, PAL.bakeryA, PAL.bakeryB)
    this.wallX(b, x0, -LAYOUT.corridorWidth / 2, back, BACK_WALL, PAL.bakeryWall, PAL.bakeryTrim)
    this.wallX(b, LAYOUT.corridorWidth / 2, x0 + bk.w, back, BACK_WALL, PAL.bakeryWall, PAL.bakeryTrim)
    this.wallZ(b, x0, back, front, 1.4, PAL.bakeryWall, PAL.bakeryTrim)
    this.wallZ(b, x0 + bk.w, back, front, 1.4, PAL.bakeryWall, PAL.bakeryTrim)
    this.wallX(b, x0, -1.3, front, STUB, PAL.bakeryWall, PAL.bakeryTrim)
    this.wallX(b, 1.3, x0 + bk.w, front, STUB, PAL.bakeryWall, PAL.bakeryTrim)
    this.colliders.push({ minX: -1.3, maxX: 1.3, minZ: front - 0.2, maxZ: front + 1, id: 'street_door' })
    // striped awning stubs + shop sign over the street door
    for (let i = 0; i < 12; i++) b.rbox(bk.w / 12 - 0.02, 0.14, 0.9, x0 + (i + 0.5) * (bk.w / 12), 0.55, front + 0.45, i % 2 ? PAL.white : PAL.coral, 0.04)
    b.rbox(4.6, 0.7, 0.18, 0, 0.75, front + 0.2, 0x7a3e2b, 0.06)
    b.rbox(4.3, 0.46, 0.06, 0, 0.75, front + 0.31, PAL.white, 0.03)
    b.rbox(3.8, 0.1, 0.07, 0, 0.6, front + 0.34, PAL.coral, 0.02)

    // back wall: pastry kitchen (left) + the secret oven (right of the corridor)
    b.prop(P.shelfPaper, -8.4, back + 0.35, 0, 1, 1.2)
    b.prop(P.stove, -6.4, back + 1.05)
    b.prop(P.fridge, -8.6, back + 1.05)
    b.prop(P.counterDeco, -4.6, back + 1.0)
    this.colliders.push({ minX: -9.6, maxX: -3.7, minZ: back, maxZ: back + 2 })
    b.prop(P.oven, 2.9, back + 1.0, 0, 0.75)
    this.colliders.push({ minX: 2.1, maxX: 3.7, minZ: back, maxZ: back + 1.9 })
    // crates of buns by the door, menu sign
    b.prop(P.crateBuns, -1.9, front - 0.9, 0.3, 0.45)
    b.prop(P.crateBuns, -1.9, front - 0.9, 0.1, 0.45, 0.34)
    b.prop(P.menu, 1.7, front - 0.6, 0.4)
    // cafe tables
    for (const [tx, tz] of [[-6.6, bk.z + 1.5], [-3.6, bk.z + 0.4], [-8.8, bk.z - 0.2]] as const) {
      b.prop(P.tableRoundSmall, tx, tz)
      b.prop(P.chairA, tx + 0.95, tz, -Math.PI / 2)
      b.prop(P.chairA, tx - 0.95, tz, Math.PI / 2)
      this.colliders.push({ minX: tx - 1.3, maxX: tx + 1.3, minZ: tz - 0.6, maxZ: tz + 0.6 })
    }
    b.prop(P.cactus, -9.4, front - 0.6)
    b.prop(P.cactus, 9.4, front - 0.6)
    b.prop(P.lamp, 9.3, back + 0.6)
    b.prop(P.pillar, -2.25, back + 0.15, 0, 0.6)
    b.prop(P.pillar, 2.25, back + 0.15, 0, 0.6)

    return b.build()
  }

  /** Street + harbour skyline in front of the plot (outside the walkable area). */
  private buildStreet(): BufferGeometry {
    const b = new StaticBatch()
    const P = this.p
    const z = LAYOUT.bakery.z + LAYOUT.bakery.d / 2 + 4.6
    for (let x = -28; x <= 28; x += 8) b.prop(P.road, x, z + 3.4, Math.PI / 2, 1, -0.6)
    b.prop(P.taxi, -5.5, z + 2.4, Math.PI / 2, 1, -0.6)
    b.prop(P.sedan, 9, z + 4.6, -Math.PI / 2, 1, -0.6)
    for (const x of [-11, 11]) b.prop(P.streetlight, x, z - 0.7, 0, 1, -0.05)
    b.prop(P.bench, 5, z - 0.7, Math.PI, 1, -0.05)
    b.prop(P.hydrant, 3.2, z - 0.8, 0, 1, -0.05)
    b.prop(P.bush, -8, z - 0.7, 0, 1, -0.05)
    b.prop(P.dumpster, 13.5, z - 0.4, 0, 1, -0.05)
    const blds: ModelId[] = ['buildingA', 'buildingB', 'buildingC', 'buildingD']
    for (let i = 0; i < 8; i++) b.prop(P[blds[i % 4]!], -24 + i * 7, z + 11, Math.PI, 1, -0.6)
    return b.build()
  }

  /** Raised plot slab with a light curb (open) or a dark blueprint slab (closed). */
  private plot(b: StaticBatch, cx: number, cz: number, w: number, d: number, open: boolean): void {
    if (open) {
      b.rbox(w + 0.2, 1.4, d + 0.2, cx, -0.82, cz, PAL.curbShadow, 0.2)
      b.rbox(w + 0.4, 0.3, d + 0.4, cx, -0.16, cz, PAL.curbSide, 0.1)
      b.rbox(w + 0.5, 0.1, d + 0.5, cx, -0.03, cz, PAL.curbTop, 0.05)
    } else {
      b.rbox(w + 0.2, 1.4, d + 0.2, cx, -0.82, cz, 0x1b2440, 0.2)
      b.rbox(w + 0.5, 0.1, d + 0.5, cx, -0.03, cz, PAL.blueprintEdge, 0.05)
    }
  }

  // ---------------------------------------------------------------- areas (islands)
  private areaMeshes = new Map<AreaId, Mesh>()

  /** One island per area: plot, corridor, plazas, outer edge colliders; bridge + gate to it. */
  syncAreas(s: GameState): void {
    for (const a of AREA_ORDER) {
      const open = s.areas[a]
      const prev = this.areaMeshes.get(a)
      if (prev && prev.userData.open === open) continue
      if (prev) {
        this.scene.remove(prev)
        prev.geometry.dispose()
      }
      for (let i = this.colliders.length - 1; i >= 0; i--) if (this.colliders[i]!.id?.startsWith(`area:${a}`)) this.colliders.splice(i, 1)
      const n = this.colliders.length
      const m = new Mesh(this.buildArea(a, open), flatMat)
      for (let i = n; i < this.colliders.length; i++) this.colliders[i]!.id ??= `area:${a}`
      m.receiveShadow = true
      m.castShadow = true
      m.userData = { open }
      this.scene.add(m)
      this.areaMeshes.set(a, m)
    }
  }

  private buildArea(a: AreaId, open: boolean): BufferGeometry {
    const b = new StaticBatch()
    const P = this.p
    const A = AREAS[a]
    const cw = LAYOUT.corridorWidth
    const half = cw / 2 + LAYOUT.roomW + 0.8
    const d = A.zFront - A.zBack
    const cz = (A.zFront + A.zBack) / 2
    const tag = `area:${a}`
    this.plot(b, 0, cz, half * 2, d, open)
    // corridor
    if (open) this.tiles(b, -cw / 2, A.zBack, cw, d, PAL.corridorA, PAL.corridorB)
    else this.tiles(b, -cw / 2, A.zBack, cw, d, 0x2b3c66, 0x324674, PAL.blueprint)
    // outer edges of the island
    this.colliders.push({ minX: -half - 1, maxX: -half + 0.2, minZ: A.zBack, maxZ: A.zFront, id: tag })
    this.colliders.push({ minX: half - 0.2, maxX: half + 1, minZ: A.zBack, maxZ: A.zFront, id: tag })
    const i = AREA_ORDER.indexOf(a)
    if (i > 0) {
      // bridge from the previous island (walkway width = corridor), void on both sides
      const pz = AREAS[AREA_ORDER[i - 1]!].zBack
      const bl = pz - A.zFront
      b.rbox(cw - 0.4, 0.3, bl + 0.6, 0, -0.12, (pz + A.zFront) / 2, open ? PAL.curbSide : 0x2b3c66, 0.08)
      b.rbox(cw - 0.6, 0.08, bl + 0.6, 0, 0.0, (pz + A.zFront) / 2, open ? PAL.wood : 0x324674, 0.03)
      for (const sx of [-1, 1]) {
        b.rbox(0.14, 0.7, bl + 0.6, sx * (cw / 2 - 0.3), 0.35, (pz + A.zFront) / 2, open ? PAL.brand : PAL.blueprintEdge, 0.04)
        this.colliders.push({ minX: sx > 0 ? cw / 2 - 0.4 : -half - 1, maxX: sx > 0 ? half + 1 : -cw / 2 + 0.4, minZ: A.zFront, maxZ: pz, id: tag })
      }
      if (!open) {
        // construction fence + padlock sign at the gate, blocks the bridge
        const g = gateOf(a)
        const fz = g.z - 1.4
        for (let x = -cw / 2 + 0.4; x <= cw / 2 - 0.4; x += 0.9) b.rbox(0.8, 0.9, 0.1, x, 0.45, fz, Math.round(x / 0.9) % 2 ? PAL.brandYellow : PAL.dark, 0.03)
        b.rbox(0.5, 0.6, 0.12, 0, 1.25, fz, PAL.steelDark, 0.12)
        b.rbox(0.36, 0.3, 0.14, 0, 1.0, fz, PAL.brandYellow, 0.05)
        this.colliders.push({ minX: -cw / 2, maxX: cw / 2, minZ: fz - 0.3, maxZ: fz + 0.3, id: `${tag}:gate` })
      }
    }
    // plazas on free row slots: a small lounge so the island never looks empty
    for (const pl of PLAZAS) {
      if (pl.area !== a) continue
      const w = LAYOUT.roomW
      const dd = LAYOUT.roomD
      if (open) {
        this.tiles(b, pl.x - w / 2, pl.z - dd / 2, w, dd, PAL.pavingA, PAL.pavingB, PAL.curbSide)
        b.prop(P.rugOval, pl.x, pl.z, 0, 1.2, 0.02)
        b.prop(P.couch, pl.x, pl.z - 2.2)
        b.prop(P.armchair, pl.x - 2.8, pl.z, Math.PI / 2)
        b.prop(P.armchair, pl.x + 2.8, pl.z, -Math.PI / 2)
        b.prop(P.deskSmall, pl.x, pl.z, 0, 0.7)
        b.prop(P.cactus, pl.x - 4, pl.z - 3)
        b.prop(P.cactus, pl.x + 4, pl.z + 3)
        b.prop(P.lamp, pl.x + 4, pl.z - 3)
        this.colliders.push({ minX: pl.x - 1.6, maxX: pl.x + 1.6, minZ: pl.z - 2.9, maxZ: pl.z - 1.5, id: tag })
        this.colliders.push({ minX: pl.x - 0.5, maxX: pl.x + 0.5, minZ: pl.z - 0.5, maxZ: pl.z + 0.5, id: tag })
      } else {
        this.tiles(b, pl.x - w / 2, pl.z - dd / 2, w, dd, 0x2b3c66, 0x324674, PAL.blueprint)
      }
    }
    // the last island ends with the "coming soon" construction row
    if (a === 'lighthouse') {
      const tz = TEASER_ROW_Z
      for (let x = -half + 1; x <= half - 1; x += 1.2) b.rbox(1.0, 0.6, 0.08, x, 0.34, tz + LAYOUT.roomD / 2 - 0.3, Math.round(x / 1.2) % 2 ? PAL.brandYellow : PAL.dark, 0.03)
      b.prop(P.pallet, -6, tz - 1)
      b.prop(P.palletB, 6.5, tz - 0.5, 0.5)
      b.prop(P.barrel, -3.2, tz + 0.6, 0, 0.6)
      this.colliders.push({ minX: -half, maxX: half, minZ: tz - LAYOUT.roomD / 2, maxZ: tz + LAYOUT.roomD / 2 - 0.2, id: `${tag}:teaser` })
    }
    return b.build()
  }

  private tiles(b: StaticBatch, x0: number, z0: number, w: number, d: number, a: number, c: number, grout: number = PAL.grout): void {
    b.box(w, 0.08, d, x0 + w / 2, -0.01, z0 + d / 2, grout)
    const nx = Math.max(1, Math.round(w))
    const nz = Math.max(1, Math.round(d))
    const tw = w / nx
    const td = d / nz
    for (let ix = 0; ix < nx; ix++)
      for (let iz = 0; iz < nz; iz++)
        b.box(tw - 0.06, 0.08, td - 0.06, x0 + (ix + 0.5) * tw, 0.01, z0 + (iz + 0.5) * td, (ix + iz) % 2 ? a : c)
  }

  /** Wall along x: bevelled body, darker skirting, brand trim on top. */
  private wallX(b: StaticBatch, xa: number, xb: number, z: number, h: number, col: number, trim: number) {
    const w = xb - xa
    if (w <= 0.01) return
    const t = LAYOUT.wall
    b.rbox(w, h, t, (xa + xb) / 2, h / 2, z, col, 0.05)
    b.rbox(w + 0.02, 0.18, t + 0.06, (xa + xb) / 2, 0.09, z, PAL.wallSkirt, 0.04)
    b.rbox(w + 0.06, 0.12, t + 0.12, (xa + xb) / 2, h + 0.04, z, trim, 0.04)
    this.colliders.push({ minX: xa, maxX: xb, minZ: z - t / 2 - 0.05, maxZ: z + t / 2 + 0.05 })
  }

  private wallZ(b: StaticBatch, x: number, za: number, zb: number, h: number, col: number, trim: number) {
    const d = zb - za
    if (d <= 0.01) return
    const t = LAYOUT.wall
    b.rbox(t, h, d, x, h / 2, (za + zb) / 2, col, 0.05)
    b.rbox(t + 0.06, 0.18, d + 0.02, x, 0.09, (za + zb) / 2, PAL.wallSkirt, 0.04)
    b.rbox(t + 0.12, 0.12, d + 0.06, x, h + 0.04, (za + zb) / 2, trim, 0.04)
    this.colliders.push({ minX: x - t / 2 - 0.05, maxX: x + t / 2 + 0.05, minZ: za, maxZ: zb })
  }

  // ---------------------------------------------------------------- sign-up counter
  syncCounter(built: boolean): void {
    if (!built || this.counterMesh) return
    const P = this.p
    const b = new StaticBatch()
    const c = LAYOUT.counter
    b.prop(P.counter, c.x - 1.7, c.z, Math.PI)
    b.prop(P.counterDeco, c.x, c.z, Math.PI)
    b.prop(P.counter, c.x + 1.7, c.z, Math.PI)
    b.prop(P.jarA, c.x - 1.6, c.z + 0.1, 0, 0.6, 0.85)
    b.prop(P.bun, c.x + 1.4, c.z + 0.2, 0, 0.6, 0.85)
    b.prop(P.bun, c.x + 1.8, c.z, 0.6, 0.6, 0.85)
    this.counterMesh = new Mesh(b.build(), flatMat)
    this.counterMesh.castShadow = true
    this.counterMesh.receiveShadow = true
    this.scene.add(this.counterMesh)
    this.colliders.push({ minX: c.x - 2.6, maxX: c.x + 2.6, minZ: c.z - 0.8, maxZ: c.z + 0.8, id: 'counter' })
  }

  // ---------------------------------------------------------------- rooms
  syncRooms(s: GameState): void {
    for (const id of ROOM_ORDER) {
      const r = s.rooms[id]
      const key = `${r.unlocked}|${r.stations}|${r.crate}`
      const meshes = this.roomMeshes.get(id)
      if (meshes && meshes[0]?.userData.key === key) continue
      for (const m of meshes ?? []) {
        this.scene.remove(m)
        m.geometry.dispose()
      }
      for (let i = this.colliders.length - 1; i >= 0; i--) if (this.colliders[i]!.id?.startsWith(`room:${id}`)) this.colliders.splice(i, 1)
      const built = this.buildRoom(id, r.unlocked, r.stations, r.crate)
      const out: Mesh[] = []
      const m = new Mesh(built.solid, flatMat)
      m.castShadow = true
      m.receiveShadow = true
      m.userData = { key }
      out.push(m)
      if (built.ghost) {
        const g = new Mesh(built.ghost, blueprintMat)
        g.renderOrder = 2
        out.push(g)
      }
      for (const o of out) this.scene.add(o)
      this.roomMeshes.set(id, out)
    }
  }

  private buildRoom(id: RoomId, unlocked: boolean, slots: number, crate: boolean): { solid: BufferGeometry; ghost: BufferGeometry | null } {
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
    const [fa, fb] = ROOM_FLOOR[id] ?? [0x888888, 0x777777]
    let ghost: BufferGeometry | null = null
    const wallCol = unlocked ? PAL.wall : 0x8aa0c8
    const trim = unlocked ? def.accent : PAL.blueprintEdge
    if (unlocked) this.tiles(b, x - w / 2, top, w, d, fa, fb, shade(fa, 0.72))
    else this.tiles(b, x - w / 2, top, w, d, 0x2b3c66, 0x324674, PAL.blueprint)
    this.wallX(b, x - w / 2, x + w / 2, top, BACK_WALL, wallCol, trim)
    this.wallZ(b, outer, top, bottom, BACK_WALL * 0.6, wallCol, trim)
    this.wallX(b, x - w / 2, x + w / 2, bottom, STUB, wallCol, trim)
    this.wallZ(b, inner, top, z - doorHalf, 1.0, wallCol, trim)
    this.wallZ(b, inner, z + doorHalf, bottom, 1.0, wallCol, trim)

    if (unlocked) {
      this.furnish(b, id, slots, tag, crate)
    } else {
      // construction tape across the door + translucent blueprint of the furnished room
      for (let i = 0; i < 4; i++) b.rbox(0.08, 0.55, 0.62, inner, 0.32, z - doorHalf + 0.35 + i * 0.66, i % 2 ? PAL.brandYellow : PAL.dark, 0.03)
      this.colliders.push({ minX: inner - 0.25, maxX: inner + 0.25, minZ: z - doorHalf, maxZ: z + doorHalf, id: `${tag}:barrier` })
      const g = new StaticBatch()
      const before = this.colliders.length
      this.furnish(g, id, 3, `${tag}:ghost`, true)
      this.colliders.splice(before) // ghost furniture never blocks
      ghost = g.empty ? null : g.build()
      b.prop(this.p.palletB, x + side * 2.2, z - 1.6, 0.3, 0.8)
      b.prop(this.p.barrel, x - side * 1.2, z + 1.6, 0, 0.5)
    }
    for (let i = n; i < this.colliders.length; i++) this.colliders[i]!.id ??= tag
    return { solid: b.build(), ghost }
  }

  private furnish(b: StaticBatch, id: RoomId, slots: number, tag: string, crate = false) {
    const P = this.p
    const def = ROOMS[id]
    const { x, z, w, d } = def.rect
    const side = def.side
    const top = z - d / 2
    const outer = x + side * (w / 2)
    const col = (minX: number, maxX: number, minZ: number, maxZ: number) => this.colliders.push({ minX, maxX, minZ, maxZ, id: tag })
    const face = side > 0 ? -Math.PI / 2 : Math.PI / 2
    // brand stripe + room sign on the back wall
    b.rbox(w - 0.6, 0.16, 0.05, x, 1.3, top + 0.2, def.accent, 0.02)
    b.rbox(2.4, 0.56, 0.08, x, 1.9, top + 0.22, PAL.white, 0.04)
    b.rbox(2.2, 0.4, 0.04, x, 1.9, top + 0.27, def.accent, 0.02)

    if (id === 'mission_control') {
      b.prop(P.frameLarge, x - 1.4, top + 0.28, 0, 1.2, 1.3)
      b.prop(P.frameLargeB, x + 1.4, top + 0.28, 0, 1.2, 1.3)
      b.prop(P.deskLong, x - 1.8, top + 1.2)
      b.prop(P.deskLong, x + 1.8, top + 1.2)
      b.prop(P.lampTable, x - 2.6, top + 1.0, 0, 1, 0.85)
      b.prop(P.books, x + 2.4, top + 1.1, 0, 1, 0.85)
      b.prop(P.officeChair, x - 1.8, top + 2.2, Math.PI)
      b.prop(P.officeChair, x + 1.8, top + 2.2, Math.PI)
      col(x - 3.2, x + 3.2, top, top + 2.0)
      b.prop(P.rugStripes, x + side * 0.5, z + 1.4, 0, 0.9, 0.01)
      b.prop(P.cabinet, outer - side * 0.55, z + 1.6, face)
      col(Math.min(outer, outer - side * 1.0), Math.max(outer, outer - side * 1.0), z + 0.7, z + 2.5)
      b.prop(P.cactus, outer - side * 0.55, top + 0.5)
      return
    }
    // office desk (upgrades)
    const u = upgradeSpotOf(id)
    const dx = u.x + side * 0.9
    b.prop(P.deskSmall, dx, u.z, 0, 0.8)
    b.prop(P.lampTable, dx, u.z - 0.15, 0, 0.8, 0.68)
    b.rbox(0.32, 0.03, 0.42, dx + 0.15, 0.7, u.z + 0.12, PAL.white, 0.01)
    col(dx - 0.45, dx + 0.45, u.z - 0.45, u.z + 0.45)
    // cash table
    const cs = cashSpotOf(id)
    b.rbox(1.3, 0.06, 1.1, cs.x, 0.05, cs.z, 0x1f7a45, 0.03)
    // kit crate (supply source)
    if (crate) {
      const k = crateOf(id)
      b.prop(P.crateLid, k.x, k.z, 0.2, 0.42)
      b.prop(P.boxC, k.x + 0.05, k.z, 0.3, 0.7, 0.34)
      b.rbox(1.0, 0.04, 1.0, k.x, 0.03, k.z, PAL.kit, 0.02)
      col(k.x - 0.45, k.x + 0.45, k.z - 0.45, k.z + 0.45)
    }
    // decoration on the back + outer wall
    b.prop(P.shelfBig, outer - side * 1.4, top + 0.35, 0, 0.9, 1.2)
    b.prop(P.cactusSmall, outer - side * 0.5, top + 0.5)
    b.prop(P.cabinet, outer - side * 0.55, z + 0.2, face, 0.75)
    col(Math.min(outer, outer - side * 0.9), Math.max(outer, outer - side * 0.9), z - 0.6, z + 1.0)
    for (let i = 0; i < slots; i++) {
      const p = slotOf(id, i)
      this.station(b, id, p.x, p.z - 0.85, def.accent)
    }
  }

  /** One training station. Devices without a pack model (safe, laser rig) are bevelled builds. */
  private station(b: StaticBatch, id: RoomId, x: number, z: number, accent: number) {
    const P = this.p
    switch (id) {
      case 'vault':
        b.rbox(0.95, 1.05, 0.75, x, 0.53, z, PAL.steel, 0.08)
        b.rbox(0.8, 0.88, 0.06, x, 0.55, z + 0.39, 0xa9b4c6, 0.04)
        b.rbox(0.36, 0.36, 0.06, x - 0.1, 0.62, z + 0.44, accent, 0.17)
        b.rbox(0.12, 0.12, 0.1, x - 0.1, 0.62, z + 0.48, PAL.dark, 0.05)
        b.rbox(0.07, 0.34, 0.08, x + 0.28, 0.6, z + 0.47, 0xe8edf4, 0.03)
        b.rbox(1.02, 0.08, 0.82, x, 1.08, z, PAL.steelDark, 0.03)
        b.rbox(0.9, 0.1, 0.7, x, 0.05, z, PAL.steelDark, 0.03)
        break
      case 'laser':
        b.prop(P.targetStand, x, z, 0, 0.55)
        b.rbox(1.4, 0.04, 0.04, x, 0.4, z + 0.45, PAL.laser, 0.015)
        b.rbox(1.4, 0.04, 0.04, x, 0.75, z + 0.45, PAL.laser, 0.015)
        break
      case 'cipher':
        b.prop(P.deskSmall, x, z, 0, 0.75)
        b.prop(P.lampTable, x - 0.2, z, 0, 0.7, 0.64)
        b.prop(P.books, x + 0.2, z, 0.3, 0.6, 0.64)
        break
      default:
        b.prop(P.dummy, x, z, 0, 0.5)
    }
  }
}

function shade(hex: number, f: number): number {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f))
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f))
  const b = Math.min(255, Math.round((hex & 255) * f))
  return (r << 16) | (g << 8) | b
}
