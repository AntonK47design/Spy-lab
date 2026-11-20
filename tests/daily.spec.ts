import { test, expect } from '@playwright/test'
import { boot, spy } from './helpers'

test('Daily rewards (claim + x2 via ad next day), contracts, achievements', async ({ page }) => {
  test.setTimeout(90_000)
  await boot(page)
  await spy(page, 'skipTutorial')
  await spy(page, 'grantAgent')
  await page.evaluate(() => {
    const s = (window as any).__spylab.raw()
    s.level = 5
    s.counter = true
    s.stats.missionsWon = 1
  })
  await page.getByTestId('bar-daily').click()
  await expect(page.getByTestId('panel-daily')).toBeVisible()
  const c0 = (await spy<any>(page, 'raw')).cash
  await page.getByTestId('btn-daily-claim').click()
  await expect(page.getByTestId('btn-daily-claim')).toHaveCount(0)
  let s = await spy<any>(page, 'raw')
  expect(s.cash).toBeGreaterThan(c0)
  expect(s.daily.streak).toBe(1)
  // achievement: first mission
  const b0 = s.badges
  await page.getByTestId('btn-ach-first_mission').click()
  s = await spy<any>(page, 'raw')
  expect(s.badges).toBe(b0 + 1)
  // contracts exist (level >= 4)
  await expect(page.getByTestId('contract-0')).toBeVisible()
  await page.getByTestId('btn-close').first().click()
  // next day: day 2 with the double
  await spy(page, 'timeWarp', 24 * 60)
  await page.getByTestId('bar-daily').click()
  const i0 = (await spy<any>(page, 'raw')).intel
  await page.getByTestId('btn-daily-double').click()
  await expect(page.getByTestId('btn-daily-claim')).toHaveCount(0, { timeout: 10_000 })
  s = await spy<any>(page, 'raw')
  expect(s.intel).toBe(i0 + 20)
  expect(s.daily.streak).toBe(2)
  expect(JSON.stringify(await page.evaluate(() => (window as any).__spylab.adLog))).toContain('daily_double')
  // a missed day resets the streak
  await spy(page, 'timeWarp', 3 * 24 * 60)
  await page.getByTestId('btn-close').first().click()
  await page.getByTestId('bar-daily').click()
  await expect(page.getByTestId('daily-0')).toHaveClass(/now/)
})
