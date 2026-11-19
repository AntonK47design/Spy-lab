/**
 * Visuals for sim cadets (arrive -> queue -> walk -> train) and the hired staff
 * (counter clerk, kit runners walking crate <-> stations, instructors at the desk).
 * Skinned characters far from the camera animate at 8 Hz (performance lesson).
 */
import type { Group } from 'three'
import { Character, type Look } from './Character'
import { FERRY, LAYOUT, ROOMS, arrivalPath, cadetPath, crateOf, slotOf, upgradeSpotOf, type RoomId } from '../config/rooms'
import type { CadetState, GameState } from '../sim/state'

/** Tracksuit color per training room (sRGB). */
const OUTFITS: Partial<Record<RoomId, number>> = {
  vault: 0x1f8a9a, laser: 0xd0453a, cipher: 0x3f9a5a, disguise: 0xd86aa0, driving: 0xf2b134, hack: 0x5a6ad8,
}

interface View {
  ch: Character
  key: string
  path: { x: number; z: number }[]
  lens: number[]
  total: number
  px: number
  pz: number
  far: number
}

function prep(path: { x: number; z: number }[]) {
  const lens: number[] = []
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const l = Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.z - path[i - 1]!.z)
    lens.push(l)
    total += l
  }
  return { lens, total }
}

function along(v: View, f: number): { x: number; z: number } {
  let d = Math.min(1, Math.max(0, f)) * v.total
  let i = 0
  while (i < v.lens.length - 1 && d > v.lens[i]!) d -= v.lens[i++]!
  const a = v.path[i]!
  const b = v.path[i + 1] ?? a
  const k = v.lens[i]! > 0 ? d / v.lens[i]! : 1
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k }
}

export class CadetViews {
  private views = new Map<number, View>()
  private leaving: { ch: Character; t: number }[] = []
  private instructors = new Map<RoomId, Character>()
  private runners = new Map<RoomId, { ch: Character; t: number; x: number; z: number }>()
  private clerk: Character | null = null
  camX = 0
  camZ = 0

  constructor(private parent: Group) {}

  private look(c: CadetState): Look {
    const models = ['cadetM1', 'cadetF1', 'cadetM2', 'cadetF2', 'cadetM3', 'cadetF3'] as const
    const model = models[c.id % models.length]!
    // civilians keep their own clothes; assigned cadets wear the room's tracksuit (brand trousers)
    if (!c.room) return { model, scale: 0.9 }
    return { model, tint: { shirt: OUTFITS[c.room] ?? 0x2f6bff, pants: 0x2b3a7a }, scale: 0.9 }
  }

  private pathFor(c: CadetState): { x: number; z: number }[] {
    if (c.phase === 'arrive') return arrivalPath(c.queueIndex)
    if (c.phase === 'walk' && c.room) return cadetPath(c.room, c.slot)
    return []
  }

  sync(s: GameState, dt: number): void {
    const seen = new Set<number>()
    for (const c of s.cadets) {
      seen.add(c.id)
      // the look changes once the cadet is assigned to a room (tracksuit color)
      const lookKey = c.room ?? 'civil'
      let v = this.views.get(c.id)
      if (!v || v.key !== lookKey) {
        const old = v
        const ch = new Character(this.look(c))
        this.parent.add(ch.root)
        v = { ch, key: lookKey, path: [], lens: [], total: 0, px: old?.px ?? LAYOUT.street.stopX, pz: old?.pz ?? LAYOUT.street.stopZ, far: 0 }
        if (old) {
          ch.root.rotation.y = old.ch.root.rotation.y
          this.parent.remove(old.ch.root)
        }
        this.views.set(c.id, v)
      }
      let tx: number
      let tz: number
      if (c.phase === 'arrive' || c.phase === 'walk') {
        const path = this.pathFor(c)
        if (path.length && (v.path.length !== path.length || v.path[path.length - 1]!.x !== path[path.length - 1]!.x || v.path[path.length - 1]!.z !== path[path.length - 1]!.z || v.path[0]!.x !== path[0]!.x)) {
          v.path = path
          Object.assign(v, prep(path))
        }
        const p = along(v, c.t / Math.max(0.01, c.walk))
        tx = p.x
        tz = p.z
      } else if (c.phase === 'queue') {
        const q = LAYOUT.queue[Math.min(c.queueIndex, LAYOUT.queue.length - 1)]!
        // glide forward when the queue moves up
        tx = v.px + (q.x - v.px) * Math.min(1, dt * 4)
        tz = v.pz + (q.z - v.pz) * Math.min(1, dt * 4)
      } else {
        const p = slotOf(c.room as RoomId, c.slot)
        tx = p.x
        tz = p.z
      }
      const moved = Math.hypot(tx - v.px, tz - v.pz)
      v.ch.walking = dt > 0 && moved / dt > 0.3 ? 1 : 0
      if (moved > 1e-3) v.ch.face(tx - v.px, tz - v.pz, dt)
      else if (c.phase === 'queue') v.ch.face(0, -1, dt)
      else if (c.phase === 'train') v.ch.face(0, -1, dt)
      v.ch.activity = c.phase === 'train' && c.repping ? 'train' : 'idle'
      v.px = tx
      v.pz = tz
      v.ch.root.position.set(tx, 0, tz)
      // crossing to the lighthouse: the cadet is on board the ferry (never walks on water)
      v.ch.root.visible = !(Math.abs(tx - FERRY.x) < 1.6 && tz < FERRY.docksEnd + 0.2 && tz > FERRY.islandEnd - 0.2)
      this.animate(v.ch, v, dt, tx, tz)
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        this.views.delete(id)
        v.ch.activity = 'cheer'
        v.ch.cheer(1.6)
        this.leaving.push({ ch: v.ch, t: 0 })
      }
    }
    for (let i = this.leaving.length - 1; i >= 0; i--) {
      const l = this.leaving[i]!
      l.t += dt
      l.ch.update(dt)
      if (l.t > 1.2) l.ch.root.scale.multiplyScalar(Math.max(0, 1 - dt * 8))
      if (l.t > 1.6) {
        this.parent.remove(l.ch.root)
        this.leaving.splice(i, 1)
      }
    }
  }

  /** Far characters (> 16 units from the camera focus) animate at 8 Hz. */
  private animate(ch: Character, v: { far: number } | null, dt: number, x: number, z: number): void {
    const far = Math.hypot(x - this.camX, z - this.camZ) > 16
    if (!far || !v) {
      ch.update(dt)
      return
    }
    v.far += dt
    if (v.far >= 0.125) {
      ch.update(v.far)
      v.far = 0
    }
  }

  /** Clerk at the counter, kit runners, instructors. */
  syncStaff(s: GameState, dt: number): void {
    if (s.clerk && !this.clerk) {
      this.clerk = new Character({ model: 'clerk', tint: { shirt: 0xff6b5e }, scale: 0.95 })
      this.clerk.root.position.set(LAYOUT.serveSpot.x + 1.2, 0, LAYOUT.serveSpot.z)
      this.clerk.root.rotation.y = 0
      this.clerk.cheer(2)
      this.parent.add(this.clerk.root)
    }
    if (this.clerk) {
      this.clerk.activity = s.cadets.some((c) => c.phase === 'queue') ? 'train' : 'idle'
      this.clerk.update(dt)
    }
    for (const id of Object.keys(s.rooms) as RoomId[]) {
      const r = s.rooms[id]
      // instructor at the desk
      let ins = this.instructors.get(id)
      if (r.instructor && r.unlocked && !ins) {
        ins = new Character({ model: 'instructor', scale: 0.95 })
        const u = upgradeSpotOf(id)
        ins.root.position.set(u.x + ROOMS[id].side * 0.2, 0, u.z - 1.3)
        ins.root.rotation.y = Math.PI
        ins.activity = 'train'
        ins.cheer(2)
        this.parent.add(ins.root)
        this.instructors.set(id, ins)
      }
      ins?.update(dt)
      // kit runner: shuttles between the crate and the stations
      let run = this.runners.get(id)
      if (r.runner && r.unlocked && !run) {
        const ch = new Character({ model: 'runner', tint: { shirt: 0xff7a2e }, scale: 0.92 })
        const k = crateOf(id)
        ch.root.position.set(k.x, 0, k.z)
        ch.runner = false
        this.parent.add(ch.root)
        run = { ch, t: 0, x: k.x, z: k.z }
        this.runners.set(id, run)
      }
      if (run) {
        run.t += dt
        const n = Math.max(1, r.stations)
        const leg = Math.floor(run.t / 2.2) % (n * 2)
        const k = crateOf(id)
        const target = leg % 2 === 0 ? k : slotOf(id, Math.floor(leg / 2) % n)
        const tz = target === k ? k.z : target.z + 0.7
        const dx = target.x - run.x
        const dz = tz - run.z
        const d = Math.hypot(dx, dz)
        const step = Math.min(d, dt * 3)
        if (d > 0.05) {
          run.x += (dx / d) * step
          run.z += (dz / d) * step
          run.ch.face(dx, dz, dt)
        }
        run.ch.walking = d > 0.05 ? 0.8 : 0
        run.ch.carrying = leg % 2 === 1
        run.ch.activity = 'idle'
        run.ch.root.position.set(run.x, 0, run.z)
        this.animate(run.ch, null, dt, run.x, run.z)
      }
    }
  }
}
