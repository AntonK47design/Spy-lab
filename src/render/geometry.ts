import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Collects colored boxes and merges them into ONE geometry (one draw call). */
export class StaticBatch {
  private parts: BufferGeometry[] = []
  private c = new Color()

  box(w: number, h: number, d: number, x: number, y: number, z: number, color: number): this {
    const g = new BoxGeometry(w, h, d).toNonIndexed()
    g.translate(x, y, z)
    this.c.setHex(color)
    const n = g.getAttribute('position').count
    const colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      colors[i * 3] = this.c.r
      colors[i * 3 + 1] = this.c.g
      colors[i * 3 + 2] = this.c.b
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3))
    g.deleteAttribute('uv')
    this.parts.push(g)
    return this
  }

  build(): BufferGeometry {
    const merged = mergeGeometries(this.parts, false)
    for (const p of this.parts) p.dispose()
    this.parts = []
    if (!merged) throw new Error('empty batch')
    merged.computeBoundingSphere()
    return merged
  }
}
