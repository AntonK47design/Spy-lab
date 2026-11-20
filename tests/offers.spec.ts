import { test, expect, type Page } from '@playwright/test'
import { boot, spy } from './helpers'

async function setup(page: Page): Promise<void> {
  await boot(page)
  await spy(page, 'skipTutorial')
  await spy(page, 'grantAgent')
  await page.evaluate(() => {
    const s = (window as any).__spylab.raw()
    s.counter = true
    for (const k of ['laser', 'cipher', 'gadget']) s.rooms[k].unlocked = true
    s.rooms.vault.stations = 1
    s.rooms.vault.supply = [0]
  })
}
const adLog = (page: Page) => page.evaluate(() => JSON.stringify((window as any).__spylab.adLog))

test('Income boost, supply drone (first free), VIP recruit', async ({ page }) => {
  test.setTimeout(90_000)
  await setup(page)
  await page.getByTestId('bar-boost').click()
  await expect.poll(async () => (await spy<any>(page, 'raw')).boostUntil).toBeGreaterThan(0)
  await expect(page.getByTestId('bar-boost')).toContainText('x2')
  expect(await adLog(page)).toContain('income_boost')
  await spy(page, 'spawnOffers')
  await expect(page.getByTestId('bar-supply')).toBeVisible({ timeout: 5_000 })
  const before = await spy<any>(page, 'raw')
  await page.getByTestId('bar-supply').click()
  await expect(page.getByTestId('bar-supply')).toHaveCount(0)
  const after = await spy<any>(page, 'raw')
  expect(after.flags.supplyFreeUsed).toBe(true)
  expect(after.cash + after.badges * 1000 + JSON.stringify(after.gadgets).length).not.toBe(before.cash + before.badges * 1000 + JSON.stringify(before.gadgets).length)
  expect(await adLog(page)).not.toContain('supply_drop')
  await expect(page.getByTestId('bar-vip')).toBeVisible()
  const p0 = after.pending.length
  await page.getByTestId('bar-vip').click()
  await expect.poll(async () => (await spy<any>(page, 'raw')).pending.length).toBe(p0 + 1)
  const vip = (await spy<any>(page, 'raw')).pending.at(-1)
  expect(['rare', 'epic', 'legendary']).toContain(vip.agent.rarity)
  // the second crate needs an ad
  await spy(page, 'spawnOffers')
  await expect(page.getByTestId('bar-supply')).toBeVisible({ timeout: 5_000 })
  await page.getByTestId('bar-supply').click()
  await expect(page.getByTestId('bar-supply')).toHaveCount(0, { timeout: 10_000 })
  expect(await adLog(page)).toContain('supply_drop')
})

test('Missing cash, mission skip after 2 fails, welcome double, map_close', async ({ page }) => {
  test.setTimeout(90_000)
  await setup(page)
  // map_close interstitial (a natural pause, no rewarded in this flow yet)
  await spy(page, 'openPanel', { kind: 'missions' })
  await page.getByTestId('btn-close').first().click()
  expect(await adLog(page)).toContain('map_close')
  // missing cash in the upgrade folder: offered when at most 25 % are missing
  const cost = await spy<number>(page, 'levelCost', 'vault')
  await page.evaluate((c) => { (window as any).__spylab.raw().cash = Math.floor(c * 0.85) }, cost)
  await spy(page, 'openPanel', { kind: 'upgrade', room: 'vault' })
  await page.getByTestId('btn-missing-cash').click()
  await expect.poll(async () => (await spy<any>(page, 'raw')).cash).toBeGreaterThanOrEqual(cost)
  expect(await adLog(page)).toContain('missing_cash')
  await page.getByTestId('btn-close').first().click()
  // mission skip
  await page.evaluate(() => { (window as any).__spylab.raw().missions.harbor_01 = { stars: 0, wins: 0, fails: 2 } })
  await spy(page, 'startMission', 'harbor_01')
  await expect(page.getByTestId('mg-hud')).toBeVisible()
  await spy(page, 'mgFinish', false)
  await page.getByTestId('btn-skip').click()
  await expect(page.getByTestId('panel-result')).toBeVisible({ timeout: 10_000 })
  expect((await spy<any>(page, 'raw')).missions.harbor_01.wins).toBe(1)
  await page.getByTestId('btn-continue').click()
  // welcome back x2
  const c0 = (await spy<any>(page, 'raw')).cash
  await spy(page, 'openPanel', { kind: 'welcome', amount: 100, seconds: 600 })
  await page.getByTestId('btn-welcome-double').click()
  await expect(page.getByTestId('panel-welcome')).toHaveCount(0, { timeout: 10_000 })
  expect((await spy<any>(page, 'raw')).cash).toBe(c0 + 200)
})
