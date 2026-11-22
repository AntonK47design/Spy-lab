/**
 * Safe Cracker (Finesse): a pointer circles the dial; tap while it is inside the green
 * sweet spot to throw a bolt. Decoy zones and misses count as mistakes; too many trip the alarm.
 */
import {
  Color, CylinderGeometry, DirectionalLight, Group, HemisphereLight, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, PerspectiveCamera, RingGeometry, Scene, BoxGeometry, Vector3,
} from 'three'
import { SAFE, SAFE_TIERS, type SafeTier } from '../../config/minigames'
import { GADGET } from '../../config/gadgets'
import { mgHud, type GameContext, type Minigame, type MinigameResult, type MissionModifiers } from '../Minigame'
import { AudioManager } from '../../audio/AudioManager'

const R = 2
const TAU = Math.PI * 2

interface Zone {
  center: number
  width: number
  fake: boolean
  mesh: Mesh
}

export class SafeCracker implements Minigame {
  readonly id = 'safe' as const
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(30, 1, 0.1, 100)
  onResult: (r: MinigameResult) => void = () => {}
  /** Vault Bonus: called for every bolt cracked. */
  onBolt?: (n: number) => void

  private tier!: SafeTier
  private zoneW = 0
  private angle = Math.PI / 2
  private dir = -1
  private done = 0
  private mistakes = 0
  private time = 0
  private running = false
  private finished = false
  private zones: Zone[] = []
  private needle = new Group()
  private bolts: Mesh[] = []
  private boltOpen: number[] = []
  private dial = new Group()
  private shake = 0
  private flashT = 0
  private flash: 'hit' | 'miss' | null = null
  private lastTick = 0
  private firstTime = false
  private w = 1
  private h = 1
  private disposables: { dispose(): void }[] = []
  private zoneMatOk = new MeshBasicMaterial({ color: 0x5fe07a })
  private zoneMatFake = new MeshBasicMaterial({ color: 0xa7d65a })

  async init(ctx: GameContext, tierN: number, mods: MissionModifiers): Promise<void> {
    this.tier = SAFE_TIERS[Math.max(0, Math.min(SAFE_TIERS.length - 1, tierN - 1))] as SafeTier
    const bonus = Math.min(SAFE.maxSkillBonusDeg, mods.agentSkill * SAFE.zoneDegPerSkill)
    // Stethoscope Pro gadget: sweet spot +15 %
    const gadget = mods.gadget === 'stethoscope' ? 1 + GADGET.stethoscopeZone : 1
    this.zoneW = (((this.tier.zoneDeg + bonus) * gadget) * Math.PI) / 180
    this.time = this.tier.timeLimit
    this.firstTime = ctx.firstTime
    this.w = ctx.width
    this.h = ctx.height
    this.build()
    this.placeZones()
    this.resize(ctx.width, ctx.height)
    this.publish()
  }

  private build(): void {
    const s = this.scene
    s.background = new Color(0x163f48)
    s.add(new HemisphereLight(0xffffff, 0x334455, 1.6))
    const d = new DirectionalLight(0xffffff, 1.2)
    d.position.set(2, 4, 6)
    s.add(d)
    const mat = (c: number) => {
      const m = new MeshLambertMaterial({ color: c, flatShading: true })
      this.disposables.push(m)
      return m
    }
    const geo = <T extends { dispose(): void }>(g: T): T => {
      this.disposables.push(g)
      return g
    }
    // vault wall + door
    const wall = new Mesh(geo(new BoxGeometry(14, 10, 0.4)), mat(0x1f5f6b))
    wall.position.z = -0.6
    s.add(wall)
    const door = new Mesh(geo(new CylinderGeometry(R * 1.55, R * 1.55, 0.5, 40)), mat(0x8a94a6))
    door.rotation.x = Math.PI / 2
    door.position.z = -0.3
    s.add(door)
    const rim = new Mesh(geo(new RingGeometry(R * 1.55, R * 1.75, 48)), mat(0x5d6270))
    rim.position.z = -0.04
    s.add(rim)
    // bolts on the door edge
    const boltGeo = geo(new BoxGeometry(0.7, 0.26, 0.26))
    for (let i = 0; i < this.tier.bolts; i++) {
      const a = Math.PI * (0.65 + (i / Math.max(1, this.tier.bolts - 1)) * 0.7)
      const b = new Mesh(boltGeo, mat(0xd0d6e0))
      b.position.set(Math.cos(a) * R * 1.62, Math.sin(a) * R * 1.62, 0.05)
      b.rotation.z = a
      b.userData.a = a
      s.add(b)
      this.bolts.push(b)
      this.boltOpen.push(0)
    }
    // dial face + tick marks
    this.dial.position.z = 0.02
    s.add(this.dial)
    const face = new Mesh(geo(new CylinderGeometry(R, R, 0.2, 48)), mat(0x22283a))
    face.rotation.x = Math.PI / 2
    this.dial.add(face)
    const track = new Mesh(geo(new RingGeometry(R * 0.72, R * 0.95, 64)), mat(0x3a4152))
    track.position.z = 0.11
    this.dial.add(track)
    const tickGeo = geo(new BoxGeometry(0.05, 0.16, 0.02))
    const tickMat = mat(0x9aa3b5)
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU
      const t = new Mesh(tickGeo, tickMat)
      t.position.set(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62, 0.12)
      t.rotation.z = a - Math.PI / 2
      this.dial.add(t)
    }
    const knob = new Mesh(geo(new CylinderGeometry(0.45, 0.5, 0.3, 20)), mat(0xf2b134))
    knob.rotation.x = Math.PI / 2
    knob.position.z = 0.2
    this.dial.add(knob)
    // needle
    const needle = new Mesh(geo(new BoxGeometry(R * 0.98, 0.12, 0.06)), mat(0xf2665c))
    needle.position.x = R * 0.49
    this.needle.add(needle)
    const tip = new Mesh(geo(new CylinderGeometry(0.13, 0.13, 0.08, 12)), mat(0xfff3e0))
    tip.rotation.x = Math.PI / 2
    tip.position.x = R * 0.86
    this.needle.add(tip)
    this.needle.position.z = 0.24
    this.dial.add(this.needle)
    this.disposables.push(this.zoneMatOk, this.zoneMatFake)
  }

  private placeZones(): void {
    for (const z of this.zones) {
      this.dial.remove(z.mesh)
      z.mesh.geometry.dispose()
    }
    this.zones = []
    const taken: number[] = []
    const pick = (minFromNeedle: number) => {
      for (let tries = 0; tries < 40; tries++) {
        const c = Math.random() * TAU
        if (angDist(c, this.angle) < minFromNeedle) continue
        if (taken.some((t) => angDist(t, c) < this.zoneW * 1.4)) continue
        taken.push(c)
        return c
      }
      const c = this.angle + Math.PI
      taken.push(c)
      return c
    }
    const real = pick(Math.PI / 2)
    this.addZone(real, this.zoneW, false)
    const fakes = this.done === 0 && this.firstTime ? 0 : this.tier.fakes
    for (let i = 0; i < fakes; i++) this.addZone(pick(0.6), this.zoneW * 0.8, true)
  }

  private addZone(center: number, width: number, fake: boolean): void {
    const g = new RingGeometry(R * 0.72, R * 0.95, 24, 1, center - width / 2, width)
    const m = new Mesh(g, fake ? this.zoneMatFake : this.zoneMatOk)
    m.position.z = 0.13
    this.dial.add(m)
    this.zones.push({ center, width, fake, mesh: m })
  }

  start(): void {
    this.running = true
  }
  pause(): void {
    this.running = false
  }
  resume(): void {
    if (!this.finished) this.running = true
  }

  action(): void {
    if (!this.running || this.finished) return
    const hit = this.zones.find((z) => angDist(z.center, this.angle) <= z.width / 2)
    if (hit && !hit.fake) {
      this.boltOpen[this.done] = 0.0001
      this.done++
      this.flash = 'hit'
      this.flashT = 0.25
      AudioManager.play('bolt_open')
      this.onBolt?.(this.done)
      if (this.done >= this.tier.bolts) return this.finish(true)
      if (this.tier.reverse) this.dir *= -1
      this.placeZones()
    } else {
      this.mistakes++
      this.flash = 'miss'
      this.flashT = 0.3
      this.shake = 0.3
      AudioManager.play('safe_tick', 0.55)
      if (this.mistakes >= this.tier.maxMistakes) return this.finish(false, 'alarm')
    }
    this.publish()
  }

  update(dt: number): void {
    // bolts slide even after the end
    for (let i = 0; i < this.bolts.length; i++) {
      if (this.boltOpen[i]! > 0 && this.boltOpen[i]! < 1) {
        this.boltOpen[i] = Math.min(1, this.boltOpen[i]! + dt * 4)
        const b = this.bolts[i]!
        const a = b.userData.a as number
        const r = R * (1.62 + this.boltOpen[i]! * 0.45)
        b.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.05)
      }
    }
    this.shake = Math.max(0, this.shake - dt)
    this.dial.position.x = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.4 : 0
    this.flashT = Math.max(0, this.flashT - dt)
    if (this.flashT === 0) this.flash = null
    if (!this.running || this.finished) {
      this.publish()
      return
    }
    this.angle = (this.angle + this.dir * this.tier.speed * TAU * dt + TAU) % TAU
    this.needle.rotation.z = this.angle
    if (Math.abs(this.angle - this.lastTick) > Math.PI / 4) {
      this.lastTick = this.angle
      AudioManager.play('safe_tick', 1.2)
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
    const share = this.time / this.tier.timeLimit
    const stars = !success ? 0 : this.mistakes === 0 && share >= SAFE.threeStarTimeShare ? 3 : this.mistakes <= 1 ? 2 : 1
    this.publish()
    this.onResult({ success, stars, timeLeft: this.time, mistakes: this.mistakes, intel: 0, reason })
  }

  revive(): void {
    this.mistakes = Math.min(this.mistakes, this.tier.maxMistakes - SAFE.reviveMistakesLeft)
    this.time = Math.max(this.time, 0) + SAFE.reviveSeconds
    this.finished = false
    this.running = true
    this.placeZones()
    this.publish()
  }

  useHint(): void {
    /* Safe Cracker has no hints */
  }

  resize(w: number, h: number): void {
    this.w = w
    this.h = h
    this.camera.aspect = w / h
    // dial (radius ~R*2.1 incl. bolts) fills ~80 % of the short side, leaving room for the HUD
    const need = R * 2.2 * 2
    const fitH = need / Math.min(1, w / h) / 0.8
    this.camera.position.set(0, 0, fitH / 2 / Math.tan((30 * Math.PI) / 360))
    this.camera.lookAt(0, 0, 0)
    this.camera.updateProjectionMatrix()
  }

  private v = new Vector3()
  private publish(): void {
    mgHud.value = {
      done: this.done,
      total: this.tier.bolts,
      mistakes: this.mistakes,
      maxMistakes: this.tier.maxMistakes,
      timeLeft: this.time,
      timeLimit: this.tier.timeLimit,
      flash: this.flash,
    }
  }

  /** Debug/test helper: angle distance to the real zone (radians). */
  debugZoneOffset(): number {
    const z = this.zones.find((q) => !q.fake)
    return z ? angDist(z.center, this.angle) : Math.PI
  }

  dispose(): void {
    for (const z of this.zones) z.mesh.geometry.dispose()
    for (const d of this.disposables) d.dispose()
    this.scene.clear()
    mgHud.value = null
  }
}

function angDist(a: number, b: number): number {
  const d = Math.abs(((a - b) % TAU) + TAU) % TAU
  return d > Math.PI ? TAU - d : d
}
