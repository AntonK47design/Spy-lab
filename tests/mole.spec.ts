import { test, expect, type Page } from '@playwright/test'
import { boot, spy } from './helpers'

async function setup(page: Page): Promise<void> {
  await boot(page)
  await spy(page, 'skipTutorial')
  await spy(page, 'grantAgent')
  await page.evaluate(() => {
    const s = (window as any).__spylab.raw()
    for (const r of ['laser', 'cipher', 'disguise']) s.rooms[r].unlocked = true
    for (let i = 1; i <= 6; i++) s.missions[`harbor_0${i}`] = { stars: 3, wins: 1, fails: 0 }
  })
}

const phase = (page: Page) => page.evaluate(() => (window as any).__spylab.state().mission?.phase)

/** Tap a traveller (mole or a wrong one) at its current screen position. */
async function tap(page: Page, wrong = false): Promise<void> {
  const p = await spy<{ x: number; y: number } | null>(page, 'mgTarget', wrong)
  if (!p) throw new Error('no target')
  await page.mouse.click(p.x, p.y)
}

async function waitClues(page: Page): Promise<void> {
  await expect.poll(() => spy(page, 'mgAllClues'), { timeout: 60_000 }).toBe(true)
}

test('Spot the Mole (mission 7): clues appear, wrong tap costs time, hint, tap the mole', async ({ page }) => {
  test.setTimeout(120_000)
  await setup(page)
  await spy(page, 'startMission', 'harbor_07')
  await expect(page.getByTestId('mg-clues')).toBeVisible()
  await expect(page.getByTestId('clue-0')).toBeVisible()
  await waitClues(page)
  await expect(page.getByTestId('clue-1')).toBeVisible()
  const t0 = await page.evaluate(() => (window as any).__spylab.mgHud().timeLeft)
  await tap(page, true)
  const t1 = await page.evaluate(() => (window as any).__spylab.mgHud().timeLeft)
  expect(t0 - t1).toBeGreaterThan(4)
  await page.getByTestId('btn-mg-hint').dispatchEvent('pointerdown')
  await page.waitForTimeout(300)
  await tap(page)
  await expect(page.getByTestId('panel-result')).toBeVisible({ timeout: 10_000 })
  expect((await spy<any>(page, 'raw')).missions.harbor_07.wins).toBe(1)
})

test('Spot the Mole: every tier 1-10 can be solved once all clues are out', async ({ page }) => {
  test.setTimeout(400_000)
  await setup(page)
  for (let tier = 1; tier <= 10; tier++) {
    await spy(page, 'setTier', 'mole', tier)
    await spy(page, 'startMission', 'harbor_07')
    await expect(page.getByTestId('mg-clues')).toBeVisible()
    await waitClues(page)
    for (let i = 0; i < 3 && (await phase(page)) === 'playing'; i++) {
      await tap(page)
      await page.waitForTimeout(300)
    }
    expect(await phase(page), `tier ${tier}`).toBe('result')
    await page.getByTestId('btn-continue').click()
  }
})
