/**
 * Street life: a taxi brings every new cadet to the stop (timed from the sim's arrival timer,
 * so it halts exactly when the cadet steps out), plus passing cars in the far lane.
 */
import { Mesh, type BufferGeometry, type Group } from 'three'
import { flatMat } from '../render/materials'
import { ECONOMY } from '../config/economy'
import { LAYOUT } from '../config/rooms'
import { waitingCount } from '../sim/academy'
import type { GameState } from '../sim/state'

const EDGE = 34
const LEAD = 2.4 // seconds the taxi needs from the edge to the stop

interface Car {
  m: Mesh
  phase: 'in' | 'wait' | 'out' | 'pass'
  t: number
  dir: 1 | -1
}

export class Traffic {
  private taxi: Car | null = null
  private passing: Car[] = []
  private passT = 3

  constructor(
    private parent: Group,
    private geo: { taxi: BufferGeometry | null; sedan: BufferGeometry | null; wagon: BufferGeometry | null },
  ) {}

  private car(g: BufferGeometry | null): Mesh | null {
    if (!g) return null
    const m = new Mesh(g, flatMat)
    m.castShadow = true
    this.parent.add(m)
    return m
  }

  update(s: GameState, dt: number): void {
    const st = LAYOUT.street
    // dispatch the taxi so it reaches the stop when the next cadet arrives
    const willArrive = waitingCount(s) < ECONOMY.queueMax
    if (!this.taxi && willArrive && s.arrivalTimer <= LEAD && s.arrivalTimer > 0.2) {
      const m = this.car(this.geo.taxi)
      if (m) {
        m.rotation.y = Math.PI / 2
        this.taxi = { m, phase: 'in', t: LEAD - s.arrivalTimer, dir: 1 }
      }
    }
    const tx = this.taxi
    if (tx) {
      tx.t += dt
      if (tx.phase === 'in') {
        const k = Math.min(1, tx.t / LEAD)
        const e = 1 - (1 - k) * (1 - k) // ease out into the stop
        tx.m.position.set(-EDGE + (st.stopX - -EDGE) * e, 0.02, st.laneIn)
        if (k >= 1) {
          tx.phase = 'wait'
          tx.t = 0
        }
      } else if (tx.phase === 'wait') {
        if (tx.t > 1.2) {
          tx.phase = 'out'
          tx.t = 0
        }
      } else {
        const x = st.stopX + tx.t * tx.t * 6
        tx.m.position.x = x
        if (x > EDGE) {
          this.parent.remove(tx.m)
          this.taxi = null
        }
      }
    }
    // passing cars in the far lane
    this.passT -= dt
    if (this.passT <= 0 && this.passing.length < 2) {
      this.passT = 5 + Math.random() * 7
      const m = this.car(Math.random() < 0.5 ? this.geo.sedan : this.geo.wagon)
      if (m) {
        m.rotation.y = -Math.PI / 2
        m.position.set(EDGE, 0.02, st.laneOut)
        this.passing.push({ m, phase: 'pass', t: 0, dir: -1 })
      }
    }
    for (let i = this.passing.length - 1; i >= 0; i--) {
      const c = this.passing[i]!
      c.m.position.x -= dt * 7
      if (c.m.position.x < -EDGE) {
        this.parent.remove(c.m)
        this.passing.splice(i, 1)
      }
    }
  }
}
