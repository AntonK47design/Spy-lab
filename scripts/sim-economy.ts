/**
 * npm run sim — headless economy bot on the REAL sim code (no ads).
 * The bot walks the real distances at hero speed, follows the tutorial order, serves cadets,
 * carries kits, collects, buys pads/upgrades and plays missions (70 % success).
 * Two profiles (focused, distracted = 70 % efficiency) over 10 seeds; median + worst are judged
 * against the beat sheet (docs/KICKOFF_LESSONS.md §5) and the brief's pacing table.
 */
import { newGame, type GameState } from '../src/sim/state.ts'
import {
  totalRate,   setRng, tick, collect, collectWelcome, pickKits, dropKits, payPad, padPrice, upgradeLevel, levelCost,
  trainingRooms, nextUnlock, nextArea, serveBlocker, resolveGraduate, nextStationCost, nextStaff, type PadTarget, type HeroInput,
} from '../src/sim/academy.ts'
import { missionLock, missionReward, recordWin, recordFail, bestAgent } from '../src/sim/missions.ts'
import { MISSIONS } from '../src/config/missions.ts'
import { LAYOUT, OFFICE, ROOMS, ROOM_ORDER, cashSpotOf, crateOf, gateOf, padOf, slotOf, staffPadOf, upgradeSpotOf, type RoomId } from '../src/config/rooms.ts'
import { ECONOMY, padFillSeconds } from '../src/config/economy.ts'
import { createRng } from '../src/core/rng.ts'
import { allPads, cheapestPrice, guideGoal, padPos } from '../src/sim/guide.ts'

type P = { x: number; z: number }
const DT = 1 / 30
/** A mission incl. briefing + result: Safe Cracker tier 1 has a hard 35 s limit, later minigames 30-60 s. */
const MISSION_SECONDS = 40
const PATH_FACTOR = 1.25 // real paths go around walls

interface Run {
  missionTime: [number, number][]
  marks: Record<string, number>
  purchases: number[]
  longestUnaffordable: number
  firstAutomation: number | null
  /** Progress beats: purchases, room upgrades, finished missions. */
  progress: number[]
  /** Stretches where the bot found nothing at all to do [start, end]. */
  idles: [number, number][]
}

function runBot(seed: number, efficiency: number, seconds: number): Run {
  const rng = createRng(seed)
  setRng(rng)
  const s = newGame()
  const marks: Record<string, number> = {}
  const purchases: number[] = []
  let hero: P = { ...LAYOUT.playerSpawn }
  let heroIn: HeroInput = { atCounter: false }
  let lastAffordable = 0
  let longestUnaffordable = 0
  let firstAutomation: number | null = null
  const t = () => s.stats.playSeconds
  const mark = (k: string) => {
    if (!(k in marks)) marks[k] = t()
  }
  let lastPurchases = 0
  let lastUpgrades = 0
  let nextLog = 0
  const progress: number[] = []
  const idles: [number, number][] = []
  let idleStart = -1
  let idleEnd = 0
  let wasIdle = false
  const ev = {
    graduate: () => mark('first_payoff'),
    levelUp: (l: number) => mark(`level_${l}`),
    unlock: (r: RoomId) => mark(`unlock_${r}`),
    cycle: () => mark('first_income'),
    served: () => mark('first_served'),
    area: (a: string) => mark(`area_${a}`),
    built: (what: string) => {
      if ((what === 'runner' || what === 'clerk' || what === 'instructor' || what === 'officeClerk') && firstAutomation == null) firstAutomation = t()
    },
  }
  const step = (sec: number) => {
    for (let x = 0; x < sec; x += DT) {
      tick(s, DT, heroIn, ev)
      if (s.stats.upgrades > lastUpgrades) {
        lastUpgrades = s.stats.upgrades
        progress.push(t())
      }
      if (s.stats.purchases > lastPurchases) {
        progress.push(t())
        for (let i = lastPurchases; i < s.stats.purchases; i++) purchases.push(t())
        lastPurchases = s.stats.purchases
        mark('first_unlock')
        if (purchases.length >= 3) mark('three_unlocks')
      }
      if (TRACE && t() >= nextLog && (nextLog += 10)) console.log('  t', Math.floor(t()), 'cash', Math.floor(s.cash), 'cheapest', Math.floor(cheapestPrice(s)), 'rate', totalRate(s).toFixed(2), 'cadets', s.cadets.map((c) => `${c.phase}${c.room ? ':' + c.room : ''}`).join('/'), 'stacks', trainingRooms(s).map((id) => Math.floor(s.rooms[id].stack)).join('/'), 'agents', s.agents.length, 'pending', s.pending.length, 'lvlcost', trainingRooms(s).map((id) => `${id}:${Math.floor(levelCost(s, id))}`).join(','))
      if (playing || cheapestPrice(s) <= s.cash) lastAffordable = t()
      longestUnaffordable = Math.max(longestUnaffordable, t() - lastAffordable)
    }
  }
  const walkTo = (p: P) => {
    const d = Math.hypot(p.x - hero.x, p.z - hero.z) * PATH_FACTOR
    step(d / ECONOMY.player.speed / efficiency)
    hero = { ...p }
  }

  let lastMission = -999
  let playing = false
  const missionTime: [number, number][] = []
  while (t() < seconds) {
    if (!wasIdle && idleStart >= 0) {
      idles.push([idleStart, idleEnd])
      idleStart = -1
    }
    wasIdle = false
    if (efficiency < 1 && rng() > efficiency) {
      step(1.5) // distracted: looks around
      continue
    }
    // 1. welcome cash
    if (s.welcome > 0) {
      walkTo(LAYOUT.welcomeSpot)
      collectWelcome(s)
      mark('first_cash')
      continue
    }
    // 1a. graduates wait in the agency office: walk there, hire the first few, sell the rest
    // with the office clerk, common graduates are sold for the bot; only rare+ need a visit
    if (s.pending.length && (!s.officeClerk || s.pending.some((p) => p.agent.rarity !== 'common') || s.agents.length < 1)) {
      walkTo(OFFICE.laptopPad)
      while (s.pending.length) {
        resolveGraduate(s, s.agents.length < 3)
        step(0.5)
      }
      continue
    }
    // 1b. tutorial route: first mission as soon as an agent is there
    const first = MISSIONS[0]!
    if (!((s.missions[first.id]?.wins ?? 0) > 0) && missionLock(s, first) === 'ok' && t() - lastMission > 20) {
      walkTo(padOf('mission_control'))
      mark(`mission_${first.id}`)
      const m0 = t()
      playing = true
      step(MISSION_SECONDS)
      playing = false
      missionTime.push([m0, t()])
      progress.push(t())
      if (rng() < 0.7) {
        const stars = 1 + Math.floor(rng() * 3)
        recordWin(s, first, stars, missionReward(s, first, stars), bestAgent(s, first), ev)
      } else recordFail(s, first)
      lastMission = t()
      continue
    }
    // 2. cheapest affordable pad (counter, stations, room, staff, clerk)
    // tutorial route: after mission 1 the guide points at the Laser Gym -> save for it
    const goal: PadTarget | null =
      (s.missions[first.id]?.wins ?? 0) > 0 && !s.rooms.laser.unlocked && padPrice(s, { kind: 'unlock', room: 'laser' })
        ? { kind: 'unlock', room: 'laser' }
        : null
    const goalLeft = goal ? padPrice(s, goal)!.cost - padPrice(s, goal)!.paid : 0
    const pads = allPads(s)
      .map((p) => ({ p, left: padPrice(s, p)!.cost - padPrice(s, p)!.paid }))
      .filter((x) => x.left <= s.cash && (!goal || x.p.kind === 'unlock' || x.p.kind === 'counter' || s.cash - x.left >= goalLeft))
      .sort((a, b) => (goal && a.p.kind === 'unlock' ? -1 : goal && b.p.kind === 'unlock' ? 1 : a.left - b.left))
    const buy = pads[0]
    // a room level-up at the desk competes with pads when it is cheaper
    const up0 = trainingRooms(s).filter((id) => s.rooms[id].stations > 0).sort((a, b) => levelCost(s, a) - levelCost(s, b))[0]
    if (!goal && up0 && levelCost(s, up0) <= s.cash && (!buy || levelCost(s, up0) < buy.left * 0.5) && nextUnlock(s) !== null && s.cash - levelCost(s, up0) >= 0) {
      walkTo(upgradeSpotOf(up0))
      upgradeLevel(s, up0, ev)
      if (TRACE) console.log(fmt(t()), 'level', up0, s.rooms[up0].level)
      continue
    }
    if (buy) {
      walkTo(padPos(buy.p, s))
      step(padFillSeconds(buy.left))
      payPad(s, buy.p, buy.left, ev)
      if (TRACE) console.log(fmt(t()), 'pad', JSON.stringify(buy.p), buy.left)
      continue
    }
    // 2b. the guide arrow points at a cash pile that pays for the next purchase: go collect it
    const g = guideGoal(s)
    if (g && g.kind === 'cash') {
      walkTo(g.at)
      collect(s, g.room)
      continue
    }
    // the arrow points at a new mission: play it (like the real player in tests/pace.spec.ts)
    if (g && g.kind === 'mission' && t() - lastMission > 20) {
      const m = MISSIONS.find((x) => missionLock(s, x) === 'ok' && !((s.missions[x.id]?.wins ?? 0) > 0))
      if (m) {
        walkTo(padOf('mission_control'))
        mark(`mission_${m.id}`)
        const m0 = t()
        playing = true
        step(MISSION_SECONDS)
        playing = false
        missionTime.push([m0, t()])
        progress.push(t())
        if (rng() < 0.7) {
          const stars = 1 + Math.floor(rng() * 3)
          recordWin(s, m, stars, missionReward(s, m, stars), bestAgent(s, m), ev)
        } else recordFail(s, m)
        lastMission = t()
        continue
      }
    }
    // 3. sign up waiting cadets
    if (!s.clerk && serveBlocker(s) === null) {
      walkTo(LAYOUT.serveSpot)
      heroIn = { atCounter: true }
      let n = 0
      while (serveBlocker(s) === null && n++ < 6) step(0.3)
      heroIn = { atCounter: false }
      continue
    }
    // 4. resupply stations with a cadet waiting for kits
    const needy = trainingRooms(s).find((id) => {
      const r = s.rooms[id]
      // like the tutorial: fill the basket while the cadet is still walking there
      return !r.runner && r.crate && s.cadets.some((c) => c.room === id && (c.phase === 'train' || c.phase === 'walk') && (r.supply[c.slot] ?? 0) === 0)
    })
    if (needy) {
      walkTo(crateOf(needy))
      step(ECONOMY.supply.carryMax * ECONOMY.supply.pickSeconds)
      pickKits(s, needy, ECONOMY.supply.carryMax)
      for (let i = 0; i < s.rooms[needy].stations && s.carry.n > 0; i++) {
        walkTo(slotOf(needy, i))
        step(ECONOMY.supply.dropSeconds * 2)
        dropKits(s, needy, i, 2)
        mark('first_delivery')
      }
      continue
    }
    // 5. collect the biggest pile
    const rich = trainingRooms(s).sort((a, b) => s.rooms[b].stack - s.rooms[a].stack)[0]
    if (rich && s.rooms[rich].stack >= Math.max(5, cheapestPrice(s) - s.cash) * 0.5 && !s.rooms[rich].instructor) {
      walkTo(cashSpotOf(rich))
      collect(s, rich)
      continue
    }
    // 6. mission
    const m = MISSIONS.find((x) => missionLock(s, x) === 'ok' && !((s.missions[x.id]?.wins ?? 0) > 0))
    if (m && t() - lastMission > 20) {
      walkTo(padOf('mission_control'))
      mark(`mission_${m.id}`)
      const m0 = t()
      playing = true
      step(MISSION_SECONDS)
      playing = false
      missionTime.push([m0, t()])
      progress.push(t())
      if (rng() < 0.7) {
        const stars = 1 + Math.floor(rng() * 3)
        recordWin(s, m, stars, missionReward(s, m, stars), bestAgent(s, m), ev)
      } else recordFail(s, m)
      lastMission = t()
      continue
    }
    // 7. room level-up at the desk
    const up = trainingRooms(s).filter((id) => s.rooms[id].stations > 0).sort((a, b) => levelCost(s, a) - levelCost(s, b))[0]
    if (up && levelCost(s, up) <= s.cash) {
      walkTo(upgradeSpotOf(up))
      upgradeLevel(s, up, ev)
      continue
    }
    // nothing useful to do right now: the player waits
    if (idleStart < 0) idleStart = t()
    wasIdle = true
    step(0.5)
    idleEnd = t()
  }
  if (idleStart >= 0) idles.push([idleStart, idleEnd])
  return { marks, purchases, longestUnaffordable, firstAutomation, missionTime, progress, idles }
}

// ---------------------------------------------------------------- report
const TRACE = process.argv.includes('--trace')
const SECONDS = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 1500)
const SEEDS = 10
const median = (xs: number[]) => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  return v.length ? v[Math.floor(v.length / 2)]! : NaN
}
const worst = (xs: number[]) => Math.max(...xs.map((x) => (Number.isFinite(x) ? x : Infinity)))
const fmt = (x: number) => (!Number.isFinite(x) ? '  —  ' : `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`)

/** Pace windows [from, to, longest allowed gap between progress beats (s)]: fast start, small drop later. */
const PACE_WINDOWS: [number, number, number][] = [
  [0, 300, 20],
  [300, 600, 25],
  [600, 900, 30],
  [900, 1500, 30],
  [1500, 3600, 40],
  [3600, 5400, 45],
  [5400, 7200, 50],
  [7200, 10800, 60],
]

const BEATS: [string, string, number, number][] = [
  // key, label, target (s), allowed worst (s)
  ['first_cash', 'Erstes Geld', 5, 5],
  ['first_unlock', 'Erster Kauf', 12, 12],
  ['first_served', 'Erster Kadett angemeldet', 10, 12],
  ['first_income', 'Erstes Einkommen', 15, 20],
  ['three_unlocks', '3 Käufe', 20, 30],
  ['first_payoff', 'Erster Absolvent (Payoff)', 60, 80],
  ['mission_harbor_01', 'Mission 1', 70, 100],
  ['affordable_laser', 'Laser Gym kaufbar', 100, 200],
  ['unlock_laser', 'Laser Gym gebaut', 100, 210],
  ['first_automation', 'Erste Automatisierung', 200, 240],
  ['area_harbor', 'Areal 2 (Hafen) offen', 600, 960],
  ['unlock_cipher', 'Cipher Room', 660, 1000],
  ['level_3', 'Akademie-Level 3', 390, 520],
  ['level_10', 'Akademie-Level 10', 1500, 2400],
  // prestige becomes possible (brief: first relocation after 40-60 min)
  ['level_15', 'Akademie-Level 15 (Umzug)', 3000, 3600],
  ['area_lighthouse', 'Leuchtturm-Insel offen', 1800, 3600],
  ['unlock_hack', 'Hack Lab', 2400, 4800],
  ['level_20', 'Akademie-Level 20', 5400, 9000],
  ['level_25', 'Akademie-Level 25', 7200, 10800],
]

if (TRACE) {
  const arg = (k: string, d: number) => Number(process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d)
  const r = runBot(1000 + arg('seed', 0), arg('eff', 1), arg('secs', 330))
  const f = (x: number) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`
  console.log('progress', r.progress.map(f).join(' '))
  console.log('missions', r.missionTime.map(([a, b]) => `${f(a)}-${f(b)}`).join(' '))
  console.log('idle', r.idles.map(([a, b]) => `${f(a)}+${(b - a).toFixed(1)}`).join(' '))
  process.exit(0)
}
let failed = false
for (const [profile, eff] of [['focused', 1], ['distracted', 0.7]] as const) {
  const runs = Array.from({ length: SEEDS }, (_, i) => runBot(1000 + i, eff, SECONDS))
  for (const r of runs) {
    if (r.firstAutomation != null) r.marks.first_automation = r.firstAutomation
    if (r.marks.unlock_laser != null) r.marks.affordable_laser ??= r.marks.unlock_laser
  }
  console.log(`\n=== ${profile} (${SEEDS} seeds, ${SECONDS}s, no ads) ===`)
  console.log('Beat                        Ziel   Median  Worst')
  for (const [k, label, target, allowed] of BEATS) {
    const vals = runs.map((r) => r.marks[k] ?? Infinity)
    const med = median(vals)
    const w = worst(vals)
    const scale = eff < 1 ? 1 / eff : 1
    const ok = med <= target * scale * 1.2 && w <= allowed * scale * 1.2
    if (!ok && target <= 180) failed = true
    console.log(`${label.padEnd(26)}  ${fmt(target * scale)}  ${fmt(med)}  ${fmt(w)}  ${ok ? 'ok' : '!!'}`)
  }
  const gaps = runs.map((r) => {
    const p = [0, ...r.purchases.filter((x) => x <= 180)]
    // time spent in a mission (the spectacle) is engagement, not a purchase gap
    const inMission = (a: number, b: number) => r.missionTime.reduce((acc, [m0, m1]) => acc + Math.max(0, Math.min(b, m1) - Math.max(a, m0)), 0)
    const d = p.slice(1).map((x, i) => x - p[i]! - inMission(p[i]!, x))
    return { avg: d.length ? d.reduce((a, b) => a + b, 0) / d.length : Infinity, max: d.length ? Math.max(...d) : Infinity }
  })
  console.log(`Kauf-Abstand (erste 3 Min): Ø median ${median(gaps.map((g) => g.avg)).toFixed(1)}s (Ziel ≤ 20), längster worst ${worst(gaps.map((g) => g.max)).toFixed(1)}s (Ziel ≤ ${eff < 1 ? 50 : 35})`)
  const dead = runs.map((r) => r.longestUnaffordable)
  console.log(`Nichts bezahlbar, längste Phase: median ${median(dead).toFixed(0)}s, worst ${worst(dead).toFixed(0)}s (Ziel ≤ ${eff < 1 ? 85 : 60})`)
  if (eff === 1 && worst(gaps.map((g) => g.max)) > 35 * 1.2) failed = true
  // pace per window: longest gap between progress beats (mission play counts as active) + longest pure idle
  console.log('Tempo        längste Lücke (median/worst)   längstes Nichtstun (median/worst)')
  for (const [a, b, gapGoal] of PACE_WINDOWS) {
    if (a >= SECONDS) break
    const gs = runs.map((r) => {
      const inMission = (x: number, y: number) => r.missionTime.reduce((acc, [m0, m1]) => acc + Math.max(0, Math.min(y, m1) - Math.max(x, m0)), 0)
      const ev = [a, ...r.progress.filter((x) => x > a && x <= b), Math.min(b, SECONDS)]
      let mx = 0
      for (let i = 1; i < ev.length; i++) mx = Math.max(mx, ev[i]! - ev[i - 1]! - inMission(ev[i - 1]!, ev[i]!))
      return mx
    })
    const ids = runs.map((r) => r.idles.reduce((m, [x, y]) => Math.max(m, Math.min(y, b) - Math.max(x, a)), 0))
    if (process.argv.includes('--idles')) runs.forEach((r, i) => { const big = r.idles.filter(([x, y]) => y - x > 10 && x < b && y > a); if (big.length) console.log(`   seed ${i}: ${big.map(([x, y]) => `${fmt(x)}+${(y - x).toFixed(0)}s`).join(' ')}`) })
    const goal = gapGoal * (eff < 1 ? 1 / eff : 1)
    // waiting (nothing to do) must stay at 10 s or less in the first 5 minutes
    const ok = median(gs) <= goal && (a >= 300 || worst(ids) <= 10 * (eff < 1 ? 1 / eff : 1))
    if (eff === 1 && a < 300 && !ok) failed = true
    console.log(`${fmt(a)}-${fmt(b)}    ${median(gs).toFixed(1).padStart(5)}s / ${worst(gs).toFixed(1).padStart(5)}s (Ziel ≤ ${goal.toFixed(0)}s)   ${median(ids).toFixed(1).padStart(5)}s / ${worst(ids).toFixed(1).padStart(5)}s  ${ok ? 'ok' : '!!'}`)
  }
}
console.log(failed ? '\nBeat sheet: NICHT erfüllt' : '\nBeat sheet (erste 3 Min): OK')
if (process.argv.includes('--strict') && failed) process.exit(1)

void ROOM_ORDER
void ROOMS
void nextStationCost
void nextStaff
