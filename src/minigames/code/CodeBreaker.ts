/**
 * Code Breaker (Brains): Mastermind on a keypad terminal. Guess the code with the on-screen
 * keypad (or keys 1-7, Backspace, Enter); each slot of a guess lights green (right symbol, right
 * place), yellow (in the code, elsewhere) or grey (not in the code). Attempts run out -> alarm.
 * Hints lock one correct slot (first free, then via rewarded ad - handled by the game).
 */
import {
  BoxGeometry, Color, CylinderGeometry, DirectionalLight, ExtrudeGeometry, Group, HemisphereLight, Mesh,
  MeshLambertMaterial, PerspectiveCamera, Scene, Shape, type BufferGeometry,
} from 'three'
import { CODE, CODE_TIERS, type CodeTier } from '../../config/minigames'
import { mgHud, type GameContext, type Minigame, type MinigameResult, type MissionModifiers } from '../Minigame'
import { AudioManager } from '../../audio/AudioManager'

type Mark = 'green' | 'yellow' | 'grey'

const TILE = 0.86
const GAP = 0.14

/** Wordle-style feedback with correct handling of repeated symbols. */
export function scoreGuess(code: number[], guess: number[]): Mark[] {
  const marks: Mark[] = guess.map(() => 'grey')
  const left = new Map<number, number>()
  code.forEach((c, i) => {
    if (guess[i] === c) marks[i] = 'green'
    else left.set(c, (left.get(c) ?? 0) + 1)
  })
  guess.forEach((g, i) => {
    if (marks[i] === 'green') return
    const n = left.get(g) ?? 0
    if (n > 0) {
      marks[i] = 'yellow'
      left.set(g, n - 1)
    }
  })
  return marks
}

function starGeo(): BufferGeometry {
  const s = new Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.13 : 0.31
    const a = Math.PI / 2 + (i * Math.PI) / 5
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  s.closePath()
  return new ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false }).translate(0, 0, -0.04)
}

export class CodeBreaker implements Minigame {
  readonly id = 'code' as const
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(32, 1, 0.1, 100)
  onResult: (r: MinigameResult) => void = () => {}

  private tier!: CodeTier
  private code: number[] = []
  private attempts = 0
  private used = 0
  private typed: number[] = []
  private locked: boolean[] = []
  private known: (number | null)[] = []
  private history: { guess: number[]; marks: Mark[] }[] = []
  private hintsLeft: number = CODE.freeHints
  private time = 0
  private running = false
  private finished = false
  private flash: 'hit' | 'miss' | null = null
  private flashT = 0
  private firstTime = false
  private w = 1
  private h = 1
  private board = new Group()
  private tiles: Mesh[][] = []
  private symbolMeshes: (Group | null)[][] = []
  private reveal: { row: number; t: number } | null = null
  private candidates: number[][] = []
  private disposables: { dispose(): void }[] = []
  private shapeGeo: BufferGeometry[] = []
  private symMat: MeshLambertMaterial[] = []
  private tileMat: Record<'empty' | 'input' | 'active' | Mark, MeshLambertMaterial>
  private frameMat!: MeshLambertMaterial

  constructor() {
    const m = (c: number) => {
      const x = new MeshLambertMaterial({ color: c })
      this.disposables.push(x)
      return x
    }
    this.tileMat = { empty: m(0x26324f), input: m(0x3b4f7a), active: m(0x30406a), green: m(0x5fbf5a), yellow: m(0xf2b134), grey: m(0x5d6270) }
    this.frameMat = m(0x0e1730)
  }

  async init(ctx: GameContext, tierN: number, mods: MissionModifiers): Promise<void> {
    this.tier = CODE_TIERS[Math.max(0, Math.min(CODE_TIERS.length - 1, tierN - 1))] as CodeTier
    const bonus = Math.min(CODE.maxSkillAttempts, Math.floor(mods.agentSkill / CODE.skillPerAttempt))
    this.attempts = this.tier.attempts + bonus
    this.time = this.tier.timeLimit
    this.firstTime = ctx.firstTime
    this.w = ctx.width
    this.h = ctx.height
    this.makeCode()
    this.typed = Array.from({ length: this.tier.length }, () => -1)
    this.locked = Array.from({ length: this.tier.length }, () => false)
    this.known = Array.from({ length: this.tier.length }, () => null)
    this.candidates = this.allCodes()
    this.build()
    this.resize(ctx.width, ctx.height)
    this.publish()
  }

  private makeCode(): void {
    const n = this.tier.symbols
    const pool = Array.from({ length: n }, (_, i) => i)
    for (let i = 0; i < this.tier.length; i++) {
      if (this.tier.duplicates) this.code.push(Math.floor(Math.random() * n))
      else this.code.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!)
    }
  }

  private allCodes(): number[][] {
    const out: number[][] = []
    const n = this.tier.symbols
    const L = this.tier.length
    const rec = (prefix: number[]) => {
      if (prefix.length === L) {
        out.push(prefix)
        return
      }
      for (let s = 0; s < n; s++) if (this.tier.duplicates || !prefix.includes(s)) rec([...prefix, s])
    }
    rec([])
    return out
  }

  // ---------------------------------------------------------------- scene
  private build(): void {
    const s = this.scene
    s.background = new Color(0x14213d)
    s.add(new HemisphereLight(0xffffff, 0x334455, 1.7))
    const d = new DirectionalLight(0xffffff, 1.1)
    d.position.set(2, 4, 6)
    s.add(d)
    // symbol shapes (shared) + colours
    const cyl = (r: number, seg: number, rot = 0) => new CylinderGeometry(r, r, 0.08, seg).rotateX(Math.PI / 2).rotateZ(rot)
    this.shapeGeo = [cyl(0.27, 24), cyl(0.32, 3, Math.PI), new BoxGeometry(0.44, 0.44, 0.08), starGeo(), cyl(0.32, 4, 0), cyl(0.29, 6, Math.PI / 6), new BoxGeometry(0.5, 0.15, 0.08)]
    this.disposables.push(...this.shapeGeo)
    this.symMat = CODE.colors.map((c) => {
      const m = new MeshLambertMaterial({ color: c, emissive: new Color(c).multiplyScalar(0.25) })
      this.disposables.push(m)
      return m
    })
    s.add(this.board)
    this.buildBoard()
  }

  private boardSize() {
    const L = this.tier.length
    return { w: L * TILE + (L - 1) * GAP, h: this.attempts * TILE + (this.attempts - 1) * GAP }
  }

  /** (Re)build the board: one row per attempt (rebuilt when a revive adds rows). */
  private buildBoard(): void {
    for (const c of [...this.board.children]) this.board.remove(c)
    this.tiles = []
    this.symbolMeshes = []
    const { w, h } = this.boardSize()
    const frame = new Mesh(new BoxGeometry(w + 1.0, h + 1.0, 0.3), this.frameMat)
    this.disposables.push(frame.geometry)
    frame.position.z = -0.25
    this.board.add(frame)
    const bezel = new Mesh(new BoxGeometry(w + 1.3, h + 1.3, 0.2), new MeshLambertMaterial({ color: 0x3b4f7a }))
    this.disposables.push(bezel.geometry, bezel.material as MeshLambertMaterial)
    bezel.position.z = -0.42
    this.board.add(bezel)
    const tileGeo = new BoxGeometry(TILE, TILE, 0.12)
    this.disposables.push(tileGeo)
    for (let r = 0; r < this.attempts; r++) {
      const row: Mesh[] = []
      const syms: (Group | null)[] = []
      for (let c = 0; c < this.tier.length; c++) {
        const t = new Mesh(tileGeo, this.tileMat.empty)
        t.position.set(-w / 2 + TILE / 2 + c * (TILE + GAP), h / 2 - TILE / 2 - r * (TILE + GAP), 0)
        this.board.add(t)
        row.push(t)
        syms.push(null)
      }
      this.tiles.push(row)
      this.symbolMeshes.push(syms)
    }
    // re-apply history
    this.history.forEach((hrow, r) => hrow.guess.forEach((g, c) => this.setSlot(r, c, g, hrow.marks[c]!)))
    this.paintInput()
  }

  private makeSymbol(i: number): Group {
    const g = new Group()
    const m = new Mesh(this.shapeGeo[i]!, this.symMat[i]!)
    g.add(m)
    if (i === 6) {
      // cross: second bar
      const m2 = new Mesh(this.shapeGeo[6]!, this.symMat[6]!)
      m2.rotation.z = Math.PI / 2
      g.add(m2)
    }
    if (i === 1) m.position.y = -0.03
    return g
  }

  private setSlot(r: number, c: number, sym: number, mark: Mark | 'input' | 'active' | 'empty'): void {
    const tile = this.tiles[r]?.[c]
    if (!tile) return
    tile.material = this.tileMat[mark]
    const old = this.symbolMeshes[r]![c]
    if (old) tile.remove(old)
    this.symbolMeshes[r]![c] = null
    if (sym >= 0) {
      const g = this.makeSymbol(sym)
      g.position.z = 0.09
      tile.add(g)
      this.symbolMeshes[r]![c] = g
    }
  }

  private paintInput(): void {
    const r = this.used
    if (r >= this.attempts || this.finished) return
    for (let c = 0; c < this.tier.length; c++) this.setSlot(r, c, this.typed[c]!, this.locked[c] ? 'green' : this.typed[c]! >= 0 ? 'input' : 'active')
  }

  // ---------------------------------------------------------------- input
  input(cmd: 'sym' | 'del' | 'ok', arg?: number): void {
    if (!this.running || this.finished || this.reveal) return
    if (cmd === 'sym' && arg !== undefined && arg >= 0 && arg < this.tier.symbols) {
      const i = this.typed.findIndex((v, k) => v < 0 && !this.locked[k])
      if (i < 0) return
      this.typed[i] = arg
      AudioManager.play('keypad_beep', 0.9 + arg * 0.05)
    } else if (cmd === 'del') {
      for (let i = this.typed.length - 1; i >= 0; i--)
        if (this.typed[i]! >= 0 && !this.locked[i]) {
          this.typed[i] = -1
          AudioManager.play('ui_click')
          break
        }
    } else if (cmd === 'ok') {
      if (this.typed.some((v) => v < 0)) return
      this.submit()
      return
    }
    this.paintInput()
    this.publish()
  }

  action(): void {
    this.input('ok')
  }

  private submit(): void {
    const guess = [...this.typed]
    const marks = scoreGuess(this.code, guess)
    this.history.push({ guess, marks })
    this.candidates = this.candidates.filter((c) => scoreGuess(c, guess).every((m, i) => m === marks[i]))
    marks.forEach((m, i) => {
      if (m === 'green') this.known[i] = guess[i]!
    })
    this.reveal = { row: this.used, t: 0 }
    this.used++
    AudioManager.play('keypad_beep', 1.2)
  }

  private afterReveal(): void {
    const last = this.history[this.history.length - 1]!
    if (last.marks.every((m) => m === 'green')) {
      this.flash = 'hit'
      this.flashT = 0.4
      AudioManager.play('bolt_open')
      this.finish(true)
      return
    }
    this.flash = 'miss'
    this.flashT = 0.3
    AudioManager.play('alarm', 1.4)
    if (this.used >= this.attempts) {
      this.finish(false, 'alarm')
      return
    }
    // next row: only hint-locked slots stay filled
    this.typed = this.typed.map((v, i) => (this.locked[i] ? v : -1))
    this.paintInput()
  }

  /** Lock one not-yet-locked slot with its correct symbol (free hint or after a rewarded ad). */
  useHint(): void {
    if (this.finished) return
    const open = this.typed.map((_, i) => i).filter((i) => !this.locked[i])
    if (!open.length) return
    // prefer a slot the player has not solved yet
    const pick = open.find((i) => this.known[i] === null) ?? open[0]!
    this.locked[pick] = true
    this.typed[pick] = this.code[pick]!
    this.known[pick] = this.code[pick]!
    this.candidates = this.candidates.filter((c) => c[pick] === this.code[pick])
    this.hintsLeft = Math.max(0, this.hintsLeft - 1)
    AudioManager.play('upgrade')
    this.paintInput()
    this.publish()
  }

  freeHints(): number {
    return this.hintsLeft
  }

  // ---------------------------------------------------------------- loop
  start(): void {
    this.running = true
  }
  pause(): void {
    this.running = false
  }
  resume(): void {
    if (!this.finished) this.running = true
  }

  update(dt: number): void {
    this.flashT = Math.max(0, this.flashT - dt)
    if (this.flashT === 0) this.flash = null
    // flip the guessed row slot by slot
    if (this.reveal) {
      const rv = this.reveal
      rv.t += dt
      const h = this.history[rv.row]!
      for (let c = 0; c < this.tier.length; c++) {
        const k = Math.min(1, Math.max(0, (rv.t - c * 0.13) / 0.18))
        const tile = this.tiles[rv.row]![c]!
        tile.rotation.x = Math.sin(k * Math.PI) * 1.2
        if (k >= 0.5 && tile.material !== this.tileMat[h.marks[c]!]) this.setSlot(rv.row, c, h.guess[c]!, h.marks[c]!)
      }
      if (rv.t > this.tier.length * 0.13 + 0.25) {
        for (const t of this.tiles[rv.row]!) t.rotation.x = 0
        this.reveal = null
        this.afterReveal()
      }
    }
    if (!this.running || this.finished) {
      this.publish()
      return
    }
    if (this.tier.timeLimit > 0) {
      this.time -= dt
      if (this.time <= 0) {
        this.time = 0
        this.finish(false, 'time')
        return
      }
    }
    this.publish()
  }

  private finish(success: boolean, reason?: 'alarm' | 'time'): void {
    this.running = false
    this.finished = true
    const left = (this.attempts - this.used) / this.attempts
    const stars = !success ? 0 : left >= CODE.threeStarLeftShare ? 3 : left >= CODE.twoStarLeftShare ? 2 : 1
    this.publish()
    this.onResult({ success, stars, timeLeft: this.time, mistakes: Math.max(0, this.used - 1), intel: 0, reason })
  }

  revive(): void {
    this.attempts += CODE.reviveAttempts
    if (this.tier.timeLimit > 0) this.time = Math.max(this.time, 0) + CODE.reviveSeconds
    this.finished = false
    this.running = true
    this.typed = this.typed.map((v, i) => (this.locked[i] ? v : -1))
    this.buildBoard()
    this.resize(this.w, this.h)
    this.publish()
  }

  // ---------------------------------------------------------------- solver (tutorial + tests)
  /** Next keypad press of a consistent-guess player: symbol index, or 'ok' when the row is full. */
  debugSuggest(): number | 'ok' | null {
    if (this.finished || this.reveal) return null
    const target = this.candidates.find((c) => c.every((v, i) => !this.locked[i] || v === this.typed[i])) ?? this.candidates[0]
    if (!target) return null
    // wrong symbol typed so far: suggest delete via -1
    for (let i = 0; i < this.typed.length; i++) {
      if (this.locked[i]) continue
      if (this.typed[i]! < 0) return target[i]!
      if (this.typed[i] !== target[i]) return -1
    }
    return 'ok'
  }

  // ---------------------------------------------------------------- view
  resize(w: number, h: number): void {
    this.w = w
    this.h = h
    this.camera.aspect = w / h
    const { w: bw, h: bh } = this.boardSize()
    // the on-screen keypad takes the lower part of the screen: the board lives in the top ~60 %
    const portrait = h > w
    const visibleH = portrait ? 0.56 : 0.68
    const vfov = (this.camera.fov * Math.PI) / 180
    const needH = (bh + 1.6) / visibleH
    const needW = (bw + 1.6) / (portrait ? 0.95 : 0.6)
    const distH = needH / 2 / Math.tan(vfov / 2)
    const distW = needW / 2 / Math.tan(vfov / 2) / this.camera.aspect
    const dist = Math.max(distH, distW)
    // shift the view so the board sits in the upper part
    const viewH = 2 * Math.tan(vfov / 2) * dist
    const shift = (viewH * (1 - visibleH)) / 2 - (portrait ? 0.2 : 0.4)
    this.camera.position.set(0, -shift, dist)
    this.camera.lookAt(0, -shift, 0)
    this.camera.updateProjectionMatrix()
  }

  private publish(): void {
    let suggest: number | undefined
    if (this.firstTime && !this.finished && this.used < 2) {
      const s = this.debugSuggest()
      suggest = s === 'ok' ? -2 : s === null ? undefined : s
    }
    mgHud.value = {
      done: 0,
      total: 0,
      mistakes: this.used,
      maxMistakes: this.attempts,
      timeLeft: this.time,
      timeLimit: this.tier.timeLimit,
      ghost: null,
      flash: this.flash,
      keypad: {
        symbols: this.tier.symbols,
        input: [...this.typed],
        locked: [...this.locked],
        canSubmit: !this.typed.some((v) => v < 0) && !this.reveal,
        freeHints: this.hintsLeft,
        attemptsLeft: this.attempts - this.used,
        suggest,
      },
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose()
    this.scene.clear()
    mgHud.value = null
  }
}
