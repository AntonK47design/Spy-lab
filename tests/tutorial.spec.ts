import { test, expect } from '@playwright/test'
import { boot, goTo, reload, spy, state } from './helpers'

test('short tutorial: cash -> desk -> safe -> crate -> sign-up -> kits, then the guide hints (hire at the laptop)', async ({ page }) => {
  test.setTimeout(180_000)
  await boot(page)
  await expect(page.getByTestId('coach')).toBeVisible()
  const tut = async () => (await state(page)).tutorial
  await goTo(page, 'welcome', 'vault')
  await expect.poll(tut).toBe(1)
  await goTo(page, 'serve', 'vault')
  await expect.poll(tut).toBe(2)
  await goTo(page, 'station', 'vault')
  await expect.poll(tut).toBe(3)
  await goTo(page, 'crate', 'vault')
  await expect.poll(tut, { timeout: 10_000 }).toBe(4)
  await goTo(page, 'serve', 'vault')
  await expect.poll(tut, { timeout: 10_000 }).toBe(5)
  // last step: bring kits to the cadet -> the short tutorial is over, free play
  await goTo(page, 'crate', 'vault')
  await page.waitForTimeout(700)
  await goTo(page, 'station', 'vault', 0)
  await expect.poll(tut, { timeout: 10_000 }).toBe(6)
  await expect(page.getByTestId('coach')).toHaveCount(0)
  // the guide arrow still hints: once a cadet graduates it points at the office laptop
  for (let i = 0; i < 40; i++) {
    if ((await spy<any>(page, 'raw')).pending.length > 0) break
    await goTo(page, 'crate', 'vault')
    await page.waitForTimeout(700)
    const st = (await spy<any>(page, 'raw')).rooms.vault.stations
    for (let k = 0; k < st; k++) {
      await goTo(page, 'station', 'vault', k)
      await page.waitForTimeout(400)
    }
    await goTo(page, 'cash', 'vault')
    await page.waitForTimeout(300)
    if ((await spy<any>(page, 'raw')).cadets.some((c: any) => c.phase === 'queue')) {
      await goTo(page, 'serve', 'vault')
      await page.waitForTimeout(1500)
    }
  }
  await expect.poll(async () => (await spy<any>(page, 'raw')).pending.length, { timeout: 20_000 }).toBeGreaterThan(0)
  const laptop = await spy<{ x: number; z: number }>(page, 'spot', 'laptop', 'vault')
  // spend the cash so no purchase outranks the hint
  await spy(page, 'addCurrency', 'cash', -1e9)
  await expect.poll(async () => (await spy<any>(page, 'guide'))?.kind).toBe('hire')
  const g = await spy<{ x: number; z: number }>(page, 'guide')
  expect(Math.hypot(g.x - laptop.x, g.z - laptop.z)).toBeLessThan(1.5)
  await spy(page, 'flushSave')
  await reload(page)
  expect(await tut()).toBe(6) // never restarts
})

test('walking only along the arrow + floor trail (real collisions, no teleport) finishes the tutorial', async ({ page }) => {
  test.setTimeout(120_000)
  await boot(page)
  await spy(page, 'autopilot', 'guide')
  // a stuck hero (arrow pointing into a wall) would never get past a step
  await expect.poll(async () => (await state(page)).tutorial, { timeout: 60_000, intervals: [500] }).toBe(6)
  await spy(page, 'autopilot', null)
})

test('arrow stays on the vault station; a floor trail leads around the bakery wall to it', async ({ page }) => {
  await boot(page)
  // on the sidewalk the desk is behind the shop front: the trail turns at the street door, marked
  await goTo(page, 'welcome', 'vault')
  await expect.poll(async () => (await state(page)).tutorial).toBe(1)
  await spy(page, 'teleport', 2.0, 14.2) // off the door line: the shop front is between hero and desk
  await expect.poll(async () => (await spy<any>(page, 'guideRoute')).corners).toBeGreaterThan(0)
  await goTo(page, 'serve', 'vault')
  await expect.poll(async () => (await state(page)).tutorial).toBe(2)
  const target = await spy<{ x: number; z: number; kind: string }>(page, 'guide')
  const station = await spy<{ x: number; z: number }>(page, 'spot', 'station', 'vault', 0)
  expect(target.kind).toBe('tut:station')
  expect(Math.hypot(target.x - station.x, target.z - station.z)).toBeLessThan(0.5)
  // the station is behind a wall: the trail bends (at least one corner) and is drawn
  await expect.poll(async () => (await spy<any>(page, 'guideRoute')).chevrons).toBeGreaterThan(3)
  expect((await spy<any>(page, 'guideRoute')).corners).toBeGreaterThan(0)
  const { route } = await spy<{ route: { x: number; z: number }[] }>(page, 'guideRoute')
  expect(route.length).toBeGreaterThanOrEqual(3)
  const end = route[route.length - 1]!
  expect(Math.hypot(end.x - station.x, end.z - station.z)).toBeLessThan(0.5)
  // standing in front of the station (straight reach): no trail
  await goTo(page, 'station', 'vault')
  await spy(page, 'teleport', station.x, station.z + 2)
  await expect.poll(async () => (await spy<any>(page, 'guideRoute')).chevrons).toBe(0)
  // cheap enough to re-plan several times per second (timed inside the page)
  await goTo(page, 'serve', 'vault')
  const ms = await page.evaluate(() => {
    const s = (window as any).__spylab
    const t0 = performance.now()
    for (let i = 0; i < 50; i++) s.guideRoute()
    return (performance.now() - t0) / 50
  })
  expect(ms).toBeLessThan(2)
})

test('opening is one straight line: spawn -> starting cash -> street door -> sign-up desk', async ({ page }) => {
  await boot(page)
  // the arrow points at the cash; nothing in the way, so no floor-trail detour
  expect((await spy<any>(page, 'guide')).kind).toBe('tut:cash')
  expect((await spy<any>(page, 'guideRoute')).route).toBeNull()
  // walk straight up (arrow key only) and the cash, then the desk, are reached without steering
  await page.mouse.click(5, 300)
  await page.keyboard.down('ArrowUp')
  await expect.poll(async () => (await state(page)).tutorial, { timeout: 15_000, intervals: [100] }).toBeGreaterThanOrEqual(2)
  await page.keyboard.up('ArrowUp')
  expect((await spy<any>(page, 'raw')).counter).toBe(true)
})
