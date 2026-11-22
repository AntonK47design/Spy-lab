import { test, expect } from '@playwright/test'
import { boot, spy, reload } from './helpers'

test('Relocate HQ: medals from lifetime cash, academy resets, agents/missions/badges stay, saved', async ({ page }) => {
  test.setTimeout(90_000)
  await boot(page)
  await spy(page, 'adGate', false) // a returning player (past the ad-free first mission)
  await spy(page, 'skipTutorial')
  await spy(page, 'grantAgent')
  await page.evaluate(() => {
    const s = (window as any).__spylab.raw()
    s.level = 15
    s.stats.earned = 10_000_000
    s.cash = 5_000_000
    s.badges = 7
    s.missions.harbor_01 = { stars: 3, wins: 1, fails: 0 }
    for (const k of ['laser', 'cipher']) s.rooms[k].unlocked = true
    s.rooms.vault.level = 30
  })
  await expect(page.getByTestId('bar-prestige')).toBeVisible()
  await page.getByTestId('bar-prestige').click()
  await expect(page.getByTestId('panel-prestige')).toBeVisible()
  await expect(page.getByTestId('prestige-gain')).toContainText('+6')
  await page.getByTestId('btn-relocate').click()
  await expect(page.getByTestId('panel-prestige')).toHaveCount(0)
  const s = await spy<any>(page, 'raw')
  expect(s.prestige).toBe(1)
  expect(s.medals).toBe(6)
  expect(s.level).toBe(1)
  expect(s.cash).toBeLessThan(1000)
  expect(s.rooms.vault.level).toBe(1)
  expect(s.rooms.laser.unlocked).toBe(false)
  expect(s.agents.length).toBeGreaterThan(0)
  expect(s.badges).toBe(7)
  expect(s.missions.harbor_01.wins).toBe(1)
  expect(JSON.stringify(await page.evaluate(() => (window as any).__spylab.adLog))).toContain('prestige')
  await spy(page, 'flushSave')
  await reload(page)
  const r = await spy<any>(page, 'raw')
  expect(r.prestige).toBe(1)
  expect(r.medals).toBe(6)
  expect(r.level).toBe(1)
})
