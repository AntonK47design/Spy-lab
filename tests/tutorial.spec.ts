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
