/**
 * New-player pace, played in the real game for 5 minutes of game time: follow only the guide
 * arrow (tutorial, then "next useful step"), walk at hero speed (wait the walking time, then step
 * onto the target), handle every popup like a player. Measured:
 *  - waiting: stretches where the arrow shows nothing and no popup/mission is open,
 *  - gaps between progress beats (purchase, upgrade, mission win); time inside a mission counts as active.
 */
import { test, expect, type Page } from '@playwright/test'
import { boot, spy } from './helpers'

const HERO_SPEED = 6.5
const PATH_FACTOR = 1.25
const GAME_SECONDS = Number(process.env.PACE_SECONDS ?? 300)

type G = { x: number; z: number; kind: string } | null

async function ui(page: Page) {
  return page.evaluate(() => {
    const s = (window as any).__spylab
    const st = s.state()
    return { panel: st.panel as string | null, mission: st.mission?.phase as string | undefined, t: s.raw().stats.playSeconds as number }
  })
}

const TUT_STEPS = 14

async function clickIf(page: Page, id: string): Promise<boolean> {
  const l = page.getByTestId(id)
  if ((await l.count()) && (await l.first().isVisible()) && (await l.first().isEnabled())) {
    await l.first().click()
    return true
  }
  return false
}

test('new player: first 5 minutes are fast-paced (waiting <= 10 s, purchases keep coming)', async ({ page }) => {
  test.setTimeout((GAME_SECONDS * 2.5 + 120) * 1000)
  await boot(page)
  const idles: [number, number][] = []
  const missions: [number, number][] = []
  const beats: number[] = []
  let idleStart = -1
  let lastP = -1
  let missionStart = -1
  const log: string[] = []
  const wrongArrow: string[] = []
  const tutLog: string[] = []
  let lastTut = -1
  for (let guard = 0; guard < 4000; guard++) {
    const u = await ui(page)
    if (u.t >= GAME_SECONDS) break
    // progress beats
    const raw = await spy<any>(page, 'raw')
    const p = raw.stats.purchases + raw.stats.upgrades + raw.stats.missionsWon
    if (lastP >= 0 && p > lastP) beats.push(u.t)
    lastP = p
    // missions: play ~20 s, then win
    if (u.mission) {
      if (idleStart >= 0) { idles.push([idleStart, u.t]); idleStart = -1 }
      if (u.mission === 'playing') {
        if (missionStart < 0) missionStart = u.t
        if (u.t - missionStart >= 20) await spy(page, 'mgFinish', true)
        else await page.waitForTimeout(500)
      } else if (u.mission === 'result') {
        missions.push([missionStart, u.t])
        missionStart = -1
        if (!(await clickIf(page, 'btn-double-free'))) await clickIf(page, 'btn-continue')
        else await clickIf(page, 'btn-continue')
      } else if (u.mission === 'fail') await clickIf(page, 'btn-giveup')
      else await page.waitForTimeout(300)
      continue
    }
    // popups: answer like a player
    if (u.panel) {
      if (idleStart >= 0) { idles.push([idleStart, u.t]); idleStart = -1 }
      const done =
        (u.panel === 'levelup' && (await clickIf(page, 'btn-levelup-ok'))) ||
        (u.panel === 'office' && ((await clickIf(page, 'btn-hire-0')) || (await clickIf(page, 'btn-close')))) ||
        (u.panel === 'missions' && ((await page.locator('[data-testid^="mission-harbor"]:not([disabled])').count()) > 0)
          ? (await page.locator('[data-testid^="mission-harbor"]:not([disabled])').last().click(), true)
          : false) ||
        (u.panel === 'briefing' && (await clickIf(page, 'btn-start-mission'))) ||
        (u.panel === 'upgrade' && ((await clickIf(page, 'buy-level')) || (await clickIf(page, 'btn-close')))) ||
        (u.panel === 'welcome' && (await clickIf(page, 'btn-welcome-collect'))) ||
        (await clickIf(page, 'btn-close'))
      if (!done) await page.waitForTimeout(200)
      log.push(`${u.t.toFixed(0)} panel ${u.panel}`)
      continue
    }
    const g = await spy<G>(page, 'guide')
    if (!g) {
      if (idleStart < 0) {
        idleStart = u.t
        log.push(`${u.t.toFixed(0)} IDLE tut=${raw.tutorial} cash=${Math.floor(raw.cash)} cadets=${raw.cadets.map((c: any) => c.phase + (c.room ? ':' + c.room : '') + ':' + c.cycles + '/' + c.need).join(',')} stack=${Math.floor(raw.rooms.vault.stack)} supply=${raw.rooms.vault.supply} pending=${raw.pending.length} agents=${raw.agents.length}`)
      }
      await page.waitForTimeout(300)
      continue
    }
    if (idleStart >= 0) { idles.push([idleStart, u.t]); idleStart = -1 }
    // walk there at hero speed, then step on
    const at = await spy<{ x: number; z: number }>(page, 'player')
    const dist = Math.hypot(g.x - at.x, g.z - at.z)
    if (dist > 0.6) {
      await page.waitForTimeout(((dist * PATH_FACTOR) / HERO_SPEED) * 1000)
      await spy(page, 'teleport', g.x, g.z)
    }
    log.push(`${u.t.toFixed(0)} -> ${g.kind}`)
    // tutorial arrow matches the coach line: the step's own target, or a chore while saving up
    if (raw.tutorial < TUT_STEPS && g.kind.startsWith('tut-wait:')) wrongArrow.push(`${u.t.toFixed(0)}s step ${raw.tutorial}: ${g.kind}`)
    if (raw.tutorial !== lastTut) { tutLog.push(`${u.t.toFixed(0)}s step ${raw.tutorial} ${g.kind}`); lastTut = raw.tutorial }
    // stay a moment (pads pour cash, kits are picked / dropped, sign-ups take a second)
    await page.waitForTimeout(g.kind === 'serve' || g.kind.includes('serve') ? 1300 : 700)
  }
  if (idleStart >= 0) idles.push([idleStart, GAME_SECONDS])
  const inMission = (a: number, b: number) => missions.reduce((acc, [m0, m1]) => acc + Math.max(0, Math.min(b, m1) - Math.max(a, m0)), 0)
  const ev = [0, ...beats.filter((x) => x <= GAME_SECONDS), GAME_SECONDS]
  const gaps = ev.slice(1).map((x, i) => ({ at: ev[i]!, gap: x - ev[i]! - inMission(ev[i]!, x) }))
  const maxGap = gaps.reduce((m, g) => (g.gap > m.gap ? g : m), { at: 0, gap: 0 })
  const maxIdle = idles.reduce((m, [a, b]) => Math.max(m, b - a), 0)
  const summary = `beats ${beats.length}, missions ${missions.length}, longest gap ${maxGap.gap.toFixed(1)}s at ${maxGap.at.toFixed(0)}s, longest wait ${maxIdle.toFixed(1)}s, gaps>10s: ${gaps.filter((g) => g.gap > 10).map((g) => `${g.at.toFixed(0)}s:${g.gap.toFixed(0)}`).join(' ')}`
  console.log(summary)
  // per window (the later minutes may slow down a little)
  for (const [a, b] of [[0, 300], [300, 600], [600, 900], [900, 1200]] as const) {
    if (a >= GAME_SECONDS) break
    const w = gaps.filter((g) => g.at >= a && g.at < b)
    const n = beats.filter((x) => x >= a && x < b).length
    console.log(`window ${a / 60}-${b / 60} min: beats ${n}, longest gap ${w.reduce((m, g) => Math.max(m, g.gap), 0).toFixed(1)}s, longest wait ${idles.filter(([x]) => x >= a && x < b).reduce((m, [x, y]) => Math.max(m, y - x), 0).toFixed(1)}s`)
  }
  console.log(log.filter((l) => { const t = Number(l.split(' ')[0]); return t >= Number(process.env.FROM ?? 0) }).slice(0, 60).join(' | '))
  expect(maxIdle, summary).toBeLessThanOrEqual(10)
  expect(maxGap.gap, summary).toBeLessThanOrEqual(35)
  console.log('tutorial: ' + tutLog.join(' | '))
  expect(wrongArrow.filter((w) => /tut-wait:(pad|level|mission)/.test(w)), 'tutorial arrow pointed at an unrelated purchase').toEqual([])
  expect(beats.length, summary).toBeGreaterThanOrEqual(25)
})
