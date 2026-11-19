/**
 * Academy camera: perspective with a small FOV, "expand" framing (a safe rectangle
 * is always fully visible, the world fills the rest), vertical drag / wheel / keys,
 * pinch + wheel zoom within limits, taps raycast into the scene.
 */
import { PerspectiveCamera, Raycaster, Vector2, type Object3D } from 'three'
import { ACADEMY_LAYOUT as L, CAMERA } from '../config/layout'

export interface Bounds {
  top: number
  bottom: number
}

export class CameraRig {
  readonly camera = new PerspectiveCamera(CAMERA.fov, 1, 0.5, 200)
  private y = 0
  private targetY = 0
  private zoom = 1
  private targetZoom = 1
  private baseDist = 30
  private aspect = 1
  private raycaster = new Raycaster()
  private ndc = new Vector2()
  private pointers = new Map<number, { x: number; y: number }>()
  private dragStart: { x: number; y: number; camY: number } | null = null
  private moved = false
  private pinchStart: { dist: number; zoom: number } | null = null
  private keys = new Set<string>()
  onTap: ((hits: Object3D[]) => void) | null = null
  tapTargets: Object3D[] = []

  constructor(
    private el: HTMLElement,
    private bounds: Bounds,
  ) {
    this.y = this.targetY = -L.floorHeight * 0.2
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('pointermove', this.onMove)
    el.addEventListener('pointerup', this.onUp)
    el.addEventListener('pointercancel', this.onUp)
    el.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', () => this.keys.clear())
  }

  resize(w: number, h: number): void {
    this.aspect = w / h
    this.camera.aspect = this.aspect
    const landscape = this.aspect >= 1.25
    const floors = landscape ? CAMERA.safeFloorsLandscape : CAMERA.safeFloorsPortrait
    const safeH = floors * L.floorHeight
    const safeW = CAMERA.safeWidth
    const neededH = Math.max(safeH, safeW / this.aspect)
    const halfFov = (CAMERA.fov * Math.PI) / 360
    this.baseDist = neededH / 2 / Math.tan(halfFov)
    this.camera.updateProjectionMatrix()
    this.clamp()
    this.apply()
  }

  private visibleHalfHeight(): number {
    const halfFov = (CAMERA.fov * Math.PI) / 360
    return Math.tan(halfFov) * this.baseDist * this.targetZoom
  }

  private worldPerPixel(): number {
    return (this.visibleHalfHeight() * 2) / Math.max(1, this.el.clientHeight)
  }

  private clamp(): void {
    this.targetZoom = Math.min(CAMERA.zoomMax, Math.max(CAMERA.zoomMin, this.targetZoom))
    const half = this.visibleHalfHeight()
    const maxY = this.bounds.top - half
    const minY = this.bounds.bottom + half
    this.targetY = minY > maxY ? (minY + maxY) / 2 : Math.min(maxY, Math.max(minY, this.targetY))
  }

  /** Smoothly glide to a world y (e.g. tapped room). */
  focus(y: number, zoom = this.targetZoom): void {
    this.targetY = y
    this.targetZoom = zoom
    this.clamp()
  }

  update(dt: number): void {
    const speed = 12 * dt
    if (this.keys.has('up')) this.targetY += speed
    if (this.keys.has('down')) this.targetY -= speed
    if (this.keys.size) this.clamp()
    const k = 1 - Math.exp(-dt / (CAMERA.glide / 4))
    this.y += (this.targetY - this.y) * k
    this.zoom += (this.targetZoom - this.zoom) * k
    this.apply()
  }

  private apply(): void {
    const dist = this.baseDist * this.zoom
    this.camera.position.set(0, this.y + dist * 0.08, dist)
    this.camera.lookAt(0, this.y, 0)
  }

  // ---- input ----
  private onDown = (e: PointerEvent): void => {
    this.el.setPointerCapture?.(e.pointerId)
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.pointers.size === 1) {
      this.dragStart = { x: e.clientX, y: e.clientY, camY: this.targetY }
      this.moved = false
    } else if (this.pointers.size === 2) {
      this.pinchStart = { dist: this.pinchDist(), zoom: this.targetZoom }
      this.moved = true
    }
  }

  private onMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.pointers.size >= 2 && this.pinchStart) {
      const d = this.pinchDist()
      if (d > 0) this.targetZoom = this.pinchStart.zoom * (this.pinchStart.dist / d)
      this.clamp()
      return
    }
    if (!this.dragStart) return
    const dy = e.clientY - this.dragStart.y
    const dx = e.clientX - this.dragStart.x
    if (!this.moved && Math.hypot(dx, dy) > CAMERA.dragThresholdPx) this.moved = true
    if (this.moved) {
      this.targetY = this.dragStart.camY + dy * this.worldPerPixel()
      this.clamp()
    }
  }

  private onUp = (e: PointerEvent): void => {
    const wasSingle = this.pointers.size === 1
    this.pointers.delete(e.pointerId)
    if (this.pointers.size < 2) this.pinchStart = null
    if (wasSingle && !this.moved && e.type === 'pointerup') this.tap(e.clientX, e.clientY)
    if (this.pointers.size === 0) this.dragStart = null
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    if (e.ctrlKey) this.targetZoom *= 1 + e.deltaY * 0.01
    else if (Math.abs(e.deltaY) > 0) this.targetZoom *= 1 + Math.sign(e.deltaY) * 0.08
    this.clamp()
  }

  private keyName(e: KeyboardEvent): string | null {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        return 'up'
      case 'ArrowDown':
      case 'KeyS':
        return 'down'
      default:
        return null
    }
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement) return
    const k = this.keyName(e)
    if (k) {
      this.keys.add(k)
      e.preventDefault()
    } else if (e.key === '+' || e.key === '=') {
      this.targetZoom /= 1.1
      this.clamp()
    } else if (e.key === '-') {
      this.targetZoom *= 1.1
      this.clamp()
    }
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    const k = this.keyName(e)
    if (k) this.keys.delete(k)
  }

  private pinchDist(): number {
    const [a, b] = [...this.pointers.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  private tap(cx: number, cy: number): void {
    const r = this.el.getBoundingClientRect()
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const hits = this.raycaster.intersectObjects(this.tapTargets, false).map((h) => h.object)
    this.onTap?.(hits)
  }

  /** Project a world object to screen px (for coin fly-outs, ghost hand, tests). */
  toScreen(obj: Object3D): { x: number; y: number } {
    const v = obj.getWorldPosition(obj.position.clone()).project(this.camera)
    const r = this.el.getBoundingClientRect()
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
  }
}
