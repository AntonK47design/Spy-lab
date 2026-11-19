import { test, expect } from '@playwright/test'
import { boot, expectClean, goTo, spy, state, watch } from './helpers'

test('boots: bridge first, game_ready after first frame, < 5 s, clean console', async ({ page }) => {
  const w = watch(page)
  const ms = await boot(page)
  expect(ms).toBeLessThan(5000)
  const marks = await page.evaluate(() => (window as any).__spylab.boot)
  expect(marks.bridge_ready).toBeLessThanOrEqual(marks.save_loaded)
  expect(marks.save_loaded).toBeLessThanOrEqual(marks.game_chunk)
  expect(marks.game_chunk).toBeLessThanOrEqual(marks.first_frame)
  expect(marks.first_frame).toBeLessThanOrEqual(marks.game_ready)
  await expect(page.locator('#loader')).toHaveCount(0)
  await expect(page.locator('#game-canvas')).toBeVisible()
  // the first tutorial step is visible right away
  await expect(page.getByTestId('coach')).toBeVisible()
  const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src || 'inline'))
  expect(scripts[0]).toContain('playgama-bridge.js')
  const stats = await spy<any>(page, 'stats')
  expect(stats.drawCalls).toBeLessThan(150)
  await page.waitForTimeout(500)
  expectClean(w)
})

test('first interaction within seconds: the first cash stack can be collected', async ({ page }) => {
  const w = watch(page)
  await boot(page)
  await expect.poll(async () => (await spy<any>(page, 'raw')).rooms.vault.stack, { timeout: 8000 }).toBeGreaterThan(0)
  await goTo(page, 'cash', 'vault')
  await expect.poll(async () => (await state(page)).cash, { timeout: 10_000 }).toBeGreaterThan(0)
  await expect.poll(async () => (await state(page)).tutorial).toBe(1)
  expectClean(w)
})

test('keyboard (WASD) moves the director, colliding with walls', async ({ page }) => {
  await boot(page)
  const a = await spy<any>(page, 'player')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(500)
  await page.keyboard.up('KeyW')
  const b = await spy<any>(page, 'player')
  expect(b.z).toBeLessThan(a.z - 0.5)
  // walk into the left wall for a long time: never leaves the corridor
  await spy(page, 'teleport', 0, -2)
  await page.keyboard.down('KeyA')
  await page.waitForTimeout(1200)
  await page.keyboard.up('KeyA')
  const c = await spy<any>(page, 'player')
  expect(c.x).toBeGreaterThan(-2.2)
})

test('touch-style drag joystick moves the director', async ({ page }) => {
  await boot(page)
  const a = await spy<any>(page, 'player')
  const vp = page.viewportSize()!
  await page.mouse.move(vp.width / 2, vp.height / 2)
  await page.mouse.down()
  await page.mouse.move(vp.width / 2, vp.height / 2 - 60, { steps: 4 })
  await page.waitForTimeout(500)
  await page.mouse.up()
  const b = await spy<any>(page, 'player')
  expect(b.z).toBeLessThan(a.z - 0.5)
})

test('stepping on the upgrade desk opens the room panel; buying works', async ({ page }) => {
  const w = watch(page)
  await boot(page)
  await spy(page, 'addCurrency', 'cash', 100)
  await goTo(page, 'upgrade', 'vault')
  const panel = page.getByTestId('panel-upgrade')
  await expect(panel).toBeVisible()
  await panel.getByTestId('buy-level').click()
  expect((await state(page)).rooms.vault.level).toBe(2)
  await panel.getByTestId('btn-close').click()
  await expect(panel).toHaveCount(0)
  expectClean(w)
})

test('unlock pad: standing on it pours cash in and builds the room', async ({ page }) => {
  await boot(page)
  await spy(page, 'addCurrency', 'cash', 500)
  await goTo(page, 'pad', 'laser')
  await expect.poll(async () => (await state(page)).rooms.laser.unlocked, { timeout: 5000 }).toBe(true)
  expect((await state(page)).cash).toBe(500 - 160)
})

test('settings popup has an X, pause via P, Esc is ignored', async ({ page }) => {
  const w = watch(page)
  await boot(page)
  await page.getByTestId('bar-settings').click()
  const panel = page.getByTestId('panel-settings')
  await expect(panel).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(panel).toBeVisible()
  await panel.getByTestId('btn-close').click()
  await expect(panel).toHaveCount(0)
  await page.keyboard.press('KeyP')
  await expect(page.getByTestId('panel-pause')).toBeVisible()
  expect((await state(page)).running).toBe(true)
  await page.getByTestId('btn-resume').click()
  await expect(page.getByTestId('panel-pause')).toHaveCount(0)
  expectClean(w)
})

test('long press: no context menu, no text selection', async ({ page }) => {
  await boot(page)
  const prevented = await page.evaluate(() => {
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    document.getElementById('game-canvas')!.dispatchEvent(ev)
    return ev.defaultPrevented
  })
  expect(prevented).toBe(true)
  const pill = page.getByTestId('hud-cash')
  const box = (await pill.boundingBox())!
  await page.mouse.move(box.x + 5, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x - 150, box.y + box.height / 2, { steps: 5 })
  await page.waitForTimeout(700)
  await page.mouse.up()
  expect(await page.evaluate(() => String(window.getSelection()))).toBe('')
})
