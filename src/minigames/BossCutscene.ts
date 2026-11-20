/**
 * Boss captured: the Velvet Paw lieutenant struggles in a foam net while cash rains down, the
 * camera circles slowly. Runs like a minigame (own scene in the shared renderer) and reports
 * "done" after a few seconds; the result folder then shows "CAPTURED" over it.
 */
import {
  BoxGeometry, Color, DirectionalLight, HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, SphereGeometry, PerspectiveCamera, Quaternion, Scene, Vector3, Euler,
} from 'three'
import type { GameContext, Minigame, MinigameResult } from './Minigame'
import { mgHud } from './Minigame'
import { Character } from '../academy/Character'
import { findBone } from '../render/assets'
import { StaticBatch } from '../render/geometry'
import { flatMat } from '../render/materials'
import { AudioManager } from '../audio/AudioManager'

export interface BossLook {
  suit: number
  hat: 'captain' | 'bobble'
  hatColor: number
}

const BILLS = 70
const DURATION = 2.8

export class BossCutscene implements Minigame {
  readonly id = 'safe' as const
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(40, 1, 0.1, 100)
  onResult: (r: MinigameResult) => void = () => {}
  private boss!: Character
  private bills!: InstancedMesh
  private billState: { p: Vector3; v: number; r: Euler; s: number }[] = []
  private foam!: Mesh
  private net!: Mesh
  private t = 0
  private done = false
  private running = false
  private disposables: { dispose(): void }[] = []

  constructor(private look: BossLook, private floor = 0x9b6b43) {}

  async init(ctx: GameContext): Promise<void> {
    const s = this.scene
    s.background = new Color(0x1e1a33)
    s.add(new HemisphereLight(0xeef4ff, 0x4a3d66, 1.6))
    const sun = new DirectionalLight(0xfff0d6, 1.5)
    sun.position.set(-3, 8, 5)
    s.add(sun)
    // little stage: round platform + spotlight disc
    const b = new StaticBatch()
    b.cyl(3.2, 3.4, 0.4, 0, -0.2, 0, this.floor, 28)
    b.cyl(2.2, 2.2, 0.02, 0, 0.01, 0, 0xfff3c4, 28)
    const g = b.build()
    this.disposables.push(g)
    s.add(new Mesh(g, flatMat))
    this.boss = new Character({ model: 'agentM', tint: { shirt: this.look.suit, pants: this.look.suit } })
    s.add(this.boss.root)
    for (let i = 0; i < 200 && !this.boss.ready; i++) await new Promise((r) => setTimeout(r, 25))
    this.dressBoss()
    // foam up to the waist + a rope net over him (face stays visible)
    const fb = new StaticBatch()
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2
      const r = 0.55 + (i % 3) * 0.12
      fb.sphere(0.34 + (i % 3) * 0.07, Math.cos(a) * r, 0.25 + (i % 2) * 0.28, Math.sin(a) * r, 0xffffff, 8, 6)
    }
    const fg = fb.build()
    this.disposables.push(fg)
    const foamMat = new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.92 })
    this.disposables.push(foamMat)
    this.foam = new Mesh(fg, foamMat)
    this.foam.scale.setScalar(0.01)
    s.add(this.foam)
    // rope net over him: wireframe dome (diamond mesh)
    const netGeo = new SphereGeometry(1, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2)
    const netMat = new MeshBasicMaterial({ color: 0x3b2a1a, wireframe: true })
    this.disposables.push(netGeo, netMat)
    this.net = new Mesh(netGeo, netMat)
    this.net.scale.set(0.01, 0.01, 0.01)
    s.add(this.net)
    // cash rain
    const bg = new BoxGeometry(0.3, 0.02, 0.16)
    const bm = new MeshLambertMaterial({ color: 0x3ddc84 })
    this.disposables.push(bg, bm)
    this.bills = new InstancedMesh(bg, bm, BILLS)
    s.add(this.bills)
    for (let i = 0; i < BILLS; i++)
      this.billState.push({
        p: new Vector3((Math.random() - 0.5) * 6, 4 + Math.random() * 6, (Math.random() - 0.5) * 6),
        v: 1.2 + Math.random() * 1.4,
        r: new Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3),
        s: 0.6 + Math.random() * 0.5,
      })
    this.resize(ctx.width, ctx.height)
    mgHud.value = null
  }

  /** Cat-ear mask + hat (captain cap / bobble hat) on the head bone. */
  private dressBoss(): void {
    const head = findBone(this.boss.root, /^head$/)
    if (!head) return
    const b = new StaticBatch()
    b.cone(0.1, 0.18, -0.2, 0.68, 0, 0x1b1b24, 4)
    b.cone(0.1, 0.18, 0.2, 0.68, 0, 0x1b1b24, 4)
    b.rbox(0.66, 0.13, 0.05, 0, 0.4, 0.33, 0x1b1b24, 0.03)
    if (this.look.hat === 'captain') {
      b.cyl(0.36, 0.38, 0.2, 0, 0.74, -0.02, this.look.hatColor, 16)
      b.rbox(0.5, 0.04, 0.22, 0, 0.66, 0.3, 0x1b1b24, 0.02)
      b.rbox(0.2, 0.08, 0.02, 0, 0.76, 0.36, 0xf2b134, 0.01)
    } else {
      b.cyl(0.36, 0.4, 0.26, 0, 0.72, -0.02, this.look.hatColor, 16)
      b.sphere(0.14, 0, 0.92, -0.02, 0xffffff, 8, 6)
    }
    const geo = b.build()
    this.disposables.push(geo)
    const m = new Mesh(geo, flatMat)
    const ws = new Vector3()
    head.getWorldScale(ws)
    m.scale.setScalar(1 / Math.max(1e-3, ws.x))
    head.add(m)
  }

  start(): void {
    this.running = true
    AudioManager.play('whoosh', 0.8)
  }
  pause(): void {
    this.running = false
  }
  resume(): void {
    this.running = true
  }

  private m4 = new Matrix4()
  private q = new Quaternion()

  update(dt: number): void {
    if (!this.running) return
    this.t += dt
    this.boss.walking = 0
    this.boss.activity = 'cheer' // arms up: struggling in the net
    this.boss.update(dt)
    this.boss.root.rotation.y = Math.sin(this.t * 7) * 0.25
    // foam pops in with a little overshoot
    const k = Math.min(1, this.t / 0.45)
    const pop = k < 1 ? k * (1.15 - 0.15 * k) * 1.05 : 1 + Math.sin(this.t * 6) * 0.02
    this.foam.scale.setScalar(Math.max(0.01, pop))
    const nk = Math.min(1, Math.max(0, (this.t - 0.15) / 0.35))
    this.net.scale.set(1.0 * nk + 0.01, 2.15 * nk + 0.01, 1.0 * nk + 0.01)
    this.net.rotation.y = Math.sin(this.t * 7) * 0.08
    // cash rain (starts after the net)
    for (let i = 0; i < BILLS; i++) {
      const b = this.billState[i]!
      if (this.t > 0.4) {
        b.p.y -= b.v * dt
        b.r.x += dt * 2
        b.r.z += dt * 1.5
        if (b.p.y < 0.05) b.p.y = 0.05
      }
      this.q.setFromEuler(b.r)
      this.m4.compose(b.p, this.q, new Vector3(b.s, b.s, b.s))
      this.bills.setMatrixAt(i, this.m4)
    }
    this.bills.instanceMatrix.needsUpdate = true
    // slow orbit
    const a = -0.25 + this.t * 0.18
    this.camera.position.set(Math.sin(a) * 6.4, 2.5, Math.cos(a) * 6.4)
    this.camera.lookAt(0, 1.25, 0)
    if (!this.done && this.t >= DURATION) {
      this.done = true
      this.onResult({ success: true, stars: 3, timeLeft: 0, mistakes: 0, intel: 0 })
    }
  }

  revive(): void {}
  useHint(): void {}
  action(): void {}

  resize(w: number, h: number): void {
    this.camera.aspect = w / h
    this.camera.fov = h > w ? 55 : 40
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose()
    this.scene.clear()
  }
}
