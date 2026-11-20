/**
 * Screenshot matrix of the remaining main screens (brief 13): missions map, briefing, daily,
 * Gadget Lab, Field Ops, relocation, office, every minigame and the boss cutscene - at all 15 sizes.
 * Each panel / HUD is checked for layout (inside the screen, no overlap, no clipped text).
 */
import { test, expect, type Page } from '@playwright/test'
import { boot, spy } from './helpers'
import { SIZES, assertLayout } from './matrix.spec'

async function shot(page: Page, screen: string, name: string, w: number, h: number) {
  await page.screenshot({ path: `tests/screenshots/${screen}-${name}-${w}x${h}.jpg`, type: 'jpeg', quality: 60 })
}

async function panel(page: Page, p: object, testid: string, screen: string, name: string, w: number, h: number) {
  await spy(page, 'openPanel', p)
  await expect(page.getByTestId(testid)).toBeVisible()
  await page.waitForTimeout(250)
  await expect(page.getByTestId(testid).getByTestId('btn-close').first()).toBeInViewport({ ratio: 0.99 })
  await assertLayout(page, w, h, `[data-testid="${testid}"]`)
  await shot(page, screen, name, w, h)
  await spy(page, 'openPanel', null)
}

const GAMES: [string, string, string][] = [
  ['laser', 'harbor_02', '[data-testid="btn-mg-pause"]'],
  ['code', 'harbor_04', '[data-testid="btn-mg-pause"], [data-testid="mg-keypad"]'],
  ['mole', 'harbor_07', '[data-testid="btn-mg-pause"], [data-testid="mg-clues"], [data-testid="btn-mg-hint"]'],
  ['scooter', 'snowpeak_01', '[data-testid="btn-mg-pause"], [data-testid="mg-chase"], [data-testid="btn-lane-left"], [data-testid="btn-lane-right"]'],
  ['circuit', 'snowpeak_05', '[data-testid="btn-mg-pause"], [data-testid="btn-mg-hint"]'],
]

for (const [name, w, h] of SIZES) {
  test(`screens ${name} ${w}x${h}`, async ({ page }) => {
    test.setTimeout(300_000)
    await page.setViewportSize({ width: w, height: h })
    await boot(page)
    await spy(page, 'skipTutorial')
    await spy(page, 'grantAgent')
    await page.evaluate(() => {
      const s = (window as any).__spylab.raw()
      for (const k of Object.keys(s.rooms)) s.rooms[k].unlocked = true
      for (const k of Object.keys(s.areas)) s.areas[k] = true
      for (let i = 1; i <= 10; i++) s.missions[`harbor_${String(i).padStart(2, '0')}`] = { stars: 2, wins: 1, fails: 0 }
      s.missions.harbor_boss = { stars: 3, wins: 1, fails: 0 }
      for (let i = 1; i <= 4; i++) s.missions[`snowpeak_0${i}`] = { stars: 1, wins: 1, fails: 0 }
      s.level = 15
      s.stats.earned = 5_000_000
      s.intel = 60
      s.badges = 4
      s.gadgets = { stethoscope: 2 }
    })
    await spy(page, 'addGraduates', 3)
    await panel(page, { kind: 'missions' }, 'panel-missions', 'map', name, w, h)
    await panel(page, { kind: 'briefing', mission: 'harbor_01' }, 'panel-briefing', 'briefing', name, w, h)
    await panel(page, { kind: 'daily' }, 'panel-daily', 'daily', name, w, h)
    await panel(page, { kind: 'lab' }, 'panel-lab', 'lab', name, w, h)
    await panel(page, { kind: 'fieldops' }, 'panel-fieldops', 'fieldops', name, w, h)
    await panel(page, { kind: 'prestige' }, 'panel-prestige', 'prestige', name, w, h)
    await panel(page, { kind: 'office' }, 'panel-office', 'office', name, w, h)
    for (const [game, mission, hud] of GAMES) {
      await spy(page, 'startMission', mission)
      await expect(page.getByTestId('btn-mg-pause')).toBeVisible({ timeout: 20_000 })
      await page.waitForTimeout(game === 'mole' ? 1500 : 800)
      await assertLayout(page, w, h, hud)
      await shot(page, game, name, w, h)
      await spy(page, 'mgFinish', false)
      await page.getByTestId('btn-giveup').click()
      // the mission_end interstitial (dev simulator) closes before the next one starts
      await page.waitForTimeout(500)
      await expect.poll(() => page.evaluate(() => (window as any).__spylab.state().adOpen), { timeout: 20_000 }).toBe(false)
      await page.waitForTimeout(300)
    }
  })
}
