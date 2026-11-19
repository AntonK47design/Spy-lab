/**
 * Isometric-style follow camera (perspective, small FOV, fixed pitch). "Expand" framing:
 * a safe ground rectangle around the player is always visible, the world fills the rest.
 */
import { PerspectiveCamera, Raycaster, Vector2, Vector3, Plane, type Object3D } from 'three'

export const FOLLOW = {
  fov: 48,
  pitchDeg: 52,
  /** Visible world width at the focus (art bible: ~11 m portrait, ~21 m landscape). */
  widthPortrait: 11,
  widthLandscape: 21,
  lookAhead: 0.6,
  lerp: 6,
  bounds: { minX: -13, maxX: 34, minZ: -40, maxZ: 17 },
}

export class FollowCamera {
  readonly camera = new PerspectiveCamera(FOLLOW.fov, 1, 0.5, 150)
  readonly target = new Vector3()
  private dist = 20
  private dir = new Vector3()
  private ray = new Raycaster()
  private ndc = new Vector2()
  private ground = new Plane(new Vector3(0, 1, 0), 0)
  private hit = new Vector3()
  zoom = 1

  constructor() {
    const p = (FOLLOW.pitchDeg * Math.PI) / 180
    this.dir.set(0, Math.sin(p), Math.cos(p))
  }

  resize(w: number, h: number): void {
    const aspect = w / h
    this.camera.aspect = aspect
    // size the view by visible world width; blend between portrait and landscape values
    const t = Math.min(1, Math.max(0, (aspect - 0.6) / (1.6 - 0.6)))
    const width = FOLLOW.widthPortrait + (FOLLOW.widthLandscape - FOLLOW.widthPortrait) * t
    const viewH = width / aspect
    this.dist = viewH / 2 / Math.tan((FOLLOW.fov * Math.PI) / 360)
    this.camera.updateProjectionMatrix()
    this.apply()
  }

  snap(x: number, z: number): void {
    this.target.set(clamp(x, FOLLOW.bounds.minX, FOLLOW.bounds.maxX), 0, clamp(z, FOLLOW.bounds.minZ, FOLLOW.bounds.maxZ))
    this.apply()
  }

  private lx = 0
  private lz = 0
  follow(x: number, z: number, dt: number): void {
    // slight look-ahead in the walking direction
    const vx = x - this.lx
    const vz = z - this.lz
    this.lx = x
    this.lz = z
    if (dt > 0) {
      x += Math.max(-1, Math.min(1, vx / dt / 6)) * FOLLOW.lookAhead
      z += Math.max(-1, Math.min(1, vz / dt / 6)) * FOLLOW.lookAhead
    }
    const k = 1 - Math.exp(-dt * FOLLOW.lerp)
    this.target.x += (clamp(x, FOLLOW.bounds.minX, FOLLOW.bounds.maxX) - this.target.x) * k
    this.target.z += (clamp(z, FOLLOW.bounds.minZ, FOLLOW.bounds.maxZ) - this.target.z) * k
    this.apply()
  }

  private apply(): void {
    const d = this.dist * this.zoom
    this.camera.position.set(this.target.x + this.dir.x * d, this.dir.y * d, this.target.z + this.dir.z * d)
    this.camera.lookAt(this.target)
  }

  /** Screen point -> ground (y=0) point. */
  groundAt(cx: number, cy: number, el: HTMLElement): Vector3 | null {
    const r = el.getBoundingClientRect()
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
    this.ray.setFromCamera(this.ndc, this.camera)
    return this.ray.ray.intersectPlane(this.ground, this.hit) ? this.hit.clone() : null
  }

  private v = new Vector3()
  /** World point -> CSS px relative to the canvas. */
  project(x: number, y: number, z: number, w: number, h: number): { x: number; y: number; visible: boolean } {
    this.v.set(x, y, z).project(this.camera)
    return { x: ((this.v.x + 1) / 2) * w, y: ((1 - this.v.y) / 2) * h, visible: this.v.z < 1 }
  }

  projectObj(o: Object3D, w: number, h: number) {
    o.getWorldPosition(this.v)
    return this.project(this.v.x, this.v.y, this.v.z, w, h)
  }
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v))
}
