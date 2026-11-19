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

export async function boot(page: Page, query = ''): Promise<number> {
  const t0 = Date.now()
  await page.goto(`/?debug=1${query}`)
  await page.waitForFunction(() => (window as any).__spylab?.boot?.game_ready, null, { timeout: 15_000 })
  return Date.now() - t0
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
