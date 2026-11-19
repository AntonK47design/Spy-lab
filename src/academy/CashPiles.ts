/** Cash stacks lying in the rooms + bills flying to the player when collected. */
import { BoxGeometry, InstancedMesh, Mesh, MeshLambertMaterial, Object3D, type Group } from 'three'
import { ROOMS, cashSpotOf, type RoomId } from '../config/rooms'
import { income } from '../sim/academy'
import type { GameState } from '../sim/state'

const MAX = 24
const billGeo = new BoxGeometry(0.42, 0.1, 0.24)
const billMat = new MeshLambertMaterial({ color: 0x5fbf5a, emissive: 0x123d12, flatShading: true })

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

  sync(s: GameState): void {
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
      const c = cashSpotOf(id)
      for (let i = 0; i < n; i++) {
        const col = i % 2
        const row = Math.floor(i / 2) % 3
        const layer = Math.floor(i / 6)
        this.tmp.position.set(c.x - 0.24 + col * 0.48, 0.1 + layer * 0.11, c.z - 0.28 + row * 0.28)
        this.tmp.rotation.y = (i % 3) * 0.05
        this.tmp.updateMatrix()
        mesh.setMatrixAt(i, this.tmp.matrix)
      }
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
    }
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
