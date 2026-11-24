/**
 * Game controller: fixed 60 Hz sim, academy view, hero interactions (serve, carry kits,
 * collect, pads), mission flow (briefing -> minigame -> result) and every ad call site.
 */
import { Color, CylinderGeometry, Group, Mesh, PCFShadowMap, type Object3D, type WebGLRenderer } from 'three'
import { StaticBatch } from '../render/geometry'
import { PAL } from '../render/palette'
import { GuideArrow } from '../academy/GuideArrow'
import { NavGrid, type P as NavP } from '../academy/NavGrid'
import { GuideTrail } from '../academy/GuideTrail'
import { GUIDE_TRAIL } from '../config/layout'
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
import { Ferry } from '../academy/Ferry'
import { Input } from '../input/Input'
import { flatMat } from '../render/materials'
import { charMaterial } from '../render/assets'
import { ECONOMY, padFillSeconds } from '../config/economy'
import { LAYOUT, OFFICE, ROOMS, TEASER, ROOM_ORDER, cashSpotOf, crateOf, padOf, slotOf, upgradeSpotOf, type RoomId } from '../config/rooms'
import { BOSSES, MISSIONS, REGION_LOOK, missionById, type MissionDef } from '../config/missions'
import { VAULT_BONUS } from '../config/minigames'
import { INTERSTITIAL_RULES, OFFERS } from '../config/ads'
import { gadgetFor, type GadgetId } from '../config/gadgets'
import { craftGadget, rushGadget, takeGadget, tickGadgets } from '../sim/gadgets'
import { relocate } from '../sim/prestige'
import { guideGoal } from '../sim/guide'
import { LEADERBOARD_ID } from '../config/prestige'
import { openSupply, vipRecruit } from '../sim/offers'
import { claimAchievement, claimContract, claimDaily, dailyIndex, ensureContracts } from '../sim/meta'
import { collectFieldOp, finishFieldOp, resolveMission, startFieldOp, tickAlert } from '../sim/ops'
import {
  tick, collect, collectWelcome, payPad, padPrice, pickKits, dropKits, resolveGraduate, buySpeed, upgradeLevel,
  offlineEarnings, trainingRooms, nextUnlock, canUnlock, officeAct, autoSellWeak, type SimEvents, type HeroInput,
} from '../sim/academy'
import { bestAgent, missionLock, missionReward, recordFail, recordWin } from '../sim/missions'
import type { Agent } from '../sim/state'
import { state, publish, persist, bump } from './store'
import { TUTORIAL, advanceTutorial, tutorialActive } from './tutorial'
import { isGameplayActive, onFlushRequest, pageHidden, userPaused } from '../core/lifecycle'
import { elapsedSince, now } from '../core/time'
import { AudioManager } from '../audio/AudioManager'
import { leaderboards, platform } from '../platform/bridge'
import { beginFlow, blockInterstitials, rewardedSupported, showInterstitial, showRewarded } from '../platform/ads'
import { checkMilestones, track } from '../analytics/telemetry'
import { SafeCracker } from '../minigames/safe/SafeCracker'
import { LaserHall } from '../minigames/laser/LaserHall'
import { SpotTheMole } from '../minigames/mole/SpotTheMole'
import { ScooterPursuit } from '../minigames/scooter/ScooterPursuit'
import { CircuitHack } from '../minigames/circuit/CircuitHack'
import { BossCutscene } from '../minigames/BossCutscene'
import { CodeBreaker } from '../minigames/code/CodeBreaker'
import type { Minigame, MinigameResult } from '../minigames/Minigame'
import { coachLine, coachNeed, infoCard, missionUi, moveHint, nextPopup, panel, queuePopup, popupQueue, hudTick, showToast, vaultLoot, briefingGadget, liveOffers, type Panel } from '../ui/uiState'
import { formatNumber } from '../core/format'
import { DEBUG } from '../debug/flags'
import { lang, t } from '../i18n/i18n'

/** After a purchase, the next pad under the hero starts taking money after this pause. */
/** Pad labels further away than this (m) fade out, except the arrow's target. */
const LABEL_RADIUS = 9
const PAD_REARM_MS = 1500
/** Mission Control re-opens for a player who stays on it while a new mission waits. */
const PAD_REOPEN_MS = 2500
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
  private ferry: Ferry
  mode: 'academy' | 'minigame' = 'academy'
  /** Debug: force a difficulty tier for the next missions. */
  tierOverride: number | null = null
  private mg: Minigame | null = null
  private mission: MissionDef | null = null
  private agent: Agent | null = null
  private revivedThisAttempt = false
  private lastReward = { cash: 0, intel: 0 }
  /** Boss missions: current stage, stars and intel collected in earlier stages. */
  private stage = 0
  private stageStars: number[] = []
  private stageIntel = 0
  private padOpened: string | null = null
  private padSound = 0
  private kitT = 0
  private acc = 0
  private revTimer = 0
  private builtAt = 0
  private panelClosedAt = 0
  private saveDirtyTimer = 0
  private guide: GuideArrow
  /** Walkable grid + floor trail: while the arrow's target is behind a wall, chevrons show the way through the doors. */
  private nav = new NavGrid()
  private trail: GuideTrail
  private navT = 0
  private navFor: NavP | null = null
  private navRoute: NavP[] | null = null
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
    this.ferry = new Ferry(world.dynamic, this.labels)
    this.traffic = new Traffic(world.dynamic, { taxi: world.propGeo('taxi'), sedan: world.propGeo('sedan'), wagon: world.propGeo('wagon') })
    world.dynamic.add(this.player.char.root)
    this.guide = new GuideArrow(world.dynamic, uiLayer)
    this.trail = new GuideTrail(world.dynamic)
    this.serveLabel = this.labels.add('serve', LAYOUT.serveSpot.x, 2.4, LAYOUT.serveSpot.z, 'serve-progress')
    this.teaserLabel = this.labels.add('pad pad-soon', TEASER.x, 1.9, TEASER.z - 2.6, 'teaser')

    this.ev = {
      cycle: (room, amount, auto) => {
        if (auto && this.mode === 'academy') this.popText(cashSpotOf(room), `+${formatNumber(amount, lang.value)}`, 'auto')
      },
      served: () => {
        // only when the hero stamps the check-in himself; the receptionist works silently
        if (this.heroIn.atCounter) AudioManager.play('stamp')
        persist(['core', 'meta'])
      },
      graduate: (c, agent) => {
        if (c.room) this.cadets.graduated(c.id, agent.id, c.room, c.slot)
        // background event: only rare+ graduates get a jingle (commons graduate constantly)
        if (agent.rarity !== 'common') AudioManager.play('level_up')
        track('agent_graduated', { rarity: agent.rarity })
        // no pop-up: graduates walk to the agency office; only rare+ ones get a short notice
        if (agent.rarity !== 'common') showToast(`grad.toast.${agent.rarity}`)
        this.pads.sync(state)
        persist(['core', 'agents', 'meta'])
      },
      clerkCollect: (room, cash) => {
        if (this.mode === 'academy') this.popText(cashSpotOf(room), `+${formatNumber(cash, lang.value)}`, 'auto')
      },
      autoSold: (cash) => {
        if (this.mode === 'academy') this.popText(OFFICE.laptopPad, `+${formatNumber(cash, lang.value)}`, 'auto')
        this.pads.sync(state)
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
        this.builtAt = performance.now()
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
    const KEY_DIR: Record<string, 'fwd' | 'back' | 'left' | 'right'> = {
      ArrowUp: 'fwd', KeyW: 'fwd', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    }
    window.addEventListener('keydown', (e) => {
      if (this.mode !== 'minigame' || e.repeat) return
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        this.minigameAction()
      } else if (KEY_DIR[e.code] && this.mg?.move && this.canPlay()) {
        e.preventDefault()
        this.mg.move(KEY_DIR[e.code]!)
      } else if (this.mg?.input && this.canPlay()) {
        // Code Breaker keypad: 1-7 (row or numpad), Backspace
        const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)
        if (m) {
          e.preventDefault()
          this.mg.input('sym', Number(m[1]) - 1)
        } else if (e.code === 'Backspace') {
          e.preventDefault()
          this.mg.input('del')
        }
      }
    })
    // minigames with a figure (Laser Hall): tap toward a direction or swipe; others: tap = action
    let downAt: { x: number; y: number } | null = null
    canvas.addEventListener('pointerdown', (e) => {
      if (this.mode === 'minigame' && e.isPrimary) {
        if (this.mg?.pointer) downAt = { x: e.clientX, y: e.clientY }
        else if (!this.mg?.input) this.minigameAction() // keypad minigames: only the keypad submits
      }
      window.focus()
      if (moveHint.value === 'hint.click') moveHint.value = 'hint.keys'
    })
    canvas.addEventListener('pointerup', (e) => {
      if (!downAt || this.mode !== 'minigame' || !e.isPrimary) return
      const dx = e.clientX - downAt.x
      const dy = e.clientY - downAt.y
      downAt = null
      if (!this.canPlay()) return
      if (Math.hypot(dx, dy) > 30 && this.mg?.move) {
        if (Math.abs(dx) > Math.abs(dy)) this.mg.move(dx > 0 ? 'right' : 'left')
        else this.mg.move(dy < 0 ? 'fwd' : 'back')
      } else this.mg?.pointer?.(e.clientX, e.clientY)
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

    this.world.setShop(state.prestige)
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
    this.offerDaily()
    if (state.medals > 0) void leaderboards.setScore(LEADERBOARD_ID, state.medals)
    this.updateCoach()
    blockInterstitials('tutorial', tutorialActive(state))
    this.updateAdGate()
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
    if (secs >= ECONOMY.offline.minAwaySeconds) {
      const amount = offlineEarnings(state, secs)
      if (amount > 0) queuePopup({ kind: 'welcome', amount, seconds: Math.round(secs) })
    }
    // a new day: the daily reward comes after the welcome-back popup
    this.offerDaily()
  }

  /** New day: the daily reward pops up (after the tutorial). */
  offerDaily(): void {
    if (state.tutorial >= TUTORIAL.length && dailyIndex(state, now()) >= 0 && panel.value?.kind !== 'daily' && !popupQueue.value.some((p) => p.kind === 'daily')) queuePopup({ kind: 'daily' })
  }

  async claimDaily(double: boolean): Promise<void> {
    if (dailyIndex(state, now()) < 0) return
    if (double) {
      const res = await showRewarded('daily_double')
      if (res !== 'rewarded') {
        if (res === 'failed') showToast('toast.noAd')
        return
      }
    }
    const r = claimDaily(state, now(), double ? 2 : 1)
    if (!r) return
    track('daily_claimed', { day: state.daily.streak })
    AudioManager.play(r.reward.kind === 'cash' ? 'coin' : 'upgrade')
    persist(['core', 'progress', 'meta'], true)
  }

  async freeBadges(): Promise<void> {
    if (now() - state.freeBadgesAt < OFFERS.freeBadgesCooldown * 1000) return
    const res = await showRewarded('free_badges')
    if (res === 'rewarded') {
      state.badges += OFFERS.freeBadges
      state.freeBadgesAt = now()
      AudioManager.play('upgrade')
      persist(['core', 'meta'], true)
    } else if (res === 'failed') showToast('toast.noAd')
  }

  claimContract(i: number): void {
    if (claimContract(state, i)) {
      AudioManager.play('upgrade')
      persist(['core', 'meta'], true)
    }
  }

  claimAchievement(id: string): void {
    if (claimAchievement(state, id)) {
      AudioManager.play('level_up')
      persist(['core', 'meta'], true)
    }
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
      hudTick.value++
      this.pads.sync(state)
      const finished = advanceTutorial(state)
      if (finished.length) this.onTutorialStep(finished)
      else if (!tutorialActive(state) && coachLine.value) this.updateCoach()
      while (this.minuteIdx < MINUTE_MARKS.length && state.stats.playSeconds >= MINUTE_MARKS[this.minuteIdx]! * 60) {
        track('minute_mark', { minute: MINUTE_MARKS[this.minuteIdx]! })
        this.minuteIdx++
      }
      if (checkMilestones(state)) persist(['meta'])
    }
    this.saveDirtyTimer += dt
    if (this.saveDirtyTimer > 15) {
      this.saveDirtyTimer = 0
      persist(['core', 'meta'])
    }
  }

  private teaserLabel: WorldLabel | null = null
  private teaserLang = ''

  private academyFrame(dt: number): void {
    state.incomeBoost = now() < state.boostUntil ? OFFERS.boostMult : 1
    if (ensureContracts(state, now())) persist(['meta'])
    this.updateOffers(dt)
    if (this.teaserLabel && this.teaserLang !== lang.value) {
      this.teaserLang = lang.value
      this.teaserLabel.el.innerHTML = `<div class="pad-title big"><b>${t('soon.title')}</b></div><div class="pad-title dim">${t('soon.text')}</div>`
    }
    // Villain Alert: counts active play time only (dt is 0 while paused)
    const alert = tickAlert(state, dt, now())
    if (alert === 'spawned') {
      showToast('alert.toast')
      AudioManager.play('alarm', 0.9)
      persist(['progress'])
    } else if (alert === 'expired') persist(['progress'])
    // Gadget Lab: a finished craft goes into the stock
    const ready = tickGadgets(state, now())
    if (ready) {
      showToast('lab.ready')
      AudioManager.play('upgrade')
      this.pads.sync(state)
      persist(['progress'])
    }
    const modal = panel.value !== null
    this.input.enabled = !modal
    this.input.update()
    this.applyAutopilot(dt)
    if (this.input.active && moveHint.value) moveHint.value = null
    const ride = this.ferry.update(dt, state.areas.lighthouse, this.player)
    if (ride) {
      // on the ferry deck (or stepping off): no steering, position follows the boat
      this.player.x = ride.x
      this.player.z = ride.z
      this.player.update(dt, 0, 0, [])
    } else {
      const steps = Math.max(1, Math.ceil(dt / (1 / 30)))
      for (let i = 0; i < steps; i++) this.player.update(dt / steps, this.input.move.x, this.input.move.y, this.world.colliders)
    }
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
    // declutter: only pads around the hero (and the arrow's target) show their labels
    const goal = this.mode === 'academy' ? this.objectiveTarget() : null
    this.labels.focus = { x: this.player.x, z: this.player.z, r: LABEL_RADIUS, tx: goal?.x, tz: goal?.z }
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
              AudioManager.play('kit_drop', 0.92 + Math.random() * 0.16)
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
      // after a purchase the next pad on the same spot waits a moment (no accidental double buy),
      // then pours in, so a player who just stays where the arrow pointed is never stuck
      if (this.padOpened === 'just-built') {
        if (performance.now() - this.builtAt < PAD_REARM_MS) return
        this.padOpened = null
      }
      const price = padPrice(state, pad.target)
      if (!price) return
      const rate = Math.max(1, price.cost / padFillSeconds(price.cost))
      const paid = payPad(state, pad.target, Math.ceil(rate * dt), this.ev)
      if (paid > 0) {
        this.padSound -= dt
        if (this.padSound <= 0) {
          AudioManager.play('pour', 0.95 + Math.random() * 0.12)
          this.padSound = 0.12
        }
      }
      return
    }
    const key = `${pad.kind}:${pad.room}`
    if (this.padOpened !== key && !panel.value) this.openPad(pad, key)
    // still standing on Mission Control while the arrow points at a new mission: open it again after
    // a moment (the arrow hides on its target, so the player would not know to step off and on)
    else if (
      !panel.value && pad.kind === 'missions' && performance.now() - this.panelClosedAt > PAD_REOPEN_MS &&
      !!this.debugGuide()?.kind.includes('mission')
    ) this.openPad(pad, key)
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
    else if (pad.kind === 'laptop') panel.value = { kind: 'office' }
    else if (pad.kind === 'lab') panel.value = { kind: 'lab' }
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

  private updateCoachNeed(): void {
    const step = tutorialActive(state) ? TUTORIAL[state.tutorial] : undefined
    const price = step?.buy ? padPrice(state, step.buy) : null
    const left = price ? Math.ceil(price.cost - price.paid - state.cash) : 0
    const v = left > 0 ? left : null
    if (coachNeed.value !== v) coachNeed.value = v
  }

  private updateCoach(): void {
    coachLine.value = tutorialActive(state) ? (TUTORIAL[state.tutorial]?.line ?? null) : null
  }

  /** Current objective: the tutorial target, else the next room unlock the player can pay for. */
  private objectiveTarget(): { x: number; z: number } | null {
    if (tutorialActive(state)) return this.tutorialGoal()?.at ?? null
    // after the tutorial: always the next useful step (buy, collect, kits, sign-up, mission)
    return guideGoal(state)?.at ?? null
  }

  /**
   * Tutorial arrow: the step's target, but while a purchase step is not affordable yet (or a step
   * has no target, e.g. "wait for the first graduate") the next chore: collect, kits, sign-up.
   */
  private tutorialGoal(): { at: { x: number; z: number }; kind: string } | null {
    const step = TUTORIAL[state.tutorial]
    if (!step) return null
    const at = step.target(state)
    const price = step.buy ? padPrice(state, step.buy) : null
    const short = price ? price.cost - price.paid > state.cash : false
    if (at && !short) return { at, kind: `tut:${step.id}` }
    // saving up / waiting: only chores (cash, kits, sign-ups), never an unrelated purchase,
    // so the arrow always matches the coach line
    const g = guideGoal(state, true)
    if (g) return { at: g.at, kind: `tut-wait:${g.kind}` }
    return at ? { at, kind: `tut:${step.id}` } : null
  }

  // ---------------------------------------------------------------- QA autopilot (gameplay video)
  /** Waypoints to walk (debug only); 'guide' = keep following the guide arrow. */
  autopilot: { x: number; z: number }[] | 'guide' | null = null
  private autoDwell = 0

  private applyAutopilot(dt: number): void {
    const a = this.autopilot
    if (!a) return
    let t: { x: number; z: number } | null | undefined
    if (a === 'guide') {
      const goal = this.objectiveTarget()
      t = goal ? (this.routeTo(goal, 0)?.[1] ?? goal) : null
    } else t = a[0]
    if (!t) return
    const dx = t.x - this.player.x
    const dz = t.z - this.player.z
    const d = Math.hypot(dx, dz)
    if (d < 0.35) {
      if (Array.isArray(a)) a.shift()
      this.input.move.x = 0
      this.input.move.y = 0
      return
    }
    // never step past the target in one frame (low fps would make the hero swing across small pads)
    const k = Math.min(1, d / Math.max(1e-3, this.player.speed * dt))
    this.input.move.x = (dx / d) * k
    this.input.move.y = (dz / d) * k
    void this.autoDwell
  }

  /** QA: where the arrow points now (null = nothing to do). */
  debugGuide(): { x: number; z: number; kind: string } | null {
    if (tutorialActive(state)) {
      const g = this.tutorialGoal()
      return g ? { ...g.at, kind: g.kind } : null
    }
    const g = guideGoal(state)
    return g ? { ...g.at, kind: g.kind } : null
  }

  private updateGuide(dt: number): void {
    const show = !panel.value && this.mode === 'academy'
    const target = show ? this.objectiveTarget() : null
    this.updateCoachNeed()
    // standing on the target: no pointer needed
    const here = target && this.player.near(target.x, target.z, 1.2)
    this.guide.update(dt, here ? null : target, this.cam, this.w, this.h)
    this.trail.update(dt, here || !target ? null : this.routeTo(target, dt))
  }

  /**
   * Walkable route from the hero to `target` (corners only where a wall is in the way), or null
   * when the target is in straight reach. Re-planned a few times per second and when the target changes.
   */
  private routeTo(target: NavP, dt: number): NavP[] | null {
    this.navT -= dt
    const changed = !this.navFor || this.navFor.x !== target.x || this.navFor.z !== target.z
    if (changed || this.navT <= 0) {
      this.navT = GUIDE_TRAIL.replanSeconds
      this.navFor = { x: target.x, z: target.z }
      this.nav.sync(this.world.colliders)
      this.navRoute = this.nav.route({ x: this.player.x, z: this.player.z }, target)
    }
    if (this.navRoute) this.navRoute[0] = { x: this.player.x, z: this.player.z }
    return this.navRoute
  }

  /** QA: the floor trail's route to the arrow target (null = straight reach) and chevrons drawn. */
  debugGuideRoute(): { route: NavP[] | null; chevrons: number; corners: number } {
    const t = this.mode === 'academy' && !panel.value ? this.objectiveTarget() : null
    if (!t) return { route: null, chevrons: this.trail.shown, corners: this.trail.cornersShown }
    this.nav.sync(this.world.colliders)
    return { route: this.nav.route({ x: this.player.x, z: this.player.z }, t), chevrons: this.trail.shown, corners: this.trail.cornersShown }
  }

  /** Rebuild pads from the state (debug / QA). */
  syncPads(): void {
    this.pads.sync(state)
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
  /** Laptop menu actions on one waiting graduate. */
  office(agentId: number, action: 'sell' | 'hire' | 'swap'): void {
    const fee = state.pending.find((p) => p.agent.id === agentId)?.fee ?? 0
    const r = officeAct(state, agentId, action)
    if (!r) return
    if (r === 'sold') AudioManager.play('coin')
    else AudioManager.play('stamp')
    if (r === 'sold') this.popText(OFFICE.laptopPad, `+${formatNumber(fee, lang.value)}`, 'cash')
    this.pads.sync(state)
    bump()
    persist(['core', 'agents', 'meta'], true)
  }

  officeSellAll(): void {
    let total = 0
    for (const p of [...state.pending]) if (officeAct(state, p.agent.id, 'sell') === 'sold') total += p.fee
    if (total > 0) {
      AudioManager.play('coin')
      this.popText(OFFICE.laptopPad, `+${formatNumber(total, lang.value)}`, 'cash')
    }
    this.pads.sync(state)
    bump()
    persist(['core', 'agents', 'meta'], true)
  }

  setAutoSell(on: boolean): void {
    state.flags.autoSellWeak = on
    autoSellWeak(state)
    this.pads.sync(state)
    bump()
    persist(['core', 'meta'], true)
  }

  resolveGraduate(keep: boolean): void {
    const r = resolveGraduate(state, keep)
    if (r === 'loaned') AudioManager.play('coin')
    persist(['core', 'agents', 'meta'], true)
  }

  // ---------------------------------------------------------------- missions
  canStart(id: string): boolean {
    const m = resolveMission(state, id)
    return !!m && missionLock(state, m) === 'ok'
  }

  async startMission(id: string): Promise<void> {
    const m = resolveMission(state, id)
    if (!m || missionLock(state, m) !== 'ok') return
    this.mission = m
    this.agent = bestAgent(state, m)
    this.revivedThisAttempt = false
    this.resetStages()
    // gadget from the briefing: own stock (used up) or a free trial (after an ad)
    this.gadget = null
    const g = gadgetFor(m.minigame)
    const sel = briefingGadget.value
    if (!m.boss && g && sel?.mission === m.id && (sel.mode === 'trial' || takeGadget(state, g.id))) {
      this.gadget = g.id
      persist(['progress'])
    }
    briefingGadget.value = null
    panel.value = null
    beginFlow()
    blockInterstitials('mission', true)
    await this.launchMinigame()
  }

  private resetStages(): void {
    this.stage = 0
    this.stageStars = []
    this.stageIntel = 0
  }

  private async launchMinigame(): Promise<void> {
    const m = this.mission
    if (!m) return
    this.mg?.dispose()
    // boss missions play their stages back to back
    const st = m.stages?.[this.stage] ?? m
    const mg: Minigame =
      st.minigame === 'laser' ? new LaserHall()
      : st.minigame === 'code' ? new CodeBreaker()
      : st.minigame === 'mole' ? new SpotTheMole()
      : st.minigame === 'scooter' ? new ScooterPursuit()
      : st.minigame === 'circuit' ? new CircuitHack()
      : new SafeCracker()
    const skill = ROOMS[st.room].skill ?? 'finesse'
    const firstKey = `played_${st.minigame}`
    // the best agent for this stage's skill
    if (m.stages) this.agent = bestAgent(state, { ...m, room: st.room })
    await mg.init(
      { renderer: this.renderer, width: this.w, height: this.h, firstTime: !state.flags[firstKey] },
      this.tierOverride ?? st.tier,
      { agentSkill: this.agent?.skills[skill] ?? 0, region: m.region, gadget: this.gadget ?? undefined },
    )
    // region palette swap (the scooter street does its own)
    const look = REGION_LOOK[m.region]
    if (look.bg !== null && st.minigame !== 'scooter') mg.scene.background = new Color(look.bg)
    mg.onResult = (r) => this.onResult(r)
    this.mg = mg
    this.mode = 'minigame'
    this.guide.hide() // the academy's guide arrow / edge pointer has no meaning inside a minigame
    this.trail.hide()
    this.input.enabled = false
    missionUi.value = { phase: 'playing', mission: m.id, stage: m.stages ? this.stage : undefined }
    if (this.stage === 0) platform.sendMessage('level_started', { world: m.region, level: m.id })
    AudioManager.playMusic(m.boss ? 'music_boss' : 'music_mission')
    mg.start()
  }

  // ---------------------------------------------------------------- Gadget Lab
  private gadget: GadgetId | null = null

  craft(id: GadgetId): void {
    if (!craftGadget(state, id, now())) return
    AudioManager.play('upgrade')
    this.pads.sync(state)
    persist(['core', 'progress'], true)
  }

  rushCraft(): void {
    const id = rushGadget(state, now())
    if (!id) return
    showToast('lab.ready')
    AudioManager.play('upgrade')
    this.pads.sync(state)
    persist(['core', 'progress'], true)
  }

  /** Briefing: try the mission's gadget for free (rewarded gadget_trial). */
  async gadgetTrial(missionId: string): Promise<void> {
    const res = await showRewarded('gadget_trial')
    if (res === 'rewarded') briefingGadget.value = { mission: missionId, mode: 'trial' }
    else if (res === 'failed') showToast('toast.noAd')
  }

  // ---------------------------------------------------------------- rewarded offers
  /** HUD: x2 income for 5 min per ad, stackable up to 30 min. */
  async incomeBoost(): Promise<void> {
    const t0 = now()
    if (state.boostUntil - t0 > (OFFERS.boostMaxMinutes - OFFERS.boostMinutes) * 60_000) return
    const res = await showRewarded('income_boost')
    if (res === 'rewarded') {
      state.boostUntil = Math.max(now(), state.boostUntil) + OFFERS.boostMinutes * 60_000
      AudioManager.play('upgrade')
      persist(['core'], true)
    } else if (res === 'failed') showToast('toast.noAd')
  }

  private lastMissingOffer = -1e9

  /** Upgrade panel: offer the missing cash when only a little is missing (not more often than every 2 min). */
  missingCashOffer(cost: number): number {
    const missing = cost - state.cash
    if (missing <= 0 || missing > cost * OFFERS.missingShare) return 0
    if (now() - this.lastMissingOffer < OFFERS.missingEverySeconds * 1000) return 0
    return Math.ceil(missing)
  }

  async missingCash(cost: number): Promise<void> {
    const missing = this.missingCashOffer(cost)
    if (!missing) return
    this.lastMissingOffer = now()
    const res = await showRewarded('missing_cash')
    if (res === 'rewarded') {
      state.cash += missing
      AudioManager.play('coin')
      persist(['core'], true)
    } else if (res === 'failed') showToast('toast.noAd')
  }

  /** Fail screen after repeated fails: win the mission with 1 star (no doubling). */
  async skipMission(): Promise<void> {
    const m = this.mission
    const ui = missionUi.value
    if (!m || !ui || ui.phase !== 'fail' || m.boss) return
    const res = await showRewarded('mission_skip')
    if (res !== 'rewarded') {
      if (res === 'failed') showToast('toast.noAd')
      return
    }
    const reward = missionReward(state, m, 1)
    recordWin(state, m, 1, reward, this.agent, this.ev)
    this.lastReward = reward
    AudioManager.playJingle('jingle_win')
    missionUi.value = { phase: 'result', mission: m.id, stars: 1, cash: reward.cash, intel: reward.intel, doubled: true, freeDouble: false, skipped: true }
    persist(['core', 'agents', 'progress', 'meta'], true)
  }

  /** Welcome back: double the offline earnings. */
  async welcomeDouble(amount: number): Promise<boolean> {
    const res = await showRewarded('offline_double')
    if (res === 'rewarded') {
      this.collectWelcome(amount, true)
      return true
    }
    if (res === 'failed') showToast('toast.noAd')
    return false
  }

  // ---------------------------------------------------------------- supply drone + VIP recruit
  private supplyT = 0
  private supplyLeft = 0
  private vipT = 0
  private vipLeft = 0
  private drone: Group | null = null
  private vip: Character | null = null

  private updateOffers(dt: number): void {
    const on = state.tutorial >= TUTORIAL.length && state.counter
    if (on && dt > 0) {
      if (this.supplyLeft <= 0) {
        this.supplyT += dt
        if (this.supplyT >= OFFERS.supplyEvery) {
          this.supplyT = 0
          this.supplyLeft = OFFERS.supplyStays
          this.spawnDrone()
          track('rewarded_offer_shown', { placement: 'supply_drop' })
        }
      } else {
        this.supplyLeft = Math.max(0, this.supplyLeft - dt)
        if (this.supplyLeft === 0) this.dropDrone()
      }
      if (this.vipLeft <= 0) {
        this.vipT += dt
        if (this.vipT >= OFFERS.vipEvery && rewardedSupported()) {
          this.vipT = 0
          this.vipLeft = OFFERS.vipStays
          this.spawnVip()
          track('rewarded_offer_shown', { placement: 'vip_recruit' })
        }
      } else {
        this.vipLeft = Math.max(0, this.vipLeft - dt)
        if (this.vipLeft === 0) this.dropVip()
      }
    }
    // drone hovers above the hero (lazy follow), bobbing; flies off up when gone
    if (this.drone) {
      const d = this.drone
      const tx = this.player.x + 1.2
      const tz = this.player.z - 1.0
      const leaving = this.supplyLeft <= 0
      d.position.x += (tx - d.position.x) * Math.min(1, dt * 1.5)
      d.position.z += (tz - d.position.z) * Math.min(1, dt * 1.5)
      d.position.y += ((leaving ? 14 : 4.2 + Math.sin(performance.now() / 300) * 0.15) - d.position.y) * Math.min(1, dt * (leaving ? 1.2 : 2))
      for (const r of d.children.filter((c: Object3D) => c.userData.rotor)) r.rotation.y += dt * 30
      if (leaving && d.position.y > 13) {
        this.world.dynamic.remove(d)
        this.drone = null
      }
    }
    this.vip?.update(dt)
    const lo = liveOffers.value
    const supply = this.supplyLeft > 0 ? Math.ceil(this.supplyLeft) : null
    const vip = this.vipLeft > 0 ? Math.ceil(this.vipLeft) : null
    const free = !state.flags.supplyFreeUsed
    if (lo.supply !== supply || lo.vip !== vip || lo.supplyFree !== free) liveOffers.value = { supply, vip, supplyFree: free }
  }

  private spawnDrone(): void {
    if (this.drone) this.world.dynamic.remove(this.drone)
    const b = new StaticBatch()
    b.rbox(0.9, 0.22, 0.9, 0, 0, 0, 0x2b3346, 0.08)
    b.rbox(0.4, 0.12, 0.4, 0, 0.16, 0, PAL.brandYellow, 0.05)
    for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) b.box(0.7, 0.06, 0.08, ax * 0.42, 0.05, az * 0.42, 0x5d6779, (ax * az * Math.PI) / 4)
    // crate on a rope
    b.box(0.03, 0.6, 0.03, 0, -0.4, 0, PAL.dark)
    b.rbox(0.62, 0.5, 0.62, 0, -0.95, 0, 0xc98b4f, 0.05)
    b.rbox(0.66, 0.08, 0.66, 0, -0.75, 0, PAL.brandYellow, 0.03)
    const g = new Group()
    g.add(new Mesh(b.build(), flatMat))
    for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const r = new Mesh(new CylinderGeometry(0.28, 0.28, 0.03, 12), flatMat)
      r.position.set(ax * 0.62, 0.12, az * 0.62)
      r.userData.rotor = true
      g.add(r)
    }
    g.position.set(this.player.x - 14, 12, this.player.z - 6)
    this.world.dynamic.add(g)
    this.drone = g
    AudioManager.play('drone', 1)
  }

  private dropDrone(): void {
    this.supplyLeft = 0
  }

  /** Open the crate: the first one is free, later ones after a rewarded ad. */
  async openSupply(): Promise<void> {
    if (this.supplyLeft <= 0) return
    if (state.flags.supplyFreeUsed) {
      const res = await showRewarded('supply_drop')
      if (res !== 'rewarded') {
        if (res === 'failed') showToast('toast.noAd')
        return
      }
    }
    state.flags.supplyFreeUsed = true
    const r = openSupply(state)
    this.supplyLeft = 0
    AudioManager.play('crate_open')
    AudioManager.play(r.kind === 'cash' ? 'coin' : 'upgrade')
    this.popText({ x: this.player.x, z: this.player.z }, r.kind === 'cash' ? `+${formatNumber(r.amount, lang.value)}` : r.kind === 'badges' ? `+${r.amount}` : t(`gadget.${r.id}`), 'cash')
    showToast(`supply.${r.kind}`)
    persist(['core', 'progress', 'meta'], true)
  }

  private spawnVip(): void {
    if (this.vip) this.world.dynamic.remove(this.vip.root)
    const v = new Character({ model: 'cadetF2', tint: { shirt: 0xf2b134, pants: 0x8f6bd8 } })
    v.root.position.set(LAYOUT.street.stopX + 2.2, 0, LAYOUT.street.stopZ - 1.0)
    v.cheer(OFFERS.vipStays)
    this.world.dynamic.add(v.root)
    this.vip = v
  }

  private dropVip(): void {
    if (this.vip) this.world.dynamic.remove(this.vip.root)
    this.vip = null
    this.vipLeft = 0
  }

  async recruitVip(): Promise<void> {
    if (this.vipLeft <= 0) return
    const res = await showRewarded('vip_recruit')
    if (res !== 'rewarded') {
      if (res === 'failed') showToast('toast.noAd')
      return
    }
    vipRecruit(state)
    this.dropVip()
    AudioManager.play('level_up')
    showToast('vip.joined')
    this.pads.sync(state)
    persist(['agents'], true)
  }

  /** QA: bring the drone / VIP right now. */
  debugOffers(): void {
    this.supplyT = OFFERS.supplyEvery
    this.vipT = OFFERS.vipEvery
  }

  // ---------------------------------------------------------------- Prestige
  relocateHq(): void {
    const gain = relocate(state)
    if (!gain) return
    track('prestige', { count: state.prestige })
    panel.value = null
    this.world.setShop(state.prestige)
    this.world.syncAreas(state)
    this.world.syncRooms(state)
    this.pads.sync(state)
    this.teleport(0, 4.6)
    AudioManager.play('level_up')
    showToast('prestige.done')
    persist(['core', 'agents', 'progress', 'meta'], true)
    showInterstitial('prestige')
    void leaderboards.setScore(LEADERBOARD_ID, state.medals)
  }

  /** Leaderboard button: own list (in_game) or the platform overlay (native_popup). */
  openLeaderboard(): void {
    if (leaderboards.type === 'native_popup') void leaderboards.showNativePopup(LEADERBOARD_ID)
    else if (leaderboards.type === 'in_game') panel.value = { kind: 'leaderboard' }
  }

  // ---------------------------------------------------------------- Field Ops
  fieldOp(pendingIndex: number, op: number): void {
    if (!startFieldOp(state, pendingIndex, op, now())) return
    AudioManager.play('whoosh')
    this.pads.sync(state)
    persist(['agents'], true)
  }

  async fieldOpFinish(i: number): Promise<void> {
    const res = await showRewarded('fieldop_finish')
    if (res === 'rewarded') {
      finishFieldOp(state, i, now())
      persist(['agents'], true)
    } else if (res === 'failed') showToast('toast.noAd')
  }

  fieldOpCollect(i: number): void {
    const r = collectFieldOp(state, i, now())
    if (!r) return
    AudioManager.play('coin')
    persist(['core', 'agents'], true)
  }

  // ---------------------------------------------------------------- Vault Bonus
  private vault: { perBolt: number; retried: boolean } | null = null

  /** Offer the Vault Bonus round (after a boss win / academy level-up), once the tutorial is done. */
  private offerVault(): void {
    if (state.tutorial < TUTORIAL.length || state.level < VAULT_BONUS.fromLevel) return
    queuePopup({ kind: 'vault' })
  }

  vaultLootPerBolt(): number {
    const next = MISSIONS.find((m) => !((state.missions[m.id]?.wins ?? 0) > 0)) ?? MISSIONS[MISSIONS.length - 1]!
    return Math.max(VAULT_BONUS.minLoot, Math.round(next.cash * VAULT_BONUS.lootShare))
  }

  async startVault(): Promise<void> {
    if (this.mode !== 'academy') return
    panel.value = null
    this.mg?.dispose()
    this.vault = { perBolt: this.vaultLootPerBolt(), retried: false }
    vaultLoot.value = 0
    const mg = new SafeCracker()
    const tier = Math.min(10, 1 + Math.floor(state.level / VAULT_BONUS.levelsPerTier))
    beginFlow()
    blockInterstitials('mission', true)
    await mg.init({ renderer: this.renderer, width: this.w, height: this.h, firstTime: false }, tier, { agentSkill: 0 })
    mg.onBolt = () => {
      vaultLoot.value += this.vault?.perBolt ?? 0
      AudioManager.play('coin', 1.1)
    }
    mg.onResult = (r) => {
      missionUi.value = {
        phase: 'vault', mission: 'vault', loot: vaultLoot.value, cracked: r.success,
        canRetry: !r.success && !this.vault?.retried && rewardedSupported(),
      }
      AudioManager.playJingle(r.success ? 'jingle_win' : 'jingle_fail')
    }
    this.mg = mg
    this.mode = 'minigame'
    this.guide.hide() // the academy's guide arrow / edge pointer has no meaning inside a minigame
    this.trail.hide()
    this.input.enabled = false
    missionUi.value = { phase: 'playing', mission: 'vault' }
    AudioManager.playMusic('music_mission')
    mg.start()
  }

  /** Extra attempt (rewarded vault_retry, once per round): the safe continues where it stopped. */
  async vaultRetry(): Promise<void> {
    const ui = missionUi.value
    if (!ui || ui.phase !== 'vault' || !ui.canRetry || !this.vault || this.vault.retried) return
    const res = await showRewarded('vault_retry')
    if (res !== 'rewarded') {
      if (res === 'failed') showToast('toast.noAd')
      return
    }
    this.vault.retried = true
    missionUi.value = { phase: 'playing', mission: 'vault' }
    this.mg?.revive()
  }

  vaultCollect(): void {
    const loot = vaultLoot.value
    state.cash += loot
    state.stats.earned += loot
    if (loot > 0) AudioManager.play('coin')
    vaultLoot.value = 0
    this.vault = null
    this.mg?.dispose()
    this.mg = null
    this.mode = 'academy'
    missionUi.value = null
    this.input.enabled = true
    blockInterstitials('mission', false)
    AudioManager.playMusic('music_academy')
    persist(['core', 'meta'], true)
    nextPopup()
  }

  /** QA: end the running minigame with a result (boss flow tests). */
  debugFinish(success: boolean): void {
    if (this.mode === 'minigame' && this.mg && !(this.mg instanceof BossCutscene) && missionUi.value?.phase === 'playing')
      this.mg.onResult({ success, stars: 3, timeLeft: 10, mistakes: 0, intel: 0, reason: success ? undefined : 'alarm' })
  }

  private canPlay(): boolean {
    return this.mode === 'minigame' && missionUi.value?.phase === 'playing' && !userPaused.value
  }

  minigameAction(): void {
    if (this.canPlay()) this.mg?.action()
  }

  /** On-screen lane buttons (Scooter Pursuit). */
  minigameMove(dir: 'left' | 'right'): void {
    if (this.canPlay()) this.mg?.move?.(dir)
  }

  /** On-screen keypad (Code Breaker). */
  minigameInput(cmd: 'sym' | 'del' | 'ok', arg?: number): void {
    if (this.canPlay()) this.mg?.input?.(cmd, arg)
  }

  /** Hint button: free hints first, then a rewarded ad (placement minigame_hint). */
  async minigameHint(): Promise<void> {
    const mg = this.mg
    if (!mg || !this.canPlay()) return
    if ((mg.freeHints?.() ?? 0) > 0) {
      mg.useHint()
      return
    }
    const res = await showRewarded('minigame_hint')
    if (res === 'rewarded') mg.useHint()
    else if (res === 'failed') showToast('toast.noAd')
  }

  private onResult(r: MinigameResult): void {
    const m = this.mission
    if (!m) return
    const st = m.stages?.[this.stage] ?? m
    state.flags[`played_${st.minigame}`] = true
    if (r.success && m.stages && this.stage < m.stages.length - 1) {
      // boss: next stage after a short "stage cleared" stamp
      this.stageStars.push(r.stars)
      this.stageIntel += r.intel
      this.stage++
      missionUi.value = { phase: 'stage', mission: m.id, stage: this.stage }
      AudioManager.play('level_up')
      setTimeout(() => {
        if (missionUi.value?.phase === 'stage' && this.mission === m) void this.launchMinigame()
      }, 1600)
      return
    }
    if (r.success && m.boss && !(this.mg instanceof BossCutscene)) {
      // boss captured: cutscene first, the result folder follows
      this.stageStars.push(r.stars)
      this.stageIntel += r.intel
      this.mg?.dispose()
      const cut = new BossCutscene(BOSSES[m.region] ?? { suit: 0x1b1b24, hat: 'captain', hatColor: 0xffffff })
      this.mg = cut
      missionUi.value = { phase: 'captured', mission: m.id }
      AudioManager.playJingle('jingle_win')
      void cut.init({ renderer: this.renderer, width: this.w, height: this.h, firstTime: false }).then(() => {
        cut.onResult = () => this.onResult({ success: true, stars: Math.min(...this.stageStars), timeLeft: 0, mistakes: 0, intel: 0 })
        cut.start()
      })
      return
    }
    if (r.success) {
      const stars = m.boss ? Math.min(...this.stageStars, 3) : r.stars
      const reward = missionReward(state, m, stars)
      reward.intel += r.intel + this.stageIntel // e.g. intel chips picked up in the Laser Hall
      const firstBossWin = !!m.boss && !((state.missions[m.id]?.wins ?? 0) > 0)
      recordWin(state, m, stars, reward, this.agent, this.ev)
      if (m.boss) track('boss_defeated', { region: m.region })
      this.lastReward = reward
      platform.sendMessage('level_completed', { world: m.region, level: m.id })
      if (!m.boss) AudioManager.playJingle('jingle_win')
      missionUi.value = {
        phase: 'result', mission: m.id, stars, cash: reward.cash, intel: reward.intel,
        doubled: false, freeDouble: !state.flags.firstDoubleFree, badges: firstBossWin ? (m.badges ?? 0) : 0,
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
    missionUi.value = { phase: 'playing', mission: ui.mission, stage: this.mission?.stages ? this.stage : undefined }
    this.mg?.revive()
  }

  async retry(): Promise<void> {
    this.revivedThisAttempt = false
    this.resetStages()
    await this.launchMinigame()
  }

  /** Continue from result / give up from fail: back to the academy (natural pause). */
  endMission(): void {
    this.panelClosedAt = performance.now()
    const boss = !!this.mission?.boss && missionUi.value?.phase === 'result'
    this.mg?.dispose()
    this.mg = null
    this.mission = null
    this.mode = 'academy'
    missionUi.value = null
    this.input.enabled = true
    blockInterstitials('mission', false)
    AudioManager.playMusic('music_academy')
    this.updateAdGate()
    showInterstitial(boss ? 'boss_end' : 'mission_end')
    if (boss) this.offerVault()
    nextPopup()
  }

  /** performance_sample scene (bounded): academy, the running minigame id, or boss. */
  perfScene(): string {
    if (this.mode !== 'minigame' || !this.mission) return 'academy'
    return this.mission.boss ? 'boss' : this.mission.minigame
  }

  /** New players: no interstitial until the first mission(s) are over (INTERSTITIAL_RULES). */
  private updateAdGate(): void {
    let ended = 0
    for (const m of Object.values(state.missions)) ended += m.wins + m.fails
    blockInterstitials('firstMissions', !this.adGateOff && ended <= INTERSTITIAL_RULES.adFreeMissions)
  }

  /** QA: switch the new-player ad-free gate off (tests of the regular interstitial points). */
  adGateOff = false
  setAdGate(on: boolean): void {
    this.adGateOff = !on
    this.updateAdGate()
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
    this.panelClosedAt = performance.now()
    if (p?.kind === 'levelup') {
      showInterstitial('level_up')
      this.offerVault()
    }
    // closing a menu (map, roster, lab, field ops, pause) is NOT an ad point: interstitials only
    // come after real play (mission/boss end, academy level-up, relocation)
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

  /** Debug: hero position. */
  debugHero(): { x: number; z: number } {
    return { x: this.player.x, z: this.player.z }
  }

  get minigame(): Minigame | null {
    return this.mg
  }
}
