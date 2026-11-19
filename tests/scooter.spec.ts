import { test, expect, type Page } from '@playwright/test'
import { boot, spy } from './helpers'

async function setup(page: Page): Promise<void> {
  await boot(page)
  await spy(page, 'skipTutorial')
  await spy(page, 'grantAgent')
  await page.evaluate(() => {
    const s = (window as any).__spylab.raw()
    for (const k of Object.keys(s.rooms)) s.rooms[k].unlocked = true
    for (const k of Object.keys(s.areas)) s.areas[k] = true
    for (let i = 1; i <= 10; i++) s.missions[`harbor_${String(i).padStart(2, '0')}`] = { stars: 3, wins: 1, fails: 0 }
  })
}

const phase = (page: Page) => page.evaluate(() => (window as any).__spylab.state().mission?.phase)

/** Ride like a careful player: follow the planner's lane advice. */
async function ride(page: Page): Promise<void> {
  for (let i = 0; i < 2000 && (await phase(page)) === 'playing'; i++) {
    const m = await spy<string | null>(page, 'mgNext')
    if (m === 'left' || m === 'right') await spy(page, 'mgMove', m)
    await page.waitForTimeout(40)
  }
}

test('Scooter Pursuit (Snowpeak 1): lane buttons, keys, catch the thief', async ({ page }) => {
  test.setTimeout(120_000)
  await setup(page)
  await spy(page, 'startMission', 'snowpeak_01')
  await expect(page.getByTestId('mg-chase')).toBeVisible()
  await page.getByTestId('btn-lane-left').dispatchEvent('pointerdown')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('KeyD')
  await ride(page)
  await expect(page.getByTestId('panel-result')).toBeVisible({ timeout: 10_000 })
  expect((await spy<any>(page, 'raw')).missions.snowpeak_01.wins).toBe(1)
})

test('Scooter Pursuit: every tier 1-10 can be won by a careful rider', async ({ page }) => {
  test.setTimeout(900_000)
  await setup(page)
  for (let tier = 1; tier <= 10; tier++) {
    await spy(page, 'setTier', 'scooter', tier)
    await spy(page, 'startMission', 'snowpeak_01')
    await expect(page.getByTestId('mg-chase')).toBeVisible()
    await ride(page)
    const crashes = await page.evaluate(() => (window as any).__spylab.mgHud()?.mistakes)
    expect(await phase(page), `tier ${tier} (crashes ${crashes})`).toBe('result')
    await page.getByTestId('btn-continue').click()
  }
})
