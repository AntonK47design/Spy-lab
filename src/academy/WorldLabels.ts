/** DOM labels pinned to world positions (sharp text, localizable). */
import type { FollowCamera } from './FollowCamera'

export interface WorldLabel {
  el: HTMLDivElement
  x: number
  y: number
  z: number
  visible: boolean
}

export class WorldLabels {
  readonly root: HTMLDivElement
  private labels: WorldLabel[] = []

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
    for (const l of this.labels) {
      if (!l.visible) {
        if (l.el.style.display !== 'none') l.el.style.display = 'none'
        continue
      }
      const p = cam.project(l.x, l.y, l.z, w, h)
      const show = p.visible && p.x > -200 && p.x < w + 200 && p.y > -100 && p.y < h + 100
      l.el.style.display = show ? '' : 'none'
      if (show) l.el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`
    }
  }
}
