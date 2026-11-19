/**
 * The academy as ONE walkable diorama (docs/ART_BIBLE.md): a raised plot with a light curb floating
 * in a dark void; bakery at the street, secret corridor behind it, cutaway rooms left/right.
 * Props: KayKit CC0 (baked to vertex colours). Architecture: bevelled boxes with skirting + trim.
 * Static parts are merged per room (one draw call each). Locked rooms are translucent blueprints.
 */
import {
  BoxGeometry, Color, DirectionalLight, Fog, Group, HemisphereLight, IcosahedronGeometry, Mesh, MeshBasicMaterial, MeshLambertMaterial, Scene, type BufferGeometry,
} from 'three'
import { StaticBatch } from '../render/geometry'
import { flatMat } from '../render/materials'
import { propGeometry } from '../render/assets'
import { PAL, ROOM_FLOOR } from '../render/palette'
import { MODELS, type ModelId } from '../config/models'
import {
  AREAS, AREA_ORDER, DOCKS, GARAGE, LAYOUT, PLAZAS, ROOMS, ROOM_AREA, ROOM_ORDER, TEASER_ROW_Z, slotOf, upgradeSpotOf, cashSpotOf, crateOf, gateOf,
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
const PUFF_GEO = new IcosahedronGeometry(0.22, 0)
const SPARK_GEO = new BoxGeometry(0.15, 0.15, 0.15)
const SPARK_MAT = new MeshBasicMaterial({ color: 0xf2b134 })

interface BuildFx {
  m: Mesh
  x: number
  z: number
  room: RoomId | null
  t: number
  landed: boolean
  puffs: Mesh[]
  sparks: Mesh[]
  dustMat: MeshBasicMaterial
  size: number
  /** Room items are temporary meshes baked into the room afterwards; the desk stays its own mesh. */
  baked: boolean
}

export class World {
  readonly scene = new Scene()
  readonly colliders: AABB[] = []
  readonly dynamic = new Group()
  readonly sun: DirectionalLight
  private roomMeshes = new Map<RoomId, Mesh[]>()
  private p = {} as Record<ModelId, BufferGeometry | null>
  private counterMesh: Mesh | null = null
  /** Items being built right now: excluded from the room bake until their animation ends. */
  private hold = new Map<RoomId, { stations: number; crate: boolean }>()
  private fx: BuildFx[] = []
  /** QA only: slow-motion factor for build animations. */
  fxScale = 1

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

  /** Baked prop geometry (for dynamic props such as cars). */
  propGeo(id: ModelId): BufferGeometry | null {
    return this.p[id] ?? null
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
    const plotMaxZ = LAYOUT.street.plotFront

    // bakery plot (raised, light curb) — the area islands are built in syncAreas()
    const pw = plotMaxX - plotMinX
    const pcx = (plotMinX + plotMaxX) / 2
    const bz0 = back - 0.4
    const bd = plotMaxZ - bz0
    this.plot(b, pcx, bz0 + bd / 2, pw, bd, true)
    void plotMinZ
    // sidewalk paving in front of the bakery (walkable), the road itself is built in buildStreet()
    const st = LAYOUT.street
    this.tiles(b, plotMinX, front, pw, st.road0 - front, PAL.pavingA, PAL.pavingB, PAL.curbSide)
    // edges of the street block: the player stays on the island
    this.colliders.push({ minX: plotMinX - 1, maxX: plotMaxX + 1, minZ: plotMaxZ - 0.2, maxZ: plotMaxZ + 1, id: 'street_edge' })
    this.colliders.push({ minX: plotMinX - 1, maxX: plotMinX + 0.2, minZ: front, maxZ: plotMaxZ, id: 'street_edge' })
    this.colliders.push({ minX: plotMaxX - 0.2, maxX: plotMaxX + 1, minZ: front, maxZ: plotMaxZ, id: 'street_edge' })

    // ---- bakery
    this.tiles(b, x0, back, bk.w, bk.d, PAL.bakeryA, PAL.bakeryB)
    this.wallX(b, x0, -LAYOUT.corridorWidth / 2, back, BACK_WALL, PAL.bakeryWall, PAL.bakeryTrim)
    this.wallX(b, LAYOUT.corridorWidth / 2, x0 + bk.w, back, BACK_WALL, PAL.bakeryWall, PAL.bakeryTrim)
    this.wallZ(b, x0, back, front, 1.4, PAL.bakeryWall, PAL.bakeryTrim)
    this.wallZ(b, x0 + bk.w, back, front, 1.4, PAL.bakeryWall, PAL.bakeryTrim)
    this.wallX(b, x0, -1.3, front, STUB, PAL.bakeryWall, PAL.bakeryTrim)
    this.wallX(b, 1.3, x0 + bk.w, front, STUB, PAL.bakeryWall, PAL.bakeryTrim)
    // striped awning stubs + shop sign over the street door
    for (let i = 0; i < 12; i++) if (Math.abs(x0 + (i + 0.5) * (bk.w / 12)) > 2.7) b.rbox(bk.w / 12 - 0.02, 0.14, 0.9, x0 + (i + 0.5) * (bk.w / 12), 0.55, front + 0.45, i % 2 ? PAL.white : PAL.coral, 0.04)
    // street door: a small full-height facade (pillars + lintel + sign + awning) so the
    // entrance reads at once, glass leaves folded open flat against the pillars
    const DOOR = 0x7a3e2b
    const H = 2.7
    for (const sd of [-1, 1]) {
      const cx = sd * 2.0
      b.rbox(1.24, H, 0.36, cx, H / 2, front, PAL.bakeryWall, 0.05)
      b.rbox(1.3, 0.2, 0.42, cx, 0.1, front, PAL.wallSkirt, 0.04)
      b.rbox(0.2, H, 0.44, sd * 1.36, H / 2, front, DOOR, 0.05)
      // open leaf: frame + glass + handle, lying on the pillar's street face
      b.rbox(1.1, 2.15, 0.07, cx + sd * 0.02, 1.1, front + 0.24, DOOR, 0.03)
      b.rbox(0.86, 1.75, 0.08, cx + sd * 0.02, 1.2, front + 0.25, 0xbfe3ff, 0.02)
      b.rbox(0.06, 0.34, 0.1, cx - sd * 0.38, 1.05, front + 0.3, PAL.brandYellow, 0.02)
    }
    b.rbox(5.3, 0.5, 0.44, 0, H + 0.2, front, DOOR, 0.06)
    b.rbox(4.6, 0.8, 0.2, 0, H + 0.85, front + 0.08, DOOR, 0.06)
    b.rbox(4.3, 0.56, 0.06, 0, H + 0.85, front + 0.2, PAL.white, 0.03)
    b.rbox(3.8, 0.1, 0.07, 0, H + 0.68, front + 0.23, PAL.coral, 0.02)
    for (let i = 0; i < 5; i++) b.rbox(0.62, 0.1, 0.8, -1.24 + i * 0.62, H - 0.15, front + 0.55, i % 2 ? PAL.white : PAL.coral, 0.03)
    b.rbox(2.3, 0.03, 1.1, 0, 0.02, front + 0.7, PAL.coral, 0.02)
    b.rbox(2.0, 0.035, 0.85, 0, 0.025, front + 0.7, 0x9c3b2f, 0.02)

    // back wall: pastry kitchen in the left corner; the middle of the wall is the hidden
    // passage into the courtyard (bread shelves slide aside, see syncSecretDoor)
    const pw2 = LAYOUT.corridorWidth / 2
    b.prop(P.fridge, -11.7, back + 1.05)
    b.prop(P.shelfPaper, -10.5, back + 0.35, 0, 1, 1.2)
    b.prop(P.stove, -9.2, back + 1.05)
    b.prop(P.oven, -7.5, back + 1.0, 0, 0.75)
    this.colliders.push({ minX: -12.4, maxX: -6.6, minZ: back, maxZ: back + 2 })
    // crates of buns by the door, menu sign
    b.prop(P.crateBuns, -3.4, front - 0.9, 0.3, 0.45)
    b.prop(P.crateBuns, -3.4, front - 0.9, 0.1, 0.45, 0.34)
    b.prop(P.menu, 3.4, front - 0.6, 0.4)
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
    // posts framing the passage
    for (const sx of [-1, 1]) {
      b.rbox(0.5, BACK_WALL + 0.3, 0.5, sx * (pw2 + 0.05), (BACK_WALL + 0.3) / 2, back, 0x7a3e2b, 0.06)
      b.rbox(0.62, 0.16, 0.62, sx * (pw2 + 0.05), BACK_WALL + 0.36, back, PAL.bakeryTrim, 0.04)
    }

    return b.build()
  }

  /** Street + harbour skyline in front of the plot (outside the walkable area). */
  /** Walkable street on the island: road with lanes, curb, taxi stop; harbour skyline beyond. */
  private buildStreet(): BufferGeometry {
    const b = new StaticBatch()
    const P = this.p
    const st = LAYOUT.street
    const half = LAYOUT.corridorWidth / 2 + LAYOUT.roomW + 0.8
    const rd = st.road1 - st.road0
    // asphalt + curbs + lane dashes + zebra crossing to the bakery door
    b.rbox(half * 2, 0.06, rd, 0, 0.0, st.road0 + rd / 2, PAL.road, 0.02)
    b.rbox(half * 2, 0.16, 0.25, 0, 0.06, st.road0, PAL.curbTop, 0.04)
    b.rbox(half * 2, 0.16, 0.25, 0, 0.06, st.road1, PAL.curbTop, 0.04)
    for (let x = -half + 1; x < half - 1; x += 2.4) if (Math.abs(x) > 2.2) b.rbox(1.2, 0.02, 0.14, x, 0.04, (st.laneIn + st.laneOut) / 2, PAL.roadLine, 0.01)
    // zebra: bars run along the road, spaced across it (walking direction = z)
    const bars = Math.floor((rd - 0.6) / 0.8)
    for (let i = 0; i < bars; i++) b.rbox(3.0, 0.02, 0.42, 0, 0.035, st.road0 + 0.5 + i * 0.8 + 0.21, PAL.white, 0.01)
    // taxi stop: bench, sign, shelter
    const sx = st.stopX
    const sz = st.road0 - 1.1
    b.rbox(3.2, 0.1, 1.4, sx, 2.2, sz, PAL.brand, 0.05)
    b.rbox(0.1, 2.2, 0.1, sx - 1.5, 1.1, sz - 0.6, PAL.steelDark, 0.03)
    b.rbox(0.1, 2.2, 0.1, sx + 1.5, 1.1, sz - 0.6, PAL.steelDark, 0.03)
    b.rbox(3.0, 1.4, 0.06, sx, 1.2, sz - 0.62, 0xbfe3ff, 0.02)
    b.prop(P.bench, sx, sz - 0.2, Math.PI)
    b.rbox(0.12, 2.6, 0.12, sx + 2.2, 1.3, sz + 0.2, PAL.steelDark, 0.04)
    b.rbox(0.8, 0.8, 0.08, sx + 2.2, 2.5, sz + 0.2, PAL.brandYellow, 0.2)
    this.colliders.push({ minX: sx - 1.6, maxX: sx + 1.6, minZ: sz - 0.8, maxZ: sz + 0.1, id: 'stop' })
    // sidewalk furniture
    for (const x of [-12, 6.5, 12]) {
      b.prop(P.streetlight, x, st.road0 - 0.5)
      this.colliders.push({ minX: x - 0.2, maxX: x + 0.2, minZ: st.road0 - 0.7, maxZ: st.road0 - 0.3, id: 'lamp' })
    }
    b.prop(P.hydrant, 4.2, st.road0 - 0.5)
    b.prop(P.bush, -5, st.road0 - 0.6)
    b.prop(P.bush, 9.4, st.road0 - 0.6)
    b.prop(P.trash, 8.2, st.road0 - 0.5)
    // across the street (outside the island): parked car + harbour skyline
    b.prop(P.dumpster, 13.5, st.road1 + 0.8, 0, 1, -0.6)
    const blds: ModelId[] = ['buildingA', 'buildingB', 'buildingC', 'buildingD']
    for (let i = 0; i < 8; i++) b.prop(P[blds[i % 4]!], -24 + i * 7, st.road1 + 7, Math.PI, 1, -0.6)
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
      const m = new Mesh(a === 'harbor' ? this.buildDocks(open) : this.buildArea(a, open), flatMat)
      for (let i = n; i < this.colliders.length; i++) this.colliders[i]!.id ??= `area:${a}`
      m.receiveShadow = true
      m.castShadow = true
      m.userData = { open }
      this.scene.add(m)
      this.areaMeshes.set(a, m)
    }
    this.syncGarage(s.areas.harbor, this.garage !== null)
    this.ensureCrane()
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
    if (a === 'hq') {
      // east edge opens where the garage hall leads out to the docks
      const gz0 = GARAGE.z - GARAGE.doorHalf
      const gz1 = GARAGE.z + GARAGE.doorHalf
      this.colliders.push({ minX: half - 0.2, maxX: half + 1, minZ: A.zBack, maxZ: gz0, id: tag })
      this.colliders.push({ minX: half - 0.2, maxX: half + 1, minZ: gz1, maxZ: A.zFront, id: tag })
      this.buildGarage(b)
    } else this.colliders.push({ minX: half - 0.2, maxX: half + 1, minZ: A.zBack, maxZ: A.zFront, id: tag })
    const i = AREA_ORDER.indexOf(a)
    if (i > 0) {
      // bridge from the previous island (walkway width = corridor), void on both sides
      const pz = AREAS[A.from].zBack
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
    this.counterMesh = new Mesh(b.build().translate(-c.x, 0, -c.z), flatMat)
    this.counterMesh.position.set(c.x, 0, c.z)
    this.counterMesh.castShadow = true
    this.counterMesh.receiveShadow = true
    this.scene.add(this.counterMesh)
    this.colliders.push({ minX: c.x - 2.6, maxX: c.x + 2.6, minZ: c.z - 0.8, maxZ: c.z + 0.8, id: 'counter' })
  }

  // ---------------------------------------------------------------- rooms
  syncRooms(s: GameState): void {
    for (const id of ROOM_ORDER) {
      const r0 = s.rooms[id]
      const h = this.hold.get(id)
      const r = h ? { ...r0, stations: Math.min(r0.stations, h.stations), crate: r0.crate && h.crate } : r0
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
    if (id === 'mission_control') return { solid: this.buildHub(), ghost: null }
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
    // harbour buildings: shipping container, fish market, boathouse
    const DOCK_LOOK: Partial<Record<RoomId, [number, number]>> = {
      cipher: [0xc8553d, 0x8a3a2a],
      disguise: [0xdfe8ee, 0x2f6fb0],
      gadget: [0x9b6b43, 0x5e3f26],
    }
    const look = ROOM_AREA[id] === 'harbor' ? DOCK_LOOK[id] : undefined
    const wallCol = unlocked ? (look?.[0] ?? PAL.wall) : 0x8aa0c8
    const trim = unlocked ? (look?.[1] ?? def.accent) : PAL.blueprintEdge
    if (unlocked) this.tiles(b, x - w / 2, top, w, d, fa, fb, shade(fa, 0.72))
    else this.tiles(b, x - w / 2, top, w, d, 0x2b3c66, 0x324674, PAL.blueprint)
    this.wallX(b, x - w / 2, x + w / 2, top, BACK_WALL, wallCol, trim)
    this.wallZ(b, outer, top, bottom, BACK_WALL * 0.6, wallCol, trim)
    this.wallX(b, x - w / 2, x + w / 2, bottom, STUB, wallCol, trim)
    this.wallZ(b, inner, top, z - doorHalf, 1.0, wallCol, trim)
    this.wallZ(b, inner, z + doorHalf, bottom, 1.0, wallCol, trim)

    if (unlocked && id === 'cipher') {
      // corrugated container ribs on the back and outer wall
      for (let i = 0; i < 19; i++) b.box(0.08, BACK_WALL - 0.3, 0.12, x - w / 2 + 0.3 + i * 0.52, (BACK_WALL - 0.3) / 2 + 0.1, top - 0.18, 0x9e3f2c)
    }
    if (unlocked && id === 'disguise') {
      // striped market awning over the street door
      for (let i = 0; i < 6; i++) b.rbox(0.9, 0.1, 0.55, inner - side * 0.45, 1.35 - i * 0, z - 2.5 + i * 1.0, i % 2 ? PAL.white : 0x2f6fb0, 0.03)
    }
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

  // ---------------------------------------------------------------- garage hall (HQ -> docks)
  private buildGarage(b: StaticBatch): void {
    const P = this.p
    const { x0, x1, z, d, doorHalf } = GARAGE
    const top = z - d / 2
    const bottom = z + d / 2
    const wall = 0x8d97a6
    const trim = PAL.brandYellow
    // concrete floor with hazard stripes at both doors
    this.tiles(b, x0, top, x1 - x0, d, 0x9aa3b0, 0x8c95a3, 0x6d7685)
    for (const gx of [x0 + 0.5, x1 - 0.5])
      for (let i = 0; i < 5; i++) b.box(0.5, 0.02, 0.5, gx, 0.06, z - doorHalf + 0.3 + i * 0.6, i % 2 ? PAL.dark : PAL.brandYellow)
    this.wallX(b, x0, x1, top, BACK_WALL, wall, trim)
    this.wallX(b, x0, x1, bottom, STUB, wall, trim)
    for (const wx of [x0, x1]) {
      this.wallZ(b, wx, top, z - doorHalf, BACK_WALL * 0.8, wall, trim)
      this.wallZ(b, wx, z + doorHalf, bottom, BACK_WALL * 0.8, wall, trim)
      // door frame posts + lintel
      for (const dz of [-doorHalf, doorHalf]) b.rbox(0.36, 2.6, 0.36, wx, 1.3, z + dz, PAL.steelDark, 0.05)
      b.rbox(0.4, 0.3, doorHalf * 2 + 0.4, wx, 2.6, z, PAL.steelDark, 0.05)
    }
    // delivery van + workbench + tyres
    b.prop(P.wagon, x0 + 4.8, top + 1.9, Math.PI / 2, 1)
    this.colliders.push({ minX: x0 + 2.6, maxX: x0 + 7.0, minZ: top + 0.8, maxZ: top + 3.0, id: 'garage' })
    b.prop(P.deskLong, x1 - 1.6, bottom - 1.2, 0, 0.8)
    b.prop(P.boxA, x1 - 1.2, bottom - 1.1, 0.3, 0.6, 0.62)
    this.colliders.push({ minX: x1 - 2.6, maxX: x1 - 0.6, minZ: bottom - 1.7, maxZ: bottom - 0.7, id: 'garage' })
    b.prop(P.barrel, x0 + 1.0, bottom - 1.0, 0, 0.55)
    b.prop(P.barrel, x0 + 1.7, bottom - 0.9, 0.4, 0.55)
  }

  private garage: { m: Mesh; t: number; open: boolean } | null = null

  /** Roll-up door on the courtyard side of the garage = the harbor gate. Rolls up when opened. */
  syncGarage(open: boolean, animate: boolean): void {
    const { x0, z, doorHalf } = GARAGE
    if (!this.garage) {
      const b = new StaticBatch()
      const h = 2.45
      // geometry hangs from its top edge (y=0) so scaling y rolls it up
      b.rbox(0.14, h, doorHalf * 2, 0, -h / 2, 0, 0xc9cfd8, 0.03)
      for (let i = 0; i < 9; i++) b.rbox(0.18, 0.06, doorHalf * 2 - 0.04, 0, -0.2 - i * 0.26, 0, 0x9aa3b0, 0.02)
      b.rbox(0.2, 0.36, 0.5, 0, -h + 0.5, 0, PAL.brandYellow, 0.04)
      const m = new Mesh(b.build(), flatMat)
      m.position.set(x0, 2.5, z)
      m.castShadow = true
      this.scene.add(m)
      this.garage = { m, t: open ? 1 : 0, open }
    }
    const g = this.garage
    g.open = open
    if (!animate) g.t = open ? 1 : 0
    this.placeGarage()
    for (let i = this.colliders.length - 1; i >= 0; i--) if (this.colliders[i]!.id === 'garage_door') this.colliders.splice(i, 1)
    if (!open) this.colliders.push({ minX: x0 - 0.3, maxX: x0 + 0.3, minZ: z - doorHalf, maxZ: z + doorHalf, id: 'garage_door' })
  }

  private placeGarage(): void {
    const g = this.garage
    if (!g) return
    const k = g.t
    const e = k >= 1 ? 1 : 1 - Math.pow(1 - k, 2)
    g.m.scale.y = Math.max(0.06, 1 - e * 0.94)
  }

  // ---------------------------------------------------------------- harbor docks
  private buildDocks(open: boolean): BufferGeometry {
    const P = this.p
    const b = new StaticBatch()
    const D0 = DOCKS
    const tag = 'area:harbor'
    const cx = (D0.x0 + D0.x1) / 2
    const cz = (D0.z0 + D0.z1) / 2
    const w = D0.x1 - D0.x0
    const d = D0.z1 - D0.z0
    // water all around the docks (always visible, also as a teaser while the gate is closed)
    b.box(90, 0.1, 90, D0.x0 + 40, -0.75, cz - 6, 0x2f8f9e)
    for (let i = 0; i < 26; i++) {
      const wx = D0.x0 + 3 + ((i * 7.3) % 60)
      const wz = D0.z0 - 14 + ((i * 11.7) % 52)
      if (wx > D0.x0 && wx < D0.x1 + 1 && wz > D0.z0 - 1 && wz < D0.z1 + 1) continue
      b.box(1.6 + (i % 3) * 0.6, 0.02, 0.12, wx, -0.68, wz, 0x7fd0da)
    }
    // pier slab: concrete quay with timber edge
    b.rbox(w + 0.2, 1.3, d + 0.2, cx, -0.66, cz, open ? 0x5e6878 : 0x1b2440, 0.15)
    b.rbox(w + 0.5, 0.12, d + 0.5, cx, -0.04, cz, open ? 0x8b5a3c : PAL.blueprintEdge, 0.05)
    if (open) this.tiles(b, D0.x0, D0.z0, w, d, 0xb9c0c9, 0xadb5bf, 0x8f98a5)
    else this.tiles(b, D0.x0, D0.z0, w, d, 0x2b3c66, 0x324674, PAL.blueprint)
    // dock street: darker asphalt band with a dashed centre line
    const sx0 = D0.street.x0
    const sx1 = D0.street.x1
    if (open) {
      b.box(sx1 - sx0, 0.04, d - 0.6, (sx0 + sx1) / 2, 0.07, cz, 0x6a7282)
      for (let z = D0.z0 + 1; z < D0.z1 - 1; z += 2.2) b.box(0.14, 0.02, 1.1, (sx0 + sx1) / 2, 0.1, z, PAL.white)
    }
    // container stacks along the west side of the street (not in front of the garage exit)
    const cols = [0xc8553d, 0x2f6fb0, 0x3f9a5c, 0xe0a030, 0x8a4a6b]
    let ci = 0
    for (const [z0, z1] of [[D0.z0 + 0.6, GARAGE.z - GARAGE.doorHalf - 1.2], [GARAGE.z + GARAGE.doorHalf + 1.2, D0.z1 - 0.6]] as const) {
      for (let z = z0 + 1.3; z + 1.3 <= z1; z += 2.7) {
        const c = open ? cols[ci++ % cols.length]! : 0x324674
        b.rbox(1.25, 1.3, 2.55, sx0 + 0.7, 0.68, z, c, 0.04)
        for (let r = 0; r < 6; r++) b.box(1.27, 1.1, 0.06, sx0 + 0.7, 0.68, z - 1.05 + r * 0.42, shade(c, 0.82))
        if (ci % 2) b.rbox(1.25, 1.3, 2.55, sx0 + 0.7, 2.0, z + 0.1, open ? cols[(ci + 2) % cols.length]! : 0x324674, 0.04)
        this.colliders.push({ minX: sx0, maxX: sx0 + 1.4, minZ: z - 1.3, maxZ: z + 1.3, id: tag })
      }
    }
    // quay behind the buildings: bollards, lamp posts, crates, crane base
    const qx = D0.quayX
    for (let z = D0.z0 + 1.5; z < D0.z1 - 0.5; z += 4) {
      b.cyl(0.18, 0.22, 0.5, D0.x1 - 0.4, 0.28, z, PAL.steelDark, 8)
      b.cyl(0.26, 0.26, 0.08, D0.x1 - 0.4, 0.55, z, PAL.steelDark, 8)
    }
    for (const z of [-22, -6, 5]) {
      b.prop(P.streetlight, qx, z, Math.PI / 2, 0.9)
      this.colliders.push({ minX: qx - 0.2, maxX: qx + 0.2, minZ: z - 0.2, maxZ: z + 0.2, id: tag })
    }
    b.prop(P.pallet, qx, -2, 0.2)
    b.prop(P.boxB, qx - 0.2, -2, 0.1, 0.7, 0.3)
    b.prop(P.barrel, qx + 0.6, -10.6, 0, 0.6)
    this.colliders.push({ minX: qx - 0.9, maxX: qx + 0.9, minZ: -2.8, maxZ: -1.2, id: tag })
    // crane rails + legs (the rotating jib is a separate animated mesh)
    const cr = D0.crane
    for (const dz of [-3.4, 3.4]) b.box(3.2, 0.06, 0.16, cr.x, 0.08, cr.z + dz, PAL.steelDark)
    for (const [dx, dz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]] as const) b.rbox(0.3, 6.2, 0.3, cr.x + dx, 3.1, cr.z + dz, open ? PAL.brandYellow : 0x3a4a72, 0.05)
    b.rbox(2.7, 0.4, 2.7, cr.x, 6.2, cr.z, open ? PAL.brandYellow : 0x3a4a72, 0.06)
    this.colliders.push({ minX: cr.x - 1.4, maxX: cr.x + 1.4, minZ: cr.z - 1.4, maxZ: cr.z + 1.4, id: tag })
    // moored boats
    for (const [bx, bz, c] of [[D0.x1 + 3.6, -18, 0xe8edf4], [D0.x1 + 3.2, -3, 0xc8553d], [D0.x1 + 4.2, 8, 0x2f6fb0]] as const) {
      b.rbox(2.2, 0.8, 5.2, bx, -0.4, bz, c, 0.35)
      b.rbox(1.9, 0.12, 4.8, bx, 0.02, bz, PAL.wood, 0.05)
      b.rbox(1.3, 0.9, 1.5, bx, 0.5, bz + 0.6, 0xf3e2c4, 0.1)
    }
    // edges: water on three sides, the HQ plot on the west
    this.colliders.push({ minX: D0.x0, maxX: D0.x1 + 1, minZ: D0.z0 - 1, maxZ: D0.z0 + 0.15, id: tag })
    this.colliders.push({ minX: D0.x0, maxX: D0.x1 + 1, minZ: D0.z1 - 0.15, maxZ: D0.z1 + 1, id: tag })
    this.colliders.push({ minX: D0.x1 - 0.15, maxX: D0.x1 + 1, minZ: D0.z0 - 1, maxZ: D0.z1 + 1, id: tag })
    return b.build()
  }

  private crane: Group | null = null

  /** Crane jib swinging a container over the quay (ambient motion, one extra mesh). */
  private ensureCrane(): void {
    if (this.crane) return
    const b = new StaticBatch()
    b.rbox(9, 0.5, 0.6, -2.2, 0, 0, PAL.brandYellow, 0.06)
    b.rbox(2.2, 1.0, 1.4, 1.6, 0.6, 0, PAL.steelDark, 0.08)
    b.rbox(1.6, 1.0, 1.3, -0.2, 0.8, 0, 0x2f6fb0, 0.1)
    b.box(0.05, 2.2, 0.05, -6.0, -1.2, 0, PAL.dark)
    b.rbox(2.4, 1.1, 1.1, -6.0, -2.8, 0, 0xc8553d, 0.05)
    const g = new Group()
    const m = new Mesh(b.build(), flatMat)
    m.castShadow = true
    g.add(m)
    g.position.set(DOCKS.crane.x, 6.65, DOCKS.crane.z)
    this.scene.add(g)
    this.crane = g
  }

  // ---------------------------------------------------------------- courtyard hub
  /** Mission Control as an open-air landmark: paved ring path, holo map table, satellite dish. */
  private buildHub(): BufferGeometry {
    const P = this.p
    const b = new StaticBatch()
    const r = ROOMS.mission_control.rect
    const hx = r.x
    const hz = r.z
    const tag = 'room:mission_control'
    const col = (minX: number, maxX: number, minZ: number, maxZ: number) => this.colliders.push({ minX, maxX, minZ, maxZ, id: tag })
    // ring path (the courtyard loop) with a curb on both sides
    const N = 28
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2
      const am = a0 + Math.PI / N
      const rr = 4.6
      b.box(1.12, 0.06, 1.3, hx + Math.cos(am) * rr, 0.06, hz + Math.sin(am) * rr, i % 2 ? PAL.pavingA : PAL.pavingB, -am + Math.PI / 2)
      b.box(1.1, 0.12, 0.12, hx + Math.cos(am) * (rr + 0.72), 0.08, hz + Math.sin(am) * (rr + 0.72), PAL.curbTop, -am + Math.PI / 2)
      b.box(0.95, 0.12, 0.12, hx + Math.cos(am) * (rr - 0.72), 0.08, hz + Math.sin(am) * (rr - 0.72), PAL.curbTop, -am + Math.PI / 2)
    }
    // lawn inside the ring
    b.cyl(3.85, 3.85, 0.06, hx, 0.05, hz, 0x6fbf5e, 28)
    // planters on the diagonals
    for (const [dx, dz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]] as const) {
      b.rbox(0.9, 0.45, 0.9, hx + dx, 0.24, hz + dz, PAL.wood, 0.08)
      b.prop(P.bush, hx + dx, hz + dz, (dx + dz) * 0.3, 0.8, 0.42)
    }
    // dais + holo table
    b.cyl(1.7, 1.85, 0.22, hx, 0.13, hz, PAL.steelDark, 20)
    b.cyl(1.15, 1.25, 0.78, hx, 0.62, hz, PAL.steel, 20)
    b.cyl(1.2, 1.2, 0.08, hx, 1.04, hz, PAL.dark, 20)
    b.cyl(1.02, 1.02, 0.03, hx, 1.09, hz, 0x46c2cb, 20)
    col(hx - 1.5, hx + 1.5, hz - 1.5, hz + 1.5)
    // two operator consoles facing the table
    for (const sx of [-1, 1]) {
      b.rbox(0.9, 0.85, 0.55, hx + sx * 2.3, 0.43, hz - 0.6, PAL.steelDark, 0.08)
      b.rbox(0.8, 0.5, 0.08, hx + sx * 2.3, 1.05, hz - 0.85, 0x2a7a87, 0.04)
      b.rbox(0.66, 0.36, 0.06, hx + sx * 2.3, 1.06, hz - 0.8, 0x7cd6e0, 0.03)
      col(hx + sx * 2.3 - 0.5, hx + sx * 2.3 + 0.5, hz - 0.9, hz - 0.3)
    }
    // satellite dish behind the table
    const dz = hz - 2.4
    b.cyl(0.12, 0.16, 2.2, hx, 1.1, dz, PAL.steelDark, 8)
    b.cyl(0.95, 0.35, 0.28, hx, 2.35, dz + 0.1, 0xe8edf4, 18, -0.75)
    b.cyl(0.05, 0.05, 0.8, hx, 2.6, dz + 0.45, PAL.steelDark, 6, -0.75)
    b.sphere(0.1, hx, 2.86, dz + 0.72, PAL.coral)
    col(hx - 0.3, hx + 0.3, dz - 0.3, dz + 0.3)
    // lamp posts on the ring
    for (const [dx, dz2] of [[-4.6, 0], [4.6, 0]] as const) {
      b.prop(P.streetlight, hx + dx, hz + dz2, dx > 0 ? Math.PI : 0, 0.85)
      col(hx + dx - 0.2, hx + dx + 0.2, hz + dz2 - 0.2, hz + dz2 + 0.2)
    }
    return b.build()
  }

  private holo: Mesh | null = null

  /** Rotating hologram of the world map above the hub table (one extra draw call). */
  private ensureHolo(): void {
    if (this.holo) return
    const r = ROOMS.mission_control.rect
    const g = new StaticBatch()
    g.cyl(0.9, 0.9, 0.02, 0, 0, 0, 0x7cd6e0, 24)
    for (let i = 0; i < 5; i++) g.rbox(0.3 + (i % 3) * 0.12, 0.05, 0.2 + (i % 2) * 0.14, Math.cos(i * 1.3) * 0.45, 0.04, Math.sin(i * 1.3) * 0.45, 0xf2b134, 0.02)
    g.sphere(0.07, 0.3, 0.12, -0.2, PAL.coral)
    this.holo = new Mesh(g.build(), new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false }))
    this.holo.position.set(r.x, 1.45, r.z)
    this.scene.add(this.holo)
  }

  // ---------------------------------------------------------------- secret door
  private secret: { l: Mesh; r: Mesh; t: number; open: boolean } | null = null

  private shelfHalf(): BufferGeometry {
    const P = this.p
    const b = new StaticBatch()
    const w = LAYOUT.corridorWidth / 2 - 0.1
    // open shelf facing the bakery (+z): back panel, side posts, top + plinth
    b.rbox(w, 2.35, 0.1, 0, 1.18, -0.2, 0x7a3e2b, 0.03)
    b.rbox(w - 0.24, 2.1, 0.04, 0, 1.18, -0.14, 0xf3e2c4, 0.02)
    for (const sx of [-1, 1]) b.rbox(0.14, 2.35, 0.5, sx * (w / 2 - 0.07), 1.18, 0, 0x7a3e2b, 0.04)
    b.rbox(w, 0.12, 0.52, 0, 2.3, 0, 0x7a3e2b, 0.04)
    b.rbox(w, 0.14, 0.52, 0, 0.07, 0, 0x5e2f20, 0.04)
    for (const y of [0.55, 1.2, 1.85]) {
      b.rbox(w - 0.2, 0.06, 0.4, 0, y, 0.02, 0x9b5a3c, 0.02)
      // chunky loaves, baguettes and jars so the wall reads as a bakery shelf from far away
      const n = 6
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + 0.55 + i * ((w - 1.1) / (n - 1))
        const k = (i + Math.round(y * 10)) % 4
        if (k === 0) b.prop(P.jarA, x, 0.05, 0, 0.55, y + 0.03)
        else if (k === 1) {
          b.rbox(0.62, 0.16, 0.22, x, y + 0.11, 0.05, 0xc9853f, 0.08, 0.15)
          b.rbox(0.5, 0.05, 0.12, x, y + 0.2, 0.05, 0xe8b46a, 0.025, 0.15)
        } else {
          b.rbox(0.42, 0.26, 0.3, x, y + 0.16, 0.04, 0xb8702f, 0.12)
          b.rbox(0.3, 0.06, 0.2, x, y + 0.3, 0.04, 0xe0a55c, 0.03)
        }
      }
    }
    return b.build()
  }

  /** The bread-shelf wall that hides the courtyard; slides apart once the sign-up desk exists. */
  syncSecretDoor(open: boolean, animate: boolean): void {
    const back = LAYOUT.bakery.z - LAYOUT.bakery.d / 2
    if (!this.secret) {
      const g = this.shelfHalf()
      const l = new Mesh(g, flatMat)
      const r = new Mesh(g, flatMat)
      for (const m of [l, r]) {
        m.castShadow = true
        m.receiveShadow = true
        m.position.z = back - 0.32
        this.scene.add(m)
      }
      this.secret = { l, r, t: open ? 1 : 0, open }
      this.ensureHolo()
    }
    const sd = this.secret
    sd.open = open
    if (!animate) sd.t = open ? 1 : 0
    this.placeSecret()
    for (let i = this.colliders.length - 1; i >= 0; i--) if (this.colliders[i]!.id === 'secret_door') this.colliders.splice(i, 1)
    const half = LAYOUT.corridorWidth / 2
    if (!open) this.colliders.push({ minX: -half, maxX: half, minZ: back - 0.65, maxZ: back + 0.1, id: 'secret_door' })
    else
      for (const sx of [-1, 1])
        this.colliders.push({ minX: sx > 0 ? half : -half * 2 - 0.2, maxX: sx > 0 ? half * 2 + 0.2 : -half, minZ: back - 0.65, maxZ: back, id: 'secret_door' })
  }

  private placeSecret(): void {
    const sd = this.secret
    if (!sd) return
    const half = LAYOUT.corridorWidth / 2
    const k = sd.t
    // ease out with a small overshoot
    const e = k >= 1 ? 1 : 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.04
    const off = (half - 0.05) / 2 + e * half
    sd.l.position.x = -off
    sd.r.position.x = off
  }

  private updateSecret(dt: number): void {
    const sd = this.secret
    if (!sd) return
    const want = sd.open ? 1 : 0
    if (sd.t !== want) {
      sd.t = want > sd.t ? Math.min(1, sd.t + dt / 1.3) : Math.max(0, sd.t - dt / 1.3)
      this.placeSecret()
    }
    if (this.holo) this.holo.rotation.y += dt * 0.6
    const g = this.garage
    if (g) {
      const want2 = g.open ? 1 : 0
      if (g.t !== want2) {
        g.t = want2 > g.t ? Math.min(1, g.t + dt / 1.6) : Math.max(0, g.t - dt / 1.6)
        this.placeGarage()
      }
    }
    if (this.crane) {
      this.craneT += dt
      this.crane.rotation.y = Math.PI / 2 + Math.sin(this.craneT * 0.25) * 0.9
    }
  }

  private craneT = 0

  // ---------------------------------------------------------------- build animation
  /**
   * Play the "just built" sequence for a station / crate (or the sign-up desk): the item drops
   * in, squashes on landing, springs back, kicks up dust and sparks, then joins the room bake.
   */
  playBuild(s: GameState, kind: 'station' | 'crate' | 'counter', room: RoomId | null): void {
    if (kind === 'counter') {
      if (this.counterMesh) this.startFx(this.counterMesh, LAYOUT.counter.x, LAYOUT.counter.z, null, 2.6)
      return
    }
    if (!room) return
    const r = s.rooms[room]
    const prev = this.hold.get(room) ?? { stations: r.stations, crate: r.crate }
    const b = new StaticBatch()
    let cx: number
    let cz: number
    if (kind === 'station') {
      const p = slotOf(room, r.stations - 1)
      cx = p.x
      cz = p.z - 0.85
      this.station(b, room, cx, cz, ROOMS[room].accent)
      this.hold.set(room, { stations: Math.min(prev.stations, r.stations - 1), crate: prev.crate })
    } else {
      const k = crateOf(room)
      cx = k.x
      cz = k.z
      b.prop(this.p.crateLid, k.x, k.z, 0.2, 0.42)
      b.prop(this.p.boxC, k.x + 0.05, k.z, 0.3, 0.7, 0.34)
      b.rbox(1.0, 0.04, 1.0, k.x, 0.03, k.z, PAL.kit, 0.02)
      this.hold.set(room, { stations: prev.stations, crate: false })
    }
    this.syncRooms(s)
    if (b.empty) return
    const m = new Mesh(b.build().translate(-cx, 0, -cz), flatMat)
    m.position.set(cx, 0, cz)
    m.castShadow = true
    this.scene.add(m)
    this.startFx(m, cx, cz, room, 1.2)
  }

  private startFx(m: Mesh, x: number, z: number, room: RoomId | null, size: number): void {
    const dustMat = new MeshBasicMaterial({ color: 0xfff3e0, transparent: true, opacity: 0.9, depthWrite: false })
    const puffs: Mesh[] = []
    for (let i = 0; i < 12; i++) {
      const p = new Mesh(PUFF_GEO, dustMat)
      p.visible = false
      p.userData.a = (i / 12) * Math.PI * 2 + Math.random() * 0.3
      this.scene.add(p)
      puffs.push(p)
    }
    const sparks: Mesh[] = []
    for (let i = 0; i < 14; i++) {
      const p = new Mesh(SPARK_GEO, SPARK_MAT)
      p.visible = false
      p.userData.v = [(Math.random() - 0.5) * 3.2, 3.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3.2]
      this.scene.add(p)
      sparks.push(p)
    }
    this.fx.push({ m, x, z, room, t: 0, landed: false, puffs, sparks, dustMat, size, baked: room !== null })
  }

  /** Advance build animations; finished items are baked back into their room. */
  updateFx(dt: number, s: GameState): void {
    this.updateSecret(dt)
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]!
      f.t += dt / this.fxScale
      const DROP = 0.3
      if (f.t < DROP) {
        const k = f.t / DROP
        f.m.position.y = (1 - k * k) * 2.6
        const sc = 0.75 + 0.25 * k
        f.m.scale.set(sc, 1.15 - 0.15 * k, sc)
      } else {
        if (!f.landed) {
          f.landed = true
          for (const p of f.puffs) p.visible = true
          for (const p of f.sparks) {
            p.visible = true
            p.position.set(f.x, 0.4, f.z)
          }
        }
        const u = f.t - DROP
        const wob = Math.exp(-6 * u) * Math.cos(13 * u)
        f.m.position.y = 0
        f.m.scale.set(1 + 0.16 * wob, 1 - 0.26 * wob, 1 + 0.16 * wob)
        const k = Math.min(1, u / 0.55)
        for (const p of f.puffs) {
          const a = p.userData.a as number
          const r = f.size * 0.45 + k * f.size * 0.6
          p.position.set(f.x + Math.cos(a) * r, 0.12 + k * 0.35, f.z + Math.sin(a) * r)
          p.scale.setScalar(0.6 + k * 1.1)
        }
        f.dustMat.opacity = 0.9 * (1 - k)
        for (const p of f.sparks) {
          const v = p.userData.v as number[]
          v[1]! -= 14 * dt
          p.position.x += v[0]! * dt
          p.position.y = Math.max(0.05, p.position.y + v[1]! * dt)
          p.position.z += v[2]! * dt
          p.rotation.x += dt * 9
          p.rotation.y += dt * 7
          p.scale.setScalar(Math.max(0.01, 1 - k))
        }
      }
      if (f.t >= DROP + 0.6) {
        for (const p of [...f.puffs, ...f.sparks]) this.scene.remove(p)
        f.dustMat.dispose()
        f.m.scale.set(1, 1, 1)
        f.m.position.y = 0
        if (f.baked && f.room) {
          this.scene.remove(f.m)
          f.m.geometry.dispose()
          if (!this.fx.some((o) => o !== f && o.room === f.room)) this.hold.delete(f.room)
          this.syncRooms(s)
        }
        this.fx.splice(i, 1)
      }
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
