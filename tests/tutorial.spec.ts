import { test, expect } from '@playwright/test'
import { boot, goTo, park, reload, solveSafe, spy, state } from './helpers'

test('tutorial route: cash -> desk -> safe -> crate -> sign-up -> kits -> fees -> 2nd safe -> graduate -> hire at the office laptop -> mission', async ({ page }) => {
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
  // keep the safe supplied and the fees collected until the first cadet graduates
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
    // buy the second safe once affordable, sign up the next cadet
    if ((await state(page)).cash >= 27 && (await spy<any>(page, 'raw')).rooms.vault.stations < 2) {
      await goTo(page, 'station', 'vault', 1)
      await page.waitForTimeout(1500)
      await goTo(page, 'serve', 'vault')
      await page.waitForTimeout(1500)
    }
  }
  // no pop-up any more: the graduate waits in the agency office
  await expect.poll(async () => (await spy<any>(page, 'raw')).pending.length, { timeout: 20_000 }).toBeGreaterThan(0)
  await expect(page.getByTestId('panel-graduate')).toHaveCount(0)
  await expect.poll(tut).toBeGreaterThanOrEqual(9) // 'hire' step
  // the laptop on the office desk opens the menu: hire the first graduate
  await goTo(page, 'laptop', 'vault')
  await expect(page.getByTestId('panel-office')).toBeVisible()
  await page.getByTestId('btn-hire-0').click()
  await expect.poll(async () => (await state(page)).agents, { timeout: 10_000 }).toBe(1)
  await page.getByTestId('panel-office').getByTestId('btn-close').click()
  await expect.poll(tut).toBeGreaterThanOrEqual(10)
  await page.evaluate(() => ((window as any).__spylab.raw().tutorial = 10))
  await park(page)
  await page.getByTestId('bar-map').click()
  await page.getByTestId('mission-harbor_01').click()
  await page.getByTestId('btn-start-mission').click()
  await solveSafe(page)
  await page.getByTestId('btn-double-free').click()
  await page.getByTestId('btn-continue').click()
  await expect.poll(tut).toBe(11)
  await spy(page, 'flushSave')
  await reload(page)
  expect(await tut()).toBe(11) // never restarts
})
