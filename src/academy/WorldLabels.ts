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

  update(cam: FollowCamera, w: number, h: number): void {
    const band = Math.min(110, Math.max(70, h * 0.12))
    const measure = this.frame++ % 20 === 0
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
        const under = p.y - (l.h ?? 0) * 0.6 < band
        if (under !== l.el.classList.contains('under-hud')) l.el.classList.toggle('under-hud', under)
      }
    }
  }
}
