/** Cash stacks lying in the rooms + bills flying to the player when collected. */
import { BoxGeometry, BufferAttribute, Color, CylinderGeometry, InstancedMesh, Mesh, MeshLambertMaterial, Object3D, type BufferGeometry, type Group } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LAYOUT, ROOMS, cashSpotOf, type RoomId } from '../config/rooms'
import { income } from '../sim/academy'
import type { GameState } from '../sim/state'

const MAX = 24

function tint(g: BufferGeometry, hex: number): BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g
  const c = new Color(hex)
  const n = ng.getAttribute('position').count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3)
  ng.setAttribute('color', new BufferAttribute(arr, 3))
  ng.deleteAttribute('uv')
  return ng
}

/** A banded bundle of bills: rounded green block, lighter printed top, emblem, cream paper strap. */
function bundleGeo(): BufferGeometry {
  const W = 0.58
  const H = 0.12
  const D = 0.32
  const parts = [
    tint(new RoundedBoxGeometry(W, H, D, 2, 0.022), 0x4fae4a),
    // printed top face with a darker frame line
    tint(new BoxGeometry(W - 0.05, 0.006, D - 0.05).translate(0, H / 2 + 0.001, 0), 0x2f7d2c),
    tint(new BoxGeometry(W - 0.08, 0.008, D - 0.08).translate(0, H / 2 + 0.003, 0), 0x86d97c),
    tint(new CylinderGeometry(0.06, 0.06, 0.01, 10).translate(0.15, H / 2 + 0.006, 0), 0x3d9439),
    tint(new CylinderGeometry(0.06, 0.06, 0.01, 10).translate(-0.15, H / 2 + 0.006, 0), 0x3d9439),
    // paper strap around the middle
    tint(new BoxGeometry(0.12, H + 0.014, D + 0.014), 0xfff3e0),
    tint(new BoxGeometry(0.12, 0.004, 0.08).translate(0, H / 2 + 0.009, 0), 0xf2b134),
  ]
  return mergeGeometries(parts, false)!
}

const billGeo = bundleGeo()
const billMat = new MeshLambertMaterial({ vertexColors: true })

interface Fly {
  m: Mesh
  t: number
  sx: number
  sz: number
  sy: number
}

export class CashPiles {
  private piles = new Map<RoomId, InstancedMesh>()
  private counts = new Map<RoomId, number>()
  private flies: Fly[] = []
  private pool: Mesh[] = []
  private tmp = new Object3D()

  constructor(private parent: Group) {}

  private welcome: InstancedMesh | null = null
  private welcomeN = -1

  sync(s: GameState): void {
    // opening cash pile next to the spawn
    const wn = s.welcome > 0 ? Math.min(MAX, Math.max(4, Math.ceil(s.welcome / 3))) : 0
    if (wn !== this.welcomeN) {
      this.welcomeN = wn
      if (!this.welcome) {
        this.welcome = new InstancedMesh(billGeo, billMat, MAX)
        this.welcome.frustumCulled = false
        this.parent.add(this.welcome)
      }
      this.layout(this.welcome, wn, LAYOUT.welcomeSpot)
    }
    for (const id of Object.keys(ROOMS) as RoomId[]) {
      const r = s.rooms[id]
      if (!r.unlocked || ROOMS[id].kind !== 'training') continue
      let mesh = this.piles.get(id)
      if (!mesh) {
        mesh = new InstancedMesh(billGeo, billMat, MAX)
        mesh.count = 0
        mesh.frustumCulled = false
        this.parent.add(mesh)
        this.piles.set(id, mesh)
      }
      const per = Math.max(1, income(s, id))
      const n = r.stack >= 1 ? Math.min(MAX, Math.max(1, Math.ceil(r.stack / per))) : 0
      if (n === this.counts.get(id)) continue
      this.counts.set(id, n)
      this.layout(mesh, n, cashSpotOf(id))
    }
  }

  private layout(mesh: InstancedMesh, n: number, c: { x: number; z: number }): void {
    for (let i = 0; i < n; i++) {
      const col = i % 2
      const row = Math.floor(i / 2) % 3
      const layer = Math.floor(i / 6)
      // a neat but hand-stacked pile: tiny deterministic jitter per bundle
      const j = Math.sin(i * 12.9898) * 43758.5453
      const r = j - Math.floor(j)
      this.tmp.position.set(c.x - 0.31 + col * 0.62 + (r - 0.5) * 0.05, 0.11 + layer * 0.126, c.z - 0.35 + row * 0.35 + (r - 0.5) * 0.04)
      this.tmp.rotation.y = (r - 0.5) * 0.16
      this.tmp.updateMatrix()
      mesh.setMatrixAt(i, this.tmp.matrix)
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
  }

  /** Spawn a few bills that arc from the pile to (tx, tz). */
  burst(id: RoomId, n: number): void {
    const c = cashSpotOf(id)
    for (let i = 0; i < Math.min(n, 8); i++) {
      const m = this.pool.pop() ?? new Mesh(billGeo, billMat)
      this.parent.add(m)
      this.flies.push({ m, t: -i * 0.04, sx: c.x + (Math.random() - 0.5) * 0.5, sz: c.z + (Math.random() - 0.5) * 0.5, sy: 0.2 })
    }
  }

  update(dt: number, tx: number, tz: number): void {
    for (let i = this.flies.length - 1; i >= 0; i--) {
      const f = this.flies[i]!
      f.t += dt
      const k = Math.max(0, Math.min(1, f.t / 0.35))
      f.m.position.set(f.sx + (tx - f.sx) * k, f.sy + Math.sin(k * Math.PI) * 1.4 + k * 1.1, f.sz + (tz - f.sz) * k)
      f.m.rotation.y += dt * 10
      if (k >= 1) {
        this.parent.remove(f.m)
        this.pool.push(f.m)
        this.flies.splice(i, 1)
      }
    }
  }
}
