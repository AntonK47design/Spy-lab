/**
 * Floor pads: unlock (pour cash in by standing on it), missions (Mission Control),
 * upgrade (desk inside each training room). Visual plate + DOM label.
 */
import { BoxGeometry, Group, Mesh, MeshLambertMaterial, RingGeometry, MeshBasicMaterial } from 'three'
import { ROOMS, ROOM_ORDER, padOf, upgradeSpotOf, type RoomId } from '../config/rooms'
import type { GameState } from '../sim/state'
import { canUnlock, levelCost } from '../sim/academy'
import { formatNumber } from '../core/format'
import { t, lang } from '../i18n/i18n'
import type { WorldLabels, WorldLabel } from './WorldLabels'
import { ECONOMY } from '../config/economy'

export type PadKind = 'unlock' | 'missions' | 'upgrade'

export interface Pad {
  kind: PadKind
  room: RoomId
  x: number
  z: number
  group: Group
  fill: Mesh
  ring: Mesh
  label: WorldLabel
  active: boolean
  key: string
}

const plateGeo = new BoxGeometry(1.9, 0.06, 1.9)
const fillGeo = new BoxGeometry(1, 0.07, 1)
const ringGeo = new RingGeometry(1.05, 1.22, 32).rotateX(-Math.PI / 2)
const plateMat = new MeshLambertMaterial({ color: 0x22283a })
const plateMatDim = new MeshLambertMaterial({ color: 0x4a4f5c })
const fillMat = new MeshLambertMaterial({ color: 0x5fbf5a, emissive: 0x143d14 })
const ringMats = {
  unlock: new MeshBasicMaterial({ color: 0xf2b134 }),
  missions: new MeshBasicMaterial({ color: 0x46c2cb }),
  upgrade: new MeshBasicMaterial({ color: 0xfff3e0 }),
  dim: new MeshBasicMaterial({ color: 0x8a8f9c }),
}

export class Pads {
  readonly list: Pad[] = []
  private t = 0
  private lastLang = ''

  constructor(
    private parent: Group,
    private labels: WorldLabels,
  ) {}

  private make(kind: PadKind, room: RoomId, x: number, z: number): Pad {
    const group = new Group()
    group.position.set(x, 0.03, z)
    const plate = new Mesh(plateGeo, plateMat)
    const fill = new Mesh(fillGeo, fillMat)
    fill.scale.set(0.001, 1, 1.7)
    fill.position.set(-0.85, 0.01, 0)
    const ring = new Mesh(ringGeo, ringMats[kind])
    ring.position.y = 0.05
    group.add(plate, fill, ring)
    this.parent.add(group)
    const label = this.labels.add(`pad pad-${kind}`, x, kind === 'unlock' ? 0.4 : 0.9, z, `pad-${kind}-${room}`)
    const p: Pad = { kind, room, x, z, group, fill, ring, label, active: true, key: '' }
    this.list.push(p)
    return p
  }

  /** Create/remove pads to match the state, refresh labels. */
  sync(s: GameState): void {
    const want: { kind: PadKind; room: RoomId; x: number; z: number }[] = []
    for (const id of ROOM_ORDER) {
      const r = s.rooms[id]
      if (!r.unlocked) {
        const p = padOf(id)
        want.push({ kind: 'unlock', room: id, ...p })
      } else if (id === 'mission_control') {
        const p = padOf(id)
        want.push({ kind: 'missions', room: id, ...p })
      } else if (ROOMS[id].kind === 'training') {
        const p = upgradeSpotOf(id)
        want.push({ kind: 'upgrade', room: id, ...p })
      }
    }
    // remove stale
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]!
      if (!want.some((w) => w.kind === p.kind && w.room === p.room)) {
        this.parent.remove(p.group)
        this.labels.remove(p.label)
        this.list.splice(i, 1)
      }
    }
    for (const w of want) if (!this.list.some((p) => p.kind === w.kind && p.room === w.room)) this.make(w.kind, w.room, w.x, w.z)
    const langChanged = this.lastLang !== lang.value
    this.lastLang = lang.value
    for (const p of this.list) this.refresh(p, s, langChanged)
  }

  private refresh(p: Pad, s: GameState, force: boolean): void {
    const r = s.rooms[p.room]
    const name = t(`room.${p.room}`)
    let key = ''
    let html = ''
    if (p.kind === 'unlock') {
      const cost = ROOMS[p.room].unlockCost
      const can = canUnlock(s, p.room)
      const levelOk = s.level >= ROOMS[p.room].unlockLevel
      p.active = can
      const left = cost - r.paid
      const rect = ROOMS[p.room].rect
      p.label.x = can ? p.x : rect.x
      p.label.z = can ? p.z : rect.z
      key = `u${can}${levelOk}${left}`
      if (key !== p.key || force) {
        html = can
          ? `<div class="pad-price"><span class="ico-cash"></span>${formatNumber(left, lang.value)}</div><div class="pad-title"><b>${t('pad.unlock')}</b> ${name}</div>`
          : levelOk
            ? `<div class="pad-title dim">${name}</div><div class="pad-price dim"><span class="ico-lock"></span>${formatNumber(left, lang.value)}</div>`
            : `<div class="pad-title dim">${name}</div><div class="pad-price dim"><span class="ico-lock"></span>${t('pad.level', { n: ROOMS[p.room].unlockLevel })}</div>`
      }
      p.fill.scale.x = Math.max(0.001, (r.paid / cost) * 1.7)
      p.fill.position.x = -0.85 + (r.paid / cost) * 0.85
      ;(p.group.children[0] as Mesh).material = can ? plateMat : plateMatDim
      p.ring.material = can ? ringMats.unlock : ringMats.dim
    } else if (p.kind === 'missions') {
      key = 'm'
      if (key !== p.key || force) html = `<div class="pad-title big"><b>${t('pad.missions')}</b></div>`
    } else {
      const cost = levelCost(s, p.room)
      const afford = s.cash >= cost
      key = `g${r.level}${afford}`
      if (key !== p.key || force)
        html = `<div class="pad-title"><b>${name}</b> ${t('upgrade.lv', { n: r.level })}</div><div class="pad-price ${afford ? 'ok' : 'dim'}"><span class="ico-up"></span>${formatNumber(cost, lang.value)}</div>`
    }
    if (html) {
      p.label.el.innerHTML = html
      p.label.el.classList.toggle('active', p.active)
    }
    p.key = key
  }

  update(dt: number): void {
    this.t += dt
    for (const p of this.list) {
      if (p.kind === 'unlock' && p.active) p.ring.scale.setScalar(1 + Math.sin(this.t * 4) * 0.06)
      else p.ring.scale.setScalar(1)
    }
  }

  /** The pad the player stands on (if any). */
  under(x: number, z: number): Pad | null {
    const r = ECONOMY.player.padRadius
    for (const p of this.list) if ((p.x - x) ** 2 + (p.z - z) ** 2 <= r * r) return p
    return null
  }
}
