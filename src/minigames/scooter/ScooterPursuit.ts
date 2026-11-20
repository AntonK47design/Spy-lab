/**
 * Scooter Pursuit (Agility): chase a Velvet Paw thief through the region street on 3 lanes.
 * Dodge obstacles (left/right: keys, swipe, tap a screen half or the arrow buttons), hit boost pads,
 * grab intel chips. The catch-up bar fills while you are faster than the thief; close the gap
 * before time runs out. 3 crashes = fail. Street segments and obstacles are recycled.
 */
import {
  Color, DirectionalLight, Fog, Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshLambertMaterial, PerspectiveCamera,
  Scene, Vector3, type BufferGeometry,
} from 'three'
import { SCOOTER, SCOOTER_TIERS, type ScooterTier } from '../../config/minigames'
import { GADGET } from '../../config/gadgets'
import { REGION_LOOK } from '../../config/missions'
import { mgHud, type GameContext, type Minigame, type MinigameResult, type MissionModifiers } from '../Minigame'
import { AudioManager } from '../../audio/AudioManager'
import { Character } from '../../academy/Character'
import { findBone, propGeometry } from '../../render/assets'
import { StaticBatch } from '../../render/geometry'
import { flatMat } from '../../render/materials'
import type { ModelId } from '../../config/models'

const SEG = 24
const SEGS = 6
const SPAWN_Z = -95
const OBST: ModelId[] = ['barrel', 'boxB', 'trash', 'sedan', 'taxi', 'wagon']
const CARS = new Set<ModelId>(['sedan', 'taxi', 'wagon'])

interface Thing {
  kind: 'obstacle' | 'boost' | 'chip'
  mesh: Mesh | Group
  lane: number
  x: number
  z: number
  halfLen: number
  /** Car drifting into another lane (target x). */
  driftTo: number | null
  done: boolean
}

function laneX(l: number): number {
  return (l - (SCOOTER.lanes - 1) / 2) * SCOOTER.laneWidth
}

export class ScooterPursuit implements Minigame {
  readonly id = 'scooter' as const
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(50, 1, 0.1, 160)
  onResult: (r: MinigameResult) => void = () => {}

  private tier!: ScooterTier
  private base = 10
  private thiefV = 7
  private v = 0
  private gapLeft = 50
  private time = 0
  private limit = 0
  private crashes = 0
  private chips = 0
  private lane = 1
  private px = 0
  private stopT = 0
  private invT = 0
  private boostT = 0
  /** z of the most recently spawned row (scrolls with the world). */
  private lastRow = 0
  private running = false
  private finished = false
  private flash: 'hit' | 'miss' | null = null
  private flashT = 0
  private firstTime = false
  private t = 0
  private w = 1
  private h = 1
  private segs: Mesh[] = []
  private things: Thing[] = []
  private geo = new Map<ModelId, BufferGeometry | null>()
  private player = new Group()
  private thief = new Group()
  private thiefLane = 1
  private thiefX = 0
  private thiefT = 0
  private rider!: Character
  private bandit!: Character
  private boostGeo!: BufferGeometry
  private chipGeo!: BufferGeometry
  private chipMat = new MeshBasicMaterial({ color: 0x5ad1ff })
  private disposables: { dispose(): void }[] = []
  private look = REGION_LOOK.snowpeak

  async init(ctx: GameContext, tierN: number, mods: MissionModifiers): Promise<void> {
    this.tier = SCOOTER_TIERS[Math.max(0, Math.min(SCOOTER_TIERS.length - 1, tierN - 1))]!
    const bonus = Math.min(SCOOTER.maxSkillSpeed, mods.agentSkill * SCOOTER.skillSpeedPerPoint)
    this.base = this.tier.speed * (1 + bonus)
    this.thiefV = this.tier.speed * this.tier.thiefShare
    this.look = REGION_LOOK[mods.region ?? 'snowpeak']
    this.v = this.base * 0.6
    this.gapLeft = this.tier.gap
    this.limit = this.tier.timeLimit
    this.time = this.limit
    this.firstTime = ctx.firstTime
    this.w = ctx.width
    this.h = ctx.height
    const ids = [...OBST, 'buildingA', 'buildingB', 'buildingC', 'streetlight', 'bush'] as ModelId[]
    const geos = await Promise.all(ids.map((id) => propGeometry(id)))
    ids.forEach((id, i) => this.geo.set(id, geos[i] ?? null))
    this.build()
    // wait for both characters (cached prototypes)
    for (let i = 0; i < 200 && !(this.rider.ready && this.bandit.ready); i++) await new Promise((r) => setTimeout(r, 25))
    this.catEars()
    // first row a little ahead, then rows out to the horizon
    this.lastRow = -28 + this.tier.rowSpacing
    this.fillRows()
    // Turbo Kit gadget: start with a boost
    if (mods.gadget === 'turbo') this.boostT = GADGET.turboSeconds
    this.resize(ctx.width, ctx.height)
    this.publish()
  }

  // ---------------------------------------------------------------- scene
  private build(): void {
    const s = this.scene
    s.background = new Color(this.look.sky)
    s.fog = new Fog(this.look.sky, 40, 105)
    s.add(new HemisphereLight(this.look.night ? 0x8a7aff : 0xffffff, 0x6a7a8a, this.look.night ? 1.1 : 1.7))
    const sun = new DirectionalLight(this.look.night ? 0xb0a0ff : 0xfff0d6, this.look.night ? 0.7 : 1.4)
    sun.position.set(-5, 12, 6)
    s.add(sun)
    // street segments: 3 looks recycled
    const looks = [0, 1, 2].map((v) => this.segmentGeo(v))
    for (let i = 0; i < SEGS; i++) {
      const m = new Mesh(looks[i % 3]!, flatMat)
      m.position.z = SEG - i * SEG
      s.add(m)
      this.segs.push(m)
    }
    // boost pad + intel chip geometry
    const b = new StaticBatch()
    b.rbox(1.6, 0.04, 2.2, 0, 0.04, 0, 0xf2b134, 0.06)
    for (let k = 0; k < 2; k++) {
      b.rboxRot(0.7, 0.03, 0.18, -0.25, 0.08, 0.35 - k * 0.7, 0xfff3e0, 0.02, 0.8, 0, 0)
      b.rboxRot(0.7, 0.03, 0.18, 0.25, 0.08, 0.35 - k * 0.7, 0xfff3e0, 0.02, -0.8, 0, 0)
    }
    this.boostGeo = b.build()
    const c = new StaticBatch()
    c.cyl(0.32, 0.32, 0.1, 0, 0, 0, 0x5ad1ff, 6, Math.PI / 2)
    c.cyl(0.18, 0.18, 0.12, 0, 0, 0, 0xffffff, 6, Math.PI / 2)
    this.chipGeo = c.build()
    this.disposables.push(this.boostGeo, this.chipGeo, this.chipMat, ...looks)
    // own scooter + rider, thief scooter + bandit
    this.player.add(this.scooterMesh(0x2f6bff))
    this.rider = new Character({ model: 'director', scale: 0.85 })
    this.rider.root.position.set(0, 0.28, 0.05)
    this.rider.root.rotation.y = Math.PI
    this.player.add(this.rider.root)
    s.add(this.player)
    this.thief.add(this.scooterMesh(0x2b2b36))
    this.bandit = new Character({ model: 'agentM', tint: { shirt: 0x1b1b24, pants: 0x1b1b24 }, scale: 0.85 })
    this.bandit.root.position.set(0, 0.28, 0.05)
    this.bandit.root.rotation.y = Math.PI
    this.thief.add(this.bandit.root)
    s.add(this.thief)
  }

  private segmentGeo(variant: number): BufferGeometry {
    const b = new StaticBatch()
    const L = SEG
    const roadW = SCOOTER.lanes * SCOOTER.laneWidth + 0.6
    b.box(roadW, 0.1, L, 0, -0.05, -L / 2, 0x5a6070)
    // lane markings (dashed)
    for (let l = 1; l < SCOOTER.lanes; l++) {
      const x = laneX(l) - SCOOTER.laneWidth / 2
      for (let z = 1; z < L; z += 4) b.box(0.12, 0.02, 2, x, 0.01, -z - 1, 0xfff3e0)
    }
    // curbs + sidewalks
    for (const sgn of [-1, 1]) {
      b.box(0.3, 0.2, L, sgn * (roadW / 2 + 0.15), 0.05, -L / 2, 0xb7a88a)
      b.box(3, 0.16, L, sgn * (roadW / 2 + 1.8), 0.04, -L / 2, this.look.walk)
      if (this.look.night) {
        // Neon City: glowing strips along the shop fronts
        b.box(0.08, 0.5, L - 2, sgn * (roadW / 2 + 3.25), 1.6, -L / 2, variant % 2 ? 0xff4fd8 : 0x5ad1ff)
        b.box(0.08, 0.12, L - 2, sgn * (roadW / 2 + 3.25), 0.4, -L / 2, 0xfff3b0)
      } else {
        // snowbanks (Snowpeak) / sand drifts (Dune) / cloud puffs (Sky) along the curb
        for (let z = 2 + variant * 2; z < L; z += 7) b.sphere(0.7, sgn * (roadW / 2 + 0.55), 0.05, -z, this.look.bank, 8, 6, 0.45)
      }
      // buildings: alternating Kenney blocks
      const bids: ModelId[] = ['buildingA', 'buildingB', 'buildingC']
      for (let k = 0; k < 3; k++) {
        const id = bids[(k + variant + (sgn > 0 ? 1 : 0)) % 3]!
        b.prop(this.geo.get(id) ?? null, sgn * (roadW / 2 + 5.2), -4 - k * 8, sgn > 0 ? -Math.PI / 2 : Math.PI / 2, 1.3)
      }
      b.prop(this.geo.get('streetlight') ?? null, sgn * (roadW / 2 + 0.7), -6 - variant * 4, sgn > 0 ? Math.PI : 0, 1)
      b.prop(this.geo.get('bush') ?? null, sgn * (roadW / 2 + 2.6), -14 + variant * 3, 0, 1)
    }
    return b.build()
  }

  private scooterMesh(color: number): Mesh {
    const b = new StaticBatch()
    b.rbox(0.42, 0.1, 1.3, 0, 0.22, 0, color, 0.04)
    b.cyl(0.18, 0.18, 0.12, 0, 0.18, 0.55, 0x22283a, 12, 0, Math.PI / 2)
    b.cyl(0.18, 0.18, 0.12, 0, 0.18, -0.55, 0x22283a, 12, 0, Math.PI / 2)
    b.rboxRot(0.08, 1.0, 0.08, 0, 0.7, -0.62, 0x8f9bb0, 0.03, 0, -0.25, 0)
    b.rbox(0.7, 0.07, 0.07, 0, 1.18, -0.75, 0x22283a, 0.03)
    b.rbox(0.2, 0.14, 0.08, 0, 0.95, -0.72, color, 0.04)
    b.sphere(0.06, 0, 0.95, -0.77, 0xfff3b0)
    const geo = b.build()
    this.disposables.push(geo)
    return new Mesh(geo, flatMat)
  }

  /** Cat-ear mask on the thief (Velvet Paw). */
  private catEars(): void {
    const head = findBone(this.bandit.root, /^head$/)
    if (!head) return
    const b = new StaticBatch()
    b.cone(0.09, 0.16, -0.17, 0.6, 0, 0x1b1b24, 4)
    b.cone(0.09, 0.16, 0.17, 0.6, 0, 0x1b1b24, 4)
    b.rbox(0.62, 0.12, 0.05, 0, 0.38, 0.3, 0x1b1b24, 0.03)
    const geo = b.build()
    this.disposables.push(geo)
    const m = new Mesh(geo, flatMat)
    // bone space is scaled by the character normalisation: undo it so the ears keep world size
    const ws = new Vector3()
    head.getWorldScale(ws)
    m.scale.setScalar(this.bandit.root.scale.x / Math.max(1e-3, ws.x))
    head.add(m)
  }

  // ---------------------------------------------------------------- spawning
  private spawnRow(z: number): void {
    const t = this.tier
    const blocked = new Set<number>()
    const first = Math.floor(Math.random() * SCOOTER.lanes)
    blocked.add(first)
    if (Math.random() < t.doubleChance) blocked.add((first + 1 + Math.floor(Math.random() * 2)) % SCOOTER.lanes)
    const free = [0, 1, 2].filter((l) => !blocked.has(l))
    let drift: { from: number; to: number } | null = null
    if (blocked.size === 1 && Math.random() < t.driftChance) {
      const to = first === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1
      drift = { from: first, to }
    }
    for (const l of blocked) {
      let id = OBST[Math.floor(Math.random() * OBST.length)]!
      if (drift && l === drift.from && !CARS.has(id)) id = 'sedan'
      const g = this.geo.get(id) ?? null
      const mesh = new Mesh(g ?? this.boostGeo, flatMat)
      const car = CARS.has(id)
      if (car) mesh.rotation.y = Math.PI
      mesh.scale.setScalar(car ? 1 : 1.25)
      this.scene.add(mesh)
      this.things.push({ kind: 'obstacle', mesh, lane: l, x: laneX(l), z, halfLen: car ? 1.5 : 0.6, driftTo: drift && l === drift.from ? laneX(drift.to) : null, done: false })
    }
    // extras in free lanes (never in a drift target)
    const safe = free.filter((l) => !drift || l !== drift.to)
    if (safe.length && Math.random() < SCOOTER.boostChance) {
      const l = safe[Math.floor(Math.random() * safe.length)]!
      const mesh = new Mesh(this.boostGeo, flatMat)
      this.scene.add(mesh)
      this.things.push({ kind: 'boost', mesh, lane: l, x: laneX(l), z: z + 4, halfLen: 1.1, driftTo: null, done: false })
    }
    if (safe.length && Math.random() < SCOOTER.chipChance) {
      const l = safe[Math.floor(Math.random() * safe.length)]!
      const mesh = new Mesh(this.chipGeo, flatMat)
      mesh.position.y = 0.75
      this.scene.add(mesh)
      this.things.push({ kind: 'chip', mesh, lane: l, x: laneX(l), z, halfLen: 0.6, driftTo: null, done: false })
    }
  }

  /** Keep rows spawned out to the horizon. */
  private fillRows(): void {
    while (this.lastRow - this.tier.rowSpacing >= SPAWN_Z) {
      this.lastRow -= this.tier.rowSpacing
      this.spawnRow(this.lastRow)
    }
  }

  // ---------------------------------------------------------------- input
  move(dir: 'fwd' | 'back' | 'left' | 'right'): void {
    if (!this.running || this.finished) return
    if (dir === 'left' && this.lane > 0) this.lane--
    else if (dir === 'right' && this.lane < SCOOTER.lanes - 1) this.lane++
    else return
    AudioManager.play('whoosh', 1.6)
  }

  /** Tap on a screen half steers that way. */
  pointer(x: number): void {
    this.move(x < this.w / 2 ? 'left' : 'right')
  }

  action(): void {
    // no primary action
  }

  useHint(): void {}

  // ---------------------------------------------------------------- loop
  start(): void {
    this.running = true
    AudioManager.play('scooter')
  }
  pause(): void {
    this.running = false
  }
  resume(): void {
    if (!this.finished) this.running = true
  }

  update(dt: number): void {
    this.t += dt
    this.flashT = Math.max(0, this.flashT - dt)
    if (this.flashT === 0) this.flash = null
    this.rider.update(dt)
    this.bandit.update(dt)
    if (!this.running || this.finished) {
      this.place(0)
      this.publish()
      return
    }
    // speed: standstill after a crash, boost, else cruise
    this.stopT = Math.max(0, this.stopT - dt)
    this.invT = Math.max(0, this.invT - dt)
    this.boostT = Math.max(0, this.boostT - dt)
    const target = this.stopT > 0 ? 0 : this.base * (this.boostT > 0 ? SCOOTER.boostMult : 1)
    this.v += (target - this.v) * Math.min(1, dt * (this.stopT > 0 ? 12 : 2.2))
    const dz = this.v * dt
    // world scrolls toward the player
    for (const sgm of this.segs) {
      sgm.position.z += dz
      if (sgm.position.z > SEG * 1.5) sgm.position.z -= SEG * SEGS
    }
    this.lastRow += dz
    this.fillRows()
    // lane steering
    const tx = laneX(this.lane)
    const k = Math.min(1, dt / SCOOTER.laneChangeSeconds * 2.2)
    this.px += (tx - this.px) * k
    for (const th of this.things) {
      th.z += dz
      if (th.driftTo !== null && th.z > -38 && th.z < -12) th.x += (th.driftTo - th.x) * Math.min(1, dt * 2.5)
      if (th.kind === 'chip') th.mesh.rotation.y += dt * 3
      if (!th.done) this.collide(th)
    }
    // recycle passed things
    for (let i = this.things.length - 1; i >= 0; i--) {
      const th = this.things[i]!
      if (th.z > 8) {
        this.scene.remove(th.mesh)
        this.things.splice(i, 1)
      }
    }
    // chase
    this.gapLeft -= (this.v - this.thiefV) * dt
    this.gapLeft = Math.min(this.gapLeft, this.tier.gap * 1.6)
    this.time -= dt
    if (this.gapLeft <= 0) {
      this.gapLeft = 0
      this.flash = 'hit'
      this.flashT = 0.5
      AudioManager.play('bolt_open')
      this.finish(true)
    } else if (this.time <= 0) {
      this.time = 0
      this.finish(false, 'time')
    }
    this.place(dt)
    this.publish()
  }

  private collide(th: Thing): void {
    if (Math.abs(th.z) > th.halfLen + 0.5) return
    if (Math.abs(th.x - this.px) > (th.kind === 'obstacle' ? 1.05 : 0.95)) return
    if (th.kind === 'chip') {
      th.done = true
      th.mesh.visible = false
      this.chips++
      AudioManager.play('coin', 1.2)
      return
    }
    if (th.kind === 'boost') {
      th.done = true
      this.boostT = SCOOTER.boostSeconds
      AudioManager.play('upgrade', 1.3)
      return
    }
    if (this.invT > 0) return
    th.done = true
    this.crashes++
    this.stopT = SCOOTER.crashStopSeconds
    this.invT = SCOOTER.invulnerableSeconds
    this.boostT = 0
    this.flash = 'miss'
    this.flashT = 0.4
    AudioManager.play('alarm', 1.3)
    if (this.crashes >= SCOOTER.maxCrashes) this.finish(false, 'alarm')
  }

  /** Position things, player and thief; camera follows. */
  private place(dt: number): void {
    for (const th of this.things) th.mesh.position.set(th.x, th.kind === 'chip' ? 0.75 + Math.sin(this.t * 4 + th.z) * 0.1 : th.kind === 'boost' ? 0 : 0, th.z)
    const lean = (laneX(this.lane) - this.px) * 0.25
    this.player.position.set(this.px, 0, 0)
    this.player.rotation.z = lean
    this.player.visible = this.invT <= 0 || Math.floor(this.t * 12) % 2 === 0
    // thief weaves between lanes ahead; distance follows the gap (clamped into view)
    this.thiefT -= dt
    if (this.thiefT <= 0) {
      this.thiefLane = Math.floor(Math.random() * SCOOTER.lanes)
      this.thiefT = 1.5 + Math.random() * 2
    }
    this.thiefX += (laneX(this.thiefLane) - this.thiefX) * Math.min(1, dt * 3)
    const tz = -Math.min(60, Math.max(3.5, this.gapLeft * 0.75 + 3))
    this.thief.position.set(this.thiefX, 0, tz)
    const p = this.px * 0.55
    this.camera.position.set(p, this.camY, this.camZ)
    this.camera.lookAt(p * 0.8, 0.8, -14)
  }

  private camY = 4.4
  private camZ = 6.8

  private finish(success: boolean, reason?: 'alarm' | 'time'): void {
    this.running = false
    this.finished = true
    const stars = !success ? 0 : this.crashes === 0 ? 3 : this.crashes === 1 ? 2 : 1
    this.publish()
    this.onResult({ success, stars, timeLeft: this.time, mistakes: this.crashes, intel: this.chips * SCOOTER.intelPerChip, reason })
  }

  revive(): void {
    this.crashes = Math.min(this.crashes, SCOOTER.maxCrashes - 1)
    this.time = Math.max(0, this.time) + SCOOTER.reviveSeconds
    this.limit = Math.max(this.limit, this.time)
    this.invT = SCOOTER.invulnerableSeconds
    this.stopT = 0
    this.finished = false
    this.running = true
    this.publish()
  }

  // ---------------------------------------------------------------- planner (ghost hand + tests)
  /** Lane the player should be in to pass the next rows; returns the move toward it or 'wait'. */
  debugNextMove(): 'left' | 'right' | 'wait' {
    const best = this.safeLane()
    if (best === this.lane) return 'wait'
    return best < this.lane ? 'left' : 'right'
  }

  private blockedAt(lane: number, z0: number, z1: number): boolean {
    const x = laneX(lane)
    return this.things.some((th) => th.kind === 'obstacle' && !th.done && th.z > z0 - th.halfLen && th.z < z1 + th.halfLen && (Math.abs(th.x - x) < 1.1 || (th.driftTo !== null && Math.abs(th.driftTo - x) < 1.1)))
  }

  private safeLane(): number {
    const horizon = -Math.max(14, this.v * 1.3)
    // stay if the own lane is clear for a while
    if (!this.blockedAt(this.lane, horizon, 1.5)) return this.lane
    const opts = [0, 1, 2].filter((l) => !this.blockedAt(l, horizon, 1.5) && (Math.abs(l - this.lane) === 1 || !this.blockedAt(1, horizon * 0.3, 1.5)))
    if (!opts.length) return [0, 1, 2].sort((a, b) => Math.abs(a - this.lane) - Math.abs(b - this.lane)).find((l) => !this.blockedAt(l, -6, 1.5)) ?? this.lane
    return opts.sort((a, b) => Math.abs(a - this.lane) - Math.abs(b - this.lane))[0]!
  }

  // ---------------------------------------------------------------- view
  resize(w: number, h: number): void {
    this.w = w
    this.h = h
    this.camera.aspect = w / h
    const portrait = h > w
    this.camera.fov = portrait ? 62 : 50
    this.camY = portrait ? 5.6 : 4.4
    this.camZ = portrait ? 8.2 : 6.8
    this.camera.updateProjectionMatrix()
    this.place(0)
  }

  private publish(): void {
    let ghost: { x: number; y: number; pulse: boolean } | null = null
    if (this.firstTime && this.running) {
      const m = this.debugNextMove()
      if (m !== 'wait') ghost = { x: m === 'left' ? this.w * 0.18 : this.w * 0.78, y: this.h * 0.62, pulse: true }
    }
    mgHud.value = {
      done: 0,
      total: 0,
      mistakes: this.crashes,
      maxMistakes: SCOOTER.maxCrashes,
      timeLeft: this.time,
      timeLimit: this.limit,
      ghost,
      flash: this.flash,
      noTap: true,
      chase: 1 - this.gapLeft / this.tier.gap,
      lanes: true,
      chips: this.chips,
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose()
    this.scene.clear()
    mgHud.value = null
  }
}
