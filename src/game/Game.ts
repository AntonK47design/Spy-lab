/**
 * Game controller: runs the sim, drives the academy view, routes input, hosts the
 * mission flow (briefing -> minigame -> result) and owns every ad call site.
 */
import { ConeGeometry, Mesh, MeshBasicMaterial, type WebGLRenderer } from 'three'
import { World } from '../academy/World'
import { Player } from '../academy/Player'
import { CadetViews } from '../academy/CadetViews'
import { CashPiles } from '../academy/CashPiles'
import { Pads, type Pad } from '../academy/Pads'
import { WorldLabels, type WorldLabel } from '../academy/WorldLabels'
import { FollowCamera } from '../academy/FollowCamera'
import { Input } from '../input/Input'
import { ECONOMY } from '../config/economy'
import { ROOMS, ROOM_ORDER, cashSpotOf, type RoomId } from '../config/rooms'
import { missionById, type MissionDef } from '../config/missions'
import {
  tick, collect, payPad, upgradeLevel, buySlot, buySpeed, hireInstructor, offlineEarnings, type SimEvents,
} from '../sim/academy'
import { bestAgent, missionLock, missionReward, recordFail, recordWin } from '../sim/missions'
import type { Agent } from '../sim/state'
import { state, publish, persist, bump } from './store'
import { TUTORIAL, advanceTutorial, tutorialActive } from './tutorial'
import { isGameplayActive, onFlushRequest, pageHidden, userPaused } from '../core/lifecycle'
import { effect } from '@preact/signals-core'
import { elapsedSince, now } from '../core/time'
import { AudioManager } from '../audio/AudioManager'
import { platform } from '../platform/bridge'
import { beginFlow, blockInterstitials, rewardedSupported, showInterstitial, showRewarded } from '../platform/ads'
import { track } from '../analytics/telemetry'
import { SafeCracker } from '../minigames/safe/SafeCracker'
import type { Minigame, MinigameResult } from '../minigames/Minigame'
import {
  coachLine, missionUi, nextPopup, panel, queuePopup, showToast, type Panel,
} from '../ui/uiState'
import { formatNumber } from '../core/format'
import { DEBUG } from '../debug/flags'
import { lang } from '../i18n/i18n'

export class Game {
  readonly world = new World()
  readonly player = new Player()
  readonly cam = new FollowCamera()
  readonly input: Input
  readonly labels: WorldLabels
  readonly cadets: CadetViews
  readonly piles: CashPiles
  readonly pads: Pads
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
  private revTimer = 0
  private saveDirtyTimer = 0
  private guide: Mesh
  private guideEdge: HTMLDivElement
  private hiddenAt = 0
  private w = 1
  private h = 1
  private ev: SimEvents

  constructor(
    private renderer: WebGLRenderer,
    private canvas: HTMLCanvasElement,
    uiLayer: HTMLElement,
  ) {
    this.labels = new WorldLabels(uiLayer)
    this.input = new Input(canvas, uiLayer)
    this.cadets = new CadetViews(this.world.dynamic)
    this.piles = new CashPiles(this.world.dynamic)
    this.pads = new Pads(this.world.dynamic, this.labels)
    this.world.dynamic.add(this.player.char.root)
    this.guide = new Mesh(new ConeGeometry(0.35, 0.8, 4).rotateX(Math.PI), new MeshBasicMaterial({ color: 0xf2b134 }))
    this.guide.visible = false
    this.world.dynamic.add(this.guide)
    this.guideEdge = document.createElement('div')
    this.guideEdge.className = 'guide-edge'
    uiLayer.appendChild(this.guideEdge)

    this.ev = {
      cycle: (room, amount, auto) => {
        if (auto && this.mode === 'academy') this.popText(cashSpotOf(room), `+${formatNumber(amount, lang.value)}`, 'auto')
      },
      graduate: (_c, agent, bonus) => {
        AudioManager.play('level_up')
        if (agent) {
          track('agent_graduated', { rarity: agent.rarity })
          queuePopup({ kind: 'agent', agentId: agent.id })
        } else if (bonus > 0) showToast('toast.rosterFull')
        persist(['core', 'agents', 'meta'])
      },
      levelUp: (level) => {
        track('academy_level_up', { level })
        queuePopup({ kind: 'levelup', level })
        this.pads.sync(state)
        persist(['core', 'meta'])
      },
      unlock: (room) => {
        track('room_unlocked', { room_id: room })
        AudioManager.play('unlock')
        showToast(`unlocked.${room}`)
        this.world.syncRooms(state)
        this.pads.sync(state)
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
    })
    onFlushRequest(() => persist(['core', 'agents', 'progress', 'meta'], true))
    // Platform pause / user pause also pauses the running minigame + reports it
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

    this.world.syncRooms(state)
    this.pads.sync(state)
    this.player.x = Math.min(this.player.x, 3)
    this.cam.snap(this.player.x, this.player.z)
  }

  resize(w: number, h: number): void {
    this.w = w
    this.h = h
    this.cam.resize(w, h)
    this.mg?.resize(w, h)
  }

  /** On boot: offline earnings since the last session. */
  start(): void {
    // QA hook (debug builds only): pretend the last session ended N seconds ago
    const away = DEBUG ? Number((window as unknown as { __spylabAwayOverride?: number }).__spylabAwayOverride) : 0
    const since = away > 0 ? now() - away * 1000 : state.lastSeen
    if (since > 0) this.checkAway(since)
    this.updateCoach()
    blockInterstitials('tutorial', tutorialActive(state))
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
    if (active) tick(state, dt, this.ev)
    const showWorld = this.mode === 'academy'
    if (this.labels.root.hidden === showWorld) this.labels.root.hidden = !showWorld
    if (this.mode === 'minigame' && this.mg) {
      // minigames slow down instead of skipping on very low frame rates (fairness)
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
    }
    // periodic soft save of stacks/cadet timers (the save module throttles real writes)
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
    // sub-step movement so long frames never tunnel through walls
    const steps = Math.max(1, Math.ceil(dt / (1 / 30)))
    for (let i = 0; i < steps; i++) this.player.update(dt / steps, this.input.move.x, this.input.move.y, this.world.colliders)
    this.cam.follow(this.player.x, this.player.z, dt || 0.016)
    this.cadets.sync(state, dt)
    this.piles.sync(state)
    this.piles.update(dt, this.player.x, this.player.z)
    this.pads.update(dt)
    if (dt > 0) this.interact(dt)
    this.updateGuide(dt)
    this.labels.update(this.cam, this.w, this.h)
  }

  private interact(dt: number): void {
    // collect cash stacks
    for (const id of ROOM_ORDER) {
      const r = state.rooms[id]
      if (!r.unlocked || r.stack < 1 || ROOMS[id].kind !== 'training') continue
      const c = cashSpotOf(id)
      if (this.player.near(c.x, c.z, ECONOMY.player.collectRadius)) {
        const got = collect(state, id)
        if (got > 0) {
          this.piles.burst(id, Math.ceil(got / Math.max(1, r.level * ROOMS[id].baseIncome)))
          AudioManager.play('coin', 0.95 + Math.random() * 0.1)
          this.popText({ x: this.player.x, z: this.player.z }, `+${formatNumber(got, lang.value)}`, 'cash')
          this.flyCoins()
          persist(['core', 'meta'])
        }
      }
    }
    // pads
    const pad = this.pads.under(this.player.x, this.player.z)
    if (!pad) {
      this.padOpened = null
      return
    }
    if (pad.kind === 'unlock' && pad.active) {
      const cost = ROOMS[pad.room].unlockCost
      const rate = Math.max(1, cost / ECONOMY.player.padFillSeconds)
      const paid = payPad(state, pad.room, Math.ceil(rate * dt), this.ev)
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

  private openPad(pad: Pad, key: string): void {
    this.padOpened = key
    AudioManager.play('ui_click')
    if (pad.kind === 'missions') panel.value = { kind: 'missions' }
    else if (pad.kind === 'upgrade') panel.value = { kind: 'upgrade', room: pad.room }
  }

  private tapWorld(cx: number, cy: number): void {
    if (this.mode !== 'academy' || panel.value) return
    const p = this.cam.groundAt(cx, cy, this.canvas)
    if (!p) return
    for (const id of ROOM_ORDER) {
      const r = ROOMS[id].rect
      if (!state.rooms[id].unlocked) continue
      if (Math.abs(p.x - r.x) <= r.w / 2 && Math.abs(p.z - r.z) <= r.d / 2) {
        AudioManager.play('ui_click')
        panel.value = id === 'mission_control' ? { kind: 'missions' } : { kind: 'upgrade', room: id }
        return
      }
    }
  }

  // ---------------------------------------------------------------- feedback
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
    for (const id of ids) track('tutorial_step', { step: id })
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

  private updateGuide(dt: number): void {
    const step = tutorialActive(state) ? TUTORIAL[state.tutorial] : undefined
    const target = step?.target(state) ?? null
    const show = !!target && !panel.value && this.mode === 'academy'
    this.guide.visible = show
    if (!show || !target) {
      this.guideEdge.style.display = 'none'
      return
    }
    this.guide.position.set(target.x, 2.1 + Math.sin(performance.now() / 220) * 0.2, target.z)
    this.guide.rotation.y += dt * 2
    const p = this.cam.project(target.x, 0.5, target.z, this.w, this.h)
    const m = 40
    const off = p.x < m || p.x > this.w - m || p.y < m * 2 || p.y > this.h - m * 2
    if (!off) {
      this.guideEdge.style.display = 'none'
      return
    }
    const cx = this.w / 2
    const cy = this.h / 2
    const ang = Math.atan2(p.y - cy, p.x - cx)
    const ex = Math.max(m, Math.min(this.w - m, cx + Math.cos(ang) * this.w))
    const ey = Math.max(m * 2, Math.min(this.h - m * 2, cy + Math.sin(ang) * this.h))
    this.guideEdge.style.display = 'block'
    this.guideEdge.style.transform = `translate(${ex}px, ${ey}px) translate(-50%, -50%) rotate(${ang}rad)`
  }

  // ---------------------------------------------------------------- room actions (UI)
  upgrade(room: RoomId, what: 'level' | 'slot' | 'speed' | 'instructor'): boolean {
    const fn = { level: upgradeLevel, slot: buySlot, speed: buySpeed, instructor: hireInstructor }[what]
    const ok = fn(state, room, this.ev)
    if (ok) {
      AudioManager.play('upgrade')
      if (what === 'slot') this.world.syncRooms(state)
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
