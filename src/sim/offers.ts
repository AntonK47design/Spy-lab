/** Rewarded academy offers: supply drop crate contents and the VIP recruit. */
import { OFFERS } from '../config/ads.ts'
import { AGENTS } from '../config/agents.ts'
import { GADGETS, GADGET, type GadgetId } from '../config/gadgets.ts'
import { createAgent, totalRate, agentFee } from './academy.ts'
import type { GameState } from './state.ts'

export type SupplyReward = { kind: 'cash'; amount: number } | { kind: 'badges'; amount: number } | { kind: 'gadget'; id: GadgetId }

export function openSupply(s: GameState, rnd: () => number = Math.random): SupplyReward {
  const w = OFFERS.supplyWeights
  const r = rnd()
  let out: SupplyReward
  if (r < w.cash || !s.rooms.gadget.unlocked && r < w.cash + w.gadget) {
    out = { kind: 'cash', amount: Math.max(50, Math.round(totalRate(s) * OFFERS.supplyCashSeconds)) }
  } else if (r < w.cash + w.badges) {
    out = { kind: 'badges', amount: OFFERS.supplyBadges }
  } else {
    const g = GADGETS[Math.floor(rnd() * GADGETS.length)]!
    out = { kind: 'gadget', id: g.id }
  }
  if (out.kind === 'cash') {
    s.cash += out.amount
    s.stats.earned += out.amount
  } else if (out.kind === 'badges') s.badges += out.amount
  else s.gadgets[out.id] = Math.min(GADGET.maxStock, (s.gadgets[out.id] ?? 0) + 1)
  return out
}

/** A rare-or-better graduate joins the office bench. */
export function vipRecruit(s: GameState, rnd: () => number = Math.random): void {
  const rooms = (['vault', 'laser', 'cipher', 'disguise', 'driving', 'hack'] as const).filter((id) => s.rooms[id].unlocked)
  const room = rooms[Math.floor(rnd() * rooms.length)] ?? 'vault'
  const a = createAgent(s, room)
  const want = rnd() < OFFERS.vipLegendaryChance ? 'legendary' : rnd() < OFFERS.vipEpicChance ? 'epic' : 'rare'
  const need = AGENTS.rarityThresholds.find((t) => t.rarity === want)!.total
  const skill = Object.keys(a.skills).find((k) => a.skills[k as keyof typeof a.skills] === Math.max(...Object.values(a.skills))) as keyof typeof a.skills
  const total = Object.values(a.skills).reduce((x, y) => x + y, 0)
  if (total < need) a.skills[skill] += need - total
  a.rarity = want
  s.pending.push({ agent: a, fee: agentFee(s, a), age: 0 })
}
