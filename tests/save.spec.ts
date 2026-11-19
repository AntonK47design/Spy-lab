import { test, expect } from '@playwright/test'
import { boot, expectClean, goTo, park, reload, solveSafe, spy, startFirstMission, state, trainingSetup, watch } from './helpers'

test('progress, rooms, agents, tutorial and settings survive reload', async ({ page }) => {
  test.setTimeout(150_000)
  const w = watch(page)
  await boot(page)
  await spy(page, 'addCurrency', 'cash', 600)
  await goTo(page, 'pad', 'laser')
  await expect.poll(async () => (await state(page)).rooms.laser.unlocked).toBe(true)
  await park(page)
  await startFirstMission(page)
  await solveSafe(page)
  await page.getByTestId('btn-continue').click()
  await page.getByTestId('bar-settings').click()
  await page.getByTestId('btn-mute').click()
  await page.getByTestId('lang-de').click()
  await page.getByTestId('btn-close').click()
  await spy(page, 'flushSave')
  const before = await state(page)

  await reload(page)
  const after = await state(page)
  expect(after.cash).toBe(before.cash)
  expect(after.rooms.laser.unlocked).toBe(true)
  expect(after.agents).toBe(before.agents)
  expect(after.missions.harbor_01.wins).toBe(1)
  expect(after.tutorial).toBe(before.tutorial)
  expect(after.userMuted).toBe(true)
  expect(after.lang).toBe('de')
  expect(after.save.reads).toBe(1) // exactly one storage.get at start
  await expect(page.getByTestId('bar-settings')).toHaveAttribute('aria-label', 'Einstellungen')
  expectClean(w)
})

test('progress survives rotation', async ({ page }) => {
  const w = watch(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await boot(page)
  await spy(page, 'addCurrency', 'cash', 7)
  await page.setViewportSize({ width: 844, height: 390 })
  await page.waitForTimeout(300)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  expect((await state(page)).cash).toBeGreaterThanOrEqual(7)
  await spy(page, 'flushSave')
  const c = (await state(page)).cash
  await reload(page)
  expect((await state(page)).cash).toBeGreaterThanOrEqual(c)
  expectClean(w)
})

test('writes are batched and throttled, flushed when the tab hides', async ({ page }) => {
  await boot(page)
  await page.waitForTimeout(300)
  const s0 = (await state(page)).save
  for (let i = 0; i < 20; i++) await spy(page, 'addCurrency', 'cash', 1)
  await page.waitForTimeout(500)
  const s1 = (await state(page)).save
  expect(s1.writes - s0.writes).toBeLessThanOrEqual(1)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(async () => (await state(page)).save.writes).toBeGreaterThan(s1.writes)
  const s2 = await state(page)
  expect(s2.running).toBe(false)
  expect(s2.audible).toBe(false)
})

test('offline earnings: hidden for 2 minutes -> welcome back popup', async ({ page }) => {
  await boot(page)
  await spy(page, 'skipTutorial')
  await trainingSetup(page)
  const setHidden = (h: boolean) =>
    page.evaluate((hidden) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
      document.dispatchEvent(new Event('visibilitychange'))
    }, h)
  await setHidden(true)
  await spy(page, 'timeWarp', 2)
  await setHidden(false)
  const welcome = page.getByTestId('panel-welcome')
  await expect(welcome).toBeVisible()
  const cash = (await state(page)).cash
  await welcome.getByTestId('btn-welcome-collect').click()
  expect((await state(page)).cash).toBeGreaterThan(cash)
})

test('offline earnings on boot use the saved lastSeen', async ({ page }) => {
  await boot(page)
  await spy(page, 'skipTutorial')
  await trainingSetup(page)
  await spy(page, 'flushSave')
  // pretend the session ended an hour ago (debug-only override; pagehide always writes lastSeen = now)
  await page.addInitScript(() => ((window as any).__spylabAwayOverride = 3600))
  await reload(page)
  await expect(page.getByTestId('panel-welcome')).toBeVisible()
})

test('clock turned back gives nothing', async ({ page }) => {
  await boot(page)
  await page.evaluate(async () => {
    const b = (window as any).bridge
    const raw = await b.storage.get(['spylab_v1_meta'])
    const meta = raw[0] ? (typeof raw[0] === 'string' ? JSON.parse(raw[0]) : raw[0]) : { v: 1, data: {} }
    meta.data.lastSeen = Date.now() + 5 * 3600_000
    await b.storage.set(['spylab_v1_meta'], [JSON.stringify(meta)])
  })
  await reload(page)
  await page.waitForTimeout(300)
  await expect(page.getByTestId('panel-welcome')).toHaveCount(0)
})
