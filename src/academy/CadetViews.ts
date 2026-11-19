/** Visuals for sim cadets: walk in from the street along the path, train at their station. */
import type { Group } from 'three'
import { Character } from './Character'
import { cadetPath, slotOf, type RoomId } from '../config/rooms'
import type { CadetState, GameState } from '../sim/state'

const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac]
const HAIRS = [0x2b1b12, 0x5a3a2a, 0xd9a441, 0x8a3b1f, 0x1a1a1a]
const OUTFITS: Partial<Record<RoomId, number>> = { vault: 0x1f5f6b, laser: 0x6b2f5a, cipher: 0x2f6b4a }

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
    const ch = new Character({
      outfit: OUTFITS[c.room] ?? 0x1f5f6b,
      skin: SKINS[c.id % SKINS.length] as number,
      hair: HAIRS[(c.id * 7) % HAIRS.length] as number,
      head: 'cap',
      scale: 0.82,
    })
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

  /** World position of a cadet (for effects). */
  posOf(id: number): { x: number; z: number } | null {
    const v = this.views.get(id)
    return v ? { x: v.px, z: v.pz } : null
  }
}
