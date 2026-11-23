/**
 * Coarse walkability grid over the academy colliders, used by the guide arrow so it never points
 * through a wall: when the target is not in straight reach, the arrow shows the next corner of
 * the walkable path (usually a door) instead.
 */
import type { AABB } from './World'

const CELL = 0.4
/** Slightly below the hero radius (0.36) so every door the hero fits through stays open. */
const PAD = 0.3
const SQRT2 = Math.SQRT2

export interface P {
  x: number
  z: number
}

export class NavGrid {
  private x0 = 0
  private z0 = 0
  private nx = 0
  private nz = 0
  private blocked = new Uint8Array(0)
  private sig = ''
  // A* scratch
  private g = new Float32Array(0)
  private from = new Int32Array(0)
  private seen = new Uint32Array(0)
  private stamp = 0
  private heap: number[] = []
  private hf: number[] = []

  /** Rebuild when the colliders changed (cheap signature: count + bounds sum). */
  sync(cs: AABB[]): void {
    let s = 0
    for (const c of cs) s += c.minX * 3 + c.maxX * 5 + c.minZ * 7 + c.maxZ * 11
    const sig = `${cs.length}:${s.toFixed(2)}`
    if (sig === this.sig) return
    this.sig = sig
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const c of cs) {
      minX = Math.min(minX, c.minX)
      maxX = Math.max(maxX, c.maxX)
      minZ = Math.min(minZ, c.minZ)
      maxZ = Math.max(maxZ, c.maxZ)
    }
    if (!cs.length) minX = maxX = minZ = maxZ = 0
    this.x0 = minX - 2
    this.z0 = minZ - 2
    this.nx = Math.ceil((maxX - minX + 4) / CELL)
    this.nz = Math.ceil((maxZ - minZ + 4) / CELL)
    const n = this.nx * this.nz
    this.blocked = new Uint8Array(n)
    this.g = new Float32Array(n)
    this.from = new Int32Array(n)
    this.seen = new Uint32Array(n)
    this.stamp = 0
    for (const c of cs) {
      const i0 = Math.max(0, Math.floor((c.minX - PAD - this.x0) / CELL))
      const i1 = Math.min(this.nx - 1, Math.floor((c.maxX + PAD - this.x0) / CELL))
      const j0 = Math.max(0, Math.floor((c.minZ - PAD - this.z0) / CELL))
      const j1 = Math.min(this.nz - 1, Math.floor((c.maxZ + PAD - this.z0) / CELL))
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          // cell centre within PAD of the box?
          const cx = this.x0 + (i + 0.5) * CELL
          const cz = this.z0 + (j + 0.5) * CELL
          const px = Math.max(c.minX, Math.min(cx, c.maxX))
          const pz = Math.max(c.minZ, Math.min(cz, c.maxZ))
          if ((cx - px) ** 2 + (cz - pz) ** 2 < PAD * PAD) this.blocked[j * this.nx + i] = 1
        }
      }
    }
  }

  private idx(x: number, z: number): number {
    const i = Math.floor((x - this.x0) / CELL)
    const j = Math.floor((z - this.z0) / CELL)
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return -1
    return j * this.nx + i
  }

  private free(k: number): boolean {
    return k >= 0 && this.blocked[k] === 0
  }

  /** Straight walk from a to b stays on free cells (cells the endpoints sit on are ignored). */
  clear(a: P, b: P): boolean {
    const ka = this.idx(a.x, a.z)
    const kb = this.idx(b.x, b.z)
    const d = Math.hypot(b.x - a.x, b.z - a.z)
    const n = Math.ceil(d / (CELL * 0.5))
    for (let s = 1; s < n; s++) {
      const t = s / n
      const k = this.idx(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)
      if (k === ka || k === kb) continue
      if (!this.free(k)) return false
    }
    return true
  }

  /** Nearest free cell to k (small ring search), or -1. */
  private nearestFree(k: number): number {
    if (k < 0) return -1
    if (this.free(k)) return k
    const i = k % this.nx
    const j = (k - i) / this.nx
    for (let r = 1; r <= 4; r++) {
      let best = -1
      let bd = Infinity
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue
          const ii = i + di
          const jj = j + dj
          if (ii < 0 || jj < 0 || ii >= this.nx || jj >= this.nz) continue
          const kk = jj * this.nx + ii
          const dd = di * di + dj * dj
          if (this.blocked[kk] === 0 && dd < bd) {
            bd = dd
            best = kk
          }
        }
      }
      if (best >= 0) return best
    }
    return -1
  }

  private centre(k: number): P {
    const i = k % this.nx
    const j = (k - i) / this.nx
    return { x: this.x0 + (i + 0.5) * CELL, z: this.z0 + (j + 0.5) * CELL }
  }

  /**
   * Next point to walk to on the way from `a` to `b`: `b` itself when it is in straight reach,
   * else the farthest corner of the grid path still in straight reach. Null = no path known.
   */
  nextWaypoint(a: P, b: P): P | null {
    if (this.clear(a, b)) return b
    const path = this.path(a, b)
    if (!path) return null
    let pick: P | null = null
    for (let i = path.length - 1; i >= 0; i--) {
      if (this.clear(a, path[i]!)) {
        pick = path[i]!
        break
      }
    }
    return pick ?? path[0] ?? null
  }

  /**
   * Walkable route a -> b as a few straight legs (corners only where a wall is in the way), ending
   * at b. Null when b is in straight reach (no detour to show) or no path is known.
   */
  route(a: P, b: P): P[] | null {
    if (this.clear(a, b)) return null
    const path = this.path(a, b)
    if (!path) return null
    const out: P[] = [a]
    let from = a
    let i = 0
    while (i < path.length) {
      let j = path.length - 1
      while (j > i && !this.clear(from, path[j]!)) j--
      from = path[j]!
      out.push(from)
      i = j + 1
    }
    return out
  }

  /** A* (8-neighbour, no corner cutting) between the free cells nearest a and b. */
  path(a: P, b: P): P[] | null {
    const s = this.nearestFree(this.idx(a.x, a.z))
    const t = this.nearestFree(this.idx(b.x, b.z))
    if (s < 0 || t < 0) return null
    const nx = this.nx
    const tc = this.centre(t)
    const stamp = ++this.stamp
    const h = (k: number): number => {
      const c = this.centre(k)
      const dx = Math.abs(c.x - tc.x) / CELL
      const dz = Math.abs(c.z - tc.z) / CELL
      return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz)
    }
    const heap = this.heap
    const hf = this.hf
    heap.length = 0
    hf.length = 0
    const push = (k: number, f: number): void => {
      let i = heap.length
      heap.push(k)
      hf.push(f)
      while (i > 0) {
        const p = (i - 1) >> 1
        if (hf[p]! <= f) break
        heap[i] = heap[p]!
        hf[i] = hf[p]!
        i = p
      }
      heap[i] = k
      hf[i] = f
    }
    const pop = (): number => {
      const top = heap[0]!
      const lk = heap.pop()!
      const lf = hf.pop()!
      if (heap.length) {
        let i = 0
        for (;;) {
          const l = 2 * i + 1
          if (l >= heap.length) break
          const r = l + 1
          const c = r < heap.length && hf[r]! < hf[l]! ? r : l
          if (hf[c]! >= lf) break
          heap[i] = heap[c]!
          hf[i] = hf[c]!
          i = c
        }
        heap[i] = lk
        hf[i] = lf
      }
      return top
    }
    this.seen[s] = stamp
    this.g[s] = 0
    this.from[s] = -1
    push(s, h(s))
    const closed = new Set<number>()
    let found = false
    while (heap.length) {
      const k = pop()
      if (k === t) {
        found = true
        break
      }
      if (closed.has(k)) continue
      closed.add(k)
      const i = k % nx
      const j = (k - i) / nx
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue
          const ii = i + di
          const jj = j + dj
          if (ii < 0 || jj < 0 || ii >= nx || jj >= this.nz) continue
          const kk = jj * nx + ii
          if (this.blocked[kk]) continue
          // no squeezing diagonally past a corner
          if (di && dj && (this.blocked[j * nx + ii] || this.blocked[jj * nx + i])) continue
          const ng = this.g[k]! + (di && dj ? SQRT2 : 1)
          if (this.seen[kk] === stamp && ng >= this.g[kk]!) continue
          this.seen[kk] = stamp
          this.g[kk] = ng
          this.from[kk] = k
          push(kk, ng + h(kk))
        }
      }
    }
    if (!found) return null
    const out: P[] = [b]
    for (let k = this.from[t]!; k >= 0 && k !== s; k = this.from[k]!) out.push(this.centre(k))
    return out.reverse()
  }
}
