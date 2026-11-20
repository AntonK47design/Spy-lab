import { test, expect, type Page } from '@playwright/test'
import { boot, spy, reload } from './helpers'

async function setup(page: Page): Promise<void> {
  await boot(page)
  await spy(page, 'skipTutorial')
  await spy(page, 'grantAgent')
  await page.evaluate(() => {
    const s = (window as any).__spylab.raw()
    for (const k of Object.keys(s.rooms)) s.rooms[k].unlocked = true
    for (const k of Object.keys(s.areas)) s.areas[k] = true
    s.intel = 100
    s.badges = 3
  })
}

test('Gadget Lab: craft with intel + time, rush with a badge, use in a mission, trial via ad, saved', async ({ page }) => {
  test.setTimeout(120_000)
  await setup(page)
  await spy(page, 'openPanel', { kind: 'lab' })
  await expect(page.getByTestId('panel-lab')).toBeVisible()
  await page.getByTestId('btn-craft-stethoscope').click()
  await expect(page.getByTestId('lab-crafting')).toBeVisible()
  // one at a time
  await expect(page.getByTestId('btn-craft-mirror')).toBeDisabled()
  let s = await spy<any>(page, 'raw')
  expect(s.intel).toBe(88)
  // time passes -> ready
  await spy(page, 'timeWarp', 2)
  await expect.poll(async () => (await spy<any>(page, 'raw')).gadgets.stethoscope ?? 0).toBe(1)
  // rush the next one with a Gold Badge
  await page.getByTestId('btn-craft-stethoscope').click()
  await page.getByTestId('btn-lab-rush').click()
  s = await spy<any>(page, 'raw')
  expect(s.gadgets.stethoscope).toBe(2)
  expect(s.badges).toBe(2)
  await page.getByTestId('btn-close').first().click()
  // briefing: use one for mission 1 (safe)
  await spy(page, 'openPanel', { kind: 'briefing', mission: 'harbor_01' })
  await page.getByTestId('btn-gadget-use').click()
  await page.getByTestId('btn-start-mission').click()
  await expect(page.getByTestId('mg-hud')).toBeVisible()
  expect((await spy<any>(page, 'raw')).gadgets.stethoscope).toBe(1)
  await spy(page, 'mgFinish', false)
  await page.getByTestId('btn-giveup').click()
  // saved across a reload
  await spy(page, 'flushSave')
  await reload(page)
  expect((await spy<any>(page, 'raw')).gadgets.stethoscope).toBe(1)
  // trial via rewarded on a mission without stock (laser)
  await page.evaluate(() => {
    const s = (window as any).__spylab.raw()
    s.missions.harbor_01 = { stars: 3, wins: 1, fails: 0 }
    for (const k of Object.keys(s.rooms)) s.rooms[k].unlocked = true
  })
  await spy(page, 'openPanel', { kind: 'briefing', mission: 'harbor_02' })
  await page.getByTestId('btn-gadget-trial').click()
  await expect(page.getByTestId('btn-gadget-off')).toBeVisible({ timeout: 10_000 })
  expect(JSON.stringify(await page.evaluate(() => (window as any).__spylab.adLog))).toContain('gadget_trial')
})
