/**
 * Animated character from the Quaternius CC0 packs (one merged SkinnedMesh, shared animation
 * library). Blob shadow underneath for low quality tiers.
 */
import { AnimationMixer, CircleGeometry, Group, Mesh, LoopOnce, LoopRepeat, type AnimationAction } from 'three'
import { characterProto, instantiate } from '../render/assets'
import { shadowMat } from '../render/materials'
import type { CharacterId } from '../config/models'

export interface Look {
  model: CharacterId
  /** Material-name -> sRGB hex (e.g. { Purple: 0x1f5f6b }). */
  tint?: Record<string, number>
  scale?: number
}

let shadowGeo: CircleGeometry | null = null

type Clip = 'Idle' | 'Walk' | 'Run' | 'Wave' | 'Interact'

export class Character {
  /** Blob shadows (low tier) instead of real shadow maps. */
  static blobs = true
  readonly root = new Group()
  private blob: Mesh
  private mixer: AnimationMixer | null = null
  private actions = new Map<Clip, AnimationAction>()
  private current: Clip | null = null
  private oneShot = 0
  /** 0..1 how much the character is moving this frame. */
  walking = 0
  /** Running instead of walking when moving. */
  runner = false
  activity: 'idle' | 'train' | 'cheer' = 'idle'
  ready = false

  constructor(look: Look) {
    shadowGeo ??= new CircleGeometry(0.42, 16).rotateX(-Math.PI / 2)
    const shadow = new Mesh(shadowGeo, shadowMat)
    shadow.position.y = 0.02
    shadow.renderOrder = -1
    shadow.name = 'blob'
    this.blob = shadow
    this.root.add(shadow)
    this.root.scale.setScalar(look.scale ?? 1)
    void characterProto(look.model, look.tint).then((proto) => {
      if (!proto) return
      const inst = instantiate(proto)
      this.root.add(inst)
      this.mixer = new AnimationMixer(inst)
      for (const name of ['Idle', 'Walk', 'Run', 'Wave', 'Interact'] as Clip[]) {
        const clip = proto.clips.find((c) => c.name === name)
        if (clip) this.actions.set(name, this.mixer.clipAction(clip))
      }
      this.mixer.timeScale = 1
      this.ready = true
      this.play('Idle', 0)
    })
  }

  private play(name: Clip, fade = 0.2): void {
    if (this.current === name) return
    const next = this.actions.get(name) ?? this.actions.get('Idle')
    if (!next) return
    const prev = this.current ? this.actions.get(this.current) : undefined
    next.reset()
    next.setLoop(name === 'Wave' && this.oneShot > 0 ? LoopOnce : LoopRepeat, Infinity)
    next.enabled = true
    next.setEffectiveWeight(1)
    next.play()
    if (prev && prev !== next && fade > 0) prev.crossFadeTo(next, fade, false)
    else if (prev && prev !== next) prev.stop()
    // de-sync identical characters
    if (fade === 0) next.time = Math.random() * next.getClip().duration
    this.current = name
  }

  /** Short celebratory wave (graduation, unlock). */
  cheer(seconds = 1.6): void {
    this.oneShot = seconds
  }

  update(dt: number): void {
    if (this.blob.visible !== Character.blobs) this.blob.visible = Character.blobs
    if (!this.mixer) return
    if (this.oneShot > 0) this.oneShot -= dt
    let want: Clip
    if (this.walking > 0.15) want = this.runner && this.walking > 0.6 ? 'Run' : 'Walk'
    else if (this.oneShot > 0 || this.activity === 'cheer') want = 'Wave'
    else if (this.activity === 'train') want = 'Interact'
    else want = 'Idle'
    this.play(want)
    const a = this.current ? this.actions.get(this.current) : undefined
    if (a && (this.current === 'Walk' || this.current === 'Run')) a.timeScale = 0.6 + this.walking * 0.6
    this.mixer.update(dt)
  }

  /** Face the movement direction smoothly. */
  face(dx: number, dz: number, dt: number): void {
    if (Math.abs(dx) + Math.abs(dz) < 1e-4) return
    const target = Math.atan2(dx, dz)
    let d = target - this.root.rotation.y
    d = Math.atan2(Math.sin(d), Math.cos(d))
    this.root.rotation.y += d * Math.min(1, dt * 14)
  }

}
