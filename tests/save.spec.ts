import { test, expect } from '@playwright/test'
import { boot, expectClean, spy, state, watch } from './helpers'

test('progress + settings survive reload', async ({ page }) => {
  const w = watch(page)
  await boot(page)
  await spy(page, 'addCurrency', 'cash', 42)
  await page.getByTestId('bar-settings').click()
  await page.getByTestId('btn-mute').click()
  await page.getByTestId('lang-de').click()
  await page.getByTestId('btn-close').click()
  await spy(page, 'flushSave')
  const before = await state(page)
  expect(before.cash).toBe(42)
  expect(before.userMuted).toBe(true)
  expect(before.lang).toBe('de')

  await page.reload()
  await page.waitForFunction(() => (window as any).__spylab?.boot?.game_ready)
  const after = await state(page)
  expect(after.cash).toBe(42)
  expect(after.userMuted).toBe(true)
  expect(after.lang).toBe('de')
  expect(after.save.reads).toBe(1) // exactly one storage.get at start
  await expect(page.getByTestId('bar-settings')).toHaveAttribute('aria-label', 'Einstellungen')
  expectClean(w)
})

test('progress survives rotation', async ({ page }) => {
  const w = watch(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await boot(page)
  await spy(page, 'addCurrency', 'cash', 7)
  await page.setViewportSize({ width: 844, height: 390 })
  await page.waitForTimeout(300)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  expect((await state(page)).cash).toBe(7)
  await spy(page, 'flushSave')
  await page.reload()
  await page.waitForFunction(() => (window as any).__spylab?.boot?.game_ready)
  expect((await state(page)).cash).toBe(7)
  expectClean(w)
})

test('writes are batched and throttled, flushed when the tab hides', async ({ page }) => {
  await boot(page)
  for (let i = 0; i < 20; i++) await spy(page, 'addCurrency', 'cash', 1)
  await page.waitForTimeout(500)
  const s1 = (await state(page)).save
  expect(s1.writes).toBeLessThanOrEqual(1) // 20 changes -> at most one write so far
  await spy(page, 'addCurrency', 'cash', 1)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(async () => (await state(page)).save.writes).toBe(s1.writes + 1)
  const s2 = await state(page)
  expect(s2.running).toBe(false) // no loop while hidden
  expect(s2.audible).toBe(false)
})
