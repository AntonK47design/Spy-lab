/**
 * Floor pads (stand on them to pour cash in): sign-up desk, clerk, room unlock, stations,
 * kit crates, staff hires; plus the Mission Control pad and the upgrade desks.
 * Visual plate + DOM label. Also the kit indicators above every built station.
 */
import { BoxGeometry, Group, Mesh, MeshLambertMaterial, RingGeometry, MeshBasicMaterial } from 'three'
import { LAYOUT, ROOMS, ROOM_ORDER, crateOf, padOf, slotOf, staffPadOf, upgradeSpotOf, type RoomId } from '../config/rooms'
import type { GameState } from '../sim/state'
import { levelCost, nextStaff, nextUnlock, padPrice, trainingRooms, type PadTarget } from '../sim/academy'
import { formatNumber } from '../core/format'
import { t, lang } from '../i18n/i18n'
import type { WorldLabels, WorldLabel } from './WorldLabels'
import { ECONOMY } from '../config/economy'

export type PadKind = PadTarget['kind'] | 'missions' | 'upgrade'

export interface Pad {
  kind: PadKind
  room: RoomId | null
  target: PadTarget | null
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
  buy: new MeshBasicMaterial({ color: 0xf2b134 }),
  missions: new MeshBasicMaterial({ color: 0x46c2cb }),
  upgrade: new MeshBasicMaterial({ color: 0xfff3e0 }),
  dim: new MeshBasicMaterial({ color: 0x8a8f9c }),
}

function targetPos(tg: PadTarget, s: GameState): { x: number; z: number } {
  switch (tg.kind) {
    case 'counter': return LAYOUT.serveSpot
    case 'clerk': return LAYOUT.clerkPad
    case 'unlock': return padOf(tg.room)
    case 'station': return slotOf(tg.room, s.rooms[tg.room].stations)
    case 'crate': return crateOf(tg.room)
    case 'staff': return staffPadOf(tg.room)
  }
}

export class Pads {
  readonly list: Pad[] = []
  private time = 0
  private lastLang = ''
  private kitLabels = new Map<string, WorldLabel>()

  constructor(
    private parent: Group,
    private labels: WorldLabels,
  ) {}

  private make(kind: PadKind, room: RoomId | null, target: PadTarget | null, x: number, z: number): Pad {
    const group = new Group()
    group.position.set(x, 0.03, z)
    const plate = new Mesh(plateGeo, plateMat)
    const fill = new Mesh(fillGeo, fillMat)
    fill.scale.set(0.001, 1, 1.7)
    fill.position.set(-0.85, 0.01, 0)
    const ring = new Mesh(ringGeo, kind === 'missions' ? ringMats.missions : kind === 'upgrade' ? ringMats.upgrade : ringMats.buy)
    ring.position.y = 0.05
    group.add(plate, fill, ring)
    this.parent.add(group)
    const label = this.labels.add(`pad pad-${kind}`, x, kind === 'missions' || kind === 'upgrade' ? 0.9 : 0.4, z, `pad-${kind}-${room ?? 'bakery'}`)
    const p: Pad = { kind, room, target, x, z, group, fill, ring, label, active: true, key: '' }
    this.list.push(p)
    return p
  }

  /** Every pad that should exist now (purchase pads only while purchasable / upcoming). */
  private wanted(s: GameState): { kind: PadKind; room: RoomId | null; target: PadTarget | null; x: number; z: number }[] {
    const out: { kind: PadKind; room: RoomId | null; target: PadTarget | null; x: number; z: number }[] = []
    const push = (tg: PadTarget) => {
      if (padPrice(s, tg)) out.push({ kind: tg.kind, room: 'room' in tg ? tg.room : null, target: tg, ...targetPos(tg, s) })
    }
    push({ kind: 'counter' })
    push({ kind: 'clerk' })
    // every locked room shows its pad (dim unless it is next)
    for (const id of ROOM_ORDER) if (!s.rooms[id].unlocked) out.push({ kind: 'unlock', room: id, target: { kind: 'unlock', room: id }, ...padOf(id) })
    for (const id of trainingRooms(s)) {
      push({ kind: 'station', room: id })
      push({ kind: 'crate', room: id })
      push({ kind: 'staff', room: id })
      if (s.rooms[id].stations > 0) out.push({ kind: 'upgrade', room: id, target: null, ...upgradeSpotOf(id) })
    }
    if (s.rooms.mission_control.unlocked) out.push({ kind: 'missions', room: 'mission_control', target: null, ...padOf('mission_control') })
    return out
  }

  /** Create/remove pads to match the state, refresh labels. */
  sync(s: GameState): void {
    const want = this.wanted(s)
    const same = (p: Pad, w: { kind: PadKind; room: RoomId | null; x: number; z: number }) =>
      p.kind === w.kind && p.room === w.room && Math.abs(p.x - w.x) < 0.01 && Math.abs(p.z - w.z) < 0.01
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]!
      if (!want.some((w) => same(p, w))) {
        this.parent.remove(p.group)
        this.labels.remove(p.label)
        this.list.splice(i, 1)
      }
    }
    for (const w of want) if (!this.list.some((p) => same(p, w))) this.make(w.kind, w.room, w.target, w.x, w.z)
    const force = this.lastLang !== lang.value
    this.lastLang = lang.value
    for (const p of this.list) this.refresh(p, s, force)
    this.syncKits(s, force)
  }

  private priceHtml(left: number, dim: boolean, icon = 'ico-cash'): string {
    return `<div class="pad-price ${dim ? 'dim' : ''}"><span class="${icon}"></span>${formatNumber(left, lang.value)}</div>`
  }

  private refresh(p: Pad, s: GameState, force: boolean): void {
    const room = p.room ? t(`room.${p.room}`) : ''
    let key = ''
    let html = ''
    const price = p.target ? padPrice(s, p.target) : null
    const left = price ? price.cost - price.paid : 0
    if (p.kind === 'unlock' && p.room) {
      const next = nextUnlock(s) === p.room
      const levelOk = s.level >= ROOMS[p.room].unlockLevel
      const can = !!price
      p.active = can
      const rect = ROOMS[p.room].rect
      p.label.x = next ? p.x : rect.x
      p.label.z = next ? p.z : rect.z
      p.group.visible = next
      key = `u${can}${levelOk}${next}${left}`
      if (key !== p.key || force)
        html = can
          ? `${this.priceHtml(left, false)}<div class="pad-title"><b>${t('pad.unlock')}</b> ${room}</div>`
          : `<div class="pad-title dim">${room}</div>${levelOk ? this.priceHtml(ROOMS[p.room].unlockCost - s.rooms[p.room].paid, true, 'ico-lock') : `<div class="pad-price dim"><span class="ico-lock"></span>${t('pad.level', { n: ROOMS[p.room].unlockLevel })}</div>`}`
    } else if (p.kind === 'missions') {
      key = 'm'
      if (key !== p.key || force) html = `<div class="pad-title big"><b>${t('pad.missions')}</b></div>`
    } else if (p.kind === 'upgrade' && p.room) {
      const cost = levelCost(s, p.room)
      const afford = s.cash >= cost
      key = `g${s.rooms[p.room].level}${afford}`
      if (key !== p.key || force)
        html = `<div class="pad-title"><b>${t('pad.office')}</b> ${t('upgrade.lv', { n: s.rooms[p.room].level })}</div><div class="pad-price ${afford ? 'ok' : 'dim'}"><span class="ico-up"></span>${formatNumber(cost, lang.value)}</div>`
    } else if (price) {
      p.active = true
      const what =
        p.kind === 'counter' ? t('pad.counter')
        : p.kind === 'clerk' ? t('pad.clerk')
        : p.kind === 'crate' ? t('pad.crate')
        : p.kind === 'station' ? t(`station.${p.room}`)
        : t(`staff.${nextStaff(s, p.room as RoomId)?.kind ?? 'runner'}`)
      const verb = p.kind === 'clerk' || p.kind === 'staff' ? t('pad.hire') : t('pad.build')
      key = `${p.kind}${left}${what}`
      if (key !== p.key || force) html = `${this.priceHtml(left, s.cash <= 0)}<div class="pad-title"><b>${verb}</b> ${what}</div>`
    }
    if (p.target && price) {
      const f = price.paid / price.cost
      p.fill.scale.x = Math.max(0.001, f * 1.7)
      p.fill.position.x = -0.85 + f * 0.85
      ;(p.group.children[0] as Mesh).material = p.active ? plateMat : plateMatDim
      p.ring.material = p.active ? ringMats.buy : ringMats.dim
    }
    if (html) {
      p.label.el.innerHTML = html
      p.label.el.classList.toggle('active', p.active)
    }
    p.key = key
  }

  /** "kits x/4" bubbles above every built station; red when a cadet waits for kits. */
  private syncKits(s: GameState, force: boolean): void {
    const seen = new Set<string>()
    for (const id of trainingRooms(s)) {
      const r = s.rooms[id]
      for (let i = 0; i < r.stations; i++) {
        const k = `${id}:${i}`
        seen.add(k)
        let l = this.kitLabels.get(k)
        if (!l) {
          const p = slotOf(id, i)
          l = this.labels.add('kits', p.x, 2.1, p.z - 0.8, `kits-${id}-${i}`)
          this.kitLabels.set(k, l)
        }
        const n = r.supply[i] ?? 0
        const waiting = s.cadets.some((c) => c.room === id && c.slot === i && c.phase === 'train' && !c.repping)
        const html = `<span class="kit-ico"></span>${n}/${ECONOMY.supply.basketMax}`
        const cls = `wlabel kits ${waiting ? 'empty' : n === 0 ? 'low' : ''}`
        if (force || l.el.innerHTML !== html) l.el.innerHTML = html
        if (l.el.className !== cls) l.el.className = cls
        l.visible = !r.runner || n === 0
      }
    }
    for (const [k, l] of this.kitLabels) {
      if (!seen.has(k)) {
        this.labels.remove(l)
        this.kitLabels.delete(k)
      }
    }
  }

  update(dt: number): void {
    this.time += dt
    for (const p of this.list) {
      if (p.active && p.kind !== 'missions' && p.kind !== 'upgrade') p.ring.scale.setScalar(1 + Math.sin(this.time * 4) * 0.06)
      else p.ring.scale.setScalar(1)
    }
  }

  /** The pad the player stands on (if any). */
  under(x: number, z: number): Pad | null {
    const r = ECONOMY.player.padRadius
    for (const p of this.list) if (p.group.visible && (p.x - x) ** 2 + (p.z - z) ** 2 <= r * r) return p
    return null
  }
}
