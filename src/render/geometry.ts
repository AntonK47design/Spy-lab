import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Matrix4,
  Euler,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const m4 = new Matrix4()
const q = new Quaternion()
const e = new Euler()
const v = new Vector3()
const sc = new Vector3(1, 1, 1)

/**
 * Collects colored primitives and merges them into ONE vertex-colored geometry
 * (one draw call with the shared flat material). Placeholder art until real models land.
 */
export class StaticBatch {
  private parts: BufferGeometry[] = []
  private c = new Color()

  private push(g: BufferGeometry, x: number, y: number, z: number, color: number, rotY = 0, rotX = 0, rotZ = 0): this {
    const geo = g.index ? g.toNonIndexed() : g
    if (geo !== g) g.dispose()
    e.set(rotX, rotY, rotZ)
    q.setFromEuler(e)
    m4.compose(v.set(x, y, z), q, sc)
    geo.applyMatrix4(m4)
    this.c.setHex(color)
    const n = geo.getAttribute('position').count
    const colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      colors[i * 3] = this.c.r
      colors[i * 3 + 1] = this.c.g
      colors[i * 3 + 2] = this.c.b
    }
    geo.setAttribute('color', new Float32BufferAttribute(colors, 3))
    if (geo.getAttribute('uv')) geo.deleteAttribute('uv')
    this.parts.push(geo)
    return this
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, color: number, rotY = 0): this {
    return this.push(new BoxGeometry(w, h, d), x, y, z, color, rotY)
  }

  cyl(rTop: number, rBot: number, h: number, x: number, y: number, z: number, color: number, seg = 10, rotX = 0, rotZ = 0): this {
    return this.push(new CylinderGeometry(rTop, rBot, h, seg), x, y, z, color, 0, rotX, rotZ)
  }

  cone(r: number, h: number, x: number, y: number, z: number, color: number, seg = 8): this {
    return this.push(new ConeGeometry(r, h, seg), x, y, z, color)
  }

  sphere(r: number, x: number, y: number, z: number, color: number, w = 10, h = 8, sy = 1): this {
    const g = new SphereGeometry(r, w, h)
    if (sy !== 1) g.scale(1, sy, 1)
    return this.push(g, x, y, z, color)
  }

  /** Add a baked prop geometry (vertex colors already set) with a placement transform. */
  prop(src: BufferGeometry | null, x: number, z: number, rotY = 0, scale = 1, y = 0): this {
    if (!src) return this
    const g = src.clone()
    e.set(0, rotY, 0)
    q.setFromEuler(e)
    m4.compose(v.set(x, y, z), q, new Vector3(scale, scale, scale))
    g.applyMatrix4(m4)
    this.parts.push(g)
    return this
  }

  get empty(): boolean {
    return this.parts.length === 0
  }

  build(): BufferGeometry {
    const merged = mergeGeometries(this.parts, false)
    for (const p of this.parts) p.dispose()
    this.parts = []
    if (!merged) throw new Error('empty batch')
    if (!merged.getAttribute('normal')) merged.computeVertexNormals()
    merged.computeBoundingSphere()
    return merged
  }
}
