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
    for (let i = 1; i <= 4; i++) s.missions[`snowpeak_0${i}`] = { stars: 3, wins: 1, fails: 0 }
  })
}

const phase = (page: Page) => page.evaluate(() => (window as any).__spylab.state().mission?.phase)

/** Solve like a player: click the next wrong tile on a power path until all terminals light up. */
async function solve(page: Page): Promise<void> {
  for (let i = 0; i < 400 && (await phase(page)) === 'playing'; i++) {
    const p = await spy<{ x: number; y: number } | null>(page, 'mgNextTap')
    if (!p) break
    await page.mouse.click(p.x, p.y)
  }
}

test('Circuit Hack (Snowpeak 5): keyboard turn, hint, power every terminal', async ({ page }) => {
  test.setTimeout(120_000)
  await setup(page)
  await spy(page, 'startMission', 'snowpeak_05')
  await expect(page.getByTestId('mg-hud')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Space')
  await page.getByTestId('btn-mg-hint').dispatchEvent('pointerdown')
  await solve(page)
  await expect(page.getByTestId('panel-result')).toBeVisible({ timeout: 10_000 })
  expect((await spy<any>(page, 'raw')).missions.snowpeak_05.wins).toBe(1)
})

test('Circuit Hack: every tier 1-10 can be solved by clicking', async ({ page }) => {
  test.setTimeout(400_000)
  await setup(page)
  for (let tier = 1; tier <= 10; tier++) {
    await spy(page, 'setTier', 'circuit', tier)
    await spy(page, 'startMission', 'snowpeak_05')
    await expect(page.getByTestId('mg-hud')).toBeVisible()
    await solve(page)
    expect(await phase(page), `tier ${tier}`).toBe('result')
    await page.getByTestId('btn-continue').click()
  }
})
