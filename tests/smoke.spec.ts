import { test, expect } from '@playwright/test'
import { boot, expectClean, goTo, spy, state, watch } from './helpers'

test('boots: bridge first, game_ready after first frame, < 5 s, clean console', async ({ page }) => {
  const w = watch(page)
  const ms = await boot(page)
  expect(ms).toBeLessThan(5000)
  const marks = await page.evaluate(() => (window as any).__spylab.boot)
  expect(marks.bridge_ready).toBeLessThanOrEqual(marks.save_loaded)
  expect(marks.save_loaded).toBeLessThanOrEqual(marks.game_chunk)
  expect(marks.game_chunk).toBeLessThanOrEqual(marks.first_frame)
  expect(marks.first_frame).toBeLessThanOrEqual(marks.game_ready)
  await expect(page.locator('#loader')).toHaveCount(0)
  await expect(page.locator('#game-canvas')).toBeVisible()
  // the first tutorial step is visible right away
  await expect(page.getByTestId('coach')).toBeVisible()
  const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src || 'inline'))
  expect(scripts[0]).toContain('playgama-bridge.js')
  const stats = await spy<any>(page, 'stats')
  expect(stats.drawCalls).toBeLessThan(150)
  await page.waitForTimeout(500)
  expectClean(w)
})

test('opening: cash next to the spawn, first purchases within seconds, first cadet waiting', async ({ page }) => {
  const w = watch(page)
  await boot(page)
  const s0 = await spy<any>(page, 'raw')
  expect(s0.cadets.some((c: any) => c.phase === 'queue')).toBe(true) // first customer already waiting
  const pl = await spy<any>(page, 'player')
  const ws = await spy<any>(page, 'spot', 'welcome', 'vault')
  expect(Math.hypot(pl.x - ws.x, pl.z - ws.z)).toBeLessThan(2) // first cash within 2 m
  await goTo(page, 'welcome', 'vault')
  await expect.poll(async () => (await state(page)).cash).toBe(30)
  await goTo(page, 'serve', 'vault')
  await expect.poll(async () => (await spy<any>(page, 'raw')).counter).toBe(true)
  await goTo(page, 'station', 'vault')
  await expect.poll(async () => (await spy<any>(page, 'raw')).rooms.vault.stations).toBe(1)
  await goTo(page, 'crate', 'vault')
  await expect.poll(async () => (await spy<any>(page, 'raw')).rooms.vault.crate, { timeout: 10_000 }).toBe(true) // load-tolerant
  await expect.poll(async () => (await state(page)).purchases).toBeGreaterThanOrEqual(3)
  await expect.poll(async () => (await state(page)).tutorial).toBeGreaterThanOrEqual(4)
  expectClean(w)
})

test('core loop: sign up a cadet, carry kits, station pays into the cash pile', async ({ page }) => {
  await boot(page)
  await spy(page, 'quickStart')
  await page.evaluate(() => ((window as any).__spylab.raw().rooms.vault.supply = [0]))
  await goTo(page, 'serve', 'vault')
  await expect.poll(async () => (await state(page)).served, { timeout: 10_000 }).toBe(1)
  await goTo(page, 'crate', 'vault')
  await expect.poll(async () => (await state(page)).carry.n).toBe(5)
  await expect.poll(async () => (await spy<any>(page, 'raw')).cadets.some((c: any) => c.phase === 'train'), { timeout: 15_000 }).toBe(true)
  await goTo(page, 'station', 'vault')
  await expect.poll(async () => (await spy<any>(page, 'raw')).rooms.vault.supply[0]).toBeGreaterThan(0)
  await expect.poll(async () => (await spy<any>(page, 'raw')).rooms.vault.stack, { timeout: 15_000 }).toBeGreaterThan(0)
  await goTo(page, 'cash', 'vault')
  await expect.poll(async () => (await state(page)).cash).toBeGreaterThan(0)
})

test('tap to explain shows a card without pausing', async ({ page }) => {
  await boot(page)
  await spy(page, 'quickStart')
  await page.waitForTimeout(300)
  const pos = await page.evaluate(() => {
    const g = (window as any).__spylab
    return g.screenOf ? g.screenOf('crate', 'vault') : null
  })
  if (pos) {
    await page.mouse.click(pos.x, pos.y)
    await expect(page.getByTestId('info-card')).toBeVisible()
    expect((await state(page)).running).toBe(true)
  }
})

test('keyboard (WASD) moves the director, colliding with walls', async ({ page }) => {
  await boot(page)
  const a = await spy<any>(page, 'player')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(500)
  await page.keyboard.up('KeyW')
  const b = await spy<any>(page, 'player')
  expect(b.z).toBeLessThan(a.z - 0.5)
  // walk into the Laser Gym's courtyard wall (beside its door) for a long time: the wall holds
  await spy(page, 'teleport', -4, 2.6)
  await page.keyboard.down('KeyA')
  await page.waitForTimeout(1500)
  await page.keyboard.up('KeyA')
  const c = await spy<any>(page, 'player')
  expect(c.x).toBeGreaterThan(-6)
  expect(c.x).toBeLessThan(-5)
})

test('touch-style drag joystick moves the director', async ({ page }) => {
  await boot(page)
  const a = await spy<any>(page, 'player')
  const vp = page.viewportSize()!
  await page.mouse.move(vp.width / 2, vp.height / 2)
  await page.mouse.down()
  await page.mouse.move(vp.width / 2, vp.height / 2 - 60, { steps: 4 })
  await page.waitForTimeout(500)
  await page.mouse.up()
  const b = await spy<any>(page, 'player')
  expect(b.z).toBeLessThan(a.z - 0.5)
})

test('stepping on the office desk opens the room panel; buying works', async ({ page }) => {
  const w = watch(page)
  await boot(page)
  await spy(page, 'quickStart')
  await spy(page, 'addCurrency', 'cash', 100)
  await goTo(page, 'upgrade', 'vault')
  const panel = page.getByTestId('panel-upgrade')
  await expect(panel).toBeVisible()
  await panel.getByTestId('buy-level').click()
  expect((await state(page)).rooms.vault.level).toBe(2)
  await panel.getByTestId('btn-close').click()
  await expect(panel).toHaveCount(0)
  expectClean(w)
})

test('unlock pad: standing on it pours cash in and builds the room', async ({ page }) => {
  await boot(page)
  await spy(page, 'addCurrency', 'cash', 500)
  await goTo(page, 'pad', 'laser')
  await expect.poll(async () => (await state(page)).rooms.laser.unlocked, { timeout: 5000 }).toBe(true)
  expect((await state(page)).cash).toBe(500 - 90)
})

test('settings popup has an X, Esc is ignored, no pause in the academy', async ({ page }) => {
  const w = watch(page)
  await boot(page)
  await page.getByTestId('bar-settings').click()
  const panel = page.getByTestId('panel-settings')
  await expect(panel).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(panel).toBeVisible()
  await panel.getByTestId('btn-close').click()
  await expect(panel).toHaveCount(0)
  await expect(page.getByTestId('bar-pause')).toHaveCount(0)
  await page.keyboard.press('KeyP')
  await page.waitForTimeout(300)
  await expect(page.getByTestId('panel-pause')).toHaveCount(0)
  expectClean(w)
})

test('long press: no context menu, no text selection', async ({ page }) => {
  await boot(page)
  const prevented = await page.evaluate(() => {
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    document.getElementById('game-canvas')!.dispatchEvent(ev)
    return ev.defaultPrevented
  })
  expect(prevented).toBe(true)
  const pill = page.getByTestId('hud-cash')
  const box = (await pill.boundingBox())!
  await page.mouse.move(box.x + 5, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x - 150, box.y + box.height / 2, { steps: 5 })
  await page.waitForTimeout(700)
  await page.mouse.up()
  expect(await page.evaluate(() => String(window.getSelection()))).toBe('')
})

test('agency office laptop: sell, hire and auto-sell the weakest', async ({ page }) => {
  await boot(page)
  await spy(page, 'quickStart')
  await spy(page, 'skipTutorial')
  await spy(page, 'addGraduates', 3)
  await expect(page.getByTestId('panel-graduate')).toHaveCount(0) // never pops up on its own
  await goTo(page, 'laptop', 'vault')
  await expect(page.getByTestId('panel-office')).toBeVisible()
  const cash0 = (await state(page)).cash
  await page.getByTestId('btn-sell-0').click()
  await expect.poll(async () => (await spy<any>(page, 'raw')).pending.length).toBe(2)
  expect((await state(page)).cash).toBeGreaterThan(cash0)
  await page.getByTestId('btn-hire-0').click()
  await expect.poll(async () => (await state(page)).agents).toBe(1)
  // fill the roster, then auto mode sells graduates that are not stronger than the weakest agent
  await page.evaluate(() => {
    const s = (window as any).__spylab.raw()
    s.rosterLimit = s.agents.length
  })
  await page.getByTestId('btn-auto-sell').click()
  await expect.poll(async () => (await spy<any>(page, 'raw')).flags.autoSellWeak).toBe(true)
  await spy(page, 'addGraduates', 4)
  await page.waitForTimeout(800)
  const left = await page.evaluate(() => {
    const s = (window as any).__spylab.raw()
    const pw = (a: any) => Object.values(a.skills).reduce((x: number, y: any) => x + y, 0) as number
    const floor = Math.min(...s.agents.map(pw))
    return s.pending.map((p: any) => pw(p.agent)).filter((p: number) => p <= floor).length
  })
  expect(left).toBe(0) // only stronger ones remain; they can be swapped in
})
