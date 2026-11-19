/**
 * Game controller: fixed 60 Hz sim, academy view, hero interactions (serve, carry kits,
 * collect, pads), mission flow (briefing -> minigame -> result) and every ad call site.
 */
import { PCFShadowMap, type WebGLRenderer } from 'three'
import { GuideArrow } from '../academy/GuideArrow'
import { effect } from '@preact/signals-core'
import { World } from '../academy/World'
import { Player } from '../academy/Player'
import { Character } from '../academy/Character'
import { CadetViews } from '../academy/CadetViews'
import { CashPiles } from '../academy/CashPiles'
import { Pads, type Pad } from '../academy/Pads'
import { WorldLabels, type WorldLabel } from '../academy/WorldLabels'
import { FollowCamera } from '../academy/FollowCamera'
import { Traffic } from '../academy/Traffic'
import { Input } from '../input/Input'
import { flatMat } from '../render/materials'
import { charMaterial } from '../render/assets'
import { ECONOMY, padFillSeconds } from '../config/economy'
import { LAYOUT, ROOMS, ROOM_ORDER, cashSpotOf, crateOf, padOf, slotOf, upgradeSpotOf, type RoomId } from '../config/rooms'
import { missionById, type MissionDef } from '../config/missions'
import {
  tick, collect, collectWelcome, payPad, padPrice, pickKits, dropKits, resolveGraduate, buySpeed, upgradeLevel,
  offlineEarnings, trainingRooms, nextUnlock, canUnlock, type SimEvents, type HeroInput,
} from '../sim/academy'
import { bestAgent, missionLock, missionReward, recordFail, recordWin } from '../sim/missions'
import type { Agent } from '../sim/state'
import { state, publish, persist, bump } from './store'
import { TUTORIAL, advanceTutorial, tutorialActive } from './tutorial'
import { isGameplayActive, onFlushRequest, pageHidden, userPaused } from '../core/lifecycle'
import { elapsedSince, now } from '../core/time'
import { AudioManager } from '../audio/AudioManager'
import { platform } from '../platform/bridge'
import { beginFlow, blockInterstitials, rewardedSupported, showInterstitial, showRewarded } from '../platform/ads'
import { track } from '../analytics/telemetry'
import { SafeCracker } from '../minigames/safe/SafeCracker'
import type { Minigame, MinigameResult } from '../minigames/Minigame'
import { coachLine, infoCard, missionUi, moveHint, nextPopup, panel, queuePopup, showToast, type Panel } from '../ui/uiState'
import { formatNumber } from '../core/format'
import { DEBUG } from '../debug/flags'
import { lang } from '../i18n/i18n'

const SIM_DT = 1 / 60
const MAX_STEPS = 15
const ROOM_KIT_COLOR: Partial<Record<RoomId, number>> = { vault: 0xf2b134, laser: 0xff5a4e, cipher: 0x7be07a, disguise: 0xf7c6d0, driving: 0x46c2cb, hack: 0x8a7bff }
const MINUTE_MARKS = [1, 2, 3, 5, 10, 15, 20, 30]

export class Game {
  readonly player = new Player()
  readonly cam = new FollowCamera()
  readonly input: Input
  readonly labels: WorldLabels
  readonly cadets: CadetViews
  readonly piles: CashPiles
  readonly pads: Pads
  readonly traffic: Traffic
  mode: 'academy' | 'minigame' = 'academy'
  /** Debug: force a difficulty tier for the next missions. */
  tierOverride: number | null = null
  private mg: Minigame | null = null
  private mission: MissionDef | null = null
  private agent: Agent | null = null
  private revivedThisAttempt = false
  private lastReward = { cash: 0, intel: 0 }
  private padOpened: string | null = null
  private padSound = 0
  private kitT = 0
  private acc = 0
  private revTimer = 0
  private saveDirtyTimer = 0
  private guide: GuideArrow
  private hiddenAt = 0
  private w = 1
  private h = 1
  private heroIn: HeroInput = { atCounter: false }
  private welcomeLabel: WorldLabel | null = null
  private serveLabel: WorldLabel
  private minuteIdx = 0
  private ev: SimEvents

  constructor(
    readonly world: World,
    private renderer: WebGLRenderer,
    private canvas: HTMLCanvasElement,
    uiLayer: HTMLElement,
  ) {
    this.labels = new WorldLabels(uiLayer)
    this.input = new Input(canvas, uiLayer)
    this.cadets = new CadetViews(world.dynamic)
    this.piles = new CashPiles(world.dynamic)
    this.pads = new Pads(world.dynamic, this.labels)
    this.traffic = new Traffic(world.dynamic, { taxi: world.propGeo('taxi'), sedan: world.propGeo('sedan'), wagon: world.propGeo('wagon') })
    world.dynamic.add(this.player.char.root)
    this.guide = new GuideArrow(world.dynamic, uiLayer)
    this.serveLabel = this.labels.add('serve', LAYOUT.serveSpot.x, 2.4, LAYOUT.serveSpot.z, 'serve-progress')

    this.ev = {
      cycle: (room, amount, auto) => {
        if (auto && this.mode === 'academy') this.popText(cashSpotOf(room), `+${formatNumber(amount, lang.value)}`, 'auto')
      },
      served: () => {
        AudioManager.play('stamp')
        persist(['core', 'meta'])
      },
      graduate: (_c, agent) => {
        AudioManager.play('level_up')
        track('agent_graduated', { rarity: agent.rarity })
        queuePopup({ kind: 'graduate' })
        persist(['core', 'agents', 'meta'])
      },
      levelUp: (level) => {
        track('academy_level_up', { level })
        queuePopup({ kind: 'levelup', level })
        persist(['core', 'meta'])
      },
      unlock: (room) => {
        this.pads.sync(state)
        track('room_unlocked', { room_id: room })
        AudioManager.play('unlock')
        showToast(`unlocked.${room}`)
        this.world.syncRooms(state)
        persist(['core', 'meta'], true)
      },
      area: (a) => {
        track('area_opened', { area: a })
        showToast(`areaOpen.${a}`)
        this.world.syncAreas(state)
        this.world.syncRooms(state)
      },
      built: (what, room) => {
        AudioManager.play('unlock')
        // rebuild pads right away so a standing hero never pays into the NEXT pad by accident
        this.pads.sync(state)
        this.padOpened = 'just-built'
        if (what === 'counter') {
          this.world.syncCounter(true)
          this.world.playBuild(state, 'counter', null)
          // the bread shelves slide apart and reveal the secret courtyard
          this.world.syncSecretDoor(true, true)
          // the desk now stands where the hero was: put the hero behind it, ready to serve
          this.player.x = LAYOUT.serveSpot.x
          this.player.z = LAYOUT.serveSpot.z
        }
        // stations / crates drop in with a build animation instead of popping into place
        if (room && (what === 'station' || what === 'crate')) this.world.playBuild(state, what, room)
        else if (room) this.world.syncRooms(state)
        track('built', { what, room_id: room ?? 'bakery' })
        persist(['core', 'meta'], true)
      },
    }

    this.input.onTap = (x, y) => this.tapWorld(x, y)
    window.addEventListener('keydown', (e) => {
      if (this.mode === 'minigame' && (e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
        e.preventDefault()
        this.minigameAction()
      }
    })
    canvas.addEventListener('pointerdown', (e) => {
      if (this.mode === 'minigame' && e.isPrimary) this.minigameAction()
      window.focus()
      if (moveHint.value === 'hint.click') moveHint.value = 'hint.keys'
    })
    onFlushRequest(() => persist(['core', 'agents', 'progress', 'meta'], true))
    effect(() => {
      const active = isGameplayActive.value
      if (!this.mg) return
      if (active) this.mg.resume()
      else this.mg.pause()
    })
    effect(() => {
      const hidden = pageHidden.value
      if (hidden) this.hiddenAt = now()
      else if (this.hiddenAt) {
        this.checkAway(this.hiddenAt)
        this.hiddenAt = 0
      }
    })

    this.world.syncAreas(state)
    this.world.syncRooms(state)
    this.world.syncCounter(state.counter)
    this.world.syncSecretDoor(state.counter, false)
    this.pads.sync(state)
    if (state.welcome > 0) {
      this.welcomeLabel = this.labels.add('pop-static', LAYOUT.welcomeSpot.x, 0.9, LAYOUT.welcomeSpot.z, 'welcome-cash')
      this.welcomeLabel.el.textContent = `+${state.welcome}`
    }
    // returning players start in the corridor, new players right next to the first cash
    if (state.stats.playSeconds > 0 && state.counter) {
      this.player.x = 0
      this.player.z = 4.6
    }
    this.cam.snap(this.player.x, this.player.z)
    while (this.minuteIdx < MINUTE_MARKS.length && state.stats.playSeconds >= MINUTE_MARKS[this.minuteIdx]! * 60) this.minuteIdx++
  }

  resize(w: number, h: number): void {
    this.w = w
    this.h = h
    this.cam.resize(w, h)
    this.mg?.resize(w, h)
  }

  /** On boot: offline earnings since the last session, keyboard focus, move hint. */
  start(): void {
    const away = DEBUG ? Number((window as unknown as { __spylabAwayOverride?: number }).__spylabAwayOverride) : 0
    const since = away > 0 ? now() - away * 1000 : state.lastSeen
    if (since > 0) this.checkAway(since)
    this.updateCoach()
    blockInterstitials('tutorial', tutorialActive(state))
    // iframe portals often keep the keyboard: grab focus, and say so while we do not have it
    try {
      window.focus()
    } catch {
      /* ignore */
    }
    const coarse = matchMedia('(pointer: coarse)').matches
    moveHint.value = state.stats.playSeconds > 30 ? null : coarse ? 'hint.drag' : document.hasFocus() ? 'hint.keys' : 'hint.click'
    track('first_frame')
  }

  checkAway(since: number): void {
    const secs = elapsedSince(since, ECONOMY.offline.capSeconds)
    if (secs < ECONOMY.offline.minAwaySeconds) return
    const amount = offlineEarnings(state, secs)
    if (amount > 0) queuePopup({ kind: 'welcome', amount, seconds: Math.round(secs) })
  }

  // ---------------------------------------------------------------- frame
  frame(dt: number): void {
    const active = isGameplayActive.value
    if (active) {
      // fixed 60 Hz simulation (accumulator, clamped)
      this.acc += dt
      let n = 0
      while (this.acc >= SIM_DT && n < MAX_STEPS) {
        tick(state, SIM_DT, this.heroIn, this.ev)
        this.acc -= SIM_DT
        n++
      }
      if (n >= MAX_STEPS) this.acc = 0
    }
    const showWorld = this.mode === 'academy'
    if (this.labels.root.hidden === showWorld) this.labels.root.hidden = !showWorld
    if (this.mode === 'minigame' && this.mg) {
      if (active) this.mg.update(Math.min(dt, 1 / 15))
      this.renderer.render(this.mg.scene, this.mg.camera)
    } else {
      this.academyFrame(active ? dt : 0)
      this.renderer.render(this.world.scene, this.cam.camera)
    }
    publish()
    this.revTimer += dt
    if (this.revTimer > 0.25) {
      this.revTimer = 0
      if (panel.value) bump()
      this.pads.sync(state)
      const finished = advanceTutorial(state)
      if (finished.length) this.onTutorialStep(finished)
      if (!panel.value && state.pending.length && !missionUi.value) queuePopup({ kind: 'graduate' })
      while (this.minuteIdx < MINUTE_MARKS.length && state.stats.playSeconds >= MINUTE_MARKS[this.minuteIdx]! * 60) {
        track('minute_mark', { minute: MINUTE_MARKS[this.minuteIdx]! })
        this.minuteIdx++
      }
    }
    this.saveDirtyTimer += dt
    if (this.saveDirtyTimer > 15) {
      this.saveDirtyTimer = 0
      persist(['core', 'meta'])
    }
  }

  private academyFrame(dt: number): void {
    const modal = panel.value !== null
    this.input.enabled = !modal
    this.input.update()
    if (this.input.active && moveHint.value) moveHint.value = null
    const steps = Math.max(1, Math.ceil(dt / (1 / 30)))
    for (let i = 0; i < steps; i++) this.player.update(dt / steps, this.input.move.x, this.input.move.y, this.world.colliders)
    this.cam.follow(this.player.x, this.player.z, dt || 0.016)
    this.world.followShadow(this.cam.target.x, this.cam.target.z)
    this.cadets.camX = this.cam.target.x
    this.cadets.camZ = this.cam.target.z
    this.cadets.sync(state, dt)
    this.cadets.syncStaff(state, dt)
    this.traffic.update(state, dt)
    this.world.updateFx(dt, state)
    this.piles.sync(state)
    this.piles.update(dt, this.player.x, this.player.z)
    this.pads.update(dt)
    this.player.setCarry(state.carry.n, ROOM_KIT_COLOR[state.carry.room ?? 'vault'] ?? 0xf2b134)
    this.interact(dt)
    if (state.welcome <= 0 && this.welcomeLabel) {
      this.labels.remove(this.welcomeLabel)
      this.welcomeLabel = null
    }
    this.updateServe()
    this.updateGuide(dt)
    this.labels.update(this.cam, this.w, this.h)
  }

  private interact(dt: number): void {
    const P = this.player
    const E = ECONOMY
    // sign-up desk: standing behind the counter serves the queue
    this.heroIn.atCounter = state.counter && P.near(LAYOUT.serveSpot.x, LAYOUT.serveSpot.z, 0.95)
    if (dt <= 0) return
    // opening cash pile
    if (state.welcome > 0 && P.near(LAYOUT.welcomeSpot.x, LAYOUT.welcomeSpot.z, E.player.collectRadius)) {
      const got = collectWelcome(state)
      if (got) this.cashFeedback(got, LAYOUT.welcomeSpot)
      if (this.welcomeLabel) this.labels.remove(this.welcomeLabel)
      this.welcomeLabel = null
    }
    // cash piles
    for (const id of ROOM_ORDER) {
      const r = state.rooms[id]
      if (!r.unlocked || r.stack < 1 || ROOMS[id].kind !== 'training') continue
      const c = cashSpotOf(id)
      if (P.near(c.x, c.z, E.player.collectRadius)) {
        const got = collect(state, id)
        if (got > 0) {
          this.piles.burst(id, Math.ceil(got / Math.max(1, r.level * ROOMS[id].baseIncome)))
          this.cashFeedback(got, { x: P.x, z: P.z })
        }
      }
    }
    // kits: pick at the crate, drop at stations
    this.kitT += dt
    for (const id of trainingRooms(state)) {
      const r = state.rooms[id]
      if (r.crate) {
        const k = crateOf(id)
        if (P.near(k.x, k.z, E.player.crateRadius) && this.kitT >= E.supply.pickSeconds) {
          if (pickKits(state, id, 1)) {
            this.kitT = 0
            AudioManager.play('ui_click', 1.3)
          }
        }
      }
      if (state.carry.room === id && state.carry.n > 0) {
        for (let i = 0; i < r.stations; i++) {
          const sp = slotOf(id, i)
          if (P.near(sp.x, sp.z - 0.4, E.player.stationRadius) && this.kitT >= E.supply.dropSeconds) {
            if (dropKits(state, id, i, 1)) {
              this.kitT = 0
              AudioManager.play('upgrade', 1.4)
              persist(['core'])
            }
          }
        }
      }
    }
    // pads
    const pad = this.pads.under(P.x, P.z)
    if (!pad) {
      this.padOpened = null
      return
    }
    if (pad.target) {
      // after a purchase the hero must step off before the next pad on the same spot takes money
      if (this.padOpened === 'just-built') return
      const price = padPrice(state, pad.target)
      if (!price) return
      const rate = Math.max(1, price.cost / padFillSeconds(price.cost))
      const paid = payPad(state, pad.target, Math.ceil(rate * dt), this.ev)
      if (paid > 0) {
        this.padSound -= dt
        if (this.padSound <= 0) {
          AudioManager.play('coin', 1.2)
          this.padSound = 0.12
        }
      }
      return
    }
    const key = `${pad.kind}:${pad.room}`
    if (this.padOpened !== key && !panel.value) this.openPad(pad, key)
  }

  private updateServe(): void {
    const l = this.serveLabel
    const serving = this.heroIn.atCounter || state.clerk
    const waiting = state.cadets.some((c) => c.phase === 'queue')
    l.visible = state.counter && waiting && state.serveT > 0.01 && serving
    if (l.visible) {
      const share = Math.min(1, state.serveT / (this.heroIn.atCounter ? ECONOMY.serveSeconds * 0.6 : ECONOMY.clerkServeSeconds))
      l.el.innerHTML = `<div class="serve-bar"><div style="width:${Math.round(share * 100)}%"></div></div>`
    }
  }

  private openPad(pad: Pad, key: string): void {
    this.padOpened = key
    AudioManager.play('ui_click')
    if (pad.kind === 'missions') panel.value = { kind: 'missions' }
    else if (pad.kind === 'upgrade' && pad.room) panel.value = { kind: 'upgrade', room: pad.room }
  }

  /** Quick tap: explain what is under the finger (5 s card, game keeps running). */
  private tapWorld(cx: number, cy: number): void {
    if (this.mode !== 'academy' || panel.value) return
    const p = this.cam.groundAt(cx, cy, this.canvas)
    if (!p) return
    const cands: { key: string; x: number; z: number; room?: RoomId }[] = []
    if (state.counter) cands.push({ key: 'info.counter', ...LAYOUT.counter })
    for (const id of trainingRooms(state)) {
      if (state.rooms[id].crate) cands.push({ key: 'info.crate', ...crateOf(id), room: id })
      for (let i = 0; i < state.rooms[id].stations; i++) cands.push({ key: 'info.station', ...slotOf(id, i), room: id })
      if (state.rooms[id].stations > 0) cands.push({ key: 'info.desk', ...upgradeSpotOf(id), room: id })
      cands.push({ key: 'info.cash', ...cashSpotOf(id), room: id })
    }
    cands.push({ key: 'info.missions', ...padOf('mission_control') })
    let best: (typeof cands)[number] | null = null
    let bd = 1.6
    for (const c of cands) {
      const d = Math.hypot(c.x - p.x, c.z - p.z)
      if (d < bd) {
        bd = d
        best = c
      }
    }
    if (!best) return
    const card = { key: best.key, room: best.room ?? null }
    infoCard.value = card
    track('info_tap', { what: best.key })
    setTimeout(() => {
      if (infoCard.value === card) infoCard.value = null
    }, 5000)
  }

  // ---------------------------------------------------------------- feedback
  private cashFeedback(amount: number, at: { x: number; z: number }): void {
    AudioManager.play('coin', 0.95 + Math.random() * 0.1)
    this.popText(at, `+${formatNumber(amount, lang.value)}`, 'cash')
    this.flyCoins()
    try {
      navigator.vibrate?.(15)
    } catch {
      /* no haptics */
    }
    persist(['core', 'meta'])
  }

  private popText(at: { x: number; z: number }, text: string, cls: string): void {
    const l: WorldLabel = this.labels.add(`pop pop-${cls}`, at.x, 2, at.z)
    l.el.textContent = text
    setTimeout(() => this.labels.remove(l), 900)
  }

  private flyCoins(): void {
    const target = document.querySelector('[data-testid="hud-cash"]')?.getBoundingClientRect()
    if (!target) return
    const from = this.cam.project(this.player.x, 1.4, this.player.z, this.w, this.h)
    const r = this.canvas.getBoundingClientRect()
    for (let i = 0; i < 4; i++) {
      const el = document.createElement('div')
      el.className = 'coin-fly'
      el.style.transform = `translate(${r.left + from.x + (Math.random() - 0.5) * 30}px, ${r.top + from.y}px)`
      document.getElementById('ui')?.appendChild(el)
      setTimeout(() => {
        el.style.transitionDelay = `${i * 50}ms`
        el.style.transform = `translate(${target.left + 14}px, ${target.top + 8}px) scale(0.6)`
        el.style.opacity = '0.4'
      }, 16)
      setTimeout(() => el.remove(), 700 + i * 50)
    }
  }

  // ---------------------------------------------------------------- tutorial
  private onTutorialStep(ids: string[]): void {
    for (const id of ids) {
      track('tutorial_step', { step: id })
      state.flags[`tut_${id}`] = true
    }
    if (!tutorialActive(state)) {
      track('tutorial_completed')
      blockInterstitials('tutorial', false)
    }
    persist(['meta'])
    this.updateCoach()
  }

  private updateCoach(): void {
    coachLine.value = tutorialActive(state) ? (TUTORIAL[state.tutorial]?.line ?? null) : null
  }

  /** Current objective: the tutorial target, else the next room unlock the player can pay for. */
  private objectiveTarget(): { x: number; z: number } | null {
    if (tutorialActive(state)) return TUTORIAL[state.tutorial]?.target(state) ?? null
    const next = nextUnlock(state)
    if (next && canUnlock(state, next) && state.cash >= ROOMS[next].unlockCost - state.rooms[next].paid) return padOf(next)
    return null
  }

  private updateGuide(dt: number): void {
    const show = !panel.value && this.mode === 'academy'
    const target = show ? this.objectiveTarget() : null
    // standing on the target: no pointer needed
    const here = target && this.player.near(target.x, target.z, 1.2)
    this.guide.update(dt, here ? null : target, this.cam, this.w, this.h)
  }

  // ---------------------------------------------------------------- office actions (UI)
  upgrade(room: RoomId, what: 'level' | 'speed'): boolean {
    const ok = what === 'level' ? upgradeLevel(state, room, this.ev) : buySpeed(state, room, this.ev)
    if (ok) {
      AudioManager.play('upgrade')
      const lv = state.rooms[room].level
      if (what === 'level' && ECONOMY.milestones.includes(lv as never)) {
        track('room_milestone', { room_id: room, level: lv })
        showToast('toast.milestone')
      }
      persist(['core', 'meta'])
      bump()
    }
    return ok
  }

  /** Graduation card: keep the agent or loan them out for the fee. */
  resolveGraduate(keep: boolean): void {
    const r = resolveGraduate(state, keep)
    if (r === 'loaned') AudioManager.play('coin')
    persist(['core', 'agents', 'meta'], true)
  }

  // ---------------------------------------------------------------- missions
  canStart(id: string): boolean {
    const m = missionById(id)
    return !!m && missionLock(state, m) === 'ok'
  }

  async startMission(id: string): Promise<void> {
    const m = missionById(id)
    if (!m || missionLock(state, m) !== 'ok') return
    this.mission = m
    this.agent = bestAgent(state, m)
    this.revivedThisAttempt = false
    panel.value = null
    beginFlow()
    blockInterstitials('mission', true)
    await this.launchMinigame()
  }

  private async launchMinigame(): Promise<void> {
    const m = this.mission
    if (!m) return
    this.mg?.dispose()
    const mg: Minigame = new SafeCracker()
    const skill = ROOMS[m.room].skill ?? 'finesse'
    const firstKey = `played_${m.minigame}`
    await mg.init(
      { renderer: this.renderer, width: this.w, height: this.h, firstTime: !state.flags[firstKey] },
      this.tierOverride ?? m.tier,
      { agentSkill: this.agent?.skills[skill] ?? 0 },
    )
    mg.onResult = (r) => this.onResult(r)
    this.mg = mg
    this.mode = 'minigame'
    this.input.enabled = false
    missionUi.value = { phase: 'playing', mission: m.id }
    platform.sendMessage('level_started', { world: m.region, level: m.id })
    AudioManager.playMusic('music_mission')
    mg.start()
  }

  minigameAction(): void {
    if (this.mode === 'minigame' && missionUi.value?.phase === 'playing' && !userPaused.value) this.mg?.action()
  }

  private onResult(r: MinigameResult): void {
    const m = this.mission
    if (!m) return
    state.flags[`played_${m.minigame}`] = true
    if (r.success) {
      const reward = missionReward(state, m, r.stars)
      recordWin(state, m, r.stars, reward, this.agent, this.ev)
      this.lastReward = reward
      platform.sendMessage('level_completed', { world: m.region, level: m.id })
      AudioManager.playJingle('jingle_win')
      missionUi.value = {
        phase: 'result', mission: m.id, stars: r.stars, cash: reward.cash, intel: reward.intel,
        doubled: false, freeDouble: !state.flags.firstDoubleFree,
      }
      persist(['core', 'agents', 'progress', 'meta'], true)
    } else {
      recordFail(state, m)
      platform.sendMessage('level_failed', { world: m.region, level: m.id })
      AudioManager.playJingle('jingle_fail')
      AudioManager.play('alarm')
      missionUi.value = {
        phase: 'fail', mission: m.id, reason: r.reason ?? 'alarm',
        canRevive: !this.revivedThisAttempt && rewardedSupported(),
      }
      persist(['progress', 'meta'])
    }
  }

  async doubleReward(): Promise<void> {
    const ui = missionUi.value
    if (!ui || ui.phase !== 'result' || ui.doubled) return
    if (ui.freeDouble) {
      state.flags.firstDoubleFree = true
    } else {
      const res = await showRewarded('mission_double')
      if (res !== 'rewarded') {
        if (res === 'failed') showToast('toast.noAd')
        return
      }
    }
    state.cash += this.lastReward.cash
    state.intel += this.lastReward.intel
    state.stats.earned += this.lastReward.cash
    AudioManager.play('coin')
    missionUi.value = { ...ui, doubled: true, cash: ui.cash * 2, intel: ui.intel * 2 }
    persist(['core', 'meta'], true)
  }

  async revive(): Promise<void> {
    const ui = missionUi.value
    if (!ui || ui.phase !== 'fail' || !ui.canRevive || this.revivedThisAttempt) return
    const res = await showRewarded('mission_revive')
    if (res !== 'rewarded') {
      if (res === 'failed') showToast('toast.noAd')
      return
    }
    this.revivedThisAttempt = true
    missionUi.value = { phase: 'playing', mission: ui.mission }
    this.mg?.revive()
  }

  async retry(): Promise<void> {
    this.revivedThisAttempt = false
    await this.launchMinigame()
  }

  /** Continue from result / give up from fail: back to the academy (natural pause). */
  endMission(): void {
    this.mg?.dispose()
    this.mg = null
    this.mission = null
    this.mode = 'academy'
    missionUi.value = null
    this.input.enabled = true
    blockInterstitials('mission', false)
    AudioManager.playMusic('music_academy')
    showInterstitial('mission_end')
    nextPopup()
  }

  // ---------------------------------------------------------------- popups
  collectWelcome(amount: number, doubled: boolean): void {
    const total = doubled ? amount * 2 : amount
    state.cash += total
    state.stats.earned += total
    AudioManager.play('coin')
    persist(['core', 'meta'], true)
  }

  closePanel(p: Panel | null): void {
    panel.value = null
    if (p?.kind === 'levelup') showInterstitial('level_up')
    if (!nextPopup()) bump()
  }

  /** Quality tier: real shadows on mid/high, blob shadows on low. */
  applyQuality(tier: 'low' | 'mid' | 'high'): void {
    const shadows = tier !== 'low'
    this.renderer.shadowMap.enabled = shadows
    this.renderer.shadowMap.type = PCFShadowMap
    this.world.setShadows(shadows)
    this.world.sun.shadow.mapSize.setScalar(tier === 'high' ? 2048 : 1024)
    this.world.sun.shadow.map?.dispose()
    this.world.sun.shadow.map = null
    Character.blobs = !shadows
    flatMat.needsUpdate = true
    charMaterial.needsUpdate = true
  }

  /** Debug: teleport the player. */
  teleport(x: number, z: number): void {
    this.player.x = x
    this.player.z = z
    this.cam.snap(x, z)
  }

  get minigame(): Minigame | null {
    return this.mg
  }
}
