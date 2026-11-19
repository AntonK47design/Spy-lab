import { test, expect } from '@playwright/test'
import { boot, goTo, park, reload, solveSafe, spy, state } from './helpers'

test('tutorial by playing: collect -> upgrade -> graduate -> mission -> unlock', async ({ page }) => {
  test.setTimeout(120_000)
  await boot(page)
  await expect(page.getByTestId('coach')).toBeVisible()
  await expect.poll(async () => (await spy<any>(page, 'raw')).rooms.vault.stack, { timeout: 8000 }).toBeGreaterThan(0)
  await goTo(page, 'cash', 'vault')
  await expect.poll(async () => (await state(page)).tutorial).toBe(1)
  // earn the first upgrade by collecting (no debug money)
  await expect.poll(async () => {
    await goTo(page, 'cash', 'vault')
    return (await state(page)).cash
  }, { timeout: 20_000 }).toBeGreaterThanOrEqual(12)
  await goTo(page, 'upgrade', 'vault')
  await page.getByTestId('buy-level').click()
  await page.getByTestId('btn-close').click()
  await park(page)
  await expect.poll(async () => (await state(page)).tutorial).toBe(2)
  // the first cadet graduates by itself (~40 s into the session)
  await expect(page.getByTestId('panel-agent')).toBeVisible({ timeout: 45_000 })
  await page.getByTestId('btn-agent-ok').click()
  await expect.poll(async () => (await state(page)).tutorial).toBe(3)
  await page.getByTestId('bar-map').click()
  await page.getByTestId('mission-harbor_01').click()
  await page.getByTestId('btn-start-mission').click()
  await solveSafe(page)
  await page.getByTestId('btn-double-free').click()
  await page.getByTestId('btn-continue').click()
  await expect.poll(async () => (await state(page)).tutorial).toBe(4)
  await spy(page, 'flushSave')
  await reload(page)
  expect((await state(page)).tutorial).toBe(4) // never restarts
})
