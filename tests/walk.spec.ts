import { test, expect, type Page } from '@playwright/test'
import { boot, spy } from './helpers'

/** Walk with the arrow keys (no teleport) to a point; returns false if blocked. */
async function walk(page: Page, tx: number, tz: number): Promise<boolean> {
  let last = { x: 1e9, z: 1e9 }
  let stuck = 0
  for (let i = 0; i < 300; i++) {
    const p = await spy<{ x: number; z: number }>(page, 'player')
    const dx = tx - p.x
    const dz = tz - p.z
    // one 70 ms press moves ~0.45 m: 0.5 m counts as arrived (well inside every pad radius)
    if (Math.hypot(dx, dz) < 0.5) return true
    stuck = Math.hypot(p.x - last.x, p.z - last.z) < 0.02 ? stuck + 1 : 0
    if (stuck > 20) { console.log("STUCK", tx, tz, "at", p.x.toFixed(2), p.z.toFixed(2)); return false }
    last = p
    const keys: string[] = []
    if (dx > 0.15) keys.push('ArrowRight')
    if (dx < -0.15) keys.push('ArrowLeft')
    if (dz > 0.15) keys.push('ArrowDown')
    if (dz < -0.15) keys.push('ArrowUp')
    for (const k of keys) await page.keyboard.down(k)
    await page.waitForTimeout(70)
    for (const k of keys) await page.keyboard.up(k)
  }
  console.log('GAVE UP', tx, tz)
  return false
}

test('walking from the street: build the desk, never trapped, first sign-up works', async ({ page }) => {
  test.setTimeout(360_000)
  await boot(page)
  await page.mouse.click(5, 300)
  const raw = () => spy<any>(page, 'raw')
  expect(await walk(page, 6.9, 13.4)).toBe(true) // welcome cash on the sidewalk
  expect(await walk(page, 6.9, 13.2)).toBe(true) // street door (in line with the desk)
  expect(await walk(page, 6.9, 11)).toBe(true)
  expect(await walk(page, 6.9, 7.4)).toBe(true) // desk pad
  await expect.poll(async () => (await raw()).counter, { timeout: 10_000 }).toBe(true)
  // the hero stands behind the built desk and can leave through the lane to the back door
  expect(await walk(page, 0.5, 7.0)).toBe(true)
  expect(await walk(page, 0, 4.6)).toBe(true)
  const s = await spy<{ x: number; z: number }>(page, 'spot', 'station', 'vault', 0)
  // through the Vault door (doors face the courtyard), then to the first safe
  expect(await walk(page, 5.2, 0.5)).toBe(true)
  expect(await walk(page, 7.4, 0.5)).toBe(true)
  expect(await walk(page, s.x, s.z - 0.4)).toBe(true)
  await expect.poll(async () => (await raw()).rooms.vault.stations, { timeout: 10_000 }).toBe(1)
  expect(await walk(page, 7.4, 0.5)).toBe(true)
  expect(await walk(page, 5.2, 0.5)).toBe(true)
  expect(await walk(page, 0, 4.6)).toBe(true)
  // along the middle of the 1.6 m lane behind the counter to the serve spot
  expect(await walk(page, 0.5, 7.0)).toBe(true)
  expect(await walk(page, 6.9, 7.0)).toBe(true)
  const pl = await spy<{ x: number; z: number }>(page, 'player')
  expect(pl.z).toBeLessThan(7.8) // behind the counter, not in front of it
  await expect.poll(async () => (await raw()).stats.served, { timeout: 10_000 }).toBeGreaterThan(0)
})
