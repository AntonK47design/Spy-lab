/**
 * Circuit Hack (Tech): rotate wire tiles until power flows from the source to every terminal.
 * Boards are generated as a random spanning tree over the whole grid (always solvable), the
 * terminals sit on leaves, then every tile is turned at random. Tap / click a tile to turn it a
 * quarter clockwise; keyboard: arrows move a cursor, Space / Enter turns.
 *
 * Draw calls: tile bases, pipe shapes (5 shapes x lit/dark) and markers are InstancedMeshes.
 */
import {
  BoxGeometry, Color, CylinderGeometry, DirectionalLight, HemisphereLight, InstancedMesh, Matrix4, Mesh,
  MeshLambertMaterial, PerspectiveCamera, Plane, Quaternion, Raycaster, Scene, Vector2, Vector3, type BufferGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CIRCUIT, CIRCUIT_TIERS, type CircuitTier } from '../../config/minigames'
import { GADGET } from '../../config/gadgets'
import { mgHud, type MinigameHud, type GameContext, type Minigame, type MinigameResult, type MissionModifiers } from '../Minigame'
import { AudioManager } from '../../audio/AudioManager'

// direction bits: N=1 E=2 S=4 W=8 (N = towards -z / up on screen)
const DIRS = [
  { bit: 1, dc: 0, dr: -1 },
  { bit: 2, dc: 1, dr: 0 },
  { bit: 4, dc: 0, dr: 1 },
  { bit: 8, dc: -1, dr: 0 },
] as const
const OPP: Record<number, number> = { 1: 4, 2: 8, 4: 1, 8: 2 }
const CELL = 1.12

/** Quarter turn clockwise (seen from above). */
export function rot(mask: number): number {
  return ((mask << 1) | (mask >> 3)) & 15
}

type Shape = 'end' | 'straight' | 'corner' | 'tee' | 'cross'
/** Base mask of each shape (rotation 0). */
const BASE: Record<Shape, number> = { end: 1, straight: 5, corner: 3, tee: 7, cross: 15 }
const SHAPES: Shape[] = ['end', 'straight', 'corner', 'tee', 'cross']

function shapeOf(mask: number): { shape: Shape; turns: number } {
  for (const shape of SHAPES) {
    let m = BASE[shape]
    for (let k = 0; k < 4; k++) {
      if (m === mask) return { shape, turns: k }
      m = rot(m)
    }
  }
  return { shape: 'end', turns: 0 }
}

export class CircuitHack implements Minigame {
  readonly id = 'circuit' as const
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(36, 1, 0.1, 100)
  onResult: (r: MinigameResult) => void = () => {}

  private tier!: CircuitTier
  private n = 4
  /** Current and solution masks per cell (index r*n+c). */
  private mask: number[] = []
  private sol: number[] = []
  /** Displayed angle per cell (animates toward the mask's turns). */
  private angle: number[] = []
  /** Quarter turns of each tile away from its solution orientation (display; mod 4 = state). */
  private offset: number[] = []
  private locked: boolean[] = []
  private powered: boolean[] = []
  private source = 0
  private targets: number[] = []
  private cursor = 0
  private time = 0
  private limit = 0
  private running = false
  private finished = false
  private flash: 'hit' | 'miss' | null = null
  private flashT = 0
  private firstTime = false
  private hintsLeft: number = CIRCUIT.freeHints
  private taps = 0
  private w = 1
  private h = 1
  private bases!: InstancedMesh
  private pipes = new Map<string, InstancedMesh>()
  private markers!: InstancedMesh
  private cursorMesh!: Mesh
  private disposables: { dispose(): void }[] = []
  private ray = new Raycaster()
  private plane = new Plane(new Vector3(0, 1, 0), -0.12)

  async init(ctx: GameContext, tierN: number, mods: MissionModifiers): Promise<void> {
    this.tier = CIRCUIT_TIERS[Math.max(0, Math.min(CIRCUIT_TIERS.length - 1, tierN - 1))]!
    this.n = this.tier.size
    this.limit = this.tier.timeLimit + Math.min(CIRCUIT.maxSkillSeconds, mods.agentSkill * CIRCUIT.skillSecondsPerPoint)
    this.time = this.limit
    this.firstTime = ctx.firstTime
    this.w = ctx.width
    this.h = ctx.height
    this.generate()
    // Auto-Splicer gadget: tiles on the way to a terminal pre-solved
    if (mods.gadget === 'splicer') {
      const wrong = this.solutionPath().filter((i) => this.mask[i] !== this.sol[i])
      for (const i of wrong.slice(0, GADGET.splicerTiles)) {
        this.mask[i] = this.sol[i]!
        this.offset[i] = Math.ceil(this.offset[i]! / 4) * 4
        this.locked[i] = true
      }
      this.angle = this.sol.map((v, i) => (shapeOf(v).turns + this.offset[i]!) * (Math.PI / 2))
    }
    this.build()
    this.recompute()
    this.syncMarkers()
    this.resize(ctx.width, ctx.height)
    this.publish()
  }

  // ---------------------------------------------------------------- board
  private idx(c: number, r: number): number {
    return r * this.n + c
  }

  private generate(): void {
    const n = this.n
    const N = n * n
    for (let attempt = 0; attempt < 50; attempt++) {
      const m = new Array<number>(N).fill(0)
      // randomized DFS spanning tree from the source (left column, random row)
      const src = this.idx(0, Math.floor(Math.random() * n))
      const seen = new Array<boolean>(N).fill(false)
      const stack = [src]
      seen[src] = true
      while (stack.length) {
        const cur = stack[stack.length - 1]!
        const c = cur % n
        const r = Math.floor(cur / n)
        const opts = DIRS.filter((d) => {
          const nc = c + d.dc
          const nr = r + d.dr
          return nc >= 0 && nr >= 0 && nc < n && nr < n && !seen[this.idx(nc, nr)]
        })
        if (!opts.length) {
          stack.pop()
          continue
        }
        const d = opts[Math.floor(Math.random() * opts.length)]!
        const nxt = this.idx(c + d.dc, r + d.dr)
        m[cur]! |= d.bit
        m[nxt]! |= OPP[d.bit]!
        seen[nxt] = true
        stack.push(nxt)
      }
      // terminals: leaves far from the source (prefer the right half)
      const leaves = m.map((v, i) => ({ i, v })).filter((x) => x.i !== src && [1, 2, 4, 8].includes(x.v)).map((x) => x.i)
      if (leaves.length < this.tier.targets) continue
      leaves.sort((a, b) => (b % n) - (a % n) + (Math.random() - 0.5) * 2)
      this.targets = leaves.slice(0, this.tier.targets)
      this.source = src
      this.sol = m
      break
    }
    // scramble: every tile turned 1-3 quarters (symmetric ones may look unchanged)
    this.offset = this.sol.map(() => 1 + Math.floor(Math.random() * 3))
    this.mask = this.sol.map((v, i) => {
      let x = v
      for (let k = 0; k < this.offset[i]!; k++) x = rot(x)
      return x
    })
    this.locked = this.mask.map(() => false)
    this.angle = this.sol.map((v, i) => (shapeOf(v).turns + this.offset[i]!) * (Math.PI / 2))
    this.cursor = this.source
  }

  /** Which cells receive power (BFS through matching connections). */
  private recompute(): void {
    const n = this.n
    this.powered = this.mask.map(() => false)
    const q = [this.source]
    this.powered[this.source] = true
    while (q.length) {
      const cur = q.shift()!
      const c = cur % n
      const r = Math.floor(cur / n)
      for (const d of DIRS) {
        if (!(this.mask[cur]! & d.bit)) continue
        const nc = c + d.dc
        const nr = r + d.dr
        if (nc < 0 || nr < 0 || nc >= n || nr >= n) continue
        const nxt = this.idx(nc, nr)
        if (this.powered[nxt] || !(this.mask[nxt]! & OPP[d.bit]!)) continue
        this.powered[nxt] = true
        q.push(nxt)
      }
    }
  }

  private allPowered(): boolean {
    return this.targets.every((t) => this.powered[t])
  }

  // ---------------------------------------------------------------- scene
  private build(): void {
    const s = this.scene
    s.background = new Color(0x0f1a33)
    s.add(new HemisphereLight(0xffffff, 0x223355, 1.6))
    const sun = new DirectionalLight(0xffffff, 1.1)
    sun.position.set(-3, 9, 5)
    s.add(sun)
    const n = this.n
    const N = n * n
    const mat = (c: number, e = 0) => {
      const m = new MeshLambertMaterial({ color: c, emissive: new Color(c).multiplyScalar(e) })
      this.disposables.push(m)
      return m
    }
    // board frame
    const span = n * CELL
    const frame = new Mesh(new BoxGeometry(span + 0.8, 0.3, span + 0.8), mat(0x22304f))
    frame.position.y = -0.15
    const rim = new Mesh(new BoxGeometry(span + 1.1, 0.2, span + 1.1), mat(0x3b4f7a))
    rim.position.y = -0.25
    this.disposables.push(frame.geometry, rim.geometry)
    s.add(frame, rim)
    // tile bases
    const baseGeo = new BoxGeometry(CELL - 0.1, 0.14, CELL - 0.1).translate(0, 0.07, 0)
    this.disposables.push(baseGeo)
    this.bases = new InstancedMesh(baseGeo, mat(0x2c3a5e), N)
    s.add(this.bases)
    // pipe shapes: arms from the centre (N arm along -z)
    const arm = () => new BoxGeometry(0.26, 0.12, CELL / 2 + 0.02).translate(0, 0.2, -CELL / 4)
    const hub = () => new CylinderGeometry(0.2, 0.2, 0.14, 12).translate(0, 0.2, 0)
    const armDir = (bit: number) => {
      const g = arm()
      const k = [1, 2, 4, 8].indexOf(bit)
      return g.rotateY(-k * (Math.PI / 2))
    }
    const shapeGeo = (m: number) => mergeGeometries([hub(), ...[1, 2, 4, 8].filter((b) => m & b).map(armDir)])!
    const dark = mat(0x9aa3b5)
    const lit = mat(0x5ad1ff, 0.6)
    for (const sh of SHAPES) {
      const g = shapeGeo(BASE[sh])
      this.disposables.push(g)
      for (const on of [false, true]) {
        const im = new InstancedMesh(g, on ? lit : dark, N)
        im.count = N
        s.add(im)
        this.pipes.set(`${sh}:${on}`, im)
      }
    }
    // markers: source (battery) + terminals (lamps): one instanced cylinder, coloured per instance
    const mg = new CylinderGeometry(0.26, 0.3, 0.32, 14).translate(0, 0.32, 0)
    this.disposables.push(mg)
    this.markers = new InstancedMesh(mg, mat(0xffffff), 1 + this.targets.length)
    s.add(this.markers)
    // keyboard cursor
    const cg = new BoxGeometry(CELL, 0.04, CELL)
    this.disposables.push(cg)
    this.cursorMesh = new Mesh(cg, new MeshLambertMaterial({ color: 0xf2b134, transparent: true, opacity: 0.45, emissive: 0x6a4a10 }))
    this.disposables.push(this.cursorMesh.material as MeshLambertMaterial)
    this.cursorMesh.visible = false
    s.add(this.cursorMesh)
    // static instance transforms
    const m4 = new Matrix4()
    for (let i = 0; i < N; i++) {
      const p = this.pos(i)
      this.bases.setMatrixAt(i, m4.makeTranslation(p.x, 0, p.z))
    }
    this.syncMarkers()
  }

  private pos(i: number): { x: number; z: number } {
    const n = this.n
    const c = i % n
    const r = Math.floor(i / n)
    return { x: (c - (n - 1) / 2) * CELL, z: (r - (n - 1) / 2) * CELL }
  }

  private syncMarkers(): void {
    const m4 = new Matrix4()
    const list = [this.source, ...this.targets]
    list.forEach((cell, k) => {
      const p = this.pos(cell)
      m4.makeTranslation(p.x, 0, p.z)
      this.markers.setMatrixAt(k, m4)
      const col = k === 0 ? 0xf2b134 : this.powered[cell] ? 0x7be07a : 0xd9503a
      this.markers.setColorAt(k, new Color(col))
    })
    this.markers.instanceMatrix.needsUpdate = true
    if (this.markers.instanceColor) this.markers.instanceColor.needsUpdate = true
  }

  private m4 = new Matrix4()
  private q = new Quaternion()
  private up = new Vector3(0, 1, 0)
  private hidden = new Matrix4().makeScale(0, 0, 0)

  /** Pipe instances: right shape + lit state, rotated to the displayed angle. */
  private syncPipes(): void {
    const N = this.n * this.n
    for (let i = 0; i < N; i++) {
      // the shape never changes: its base orientation comes from the solution mask
      const { shape } = shapeOf(this.sol[i]!)
      const p = this.pos(i)
      // clockwise from above = negative rotation about +y
      this.q.setFromAxisAngle(this.up, -this.angle[i]!)
      this.m4.compose(new Vector3(p.x, 0, p.z), this.q, new Vector3(1, 1, 1))
      for (const sh of SHAPES)
        for (const on of [false, true]) {
          const im = this.pipes.get(`${sh}:${on}`)!
          im.setMatrixAt(i, sh === shape && on === !!this.powered[i] ? this.m4 : this.hidden)
        }
    }
    for (const im of this.pipes.values()) im.instanceMatrix.needsUpdate = true
  }

  // ---------------------------------------------------------------- input
  private turn(i: number): void {
    if (!this.running || this.finished || this.locked[i]) return
    this.mask[i] = rot(this.mask[i]!)
    this.offset[i]!++
    this.taps++
    AudioManager.play('ui_click', 1.2 + Math.random() * 0.1)
    this.recompute()
    this.syncMarkers()
    if (this.allPowered()) {
      this.flash = 'hit'
      this.flashT = 0.5
      AudioManager.play('bolt_open')
      this.finish(true)
    }
    this.publish()
  }

  pointer(x: number, y: number): void {
    const i = this.cellAt(x, y)
    if (i === null) return
    this.cursor = i
    this.turn(i)
  }

  private cellAt(x: number, y: number): number | null {
    const v = new Vector2((x / this.w) * 2 - 1, -(y / this.h) * 2 + 1)
    this.ray.setFromCamera(v, this.camera)
    const hit = new Vector3()
    if (!this.ray.ray.intersectPlane(this.plane, hit)) return null
    const n = this.n
    const c = Math.round(hit.x / CELL + (n - 1) / 2)
    const r = Math.round(hit.z / CELL + (n - 1) / 2)
    if (c < 0 || r < 0 || c >= n || r >= n) return null
    return this.idx(c, r)
  }

  move(dir: 'fwd' | 'back' | 'left' | 'right'): void {
    if (!this.running || this.finished) return
    const n = this.n
    let c = this.cursor % n
    let r = Math.floor(this.cursor / n)
    if (dir === 'fwd') r = Math.max(0, r - 1)
    if (dir === 'back') r = Math.min(n - 1, r + 1)
    if (dir === 'left') c = Math.max(0, c - 1)
    if (dir === 'right') c = Math.min(n - 1, c + 1)
    this.cursor = this.idx(c, r)
    this.cursorMesh.visible = true
  }

  /** Space / Enter: turn the tile under the keyboard cursor. */
  action(): void {
    this.cursorMesh.visible = true
    this.turn(this.cursor)
  }

  /** Snap the next wrong tiles on the way to an unpowered terminal into place (and lock them). */
  useHint(): void {
    if (this.finished) return
    const wrong = this.solutionPath().filter((i) => this.mask[i] !== this.sol[i] && !this.locked[i])
    for (const i of wrong.slice(0, CIRCUIT.hintTiles)) {
      this.mask[i] = this.sol[i]!
      this.offset[i] = Math.ceil(this.offset[i]! / 4) * 4
      this.locked[i] = true
    }
    this.hintsLeft = Math.max(0, this.hintsLeft - 1)
    AudioManager.play('upgrade')
    this.recompute()
    this.syncMarkers()
    if (this.allPowered()) this.finish(true)
    this.publish()
  }

  freeHints(): number {
    return this.hintsLeft
  }

  /** Cells on the solution paths from the source to every terminal, source first. */
  private solutionPath(): number[] {
    const n = this.n
    const parent = new Map<number, number>()
    const q = [this.source]
    parent.set(this.source, -1)
    while (q.length) {
      const cur = q.shift()!
      const c = cur % n
      const r = Math.floor(cur / n)
      for (const d of DIRS) {
        if (!(this.sol[cur]! & d.bit)) continue
        const nxt = this.idx(c + d.dc, r + d.dr)
        if (parent.has(nxt)) continue
        parent.set(nxt, cur)
        q.push(nxt)
      }
    }
    const out: number[] = []
    for (const t of this.targets) {
      const chain: number[] = []
      for (let k: number = t; k !== -1; k = parent.get(k) ?? -1) chain.push(k)
      for (const k of chain.reverse()) if (!out.includes(k)) out.push(k)
    }
    return out
  }

  // ---------------------------------------------------------------- loop
  start(): void {
    this.running = true
  }
  pause(): void {
    this.running = false
  }
  resume(): void {
    if (!this.finished) this.running = true
  }

  update(dt: number): void {
    this.flashT = Math.max(0, this.flashT - dt)
    if (this.flashT === 0) this.flash = null
    // turn animation: displayed angle chases the mask's orientation
    const N = this.n * this.n
    for (let i = 0; i < N; i++) {
      const target = (shapeOf(this.sol[i]!).turns + this.offset[i]!) * (Math.PI / 2)
      const a = this.angle[i]!
      this.angle[i] = a + (target - a) * Math.min(1, dt / CIRCUIT.turnSeconds * 2.5)
    }
    this.syncPipes()
    const p = this.pos(this.cursor)
    this.cursorMesh.position.set(p.x, 0.17, p.z)
    if (!this.running || this.finished) {
      this.publish()
      return
    }
    this.time -= dt
    if (this.time <= 0) {
      this.time = 0
      this.finish(false, 'time')
      return
    }
    this.publish()
  }

  private finish(success: boolean, reason?: 'alarm' | 'time'): void {
    this.running = false
    this.finished = true
    const left = this.time / this.limit
    const stars = !success ? 0 : left >= CIRCUIT.threeStarLeftShare ? 3 : left >= CIRCUIT.twoStarLeftShare ? 2 : 1
    this.publish()
    this.onResult({ success, stars, timeLeft: this.time, mistakes: 0, intel: 0, reason })
  }

  revive(): void {
    this.time = Math.max(0, this.time) + CIRCUIT.reviveSeconds
    this.limit = Math.max(this.limit, this.time)
    this.finished = false
    this.running = true
    this.publish()
  }

  // ---------------------------------------------------------------- planner (ghost hand + tests)
  /** A tile the player should turn next (screen CSS px), or null when nothing is left. */
  debugNextTap(): { x: number; y: number } | null {
    const i = this.solutionPath().find((k) => this.mask[k] !== this.sol[k] && !this.locked[k])
    if (i === undefined) return null
    return this.screenOfCell(i)
  }

  private screenOfCell(i: number): { x: number; y: number } {
    const p = this.pos(i)
    const v = new Vector3(p.x, 0.2, p.z).project(this.camera)
    return { x: ((v.x + 1) / 2) * this.w, y: ((1 - v.y) / 2) * this.h }
  }

  // ---------------------------------------------------------------- view
  resize(w: number, h: number): void {
    this.w = w
    this.h = h
    this.camera.aspect = w / h
    const portrait = h > w
    const span = this.n * CELL + 1.6
    const vfov = (this.camera.fov * Math.PI) / 180
    // board between the timer (top) and the hint button (bottom)
    const usableH = portrait ? 0.62 : 0.74
    const usableW = portrait ? 0.94 : 0.7
    const distH = span / usableH / 2 / Math.tan(vfov / 2)
    const distW = span / usableW / 2 / Math.tan(vfov / 2) / this.camera.aspect
    const dist = Math.max(distH, distW)
    this.camera.position.set(0, dist * 0.97, dist * 0.25)
    this.camera.lookAt(0, 0, 0.35)
    this.camera.updateProjectionMatrix()
  }

  private publish(): void {
    let ghost: MinigameHud['ghost'] = null
    if (this.firstTime && this.running && this.taps < 6) {
      const p = this.debugNextTap()
      if (p) ghost = { x: p.x - 8, y: p.y - 4, pulse: Math.sin(performance.now() / 160) > 0, label: 'circuit.ghostTap' }
    }
    mgHud.value = {
      done: this.targets.filter((t) => this.powered[t]).length,
      total: this.targets.length,
      icon: 'bulb',
      mistakes: 0,
      maxMistakes: 0,
      timeLeft: this.time,
      timeLimit: this.limit,
      ghost,
      flash: this.flash,
      hint: { free: this.hintsLeft },
      noTap: true,
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose()
    this.scene.clear()
    mgHud.value = null
  }
}
