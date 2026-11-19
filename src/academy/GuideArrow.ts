/**
 * Objective pointer: a chunky outlined 3D arrow bobbing over the target, and a DOM badge
 * at the screen edge (tip rotated toward the target) when the target is off-screen or
 * hidden under the HUD band.
 */
import { BackSide, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, Shape, type Camera } from 'three'
import type { FollowCamera } from './FollowCamera'

function arrowGeo(): ExtrudeGeometry {
  // points down, tip at y = 0
  const s = new Shape()
  s.moveTo(0, 0)
  s.lineTo(0.46, 0.5)
  s.lineTo(0.19, 0.5)
  s.lineTo(0.19, 1.05)
  s.lineTo(-0.19, 1.05)
  s.lineTo(-0.19, 0.5)
  s.lineTo(-0.46, 0.5)
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 })
  g.translate(0, 0, -0.07)
  return g
}

const geo = arrowGeo()
const fillMat = new MeshBasicMaterial({ color: 0xf2b134 })
const shadeMat = new MeshBasicMaterial({ color: 0xb07a14 })
const lineMat = new MeshBasicMaterial({ color: 0x14213d, side: BackSide })

export class GuideArrow {
  readonly root = new Group()
  private edge: HTMLDivElement
  private tip: HTMLDivElement
  private t = 0

  constructor(parent: Group, uiLayer: HTMLElement) {
    const outline = new Mesh(geo, lineMat)
    outline.scale.setScalar(1.13)
    outline.position.y = -0.06
    const back = new Mesh(geo, shadeMat)
    back.position.z = -0.03
    const front = new Mesh(geo, fillMat)
    front.position.z = 0.02
    this.root.add(outline, back, front)
    this.root.visible = false
    parent.add(this.root)

    this.edge = document.createElement('div')
    this.edge.className = 'guide-edge'
    this.edge.dataset.testid = 'guide-edge'
    this.tip = document.createElement('div')
    this.tip.className = 'ge-tip'
    const badge = document.createElement('div')
    badge.className = 'ge-badge'
    // spy crosshair (inline SVG, static markup)
    badge.innerHTML =
      '<svg viewBox="0 0 24 24" width="62%" height="62%" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/></svg>'
    this.edge.append(this.tip, badge)
    uiLayer.appendChild(this.edge)
  }

  hide(): void {
    this.root.visible = false
    this.edge.style.display = 'none'
  }

  update(dt: number, target: { x: number; z: number } | null, cam: FollowCamera, w: number, h: number): void {
    if (!target) return this.hide()
    this.t += dt
    const bob = Math.abs(Math.sin(this.t * 3.2)) * 0.35
    this.root.visible = true
    this.root.position.set(target.x, 1.9 + bob, target.z)
    const squash = 1 + (bob < 0.06 ? (0.06 - bob) * 2 : 0)
    this.root.scale.set(squash, 1 / squash, squash)
    // billboard around Y toward the camera
    const c = (cam.camera as Camera).position
    this.root.rotation.y = Math.atan2(c.x - target.x, c.z - target.z)

    const p = cam.project(target.x, 2.2, target.z, w, h)
    const m = 64
    const top = Math.min(110, Math.max(70, h * 0.12)) + 30
    const bottom = h - Math.min(140, Math.max(96, h * 0.16))
    const off = !p.visible || p.x < m || p.x > w - m || p.y < top || p.y > bottom
    if (!off) {
      this.edge.style.display = 'none'
      return
    }
    const cx = w / 2
    const cy = h / 2
    const px = p.visible ? p.x : cx - (p.x - cx)
    const py = p.visible ? p.y : cy - (p.y - cy)
    const ang = Math.atan2(py - cy, px - cx)
    // intersect the ray from the centre with the inner safe rectangle
    const hx = (w - 2 * m) / 2
    const hyTop = cy - top
    const hyBot = bottom - cy
    const dx = Math.cos(ang)
    const dy = Math.sin(ang)
    const kx = Math.abs(dx) > 1e-4 ? hx / Math.abs(dx) : Infinity
    const ky = Math.abs(dy) > 1e-4 ? (dy < 0 ? hyTop : hyBot) / Math.abs(dy) : Infinity
    const k = Math.min(kx, ky)
    const ex = cx + dx * k
    const ey = cy + dy * k
    this.edge.style.display = 'block'
    this.edge.style.transform = `translate(${Math.round(ex)}px, ${Math.round(ey)}px)`
    this.tip.style.transform = `rotate(${ang}rad)`
  }
}
