/**
 * Chevrons on the floor along the walkable route to the guide target (around walls, through
 * doors). Only shown while the target is not in straight reach; the 3D arrow stays on the target.
 * One instanced mesh = one draw call.
 */
import { DoubleSide, InstancedMesh, MeshBasicMaterial, Object3D, Shape, ShapeGeometry, type Group } from 'three'
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

export class GuideTrail {
  private mesh: InstancedMesh
  private dummy = new Object3D()
  private phase = 0

  constructor(parent: Group) {
    const mat = new MeshBasicMaterial({ color: T.color, transparent: true, opacity: 0.95, side: DoubleSide, depthWrite: false })
    this.mesh = new InstancedMesh(chevron(), mat, T.max)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 1
    this.mesh.name = 'guide-trail'
    parent.add(this.mesh)
  }

  /** Number of chevrons drawn right now (QA). */
  get shown(): number {
    return this.mesh.visible ? this.mesh.count : 0
  }

  hide(): void {
    this.mesh.visible = false
    this.mesh.count = 0
  }

  update(dt: number, route: P[] | null): void {
    if (!route || route.length < 2) return this.hide()
    this.phase = (this.phase + dt * T.flow) % T.spacing
    let total = 0
    for (let i = 1; i < route.length; i++) total += Math.hypot(route[i]!.x - route[i - 1]!.x, route[i]!.z - route[i - 1]!.z)
    let n = 0
    let seg = 1
    let segStart = 0
    for (let d = T.skipHero + this.phase; d < total - T.skipTarget && n < T.max; d += T.spacing) {
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
      this.dummy.position.set(a.x + (b.x - a.x) * t, T.lift, a.z + (b.z - a.z) * t)
      this.dummy.rotation.set(0, Math.atan2(-(b.x - a.x), -(b.z - a.z)), 0)
      this.dummy.scale.setScalar(T.size)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(n++, this.dummy.matrix)
    }
    this.mesh.count = n
    this.mesh.visible = n > 0
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
