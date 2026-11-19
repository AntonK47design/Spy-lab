import { test, expect } from '@playwright/test'
import { boot, expectClean, spy, state, watch } from './helpers'

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
  expect(await pending).toBe('rewarded')
  const after = await state(page)
  expect(after.running).toBe(true)
  expect(after.adOpen).toBe(false)
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
  await spy(page, 'simulateAd', 'closed', 200)
  expect(await spy(page, 'showInterstitial', 'mission_end')).toBe(true)
  await page.waitForTimeout(400)
  await spy(page, 'simulateAd', 'rewarded', 200)
  expect(await spy(page, 'showRewarded', 'mission_double')).toBe('rewarded')
  expect(await spy(page, 'showInterstitial', 'mission_end')).toBe(false)
  const log = await page.evaluate(() => (window as any).__spylab.adLog)
  expect(log.map((l: any) => l.kind)).toEqual(['interstitial', 'rewarded'])
})

test('pause menu resume is an interstitial point', async ({ page }) => {
  await boot(page)
  await spy(page, 'simulateAd', 'closed', 200)
  await page.keyboard.press('KeyP')
  expect((await state(page)).running).toBe(true) // render loop keeps running, gameplay paused
  await page.getByTestId('btn-resume').click()
  const log = await page.evaluate(() => (window as any).__spylab.adLog)
  expect(log.at(-1)).toMatchObject({ kind: 'interstitial', placement: 'pause_resume' })
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
