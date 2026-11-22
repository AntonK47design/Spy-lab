/**
 * Laser Hall (Stealth): hop field by field down a 5 x 12 corridor to the briefcase.
 * Hazard rows: static beams with gaps, blinking beams (wait for the off phase), sweeping beams,
 * and cameras whose cone sweeps the row (standing in the light too long trips the alarm).
 * A hit costs a life and sends the agent back to the last safe row. Intel chips are optional.
 * Input: arrows / WASD, tap toward a direction, swipe, or the action button (= hop forward).
 */
import {
  AdditiveBlending, BoxGeometry, Color, CylinderGeometry, DirectionalLight, Fog, Group, HemisphereLight, Mesh,
  MeshBasicMaterial, MeshLambertMaterial, PerspectiveCamera, PlaneGeometry, Scene, Vector3,
} from 'three'
import { LASER, LASER_TIERS, type LaserTier } from '../../config/minigames'
import { mgHud, type GameContext, type Minigame, type MinigameResult, type MissionModifiers } from '../Minigame'
import { AudioManager } from '../../audio/AudioManager'
import { Character } from '../../academy/Character'

type Dir = 'fwd' | 'back' | 'left' | 'right'
type Kind = LaserTier['hazards'][number]

interface Hazard {
  kind: Kind
  row: number
  /** static: blocked columns */
  blocked: boolean[]
  /** blink: phase offset (s) */
  phase: number
  /** sweep: beam width in columns; camera: spot radius */
  width: number
  /** sweep/camera: speed multiplier and start offset */
  speed: number
  offset: number
  group: Group
  beams: Mesh[]
  /** camera: lit-cell overlays per column + head */
  lit: Mesh[]
  head: Mesh | null
}

const CELL = 1.2
const DIRS: Record<Dir, [number, number]> = { fwd: [0, 1], back: [0, -1], left: [-1, 0], right: [1, 0] }

/** Deterministic random so a tier always builds the same corridor layout. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Triangle wave 0..1..0 with period 2 (in "units" of t). */
function tri(t: number): number {
  const x = ((t % 2) + 2) % 2
  return x < 1 ? x : 2 - x
}

export class LaserHall implements Minigame {
  readonly id = 'laser' as const
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(40, 1, 0.1, 120)
  onResult: (r: MinigameResult) => void = () => {}

  private tier!: LaserTier
  private onShare = 0.5
  /** Corridor length: at least LASER.rows, longer at high tiers so every hazard has a safe row before it. */
  private rows: number = LASER.rows
  private hazards: Hazard[] = []
  private hazardAt = new Map<number, Hazard>()
  private chips = new Map<string, Mesh>()
  private chipTotal = 0
  private collected = 0
  private col = Math.floor(LASER.cols / 2)
  private row = 0
  private hop: { fc: number; fr: number; tc: number; tr: number; t: number } | null = null
  private queued: Dir | null = null
  private lastSafeRow = 0
  private litTime = 0
  private stun = 0
  private mistakes = 0
  private time = 0
  private clock = 0
  private running = false
  private finished = false
  private flash: 'hit' | 'miss' | null = null
  private flashT = 0
  private firstTime = false
  private w = 1
  private h = 1
  private agent: Character
  private camTarget = new Vector3()
  private disposables: { dispose(): void }[] = []
  private beamMat = new MeshBasicMaterial({ color: 0xff3b3b })
  private glowMat = new MeshBasicMaterial({ color: 0xff5a4f, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false })
  private litMat = new MeshBasicMaterial({ color: 0xffe680, transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false })
  private chipMat = new MeshLambertMaterial({ color: 0x46c2cb, emissive: 0x1f6f78 })

  constructor() {
    this.agent = new Character({ model: 'agentF', tint: { shirt: 0x14213d, pants: 0x14213d }, scale: 0.8 })
    this.agent.root.getObjectByName('blob')?.removeFromParent()
  }

  async init(ctx: GameContext, tierN: number, mods: MissionModifiers): Promise<void> {
    const ti = Math.max(0, Math.min(LASER_TIERS.length - 1, tierN - 1))
    this.tier = LASER_TIERS[ti] as LaserTier
    // stealth skill: shorter on-phase of blinking beams
    this.onShare = Math.max(0.25, this.tier.blinkOn - Math.min(LASER.maxSkillBonus, mods.agentSkill * LASER.onSharePerSkill))
    this.time = this.tier.timeLimit
    this.shield = mods.gadget === 'mirror'
    this.firstTime = ctx.firstTime
    this.w = ctx.width
    this.h = ctx.height
    this.build(rng(1000 + ti * 77))
    this.placeAgent()
    this.resize(ctx.width, ctx.height)
    this.publish()
  }

  // ---------------------------------------------------------------- world
  private mat(c: number) {
    const m = new MeshLambertMaterial({ color: c })
    this.disposables.push(m)
    return m
  }

  private geo<T extends { dispose(): void }>(g: T): T {
    this.disposables.push(g)
    return g
  }

  private cellPos(c: number, r: number): Vector3 {
    return new Vector3((c - (LASER.cols - 1) / 2) * CELL, 0, -r * CELL)
  }

  private build(rand: () => number): void {
    const s = this.scene
    s.background = new Color(0x14213d)
    s.fog = new Fog(0x14213d, 18, 34)
    s.add(new HemisphereLight(0xdfe9ff, 0x2a2440, 1.5))
    const d = new DirectionalLight(0xffffff, 1.3)
    d.position.set(3, 8, 4)
    s.add(d)
    this.disposables.push(this.beamMat, this.glowMat, this.litMat, this.chipMat)

    // hazards on every other row from row 2: a safe row before each one (fair waiting spot)
    const n = this.tier.hazards.length
    this.rows = Math.max(LASER.rows, 2 * n + 3)
    const rows = Array.from({ length: n }, (_, i) => 2 + i * 2)
    rows.forEach((r, i) => {
      const hz = this.makeHazard(this.tier.hazards[i]!, r, rand)
      this.hazards.push(hz)
      this.hazardAt.set(r, hz)
    })

    // floor tiles
    const tile = this.geo(new BoxGeometry(CELL - 0.06, 0.2, CELL - 0.06))
    const tA = this.mat(0x2c3a5e)
    const tB = this.mat(0x34446c)
    const tH = this.mat(0x3d2f4f)
    const tStart = this.mat(0x2f7d5a)
    const tGoal = this.mat(0xb07a14)
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < LASER.cols; c++) {
        const m = new Mesh(tile, r === 0 ? tStart : r === this.rows - 1 ? tGoal : this.hazardAt.has(r) ? tH : (r + c) % 2 ? tA : tB)
        m.position.copy(this.cellPos(c, r)).setY(-0.1)
        s.add(m)
      }
    // side walls with emitter lenses at hazard rows
    const len = this.rows * CELL
    const wallGeo = this.geo(new BoxGeometry(0.5, 2.2, len + 1))
    const wallMat = this.mat(0x3b4f7a)
    const trimMat = this.mat(0xf2b134)
    const half = ((LASER.cols - 1) / 2) * CELL + CELL / 2 + 0.25
    for (const sx of [-1, 1]) {
      const wall = new Mesh(wallGeo, wallMat)
      wall.position.set(sx * half, 1.1, -len / 2 + CELL / 2)
      s.add(wall)
      const trim = new Mesh(this.geo(new BoxGeometry(0.56, 0.12, len + 1)), trimMat)
      trim.position.set(sx * half, 2.26, -len / 2 + CELL / 2)
      s.add(trim)
    }
    // back wall + briefcase on a pedestal
    const back = new Mesh(this.geo(new BoxGeometry(half * 2 + 0.5, 3, 0.4)), wallMat)
    back.position.set(0, 1.5, -(this.rows - 0.3) * CELL)
    s.add(back)
    const goal = this.cellPos(Math.floor(LASER.cols / 2), this.rows - 1)
    const ped = new Mesh(this.geo(new CylinderGeometry(0.45, 0.55, 0.6, 16)), this.mat(0x8a94a6))
    ped.position.copy(goal).setY(0.3)
    s.add(ped)
    const caseM = new Mesh(this.geo(new BoxGeometry(0.75, 0.5, 0.22)), this.mat(0x7a3e2b))
    caseM.position.copy(goal).setY(0.86)
    s.add(caseM)
    const handle = new Mesh(this.geo(new BoxGeometry(0.3, 0.1, 0.08)), this.mat(0xf2b134))
    handle.position.copy(goal).setY(1.16)
    s.add(handle)

    // hazard visuals
    const emitGeo = this.geo(new BoxGeometry(0.2, 1.2, 0.5))
    const emitMat = this.mat(0x22283a)
    for (const hz of this.hazards) {
      hz.group.position.z = -hz.row * CELL
      s.add(hz.group)
      if (hz.kind !== 'camera')
        for (const sx of [-1, 1]) {
          const e = new Mesh(emitGeo, emitMat)
          e.position.set(sx * (half - 0.32), 0.6, 0)
          hz.group.add(e)
        }
      this.buildHazard(hz, half)
    }

    // intel chips on safe rows
    const safeRows: number[] = []
    for (let r = 1; r < this.rows - 1; r++) if (!this.hazardAt.has(r)) safeRows.push(r)
    const chipGeo = this.geo(new BoxGeometry(0.34, 0.06, 0.34))
    for (let i = 0; i < this.tier.chips && safeRows.length; i++) {
      const r = safeRows.splice(Math.floor(rand() * safeRows.length), 1)[0]!
      const c = Math.floor(rand() * LASER.cols)
      const m = new Mesh(chipGeo, this.chipMat)
      m.position.copy(this.cellPos(c, r)).setY(0.45)
      s.add(m)
      this.chips.set(`${c}:${r}`, m)
    }
    this.chipTotal = this.chips.size

    s.add(this.agent.root)
  }

  private makeHazard(kind: Kind, row: number, rand: () => number): Hazard {
    const blocked = Array.from({ length: LASER.cols }, () => false)
    if (kind === 'static') {
      const gaps = rand() < 0.5 ? 1 : 2
      const free = new Set<number>()
      while (free.size < gaps) free.add(Math.floor(rand() * LASER.cols))
      for (let c = 0; c < LASER.cols; c++) blocked[c] = !free.has(c)
    }
    return {
      kind, row, blocked,
      phase: rand() * this.tier.blinkPeriod,
      width: kind === 'sweep' ? (rand() < 0.5 ? 2 : 3) : 1.2,
      speed: 0.8 + rand() * 0.4,
      offset: rand() * 2,
      group: new Group(), beams: [], lit: [], head: null,
    }
  }

  private beam(len: number, x: number, y: number, parent: Group): Mesh {
    const g = this.geo(new BoxGeometry(len, 0.07, 0.07))
    const core = new Mesh(g, this.beamMat)
    core.position.set(x, y, 0)
    const glow = new Mesh(this.geo(new BoxGeometry(len, 0.22, 0.22)), this.glowMat)
    core.add(glow)
    parent.add(core)
    return core
  }

  private buildHazard(hz: Hazard, half: number): void {
    const span = half * 2 - 0.6
    if (hz.kind === 'static') {
      // one beam pair per run of blocked columns
      let c = 0
      while (c < LASER.cols) {
        if (!hz.blocked[c]) {
          c++
          continue
        }
        let e = c
        while (e + 1 < LASER.cols && hz.blocked[e + 1]) e++
        const x0 = (c - (LASER.cols - 1) / 2) * CELL - CELL / 2
        const x1 = (e - (LASER.cols - 1) / 2) * CELL + CELL / 2
        for (const y of [0.35, 0.85]) hz.beams.push(this.beam(x1 - x0, (x0 + x1) / 2, y, hz.group))
        c = e + 1
      }
    } else if (hz.kind === 'blink') {
      for (const y of [0.35, 0.85]) hz.beams.push(this.beam(span, 0, y, hz.group))
    } else if (hz.kind === 'sweep') {
      for (const y of [0.35, 0.85]) hz.beams.push(this.beam(hz.width * CELL, 0, y, hz.group))
      // rail the emitter slides along
      const rail = new Mesh(this.geo(new BoxGeometry(span, 0.06, 0.06)), this.mat(0x5d6270))
      rail.position.set(0, 1.2, 0)
      hz.group.add(rail)
    } else {
      // camera on the wall + lit floor cells
      const side = hz.offset > 1 ? 1 : -1
      const body = new Mesh(this.geo(new BoxGeometry(0.5, 0.32, 0.32)), this.mat(0xe8edf4))
      body.position.set(side * (half - 0.45), 2.0, 0)
      hz.group.add(body)
      const lens = new Mesh(this.geo(new CylinderGeometry(0.1, 0.12, 0.12, 10)), this.mat(0x22283a))
      lens.rotation.z = Math.PI / 2
      lens.position.set(-side * 0.3, 0, 0)
      body.add(lens)
      hz.head = body
      const plane = this.geo(new PlaneGeometry(CELL - 0.1, CELL - 0.1).rotateX(-Math.PI / 2))
      for (let c = 0; c < LASER.cols; c++) {
        const m = new Mesh(plane, this.litMat)
        m.position.set((c - (LASER.cols - 1) / 2) * CELL, 0.02, 0)
        m.visible = false
        hz.group.add(m)
        hz.lit.push(m)
      }
    }
  }

  // ---------------------------------------------------------------- hazard state
  /** Is column c of this hazard row dangerous at time t? */
  private danger(hz: Hazard, c: number, t: number): boolean {
    switch (hz.kind) {
      case 'static':
        return hz.blocked[c] === true
      case 'blink': {
        const P = this.tier.blinkPeriod
        const x = (((t + hz.phase) % P) + P) % P
        return x < P * this.onShare
      }
      case 'sweep': {
        const pos = this.sweepPos(hz, t)
        return c + 0.5 > pos && c + 0.5 < pos + hz.width
      }
      case 'camera':
        return Math.abs(c - this.spotPos(hz, t)) < hz.width
    }
  }

  private sweepPos(hz: Hazard, t: number): number {
    const range = LASER.cols - hz.width
    return tri((t * this.tier.sweepSpeed * hz.speed) / Math.max(1, range) + hz.offset) * range
  }

  private spotPos(hz: Hazard, t: number): number {
    return tri((t * this.tier.sweepSpeed * hz.speed * 0.7) / (LASER.cols - 1) + hz.offset) * (LASER.cols - 1)
  }

  private warn(hz: Hazard, t: number): boolean {
    if (hz.kind !== 'blink') return false
    const P = this.tier.blinkPeriod
    const x = (((t + hz.phase) % P) + P) % P
    return x > P - LASER.warnSeconds
  }

  private updateHazards(): void {
    const t = this.clock
    for (const hz of this.hazards) {
      if (hz.kind === 'blink') {
        const on = this.danger(hz, 0, t)
        const flicker = this.warn(hz, t) && Math.floor(t * 20) % 2 === 0
        for (const b of hz.beams) b.visible = on || flicker
      } else if (hz.kind === 'sweep') {
        const pos = this.sweepPos(hz, t)
        const x = (pos + hz.width / 2 - LASER.cols / 2) * CELL
        for (const b of hz.beams) b.position.x = x
      } else if (hz.kind === 'camera') {
        const sp = this.spotPos(hz, t)
        hz.lit.forEach((m, c) => (m.visible = Math.abs(c - sp) < hz.width))
        if (hz.head) {
          const tx = (sp - (LASER.cols - 1) / 2) * CELL
          hz.head.rotation.y = Math.atan2(0, 1) + (tx - hz.head.position.x) * -0.08
        }
      }
    }
  }

  // ---------------------------------------------------------------- agent
  private placeAgent(): void {
    const p = this.cellPos(this.col, this.row)
    this.agent.root.position.set(p.x, 0, p.z)
    this.agent.root.rotation.y = Math.PI
    this.camTarget.set(0, 0, p.z - 2.0)
  }

  move(dir: Dir): void {
    if (!this.running || this.finished) return
    if (this.hop || this.stun > 0) {
      this.queued = dir
      return
    }
    const [dc, dr] = DIRS[dir]
    const tc = this.col + dc
    const tr = this.row + dr
    if (tc < 0 || tc >= LASER.cols || tr < 0 || tr >= this.rows) return
    this.hop = { fc: this.col, fr: this.row, tc, tr, t: 0 }
    this.agent.face(dc, -dr, 1)
    AudioManager.play('whoosh', 1.5)
  }

  action(): void {
    this.move('fwd')
  }

  pointer(x: number, y: number): void {
    // direction from the agent on screen to the tap (dominant axis); a tap on the agent = forward
    const p = this.agent.root.position.clone().setY(0.6).project(this.camera)
    const ax = ((p.x + 1) / 2) * this.w
    const ay = ((1 - p.y) / 2) * this.h
    const dx = x - ax
    const dy = y - ay
    if (Math.hypot(dx, dy) < 28) return this.move('fwd')
    if (Math.abs(dx) > Math.abs(dy)) this.move(dx > 0 ? 'right' : 'left')
    else this.move(dy < 0 ? 'fwd' : 'back')
  }

  /** Mirror Shield gadget: catches the first hit. */
  private shield = false

  private hit(): void {
    if (this.shield) {
      this.shield = false
      this.flash = 'hit'
      this.flashT = 0.35
      this.stun = 0.25
      this.hop = null
      this.queued = null
      AudioManager.play('upgrade', 1.4)
      this.row = this.lastSafeRow
      this.placeAgent()
      return
    }
    this.mistakes++
    this.flash = 'miss'
    this.flashT = 0.35
    this.stun = 0.4
    this.litTime = 0
    this.hop = null
    this.queued = null
    AudioManager.play('laser_zap')
    AudioManager.play('alarm')
    if (this.mistakes >= this.tier.maxMistakes) {
      this.finish(false, 'alarm')
      return
    }
    this.row = this.lastSafeRow
    this.placeAgent()
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
    this.agent.update(dt)
    for (const m of this.chips.values()) m.rotation.y += dt * 2
    // camera follows the agent down the corridor
    const z = this.agent.root.position.z - 2.0
    this.camTarget.z += (z - this.camTarget.z) * Math.min(1, dt * 5)
    this.aimCamera()
    if (!this.running || this.finished) {
      this.publish()
      return
    }
    this.clock += dt
    this.updateHazards()
    this.stun = Math.max(0, this.stun - dt)

    // hop animation
    if (this.hop) {
      const hp = this.hop
      hp.t = Math.min(1, hp.t + dt / LASER.hopSeconds)
      const a = this.cellPos(hp.fc, hp.fr)
      const b = this.cellPos(hp.tc, hp.tr)
      this.agent.root.position.set(a.x + (b.x - a.x) * hp.t, Math.sin(hp.t * Math.PI) * 0.35, a.z + (b.z - a.z) * hp.t)
      this.agent.walking = 1
      if (hp.t >= 0.5) {
        this.col = hp.tc
        this.row = hp.tr
      }
      if (hp.t >= 1) {
        this.hop = null
        this.agent.walking = 0
        this.land()
        if (this.finished) return
      }
    } else if (this.queued && this.stun === 0) {
      const q = this.queued
      this.queued = null
      this.move(q)
    }

    // hazard contact on the (effective) current cell
    const hz = this.hazardAt.get(this.row)
    if (hz && this.stun === 0) {
      if (hz.kind === 'camera') {
        if (this.danger(hz, this.col, this.clock)) {
          this.litTime += dt
          if (this.litTime >= LASER.cameraGrace) this.hit()
        } else this.litTime = 0
      } else if (this.danger(hz, this.col, this.clock)) this.hit()
    } else this.litTime = 0

    this.time -= dt
    if (this.time <= 0 && !this.finished) {
      this.time = 0
      this.finish(false, 'time')
      return
    }
    this.publish()
  }

  private land(): void {
    if (!this.hazardAt.has(this.row)) this.lastSafeRow = this.row
    const key = `${this.col}:${this.row}`
    const chip = this.chips.get(key)
    if (chip) {
      this.scene.remove(chip)
      this.chips.delete(key)
      this.collected++
      this.flash = 'hit'
      this.flashT = 0.25
      AudioManager.play('keypad_beep', 1.3)
    }
    if (this.row >= this.rows - 1) {
      AudioManager.play('bolt_open')
      this.finish(true)
    }
  }

  private finish(success: boolean, reason?: 'alarm' | 'time'): void {
    this.running = false
    this.finished = true
    const share = this.time / this.tier.timeLimit
    const stars = !success ? 0 : this.mistakes === 0 && share >= LASER.threeStarTimeShare ? 3 : this.mistakes <= 1 ? 2 : 1
    this.publish()
    this.onResult({ success, stars, timeLeft: this.time, mistakes: this.mistakes, intel: success ? this.collected * LASER.intelPerChip : 0, reason })
  }

  revive(): void {
    this.mistakes = Math.min(this.mistakes, this.tier.maxMistakes - LASER.reviveMistakesLeft)
    this.time = Math.max(this.time, 0) + LASER.reviveSeconds
    this.finished = false
    this.running = true
    this.stun = 0.6
    this.row = this.lastSafeRow
    this.placeAgent()
    this.publish()
  }

  useHint(): void {
    /* the Laser Hall has no hint button */
  }

  // ---------------------------------------------------------------- planner (tests)
  /** Is (c, r) safe during [t0, t0 + span] (sampled)? */
  private safeDuring(c: number, r: number, t0: number, span: number): boolean {
    const hz = this.hazardAt.get(r)
    if (!hz) return true
    if (hz.kind === 'static') return !hz.blocked[c]
    for (let k = 0; k <= 6; k++) if (this.danger(hz, c, t0 + (span * k) / 6)) return false
    return true
  }

  /** Suggested next move for a careful player (automated tests). */
  debugNextMove(): Dir | 'wait' {
    if (this.hop || this.stun > 0 || this.finished) return 'wait'
    const r = this.row
    const pass = LASER.hopSeconds * 2 + 0.18 // enter the hazard row and leave it again
    const here = this.hazardAt.get(r)
    if (here) {
      // standing in a hazard row (only cameras allow that briefly): move on or step aside
      if (this.safeDuring(this.col, r + 1, this.clock, pass)) return 'fwd'
      for (const d of ['left', 'right'] as const) {
        const tc = this.col + (d === 'right' ? 1 : -1)
        if (tc >= 0 && tc < LASER.cols && this.safeDuring(tc, r, this.clock, 0.6)) return d
      }
      return 'fwd'
    }
    // safe row: for every column, when could we cross the next row from there?
    let best = { c: this.col, t: Infinity }
    for (let c = 0; c < LASER.cols; c++) {
      const travel = Math.abs(c - this.col) * (LASER.hopSeconds + 0.06)
      for (let w = 0; w <= 4; w += 0.05) {
        if (this.safeDuring(c, r + 1, this.clock + travel + w, pass)) {
          const cost = travel + w
          if (cost < best.t) best = { c, t: cost }
          break
        }
      }
    }
    if (best.c !== this.col) return best.c > this.col ? 'right' : 'left'
    return this.safeDuring(this.col, r + 1, this.clock, pass) ? 'fwd' : 'wait'
  }

  // ---------------------------------------------------------------- view
  private aimCamera(): void {
    const aspect = this.w / this.h
    const vfov = (this.camera.fov * Math.PI) / 180
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect)
    const width = LASER.cols * CELL + 1.6
    const dist = Math.max(12.5, width / 2 / Math.tan(hfov / 2) + 1)
    const dir = new Vector3(0, 0.84, 0.54).normalize()
    this.camera.position.copy(this.camTarget).addScaledVector(dir, dist)
    this.camera.lookAt(this.camTarget)
  }

  resize(w: number, h: number): void {
    this.w = w
    this.h = h
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.aimCamera()
  }

  private v = new Vector3()
  private screenOf(col: number, row: number): { x: number; y: number } {
    this.v.copy(this.cellPos(col, row)).setY(0.3).project(this.camera)
    return { x: ((this.v.x + 1) / 2) * this.w, y: ((1 - this.v.y) / 2) * this.h }
  }

  private publish(): void {
    mgHud.value = {
      done: this.collected,
      total: this.chipTotal,
      mistakes: this.mistakes,
      maxMistakes: this.tier.maxMistakes,
      timeLeft: this.time,
      timeLimit: this.tier.timeLimit,
      flash: this.flash,
      icon: 'chip',
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose()
    this.scene.clear()
    mgHud.value = null
  }
}
