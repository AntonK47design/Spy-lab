import { test, expect } from '@playwright/test'
import { boot, expectClean, spy, state, watch } from './helpers'

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
  await expect(page.getByTestId('orders')).toBeVisible()
  // Three.js must not have been requested before the Bridge was ready: it lives in the boot chunk
  const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src || 'inline'))
  expect(scripts[0]).toContain('playgama-bridge.js')
  await page.waitForTimeout(500)
  expectClean(w)
})

test('first interaction: tapping the cash stack pays out', async ({ page }) => {
  const w = watch(page)
  await boot(page)
  await page.waitForTimeout(600) // camera glide settles
  const p = await spy<{ x: number; y: number }>(page, 'tapCash')
  await page.mouse.click(p.x, p.y)
  await expect.poll(async () => (await state(page)).cash).toBe(1)
  expectClean(w)
})

test('settings popup has an X, pause via P, Esc is ignored', async ({ page }) => {
  const w = watch(page)
  await boot(page)
  await page.getByTestId('bar-settings').click()
  const panel = page.getByTestId('panel-settings')
  await expect(panel).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(panel).toBeVisible() // Esc does nothing (rule 1.5.2)
  await panel.getByTestId('btn-close').click()
  await expect(panel).toHaveCount(0)

  await page.keyboard.press('KeyP')
  await expect(page.getByTestId('panel-pause')).toBeVisible()
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
  await page.mouse.move(box.x + box.width + 200, box.y + box.height / 2, { steps: 5 })
  await page.waitForTimeout(700)
  await page.mouse.up()
  expect(await page.evaluate(() => String(window.getSelection()))).toBe('')
  const css = await page.evaluate(() => {
    const s = getComputedStyle(document.body)
    return { us: s.userSelect || (s as any).webkitUserSelect, ta: s.touchAction }
  })
  expect(css.us).toBe('none')
  expect(css.ta).toBe('none')
})

test('keyboard-only camera control works', async ({ page }) => {
  await boot(page)
  const before = await page.evaluate(() => (window as any).__spylab.tapCash().y)
  await page.keyboard.down('ArrowDown')
  await page.waitForTimeout(400)
  await page.keyboard.up('ArrowDown')
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => (window as any).__spylab.tapCash().y)
  expect(after).not.toBe(before)
})
