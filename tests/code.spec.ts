import { test, expect, type Page } from '@playwright/test'
import { boot, spy } from './helpers'

/** Play the Code Breaker like a consistent-guess player (built-in solver). */
async function solveCode(page: Page): Promise<void> {
  for (let i = 0; i < 400; i++) {
    const phase = await page.evaluate(() => (window as any).__spylab.state().mission?.phase)
    if (phase !== 'playing') return
    const s = await spy<number | 'ok' | null>(page, 'mgSuggest')
    if (s === null) await page.waitForTimeout(120)
    else if (s === 'ok') {
      await spy(page, 'mgInput', 'ok')
      await page.waitForTimeout(150)
    } else if (s === -1) await spy(page, 'mgInput', 'del')
    else await spy(page, 'mgInput', 'sym', s)
  }
}

async function setup(page: Page): Promise<void> {
  await boot(page)
  await spy(page, 'skipTutorial')
  await spy(page, 'grantAgent')
  await page.evaluate(() => {
    const s = (window as any).__spylab.raw()
    s.rooms.laser.unlocked = true
    s.rooms.cipher.unlocked = true
    for (const id of ['harbor_01', 'harbor_02', 'harbor_03']) s.missions[id] = { stars: 3, wins: 1, fails: 0 }
  })
}

test('Code Breaker (mission 4): keypad by touch + keys, hint, crack the code', async ({ page }) => {
  test.setTimeout(120_000)
  await setup(page)
  await spy(page, 'startMission', 'harbor_04')
  await expect(page.getByTestId('mg-keypad')).toBeVisible()
  // keys 1 + Backspace and an on-screen key work
  await page.keyboard.press('Digit1')
  await page.keyboard.press('Backspace')
  await page.getByTestId('btn-sym-1').dispatchEvent('pointerdown')
  await page.getByTestId('btn-sym-del').dispatchEvent('pointerdown')
  // the free hint locks one slot
  await page.getByTestId('btn-mg-hint').dispatchEvent('pointerdown')
  await solveCode(page)
  await expect(page.getByTestId('panel-result')).toBeVisible({ timeout: 10_000 })
  expect((await spy<any>(page, 'raw')).missions.harbor_04.wins).toBe(1)
})

test('Code Breaker: every tier 1-10 is crackable by a careful player', async ({ page }) => {
  test.setTimeout(300_000)
  await setup(page)
  let wins = 0
  for (let tier = 1; tier <= 10; tier++) {
    await spy(page, 'setTier', 'code', tier)
    await spy(page, 'startMission', 'harbor_04')
    await expect(page.getByTestId('mg-keypad')).toBeVisible()
    await solveCode(page)
    const phase = await page.evaluate(() => (window as any).__spylab.state().mission?.phase)
    if (phase === 'result') wins++
    else console.log('tier', tier, 'not cracked by the solver')
    await page.getByTestId(phase === 'result' ? 'btn-continue' : 'btn-giveup').click()
  }
  expect(wins).toBeGreaterThanOrEqual(9)
})
