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
    s.level = 5
  })
}

const ui = (page: Page) => page.evaluate(() => (window as any).__spylab.state().mission)

async function waitPlaying(page: Page, stage: number): Promise<void> {
  await expect.poll(async () => { const u = await ui(page); return u?.phase === 'playing' ? u.stage : null }, { timeout: 15_000 }).toBe(stage)
}

test('Boss Captain Clawford: 3 stages, retry restarts, captured cutscene, badges, Snowpeak opens', async ({ page }) => {
  test.setTimeout(120_000)
  await setup(page)
  await spy(page, 'startMission', 'harbor_boss')
  await waitPlaying(page, 0)
  await expect(page.getByTestId('boss-stages')).toBeVisible()
  await spy(page, 'mgFinish', true)
  await expect(page.getByTestId('stage-clear')).toBeVisible()
  await waitPlaying(page, 1)
  // a failed stage: retry starts the boss over
  await spy(page, 'mgFinish', false)
  await expect(page.getByTestId('panel-fail')).toBeVisible()
  await page.getByTestId('btn-retry').click()
  await waitPlaying(page, 0)
  for (const st of [0, 1, 2]) {
    await waitPlaying(page, st)
    await spy(page, 'mgFinish', true)
  }
  await expect(page.getByTestId('captured')).toBeVisible()
  await expect(page.getByTestId('panel-result')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('reward-badges')).toBeVisible()
  const badges0 = (await spy<any>(page, 'raw')).badges
  expect(badges0).toBeGreaterThanOrEqual(5)
  await page.getByTestId('btn-continue').click()
  // boss_end interstitial is requested (dev simulator log)
  const log = await page.evaluate(() => (window as any).__spylab.adLog)
  expect(JSON.stringify(log)).toContain('boss_end')
  expect((await spy<any>(page, 'raw')).missions.harbor_boss.wins).toBe(1)
  // Vault Bonus is offered after the boss: fail once, extra attempt via rewarded, crack, collect
  await expect(page.getByTestId('panel-vault')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('btn-vault-start').click()
  await expect(page.getByTestId('vault-loot')).toBeVisible()
  await spy(page, 'mgFinish', false)
  await page.getByTestId('btn-vault-retry').click()
  await expect(page.getByTestId('vault-loot')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('btn-vault-retry')).toHaveCount(0)
  await spy(page, 'mgFinish', true)
  await expect(page.getByTestId('panel-vault-result')).toBeVisible()
  await expect(page.getByTestId('btn-vault-retry')).toHaveCount(0)
  await page.getByTestId('btn-vault-collect').click()
  expect(JSON.stringify(await page.evaluate(() => (window as any).__spylab.adLog))).toContain('vault_retry')
  await spy(page, 'startMission', 'snowpeak_01')
  await expect(page.getByTestId('mg-chase')).toBeVisible()
})
