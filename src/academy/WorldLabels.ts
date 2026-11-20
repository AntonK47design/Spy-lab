/** DOM labels pinned to world positions (sharp text, localizable). */
import type { FollowCamera } from './FollowCamera'

export interface WorldLabel {
  el: HTMLDivElement
  x: number
  y: number
  z: number
  visible: boolean
  /** Cached rendered width (px), re-measured every few frames for edge clamping. */
  w?: number
  h?: number
}

export class WorldLabels {
  readonly root: HTMLDivElement
  private labels: WorldLabel[] = []
  private frame = 0
  /**
   * Declutter: pad labels (class "pad") further than r from the hero fade out; the label at the
   * guide target always stays. null = show all.
   */
  focus: { x: number; z: number; r: number; tx?: number; tz?: number } | null = null

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'world-labels'
    parent.insertBefore(this.root, parent.firstChild)
  }

  add(cls: string, x: number, y: number, z: number, testid?: string): WorldLabel {
    const el = document.createElement('div')
    el.className = `wlabel ${cls}`
    if (testid) el.dataset.testid = testid
    this.root.appendChild(el)
    const l = { el, x, y, z, visible: true }
    this.labels.push(l)
    return l
  }

  remove(l: WorldLabel): void {
    l.el.remove()
    const i = this.labels.indexOf(l)
    if (i >= 0) this.labels.splice(i, 1)
  }

  private blocker: DOMRect | null = null

  update(cam: FollowCamera, w: number, h: number): void {
    const band = Math.min(110, Math.max(70, h * 0.12))
    const measure = this.frame++ % 20 === 0
    // the coach bubble covers part of the world: labels behind it fade too
    if (measure) {
      const coach = document.querySelector('[data-testid="coach"]')
      const r = coach?.getBoundingClientRect()
      const root = this.root.getBoundingClientRect()
      this.blocker = r && r.width > 0 ? new DOMRect(r.x - root.x, r.y - root.y, r.width, r.height) : null
    }
    for (const l of this.labels) {
      if (!l.visible) {
        if (l.el.style.display !== 'none') l.el.style.display = 'none'
        continue
      }
      const p = cam.project(l.x, l.y, l.z, w, h)
      const show = p.visible && p.x > -200 && p.x < w + 200 && p.y > -100 && p.y < h + 100
      l.el.style.display = show ? '' : 'none'
      if (show) {
        if (measure || l.w === undefined) {
          l.w = l.el.offsetWidth
          l.h = l.el.offsetHeight
        }
        // keep the whole label on screen (pads near the edge stay readable)
        const half = (l.w ?? 0) / 2 + 6
        const x = half * 2 < w ? Math.min(w - half, Math.max(half, p.x)) : p.x
        l.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`
        // labels that slide under the top HUD band fade out (never fight the HUD for attention)
        const b = this.blocker
        const lw = l.w ?? 0
        const lh = l.h ?? 0
        const behindCoach = !!b && x + lw / 2 > b.x && x - lw / 2 < b.x + b.width && p.y > b.y && p.y - lh < b.y + b.height
        const under = p.y - lh * 0.6 < band || behindCoach
        if (under !== l.el.classList.contains('under-hud')) l.el.classList.toggle('under-hud', under)
        const f = this.focus
        let far = false
        if (f && l.el.classList.contains('pad')) {
          const target = f.tx !== undefined && (l.x - f.tx) ** 2 + (l.z - (f.tz ?? 0)) ** 2 < 2.5
          far = !target && (l.x - f.x) ** 2 + (l.z - f.z) ** 2 > f.r * f.r
        }
        if (far !== l.el.classList.contains('far')) l.el.classList.toggle('far', far)
      }
    }
  }
}
