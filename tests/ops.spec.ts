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
    s.level = 6
  })
}

test('Field Ops: send a graduate, finish now via ad, collect cash + intel', async ({ page }) => {
  test.setTimeout(90_000)
  await setup(page)
  await spy(page, 'addGraduates', 2)
  await spy(page, 'openPanel', { kind: 'missions' })
  await page.getByTestId('btn-fieldops').click()
  await expect(page.getByTestId('panel-fieldops')).toBeVisible()
  await page.getByTestId('btn-fieldop-0-1').click()
  await expect(page.getByTestId('fieldop-0')).toBeVisible()
  let s = await spy<any>(page, 'raw')
  expect(s.pending.length).toBe(1)
  const cash0 = s.cash
  const intel0 = s.intel
  await page.getByTestId('btn-fieldop-finish-0').click()
  await expect(page.getByTestId('btn-fieldop-collect-0')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('btn-fieldop-collect-0').click()
  s = await spy<any>(page, 'raw')
  expect(s.fieldOps.length).toBe(0)
  expect(s.cash).toBeGreaterThan(cash0)
  expect(s.intel).toBeGreaterThan(intel0)
  // a 5-minute op finishes by itself
  await page.getByTestId('btn-fieldop-0-0').click()
  await spy(page, 'timeWarp', 6)
  await expect(page.getByTestId('btn-fieldop-collect-0')).toBeVisible({ timeout: 5_000 })
})

test('Villain Alert: appears, opens a briefing, win pays Gold Badges; Endless Ops after Snowpeak', async ({ page }) => {
  test.setTimeout(90_000)
  await setup(page)
  await spy(page, 'spawnAlert')
  await expect(page.getByTestId('bar-alert')).toBeVisible({ timeout: 5_000 })
  await page.getByTestId('bar-alert').click()
  await expect(page.getByTestId('panel-briefing')).toBeVisible()
  const b0 = (await spy<any>(page, 'raw')).badges
  await page.getByTestId('btn-start-mission').click()
  await expect(page.getByTestId('mg-hud')).toBeVisible()
  await spy(page, 'mgFinish', true)
  await expect(page.getByTestId('panel-result')).toBeVisible()
  const s = await spy<any>(page, 'raw')
  expect(s.badges).toBe(b0 + 2)
  expect(s.alert).toBeNull()
  await page.getByTestId('btn-continue').click()
  await expect(page.getByTestId('bar-alert')).toHaveCount(0)
  // Endless Ops
  await page.evaluate(() => {
    const r = (window as any).__spylab.raw()
    r.missions.snowpeak_boss = { stars: 3, wins: 1, fails: 0 }
  })
  await spy(page, 'openPanel', { kind: 'missions' })
  await page.getByTestId('tab-region-endless').click()
  await page.getByTestId('mission-endless').click()
  await page.getByTestId('btn-start-mission').click()
  await expect(page.getByTestId('mg-hud')).toBeVisible()
  await spy(page, 'mgFinish', true)
  await expect(page.getByTestId('panel-result')).toBeVisible()
  expect((await spy<any>(page, 'raw')).endless).toBe(1)
})
