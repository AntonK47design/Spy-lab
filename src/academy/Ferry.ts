/**
 * Ferry between the docks jetty and the lighthouse island. Standing on a boarding spot calls the
 * boat (it comes over empty if it is on the other side), the hero boards for a moment, then rides
 * across standing on deck. After arrival the spot must be left once before it triggers again.
 * Before the lighthouse gate is paid the boat lies moored at the docks as a teaser.
 */
import { Group, Mesh } from 'three'
import { FERRY } from '../config/rooms'
import { StaticBatch } from '../render/geometry'
import { flatMat } from '../render/materials'
import { PAL } from '../render/palette'
import { t, lang } from '../i18n/i18n'
import type { WorldLabels, WorldLabel } from './WorldLabels'

type Side = 'docks' | 'island'
type State = { kind: 'idle'; at: Side } | { kind: 'board'; at: Side; t: number } | { kind: 'cross'; to: Side; t: number; withHero: boolean }

const BOARD_R = 1.0

function boatGeo() {
  const b = new StaticBatch()
  b.rbox(2.3, 0.7, 3.6, 0, 0.05, 0, PAL.white, 0.3)
  b.rbox(2.36, 0.16, 3.66, 0, 0.32, 0, PAL.coral, 0.06)
  b.rbox(2.0, 0.08, 3.2, 0, 0.42, 0, PAL.wood, 0.03)
  b.rbox(1.2, 0.9, 0.9, 0, 0.9, -1.0, 0xf3e2c4, 0.1)
  b.rbox(1.25, 0.12, 0.95, 0, 1.4, -1.0, PAL.coral, 0.04)
  b.rbox(0.9, 0.3, 0.06, 0, 1.05, -0.53, 0x7cd6e0, 0.02)
  b.cyl(0.04, 0.04, 1.2, 0.7, 1.4, 1.3, PAL.steelDark, 6)
  b.rbox(0.5, 0.3, 0.03, 0.95, 1.85, 1.3, PAL.brandYellow, 0.02)
  return b.build()
}

export class Ferry {
  readonly root = new Group()
  private state: State = { kind: 'idle', at: 'docks' }
  private armed = { docks: true, island: true }
  private time = 0
  private labels: WorldLabel[] = []
  private open = false
  private lastLang = ''
  /** True while the hero is on board (input ignored, position follows the deck). */
  riding = false

  constructor(parent: Group, private wl: WorldLabels) {
    const m = new Mesh(boatGeo(), flatMat)
    m.castShadow = true
    this.root.add(m)
    this.root.position.set(FERRY.x, -0.3, FERRY.boatDocks)
    parent.add(this.root)
  }

  private zOf(side: Side): number {
    return side === 'docks' ? FERRY.boatDocks : FERRY.boatIsland
  }

  private spot(side: Side) {
    return side === 'docks' ? FERRY.boardDocks : FERRY.boardIsland
  }

  private syncLabels(open: boolean): void {
    if (open === this.open && this.labels.length) return
    this.open = open
    for (const l of this.labels) this.wl.remove(l)
    this.labels = []
    if (!open) return
    for (const side of ['docks', 'island'] as const) {
      const p = this.spot(side)
      const l = this.wl.add('pad pad-ferry', p.x, 0.6, p.z, `ferry-${side}`)
      l.el.innerHTML = `<div class="pad-title big"><b>${t('pad.ferry')}</b></div>`
      this.labels.push(l)
    }
  }

  /** Language switch: rebuild the sign text. */
  relabel(): void {
    for (const l of this.labels) l.el.innerHTML = `<div class="pad-title big"><b>${t('pad.ferry')}</b></div>`
  }

  /**
   * Advance the ferry. Returns the deck position while the hero rides (the caller places the hero
   * there and ignores input), or where to put the hero on arrival, else null.
   */
  update(dt: number, open: boolean, hero: { x: number; z: number }): { x: number; z: number; arrived: boolean } | null {
    this.time += dt
    this.syncLabels(open)
    if (lang.value !== this.lastLang) {
      this.lastLang = lang.value
      this.relabel()
    }
    const bob = Math.sin(this.time * 1.7) * 0.05
    this.root.position.y = -0.3 + bob
    this.root.rotation.z = Math.sin(this.time * 1.3) * 0.02
    if (!open) return null
    const near = (side: Side) => {
      const p = this.spot(side)
      return (hero.x - p.x) ** 2 + (hero.z - p.z) ** 2 <= BOARD_R * BOARD_R
    }
    // leaving a spot re-arms it
    for (const side of ['docks', 'island'] as const) if (!near(side)) this.armed[side] = true

    const st = this.state
    if (st.kind === 'idle') {
      for (const side of ['docks', 'island'] as const) {
        if (!near(side) || !this.armed[side]) continue
        if (st.at === side) this.state = { kind: 'board', at: side, t: 0 }
        else this.state = { kind: 'cross', to: side, t: 0, withHero: false } // fetch the boat
      }
      return null
    }
    if (st.kind === 'board') {
      if (!near(st.at)) {
        this.state = { kind: 'idle', at: st.at }
        return null
      }
      st.t += dt
      if (st.t >= FERRY.boardSeconds) {
        this.state = { kind: 'cross', to: st.at === 'docks' ? 'island' : 'docks', t: 0, withHero: true }
        this.riding = true
      }
      return null
    }
    // crossing
    st.t += dt
    const from = st.to === 'island' ? 'docks' : 'island'
    const k = Math.min(1, st.t / FERRY.rideSeconds)
    const e = k * k * (3 - 2 * k)
    const z = this.zOf(from) + (this.zOf(st.to) - this.zOf(from)) * e
    this.root.position.z = z
    if (k >= 1) {
      const to = st.to
      this.state = { kind: 'idle', at: to }
      if (st.withHero) {
        this.riding = false
        this.armed[to] = false
        const p = this.spot(to)
        // step off onto the jetty, a little inland from the boarding spot
        return { x: p.x, z: p.z + (to === 'island' ? -0.9 : 0.9), arrived: true }
      }
      // fetched empty: board right away if the hero still waits
      if (near(to)) this.state = { kind: 'board', at: to, t: 0 }
      return null
    }
    return st.withHero ? { x: FERRY.x, z, arrived: false } : null
  }
}
