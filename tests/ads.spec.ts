import { test, expect } from '@playwright/test'
import { boot, expectClean, spy, startFirstMission, state, watch } from './helpers'

test('rewarded: reward only on `rewarded`, game paused + muted while open', async ({ page }) => {
  const w = watch(page)
  await boot(page)
  await page.mouse.click(5, 300) // unlock audio
  await spy(page, 'simulateAd', 'rewarded', 1500)
  const pending = page.evaluate(() => (window as any).__spylab.showRewarded('mission_double'))
  await expect(page.getByTestId('sim-ad')).toBeVisible()
  const during = await state(page)
  expect(during.adOpen).toBe(true)
  expect(during.running).toBe(false)
  expect(during.audible).toBe(false)
  expect(['suspended', 'none']).toContain(during.audio.ctx)
  expect(during.audio.master).toBe(0)
  expect(during.audio.output).toBe(false) // output disconnected: silent even if a browser ignores suspend/gain
  expect(await pending).toBe('rewarded')
  const after = await state(page)
  expect(after.running).toBe(true)
  expect(after.adOpen).toBe(false)
  await expect.poll(async () => (await state(page)).audio.output).toBe(true)
  expectClean(w)
})

test('rewarded closed early or failed: no reward, game keeps running', async ({ page }) => {
  const w = watch(page)
  await boot(page)
  await spy(page, 'simulateAd', 'closed', 300)
  expect(await spy(page, 'showRewarded', 'mission_double')).toBe('closed')
  await spy(page, 'simulateAd', 'failed')
  expect(await spy(page, 'showRewarded', 'mission_double')).toBe('failed')
  const s = await state(page)
  expect(s.running).toBe(true)
  expect(s.adOpen).toBe(false)
  expectClean(w)
})

test('interstitial: forwarded at a pause, skipped right after a rewarded in the same flow', async ({ page }) => {
  await boot(page)
  // during the tutorial no interstitials at all
  expect(await spy(page, 'showInterstitial', 'mission_end')).toBe(false)
  await spy(page, 'skipTutorial')
  await spy(page, 'simulateAd', 'closed', 200)
  expect(await spy(page, 'showInterstitial', 'mission_end')).toBe(true)
  await page.waitForTimeout(400)
  await spy(page, 'simulateAd', 'rewarded', 200)
  expect(await spy(page, 'showRewarded', 'mission_double')).toBe('rewarded')
  expect(await spy(page, 'showInterstitial', 'mission_end')).toBe(false)
  const log = await page.evaluate(() => (window as any).__spylab.adLog)
  expect(log.map((l: any) => l.kind)).toEqual(['interstitial', 'rewarded'])
})

test('pause in a mission: resume never shows an interstitial (gameplay blocker)', async ({ page }) => {
  await boot(page)
  await startFirstMission(page)
  await spy(page, 'simulateAd', 'closed', 200)
  await page.getByTestId('btn-mg-pause').click()
  await expect(page.getByTestId('panel-pause')).toBeVisible()
  await page.getByTestId('btn-resume').click()
  await expect(page.getByTestId('panel-pause')).toHaveCount(0)
  const log = await page.evaluate(() => (window as any).__spylab.adLog)
  expect(log.filter((l: any) => l.placement === 'pause_resume')).toEqual([])
})

test('no ad support: rewarded resolves failed, nothing breaks', async ({ page }) => {
  const w = watch(page)
  await boot(page, '&adsim=unsupported')
  expect(await spy(page, 'showRewarded', 'mission_double')).toBe('failed')
  expect(await spy(page, 'showInterstitial', 'mission_end')).toBe(false)
  expectClean(w)
})

test('platform pause/mute (central handler) stops loop and audio', async ({ page }) => {
  await boot(page)
  await page.mouse.click(5, 300)
  await page.evaluate(() => ((window as any).__spylab.lifecycle.platformPaused.value = true))
  let s = await state(page)
  expect(s.running).toBe(false)
  expect(s.audible).toBe(false)
  await page.evaluate(() => {
    const l = (window as any).__spylab.lifecycle
    l.platformPaused.value = false
    l.platformAudioEnabled.value = false
  })
  s = await state(page)
  expect(s.running).toBe(true)
  expect(s.audible).toBe(false)
})

test('real Bridge path: rewarded pauses + mutes from the request on, before any ad event', async ({ page }) => {
  await boot(page, '&adsim=off')
  await page.mouse.click(5, 300) // unlock audio
  // a platform that is slow to report 'opened' (or never does): nothing arrives yet
  const r = await page.evaluate(() => {
    const a = (window as any).bridge.advertisement
    Object.defineProperty(a, 'isRewardedSupported', { get: () => true, configurable: true })
    a.showRewarded = () => {}
    const L = (window as any).__spylab.lifecycle
    const before = { adOpen: L.adOpen.value, audible: L.isAudible.value }
    void (window as any).__spylab.showRewarded('mission_double')
    return { before, adOpen: L.adOpen.value, running: L.isRunning.value, audible: L.isAudible.value }
  })
  expect(r.before.adOpen).toBe(false)
  expect(r.adOpen).toBe(true)
  expect(r.running).toBe(false)
  expect(r.audible).toBe(false)
  await expect.poll(async () => (await state(page)).audio.ctx).not.toBe('running')
})
