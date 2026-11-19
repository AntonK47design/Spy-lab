/** Visuals for sim cadets: walk in from the street along the path, train at their station. */
import type { Group } from 'three'
import { Character } from './Character'
import { ROOMS, cadetPath, slotOf, upgradeSpotOf, type RoomId } from '../config/rooms'
import type { CadetState, GameState } from '../sim/state'

/** Tracksuit color per training room (sRGB). */
const OUTFITS: Partial<Record<RoomId, number>> = {
  vault: 0x1f8a9a, laser: 0xd0453a, cipher: 0x3f9a5a, disguise: 0xd86aa0, driving: 0xf2b134, hack: 0x5a6ad8,
}

interface View {
  ch: Character
  path: { x: number; z: number }[]
  lens: number[]
  total: number
  px: number
  pz: number
}

export class CadetViews {
  private views = new Map<number, View>()
  private leaving: { ch: Character; t: number }[] = []

  constructor(private parent: Group) {}

  private create(c: CadetState): View {
    const outfit = OUTFITS[c.room] ?? 0x1f8a9a
    const female = c.id % 2 === 0
    const ch = new Character(
      female
        ? { model: 'cadetCasualW', tint: { Orange: outfit, Grey: 0x2b3245 }, scale: 0.88 }
        : { model: 'cadetHoodie', tint: { Purple: outfit, LightBlue: 0x2b3245 }, scale: 0.88 },
    )
    const path = cadetPath(c.room, c.slot)
    const lens: number[] = []
    let total = 0
    for (let i = 1; i < path.length; i++) {
      const l = Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.z - path[i - 1]!.z)
      lens.push(l)
      total += l
    }
    this.parent.add(ch.root)
    const v = { ch, path, lens, total, px: path[0]!.x, pz: path[0]!.z }
    this.views.set(c.id, v)
    return v
  }

  sync(s: GameState, dt: number): void {
    const seen = new Set<number>()
    for (const c of s.cadets) {
      seen.add(c.id)
      const v = this.views.get(c.id) ?? this.create(c)
      let x: number
      let z: number
      if (c.phase === 'walk') {
        let d = Math.min(1, c.t / Math.max(0.01, c.walk)) * v.total
        let i = 0
        while (i < v.lens.length - 1 && d > v.lens[i]!) d -= v.lens[i++]!
        const a = v.path[i]!
        const b = v.path[i + 1]!
        const f = v.lens[i]! > 0 ? d / v.lens[i]! : 1
        x = a.x + (b.x - a.x) * f
        z = a.z + (b.z - a.z) * f
        v.ch.walking = 1
        v.ch.face(x - v.px, z - v.pz, dt)
      } else {
        const p = slotOf(c.room, c.slot)
        x = p.x
        z = p.z
        v.ch.walking = 0
        v.ch.activity = 'train'
        v.ch.face(0, -1, dt)
      }
      v.px = x
      v.pz = z
      v.ch.root.position.set(x, 0, z)
      v.ch.update(dt)
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

  private instructors = new Map<RoomId, Character>()

  /** One instructor (worker model) per room that hired one, standing at the upgrade desk. */
  syncInstructors(s: GameState, dt: number): void {
    for (const id of Object.keys(s.rooms) as RoomId[]) {
      const r = s.rooms[id]
      let ch = this.instructors.get(id)
      if (r.instructor && r.unlocked && !ch) {
        const female = id.length % 2 === 0
        ch = new Character({ model: female ? 'instructorW' : 'instructorM', scale: 0.95 })
        const u = upgradeSpotOf(id)
        const side = ROOMS[id].side
        ch.root.position.set(u.x + side * 1.0, 0, u.z - 1.1)
        ch.root.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2
        ch.activity = 'train'
        ch.cheer(2)
        this.parent.add(ch.root)
        this.instructors.set(id, ch)
      }
      ch?.update(dt)
    }
  }

  /** World position of a cadet (for effects). */
  posOf(id: number): { x: number; z: number } | null {
    const v = this.views.get(id)
    return v ? { x: v.px, z: v.pz } : null
  }
}
