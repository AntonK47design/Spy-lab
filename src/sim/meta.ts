/** Daily rewards, daily contracts, achievements: pure logic on the game state. */
import { ACHIEVEMENTS, CONTRACTS, CONTRACTS_FROM_LEVEL, CONTRACTS_PER_DAY, DAILY, type DailyReward, type StatKey } from '../config/meta.ts'
import { GADGETS, GADGET } from '../config/gadgets.ts'
import { MISSIONS } from '../config/missions.ts'
import { totalRate } from './academy.ts'
import { totalStars } from './missions.ts'
import type { GameState } from './state.ts'

export const dayOf = (ms: number) => Math.floor(ms / 86_400_000)

export function statValue(s: GameState, k: StatKey | 'earned' | 'prestige' | 'bosses'): number {
  switch (k) {
    case 'stars': return totalStars(s)
    case 'graduates': return s.graduatedTotal
    case 'earned': return s.stats.earned
    case 'prestige': return s.prestige
    case 'bosses': return MISSIONS.filter((m) => m.boss && (s.missions[m.id]?.wins ?? 0) > 0).length
    default: return s.stats[k]
  }
}

// ---------------------------------------------------------------- daily rewards
/** Index of today's reward, or -1 if already claimed today. A missed day resets the streak. */
export function dailyIndex(s: GameState, nowMs: number): number {
  const today = dayOf(nowMs)
  if (s.daily.lastDay === today) return -1
  const keep = s.daily.lastDay === today - 1
  return keep ? s.daily.streak % DAILY.length : 0
}

export function dailyValue(s: GameState, r: DailyReward): number {
  if (r.kind === 'cash') return Math.max(r.min, Math.round(totalRate(s) * r.seconds))
  if (r.kind === 'badges' || r.kind === 'intel') return r.n
  return 1
}

/** Claim today's reward (x mult with the rewarded double). Returns what was granted. */
export function claimDaily(s: GameState, nowMs: number, mult = 1, rnd: () => number = Math.random): { reward: DailyReward; value: number; gadget?: string } | null {
  const i = dailyIndex(s, nowMs)
  if (i < 0) return null
  const r = DAILY[i]!
  const v = dailyValue(s, r) * mult
  let gadget: string | undefined
  if (r.kind === 'cash') {
    s.cash += v
    s.stats.earned += v
  } else if (r.kind === 'badges') s.badges += v
  else if (r.kind === 'intel') s.intel += v
  else {
    const g = GADGETS[Math.floor(rnd() * GADGETS.length)]!
    s.gadgets[g.id] = Math.min(GADGET.maxStock, (s.gadgets[g.id] ?? 0) + mult)
    gadget = g.id
  }
  s.daily = { lastDay: dayOf(nowMs), streak: i + 1 }
  return { reward: r, value: v, gadget }
}

// ---------------------------------------------------------------- contracts
export function contractsOpen(s: GameState): boolean {
  return s.level >= CONTRACTS_FROM_LEVEL
}

/** Make sure today's 3 contracts exist (baselines = stats at the start of the day). */
export function ensureContracts(s: GameState, nowMs: number): boolean {
  const today = dayOf(nowMs)
  if (!contractsOpen(s) || s.contracts.day === today) return false
  // deterministic pick per day
  const ids = CONTRACTS.map((c) => c.id)
  const pick: string[] = []
  // deterministic shuffle per day (32-bit integer LCG, bounded)
  let x = (Math.imul(today, 2654435761) ^ 0x9e3779b9) >>> 0
  for (let n = 0; n < 200 && pick.length < CONTRACTS_PER_DAY; n++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0
    const id = ids[(x >>> 16) % ids.length]!
    if (!pick.includes(id)) pick.push(id)
  }
  for (const id of ids) if (pick.length < CONTRACTS_PER_DAY && !pick.includes(id)) pick.push(id)
  s.contracts = { day: today, items: pick.map((id) => ({ id, base: statValue(s, CONTRACTS.find((c) => c.id === id)!.stat), claimed: false })) }
  return true
}

export function contractProgress(s: GameState, i: number): { goal: number; progress: number; badges: number } | null {
  const it = s.contracts.items[i]
  const def = it && CONTRACTS.find((c) => c.id === it.id)
  if (!it || !def) return null
  return { goal: def.goal, progress: Math.min(def.goal, statValue(s, def.stat) - it.base), badges: def.badges }
}

export function claimContract(s: GameState, i: number): number {
  const p = contractProgress(s, i)
  const it = s.contracts.items[i]
  if (!p || !it || it.claimed || p.progress < p.goal) return 0
  it.claimed = true
  s.badges += p.badges
  return p.badges
}

// ---------------------------------------------------------------- achievements
export function achievementProgress(s: GameState, id: string): { goal: number; progress: number; badges: number; claimed: boolean } | null {
  const a = ACHIEVEMENTS.find((x) => x.id === id)
  if (!a) return null
  return { goal: a.goal, progress: Math.min(a.goal, statValue(s, a.stat)), badges: a.badges, claimed: !!s.achievements[id] }
}

export function claimAchievement(s: GameState, id: string): number {
  const p = achievementProgress(s, id)
  if (!p || p.claimed || p.progress < p.goal) return 0
  s.achievements[id] = true
  s.badges += p.badges
  return p.badges
}

/** Something to claim (red dot on the HUD button). */
export function metaClaimable(s: GameState, nowMs: number): boolean {
  if (dailyIndex(s, nowMs) >= 0) return true
  if (s.contracts.items.some((_, i) => { const p = contractProgress(s, i); return !!p && p.progress >= p.goal && !s.contracts.items[i]!.claimed })) return true
  return ACHIEVEMENTS.some((a) => { const p = achievementProgress(s, a.id)!; return !p.claimed && p.progress >= p.goal })
}
