/**
 * npm run sim — headless average-player simulation (no ads).
 * Collects, upgrades the best-value target, plays missions (70 % success, ~60 s each),
 * unlocks rooms when affordable. Prints unlock times against the pacing table.
 */
import { newGame, type GameState } from '../src/sim/state.ts'
import {
  setRng, tick, collect, upgradeLevel, buySlot, buySpeed, hireInstructor, payPad, canUnlock,
  levelCost, income, cycleTime, trainingRooms, nextUnlock,
} from '../src/sim/academy.ts'
import { missionLock, missionReward, recordWin, recordFail, bestAgent } from '../src/sim/missions.ts'
import { MISSIONS } from '../src/config/missions.ts'
import { ROOMS, type RoomId } from '../src/config/rooms.ts'
import { ECONOMY, slotCost, speedCost } from '../src/config/economy.ts'
import { createRng } from '../src/core/rng.ts'

const SECONDS = Number(process.argv[2] ?? 1500)
const DT = 0.25
const rng = createRng(42)
setRng(rng)

const s: GameState = newGame()
const t0: Record<string, number> = {}
const mark = (k: string, t: number) => {
  if (!(k in t0)) t0[k] = t
}

const ev = {
  graduate: () => mark('first_graduate', s.stats.playSeconds),
  levelUp: (l: number) => mark(`level_${l}`, s.stats.playSeconds),
  unlock: (r: RoomId) => mark(`unlock_${r}`, s.stats.playSeconds),
}

let busyUntil = 0 // bot is "walking" / playing a minigame
let lastCollect = 0
let missionsPlayed = 0
const ACTION_COST = 1.6 // seconds of walking per action
const MISSION_TIME = 55

function advance(sec: number) {
  for (let x = 0; x < sec; x += DT) tick(s, DT, ev)
}

type Option = { cost: number; gain: number; run: () => boolean; label: string }

function bestUpgrade(): Option | null {
  const opts: Option[] = []
  for (const id of trainingRooms(s)) {
    const r = s.rooms[id]
    const perCycle = income(s, id) / r.level
    const ct = cycleTime(s, id)
    const filled = Math.min(r.slots, s.cadets.filter((c) => c.room === id).length || 1)
    opts.push({ cost: levelCost(s, id), gain: (perCycle * filled) / ct, run: () => upgradeLevel(s, id, ev), label: `${id} lv` })
    if (r.slots < ECONOMY.slots.max)
      opts.push({ cost: slotCost(r.slots), gain: income(s, id) / ct, run: () => buySlot(s, id, ev), label: `${id} slot` })
    if (r.speed < ECONOMY.speed.max)
      opts.push({ cost: speedCost(r.speed), gain: ((income(s, id) * filled) / ct) * 0.087, run: () => buySpeed(s, id, ev), label: `${id} speed` })
  }
  opts.sort((a, b) => b.gain / b.cost - a.gain / a.cost)
  return opts[0] ?? null
}

for (let t = 0; t < SECONDS; t += DT) {
  tick(s, DT, ev)
  if (t < busyUntil) continue

  // 1. collect stacks every few seconds
  if (t - lastCollect > 5) {
    for (const id of trainingRooms(s)) {
      if (s.rooms[id].stack >= 1 && !s.rooms[id].instructor) {
        collect(s, id)
        mark('first_collect', t)
        busyUntil = t + ACTION_COST
      }
    }
    lastCollect = t
    if (t < busyUntil) continue
  }

  // 2. missions when available
  const m = MISSIONS.find((x) => missionLock(s, x) === 'ok' && !((s.missions[x.id]?.wins ?? 0) > 0)) ??
    (s.stats.playSeconds - (t0.last_mission ?? -999) > 150 ? MISSIONS.find((x) => missionLock(s, x) === 'ok') : undefined)
  if (m && s.agents.length > 0 && t - (t0.last_mission ?? -999) > 40) {
    mark(`mission_${m.id}`, t)
    advance(MISSION_TIME)
    t += MISSION_TIME
    const win = rng() < 0.7
    if (win) {
      const stars = 1 + Math.floor(rng() * 3)
      recordWin(s, m, stars, missionReward(s, m, stars), bestAgent(s, m), ev)
    } else recordFail(s, m)
    missionsPlayed++
    t0.last_mission = t
    continue
  }

  // 3. unlock next room
  const nu = nextUnlock(s)
  if (nu && canUnlock(s, nu)) {
    if (s.cash >= ROOMS[nu].unlockCost - s.rooms[nu].paid) mark(`affordable_${nu}`, t)
    const want = ROOMS[nu].unlockCost - s.rooms[nu].paid
    if (s.cash >= want) {
      payPad(s, nu, want, ev)
      busyUntil = t + ACTION_COST * 2
      continue
    }
  }

  // 4. instructor when cheap relative to cash
  for (const id of trainingRooms(s)) {
    if (!s.rooms[id].instructor && s.cash >= ROOMS[id].instructorCost && (!nu || ROOMS[id].instructorCost < ROOMS[nu].unlockCost * 1.5)) {
      hireInstructor(s, id, ev)
      mark('first_instructor', t)
      busyUntil = t + ACTION_COST
    }
  }

  // 5. best-value upgrade (keep a reserve when the next room is close)
  const up = bestUpgrade()
  const reserve = nu ? (ROOMS[nu].unlockCost - s.rooms[nu].paid) : 0
  if (up && s.cash >= up.cost && (s.cash - up.cost >= reserve * 0.6 || up.cost < reserve * 0.08)) {
    if (up.run()) {
      mark('first_upgrade', t)
      busyUntil = t + ACTION_COST
    }
  }
}

const fmt = (x?: number) => (x == null ? '   —  ' : `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`)
const targets: [string, string, number][] = [
  ['first_collect', 'Erstes Einsammeln', 5],
  ['first_upgrade', 'Erstes Upgrade', 15],
  ['first_graduate', 'Erster Absolvent', 40],
  ['mission_harbor_01', 'Mission 1', 45],
  ['affordable_laser', 'Laser Gym kaufbar', 90],
  ['first_instructor', 'Erster Ausbilder', 240],
  ['unlock_cipher', 'Cipher Room', 300],
  ['level_3', 'Akademie-Level 3', 390],
  ['unlock_disguise', 'Disguise Studio', 480],
  ['unlock_gadget', 'Gadget Lab', 600],
  ['unlock_driving', 'Driving Simulator', 840],
  ['unlock_hack', 'Hack Lab', 1200],
]
console.log(`\nSpy Lab economy sim — ${SECONDS}s, no ads, 70% mission success\n`)
console.log('Ereignis                Ziel    Sim     Abw.')
let inPhase1 = true
for (const [k, label, target] of targets) {
  const v = t0[k]
  const dev = v == null ? 'fehlt' : `${v >= target ? '+' : ''}${Math.round(((v - target) / target) * 100)}%`
  const ok = v != null && Math.abs(v - target) <= Math.max(target * 0.2, 8)
  if (target <= 180 && !ok) inPhase1 = false
  console.log(`${label.padEnd(22)}  ${fmt(target)}  ${fmt(v)}  ${dev.padStart(6)} ${ok ? 'ok' : ''}`)
}
console.log(`\nEnde: cash ${Math.round(s.cash)}, level ${s.level}, agents ${s.agents.length}, missions ${missionsPlayed}, earned ${Math.round(s.stats.earned)}`)
console.log(`Rooms: ${trainingRooms(s).map((id) => `${id} L${s.rooms[id].level}/S${s.rooms[id].slots}/V${s.rooms[id].speed}${s.rooms[id].instructor ? '/I' : ''}`).join('  ')}`)
console.log(inPhase1 ? '\nPhase-1-Pacing (bis 3:00): OK' : '\nPhase-1-Pacing (bis 3:00): NICHT erreicht')
if (process.argv.includes('--strict') && !inPhase1) process.exit(1)
