/**
 * Chevrons on the floor along the walkable route to the guide target (around walls, through
 * doors). Only shown while the target is not in straight reach; the 3D arrow stays on the target.
 * Every turn of the route (usually a doorway) gets a bigger, brighter, pulsing chevron pointing
 * along the next leg. A dark rim under each chevron keeps the trail readable on pale floors.
 * Two instanced meshes (rim + fill with per-instance colour) = two draw calls.
 */
import { Color, DoubleSide, InstancedMesh, MeshBasicMaterial, Object3D, Shape, ShapeGeometry, type Group } from 'three'
import { GUIDE_TRAIL as T } from '../config/layout'
import type { P } from './NavGrid'

function chevron(): ShapeGeometry {
  // pointing +Y in shape space (becomes -Z after lying flat; rotated per instance)
  const s = new Shape()
  s.moveTo(0, 0.45)
  s.lineTo(0.5, -0.05)
  s.lineTo(0.5, -0.38)
  s.lineTo(0, 0.08)
  s.lineTo(-0.5, -0.38)
  s.lineTo(-0.5, -0.05)
  s.closePath()
  const g = new ShapeGeometry(s)
  g.rotateX(-Math.PI / 2)
  return g
}

const MAX_CORNERS = 6

export class GuideTrail {
  private fill: InstancedMesh
  private rim: InstancedMesh
  private dummy = new Object3D()
  private phase = 0
  private t = 0
  private dotColor = new Color(T.color)
  private cornerColor = new Color(T.cornerColor)
  private corners = 0

  constructor(parent: Group) {
    const geo = chevron()
    const n = T.max + MAX_CORNERS
    this.rim = new InstancedMesh(geo, new MeshBasicMaterial({ color: T.outlineColor, side: DoubleSide, depthWrite: false }), n)
    this.fill = new InstancedMesh(geo, new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide, depthWrite: false }), n)
    for (const m of [this.rim, this.fill]) {
      m.count = 0
      m.frustumCulled = false
      parent.add(m)
    }
    this.rim.renderOrder = 1
    this.fill.renderOrder = 2
    this.rim.name = 'guide-trail-rim'
    this.fill.name = 'guide-trail'
    this.fill.setColorAt(0, this.dotColor) // allocate instanceColor
  }

  /** Number of chevrons drawn right now (QA). */
  get shown(): number {
    return this.fill.visible ? this.fill.count : 0
  }

  /** Number of turn markers drawn right now (QA). */
  get cornersShown(): number {
    return this.fill.visible ? this.corners : 0
  }

  hide(): void {
    this.fill.visible = this.rim.visible = false
    this.fill.count = this.rim.count = 0
    this.corners = 0
  }

  private put(i: number, x: number, z: number, dx: number, dz: number, size: number, color: Color): void {
    const d = this.dummy
    d.rotation.set(0, Math.atan2(-dx, -dz), 0)
    d.position.set(x, T.lift, z)
    d.scale.setScalar(size * T.outlineScale)
    d.updateMatrix()
    this.rim.setMatrixAt(i, d.matrix)
    d.position.y = T.lift + 0.01
    d.scale.setScalar(size)
    d.updateMatrix()
    this.fill.setMatrixAt(i, d.matrix)
    this.fill.setColorAt(i, color)
  }

  update(dt: number, route: P[] | null): void {
    if (!route || route.length < 2) return this.hide()
    this.t += dt
    this.phase = (this.phase + dt * T.flow) % T.spacing
    let n = 0
    // turn markers first (they matter most if the instance budget runs out)
    const hero = route[0]!
    const pulse = 1 + T.cornerPulse * Math.sin(this.t * Math.PI * 2 * T.cornerPulseHz)
    for (let i = 1; i < route.length - 1 && n < MAX_CORNERS; i++) {
      const c = route[i]!
      if (Math.hypot(c.x - hero.x, c.z - hero.z) < T.cornerSkipHero) continue
      const nx = route[i + 1]!
      this.put(n++, c.x, c.z, nx.x - c.x, nx.z - c.z, T.cornerSize * pulse, this.cornerColor)
    }
    this.corners = n
    let total = 0
    for (let i = 1; i < route.length; i++) total += Math.hypot(route[i]!.x - route[i - 1]!.x, route[i]!.z - route[i - 1]!.z)
    let seg = 1
    let segStart = 0
    for (let d = T.skipHero + this.phase; d < total - T.skipTarget && n < T.max + MAX_CORNERS; d += T.spacing) {
      while (seg < route.length - 1) {
        const len = Math.hypot(route[seg]!.x - route[seg - 1]!.x, route[seg]!.z - route[seg - 1]!.z)
        if (d <= segStart + len) break
        segStart += len
        seg++
      }
      const a = route[seg - 1]!
      const b = route[seg]!
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
      const t = Math.min(1, (d - segStart) / len)
      const x = a.x + (b.x - a.x) * t
      const z = a.z + (b.z - a.z) * t
      // leave room around the turn markers
      let near = false
      for (let i = 1; i < route.length - 1; i++) if (Math.hypot(route[i]!.x - x, route[i]!.z - z) < T.spacing * 0.7) near = true
      if (near) continue
      this.put(n++, x, z, b.x - a.x, b.z - a.z, T.size, this.dotColor)
    }
    this.fill.count = this.rim.count = n
    this.fill.visible = this.rim.visible = n > 0
    this.fill.instanceMatrix.needsUpdate = true
    this.rim.instanceMatrix.needsUpdate = true
    if (this.fill.instanceColor) this.fill.instanceColor.needsUpdate = true
  }
}
