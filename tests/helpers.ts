import { expect, type Page } from '@playwright/test'

/** Requests the Bridge itself may make on the mock platform (server time). Everything else must be local. */
const ALLOWED_EXTERNAL = [/^https:\/\/api\.playgama\.com\/api\/bridge\//]

export interface Watch {
  errors: string[]
  external: string[]
}

export function watch(page: Page): Watch {
  const w: Watch = { errors: [], external: [] }
  page.on('pageerror', (e) => w.errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') w.errors.push(`console: ${m.text()}`)
  })
  page.on('request', (r) => {
    const u = r.url()
    if (u.startsWith('http://localhost') || u.startsWith('data:') || u.startsWith('blob:')) return
    if (ALLOWED_EXTERNAL.some((re) => re.test(u))) return
    w.external.push(u)
  })
  return w
}

export async function boot(page: Page, query = '', quality: 'low' | 'auto' = 'low'): Promise<number> {
  const t0 = Date.now()
  await page.goto(`/?debug=1${quality === 'low' ? '&quality=low' : ''}${query}`)
  await page.waitForFunction(() => (window as any).__spylab?.boot?.game_ready, null, { timeout: 15_000 })
  return Date.now() - t0
}

export async function reload(page: Page): Promise<void> {
  await page.reload()
  await page.waitForFunction(() => (window as any).__spylab?.boot?.game_ready, null, { timeout: 15_000 })
}

export function expectClean(w: Watch): void {
  expect(w.errors, w.errors.join('\n')).toEqual([])
  expect(w.external, w.external.join('\n')).toEqual([])
}

export const spy = <T = any>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(
    ([f, a]) => {
      const api = (window as any).__spylab
      return f.split('.').reduce((o: any, k: string) => o[k], api).apply(api, a)
    },
    [fn, args] as const,
  ) as Promise<T>

export const state = (page: Page) => page.evaluate(() => (window as any).__spylab.state())

/** Walk-free: put the player on a spot (cash / pad / upgrade desk). */
export async function goTo(
  page: Page,
  kind: 'cash' | 'pad' | 'upgrade' | 'crate' | 'station' | 'staff' | 'serve' | 'welcome' | 'clerk',
  room: string,
  slot = 0,
): Promise<void> {
  const p = await spy<{ x: number; z: number }>(page, 'spot', kind, room, slot)
  // stations: stand just in front of the basket
  await spy(page, 'teleport', p.x, kind === 'station' ? p.z - 0.4 : p.z)
}

/** Neutral spot in the corridor (no pad, no cash). */
export const park = (page: Page) => spy(page, 'teleport', 0, 4.6)

/** Start mission 1 with a granted agent (tutorial skipped unless keepTutorial). */
export async function startFirstMission(page: Page, keepTutorial = false): Promise<void> {
  if (!keepTutorial) await spy(page, 'skipTutorial')
  await spy(page, 'grantAgent')
  await park(page)
  await page.getByTestId('bar-map').click()
  await page.getByTestId('mission-harbor_01').click()
  await page.getByTestId('btn-start-mission').click()
  await expect(page.getByTestId('mg-hud')).toBeVisible()
}

/** Play the Safe Cracker perfectly (tap when the needle is in the sweet spot). */
export async function solveSafe(page: Page): Promise<void> {
  for (let i = 0; i < 2000; i++) {
    const phase = await page.evaluate(() => (window as any).__spylab.state().mission?.phase)
    if (phase !== 'playing') return
    const off = await spy<number | null>(page, 'mgZoneOffset')
    if (off !== null && off < 0.1) {
      await spy(page, 'mgAction')
      await page.waitForTimeout(60)
    } else await page.waitForTimeout(10)
  }
}

/** Fail the Safe Cracker on purpose (tap outside the zone). */
export async function failSafe(page: Page): Promise<void> {
  for (let i = 0; i < 400; i++) {
    const phase = await page.evaluate(() => (window as any).__spylab.state().mission?.phase)
    if (phase !== 'playing') return
    const off = await spy<number | null>(page, 'mgZoneOffset')
    if (off !== null && off > 0.9) {
      await spy(page, 'mgAction')
      await page.waitForTimeout(40)
    } else await page.waitForTimeout(10)
  }
}

/** Playable academy for tests: desk, vault station + crate, kit runner, two cadets training. */
export async function trainingSetup(page: Page): Promise<void> {
  await spy(page, 'quickStart')
  await page.evaluate(() => {
    const s = (window as any).__spylab.raw()
    s.rooms.vault.stations = 2
    s.rooms.vault.supply = [4, 4]
    s.rooms.vault.runner = true
  })
  await goTo(page, 'serve', 'vault')
  await expect
    .poll(async () => (await spy<any>(page, 'raw')).cadets.filter((c: any) => c.phase === 'train').length, { timeout: 30_000 })
    .toBeGreaterThan(1)
  await park(page)
}
