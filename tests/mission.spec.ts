import { test, expect } from '@playwright/test'
import { boot, expectClean, failSafe, park, solveSafe, spy, startFirstMission, state, watch } from './helpers'

test('mission flow: briefing -> Safe Cracker -> stars -> free x2 demo -> continue', async ({ page }) => {
  const w = watch(page)
  await boot(page)
  await startFirstMission(page, true)
  await solveSafe(page)
  const result = page.getByTestId('panel-result')
  await expect(result).toBeVisible()
  const s1 = await state(page)
  expect(s1.mission.stars).toBeGreaterThanOrEqual(1)
  const cash = s1.cash
  // first double is a free demo (no ad), tutorial blocks interstitials
  await result.getByTestId('btn-double-free').click()
  expect((await state(page)).cash).toBe(cash + s1.mission.cash)
  await result.getByTestId('btn-continue').click()
  await expect(result).toHaveCount(0)
  const s2 = await state(page)
  expect(s2.mode).toBe('academy')
  expect(s2.missions.harbor_01.wins).toBe(1)
  expect(await page.evaluate(() => (window as any).__spylab.adLog)).toEqual([])
  expectClean(w)
})

test('x2 after the demo needs a watched ad; closing early grants nothing', async ({ page }) => {
  await boot(page)
  await spy(page, 'raw').then(() => page.evaluate(() => ((window as any).__spylab.raw().flags.firstDoubleFree = true)))
  await startFirstMission(page)
  await solveSafe(page)
  const cash = (await state(page)).cash
  await spy(page, 'simulateAd', 'closed', 200)
  await page.getByTestId('btn-double-ad').click()
  await page.waitForTimeout(500)
  expect((await state(page)).cash).toBe(cash)
  await spy(page, 'simulateAd', 'rewarded', 200)
  await page.getByTestId('btn-double-ad').click()
  await expect.poll(async () => (await state(page)).cash).toBeGreaterThan(cash)
  // a rewarded was watched in this flow -> no interstitial on Continue
  await page.getByTestId('btn-continue').click()
  const log = await page.evaluate(() => (window as any).__spylab.adLog)
  expect(log.filter((l: any) => l.kind === 'interstitial')).toEqual([])
})

test('Continue without a rewarded is an interstitial point (mission_end)', async ({ page }) => {
  await boot(page)
  await startFirstMission(page)
  await spy(page, 'adGate', false) // past the ad-free first mission
  await solveSafe(page)
  await spy(page, 'simulateAd', 'closed', 200)
  await page.getByTestId('btn-continue').click()
  const log = await page.evaluate(() => (window as any).__spylab.adLog)
  expect(log).toEqual([{ kind: 'interstitial', placement: 'mission_end', outcome: 'closed' }])
})

test('revive is offered at most once per attempt; retry starts a new attempt', async ({ page }) => {
  await boot(page)
  await startFirstMission(page)
  await failSafe(page)
  const fail = page.getByTestId('panel-fail')
  await expect(fail).toBeVisible()
  await spy(page, 'simulateAd', 'rewarded', 200)
  await fail.getByTestId('btn-revive').click()
  await expect(page.getByTestId('mg-hud')).toBeVisible()
  await failSafe(page)
  await expect(fail).toBeVisible()
  await expect(fail.getByTestId('btn-revive')).toHaveCount(0) // once per attempt (2.2.4)
  await fail.getByTestId('btn-retry').click()
  await expect(page.getByTestId('mg-hud')).toBeVisible()
  await failSafe(page)
  await expect(fail.getByTestId('btn-revive')).toBeVisible()
  await fail.getByTestId('btn-giveup').click()
  expect((await state(page)).mode).toBe('academy')
})

test('revive with a failed ad: no continue, game stays playable', async ({ page }) => {
  const w = watch(page)
  await boot(page)
  await startFirstMission(page)
  await failSafe(page)
  await spy(page, 'simulateAd', 'failed')
  await page.getByTestId('btn-revive').click()
  await expect(page.getByTestId('toast')).toBeVisible()
  await expect(page.getByTestId('panel-fail')).toBeVisible()
  await page.getByTestId('btn-giveup').click()
  // the closing interstitial may run first; afterwards the game is running again
  await expect.poll(async () => (await state(page)).running, { timeout: 5000 }).toBe(true)
  expect((await state(page)).mode).toBe('academy')
  expectClean(w)
})

test('rewarded buttons are hidden when rewarded ads are unsupported', async ({ page }) => {
  await boot(page, '&adsim=unsupported')
  await page.evaluate(() => ((window as any).__spylab.raw().flags.firstDoubleFree = true))
  await startFirstMission(page)
  await solveSafe(page)
  await expect(page.getByTestId('panel-result')).toBeVisible()
  await expect(page.getByTestId('btn-double-ad')).toHaveCount(0)
  await page.getByTestId('btn-continue').click()
  await park(page)
})

test('pause during a minigame freezes it', async ({ page }) => {
  await boot(page)
  await startFirstMission(page)
  await page.getByTestId('btn-mg-pause').click()
  await expect(page.getByTestId('panel-pause')).toBeVisible()
  const t1 = await page.evaluate(() => (window as any).__spylab.raw().stats.playSeconds)
  await page.waitForTimeout(600)
  const t2 = await page.evaluate(() => (window as any).__spylab.raw().stats.playSeconds)
  expect(t2).toBe(t1)
  await page.getByTestId('btn-resume').click()
  await expect(page.getByTestId('mg-hud')).toBeVisible()
})
