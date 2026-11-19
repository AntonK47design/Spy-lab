/**
 * Movement input: floating virtual joystick (touch or mouse drag anywhere on the canvas)
 * + WASD / arrow keys. A short press without movement is a tap.
 */
import { CAMERA } from '../config/layout'

export class Input {
  /** Desired move in screen space: x right, y down. Length 0..1. */
  readonly move = { x: 0, y: 0 }
  onTap: ((x: number, y: number) => void) | null = null
  enabled = true
  private keys = new Set<string>()
  private pid: number | null = null
  private origin = { x: 0, y: 0 }
  private start = { x: 0, y: 0, t: 0 }
  private dragged = false
  private stick = { x: 0, y: 0 }
  private base: HTMLDivElement
  private knob: HTMLDivElement
  private radius = 56

  constructor(private el: HTMLElement, uiLayer: HTMLElement) {
    this.base = document.createElement('div')
    this.base.className = 'joy-base'
    this.knob = document.createElement('div')
    this.knob.className = 'joy-knob'
    this.base.appendChild(this.knob)
    uiLayer.appendChild(this.base)
    el.addEventListener('pointerdown', this.down)
    window.addEventListener('pointermove', this.moveH)
    window.addEventListener('pointerup', this.up)
    window.addEventListener('pointercancel', this.up)
    window.addEventListener('keydown', this.key)
    window.addEventListener('keyup', this.keyUp)
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.release()
    })
  }

  private down = (e: PointerEvent) => {
    if (this.pid !== null || !this.enabled) return
    this.pid = e.pointerId
    this.origin = { x: e.clientX, y: e.clientY }
    this.start = { x: e.clientX, y: e.clientY, t: performance.now() }
    this.dragged = false
    this.stick = { x: 0, y: 0 }
    this.radius = Math.max(40, Math.min(70, Math.min(innerWidth, innerHeight) * 0.11))
  }

  private moveH = (e: PointerEvent) => {
    if (e.pointerId !== this.pid) return
    const dx = e.clientX - this.origin.x
    const dy = e.clientY - this.origin.y
    const len = Math.hypot(dx, dy)
    if (!this.dragged && Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) > CAMERA.dragThresholdPx) {
      this.dragged = true
      this.base.style.display = 'block'
    }
    if (!this.dragged) return
    // floating: the base follows when the finger goes beyond the radius
    if (len > this.radius) {
      this.origin.x = e.clientX - (dx / len) * this.radius
      this.origin.y = e.clientY - (dy / len) * this.radius
    }
    this.stick.x = (e.clientX - this.origin.x) / this.radius
    this.stick.y = (e.clientY - this.origin.y) / this.radius
    this.base.style.width = this.base.style.height = `${this.radius * 2}px`
    this.base.style.transform = `translate(${this.origin.x - this.radius}px, ${this.origin.y - this.radius}px)`
    this.knob.style.transform = `translate(${this.stick.x * this.radius * 0.6}px, ${this.stick.y * this.radius * 0.6}px)`
  }

  private up = (e: PointerEvent) => {
    if (e.pointerId !== this.pid) return
    const wasTap = !this.dragged && performance.now() - this.start.t < 400
    this.release()
    if (wasTap && e.type === 'pointerup') this.onTap?.(e.clientX, e.clientY)
  }

  private release() {
    this.pid = null
    this.dragged = false
    this.stick = { x: 0, y: 0 }
    this.base.style.display = 'none'
  }

  private code(e: KeyboardEvent): string | null {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': return 'u'
      case 'KeyS': case 'ArrowDown': return 'd'
      case 'KeyA': case 'ArrowLeft': return 'l'
      case 'KeyD': case 'ArrowRight': return 'r'
      default: return null
    }
  }

  private key = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return
    const c = this.code(e)
    if (c) {
      this.keys.add(c)
      e.preventDefault()
    }
  }

  private keyUp = (e: KeyboardEvent) => {
    const c = this.code(e)
    if (c) this.keys.delete(c)
  }

  /** Call once per frame. */
  update(): void {
    let x = this.stick.x
    let y = this.stick.y
    if (this.keys.size) {
      x = (this.keys.has('r') ? 1 : 0) - (this.keys.has('l') ? 1 : 0)
      y = (this.keys.has('d') ? 1 : 0) - (this.keys.has('u') ? 1 : 0)
    }
    if (!this.enabled) x = y = 0
    const len = Math.hypot(x, y)
    if (len > 1) {
      x /= len
      y /= len
    }
    // dead zone
    if (len < 0.12) x = y = 0
    this.move.x = x
    this.move.y = y
  }

  get active(): boolean {
    return this.move.x !== 0 || this.move.y !== 0
  }
}
