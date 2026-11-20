/**
 * Spot the Mole (Charm): a busy station hall full of travellers. Clues about the mole appear one
 * after another ("red hat", "glasses", "briefcase", "blue coat"); tap the one traveller who
 * matches all of them. A wrong suspect costs seconds. Hint: half of the wrong suspects leave.
 *
 * Draw calls: one merged SkinnedMesh per traveller + one InstancedMesh per accessory type
 * (hats, glasses, briefcases) + a handful for the hall.
 */
import {
  BoxGeometry, Color, CylinderGeometry, DirectionalLight, HemisphereLight, InstancedMesh, Matrix4, Mesh,
  MeshLambertMaterial, PerspectiveCamera, Quaternion, Scene, Vector3, type Bone, type BufferGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MOLE, MOLE_TIERS, type MoleTier } from '../../config/minigames'
import { GADGET } from '../../config/gadgets'
import { mgHud, type GameContext, type Minigame, type MinigameResult, type MissionModifiers, type MoleClue } from '../Minigame'
import { AudioManager } from '../../audio/AudioManager'
import { Character } from '../../academy/Character'
import { findBone } from '../../render/assets'
import { StaticBatch } from '../../render/geometry'
import { flatMat } from '../../render/materials'
import type { CharacterId } from '../../config/models'

type Attr = 'hat' | 'glasses' | 'bag' | 'shirt'
const ATTRS: Attr[] = ['hat', 'glasses', 'bag', 'shirt']
interface Looks {
  hat: number
  glasses: number
  bag: number
  shirt: number
}

const MODELS: CharacterId[] = ['cadetM1', 'cadetF1', 'cadetM2', 'cadetF2']
const RANGE: Record<Attr, number> = { hat: MOLE.hats.length, glasses: 2, bag: 2, shirt: MOLE.shirts.length }

interface Npc {
  ch: Character
  looks: Looks
  x: number
  z: number
  tx: number
  tz: number
  wait: number
  speed: number
  head: Bone | null
  hand: Bone | null
  /** Sent away by a hint: walks to the exit, then hidden. */
  leaving: boolean
  gone: boolean
  /** Already tapped as a wrong suspect. */
  wrong: boolean
}

function rnd(n: number): number {
  return Math.floor(Math.random() * n)
}

export class SpotTheMole implements Minigame {
  readonly id = 'mole' as const
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(38, 1, 0.1, 120)
  onResult: (r: MinigameResult) => void = () => {}

  private tier!: MoleTier
  private npcs: Npc[] = []
  private mole!: Npc
  private clues: { attr: Attr; value: number }[] = []
  private shown = 0
  private clueT = 0
  private interval = 5
  private time = 0
  private limit = 0
  private running = false
  private finished = false
  private flash: 'hit' | 'miss' | null = null
  private flashT = 0
  private firstTime = false
  private hintsLeft: number = MOLE.freeHints
  private mistakes = 0
  private w = 1
  private h = 1
  private hallW = 14
  private hallD = 10
  private hats!: InstancedMesh
  private glasses!: InstancedMesh
  private bags!: InstancedMesh
  private disposables: { dispose(): void }[] = []

  async init(ctx: GameContext, tierN: number, mods: MissionModifiers): Promise<void> {
    this.tier = MOLE_TIERS[Math.max(0, Math.min(MOLE_TIERS.length - 1, tierN - 1))]!
    const faster = Math.min(MOLE.maxSkillFaster, mods.agentSkill * MOLE.skillFasterPerPoint)
    this.interval = this.tier.clueInterval * (1 - faster)
    this.limit = this.tier.timeLimit
    this.time = this.limit
    this.firstTime = ctx.firstTime
    this.w = ctx.width
    this.h = ctx.height
    // hall shape follows the screen: deeper in portrait
    const portrait = ctx.height > ctx.width
    this.hallW = portrait ? 9.5 : 16
    this.hallD = portrait ? 14 : 9
    this.buildHall()
    this.makeCast()
    this.buildAccessories()
    // wait until every traveller model is ready (cached prototypes -> quick)
    for (let i = 0; i < 200 && this.npcs.some((n) => !n.ch.ready); i++) await new Promise((r) => setTimeout(r, 25))
    for (const n of this.npcs) {
      n.head = findBone(n.ch.root, /^head$/)
      n.hand = findBone(n.ch.root, /^arm-right$/)
    }
    this.resize(ctx.width, ctx.height)
    // Face Scanner gadget: three wrong suspects walk out right away
    if (mods.gadget === 'scanner') this.sendAway(GADGET.scannerRemove)
    this.shown = 1
    this.publish()
  }

  // ---------------------------------------------------------------- cast
  private randomLooks(): Looks {
    return { hat: rnd(RANGE.hat), glasses: rnd(2), bag: Math.random() < 0.35 ? 1 : 0, shirt: rnd(RANGE.shirt) }
  }

  private matches(l: Looks, upTo: number): boolean {
    for (let i = 0; i < upTo; i++) {
      const c = this.clues[i]!
      if (l[c.attr] !== c.value) return false
    }
    return true
  }

  private makeCast(): void {
    const t = this.tier
    // the mole wears every feature, so each clue is a clear positive ("red hat", "glasses", "briefcase", "blue coat")
    const moleLooks: Looks = { hat: 1 + rnd(RANGE.hat - 1), glasses: 1, bag: 1, shirt: rnd(RANGE.shirt) }
    // clue order: random attributes of the mole
    const order = [...ATTRS].sort(() => Math.random() - 0.5).slice(0, t.clues)
    this.clues = order.map((attr) => ({ attr, value: moleLooks[attr] }))
    const all: Looks[] = [moleLooks]
    for (let i = 1; i < t.npcs; i++) {
      const l = this.randomLooks()
      // look-alikes copy some of the mole's attributes
      for (const a of ATTRS) if (Math.random() < t.similarity) l[a] = moleLooks[a]
      // nobody else may match every clue: change the last clue's attribute
      if (this.matches(l, this.clues.length)) {
        // break the match on one clue (a different hat / coat colour, or no glasses / briefcase)
        const c = this.clues[rnd(this.clues.length)]!
        l[c.attr] = c.attr === 'glasses' || c.attr === 'bag' ? 0 : (c.value + 1 + rnd(RANGE[c.attr] - 1)) % RANGE[c.attr]
      }
      all.push(l)
    }
    // mole at a random index so it is not always the first one created
    const mi = rnd(all.length)
    ;[all[0], all[mi]] = [all[mi]!, all[0]!]
    all.forEach((looks, i) => {
      const model = MODELS[(i * 7 + rnd(MODELS.length)) % MODELS.length]!
      const ch = new Character({ model, tint: { shirt: MOLE.shirts[looks.shirt]! }, scale: 0.85 })
      const p = this.randomSpot()
      const n: Npc = { ch, looks, x: p.x, z: p.z, tx: p.x, tz: p.z, wait: Math.random() * 2, speed: this.tier.speed * (0.8 + Math.random() * 0.4), head: null, hand: null, leaving: false, gone: false, wrong: false }
      ch.root.position.set(p.x, 0, p.z)
      ch.root.rotation.y = Math.random() * Math.PI * 2
      this.scene.add(ch.root)
      this.npcs.push(n)
      if (i === mi) this.mole = n
    })
  }

  private randomSpot(): { x: number; z: number } {
    return { x: (Math.random() - 0.5) * (this.hallW - 1.6), z: (Math.random() - 0.5) * (this.hallD - 1.6) }
  }

  // ---------------------------------------------------------------- scene
  private buildHall(): void {
    const s = this.scene
    s.background = new Color(0x1e1a33)
    s.add(new HemisphereLight(0xeef4ff, 0x4a3d66, 1.6))
    const sun = new DirectionalLight(0xfff0d6, 1.6)
    sun.position.set(-4, 10, 6)
    s.add(sun)
    const W = this.hallW
    const D = this.hallD
    const b = new StaticBatch()
    // floor: big marble tiles with a darker border
    b.box(W + 2, 0.2, D + 2, 0, -0.1, 0, 0x8e7a63)
    const nx = Math.round(W / 1.5)
    const nz = Math.round(D / 1.5)
    for (let ix = 0; ix < nx; ix++)
      for (let iz = 0; iz < nz; iz++)
        b.box(W / nx - 0.05, 0.05, D / nz - 0.05, -W / 2 + (ix + 0.5) * (W / nx), 0.02, -D / 2 + (iz + 0.5) * (D / nz), (ix + iz) % 2 ? 0xe9e0cf : 0xd9ccb4)
    // back wall with arched windows, departure board and clock
    b.rbox(W + 2, 3.2, 0.4, 0, 1.6, -D / 2 - 1, 0xf3eee6, 0.06)
    const nWin = Math.max(2, Math.round(W / 3.4))
    for (let i = 0; i < nWin; i++) {
      const x = -W / 2 + (i + 0.5) * (W / nWin)
      b.rbox(1.4, 1.6, 0.1, x, 1.7, -D / 2 - 0.78, 0x7cc6d6, 0.3)
      b.rbox(1.6, 0.14, 0.16, x, 0.86, -D / 2 - 0.74, 0xc9bfb0, 0.04)
    }
    b.rbox(3.4, 0.9, 0.14, 0, 2.75, -D / 2 - 0.7, 0x22283a, 0.06)
    for (let r = 0; r < 3; r++) b.box(2.9, 0.1, 0.02, 0, 2.98 - r * 0.22, -D / 2 - 0.62, r === 0 ? 0xffd23f : 0xfff3e0)
    b.cyl(0.42, 0.42, 0.1, W / 2 - 1.2, 2.6, -D / 2 - 0.75, 0xffffff, 20, Math.PI / 2)
    b.cyl(0.47, 0.47, 0.08, W / 2 - 1.2, 2.6, -D / 2 - 0.79, 0x22283a, 20, Math.PI / 2)
    b.box(0.04, 0.3, 0.03, W / 2 - 1.2, 2.7, -D / 2 - 0.68, 0x22283a)
    b.box(0.22, 0.04, 0.03, W / 2 - 1.12, 2.6, -D / 2 - 0.68, 0x22283a)
    // side platforms: yellow safety line + benches along the edges
    b.box(0.12, 0.03, D, -W / 2 - 0.5, 0.05, 0, 0xffd23f)
    b.box(0.12, 0.03, D, W / 2 + 0.5, 0.05, 0, 0xffd23f)
    for (let i = 0; i < 2; i++) {
      const z = -D / 4 + i * (D / 2)
      for (const x of [-W / 2 - 0.85, W / 2 + 0.85]) {
        b.rbox(0.5, 0.1, 1.6, x, 0.45, z, 0xc98b4f, 0.03)
        b.rbox(0.1, 0.45, 1.6, x + (x < 0 ? -0.22 : 0.22), 0.7, z, 0xc98b4f, 0.03)
        b.box(0.08, 0.42, 0.08, x, 0.21, z - 0.6, 0x5d6779)
        b.box(0.08, 0.42, 0.08, x, 0.21, z + 0.6, 0x5d6779)
      }
    }
    // pillars at the corners
    for (const [x, z] of [[-W / 2 - 0.6, -D / 2 - 0.5], [W / 2 + 0.6, -D / 2 - 0.5]] as const) b.cyl(0.3, 0.34, 3.2, x, 1.6, z, 0xe8dfcf, 12)
    const geo = b.build()
    this.disposables.push(geo)
    const m = new Mesh(geo, flatMat)
    s.add(m)
  }

  private buildAccessories(): void {
    const n = this.npcs.length
    const mk = (geo: BufferGeometry, color: number) => {
      const mat = new MeshLambertMaterial({ color })
      const im = new InstancedMesh(geo, mat, n)
      im.frustumCulled = false
      this.disposables.push(geo, mat)
      this.scene.add(im)
      return im
    }
    // hat: brim + crown + band (white band coloured per instance as part of the crown colour)
    const hatGeo = mergeGeometries([
      new CylinderGeometry(0.5, 0.5, 0.05, 18).translate(0, 0.025, 0),
      new CylinderGeometry(0.31, 0.34, 0.34, 18).translate(0, 0.2, 0),
    ])!
    this.hats = mk(hatGeo, 0xffffff)
    const glassGeo = mergeGeometries([
      new BoxGeometry(0.26, 0.17, 0.06).translate(-0.16, 0, 0),
      new BoxGeometry(0.26, 0.17, 0.06).translate(0.16, 0, 0),
      new BoxGeometry(0.66, 0.05, 0.05).translate(0, 0.06, 0),
    ])!
    this.glasses = mk(glassGeo, 0x15151c)
    const bagGeo = mergeGeometries([
      new BoxGeometry(0.56, 0.4, 0.16).translate(0, -0.2, 0),
      new BoxGeometry(0.14, 0.05, 0.04).translate(0, 0.02, 0),
    ])!
    this.bags = mk(bagGeo, 0x6b4226)
    const white = new Color()
    for (let i = 0; i < n; i++) {
      const c = MOLE.hats[this.npcs[i]!.looks.hat]
      this.hats.setColorAt(i, c === null || c === undefined ? white : new Color(c))
    }
    if (this.hats.instanceColor) this.hats.instanceColor.needsUpdate = true
  }

  private m4 = new Matrix4()
  private v = new Vector3()
  private q = new Quaternion()
  private sc = new Vector3()
  private zero = new Matrix4().makeScale(0, 0, 0)

  /** Place hats / glasses / briefcases on the animated head and hand bones. */
  private syncAccessories(): void {
    this.scene.updateMatrixWorld()
    const off = new Vector3()
    this.npcs.forEach((n, i) => {
      const visible = !n.gone && n.head
      if (!visible || !n.head) {
        this.hats.setMatrixAt(i, this.zero)
        this.glasses.setMatrixAt(i, this.zero)
        this.bags.setMatrixAt(i, this.zero)
        return
      }
      n.head.matrixWorld.decompose(this.v, this.q, this.sc)
      const s = n.ch.root.scale.x
      // hat on top of the (big) head, glasses on its face
      if (n.looks.hat > 0) {
        off.set(0, 0.7 * s, -0.03 * s).applyQuaternion(this.q)
        this.m4.compose(this.v.clone().add(off), this.q, this.sc.set(s, s, s))
        this.hats.setMatrixAt(i, this.m4)
      } else this.hats.setMatrixAt(i, this.zero)
      if (n.looks.glasses) {
        off.set(0, 0.36 * s, 0.33 * s).applyQuaternion(this.q)
        this.m4.compose(this.v.clone().add(off), this.q, this.sc.set(s, s, s))
        this.glasses.setMatrixAt(i, this.m4)
      } else this.glasses.setMatrixAt(i, this.zero)
      if (n.looks.bag && n.hand) {
        n.hand.matrixWorld.decompose(this.v, this.q, this.sc)
        off.set(-0.06 * s, -0.42 * s, 0).applyQuaternion(this.q)
        const body = n.ch.root.quaternion
        this.m4.compose(this.v.clone().add(off), body, this.sc.set(s, s, s))
        this.bags.setMatrixAt(i, this.m4)
      } else this.bags.setMatrixAt(i, this.zero)
    })
    this.hats.instanceMatrix.needsUpdate = true
    this.glasses.instanceMatrix.needsUpdate = true
    this.bags.instanceMatrix.needsUpdate = true
  }

  // ---------------------------------------------------------------- input
  pointer(x: number, y: number): void {
    if (!this.running || this.finished) return
    const n = this.pick(x, y)
    if (!n) return
    if (n === this.mole) {
      this.flash = 'hit'
      this.flashT = 0.5
      n.ch.cheer(2)
      AudioManager.play('bolt_open')
      this.finish(true)
      return
    }
    this.mistakes++
    n.wrong = true
    // a wrong suspect walks out, so he cannot confuse you twice
    n.leaving = true
    n.tx = n.x < 0 ? -this.hallW / 2 - 3 : this.hallW / 2 + 3
    n.tz = n.z
    n.wait = 0
    n.speed = Math.max(n.speed, 1.8)
    this.time = Math.max(0, this.time - MOLE.wrongPenalty)
    this.flash = 'miss'
    this.flashT = 0.35
    AudioManager.play('alarm', 1.4)
    if (this.time <= 0) this.finish(false, 'time')
    this.publish()
  }

  /** Traveller under a screen point (CSS px): nearest projected torso within reach. */
  private pick(x: number, y: number): Npc | null {
    let best: Npc | null = null
    let bestD = Infinity
    for (const n of this.npcs) {
      if (n.gone || n.leaving) continue
      const s = this.screenOf(n.x, 0.85, n.z)
      const top = this.screenOf(n.x, 1.7, n.z)
      const reach = Math.max(26, Math.abs(s.y - top.y) * 0.75)
      const d = Math.hypot(s.x - x, s.y - y)
      if (d < reach && d < bestD) {
        best = n
        bestD = d
      }
    }
    return best
  }

  private screenOf(x: number, y: number, z: number): { x: number; y: number } {
    const p = this.v.set(x, y, z).project(this.camera)
    return { x: ((p.x + 1) / 2) * this.w, y: ((1 - p.y) / 2) * this.h }
  }

  action(): void {
    // no primary action: the player taps a traveller
  }

  /** Half of the remaining wrong suspects walk out of the hall. */
  useHint(): void {
    if (this.finished) return
    this.sendAway(Math.floor(this.npcs.filter((n) => n !== this.mole && !n.leaving && !n.gone).length * MOLE.hintRemoveShare))
    this.hintsLeft = Math.max(0, this.hintsLeft - 1)
    AudioManager.play('whoosh')
    this.publish()
  }

  /** k wrong suspects (the most confusing first) walk out of the hall. */
  private sendAway(k: number): void {
    const wrong = this.npcs.filter((n) => n !== this.mole && !n.leaving && !n.gone)
    // prefer the most confusing ones (matching most shown clues)
    const score = (n: Npc) => this.clues.slice(0, this.shown).filter((c) => n.looks[c.attr] === c.value).length
    wrong.sort((a, b) => score(b) - score(a) || Math.random() - 0.5)
    for (const n of wrong.slice(0, k)) {
      n.leaving = true
      n.tx = n.x < 0 ? -this.hallW / 2 - 3 : this.hallW / 2 + 3
      n.tz = n.z
      n.wait = 0
      n.speed = Math.max(n.speed, 1.6)
    }
  }

  freeHints(): number {
    return this.hintsLeft
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
    const moving = this.running || this.finished
    for (const n of this.npcs) {
      if (n.gone) continue
      if (moving && !(this.finished && n === this.mole)) this.walk(n, dt)
      else n.ch.walking = 0
      n.ch.update(dt)
    }
    this.syncAccessories()
    if (!this.running || this.finished) {
      this.publish()
      return
    }
    // clues
    if (this.shown < this.clues.length) {
      this.clueT += dt
      if (this.clueT >= this.interval) {
        this.clueT = 0
        this.shown++
        AudioManager.play('keypad_beep', 1.1)
      }
    }
    this.time -= dt
    if (this.time <= 0) {
      this.time = 0
      this.finish(false, 'time')
      return
    }
    this.publish()
  }

  private walk(n: Npc, dt: number): void {
    const dx = n.tx - n.x
    const dz = n.tz - n.z
    const d = Math.hypot(dx, dz)
    if (d < 0.05) {
      n.ch.walking = 0
      if (n.leaving) {
        n.gone = true
        n.ch.root.visible = false
        return
      }
      n.wait -= dt
      if (n.wait <= 0) {
        // wander locally (random targets across the whole hall bunch everyone up in the middle)
        const a = Math.random() * Math.PI * 2
        const r = 1.5 + Math.random() * 2.5
        const mx = (this.hallW - 1.6) / 2
        const mz = (this.hallD - 1.6) / 2
        n.tx = Math.max(-mx, Math.min(mx, n.x + Math.cos(a) * r))
        n.tz = Math.max(-mz, Math.min(mz, n.z + Math.sin(a) * r))
        n.wait = 0.6 + Math.random() * 2.5
      }
      return
    }
    const step = Math.min(d, n.speed * dt)
    n.x += (dx / d) * step
    n.z += (dz / d) * step
    n.ch.walking = Math.min(1, n.speed / 1.2)
    n.ch.face(dx, dz, dt)
    n.ch.root.position.set(n.x, 0, n.z)
  }

  private finish(success: boolean, reason?: 'alarm' | 'time'): void {
    this.running = false
    this.finished = true
    const left = this.time / this.limit
    const stars = !success ? 0 : left >= MOLE.threeStarLeftShare ? 3 : left >= MOLE.twoStarLeftShare ? 2 : 1
    // reveal the mole on failure too
    if (!success) this.mole.ch.cheer(2)
    this.publish()
    this.onResult({ success, stars, timeLeft: this.time, mistakes: this.mistakes, intel: 0, reason })
  }

  revive(): void {
    this.time = Math.max(0, this.time) + MOLE.reviveSeconds
    this.limit = Math.max(this.limit, this.time)
    this.finished = false
    this.running = true
    this.mole.ch.cheer(0)
    this.publish()
  }

  // ---------------------------------------------------------------- QA
  /** Screen position of the mole (tests) or of a wrong suspect. */
  debugTarget(wrong = false): { x: number; y: number } | null {
    const n = wrong ? this.npcs.find((k) => k !== this.mole && !k.gone && !k.leaving) : this.mole
    if (!n) return null
    return this.screenOf(n.x, 0.9, n.z)
  }

  /** Every clue revealed? (the solver taps only then). */
  debugAllClues(): boolean {
    return this.shown >= this.clues.length
  }

  // ---------------------------------------------------------------- view
  resize(w: number, h: number): void {
    this.w = w
    this.h = h
    this.camera.aspect = w / h
    const portrait = h > w
    // lower, more frontal view so faces (glasses) and coats read; hall sits between clue bar and hint button
    const tilt = 0.78
    const vfov = (this.camera.fov * Math.PI) / 180
    const usable = portrait ? 0.7 : 0.72
    const depthOnScreen = this.hallD * Math.sin(tilt) + 2.2 * Math.cos(tilt)
    const distD = depthOnScreen / usable / 2 / Math.tan(vfov / 2)
    const distW = (this.hallW + 1.6) / 2 / Math.tan(vfov / 2) / this.camera.aspect
    const dist = Math.max(distD, distW) + this.hallD / 2 * Math.cos(tilt) * 0.3
    // aim slightly above the floor centre and push the view down below the clue chips
    const shift = portrait ? 0.9 : 0.7
    this.camera.position.set(0, Math.sin(tilt) * dist, Math.cos(tilt) * dist + shift)
    this.camera.lookAt(0, 0.6, shift - 0.2)
    this.camera.updateProjectionMatrix()
  }

  private publish(): void {
    const clues: MoleClue[] = this.clues.map((c, i) => ({
      key: `mole.${c.attr}.${c.attr === 'hat' ? MOLE.hatNames[c.value] : c.attr === 'shirt' ? MOLE.shirtNames[c.value] : c.value ? 'yes' : 'no'}`,
      color: c.attr === 'hat' ? MOLE.hats[c.value] ?? null : c.attr === 'shirt' ? MOLE.shirts[c.value]! : null,
      icon: c.attr,
      shown: i < this.shown,
      progress: i === this.shown ? this.clueT / this.interval : i < this.shown ? 1 : 0,
    }))
    let ghost: { x: number; y: number; pulse: boolean } | null = null
    if (this.firstTime && this.running && this.shown >= this.clues.length) {
      const p = this.screenOf(this.mole.x, 1.0, this.mole.z)
      ghost = { x: p.x - 10, y: p.y - 6, pulse: Math.sin(performance.now() / 160) > 0 }
    }
    mgHud.value = {
      done: 0,
      total: 0,
      mistakes: 0,
      maxMistakes: 0,
      timeLeft: this.time,
      timeLimit: this.limit,
      ghost,
      flash: this.flash,
      clues,
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
