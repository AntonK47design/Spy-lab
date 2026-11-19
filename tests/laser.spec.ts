import { test, expect } from '@playwright/test'
import { boot, spy, state } from './helpers'

/** Play the Laser Hall with the built-in planner (safe moves only). */
async function solveLaser(page: import('@playwright/test').Page): Promise<void> {
  for (let i = 0; i < 1500; i++) {
    const phase = await page.evaluate(() => (window as any).__spylab.state().mission?.phase)
    if (phase !== 'playing') return
    const next = await spy<string | null>(page, 'mgNext')
    if (next && next !== 'wait') await spy(page, 'mgMove', next)
    await page.waitForTimeout(40)
  }
}

test('Laser Hall (mission 2): hop through the corridor to the briefcase', async ({ page }) => {
  test.setTimeout(150_000)
  await boot(page)
  await spy(page, 'skipTutorial')
  await spy(page, 'grantAgent')
  await page.evaluate(() => {
    const s = (window as any).__spylab.raw()
    s.rooms.laser.unlocked = true
    s.missions.harbor_01 = { stars: 3, wins: 1, fails: 0 }
  })
  await spy(page, 'startMission', 'harbor_02')
  await expect(page.getByTestId('mg-hud')).toBeVisible()
  // keyboard works: one hop forward
  await page.keyboard.press('ArrowUp')
  await solveLaser(page)
  await expect(page.getByTestId('panel-result')).toBeVisible({ timeout: 10_000 })
  const s = await spy<any>(page, 'raw')
  expect(s.missions.harbor_02.wins).toBe(1)
  await page.getByTestId('btn-continue').click()
  expect((await state(page)).mode).toBe('academy')
})

test('Laser Hall: every tier 1-10 can be finished (planner, no hits)', async ({ page }) => {
  test.setTimeout(300_000)
  await boot(page)
  await spy(page, 'skipTutorial')
  await spy(page, 'grantAgent')
  await page.evaluate(() => {
    const s = (window as any).__spylab.raw()
    s.rooms.laser.unlocked = true
    s.missions.harbor_01 = { stars: 3, wins: 1, fails: 0 }
  })
  for (let tier = 1; tier <= 10; tier++) {
    await spy(page, 'setTier', 'laser', tier)
    await spy(page, 'startMission', 'harbor_02')
    await expect(page.getByTestId('mg-hud')).toBeVisible()
    await solveLaser(page)
    await expect(page.getByTestId('panel-result'), `tier ${tier}`).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('btn-continue').click()
  }
})
