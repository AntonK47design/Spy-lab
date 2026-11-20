import { test, expect, type Page } from '@playwright/test'
import { boot, expectClean, goTo, park, solveSafe, spy, startFirstMission, watch } from './helpers'

export const SIZES: [string, number, number][] = [
  ['phone-s', 360, 640],
  ['phone-m', 390, 844],
  ['phone-l', 430, 932],
  ['phone-land', 844, 390],
  ['phone-land-2', 915, 412],
  ['tablet-p', 768, 1024],
  ['tablet-l', 1024, 768],
  ['square', 640, 640],
  ['wide-s', 800, 450],
  ['hd', 1280, 720],
  ['laptop', 1366, 768],
  ['fhd', 1920, 1080],
  ['qhd', 2560, 1440],
  ['tall-9x21', 360, 840],
  ['ultrawide-21x9', 1680, 720],
]

type R = { id: string; x: number; y: number; w: number; h: number }

async function rects(page: Page, selector: string): Promise<R[]> {
  return page.$$eval(selector, (els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect()
      return { id: (e as HTMLElement).dataset.testid ?? e.className, x: r.x, y: r.y, w: r.width, h: r.height }
    }),
  )
}

function overlap(a: R, b: R): boolean {
  return a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5
}

export async function assertLayout(page: Page, w: number, h: number, selector: string) {
  const scroll = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    sh: document.documentElement.scrollHeight,
    iw: innerWidth,
    ih: innerHeight,
  }))
  expect(scroll.sw).toBeLessThanOrEqual(scroll.iw)
  expect(scroll.sh).toBeLessThanOrEqual(scroll.ih)
  const rs = await rects(page, selector)
  for (const r of rs) {
    expect(r.x, `${r.id} left`).toBeGreaterThanOrEqual(0)
    expect(r.y, `${r.id} top`).toBeGreaterThanOrEqual(0)
    expect(r.x + r.w, `${r.id} right`).toBeLessThanOrEqual(w + 0.5)
    expect(r.y + r.h, `${r.id} bottom`).toBeLessThanOrEqual(h + 0.5)
  }
  for (let i = 0; i < rs.length; i++)
    for (let j = i + 1; j < rs.length; j++)
      expect(overlap(rs[i]!, rs[j]!), `${rs[i]!.id} overlaps ${rs[j]!.id}`).toBe(false)
  // text clipped? (scrollWidth > clientWidth on any visible text element)
  const clipped = await page.$$eval(`${selector}, ${selector} *`, (els) =>
    els
      .filter((e) => e instanceof HTMLElement && e.children.length === 0 && e.textContent?.trim())
      .filter((e) => (e as HTMLElement).scrollWidth > (e as HTMLElement).clientWidth + 1)
      .map((e) => e.textContent),
  )
  expect(clipped, `clipped text: ${clipped.join(' | ')}`).toEqual([])
  const minFont = await page.$$eval(`${selector} *`, (els) =>
    Math.min(...els.filter((e) => e.textContent?.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize))),
  )
  expect(minFont).toBeGreaterThanOrEqual(10)
}

const HUD = '[data-testid^="hud-"], [data-testid^="bar-"], [data-testid="coach"]'

async function shot(page: Page, lang: string, name: string, screen: string, w: number, h: number) {
  if (lang === 'en') await page.screenshot({ path: `tests/screenshots/${screen}-${name}-${w}x${h}.png` })
}

for (const lang of ['en', 'de', 'ru']) {
  for (const [name, w, h] of SIZES) {
    test(`${lang} ${name} ${w}x${h}`, async ({ page }) => {
      test.setTimeout(w > 2000 ? 600_000 : 240_000)
      const wt = watch(page)
      await page.setViewportSize({ width: w, height: h })
      // the software renderer of the test machine is very slow at QHD: low quality keeps the run in time
      await boot(page, '', lang === 'en' && w < 2000 ? 'auto' : 'low')
      if (lang !== 'en') {
        await page.getByTestId('bar-settings').click()
        await page.getByTestId(`lang-${lang}`).click()
        await page.getByTestId('btn-close').click()
      }
      await page.waitForTimeout(700)
      await assertLayout(page, w, h, HUD)
      await shot(page, lang, name, 'academy', w, h)

      await page.getByTestId('bar-settings').click()
      await page.waitForTimeout(250)
      await expect(page.getByTestId('panel-settings').getByTestId('btn-close')).toBeInViewport({ ratio: 0.99 })
      await assertLayout(page, w, h, '[data-testid="panel-settings"]')
      await shot(page, lang, name, 'settings', w, h)
      await page.getByTestId('btn-close').click()

      await spy(page, 'quickStart') // the office desk exists once a station is built
      await spy(page, 'addCurrency', 'cash', 50)
      await goTo(page, 'upgrade', 'vault')
      await expect(page.getByTestId('panel-upgrade')).toBeVisible()
      await page.waitForTimeout(250)
      await expect(page.getByTestId('panel-upgrade').getByTestId('btn-close')).toBeInViewport({ ratio: 0.99 })
      await assertLayout(page, w, h, '[data-testid="panel-upgrade"]')
      await shot(page, lang, name, 'upgrade', w, h)
      await page.getByTestId('btn-close').click()

      await startFirstMission(page)
      await page.waitForTimeout(400)
      await assertLayout(page, w, h, '[data-testid="btn-mg-pause"], [data-testid="btn-mg-tap"]')
      await shot(page, lang, name, 'safe', w, h)
      await solveSafe(page)
      await expect(page.getByTestId('panel-result')).toBeVisible()
      await page.waitForTimeout(600)
      await assertLayout(page, w, h, '[data-testid="panel-result"]')
      await shot(page, lang, name, 'result', w, h)
      await page.getByTestId('btn-continue').click()

      await park(page)
      await page.getByTestId('bar-map').click()
      await page.waitForTimeout(250)
      await assertLayout(page, w, h, '[data-testid="panel-missions"]')
      await shot(page, lang, name, 'missions', w, h)
      expectClean(wt)
    })
  }
}
